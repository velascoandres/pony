import type { ToolDefinition } from '../schemas.js'

const PARSE_INVOICE_TOOL: ToolDefinition = {
  name: 'parse_invoice_tool',
  description:
    'Parse an invoice from a XLM content and extract relevant information such as access key, RUC, business name, branch code, invoice number, date, items, subtotal, IVA, and total.',
  input_schema: {
    type: 'object',
    properties: {
      invoiceContent: {
        type: 'string',
        description: 'The XML content of the invoice to be parsed.',
      },
    },
    required: ['invoiceContent'],
  },
}

const GET_FISCAL_INVOICE_TOOL: ToolDefinition = {
  name: 'get_fiscal_invoice_tool',
  description: 'Retrieve a fiscal invoice from the SRI API using the provided ruc.',
  input_schema: {
    type: 'object',
    properties: {
      ruc: {
        type: 'string',
        description: 'The ruc of the contributor for which to retrieve the fiscal invoice.',
      },
    },
    required: ['ruc'],
  },
}

const SAVE_INVOICE_INFO_TOOL: ToolDefinition = {
  name: 'save_invoice_info_tool',
  description: 'Save the parsed invoice information into the database.',
  input_schema: {
    type: 'object',
    properties: {
      invoiceInfo: {
        type: 'object',
        description: 'The parsed invoice information to be saved.',
      },
    },
    required: ['invoiceInfo'],
  },
}

export const ALL_TOOL_DEFINITIONS: ToolDefinition[] = [
  PARSE_INVOICE_TOOL,
  GET_FISCAL_INVOICE_TOOL,
  SAVE_INVOICE_INFO_TOOL,
]
