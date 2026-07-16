import { Effect, Match } from 'effect'
import { GetFiscalInfoTool } from '../tools/get-fiscal-info.js'
import { ParseInvoiceXmlTool } from '../tools/parse-invoice-xml.js'
import { SaveConflictReportTool } from '../tools/save-conflict-report.js'
import { SaveInvoiceInfoTool } from '../tools/save-invoice-info.js'
import type { ExecuteEffect, ToolCall } from '../types.js'

export const ToolExecuter = Effect.gen(function* () {
  const getFiscalInfoTool = yield* GetFiscalInfoTool
  const parseInvoiceXmlTool = yield* ParseInvoiceXmlTool
  const saveInvoiceInfoTool = yield* SaveInvoiceInfoTool
  const saveConflictReportTool = yield* SaveConflictReportTool

  return {
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
