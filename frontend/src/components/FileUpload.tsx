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
  const [showMenu, setShowMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleFileSelect = async (file: File) => {
    if (!file || disabled) return;

    // Проверка размера (25 МБ)
    if (file.size > 25 * 1024 * 1024) {
      alert("Файл слишком большой. Максимум: 25 МБ");
      return;
    }

    setIsUploading(true);
    setShowMenu(false);

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

  const handleButtonClick = () => {
    if (disabled || isUploading) return;
    setShowMenu(!showMenu);
  };

  const handleSelectFile = () => {
    setShowMenu(false);
    fileInputRef.current?.click();
  };

  // Закрыть меню при клике вне его
  const handleClickOutside = (e: React.MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      setShowMenu(false);
    }
  };

  return (
    <div className="relative" onClick={handleClickOutside}>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
        className="hidden"
        disabled={disabled || isUploading}
      />

      <button
        onClick={handleButtonClick}
        disabled={disabled || isUploading}
        type="button"
        className={`
          p-3 rounded-xl transition-colors
          bg-sgc-blue-700 text-gray-300 hover:bg-sgc-blue-500
          ${(disabled || isUploading) ? "opacity-50 cursor-not-allowed" : ""}
        `}
        title="Прикрепить файл"
      >
        {isUploading ? (
          <span className="animate-pulse">...</span>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
          </svg>
        )}
      </button>

      {/* Выпадающее меню */}
      {showMenu && (
        <div
          ref={menuRef}
          className="absolute bottom-full left-0 mb-2 bg-sgc-blue-700 border border-sgc-blue-500 rounded-lg shadow-lg py-1 min-w-[200px] z-50"
        >
          <button
            onClick={handleSelectFile}
            className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-sgc-blue-500 flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            Загрузить файл
          </button>
          <div className="px-4 py-2 text-xs text-gray-500 border-t border-sgc-blue-500">
            DOCX, PDF, TXT, изображения, аудио
          </div>
        </div>
      )}
    </div>
  );
}
