import InviteForm from "@/components/InviteForm";

export default function Home() {
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
      <footer className="mt-12 text-gray-500 text-xs">
        © 2026 СГК. Для внутреннего использования.
      </footer>
    </main>
  );
}
