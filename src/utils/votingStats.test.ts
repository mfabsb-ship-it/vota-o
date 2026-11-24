import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCategoryRankings,
  computeDashboardMetrics,
  isSafeImageUrl,
  validateEntryInput,
  type EntryRecord,
} from './votingStats.ts';

const sampleEntries: EntryRecord[] = [
  {
    id: 1,
    category: 'desenho',
    studentName: 'Ana Clara',
    studentClass: '9º Ano A',
    title: 'Árvore Cósmica',
    imageUrl: '/src/assets/images/desenho_arvore_cosmica_1795527998000.jpg',
    createdAt: '2026-11-24T10:00:00Z',
  },
  {
    id: 2,
    category: 'desenho',
    studentName: 'Bruno Dias',
    studentClass: '8º Ano B',
    title: 'Tartaruga Coral',
    imageUrl: '/src/assets/images/desenho_tartaruga_coral_1795527991234.jpg',
    createdAt: '2026-11-24T10:05:00Z',
  },
  {
    id: 3,
    category: 'poema',
    studentName: 'Maria Silva',
    studentClass: '1º Ano EM',
    title: 'Estrelas do Amanhã',
    imageUrl: '/src/assets/images/poema_estrelas_amanha_1795527992377.jpg',
    createdAt: '2026-11-24T10:10:00Z',
  },
];

test('validateEntryInput accepts valid student entry and trims whitespace', () => {
  const res = validateEntryInput({
    category: 'desenho',
    studentName: '  Lucas Mendes  ',
    studentClass: '  7º Ano C  ',
    title: '  Horizonte Azul  ',
  });
  assert.equal(res.valid, true);
  assert.deepEqual(res.normalized, {
    category: 'desenho',
    studentName: 'Lucas Mendes',
    studentClass: '7º Ano C',
    title: 'Horizonte Azul',
  });
});

test('validateEntryInput rejects invalid category or empty fields', () => {
  assert.equal(
    validateEntryInput({ category: 'musica', studentName: 'Ana', studentClass: '9A' }).valid,
    false,
  );
  assert.equal(
    validateEntryInput({ category: 'poema', studentName: 'A', studentClass: '9A' }).valid,
    false,
  );
  assert.equal(
    validateEntryInput({ category: 'poema', studentName: 'Ana Paula', studentClass: '   ' }).valid,
    false,
  );
});

test('computeCategoryRankings sorts descending and computes accurate percentages', () => {
  const result = computeCategoryRankings(sampleEntries, { 1: 3, 2: 7, 3: 5 }, 'desenho');
  assert.equal(result.totalVotes, 10);
  assert.equal(result.rankings.length, 2);
  assert.equal(result.rankings[0].id, 2);
  assert.equal(result.rankings[0].rank, 1);
  assert.equal(result.rankings[0].percentage, 70);
  assert.equal(result.rankings[1].id, 1);
  assert.equal(result.rankings[1].rank, 2);
  assert.equal(result.rankings[1].percentage, 30);
});

test('computeDashboardMetrics counts distinct voters across categories', () => {
  const metrics = computeDashboardMetrics(sampleEntries, [
    { entryId: 1, category: 'desenho', voterKey: 'v1' },
    { entryId: 3, category: 'poema', voterKey: 'v1' },
    { entryId: 2, category: 'desenho', voterKey: 'v2' },
  ]);
  assert.deepEqual(metrics, {
    totalDesenhos: 2,
    totalPoemas: 1,
    totalVotosDesenhos: 2,
    totalVotosPoemas: 1,
    totalParticipantes: 3,
    totalPessoasQueVotaram: 2,
  });
});

test('isSafeImageUrl allows only internal asset/upload paths without traversal', () => {
  assert.equal(isSafeImageUrl('/uploads/abc.png'), true);
  assert.equal(isSafeImageUrl('/src/assets/images/test.jpg'), true);
  assert.equal(isSafeImageUrl('/uploads/../etc/passwd'), false);
  assert.equal(isSafeImageUrl('javascript:alert(1)'), false);
  assert.equal(isSafeImageUrl('https://evil.example/img.png'), false);
});
