import { Effect, Layer } from 'effect'
import { ConfigLive } from './config.js'
import { LLMClientLive } from './llm/client.layer.js'
import { LLMClientPort } from './llm/client.port.js'

const MainLayer = Layer.mergeAll(ConfigLive, LLMClientLive.pipe(Layer.provide(ConfigLive)))

const program = Effect.gen(function* () {
  // Example usage of the LLMClientPort
  const llmClient = yield* LLMClientPort

  const prompt = 'What is the capital of France?'
  const systemPrompt = 'You are a helpful assistant.'

  return yield* llmClient.ask(prompt, systemPrompt)
})

const runnable = program.pipe(Effect.provide(MainLayer))

const main = runnable.pipe(
  Effect.catchTags({
    AskLLMError: (error) => Effect.succeed(`AskLLMError: ${error.message}`),
    NoTextContentError: (error) => Effect.succeed(`NoTextContentError: ${error.message}`),
  }),
)

Effect.runPromise(main).then(console.log)
