import { hash, compare } from "bcrypt"

import db from "@/database"
import { NotFoundError } from "@/errors";


interface UserConfig {
  theme?: string
}

interface RegisteringUser {
  name: string,
  pass: string,
  email: string
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


export async function create({ name, pass, email }: RegisteringUser): Promise<User | undefined> {
  const hashedPass = await hash(pass, 8)

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
    values: [name, email, hashedPass],
  }

  try {
    const result = await db.query(query)
    return result.rows[0]
  } catch (err) {
    console.error(err);
  }
}

export async function findByLogin(login: string): Promise<User> {
  const searchTerm = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(login) ? "email" : "name"
  const query = {
    text: `
      WITH user_found AS (
        SELECT
          pid,
          name,
          pass,
          email,
          colcoins,
          prestige,
          permissions,
          created_at
        FROM
          users
        WHERE
          LOWER(${searchTerm}) = LOWER($1)
        LIMIT
          1
    )
    SELECT
      *
    FROM
      user_found
    ;`,
    values: [login]
  };

  const results = await db.query(query);

  if (results.rowCount === 0) {
    throw new NotFoundError({
      message: `O ${searchTerm} informado não foi encontrado.`,
      action: `Verifique se o "${searchTerm}" foi digitado corretamente.`,
      stack: new Error().stack,
      errorLocationCode: 'MODEL:USER:FIND_BY_LOGIN:NOT_FOUND',
      key: 'email',
    });
  }

  return results.rows[0];
}

export async function removeFeatures(userPid: string, features: string[]): Promise<User> {
  let lastUpdatedUser;

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
        values: [feature, userPid],
      };

      const results = await db.query(query);
      lastUpdatedUser = results.rows[0];
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
      values: [userPid],
    };

    const results = await db.query(query);
    lastUpdatedUser = results.rows[0];
  }

  return lastUpdatedUser;
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
  };

  const results = await db.query(query);

  return results.rows[0];
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
    console.error(err);
  }
}