"use client";

import { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Pencil,
  Trash2,
  X,
  Check,
  AlertCircle,
  History,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import {
  ChatSession,
  getChatSessions,
  renameChatSession,
  deleteChatSession,
  deleteAllChatSessions,
} from "@/lib/api";

interface ChatHistorySidebarProps {
  token: string;
  currentChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  isOpen: boolean;
  onToggle: (open: boolean) => void;
}

export default function ChatHistorySidebar({
  token,
  currentChatId,
  onSelectChat,
  onNewChat,
  isOpen,
  onToggle,
}: ChatHistorySidebarProps) {
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [count, setCount] = useState(0);
  const [limit, setLimit] = useState(20);
  const [isLoading, setIsLoading] = useState(false);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const loadChats = async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getChatSessions(token);
      // Фильтруем пустые чаты с дефолтным названием "Новый чат"
      const filteredChats = data.chats.filter(chat => chat.title !== "Новый чат");
      setChats(filteredChats);
      setCount(filteredChats.length);
      setLimit(data.limit);
    } catch (err) {
      console.error("Failed to load chats:", err);
      setError("Не удалось загрузить историю");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && token) {
      loadChats();
    }
  }, [isOpen, token]);

  useEffect(() => {
    if (editingChatId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingChatId]);

  const handleRename = async (chatId: string) => {
    if (!editTitle.trim()) {
      setEditingChatId(null);
      return;
    }

    try {
      await renameChatSession(token, chatId, editTitle.trim());
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === chatId ? { ...chat, title: editTitle.trim() } : chat
        )
      );
      setEditingChatId(null);
    } catch (err) {
      console.error("Failed to rename chat:", err);
      setError("Не удалось переименовать чат");
    }
  };

  const handleDelete = async (chatId: string) => {
    try {
      await deleteChatSession(token, chatId);
      setChats((prev) => prev.filter((chat) => chat.id !== chatId));
      setCount((prev) => prev - 1);
      setShowDeleteConfirm(null);

      if (chatId === currentChatId) {
        onNewChat();
      }
    } catch (err) {
      console.error("Failed to delete chat:", err);
      setError("Не удалось удалить чат");
    }
  };

  const handleClearAll = async () => {
    try {
      await deleteAllChatSessions(token);
      setChats([]);
      setCount(0);
      setShowClearConfirm(false);
      onNewChat();
    } catch (err) {
      console.error("Failed to clear history:", err);
      setError("Не удалось очистить историю");
    }
  };

  const handleSelectChat = (chatId: string) => {
    onSelectChat(chatId);
    // На мобильном закрываем панель после выбора чата
    onToggle(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    } else if (diffDays === 1) {
      return "Вчера";
    } else if (diffDays < 7) {
      return date.toLocaleDateString("ru-RU", { weekday: "short" });
    } else {
      return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
    }
  };

  // Контент панели (переиспользуется для мобильной и десктопной версии)
  const panelContent = (
    <>
      {/* Header */}
      <div className="p-4 border-b border-sgc-blue-600 shrink-0" style={{ backgroundColor: '#0f2240' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Кнопка назад для мобильной версии */}
            <button
              onClick={() => onToggle(false)}
              className="md:hidden text-gray-400 hover:text-white p-1 hover:bg-sgc-blue-600 rounded mr-1"
            >
              <ArrowLeft size={20} />
            </button>
            <History size={18} className="text-sgc-orange" />
            <h2 className="text-white font-semibold">История чатов</h2>
          </div>
          {/* Кнопка закрытия для десктопа */}
          <button
            onClick={() => onToggle(false)}
            className="hidden md:block text-gray-400 hover:text-white p-1 hover:bg-sgc-blue-600 rounded"
          >
            <X size={18} />
          </button>
        </div>

        {/* Counter */}
        <div className="mt-3 flex items-center gap-2">
          <div className="h-1 flex-1 bg-sgc-blue-900 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${count >= limit ? 'bg-red-500' : 'bg-sgc-orange'}`}
              style={{ width: `${(count / limit) * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-400 whitespace-nowrap">
            {count}/{limit}
          </span>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-3 mt-3 p-2 bg-red-500/20 border border-red-500/50 rounded-lg flex items-start gap-2 shrink-0">
          <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
          <span className="text-red-300 text-xs flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-300 shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto p-2 md:p-2 p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-sgc-orange border-t-transparent" />
          </div>
        ) : chats.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <MessageSquare size={48} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">Нет сохранённых чатов</p>
            <p className="text-xs mt-1 text-gray-600">Начните новый диалог, и он появится здесь</p>
          </div>
        ) : (
          <div className="space-y-2 md:space-y-1">
            {chats.map((chat) => (
              <div
                key={chat.id}
                className={`group relative rounded-lg transition-all ${
                  chat.id === currentChatId
                    ? "bg-sgc-orange/20 border border-sgc-orange/50"
                    : "hover:bg-sgc-blue-700 md:hover:bg-sgc-blue-700 active:bg-sgc-blue-700"
                }`}
              >
                {editingChatId === chat.id ? (
                  <div className="flex items-center gap-1 p-3 md:p-2">
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(chat.id);
                        if (e.key === "Escape") setEditingChatId(null);
                      }}
                      className="flex-1 bg-sgc-blue-900 text-white text-sm md:text-xs px-2 py-1 rounded border border-sgc-blue-500 focus:outline-none focus:border-sgc-orange"
                    />
                    <button
                      onClick={() => handleRename(chat.id)}
                      className="p-2 md:p-1 text-green-400 hover:text-green-300"
                    >
                      <Check size={18} className="md:hidden" />
                      <Check size={14} className="hidden md:block" />
                    </button>
                    <button
                      onClick={() => setEditingChatId(null)}
                      className="p-2 md:p-1 text-gray-400 hover:text-gray-300"
                    >
                      <X size={18} className="md:hidden" />
                      <X size={14} className="hidden md:block" />
                    </button>
                  </div>
                ) : showDeleteConfirm === chat.id ? (
                  <div className="p-3 md:p-2">
                    <p className="text-sm md:text-xs text-gray-300 mb-2">Удалить этот чат?</p>
                    <div className="flex gap-2 md:gap-1">
                      <button
                        onClick={() => handleDelete(chat.id)}
                        className="flex-1 py-2 md:py-1 bg-red-600 hover:bg-red-500 text-white text-sm md:text-xs rounded"
                      >
                        Да, удалить
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(null)}
                        className="flex-1 py-2 md:py-1 bg-gray-600 hover:bg-gray-500 text-white text-sm md:text-xs rounded"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <button
                      onClick={() => handleSelectChat(chat.id)}
                      className="flex-1 text-left p-3 md:p-2 md:pr-14"
                    >
                      <div className="text-sm md:text-xs text-white truncate">{chat.title}</div>
                      <div className="text-xs md:text-[10px] text-gray-500 mt-0.5">
                        {formatDate(chat.updated_at)}
                      </div>
                    </button>

                    {/* Кнопки действий - видны всегда на мобиле, на ховер на десктопе */}
                    <div className="flex gap-1 pr-2 md:absolute md:right-1 md:top-1/2 md:-translate-y-1/2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditTitle(chat.title);
                          setEditingChatId(chat.id);
                        }}
                        className="p-2 md:p-1 text-gray-400 hover:text-white hover:bg-sgc-blue-600 rounded"
                        title="Переименовать"
                      >
                        <Pencil size={16} className="md:hidden" />
                        <Pencil size={12} className="hidden md:block" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDeleteConfirm(chat.id);
                        }}
                        className="p-2 md:p-1 text-gray-400 hover:text-red-400 hover:bg-red-500/20 rounded"
                        title="Удалить"
                      >
                        <Trash2 size={16} className="md:hidden" />
                        <Trash2 size={12} className="hidden md:block" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer - Clear All */}
      {chats.length > 0 && (
        <div className="p-4 md:p-3 border-t border-sgc-blue-600 shrink-0">
          {showClearConfirm ? (
            <div>
              <p className="text-sm md:text-xs text-gray-300 mb-3 md:mb-2 text-center">
                Удалить все {count} чатов?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleClearAll}
                  className="flex-1 py-2.5 md:py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm md:text-xs rounded"
                >
                  Удалить всё
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 py-2.5 md:py-1.5 bg-gray-600 hover:bg-gray-500 text-white text-sm md:text-xs rounded"
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="w-full py-2.5 md:py-1.5 text-gray-500 hover:text-red-400 text-sm md:text-xs flex items-center justify-center gap-2 md:gap-1 rounded transition-colors"
            >
              <Trash2 size={16} className="md:hidden" />
              <Trash2 size={12} className="hidden md:block" />
              <span>Очистить историю</span>
            </button>
          )}
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Toggle Button - always visible on right edge */}
      <button
        onClick={() => onToggle(!isOpen)}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-50 bg-sgc-orange hover:bg-orange-500 text-white shadow-lg rounded-l-lg"
        title={isOpen ? "Скрыть историю" : "История чатов"}
      >
        <div className="flex flex-col items-center py-4 px-2">
          <History size={20} className="mb-1" />
          <span
            className="text-[10px] font-bold uppercase tracking-wide"
            style={{
              writingMode: "vertical-rl",
              textOrientation: "mixed",
            }}
          >
            История
          </span>
          <ChevronRight
            size={14}
            className={`mt-1 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Mobile: Full-screen overlay */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 z-[100] flex flex-col"
          style={{ backgroundColor: '#0a1628' }}
        >
          {panelContent}
        </div>
      )}

      {/* Desktop: Sidebar Panel */}
      <div
        className={`hidden md:flex min-h-screen bg-sgc-blue-800 border-l border-sgc-blue-500 flex-col transition-all duration-300 ease-in-out overflow-hidden ${
          isOpen ? "w-72" : "w-0 border-l-0"
        }`}
      >
        {panelContent}
      </div>
    </>
  );
}
