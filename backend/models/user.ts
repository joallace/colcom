import db from "../database"
import { hash, compare } from "bcrypt"

interface RegisteringUser {
  nick: string,
  pass: string,
  email: string
}

async function validateNickname(username: string) {
  const query = {
    text: `
      SELECT 
        nick
      FROM
        users
      WHERE
        LOWER(username) = LOWER($1)`,
    values: [username],
  }

  const results = await db.query(query)

  if (results.rowCount && results.rowCount > 0)
    return false
  else
    return true
}

async function validateEmail(email: string) {
  const query = {
    text: `
      SELECT
        email
      FROM
        users
      WHERE
        LOWER(email) = LOWER($1)`,
    values: [email],
  }

  const results = await db.query(query)

  if (results.rowCount && results.rowCount > 0)
    return false
  else
    return true
}

export async function create({ nick, pass, email }: RegisteringUser) {
  if(await validateNickname(nick) || await validateEmail(email))
    return
  
  const hashedPass = hash(pass, 8)

  const query = {
    text: `
      INSERT INTO
        users(
          nick,
          pass,
          email
        )
      VALUES
        ($1, $2, $3)
      RETURNING
        *
      ;`,
    values: [nick, email, hashedPass],
  }

  const result = await db.query(query)
  return result.rows[0]
}

export async function getDataByPid(public_id: string, data: string[]): Promise<any> {
  const query = {
    text: `
      SELECT
        ${data.join()}
      FROM
        users
      WHERE
        pid = $1`,
    values: [public_id],
  }

  const result = await db.query(query)
  return result.rows[0]
}