import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import QRCode from 'qrcode';
import { db, getOrCreateSessionSecret, getSetting, setSetting, UPLOADS_DIR } from './src/server/db.ts';
import {
  createAdminSessionToken,
  createSignedVoterToken,
  evaluateVoteEligibility,
  hashPassword,
  hashValue,
  normalizeClientIp,
  timingSafeStringMatch,
  verifyAdminSessionToken,
  verifyPassword,
  verifySignedVoterToken,
} from './src/server/security.ts';
import {
  computeCategoryRankings,
  computeDashboardMetrics,
  isSafeImageUrl,
  validateEntryInput,
  type Category,
  type EntryRecord,
  type VoteRecordForStats,
} from './src/utils/votingStats.ts';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const SESSION_SECRET = getOrCreateSessionSecret();
const VOTER_COOKIE_NAME = 've_voter_id';

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Login rate limiter (in-memory per normalized IP)
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 5 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 12) {
    return false;
  }
  entry.count += 1;
  return true;
}

// Multer configuration with strict image extension & size limit
const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024, // 8 MB
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TO_EXT[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new Error('Formato de imagem não suportado. Envie JPG, PNG, WEBP ou GIF.'));
    }
  },
});

function hasValidImageMagicBytes(buffer: Buffer, mimetype: string): boolean {
  if (buffer.length < 12) return false;
  if (mimetype === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimetype === 'image/png') {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }
  if (mimetype === 'image/gif') {
    const header = buffer.subarray(0, 6).toString('ascii');
    return header === 'GIF87a' || header === 'GIF89a';
  }
  if (mimetype === 'image/webp') {
    return (
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  return false;
}

function saveUploadedImage(file: Express.Multer.File): string {
  const ext = ALLOWED_MIME_TO_EXT[file.mimetype];
  if (!ext || !hasValidImageMagicBytes(file.buffer, file.mimetype)) {
    throw new Error('Arquivo de imagem inválido ou corrompido.');
  }
  const safeFilename = `${crypto.randomUUID()}${ext}`;
  const targetPath = path.resolve(UPLOADS_DIR, safeFilename);
  if (!targetPath.startsWith(UPLOADS_DIR + path.sep)) {
    throw new Error('Caminho de upload inválido.');
  }
  fs.writeFileSync(targetPath, file.buffer);
  return `/uploads/${safeFilename}`;
}

function safeDeleteUploadedFile(imageUrl: string): void {
  if (!imageUrl.startsWith('/uploads/')) return;
  const filename = imageUrl.slice('/uploads/'.length);
  if (!filename || filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    return;
  }
  const targetPath = path.resolve(UPLOADS_DIR, filename);
  if (!targetPath.startsWith(UPLOADS_DIR + path.sep)) {
    return;
  }
  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath);
  }
}

// Safe uploaded image static serving with strict confinement
app.get('/uploads/:filename', (req, res) => {
  const filename = req.params.filename;
  if (!filename || !/^[a-zA-Z0-9._-]+$/.test(filename)) {
    res.status(400).send('Nome de arquivo inválido.');
    return;
  }
  const targetPath = path.resolve(UPLOADS_DIR, filename);
  if (!targetPath.startsWith(UPLOADS_DIR + path.sep) || !fs.existsSync(targetPath)) {
    res.status(404).send('Imagem não encontrada.');
    return;
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(targetPath);
});

interface EntryRow {
  id: number;
  category: Category;
  student_name: string;
  student_class: string;
  title: string;
  image_url: string;
  created_at: string;
}

function mapEntryRow(row: EntryRow): EntryRecord {
  return {
    id: row.id,
    category: row.category,
    studentName: row.student_name,
    studentClass: row.student_class,
    title: row.title,
    imageUrl: row.image_url,
    createdAt: row.created_at,
  };
}

function getAllEntries(): EntryRecord[] {
  const rows = db
    .prepare(
      'SELECT id, category, student_name, student_class, title, image_url, created_at FROM entries ORDER BY id ASC',
    )
    .all() as unknown as EntryRow[];
  return rows.map(mapEntryRow);
}

function getVoteCountsByEntryId(): Record<number, number> {
  const rows = db
    .prepare('SELECT entry_id, COUNT(*) AS count FROM votes GROUP BY entry_id')
    .all() as unknown as Array<{ entry_id: number; count: number }>;
  const map: Record<number, number> = {};
  for (const row of rows) {
    map[row.entry_id] = row.count;
  }
  return map;
}

function getAllVotesForStats(): VoteRecordForStats[] {
  const rows = db
    .prepare('SELECT entry_id, category, voter_token_hash FROM votes')
    .all() as unknown as Array<{ entry_id: number; category: Category; voter_token_hash: string }>;
  return rows.map((r) => ({
    entryId: r.entry_id,
    category: r.category,
    voterKey: r.voter_token_hash,
  }));
}

function getClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return normalizeClientIp(xff);
  }
  return normalizeClientIp(req.ip);
}

