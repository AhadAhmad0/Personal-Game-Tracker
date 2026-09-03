import { createClient } from '@libsql/client';

// TURSO_DATABASE_URL and TURSO_AUTH_TOKEN come from your Turso dashboard.
// Locally, you can also just point this at a local file, e.g. 'file:local.db',
// so you can develop without touching the cloud DB.
const url = process.env.TURSO_DATABASE_URL || 'file:local.db';
const authToken = process.env.TURSO_AUTH_TOKEN; // not needed for local file mode

export const db = createClient(
  authToken ? { url, authToken } : { url }
);

export async function initDb() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      genre TEXT,
      rating INTEGER,
      notes TEXT,
      cover_image_url TEXT,
      date_completed TEXT,
      source TEXT DEFAULT 'manual',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
}
