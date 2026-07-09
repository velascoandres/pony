import { Effect } from 'effect'
import {
  InvalidEstablishmentError,
  InvalidProvinceCodeError,
  InvalidRucFormatError,
  InvalidThirdDigitError,
} from '../errors.js'

type RucError =
  | InvalidRucFormatError
  | InvalidProvinceCodeError
  | InvalidThirdDigitError
  | InvalidEstablishmentError

export function validateRuc(ruc: string): Effect.Effect<string, RucError> {
  return Effect.gen(function* () {
    if (!/^\d{13}$/.test(ruc)) {
      return yield* Effect.fail(
        new InvalidRucFormatError({ message: 'RUC must have exactly 13 digits' }),
      )
    }
    const province = parseInt(ruc.slice(0, 2), 10)
    if ((province < 1 || province > 24) && province !== 30) {
      return yield* Effect.fail(new InvalidProvinceCodeError({ message: 'Invalid province code' }))
    }
    const thirdDigit = parseInt(ruc.charAt(2), 10)
    if (thirdDigit === 7 || thirdDigit === 8) {
      return yield* Effect.fail(new InvalidThirdDigitError({ message: 'Invalid third digit' }))
    }
    if (ruc.slice(10) === '000') {
      return yield* Effect.fail(
        new InvalidEstablishmentError({ message: 'Invalid establishment number' }),
      )
    }
    return ruc
  })
}
