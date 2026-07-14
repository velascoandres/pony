import { Layer } from 'effect'
import { InvoiceAgent } from './invoice.agent.js'

export const AgentsLayer = Layer.mergeAll(InvoiceAgent.Default)
