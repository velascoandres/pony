import { FetchHttpClient } from '@effect/platform'
import { Layer } from 'effect'
import { SriService } from './sri.service.js'

export const ServicesLayer = Layer.mergeAll(SriService.Default).pipe(
  Layer.provide(FetchHttpClient.layer),
)
