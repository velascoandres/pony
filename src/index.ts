import { FetchHttpClient } from '@effect/platform'
import { NodeFileSystem } from '@effect/platform-node'
import { Effect, Layer } from 'effect'
import { ConfigService } from './config.js'
import { LLMService } from './llm/client.js'
import { ServicesLayer } from './services/services.layer.js'
import { ToolsLayer } from './tools/tool.layer.js'

const MainLayer = Layer.mergeAll(ConfigService.Default, LLMService.Default, ToolsLayer).pipe(
  Layer.provide(ServicesLayer),
  Layer.provide(FetchHttpClient.layer),
  Layer.provide(NodeFileSystem.layer),
)

const program = Effect.gen(function* () {
  // Example usage of the LLMClientPort
  const llmClient = yield* LLMService

  const prompt = 'What is the capital of France?'
  const systemPrompt = 'You are a helpful assistant.'

  return yield* llmClient.ask(prompt, systemPrompt)
})

const runnable = program.pipe(Effect.provide(MainLayer))

const main = runnable.pipe(
  Effect.catchTags({
    AskLLMError: (error) => Effect.succeed(`AskLLMError: ${error.message}`),
    NoTextContentError: (error) => Effect.succeed(`NoTextContentError: ${error.message}`),
    ConfigError: (error) => Effect.succeed(`ConfigError: ${error}`),
  }),
)

Effect.runPromise(main).then(console.log)
