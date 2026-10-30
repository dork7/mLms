// Applies drizzle/ migrations to DATABASE_URL. Run on every start (Docker) and by `npm run dev`.
import { createDb, migrateDb } from "../src/db/client";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const db = createDb(url);
await migrateDb(db);
await db.$client.end();
console.info("migrations applied");
