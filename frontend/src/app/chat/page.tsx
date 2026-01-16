"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  sendQuery,
  runConsilium,
  Message,
  ConsiliumResult,
  StageUpdate,
  FileUploadResult,
  CourtPracticeCase,
  SingleQueryStageUpdate,
  getChatHistory,
  clearChatHistory,
  saveResponse,
  QueryMode,
} from "@/lib/api";
import ModeSelector from "@/components/ModeSelector";
import ModeToggle from "@/components/ModeToggle";
import SearchToggle from "@/components/SearchToggle";
import ChatMessage from "@/components/ChatMessage";
import LoadingSpinner from "@/components/LoadingSpinner";
import ChatInput from "@/components/ChatInput";
import ConsiliumProgress from "@/components/ConsiliumProgress";
import ConsiliumResultComponent from "@/components/ConsiliumResult";
import CourtPracticeProgress from "@/components/CourtPracticeProgress";
import VerifiedCasesDisplay from "@/components/VerifiedCasesDisplay";
import FileUpload from "@/components/FileUpload";
import FilePreview from "@/components/FilePreview";

type Mode = "single" | "consilium";

interface ConsiliumMessage {
  type: "consilium";
  result: ConsiliumResult;
}

// Single query result with verified cases
interface SingleResultMessage {
  type: "single_result";
  content: string;
  verifiedCases: CourtPracticeCase[];
}

type ChatItem = Message | ConsiliumMessage | SingleResultMessage;

