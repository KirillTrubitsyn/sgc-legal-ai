"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  getModels,
  sendQuery,
  runConsilium,
  Model,
  Message,
  ConsiliumResult,
  StageUpdate,
  FileUploadResult,
} from "@/lib/api";
import ModelSelector from "@/components/ModelSelector";
import ModeSelector from "@/components/ModeSelector";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import ConsiliumProgress from "@/components/ConsiliumProgress";
import ConsiliumResultComponent from "@/components/ConsiliumResult";
import FileUpload from "@/components/FileUpload";
import FilePreview from "@/components/FilePreview";

type Mode = "single" | "consilium";

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

    getModels(storedToken)
      .then((m) => {
        setModels(m);
        if (m.length > 0) setSelectedModel(m[0].id);
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
      if (!selectedModel) return;
      setStreamingContent("");

      try {
        let fullResponse = "";
        const allMessages = [
          ...messages.filter((m): m is Message => "role" in m),
          { role: "user" as const, content: fullContent },
        ];

        await sendQuery(token, selectedModel, allMessages, (chunk) => {
          fullResponse += chunk;
          setStreamingContent(fullResponse);
        });

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

  const handleNewChat = () => {
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
            <h1 className="text-xl font-bold">
              <span className="text-sgc-orange-500">SGC</span> Legal AI
            </h1>
          </div>
          <div className="flex items-center gap-4">
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
              <ModelSelector
                models={models}
                selected={selectedModel}
                onSelect={setSelectedModel}
              />
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
                  ? "Выберите модель и задайте вопрос"
                  : "Режим Consilium"}
              </p>
              <p className="text-sm">
                {mode === "single"
                  ? "Single Query — быстрые ответы от одной AI-модели"
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

              {messages.map((item, idx) =>
                isConsiliumMessage(item) ? (
                  <div key={idx} className="mb-4">
                    <ConsiliumResultComponent result={item.result} />
                  </div>
                ) : (
                  <ChatMessage key={idx} role={item.role} content={item.content} />
                )
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
                disabled={isLoading || (mode === "single" && !selectedModel)}
                initialValue={pendingText}
                placeholder={
                  uploadedFile
                    ? "Задайте вопрос по загруженному файлу..."
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
