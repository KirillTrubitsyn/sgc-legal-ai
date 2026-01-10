"use client";

import { useState } from "react";
import { CourtPracticeCase } from "@/lib/api";

interface Props {
  cases: CourtPracticeCase[];
}

export default function VerifiedCasesDisplay({ cases }: Props) {
  const [isExpanded, setIsExpanded] = useState(true);

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

  // Generate link to court databases based on case number
  const generateCourtLink = (caseNumber: string): { url: string; label: string; color: string } | null => {
    if (!caseNumber) return null;

    const normalized = caseNumber.trim();

    // Arbitrazh cases: A40-12345/2024
    if (/^[АA]\d{1,2}[-–]\d+\/\d{2,4}$/i.test(normalized)) {
      return {
        url: `https://kad.arbitr.ru/Card?number=${encodeURIComponent(normalized)}`,
        label: "kad.arbitr.ru",
        color: "orange"
      };
    }

    // Appeal cases: 20AP-7288/24, 13AP-12345/2023
    if (/^\d{1,2}[АA][ПП][-–]\d+\/\d{2,4}$/i.test(normalized)) {
      return {
        url: `https://kad.arbitr.ru/Card?number=${encodeURIComponent(normalized)}`,
        label: "kad.arbitr.ru",
        color: "orange"
      };
    }

    // Supreme Court economic cases: 301-ES24-609
    if (/^\d{2,3}[-–][ЭЕ][СC]\d{2}[-–]\d+$/i.test(normalized)) {
      return {
        url: `https://www.google.com/search?q=${encodeURIComponent(normalized)}+site:consultant.ru+OR+site:garant.ru`,
        label: "Найти решение",
        color: "purple"
      };
    }

    // Supreme Court PEK cases
    if (/^\d{2,3}[-–]П[ЭЕ]К\d{2}$/i.test(normalized)) {
      return {
        url: `https://www.google.com/search?q=${encodeURIComponent(normalized)}+site:consultant.ru+OR+site:garant.ru`,
        label: "Найти решение",
        color: "purple"
      };
    }

    // Cassation cases: 33-21419/2024, 88-1234/2023
    if (/^\d{2}[-–]\d+\/\d{2,4}$/i.test(normalized)) {
      return {
        url: `https://www.google.com/search?q=${encodeURIComponent(normalized)}+судебное+решение`,
        label: "Найти решение",
        color: "teal"
      };
    }

    return null;
  };

  const getLinkColorClasses = (color: string): string => {
    switch (color) {
      case "blue":
        return "bg-blue-600/30 text-blue-400 hover:bg-blue-600/50 hover:text-blue-300";
      case "orange":
        return "bg-orange-600/30 text-orange-400 hover:bg-orange-600/50 hover:text-orange-300";
      case "purple":
        return "bg-purple-600/30 text-purple-400 hover:bg-purple-600/50 hover:text-purple-300";
      case "teal":
        return "bg-teal-600/30 text-teal-400 hover:bg-teal-600/50 hover:text-teal-300";
      default:
        return "bg-gray-600/30 text-gray-400 hover:bg-gray-600/50 hover:text-gray-300";
    }
  };

  const verifiedCases = cases.filter(c => c.status === "VERIFIED");
  const likelyCases = cases.filter(c => c.status === "LIKELY_EXISTS");
  const notFoundCases = cases.filter(c => c.status === "NOT_FOUND");

  return (
    <div className="bg-sgc-blue-700 rounded-xl p-4">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex justify-between items-center text-left"
      >
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-sgc-orange-500">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
          <h3 className="text-md font-semibold text-sgc-orange-500">
            Судебная практика
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-2 text-xs">
            <span className="text-green-400">[V] {verifiedCases.length}</span>
            {likelyCases.length > 0 && <span className="text-yellow-400">[?] {likelyCases.length}</span>}
            {notFoundCases.length > 0 && <span className="text-red-400">[X] {notFoundCases.length}</span>}
          </div>
          <span className="text-gray-400">{isExpanded ? "v" : ">"}</span>
        </div>
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-2">
          {/* Verified cases first */}
          {verifiedCases.map((c, i) => (
            <div key={`verified-${i}`} className="bg-sgc-blue-500/50 rounded-lg p-3 border-l-2 border-green-500">
              <div className="flex items-start justify-between">
                <div className="font-medium text-white">{c.case_number}</div>
                <span className="text-xs px-2 py-1 rounded bg-green-600/30 text-green-400">
                  {c.verification_source === "damia_api" ? "DaMIA" : "Perplexity"}
                </span>
              </div>
              {c.court && <div className="text-sm text-gray-300">{c.court}</div>}
              {c.date && <div className="text-sm text-gray-400">{c.date}</div>}
              {c.summary && <div className="text-sm text-gray-300 mt-2">{c.summary}</div>}

              {c.verification?.actual_info && (
                <div className="text-xs text-gray-400 mt-2 pt-2 border-t border-sgc-blue-500">
                  {c.verification.actual_info}
                </div>
              )}

              {/* Links */}
              {(() => {
                const damiaLinks = c.verification?.links?.filter(Boolean) || [];
                const generatedLink = damiaLinks.length === 0 ? generateCourtLink(c.case_number) : null;

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
                        href={generatedLink.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${getLinkColorClasses(generatedLink.color)}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                          <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z" clipRule="evenodd" />
                          <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z" clipRule="evenodd" />
                        </svg>
                        {generatedLink.label}
                      </a>
                    )}
                  </div>
                );
              })()}
            </div>
          ))}

          {/* Likely exists cases */}
          {likelyCases.map((c, i) => {
            const courtLink = generateCourtLink(c.case_number);
            return (
              <div key={`likely-${i}`} className="bg-sgc-blue-500/50 rounded-lg p-3 border-l-2 border-yellow-500 opacity-80">
                <div className="flex items-start justify-between">
                  <div className="font-medium text-white">{c.case_number}</div>
                  <span className="text-xs px-2 py-1 rounded bg-yellow-600/30 text-yellow-400">
                    Вероятно
                  </span>
                </div>
                {c.court && <div className="text-sm text-gray-300">{c.court}</div>}
                {c.summary && <div className="text-sm text-gray-300 mt-2">{c.summary}</div>}
                {courtLink && (
                  <div className="mt-2">
                    <a
                      href={courtLink.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${getLinkColorClasses("yellow")}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                        <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z" clipRule="evenodd" />
                        <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z" clipRule="evenodd" />
                      </svg>
                      Проверить
                    </a>
                  </div>
                )}
              </div>
            );
          })}

          {/* Not found - collapsed by default */}
          {notFoundCases.length > 0 && (
            <div className="text-xs text-gray-500 mt-2 pl-2">
              + {notFoundCases.length} дел не найдено в базах
            </div>
          )}
        </div>
      )}
    </div>
  );
}
