import { HttpClient, HttpClientResponse } from '@effect/platform'
import { Effect, type Schema } from 'effect'
import { FetchError } from '../errors.js'
import { SriContributorRaw, SriWEstablishmentRaw } from '../schemas.js'

const SRI_BASE_URL = 'https://srienlinea.sri.gob.ec/sri-catastro-sujeto-servicio-internet/rest'

export class SriService extends Effect.Service<SriService>()('app/SriService', {
  effect: Effect.gen(function* () {
    const httpClient = yield* HttpClient.HttpClient

    const getJson = <A, I>(url: string, schema: Schema.Schema<A, I>) =>
      httpClient.get(url).pipe(
        Effect.flatMap(HttpClientResponse.schemaBodyJson(schema)),
        Effect.mapError((error) => new FetchError({ message: String(error) })),
      )

    return {
      getContrib: (ruc: string) =>
        getJson(
          `${SRI_BASE_URL}/ConsolidadoContribuyente/obtenerPorNumerosRuc?ruc=${ruc}`,
          SriContributorRaw,
        ),
      getEstablishment: (ruc: string) =>
        getJson(
          `${SRI_BASE_URL}/Establecimiento/consultarPorNumeroRuc?numeroRuc=${ruc}`,
          SriWEstablishmentRaw,
        ),
    }
  }),
}) {}
