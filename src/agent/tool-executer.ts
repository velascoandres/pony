import { Effect, Match } from 'effect'
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

// Every effect a tool can return. Deriving the executer's signature from these
// keeps the error and requirement channels correct as the tools evolve.
type ToolEffect =
  | ReturnType<GetFiscalInfoTool['execute']>
  | ReturnType<ParseInvoiceXmlTool['execute']>
  | ReturnType<SaveInvoiceInfoTool['execute']>
  | ReturnType<SaveConflictReportTool['execute']>

type ExecuteEffect = Effect.Effect<
  Effect.Effect.Success<ToolEffect>,
  Effect.Effect.Error<ToolEffect>,
  Effect.Effect.Context<ToolEffect>
>

export const ToolExecuter = Effect.gen(function* () {
  const getFiscalInfoTool = yield* GetFiscalInfoTool
  const parseInvoiceXmlTool = yield* ParseInvoiceXmlTool
  const saveInvoiceInfoTool = yield* SaveInvoiceInfoTool
  const saveConflictReportTool = yield* SaveConflictReportTool

  return {
    // Match.discriminator narrows on `toolName`, so each tool receives its own
    // input type with no cast. Match.exhaustive makes a forgotten tool a
    // compile error rather than a runtime surprise.
    execute: (call: ToolCall): ExecuteEffect =>
      Match.value(call).pipe(
        Match.discriminator('toolName')('get_fiscal_invoice_tool', (toolCall) =>
          getFiscalInfoTool.execute(toolCall.input),
        ),
        Match.discriminator('toolName')('parse_invoice_tool', (toolCall) =>
          parseInvoiceXmlTool.execute(toolCall.input),
        ),
        Match.discriminator('toolName')('save_invoice_info_tool', (toolCall) =>
          saveInvoiceInfoTool.execute(toolCall.input),
        ),
        Match.discriminator('toolName')('save_conflict_report_tool', (toolCall) =>
          saveConflictReportTool.execute(toolCall.input),
        ),
        Match.exhaustive,
      ),
  }
})
