"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ChatPage() {
  const [userName, setUserName] = useState("");
  const router = useRouter();

  useEffect(() => {
    // Проверить авторизацию
    const token = localStorage.getItem("sgc_token");
    const user = localStorage.getItem("sgc_user");

    if (!token) {
      router.push("/");
      return;
    }

    setUserName(user || "Пользователь");
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("sgc_token");
    localStorage.removeItem("sgc_user");
    router.push("/");
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-sgc-blue-700 border-b border-sgc-blue-500 px-6 py-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div>
            <h1 className="text-xl font-bold">
              <span className="text-sgc-orange-500">SGC</span> Legal AI
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-sm">{userName}</span>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-white text-sm"
            >
              Выйти
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🏗️</div>
          <h2 className="text-2xl font-semibold mb-2">Интерфейс в разработке</h2>
          <p className="text-gray-400">
            Этап 1 завершён. Авторизация работает.
          </p>
          <p className="text-gray-500 text-sm mt-4">
            Следующий этап: Single Query режим
          </p>
        </div>
      </main>
    </div>
  );
}
