import { Layer } from 'effect'
import { LLMService } from '../llm/client.js'
import { InvoiceAgent } from './invoice.agent.js'

export const AgentsLayer = Layer.mergeAll(InvoiceAgent.Default).pipe(
  Layer.provideMerge(LLMService.Default),
)
