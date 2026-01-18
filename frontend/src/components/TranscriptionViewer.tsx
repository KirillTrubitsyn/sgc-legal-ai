"use client";

import { useState } from "react";
import { TranscriptionFull, sendQuery, Message, exportAsDocx, downloadBlob } from "@/lib/api";
import { Pencil, Trash2, X, Check, Copy, CheckCheck, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface TranscriptionViewerProps {
  transcription: TranscriptionFull;
  token: string;
  onClose: () => void;
  onGoToChat: (text: string) => void;
  onDownloadDocx: () => void;
  onDownloadTxt: () => void;
  onRename: (title: string) => Promise<void>;
  onDelete: () => Promise<void>;
}

type ActionType = "summary" | "analyze" | "tasks" | null;

const ACTION_PROMPTS: Record<Exclude<ActionType, null>, string> = {
  summary: `Сделай структурированное резюме этой транскрипции. Выдели:
1. Основные темы и вопросы
2. Ключевые решения и договорённости
3. Участники и их позиции
4. Важные даты и сроки (если упоминаются)
5. Следующие шаги и action items`,
  analyze: `Проанализируй эту транскрипцию и выдели:
- Ключевые моменты и аргументы
- Позиции участников
- Спорные или важные вопросы
- Рекомендации по дальнейшим действиям`,
  tasks: `Извлеки из этой транскрипции все задачи, поручения и action items. Для каждой задачи укажи:
- Описание задачи
- Ответственный (если указан)
- Срок (если указан)
- Приоритет (высокий/средний/низкий)`,
};

const ACTION_TITLES: Record<Exclude<ActionType, null>, string> = {
  summary: "Саммари",
  analyze: "Анализ",
  tasks: "Задачи",
};

export default function TranscriptionViewer({
  transcription,
  token,
  onClose,
  onGoToChat,
  onDownloadDocx,
  onDownloadTxt,
  onRename,
  onDelete,
}: TranscriptionViewerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(transcription.title);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedResult, setCopiedResult] = useState(false);
  const [showFullText, setShowFullText] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Quick action state
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentAction, setCurrentAction] = useState<ActionType>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const [actionResult, setActionResult] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(transcription.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = transcription.text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyResult = async () => {
    if (!actionResult) return;
    try {
      await navigator.clipboard.writeText(actionResult);
      setCopiedResult(true);
      setTimeout(() => setCopiedResult(false), 2000);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = actionResult;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopiedResult(true);
      setTimeout(() => setCopiedResult(false), 2000);
    }
  };

  const handleRename = async () => {
    if (!editTitle.trim() || editTitle === transcription.title) {
      setIsEditing(false);
      return;
    }
    try {
      await onRename(editTitle.trim());
      setIsEditing(false);
    } catch {
      // Error handled by parent
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
    } catch {
      setIsDeleting(false);
    }
  };

  const handleDownloadDocx = async () => {
    setIsExporting(true);
    try {
      await onDownloadDocx();
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportResultDocx = async () => {
    if (!actionResult || !currentAction) return;
    try {
      const title = `${ACTION_TITLES[currentAction]}: ${transcription.title}`;
      const blob = await exportAsDocx(token, title, actionResult, "analysis");
      const date = new Date().toISOString().split("T")[0];
      downloadBlob(blob, `${currentAction}-${date}.docx`);
    } catch (err) {
      console.error("Export error:", err);
    }
  };

  const runQuickAction = async (action: Exclude<ActionType, null>) => {
    setIsProcessing(true);
    setCurrentAction(action);
    setStreamingContent("");
    setActionResult(null);
    setActionError(null);

    const prompt = ACTION_PROMPTS[action];
    const fullPrompt = `${prompt}\n\nТранскрипция:\n\n${transcription.text}`;

    const messages: Message[] = [{ role: "user", content: fullPrompt }];

    try {
      const result = await sendQuery(
        token,
        messages,
        "fast",
        false, // No search needed for analysis
        (chunk) => {
          setStreamingContent((prev) => prev + chunk);
        },
        undefined, // No stage updates
        undefined, // No file context
        undefined  // No chat session
      );

      setActionResult(result.content);
      setStreamingContent("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Ошибка обработки");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDiscuss = () => {
    onGoToChat(transcription.text);
  };

  const clearResult = () => {
    setActionResult(null);
    setCurrentAction(null);
    setActionError(null);
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Preview text (first 1000 chars)
  const previewText = transcription.text.length > 1000
    ? transcription.text.substring(0, 1000) + "..."
    : transcription.text;

  return (
    <div className="bg-sgc-blue-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-sgc-blue-600">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename();
                    if (e.key === "Escape") setIsEditing(false);
                  }}
                  className="flex-1 bg-sgc-blue-900 text-white px-3 py-1.5 rounded border border-sgc-blue-500 focus:outline-none focus:border-sgc-orange"
                  autoFocus
                />
                <button
                  onClick={handleRename}
                  className="p-1.5 text-green-400 hover:text-green-300 hover:bg-green-500/20 rounded"
                >
                  <Check size={18} />
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-300 hover:bg-sgc-blue-700 rounded"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-white text-lg font-semibold truncate">
                  {transcription.title}
                </h2>
                <button
                  onClick={() => {
                    setEditTitle(transcription.title);
                    setIsEditing(true);
                  }}
                  className="p-1 text-gray-400 hover:text-white hover:bg-sgc-blue-700 rounded shrink-0"
                  title="Переименовать"
                >
                  <Pencil size={14} />
                </button>
              </div>
            )}
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
              <span>{formatDate(transcription.created_at)}</span>
              <span className="text-gray-600">|</span>
              <span>{transcription.word_count.toLocaleString()} слов</span>
              {transcription.filename && (
                <>
                  <span className="text-gray-600">|</span>
                  <span className="truncate max-w-[200px]">{transcription.filename}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {showDeleteConfirm ? (
              <div className="flex items-center gap-1 bg-red-500/20 rounded-lg p-1">
                <span className="text-red-300 text-xs px-2">Удалить?</span>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded disabled:opacity-50"
                >
                  {isDeleting ? "..." : "Да"}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-2 py-1 bg-gray-600 hover:bg-gray-500 text-white text-xs rounded"
                >
                  Нет
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/20 rounded-lg"
                  title="Удалить"
                >
                  <Trash2 size={18} />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-white hover:bg-sgc-blue-700 rounded-lg"
                  title="Закрыть"
                >
                  <X size={18} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Action Result */}
        {(isProcessing || actionResult || actionError) && (
          <div className="bg-sgc-orange/10 border border-sgc-orange/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sgc-orange text-sm font-medium flex items-center gap-2">
                {isProcessing && <Loader2 size={14} className="animate-spin" />}
                {currentAction && ACTION_TITLES[currentAction]}
              </span>
              <div className="flex items-center gap-2">
                {actionResult && (
                  <>
                    <button
                      onClick={handleCopyResult}
                      className="text-gray-400 hover:text-white text-xs flex items-center gap-1"
                    >
                      {copiedResult ? (
                        <>
                          <CheckCheck size={12} className="text-green-400" />
                          <span className="text-green-400">Скопировано</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          <span>Копировать</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleExportResultDocx}
                      className="text-gray-400 hover:text-white text-xs"
                    >
                      DOCX
                    </button>
                  </>
                )}
                {!isProcessing && (
                  <button
                    onClick={clearResult}
                    className="text-gray-400 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {actionError ? (
              <p className="text-red-400 text-sm">{actionError}</p>
            ) : (
              <div className="text-gray-200 text-sm prose prose-invert prose-sm max-w-none max-h-[40vh] overflow-y-auto">
                <ReactMarkdown>
                  {actionResult || streamingContent || "Обработка..."}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}

        {/* Text */}
        <div className="bg-sgc-blue-900 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400 text-sm font-medium">Текст транскрипции</span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="text-gray-400 hover:text-white text-sm flex items-center gap-1"
              >
                {copied ? (
                  <>
                    <CheckCheck size={14} className="text-green-400" />
                    <span className="text-green-400">Скопировано</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Копировать</span>
                  </>
                )}
              </button>
            </div>
          </div>
          <div
            className={`text-gray-200 text-sm whitespace-pre-wrap overflow-y-auto ${
              showFullText ? "max-h-[50vh]" : "max-h-48"
            }`}
          >
            {showFullText ? transcription.text : previewText}
          </div>
          {transcription.text.length > 1000 && (
            <button
              onClick={() => setShowFullText(!showFullText)}
              className="mt-3 text-sgc-orange text-sm hover:underline flex items-center gap-1"
            >
              {showFullText ? (
                <>
                  <ChevronUp size={14} />
                  Свернуть
                </>
              ) : (
                <>
                  <ChevronDown size={14} />
                  Показать всё
                </>
              )}
            </button>
          )}
        </div>

        {/* Quick Actions */}
        <div className="space-y-3">
          <p className="text-gray-400 text-sm font-medium">Быстрые действия</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Summarize */}
            <button
              onClick={() => runQuickAction("summary")}
              disabled={isProcessing}
              className="flex items-center gap-3 p-3 bg-sgc-orange/20 hover:bg-sgc-orange/30 border border-sgc-orange/50 rounded-lg transition-colors disabled:opacity-50"
            >
              <div className="w-10 h-10 bg-sgc-orange/20 rounded-lg flex items-center justify-center shrink-0">
                {isProcessing && currentAction === "summary" ? (
                  <Loader2 size={20} className="text-sgc-orange animate-spin" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-sgc-orange">
                    <line x1="21" y1="10" x2="3" y2="10" />
                    <line x1="21" y1="6" x2="3" y2="6" />
                    <line x1="21" y1="14" x2="3" y2="14" />
                    <line x1="21" y1="18" x2="3" y2="18" />
                  </svg>
                )}
              </div>
              <div className="text-left">
                <p className="text-white text-sm font-medium">Сделать саммари</p>
                <p className="text-gray-400 text-xs">Краткое структурированное резюме</p>
              </div>
            </button>

            {/* Analyze */}
            <button
              onClick={() => runQuickAction("analyze")}
              disabled={isProcessing}
              className="flex items-center gap-3 p-3 bg-sgc-blue-700 hover:bg-sgc-blue-600 rounded-lg transition-colors disabled:opacity-50"
            >
              <div className="w-10 h-10 bg-sgc-blue-600 rounded-lg flex items-center justify-center shrink-0">
                {isProcessing && currentAction === "analyze" ? (
                  <Loader2 size={20} className="text-white animate-spin" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                )}
              </div>
              <div className="text-left">
                <p className="text-white text-sm font-medium">Анализ</p>
                <p className="text-gray-400 text-xs">Ключевые моменты и позиции</p>
              </div>
            </button>

            {/* Extract Tasks */}
            <button
              onClick={() => runQuickAction("tasks")}
              disabled={isProcessing}
              className="flex items-center gap-3 p-3 bg-sgc-blue-700 hover:bg-sgc-blue-600 rounded-lg transition-colors disabled:opacity-50"
            >
              <div className="w-10 h-10 bg-sgc-blue-600 rounded-lg flex items-center justify-center shrink-0">
                {isProcessing && currentAction === "tasks" ? (
                  <Loader2 size={20} className="text-white animate-spin" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white">
                    <path d="M9 11l3 3L22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                )}
              </div>
              <div className="text-left">
                <p className="text-white text-sm font-medium">Извлечь задачи</p>
                <p className="text-gray-400 text-xs">Action items и поручения</p>
              </div>
            </button>

            {/* Discuss in Chat */}
            <button
              onClick={handleDiscuss}
              disabled={isProcessing}
              className="flex items-center gap-3 p-3 bg-sgc-blue-700 hover:bg-sgc-blue-600 rounded-lg transition-colors disabled:opacity-50"
            >
              <div className="w-10 h-10 bg-sgc-blue-600 rounded-lg flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-white text-sm font-medium">Обсудить в чате</p>
                <p className="text-gray-400 text-xs">Задать свой вопрос по тексту</p>
              </div>
            </button>
          </div>
        </div>

        {/* Download Options */}
        <div className="space-y-3">
          <p className="text-gray-400 text-sm font-medium">Скачать</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleDownloadDocx}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 bg-sgc-blue-700 hover:bg-sgc-blue-600 rounded-lg transition-colors disabled:opacity-50"
            >
              {isExporting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              )}
              <span className="text-white text-sm">DOCX</span>
            </button>

            <button
              onClick={onDownloadTxt}
              className="flex items-center gap-2 px-4 py-2 bg-sgc-blue-700 hover:bg-sgc-blue-600 rounded-lg transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span className="text-white text-sm">TXT</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
