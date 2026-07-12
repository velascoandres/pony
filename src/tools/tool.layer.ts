import { Layer } from 'effect'
import { GetFiscalInfoTool } from './get-fiscal-info.js'
import { ParseInvoiceXmlTool } from './parse-invoice-xml.js'

export const ToolsLayer = Layer.mergeAll(GetFiscalInfoTool.Default, ParseInvoiceXmlTool.Default)
