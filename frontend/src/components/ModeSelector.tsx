"use client";

interface Props {
  mode: "single" | "consilium" | "google";
  onModeChange: (mode: "single" | "consilium" | "google") => void;
}

export default function ModeSelector({ mode, onModeChange }: Props) {
  return (
    <div className="flex gap-2">
      <button
        onClick={() => onModeChange("single")}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          mode === "single"
            ? "bg-sgc-orange-500 text-white"
            : "bg-sgc-blue-700 text-gray-300 hover:bg-sgc-blue-500"
        }`}
      >
        Single Query
      </button>
      <button
        onClick={() => onModeChange("consilium")}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          mode === "consilium"
            ? "bg-sgc-orange-500 text-white"
            : "bg-sgc-blue-700 text-gray-300 hover:bg-sgc-blue-500"
        }`}
      >
        Consilium
      </button>
      <button
        onClick={() => onModeChange("google")}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
          mode === "google"
            ? "bg-sgc-orange-500 text-white"
            : "bg-sgc-blue-700 text-gray-300 hover:bg-sgc-blue-500"
        }`}
        title="Поиск судебной практики через Google"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-4 h-4"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        Google
      </button>
    </div>
  );
}
