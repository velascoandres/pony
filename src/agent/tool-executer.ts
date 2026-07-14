import { Effect } from 'effect'
import { UnknownToolError } from '../errors.js'
import { GetFiscalInfoTool } from '../tools/get-fiscal-info.js'
import { ParseInvoiceXmlTool } from '../tools/parse-invoice-xml.js'
import { SaveInvoiceInfoTool } from '../tools/save-invoice-info.js'

export type ToolCall =
  | { toolName: 'get_fiscal_invoice_tool'; input: Parameters<GetFiscalInfoTool['execute']>[0] }
  | { toolName: 'parse_invoice_tool'; input: Parameters<ParseInvoiceXmlTool['execute']>[0] }
  | { toolName: 'save_invoice_info_tool'; input: Parameters<SaveInvoiceInfoTool['execute']>[0] }

export const ToolExecuter = Effect.gen(function* () {
  const getFiscalInfoTool = yield* GetFiscalInfoTool
  const parseInvoiceXmlTool = yield* ParseInvoiceXmlTool
  const saveInvoiceInfoTool = yield* SaveInvoiceInfoTool

  return {
    execute: (call: ToolCall) =>
      Effect.gen(function* () {
        switch (call.toolName) {
          case 'get_fiscal_invoice_tool':
            return yield* getFiscalInfoTool.execute(call.input)

          case 'parse_invoice_tool':
            return yield* parseInvoiceXmlTool.execute(call.input)

          case 'save_invoice_info_tool':
            return yield* saveInvoiceInfoTool.execute(call.input)

          default:
            return yield* Effect.fail(
              new UnknownToolError({
                message: `Unknown tool: ${call}`,
              }),
            )
        }
      }),
  }
})
