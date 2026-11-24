import { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  Edit3,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Palette,
  PenLine,
  Plus,
  QrCode,
  ShieldCheck,
  Trash2,
  Users,
  Vote,
  Wifi,
} from 'lucide-react';
import type { Category, CategoryResults, DashboardMetrics, EntryRecord } from '../utils/votingStats';
import { AdminAuthScreen } from './AdminAuthScreen';
import { AdminEntryModal } from './AdminEntryModal';
import { AdminQrPanel } from './AdminQrPanel';
import { AdminResultsPanel } from './AdminResultsPanel';
import { ImageWithFallback } from './ImageWithFallback';

type AdminSection = 'overview' | 'desenhos' | 'poemas' | 'qrcode' | 'resultados';

interface AdminEntryWithVotes extends EntryRecord {
  votes: number;
}

interface AdminOverviewResponse {
  adminUsername: string;
  metrics: DashboardMetrics;
  entries: AdminEntryWithVotes[];
  results: {
    desenho: CategoryResults;
    poema: CategoryResults;
  };
  settings: {
    showPublicResults: boolean;
    allowSharedSchoolWifi: boolean;
    votingActive: boolean;
  };
  qr: {
    generated: boolean;
    publicUrl: string;
    qrDataUrl: string;
    generatedAt: string;
  };
}

interface AdminPortalPageProps {
  onNavigatePublic: () => void;
}

