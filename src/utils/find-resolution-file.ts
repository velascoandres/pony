import { FileSystem, Path } from '@effect/platform'
import { Effect } from 'effect'
import { ResolutionError } from '../errors.js'

const RESOLUTIONS_DIR = 'resolutions'

// resolution-<timestamp>.json, with the same stamp shape the reports use
// (`2026-07-27T03-26-24-028Z`), so the names sort chronologically.
const RESOLUTION_FILE = /^resolution-.+\.json$/i

/**
 * Resolves which resolution file to apply: the path the user passed, or the
 * newest `resolution-<timestamp>.json` in `resolutions/` when they passed none.
 */
export const findResolutionFile = (requestedPath?: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    if (requestedPath !== undefined) {
      return path.resolve(requestedPath)
    }

    const directory = path.resolve(RESOLUTIONS_DIR)

    const entries = yield* fs.readDirectory(directory).pipe(
      Effect.mapError(
        (cause) =>
          new ResolutionError({
            message: `Could not read resolutions directory at ${directory}: ${cause.message}`,
          }),
      ),
    )

    // The timestamp sorts lexicographically, so the last name is the newest file.
    const candidates = entries.filter((entry) => RESOLUTION_FILE.test(entry)).sort()
    const latest = candidates.at(-1)

    if (latest === undefined) {
      return yield* new ResolutionError({
        message: `No resolution-<timestamp>.json file in ${directory}. Create one or pass its path: pnpm resolve <file>`,
      })
    }

    return path.join(directory, latest)
  })
