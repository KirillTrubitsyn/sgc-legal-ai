"use client";

import { MessageSquare, Users } from "lucide-react";

interface Props {
  mode: "single" | "consilium";
  onModeChange: (mode: "single" | "consilium") => void;
}

export default function ModeSelector({ mode, onModeChange }: Props) {
  return (
    <div className="relative flex bg-sgc-blue-700 rounded-lg p-0.5 sm:p-1">
      {/* Sliding indicator */}
      <div
        className={`absolute top-0.5 sm:top-1 bottom-0.5 sm:bottom-1 bg-sgc-orange-500 rounded-md transition-all duration-200 ease-out ${
          mode === "consilium"
            ? "left-0.5 sm:left-1 w-[calc(50%-2px)] sm:w-[calc(50%-4px)]"
            : "left-[50%] w-[calc(50%-2px)] sm:w-[calc(50%-4px)]"
        }`}
      />

      <button
        onClick={() => onModeChange("consilium")}
        className={`relative z-10 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors duration-200 flex items-center gap-1 ${
          mode === "consilium" ? "text-white" : "text-gray-400"
        }`}
      >
        <Users size={14} className="hidden sm:inline" />
        Консилиум
      </button>
      <button
        onClick={() => onModeChange("single")}
        className={`relative z-10 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors duration-200 flex items-center gap-1 ${
          mode === "single" ? "text-white" : "text-gray-400"
        }`}
      >
        <MessageSquare size={14} />
        Запрос
      </button>
    </div>
  );
}