export function AdminPortalPage({ onNavigatePublic }: AdminPortalPageProps) {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [adminUsername, setAdminUsername] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const [section, setSection] = useState<AdminSection>('overview');
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalCategory, setModalCategory] = useState<Category>('desenho');
  const [editingEntry, setEditingEntry] = useState<EntryRecord | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [generatingQr, setGeneratingQr] = useState(false);
  const [updatingSetting, setUpdatingSetting] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/admin/session', { cache: 'no-store' });
        if (res.ok) {
          const data = (await res.json()) as { needsSetup: boolean };
          if (active) setNeedsSetup(data.needsSetup);
        }
      } finally {
        if (active) setCheckingSession(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const fetchOverview = useCallback(async () => {
    if (!authToken) return;
    try {
      const res = await fetch('/api/admin/overview', {
        headers: { Authorization: `Bearer ${authToken}` },
        cache: 'no-store',
      });
      if (res.status === 401) {
        setAuthToken(null);
        setOverview(null);
        return;
      }
      if (!res.ok) throw new Error('Erro ao carregar dados do painel.');
      const data = (await res.json()) as AdminOverviewResponse;
      setOverview(data);
      setErrorMsg(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao atualizar painel.');
    } finally {
      setLoadingData(false);
    }
  }, [authToken]);

  useEffect(() => {
    if (!authToken) return;
    setLoadingData(true);
    fetchOverview();
    const timer = setInterval(fetchOverview, 5000);
    return () => clearInterval(timer);
  }, [authToken, fetchOverview]);

  async function handleDelete(entry: AdminEntryWithVotes) {
    if (!authToken) return;
    setDeletingId(entry.id);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/entries/${entry.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setErrorMsg(data.error || 'Não foi possível excluir o participante.');
        return;
      }
      await fetchOverview();
    } catch {
      setErrorMsg('Erro de rede ao excluir participante.');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleGenerateQr(regenerate = false) {
    if (!authToken) return;
    setGeneratingQr(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/admin/qr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ regenerate }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setErrorMsg(data.error || 'Erro ao gerar QR Code.');
        return;
      }
      await fetchOverview();
    } catch {
      setErrorMsg('Erro de rede ao gerar QR Code.');
    } finally {
      setGeneratingQr(false);
    }
  }

  async function handleUpdateSetting(patch: Partial<AdminOverviewResponse['settings']>) {
    if (!authToken) return;
    setUpdatingSetting(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        setErrorMsg('Não foi possível atualizar a configuração.');
        return;
      }
      await fetchOverview();
    } catch {
      setErrorMsg('Erro ao salvar configuração.');
    } finally {
      setUpdatingSetting(false);
    }
  }

  function openAddModal(cat: Category) {
    setModalCategory(cat);
    setEditingEntry(null);
    setModalOpen(true);
  }

  function openEditModal(entry: EntryRecord) {
    setModalCategory(entry.category);
    setEditingEntry(entry);
    setModalOpen(true);
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#F6F7FF] flex items-center justify-center p-6">
        <div className="text-sm font-medium text-slate-600">Carregando painel administrativo...</div>
      </div>
    );
  }

  if (!authToken) {
    return (
      <AdminAuthScreen
        needsSetup={needsSetup}
        onAuthenticated={(token, username) => {
          setNeedsSetup(false);
          setAuthToken(token);
          setAdminUsername(username);
        }}
        onBackPublic={onNavigatePublic}
      />
    );
  }

  const drawings = (overview?.entries ?? []).filter((e) => e.category === 'desenho');
  const poems = (overview?.entries ?? []).filter((e) => e.category === 'poema');
  const metrics = overview?.metrics ?? {
    totalDesenhos: 0,
    totalPoemas: 0,
    totalVotosDesenhos: 0,
    totalVotosPoemas: 0,
    totalParticipantes: 0,
    totalPessoasQueVotaram: 0,
  };

  const navItems: Array<{ id: AdminSection; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'desenhos', label: 'Gerenciar Desenhos', icon: Palette },
    { id: 'poemas', label: 'Gerenciar Poemas', icon: PenLine },
    { id: 'qrcode', label: 'Gerar QR Code', icon: QrCode },
    { id: 'resultados', label: 'Resultados', icon: BarChart3 },
  ];

  const kpiCards = [
    { label: 'Total de desenhos cadastrados', value: metrics.totalDesenhos, icon: Palette },
    { label: 'Total de poemas cadastrados', value: metrics.totalPoemas, icon: PenLine },
    { label: 'Total de votos em desenhos', value: metrics.totalVotosDesenhos, icon: Vote },
    { label: 'Total de votos em poemas', value: metrics.totalVotosPoemas, icon: Vote },
    { label: 'Total de participantes', value: metrics.totalParticipantes, icon: Users },
    { label: 'Total de pessoas que já votaram', value: metrics.totalPessoasQueVotaram, icon: ShieldCheck },
  ];

  const renderManagementSection = (cat: Category, items: AdminEntryWithVotes[]) => {
    const isDrawing = cat === 'desenho';
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-indigo-100 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">
              {isDrawing ? 'Gerenciar Desenhos' : 'Gerenciar Poemas'}
            </h2>
            <p className="text-sm text-slate-600 mt-0.5">
              {isDrawing
                ? 'Cadastre 1 foto por desenho com nome e turma. Os trabalhos aparecem automaticamente para os alunos.'
                : 'Cadastre a foto de cada poema com nome e turma para que os alunos leiam e votem.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => openAddModal(cat)}
            data-testid={`add-${cat}-btn`}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white font-display font-bold text-sm shadow-sm flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>{isDrawing ? 'Adicionar Desenho' : 'Adicionar Poema'}</span>
          </button>
        </div>

        {items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-indigo-100 p-12 text-center">
            <p className="font-display font-bold text-slate-900">
              {isDrawing ? 'Nenhum desenho cadastrado' : 'Nenhum poema cadastrado'}
            </p>
            <p className="text-sm text-slate-500 mt-1 mb-4">
              Adicione o primeiro trabalho para disponibilizá-lo na página de votação.
            </p>
            <button
              type="button"
              onClick={() => openAddModal(cat)}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white font-semibold text-sm inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>{isDrawing ? 'Cadastrar Primeiro Desenho' : 'Cadastrar Primeiro Poema'}</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {items.map((item) => (
              <article
                key={item.id}
                data-testid={`admin-entry-${item.id}`}
                className="bg-white rounded-2xl border border-indigo-100 shadow-sm overflow-hidden flex flex-col"
              >
                <div className={`bg-slate-100 ${isDrawing ? 'aspect-[4/3]' : 'aspect-[3/4] max-h-72'}`}>
                  <ImageWithFallback
                    src={item.imageUrl}
                    alt={`${isDrawing ? 'Desenho' : 'Poema'} de ${item.studentName}`}
                    fallbackTitle={item.studentName}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                  <div>
                    <h3 className="font-display text-base font-bold text-slate-900">
                      {item.studentName}
                    </h3>
                    <p className="text-sm text-slate-600 mt-0.5">
                      Turma: {item.studentClass}
                      {item.title ? ` · ${item.title}` : ''}
                    </p>
                    <p className="text-xs font-semibold text-violet-700 mt-2 tabular-nums">
                      {item.votes} {item.votes === 1 ? 'voto registrado' : 'votos registrados'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => openEditModal(item)}
                      aria-label={`Editar ${item.studentName}`}
                      className="flex-1 min-h-[44px] px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100 text-indigo-900 font-semibold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap"
                    >
                      <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      disabled={deletingId === item.id}
                      onClick={() => handleDelete(item)}
                      aria-label={`Excluir ${item.studentName}`}
                      className="flex-1 min-h-[44px] px-3 py-2 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-100 text-rose-800 font-semibold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{deletingId === item.id ? 'Excluindo...' : 'Excluir'}</span>
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F6F7FF] flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-68 bg-white border-r border-indigo-100 shrink-0">
        <div className="p-6 bg-gradient-to-br from-violet-800 via-purple-700 to-blue-600 text-white">
          <div className="text-xs text-blue-100 font-medium">Painel Exclusivo</div>
          <div className="font-display text-xl font-extrabold tracking-tight mt-0.5">
            VOTAÇÃO ESCOLAR
          </div>
          <div className="text-xs text-violet-100 mt-1">Organizador: {adminUsername}</div>
        </div>

        <nav className="flex-1 p-4 space-y-1.5" aria-label="Navegação administrativa">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`w-full min-h-[44px] px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-3 transition-all text-left whitespace-nowrap ${
                  active
                    ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-sm'
                    : 'text-slate-700 hover:bg-violet-50 hover:text-violet-700'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-indigo-100 space-y-2">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigatePublic();
            }}
            className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-indigo-100 text-slate-700 hover:bg-indigo-50 text-sm font-medium flex items-center justify-between"
          >
            <span>Página dos Alunos</span>
            <ExternalLink className="w-4 h-4" aria-hidden="true" />
          </a>
          <button
            type="button"
            onClick={() => {
              setAuthToken(null);
              setOverview(null);
            }}
            className="w-full min-h-[44px] px-4 py-2 rounded-xl text-rose-700 hover:bg-rose-50 text-sm font-semibold flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span>Sair do Painel</span>
          </button>
        </div>
      </aside>

      {/* Mobile Top Header & Nav */}
      <div className="lg:hidden bg-gradient-to-r from-violet-800 via-purple-700 to-blue-600 text-white">
        <div className="px-4 py-4 flex items-center justify-between gap-3">
          <div>
            <div className="font-display font-extrabold text-lg">Painel Administrativo</div>
            <div className="text-xs text-blue-100">Organizador: {adminUsername}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onNavigatePublic}
              aria-label="Abrir página dos alunos"
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white/15 text-xs font-semibold whitespace-nowrap"
            >
              Ver Votação
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthToken(null);
                setOverview(null);
              }}
              aria-label="Sair do painel"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-white/15"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="px-3 pb-3 flex items-center gap-1.5 overflow-x-auto">
          {navItems.map((item) => {
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                  active ? 'bg-white text-violet-800' : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Workspace */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
        {errorMsg && (
          <div
            role="alert"
            className="rounded-2xl bg-rose-50 border border-rose-200 px-5 py-4 text-sm font-medium text-rose-900 flex items-center justify-between gap-3"
          >
            <span>{errorMsg}</span>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="font-semibold text-rose-700 whitespace-nowrap"
            >
              Fechar
            </button>
          </div>
        )}

        {loadingData && !overview ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="h-28 rounded-2xl bg-white border border-indigo-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {section === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h1 className="font-display text-2xl font-extrabold text-slate-900">
                    Dashboard Administrativo
                  </h1>
                  <p className="text-sm text-slate-600 mt-1">
                    Resumo geral da competição escolar em tempo real.
                  </p>
                </div>

                {/* 6 KPI Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {kpiCards.map((card) => {
                    const Icon = card.icon;
                    return (
                      <div
                        key={card.label}
                        className="bg-white rounded-2xl border border-indigo-100 p-5 shadow-sm flex items-center justify-between gap-4"
                      >
                        <div>
                          <div className="text-xs font-semibold text-slate-500">{card.label}</div>
                          <div className="font-display text-3xl font-extrabold text-slate-900 mt-1 tabular-nums">
                            {card.value}
                          </div>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-100 to-blue-100 text-violet-700 flex items-center justify-center shrink-0">
                          <Icon className="w-6 h-6" aria-hidden="true" />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Security & Voting Controls */}
                <section className="bg-white rounded-2xl border border-indigo-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-indigo-100">
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      Controles de Votação e Segurança
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-indigo-100">
                    <div className="p-6 flex flex-col justify-between gap-4">
                      <div>
                        <div className="font-semibold text-sm text-slate-900">Status da Votação</div>
                        <p className="text-xs text-slate-600 mt-1">
                          {overview?.settings.votingActive
                            ? 'Votação aberta para os alunos pelo QR Code.'
                            : 'Votação pausada temporariamente.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={updatingSetting}
                        onClick={() =>
                          handleUpdateSetting({ votingActive: !overview?.settings.votingActive })
                        }
                        className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                          overview?.settings.votingActive
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                        }`}
                      >
                        {overview?.settings.votingActive ? 'Votação Ativa (Pausar)' : 'Reativar Votação'}
                      </button>
                    </div>

                    <div className="p-6 flex flex-col justify-between gap-4">
                      <div>
                        <div className="font-semibold text-sm text-slate-900">
                          Visibilidade dos Resultados
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          {overview?.settings.showPublicResults
                            ? 'Resultados visíveis também na página dos alunos.'
                            : 'Resultados ocultos dos alunos (visíveis apenas aqui).'}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={updatingSetting}
                        onClick={() =>
                          handleUpdateSetting({
                            showPublicResults: !overview?.settings.showPublicResults,
                          })
                        }
                        className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                          overview?.settings.showPublicResults
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-violet-100 text-violet-900 hover:bg-violet-200'
                        }`}
                      >
                        {overview?.settings.showPublicResults
                          ? 'Ocultar dos Alunos'
                          : 'Resultados Ocultos (Liberar)'}
                      </button>
                    </div>

                    <div className="p-6 flex flex-col justify-between gap-4">
                      <div>
                        <div className="font-semibold text-sm text-slate-900 flex items-center gap-1.5">
                          <Wifi className="w-4 h-4 text-violet-600" aria-hidden="true" />
                          <span>Controle de IP / Wi-Fi Escolar</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          {overview?.settings.allowSharedSchoolWifi
                            ? 'Wi-Fi compartilhado liberado: controle por identificador seguro do dispositivo.'
                            : 'Bloqueio estrito ativo: 1 voto por IP e por identificador seguro em cada categoria.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={updatingSetting}
                        onClick={() =>
                          handleUpdateSetting({
                            allowSharedSchoolWifi: !overview?.settings.allowSharedSchoolWifi,
                          })
                        }
                        className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                          overview?.settings.allowSharedSchoolWifi
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-violet-600 text-white hover:bg-violet-700'
                        }`}
                      >
                        {overview?.settings.allowSharedSchoolWifi
                          ? 'Modo Wi-Fi Compartilhado (Ativo)'
                          : 'Bloqueio Estrito de IP (Ativo)'}
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {section === 'desenhos' && renderManagementSection('desenho', drawings)}
            {section === 'poemas' && renderManagementSection('poema', poems)}

            {section === 'qrcode' && overview && (
              <AdminQrPanel
                qrState={overview.qr}
                votingActive={overview.settings.votingActive}
                generating={generatingQr}
                onGenerateQr={handleGenerateQr}
              />
            )}

            {section === 'resultados' && overview && (
              <AdminResultsPanel
                desenhoResults={overview.results.desenho}
                poemaResults={overview.results.poema}
                showPublicResults={overview.settings.showPublicResults}
                updatingSetting={updatingSetting}
                onTogglePublicResults={(next) =>
                  handleUpdateSetting({ showPublicResults: next })
                }
                onRefresh={fetchOverview}
              />
            )}
          </>
        )}
      </main>

      {authToken && (
        <AdminEntryModal
          open={modalOpen}
          category={modalCategory}
          editingEntry={editingEntry}
          authToken={authToken}
          onClose={() => setModalOpen(false)}
          onSaved={fetchOverview}
        />
      )}
    </div>
  );
}
