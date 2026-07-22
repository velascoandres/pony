import { Config, Effect } from 'effect'

export class ConfigService extends Effect.Service<ConfigService>()('app/config', {
  effect: Effect.gen(function* () {
    const config = yield* Config.all({
      anthropicApiKey: Config.redacted('ANTHROPIC_API_KEY'),
      modelProvider: Config.literal('anthropic', 'openai')('MODEL_PROVIDER'),
      anthropicModel: Config.string('ANTHROPIC_MODEL'),
      dbPath: Config.string('DB_PATH'),
      maxToolCalls: Config.integer('MAX_TOOL_CALLS'),
      confidenceThreshold: Config.number('CONFIDENCE_THRESHOLD'),
    })

    return { config }
  }),
}) {}
