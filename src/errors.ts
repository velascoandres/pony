import { Data } from 'effect'

// LLM Errors
export class AskLLMError extends Data.TaggedError('AskLLMError')<{ message: string }> {}
export class NoTextContentError extends Data.TaggedError('NoTextContentError')<{
  message: string
}> {}

// Common Errors
export class FetchError extends Data.TaggedError('FetchError')<{ message: string }> {}

// RUC Validation Errors
export class InvalidRucFormatError extends Data.TaggedError('InvalidRucFormatError')<{
  message: string
}> {}
export class InvalidProvinceCodeError extends Data.TaggedError('InvalidProvinceCodeError')<{
  message: string
}> {}
export class InvalidThirdDigitError extends Data.TaggedError('InvalidThirdDigitError')<{
  message: string
}> {}
export class InvalidEstablishmentError extends Data.TaggedError('InvalidEstablishmentError')<{
  message: string
}> {}

export class XMLParsingError extends Data.TaggedError('XMLParsingError')<{ message: string }> {}
