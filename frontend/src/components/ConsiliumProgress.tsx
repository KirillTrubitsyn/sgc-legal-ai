"use client";

interface Props {
  currentStage: string;
  message: string;
}

const STAGES = [
  { id: "stage_1", name: "Сбор мнений", icon: "1" },
  { id: "stage_2", name: "Анализ", icon: "2" },
  { id: "stage_3", name: "Синтез", icon: "3" },
];

export default function ConsiliumProgress({ currentStage, message }: Props) {
  // Calculate current index based on stage
  // "starting" = before stage_1 (index -1, but show stage_1 as active)
  // "heartbeat" = keep current stage active (don't change highlighting)
  // "stage_N" = that stage is active
  const getCurrentIndex = (): number => {
    if (currentStage === "starting") {
      return 0; // Show first stage as active when starting
    }

    const foundIndex = STAGES.findIndex((s) => s.id === currentStage);
    if (foundIndex !== -1) {
      return foundIndex;
    }

    // For heartbeat or unknown stages, keep the last known stage highlighted
    // by parsing stage number from currentStage if possible
    const stageMatch = currentStage.match(/stage_(\d+)/);
    if (stageMatch) {
      return Math.min(parseInt(stageMatch[1]) - 1, STAGES.length - 1);
    }

    return 0; // Default to first stage
  };

  const currentIndex = getCurrentIndex();

  return (
    <div className="bg-sgc-blue-700 rounded-xl p-6 mb-4">
      <h3 className="text-lg font-semibold mb-4 text-sgc-orange-500">
        Консилиум в процессе
      </h3>

      <div className="flex justify-between mb-4">
        {STAGES.map((stage, index) => (
          <div
            key={stage.id}
            className={`flex flex-col items-center flex-1 ${
              index <= currentIndex ? "text-white" : "text-gray-500"
            }`}
          >
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center text-lg mb-2 transition-colors ${
                index < currentIndex
                  ? "bg-green-600"
                  : index === currentIndex
                  ? "bg-sgc-orange-500 animate-pulse"
                  : "bg-sgc-blue-500"
              }`}
            >
              {index < currentIndex ? "✓" : stage.icon}
            </div>
            <span className="text-sm text-center">{stage.name}</span>
          </div>
        ))}
      </div>

      <div className="text-center text-gray-300 mt-4">
        <span className="animate-pulse">...</span> {typeof message === 'string' ? message : JSON.stringify(message)}
      </div>

      <div className="mt-3 text-xs text-gray-500 text-center">
        Не сворачивайте приложение до завершения
      </div>
    </div>
  );
}
