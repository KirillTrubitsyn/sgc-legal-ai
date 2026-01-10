"use client";

type QueryMode = "fast" | "thinking";

interface Props {
  mode: QueryMode;
  onModeChange: (mode: QueryMode) => void;
  disabled?: boolean;
}

export default function ModeToggle({ mode, onModeChange, disabled }: Props) {
  const modes: { id: QueryMode; name: string; icon: string }[] = [
    { id: "fast", name: "Быстрый", icon: "⚡" },
    { id: "thinking", name: "Думающий", icon: "🧠" },
  ];

  return (
    <div className={`flex gap-2 ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      {modes.map((m) => (
        <button
          key={m.id}
          onClick={() => onModeChange(m.id)}
          disabled={disabled}
          className={`px-4 py-2 rounded-lg text-sm transition-colors ${
            mode === m.id
              ? "bg-sgc-orange-500 text-white"
              : "bg-sgc-blue-700 text-gray-300 hover:bg-sgc-blue-500"
          }`}
        >
          {m.icon} {m.name}
        </button>
      ))}
    </div>
  );
}
