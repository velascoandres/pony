import { FetchHttpClient } from '@effect/platform'
import { NodeFileSystem, NodePath } from '@effect/platform-node'
import { Cause, Console, Effect, Layer } from 'effect'
import { AgentsLayer } from './agent/agents.layer.js'
import { InvoiceAgent } from './agent/invoice.agent.js'
import { ConfigService } from './config.js'
import { DbClient } from './db/client.js'
import { LLMService } from './llm/client.js'
import { ServicesLayer } from './services/services.layer.js'
import { ToolsLayer } from './tools/tool.layer.js'

const MainLive = Layer.mergeAll(
  AgentsLayer,
  ServicesLayer,
  NodeFileSystem.layer,
  NodePath.layer,
).pipe(
  Layer.provide(LLMService.Default),
  Layer.provide(ToolsLayer),
  Layer.provide(ServicesLayer),
  Layer.provide(DbClient.Default),
  Layer.provide(ConfigService.Default),
  Layer.provide(FetchHttpClient.layer),
  Layer.provide(NodeFileSystem.layer),
  Layer.provide(NodePath.layer),
)

const program = Effect.gen(function* () {
  const invoiceAgent = yield* InvoiceAgent

  const report = yield* invoiceAgent.execute()

  yield* Console.log(
    `\nReady: ${report.successLines} success lines, ${report.conflictLines} lines with conflictsa (${report.conflictFile})`,
  )
})

const main = program.pipe(
  Effect.provide(MainLive),
  Effect.tapErrorCause((cause) => Console.error(Cause.pretty(cause))),
)

Effect.runPromise(main).catch(() => process.exit(1))
