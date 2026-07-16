import type Anthropic from '@anthropic-ai/sdk'
import { Console, Effect, Either } from 'effect'
import { ConfigService } from '../config.js'
import { LLMService } from '../llm/client.js'
import { SaveConflictReportTool } from '../tools/save-conflict-report.js'
import type { ClassifiedInvoice, ConflictLine, InvoiceOutcome } from '../types.js'
import { listInvoices } from '../utils/list-invoices.js'
import { AGENT_SYSTEM_PROMPT } from './system-prompt.js'
import { decodeToolCall } from './tool-decoder.js'
import { ToolExecuter } from './tool-executer.js'
import { ALL_TOOL_DEFINITIONS } from './tool-registry.js'

const EMPTY_OUTCOME: InvoiceOutcome = { successLines: 0, conflictLines: [] }

export class InvoiceAgent extends Effect.Service<InvoiceAgent>()('app/InvoiceAgent', {
  effect: Effect.gen(function* () {
    const toolExecuter = yield* ToolExecuter
    const llm = yield* LLMService
    const saveConflictReportTool = yield* SaveConflictReportTool
    const { config } = yield* ConfigService

    const CONFIDENCE_THRESHOLD = config.confidenceThreshold
    const MAX_TOOL_CALLS = config.maxToolCalls

    // Split a classified invoice into the lines we trust and the ones that need a
    // human to look at them.
    const toOutcome = (invoice: ClassifiedInvoice): InvoiceOutcome => {
      const conflictLines = invoice.items
        .filter((item) => item.confidence < CONFIDENCE_THRESHOLD)
        .map((item) => ({
          invoiceNumber: invoice.invoiceNumber,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
          reason:
            item.warning ??
            `Confidence ${item.confidence} < ${CONFIDENCE_THRESHOLD} (suggested category: ${item.taxCategory})`,
        }))

      return { successLines: invoice.items.length - conflictLines.length, conflictLines }
    }

    // One agent run per invoice file. Returns what the model managed to
    // classify; an invoice that never reaches save_invoice_info_tool
    // contributes nothing.
    const processInvoice = (invoiceFilePath: string) =>
      Effect.gen(function* () {
        yield* Console.log(`\n--- Proccessing ${invoiceFilePath} ---`)

        const initial = {
          messages: [
            {
              role: 'user' as const,
              content: `Proccessing invoice located at: ${invoiceFilePath}`,
            },
          ] as Anthropic.MessageParam[],
          remaining: MAX_TOOL_CALLS,
          outcome: undefined as InvoiceOutcome | undefined,
          done: false,
        }

        const final = yield* Effect.iterate(initial, {
          while: (state) => !state.done && state.remaining > 0,
          body: (state) =>
            Effect.gen(function* () {
              const response = yield* llm.sendMessages({
                system: AGENT_SYSTEM_PROMPT,
                messages: state.messages,
                tools: ALL_TOOL_DEFINITIONS,
              })

              const toolUses = response.content.filter(
                (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
              )

              // No tool call means the model considers itself finished.
              if (toolUses.length === 0) {
                return { ...state, done: true }
              }

              const results: Anthropic.ToolResultBlockParam[] = []
              let outcome = state.outcome

              for (const block of toolUses) {
                // Failures come back to the model as tool_result errors so it
                // can correct course within the remaining budget, rather than
                // aborting the invoice.
                const attempt = yield* decodeToolCall(block).pipe(
                  Effect.flatMap((call) =>
                    toolExecuter.execute(call).pipe(Effect.map((result) => ({ call, result }))),
                  ),
                  Effect.either,
                )

                if (Either.isLeft(attempt)) {
                  yield* Console.error(`Tool ${block.name} has failed: ${attempt.left.message}`)
                  results.push({
                    type: 'tool_result',
                    tool_use_id: block.id,
                    content: `Error: ${attempt.left.message}`,
                    is_error: true,
                  })
                  continue
                }

                const { call, result } = attempt.right
                if (call.toolName === 'save_invoice_info_tool') {
                  outcome = toOutcome(call.input)
                }

                results.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: JSON.stringify(result ?? { ok: true }),
                })
              }

              return {
                messages: [
                  ...state.messages,
                  { role: 'assistant' as const, content: response.content },
                  { role: 'user' as const, content: results },
                ] as Anthropic.MessageParam[],
                remaining: state.remaining - 1,
                outcome,
                // The save is the last step of the invoice — stop once it lands.
                done: outcome !== undefined,
              }
            }),
        })

        if (final.outcome === undefined) {
          yield* Console.error(
            `${invoiceFilePath}: finish without save the invoice (${MAX_TOOL_CALLS} tool calls budget exhausted or the model stopped)`,
          )

          return EMPTY_OUTCOME
        }

        return final.outcome
      })

    return {
      execute: () =>
        Effect.gen(function* () {
          const invoiceFiles = yield* listInvoices
          yield* Console.log(`Found ${invoiceFiles.length} invoices to proccess.`)

          // One invoice failing outright must not abort the batch.
          const totals = yield* Effect.reduce(
            invoiceFiles,
            { successLines: 0, conflictLines: [] as ConflictLine[] },
            (acc, invoiceFilePath) =>
              processInvoice(invoiceFilePath).pipe(
                Effect.catchAll((error) =>
                  Console.error(`${invoiceFilePath}: ${error.message}`).pipe(
                    Effect.as(EMPTY_OUTCOME),
                  ),
                ),
                Effect.map((outcome) => ({
                  successLines: acc.successLines + outcome.successLines,
                  conflictLines: [...acc.conflictLines, ...outcome.conflictLines],
                })),
              ),
          )

          yield* Console.log(
            `\nClassified ${totals.successLines} lines; ${totals.conflictLines.length} lines need human review.`,
          )

          return yield* saveConflictReportTool.execute({
            successLines: totals.successLines,
            conflictLines: totals.conflictLines,
          })
        }),
    }
  }),
}) {}