function isHttpsRequest(req: Request): boolean {
  return req.secure || req.headers['x-forwarded-proto'] === 'https';
}

function setVoterCookie(res: Response, req: Request, signedToken: string): void {
  const https = isHttpsRequest(req);
  const parts = [
    `${VOTER_COOKIE_NAME}=${encodeURIComponent(signedToken)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${60 * 60 * 24 * 30}`,
  ];
  if (https) {
    parts.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

function ensureVoterIdentity(req: Request, res: Response): { voterId: string; voterTokenHash: string; ipHash: string } {
  const rawCookie = req.cookies?.[VOTER_COOKIE_NAME] as string | undefined;
  let voterId = verifySignedVoterToken(rawCookie, SESSION_SECRET);
  if (!voterId) {
    voterId = crypto.randomUUID();
    const signed = createSignedVoterToken(voterId, SESSION_SECRET);
    setVoterCookie(res, req, signed);
  }
  const clientIp = getClientIp(req);
  return {
    voterId,
    voterTokenHash: hashValue(`voter:${voterId}`, SESSION_SECRET),
    ipHash: hashValue(`ip:${clientIp}`, SESSION_SECRET),
  };
}

function verifySameOriginOrHeader(req: Request): boolean {
  if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
    return true;
  }
  const origin = req.headers.origin;
  const host = (req.headers['x-forwarded-host'] as string | undefined) || req.headers.host;
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      return originHost === host;
    } catch {
      return false;
    }
  }
  return false;
}

function getVoterStatus(voterTokenHash: string, ipHash: string, allowSharedWifi: boolean): {
  votedEntries: { desenho: number | null; poema: number | null };
  ipBlockedCategories: { desenho: boolean; poema: boolean };
} {
  const tokenRows = db
    .prepare('SELECT category, entry_id FROM votes WHERE voter_token_hash = ?')
    .all(voterTokenHash) as unknown as Array<{ category: Category; entry_id: number }>;

  const votedEntries: { desenho: number | null; poema: number | null } = {
    desenho: null,
    poema: null,
  };
  for (const row of tokenRows) {
    votedEntries[row.category] = row.entry_id;
  }

  const ipBlockedCategories = { desenho: false, poema: false };
  if (!allowSharedWifi) {
    const ipRows = db
      .prepare('SELECT DISTINCT category FROM votes WHERE ip_hash = ?')
      .all(ipHash) as unknown as Array<{ category: Category }>;
    for (const row of ipRows) {
      ipBlockedCategories[row.category] = true;
    }
  }

  return { votedEntries, ipBlockedCategories };
}

function buildPublicBaseUrl(req: Request): string {
  const envUrl = process.env.APP_URL?.trim();
  if (envUrl && envUrl !== 'MY_APP_URL' && /^https?:\/\//i.test(envUrl)) {
    return envUrl.replace(/\/+$/, '');
  }
  const proto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim() || req.protocol || 'http';
  const host = (req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0]?.trim() || req.headers.host || `localhost:${PORT}`;
  return `${proto}://${host}`;
}

