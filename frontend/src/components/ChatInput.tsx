"use client";

import { useState, useEffect, KeyboardEvent, useRef } from "react";
import { transcribeAudio } from "@/lib/api";

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  initialValue?: string;
  token?: string;
}

export default function ChatInput({
  onSend,
  disabled,
  placeholder = "Введите ваш вопрос...",
  initialValue = "",
  token
}: Props) {
  const [input, setInput] = useState(initialValue);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Update input when initialValue changes
  useEffect(() => {
    if (initialValue && initialValue !== input) {
      setInput(initialValue);
    }
  }, [initialValue]);

  const handleSend = () => {
    if (input.trim() && !disabled) {
      // Stop recording when sending
      if (isRecording && mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      }
      onSend(input.trim());
      setInput("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Try to use webm, fallback to mp4 for iOS
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "audio/wav";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());

        if (audioChunksRef.current.length === 0) return;

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

        // Get token from localStorage if not provided
        const authToken = token || localStorage.getItem("token");

        if (!authToken) {
          alert("Ошибка: не найден токен авторизации");
          return;
        }

        setIsTranscribing(true);
        try {
          const text = await transcribeAudio(authToken, audioBlob);
          if (text) {
            setInput((prev) => prev + (prev ? " " : "") + text);
          }
        } catch (error) {
          console.error("Transcription error:", error);
          alert("Ошибка транскрипции: " + (error instanceof Error ? error.message : "Неизвестная ошибка"));
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Failed to start recording:", error);
      alert("Не удалось запустить запись. Разрешите доступ к микрофону.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const isButtonDisabled = disabled || isTranscribing;
  const buttonState = isRecording ? "recording" : isTranscribing ? "transcribing" : "idle";

  return (
    <div className="flex gap-2 sm:gap-3">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          isRecording
            ? "Говорите..."
            : isTranscribing
            ? "Распознаю речь..."
            : placeholder
        }
        disabled={disabled}
        rows={Math.min(5, Math.max(1, input.split("\n").length))}
        className={`flex-1 px-4 py-3 bg-sgc-blue-700 border rounded-xl
                   text-white placeholder-gray-400 focus:outline-none focus:border-sgc-orange-500
                   resize-none disabled:opacity-50 ${
                     isRecording ? "border-red-500" : "border-sgc-blue-500"
                   }`}
      />
      <button
        onClick={toggleRecording}
        disabled={isButtonDisabled}
        type="button"
        className={`px-3 sm:px-4 py-3 rounded-xl font-semibold transition-all disabled:cursor-not-allowed ${
          buttonState === "recording"
            ? "bg-red-500 hover:bg-red-600 animate-pulse"
            : buttonState === "transcribing"
            ? "bg-yellow-500 animate-pulse opacity-70"
            : "bg-sgc-blue-600 hover:bg-sgc-blue-500"
        }`}
        title={
          isRecording
            ? "Остановить запись"
            : isTranscribing
            ? "Распознаю речь..."
            : "Голосовой ввод"
        }
      >
        {isTranscribing ? (
          <svg
            className="w-5 h-5 sm:w-6 sm:h-6 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-5 h-5 sm:w-6 sm:h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
            />
          </svg>
        )}
      </button>
      <button
        onClick={handleSend}
        disabled={!input.trim() || disabled}
        className="px-4 sm:px-6 py-3 bg-sgc-orange-500 hover:bg-orange-600 disabled:bg-gray-600
                   rounded-xl font-semibold transition-colors disabled:cursor-not-allowed"
      >
        {disabled ? "..." : "->"}
      </button>
    </div>
  );
}
