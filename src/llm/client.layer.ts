import Anthropic from '@anthropic-ai/sdk'
import { Effect, Layer } from 'effect'
import { ConfigPort } from '../config.js'
import { AskLLMError, NoTextContentError } from '../errors.js'
import { LLMClientPort } from './client.port.js'

export const LLMClientLive = Layer.effect(
  LLMClientPort,
  Effect.gen(function* () {
    const config = yield* ConfigPort

    const client = new Anthropic({
      apiKey: config.get('ANTHROPIC_API_KEY'),
      baseURL: 'https://api.anthropic.com',
    })

    const model = config.get('ANTHROPIC_MODEL')

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
)