// ==========================================
// PUBLIC VOTING ROUTES
// ==========================================

app.get('/api/public/entries', (req, res) => {
  const { voterTokenHash, ipHash } = ensureVoterIdentity(req, res);
  const showPublicResults = getSetting('show_public_results', '0') === '1';
  const allowSharedWifi = getSetting('allow_shared_school_wifi', '0') === '1';
  const votingActive = getSetting('voting_active', '1') === '1';

  const entries = getAllEntries();
  const voteCounts = showPublicResults ? getVoteCountsByEntryId() : {};
  const { votedEntries, ipBlockedCategories } = getVoterStatus(voterTokenHash, ipHash, allowSharedWifi);

  res.json({
    entries: entries.map((e) => ({
      ...e,
      ...(showPublicResults ? { votes: voteCounts[e.id] ?? 0 } : {}),
    })),
    votedEntries,
    ipBlockedCategories,
    showPublicResults,
    votingActive,
  });
});

app.get('/api/public/results', (_req, res) => {
  const showPublicResults = getSetting('show_public_results', '0') === '1';
  if (!showPublicResults) {
    res.json({ hidden: true });
    return;
  }
  const entries = getAllEntries();
  const voteCounts = getVoteCountsByEntryId();
  res.json({
    hidden: false,
    desenho: computeCategoryRankings(entries, voteCounts, 'desenho'),
    poema: computeCategoryRankings(entries, voteCounts, 'poema'),
  });
});

app.post('/api/public/vote', (req, res) => {
  if (!verifySameOriginOrHeader(req)) {
    res.status(403).json({ error: 'Solicitação de origem não autorizada.' });
    return;
  }

  const votingActive = getSetting('voting_active', '1') === '1';
  if (!votingActive) {
    res.status(403).json({ error: 'A votação está encerrada ou pausada no momento.' });
    return;
  }

  const rawEntryId = req.body?.entryId;
  const entryId = typeof rawEntryId === 'number' ? rawEntryId : Number(rawEntryId);
  if (!Number.isInteger(entryId) || entryId <= 0) {
    res.status(400).json({ error: 'Participante inválido.' });
    return;
  }

  const entryRow = db
    .prepare('SELECT id, category FROM entries WHERE id = ?')
    .get(entryId) as { id: number; category: Category } | undefined;

  if (!entryRow) {
    res.status(404).json({ error: 'Participante não encontrado.' });
    return;
  }

  const { voterTokenHash, ipHash } = ensureVoterIdentity(req, res);
  const allowSharedWifi = getSetting('allow_shared_school_wifi', '0') === '1';
  const uaHash = hashValue(`ua:${req.headers['user-agent'] ?? ''}`, SESSION_SECRET);
  const now = new Date().toISOString();

  try {
    db.exec('BEGIN IMMEDIATE');

    const tokenExisting = db
      .prepare('SELECT id FROM votes WHERE category = ? AND voter_token_hash = ? LIMIT 1')
      .get(entryRow.category, voterTokenHash) as { id: number } | undefined;

    const ipExisting = db
      .prepare('SELECT id FROM votes WHERE category = ? AND ip_hash = ? LIMIT 1')
      .get(entryRow.category, ipHash) as { id: number } | undefined;

    const eligibility = evaluateVoteEligibility({
      category: entryRow.category,
      tokenAlreadyVotedInCategory: Boolean(tokenExisting),
      ipAlreadyVotedInCategory: Boolean(ipExisting),
      allowSharedSchoolWifi: allowSharedWifi,
    });

    if (!eligibility.allowed) {
      db.exec('ROLLBACK');
      res.status(409).json({ error: eligibility.reason });
      return;
    }

    db.prepare(
      'INSERT INTO votes (entry_id, category, voter_token_hash, ip_hash, user_agent_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(entryRow.id, entryRow.category, voterTokenHash, ipHash, uaHash, now);

    db.exec('COMMIT');
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore rollback if already rolled back
    }
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('UNIQUE constraint failed')) {
      res.status(409).json({ error: 'Seu voto nesta categoria já foi registrado.' });
      return;
    }
    res.status(500).json({ error: 'Erro interno ao registrar o voto.' });
    return;
  }

  const { votedEntries, ipBlockedCategories } = getVoterStatus(voterTokenHash, ipHash, allowSharedWifi);
  const bothCompleted = Boolean(votedEntries.desenho && votedEntries.poema);

  res.status(201).json({
    ok: true,
    votedEntries,
    ipBlockedCategories,
    bothCompleted,
  });
});

