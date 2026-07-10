import { Layer } from 'effect'
import { SriService } from './sri.service.js'

// HttpClient se provee globalmente desde el MainLayer.
export const ServicesLayer = Layer.mergeAll(SriService.Default)
