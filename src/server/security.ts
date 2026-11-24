import crypto from 'node:crypto';
import type { Category } from '../utils/votingStats.ts';

export function normalizeClientIp(rawIp: string | undefined | null): string {
  if (!rawIp) return '0.0.0.0';
  const first = rawIp.split(',')[0]?.trim() ?? '';
  if (!first) return '0.0.0.0';
  if (first.startsWith('::ffff:')) {
    return first.slice(7);
  }
  if (first === '::1') {
    return '127.0.0.1';
  }
  return first;
}

export function hashValue(value: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

export function createSignedVoterToken(voterId: string, secret: string): string {
  const sig = crypto.createHmac('sha256', secret).update(`voter:${voterId}`).digest('hex');
  return `${voterId}.${sig}`;
}

export function verifySignedVoterToken(token: string | undefined | null, secret: string): string | null {
  if (!token || typeof token !== 'string') return null;
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return null;
  const voterId = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  if (!/^[a-z0-9-]{16,64}$/i.test(voterId) || !/^[a-f0-9]{64}$/i.test(sig)) {
    return null;
  }
  const expectedSig = crypto.createHmac('sha256', secret).update(`voter:${voterId}`).digest('hex');
  const sigBuf = Buffer.from(sig, 'hex');
  const expectedBuf = Buffer.from(expectedSig, 'hex');
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  return voterId;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  const expectedBuf = Buffer.from(keyHex, 'hex');
  const actualBuf = crypto.scryptSync(password, salt, 64);
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

export function timingSafeStringMatch(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export function createAdminSessionToken(username: string, secret: string, ttlMs = 1000 * 60 * 60 * 12): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: username,
      exp: Date.now() + ttlMs,
      nonce: crypto.randomBytes(12).toString('hex'),
    }),
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(`admin:${payload}`).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyAdminSessionToken(token: string | undefined | null, secret: string): { username: string } | null {
  if (!token || typeof token !== 'string') return null;
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return null;
  const payloadB64 = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  const expectedSig = crypto.createHmac('sha256', secret).update(`admin:${payloadB64}`).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
      sub?: string;
      exp?: number;
    };
    if (!parsed.sub || typeof parsed.exp !== 'number' || parsed.exp < Date.now()) {
      return null;
    }
    return { username: parsed.sub };
  } catch {
    return null;
  }
}

export function evaluateVoteEligibility(params: {
  category: Category;
  tokenAlreadyVotedInCategory: boolean;
  ipAlreadyVotedInCategory: boolean;
  allowSharedSchoolWifi: boolean;
}): { allowed: boolean; reason?: string } {
  if (params.tokenAlreadyVotedInCategory) {
    return {
      allowed: false,
      reason:
        params.category === 'desenho'
          ? 'Você já registrou seu voto na categoria Desenhos.'
          : 'Você já registrou seu voto na categoria Poemas.',
    };
  }
  if (!params.allowSharedSchoolWifi && params.ipAlreadyVotedInCategory) {
    return {
      allowed: false,
      reason:
        params.category === 'desenho'
          ? 'Já existe um voto registrado a partir desta rede/IP na categoria Desenhos.'
          : 'Já existe um voto registrado a partir desta rede/IP na categoria Poemas.',
    };
  }
  return { allowed: true };
}
