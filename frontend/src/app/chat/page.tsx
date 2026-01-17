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
  VerifiedNpa,
  SingleQueryStageUpdate,
  saveResponse,
  QueryMode,
  ChatSession,
  createChatSession,
  getChatSessionWithMessages,
  renameChatSession,
} from "@/lib/api";
import ChatHistorySidebar from "@/components/ChatHistorySidebar";
import ModeSelector from "@/components/ModeSelector";
import { History } from "lucide-react";
import ModeToggle from "@/components/ModeToggle";
import SearchToggle from "@/components/SearchToggle";
import ChatMessage from "@/components/ChatMessage";
import LoadingSpinner from "@/components/LoadingSpinner";
import ChatInput from "@/components/ChatInput";
import ConsiliumProgress from "@/components/ConsiliumProgress";
import ConsiliumResultComponent from "@/components/ConsiliumResult";
import CourtPracticeProgress from "@/components/CourtPracticeProgress";
import VerifiedCasesDisplay from "@/components/VerifiedCasesDisplay";
import VerifiedNpaDisplay from "@/components/VerifiedNpaDisplay";
import FilePreview from "@/components/FilePreview";
import PhotoPreview from "@/components/PhotoPreview";
import { FileButton, CameraButton, VoiceButton } from "@/components/MobileInputButtons";

type Mode = "single" | "consilium";

// Photo item for camera capture
interface PhotoItem {
  file: File;
  preview: string;
  result?: FileUploadResult;
  isProcessing?: boolean;
  error?: string;
}

const MAX_PHOTOS = 5;

interface ConsiliumMessage {
  type: "consilium";
  result: ConsiliumResult;
}

// Single query result with verified cases and NPA
interface SingleResultMessage {
  type: "single_result";
  content: string;
  verifiedCases: CourtPracticeCase[];
  verifiedNpa: VerifiedNpa[];
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
  const [capturedPhotos, setCapturedPhotos] = useState<PhotoItem[]>([]);
  const [chatPhotoCount, setChatPhotoCount] = useState(0); // Track total photos in chat session
  const [pendingText, setPendingText] = useState("");
  const [voiceInputText, setVoiceInputText] = useState("");
  const [continuedFromSaved, setContinuedFromSaved] = useState(false);
  // Chat session state
  const [currentChatSession, setCurrentChatSession] = useState<ChatSession | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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

    // Check if continuing from saved response
    const urlParams = new URLSearchParams(window.location.search);
    const isContinue = urlParams.get("continue") === "true";