// ==========================================
// ADMIN AUTH & MANAGEMENT ROUTES
// ==========================================

function getAdminAuthConfigState(): { envConfigured: boolean; hasDbAdmin: boolean } {
  const envPass = process.env.ADMIN_PASSWORD?.trim();
  const countRow = db.prepare('SELECT COUNT(*) AS count FROM admin_users').get() as { count: number };
  return {
    envConfigured: Boolean(envPass && envPass.length > 0),
    hasDbAdmin: countRow.count > 0,
  };
}

function extractBearerToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim();
}

interface AdminRequest extends Request {
  adminUser?: string;
}

function requireAdmin(req: AdminRequest, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  const verified = verifyAdminSessionToken(token, SESSION_SECRET);
  if (!verified) {
    res.status(401).json({ error: 'Sessão administrativa expirada ou não autorizada.' });
    return;
  }
  req.adminUser = verified.username;
  next();
}

app.get('/api/admin/session', (req, res) => {
  const { envConfigured, hasDbAdmin } = getAdminAuthConfigState();
  const needsSetup = !envConfigured && !hasDbAdmin;
  const token = extractBearerToken(req);
  const verified = verifyAdminSessionToken(token, SESSION_SECRET);
  res.json({
    authenticated: Boolean(verified),
    username: verified?.username ?? null,
    needsSetup,
    envConfigured,
  });
});

app.post('/api/admin/bootstrap', (req, res) => {
  const { envConfigured, hasDbAdmin } = getAdminAuthConfigState();
  if (envConfigured || hasDbAdmin) {
    res.status(403).json({ error: 'O acesso administrativo já foi configurado.' });
    return;
  }

  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (username.length < 3 || username.length > 40) {
    res.status(400).json({ error: 'O usuário deve ter entre 3 e 40 caracteres.' });
    return;
  }
  if (password.length < 6 || password.length > 100) {
    res.status(400).json({ error: 'A senha deve ter entre 6 e 100 caracteres.' });
    return;
  }

  const passwordHash = hashPassword(password);
  const now = new Date().toISOString();

  try {
    db.exec('BEGIN IMMEDIATE');
    const existing = db.prepare('SELECT COUNT(*) AS count FROM admin_users').get() as { count: number };
    if (existing.count > 0) {
      db.exec('ROLLBACK');
      res.status(403).json({ error: 'O acesso administrativo já foi configurado.' });
      return;
    }
    db.prepare('INSERT INTO admin_users (username, password_hash, created_at) VALUES (?, ?, ?)').run(
      username,
      passwordHash,
      now,
    );
    db.exec('COMMIT');
  } catch {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore
    }
    res.status(500).json({ error: 'Não foi possível concluir a configuração inicial.' });
    return;
  }

  const token = createAdminSessionToken(username, SESSION_SECRET);
  res.status(201).json({ token, username });
});

