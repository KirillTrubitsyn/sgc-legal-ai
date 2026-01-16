"use client";

import { useState, useEffect, KeyboardEvent } from "react";

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  initialValue?: string;
}

export default function ChatInput({
  onSend,
  disabled,
  placeholder = "Введите ваш вопрос...",
  initialValue = ""
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

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex gap-3">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={5}
        className="flex-1 px-4 py-3 bg-sgc-blue-700 border border-sgc-blue-500 rounded-xl
                   text-white placeholder-gray-400 focus:outline-none focus:border-sgc-orange-500
                   resize-none disabled:opacity-50"
      />
      <button
        onClick={() => handleSend()}
        disabled={!input.trim() || disabled}
        type="button"
        className="px-4 py-3 bg-sgc-orange-500 hover:bg-orange-600 disabled:bg-gray-600
                   rounded-xl font-semibold transition-colors disabled:cursor-not-allowed
                   flex items-center justify-center min-w-[52px]"
      >
        {disabled ? (
          <span className="animate-pulse">...</span>
        ) : (
          <svg className="pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        )}
      </button>
    </div>
  );
}
