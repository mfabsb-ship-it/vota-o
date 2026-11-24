import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { ImagePlus, X } from 'lucide-react';
import type { Category, EntryRecord } from '../utils/votingStats';

interface AdminEntryModalProps {
  open: boolean;
  category: Category;
  editingEntry: EntryRecord | null;
  authToken: string;
  onClose: () => void;
  onSaved: () => void;
}

export function AdminEntryModal({
  open,
  category,
  editingEntry,
  authToken,
  onClose,
  onSaved,
}: AdminEntryModalProps) {
  const [studentName, setStudentName] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setFile(null);
    if (editingEntry) {
      setStudentName(editingEntry.studentName);
      setStudentClass(editingEntry.studentClass);
      setTitle(editingEntry.title);
      setPreviewUrl(editingEntry.imageUrl);
    } else {
      setStudentName('');
      setStudentClass('');
      setTitle('');
      setPreviewUrl('');
    }
  }, [open, editingEntry]);

  useEffect(() => {
    return () => {
      if (previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  if (!open) return null;

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    if (!selected) return;
    if (selected.size > 8 * 1024 * 1024) {
      setError('A imagem deve ter no máximo 8 MB.');
      return;
    }
    setError(null);
    setFile(selected);
    const objectUrl = URL.createObjectURL(selected);
    setPreviewUrl(objectUrl);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!editingEntry && !file) {
      setError(
        category === 'desenho'
          ? 'Selecione a foto do desenho para salvar.'
          : 'Selecione a foto do poema para salvar.',
      );
      return;
    }

    const formData = new FormData();
    formData.append('category', category);
    formData.append('studentName', studentName.trim());
    formData.append('studentClass', studentClass.trim());
    formData.append('title', title.trim());
    if (file) {
      formData.append('image', file);
    }

    setSubmitting(true);
    try {
      const url = editingEntry ? `/api/admin/entries/${editingEntry.id}` : '/api/admin/entries';
      const method = editingEntry ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: formData,
      });

      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(payload.error || 'Erro ao salvar participante.');
        return;
      }

      onSaved();
      onClose();
    } catch {
      setError('Falha de rede ao enviar os dados.');
    } finally {
      setSubmitting(false);
    }
  }

  const labelCategory = category === 'desenho' ? 'Desenho' : 'Poema';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="entry-modal-title"
    >
      <div className="w-full max-w-lg bg-white rounded-3xl border border-indigo-100 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 id="entry-modal-title" className="font-display text-lg font-bold text-slate-900">
            {editingEntry ? `Editar ${labelCategory}` : `Adicionar ${labelCategory}`}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar formulário"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-violet-50 hover:text-violet-700 transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div
              role="alert"
              className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-800 font-medium"
            >
              {error}
            </div>
          )}

          <div>
            <label htmlFor="entry-student-name" className="block text-sm font-semibold text-slate-800 mb-1.5">
              Nome do Aluno
            </label>
            <input
              id="entry-student-name"
              type="text"
              required
              minLength={2}
              maxLength={100}
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="Ex.: Mariana Ferreira"
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="entry-student-class" className="block text-sm font-semibold text-slate-800 mb-1.5">
                Turma do Aluno
              </label>
              <input
                id="entry-student-class"
                type="text"
                required
                minLength={1}
                maxLength={50}
                value={studentClass}
                onChange={(e) => setStudentClass(e.target.value)}
                placeholder="Ex.: 9º Ano B"
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-600"
              />
            </div>

            <div>
              <label htmlFor="entry-title" className="block text-sm font-semibold text-slate-800 mb-1.5">
                Título da Obra (opcional)
              </label>
              <input
                id="entry-title"
                type="text"
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={category === 'desenho' ? 'Ex.: Céu Violeta' : 'Ex.: Versos da Manhã'}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-600"
              />
            </div>
          </div>

          <div>
            <label htmlFor="entry-image-input" className="block text-sm font-semibold text-slate-800 mb-1.5">
              {category === 'desenho' ? 'Foto do Desenho (1 imagem)' : 'Foto do Poema (1 imagem)'}
            </label>
            <label
              htmlFor="entry-image-input"
              className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50/80 transition-colors p-4 cursor-pointer text-center"
            >
              {previewUrl ? (
                <div className="w-full space-y-2">
                  <img
                    src={previewUrl}
                    alt="Pré-visualização da imagem selecionada"
                    className="max-h-48 mx-auto rounded-xl object-contain"
                  />
                  <span className="inline-block text-xs font-semibold text-violet-700">
                    Clique para trocar a imagem
                  </span>
                </div>
              ) : (
                <div className="py-4">
                  <ImagePlus className="w-8 h-8 text-violet-600 mx-auto mb-2" aria-hidden="true" />
                  <span className="text-sm font-semibold text-slate-800 block">
                    Enviar foto ({category === 'desenho' ? 'desenho' : 'poema'})
                  </span>
                  <span className="text-xs text-slate-500 mt-1 block">
                    JPG, PNG, WEBP ou GIF (máx. 8 MB)
                  </span>
                </div>
              )}
              <input
                id="entry-image-input"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFileChange}
                className="sr-only"
              />
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white font-display font-bold text-sm shadow-sm disabled:opacity-60"
            >
              {submitting ? 'Salvando...' : 'Salvar Cadastro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
