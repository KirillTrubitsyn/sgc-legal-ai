"use client";

import React from "react";

interface Props {
  content: string;
}

export default function MarkdownText({ content }: Props) {
  // Clean content before rendering
  const cleanContent = (text: string): string => {
    // Remove duplicate "АНАЛИТИЧЕСКАЯ СПРАВКА" header
    text = text.replace(/^[\s\n]*АНАЛИТИЧЕСКАЯ СПРАВКА[\s\n]*/i, '');

    // Remove --- separators
    text = text.replace(/^---+\s*$/gm, '');

    return text.trim();
  };

  // Split inline numbered lists into separate lines
  const expandInlineNumberedLists = (text: string): string => {
    const lines = text.split('\n');
    const expandedLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Check if line contains multiple numbered items like "1. **Item**: text 2. **Item**: text"
      if (/\d+\.\s+\*\*[^*]+\*\*:/.test(trimmed) && /\d+\.\s+.*\d+\.\s+/.test(trimmed)) {
        // Split by numbered pattern
        const parts = trimmed.split(/(?=\d+\.\s+)/);
        for (const part of parts) {
          if (part.trim()) {
            expandedLines.push(part.trim());
          }
        }
      } else {
        expandedLines.push(line);
      }
    }

    return expandedLines.join('\n');
  };

  const renderContent = () => {
    let processedContent = cleanContent(content);
    processedContent = expandInlineNumberedLists(processedContent);

    const lines = processedContent.split('\n');
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

      // Headers (####, ###, ##, #)
      if (trimmed.startsWith('#### ')) {
        elements.push(
          <h5 key={key++} className="font-bold text-sm mt-2 mb-1">
            {renderInline(trimmed.slice(5))}
          </h5>
        );
        continue;
      }
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

      // Section headers (N. Title) - main sections
      const sectionMatch = trimmed.match(/^(\d+)\.\s+([А-ЯA-Z][^:]*?)$/);
      if (sectionMatch && trimmed.length < 100) {
        elements.push(
          <h4 key={key++} className="font-bold text-base mt-4 mb-2">
            {trimmed}
          </h4>
        );
        continue;
      }

      // Bullet lists
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
        const bulletContent = trimmed.startsWith('• ') ? trimmed.slice(2) : trimmed.slice(2);
        elements.push(
          <div key={key++} className="flex gap-2 ml-4 text-justify">
            <span className="flex-shrink-0">•</span>
            <span className="flex-1">{renderInline(bulletContent)}</span>
          </div>
        );
        continue;
      }

      // Numbered lists (items with content after number)
      const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
      if (numberedMatch && numberedMatch[2].length > 0) {
        // Check if it's a section header vs list item
        const isHeader = /^[А-ЯA-Z]/.test(numberedMatch[2]) && !numberedMatch[2].includes(':') && trimmed.length < 80;
        if (isHeader) {
          elements.push(
            <h4 key={key++} className="font-bold text-base mt-4 mb-2">
              {trimmed}
            </h4>
          );
        } else {
          elements.push(
            <div key={key++} className="flex gap-2 ml-4 text-justify">
              <span className="flex-shrink-0">{numberedMatch[1]}.</span>
              <span className="flex-1">{renderInline(numberedMatch[2])}</span>
            </div>
          );
        }
        continue;
      }

      // Regular paragraph with justify
      elements.push(
        <p key={key++} className="mb-2 text-justify indent-4">
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
