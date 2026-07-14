import { Layer } from 'effect'
import { InvoiceService } from './invoice.service.js'
import { SriService } from './sri.service.js'

// HttpClient se provee globalmente desde el MainLayer.
export const ServicesLayer = Layer.mergeAll(SriService.Default, InvoiceService.Default)
