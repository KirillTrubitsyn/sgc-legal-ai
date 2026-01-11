"use client";

interface Props {
  mode: "single" | "consilium";
  onModeChange: (mode: "single" | "consilium") => void;
}

export default function ModeSelector({ mode, onModeChange }: Props) {
  return (
    <div className="flex gap-1 sm:gap-2">
      <button
        onClick={() => onModeChange("single")}
        className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
          mode === "single"
            ? "bg-sgc-orange-500 text-white"
            : "bg-sgc-blue-700 text-gray-300 hover:bg-sgc-blue-500"
        }`}
      >
        Запрос
      </button>
      <button
        onClick={() => onModeChange("consilium")}
        className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
          mode === "consilium"
            ? "bg-sgc-orange-500 text-white"
            : "bg-sgc-blue-700 text-gray-300 hover:bg-sgc-blue-500"
        }`}
      >
        Консилиум
      </button>
    </div>
  );
}
