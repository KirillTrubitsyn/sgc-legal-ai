"use client";

interface Props {
  mode: "single" | "consilium";
  onModeChange: (mode: "single" | "consilium") => void;
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
    </div>
  );
}
