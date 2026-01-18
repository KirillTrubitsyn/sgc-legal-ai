"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  TranscriptionMeta,
  TranscriptionFull,
  getTranscriptions,
  getTranscription,
  transcribeAndSaveAudio,
  deleteTranscription,
  updateTranscriptionTitle,
  TranscribeAndSaveProgress,
  exportAsDocx,
  downloadBlob,
} from "@/lib/api";
import TranscriptionHistory from "@/components/TranscriptionHistory";
import TranscriptionViewer from "@/components/TranscriptionViewer";
import { History, Mic, ArrowLeft } from "lucide-react";

const ACCEPTED_AUDIO_TYPES = ".mp3,.wav,.ogg,.m4a,.webm,.flac,.mp4,.aac";

export default function AudioPage() {
  const [userName, setUserName] = useState("");
  const [token, setToken] = useState("");
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Transcription state
  const [transcriptions, setTranscriptions] = useState<TranscriptionMeta[]>([]);
  const [transcriptionsCount, setTranscriptionsCount] = useState(0);
  const [maxTranscriptions, setMaxTranscriptions] = useState(50);
  const [selectedTranscription, setSelectedTranscription] = useState<TranscriptionFull | null>(null);
  const [isLoadingTranscription, setIsLoadingTranscription] = useState(false);

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [progress, setProgress] = useState<TranscribeAndSaveProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const storedToken = localStorage.getItem("sgc_token");
    const user = localStorage.getItem("sgc_user");

    if (!storedToken) {
      router.replace("/");
      return;
    }

    setToken(storedToken);
    setUserName(user || "Пользователь");
    loadTranscriptions(storedToken);
    setIsInitializing(false);
  }, [router]);

  const loadTranscriptions = async (authToken: string) => {
    try {
      const data = await getTranscriptions(authToken);
      setTranscriptions(data.transcriptions);
      setTranscriptionsCount(data.count);
      setMaxTranscriptions(data.max_allowed);
    } catch (err) {
      console.error("Failed to load transcriptions:", err);
    }
  };

  const handleSelectTranscription = async (id: string) => {
    setIsLoadingTranscription(true);
    setIsSidebarOpen(false);
    try {
      const full = await getTranscription(token, id);
      setSelectedTranscription(full);
    } catch (err) {
      console.error("Failed to load transcription:", err);
      setError("Не удалось загрузить транскрипцию");
    } finally {
      setIsLoadingTranscription(false);
    }
  };

  const handleDeleteTranscription = async (id: string) => {
    try {
      await deleteTranscription(token, id);
      setTranscriptions((prev) => prev.filter((t) => t.id !== id));
      setTranscriptionsCount((prev) => prev - 1);
      if (selectedTranscription?.id === id) {
        setSelectedTranscription(null);
      }
    } catch (err) {
      console.error("Failed to delete transcription:", err);
      throw err;
    }
  };

  const handleRenameTranscription = async (id: string, title: string) => {
    try {
      await updateTranscriptionTitle(token, id, title);
      setTranscriptions((prev) =>
        prev.map((t) => (t.id === id ? { ...t, title } : t))
      );
      if (selectedTranscription?.id === id) {
        setSelectedTranscription({ ...selectedTranscription, title });
      }
    } catch (err) {
      console.error("Failed to rename transcription:", err);
      throw err;
    }
  };

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
      const result = await transcribeAndSaveAudio(token, selectedFile, (p) => {
        setProgress(p);
      });

      if (result.transcription_id) {
        // Reload transcriptions list
        await loadTranscriptions(token);
        // Load the new transcription
        await handleSelectTranscription(result.transcription_id);
        // Clear upload state
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неизвестная ошибка");
    } finally {
      setIsTranscribing(false);
      setProgress(null);
    }
  };

  const handleClearUpload = () => {
    setSelectedFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleGoToChat = (text: string) => {
    // Store the text in sessionStorage for chat page to pick up
    sessionStorage.setItem("transcription_context", text);
    router.push("/chat");
  };

  const handleDownloadDocx = async (transcription: TranscriptionFull) => {
    try {
      const blob = await exportAsDocx(
        token,
        "Транскрипция аудиозаписи",
        transcription.text,
        "transcription"
      );
      const date = new Date(transcription.created_at).toISOString().split("T")[0];
      const filename = transcription.title.replace(/[^a-zA-Zа-яА-ЯёЁ0-9\s]/g, "").trim() || "transcription";
      downloadBlob(blob, `${filename}-${date}.docx`);
    } catch (err) {
      console.error("Export error:", err);
      alert("Ошибка при экспорте. Попробуйте скопировать текст.");
    }
  };

  const handleDownloadTxt = (transcription: TranscriptionFull) => {
    const blob = new Blob([transcription.text], { type: "text/plain;charset=utf-8" });
    const date = new Date(transcription.created_at).toISOString().split("T")[0];
    const filename = transcription.title.replace(/[^a-zA-Zа-яА-ЯёЁ0-9\s]/g, "").trim() || "transcription";
    downloadBlob(blob, `${filename}-${date}.txt`);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} КБ`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  };

  const formatProgress = (value: number): string => {
    if (value === undefined || value === null || isNaN(value)) {
      return "0%";
    }
    return `${Math.round(value * 100)}%`;
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-sgc-orange border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="bg-sgc-blue-800 border-b border-sgc-blue-500 px-4 py-3">
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/chat")}
                className="text-gray-400 hover:text-white p-2 hover:bg-sgc-blue-700 rounded-lg transition-colors"
                title="Назад к чату"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-sgc-orange/20 rounded-lg flex items-center justify-center">
                  <Mic size={18} className="text-sgc-orange" />
                </div>
                <div>
                  <h1 className="text-white font-semibold">Аудио транскрипции</h1>
                  <p className="text-gray-500 text-xs">Транскрибация записей</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Mobile History Button */}
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="md:hidden p-2 text-gray-400 hover:text-white hover:bg-sgc-blue-700 rounded-lg"
                title="История"
              >
                <History size={20} />
              </button>
              <span className="text-gray-400 text-sm hidden sm:block">{userName}</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Upload Section */}
            <div className="bg-sgc-blue-800 rounded-xl p-6">
              <h2 className="text-white text-lg font-semibold mb-4">
                Загрузить аудио
              </h2>
              <p className="text-gray-400 text-sm mb-4">
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
                    disabled={transcriptionsCount >= maxTranscriptions}
                    className="w-full py-8 border-2 border-dashed border-sgc-blue-400 rounded-lg hover:border-sgc-orange transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                  {transcriptionsCount >= maxTranscriptions && (
                    <p className="text-red-400 text-sm text-center">
                      Достигнут лимит транскрипций ({maxTranscriptions}). Удалите старые записи.
                    </p>
                  )}
                </div>
              )}

              {/* Selected File */}
              {selectedFile && !isTranscribing && (
                <div className="bg-sgc-blue-700 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-sgc-orange/20 rounded-lg flex items-center justify-center">
                      <Mic size={20} className="text-sgc-orange" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm truncate">{selectedFile.name}</p>
                      <p className="text-gray-400 text-xs">
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                    <button
                      onClick={handleClearUpload}
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
                  <div className="bg-sgc-blue-700 rounded-lg p-4 space-y-3">
                    {/* Progress bar */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-300">{progress.message}</span>
                        <span className="text-sgc-orange">
                          {formatProgress(progress.progress)}
                        </span>
                      </div>
                      <div className="h-2 bg-sgc-blue-900 rounded-full overflow-hidden">
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
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mt-4">
                  <p className="text-red-300 text-sm">{error}</p>
                  <button
                    onClick={handleClearUpload}
                    className="text-red-400 text-xs hover:text-red-300 mt-2"
                  >
                    Попробовать снова
                  </button>
                </div>
              )}

              {/* Footer */}
              <p className="text-gray-500 text-xs mt-4">
                Используется Gemini 3.0 Flash для транскрибации на русском языке.
              </p>
            </div>

            {/* Selected Transcription Viewer */}
            {isLoadingTranscription && (
              <div className="bg-sgc-blue-800 rounded-xl p-8 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-sgc-orange border-t-transparent" />
              </div>
            )}

            {selectedTranscription && !isLoadingTranscription && (
              <TranscriptionViewer
                transcription={selectedTranscription}
                token={token}
                onClose={() => setSelectedTranscription(null)}
                onGoToChat={handleGoToChat}
                onDownloadDocx={() => handleDownloadDocx(selectedTranscription)}
                onDownloadTxt={() => handleDownloadTxt(selectedTranscription)}
                onRename={(title) => handleRenameTranscription(selectedTranscription.id, title)}
                onDelete={() => handleDeleteTranscription(selectedTranscription.id)}
              />
            )}

            {/* Empty State */}
            {!selectedTranscription && !isLoadingTranscription && transcriptions.length === 0 && (
              <div className="bg-sgc-blue-800 rounded-xl p-8 text-center">
                <Mic size={48} className="mx-auto mb-4 text-gray-600" />
                <h3 className="text-white text-lg mb-2">Нет транскрипций</h3>
                <p className="text-gray-400 text-sm">
                  Загрузите аудио файл, чтобы начать
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* History Sidebar */}
      <TranscriptionHistory
        token={token}
        transcriptions={transcriptions}
        count={transcriptionsCount}
        maxAllowed={maxTranscriptions}
        selectedId={selectedTranscription?.id || null}
        onSelect={handleSelectTranscription}
        onDelete={handleDeleteTranscription}
        onRename={handleRenameTranscription}
        isOpen={isSidebarOpen}
        onToggle={setIsSidebarOpen}
        onRefresh={() => loadTranscriptions(token)}
      />
    </div>
  );
}
