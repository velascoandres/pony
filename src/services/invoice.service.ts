import { Console, Effect, Schema } from 'effect'
import { DbClient } from '../db/client.js'
import { DatabaseError } from '../errors.js'
import { type Invoice, InvoiceSchema } from './../schemas.js'

// Header and total must reconcile within one cent to be considered balanced.
const BALANCE_TOLERANCE = 0.01

export class InvoiceService extends Effect.Service<InvoiceService>()('app/InvoiceService', {
  effect: Effect.gen(function* () {
    const dbClient = yield* DbClient

    return {
      createInvoice: (invoiceData: Invoice) =>
        Effect.gen(function* () {
          yield* Console.log(`Creating invoice ${invoiceData.invoiceNumber} (${invoiceData.ruc})`)

          // 1. Upsert supplier first: invoices.supplier_ruc has a FK to
          //    suppliers(ruc) and foreign_keys are ON.
          yield* dbClient.executeSql(
            `INSERT INTO suppliers (ruc, legal_name)
             VALUES (@ruc, @legalName)
             ON CONFLICT(ruc) DO UPDATE SET
               legal_name = excluded.legal_name,
               updated_at = datetime('now')`,
            { ruc: invoiceData.ruc, legalName: invoiceData.businessName },
          )

          // 2. Insert the invoice header.
          const isBalanced =
            Math.abs(invoiceData.subtotal + invoiceData.iva - invoiceData.total) <=
            BALANCE_TOLERANCE
              ? 1
              : 0

          const result = yield* dbClient.executeSql(
            `INSERT INTO invoices
               (access_key, supplier_ruc, branch_code, invoice_number,
                issue_date, subtotal, vat, total, is_balanced)
             VALUES
               (@accessKey, @ruc, @branchCode, @invoiceNumber,
                @date, @subtotal, @iva, @total, @isBalanced)`,
            {
              accessKey: invoiceData.accessKey,
              ruc: invoiceData.ruc,
              branchCode: invoiceData.branchCode,
              invoiceNumber: invoiceData.invoiceNumber,
              date: invoiceData.date,
              subtotal: invoiceData.subtotal,
              iva: invoiceData.iva,
              total: invoiceData.total,
              isBalanced,
            },
          )

          const invoiceId = Number(result.lastInsertRowid)

          // 3. Insert each detail line. Classification columns stay NULL so the
          //    agent queue (idx_lines_pending) picks them up later.
          yield* Effect.forEach(
            invoiceData.items,
            (item, index) =>
              dbClient.executeSql(
                `INSERT INTO invoice_lines
                   (invoice_id, line_number, description, quantity, unit_price,
                    subtotal, vat_rate, vat_amount)
                 VALUES
                   (@invoiceId, @lineNumber, @description, @quantity, @unitPrice,
                    @subtotal, @vatRate, @vatAmount)`,
                {
                  invoiceId,
                  lineNumber: index + 1,
                  description: item.description,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  subtotal: item.subtotal,
                  vatRate: item.vatRate,
                  vatAmount: item.vatAmount,
                },
              ),
            { discard: true },
          )

          yield* Console.log(
            `Invoice created with id ${invoiceId} (${invoiceData.items.length} lines)`,
          )

          return { success: true, invoiceId, isBalanced: isBalanced === 1 }
        }).pipe(Effect.tapError((error) => Console.error(`Failed to create invoice: ${error}`))),
      getInvoicesBySupplier: (ruc: string) =>
        Effect.gen(function* () {
          yield* Console.log(`Fetching invoices for supplier ${ruc}`)

          // Header rows joined to the supplier for businessName. NULL-able
          // columns are coalesced so the schema (which requires them) decodes.
          const headers = yield* dbClient.query<{
            id: number
            accessKey: string
            ruc: string
            businessName: string
            branchCode: string
            invoiceNumber: string
            date: string
            subtotal: number
            iva: number
            total: number
          }>(
            `SELECT i.id                        AS id,
                    i.access_key                AS accessKey,
                    i.supplier_ruc              AS ruc,
                    s.legal_name                AS businessName,
                    COALESCE(i.branch_code, '') AS branchCode,
                    i.invoice_number            AS invoiceNumber,
                    i.issue_date                AS date,
                    i.subtotal                  AS subtotal,
                    i.vat                       AS iva,
                    i.total                     AS total
             FROM invoices i
             JOIN suppliers s ON s.ruc = i.supplier_ruc
             WHERE i.supplier_ruc = @ruc
             ORDER BY i.issue_date DESC`,
            { ruc },
          )

          // Assemble each header with its detail lines and parse the whole
          // structure through InvoiceSchema so callers get validated Invoices.
          const invoices = yield* Effect.forEach(headers, (header) =>
            Effect.gen(function* () {
              const items = yield* dbClient.query<{
                description: string
                quantity: number
                unitPrice: number
                subtotal: number
                vatRate: number
                vatAmount: number
              }>(
                `SELECT description         AS description,
                        quantity            AS quantity,
                        unit_price          AS unitPrice,
                        subtotal            AS subtotal,
                        COALESCE(vat_rate, 0)   AS vatRate,
                        vat_amount          AS vatAmount
                 FROM invoice_lines
                 WHERE invoice_id = @invoiceId
                 ORDER BY line_number`,
                { invoiceId: header.id },
              )

              const { id: _id, ...rest } = header
              return yield* Schema.decodeUnknown(InvoiceSchema)({ ...rest, items }).pipe(
                Effect.mapError((cause) => new DatabaseError({ message: String(cause) })),
              )
            }),
          )

          yield* Console.log(`Found ${invoices.length} invoices for supplier ${ruc}`)
          return invoices
        }).pipe(Effect.tapError((error) => Console.error(`Failed to fetch invoices: ${error}`))),
    }
  }),
}) {}
