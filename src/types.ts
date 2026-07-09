export interface Contributor {
  ruc: string
  businessName: string
  status: string // ACTIVE | SUSPENDED | INACTIVE...
  contributorType: string // NATURAL PERSON | COMPANY
  regime?: string // GENERAL | RIMPE...
  economicActivity?: string // key to classify expenses
  accountingObligatory?: boolean
  retentionAgent?: boolean
  specialContributor?: boolean
  startDateActivities?: string
}

export interface Establishment {
  number: string // "001", "002"...
  commercialName?: string
  address?: string
  status?: string // OPEN | CLOSED
  mainOffice?: boolean
}

export interface TaxPayerRegistryResult {
  ok: boolean
  source: 'cache' | 'sri'
  contributor?: Contributor
  establishments?: Establishment[]
  error?: string
}
