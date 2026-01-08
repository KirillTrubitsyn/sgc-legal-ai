"use client";

interface Props {
  currentStage: string;
  message: string;
}

const STAGES = [
  { id: "stage_1", name: "Сбор мнений", icon: "1" },
  { id: "stage_2", name: "Извлечение практики", icon: "2" },
  { id: "stage_3", name: "Верификация", icon: "3" },
  { id: "stage_4", name: "Peer Review", icon: "4" },
  { id: "stage_5", name: "Синтез", icon: "5" },
];

export default function ConsiliumProgress({ currentStage, message }: Props) {
  // Handle "starting" stage as before stage_1
  const currentIndex = currentStage === "starting"
    ? -1
    : STAGES.findIndex((s) => s.id === currentStage);

  return (
    <div className="bg-sgc-blue-700 rounded-xl p-6 mb-4">
      <h3 className="text-lg font-semibold mb-4 text-sgc-orange-500">
        Consilium в процессе
      </h3>

      <div className="flex justify-between mb-4">
        {STAGES.map((stage, index) => (
          <div
            key={stage.id}
            className={`flex flex-col items-center ${
              index <= currentIndex ? "text-white" : "text-gray-500"
            }`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-lg mb-1 ${
                index < currentIndex
                  ? "bg-green-600"
                  : index === currentIndex
                  ? "bg-sgc-orange-500 animate-pulse"
                  : "bg-sgc-blue-500"
              }`}
            >
              {index < currentIndex ? "V" : stage.icon}
            </div>
            <span className="text-xs text-center">{stage.name}</span>
          </div>
        ))}
      </div>

      <div className="text-center text-gray-300">
        <span className="animate-pulse">...</span> {message}
      </div>
    </div>
  );
}
