import { NodeFileSystem, NodePath } from '@effect/platform-node'
import { Console, Effect, Layer } from 'effect'
import { ConfigService } from '../config.js'
import { DbClient } from './client.js'

const MainLayer = Layer.mergeAll(DbClient.Default).pipe(
  Layer.provide(NodeFileSystem.layer),
  Layer.provide(NodePath.layer),
  Layer.provide(ConfigService.Default),
)

const program = Effect.gen(function* () {
  const dbClient = yield* DbClient
  yield* Console.log(`Starting database initialization...`)

  yield* dbClient.createTables()
})

const runnable = program.pipe(Effect.provide(MainLayer))

const main = runnable.pipe(
  Effect.catchTags({
    DatabaseError: (error) => Effect.succeed(`DatabaseError: ${error.message}`),
    ConfigError: (error) => Effect.succeed(`ConfigError: ${error}`),
  }),
)

Effect.runPromise(main)
