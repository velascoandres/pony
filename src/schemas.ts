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

export type SriContributorRaw = Schema.Schema.Type<typeof SriContributorRaw>

export const SriWEstablishmentRaw = Schema.Struct({
  numeroEstablecimiento: Schema.optional(Schema.String),
  nombreFantasiaComercial: Schema.optional(Schema.String),
  direccionCompleta: Schema.optional(Schema.String),
  estado: Schema.optional(Schema.String),
  matriz: Schema.optional(Schema.String), // "SI" | "NO"
})

export type SriWEstablishmentRaw = Schema.Schema.Type<typeof SriWEstablishmentRaw>
