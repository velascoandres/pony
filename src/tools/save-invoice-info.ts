import { Console, Effect } from 'effect'
import { InvoiceService } from '../services/invoice.service.js'
import type { ClassifiedInvoice } from '../types.js'

export class SaveInvoiceInfoTool extends Effect.Service<SaveInvoiceInfoTool>()(
  'app/SaveInvoiceInfoTool',
  {
    effect: Effect.gen(function* () {
      const invoiceService = yield* InvoiceService

      return {
        execute: (invoice: ClassifiedInvoice) =>
          Effect.gen(function* () {
            // Save invoice to database
            const result = yield* invoiceService.createInvoice(invoice)

            const { items, ...header } = invoice

            yield* Console.log(`\n✔ Invoice saved · ID ${result.invoiceId}`)

            yield* Console.table(header).pipe(Console.withGroup({ label: 'Invoice Info' }))

            yield* Console.table(items).pipe(
              Console.withGroup({ label: `Invoice Items (${items.length})` }),
            )
          }),
      }
    }),
  },
) {}
