"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { uploadFile, FileUploadResult } from "@/lib/api";

interface PhotoItem {
  file: File;
  preview: string;
  result?: FileUploadResult;
  isProcessing?: boolean;
  error?: string;
}

interface Props {
  token: string;
  onFileProcessed: (result: FileUploadResult) => void;
  onPhotoCapture: (file: File) => void;
  onVoiceTranscript: (text: string) => void;
  disabled?: boolean;
  maxPhotos?: number;
  currentPhotoCount?: number;
}

// File types
const ACCEPTED_TYPES = [
  ".docx", ".doc", ".pdf", ".txt", ".md",
  ".xlsx", ".xls", ".xlsm",
  ".jpg", ".jpeg", ".png", ".gif", ".bmp",
  ".mp3", ".wav", ".ogg", ".m4a", ".webm"
].join(",");

// Speech Recognition types
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event & { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

export default function MediaInput({
  token,
  onFileProcessed,
  onPhotoCapture,
  onVoiceTranscript,
  disabled,
  maxPhotos = 5,
  currentPhotoCount = 0
}: Props) {
  // Menu state
  const [showMenu, setShowMenu] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Camera state
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Voice state
  const [isRecording, setIsRecording] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const isPhotoLimitReached = currentPhotoCount >= maxPhotos;

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      setVoiceSupported(true);
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "ru-RU";

      recognition.onstart = () => {
        console.log("Voice recording started");
        setIsRecording(true);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = "";
        let interimText = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimText += result[0].transcript;
          }
        }

        if (finalTranscript) {
          onVoiceTranscript(finalTranscript);
          setInterimTranscript("");
        } else {
          setInterimTranscript(interimText);
        }
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsRecording(false);
        setInterimTranscript("");
      };

      recognition.onend = () => {
        console.log("Voice recording ended");
        setIsRecording(false);
        setInterimTranscript("");
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [onVoiceTranscript]);

  // File upload handler
  const handleFileSelect = async (file: File) => {
    if (!file || disabled) return;

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

  // Camera functions
  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      setCameraReady(false);

      // Stop existing stream
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      setCameraStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        // Wait for video to be ready
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play()
            .then(() => {
              setCameraReady(true);
            })
            .catch((err) => {
              console.error("Video play error:", err);
              setCameraError("Не удалось запустить видео");
            });
        };
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setCameraError("Не удалось получить доступ к камере. Проверьте разрешения.");
    }
  }, [facingMode, cameraStream]);

  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setCameraReady(false);
  }, [cameraStream]);

  const openCamera = () => {
    if (isPhotoLimitReached) {
      alert(`Максимум ${maxPhotos} фото в чате`);
      return;
    }
    setShowMenu(false);
    setShowCamera(true);
    // Start camera after state update
    setTimeout(() => startCamera(), 100);
  };

  const closeCamera = () => {
    stopCamera();
    setShowCamera(false);
    setCameraError(null);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current || !cameraReady) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `photo_${Date.now()}.jpg`, {
            type: "image/jpeg"
          });
          onPhotoCapture(file);
          closeCamera();
        }
      },
      "image/jpeg",
      0.85
    );
  };

  const switchCamera = () => {
    stopCamera();
    setFacingMode(prev => prev === "environment" ? "user" : "environment");
    setTimeout(() => startCamera(), 100);
  };

  // Voice functions
  const toggleVoice = () => {
    if (!recognitionRef.current || disabled) return;

    setShowMenu(false);

    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error("Failed to start voice:", err);
        // Might already be running, try to stop and restart
        try {
          recognitionRef.current.stop();
          setTimeout(() => {
            recognitionRef.current?.start();
          }, 100);
        } catch (e) {
          console.error("Voice restart failed:", e);
        }
      }
    }
  };

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMenu]);

  return (
    <>
      <div className="relative" ref={menuRef}>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          className="hidden"
          disabled={disabled || isUploading}
        />

        {/* Main button */}
        <button
          onClick={() => !disabled && !isUploading && setShowMenu(!showMenu)}
          disabled={disabled || isUploading}
          type="button"
          className={`
            p-3 rounded-xl transition-colors relative
            ${isRecording
              ? "bg-red-500 text-white animate-pulse"
              : "bg-sgc-blue-700 text-gray-300 hover:bg-sgc-blue-500"
            }
            ${(disabled || isUploading) ? "opacity-50 cursor-not-allowed" : ""}
          `}
          title="Прикрепить"
        >
          {isUploading ? (
            <span className="animate-pulse">...</span>
          ) : isRecording ? (
            // Stop icon when recording
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            // Paperclip icon
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
            </svg>
          )}

          {/* Photo counter badge */}
          {currentPhotoCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-sgc-orange-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
              {currentPhotoCount}
            </span>
          )}
        </button>

        {/* Stop recording button (shown when recording) */}
        {isRecording && (
          <button
            onClick={toggleVoice}
            type="button"
            className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1 bg-red-500 text-white text-xs rounded-full whitespace-nowrap"
          >
            Остановить запись
          </button>
        )}

        {/* Interim transcript */}
        {interimTranscript && (
          <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-sgc-blue-700 border border-sgc-blue-500 rounded-lg text-sm text-gray-300 max-w-[250px] truncate">
            {interimTranscript}
          </div>
        )}

        {/* Menu */}
        {showMenu && !isRecording && (
          <div className="absolute bottom-full left-0 mb-2 bg-sgc-blue-700 border border-sgc-blue-500 rounded-lg shadow-lg py-1 min-w-[200px] z-50">
            {/* File upload */}
            <button
              onClick={() => {
                setShowMenu(false);
                fileInputRef.current?.click();
              }}
              className="w-full px-4 py-3 text-left text-sm text-gray-200 hover:bg-sgc-blue-500 flex items-center gap-3"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              Загрузить файл
            </button>

            {/* Camera (mobile only) */}
            <button
              onClick={openCamera}
              disabled={isPhotoLimitReached}
              className={`w-full px-4 py-3 text-left text-sm text-gray-200 hover:bg-sgc-blue-500 flex items-center gap-3 md:hidden ${isPhotoLimitReached ? "opacity-50" : ""}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                <circle cx="12" cy="13" r="4"></circle>
              </svg>
              <span className="flex-1">Сделать фото</span>
              {currentPhotoCount > 0 && (
                <span className="text-xs text-gray-400">{currentPhotoCount}/{maxPhotos}</span>
              )}
            </button>

            {/* Voice input (mobile only) */}
            {voiceSupported && (
              <button
                onClick={toggleVoice}
                className="w-full px-4 py-3 text-left text-sm text-gray-200 hover:bg-sgc-blue-500 flex items-center gap-3 md:hidden"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                  <line x1="12" y1="19" x2="12" y2="23"></line>
                  <line x1="8" y1="23" x2="16" y2="23"></line>
                </svg>
                Голосовой ввод
              </button>
            )}

            {/* Info */}
            <div className="px-4 py-2 text-xs text-gray-500 border-t border-sgc-blue-500">
              DOCX, PDF, Excel, TXT, изображения, аудио
            </div>
          </div>
        )}
      </div>

      {/* Camera fullscreen modal */}
      {showCamera && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          {/* Top bar */}
          <div className="flex items-center justify-between p-4 bg-black/50 z-10">
            <button onClick={closeCamera} className="text-white p-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <span className="text-white text-sm">
              Фото {currentPhotoCount + 1} из {maxPhotos}
            </span>
            <button onClick={switchCamera} className="text-white p-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"></path>
                <path d="M13 5h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <polyline points="8 7 3 12 8 17"></polyline>
              </svg>
            </button>
          </div>

          {/* Video area */}
          <div className="flex-1 relative overflow-hidden">
            {cameraError ? (
              <div className="absolute inset-0 flex items-center justify-center text-white text-center p-4">
                <div>
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mx-auto mb-4 text-red-500">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  <p>{cameraError}</p>
                  <button
                    onClick={startCamera}
                    className="mt-4 px-4 py-2 bg-sgc-orange-500 rounded-lg"
                  >
                    Попробовать снова
                  </button>
                </div>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {!cameraReady && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black">
                    <div className="text-white text-center">
                      <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      <p>Загрузка камеры...</p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Document frame */}
            <div className="absolute inset-8 border-2 border-white/30 rounded-lg pointer-events-none">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white rounded-br-lg" />
            </div>
          </div>

          {/* Capture button */}
          <div className="p-6 bg-black/50 flex items-center justify-center">
            <button
              onClick={capturePhoto}
              disabled={!cameraReady || !!cameraError}
              className={`
                w-16 h-16 rounded-full border-4 border-white
                flex items-center justify-center
                ${(!cameraReady || cameraError) ? "opacity-50" : "active:scale-95"}
                transition-transform
              `}
            >
              <div className="w-12 h-12 rounded-full bg-white" />
            </button>
          </div>

          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}
    </>
  );
}