app.post('/api/admin/login', (req, res) => {
  const ip = getClientIp(req);
  if (!checkLoginRateLimit(ip)) {
    res.status(429).json({ error: 'Muitas tentativas de login. Aguarde alguns minutos.' });
    return;
  }

  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!username || !password) {
    res.status(400).json({ error: 'Informe usuário e senha.' });
    return;
  }

  const envPass = process.env.ADMIN_PASSWORD?.trim();
  if (envPass && envPass.length > 0) {
    const envUser = process.env.ADMIN_USERNAME?.trim() || 'admin';
    if (timingSafeStringMatch(username, envUser) && timingSafeStringMatch(password, envPass)) {
      const token = createAdminSessionToken(envUser, SESSION_SECRET);
      res.json({ token, username: envUser });
      return;
    }
    res.status(401).json({ error: 'Usuário ou senha inválidos.' });
    return;
  }

  const adminRow = db
    .prepare('SELECT username, password_hash FROM admin_users WHERE username = ? LIMIT 1')
    .get(username) as { username: string; password_hash: string } | undefined;

  if (!adminRow || !verifyPassword(password, adminRow.password_hash)) {
    res.status(401).json({ error: 'Usuário ou senha inválidos.' });
    return;
  }

  const token = createAdminSessionToken(adminRow.username, SESSION_SECRET);
  res.json({ token, username: adminRow.username });
});

app.get('/api/admin/overview', requireAdmin, async (req: AdminRequest, res) => {
  const entries = getAllEntries();
  const voteCounts = getVoteCountsByEntryId();
  const allVotes = getAllVotesForStats();

  const metrics = computeDashboardMetrics(entries, allVotes);
  const desenhosResult = computeCategoryRankings(entries, voteCounts, 'desenho');
  const poemasResult = computeCategoryRankings(entries, voteCounts, 'poema');

  const showPublicResults = getSetting('show_public_results', '0') === '1';
  const allowSharedSchoolWifi = getSetting('allow_shared_school_wifi', '0') === '1';
  const votingActive = getSetting('voting_active', '1') === '1';
  const qrToken = getSetting('qr_token', '');
  const qrGeneratedAt = getSetting('qr_generated_at', '');

  let publicUrl = '';
  let qrDataUrl = '';
  if (qrToken) {
    publicUrl = `${buildPublicBaseUrl(req)}/?qr=${encodeURIComponent(qrToken)}`;
    qrDataUrl = await QRCode.toDataURL(publicUrl, {
      width: 512,
      margin: 2,
      color: { dark: '#3b0764', light: '#ffffff' },
    });
  }

  res.json({
    adminUsername: req.adminUser,
    metrics,
    entries: entries.map((e) => ({
      ...e,
      votes: voteCounts[e.id] ?? 0,
    })),
    results: {
      desenho: desenhosResult,
      poema: poemasResult,
    },
    settings: {
      showPublicResults,
      allowSharedSchoolWifi,
      votingActive,
    },
    qr: {
      generated: Boolean(qrToken),
      publicUrl,
      qrDataUrl,
      generatedAt: qrGeneratedAt,
    },
  });
});

app.post('/api/admin/entries', requireAdmin, upload.single('image'), (req: AdminRequest, res) => {
  const validation = validateEntryInput({
    category: req.body?.category,
    studentName: req.body?.studentName,
    studentClass: req.body?.studentClass,
    title: req.body?.title,
  });

  if (!validation.valid || !validation.normalized) {
    res.status(400).json({ error: validation.error });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: 'Envie uma foto da obra antes de salvar.' });
    return;
  }

  let imageUrl = '';
  try {
    imageUrl = saveUploadedImage(req.file);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Imagem inválida.' });
    return;
  }

  const now = new Date().toISOString();
  const { category, studentName, studentClass, title } = validation.normalized;
  const result = db
    .prepare(
      'INSERT INTO entries (category, student_name, student_class, title, image_url, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(category, studentName, studentClass, title, imageUrl, now);

  res.status(201).json({
    id: Number(result.lastInsertRowid),
    category,
    studentName,
    studentClass,
    title,
    imageUrl,
    createdAt: now,
  });
});

