"use client";

import { useState, useEffect, ReactNode } from "react";

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  initialValue?: string;
  bottomLeftContent?: ReactNode;
  bottomRightContent?: ReactNode;
}

export default function ChatInput({
  onSend,
  disabled,
  placeholder = "Введите ваш вопрос...",
  initialValue = "",
  bottomLeftContent,
  bottomRightContent
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
    <div className="bg-sgc-blue-700 border border-sgc-blue-500 rounded-2xl focus-within:border-sgc-orange-500 transition-colors overflow-hidden">
      {/* Text input area */}
      <div className="px-4 pt-3 pb-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="w-full bg-transparent text-white placeholder-gray-400 focus:outline-none
                     resize-none disabled:opacity-50 text-base"
          style={{ minHeight: "1.5rem", maxHeight: "6rem" }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = "auto";
            target.style.height = Math.min(target.scrollHeight, 96) + "px";
          }}
        />
      </div>

      {/* Bottom bar with buttons */}
      <div className="flex items-center justify-between px-2 pb-2">
        {/* Left buttons */}
        <div className="flex items-center gap-1">
          {bottomLeftContent}
        </div>

        {/* Right side - send button */}
        <div className="flex items-center gap-1">
          {bottomRightContent}
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || disabled}
            type="button"
            className="p-2 bg-sgc-orange-500 hover:bg-orange-600 disabled:bg-gray-600
                       rounded-full font-semibold transition-colors disabled:cursor-not-allowed
                       flex items-center justify-center"
          >
            {disabled ? (
              <span className="animate-pulse text-sm px-1">...</span>
            ) : (
              <svg className="pointer-events-none w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
