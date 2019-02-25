

export type PrimaryKeyType = string

export const MODEL_PRIMARY_KEY = 'pk'

export interface BaseModel {
  readonly pk: PrimaryKeyType
}
