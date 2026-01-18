"use client";

interface Props {
  currentStage: string;
  message: string;
}

const STAGES = [
  { id: "classifying", name: "Анализ", icon: "🎯" },
  { id: "classified", name: "Режим", icon: "✅" },
  { id: "search", name: "Поиск", icon: "🔍" },
  { id: "search_complete", name: "Найдено", icon: "✅" },
  { id: "npa_verify", name: "НПА", icon: "📋" },
  { id: "npa_verify_complete", name: "НПА ✓", icon: "✅" },
  { id: "generating", name: "Ответ", icon: "📝" },
];

export default function CourtPracticeProgress({ currentStage, message }: Props) {
  // Handle error stages as completed variants
  const normalizedStage = currentStage === "classify_error" ? "classified"
    : currentStage === "search_error" ? "search_complete"
    : currentStage === "npa_verify_error" ? "npa_verify_complete"
    : currentStage;
  const currentIndex = STAGES.findIndex((s) => s.id === normalizedStage);
  const isError = currentStage === "classify_error" || currentStage === "search_error" || currentStage === "npa_verify_error";

  return (
    <div className="bg-sgc-blue-700 rounded-xl p-6 mb-4">
      <div className="flex items-center gap-2 mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-sgc-orange-500">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        <h3 className="text-lg font-semibold text-sgc-orange-500">
          Обработка запроса
        </h3>
      </div>

      <div className="flex justify-between mb-4">
        {STAGES.map((stage, index) => (
          <div
            key={stage.id}
            className={`flex flex-col items-center flex-1 ${
              index <= currentIndex ? "text-white" : "text-gray-500"
            }`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-lg mb-1 ${
                index < currentIndex
                  ? isError && index === 1 ? "bg-yellow-600" : "bg-green-600"
                  : index === currentIndex
                  ? "bg-sgc-orange-500 animate-pulse"
                  : "bg-sgc-blue-500"
              }`}
            >
              {index < currentIndex ? "✓" : stage.icon}
            </div>
            <span className="text-xs text-center">{stage.name}</span>
          </div>
        ))}
      </div>

      <div className="text-center text-gray-300">
        <span className="animate-pulse">...</span> {typeof message === 'string' ? message : JSON.stringify(message)}
      </div>

      <div className="mt-3 text-xs text-gray-500 text-center">
        Не сворачивайте приложение до завершения
      </div>
    </div>
  );
}
