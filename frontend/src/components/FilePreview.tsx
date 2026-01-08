"use client";

import { FileUploadResult } from "@/lib/api";

interface Props {
  file: FileUploadResult;
  onRemove: () => void;
  onUseText: () => void;
}

const TYPE_ICONS: Record<string, string> = {
  document: "[DOC]",
  pdf: "[PDF]",
  text: "[TXT]",
  image: "[IMG]",
  audio: "[AUD]",
};

export default function FilePreview({ file, onRemove, onUseText }: Props) {
  const icon = TYPE_ICONS[file.file_type] || "[FILE]";
  const previewText = file.extracted_text.slice(0, 200) +
    (file.extracted_text.length > 200 ? "..." : "");

  return (
    <div className="bg-sgc-blue-700 rounded-xl p-4 mb-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-sgc-orange-500">{icon}</span>
          <div>
            <div className="text-sm text-gray-300">{file.summary}</div>
          </div>
        </div>
        <button
          onClick={onRemove}
          className="text-gray-400 hover:text-red-400 text-lg"
          title="Удалить файл"
        >
          x
        </button>
      </div>

      <div className="bg-sgc-blue-500/50 rounded-lg p-3 mt-2">
        <div className="text-xs text-gray-400 mb-1">Извлечённый текст:</div>
        <div className="text-sm text-gray-300 whitespace-pre-wrap">
          {previewText}
        </div>
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={onUseText}
          className="px-4 py-2 bg-sgc-orange-500 hover:bg-orange-600 rounded-lg text-sm font-medium transition-colors"
        >
          Использовать текст в запросе
        </button>
      </div>
    </div>
  );
}
