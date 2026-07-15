import { Config, Effect } from 'effect'

export class ConfigService extends Effect.Service<ConfigService>()('app/config', {
  effect: Effect.gen(function* () {
    const config = yield* Config.all({
      // Use `Config.redacted` for sensitive information like API keys, and `Config.string` or `Config.integer` for other configuration values.
      anthropicApiKey: Config.redacted('ANTHROPIC_API_KEY'),
      openaiApiKey: Config.redacted('OPENAI_API_KEY'),
      modelProvider: Config.literal('anthropic', 'openai')('MODEL_PROVIDER'),
      anthropicModel: Config.string('ANTHROPIC_MODEL'),
      openaiModel: Config.string('OPENAI_MODEL'),
      openaiEmbeddingModel: Config.string('OPENAI_EMBEDDING_MODEL'),
      docsPath: Config.string('DOCS_PATH'),
      dbPath: Config.string('DB_PATH'),
      ragTopK: Config.integer('RAG_TOP_K'),
      maxToolCalls: Config.integer('MAX_TOOL_CALLS'),
      confidenceThreshold: Config.number('CONFIDENCE_THRESHOLD'),
    })

    return { config }
  }),
}) {}
