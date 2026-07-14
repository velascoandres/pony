import type Anthropic from '@anthropic-ai/sdk'
import { Console, Effect } from 'effect'
import { AskLLMError } from '../errors.js'
import { LLMService } from '../llm/client.js'
import { type ToolCall, ToolExecuter } from './tool-executer.js'
import { ALL_TOOL_DEFINITIONS } from './tool-registry.js'

const SYSTEM_PROMPT = `You are an invoice processing agent. Your job is to:
1. Parse invoice XML files to extract invoice data.
2. Retrieve fiscal information (contributor data) from the SRI API using the RUC.
3. Save the parsed invoice information into the database.

Use the available tools to accomplish these tasks. Process the user's request step by step.`

const MAX_ITERATIONS = 10

export class InvoiceAgent extends Effect.Service<InvoiceAgent>()('app/InvoiceAgent', {
  effect: Effect.gen(function* () {
    const toolExecuter = yield* ToolExecuter
    const llmService = yield* LLMService

    const tools: Anthropic.Messages.Tool[] = ALL_TOOL_DEFINITIONS.map((def) => ({
      name: def.name,
      description: def.description,
      input_schema: def.input_schema as Anthropic.Messages.Tool['input_schema'],
    }))

    const executeToolCall = (block: Anthropic.Messages.ToolUseBlock) =>
      Effect.gen(function* () {
        const call = { toolName: block.name, input: block.input } as ToolCall

        const result = yield* toolExecuter.execute(call).pipe(
          Effect.map((r) => JSON.stringify(r)),
          Effect.catchAll((error) => Effect.succeed(JSON.stringify({ error: String(error) }))),
        )

        return {
          type: 'tool_result' as const,
          tool_use_id: block.id,
          content: result,
        }
      })

    const run = (userPrompt: string) =>
      Effect.gen(function* () {
        const messages: Anthropic.Messages.MessageParam[] = [{ role: 'user', content: userPrompt }]

        let iterations = 0

        while (iterations < MAX_ITERATIONS) {
          iterations++

          yield* Console.log(`[InvoiceAgent] Iteration ${iterations}`)

          const response = yield* llmService.createMessage({
            max_tokens: 4096,
            system: SYSTEM_PROMPT,
            messages,
            tools,
          })

          // Append assistant response to conversation
          messages.push({ role: 'assistant', content: response.content })

          if (response.stop_reason === 'tool_use') {
            const toolUseBlocks = response.content.filter(
              (block): block is Anthropic.Messages.ToolUseBlock => block.type === 'tool_use',
            )

            const toolResults = yield* Effect.all(
              toolUseBlocks.map((block) => executeToolCall(block)),
            )

            // Append tool results as a user message
            messages.push({ role: 'user', content: toolResults })
            continue
          }

          // For end_turn, max_tokens, stop_sequence, or any other stop reason, return the text
          const textBlock = response.content.find((block) => block.type === 'text')
          return textBlock?.type === 'text' ? textBlock.text : ''
        }

        return yield* Effect.fail(
          new AskLLMError({
            message: `Agent loop exceeded maximum iterations (${MAX_ITERATIONS})`,
          }),
        )
      })

    return {
      run,
      executeTool: (call: ToolCall) => toolExecuter.execute(call),
    }
  }),
}) {}
