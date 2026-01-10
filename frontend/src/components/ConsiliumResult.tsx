"use client";

import { useState } from "react";
import { ConsiliumResult as ConsiliumResultType, saveResponse, exportAsDocx, downloadBlob } from "@/lib/api";
import MarkdownText from "./MarkdownText";

interface Props {
  result: ConsiliumResultType;
  token?: string;
}

export default function ConsiliumResult({ result, token }: Props) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const handleSave = async () => {
    if (!token || saving || saved) return;
    setSaving(true);
    try {
      await saveResponse(token, result.question, result.final_answer, "consilium");
      setSaved(true);
    } catch (err) {
      console.error("Failed to save:", err);
    }
    setSaving(false);
  };

  const handleExport = async () => {
    if (!token) return;
    try {
      const blob = await exportAsDocx(token, result.question, result.final_answer, "consilium");
      downloadBlob(blob, "sgc-consilium-response.docx");
    } catch (err) {
      console.error("Failed to export:", err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Итоговый ответ */}
      <div className="bg-sgc-blue-700 rounded-xl p-6">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-lg font-semibold text-sgc-orange-500">
            Итоговый ответ консилиума
          </h3>
          {token && (
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving || saved}
                className={`p-2 rounded-lg transition-colors ${
                  saved
                    ? "bg-green-600 text-white"
                    : "bg-sgc-blue-500 text-gray-300 hover:text-white hover:bg-sgc-blue-400"
                }`}
                title={saved ? "Сохранено" : "Сохранить"}
              >
                {saved ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                    <path d="M20 6 9 17l-5-5"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                    <polyline points="17 21 17 13 7 13 7 21"/>
                    <polyline points="7 3 7 8 15 8"/>
                  </svg>
                )}
              </button>
              <button
                onClick={handleExport}
                className="p-2 rounded-lg bg-sgc-blue-500 text-gray-300 hover:text-white hover:bg-sgc-blue-400 transition-colors"
                title="Скачать DOCX"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </button>
            </div>
          )}
        </div>
        <div className="text-gray-100">
          <MarkdownText content={result.final_answer} />
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
                <div className="text-sm text-gray-300">
                  <MarkdownText content={op.content} />
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

      {/* Источники */}
      {(() => {
        // Собираем все источники из верифицированных дел
        const allSources: { url: string; title: string; source: string }[] = [];

        result.verified_cases.forEach((c) => {
          const verification = c.verification || {};
          const verificationSource = c.verification_source || "unknown";

          // Ссылки из DaMIA
          if (verification.links) {
            verification.links.forEach((link: string) => {
              if (link) {
                allSources.push({
                  url: link,
                  title: c.case_number || "Судебное дело",
                  source: verificationSource === "damia_api" ? "kad.arbitr.ru" : "Поиск"
                });
              }
            });
          }

          // Источники из Perplexity/Google
          if (verification.sources) {
            verification.sources.forEach((src: string) => {
              if (src && !src.includes("DaMIA")) {
                allSources.push({
                  url: "",
                  title: src,
                  source: "Верификация"
                });
              }
            });
          }
        });

        if (allSources.length === 0) return null;

        return (
          <div className="bg-sgc-blue-700 rounded-xl p-4">
            <button
              onClick={() => toggleSection("sources")}
              className="w-full flex justify-between items-center text-left"
            >
              <h3 className="text-md font-semibold text-gray-300">
                Источники ({allSources.length})
              </h3>
              <span>{expandedSection === "sources" ? "v" : ">"}</span>
            </button>

            {expandedSection === "sources" && (
              <div className="mt-3 space-y-2">
                {allSources.map((src, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-gray-500">{i + 1}.</span>
                    {src.url ? (
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 hover:underline flex-1"
                      >
                        {src.title}
                        <span className="text-gray-500 ml-2">({src.source})</span>
                      </a>
                    ) : (
                      <span className="text-gray-300 flex-1">
                        {src.title}
                        <span className="text-gray-500 ml-2">({src.source})</span>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
