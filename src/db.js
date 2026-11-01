import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || path.join(here, '..', 'data', 'beach-place.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(fs.readFileSync(path.join(here, 'schema.sql'), 'utf8'));
// migration: furniture/staging budget on finance_targets
if (!db.prepare("PRAGMA table_info(finance_targets)").all().some(c => c.name === 'furniture_budget_cents'))
  db.exec('ALTER TABLE finance_targets ADD COLUMN furniture_budget_cents INTEGER NOT NULL DEFAULT 500000');
