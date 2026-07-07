import { Config, Context, Effect, Layer } from 'effect'

interface ConfigPortInterface {
  readonly get: (key: string) => string
}

export class ConfigPort extends Context.Tag('ConfigPort')<ConfigPort, ConfigPortInterface>() {}

export const ConfigLive = Layer.effect(
  ConfigPort,
  Effect.gen(function* () {
    const values = new Map<string, string>()
    // Retrieve the configuration values from .env.template:
    values.set('ANTHROPIC_API_KEY', yield* Config.string('ANTHROPIC_API_KEY'))
    values.set('OPENAI_API_KEY', yield* Config.string('OPENAI_API_KEY'))
    values.set('MODEL_PROVIDER', yield* Config.string('MODEL_PROVIDER'))
    values.set('ANTHROPIC_MODEL', yield* Config.string('ANTHROPIC_MODEL'))
    values.set('OPENAI_MODEL', yield* Config.string('OPENAI_MODEL'))
    values.set('OPENAI_EMBEDDING_MODEL', yield* Config.string('OPENAI_EMBEDDING_MODEL'))
    values.set('DOCS_PATH', yield* Config.string('DOCS_PATH'))
    values.set('DB_PATH', yield* Config.string('DB_PATH'))
    values.set('RAG_TOP_K', yield* Config.string('RAG_TOP_K'))

    return {
      get: (key: string) => {
        const value = values.get(key)
        if (value === undefined) {
          throw new Error(`Config key "${key}" not found`)
        }
        return value
      },
    }
  }),
)

export const resolveConfig = (): Promise<Record<string, string>> => {
  const program = Effect.gen(function* () {
    const config = yield* ConfigPort
    return {
      ANTHROPIC_API_KEY: config.get('ANTHROPIC_API_KEY'),
      OPENAI_API_KEY: config.get('OPENAI_API_KEY'),
      MODEL_PROVIDER: config.get('MODEL_PROVIDER'),
      ANTHROPIC_MODEL: config.get('ANTHROPIC_MODEL'),
      OPENAI_MODEL: config.get('OPENAI_MODEL'),
      OPENAI_EMBEDDING_MODEL: config.get('OPENAI_EMBEDDING_MODEL'),
      DOCS_PATH: config.get('DOCS_PATH'),
      DB_PATH: config.get('DB_PATH'),
      RAG_TOP_K: config.get('RAG_TOP_K'),
    }
  }).pipe(Effect.provide(ConfigLive))

  return Effect.runPromise(program)
}
