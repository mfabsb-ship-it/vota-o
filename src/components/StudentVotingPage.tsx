import { useCallback, useEffect, useState } from 'react';
import {
  Award,
  BarChart3,
  Check,
  CheckCircle2,
  Lock,
  Maximize2,
  Palette,
  PenLine,
  Sparkles,
} from 'lucide-react';
import { motion } from 'motion/react';
import type { Category, CategoryResults, PublicEntry } from '../utils/votingStats';
import { ArtworkLightbox } from './ArtworkLightbox';
import { ImageWithFallback } from './ImageWithFallback';

interface StudentVotingPageProps {
  onNavigateAdmin: () => void;
}

interface PublicApiResponse {
  entries: PublicEntry[];
  votedEntries: { desenho: number | null; poema: number | null };
  ipBlockedCategories: { desenho: boolean; poema: boolean };
  showPublicResults: boolean;
  votingActive: boolean;
}

interface PublicResultsResponse {
  hidden: boolean;
  desenho?: CategoryResults;
  poema?: CategoryResults;
}

export function StudentVotingPage({ onNavigateAdmin }: StudentVotingPageProps) {
  const [activeTab, setActiveTab] = useState<Category | 'resultados'>('desenho');
  const [entries, setEntries] = useState<PublicEntry[]>([]);
  const [votedEntries, setVotedEntries] = useState<{ desenho: number | null; poema: number | null }>({
    desenho: null,
    poema: null,
  });
  const [ipBlockedCategories, setIpBlockedCategories] = useState<{ desenho: boolean; poema: boolean }>({
    desenho: false,
    poema: false,
  });
  const [showPublicResults, setShowPublicResults] = useState(false);
  const [votingActive, setVotingActive] = useState(true);
  const [publicResults, setPublicResults] = useState<PublicResultsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [votingId, setVotingId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lightboxEntry, setLightboxEntry] = useState<PublicEntry | null>(null);

  const loadEntries = useCallback(async () => {
    try {
      const res = await fetch('/api/public/entries', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Não foi possível carregar os participantes.');
      const data = (await res.json()) as PublicApiResponse;
      setEntries(data.entries);
      setVotedEntries(data.votedEntries);
      setIpBlockedCategories(data.ipBlockedCategories);
      setShowPublicResults(data.showPublicResults);
      setVotingActive(data.votingActive);

      if (data.showPublicResults) {
        const resResults = await fetch('/api/public/results', { cache: 'no-store' });
        if (resResults.ok) {
          setPublicResults((await resResults.json()) as PublicResultsResponse);
        }
      } else {
        setPublicResults(null);
        setActiveTab((prev) => (prev === 'resultados' ? 'desenho' : prev));
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao carregar a votação.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  async function handleVote(entry: PublicEntry) {
    setErrorMsg(null);
    setVotingId(entry.id);
    try {
      const res = await fetch('/api/public/vote', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ entryId: entry.id }),
      });

      const payload = (await res.json()) as {
        error?: string;
        votedEntries?: { desenho: number | null; poema: number | null };
        ipBlockedCategories?: { desenho: boolean; poema: boolean };
      };

      if (!res.ok) {
        setErrorMsg(payload.error || 'Não foi possível registrar seu voto.');
        await loadEntries();
        return;
      }

      if (payload.votedEntries) {
        setVotedEntries(payload.votedEntries);
      }
      if (payload.ipBlockedCategories) {
        setIpBlockedCategories(payload.ipBlockedCategories);
      }
      await loadEntries();
    } catch {
      setErrorMsg('Falha de conexão ao enviar seu voto. Tente novamente.');
    } finally {
      setVotingId(null);
    }
  }

  const drawings = entries.filter((e) => e.category === 'desenho');
  const poems = entries.filter((e) => e.category === 'poema');
  const visibleEntries = activeTab === 'desenho' ? drawings : activeTab === 'poema' ? poems : [];

  const votedDrawing = votedEntries.desenho !== null;
  const votedPoem = votedEntries.poema !== null;
  const bothVotesCompleted = votedDrawing && votedPoem;
  const completedCount = (votedDrawing ? 1 : 0) + (votedPoem ? 1 : 0);

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7FF]">
      {/* Hero Header */}
      <header className="relative overflow-hidden bg-gradient-to-br from-violet-800 via-purple-700 to-blue-600 text-white">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,_#ffffff_0%,_transparent_55%)]"
        />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-xs font-medium text-blue-100 tracking-wide mb-2">
                <Award className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Competição Cultural Estudantil · Desenhos &amp; Poemas</span>
              </div>
              <h1 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
                VOTAÇÃO ESCOLAR
              </h1>
              <p className="mt-2 text-base sm:text-lg text-violet-100 font-medium">
                Escolha seus favoritos!
              </p>
            </div>

            <div className="bg-white/12 backdrop-blur-md border border-white/20 rounded-2xl px-5 py-4 text-sm shrink-0">
              <div className="text-xs text-blue-100 mb-1">Progresso da sua votação</div>
              <div className="flex items-center gap-4 tabular-nums font-semibold text-white">
                <span>
                  {completedCount}/2 categorias votadas
                </span>
                <span aria-hidden="true" className="text-white/40">·</span>
                <span className="text-blue-100 font-normal">
                  Desenhos: {votedDrawing ? 'Registrado' : 'Disponível'} · Poemas:{' '}
                  {votedPoem ? 'Registrado' : 'Disponível'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Completion Confirmation Banner */}
        {bothVotesCompleted && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            role="status"
            data-testid="both-votes-success"
            className="mb-6 rounded-2xl bg-gradient-to-r from-violet-600 to-blue-600 p-[1px] shadow-md"
          >
            <div className="bg-white rounded-[15px] px-5 py-4 flex items-start sm:items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 text-white flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <p className="font-display font-bold text-slate-900 text-base sm:text-lg">
                  Obrigado por participar! Seus votos foram registrados com sucesso.
                </p>
                <p className="text-sm text-slate-600 mt-0.5">
                  Você já votou em 1 desenho e em 1 poema. Os votos foram salvos com segurança.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Voting Paused Alert */}
        {!votingActive && (
          <div
            role="alert"
            className="mb-6 rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4 text-amber-900 text-sm font-medium"
          >
            A votação está pausada pelo organizador no momento. Você ainda pode visualizar os trabalhos cadastrados.
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div
            role="alert"
            className="mb-6 rounded-2xl bg-rose-50 border border-rose-200 px-5 py-4 flex items-center justify-between gap-4 text-rose-900 text-sm font-medium"
          >
            <span>{errorMsg}</span>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-rose-700 hover:text-rose-950 font-semibold whitespace-nowrap shrink-0"
            >
              Fechar
            </button>
          </div>
        )}

        {/* Category Tabs */}
        <div
          role="tablist"
          aria-label="Categorias da votação"
          className="flex flex-wrap items-center gap-2 p-1.5 bg-white border border-indigo-100 rounded-2xl shadow-sm mb-8 w-full sm:w-fit"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'desenho'}
            onClick={() => setActiveTab('desenho')}
            className={`flex-1 sm:flex-initial min-h-[44px] px-5 py-2.5 rounded-xl font-display font-bold text-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'desenho'
                ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-sm'
                : 'text-slate-700 hover:bg-violet-50 hover:text-violet-700'
            }`}
          >
            <span aria-hidden="true">🎨</span>
            <span>DESENHOS</span>
            <span
              className={`tabular-nums text-xs ${
                activeTab === 'desenho' ? 'text-blue-100' : 'text-slate-400'
              }`}
            >
              ({drawings.length})
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'poema'}
            onClick={() => setActiveTab('poema')}
            className={`flex-1 sm:flex-initial min-h-[44px] px-5 py-2.5 rounded-xl font-display font-bold text-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'poema'
                ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-sm'
                : 'text-slate-700 hover:bg-violet-50 hover:text-violet-700'
            }`}
          >
            <span aria-hidden="true">📝</span>
            <span>POEMAS</span>
            <span
              className={`tabular-nums text-xs ${
                activeTab === 'poema' ? 'text-blue-100' : 'text-slate-400'
              }`}
            >
              ({poems.length})
            </span>
          </button>

          {showPublicResults && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'resultados'}
              onClick={() => setActiveTab('resultados')}
              className={`flex-1 sm:flex-initial min-h-[44px] px-5 py-2.5 rounded-xl font-display font-bold text-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap shrink-0 ${
                activeTab === 'resultados'
                  ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-sm'
                  : 'text-slate-700 hover:bg-violet-50 hover:text-violet-700'
              }`}
            >
              <BarChart3 className="w-4 h-4" aria-hidden="true" />
              <span>RESULTADOS</span>
            </button>
          )}
        </div>

        {/* Category Instruction Strip */}
        {activeTab !== 'resultados' && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6 pb-4 border-b border-indigo-100">
            <div className="flex items-center gap-2.5">
              {activeTab === 'desenho' ? (
                <Palette className="w-5 h-5 text-violet-600 shrink-0" aria-hidden="true" />
              ) : (
                <PenLine className="w-5 h-5 text-blue-600 shrink-0" aria-hidden="true" />
              )}
              <h2 className="font-display text-xl font-bold text-slate-900">
                {activeTab === 'desenho' ? 'Galeria de Desenhos' : 'Galeria de Poemas'}
              </h2>
            </div>
            <p className="text-sm text-slate-600">
              {activeTab === 'desenho'
                ? 'Toque na imagem para ampliar e escolha 1 desenho favorito.'
                : 'Toque na imagem para ler o poema completo e escolha 1 favorito.'}
            </p>
          </div>
        )}

        {/* Loading Skeletons */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="bg-white rounded-2xl border border-indigo-100 overflow-hidden animate-pulse"
              >
                <div className="aspect-[4/3] bg-indigo-100/60" />
                <div className="p-5 space-y-3">
                  <div className="h-5 w-2/3 bg-indigo-100 rounded" />
                  <div className="h-4 w-1/3 bg-indigo-50 rounded" />
                  <div className="h-12 w-full bg-indigo-100 rounded-xl mt-4" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Public Results View (only if enabled by Admin) */}
        {!loading && activeTab === 'resultados' && showPublicResults && publicResults && !publicResults.hidden && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {([
              { title: 'Ranking de Desenhos', data: publicResults.desenho },
              { title: 'Ranking de Poemas', data: publicResults.poema },
            ] as const).map((section) => (
              <section
                key={section.title}
                className="bg-white rounded-2xl border border-indigo-100 p-6 shadow-sm"
              >
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-display text-lg font-bold text-slate-900">{section.title}</h3>
                  <span className="text-sm font-medium text-violet-700 tabular-nums">
                    {section.data?.totalVotes ?? 0} votos no total
                  </span>
                </div>
                <div className="space-y-4">
                  {(section.data?.rankings ?? []).map((item) => (
                    <div key={item.id} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="font-semibold text-slate-900 truncate">
                          {item.rank}º · {item.studentName}{' '}
                          <span className="font-normal text-slate-500">({item.studentClass})</span>
                        </span>
                        <span className="tabular-nums font-semibold text-slate-800 shrink-0">
                          {item.votes} ({item.percentage}%)
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-indigo-50 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-violet-600 to-blue-600 transition-all duration-300"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && activeTab !== 'resultados' && visibleEntries.length === 0 && (
          <div className="bg-white rounded-2xl border border-indigo-100 p-12 text-center">
            <Sparkles className="w-10 h-10 text-violet-500 mx-auto mb-3" aria-hidden="true" />
            <h3 className="font-display text-lg font-bold text-slate-900">
              Nenhum trabalho cadastrado nesta categoria
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              Os trabalhos enviados pela organização aparecerão aqui automaticamente.
            </p>
          </div>
        )}

        {/* Entries Grid */}
        {!loading && activeTab !== 'resultados' && visibleEntries.length > 0 && (
          <div
            data-testid={`entries-grid-${activeTab}`}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {visibleEntries.map((entry) => {
              const category = entry.category;
              const votedIdInCat = votedEntries[category];
              const isThisVoted = votedIdInCat === entry.id;
              const hasVotedInCategory =
                votedIdInCat !== null || ipBlockedCategories[category];
              const isSubmittingThis = votingId === entry.id;

              return (
                <article
                  key={entry.id}
                  data-testid={`entry-card-${entry.id}`}
                  className="bg-white rounded-2xl border border-indigo-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col"
                >
                  <div className="relative group bg-slate-100">
                    <button
                      type="button"
                      onClick={() => setLightboxEntry(entry)}
                      aria-label={`Ampliar ${category === 'desenho' ? 'desenho' : 'poema'} de ${entry.studentName}`}
                      className={`block w-full overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 ${
                        category === 'poema' ? 'aspect-[3/4]' : 'aspect-[4/3]'
                      }`}
                    >
                      <ImageWithFallback
                        src={entry.imageUrl}
                        alt={`${category === 'desenho' ? 'Desenho' : 'Poema'} de ${entry.studentName} - Turma ${entry.studentClass}`}
                        fallbackTitle={entry.studentName}
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => setLightboxEntry(entry)}
                      aria-label={`Visualizar em tela cheia ${entry.studentName}`}
                      className="absolute bottom-3 right-3 min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-950/75 text-white text-xs font-medium backdrop-blur-sm flex items-center gap-1.5 hover:bg-slate-950 transition-colors"
                    >
                      <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Ampliar</span>
                    </button>
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                    <div>
                      <h3 className="font-display text-lg font-bold text-slate-900 leading-snug">
                        {entry.studentName}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span>Turma: {entry.studentClass}</span>
                        {entry.title && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-slate-700 font-medium">{entry.title}</span>
                          </>
                        )}
                      </p>
                      {showPublicResults && typeof entry.votes === 'number' && (
                        <p className="mt-2 text-xs font-semibold text-violet-700 tabular-nums">
                          {entry.votes} {entry.votes === 1 ? 'voto' : 'votos'}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={hasVotedInCategory || !votingActive || votingId !== null}
                      onClick={() => handleVote(entry)}
                      data-testid={`vote-btn-${entry.id}`}
                      className={`w-full min-h-[48px] px-4 py-3 rounded-xl font-display font-bold text-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
                        isThisVoted
                          ? 'bg-emerald-600 text-white cursor-default shadow-sm'
                          : hasVotedInCategory
                            ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
                            : !votingActive
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              : 'bg-gradient-to-r from-violet-600 to-blue-600 text-white hover:from-violet-700 hover:to-blue-700 shadow-sm hover:shadow active:scale-[0.98]'
                      }`}
                    >
                      {isThisVoted ? (
                        <>
                          <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                          <span>VOTO REGISTRADO</span>
                        </>
                      ) : hasVotedInCategory ? (
                        <span>
                          {ipBlockedCategories[category] && !votedIdInCat
                            ? 'VOTO JÁ REGISTRADO NESTA REDE'
                            : 'VOTO JÁ UTILIZADO'}
                        </span>
                      ) : isSubmittingThis ? (
                        <span>REGISTRANDO VOTO...</span>
                      ) : category === 'desenho' ? (
                        <span>VOTAR NESTE DESENHO</span>
                      ) : (
                        <span>VOTAR NESTE POEMA</span>
                      )}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-indigo-100 bg-white/80 mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <span>Competição Escolar · Votação segura (1 desenho e 1 poema por participante)</span>
          <a
            href="/admin"
            onClick={(e) => {
              e.preventDefault();
              onNavigateAdmin();
            }}
            className="inline-flex items-center gap-1.5 text-slate-500 hover:text-violet-700 transition-colors whitespace-nowrap"
          >
            <Lock className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Acesso Administrativo</span>
          </a>
        </div>
      </footer>

      <ArtworkLightbox entry={lightboxEntry} onClose={() => setLightboxEntry(null)} />
    </div>
  );
}
