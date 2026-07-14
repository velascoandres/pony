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

export const SriWEstablishmentRaw = Schema.Struct({
  numeroEstablecimiento: Schema.optional(Schema.String),
  nombreFantasiaComercial: Schema.optional(Schema.String),
  direccionCompleta: Schema.optional(Schema.String),
  estado: Schema.optional(Schema.String),
  matriz: Schema.optional(Schema.String), // "SI" | "NO"
})

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

export const InvoiceSchema = Schema.Struct({
  accessKey: Schema.String, // claveAcceso — 49 chars, unique per invoice
  ruc: Schema.String,
  businessName: Schema.String,
  branchCode: Schema.String, // estab: "002"
  invoiceNumber: Schema.String, // "estab-ptoEmi-secuencial": "002-030-000123456"
  date: Schema.String,
  items: Schema.Array(
    Schema.Struct({
      description: Schema.String,
      quantity: Schema.Number,
      unitPrice: Schema.Number,
      subtotal: Schema.Number, // precioTotalSinImpuesto
      vatRate: Schema.Number, // 0, 12, 15
      vatAmount: Schema.Number,
    }),
  ),
  subtotal: Schema.Number,
  iva: Schema.Number,
  total: Schema.Number,
})

export type Contributor = typeof ContributorSchema

export type Invoice = Schema.Schema.Type<typeof InvoiceSchema>
