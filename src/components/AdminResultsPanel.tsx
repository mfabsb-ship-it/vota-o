import { Eye, EyeOff, RefreshCw, Trophy } from 'lucide-react';
import type { CategoryResults } from '../utils/votingStats';

interface AdminResultsPanelProps {
  desenhoResults: CategoryResults;
  poemaResults: CategoryResults;
  showPublicResults: boolean;
  updatingSetting: boolean;
  onTogglePublicResults: (nextValue: boolean) => void;
  onRefresh: () => void;
}

function CategoryChartCard({
  title,
  accentClass,
  results,
}: {
  title: string;
  accentClass: string;
  results: CategoryResults;
}) {
  const maxVotes = Math.max(1, ...results.rankings.map((r) => r.votes));

  return (
    <section className="bg-white rounded-2xl border border-indigo-100 p-6 shadow-sm flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
        <div>
          <h3 className="font-display text-lg font-bold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Ranking atualizado automaticamente com percentuais
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">Total geral de votos</div>
          <div className="font-display text-2xl font-extrabold text-violet-700 tabular-nums">
            {results.totalVotes}
          </div>
        </div>
      </div>

      {results.rankings.length === 0 ? (
        <p className="text-sm text-slate-500 py-8 text-center">
          Nenhum participante cadastrado nesta categoria.
        </p>
      ) : (
        <>
          {/* Visual Bar Chart */}
          <div className="space-y-3" aria-label={`Gráfico de barras — ${title}`}>
            {results.rankings.map((item) => {
              const barWidth =
                item.votes > 0 && results.totalVotes > 0
                  ? Math.max(4, Math.round((item.votes / maxVotes) * 100))
                  : 0;
              return (
                <div key={item.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 tabular-nums ${
                          item.rank === 1
                            ? 'bg-gradient-to-br from-violet-600 to-blue-600 text-white'
                            : 'bg-indigo-50 text-indigo-800'
                        }`}
                      >
                        {item.rank}º
                      </span>
                      <span className="font-semibold text-slate-900 truncate">
                        {item.studentName}
                      </span>
                      <span className="text-xs text-slate-500 truncate hidden sm:inline">
                        · {item.studentClass}
                      </span>
                    </div>
                    <div className="tabular-nums text-sm font-bold text-slate-800 shrink-0">
                      {item.votes} {item.votes === 1 ? 'voto' : 'votos'}{' '}
                      <span className="text-violet-700">({item.percentage.toFixed(1)}%)</span>
                    </div>
                  </div>
                  <div className="h-3 w-full rounded-full bg-indigo-50 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${accentClass}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detailed Ranking Table */}
          <div className="overflow-x-auto pt-2">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500">
                  <th className="py-2 pr-3">Posição</th>
                  <th className="py-2 pr-3">Aluno</th>
                  <th className="py-2 pr-3">Turma</th>
                  <th className="py-2 px-3 text-right">Votos</th>
                  <th className="py-2 pl-3 text-right">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.rankings.map((item) => (
                  <tr key={item.id} className="hover:bg-indigo-50/40">
                    <td className="py-2.5 pr-3 font-mono text-xs font-semibold text-slate-700 tabular-nums">
                      #{item.rank}
                    </td>
                    <td className="py-2.5 pr-3 font-medium text-slate-900">
                      {item.studentName}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-600">{item.studentClass}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                      {item.votes}
                    </td>
                    <td className="py-2.5 pl-3 text-right font-mono font-semibold text-violet-700 tabular-nums">
                      {item.percentage.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

export function AdminResultsPanel({
  desenhoResults,
  poemaResults,
  showPublicResults,
  updatingSetting,
  onTogglePublicResults,
  onRefresh,
}: AdminResultsPanelProps) {
  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="bg-white rounded-2xl border border-indigo-100 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 text-white flex items-center justify-center shrink-0">
            <Trophy className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              Resultados da Votação
            </h2>
            <p className="text-sm text-slate-600">
              Os rankings são atualizados automaticamente a cada novo voto registrado.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={updatingSetting}
            onClick={() => onTogglePublicResults(!showPublicResults)}
            data-testid="toggle-public-results"
            className={`min-h-[44px] px-4 py-2 rounded-xl border font-semibold text-sm transition-colors flex items-center gap-2 whitespace-nowrap ${
              showPublicResults
                ? 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100'
                : 'border-violet-200 bg-violet-50 text-violet-900 hover:bg-violet-100'
            }`}
          >
            {showPublicResults ? (
              <>
                <Eye className="w-4 h-4" aria-hidden="true" />
                <span>Resultados visíveis aos alunos</span>
              </>
            ) : (
              <>
                <EyeOff className="w-4 h-4" aria-hidden="true" />
                <span>Ocultar resultados dos alunos (Ativo)</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onRefresh}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm flex items-center gap-2 whitespace-nowrap"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Rankings Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <CategoryChartCard
          title="Ranking de Desenhos"
          accentClass="bg-gradient-to-r from-violet-600 to-purple-500"
          results={desenhoResults}
        />
        <CategoryChartCard
          title="Ranking de Poemas"
          accentClass="bg-gradient-to-r from-blue-600 to-indigo-600"
          results={poemaResults}
        />
      </div>
    </div>
  );
}
