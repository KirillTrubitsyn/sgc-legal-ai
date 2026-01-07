"use client";

import { useState, KeyboardEvent } from "react";

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [input, setInput] = useState("");

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
        placeholder="Введите ваш вопрос..."
        disabled={disabled}
        rows={1}
        className="flex-1 px-4 py-3 bg-sgc-blue-700 border border-sgc-blue-500 rounded-xl
                   text-white placeholder-gray-400 focus:outline-none focus:border-sgc-orange-500
                   resize-none disabled:opacity-50"
      />
      <button
        onClick={handleSend}
        disabled={!input.trim() || disabled}
        className="px-6 py-3 bg-sgc-orange-500 hover:bg-orange-600 disabled:bg-gray-600
                   rounded-xl font-semibold transition-colors disabled:cursor-not-allowed"
      >
        {disabled ? "..." : "->"}
      </button>
    </div>
  );
}
