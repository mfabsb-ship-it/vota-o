import { useState, type FormEvent } from 'react';
import { ArrowLeft, KeyRound, Lock, ShieldCheck } from 'lucide-react';

interface AdminAuthScreenProps {
  needsSetup: boolean;
  onAuthenticated: (token: string, username: string) => void;
  onBackPublic: () => void;
}

export function AdminAuthScreen({
  needsSetup,
  onAuthenticated,
  onBackPublic,
}: AdminAuthScreenProps) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (needsSetup && password !== confirmPassword) {
      setError('As senhas digitadas não coincidem.');
      return;
    }

    setSubmitting(true);
    try {
      const endpoint = needsSetup ? '/api/admin/bootstrap' : '/api/admin/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = (await res.json()) as { token?: string; username?: string; error?: string };
      if (!res.ok || !data.token || !data.username) {
        setError(data.error || 'Não foi possível autenticar.');
        return;
      }

      onAuthenticated(data.token, data.username);
    } catch {
      setError('Erro de conexão com o servidor.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F6F7FF] flex flex-col justify-center items-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-3xl border border-indigo-100 shadow-lg overflow-hidden">
        <div className="bg-gradient-to-br from-violet-800 via-purple-700 to-blue-600 px-7 py-7 text-white">
          <div className="flex items-center gap-2 text-xs text-blue-100 mb-2">
            {needsSetup ? (
              <KeyRound className="w-4 h-4" aria-hidden="true" />
            ) : (
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            )}
            <span>Área Exclusiva do Organizador</span>
          </div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">
            {needsSetup ? 'Configurar Administrador' : 'Painel Administrativo'}
          </h1>
          <p className="text-sm text-violet-100 mt-1">
            {needsSetup
              ? 'Defina o usuário e a senha do organizador para proteger o painel da competição.'
              : 'Entre com suas credenciais para gerenciar trabalhos, QR Code e resultados.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-7 space-y-5">
          {error && (
            <div
              role="alert"
              className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-800 font-medium"
            >
              {error}
            </div>
          )}

          <div>
            <label htmlFor="admin-username" className="block text-sm font-semibold text-slate-800 mb-1.5">
              Usuário
            </label>
            <input
              id="admin-username"
              type="text"
              required
              minLength={3}
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="block text-sm font-semibold text-slate-800 mb-1.5">
              Senha
            </label>
            <input
              id="admin-password"
              type="password"
              required
              minLength={needsSetup ? 6 : 1}
              autoComplete={needsSetup ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={needsSetup ? 'Mínimo de 6 caracteres' : 'Digite sua senha'}
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent"
            />
          </div>

          {needsSetup && (
            <div>
              <label htmlFor="admin-password-confirm" className="block text-sm font-semibold text-slate-800 mb-1.5">
                Confirmar Senha
              </label>
              <input
                id="admin-password-confirm"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha"
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white font-display font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Lock className="w-4 h-4" aria-hidden="true" />
            <span>
              {submitting
                ? 'Validando...'
                : needsSetup
                  ? 'Salvar e Acessar Painel'
                  : 'Entrar no Painel'}
            </span>
          </button>

          <div className="pt-2 border-t border-slate-100 text-center">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                onBackPublic();
              }}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-violet-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>Voltar para a página pública de votação</span>
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
