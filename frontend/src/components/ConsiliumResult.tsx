"use client";

import { useState } from "react";
import { ConsiliumResult as ConsiliumResultType } from "@/lib/api";

interface Props {
  result: ConsiliumResultType;
}

export default function ConsiliumResult({ result }: Props) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="space-y-4">
      {/* Итоговый ответ */}
      <div className="bg-sgc-blue-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-3 text-sgc-orange-500">
          Итоговый ответ консилиума
        </h3>
        <div className="text-gray-100 whitespace-pre-wrap">
          {result.final_answer}
        </div>
      </div>

      {/* Верифицированная судебная практика */}
      {result.verified_cases.length > 0 && (
        <div className="bg-sgc-blue-700 rounded-xl p-4">
          <button
            onClick={() => toggleSection("cases")}
            className="w-full flex justify-between items-center text-left"
          >
            <h3 className="text-md font-semibold text-green-400">
              [V] Верифицированная судебная практика ({result.verified_cases.length})
            </h3>
            <span>{expandedSection === "cases" ? "v" : ">"}</span>
          </button>

          {expandedSection === "cases" && (
            <div className="mt-3 space-y-2">
              {result.verified_cases.map((c, i) => (
                <div key={i} className="bg-sgc-blue-500/50 rounded-lg p-3">
                  <div className="font-medium text-white">{c.case_number}</div>
                  <div className="text-sm text-gray-300">{c.court}</div>
                  <div className="text-sm text-gray-400 mt-1">{c.summary}</div>
                  <div className="text-xs text-green-400 mt-1">
                    Статус: {c.status}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Мнения экспертов */}
      <div className="bg-sgc-blue-700 rounded-xl p-4">
        <button
          onClick={() => toggleSection("opinions")}
          className="w-full flex justify-between items-center text-left"
        >
          <h3 className="text-md font-semibold text-gray-300">
            Мнения экспертов
          </h3>
          <span>{expandedSection === "opinions" ? "v" : ">"}</span>
        </button>

        {expandedSection === "opinions" && (
          <div className="mt-3 space-y-3">
            {Object.values(result.stages.stage_1).map((op, i) => (
              <div key={i} className="bg-sgc-blue-500/50 rounded-lg p-3">
                <div className="font-medium text-sgc-orange-500 mb-2">
                  {op.name}
                </div>
                <div className="text-sm text-gray-300 whitespace-pre-wrap">
                  {op.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Peer Review */}
      {result.stages.stage_4?.ranking && (
        <div className="bg-sgc-blue-700 rounded-xl p-4">
          <button
            onClick={() => toggleSection("reviews")}
            className="w-full flex justify-between items-center text-left"
          >
            <h3 className="text-md font-semibold text-gray-300">
              Рейтинг экспертов
            </h3>
            <span>{expandedSection === "reviews" ? "v" : ">"}</span>
          </button>

          {expandedSection === "reviews" && (
            <div className="mt-3">
              <div className="flex gap-2 flex-wrap">
                {result.stages.stage_4.ranking.map((name, i) => (
                  <span
                    key={i}
                    className={`px-3 py-1 rounded-full text-sm ${
                      i === 0
                        ? "bg-yellow-600 text-white"
                        : i === 1
                        ? "bg-gray-400 text-black"
                        : "bg-orange-700 text-white"
                    }`}
                  >
                    {i + 1}. {name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
