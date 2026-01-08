"use client";

import { useState, useEffect, KeyboardEvent, useRef } from "react";

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  initialValue?: string;
}

// Extend Window interface for SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

export default function ChatInput({
  onSend,
  disabled,
  placeholder = "Введите ваш вопрос...",
  initialValue = ""
}: Props) {
  const [input, setInput] = useState(initialValue);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Check for speech recognition support
  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "ru-RU";

      recognition.onresult = (event) => {
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          }
        }

        if (finalTranscript) {
          setInput((prev) => prev + finalTranscript);
        }
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Update input when initialValue changes
  useEffect(() => {
    if (initialValue && initialValue !== input) {
      setInput(initialValue);
    }
  }, [initialValue]);

  const handleSend = () => {
    if (input.trim() && !disabled) {
      // Stop listening when sending
      if (isListening && recognitionRef.current) {
        recognitionRef.current.stop();
        setIsListening(false);
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

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error("Failed to start speech recognition:", e);
      }
    }
  };

  return (
    <div className="flex gap-2 sm:gap-3">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={isListening ? "Говорите..." : placeholder}
        disabled={disabled}
        rows={Math.min(5, Math.max(1, input.split('\n').length))}
        className={`flex-1 px-4 py-3 bg-sgc-blue-700 border rounded-xl
                   text-white placeholder-gray-400 focus:outline-none focus:border-sgc-orange-500
                   resize-none disabled:opacity-50 ${
                     isListening ? "border-red-500" : "border-sgc-blue-500"
                   }`}
      />
      {speechSupported && (
        <button
          onClick={toggleListening}
          disabled={disabled}
          type="button"
          className={`px-3 sm:px-4 py-3 rounded-xl font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
            isListening
              ? "bg-red-500 hover:bg-red-600 animate-pulse"
              : "bg-sgc-blue-600 hover:bg-sgc-blue-500"
          }`}
          title={isListening ? "Остановить запись" : "Голосовой ввод"}
        >
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
        </button>
      )}
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
