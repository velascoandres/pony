import Anthropic from '@anthropic-ai/sdk'
import { Effect, Redacted } from 'effect'
import { ConfigService } from '../config.js'
import { AskLLMError, NoTextContentError } from '../errors.js'

export class LLMService extends Effect.Service<LLMService>()('app/llm', {
  effect: Effect.gen(function* () {
    const { config } = yield* ConfigService

    const client = new Anthropic({
      apiKey: Redacted.value(config.anthropicApiKey),
      baseURL: 'https://api.anthropic.com',
    })

    const model = config.anthropicModel

    const createMessage = (params: Anthropic.MessageCreateParamsNonStreaming) =>
      Effect.tryPromise({
        try: () => client.messages.create(params),
        catch: (error) => new AskLLMError({ message: (error as Error).message }),
      })

    return {
      ask: (prompt: string, systemPrompt?: string) =>
        Effect.gen(function* () {
          const response = yield* createMessage({
            model,
            max_tokens: 1024,
            ...(systemPrompt && { system: systemPrompt }),
            messages: [{ role: 'user', content: prompt }],
          })

          const textBlock = response.content.find((block) => block.type === 'text')
          if (textBlock?.type !== 'text') {
            return yield* Effect.fail(
              new NoTextContentError({ message: 'No text content found in Claude response' }),
            )
          }

          return textBlock.text
        }),
    }
  }),
}) {}
