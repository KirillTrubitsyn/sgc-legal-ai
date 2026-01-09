"use client";

interface Props {
  message?: string;
}

export default function LoadingSpinner({ message = "Анализирую запрос..." }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-8">
      {/* Animated neural network spinner */}
      <div className="relative w-24 h-24">
        {/* Central pulsing node */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full animate-pulse shadow-[0_0_20px_rgba(255,255,255,0.8)]" />

        {/* Orbiting nodes */}
        <div className="absolute inset-0 animate-spin-slow">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-sgc-orange-500 rounded-full shadow-[0_0_10px_rgba(247,148,29,0.8)]" />
        </div>
        <div className="absolute inset-0 animate-spin-slow-reverse">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-sgc-orange-500 rounded-full shadow-[0_0_10px_rgba(247,148,29,0.8)]" />
        </div>
        <div className="absolute inset-0 animate-spin-medium">
          <div className="absolute top-1/2 left-0 -translate-y-1/2 w-2.5 h-2.5 bg-sgc-orange-400 rounded-full shadow-[0_0_8px_rgba(247,148,29,0.6)]" />
        </div>
        <div className="absolute inset-0 animate-spin-medium-reverse">
          <div className="absolute top-1/2 right-0 -translate-y-1/2 w-2.5 h-2.5 bg-sgc-orange-400 rounded-full shadow-[0_0_8px_rgba(247,148,29,0.6)]" />
        </div>

        {/* Connecting lines (SVG) */}
        <svg className="absolute inset-0 w-full h-full animate-pulse" viewBox="0 0 100 100">
          <line x1="50" y1="50" x2="50" y2="10" stroke="#f7941d" strokeWidth="1" opacity="0.5" />
          <line x1="50" y1="50" x2="50" y2="90" stroke="#f7941d" strokeWidth="1" opacity="0.5" />
          <line x1="50" y1="50" x2="10" y2="50" stroke="#f7941d" strokeWidth="1" opacity="0.5" />
          <line x1="50" y1="50" x2="90" y2="50" stroke="#f7941d" strokeWidth="1" opacity="0.5" />
          {/* Diagonal connections */}
          <line x1="50" y1="50" x2="20" y2="20" stroke="#f7941d" strokeWidth="0.5" opacity="0.3" className="animate-dash" />
          <line x1="50" y1="50" x2="80" y2="20" stroke="#f7941d" strokeWidth="0.5" opacity="0.3" className="animate-dash" />
          <line x1="50" y1="50" x2="20" y2="80" stroke="#f7941d" strokeWidth="0.5" opacity="0.3" className="animate-dash" />
          <line x1="50" y1="50" x2="80" y2="80" stroke="#f7941d" strokeWidth="0.5" opacity="0.3" className="animate-dash" />
        </svg>

        {/* Outer ring */}
        <div className="absolute inset-0 border-2 border-sgc-orange-500/30 rounded-full animate-ping-slow" />
        <div className="absolute inset-2 border border-sgc-blue-400/20 rounded-full animate-ping-slower" />
      </div>

      {/* Loading text with typing effect */}
      <div className="mt-6 text-gray-300 text-sm flex items-center gap-1">
        <span>{message}</span>
        <span className="inline-flex">
          <span className="animate-bounce-dot-1">.</span>
          <span className="animate-bounce-dot-2">.</span>
          <span className="animate-bounce-dot-3">.</span>
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-3 w-32 h-1 bg-sgc-blue-700 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-sgc-orange-500 to-sgc-orange-400 rounded-full animate-progress" />
      </div>
    </div>
  );
}
