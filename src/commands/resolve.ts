import { NodeFileSystem, NodePath } from '@effect/platform-node'
import { Cause, Console, Effect, Layer } from 'effect'
import { ConfigService } from '../config.js'
import { DbClient } from '../db/client.js'
import { ResolveFileInput } from '../schemas.js'
import { InvoiceService } from '../services/invoice.service.js'
import type { LineResolution, ResolvedLine } from '../types.js'
import { findResolutionFile } from '../utils/find-resolution-file.js'
import { parseJsonFile } from '../utils/parse-json.js'

const MainLive = Layer.mergeAll(InvoiceService.Default, NodeFileSystem.layer, NodePath.layer).pipe(
  Layer.provide(DbClient.Default),
  Layer.provide(ConfigService.Default),
  Layer.provide(NodeFileSystem.layer),
  Layer.provide(NodePath.layer),
)

interface ResolveOutcome {
  readonly resolved: readonly ResolvedLine[]
  readonly failed: readonly LineResolution[]
}

const EMPTY_OUTCOME: ResolveOutcome = { resolved: [], failed: [] }

/**
 * Applies a resolution file to the database: the human verdict for every line
 * that came out of the conflict report.
 *
 *   pnpm resolve                                        # newest file in resolutions/
 *   pnpm resolve resolutions/resolution-<timestamp>.json
 */
const program = Effect.gen(function* () {
  const invoiceService = yield* InvoiceService

  const [, , requestedPath] = process.argv
  const resolutionFile = yield* findResolutionFile(requestedPath)

  const resolutions = yield* parseJsonFile(resolutionFile, ResolveFileInput)

  yield* Console.log(`Applying ${resolutions.length} resolutions from ${resolutionFile}`)

  // One unusable entry (unknown id, for instance) must not abandon the rest of
  // the file: record it and carry on, then report both sides at the end.
  const outcome = yield* Effect.reduce(resolutions, EMPTY_OUTCOME, (acc, resolution) =>
    invoiceService.resolveInvoiceLine(resolution).pipe(
      Effect.map((line): ResolveOutcome => ({ ...acc, resolved: [...acc.resolved, line] })),
      Effect.catchAll(() =>
        Effect.succeed<ResolveOutcome>({ ...acc, failed: [...acc.failed, resolution] }),
      ),
    ),
  )

  if (outcome.resolved.length > 0) {
    yield* Console.table(outcome.resolved).pipe(
      Console.withGroup({ label: `Resolved lines (${outcome.resolved.length})` }),
    )
  }

  yield* Console.log(
    `\nResolved ${outcome.resolved.length} of ${resolutions.length} lines; ${outcome.failed.length} could not be applied.`,
  )

  if (outcome.failed.length > 0) {
    yield* Console.error(
      `Unapplied invoice line ids: ${outcome.failed.map((entry) => entry.invoiceLineId).join(', ')}`,
    )
  }

  return outcome
})

const main = program.pipe(
  Effect.provide(MainLive),
  Effect.tapErrorCause((cause) => Console.error(Cause.pretty(cause))),
)

// A partially applied file is still a failure for whoever called us: exit
// non-zero so the run is not mistaken for a clean one.
Effect.runPromise(main)
  .then((outcome) => {
    if (outcome.failed.length > 0) process.exit(1)
  })
  .catch(() => process.exit(1))
