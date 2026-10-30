// Run through `npm run test:e2e` (scripts/run-e2e.ts), which provides the database and env.
import { defineConfig, devices } from "@playwright/test";

const port = process.env.PORT ?? "3100";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: { baseURL: `http://localhost:${port}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: `npx next dev --port ${port}`,
    url: `http://localhost:${port}/login`,
    timeout: 180_000,
    reuseExistingServer: false,
  },
});
