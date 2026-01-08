"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginWithInvite } from "@/lib/api";

export default function InviteForm() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await loginWithInvite(code);

      // Сохранить токен
      localStorage.setItem("sgc_token", data.token);
      localStorage.setItem("sgc_user", data.user_name);

      // Перейти в чат
      router.push("/chat");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Произошла ошибка");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md">
      <div className="mb-4">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Введите инвайт-код"
          className="w-full px-4 py-3 bg-sgc-blue-700 border border-sgc-blue-500 rounded-lg
                     text-white placeholder-gray-400 focus:outline-none focus:border-sgc-orange-500
                     text-center text-lg tracking-widest"
          disabled={loading}
        />
      </div>

      {error && (
        <p className="text-red-400 text-sm mb-4 text-center">{error}</p>
      )}

      <button
        type="submit"
        disabled={!code || loading}
        className="w-full py-3 bg-sgc-orange-500 hover:bg-orange-600 disabled:bg-gray-600
                   rounded-lg font-semibold transition-colors"
      >
        {loading ? "Проверка..." : "Войти"}
      </button>

      <a
        href="/admin"
        className="block mt-4 text-center text-gray-500 hover:text-gray-400 text-xs"
      >
        Вход для администратора
      </a>
    </form>
  );
}
