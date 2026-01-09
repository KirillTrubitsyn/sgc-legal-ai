"use client";

import { useState } from "react";
import { exportAsDocx, downloadBlob } from "@/lib/api";
import MarkdownText from "./MarkdownText";

interface Props {
  role: "user" | "assistant";
  content: string;
  onSave?: () => void;
  question?: string;
  model?: string;
  token?: string;
}

export default function ChatMessage({ role, content, onSave, question, model, token }: Props) {
  const isUser = role === "user";
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleSave = async () => {
    if (!onSave || saved || saving) return;
    setSaving(true);
    try {
      await onSave();
      setSaved(true);
    } catch (e) {
      console.error("Failed to save:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    if (downloading || !token) return;
    // Используем content как вопрос если question не передан
    const questionText = question || "Юридический запрос";
    setDownloading(true);
    try {
      const blob = await exportAsDocx(token, questionText, content, model);
      const timestamp = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `sgc-legal-${timestamp}.docx`);
    } catch (e) {
      console.error("Failed to download:", e);
      alert("Ошибка при скачивании документа");
    } finally {
      setDownloading(false);
    }
  };

  const showActions = !isUser && (onSave || token);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4 group`}>
      <div
        className={`max-w-[80%] px-4 py-3 rounded-2xl ${
          isUser
            ? "bg-sgc-orange-500 text-white rounded-br-md"
            : "bg-sgc-blue-700 text-gray-100 rounded-bl-md"
        }`}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{content}</div>
        ) : (
          <MarkdownText content={content} />
        )}
        {showActions && (
          <div className="mt-2 pt-2 border-t border-gray-600/30 flex justify-end gap-2">
            {token && (
              <button
                onClick={handleDownload}
                disabled={downloading}
                type="button"
                className="text-xs px-3 py-1.5 rounded-lg transition-colors bg-sgc-blue-600 text-gray-200 hover:bg-sgc-blue-500 hover:text-white disabled:opacity-50"
              >
                {downloading ? "..." : "Скачать .docx"}
              </button>
            )}
            {onSave && (
              <button
                onClick={handleSave}
                disabled={saved || saving}
                className={`text-xs px-2 py-1 rounded transition-colors ${
                  saved
                    ? "text-green-400 cursor-default"
                    : "text-gray-400 hover:text-white hover:bg-gray-600/30"
                }`}
              >
                {saving ? "..." : saved ? "Сохранено" : "Сохранить"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
