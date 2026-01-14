"use client";

import { useState, useEffect } from "react";
import {
  adminLogin,
  adminLogout,
  getInviteCodesDetailed,
  createInviteCode,
  deleteInviteCode,
  resetInviteCode,
  getUsageStats,
  InviteCodeWithUsers,
  UsageStats,
  InviteCodesDetailedResponse,
} from "@/lib/api";

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Invite codes state
  const [codes, setCodes] = useState<InviteCodeWithUsers[]>([]);
  const [codesError, setCodesError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newUses, setNewUses] = useState(1);
  const [newCode, setNewCode] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);

  // Stats state
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [statsDays, setStatsDays] = useState(30);
  const [recentLimit, setRecentLimit] = useState(10);
  const [activeTab, setActiveTab] = useState<"codes" | "stats">("codes");

  // Expanded rows for showing users
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Check for existing admin session
  useEffect(() => {
    const savedToken = localStorage.getItem("admin_token");
    if (savedToken) {
      setToken(savedToken);
    }
  }, []);

  // Load invite codes when authenticated
  useEffect(() => {
    if (token) {
      loadCodes();
      loadStats();
    }
  }, [token]);

  // Reload stats when days or recentLimit change
  useEffect(() => {
    if (token && activeTab === "stats") {
      loadStats();
    }
  }, [statsDays, recentLimit]);

  const loadCodes = async () => {
    if (!token) return;
    try {
      const data = await getInviteCodesDetailed(token);
      setCodes(data.codes);
      setCodesError(data.error || null);
    } catch (err) {
      console.error("Failed to load codes:", err);
      setCodesError(err instanceof Error ? err.message : "Ошибка загрузки");
    }
  };

  const loadStats = async () => {
    if (!token) return;
    try {
      const data = await getUsageStats(token, statsDays, recentLimit);
      setStats(data);
    } catch (err) {
      console.error("Failed to load stats:", err);
      setStats({
        total_requests: 0,
        successful_requests: 0,
        failed_requests: 0,
        by_model: {},
        by_type: {},
        by_user: {},
        recent: [],
        period_days: statsDays,
        error: err instanceof Error ? err.message : "Ошибка загрузки"
      });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await adminLogin(password);
      setToken(result.token);
      localStorage.setItem("admin_token", result.token);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка авторизации");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (token) {
      await adminLogout(token);
    }
    setToken(null);
    localStorage.removeItem("admin_token");
    setCodes([]);
    setCodesError(null);
    setStats(null);
  };

  const handleCreateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newName.trim()) return;

    setCreating(true);
    try {
      await createInviteCode(
        token,
        newName.trim(),
        newUses,
        newCode.trim() || undefined,
        newDescription.trim() || undefined
      );
      setNewName("");
      setNewCode("");
      setNewUses(1);
      setNewDescription("");
      await loadCodes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка создания кода");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCode = async (codeId: string) => {
    if (!token) return;
    if (!confirm("Удалить этот инвайт-код?")) return;

    try {
      await deleteInviteCode(token, codeId);
      await loadCodes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка удаления");
    }
  };

  const handleResetCode = async (codeId: string) => {
    if (!token) return;
    if (
      !confirm(
        "Сбросить этот код? Все связанные пользователи будут удалены, код станет доступным для повторного использования."
      )
    )
      return;

    try {
      await resetInviteCode(token, codeId, 1);
      await loadCodes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сброса");
    }
  };

  const toggleRow = (codeId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(codeId)) {
        next.delete(codeId);
      } else {
        next.add(codeId);
      }
      return next;
    });
  };

  // Login form
  if (!token) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2">
            <span className="text-sgc-orange-500">SGC</span> Admin Panel
          </h1>
          <p className="text-gray-400 text-sm">Панель администратора</p>
        </div>

        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm bg-gray-800 rounded-lg p-6"
        >
          <div className="mb-4">
            <label className="block text-gray-300 text-sm mb-2">
              Пароль администратора
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-700 text-white rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sgc-orange-500"
              placeholder="Введите пароль"
              autoFocus
            />
          </div>

          {error && (
            <div className="mb-4 text-red-400 text-sm text-center">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-sgc-orange-500 hover:bg-sgc-orange-600 disabled:bg-gray-600 text-white font-semibold py-2 px-4 rounded transition-colors"
          >
            {loading ? "Вход..." : "Войти"}
          </button>
        </form>

        <a
          href="/"
          className="mt-4 text-gray-400 hover:text-gray-300 text-sm"
        >
          Вернуться на главную
        </a>
      </main>
    );
  }

  // Admin panel
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold">
              <span className="text-sgc-orange-500">SGC</span> Admin Panel
            </h1>
            <p className="text-gray-400 text-sm">
              Управление инвайт-кодами и статистика
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="text-gray-400 hover:text-white text-sm"
          >
            Выйти
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-900/50 text-red-300 rounded p-3 text-sm">
            {error}
            <button
              onClick={() => setError("")}
              className="float-right text-red-400 hover:text-red-300"
            >
              x
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("codes")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "codes"
                ? "bg-sgc-orange-500 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            Инвайт-коды
          </button>
          <button
            onClick={() => setActiveTab("stats")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "stats"
                ? "bg-sgc-orange-500 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            Статистика
          </button>
        </div>

        {/* Invite Codes Tab */}
        {activeTab === "codes" && (
          <>
            {/* Create new code form - all fields in rows */}
            <div className="bg-gray-800 rounded-lg p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">
                Создать инвайт-код
              </h2>
              <form onSubmit={handleCreateCode} className="space-y-4">
                {/* Row 1: Name, Uses, Code, Button */}
                <div className="grid grid-cols-12 gap-4 items-end">
                  <div className="col-span-4">
                    <label className="block text-gray-400 text-xs mb-1">
                      Имя пользователя *
                    </label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sgc-orange-500"
                      placeholder="Иванов И.И."
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-gray-400 text-xs mb-1">
                      Использований
                    </label>
                    <input
                      type="number"
                      value={newUses}
                      onChange={(e) => setNewUses(parseInt(e.target.value) || 1)}
                      min={1}
                      className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sgc-orange-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-gray-400 text-xs mb-1">
                      Код (авто)
                    </label>
                    <input
                      type="text"
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                      className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sgc-orange-500 font-mono"
                      placeholder="АВТО"
                      maxLength={12}
                    />
                  </div>
                  <div className="col-span-4">
                    <label className="block text-gray-400 text-xs mb-1">
                      Кто это / заметки
                    </label>
                    <input
                      type="text"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sgc-orange-500"
                      placeholder="Тестировщик из компании X"
                    />
                  </div>
                </div>
                {/* Button */}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={creating || !newName.trim()}
                    className="bg-sgc-orange-500 hover:bg-sgc-orange-600 disabled:bg-gray-600 text-white font-semibold py-2 px-8 rounded transition-colors text-sm"
                  >
                    {creating ? "Создание..." : "Создать"}
                  </button>
                </div>
              </form>
            </div>

            {/* Codes list */}
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-700">
                <h2 className="text-lg font-semibold">
                  Инвайт-коды ({codes.length})
                </h2>
              </div>

              {codesError ? (
                <div className="p-4 m-4 bg-red-900/50 text-red-300 rounded-lg">
                  <p className="font-medium mb-2">Ошибка загрузки инвайт-кодов</p>
                  <p className="text-sm">{codesError}</p>
                  <p className="text-sm mt-2 text-gray-400">
                    Проверьте подключение к базе данных Supabase и наличие таблицы invite_codes.
                  </p>
                </div>
              ) : codes.length === 0 ? (
                <div className="p-6 text-center text-gray-400">
                  Нет инвайт-кодов
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-700/50">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">
                          Код
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">
                          Имя
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">
                          Описание
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">
                          Осталось
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">
                          Использован
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">
                          Создан
                        </th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {codes.map((code) => (
                        <>
                          <tr
                            key={code.id}
                            className="hover:bg-gray-700/30 cursor-pointer"
                            onClick={() =>
                              code.users.length > 0 && toggleRow(code.id)
                            }
                          >
                            <td className="px-4 py-3 font-mono text-sgc-orange-400 text-sm">
                              {code.code}
                              {code.users.length > 0 && (
                                <span className="ml-2 text-xs text-gray-500">
                                  {expandedRows.has(code.id) ? "▼" : "▶"}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm">{code.name}</td>
                            <td className="px-4 py-3 text-sm text-gray-400 max-w-[200px] truncate">
                              {code.description || "—"}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span
                                className={
                                  code.uses_remaining > 0
                                    ? "text-green-400"
                                    : "text-red-400"
                                }
                              >
                                {code.uses_remaining}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {code.users.length > 0 ? (
                                <span className="text-blue-400">
                                  {code.users.length} чел.
                                </span>
                              ) : (
                                <span className="text-gray-500">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-400 text-sm">
                              {new Date(code.created_at).toLocaleDateString(
                                "ru-RU"
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex gap-2 justify-end">
                                {code.users.length > 0 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleResetCode(code.id);
                                    }}
                                    className="text-yellow-400 hover:text-yellow-300 text-sm"
                                    title="Сбросить код"
                                  >
                                    Сбросить
                                  </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteCode(code.id);
                                  }}
                                  className="text-red-400 hover:text-red-300 text-sm"
                                >
                                  Удалить
                                </button>
                              </div>
                            </td>
                          </tr>
                          {expandedRows.has(code.id) &&
                            code.users.length > 0 && (
                              <tr key={`${code.id}-users`}>
                                <td
                                  colSpan={7}
                                  className="bg-gray-900/50 px-4 py-3"
                                >
                                  <div className="text-sm text-gray-400 mb-2">
                                    Пользователи:
                                  </div>
                                  <div className="space-y-1">
                                    {code.users.map((user) => (
                                      <div
                                        key={user.id}
                                        className="flex items-center gap-4 text-sm"
                                      >
                                        <span className="text-white">
                                          {user.name}
                                        </span>
                                        <span className="text-gray-500">
                                          {new Date(
                                            user.created_at
                                          ).toLocaleDateString("ru-RU", {
                                            day: "numeric",
                                            month: "short",
                                            year: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          })}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            )}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* Stats Tab */}
        {activeTab === "stats" && (
          <>
            {/* Period selector */}
            <div className="bg-gray-800 rounded-lg p-4 mb-6 flex items-center gap-4">
              <span className="text-gray-400 text-sm">Период:</span>
              <select
                value={statsDays}
                onChange={(e) => setStatsDays(parseInt(e.target.value))}
                className="bg-gray-700 text-white rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sgc-orange-500"
              >
                <option value={7}>7 дней</option>
                <option value={30}>30 дней</option>
                <option value={90}>90 дней</option>
                <option value={365}>1 год</option>
              </select>
              <button
                onClick={loadStats}
                className="text-sgc-orange-400 hover:text-sgc-orange-300 text-sm"
              >
                Обновить
              </button>
            </div>

            {!stats ? (
              <div className="text-center text-gray-400 py-8">
                Загрузка статистики...
              </div>
            ) : stats.error ? (
              <div className="bg-yellow-900/50 text-yellow-300 rounded-lg p-4 mb-6">
                <p className="font-medium mb-2">Таблица usage_stats не найдена</p>
                <p className="text-sm">Выполните SQL скрипт из файла SUPABASE_MIGRATION.sql в Supabase SQL Editor</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {/* Summary cards */}
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-gray-400 text-sm mb-1">
                    Всего запросов
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {stats.total_requests}
                  </div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-gray-400 text-sm mb-1">Успешных</div>
                  <div className="text-2xl font-bold text-green-400">
                    {stats.successful_requests}
                  </div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-gray-400 text-sm mb-1">Ошибок</div>
                  <div className="text-2xl font-bold text-red-400">
                    {stats.failed_requests}
                  </div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-gray-400 text-sm mb-1">
                    Уникальных пользователей
                  </div>
                  <div className="text-2xl font-bold text-blue-400">
                    {Object.keys(stats.by_user).length}
                  </div>
                </div>
              </div>
            )}

            {stats && !stats.error && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* By Model */}
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">По моделям</h3>
                  {Object.keys(stats.by_model).length === 0 ? (
                    <div className="text-gray-500 text-sm">Нет данных</div>
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(stats.by_model)
                        .sort((a, b) => b[1].count - a[1].count)
                        .map(([model, data]) => (
                          <div
                            key={model}
                            className="flex justify-between items-center"
                          >
                            <span className="text-sm text-gray-300 truncate max-w-[200px]">
                              {model.split("/").pop()}
                            </span>
                            <span className="text-sm font-mono text-sgc-orange-400">
                              {data.count}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* By Type */}
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">
                    По типу запроса
                  </h3>
                  {Object.keys(stats.by_type).length === 0 ? (
                    <div className="text-gray-500 text-sm">Нет данных</div>
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(stats.by_type)
                        .sort((a, b) => b[1] - a[1])
                        .map(([type, count]) => (
                          <div
                            key={type}
                            className="flex justify-between items-center"
                          >
                            <span className="text-sm text-gray-300">{type}</span>
                            <span className="text-sm font-mono text-sgc-orange-400">
                              {count}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Top Users */}
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">
                    Топ пользователей
                  </h3>
                  {Object.keys(stats.by_user).length === 0 ? (
                    <div className="text-gray-500 text-sm">Нет данных</div>
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(stats.by_user)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 10)
                        .map(([user, count]) => (
                          <div
                            key={user}
                            className="flex justify-between items-center"
                          >
                            <span className="text-sm text-gray-300">{user}</span>
                            <span className="text-sm font-mono text-sgc-orange-400">
                              {count}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Recent Activity */}
                <div className="bg-gray-800 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">
                      Последняя активность
                    </h3>
                    <select
                      value={recentLimit}
                      onChange={(e) => setRecentLimit(parseInt(e.target.value))}
                      className="bg-gray-700 text-white rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-sgc-orange-500"
                    >
                      <option value={10}>10 записей</option>
                      <option value={25}>25 записей</option>
                      <option value={50}>50 записей</option>
                      <option value={100}>100 записей</option>
                    </select>
                  </div>
                  {stats.recent.length === 0 ? (
                    <div className="text-gray-500 text-sm">Нет данных</div>
                  ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {stats.recent.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 text-sm"
                        >
                          <span
                            className={
                              item.success ? "text-green-400" : "text-red-400"
                            }
                          >
                            {item.success ? "✓" : "✗"}
                          </span>
                          <span className="text-gray-300 truncate">
                            {item.user_name}
                          </span>
                          <span className="text-gray-500">→</span>
                          <span className="text-gray-400 truncate">
                            {item.request_type}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
