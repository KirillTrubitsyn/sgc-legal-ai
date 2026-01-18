"use client";

import { useState } from "react";
import { TranscriptionResult as TranscriptionResultType } from "@/lib/api";

interface TranscriptionResultProps {
  result: TranscriptionResultType;
  onUseInChat: (text: string) => void;
  onClose: () => void;
}

export default function TranscriptionResult({
  result,
  onUseInChat,
  onClose,
}: TranscriptionResultProps) {
  const [copied, setCopied] = useState(false);
  const [showFullText, setShowFullText] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = result.text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleUseInChat = () => {
    onUseInChat(result.text);
    onClose();
  };

  const handleAnalyze = () => {
    // Add transcription as context and suggest analysis
    onUseInChat(
      `Проанализируй эту транскрипцию судебного заседания и выдели ключевые моменты, позиции сторон и аргументы:\n\n${result.text}`
    );
    onClose();
  };

  const handleSummarize = () => {
    onUseInChat(
      `Сделай краткое резюме этой транскрипции судебного заседания, выделив основные события и решения:\n\n${result.text}`
    );
    onClose();
  };

  // Preview text (first 500 chars)
  const previewText = result.text.length > 500
    ? result.text.substring(0, 500) + "..."
    : result.text;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-sgc-blue-700 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-sgc-blue-500 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Транскрибация завершена
            </h2>
            <p className="text-gray-400 text-sm">
              {result.word_count.toLocaleString()} слов
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Text Preview */}
          <div className="bg-sgc-blue-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Текст транскрипции</span>
              <button
                onClick={() => setShowFullText(!showFullText)}
                className="text-sgc-orange text-sm hover:underline"
              >
                {showFullText ? "Свернуть" : "Показать полностью"}
              </button>
            </div>
            <div className="text-gray-200 text-sm whitespace-pre-wrap max-h-60 overflow-y-auto">
              {showFullText ? result.text : previewText}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-2">
            <p className="text-gray-400 text-sm">Быстрые действия:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={handleAnalyze}
                className="flex items-center gap-2 p-3 bg-sgc-blue-600 hover:bg-sgc-blue-500 rounded-lg transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-sgc-orange"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                <div className="text-left">
                  <p className="text-white text-sm font-medium">Анализ</p>
                  <p className="text-gray-400 text-xs">Выделить ключевые моменты</p>
                </div>
              </button>

              <button
                onClick={handleSummarize}
                className="flex items-center gap-2 p-3 bg-sgc-blue-600 hover:bg-sgc-blue-500 rounded-lg transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-sgc-orange"
                >
                  <line x1="21" y1="10" x2="3" y2="10" />
                  <line x1="21" y1="6" x2="3" y2="6" />
                  <line x1="21" y1="14" x2="3" y2="14" />
                  <line x1="21" y1="18" x2="3" y2="18" />
                </svg>
                <div className="text-left">
                  <p className="text-white text-sm font-medium">Резюме</p>
                  <p className="text-gray-400 text-xs">Краткое содержание</p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 p-4 border-t border-sgc-blue-500 shrink-0">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 bg-sgc-blue-600 hover:bg-sgc-blue-500 rounded-lg transition-colors"
          >
            {copied ? (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-green-400"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="text-green-400 text-sm">Скопировано</span>
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-gray-300"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <span className="text-gray-300 text-sm">Копировать</span>
              </>
            )}
          </button>

          <button
            onClick={handleUseInChat}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-sgc-orange hover:bg-sgc-orange/90 rounded-lg transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-white"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span className="text-white text-sm font-medium">Задать вопрос по тексту</span>
          </button>
        </div>
      </div>
    </div>
  );
}
