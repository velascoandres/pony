import { Effect } from 'effect'
import type { AskLLMError, NoTextContentError } from '../errors.js'

interface LLMClientInterface {
  ask(
    prompt: string,
    systemPrompt?: string,
  ): Effect.Effect<string, AskLLMError | NoTextContentError>
}

export class LLMClientPort extends Effect.Tag('LLMClientPort')<
  LLMClientPort,
  LLMClientInterface
>() {}
