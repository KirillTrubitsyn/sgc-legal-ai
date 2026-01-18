"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import InviteForm from "@/components/InviteForm";

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem("sgc_token");
    if (token) {
      // Redirect to chat if token exists
      router.push("/chat");
    } else {
      setChecking(false);
    }
  }, [router]);

  // Show nothing while checking auth
  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Загрузка...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      {/* Logo */}
      <div className="mb-8 text-center">
        <img
          src="/sgc-logo-main.svg"
          alt="SGC Legal AI"
          className="h-24 mx-auto mb-4"
        />
        <p className="text-gray-400 text-sm">
          AI-ассистент юридической службы
        </p>
        <p className="text-gray-500 text-xs">
          Сибирская генерирующая компания
        </p>
      </div>

      {/* Invite Form */}
      <InviteForm />

      {/* Footer */}
      <footer className="mt-12 text-gray-500 text-xs text-center">
        <div>Разработка @Кирилл Трубицын</div>
      </footer>
    </main>
  );
}
