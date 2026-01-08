"use client";

import { useState, useEffect } from "react";
import {
  adminLogin,
  adminLogout,
  getInviteCodes,
  createInviteCode,
  deleteInviteCode,
  InviteCode,
} from "@/lib/api";

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Invite codes state
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [newName, setNewName] = useState("");
  const [newUses, setNewUses] = useState(1);
  const [newCode, setNewCode] = useState("");
  const [creating, setCreating] = useState(false);

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
    }
  }, [token]);

  const loadCodes = async () => {
    if (!token) return;
    try {
      const data = await getInviteCodes(token);
      setCodes(data);
    } catch (err) {
      console.error("Failed to load codes:", err);
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
        newCode.trim() || undefined
      );
      setNewName("");
      setNewCode("");
      setNewUses(1);
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
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold">
              <span className="text-sgc-orange-500">SGC</span> Admin Panel
            </h1>
            <p className="text-gray-400 text-sm">Управление инвайт-кодами</p>
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

        {/* Create new code form */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Создать инвайт-код</h2>
          <form onSubmit={handleCreateCode} className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-gray-400 text-xs mb-1">
                Имя пользователя
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
            <div className="w-32">
              <label className="block text-gray-400 text-xs mb-1">
                Кол-во использований
              </label>
              <input
                type="number"
                value={newUses}
                onChange={(e) => setNewUses(parseInt(e.target.value) || 1)}
                min={1}
                className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sgc-orange-500"
              />
            </div>
            <div className="w-40">
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
            <div className="flex items-end">
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="bg-sgc-orange-500 hover:bg-sgc-orange-600 disabled:bg-gray-600 text-white font-semibold py-2 px-6 rounded transition-colors text-sm"
              >
                {creating ? "..." : "Создать"}
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

          {codes.length === 0 ? (
            <div className="p-6 text-center text-gray-400">
              Нет инвайт-кодов
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700/50">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase">
                      Код
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase">
                      Имя
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase">
                      Осталось
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase">
                      Создан
                    </th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {codes.map((code) => (
                    <tr key={code.id} className="hover:bg-gray-700/30">
                      <td className="px-6 py-4 font-mono text-sgc-orange-400">
                        {code.code}
                      </td>
                      <td className="px-6 py-4">{code.name}</td>
                      <td className="px-6 py-4">
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
                      <td className="px-6 py-4 text-gray-400 text-sm">
                        {new Date(code.created_at).toLocaleDateString("ru-RU")}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDeleteCode(code.id)}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          Удалить
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
