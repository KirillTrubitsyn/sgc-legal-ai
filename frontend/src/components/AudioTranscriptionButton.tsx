"use client";

import { useState, useRef } from "react";
import { transcribeAudio, TranscriptionProgress, TranscriptionResult } from "@/lib/api";

interface AudioTranscriptionButtonProps {
  token: string;
  onTranscriptionComplete: (result: TranscriptionResult) => void;
  disabled?: boolean;
}

const ACCEPTED_AUDIO_TYPES = ".mp3,.wav,.ogg,.m4a,.webm,.flac,.mp4,.aac";

export default function AudioTranscriptionButton({
  token,
  onTranscriptionComplete,
  disabled,
}: AudioTranscriptionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [progress, setProgress] = useState<TranscriptionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (500 MB max)
    if (file.size > 500 * 1024 * 1024) {
      setError("Файл слишком большой. Максимум: 500 МБ");
      return;
    }

    setSelectedFile(file);
    setError(null);
  };

  const handleStartTranscription = async () => {
    if (!selectedFile) return;

    setIsTranscribing(true);
    setError(null);
    setProgress({
      stage: "preparing",
      progress: 0,
      message: "Загрузка файла...",
    });

    try {
      const result = await transcribeAudio(token, selectedFile, (p) => {
        setProgress(p);
      });

      if (result.success) {
        onTranscriptionComplete(result);
        handleClose();
      } else {
        setError(result.error || "Ошибка транскрибации");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неизвестная ошибка");
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleClose = () => {
    if (isTranscribing) return;
    setIsOpen(false);
    setSelectedFile(null);
    setProgress(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} КБ`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  };

  const formatProgress = (value: number): string => {
    return `${Math.round(value * 100)}%`;
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        type="button"
        className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-sgc-blue-500 transition-colors disabled:opacity-50"
        title="Транскрибация аудио"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-sgc-blue-700 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-sgc-blue-500">
              <h2 className="text-lg font-semibold text-white">
                Транскрибация аудио
              </h2>
              <button
                onClick={handleClose}
                disabled={isTranscribing}
                className="text-gray-400 hover:text-white disabled:opacity-50"
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
            <div className="p-4 space-y-4">
              {/* Description */}
              <p className="text-gray-300 text-sm">
                Загрузите аудиозапись для транскрибации: судебные заседания,
                переговоры, совещания, встречи. До 2 часов.
              </p>

              {/* File Input */}
              {!isTranscribing && !selectedFile && (
                <div className="space-y-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_AUDIO_TYPES}
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-8 border-2 border-dashed border-sgc-blue-400 rounded-lg hover:border-sgc-orange transition-colors"
                  >
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="32"
                        height="32"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      <span>Выберите аудио файл</span>
                      <span className="text-xs text-gray-500">
                        MP3, WAV, OGG, M4A, MP4, FLAC (до 500 МБ)
                      </span>
                    </div>
                  </button>
                </div>
              )}

              {/* Selected File */}
              {selectedFile && !isTranscribing && (
                <div className="bg-sgc-blue-600 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-sgc-orange/20 rounded-lg flex items-center justify-center">
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
                        <path d="M9 18V5l12-2v13" />
                        <circle cx="6" cy="18" r="3" />
                        <circle cx="18" cy="16" r="3" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm truncate">
                        {selectedFile.name}
                      </p>
                      <p className="text-gray-400 text-xs">
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedFile(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      }}
                      className="text-gray-400 hover:text-white"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
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

                  <button
                    onClick={handleStartTranscription}
                    className="w-full py-2 bg-sgc-orange hover:bg-sgc-orange/90 text-white rounded-lg font-medium transition-colors"
                  >
                    Начать транскрибацию
                  </button>
                </div>
              )}

              {/* Progress */}
              {isTranscribing && progress && (
                <div className="space-y-4">
                  <div className="bg-sgc-blue-600 rounded-lg p-4 space-y-3">
                    {/* Progress bar */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-300">{progress.message}</span>
                        <span className="text-sgc-orange">
                          {formatProgress(progress.progress)}
                        </span>
                      </div>
                      <div className="h-2 bg-sgc-blue-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-sgc-orange transition-all duration-300"
                          style={{ width: `${progress.progress * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Chunk info */}
                    {progress.chunk_index && progress.total_chunks && (
                      <p className="text-gray-400 text-xs text-center">
                        Часть {progress.chunk_index} из {progress.total_chunks}
                      </p>
                    )}
                  </div>

                  {/* Spinner */}
                  <div className="flex justify-center">
                    <div className="w-8 h-8 border-2 border-sgc-orange border-t-transparent rounded-full animate-spin" />
                  </div>

                  <p className="text-gray-400 text-xs text-center">
                    Не закрывайте окно и не сворачивайте приложение
                  </p>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3">
                  <p className="text-red-300 text-sm">{error}</p>
                  <button
                    onClick={() => {
                      setError(null);
                      setSelectedFile(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                    className="text-red-400 text-xs hover:text-red-300 mt-2"
                  >
                    Попробовать снова
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-sgc-blue-500 text-xs text-gray-500">
              Используется Gemini 3.0 Flash для транскрибации на русском языке.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
