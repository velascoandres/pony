import { FileSystem } from '@effect/platform'
import { Effect, Schema } from 'effect'
import { XMLParser } from 'fast-xml-parser'
import { XMLParsingError } from '../errors.js'
import { InvoiceSchema } from '../schemas.js'

type Invoice = Schema.Schema.Type<typeof InvoiceSchema>

// biome-ignore lint/suspicious/noExplicitAny: parsed XML is dynamically shaped
type Xml = Record<string, any>

const parser = new XMLParser({
  ignoreAttributes: true,
  // Keep every value as string so leading zeros (secuencial, ruc) and dates
  // (fechaEmision) survive; numeric fields are coerced explicitly below.
  parseTagValue: false,
  trimValues: true,
})

const toArray = <T>(value: T | T[] | undefined): T[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value]

const toNumber = (value: unknown): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

// SRI XML files come in several shapes: a bare <factura>, or a <factura>
// wrapped inside <autorizacion>/<comprobante> (as CDATA or entity-encoded
// text), optionally inside a SOAP envelope. Locate the <factura> node,
// re-parsing embedded comprobante strings as needed.
const findInvoice = (node: Xml, depth = 0): Xml | undefined => {
  if (depth > 10 || node === null || typeof node !== 'object') return undefined

  if ('factura' in node && node.factura && typeof node.factura === 'object') {
    return node.factura as Xml
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === 'comprobante' && typeof value === 'string') {
      const inner = findInvoice(parser.parse(value) as Xml, depth + 1)
      if (inner) return inner
    }
    if (value && typeof value === 'object') {
      const inner = findInvoice(value as Xml, depth + 1)
      if (inner) return inner
    }
  }

  return undefined
}

const mapInvoice = (factura: Xml): Invoice => {
  const infoTributaria: Xml = factura.infoTributaria ?? {}
  const infoFactura: Xml = factura.infoFactura ?? {}

  const items = toArray<Xml>(factura.detalles?.detalle).map((detalle) => ({
    description: String(detalle.descripcion ?? ''),
    quantity: toNumber(detalle.cantidad),
    unitPrice: toNumber(detalle.precioUnitario),
  }))

  // IVA is impuesto código "2"; sum its valor across all tax lines.
  const iva = toArray<Xml>(infoFactura.totalConImpuestos?.totalImpuesto)
    .filter((imp) => String(imp.codigo) === '2')
    .reduce((sum, imp) => sum + toNumber(imp.valor), 0)

  return {
    ruc: String(infoTributaria.ruc ?? ''),
    businessName: String(infoTributaria.razonSocial ?? ''),
    date: String(infoFactura.fechaEmision ?? ''),
    items,
    subtotal: toNumber(infoFactura.totalSinImpuestos),
    iva,
    total: toNumber(infoFactura.importeTotal),
  }
}

export class ParseInvoiceXmlTool extends Effect.Service<ParseInvoiceXmlTool>()('app/ParseXmlTool', {
  effect: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem

    return {
      execute: (xmlFilePath: string) =>
        Effect.gen(function* () {
          const xmlContent = yield* fs.readFileString(xmlFilePath, 'utf-8').pipe(
            Effect.mapError(
              (cause) =>
                new XMLParsingError({
                  message: `Could not read XML file at ${xmlFilePath}: ${cause.message}`,
                }),
            ),
          )

          if (!xmlContent.trim()) {
            return yield* Effect.fail(
              new XMLParsingError({
                message: `No content found in the XML file at ${xmlFilePath}`,
              }),
            )
          }

          const factura = yield* Effect.try({
            try: () => findInvoice(parser.parse(xmlContent) as Xml),
            catch: (cause) =>
              new XMLParsingError({
                message: `Failed to parse XML at ${xmlFilePath}: ${String(cause)}`,
              }),
          })

          if (!factura) {
            return yield* Effect.fail(
              new XMLParsingError({
                message: `No <factura> element found in the XML file at ${xmlFilePath}`,
              }),
            )
          }

          return yield* Schema.decode(InvoiceSchema)(mapInvoice(factura)).pipe(
            Effect.mapError(
              (cause) =>
                new XMLParsingError({
                  message: `Invalid invoice data in ${xmlFilePath}: ${cause.message}`,
                }),
            ),
          )
        }),
    }
  }),
}) {}
