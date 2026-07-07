import { Effect } from 'effect'

const program = Effect.gen(function* () {
  yield* Effect.log('¡Hola desde Effect!')
  const result = yield* Effect.succeed(21).pipe(Effect.map((n) => n * 2))
  yield* Effect.log(`El resultado es: ${result}`)
})

Effect.runPromise(program).catch(console.error)
