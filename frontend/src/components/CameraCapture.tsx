"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface Props {
  onCapture: (file: File) => void;
  disabled?: boolean;
  maxPhotos?: number;
  currentPhotoCount?: number;
}

export default function CameraCapture({
  onCapture,
  disabled,
  maxPhotos = 5,
  currentPhotoCount = 0
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isLimitReached = currentPhotoCount >= maxPhotos;

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setError("Не удалось получить доступ к камере. Проверьте разрешения.");
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  const handleOpen = () => {
    if (disabled || isLimitReached) return;
    setIsOpen(true);
  };

  const handleClose = () => {
    stopCamera();
    setIsOpen(false);
    setError(null);
  };

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    // Устанавливаем размер canvas по размеру видео
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Рисуем кадр из видео на canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Конвертируем в blob и создаём File
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const timestamp = Date.now();
          const file = new File([blob], `photo_${timestamp}.jpg`, {
            type: "image/jpeg"
          });
          onCapture(file);
          handleClose();
        }
      },
      "image/jpeg",
      0.85
    );
  };

  const toggleCamera = async () => {
    stopCamera();
    setFacingMode(prev => prev === "environment" ? "user" : "environment");
  };

  // Переключение камеры при изменении facingMode
  useEffect(() => {
    if (isOpen && !stream) {
      startCamera();
    }
  }, [facingMode, isOpen, stream, startCamera]);

  return (
    <>
      {/* Кнопка открытия камеры */}
      <button
        onClick={handleOpen}
        disabled={disabled || isLimitReached}
        type="button"
        className={`
          p-3 rounded-xl transition-colors relative
          bg-sgc-blue-700 text-gray-300 hover:bg-sgc-blue-500
          ${(disabled || isLimitReached) ? "opacity-50 cursor-not-allowed" : ""}
        `}
        title={isLimitReached ? `Максимум ${maxPhotos} фото` : "Сделать фото документа"}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
          <circle cx="12" cy="13" r="4"></circle>
        </svg>
        {/* Счётчик фото */}
        {currentPhotoCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-sgc-orange-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
            {currentPhotoCount}
          </span>
        )}
      </button>

      {/* Модальное окно камеры */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          {/* Верхняя панель */}
          <div className="flex items-center justify-between p-4 bg-black/50">
            <button
              onClick={handleClose}
              className="text-white p-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <span className="text-white text-sm">
              Фото {currentPhotoCount + 1} из {maxPhotos}
            </span>
            <button
              onClick={toggleCamera}
              className="text-white p-2"
              title="Переключить камеру"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"></path>
                <path d="M13 5h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <polyline points="8 7 3 12 8 17"></polyline>
              </svg>
            </button>
          </div>

          {/* Область видео */}
          <div className="flex-1 relative overflow-hidden">
            {error ? (
              <div className="absolute inset-0 flex items-center justify-center text-white text-center p-4">
                <div>
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 text-red-500">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  <p>{error}</p>
                </div>
              </div>
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            )}
            {/* Рамка для документа */}
            <div className="absolute inset-8 border-2 border-white/30 rounded-lg pointer-events-none">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white rounded-br-lg" />
            </div>
          </div>

          {/* Нижняя панель с кнопкой съёмки */}
          <div className="p-6 bg-black/50 flex items-center justify-center">
            <button
              onClick={handleCapture}
              disabled={!stream || !!error}
              className={`
                w-16 h-16 rounded-full border-4 border-white
                flex items-center justify-center
                ${(!stream || error) ? "opacity-50" : "active:scale-95"}
                transition-transform
              `}
            >
              <div className="w-12 h-12 rounded-full bg-white" />
            </button>
          </div>

          {/* Скрытый canvas для захвата изображения */}
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}
    </>
  );
}
