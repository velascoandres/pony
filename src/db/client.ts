import { FileSystem, Path } from '@effect/platform'
import Database from 'better-sqlite3'
import { Console, Effect } from 'effect'
import { ConfigService } from '../config.js'
import { DatabaseError } from '../errors.js'

export class DbClient extends Effect.Service<DbClient>()('app/DbClient', {
  dependencies: [ConfigService.Default],
  effect: Effect.gen(function* () {
    const configService = yield* ConfigService
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    const dbPath = configService.config.dbPath

    const dir = path.dirname(dbPath)

    yield* Console.log(`Ensuring database directory exists: ${dir}`)

    yield* fs.makeDirectory(dir, { recursive: true })

    const dbClient = new Database(dbPath)
    dbClient.pragma('journal_mode = WAL')
    dbClient.pragma('synchronous = NORMAL')

    Console.log(`Database initialized at: ${dbPath}`)

    const schemaPath = path.join(import.meta.dirname, '..', '..', 'db', 'db-schemas.sql')

    return {
      createTables: () =>
        Effect.gen(function* () {
          yield* Console.log(`Creating tables from schema: ${schemaPath}`)
          const sqlContent = yield* fs.readFileString(schemaPath, 'utf-8')
          const result = Boolean(dbClient.exec(sqlContent))
          yield* Console.log('Tables created successfully')
          return result
        }).pipe(
          Effect.tapError((error) => Console.error(`Failed to create tables: ${error}`)),
          Effect.mapError((error) => new DatabaseError({ message: String(error) })),
        ),
      executeSql: (sql: string, params?: Record<string, unknown>) =>
        Effect.gen(function* () {
          yield* Console.log(`Executing SQL: ${sql} with params: ${JSON.stringify(params)}`)
          const stmt = dbClient.prepare(sql)
          const result = params ? stmt.run(params) : stmt.run()
          yield* Console.log(`SQL executed successfully, changes: ${result.changes}`)
          return result
        }).pipe(
          Effect.tapError((error) => Console.error(`Failed to execute SQL: ${error}`)),
          Effect.mapError((error) => new DatabaseError({ message: String(error) })),
        ),
      query: <T = unknown>(sql: string, params?: Record<string, unknown>) =>
        Effect.gen(function* () {
          yield* Console.log(`Querying SQL: ${sql} with params: ${JSON.stringify(params)}`)
          const stmt = dbClient.prepare(sql)
          const rows = (params ? stmt.all(params) : stmt.all()) as T[]
          yield* Console.log(`SQL query returned ${rows.length} rows`)
          return rows
        }).pipe(
          Effect.tapError((error) => Console.error(`Failed to query SQL: ${error}`)),
          Effect.mapError((error) => new DatabaseError({ message: String(error) })),
        ),
    }
  }),
}) {}
