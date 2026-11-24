export type Category = 'desenho' | 'poema';

export interface EntryRecord {
  id: number;
  category: Category;
  studentName: string;
  studentClass: string;
  title: string;
  imageUrl: string;
  createdAt: string;
}

export interface PublicEntry extends EntryRecord {
  votes?: number;
}

export interface RankedEntry extends EntryRecord {
  votes: number;
  percentage: number;
  rank: number;
}

export interface CategoryResults {
  category: Category;
  totalVotes: number;
  rankings: RankedEntry[];
}

export interface DashboardMetrics {
  totalDesenhos: number;
  totalPoemas: number;
  totalVotosDesenhos: number;
  totalVotosPoemas: number;
  totalParticipantes: number;
  totalPessoasQueVotaram: number;
}

export interface VoteRecordForStats {
  entryId: number;
  category: Category;
  voterKey: string;
}

export function validateEntryInput(input: {
  category: unknown;
  studentName: unknown;
  studentClass: unknown;
  title?: unknown;
}): {
  valid: boolean;
  error?: string;
  normalized?: {
    category: Category;
    studentName: string;
    studentClass: string;
    title: string;
  };
} {
  if (input.category !== 'desenho' && input.category !== 'poema') {
    return { valid: false, error: 'Categoria inválida. Escolha Desenho ou Poema.' };
  }

  const studentName = typeof input.studentName === 'string' ? input.studentName.trim() : '';
  const studentClass = typeof input.studentClass === 'string' ? input.studentClass.trim() : '';
  const title = typeof input.title === 'string' ? input.title.trim() : '';

  if (studentName.length < 2 || studentName.length > 100) {
    return { valid: false, error: 'Informe o nome completo do aluno (entre 2 e 100 caracteres).' };
  }

  if (studentClass.length < 1 || studentClass.length > 50) {
    return { valid: false, error: 'Informe a turma do aluno (ex.: 8º Ano B).' };
  }

  if (title.length > 120) {
    return { valid: false, error: 'O título da obra deve ter no máximo 120 caracteres.' };
  }

  return {
    valid: true,
    normalized: {
      category: input.category,
      studentName,
      studentClass,
      title,
    },
  };
}

export function computeCategoryRankings(
  entries: EntryRecord[],
  voteCountsByEntryId: Record<number, number>,
  category: Category,
): CategoryResults {
  const categoryEntries = entries.filter((entry) => entry.category === category);
  const totalVotes = categoryEntries.reduce(
    (sum, entry) => sum + (voteCountsByEntryId[entry.id] ?? 0),
    0,
  );

  const sorted = [...categoryEntries].sort((a, b) => {
    const votesA = voteCountsByEntryId[a.id] ?? 0;
    const votesB = voteCountsByEntryId[b.id] ?? 0;
    if (votesB !== votesA) {
      return votesB - votesA;
    }
    return a.studentName.localeCompare(b.studentName, 'pt-BR');
  });

  const rankings: RankedEntry[] = sorted.map((entry, idx) => {
    const votes = voteCountsByEntryId[entry.id] ?? 0;
    const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 1000) / 10 : 0;
    return {
      ...entry,
      votes,
      percentage,
      rank: idx + 1,
    };
  });

  return {
    category,
    totalVotes,
    rankings,
  };
}

export function computeDashboardMetrics(
  entries: EntryRecord[],
  votes: VoteRecordForStats[],
): DashboardMetrics {
  const totalDesenhos = entries.filter((e) => e.category === 'desenho').length;
  const totalPoemas = entries.filter((e) => e.category === 'poema').length;

  let totalVotosDesenhos = 0;
  let totalVotosPoemas = 0;
  const distinctVoters = new Set<string>();

  for (const vote of votes) {
    if (vote.category === 'desenho') {
      totalVotosDesenhos += 1;
    } else if (vote.category === 'poema') {
      totalVotosPoemas += 1;
    }
    if (vote.voterKey) {
      distinctVoters.add(vote.voterKey);
    }
  }

  return {
    totalDesenhos,
    totalPoemas,
    totalVotosDesenhos,
    totalVotosPoemas,
    totalParticipantes: entries.length,
    totalPessoasQueVotaram: distinctVoters.size,
  };
}

export function isSafeImageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('/src/assets/')) {
    return !trimmed.includes('..');
  }
  return false;
}
