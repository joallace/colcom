// Unit tests touch no database, but gitDatabase.ts creates its directory on import, so each test
// file gets an empty one instead of the default inside src/.
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll } from "vitest"


process.env.DB_PATH = mkdtempSync(join(tmpdir(), "colcom-git-"))

afterAll(() => {
  rmSync(process.env.DB_PATH!, { recursive: true, force: true })
})
