// Types for src/ (plain JS, so both packages can use it without a build step). Keep in step with
// limits.js and schemas.js.

export interface Limits {
  username: { min: number, max: number }
  email: { max: number }
  password: { min: number, maxBytes: number }
  avatar: { maxBytes: number }
  title: { min: number, max: number }
  answers: { min: number, max: number }
  answer: { max: number }
  postBody: { max: number }
  critiqueBody: { max: number }
  message: { max: number }
  quote: { max: number, context: number }
  page: { max: number }
  pageSize: { default: number, max: number }
  orderBy: { max: number }
}

export type LimitOverrides = { [Group in keyof Limits]?: Partial<Limits[Group]> }

export interface CritiqueConfig {
  commit: string
  from: number
  to: number
  quote: { exact: string, prefix: string, suffix: string, start: number }
}

// What each schema accepts, after defaults are filled in
export interface SchemaData {
  signUp: { name: string, email: string, pass: string, avatar: string }
  login: { login: string, pass: string }
  content: { parent_id?: number, [key: string]: unknown }
  topic: { title: string, body?: string, config: { answers: string[], allowMultipleAnswers?: boolean } }
  post: { title: string, parent_id: number, body: string, config: { answer?: string } }
  critique: { title: string, parent_id: number, body: string, config: CritiqueConfig }
  critiqueConfig: CritiqueConfig
  edit: { body: string, message: string }
  clone: { title: string }
  interaction: { content_id: number, type: "up" | "down" | "vote" | "bookmark" | "promote" }
  readNotifications: { ids?: number[] }
  notifications: { page: number, pageSize: number, unread: boolean }
  list: { page: number, pageSize: number, orderBy: string, authorId?: string, [key: string]: unknown }
  contentParams: { id: number }
  versionParams: { id: number, hash: string }
  userParams: { name: string }
}

export type SchemaName = keyof SchemaData

export interface FieldError {
  key: string
  label: string
  message: string
  action?: string
}

export interface ValidationResult<Name extends SchemaName> {
  valid: boolean
  data: SchemaData[Name]
  errors: FieldError[]
}

export interface Validators {
  limits: Limits
  schemas: Record<SchemaName, object>
  validate<Name extends SchemaName>(name: Name, data: unknown): ValidationResult<Name>
}

export const DEFAULT_LIMITS: Limits
export function mergeLimits(overrides?: LimitOverrides): Limits
export function createSchemas(limits: Limits): { body: Record<string, object>, query: Record<string, object> }
export function createValidators(Ajv: new (options: object) => any, options?: { limits?: LimitOverrides }): Validators
export function formatErrors(errors: object[] | null | undefined, rootSchema: object): FieldError[]
export function describe(error: FieldError): string
export function fieldErrors(errors: FieldError[]): Record<string, string>
export function byteLength(value: string): number
