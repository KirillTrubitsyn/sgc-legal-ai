"use client";

import { useState } from "react";
import { exportAsDocx, downloadBlob } from "@/lib/api";

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
    if (!token || !question || downloading) return;
    setDownloading(true);
    try {
      const blob = await exportAsDocx(token, question, content, model);
      const timestamp = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `sgc-legal-${timestamp}.docx`);
    } catch (e) {
      console.error("Failed to download:", e);
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
        <div className="whitespace-pre-wrap">{content}</div>
        {showActions && (
          <div className="mt-2 pt-2 border-t border-gray-600/30 flex justify-end gap-2">
            {token && question && (
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="text-xs px-2 py-1 rounded transition-colors text-gray-400 hover:text-white hover:bg-gray-600/30"
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
