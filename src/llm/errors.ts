import { Data } from 'effect'

export class AskLLMError extends Data.TaggedError('AskLLMError')<{ message: string }> {}
export class NoTextContentError extends Data.TaggedError('NoTextContentError')<{
  message: string
}> {}
