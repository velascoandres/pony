import { HttpClient, HttpClientResponse } from '@effect/platform'
import { Console, Effect, type Schema } from 'effect'
import { ConfigService } from '../config.js'
import { FetchError } from '../errors.js'
import { SriContributorRawResponse, SriWEstablishmentRawResponse } from '../schemas.js'

export class SriService extends Effect.Service<SriService>()('app/SriService', {
  effect: Effect.gen(function* () {
    const httpClient = yield* HttpClient.HttpClient
    const configService = yield* ConfigService
    const SRI_BASE_URL = configService.config.sriBaseUrl

    const getJson = <A, I>(url: string, schema: Schema.Schema<ReadonlyArray<A>, I>) =>
      httpClient.get(url).pipe(
        Effect.tap(() => Console.log(`Fetching SRI data from ${url}`)),
        Effect.flatMap(HttpClientResponse.schemaBodyJson(schema)),
        Effect.map((items) => items[0]),
        Effect.mapError((error) => new FetchError({ message: String(error) })),
        Effect.tapError((error) =>
          Console.error(`Error fetching SRI data from ${url}: ${error.message}`),
        ),
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
