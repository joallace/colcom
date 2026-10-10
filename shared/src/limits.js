// Every size the frontend and backend enforce. Schemas are built from these values, so changing one
// here changes it on both sides; createValidators also takes overrides for a single instance.
export const DEFAULT_LIMITS = Object.freeze({
  // users.name is VARCHAR(32) and users.email VARCHAR(254) (RFC 5321) in init.sql: keep them in step
  username: Object.freeze({ min: 3, max: 32 }),
  email: Object.freeze({ max: 254 }),
  // bcrypt only reads the first 72 bytes, so a longer password would be silently truncated
  password: Object.freeze({ min: 8, maxBytes: 72 }),
  // The pixel-art avatar is a 16x16 PNG, a few hundred bytes
  avatar: Object.freeze({ maxBytes: 32 * 1024 }),

  title: Object.freeze({ min: 3, max: 150 }),
  // A topic either leaves answers open (none) or offers between `min` and `max` of them
  answers: Object.freeze({ min: 2, max: 10 }),
  answer: Object.freeze({ max: 64 }),
  // HTML, as the editor emits it
  postBody: Object.freeze({ max: 100_000 }),
  critiqueBody: Object.freeze({ max: 5_000 }),
  // The commit message of an edit or suggestion
  message: Object.freeze({ max: 200 }),
  quote: Object.freeze({ max: 5_000, context: 32 }),
  // A tag's name, and so its slug (tags.js), which has the same length
  tag: Object.freeze({ min: 2, max: 32 }),
  // Tags given when creating a topic, distinct tags proposed on one topic, and tags combined in a filter
  tags: Object.freeze({ seed: 5, perTopic: 10, filter: 5 }),
  // What's typed in the search box
  search: Object.freeze({ max: 200 }),

  page: Object.freeze({ max: 1_000_000 }),
  pageSize: Object.freeze({ default: 10, max: 100 }),
  orderBy: Object.freeze({ max: 32 })
})

// Overrides are given per group, e.g. { title: { max: 200 } }, and keep the group's other values
export const mergeLimits = (overrides = {}) => {
  const limits = {}

  for (const [group, values] of Object.entries(DEFAULT_LIMITS))
    limits[group] = Object.freeze({ ...values, ...overrides[group] })

  return Object.freeze(limits)
}
