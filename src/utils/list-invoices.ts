import { FileSystem, Path } from '@effect/platform'
import { Effect } from 'effect'
import { ReadDirectoryError } from '../errors.js'

const INVOICES_DIR = 'invoices'

export const listInvoices = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path

  const directory = path.resolve(INVOICES_DIR)

  const entries = yield* fs.readDirectory(directory).pipe(
    Effect.mapError(
      (cause) =>
        new ReadDirectoryError({
          message: `Could not read invoices directory at ${directory}: ${cause.message}`,
        }),
    ),
  )

  return entries
    .filter((entry) => entry.toLowerCase().endsWith('.xml'))
    .map((entry) => path.join(directory, entry))
    .sort()
})
