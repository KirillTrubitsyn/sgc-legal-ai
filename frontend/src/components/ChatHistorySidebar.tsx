"use client";

import { useState, useEffect, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  MessageSquare,
  Pencil,
  Trash2,
  X,
  Check,
  AlertCircle,
  History,
} from "lucide-react";
import {
  ChatSession,
  getChatSessions,
  createChatSession,
  renameChatSession,
  deleteChatSession,
  deleteAllChatSessions,
} from "@/lib/api";

interface ChatHistorySidebarProps {
  token: string;
  currentChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  onChatCreated: (chat: ChatSession) => void;
}

export default function ChatHistorySidebar({
  token,
  currentChatId,
  onSelectChat,
  onNewChat,
  onChatCreated,
}: ChatHistorySidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [count, setCount] = useState(0);
  const [limit, setLimit] = useState(20);
  const [canCreate, setCanCreate] = useState(true);
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
      setChats(data.chats);
      setCount(data.count);
      setLimit(data.limit);
      setCanCreate(data.can_create);
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

  const handleCreateChat = async () => {
    if (!canCreate) {
      setError(`Достигнут лимит чатов (${limit}). Удалите старые чаты.`);
      return;
    }

    try {
      const data = await createChatSession(token);
      setChats((prev) => [data.chat, ...prev]);
      setCount(data.count);
      setCanCreate(data.count < data.limit);
      onChatCreated(data.chat);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Ошибка создания чата";
      setError(errorMessage);
    }
  };

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
      setCanCreate(true);
      setShowDeleteConfirm(null);

      // If deleting current chat, trigger new chat
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
      setCanCreate(true);
      setShowClearConfirm(false);
      onNewChat();
    } catch (err) {
      console.error("Failed to clear history:", err);
      setError("Не удалось очистить историю");
    }
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

  return (
    <>
      {/* Toggle Button - visible tab on right edge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed right-0 top-1/2 -translate-y-1/2 z-40 flex items-center gap-2 py-3 px-2 rounded-l-xl shadow-lg transition-all ${
          isOpen
            ? "bg-sgc-blue-700 text-white"
            : "bg-sgc-orange hover:bg-sgc-orange/90 text-white"
        }`}
        title={isOpen ? "Скрыть историю" : "История чатов"}
      >
        <div className="flex flex-col items-center gap-1">
          <History size={20} />
          <span className="text-xs font-medium writing-mode-vertical" style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}>
            История
          </span>
        </div>
        {isOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar - slides from right */}
      <div
        className={`fixed right-0 top-0 h-full z-50 bg-sgc-blue-800 border-l border-sgc-blue-600 shadow-2xl transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        } w-80 flex flex-col`}
      >
        {/* Header */}
        <div className="p-4 border-b border-sgc-blue-600 bg-sgc-blue-700">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <History size={20} className="text-sgc-orange" />
              <h2 className="text-white font-semibold text-lg">История чатов</h2>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white p-1 hover:bg-sgc-blue-600 rounded"
            >
              <X size={20} />
            </button>
          </div>

          {/* New Chat Button */}
          <button
            onClick={handleCreateChat}
            disabled={!canCreate}
            className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium transition-colors ${
              canCreate
                ? "bg-sgc-orange hover:bg-sgc-orange/90 text-white"
                : "bg-gray-600 text-gray-400 cursor-not-allowed"
            }`}
          >
            <Plus size={20} />
            <span>Новый чат</span>
          </button>

          {/* Counter */}
          <div className="mt-3 flex items-center justify-center gap-2">
            <div className="h-1.5 flex-1 bg-sgc-blue-900 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${count >= limit ? 'bg-red-500' : 'bg-sgc-orange'}`}
                style={{ width: `${(count / limit) * 100}%` }}
              />
            </div>
            <span className="text-sm text-gray-400 whitespace-nowrap">
              {count} / {limit}
            </span>
          </div>
          {!canCreate && (
            <p className="text-yellow-500 text-xs text-center mt-1">
              Лимит достигнут
            </p>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-4 mt-3 p-3 bg-red-500/20 border border-red-500/50 rounded-lg flex items-start gap-2">
            <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
            <span className="text-red-300 text-sm flex-1">{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-300 shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto p-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-sgc-orange border-t-transparent" />
            </div>
          ) : chats.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <MessageSquare size={48} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">Нет сохранённых чатов</p>
              <p className="text-xs mt-1 text-gray-600">Начните новый диалог</p>
            </div>
          ) : (
            <div className="space-y-2">
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  className={`group relative rounded-lg transition-all ${
                    chat.id === currentChatId
                      ? "bg-sgc-blue-600 ring-2 ring-sgc-orange/50"
                      : "bg-sgc-blue-700/50 hover:bg-sgc-blue-700"
                  }`}
                >
                  {editingChatId === chat.id ? (
                    // Edit Mode
                    <div className="flex items-center gap-2 p-3">
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRename(chat.id);
                          if (e.key === "Escape") setEditingChatId(null);
                        }}
                        className="flex-1 bg-sgc-blue-900 text-white text-sm px-3 py-1.5 rounded border border-sgc-blue-500 focus:outline-none focus:border-sgc-orange"
                      />
                      <button
                        onClick={() => handleRename(chat.id)}
                        className="p-1.5 text-green-400 hover:text-green-300 hover:bg-green-500/20 rounded"
                      >
                        <Check size={18} />
                      </button>
                      <button
                        onClick={() => setEditingChatId(null)}
                        className="p-1.5 text-gray-400 hover:text-gray-300 hover:bg-gray-500/20 rounded"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ) : showDeleteConfirm === chat.id ? (
                    // Delete Confirmation
                    <div className="p-3">
                      <p className="text-sm text-gray-300 mb-3">Удалить этот чат?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDelete(chat.id)}
                          className="flex-1 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg font-medium"
                        >
                          Удалить
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(null)}
                          className="flex-1 py-1.5 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded-lg"
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Normal Mode
                    <button
                      onClick={() => {
                        onSelectChat(chat.id);
                        // Close sidebar on mobile after selection
                        if (window.innerWidth < 1024) {
                          setIsOpen(false);
                        }
                      }}
                      className="w-full text-left p-3 pr-20"
                    >
                      <div className="flex items-start gap-2">
                        <MessageSquare size={16} className="text-gray-500 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-white truncate font-medium">{chat.title}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {formatDate(chat.updated_at)}
                          </div>
                        </div>
                      </div>
                    </button>
                  )}

                  {/* Action Buttons */}
                  {!editingChatId && !showDeleteConfirm && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditTitle(chat.title);
                          setEditingChatId(chat.id);
                        }}
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-sgc-blue-500 rounded"
                        title="Переименовать"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDeleteConfirm(chat.id);
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/20 rounded"
                        title="Удалить"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer - Clear All */}
        {chats.length > 0 && (
          <div className="p-4 border-t border-sgc-blue-600 bg-sgc-blue-700/50">
            {showClearConfirm ? (
              <div>
                <p className="text-sm text-gray-300 mb-3 text-center">
                  Удалить все {count} чатов?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleClearAll}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg font-medium"
                  >
                    Удалить все
                  </button>
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded-lg"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="w-full py-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 text-sm flex items-center justify-center gap-2 rounded-lg transition-colors"
              >
                <Trash2 size={16} />
                <span>Очистить всю историю</span>
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
