"use client";

import { Model } from "@/lib/api";

interface Props {
  models: Model[];
  selected: string;
  onSelect: (modelId: string) => void;
  disabled?: boolean;
}

export default function ModelSelector({ models, selected, onSelect, disabled }: Props) {
  return (
    <div className={`flex gap-2 flex-wrap ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      {models.map((model) => (
        <button
          key={model.id}
          onClick={() => onSelect(model.id)}
          disabled={disabled}
          className={`px-4 py-2 rounded-lg text-sm transition-colors ${
            selected === model.id
              ? "bg-sgc-orange-500 text-white"
              : "bg-sgc-blue-700 text-gray-300 hover:bg-sgc-blue-500"
          }`}
          title={model.description}
        >
          {model.name}
        </button>
      ))}
    </div>
  );
}
