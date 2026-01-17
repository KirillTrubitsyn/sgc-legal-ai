"use client";

import { useState, useEffect } from "react";
import { FileUploadResult } from "@/lib/api";

interface PhotoItem {
  file: File;
  preview: string;
  result?: FileUploadResult;
  isProcessing?: boolean;
  error?: string;
}

interface Props {
  photos: PhotoItem[];
  onRemove: (index: number) => void;
  maxPhotos?: number;
}

export default function PhotoPreview({ photos, onRemove, maxPhotos = 5 }: Props) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Cleanup preview URLs when component unmounts
  useEffect(() => {
    return () => {
      photos.forEach(photo => {
        if (photo.preview) {
          URL.revokeObjectURL(photo.preview);
        }
      });
    };
  }, [photos]);

  if (photos.length === 0) {
    return null;
  }

  return (
    <div className="mb-2">
      {/* Заголовок с счётчиком */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400">
          Фото документов: {photos.length}/{maxPhotos}
        </span>
        {photos.some(p => p.isProcessing) && (
          <span className="text-xs text-sgc-orange-500 animate-pulse">
            Обработка...
          </span>
        )}
      </div>

      {/* Сетка превью */}
      <div className="flex gap-2 flex-wrap">
        {photos.map((photo, index) => (
          <div
            key={index}
            className="relative group"
          >
            {/* Превью изображения */}
            <button
              type="button"
              onClick={() => setSelectedIndex(index)}
              className={`
                w-16 h-16 rounded-lg overflow-hidden border-2 transition-all
                ${photo.error
                  ? "border-red-500"
                  : photo.result
                    ? "border-green-500"
                    : photo.isProcessing
                      ? "border-sgc-orange-500 animate-pulse"
                      : "border-sgc-blue-500"
                }
              `}
            >
              <img
                src={photo.preview}
                alt={`Фото ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </button>

            {/* Индикатор обработки */}
            {photo.isProcessing && (
              <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {/* Индикатор успеха */}
            {photo.result && !photo.isProcessing && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
            )}

            {/* Индикатор ошибки */}
            {photo.error && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </div>
            )}

            {/* Кнопка удаления */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(index);
              }}
              className="absolute -top-1 -left-1 w-5 h-5 bg-sgc-blue-700 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>

            {/* Номер фото */}
            <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs text-center py-0.5 rounded-b-lg">
              {index + 1}
            </div>
          </div>
        ))}
      </div>

      {/* Модальное окно для просмотра фото */}
      {selectedIndex !== null && photos[selectedIndex] && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedIndex(null)}
        >
          <div className="relative max-w-full max-h-full">
            <img
              src={photos[selectedIndex].preview}
              alt={`Фото ${selectedIndex + 1}`}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />

            {/* Информация о фото */}
            <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-3 rounded-b-lg">
              <div className="text-white text-sm">
                Фото {selectedIndex + 1} из {photos.length}
              </div>
              {photos[selectedIndex].result && (
                <div className="text-green-400 text-xs mt-1">
                  Текст распознан ({photos[selectedIndex].result?.extracted_text?.length ?? 0} символов)
                </div>
              )}
              {photos[selectedIndex].error && (
                <div className="text-red-400 text-xs mt-1">
                  Ошибка: {photos[selectedIndex].error}
                </div>
              )}
            </div>

            {/* Кнопка закрытия */}
            <button
              onClick={() => setSelectedIndex(null)}
              className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>

            {/* Навигация между фото */}
            {photos.length > 1 && (
              <>
                {selectedIndex > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedIndex(selectedIndex - 1);
                    }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                  </button>
                )}
                {selectedIndex < photos.length - 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedIndex(selectedIndex + 1);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
