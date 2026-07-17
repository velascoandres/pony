import { HttpClient, HttpClientResponse } from '@effect/platform'
import { Console, Effect, type Schema } from 'effect'
import { FetchError } from '../errors.js'
import { SriContributorRawResponse, SriWEstablishmentRawResponse } from '../schemas.js'

const SRI_BASE_URL = 'https://srienlinea.sri.gob.ec/sri-catastro-sujeto-servicio-internet/rest'

export class SriService extends Effect.Service<SriService>()('app/SriService', {
  effect: Effect.gen(function* () {
    const httpClient = yield* HttpClient.HttpClient

    const getJson = <A, I>(url: string, schema: Schema.Schema<ReadonlyArray<A>, I>) =>
      httpClient.get(url).pipe(
        Effect.tap(() => Console.log(`Fetching SRI data from ${url}`)),
        Effect.flatMap(HttpClientResponse.schemaBodyJson(schema)),
        Effect.tap((items) => Console.log(`SRI response: ${JSON.stringify(items)}`)),
        Effect.map((items) => items[0]),
        Effect.mapError((error) => new FetchError({ message: String(error) })),
      )

    return {
      getContrib: (ruc: string) =>
        getJson(
          `${SRI_BASE_URL}/ConsolidadoContribuyente/obtenerPorNumerosRuc?ruc=${ruc}`,
          SriContributorRawResponse,
        ),
      getEstablishment: (ruc: string) =>
        getJson(
          `${SRI_BASE_URL}/Establecimiento/consultarPorNumeroRuc?numeroRuc=${ruc}`,
          SriWEstablishmentRawResponse,
        ),
    }
  }),
}) {}
