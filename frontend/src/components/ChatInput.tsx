"use client";

import { useState, useEffect, ReactNode } from "react";

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  initialValue?: string;
  leftContent?: ReactNode;
}

export default function ChatInput({
  onSend,
  disabled,
  placeholder = "Введите ваш вопрос...",
  initialValue = "",
  leftContent
}: Props) {
  const [input, setInput] = useState(initialValue);

  // Обновить input когда initialValue меняется
  useEffect(() => {
    if (initialValue && initialValue !== input) {
      setInput(initialValue);
    }
  }, [initialValue]);

  const handleSend = () => {
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput("");
    }
  };

  return (
    <div className="flex items-end gap-2 sm:gap-3 bg-sgc-blue-700 border border-sgc-blue-500 rounded-xl p-2 sm:p-3 focus-within:border-sgc-orange-500 transition-colors">
      {/* Left content (media input button) */}
      {leftContent && (
        <div className="flex-shrink-0 pb-1">
          {leftContent}
        </div>
      )}

      {/* Text input */}
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={2}
        className="flex-1 bg-transparent text-white placeholder-gray-400 focus:outline-none
                   resize-none disabled:opacity-50 text-sm sm:text-base min-h-[2.5rem] sm:min-h-[3rem]"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
      />

      {/* Send button */}
      <button
        onClick={() => handleSend()}
        disabled={!input.trim() || disabled}
        type="button"
        className="flex-shrink-0 p-2 sm:p-3 bg-sgc-orange-500 hover:bg-orange-600 disabled:bg-gray-600
                   rounded-lg sm:rounded-xl font-semibold transition-colors disabled:cursor-not-allowed
                   flex items-center justify-center"
      >
        {disabled ? (
          <span className="animate-pulse text-sm">...</span>
        ) : (
          <svg className="pointer-events-none w-5 h-5 sm:w-6 sm:h-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        )}
      </button>
    </div>
  );
}
