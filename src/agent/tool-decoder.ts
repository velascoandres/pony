// `block.name` is an open string coming from the model, so there is no closed

import type Anthropic from '@anthropic-ai/sdk'
import { Effect, Match, type ParseResult, Schema } from 'effect'
import { UnknownToolError } from '../errors.js'
import { ClassifiedInvoiceSchema } from '../schemas.js'
import type { ToolCall } from './tool-executer.js'

// Tool inputs arrive as untrusted model output — decode them before use.
const ParseInvoiceInput = Schema.Struct({ invoiceFilePath: Schema.String })
const GetFiscalInfoInput = Schema.Struct({ ruc: Schema.String })
const SaveInvoiceInfoInput = Schema.Struct({ invoiceInfo: ClassifiedInvoiceSchema })

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
        Effect.map(
          ({ invoiceInfo }): ToolCall => ({
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
