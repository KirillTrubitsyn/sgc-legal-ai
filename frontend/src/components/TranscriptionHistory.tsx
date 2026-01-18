"use client";

import { useState, useEffect, useRef } from "react";
import {
  Mic,
  Pencil,
  Trash2,
  X,
  Check,
  AlertCircle,
  History,
  ChevronRight,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import { TranscriptionMeta } from "@/lib/api";

interface TranscriptionHistoryProps {
  token: string;
  transcriptions: TranscriptionMeta[];
  count: number;
  maxAllowed: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onRename: (id: string, title: string) => Promise<void>;
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  onRefresh: () => void;
}

export default function TranscriptionHistory({
  transcriptions,
  count,
  maxAllowed,
  selectedId,
  onSelect,
  onDelete,
  onRename,
  isOpen,
  onToggle,
  onRefresh,
}: TranscriptionHistoryProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleRename = async (id: string) => {
    if (!editTitle.trim()) {
      setEditingId(null);
      return;
    }

    try {
      await onRename(id, editTitle.trim());
      setEditingId(null);
    } catch {
      setError("Не удалось переименовать");
    }
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      await onDelete(id);
      setShowDeleteConfirm(null);
    } catch {
      setError("Не удалось удалить");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSelectTranscription = (id: string) => {
    onSelect(id);
    onToggle(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    } else if (diffDays === 1) {
      return "Вчера";
    } else if (diffDays < 7) {
      return date.toLocaleDateString("ru-RU", { weekday: "short" });
    } else {
      return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
    }
  };

  const formatWordCount = (count: number) => {
    if (count < 1000) return `${count} слов`;
    return `${(count / 1000).toFixed(1)}k слов`;
  };

  const panelContent = (
    <>
      {/* Header */}
      <div className="p-4 border-b border-sgc-blue-600 shrink-0" style={{ backgroundColor: '#0f2240' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggle(false)}
              className="md:hidden text-gray-400 hover:text-white p-1 hover:bg-sgc-blue-600 rounded mr-1"
            >
              <ArrowLeft size={20} />
            </button>
            <Mic size={18} className="text-sgc-orange" />
            <h2 className="text-white font-semibold">Транскрипции</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onRefresh}
              className="text-gray-400 hover:text-white p-1 hover:bg-sgc-blue-600 rounded"
              title="Обновить"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={() => onToggle(false)}
              className="hidden md:block text-gray-400 hover:text-white p-1 hover:bg-sgc-blue-600 rounded"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Counter */}
        <div className="mt-3 flex items-center gap-2">
          <div className="h-1 flex-1 bg-sgc-blue-900 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${count >= maxAllowed ? 'bg-red-500' : 'bg-sgc-orange'}`}
              style={{ width: `${(count / maxAllowed) * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-400 whitespace-nowrap">
            {count}/{maxAllowed}
          </span>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-3 mt-3 p-2 bg-red-500/20 border border-red-500/50 rounded-lg flex items-start gap-2 shrink-0">
          <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
          <span className="text-red-300 text-xs flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-300 shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Transcription List */}
      <div className="flex-1 overflow-y-auto p-2 md:p-2 p-4">
        {transcriptions.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <Mic size={48} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">Нет транскрипций</p>
            <p className="text-xs mt-1 text-gray-600">Загрузите аудио, чтобы начать</p>
          </div>
        ) : (
          <div className="space-y-2 md:space-y-1">
            {transcriptions.map((t) => (
              <div
                key={t.id}
                className={`group relative rounded-lg transition-all ${
                  t.id === selectedId
                    ? "bg-sgc-orange/20 border border-sgc-orange/50"
                    : "hover:bg-sgc-blue-700 md:hover:bg-sgc-blue-700 active:bg-sgc-blue-700"
                }`}
              >
                {editingId === t.id ? (
                  <div className="flex items-center gap-1 p-3 md:p-2">
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(t.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="flex-1 bg-sgc-blue-900 text-white text-sm md:text-xs px-2 py-1 rounded border border-sgc-blue-500 focus:outline-none focus:border-sgc-orange"
                    />
                    <button
                      onClick={() => handleRename(t.id)}
                      className="p-2 md:p-1 text-green-400 hover:text-green-300"
                    >
                      <Check size={18} className="md:hidden" />
                      <Check size={14} className="hidden md:block" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-2 md:p-1 text-gray-400 hover:text-gray-300"
                    >
                      <X size={18} className="md:hidden" />
                      <X size={14} className="hidden md:block" />
                    </button>
                  </div>
                ) : showDeleteConfirm === t.id ? (
                  <div className="p-3 md:p-2">
                    <p className="text-sm md:text-xs text-gray-300 mb-2">Удалить?</p>
                    <div className="flex gap-2 md:gap-1">
                      <button
                        onClick={() => handleDelete(t.id)}
                        disabled={isDeleting}
                        className="flex-1 py-2 md:py-1 bg-red-600 hover:bg-red-500 text-white text-sm md:text-xs rounded disabled:opacity-50"
                      >
                        {isDeleting ? "..." : "Да"}
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(null)}
                        className="flex-1 py-2 md:py-1 bg-gray-600 hover:bg-gray-500 text-white text-sm md:text-xs rounded"
                      >
                        Нет
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <button
                      onClick={() => handleSelectTranscription(t.id)}
                      className="flex-1 text-left p-3 md:p-2 md:pr-14"
                    >
                      <div className="text-sm md:text-xs text-white truncate">{t.title}</div>
                      <div className="text-xs md:text-[10px] text-gray-500 mt-0.5 flex items-center gap-2">
                        <span>{formatDate(t.created_at)}</span>
                        <span className="text-gray-600">|</span>
                        <span>{formatWordCount(t.word_count)}</span>
                      </div>
                    </button>

                    <div className="flex gap-1 pr-2 md:absolute md:right-1 md:top-1/2 md:-translate-y-1/2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditTitle(t.title);
                          setEditingId(t.id);
                        }}
                        className="p-2 md:p-1 text-gray-400 hover:text-white hover:bg-sgc-blue-600 rounded"
                        title="Переименовать"
                      >
                        <Pencil size={16} className="md:hidden" />
                        <Pencil size={12} className="hidden md:block" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDeleteConfirm(t.id);
                        }}
                        className="p-2 md:p-1 text-gray-400 hover:text-red-400 hover:bg-red-500/20 rounded"
                        title="Удалить"
                      >
                        <Trash2 size={16} className="md:hidden" />
                        <Trash2 size={12} className="hidden md:block" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Toggle Button - visible only on desktop */}
      <button
        onClick={() => onToggle(!isOpen)}
        className="hidden md:block fixed right-0 top-1/2 -translate-y-1/2 z-50 bg-sgc-orange hover:bg-orange-500 text-white shadow-lg rounded-l-lg"
        title={isOpen ? "Скрыть" : "Транскрипции"}
      >
        <div className="flex flex-col items-center py-4 px-2">
          <Mic size={20} className="mb-1" />
          <span
            className="text-[10px] font-bold uppercase tracking-wide"
            style={{
              writingMode: "vertical-rl",
              textOrientation: "mixed",
            }}
          >
            Записи
          </span>
          <ChevronRight
            size={14}
            className={`mt-1 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Mobile: Full-screen overlay */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 z-[100] flex flex-col"
          style={{ backgroundColor: '#0a1628' }}
        >
          {panelContent}
        </div>
      )}

      {/* Desktop: Sidebar Panel */}
      <div
        className={`hidden md:flex min-h-screen bg-sgc-blue-800 border-l border-sgc-blue-500 flex-col transition-all duration-300 ease-in-out overflow-hidden ${
          isOpen ? "w-72" : "w-0 border-l-0"
        }`}
      >
        {panelContent}
      </div>
    </>
  );
}
