import { Effect } from 'effect'
import { type ToolCall, ToolExecuter } from './tool-executer.js'

export class InvoiceAgent extends Effect.Service<InvoiceAgent>()('app/InvoiceAgent', {
  effect: Effect.gen(function* () {
    const toolExecuter = yield* ToolExecuter

    return {
      executeTool: (call: ToolCall) => toolExecuter.execute(call),
    }
  }),
}) {}
