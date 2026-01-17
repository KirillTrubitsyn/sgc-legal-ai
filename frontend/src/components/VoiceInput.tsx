"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  onTranscript: (text: string) => void;
  onRecordingStart?: () => void;
  onRecordingEnd?: () => void;
  disabled?: boolean;
}

// Типы для Web Speech API
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
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

export default function VoiceInput({
  onTranscript,
  onRecordingStart,
  onRecordingEnd,
  disabled
}: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    // Проверяем поддержку Web Speech API
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      setIsSupported(true);
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "ru-RU";

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
          onTranscript(finalTranscript);
          setInterimTranscript("");
        } else {
          setInterimTranscript(interimText);
        }
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsRecording(false);
        setInterimTranscript("");
        onRecordingEnd?.();
      };

      recognition.onend = () => {
        setIsRecording(false);
        setInterimTranscript("");
        onRecordingEnd?.();
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [onTranscript, onRecordingEnd]);

  const toggleRecording = () => {
    if (!recognitionRef.current || disabled) return;

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
      setInterimTranscript("");
      onRecordingEnd?.();
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
        onRecordingStart?.();
      } catch (err) {
        console.error("Failed to start recording:", err);
      }
    }
  };

  // Не показываем кнопку если API не поддерживается
  if (!isSupported) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={toggleRecording}
        disabled={disabled}
        type="button"
        className={`
          p-3 rounded-xl transition-all
          ${isRecording
            ? "bg-red-500 text-white animate-pulse"
            : "bg-sgc-blue-700 text-gray-300 hover:bg-sgc-blue-500"
          }
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        `}
        title={isRecording ? "Остановить запись" : "Голосовой ввод"}
      >
        {isRecording ? (
          // Иконка остановки
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          // Иконка микрофона
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
            <line x1="12" y1="19" x2="12" y2="23"></line>
            <line x1="8" y1="23" x2="16" y2="23"></line>
          </svg>
        )}
      </button>

      {/* Индикатор промежуточного текста */}
      {interimTranscript && (
        <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-sgc-blue-700 border border-sgc-blue-500 rounded-lg text-sm text-gray-300 whitespace-nowrap max-w-[200px] truncate">
          {interimTranscript}
        </div>
      )}
    </div>
  );
}
