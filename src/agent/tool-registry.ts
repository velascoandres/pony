import type { ToolDefinition } from '../types.js'

const TAX_CATEGORIES = [
  'VIVIENDA',
  'SALUD',
  'EDUCACION',
  'ALIMENTACION',
  'VESTIMENTA',
  'TURISMO',
  'NEGOCIO',
  'NO_DEDUCIBLE',
]

const PARSE_INVOICE_TOOL: ToolDefinition = {
  name: 'parse_invoice_tool',
  description:
    'Read an invoice XML file from disk and extract its structured data: access key, RUC, business name, branch code, invoice number, date, line items, subtotal, IVA and total.',
  input_schema: {
    type: 'object',
    properties: {
      invoiceFilePath: {
        type: 'string',
        description: 'Absolute path of the invoice XML file to parse.',
      },
    },
    required: ['invoiceFilePath'],
  },
}

const GET_FISCAL_INVOICE_TOOL: ToolDefinition = {
  name: 'get_fiscal_invoice_tool',
  description:
    'Look up a contributor in the SRI registry by RUC to obtain its economic activity and fiscal status. Use it to resolve ambiguous line descriptions and to detect suspended or passive issuers.',
  input_schema: {
    type: 'object',
    properties: {
      ruc: {
        type: 'string',
        description: 'The 13-digit RUC of the invoice issuer.',
      },
    },
    required: ['ruc'],
  },
}

// The line shape mirrors ClassifiedInvoiceItemSchema — the agent decodes this
// input through that schema before persisting it.
const CLASSIFIED_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    description: { type: 'string' },
    quantity: { type: 'number' },
    unitPrice: { type: 'number' },
    subtotal: { type: 'number' },
    vatRate: { type: 'number' },
    vatAmount: { type: 'number' },
    taxCategory: { type: 'string', enum: TAX_CATEGORIES },
    confidence: {
      type: 'number',
      description: 'Confidence in the assigned category, between 0 and 1.',
    },
    warning: {
      type: 'string',
      description: 'Optional caveat, e.g. "emisor no activo en SRI".',
    },
  },
  required: [
    'description',
    'quantity',
    'unitPrice',
    'subtotal',
    'vatRate',
    'vatAmount',
    'taxCategory',
    'confidence',
  ],
}

const SAVE_INVOICE_INFO_TOOL: ToolDefinition = {
  name: 'save_invoice_info_tool',
  description:
    'Persist the parsed and fully classified invoice into the database. Every line must carry a taxCategory and a confidence. Call this exactly once per invoice, as the final step.',
  input_schema: {
    type: 'object',
    properties: {
      invoiceInfo: {
        type: 'object',
        description: 'The parsed invoice, with every line classified.',
        properties: {
          accessKey: { type: 'string' },
          ruc: { type: 'string' },
          businessName: { type: 'string' },
          branchCode: { type: 'string' },
          invoiceNumber: { type: 'string' },
          date: { type: 'string' },
          items: { type: 'array', items: CLASSIFIED_ITEM_SCHEMA },
          subtotal: { type: 'number' },
          iva: { type: 'number' },
          total: { type: 'number' },
        },
        required: [
          'accessKey',
          'ruc',
          'businessName',
          'branchCode',
          'invoiceNumber',
          'date',
          'items',
          'subtotal',
          'iva',
          'total',
        ],
      },
    },
    required: ['invoiceInfo'],
  },
}

// save_conflict_report_tool is intentionally absent: the agent loop collects the
// low-confidence lines across every invoice and writes the report itself once
// the whole run finishes.
export const ALL_TOOL_DEFINITIONS: ToolDefinition[] = [
  PARSE_INVOICE_TOOL,
  GET_FISCAL_INVOICE_TOOL,
  SAVE_INVOICE_INFO_TOOL,
]
