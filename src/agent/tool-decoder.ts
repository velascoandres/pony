import type Anthropic from '@anthropic-ai/sdk'
import { Effect, Match, type ParseResult, Schema } from 'effect'
import { UnknownToolError } from '../errors.js'
import { GetFiscalInfoInput, ParseInvoiceInput, SaveInvoiceInfoInput } from '../schemas.js'
import type { ClassifiedInvoice, IdentifiedInvoice, ToolCall } from '../types.js'
import { generateId } from '../utils/generate-id.js'

// The model classifies the lines; the app owns their identity. Minting the ids at
// this boundary — where untrusted model output becomes a domain value — is what
// lets the INSERT and the conflict report refer to the same row without either of
// them consulting the database.
const withLineIds = (invoice: ClassifiedInvoice): Effect.Effect<IdentifiedInvoice> =>
  Effect.forEach(invoice.items, (item) =>
    generateId.pipe(Effect.map((invoiceLineId) => ({ ...item, invoiceLineId }))),
  ).pipe(Effect.map((items) => ({ ...invoice, items })))

// union to be exhaustive over — an unrecognised name falls through to orElse.
export const decodeToolCall = (
  block: Anthropic.ToolUseBlock,
): Effect.Effect<ToolCall, ParseResult.ParseError | UnknownToolError> =>
  Match.value(block.name).pipe(
    Match.when('parse_invoice_tool', () =>
      Schema.decodeUnknown(ParseInvoiceInput)(block.input).pipe(
        Effect.map(
          ({ invoiceFilePath }): ToolCall => ({
            toolName: 'parse_invoice_tool',
            input: invoiceFilePath,
          }),
        ),
      ),
    ),
    Match.when('get_fiscal_invoice_tool', () =>
      Schema.decodeUnknown(GetFiscalInfoInput)(block.input).pipe(
        Effect.map(({ ruc }): ToolCall => ({ toolName: 'get_fiscal_invoice_tool', input: ruc })),
      ),
    ),
    Match.when('save_invoice_info_tool', () =>
      Schema.decodeUnknown(SaveInvoiceInfoInput)(block.input).pipe(
        Effect.flatMap(({ invoiceInfo }) => withLineIds(invoiceInfo)),
        Effect.map(
          (invoiceInfo): ToolCall => ({
            toolName: 'save_invoice_info_tool',
            input: invoiceInfo,
          }),
        ),
      ),
    ),
    Match.orElse(() =>
      Effect.fail(new UnknownToolError({ message: `Unknown tool: ${block.name}` })),
    ),
  )
