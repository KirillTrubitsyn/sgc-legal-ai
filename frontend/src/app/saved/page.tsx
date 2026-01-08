"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSavedResponses, deleteSavedResponse, SavedResponse } from "@/lib/api";

export default function SavedPage() {
  const [token, setToken] = useState("");
  const [responses, setResponses] = useState<SavedResponse[]>([]);
  const [loading, setLoading] = useState(true);
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

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить этот ответ?")) return;

    try {
      await deleteSavedResponse(token, id);
      setResponses((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      console.error("Failed to delete:", e);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-sgc-blue-700 border-b border-sgc-blue-500 px-6 py-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">
              <span className="text-sgc-orange-500">SGC</span> Legal AI
            </h1>
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
            <div className="space-y-6">
              {responses.map((response) => (
                <div
                  key={response.id}
                  className="bg-sgc-blue-700 rounded-lg overflow-hidden"
                >
                  {/* Question */}
                  <div className="bg-sgc-blue-600 px-4 py-3 border-b border-sgc-blue-500">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <span className="text-xs text-gray-400 block mb-1">
                          Вопрос
                        </span>
                        <p className="text-white">{response.question || "—"}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs text-gray-500">
                          {new Date(response.created_at).toLocaleDateString("ru-RU")}
                        </span>
                        {response.model && (
                          <span className="text-xs text-gray-500 block">
                            {response.model.split("/").pop()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Answer */}
                  <div className="px-4 py-4">
                    <span className="text-xs text-gray-400 block mb-2">
                      Ответ
                    </span>
                    <div className="text-gray-100 whitespace-pre-wrap">
                      {response.answer}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="px-4 py-3 border-t border-sgc-blue-500 flex justify-end">
                    <button
                      onClick={() => handleDelete(response.id)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
