import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { EntryRecord } from '../utils/votingStats';
import { ImageWithFallback } from './ImageWithFallback';

interface ArtworkLightboxProps {
  entry: EntryRecord | null;
  onClose: () => void;
}

export function ArtworkLightbox({ entry, onClose }: ArtworkLightboxProps) {
  useEffect(() => {
    if (!entry) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [entry, onClose]);

  if (!entry) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lightbox-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-white rounded-2xl overflow-hidden shadow-2xl border border-indigo-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-100">
          <div className="min-w-0">
            <h2 id="lightbox-title" className="text-lg font-bold text-slate-900 truncate">
              {entry.title || entry.studentName}
            </h2>
            <p className="text-sm text-slate-600 truncate">
              {entry.studentName} · Turma {entry.studentClass}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar visualização ampliada"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-600 hover:bg-violet-50 hover:text-violet-700 transition-colors shrink-0"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        <div className="bg-slate-950/5 flex items-center justify-center p-3 sm:p-6 max-h-[80vh] overflow-auto">
          <ImageWithFallback
            src={entry.imageUrl}
            alt={`${entry.category === 'desenho' ? 'Desenho' : 'Poema'} de ${entry.studentName} (${entry.studentClass})`}
            fallbackTitle={entry.studentName}
            className="max-h-[72vh] w-auto object-contain rounded-lg shadow-sm"
          />
        </div>
      </div>
    </div>
  );
}
