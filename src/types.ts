import type { Effect, Schema } from 'effect'
import type {
  ClassifiedInvoiceItemSchema,
  ClassifiedInvoiceSchema,
  ConflictLineSchema,
  ConflictReportInputSchema,
  ConflictReportSchema,
  ContributorSchema,
  InvoiceSchema,
  TaxCategorySchema,
} from './schemas.js'
import type { GetFiscalInfoTool } from './tools/get-fiscal-info.js'
import type { ParseInvoiceXmlTool } from './tools/parse-invoice-xml.js'
import type { SaveConflictReportTool } from './tools/save-conflict-report.js'
import type { SaveInvoiceInfoTool } from './tools/save-invoice-info.js'

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
export type ToolEffect =
  | ReturnType<GetFiscalInfoTool['execute']>
  | ReturnType<ParseInvoiceXmlTool['execute']>
  | ReturnType<SaveInvoiceInfoTool['execute']>
  | ReturnType<SaveConflictReportTool['execute']>

export type ExecuteEffect = Effect.Effect<
  Effect.Effect.Success<ToolEffect>,
  Effect.Effect.Error<ToolEffect>,
  Effect.Effect.Context<ToolEffect>
>

export type ConflictLine = Schema.Schema.Type<typeof ConflictLineSchema>
export type ConflictReportInput = Schema.Schema.Type<typeof ConflictReportInputSchema>
export type ConflictReport = Schema.Schema.Type<typeof ConflictReportSchema>

export type Contributor = typeof ContributorSchema

export type Invoice = Schema.Schema.Type<typeof InvoiceSchema>
export type TaxCategory = Schema.Schema.Type<typeof TaxCategorySchema>
export type ClassifiedInvoiceItem = Schema.Schema.Type<typeof ClassifiedInvoiceItemSchema>
export type ClassifiedInvoice = Schema.Schema.Type<typeof ClassifiedInvoiceSchema>

export interface ToolDefinition {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export interface InvoiceOutcome {
  readonly successLines: number
  readonly conflictLines: readonly ConflictLine[]
}
