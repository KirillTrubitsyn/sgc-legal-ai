"use client";

import { Zap, Brain, LucideIcon } from "lucide-react";

type QueryMode = "fast" | "thinking";

interface Props {
  mode: QueryMode;
  onModeChange: (mode: QueryMode) => void;
  disabled?: boolean;
}

export default function ModeToggle({ mode, onModeChange, disabled }: Props) {
  const modes: { id: QueryMode; name: string; icon: LucideIcon }[] = [
    { id: "fast", name: "Быстрый", icon: Zap },
    { id: "thinking", name: "Думающий", icon: Brain },
  ];

  const activeIndex = modes.findIndex((m) => m.id === mode);

  return (
    <div
      className={`relative flex bg-sgc-blue-700 rounded-lg p-0.5 sm:p-1 ${
        disabled ? "opacity-50 pointer-events-none" : ""
      }`}
    >
      {/* Sliding indicator */}
      <div
        className="absolute top-0.5 sm:top-1 bottom-0.5 sm:bottom-1 bg-sgc-orange-500 rounded-md transition-all duration-200 ease-out"
        style={{
          left: `calc(${activeIndex * 50}% + ${activeIndex === 0 ? "2px" : "0px"})`,
          width: "calc(50% - 4px)",
        }}
      />

      {modes.map((m) => {
        const Icon = m.icon;
        return (
          <button
            key={m.id}
            onClick={() => onModeChange(m.id)}
            disabled={disabled}
            className={`relative z-10 flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors duration-200 ${
              mode === m.id ? "text-white" : "text-gray-400"
            }`}
          >
            <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            {m.name}
          </button>
        );
      })}
    </div>
  );
}
