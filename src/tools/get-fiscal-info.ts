import { Effect, Schema } from 'effect'
import {
  type ContributorSchema,
  type EstablishmentSchema,
  type SriContributorRaw,
  type SriWEstablishmentRaw,
  TaxPayerRegistryResultSchema,
} from './../schemas.js'
import { SriService } from '../services/sri.service.js'
import { validateRuc } from '../utils/validate-ruc.js'

type SriContributor = Schema.Schema.Type<typeof SriContributorRaw>
type SriEstablishment = Schema.Schema.Type<typeof SriWEstablishmentRaw>
type Contributor = Schema.Schema.Type<typeof ContributorSchema>
type Establishment = Schema.Schema.Type<typeof EstablishmentSchema>

const parseYesNo = (value: string | undefined): boolean | undefined =>
  value === undefined ? undefined : value.toUpperCase() === 'SI'

const mapContributor = (raw: SriContributor): Contributor => ({
  ruc: raw.numeroRuc ?? '',
  businessName: raw.razonSocial ?? '',
  status: raw.estadoContribuyenteRuc ?? '',
  contributorType: raw.tipoContribuyente ?? '',
  regime: raw.regimen,
  economicActivity: raw.actividadEconomicaPrincipal,
  accountingObligatory: parseYesNo(raw.obligadoLlevarContabilidad),
  retentionAgent: parseYesNo(raw.agenteRetencion),
  specialContributor: parseYesNo(raw.contribuyenteEspecial),
  startDateActivities: raw.informacionFechasContribuyente?.fechaInicioActividades,
})

const mapEstablishment = (raw: SriEstablishment): Establishment => ({
  number: raw.numeroEstablecimiento ?? '',
  commercialName: raw.nombreFantasiaComercial,
  address: raw.direccionCompleta,
  status: raw.estado,
  mainOffice: parseYesNo(raw.matriz),
})

export class GetFiscalInfoTool extends Effect.Service<GetFiscalInfoTool>()(
  'app/GetFiscalInfoTool',
  {
    // SriService es transversal: se declara como requerimiento (R) y se
    // provee una sola vez en el MainLayer, no como dependency privada.
    effect: Effect.gen(function* () {
      return {
        execute: (ruc: string) =>
          Effect.gen(function* () {
            const validatedRuc = yield* validateRuc(ruc)
            const sriService = yield* SriService

            const [contributor, establishment] = yield* Effect.all([
              sriService.getContrib(validatedRuc),
              sriService.getEstablishment(validatedRuc),
            ])

            // Parse contributor and establishment to TaxPayerRegistryResultSchema
            return yield* Schema.decode(TaxPayerRegistryResultSchema)({
              ok: true,
              source: 'sri' as const,
              contributor: mapContributor(contributor),
              establishments: establishment ? [mapEstablishment(establishment)] : [],
            })
          }),
      }
    }),
  },
) {}
