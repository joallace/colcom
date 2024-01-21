import { hash } from "bcryptjs"

import db from "@/database"
import { NotFoundError, ValidationError } from "@/errors"


interface UserConfig {
  theme?: string
}

interface UserInsertRequest {
  name: string,
  pass: string,
  email: string
  [key: string]: string
}

interface User {
  id?: string,
  pid: string, // Public ID
  name: string,
  pass: string,
  email: string,
  colcoins: number,
  prestige: number,
  permissions: string[],
  config?: UserConfig,
  created_at: Date
}

async function validateUnique(value: string, field: keyof User) {
  const query = {
    text: `SELECT ${field} FROM users WHERE LOWER(${field}) = LOWER($1)`,
    values: [value],
  }

  const results = await db.query(query)

  if (Number(results.rowCount) > 0) {
    throw new ValidationError({
      message: `O "${field}" informado já está sendo usado.`,
      stack: new Error().stack,
      errorLocationCode: 'MODEL:USER:VALIDATE_UNIQUE:ALREADY_EXISTS',
      key: field,
    })
  }
}

export async function create({ name, pass, email }: UserInsertRequest): Promise<User | undefined> {
  await validateUnique(name, "name")
  await validateUnique(email, "email")

  const hashedPass = await hash(pass, 10)

  const query = {
    text: `
      INSERT INTO
        users(
          name,
          pass,
          email
        )
      VALUES
        ($1, $2, $3)
      RETURNING
        *
      ;`,
    values: [name, hashedPass, email]
  }

  const result = await db.query(query)
  return result.rows[0]
}

export async function findAll({ where = "", orderBy = "id", page = 1, pageSize = 10, values = [] as any[], hideSensitiveInfo = true }): Promise<User[]> {
  const query = {
    text: `
      SELECT
        pid,
        name,
        ${hideSensitiveInfo ? "" : "pass, email,"}
        colcoins,
        prestige,
        permissions,
        created_at
      FROM
        users
      ${where ? `WHERE ${where}` : ""}
      ORDER BY ${orderBy} DESC
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
      ;
    ;`,
    values
  }

  const results = await db.query(query)
  return results.rows
}

export async function findByLogin(login: string, options = {}): Promise<User> {
  const searchTerm = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(login) ? "email" : "name"
  const result = await findAll({
    where: `LOWER(${searchTerm}) = $1`,
    values: [login],
    pageSize: 1,
    ...options
  })

  if (result.length === 0) {
    throw new NotFoundError({
      message: `O "${searchTerm}" informado não foi encontrado.`,
      action: `Verifique se o "${searchTerm}" foi digitado corretamente.`,
      stack: new Error().stack,
      errorLocationCode: 'MODEL:USER:FIND_BY_LOGIN:NOT_FOUND',
      key: searchTerm,
    })
  }

  return result[0]
}

export async function removeFeatures(userPid: string, features: string[]): Promise<User> {
  let lastUpdatedUser

  if (features?.length > 0) {
    for (const feature of features) {
      const query = {
        text: `
          UPDATE
            users
          SET
            features = array_remove(features, $1),
          WHERE
            pid = $2
          RETURNING
            *
        ;`,
        values: [feature, userPid]
      }

      const results = await db.query(query)
      lastUpdatedUser = results.rows[0]
    }
  } else {
    const query = {
      text: `
        UPDATE
          users
        SET
          features = '{}',
        WHERE
          pid = $1
        RETURNING
          *
      ;`,
      values: [userPid]
    }

    const results = await db.query(query)
    lastUpdatedUser = results.rows[0]
  }

  return lastUpdatedUser
}

export async function addFeatures(userPid: string, features: string[]): Promise<User> {
  const query = {
    text: `
      UPDATE
        users
      SET
        features = array_cat(features, $1),
        updated_at = (now() at time zone 'utc')
      WHERE
        pid = $2
      RETURNING
        *
    ;`,
    values: [features, userPid],
  }

  const results = await db.query(query)

  return results.rows[0]
}


export async function getDataByPublicId(public_id: string, data: (keyof User)[]): Promise<any> {
  const query = {
    text: `
      SELECT
        ${data.join()}
      FROM
        users
      WHERE
        pid = $1
      ;`,
    values: [public_id],
  }

  try {
    const result = await db.query(query)
    return result.rows[0]
  } catch (err) {
    console.error(err)
  }
}

export default Object.freeze({
  create,
  findAll,
  findByLogin,
  removeFeatures,
  addFeatures,
  getDataByPublicId
})

export { UserInsertRequest }