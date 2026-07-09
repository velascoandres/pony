import { HttpClient } from '@effect/platform'
import { Effect, Layer } from 'effect'
import {
  FetchError,
  type InvalidEstablishmentError,
  type InvalidProvinceCodeError,
  type InvalidRucFormatError,
  type InvalidThirdDigitError,
} from '../errors.js'
import type { TaxPayerRegistryResult } from '../types.js'
import { validateRuc } from '../utils/validate-ruc.js'

interface GetFiscalInfoToolInterface {
  execute(
    ruc: string,
  ): Effect.Effect<
    TaxPayerRegistryResult,
    | FetchError
    | InvalidRucFormatError
    | InvalidProvinceCodeError
    | InvalidThirdDigitError
    | InvalidEstablishmentError
  >
}

export class GetFiscalInfoTool extends Effect.Tag('LLMClientPort')<
  GetFiscalInfoTool,
  GetFiscalInfoToolInterface
>() {}

export const GetFiscalInfoToolRestLive = Layer.effect(
  GetFiscalInfoTool,
  Effect.gen(function* () {
    const httpClient = (yield* HttpClient.HttpClient).pipe(HttpClient.filterStatusOk)

    const BASE = 'https://srienlinea.sri.gob.ec/sri-catastro-sujeto-servicio-internet/rest'

    return {
      execute: (ruc: string) =>
        Effect.gen(function* () {
          const validatedRuc = yield* validateRuc(ruc)

          return yield* httpClient.get(`${BASE}/fiscal-info/${validatedRuc}`).pipe(
            Effect.flatMap((response) => response.json),
            Effect.map((body) => body as TaxPayerRegistryResult),
            Effect.mapError((error) => new FetchError({ message: error.message })),
          )
        }),
    }
  }),
)