    if (!isContinue) {
      // Create a new chat session on entry
      initializeNewChat(storedToken);
    } else {
      setIsInitializing(false);
    }
  }, [router]);

  const initializeNewChat = async (authToken: string) => {
    setIsInitializing(true);
    try {
      const data = await createChatSession(authToken);
      setCurrentChatSession(data.chat);
      setMessages([]);
    } catch (err) {
      console.error("Failed to create chat session:", err);
      // Fallback: work without session
      setCurrentChatSession(null);
    } finally {
      setIsInitializing(false);
    }
  };

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
          // Create a new chat session for this context
          createChatSession(storedToken, "Продолжение: " + context.question.substring(0, 30) + "...")
            .then((data) => {
              setCurrentChatSession(data.chat);
              // Add the saved Q&A as context
              const contextMessages: Message[] = [
                { role: "user", content: context.question },
                { role: "assistant", content: context.answer },
              ];
              setMessages(contextMessages);
              setContinuedFromSaved(true);
              setIsInitializing(false);
              // Clean up after successful load
              localStorage.removeItem("sgc_continue_chat");
              // Remove query param from URL
              window.history.replaceState({}, "", "/chat");
            })
            .catch((err) => {
              console.error("Failed to create chat session for continue:", err);
              setIsInitializing(false);
            });
        } catch (e) {
          console.error("Failed to parse continue chat context:", e);
          localStorage.removeItem("sgc_continue_chat");
          setIsInitializing(false);
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

  // Handle voice input transcript
  const handleVoiceTranscript = (text: string) => {
    setVoiceInputText(prev => prev ? prev + " " + text : text);
  };

  // Handle camera capture
  const handlePhotoCapture = async (file: File) => {
    if (chatPhotoCount >= MAX_PHOTOS) {
      alert(`Максимум ${MAX_PHOTOS} фото в чате`);
      return;
    }

    const preview = URL.createObjectURL(file);
    const newPhoto: PhotoItem = {
      file,
      preview,
      isProcessing: true
    };

    setCapturedPhotos(prev => [...prev, newPhoto]);

    // Process photo through OCR
    try {
      const result = await import("@/lib/api").then(api => api.uploadFile(token, file));
      setCapturedPhotos(prev =>
        prev.map(p =>
          p.file === file
            ? { ...p, result, isProcessing: false }
            : p
        )
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Ошибка обработки";
      setCapturedPhotos(prev =>
        prev.map(p =>
          p.file === file
            ? { ...p, error: errorMessage, isProcessing: false }
            : p
        )
      );
    }
  };

  // Remove captured photo
  const handleRemovePhoto = (index: number) => {
    setCapturedPhotos(prev => {
      const newPhotos = [...prev];
      const removed = newPhotos.splice(index, 1)[0];
      if (removed?.preview) {
        URL.revokeObjectURL(removed.preview);
      }
      return newPhotos;
    });
  };

  const handleSend = async (content: string) => {
    if (isLoading) return;

    // Сохраняем контекст файла отдельно (не показывается в UI, только для LLM)
    let fileContext: string | undefined;
    let displayContent = content;

    // Handle single uploaded file
    if (uploadedFile) {
      fileContext = `${uploadedFile.summary}\n\n${uploadedFile.extracted_text}`;
      displayContent = `📎 ${uploadedFile.summary.split("|")[0].trim()}\n\n${content}`;
      setUploadedFile(null);
    }

    // Handle captured photos (OCR results)
    const processedPhotos = capturedPhotos.filter(p => p.result && !p.error);
    if (processedPhotos.length > 0) {
      const photoContexts = processedPhotos.map((p, idx) =>
        `[Фото ${idx + 1}]\n${p.result!.summary}\n\n${p.result!.extracted_text}`
      ).join("\n\n---\n\n");

      if (fileContext) {
        fileContext = `${fileContext}\n\n---\n\n${photoContexts}`;
      } else {
        fileContext = photoContexts;
      }

      const photoCountText = processedPhotos.length === 1
        ? "1 фото"
        : `${processedPhotos.length} фото`;
      displayContent = `📷 ${photoCountText} документов\n\n${content}`;

      // Update total photo count in chat and clear captured photos
      setChatPhotoCount(prev => prev + processedPhotos.length);
      setCapturedPhotos([]);
    }

    // Clear voice input text
    setVoiceInputText("");

    const userMessage: Message = { role: "user", content: displayContent };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setPendingText("");

    // Auto-rename chat on first message
    if (messages.length === 0 && currentChatSession) {
      const chatTitle = content.length > 40
        ? content.substring(0, 40) + "..."
        : content;
      renameChatSession(token, currentChatSession.id, chatTitle).catch(console.error);
      setCurrentChatSession({ ...currentChatSession, title: chatTitle });
    }

    if (mode === "single") {
      // Single Query mode с поиском Perplexity
      setStreamingContent("");
      setSingleQueryStage("");
      setSingleQueryMessage("");

      try {
        const allMessages = [
          ...messages.filter((m): m is Message => "role" in m && !("type" in m)),
          { role: "user" as const, content },
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
          },
          fileContext,
          currentChatSession?.id
        );

        setSingleQueryStage("");
        setSingleQueryMessage("");
        setStreamingContent("");

        // Если есть верифицированные дела или НПА, показываем результат с ними
        const hasVerifiedCases = result.verifiedCases && result.verifiedCases.length > 0;
        const hasVerifiedNpa = result.verifiedNpa && result.verifiedNpa.length > 0;

        if (hasVerifiedCases || hasVerifiedNpa) {
          setMessages((prev) => [
            ...prev,
            {
              type: "single_result",
              content: result.content,
              verifiedCases: result.verifiedCases || [],
              verifiedNpa: result.verifiedNpa || [],
            },
          ]);
        } else {
          // Если дел и НПА нет, показываем как обычное сообщение
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

      // Для Consilium передаём контекст файла вместе с вопросом
      const consiliumQuery = fileContext
        ? `[Контекст загруженного файла]\n${fileContext}\n\n[Вопрос пользователя]\n${content}`
        : content;

      try {
        const result = await runConsilium(
          token,
          consiliumQuery,
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
    // Create a new chat session
    if (token) {
      try {
        const data = await createChatSession(token);
        setCurrentChatSession(data.chat);
      } catch (err) {
        console.error("Failed to create new chat:", err);
        // Show error or work without session
      }
    }
    setMessages([]);
    setStreamingContent("");
    setConsiliumStage("");
    setSingleQueryStage("");
    setSingleQueryMessage("");
    setUploadedFile(null);
    setCapturedPhotos([]);
    setChatPhotoCount(0);
    setVoiceInputText("");
    setPendingText("");
  };

  // Handle chat selection from sidebar
  const handleSelectChat = async (chatId: string) => {
    if (!token) return;

    try {
      const data = await getChatSessionWithMessages(token, chatId);
      setCurrentChatSession(data.chat);
      // Convert messages to the format expected by the chat
      const loadedMessages: ChatItem[] = data.messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
      setMessages(loadedMessages);
      setStreamingContent("");
      setConsiliumStage("");
      setSingleQueryStage("");
      setSingleQueryMessage("");
      setUploadedFile(null);
      setCapturedPhotos([]);
      setChatPhotoCount(0); // Reset photo count for loaded chat
      setVoiceInputText("");
      setPendingText("");
    } catch (err) {
      console.error("Failed to load chat:", err);
    }
  };

  // Handle chat created from sidebar
  const handleChatCreated = (chat: ChatSession) => {
    setCurrentChatSession(chat);
    setMessages([]);
    setStreamingContent("");
    setConsiliumStage("");
    setSingleQueryStage("");
    setSingleQueryMessage("");
    setUploadedFile(null);
    setCapturedPhotos([]);
    setChatPhotoCount(0);
    setVoiceInputText("");
    setPendingText("");
  };

  const isConsiliumMessage = (item: ChatItem): item is ConsiliumMessage => {
    return "type" in item && item.type === "consilium";
  };

  const isSingleResultMessage = (item: ChatItem): item is SingleResultMessage => {
    return "type" in item && item.type === "single_result";
  };

  // Show loading spinner while initializing
  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sgc-blue-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-sgc-orange border-t-transparent mx-auto mb-4" />
          <p className="text-gray-400">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
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
            {/* История - только на мобильных */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden text-gray-400 hover:text-sgc-orange p-1"
              title="История чатов"
            >
              <History size={20} />
            </button>
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
                      {/* Verified NPA */}
                      {item.verifiedNpa.length > 0 && (
                        <VerifiedNpaDisplay npa={item.verifiedNpa} />
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
      <div className="bg-sgc-blue-700/50 border-t border-sgc-blue-500 px-2 sm:px-6 py-2 sm:py-4">
        <div className="max-w-4xl mx-auto">
          {/* File preview */}
          {uploadedFile && (
            <div className="mb-2">
              <FilePreview
                file={uploadedFile}
                onRemove={() => setUploadedFile(null)}
              />
            </div>
          )}

          {/* Photos preview */}
          {capturedPhotos.length > 0 && (
            <PhotoPreview
              photos={capturedPhotos}
              onRemove={handleRemovePhoto}
              maxPhotos={MAX_PHOTOS}
            />
          )}

          {/* Input with buttons like Perplexity */}
          <ChatInput
            onSend={handleSend}
            disabled={isLoading || capturedPhotos.some(p => p.isProcessing)}
            initialValue={voiceInputText || pendingText}
            placeholder={
              capturedPhotos.length > 0
                ? "Вопрос по фото..."
                : uploadedFile
                  ? "Вопрос по файлу..."
                  : "Спросите что угодно..."
            }
            bottomLeftContent={
              <>
                <FileButton
                  token={token}
                  onFileProcessed={handleFileProcessed}
                  disabled={isLoading}
                />
                <CameraButton
                  onCapture={handlePhotoCapture}
                  disabled={isLoading || capturedPhotos.some(p => p.isProcessing)}
                  maxPhotos={MAX_PHOTOS}
                  currentPhotoCount={chatPhotoCount + capturedPhotos.length}
                />
                <VoiceButton
                  onTranscript={handleVoiceTranscript}
                  disabled={isLoading}
                />
              </>
            }
          />
        </div>
      </div>
      </div> {/* End of main content */}

      {/* Chat History Sidebar */}
      {token && (
        <ChatHistorySidebar
          token={token}
          currentChatId={currentChatSession?.id || null}
          onSelectChat={handleSelectChat}
          onNewChat={handleNewChat}
          isOpen={isSidebarOpen}
          onToggle={setIsSidebarOpen}
        />
      )}
    </div>
  );
}