app.put('/api/admin/entries/:id', requireAdmin, upload.single('image'), (req: AdminRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'ID de participante inválido.' });
    return;
  }

  const existing = db
    .prepare('SELECT id, category, student_name, student_class, title, image_url, created_at FROM entries WHERE id = ?')
    .get(id) as EntryRow | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Participante não encontrado.' });
    return;
  }

  const validation = validateEntryInput({
    category: req.body?.category ?? existing.category,
    studentName: req.body?.studentName,
    studentClass: req.body?.studentClass,
    title: req.body?.title,
  });

  if (!validation.valid || !validation.normalized) {
    res.status(400).json({ error: validation.error });
    return;
  }

  let imageUrl = existing.image_url;
  if (req.file) {
    try {
      const nextUrl = saveUploadedImage(req.file);
      safeDeleteUploadedFile(existing.image_url);
      imageUrl = nextUrl;
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Imagem inválida.' });
      return;
    }
  } else if (!isSafeImageUrl(imageUrl)) {
    res.status(400).json({ error: 'URL de imagem inválida.' });
    return;
  }

  const { category, studentName, studentClass, title } = validation.normalized;
  db.prepare(
    'UPDATE entries SET category = ?, student_name = ?, student_class = ?, title = ?, image_url = ? WHERE id = ?',
  ).run(category, studentName, studentClass, title, imageUrl, id);

  res.json({
    id,
    category,
    studentName,
    studentClass,
    title,
    imageUrl,
    createdAt: existing.created_at,
  });
});

app.delete('/api/admin/entries/:id', requireAdmin, (req: AdminRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'ID inválido.' });
    return;
  }

  const existing = db
    .prepare('SELECT id, image_url FROM entries WHERE id = ?')
    .get(id) as { id: number; image_url: string } | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Participante não encontrado.' });
    return;
  }

  db.prepare('DELETE FROM entries WHERE id = ?').run(id);
  safeDeleteUploadedFile(existing.image_url);
  res.json({ ok: true });
});

app.post('/api/admin/qr', requireAdmin, async (req: AdminRequest, res) => {
  let qrToken = getSetting('qr_token', '');
  if (!qrToken || req.body?.regenerate === true) {
    qrToken = crypto.randomBytes(8).toString('hex');
    setSetting('qr_token', qrToken);
  }
  const now = new Date().toISOString();
  setSetting('qr_generated_at', now);

  const publicUrl = `${buildPublicBaseUrl(req)}/?qr=${encodeURIComponent(qrToken)}`;
  const qrDataUrl = await QRCode.toDataURL(publicUrl, {
    width: 512,
    margin: 2,
    color: { dark: '#3b0764', light: '#ffffff' },
  });

  res.json({
    generated: true,
    publicUrl,
    qrDataUrl,
    generatedAt: now,
  });
});

app.patch('/api/admin/settings', requireAdmin, (req: AdminRequest, res) => {
  if (typeof req.body?.showPublicResults === 'boolean') {
    setSetting('show_public_results', req.body.showPublicResults ? '1' : '0');
  }
  if (typeof req.body?.allowSharedSchoolWifi === 'boolean') {
    setSetting('allow_shared_school_wifi', req.body.allowSharedSchoolWifi ? '1' : '0');
  }
  if (typeof req.body?.votingActive === 'boolean') {
    setSetting('voting_active', req.body.votingActive ? '1' : '0');
  }

  res.json({
    showPublicResults: getSetting('show_public_results', '0') === '1',
    allowSharedSchoolWifi: getSetting('allow_shared_school_wifi', '0') === '1',
    votingActive: getSetting('voting_active', '1') === '1',
  });
});

// Error handler for multer & upload errors
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'A imagem excede o tamanho máximo de 8 MB.' });
      return;
    }
    res.status(400).json({ error: 'Erro ao processar envio da imagem.' });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Votação Escolar server listening on http://localhost:${PORT}`);
  });
}

startServer();
