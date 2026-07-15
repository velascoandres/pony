import { Effect, Match } from 'effect'
import { UnknownToolError } from '../errors.js'
import { GetFiscalInfoTool } from '../tools/get-fiscal-info.js'
import { ParseInvoiceXmlTool } from '../tools/parse-invoice-xml.js'
import { SaveConflictReportTool } from '../tools/save-conflict-report.js'
import { SaveInvoiceInfoTool } from '../tools/save-invoice-info.js'

export type ToolCall =
  | { toolName: 'get_fiscal_invoice_tool'; input: Parameters<GetFiscalInfoTool['execute']>[0] }
  | { toolName: 'parse_invoice_tool'; input: Parameters<ParseInvoiceXmlTool['execute']>[0] }
  | { toolName: 'save_invoice_info_tool'; input: Parameters<SaveInvoiceInfoTool['execute']>[0] }
  | {
      toolName: 'save_conflict_report_tool'
      input: Parameters<SaveConflictReportTool['execute']>[0]
    }

export const ToolExecuter = Effect.gen(function* () {
  const getFiscalInfoTool = yield* GetFiscalInfoTool
  const parseInvoiceXmlTool = yield* ParseInvoiceXmlTool
  const saveInvoiceInfoTool = yield* SaveInvoiceInfoTool
  const saveConflictReportTool = yield* SaveConflictReportTool

  return {
    execute: (call: ToolCall) =>
      Effect.gen(function* () {
        Match.value(call).pipe(
          Match.when({ toolName: 'get_fiscal_invoice_tool' }, (toolCall) =>
            getFiscalInfoTool.execute(toolCall.input),
          ),
          Match.when({ toolName: 'parse_invoice_tool' }, (toolCall) =>
            parseInvoiceXmlTool.execute(toolCall.input),
          ),
          Match.when({ toolName: 'save_invoice_info_tool' }, (toolCall) =>
            saveInvoiceInfoTool.execute(toolCall.input),
          ),
          Match.when({ toolName: 'save_conflict_report_tool' }, (toolCall) =>
            saveConflictReportTool.execute(toolCall.input),
          ),
          Match.orElse(() =>
            Effect.fail(new UnknownToolError({ message: `Unknown tool: ${call}` })),
          ),
        )
      }),
  }
})
