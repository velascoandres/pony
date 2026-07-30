import { randomUUID } from 'node:crypto'
import { Effect } from 'effect'

export const generateId = Effect.sync((): string => randomUUID())
