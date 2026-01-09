"use client";

import { useState } from "react";
import { CourtPracticeResult as CourtPracticeResultType } from "@/lib/api";

interface Props {
  result: CourtPracticeResultType;
}

export default function CourtPracticeResult({ result }: Props) {
  const [expandedSection, setExpandedSection] = useState<string | null>("cases");

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "VERIFIED":
        return "text-green-400";
      case "LIKELY_EXISTS":
        return "text-yellow-400";
      case "NOT_FOUND":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case "VERIFIED":
        return "[V]";
      case "LIKELY_EXISTS":
        return "[?]";
      case "NOT_FOUND":
        return "[X]";
      default:
        return "[?]";
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case "VERIFIED":
        return "Подтверждено";
      case "LIKELY_EXISTS":
        return "Вероятно существует";
      case "NOT_FOUND":
        return "Не найдено";
      default:
        return "Неизвестно";
    }
  };

  // Генерация ссылки на kad.arbitr.ru по номеру дела
  const generateKadArbitrLink = (caseNumber: string): string | null => {
    if (!caseNumber) return null;

    // Проверяем, что это арбитражное дело (начинается с А + цифра или апелляционное)
    const normalized = caseNumber.trim();

    // Паттерны арбитражных дел: А40-12345/2024, 20АП-7288/24, 13АП-12345/2023
    const isArbitrCase = /^[АA]\d{1,2}[-–]\d+\/\d{2,4}$/i.test(normalized) ||
                         /^\d{1,2}[АA][ПП][-–]\d+\/\d{2,4}$/i.test(normalized);

    if (isArbitrCase) {
      // Формируем ссылку для поиска в КАД
      return `https://kad.arbitr.ru/Card?number=${encodeURIComponent(normalized)}`;
    }

    return null;
  };

  const verifiedCases = result.verified_cases.filter(c => c.status === "VERIFIED");
  const likelyCases = result.verified_cases.filter(c => c.status === "LIKELY_EXISTS");
  const notFoundCases = result.verified_cases.filter(c => c.status === "NOT_FOUND");

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="bg-sgc-blue-700 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-sgc-orange-500">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          <h3 className="text-lg font-semibold text-sgc-orange-500">
            Поиск судебной практики
          </h3>
        </div>
        <div className="text-sm text-gray-400 mb-3">
          Запрос: {result.query}
        </div>
        <div className="text-gray-100">
          {result.summary}
        </div>

        {/* Stats */}
        <div className="flex gap-4 mt-3 text-sm">
          <span className="text-green-400">
            [V] Подтверждено: {verifiedCases.length}
          </span>
          <span className="text-yellow-400">
            [?] Вероятно: {likelyCases.length}
          </span>
          <span className="text-red-400">
            [X] Не найдено: {notFoundCases.length}
          </span>
        </div>
      </div>

      {/* Verified Cases */}
      {verifiedCases.length > 0 && (
        <div className="bg-sgc-blue-700 rounded-xl p-4">
          <button
            onClick={() => toggleSection("verified")}
            className="w-full flex justify-between items-center text-left"
          >
            <h3 className="text-md font-semibold text-green-400">
              [V] Верифицированные дела ({verifiedCases.length})
            </h3>
            <span className="text-gray-400">{expandedSection === "verified" ? "v" : ">"}</span>
          </button>

          {expandedSection === "verified" && (
            <div className="mt-3 space-y-2">
              {verifiedCases.map((c, i) => (
                <div key={i} className="bg-sgc-blue-500/50 rounded-lg p-3">
                  <div className="flex items-start justify-between">
                    <div className="font-medium text-white">{c.case_number}</div>
                    <span className="text-xs px-2 py-1 rounded bg-green-600/30 text-green-400">
                      {c.verification_source === "damia_api" ? "DaMIA API" : "Perplexity"}
                    </span>
                  </div>
                  {c.court && <div className="text-sm text-gray-300">{c.court}</div>}
                  {c.date && <div className="text-sm text-gray-400">{c.date}</div>}
                  {c.summary && <div className="text-sm text-gray-300 mt-2">{c.summary}</div>}

                  {/* DaMIA data if available */}
                  {c.verification?.actual_info && (
                    <div className="text-xs text-gray-400 mt-2 pt-2 border-t border-sgc-blue-500">
                      {c.verification.actual_info}
                    </div>
                  )}

                  {/* Links - от DaMIA или сгенерированные */}
                  {(() => {
                    const damiaLinks = c.verification?.links?.filter(Boolean) || [];
                    const generatedLink = damiaLinks.length === 0 ? generateKadArbitrLink(c.case_number) : null;

                    return (damiaLinks.length > 0 || generatedLink) && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {damiaLinks.map((link, j) => (
                          <a
                            key={j}
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-blue-600/30 text-blue-400 hover:bg-blue-600/50 hover:text-blue-300 transition-colors"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                              <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z" clipRule="evenodd" />
                              <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z" clipRule="evenodd" />
                            </svg>
                            kad.arbitr.ru
                          </a>
                        ))}
                        {generatedLink && (
                          <a
                            href={generatedLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-orange-600/30 text-orange-400 hover:bg-orange-600/50 hover:text-orange-300 transition-colors"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                              <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z" clipRule="evenodd" />
                              <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z" clipRule="evenodd" />
                            </svg>
                            Найти в КАД
                          </a>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Likely Exists Cases */}
      {likelyCases.length > 0 && (
        <div className="bg-sgc-blue-700 rounded-xl p-4">
          <button
            onClick={() => toggleSection("likely")}
            className="w-full flex justify-between items-center text-left"
          >
            <h3 className="text-md font-semibold text-yellow-400">
              [?] Вероятно существуют ({likelyCases.length})
            </h3>
            <span className="text-gray-400">{expandedSection === "likely" ? "v" : ">"}</span>
          </button>

          {expandedSection === "likely" && (
            <div className="mt-3 space-y-2">
              {likelyCases.map((c, i) => {
                const kadLink = generateKadArbitrLink(c.case_number);
                return (
                  <div key={i} className="bg-sgc-blue-500/50 rounded-lg p-3">
                    <div className="font-medium text-white">{c.case_number}</div>
                    {c.court && <div className="text-sm text-gray-300">{c.court}</div>}
                    {c.date && <div className="text-sm text-gray-400">{c.date}</div>}
                    {c.summary && <div className="text-sm text-gray-300 mt-2">{c.summary}</div>}
                    {c.verification?.actual_info && (
                      <div className="text-xs text-gray-400 mt-2">
                        {c.verification.actual_info}
                      </div>
                    )}
                    {kadLink && (
                      <div className="mt-2">
                        <a
                          href={kadLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-yellow-600/30 text-yellow-400 hover:bg-yellow-600/50 hover:text-yellow-300 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                            <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z" clipRule="evenodd" />
                            <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z" clipRule="evenodd" />
                          </svg>
                          Проверить в КАД
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Not Found Cases */}
      {notFoundCases.length > 0 && (
        <div className="bg-sgc-blue-700 rounded-xl p-4">
          <button
            onClick={() => toggleSection("notfound")}
            className="w-full flex justify-between items-center text-left"
          >
            <h3 className="text-md font-semibold text-red-400">
              [X] Не найдены ({notFoundCases.length})
            </h3>
            <span className="text-gray-400">{expandedSection === "notfound" ? "v" : ">"}</span>
          </button>

          {expandedSection === "notfound" && (
            <div className="mt-3 space-y-2">
              {notFoundCases.map((c, i) => (
                <div key={i} className="bg-sgc-blue-500/50 rounded-lg p-3 opacity-70">
                  <div className="font-medium text-gray-300">{c.case_number}</div>
                  {c.court && <div className="text-sm text-gray-400">{c.court}</div>}
                  <div className="text-xs text-red-400 mt-1">
                    Дело не найдено в базах данных
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Full Search Result */}
      <div className="bg-sgc-blue-700 rounded-xl p-4">
        <button
          onClick={() => toggleSection("fullresult")}
          className="w-full flex justify-between items-center text-left"
        >
          <h3 className="text-md font-semibold text-gray-300">
            Полные результаты поиска
          </h3>
          <span className="text-gray-400">{expandedSection === "fullresult" ? "v" : ">"}</span>
        </button>

        {expandedSection === "fullresult" && (
          <div className="mt-3 text-sm text-gray-300 whitespace-pre-wrap max-h-96 overflow-y-auto">
            {result.search_result}
          </div>
        )}
      </div>
    </div>
  );
}
