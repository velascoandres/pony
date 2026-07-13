import { FetchHttpClient } from '@effect/platform'
import { NodeFileSystem, NodePath } from '@effect/platform-node'
import { Effect, Layer } from 'effect'
import { ConfigService } from './config.js'
import { DbClient } from './db/client.js'
import { LLMService } from './llm/client.js'
import { ServicesLayer } from './services/services.layer.js'
import { ToolsLayer } from './tools/tool.layer.js'

const MainLayer = Layer.mergeAll(LLMService.Default, DbClient.Default, ToolsLayer).pipe(
  Layer.provide(ServicesLayer),
  Layer.provide(FetchHttpClient.layer),
  Layer.provide(NodeFileSystem.layer),
  Layer.provide(NodePath.layer),
  Layer.provide(ConfigService.Default),
)

const program = Effect.gen(function* () {
  // Example usage of the LLMClientPort
  const llmClient = yield* LLMService
  const dbClient = yield* DbClient

  // Create database tables
  yield* dbClient.createTables()

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

Effect.runPromise(main)
