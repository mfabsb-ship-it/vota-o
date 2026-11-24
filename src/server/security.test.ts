import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAdminSessionToken,
  createSignedVoterToken,
  evaluateVoteEligibility,
  hashPassword,
  normalizeClientIp,
  verifyAdminSessionToken,
  verifyPassword,
  verifySignedVoterToken,
} from './security.ts';

const SECRET = 'unit-test-secret-key-at-least-32-bytes';

test('signed voter token verifies cleanly and rejects tampering', () => {
  const token = createSignedVoterToken('voter-1234-5678-90ab', SECRET);
  assert.equal(verifySignedVoterToken(token, SECRET), 'voter-1234-5678-90ab');
  assert.equal(verifySignedVoterToken(`${token}tampered`, SECRET), null);
  assert.equal(verifySignedVoterToken(token, 'wrong-secret'), null);
});

test('password hashing and verification work with scrypt', () => {
  const hashed = hashPassword('Escola@2026');
  assert.equal(verifyPassword('Escola@2026', hashed), true);
  assert.equal(verifyPassword('errada', hashed), false);
});

test('admin session token verifies valid token and rejects expired or tampered', () => {
  const token = createAdminSessionToken('coordenador', SECRET, 60_000);
  const verified = verifyAdminSessionToken(token, SECRET);
  assert.deepEqual(verified, { username: 'coordenador' });

  const expired = createAdminSessionToken('coordenador', SECRET, -1000);
  assert.equal(verifyAdminSessionToken(expired, SECRET), null);
  assert.equal(verifyAdminSessionToken(`${token}x`, SECRET), null);
});

test('normalizeClientIp extracts first forwarded IP and strips IPv6 prefix', () => {
  assert.equal(normalizeClientIp('::ffff:192.168.1.50'), '192.168.1.50');
  assert.equal(normalizeClientIp('203.0.113.10, 10.0.0.1'), '203.0.113.10');
  assert.equal(normalizeClientIp('::1'), '127.0.0.1');
});

test('evaluateVoteEligibility blocks duplicate token and strict IP votes independently per category', () => {
  assert.equal(
    evaluateVoteEligibility({
      category: 'desenho',
      tokenAlreadyVotedInCategory: true,
      ipAlreadyVotedInCategory: false,
      allowSharedSchoolWifi: true,
    }).allowed,
    false,
  );

  assert.equal(
    evaluateVoteEligibility({
      category: 'poema',
      tokenAlreadyVotedInCategory: false,
      ipAlreadyVotedInCategory: true,
      allowSharedSchoolWifi: false,
    }).allowed,
    false,
  );

  assert.equal(
    evaluateVoteEligibility({
      category: 'poema',
      tokenAlreadyVotedInCategory: false,
      ipAlreadyVotedInCategory: true,
      allowSharedSchoolWifi: true,
    }).allowed,
    true,
  );
});
