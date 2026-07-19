import { FileSystem, Path } from '@effect/platform'
import { Console, Effect, Schema } from 'effect'
import { ReportError } from '../errors.js'
import { ConflictReportSchema } from '../schemas.js'
import type { ConflictLine, ConflictReport, ConflictReportInput } from '../types.js'

const CSV_HEADER = [
  'invoiceNumber',
  'description',
  'quantity',
  'unitPrice',
  'subtotal',
  'reason',
  'rationale',
]

const csvCell = (value: string | number | undefined): string => {
  const text = value === undefined ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const toCsv = (lines: readonly ConflictLine[]): string => {
  const rows = lines.map((line) =>
    [
      line.invoiceNumber,
      line.description,
      line.quantity,
      line.unitPrice,
      line.subtotal,
      line.reason,
      line.rationale,
    ]
      .map(csvCell)
      .join(','),
  )
  return [CSV_HEADER.join(','), ...rows].join('\n')
}

export class SaveConflictReportTool extends Effect.Service<SaveConflictReportTool>()(
  'app/SaveConflictReportTool',
  {
    effect: Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path

      return {
        execute: (input: ConflictReportInput) =>
          Effect.gen(function* () {
            const outputDir = input.outputDir ?? 'reports'
            const now = yield* Effect.sync(() => new Date())
            const stamp = now.toISOString().replace(/[:.]/g, '-')

            // Order the conflict lines by invoice number so the CSV is stable
            // and easy to reconcile against the source invoices.
            const orderedLines = [...input.conflictLines].sort((a, b) =>
              a.invoiceNumber.localeCompare(b.invoiceNumber),
            )

            const conflictFile = input.conflictLines ? `conflicts-${stamp}.csv` : undefined
            const reportFile = `summary-${stamp}.json`

            const report: ConflictReport = {
              successLines: input.successLines,
              conflictLines: orderedLines.length,
              conflictFile,
              date: now.toISOString(),
            }

            const encoded = yield* Schema.encode(ConflictReportSchema)(report).pipe(
              Effect.mapError(
                (cause) =>
                  new ReportError({ message: `Invalid conflict report: ${cause.message}` }),
              ),
            )

            yield* fs.makeDirectory(outputDir, { recursive: true }).pipe(
              Effect.mapError(
                (cause) =>
                  new ReportError({
                    message: `Could not create report directory ${outputDir}: ${cause.message}`,
                  }),
              ),
            )

            if (conflictFile) {
              yield* Effect.all([
                fs.writeFileString(path.join(outputDir, conflictFile), toCsv(orderedLines)),
                fs.writeFileString(
                  path.join(outputDir, reportFile),
                  JSON.stringify(encoded, null, 2),
                ),
              ]).pipe(
                Effect.mapError(
                  (cause) =>
                    new ReportError({ message: `Could not write report files: ${cause.message}` }),
                ),
              )
            } else {
              yield* Console.log(
                `No conflicts found; writing only summary report to ${path.join(outputDir, reportFile)}`,
              )
            }

            yield* Console.log(
              `Report saved to ${path.join(outputDir, reportFile)} (${report.successLines} classified, ${report.conflictLines} in conflict)`,
            )

            return report
          }),
      }
    }),
  },
) {}
