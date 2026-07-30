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

export class JsonParseError extends Data.TaggedError('JsonParseError')<{ message: string }> {}

export class ReadDirectoryError extends Data.TaggedError('ReadDirectoryError')<{
  message: string
}> {}

export class DatabaseError extends Data.TaggedError('DatabaseError')<{ message: string }> {}

export class UnknownToolError extends Data.TaggedError('UnknownToolError')<{ message: string }> {}

export class ReportError extends Data.TaggedError('ReportError')<{ message: string }> {}

// Raised when a resolution file cannot be located or points at a line that is
// not in the database.
export class ResolutionError extends Data.TaggedError('ResolutionError')<{ message: string }> {}
