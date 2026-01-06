import InviteForm from "@/components/InviteForm";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      {/* Logo */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold mb-2">
          <span className="text-sgc-orange-500">SGC</span> Legal AI
        </h1>
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
      <footer className="mt-12 text-gray-500 text-xs">
        © 2026 СГК. Для внутреннего использования.
      </footer>
    </main>
  );
}
