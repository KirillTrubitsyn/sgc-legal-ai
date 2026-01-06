const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function loginWithInvite(code: string) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Ошибка авторизации");
  }

  return res.json();
}

export async function validateToken(token: string) {
  const res = await fetch(`${API_URL}/api/auth/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

  return res.ok;
}
