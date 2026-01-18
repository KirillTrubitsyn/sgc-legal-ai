"use client";

import { useState } from "react";
import { TranscriptionResult as TranscriptionResultType, exportAsDocx, downloadBlob } from "@/lib/api";

interface TranscriptionResultProps {
  result: TranscriptionResultType;
  onUseInChat: (text: string) => void;
  onClose: () => void;
  token: string;
}

export default function TranscriptionResult({
  result,
  onUseInChat,
  onClose,
  token,
}: TranscriptionResultProps) {
  const [copied, setCopied] = useState(false);
  const [showFullText, setShowFullText] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
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

  const handleDownloadDocx = async () => {
    setIsExporting(true);
    try {
      const blob = await exportAsDocx(
        token,
        "Транскрипция аудиозаписи",
        result.text,
        "transcription"
      );
      const date = new Date().toISOString().split("T")[0];
      downloadBlob(blob, `transcription-${date}.docx`);
    } catch (err) {
      console.error("Export error:", err);
      alert("Ошибка при экспорте. Попробуйте скопировать текст.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([result.text], { type: "text/plain;charset=utf-8" });
    const date = new Date().toISOString().split("T")[0];
    downloadBlob(blob, `transcription-${date}.txt`);
  };

  const handleUseInChat = () => {
    onUseInChat(result.text);
    onClose();
  };

  const handleSummarize = () => {
    onUseInChat(
      `Сделай структурированное резюме этой транскрипции. Выдели:\n1. Основные темы и вопросы\n2. Ключевые решения и договорённости\n3. Участники и их позиции\n4. Важные даты и сроки (если упоминаются)\n5. Следующие шаги и action items\n\nТранскрипция:\n\n${result.text}`
    );
    onClose();
  };

  const handleAnalyze = () => {
    onUseInChat(
      `Проанализируй эту транскрипцию и выдели:\n- Ключевые моменты и аргументы\n- Позиции участников\n- Спорные или важные вопросы\n- Рекомендации по дальнейшим действиям\n\nТранскрипция:\n\n${result.text}`
    );
    onClose();
  };

  const handleExtractTasks = () => {
    onUseInChat(
      `Извлеки из этой транскрипции все задачи, поручения и action items. Для каждой задачи укажи:\n- Описание задачи\n- Ответственный (если указан)\n- Срок (если указан)\n- Приоритет (высокий/средний/низкий)\n\nТранскрипция:\n\n${result.text}`
    );
    onClose();
  };

  // Preview text (first 1000 chars)
  const previewText = result.text.length > 1000
    ? result.text.substring(0, 1000) + "..."
    : result.text;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-sgc-blue-700 rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-sgc-blue-500 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Транскрибация завершена
            </h2>
            <p className="text-gray-400 text-sm">
              {result.word_count.toLocaleString()} слов
              {result.chunks_processed > 1 && ` | ${result.chunks_processed} частей`}
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
          {/* Text Preview/Full */}
          <div className="bg-sgc-blue-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-400 text-sm font-medium">Текст транскрипции</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="text-gray-400 hover:text-white text-sm flex items-center gap-1"
                >
                  {copied ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span className="text-green-400">Скопировано</span>
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      Копировать
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowFullText(!showFullText)}
                  className="text-sgc-orange text-sm hover:underline"
                >
                  {showFullText ? "Свернуть" : "Показать всё"}
                </button>
              </div>
            </div>
            <div
              className={`text-gray-200 text-sm whitespace-pre-wrap overflow-y-auto ${
                showFullText ? "max-h-[50vh]" : "max-h-48"
              }`}
            >
              {showFullText ? result.text : previewText}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-3">
            <p className="text-gray-400 text-sm font-medium">Быстрые действия</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Summarize */}
              <button
                onClick={handleSummarize}
                className="flex items-center gap-3 p-3 bg-sgc-orange/20 hover:bg-sgc-orange/30 border border-sgc-orange/50 rounded-lg transition-colors"
              >
                <div className="w-10 h-10 bg-sgc-orange/20 rounded-lg flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-sgc-orange">
                    <line x1="21" y1="10" x2="3" y2="10" />
                    <line x1="21" y1="6" x2="3" y2="6" />
                    <line x1="21" y1="14" x2="3" y2="14" />
                    <line x1="21" y1="18" x2="3" y2="18" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-white text-sm font-medium">Сделать саммари</p>
                  <p className="text-gray-400 text-xs">Краткое структурированное резюме</p>
                </div>
              </button>

              {/* Analyze */}
              <button
                onClick={handleAnalyze}
                className="flex items-center gap-3 p-3 bg-sgc-blue-600 hover:bg-sgc-blue-500 rounded-lg transition-colors"
              >
                <div className="w-10 h-10 bg-sgc-blue-500 rounded-lg flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-white text-sm font-medium">Анализ</p>
                  <p className="text-gray-400 text-xs">Ключевые моменты и позиции</p>
                </div>
              </button>

              {/* Extract Tasks */}
              <button
                onClick={handleExtractTasks}
                className="flex items-center gap-3 p-3 bg-sgc-blue-600 hover:bg-sgc-blue-500 rounded-lg transition-colors"
              >
                <div className="w-10 h-10 bg-sgc-blue-500 rounded-lg flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white">
                    <path d="M9 11l3 3L22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-white text-sm font-medium">Извлечь задачи</p>
                  <p className="text-gray-400 text-xs">Action items и поручения</p>
                </div>
              </button>

              {/* Chat */}
              <button
                onClick={handleUseInChat}
                className="flex items-center gap-3 p-3 bg-sgc-blue-600 hover:bg-sgc-blue-500 rounded-lg transition-colors"
              >
                <div className="w-10 h-10 bg-sgc-blue-500 rounded-lg flex items-center justify-center shrink-0">
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
            <p className="text-gray-400 text-sm font-medium">Скачать транскрипцию</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleDownloadDocx}
                disabled={isExporting}
                className="flex items-center gap-2 px-4 py-2 bg-sgc-blue-600 hover:bg-sgc-blue-500 rounded-lg transition-colors disabled:opacity-50"
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
                onClick={handleDownloadTxt}
                className="flex items-center gap-2 px-4 py-2 bg-sgc-blue-600 hover:bg-sgc-blue-500 rounded-lg transition-colors"
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

        {/* Footer */}
        <div className="p-4 border-t border-sgc-blue-500 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2 bg-sgc-blue-600 hover:bg-sgc-blue-500 text-white rounded-lg transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
