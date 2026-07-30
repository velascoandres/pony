import { Console, Effect, Schema } from 'effect'
import { DbClient } from '../db/client.js'
import { DatabaseError, ResolutionError } from '../errors.js'
import {
  CategoryExpenseReportSchema,
  DEDUCTIBLE_CATEGORIES,
  InvoiceSchema,
  isDeductibleCategory,
} from '../schemas.js'
import type {
  IdentifiedInvoice,
  LineResolution,
  ResolvedLine,
  SaveInvoiceResult,
  TaxCategory,
} from '../types.js'

// Header and total must reconcile within one cent to be considered balanced.
const BALANCE_TOLERANCE = 0.01

// The agent decides deductibility per line, but the catalogue has the last word:
// a category that is not an SRI rubro can never be stored as deductible (the
// same rule the CHECK constraint on invoice_lines enforces). It applies to a
// human verdict too — the DB would reject it either way.
const toDeductibleFlag = (line: {
  readonly taxCategory: TaxCategory
  readonly isDeductible: boolean
}) => (line.isDeductible && isDeductibleCategory(line.taxCategory) ? 1 : 0)

// A line the user classified by hand is ground truth: full confidence, method
// HUMANO, and a rationale prefixed with this marker so the stored reasoning says
// where the decision came from.
const MANUAL_TAG = '[MANUAL-TAGGED]'
const MANUAL_CONFIDENCE = 1

// Keep the agent's original wording behind the marker — it is the reasoning the
// human was reviewing. Prefixing is idempotent so re-applying the same
// resolution file does not stack markers.
const toManualRationale = (rationale: string | null): string => {
  const previous = rationale?.trim() ?? ''
  if (previous.startsWith(MANUAL_TAG)) return previous
  return previous.length > 0 ? `${MANUAL_TAG} ${previous}` : MANUAL_TAG
}

// Inlined into the report query so the SQL splits rubros exactly like the TS
// catalogue does.
const DEDUCTIBLE_CATEGORIES_SQL = DEDUCTIBLE_CATEGORIES.map((c) => `'${c}'`).join(', ')

