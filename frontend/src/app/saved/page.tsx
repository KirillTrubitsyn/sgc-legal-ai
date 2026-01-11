"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSavedResponses, deleteSavedResponse, SavedResponse, exportAsDocx, downloadBlob } from "@/lib/api";
import MarkdownText from "@/components/MarkdownText";

export default function SavedPage() {
  const [token, setToken] = useState("");
  const [responses, setResponses] = useState<SavedResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const router = useRouter();

  useEffect(() => {
    const storedToken = localStorage.getItem("sgc_token");
    if (!storedToken) {
      router.push("/");
      return;
    }

    setToken(storedToken);
    loadResponses(storedToken);
  }, [router]);

  const loadResponses = async (t: string) => {
    setLoading(true);
    try {
      const data = await getSavedResponses(t);
      setResponses(data);
    } catch (e) {
      console.error("Failed to load saved responses:", e);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Удалить этот ответ?")) return;

    try {
      await deleteSavedResponse(token, id);
      setResponses((prev) => prev.filter((r) => r.id !== id));
      setExpandedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (e) {
      console.error("Failed to delete:", e);
    }
  };

  const handleDownload = async (response: SavedResponse, e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloadingId(response.id);
    try {
      const blob = await exportAsDocx(token, response.question, response.answer, response.model);
      const timestamp = new Date(response.created_at).toISOString().slice(0, 10);
      downloadBlob(blob, `sgc-legal-${timestamp}.docx`);
    } catch (e) {
      console.error("Failed to download:", e);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleContinueChat = (response: SavedResponse, e: React.MouseEvent) => {
    e.stopPropagation();
    // Сохраняем контекст в localStorage для продолжения в чате
    const chatContext = {
      question: response.question,
      answer: response.answer,
      model: response.model,
    };
    localStorage.setItem("sgc_continue_chat", JSON.stringify(chatContext));
    router.push("/chat?continue=true");
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-sgc-blue-700 border-b border-sgc-blue-500 px-6 py-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <img
              src="/sgc-logo-horizontal.png"
              alt="SGC Legal AI"
              className="h-10"
            />
            <span className="text-gray-400">/ Сохранённые ответы</span>
          </div>
          <a
            href="/chat"
            className="text-gray-400 hover:text-white text-sm"
          >
            Назад в чат
          </a>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-4xl mx-auto">
          {loading ? (
            <div className="text-center text-gray-500 mt-20">
              Загрузка...
            </div>
          ) : responses.length === 0 ? (
            <div className="text-center text-gray-500 mt-20">
              <p className="text-lg mb-2">Нет сохранённых ответов</p>
              <p className="text-sm">
                Нажмите &quot;Сохранить&quot; на понравившемся ответе в чате
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {responses.map((response) => {
                const isExpanded = expandedIds.has(response.id);
                return (
                  <div
                    key={response.id}
                    className="bg-sgc-blue-700 rounded-lg overflow-hidden"
                  >
                    {/* Accordion Header - Always visible */}
                    <div
                      onClick={() => toggleExpand(response.id)}
                      className="bg-sgc-blue-600 px-4 py-3 cursor-pointer hover:bg-sgc-blue-550 transition-colors"
                    >
                      <div className="flex justify-between items-center gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {/* Chevron */}
                          <svg
                            className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          {/* Question preview */}
                          <p className="text-white truncate">
                            {response.question || "—"}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs text-gray-500">
                            {new Date(response.created_at).toLocaleDateString("ru-RU")}
                          </span>
                          {response.model && (
                            <span className="text-xs text-gray-500 hidden sm:inline">
                              {response.model.split("/").pop()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Accordion Content - Collapsible */}
                    {isExpanded && (
                      <>
                        {/* Question full */}
                        <div className="px-4 py-3 border-b border-sgc-blue-500">
                          <span className="text-xs text-gray-400 block mb-1">
                            Вопрос
                          </span>
                          <p className="text-white whitespace-pre-wrap">{response.question}</p>
                        </div>

                        {/* Answer */}
                        <div className="px-4 py-4">
                          <span className="text-xs text-gray-400 block mb-2">
                            Ответ
                          </span>
                          <div className="text-gray-100">
                            <MarkdownText content={response.answer} />
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="px-4 py-3 border-t border-sgc-blue-500 flex flex-wrap justify-between gap-3">
                          <button
                            onClick={(e) => handleContinueChat(response, e)}
                            className="text-sgc-orange hover:text-orange-300 text-sm font-medium flex items-center gap-1"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            Продолжить чат
                          </button>
                          <div className="flex gap-4">
                            <button
                              onClick={(e) => handleDownload(response, e)}
                              disabled={downloadingId === response.id}
                              className="text-gray-400 hover:text-white text-sm"
                            >
                              {downloadingId === response.id ? "..." : "Скачать .docx"}
                            </button>
                            <button
                              onClick={(e) => handleDelete(response.id, e)}
                              className="text-red-400 hover:text-red-300 text-sm"
                            >
                              Удалить
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
