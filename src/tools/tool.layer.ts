import { Layer } from 'effect'
import { GetFiscalInfoTool } from './get-fiscal-info.js'

export const ToolsLayer = Layer.mergeAll(GetFiscalInfoTool.Default)
