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

  return (
    <div className={`flex gap-2 ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      {modes.map((m) => {
        const Icon = m.icon;
        return (
          <button
            key={m.id}
            onClick={() => onModeChange(m.id)}
            disabled={disabled}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition-colors ${
              mode === m.id
                ? "bg-sgc-orange-500 text-white"
                : "bg-sgc-blue-700 text-gray-300 hover:bg-sgc-blue-500"
            }`}
          >
            <Icon className="w-4 h-4" />
            {m.name}
          </button>
        );
      })}
    </div>
  );
}
