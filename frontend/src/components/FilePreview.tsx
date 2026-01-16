"use client";

import { FileUploadResult } from "@/lib/api";

interface Props {
  file: FileUploadResult;
  onRemove: () => void;
}

const TYPE_ICONS: Record<string, string> = {
  document: "📄",
  pdf: "📕",
  spreadsheet: "📊",
  text: "📝",
  image: "🖼️",
  audio: "🎵",
};

export default function FilePreview({ file, onRemove }: Props) {
  const icon = TYPE_ICONS[file.file_type] || "📎";

  // Извлекаем имя файла из summary (формат: "Загружен PDF: filename.pdf | ...")
  const filename = file.summary.split("|")[0].replace(/^Загружен \w+:\s*/, "").trim();

  return (
    <div className="inline-flex items-center gap-2 bg-sgc-blue-600 rounded-lg px-3 py-1.5 text-sm">
      <span>{icon}</span>
      <span className="text-gray-300 max-w-[200px] truncate">{filename}</span>
      <button
        onClick={onRemove}
        className="text-gray-400 hover:text-red-400 ml-1"
        title="Удалить файл"
      >
        ✕
      </button>
    </div>
  );
}
