// JSON Schemas for every request colcom accepts. They are built from the limits (limits.js), so the
// same rules, sizes and messages apply in the forms and in the API.
//
// Besides the standard keywords, schemas use:
// - annotations: `label` (the field's name in messages), `messages` (per-keyword message overrides)
//   and `action` (what to do about it, sent by the API);
// - keywords: `trimmed` (no surrounding whitespace), `notBlank` (some non-whitespace character) and
//   `maxBytes` (UTF-8 length);
// - formats: `email`, `commit`, `uuid` and `png` (base64). See keywords.js.

const MAX_ID = 2_147_483_647 // Postgres' SERIAL

// base64 takes 4 characters for every 3 bytes
const base64Length = bytes => 4 * Math.ceil(bytes / 3)

const id = label => ({ type: "integer", minimum: 1, maximum: MAX_ID, label })

const offset = { type: "integer", minimum: 0, maximum: MAX_ID }

export function createSchemas(limits) {
  const title = { type: "string", label: "título", minLength: limits.title.min, maxLength: limits.title.max, trimmed: true }
  const postBody = { type: "string", label: "texto", minLength: 1, maxLength: limits.postBody.max, notBlank: true }
  const commit = label => ({ type: "string", label, format: "commit" })
  const username = {
    type: "string",
    label: "nome de usuário",
    minLength: limits.username.min,
    maxLength: limits.username.max,
    trimmed: true,
    // Logging in takes a name or an email, told apart by the "@"
    pattern: "^[^@]*$",
    // GET /users/self is the logged in user, so a user named "self" couldn't have a public profile
    not: { const: "self" },
    messages: { pattern: 'não pode conter "@"', not: "nome reservado" }
  }

  const signUp = {
    type: "object",
    required: ["name", "email", "pass", "avatar"],
    additionalProperties: false,
    properties: {
      name: username,
      email: { type: "string", label: "email", maxLength: limits.email.max, format: "email" },
      pass: { type: "string", label: "senha", minLength: limits.password.min, maxBytes: limits.password.maxBytes },
      avatar: { type: "string", label: "foto de perfil", maxLength: base64Length(limits.avatar.maxBytes), format: "png" }
    }
  }

  const login = {
    type: "object",
    required: ["login", "pass"],
    additionalProperties: false,
    properties: {
      login: { type: "string", label: "nome de usuário ou email", minLength: 1, maxLength: Math.max(limits.username.max, limits.email.max) },
      pass: { type: "string", label: "senha", minLength: 1, maxBytes: limits.password.maxBytes }
    }
  }

  const topic = {
    type: "object",
    required: ["title"],
    additionalProperties: false,
    properties: {
      title,
      body: { type: "string", label: "texto", maxLength: limits.postBody.max },
      config: {
        type: "object",
        default: {},
        additionalProperties: false,
        properties: {
          answers: {
            type: "array",
            label: "respostas",
            default: [],
            maxItems: limits.answers.max,
            uniqueItems: true,
            // Either no answers (open) or at least the minimum
            not: { type: "array", minItems: 1, maxItems: limits.answers.min - 1 },
            messages: { not: `defina ao menos ${limits.answers.min} respostas, ou nenhuma`, uniqueItems: "as respostas devem ser diferentes" },
            items: { type: "string", label: "resposta", minLength: 1, maxLength: limits.answer.max, trimmed: true }
          },
          allowMultipleAnswers: { type: "boolean", label: "permitir múltiplas respostas" }
        }
      }
    }
  }
  const post = {
    type: "object",
    required: ["title", "parent_id", "body"],
    additionalProperties: false,
    properties: {
      title,
      parent_id: id("tópico"),
      body: postBody,
      config: {
        type: "object",
        default: {},
        additionalProperties: false,
        properties: {
          // Checked against the topic's answers by the API
          answer: { type: "string", label: "resposta", maxLength: limits.answer.max }
        }
      }
    }
  }

  // A critique is anchored to the exact version it criticised (commit + positions) and also carries
  // the quoted text with some context around it, to find the passage again in later versions
  const critiqueConfig = {
    type: "object",
    label: "trecho criticado",
    action: "Selecione um trecho de texto do post e tente novamente.",
    required: ["commit", "from", "to", "quote"],
    additionalProperties: false,
    properties: {
      commit: commit("versão criticada"),
      from: offset,
      to: { ...offset, exclusiveMinimum: { $data: "1/from" } },
      quote: {
        type: "object",
        required: ["exact", "prefix", "suffix", "start"],
        additionalProperties: false,
        properties: {
          exact: { type: "string", minLength: 1, maxLength: limits.quote.max, notBlank: true },
          prefix: { type: "string", maxLength: limits.quote.context },
          suffix: { type: "string", maxLength: limits.quote.context },
          start: offset
        }
      }
    }
  }

  const critique = {
    type: "object",
    required: ["title", "parent_id", "body", "config"],
    additionalProperties: false,
    properties: {
      title,
      parent_id: id("post"),
      body: { ...postBody, maxLength: limits.critiqueBody.max },
      config: critiqueConfig
    }
  }

  // Only `parent_id` decides which of topic, post or critique a new content is
  const content = {
    type: "object",
    properties: { parent_id: id("conteúdo pai") }
  }

  const edit = {
    type: "object",
    required: ["body", "message"],
    additionalProperties: false,
    properties: {
      body: postBody,
      message: { type: "string", label: "descrição da alteração", minLength: 1, maxLength: limits.message.max, trimmed: true }
    }
  }

  const clone = {
    type: "object",
    required: ["title"],
    additionalProperties: false,
    properties: { title }
  }

  const interaction = {
    type: "object",
    required: ["content_id", "type"],
    additionalProperties: false,
    properties: {
      content_id: id("conteúdo"),
      type: { type: "string", label: "tipo de interação", enum: ["up", "down", "vote", "bookmark", "promote"] }
    }
  }

  // Query strings and route parameters arrive as strings, so these are validated with type coercion.
  // Unknown keys are kept: flags like `with_count` are read by presence.
  const list = {
    type: "object",
    properties: {
      page: { type: "integer", label: "página", minimum: 1, maximum: limits.page.max, default: 1 },
      pageSize: { type: "integer", label: "tamanho da página", minimum: 1, maximum: limits.pageSize.max, default: limits.pageSize.default },
      orderBy: { type: "string", label: "ordenação", minLength: 1, maxLength: limits.orderBy.max, default: "id" },
      authorId: { type: "string", label: "autor", format: "uuid" }
    }
  }

  const contentParams = {
    type: "object",
    required: ["id"],
    properties: { id: id("id") }
  }

  const versionParams = {
    type: "object",
    required: ["id", "hash"],
    properties: { id: id("id"), hash: commit("versão") }
  }

  const userParams = {
    type: "object",
    required: ["name"],
    properties: { name: username }
  }

  return {
    body: { signUp, login, content, topic, post, critique, critiqueConfig, edit, clone, interaction },
    query: { list, contentParams, versionParams, userParams }
  }
}
