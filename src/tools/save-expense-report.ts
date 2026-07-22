import { FileSystem, Path } from '@effect/platform'
import { Console, Effect } from 'effect'
import ejs from 'ejs'
import { ReportError } from '../errors.js'
import { InvoiceService } from '../services/invoice.service.js'
import type { CategoryExpenseReport, ExpenseReportResult } from '../types.js'

const TEMPLATE_FILE = 'expense-report.ejs'
const DEFAULT_OUTPUT_DIR = 'reports'

interface SaveExpenseReportInput {
  readonly outputDir?: string
}

// Sum the per-category rows once so the template stays free of aggregation.
const sumTotals = (categories: CategoryExpenseReport) =>
  categories.reduce(
    (acc, row) => ({
      base: acc.base + row.base,
      vat: acc.vat + row.vat,
      total: acc.total + row.total,
      deductible: acc.deductible + row.deductible,
      lineCount: acc.lineCount + row.lineCount,
    }),
    { base: 0, vat: 0, total: 0, deductible: 0, lineCount: 0 },
  )

export class SaveExpenseReportTool extends Effect.Service<SaveExpenseReportTool>()(
  'app/SaveExpenseReportTool',
  {
    effect: Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const invoiceService = yield* InvoiceService

      const templatePath = path.join(import.meta.dirname, '..', '..', 'templates', TEMPLATE_FILE)

      return {
        execute: (input: SaveExpenseReportInput = {}) =>
          Effect.gen(function* () {
            const outputDir = input.outputDir ?? DEFAULT_OUTPUT_DIR

            const categories = yield* invoiceService
              .getExpenseReportByCategory()
              .pipe(
                Effect.mapError(
                  (cause) =>
                    new ReportError({ message: `Could not load expense report: ${cause.message}` }),
                ),
              )

            const totals = sumTotals(categories)
            const now = yield* Effect.sync(() => new Date())
            const stamp = now.toISOString().replace(/[:.]/g, '-')
            const reportFile = path.join(outputDir, `report-${stamp}.html`)

            const template = yield* fs.readFileString(templatePath, 'utf-8').pipe(
              Effect.mapError(
                (cause) =>
                  new ReportError({
                    message: `Could not read report template at ${templatePath}: ${cause.message}`,
                  }),
              ),
            )

            const html = yield* Effect.try({
              try: () =>
                ejs.render(template, {
                  generatedAt: now.toISOString(),
                  categories,
                  totals,
                }),
              catch: (cause) =>
                new ReportError({ message: `Failed to render expense report: ${String(cause)}` }),
            })

            yield* fs.makeDirectory(outputDir, { recursive: true }).pipe(
              Effect.mapError(
                (cause) =>
                  new ReportError({
                    message: `Could not create report directory ${outputDir}: ${cause.message}`,
                  }),
              ),
            )

            yield* fs.writeFileString(reportFile, html).pipe(
              Effect.mapError(
                (cause) =>
                  new ReportError({
                    message: `Could not write expense report to ${reportFile}: ${cause.message}`,
                  }),
              ),
            )

            yield* Console.log(
              `Expense report saved to ${reportFile} (${categories.length} categories, total ${totals.total.toFixed(2)})`,
            )

            const result: ExpenseReportResult = {
              reportFile,
              categories: categories.length,
              total: totals.total,
              date: now.toISOString(),
            }

            return result
          }),
      }
    }),
  },
) {}
