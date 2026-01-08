"use client";

import React from "react";

interface Props {
  content: string;
}

export default function MarkdownText({ content }: Props) {
  const renderContent = () => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let key = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Empty line
      if (!trimmed) {
        elements.push(<br key={key++} />);
        continue;
      }

      // Headers
      if (trimmed.startsWith('### ')) {
        elements.push(
          <h4 key={key++} className="font-bold text-base mt-3 mb-1">
            {renderInline(trimmed.slice(4))}
          </h4>
        );
        continue;
      }
      if (trimmed.startsWith('## ')) {
        elements.push(
          <h3 key={key++} className="font-bold text-lg mt-3 mb-1">
            {renderInline(trimmed.slice(3))}
          </h3>
        );
        continue;
      }
      if (trimmed.startsWith('# ')) {
        elements.push(
          <h2 key={key++} className="font-bold text-xl mt-3 mb-1">
            {renderInline(trimmed.slice(2))}
          </h2>
        );
        continue;
      }

      // Bullet lists
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        elements.push(
          <div key={key++} className="flex gap-2 ml-2">
            <span>•</span>
            <span>{renderInline(trimmed.slice(2))}</span>
          </div>
        );
        continue;
      }

      // Numbered lists
      const numberedMatch = trimmed.match(/^(\d+)\.\s(.+)/);
      if (numberedMatch) {
        elements.push(
          <div key={key++} className="flex gap-2 ml-2">
            <span>{numberedMatch[1]}.</span>
            <span>{renderInline(numberedMatch[2])}</span>
          </div>
        );
        continue;
      }

      // Regular paragraph
      elements.push(
        <p key={key++} className="mb-1">
          {renderInline(line)}
        </p>
      );
    }

    return elements;
  };

  const renderInline = (text: string): React.ReactNode => {
    // Pattern for **bold** and *italic*
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
      // Bold **text**
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      // Italic *text* (not preceded by *)
      const italicMatch = remaining.match(/(?<!\*)\*([^*]+)\*(?!\*)/);

      if (boldMatch && (!italicMatch || boldMatch.index! <= italicMatch.index!)) {
        const idx = boldMatch.index!;
        if (idx > 0) {
          parts.push(remaining.slice(0, idx));
        }
        parts.push(<strong key={key++}>{boldMatch[1]}</strong>);
        remaining = remaining.slice(idx + boldMatch[0].length);
      } else if (italicMatch) {
        const idx = italicMatch.index!;
        if (idx > 0) {
          parts.push(remaining.slice(0, idx));
        }
        parts.push(<em key={key++}>{italicMatch[1]}</em>);
        remaining = remaining.slice(idx + italicMatch[0].length);
      } else {
        parts.push(remaining);
        break;
      }
    }

    return parts.length === 1 ? parts[0] : parts;
  };

  return <div className="space-y-0.5">{renderContent()}</div>;
}
