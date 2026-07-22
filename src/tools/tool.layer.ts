import { Layer } from 'effect'
import { GetFiscalInfoTool } from './get-fiscal-info.js'
import { ParseInvoiceXmlTool } from './parse-invoice-xml.js'
import { SaveConflictReportTool } from './save-conflict-report.js'
import { SaveExpenseReportTool } from './save-expense-report.js'
import { SaveInvoiceInfoTool } from './save-invoice-info.js'

export const ToolsLayer = Layer.mergeAll(
  GetFiscalInfoTool.Default,
  ParseInvoiceXmlTool.Default,
  SaveInvoiceInfoTool.Default,
  SaveConflictReportTool.Default,
  SaveExpenseReportTool.Default,
)
