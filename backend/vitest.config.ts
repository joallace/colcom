import { resolve } from "path"
import { defineConfig } from "vitest/config"


const shared = {
  resolve: {
    alias: { "@": resolve(import.meta.dirname, "src") }
  }
}

export default defineConfig({
  test: {
    env: {
      // config.ts refuses to load without a 32+ character secret
      ACCESS_TOKEN_SECRET: "test-secret-that-is-at-least-32-characters-long",
      PINO_LOG_LEVEL: "silent",
      // Helpers sign up and log in many users from one address; rateLimit.test.ts turns them on
      RATE_LIMIT_LOGIN: "off",
      RATE_LIMIT_SIGN_UP: "off",
      RATE_LIMIT_CONTENTS: "off",
      RATE_LIMIT_INTERACTIONS: "off",
      DB_POOL: "4",
      // git must not read the developer's configuration (signing, hooks, default branch…), and
      // needs an identity for merge commits, as the Docker image sets one globally
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "colcom",
      GIT_AUTHOR_EMAIL: "admin@colcom.test",
      GIT_COMMITTER_NAME: "colcom",
      GIT_COMMITTER_EMAIL: "admin@colcom.test"
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/server.ts"]
    },
    projects: [
      {
        ...shared,
        extends: true,
        test: {
          name: "unit",
          include: ["test/unit/**/*.test.ts"],
          setupFiles: ["test/setup/unit.ts"]
        }
      },
      {
        ...shared,
        extends: true,
        test: {
          name: "integration",
          include: ["test/integration/**/*.test.ts"],
          globalSetup: ["test/setup/postgres.ts"],
          setupFiles: ["test/setup/integration.ts"],
          // Every request runs git and bcrypt, slower than the 5 s default on a loaded machine
          testTimeout: 20_000,
          hookTimeout: 60_000
        }
      }
    ]
  }
})
