"use client";

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
      className={`px-4 py-2 rounded-lg text-sm transition-colors ${
        enabled
          ? "bg-sgc-orange-500 text-white"
          : "bg-gray-600 text-gray-300 hover:bg-gray-500"
      } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
      title={enabled ? "Поиск включён" : "Поиск выключен"}
    >
      🔍 Поиск
    </button>
  );
}
