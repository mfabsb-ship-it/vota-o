import { useState } from 'react';
import { Check, Copy, Download, QrCode, ShieldAlert } from 'lucide-react';

interface AdminQrPanelProps {
  qrState: {
    generated: boolean;
    publicUrl: string;
    qrDataUrl: string;
    generatedAt: string;
  };
  votingActive: boolean;
  generating: boolean;
  onGenerateQr: (regenerate?: boolean) => void;
}

export function AdminQrPanel({
  qrState,
  votingActive,
  generating,
  onGenerateQr,
}: AdminQrPanelProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopyLink() {
    if (!qrState.publicUrl) return;
    try {
      await navigator.clipboard.writeText(qrState.publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback copy via temporary input
      const input = document.createElement('input');
      input.value = qrState.publicUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <section className="lg:col-span-7 bg-white rounded-2xl border border-indigo-100 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 text-white flex items-center justify-center shrink-0">
            <QrCode className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">
              Gerar QR Code para os Alunos
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              O QR Code direciona exclusivamente para a página pública de votação, sem permitir acesso ao painel administrativo.
            </p>
          </div>
        </div>

        {!votingActive && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              A votação está pausada no momento. Reative-a em Visão Geral para que os alunos possam registrar votos pelo QR Code.
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={generating}
            onClick={() => onGenerateQr(false)}
            data-testid="generate-qr-btn"
            className="min-h-[48px] px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white font-display font-bold text-sm shadow-sm transition-all flex items-center gap-2 whitespace-nowrap disabled:opacity-60"
          >
            <QrCode className="w-4 h-4" aria-hidden="true" />
            <span>{generating ? 'GERANDO...' : 'GERAR QR CODE'}</span>
          </button>

          {qrState.generated && qrState.qrDataUrl && (
            <>
              <a
                href={qrState.qrDataUrl}
                download="qrcode-votacao-escolar.png"
                data-testid="download-qr-btn"
                className="min-h-[48px] px-5 py-3 rounded-xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-900 font-semibold text-sm transition-colors inline-flex items-center gap-2 whitespace-nowrap"
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                <span>Baixar QR Code (PNG)</span>
              </a>

              <button
                type="button"
                onClick={handleCopyLink}
                data-testid="copy-qr-link-btn"
                className="min-h-[48px] px-5 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm transition-colors inline-flex items-center gap-2 whitespace-nowrap"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                    <span>Link Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" aria-hidden="true" />
                    <span>Copiar Link de Votação</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>

        {qrState.generated && qrState.publicUrl && (
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <div className="text-xs font-semibold text-slate-500">
              Link exclusivo da página pública dos alunos
            </div>
            <div
              data-testid="qr-public-url"
              className="rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 font-mono text-xs text-slate-800 break-all"
            >
              {qrState.publicUrl}
            </div>
          </div>
        )}
      </section>

      <section className="lg:col-span-5 bg-white rounded-2xl border border-indigo-100 p-6 sm:p-8 shadow-sm flex flex-col items-center justify-center text-center min-h-[340px]">
        {qrState.generated && qrState.qrDataUrl ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-50 to-blue-50 border border-indigo-100 inline-block">
              <img
                src={qrState.qrDataUrl}
                alt="QR Code da página pública de votação escolar"
                data-testid="qr-preview-img"
                className="w-56 h-56 sm:w-64 sm:h-64 rounded-xl bg-white p-2 shadow-sm"
              />
            </div>
            <div>
              <p className="font-display font-bold text-slate-900">VOTAÇÃO ESCOLAR</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Aponte a câmera do celular para votar em Desenhos e Poemas
              </p>
            </div>
          </div>
        ) : (
          <div className="max-w-xs space-y-2">
            <QrCode className="w-12 h-12 text-violet-300 mx-auto" aria-hidden="true" />
            <h3 className="font-display font-bold text-slate-900">
              Nenhum QR Code gerado ainda
            </h3>
            <p className="text-sm text-slate-500">
              Clique em &ldquo;GERAR QR CODE&rdquo; para criar o código de acesso dos alunos e liberá-lo para impressão ou projeção.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