export default function ChatPage() {
  const [userName, setUserName] = useState("");
  const [token, setToken] = useState("");
  const [mode, setMode] = useState<Mode>("single");
  const [queryMode, setQueryMode] = useState<QueryMode>("fast");
  const [searchEnabled, setSearchEnabled] = useState(true);
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [consiliumStage, setConsiliumStage] = useState("");
  const [consiliumMessage, setConsiliumMessage] = useState("");
  // Single mode stage progress (for court practice search integration)
  const [singleQueryStage, setSingleQueryStage] = useState("");
  const [singleQueryMessage, setSingleQueryMessage] = useState("");
  const [uploadedFile, setUploadedFile] = useState<FileUploadResult | null>(null);
  const [pendingText, setPendingText] = useState("");
  const [continuedFromSaved, setContinuedFromSaved] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const storedToken = localStorage.getItem("sgc_token");
    const user = localStorage.getItem("sgc_user");

    if (!storedToken) {
      router.push("/");
      return;
    }

    setToken(storedToken);
    setUserName(user || "Пользователь");

    // Load chat history (only if not continuing from saved)
    const urlParams = new URLSearchParams(window.location.search);
    const isContinue = urlParams.get("continue") === "true";
    if (!isContinue) {
      getChatHistory(storedToken)
        .then((history) => {
          if (history.length > 0) {
            const loadedMessages: Message[] = history.map((m) => ({
              role: m.role,
              content: m.content,
            }));
            setMessages(loadedMessages);
          }
        })
        .catch(console.error);
    }
  }, [router]);

  // Handle continue from saved response
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isContinue = urlParams.get("continue") === "true";
    if (isContinue && !continuedFromSaved) {
      const savedContext = localStorage.getItem("sgc_continue_chat");
      const storedToken = localStorage.getItem("sgc_token");
      if (savedContext && storedToken) {
        try {
          const context = JSON.parse(savedContext);
          // Clear the history first for a fresh conversation with context
          clearChatHistory(storedToken).then(() => {
            // Add the saved Q&A as context
            const contextMessages: Message[] = [
              { role: "user", content: context.question },
              { role: "assistant", content: context.answer },
            ];
            setMessages(contextMessages);
            setContinuedFromSaved(true);
            // Clean up after successful load
            localStorage.removeItem("sgc_continue_chat");
            // Remove query param from URL
            window.history.replaceState({}, "", "/chat");
          });
        } catch (e) {
          console.error("Failed to parse continue chat context:", e);
          localStorage.removeItem("sgc_continue_chat");
        }
      }
    }
  }, [continuedFromSaved]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent, consiliumStage, singleQueryStage]);

  const handleLogout = () => {
    localStorage.removeItem("sgc_token");
    localStorage.removeItem("sgc_user");
    router.push("/");
  };

  const handleFileProcessed = (result: FileUploadResult) => {
    setUploadedFile(result);
  };

  const handleSend = async (content: string) => {
    if (isLoading) return;

    // Если есть загруженный файл, добавляем текст к сообщению
    let fullContent = content;
    if (uploadedFile) {
      fullContent = `[Загружен файл: ${uploadedFile.summary}]\n\nСодержимое файла:\n${uploadedFile.extracted_text}\n\nВопрос пользователя:\n${content}`;
      setUploadedFile(null);
    }

    const userMessage: Message = { role: "user", content };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setPendingText("");

    if (mode === "single") {
      // Single Query mode с поиском Perplexity
      setStreamingContent("");
      setSingleQueryStage("");
      setSingleQueryMessage("");

      try {
        const allMessages = [
          ...messages.filter((m): m is Message => "role" in m && !("type" in m)),
          { role: "user" as const, content: fullContent },
        ];

        const result = await sendQuery(
          token,
          allMessages,
          queryMode,
          searchEnabled,
          (chunk) => {
            setStreamingContent((prev) => prev + chunk);
          },
          (update: SingleQueryStageUpdate) => {
            setSingleQueryStage(update.stage);
            setSingleQueryMessage(update.message || "");
          }
        );

        setSingleQueryStage("");
        setSingleQueryMessage("");
        setStreamingContent("");

        // Если есть верифицированные дела, показываем результат с делами
        if (result.verifiedCases && result.verifiedCases.length > 0) {
          setMessages((prev) => [
            ...prev,
            {
              type: "single_result",
              content: result.content,
              verifiedCases: result.verifiedCases,
            },
          ]);
        } else {
          // Если дел нет, показываем как обычное сообщение
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: result.content },
          ]);
        }
      } catch (err: unknown) {
        setSingleQueryStage("");
        setSingleQueryMessage("");
        setStreamingContent("");
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Ошибка: ${errorMessage}` },
        ]);
      }
    } else {
      // Consilium mode - использует Perplexity + Google для поиска
      setConsiliumStage("starting");
      setConsiliumMessage("Запуск консилиума...");

      try {
        const result = await runConsilium(
          token,
          fullContent,
          (update: StageUpdate) => {
            // Handle error/timeout stages
            if (update.stage === "error" || update.stage === "timeout") {
              setConsiliumStage("");
              // Ensure message is always a string
              const errorMsg = typeof update.message === 'string'
                ? update.message
                : (update.message ? JSON.stringify(update.message) : 'Неизвестная ошибка');
              setMessages((prev) => [
                ...prev,
                { role: "assistant", content: `Ошибка: ${errorMsg}` },
              ]);
              return;
            }
            // Skip heartbeat - don't update stage display
            if (update.stage === "heartbeat") {
              return;
            }
            setConsiliumStage(update.stage);
            // Ensure message is always a string
            const stageMsg = typeof update.message === 'string'
              ? update.message
              : (update.message ? JSON.stringify(update.message) : '');
            setConsiliumMessage(stageMsg);
          }
        );

        setMessages((prev) => [...prev, { type: "consilium", result }]);
        setConsiliumStage("");
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setConsiliumStage("");
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Ошибка консилиума: ${errorMessage}` },
        ]);
      }
    }

    setIsLoading(false);
  };

  const handleNewChat = async () => {
    // Clear history in database
    if (token) {
      await clearChatHistory(token);
    }
    setMessages([]);
    setStreamingContent("");
    setConsiliumStage("");
    setSingleQueryStage("");
    setSingleQueryMessage("");
    setUploadedFile(null);
    setPendingText("");
  };

  const isConsiliumMessage = (item: ChatItem): item is ConsiliumMessage => {
    return "type" in item && item.type === "consilium";
  };

  const isSingleResultMessage = (item: ChatItem): item is SingleResultMessage => {
    return "type" in item && item.type === "single_result";
  };

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      {/* Header */}
      <header className="bg-sgc-blue-700 border-b border-sgc-blue-500 px-3 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <img
              src="/sgc-logo-horizontal.png"
              alt="SGC Legal AI"
              className="h-10 sm:h-[74px] shrink-0"
            />
          </div>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <a
              href="/saved"
              className="text-gray-400 hover:text-white text-xs sm:text-sm"
            >
              Сохранённые
            </a>
            <span className="text-gray-400 text-sm hidden sm:inline">
              {userName}
            </span>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-white text-xs sm:text-sm"
            >
              Выйти
            </button>
          </div>
        </div>
      </header>

      {/* Mode & Query Mode Selector */}
      <div className="bg-sgc-blue-700/50 border-b border-sgc-blue-500 px-3 sm:px-6 py-2 sm:py-3">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <ModeSelector mode={mode} onModeChange={setMode} />
            {mode === "single" && (
              <>
                <ModeToggle
                  mode={queryMode}
                  onModeChange={setQueryMode}
                  disabled={isLoading}
                />
                <SearchToggle
                  enabled={searchEnabled}
                  onToggle={setSearchEnabled}
                  disabled={isLoading}
                />
              </>
            )}
          </div>
          {messages.length > 0 && (
            <button
              onClick={handleNewChat}
              className="text-gray-400 hover:text-white text-sm whitespace-nowrap self-end sm:self-auto"
            >
              + Новый чат
            </button>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6">
        <div className="max-w-4xl mx-auto">
          {messages.length === 0 && !streamingContent && !consiliumStage && !singleQueryStage ? (
            <div className="text-center text-gray-500 mt-20">
              <p className="text-lg mb-2">
                {mode === "single"
                  ? "Задайте юридический вопрос"
                  : "Режим Консилиум"}
              </p>
              <p className="text-sm">
                {mode === "single"
                  ? "Быстрый — оперативные ответы | Думающий — глубокий анализ"
                  : "4 модели проанализируют вопрос с поиском судебной практики"}
              </p>
              <p className="text-xs text-gray-600 mt-4">
                Поддержка файлов: DOCX, PDF, TXT, изображения (OCR), аудио
              </p>
            </div>
          ) : (
            <>
              {messages.map((item, idx) => {
                if (isConsiliumMessage(item)) {
                  return (
                    <div key={idx} className="mb-4">
                      <ConsiliumResultComponent result={item.result} token={token} />
                    </div>
                  );
                }

                if (isSingleResultMessage(item)) {
                  // Single query result with verified cases
                  const getPreviousUserMessage = () => {
                    for (let i = idx - 1; i >= 0; i--) {
                      const prev = messages[i];
                      if (!isConsiliumMessage(prev) && !isSingleResultMessage(prev) && prev.role === "user") {
                        return prev.content;
                      }
                    }
                    return "";
                  };

                  return (
                    <div key={idx} className="mb-4 space-y-4">
                      {/* Main answer */}
                      <ChatMessage
                        role="assistant"
                        content={item.content}
                        onSave={async () => {
                          const question = getPreviousUserMessage();
                          await saveResponse(token, question, item.content, queryMode);
                        }}
                        question={getPreviousUserMessage()}
                        model={queryMode}
                        token={token}
                      />
                      {/* Verified cases */}
                      {item.verifiedCases.length > 0 && (
                        <VerifiedCasesDisplay cases={item.verifiedCases} />
                      )}
                    </div>
                  );
                }

                // Regular message
                // Find previous user message for saving
                const getPreviousUserMessage = () => {
                  for (let i = idx - 1; i >= 0; i--) {
                    const prev = messages[i];
                    if (!isConsiliumMessage(prev) && !isSingleResultMessage(prev) && prev.role === "user") {
                      return prev.content;
                    }
                  }
                  return "";
                };

                const handleSaveResponse = item.role === "assistant"
                  ? async () => {
                      const question = getPreviousUserMessage();
                      await saveResponse(token, question, item.content, queryMode);
                    }
                  : undefined;

                return (
                  <ChatMessage
                    key={idx}
                    role={item.role}
                    content={item.content}
                    onSave={handleSaveResponse}
                    question={item.role === "assistant" ? getPreviousUserMessage() : undefined}
                    model={queryMode}
                    token={token}
                  />
                );
              })}

              {/* Loading spinner before response starts */}
              {isLoading && !streamingContent && !consiliumStage && !singleQueryStage && (
                <LoadingSpinner
                  message={mode === "single" ? "Подготовка..." : "Запускаю консилиум..."}
                />
              )}

              {streamingContent && (
                <ChatMessage
                  role="assistant"
                  content={streamingContent + "|"}
                />
              )}

              {consiliumStage && (
                <ConsiliumProgress
                  currentStage={consiliumStage}
                  message={consiliumMessage}
                />
              )}

              {singleQueryStage && (
                <CourtPracticeProgress
                  currentStage={singleQueryStage}
                  message={singleQueryMessage}
                />
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </main>

      {/* Input Area */}
      <div className="bg-sgc-blue-700/50 border-t border-sgc-blue-500 px-3 sm:px-6 py-3 sm:py-4">
        <div className="max-w-4xl mx-auto">
          {uploadedFile && (
            <div className="mb-2">
              <FilePreview
                file={uploadedFile}
                onRemove={() => setUploadedFile(null)}
              />
            </div>
          )}
          <div className="flex gap-3 items-end">
            <FileUpload
              token={token}
              onFileProcessed={handleFileProcessed}
              disabled={isLoading}
            />
            <div className="flex-1">
              <ChatInput
                onSend={handleSend}
                disabled={isLoading}
                initialValue={pendingText}
                placeholder={
                  uploadedFile
                    ? "Задайте вопрос по загруженному файлу..."
                    : "Введите ваш вопрос..."
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
