"use client";

import { useRef, useState } from "react";
import { uploadFile, FileUploadResult } from "@/lib/api";

interface Props {
  token: string;
  onFileProcessed: (result: FileUploadResult) => void;
  disabled?: boolean;
}

const ACCEPTED_TYPES = [
  ".docx", ".doc", ".pdf", ".txt", ".md",
  ".jpg", ".jpeg", ".png", ".gif", ".bmp",
  ".mp3", ".wav", ".ogg", ".m4a", ".webm"
].join(",");

export default function FileUpload({ token, onFileProcessed, disabled }: Props) {
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    if (!file || disabled) return;

    // Проверка размера (25 МБ)
    if (file.size > 25 * 1024 * 1024) {
      alert("Файл слишком большой. Максимум: 25 МБ");
      return;
    }

    setIsUploading(true);

    try {
      const result = await uploadFile(token, file);
      onFileProcessed(result);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Ошибка загрузки файла";
      alert(errorMessage);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
        className="hidden"
        disabled={disabled || isUploading}
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        disabled={disabled || isUploading}
        className={`
          p-3 rounded-xl transition-colors
          ${dragOver
            ? "bg-sgc-orange-500 text-white"
            : "bg-sgc-blue-700 text-gray-300 hover:bg-sgc-blue-500"
          }
          ${(disabled || isUploading) ? "opacity-50 cursor-not-allowed" : ""}
        `}
        title="Загрузить файл (DOCX, PDF, TXT, изображения, аудио)"
      >
        {isUploading ? (
          <span className="animate-pulse">...</span>
        ) : (
          <span>+</span>
        )}
      </button>
    </div>
  );
}
