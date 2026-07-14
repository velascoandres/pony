import { Console, Effect } from 'effect'
import type { Invoice } from '../schemas.js'
import { InvoiceService } from '../services/invoice.service.js'

export class SaveInvoiceInfoTool extends Effect.Service<SaveInvoiceInfoTool>()(
  'app/SaveInvoiceInfoTool',
  {
    effect: Effect.gen(function* () {
      const invoiceService = yield* InvoiceService

      return {
        execute: (invoice: Invoice) =>
          Effect.gen(function* () {
            // Save invoice to database
            const result = yield* invoiceService.createInvoice(invoice)

            yield* Console.log(`Invoice saved with ID: ${result.invoiceId}`)

            yield* Console.table(invoice)
          }),
      }
    }),
  },
) {}
