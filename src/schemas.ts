import { Schema } from 'effect'

// Raw data structures from SRI API responses
export const SriContributorRaw = Schema.Struct({
  numeroRuc: Schema.optional(Schema.String),
  razonSocial: Schema.optional(Schema.String),
  estadoContribuyenteRuc: Schema.optional(Schema.String),
  tipoContribuyente: Schema.optional(Schema.String),
  regimen: Schema.optional(Schema.String),
  actividadEconomicaPrincipal: Schema.optional(Schema.String),
  obligadoLlevarContabilidad: Schema.optional(Schema.String), // "SI" | "NO"
  agenteRetencion: Schema.optional(Schema.String),
  contribuyenteEspecial: Schema.optional(Schema.String),
  informacionFechasContribuyente: Schema.optional(
    Schema.Struct({
      fechaInicioActividades: Schema.optional(Schema.String),
    }),
  ),
})

export const SriContributorRawResponse = Schema.Array(SriContributorRaw)

export const SriWEstablishmentRaw = Schema.Struct({
  numeroEstablecimiento: Schema.optional(Schema.String),
  nombreFantasiaComercial: Schema.optional(Schema.String),
  direccionCompleta: Schema.optional(Schema.String),
  estado: Schema.optional(Schema.String),
  matriz: Schema.optional(Schema.String), // "SI" | "NO"
})

export const SriWEstablishmentRawResponse = Schema.Array(SriWEstablishmentRaw)

// Parsed data structures for internal use
export const ContributorSchema = Schema.Struct({
  ruc: Schema.String,
  businessName: Schema.String,
  status: Schema.String,
  contributorType: Schema.String,
  regime: Schema.optional(Schema.String),
  economicActivity: Schema.optional(Schema.String),
  accountingObligatory: Schema.optional(Schema.Boolean),
  retentionAgent: Schema.optional(Schema.Boolean),
  specialContributor: Schema.optional(Schema.Boolean),
  startDateActivities: Schema.optional(Schema.String),
})

export const EstablishmentSchema = Schema.Struct({
  number: Schema.String,
  commercialName: Schema.optional(Schema.String),
  address: Schema.optional(Schema.String),
  status: Schema.optional(Schema.String),
  mainOffice: Schema.optional(Schema.Boolean),
})

export const TaxPayerRegistryResultSchema = Schema.Struct({
  ok: Schema.Boolean,
  source: Schema.Union(Schema.Literal('cache'), Schema.Literal('sri')),
  contributor: Schema.optional(ContributorSchema),
  establishments: Schema.optional(Schema.Array(EstablishmentSchema)),
  error: Schema.optional(Schema.String),
})

export const InvoiceItemSchema = Schema.Struct({
  description: Schema.String,
  quantity: Schema.Number,
  unitPrice: Schema.Number,
  subtotal: Schema.Number, // precioTotalSinImpuesto
  vatRate: Schema.Number, // 0, 12, 15
  vatAmount: Schema.Number,
})

export const InvoiceSchema = Schema.Struct({
  accessKey: Schema.String, // claveAcceso — 49 chars, unique per invoice
  ruc: Schema.String,
  businessName: Schema.String,
  branchCode: Schema.String, // estab: "002"
  invoiceNumber: Schema.String, // "estab-ptoEmi-secuencial": "002-030-000123456"
  date: Schema.String,
  items: Schema.Array(InvoiceItemSchema),
  subtotal: Schema.Number,
  iva: Schema.Number,
  total: Schema.Number,
})

// The expense categories the agent may assign — mirrors the CHECK constraint on
// invoice_lines.tax_category.
export const TaxCategorySchema = Schema.Literal(
  'VIVIENDA',
  'SALUD',
  'EDUCACION',
  'ALIMENTACION',
  'VESTIMENTA',
  'TURISMO',
  'NEGOCIO',
  'NO_DEDUCIBLE',
)

// An invoice line once the agent has assigned it a category. `confidence` below
// CONFIDENCE_THRESHOLD routes the line to the conflict report.
export const ClassifiedInvoiceItemSchema = Schema.Struct({
  ...InvoiceItemSchema.fields,
  taxCategory: TaxCategorySchema,
  confidence: Schema.Number.pipe(Schema.between(0, 1)),
  // One-line justification the agent must write BEFORE settling on a category.
  // Forcing the reasoning reduces anchoring on brand names and surfaces the
  // "why" in the conflict report for the human reviewer.
  rationale: Schema.String,
  warning: Schema.optional(Schema.String),
})

export const ClassifiedInvoiceSchema = Schema.Struct({
  ...InvoiceSchema.fields,
  items: Schema.Array(ClassifiedInvoiceItemSchema),
})

// A single invoice line that could not be classified into a category.
export const ConflictLineSchema = Schema.Struct({
  invoiceNumber: Schema.String, // "estab-ptoEmi-secuencial": used to order the CSV
  description: Schema.String,
  quantity: Schema.Number,
  unitPrice: Schema.Number,
  subtotal: Schema.Number,
  reason: Schema.optional(Schema.String), // why it could not be classified
  rationale: Schema.optional(Schema.String), // the agent's own justification for the (uncertain) category
})

export const ConflictReportInputSchema = Schema.Struct({
  successLines: Schema.Number,
  conflictLines: Schema.Array(ConflictLineSchema),
  outputDir: Schema.optional(Schema.String),
})

// The JSON report describing the outcome of a classification run.
export const ConflictReportSchema = Schema.Struct({
  successLines: Schema.Number,
  conflictLines: Schema.Number,
  conflictFile: Schema.optional(Schema.String), // path to the CSV of conflicts
  date: Schema.String, // ISO timestamp of when the report was generated
})

// Tool inputs arrive as untrusted model output — decode them before use.
export const ParseInvoiceInput = Schema.Struct({ invoiceFilePath: Schema.String })
export const GetFiscalInfoInput = Schema.Struct({ ruc: Schema.String })
export const SaveInvoiceInfoInput = Schema.Struct({ invoiceInfo: ClassifiedInvoiceSchema })
