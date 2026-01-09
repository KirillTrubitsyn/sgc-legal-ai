"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  getModels,
  sendQuery,
  runConsilium,
  webSearch,
  googleSearch,
  Model,
  Message,
  ConsiliumResult,
  StageUpdate,
  FileUploadResult,
  getChatHistory,
  clearChatHistory,
  saveResponse,
  GoogleSearchResult,
} from "@/lib/api";
import ModelSelector from "@/components/ModelSelector";
import ModeSelector from "@/components/ModeSelector";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import ConsiliumProgress from "@/components/ConsiliumProgress";
import ConsiliumResultComponent from "@/components/ConsiliumResult";
import FileUpload from "@/components/FileUpload";
import FilePreview from "@/components/FilePreview";

type Mode = "single" | "consilium" | "google";

interface ConsiliumMessage {
  type: "consilium";
  result: ConsiliumResult;
}

type ChatItem = Message | ConsiliumMessage;

export default function ChatPage() {
  const [userName, setUserName] = useState("");
  const [token, setToken] = useState("");
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [mode, setMode] = useState<Mode>("single");
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [consiliumStage, setConsiliumStage] = useState("");
  const [consiliumMessage, setConsiliumMessage] = useState("");
  const [uploadedFile, setUploadedFile] = useState<FileUploadResult | null>(null);
  const [pendingText, setPendingText] = useState("");
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [googleSearchType, setGoogleSearchType] = useState<"general" | "court_cases" | "legal_topic">("legal_topic");
  const [googleSearchLoading, setGoogleSearchLoading] = useState(false);
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

    // Load models
    getModels(storedToken)
      .then((m) => {
        setModels(m);
        if (m.length > 0) setSelectedModel(m[0].id);
      })
      .catch(console.error);

    // Load chat history
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
  }, [router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent, consiliumStage]);

  const handleLogout = () => {
    localStorage.removeItem("sgc_token");
    localStorage.removeItem("sgc_user");
    router.push("/");
  };

  const handleFileProcessed = (result: FileUploadResult) => {
    setUploadedFile(result);
  };

  const handleUseFileText = () => {
    if (uploadedFile) {
      setPendingText(uploadedFile.extracted_text);
      setUploadedFile(null);
    }
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
      // Single Query mode
      if (!selectedModel && !webSearchEnabled) return;
      setStreamingContent("");

      try {
        let fullResponse = "";

        if (webSearchEnabled) {
          // Web search mode
          await webSearch(token, fullContent, (chunk) => {
            fullResponse += chunk;
            setStreamingContent(fullResponse);
          });
        } else {
          // Regular query mode
          const allMessages = [
            ...messages.filter((m): m is Message => "role" in m),
            { role: "user" as const, content: fullContent },
          ];

          await sendQuery(token, selectedModel, allMessages, (chunk) => {
            fullResponse += chunk;
            setStreamingContent(fullResponse);
          });
        }

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: fullResponse },
        ]);
        setStreamingContent("");
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Ошибка: ${errorMessage}` },
        ]);
      }
    } else if (mode === "google") {
      // Google Search mode
      setGoogleSearchLoading(true);

      try {
        const result = await googleSearch(token, fullContent, googleSearchType);

        if (result.success) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: result.content },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `Ошибка поиска: ${result.error || "Неизвестная ошибка"}` },
          ]);
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Ошибка Google Search: ${errorMessage}` },
        ]);
      }

      setGoogleSearchLoading(false);
    } else {
      // Consilium mode
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
              setMessages((prev) => [
                ...prev,
                { role: "assistant", content: `Ошибка: ${update.message}` },
              ]);
              return;
            }
            setConsiliumStage(update.stage);
            setConsiliumMessage(update.message || "");
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
    setUploadedFile(null);
    setPendingText("");
  };

  const isConsiliumMessage = (item: ChatItem): item is ConsiliumMessage => {
    return "type" in item && item.type === "consilium";
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-sgc-blue-700 border-b border-sgc-blue-500 px-6 py-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <img
              src="/sgc-logo-horizontal.svg"
              alt="SGC Legal AI"
              className="h-10"
            />
          </div>
          <div className="flex items-center gap-4">
            <a
              href="/saved"
              className="text-gray-400 hover:text-white text-sm"
            >
              Сохранённые
            </a>
            <span className="text-gray-400 text-sm hidden sm:inline">
              {userName}
            </span>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-white text-sm"
            >
              Выйти
            </button>
          </div>
        </div>
      </header>

      {/* Mode & Model Selector */}
      <div className="bg-sgc-blue-700/50 border-b border-sgc-blue-500 px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <ModeSelector mode={mode} onModeChange={setMode} />
            {mode === "single" && (
              <>
                <ModelSelector
                  models={models}
                  selected={selectedModel}
                  onSelect={setSelectedModel}
                  disabled={webSearchEnabled}
                />
                <button
                  onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    webSearchEnabled
                      ? "bg-green-600 text-white"
                      : "bg-sgc-blue-600 text-gray-300 hover:text-white"
                  }`}
                  title="Поиск в интернете через Perplexity"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-4 h-4"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                  <span className="hidden sm:inline">Поиск</span>
                </button>
              </>
            )}
            {mode === "google" && (
              <select
                value={googleSearchType}
                onChange={(e) => setGoogleSearchType(e.target.value as "general" | "court_cases" | "legal_topic")}
                className="bg-sgc-blue-600 text-white px-3 py-2 rounded-lg text-sm border border-sgc-blue-500 focus:outline-none focus:ring-2 focus:ring-sgc-orange-500"
              >
                <option value="legal_topic">Юридический поиск</option>
                <option value="court_cases">Судебные дела</option>
                <option value="general">Общий поиск</option>
              </select>
            )}
          </div>
          {messages.length > 0 && (
            <button
              onClick={handleNewChat}
              className="text-gray-400 hover:text-white text-sm whitespace-nowrap"
            >
              + Новый чат
            </button>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-4xl mx-auto">
          {messages.length === 0 && !streamingContent && !consiliumStage && !uploadedFile ? (
            <div className="text-center text-gray-500 mt-20">
              <p className="text-lg mb-2">
                {mode === "single"
                  ? webSearchEnabled
                    ? "Поиск в интернете"
                    : "Выберите модель и задайте вопрос"
                  : mode === "google"
                  ? "Google Поиск судебной практики"
                  : "Режим Consilium"}
              </p>
              <p className="text-sm">
                {mode === "single"
                  ? webSearchEnabled
                    ? "Perplexity найдёт актуальную информацию в интернете"
                    : "Single Query — быстрые ответы от одной AI-модели"
                  : mode === "google"
                  ? "Поиск судебных дел и законодательства через Google Custom Search"
                  : "4 модели проанализируют вопрос с верификацией судебной практики"}
              </p>
              <p className="text-xs text-gray-600 mt-4">
                Поддержка файлов: DOCX, PDF, TXT, изображения (OCR), аудио (транскрибация)
              </p>
              {mode === "consilium" && (
                <p className="text-xs text-gray-600 mt-1">
                  ~$0.60 за запрос | 10-20 секунд
                </p>
              )}
              {mode === "google" && (
                <p className="text-xs text-gray-600 mt-1">
                  Приоритет: Судакт, КАД, КонсультантПлюс, Гарант
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Uploaded file preview */}
              {uploadedFile && (
                <FilePreview
                  file={uploadedFile}
                  onRemove={() => setUploadedFile(null)}
                  onUseText={handleUseFileText}
                />
              )}

              {messages.map((item, idx) => {
                if (isConsiliumMessage(item)) {
                  return (
                    <div key={idx} className="mb-4">
                      <ConsiliumResultComponent result={item.result} token={token} />
                    </div>
                  );
                }

                // Find previous user message for saving
                const getPreviousUserMessage = () => {
                  for (let i = idx - 1; i >= 0; i--) {
                    const prev = messages[i];
                    if (!isConsiliumMessage(prev) && prev.role === "user") {
                      return prev.content;
                    }
                  }
                  return "";
                };

                const handleSaveResponse = item.role === "assistant"
                  ? async () => {
                      const question = getPreviousUserMessage();
                      await saveResponse(token, question, item.content, selectedModel);
                    }
                  : undefined;

                return (
                  <ChatMessage
                    key={idx}
                    role={item.role}
                    content={item.content}
                    onSave={handleSaveResponse}
                    question={item.role === "assistant" ? getPreviousUserMessage() : undefined}
                    model={selectedModel}
                    token={token}
                  />
                );
              })}

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

              {googleSearchLoading && (
                <div className="flex items-center gap-3 p-4 bg-sgc-blue-700 rounded-lg">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-sgc-orange-500"></div>
                  <span className="text-gray-300">Поиск через Google...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </main>

      {/* Input Area */}
      <div className="bg-sgc-blue-700/50 border-t border-sgc-blue-500 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-3 items-end">
            <FileUpload
              token={token}
              onFileProcessed={handleFileProcessed}
              disabled={isLoading}
            />
            <div className="flex-1">
              <ChatInput
                onSend={handleSend}
                disabled={isLoading || googleSearchLoading || (mode === "single" && !selectedModel && !webSearchEnabled)}
                initialValue={pendingText}
                placeholder={
                  uploadedFile
                    ? "Задайте вопрос по загруженному файлу..."
                    : mode === "google"
                    ? "Поиск судебной практики..."
                    : webSearchEnabled
                    ? "Поиск в интернете..."
                    : "Введите ваш вопрос..."
                }
              />
            </div>
          </div>
          {uploadedFile && (
            <div className="mt-2 text-xs text-gray-400">
              Файл загружен и будет включён в запрос
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
