"use client";

import { Search } from "lucide-react";

interface Props {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  disabled?: boolean;
}

export default function SearchToggle({ enabled, onToggle, disabled }: Props) {
  return (
    <button
      onClick={() => onToggle(!enabled)}
      disabled={disabled}
      className={`relative flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${
        enabled
          ? "bg-sgc-orange-500 text-white shadow-lg shadow-sgc-orange-500/30"
          : "bg-sgc-blue-700 text-gray-400 hover:text-gray-300"
      } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
      title={enabled ? "Поиск включён" : "Поиск выключен"}
    >
      <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      <span className="hidden sm:inline">Поиск</span>
    </button>
  );
}