export class InvoiceService extends Effect.Service<InvoiceService>()('app/InvoiceService', {
  effect: Effect.gen(function* () {
    const dbClient = yield* DbClient

    return {
      createInvoice: (invoiceData: IdentifiedInvoice) =>
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

          // 3. Insert each detail line together with the category the agent
          //    assigned, so the line leaves the pending queue (idx_lines_pending).
          //    The line already knows its id — it was minted when the invoice
          //    entered the domain — so nothing here depends on lastInsertRowid.
          yield* Effect.forEach(
            invoiceData.items,
            (item, index) =>
              dbClient.executeSql(
                `INSERT INTO invoice_lines
                   (id, invoice_id, line_number, description, quantity, unit_price,
                    subtotal, vat_rate, vat_amount,
                    tax_category, is_deductible, method, confidence, rationale)
                 VALUES
                   (@invoiceLineId, @invoiceId, @lineNumber, @description, @quantity, @unitPrice,
                    @subtotal, @vatRate, @vatAmount,
                    @taxCategory, @isDeductible, 'LLM', @confidence, @rationale)`,
                {
                  invoiceLineId: item.invoiceLineId,
                  invoiceId,
                  lineNumber: index + 1,
                  description: item.description,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  subtotal: item.subtotal,
                  vatRate: item.vatRate,
                  vatAmount: item.vatAmount,
                  taxCategory: item.taxCategory,
                  isDeductible: toDeductibleFlag(item),
                  confidence: item.confidence,
                  rationale: item.rationale,
                },
              ),
            { discard: true },
          )

          yield* Console.log(
            `Invoice created with id ${invoiceId} (${invoiceData.items.length} lines)`,
          )

          const saved: SaveInvoiceResult = { invoiceId, isBalanced: isBalanced === 1 }
          return saved
        }).pipe(Effect.tapError((error) => Console.error(`Failed to create invoice: ${error}`))),
      // Apply one human verdict to one line. The user has already looked at the
      // line, so the stored classification becomes fully confident and HUMANO —
      // the agent's confidence score no longer means anything for it.
      resolveInvoiceLine: (resolution: LineResolution) =>
        Effect.gen(function* () {
          const [line] = yield* dbClient.query<{
            description: string
            taxCategory: TaxCategory | null
            rationale: string | null
            invoiceNumber: string
          }>(
            `SELECT l.description      AS description,
                    l.tax_category     AS taxCategory,
                    l.rationale        AS rationale,
                    i.invoice_number   AS invoiceNumber
             FROM invoice_lines l
             JOIN invoices i ON i.id = l.invoice_id
             WHERE l.id = @invoiceLineId`,
            { invoiceLineId: resolution.invoiceLineId },
          )

          // A typo in the resolution file must not pass silently as a no-op
          // UPDATE: nothing would change and the user would never know.
          if (line === undefined) {
            return yield* new ResolutionError({
              message: `Invoice line ${resolution.invoiceLineId} does not exist`,
            })
          }

          const isDeductible = toDeductibleFlag({
            taxCategory: resolution.category,
            isDeductible: resolution.isDeductible,
          })

          yield* dbClient.executeSql(
            `UPDATE invoice_lines
             SET tax_category  = @taxCategory,
                 is_deductible = @isDeductible,
                 method        = 'HUMANO',
                 confidence    = @confidence,
                 rationale     = @rationale
             WHERE id = @invoiceLineId`,
            {
              taxCategory: resolution.category,
              isDeductible,
              confidence: MANUAL_CONFIDENCE,
              rationale: toManualRationale(line.rationale),
              invoiceLineId: resolution.invoiceLineId,
            },
          )

          yield* Console.log(
            `Line ${resolution.invoiceLineId} (${line.invoiceNumber}): ${line.taxCategory ?? 'SIN CATEGORIA'} -> ${resolution.category}`,
          )

          const resolved: ResolvedLine = {
            invoiceLineId: resolution.invoiceLineId,
            invoiceNumber: line.invoiceNumber,
            description: line.description,
            previousCategory: line.taxCategory,
            category: resolution.category,
            isDeductible: isDeductible === 1,
          }
          return resolved
        }).pipe(
          Effect.tapError((error) =>
            Console.error(`Failed to resolve line ${resolution.invoiceLineId}: ${error.message}`),
          ),
        ),
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
      getExpenseReportByCategory: () =>
        Effect.gen(function* () {
          yield* Console.log('Building general expense report by category')

          // Aggregate the classified lines by category. Only balanced invoices
          // (is_balanced = 1) and already-classified lines (tax_category NOT
          // NULL — see idx_lines_pending) count towards the report. Rounding to
          // two decimals keeps the summed cents from drifting into float noise.
          // `deductibleCategory` lets the report group the rubros into the SRI
          // block and the non-deductible breakdown.
          const rows = yield* dbClient.query<{
            category: TaxCategory
            deductibleCategory: 0 | 1
            lineCount: number
            base: number
            vat: number
            total: number
            deductible: number
            nonDeductible: number
          }>(
            `SELECT l.tax_category                            AS category,
                    CASE WHEN l.tax_category IN (${DEDUCTIBLE_CATEGORIES_SQL})
                         THEN 1 ELSE 0 END                    AS deductibleCategory,
                    COUNT(*)                                  AS lineCount,
                    ROUND(SUM(l.subtotal), 2)                 AS base,
                    ROUND(SUM(l.vat_amount), 2)               AS vat,
                    ROUND(SUM(l.subtotal + l.vat_amount), 2)  AS total,
                    ROUND(SUM(CASE WHEN l.is_deductible = 1
                                   THEN l.subtotal ELSE 0 END), 2) AS deductible,
                    ROUND(SUM(CASE WHEN l.is_deductible = 0
                                   THEN l.subtotal ELSE 0 END), 2) AS nonDeductible
             FROM invoice_lines l
             JOIN invoices i ON i.id = l.invoice_id
             WHERE l.tax_category IS NOT NULL
               AND i.is_balanced = 1
             GROUP BY l.tax_category
             ORDER BY deductibleCategory DESC, total DESC`,
          )

          const report = yield* Schema.decodeUnknown(CategoryExpenseReportSchema)(rows).pipe(
            Effect.mapError((cause) => new DatabaseError({ message: String(cause) })),
          )

          yield* Console.log(`Expense report built with ${report.length} categories`)
          return report
        }).pipe(
          Effect.tapError((error) => Console.error(`Failed to build expense report: ${error}`)),
        ),
    }
  }),
}) {}
