import { tagSlug } from "@colcom/shared"

import db from "@/pgDatabase"
import git from "@/gitDatabase"
import Content from "@/models/content"
import Tags from "@/models/tags"
import logger from "@/logger"
import { META_GROUPS, META_TAG } from "@/metaTopics"


// The account the instance writes as: it authors the foundational topics and applies the reserved
// tag, so both show in the history like anyone's. Its password isn't a bcrypt hash, so no password
// matches it and nobody can log in as it; its name, taken here, can't be signed up for.
export const SYSTEM_USER = Object.freeze({ name: "colcom", email: "colcom@colcom.invalid" })

// colcom's logo as a 16x16 pixel-art PNG, like the avatars people draw
const SYSTEM_AVATAR = "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAADQElEQVR42mWT3W+TZRjGr/t5+/aLrkDp2joXM8IQwiTLYkzEEJmGmc0gjJG3RmSIwSPigpkf0Rh4fBycaFAnB8YjTQzD9JXA1CAUGJkfISGahZBOSHagUbd1bqvtuq5v1/e5PVg0c/7+gF/uXNd1E5YgAGxZlrGj2ewGid3MHCHC3UqF7V41cFVKCKWgsQKDGQRI6mqtr2moM74Kh4K9C+XKWmZogDrCIf/B1kfuD76hMleklGJ4eJiXC4RtW0IppbVwP1i3NrQzVyi9MutuvPfo8YFmB7y+tODcjqypea1fPbNDKaVTlmX8R5BM2u57J569x2eah6ZmCt+9dHzglFJK9/e0+149NvBrmfURGMJxhehggCYSI57lAg8ACK1bwqtX0XSueF5KKYBRz1FlOwCw9W5mJJeo3VXH1UkCGKfHnOV5LAlAMSIA4AmllAbzYnokWuczzRO8kN2XGBsPMpH+1or/VHDw5i6Vvf6PxAMAGqgAYAHySynFhu7mgDA8X9cGRcsf8+6XVcObJnAiwPrFaICG0ntiO59QU9dSFgwBANqlO4tVl1y3ul0ppWPO7PObo96WiYLzYdu5SWu8dfdzI9s6p7yzxc0aNE8GffzjgzAtG1pIKUV9U+VWPl/6ORT0H+jre2H9mvzU78Vi+ezjgzMvnzp58EjEbzwULkyLbUPz2UJFfxYLGBvmGhLNBLBoGh2lZNJ2BXBYgxAR5cwP25Obzjd12P1q/0fRkPf93yb/yoTJ+wkDZBj8vSnAVe1uWarRtl0ppeiRZ2/k8qVHiXDTNKgvIPCFxyMOFUtOiqto71Zn5ghgg1FkgARh1b8tKKW0lFK8rtRNAK2Dhx9o8xvYOrM68fn+d6+OA0DKgjezBVXcRpwABhvTK2eNi+2NPmama53rTt45kOD0U5GHAeBiT6OPl/4FV7ri6RtPJ/j6nnjD0gSWUawZqxIRazIvlLSA6TPfubw3Hnvy9JhDAA91xXrrQ0bbnMNnHhvM/pKyYNDKK1hCkIK+1Bl/uzYojuUd7biabwmiRDRg3Jcru5f9/sXkN42zxbcU+H8CAJCAUIC+tLe2PegR3VpjEwn8yRp267nspwA0A0QA/w3d9m7iRsl6mQAAAABJRU5ErkJggg=="

async function systemUser(): Promise<{ id: number, pid: string }> {
  const result = await db.query({
    text: `
      INSERT INTO users (name, pass, email, avatar) VALUES ($1, '!', $2, decode($3, 'base64'))
      ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
      RETURNING id, pid
      ;`,
    values: [SYSTEM_USER.name, SYSTEM_USER.email, SYSTEM_AVATAR]
  })
  return result.rows[0]
}

// The system account's id, or undefined before the first startup made it
export async function systemUserId(): Promise<number | undefined> {
  const result = await db.query({ text: "SELECT id FROM users WHERE email = $1;", values: [SYSTEM_USER.email] })
  return result.rows[0]?.id
}

export const metaTitles = () => META_GROUPS.flatMap(group => group.topics.map(topic => topic.title))

// Makes what's missing of the meta space: the system account, the reserved tag and each foundational
// topic, tagged once. Run at every startup, so it changes nothing when everything is there.
export async function ensureMeta() {
  const user = await systemUser()
  const tagId = await Tags.reserve(tagSlug(META_TAG), META_TAG, user.id)

  for (const { title, body, answers } of META_GROUPS.flatMap(group => group.topics)) {
    const found = await db.query({
      text: "SELECT id FROM contents WHERE type = 'topic' AND author_id = $1 AND title = $2;",
      values: [user.id, title]
    })
    let id: number = found.rows[0]?.id

    if (!id) {
      const topic = await Content.create({ title, author_pid: user.pid, body, type: "topic", config: { answers } })
      try {
        await git.create({ ...topic, body }, { username: SYSTEM_USER.name, email: SYSTEM_USER.email })
      }
      catch (err) {
        // As createContent's withRollback: no row without its repo
        await Content.removeById(topic.id)
        throw err
      }
      id = topic.id
      logger.info(`[meta.ts] Opened the meta topic "${title}" (${id})`)
    }

    // Voting again would log the same vote on every startup
    if (!(await Tags.proposed(id)).has(tagId))
      await Tags.vote(id, tagId, user.id, 1)
  }
}
