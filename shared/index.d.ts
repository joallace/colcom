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
  tag: { min: number, max: number }
  tags: { seed: number, perTopic: number, filter: number }
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
  topic: { title: string, body?: string, config: { answers: string[], allowMultipleAnswers?: boolean }, tags: string[] }
  post: { title: string, parent_id: number, body: string, config: { answer?: string } }
  critique: { title: string, parent_id: number, body: string, config: CritiqueConfig }
  critiqueConfig: CritiqueConfig
  edit: { body: string, message: string }
  resolution: { body: string, head: string }
  clone: { title: string }
  interaction: { content_id: number, type: "up" | "down" | "vote" | "bookmark" | "promote" }
  tagVote: { tag: string, value: 1 | -1 | 0 }
  readNotifications: { ids?: number[] }
  notifications: { page: number, pageSize: number, unread: boolean }
  list: { page: number, pageSize: number, orderBy: string, authorId?: string, tags?: string, [key: string]: unknown }
  tagList: { q: string, page: number, pageSize: number }
  contentParams: { id: number }
  versionParams: { id: number, hash: string }
  tagParams: { slugs: string }
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
// Ajv's class. At runtime it also carries the `_` code template the custom keywords are generated
// with, which its types leave out
export type AjvClass = new (options: object) => any
export type ValidateFunction = ((data: unknown) => boolean) & { errors?: object[] | null }

export function createValidators(Ajv: AjvClass, options?: { limits?: LimitOverrides }): Validators
export function createPrecompiledValidators(functions: Record<string, ValidateFunction>, options?: { limits?: LimitOverrides }): Validators
export function formatErrors(errors: object[] | null | undefined, rootSchema: object): FieldError[]
export function describe(error: FieldError): string
export function fieldErrors(errors: FieldError[]): Record<string, string>
export function byteLength(value: string): number
export const formats: Record<"email" | "commit" | "uuid" | "png", RegExp | ((value: string) => boolean)>
export function ucs2length(value: string): number
// A tag's identity: accents dropped, lowercase, words joined by "-"
export function tagSlug(name: string): string
export const TAG_NAME_PATTERN: string
export const TAG_SLUG_PATTERN: string
// A three-way merge of documents stored one block per line (merge.js)
export type MergeChunk = { type: "ok", text: string } | { type: "conflict", base: string, ours: string, theirs: string }
export function merge3(base: string, ours: string, theirs: string): MergeChunk[]
export function cleanMerge(base: string, ours: string, theirs: string): string | undefined
export function diffLines(a: string[], b: string[]): { start: number, end: number, lines: string[] }[]
export function splitLines(text: string): string[]
