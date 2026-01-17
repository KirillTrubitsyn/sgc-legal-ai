"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { uploadFile, FileUploadResult } from "@/lib/api";

// === FILE BUTTON ===
interface FileButtonProps {
  token: string;
  onFileProcessed: (result: FileUploadResult) => void;
  disabled?: boolean;
}

const ACCEPTED_TYPES = [
  ".docx", ".doc", ".pdf", ".txt", ".md",
  ".xlsx", ".xls", ".xlsm",
  ".jpg", ".jpeg", ".png", ".gif", ".bmp",
  ".mp3", ".wav", ".ogg", ".m4a", ".webm"
].join(",");

export function FileButton({ token, onFileProcessed, disabled }: FileButtonProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    if (!file || disabled) return;
    if (file.size > 25 * 1024 * 1024) {
      alert("Файл слишком большой. Максимум: 25 МБ");
      return;
    }

    setIsUploading(true);
    try {
      const result = await uploadFile(token, file);
      onFileProcessed(result);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <>
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
        disabled={disabled || isUploading}
        type="button"
        className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-sgc-blue-500 transition-colors disabled:opacity-50"
        title="Загрузить файл"
      >
        {isUploading ? (
          <span className="animate-pulse text-xs">...</span>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
          </svg>
        )}
      </button>
    </>
  );
}

// === CAMERA BUTTON ===
interface CameraButtonProps {
  onCapture: (file: File) => void;
  disabled?: boolean;
  maxPhotos?: number;
  currentPhotoCount?: number;
}

export function CameraButton({ onCapture, disabled, maxPhotos = 5, currentPhotoCount = 0 }: CameraButtonProps) {
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isLimitReached = currentPhotoCount >= maxPhotos;

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      setReady(false);
      if (stream) stream.getTracks().forEach(t => t.stop());

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().then(() => setReady(true)).catch(() => setError("Не удалось запустить видео"));
        };
      }
    } catch {
      setError("Нет доступа к камере");
    }
  }, [facingMode, stream]);

  const stopCamera = useCallback(() => {
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
    setReady(false);
  }, [stream]);

  const openCamera = () => {
    if (isLimitReached) { alert(`Максимум ${maxPhotos} фото`); return; }
    setShowCamera(true);
    setTimeout(() => startCamera(), 100);
  };

  const closeCamera = () => { stopCamera(); setShowCamera(false); setError(null); };

  const capture = () => {
    if (!videoRef.current || !canvasRef.current || !ready) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) {
        onCapture(new File([blob], `photo_${Date.now()}.jpg`, { type: "image/jpeg" }));
        closeCamera();
      }
    }, "image/jpeg", 0.85);
  };

  const switchCam = () => { stopCamera(); setFacingMode(f => f === "environment" ? "user" : "environment"); setTimeout(() => startCamera(), 100); };

  return (
    <>
      <button
        onClick={openCamera}
        disabled={disabled || isLimitReached}
        type="button"
        className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-sgc-blue-500 transition-colors disabled:opacity-50 relative md:hidden"
        title="Сделать фото"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
          <circle cx="12" cy="13" r="4"></circle>
        </svg>
        {currentPhotoCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-sgc-orange-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center text-[10px]">
            {currentPhotoCount}
          </span>
        )}
      </button>

      {showCamera && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex items-center justify-between p-4">
            <button onClick={closeCamera} className="text-white p-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <span className="text-white text-sm">{currentPhotoCount + 1} / {maxPhotos}</span>
            <button onClick={switchCam} className="text-white p-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/><path d="M13 5h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5"/><polyline points="16 17 21 12 16 7"/><polyline points="8 7 3 12 8 17"/></svg>
            </button>
          </div>

          <div className="flex-1 relative">
            {error ? (
              <div className="absolute inset-0 flex items-center justify-center text-white text-center p-4">
                <div>
                  <p className="mb-4">{error}</p>
                  <button onClick={startCamera} className="px-4 py-2 bg-sgc-orange-500 rounded-lg">Повторить</button>
                </div>
              </div>
            ) : (
              <>
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                {!ready && <div className="absolute inset-0 flex items-center justify-center bg-black"><div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"/></div>}
              </>
            )}
          </div>

          {/* Capture button - with safe area for iPhone */}
          <div className="p-4 pb-8 flex justify-center bg-black/50">
            <button onClick={capture} disabled={!ready} className={`w-18 h-18 rounded-full border-4 border-white flex items-center justify-center ${!ready ? "opacity-50" : "active:scale-95"} transition-transform`} style={{ width: 72, height: 72 }}>
              <div className="w-14 h-14 rounded-full bg-white"/>
            </button>
          </div>
          <canvas ref={canvasRef} className="hidden"/>
        </div>
      )}
    </>
  );
}

// === VOICE BUTTON ===
interface VoiceButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList { length: number; [index: number]: SpeechRecognitionResult; }
interface SpeechRecognitionResult { isFinal: boolean; [index: number]: { transcript: string }; }
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: Event) => void) | null;
  onend: (() => void) | null;
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

export function VoiceButton({ onTranscript, disabled }: VoiceButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const API = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (API) {
      setSupported(true);
      const rec = new API();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "ru-RU";

      rec.onresult = (e: SpeechRecognitionEvent) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) {
            onTranscript(e.results[i][0].transcript);
          }
        }
      };
      rec.onerror = () => setIsRecording(false);
      rec.onend = () => setIsRecording(false);
      recognitionRef.current = rec;
    }
    return () => { recognitionRef.current?.abort(); };
  }, [onTranscript]);

  const toggle = () => {
    if (!recognitionRef.current || disabled) return;
    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      try { recognitionRef.current.start(); setIsRecording(true); }
      catch { recognitionRef.current.stop(); setTimeout(() => { recognitionRef.current?.start(); setIsRecording(true); }, 100); }
    }
  };

  if (!supported) return null;

  return (
    <button
      onClick={toggle}
      disabled={disabled}
      type="button"
      className={`p-2 rounded-full transition-colors md:hidden ${
        isRecording
          ? "bg-red-500 text-white animate-pulse"
          : "text-gray-400 hover:text-white hover:bg-sgc-blue-500"
      } disabled:opacity-50`}
      title={isRecording ? "Остановить" : "Голос"}
    >
      {isRecording ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" rx="2"/>
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
      )}
    </button>
  );
}
