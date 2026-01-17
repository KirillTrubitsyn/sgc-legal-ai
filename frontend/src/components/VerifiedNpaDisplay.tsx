"use client";

import { useState } from "react";
import { VerifiedNpa } from "@/lib/api";

interface Props {
  npa: VerifiedNpa[];
}

export default function VerifiedNpaDisplay({ npa }: Props) {
  const [isExpanded, setIsExpanded] = useState(true);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "VERIFIED":
        return "text-green-400";
      case "AMENDED":
        return "text-yellow-400";
      case "REPEALED":
        return "text-red-400";
      case "NOT_FOUND":
        return "text-gray-400";
      default:
        return "text-gray-400";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "VERIFIED":
        return { label: "Действует", bg: "bg-green-600/30", text: "text-green-400" };
      case "AMENDED":
        return { label: "Изменена", bg: "bg-yellow-600/30", text: "text-yellow-400" };
      case "REPEALED":
        return { label: "Утратила силу", bg: "bg-red-600/30", text: "text-red-400" };
      case "NOT_FOUND":
        return { label: "Не найдена", bg: "bg-gray-600/30", text: "text-gray-400" };
      default:
        return { label: status, bg: "bg-gray-600/30", text: "text-gray-400" };
    }
  };

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case "high":
        return { label: "Высокая", color: "text-green-400" };
      case "medium":
        return { label: "Средняя", color: "text-yellow-400" };
      case "low":
        return { label: "Низкая", color: "text-red-400" };
      default:
        return { label: confidence, color: "text-gray-400" };
    }
  };

  // Generate link to legal databases
  const generateNpaLink = (npaItem: VerifiedNpa): { url: string; label: string; color: string } | null => {
    const { act_type, article, raw_reference } = npaItem;

    // Code slugs for ConsultantPlus
    const codeUrls: Record<string, string> = {
      "ГК": "cons_doc_LAW_5142",
      "УК": "cons_doc_LAW_10699",
      "ТК": "cons_doc_LAW_34683",
      "НК": "cons_doc_LAW_19671",
      "КоАП": "cons_doc_LAW_34661",
      "АПК": "cons_doc_LAW_37800",
      "ГПК": "cons_doc_LAW_39570",
      "УПК": "cons_doc_LAW_34481",
      "КАС": "cons_doc_LAW_176147",
      "СК": "cons_doc_LAW_8982",
      "ЖК": "cons_doc_LAW_51057",
      "ЗК": "cons_doc_LAW_33773",
    };

    if (act_type && codeUrls[act_type]) {
      const baseUrl = `https://www.consultant.ru/document/${codeUrls[act_type]}/`;
      return {
        url: article ? `${baseUrl}?frame=1#st${article}` : baseUrl,
        label: "КонсультантПлюс",
        color: "blue"
      };
    }

    // For federal laws and other acts - search
    if (act_type === "ФЗ" || act_type === "ПП_РФ" || act_type === "УП_РФ") {
      return {
        url: `https://www.consultant.ru/search/?q=${encodeURIComponent(raw_reference)}`,
        label: "КонсультантПлюс",
        color: "blue"
      };
    }

    // Default: Google search on legal sites
    return {
      url: `https://www.google.com/search?q=${encodeURIComponent(raw_reference)}+site:consultant.ru+OR+site:garant.ru`,
      label: "Найти",
      color: "gray"
    };
  };

  const getLinkColorClasses = (color: string): string => {
    switch (color) {
      case "blue":
        return "bg-blue-600/30 text-blue-400 hover:bg-blue-600/50 hover:text-blue-300";
      case "green":
        return "bg-green-600/30 text-green-400 hover:bg-green-600/50 hover:text-green-300";
      case "yellow":
        return "bg-yellow-600/30 text-yellow-400 hover:bg-yellow-600/50 hover:text-yellow-300";
      default:
        return "bg-gray-600/30 text-gray-400 hover:bg-gray-600/50 hover:text-gray-300";
    }
  };

  const verifiedNpa = npa.filter(n => n.status === "VERIFIED");
  const amendedNpa = npa.filter(n => n.status === "AMENDED");
  const repealedNpa = npa.filter(n => n.status === "REPEALED");
  const notFoundNpa = npa.filter(n => n.status === "NOT_FOUND");

  const getBorderColor = (status: string) => {
    switch (status) {
      case "VERIFIED":
        return "border-green-500";
      case "AMENDED":
        return "border-yellow-500";
      case "REPEALED":
        return "border-red-500";
      default:
        return "border-gray-500";
    }
  };

  const renderNpaItem = (npaItem: VerifiedNpa, index: number) => {
    const statusBadge = getStatusBadge(npaItem.status);
    const confidenceBadge = getConfidenceBadge(npaItem.confidence);
    const link = generateNpaLink(npaItem);

    return (
      <div
        key={`${npaItem.status}-${index}`}
        className={`bg-sgc-blue-500/50 rounded-lg p-3 border-l-2 ${getBorderColor(npaItem.status)}`}
      >
        <div className="flex items-start justify-between">
          <div className="font-medium text-white">{npaItem.raw_reference}</div>
          <span className={`text-xs px-2 py-1 rounded ${statusBadge.bg} ${statusBadge.text}`}>
            {statusBadge.label}
          </span>
        </div>

        {npaItem.act_name && npaItem.act_name !== npaItem.raw_reference && (
          <div className="text-sm text-gray-300 mt-1">{npaItem.act_name}</div>
        )}

        {npaItem.current_text && (
          <div className="text-sm text-gray-300 mt-2 p-2 bg-sgc-blue-700/50 rounded">
            <span className="text-gray-400 text-xs">Текст нормы:</span>
            <p className="mt-1 italic">{npaItem.current_text}</p>
          </div>
        )}

        {npaItem.amendment_info && (
          <div className="text-sm text-yellow-300 mt-2">
            <span className="font-medium">Изменения:</span> {npaItem.amendment_info}
          </div>
        )}

        {npaItem.repeal_info && (
          <div className="text-sm text-red-300 mt-2">
            <span className="font-medium">Утрата силы:</span> {npaItem.repeal_info}
          </div>
        )}

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            {/* Confidence badge */}
            <span className={`text-xs ${confidenceBadge.color}`}>
              Уверенность: {confidenceBadge.label}
            </span>
          </div>

          {/* Link to legal database */}
          {link && (
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${getLinkColorClasses(link.color)}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z" clipRule="evenodd" />
                <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z" clipRule="evenodd" />
              </svg>
              {link.label}
            </a>
          )}
        </div>

        {/* Sources */}
        {npaItem.sources && npaItem.sources.length > 0 && (
          <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-sgc-blue-500">
            Источники: {npaItem.sources.join(", ")}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-sgc-blue-700 rounded-xl p-4">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex justify-between items-center text-left"
      >
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-blue-400">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            <path d="M8 7h8" />
            <path d="M8 11h8" />
            <path d="M8 15h4" />
          </svg>
          <h3 className="text-md font-semibold text-blue-400">
            Нормативно-правовые акты
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-2 text-xs">
            <span className="text-green-400">[V] {verifiedNpa.length}</span>
            {amendedNpa.length > 0 && <span className="text-yellow-400">[~] {amendedNpa.length}</span>}
            {repealedNpa.length > 0 && <span className="text-red-400">[X] {repealedNpa.length}</span>}
            {notFoundNpa.length > 0 && <span className="text-gray-400">[?] {notFoundNpa.length}</span>}
          </div>
          <span className="text-gray-400">{isExpanded ? "v" : ">"}</span>
        </div>
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-2">
          {/* Verified NPA first */}
          {verifiedNpa.map((n, i) => renderNpaItem(n, i))}

          {/* Amended NPA */}
          {amendedNpa.map((n, i) => renderNpaItem(n, i))}

          {/* Repealed NPA */}
          {repealedNpa.map((n, i) => renderNpaItem(n, i))}

          {/* Not found - collapsed info */}
          {notFoundNpa.length > 0 && (
            <div className="text-xs text-gray-500 mt-2 pl-2">
              + {notFoundNpa.length} НПА не найдено в базах
            </div>
          )}
        </div>
      )}
    </div>
  );
}
