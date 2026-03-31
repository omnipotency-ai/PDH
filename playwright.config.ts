import { defineConfig, devices } from "@playwright/test";

const STORAGE_STATE = ".playwright/auth/user.json";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: "http://localhost:3005",
    headless: true,
  },
  projects: [
    {
      name: "auth-setup",
      testMatch: /auth\.setup\.ts/,
      testDir: "./e2e",
    },
    {
      name: "chromium",
      testMatch: /.*\.spec\.ts/,
      testDir: "./e2e",
      dependencies: ["auth-setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: STORAGE_STATE,
      },
    },
  ],
  webServer: {
    command: "bun run dev",
    port: 3005,
    reuseExistingServer: true,
  },
});
