import { FileSystem } from '@effect/platform'
import { Effect, ParseResult, Schema } from 'effect'
import { JsonParseError } from '../errors.js'

/**
 * Reads a JSON file whose top level is an array and decodes every element with
 * `schema`, so the caller gets values already validated instead of `unknown`.
 */
export const parseJsonFile = <A, I, R>(
  inputPath: string,
  schema: Schema.Schema<A, I, R>,
): Effect.Effect<readonly A[], JsonParseError, FileSystem.FileSystem | R> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem

    const content = yield* fs
      .readFileString(inputPath, 'utf-8')
      .pipe(
        Effect.mapError(
          (cause) =>
            new JsonParseError({ message: `Could not read ${inputPath}: ${cause.message}` }),
        ),
      )

    return yield* Schema.decodeUnknown(Schema.parseJson(Schema.Array(schema)))(content).pipe(
      Effect.mapError(
        (cause) =>
          new JsonParseError({
            message: `Invalid JSON ${inputPath}: ${ParseResult.TreeFormatter.formatErrorSync(cause)}`,
          }),
      ),
    )
  })
