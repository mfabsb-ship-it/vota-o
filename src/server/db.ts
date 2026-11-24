import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.resolve(DATA_DIR, 'votacao.db');
export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

export const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL CHECK(category IN ('desenho', 'poema')),
    student_name TEXT NOT NULL,
    student_class TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK(category IN ('desenho', 'poema')),
    voter_token_hash TEXT NOT NULL,
    ip_hash TEXT NOT NULL,
    user_agent_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(category, voter_token_hash)
  );

  CREATE INDEX IF NOT EXISTS idx_votes_category_ip ON votes(category, ip_hash);
  CREATE INDEX IF NOT EXISTS idx_votes_entry_id ON votes(entry_id);

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

export function getSetting(key: string, defaultValue = ''): string {
  const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
  const row = stmt.get(key) as { value: string } | undefined;
  return row ? row.value : defaultValue;
}

export function setSetting(key: string, value: string): void {
  const stmt = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  );
  stmt.run(key, value);
}

export function getOrCreateSessionSecret(): string {
  const envSecret = process.env.SESSION_SECRET?.trim();
  if (envSecret && envSecret.length >= 16) {
    return envSecret;
  }
  const existing = getSetting('session_secret');
  if (existing && existing.length >= 32) {
    return existing;
  }
  const generated = crypto.randomBytes(32).toString('hex');
  setSetting('session_secret', generated);
  return generated;
}

function seedInitialData(): void {
  const countRow = db.prepare('SELECT COUNT(*) AS count FROM entries').get() as { count: number };
  if (countRow.count === 0) {
    const now = new Date().toISOString();
    const insert = db.prepare(
      'INSERT INTO entries (category, student_name, student_class, title, image_url, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    );

    const seedEntries: Array<[string, string, string, string, string]> = [
      [
        'desenho',
        'Ana Clara Oliveira',
        '9º Ano A',
        'Árvore Cósmica do Saber',
        '/src/assets/images/desenho_arvore_cosmica_1795527998000.jpg',
      ],
      [
        'desenho',
        'Bruno Henrique Dias',
        '8º Ano B',
        'Guardiã dos Corais',
        '/src/assets/images/desenho_tartaruga_coral_1795527991234.jpg',
      ],
      [
        'desenho',
        'Sofia Martins Costa',
        '2º Ano EM',
        'Campus Verde Horizonte',
        '/src/assets/images/desenho_cidade_verde_1795527992465.jpg',
      ],
      [
        'poema',
        'Maria Eduarda Silva',
        '1º Ano EM',
        'Estrelas do Amanhã',
        '/src/assets/images/poema_estrelas_amanha_1795527992377.jpg',
      ],
      [
        'poema',
        'Margarida Almeida',
        '3º Ano EM',
        'O Mar e o Silêncio',
        '/src/assets/images/poema_mar_silencio_1795527993313.jpg',
      ],
    ];

    for (const [category, studentName, studentClass, title, imageUrl] of seedEntries) {
      insert.run(category, studentName, studentClass, title, imageUrl, now);
    }
  }

  if (!getSetting('show_public_results')) {
    setSetting('show_public_results', '0');
  }
  if (!getSetting('allow_shared_school_wifi')) {
    setSetting('allow_shared_school_wifi', '0');
  }
  if (!getSetting('voting_active')) {
    setSetting('voting_active', '1');
  }
}

seedInitialData();
