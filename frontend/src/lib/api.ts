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

export interface Model {
  id: string;
  name: string;
  description: string;
  price_per_1k: number;
}

export async function getModels(token: string): Promise<Model[]> {
  const res = await fetch(`${API_URL}/api/query/models`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error("Failed to fetch models");
  const data = await res.json();
  return data.models;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export async function sendQuery(
  token: string,
  model: string,
  messages: Message[],
  onChunk: (chunk: string) => void
): Promise<void> {
  const res = await fetch(`${API_URL}/api/query/single`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ model, messages, stream: true }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Query failed");
  }

  const reader = res.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) throw new Error("No response body");

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value);
    const lines = text.split("\n");

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") return;

        try {
          const parsed = JSON.parse(data);
          if (parsed.error) throw new Error(parsed.error);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) onChunk(content);
        } catch (e) {
          // Skip non-JSON lines
        }
      }
    }
  }
}

// Consilium types and functions

export interface ConsiliumResult {
  question: string;
  started_at: string;
  completed_at: string;
  stages: {
    stage_1: Record<string, ModelOpinion>;
    stage_2: CaseReference[];
    stage_3: VerifiedCase[];
    stage_4: PeerReview;
    stage_5: { synthesis: string };
  };
  final_answer: string;
  verified_cases: VerifiedCase[];
}

export interface ModelOpinion {
  model: string;
  name: string;
  content: string;
  tokens?: number;
  error?: boolean;
}

export interface CaseReference {
  case_number: string;
  court: string;
  date: string;
  summary: string;
  source_model: string;
}

export interface VerifiedCase extends CaseReference {
  status: "VERIFIED" | "LIKELY_EXISTS" | "NOT_FOUND" | "NEEDS_MANUAL_CHECK";
  verification: Record<string, unknown>;
}

export interface PeerReview {
  reviews: Record<string, {
    legal_accuracy: number;
    practical_value: number;
    source_reliability: number;
    argumentation: number;
    total: number;
    strengths: string[];
    weaknesses: string[];
  }>;
  ranking: string[];
}

export interface StageUpdate {
  stage: string;
  message?: string;
  result?: ConsiliumResult;
}

export async function runConsilium(
  token: string,
  question: string,
  onStageUpdate: (update: StageUpdate) => void
): Promise<ConsiliumResult> {
  const res = await fetch(`${API_URL}/api/consilium/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ question }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Consilium failed");
  }

  const reader = res.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) throw new Error("No response body");

  let finalResult: ConsiliumResult | null = null;
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process complete lines from buffer
    const lines = buffer.split("\n");
    // Keep the last incomplete line in buffer
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6).trim();
        if (data === "[DONE]") {
          if (finalResult) return finalResult;
          throw new Error("No result received");
        }

        if (!data) continue;

        try {
          const parsed = JSON.parse(data) as StageUpdate;
          onStageUpdate(parsed);

          if (parsed.stage === "complete" && parsed.result) {
            finalResult = parsed.result;
          }
        } catch (e) {
          // JSON parse error - might be incomplete, skip
          console.log("Parse error:", e, "Data:", data.substring(0, 100));
        }
      }
    }
  }

  // Process any remaining data in buffer
  if (buffer.trim()) {
    const lines = buffer.split("\n");
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6).trim();
        if (data === "[DONE]") {
          if (finalResult) return finalResult;
          throw new Error("No result received");
        }

        if (!data) continue;

        try {
          const parsed = JSON.parse(data) as StageUpdate;
          onStageUpdate(parsed);

          if (parsed.stage === "complete" && parsed.result) {
            finalResult = parsed.result;
          }
        } catch (e) {
          console.log("Final parse error:", e, "Data:", data.substring(0, 100));
        }
      }
    }
  }

  if (finalResult) return finalResult;
  throw new Error("Stream ended without result");
}

// File upload types and functions

export interface FileUploadResult {
  success: boolean;
  file_type: string;
  extracted_text: string;
  summary: string;
  error?: string;
}

export async function uploadFile(
  token: string,
  file: File
): Promise<FileUploadResult> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_URL}/api/files/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Ошибка загрузки файла");
  }

  return res.json();
}

export interface SupportedFormats {
  formats: {
    documents: { extensions: string[]; description: string };
    images: { extensions: string[]; description: string };
    audio: { extensions: string[]; description: string };
  };
  limits: {
    max_file_size_mb: number;
    max_audio_duration_sec: number;
  };
}

export async function getSupportedFormats(): Promise<SupportedFormats> {
  const res = await fetch(`${API_URL}/api/files/supported`);
  return res.json();
}

// Chat history API functions

export interface ChatHistoryMessage {
  id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  created_at: string;
}

export async function getChatHistory(token: string): Promise<ChatHistoryMessage[]> {
  const res = await fetch(`${API_URL}/api/query/history`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    return [];
  }

  const data = await res.json();
  return data.messages || [];
}

export async function clearChatHistory(token: string): Promise<void> {
  await fetch(`${API_URL}/api/query/history`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

// Saved responses API functions

export interface SavedResponse {
  id: string;
  user_id: string;
  question: string;
  answer: string;
  model?: string;
  created_at: string;
}

export async function saveResponse(
  token: string,
  question: string,
  answer: string,
  model?: string
): Promise<{ id: string }> {
  const res = await fetch(`${API_URL}/api/query/saved`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ question, answer, model }),
  });

  if (!res.ok) {
    throw new Error("Не удалось сохранить ответ");
  }

  return res.json();
}

export async function getSavedResponses(token: string): Promise<SavedResponse[]> {
  const res = await fetch(`${API_URL}/api/query/saved`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    return [];
  }

  const data = await res.json();
  return data.responses || [];
}

export async function deleteSavedResponse(token: string, responseId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/query/saved/${responseId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error("Не удалось удалить ответ");
  }
}

// Admin API functions

export interface InviteCode {
  id: string;
  code: string;
  name: string;
  uses_remaining: number;
  created_at: string;
}

export async function adminLogin(password: string): Promise<{ token: string }> {
  const res = await fetch(`${API_URL}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Ошибка авторизации");
  }

  return res.json();
}

export async function adminLogout(token: string): Promise<void> {
  await fetch(`${API_URL}/api/admin/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getInviteCodes(token: string): Promise<InviteCode[]> {
  const res = await fetch(`${API_URL}/api/admin/invite-codes`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error("Не удалось получить инвайт-коды");
  }

  return res.json();
}

export async function createInviteCode(
  token: string,
  name: string,
  uses: number,
  code?: string
): Promise<InviteCode> {
  const res = await fetch(`${API_URL}/api/admin/invite-codes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name, uses, code }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Не удалось создать инвайт-код");
  }

  return res.json();
}

export async function deleteInviteCode(
  token: string,
  codeId: string
): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/invite-codes/${codeId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error("Не удалось удалить инвайт-код");
  }
}

export async function updateInviteCodeUses(
  token: string,
  codeId: string,
  uses: number
): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/invite-codes/${codeId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ uses }),
  });

  if (!res.ok) {
    throw new Error("Не удалось обновить инвайт-код");
  }
}

// Export functions

export async function exportAsDocx(
  token: string,
  question: string,
  answer: string,
  model?: string
): Promise<Blob> {
  const res = await fetch(`${API_URL}/api/query/export/docx`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ question, answer, model }),
  });

  if (!res.ok) {
    throw new Error("Не удалось экспортировать документ");
  }

  return res.blob();
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Web Search API functions

export async function webSearch(
  token: string,
  query: string,
  onChunk: (chunk: string) => void,
  context?: string
): Promise<void> {
  const res = await fetch(`${API_URL}/api/query/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, context, stream: true }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Search failed");
  }

  const reader = res.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) throw new Error("No response body");

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value);
    const lines = text.split("\n");

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") return;

        try {
          const parsed = JSON.parse(data);
          if (parsed.error) throw new Error(parsed.error);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) onChunk(content);
        } catch {
          // Skip non-JSON lines
        }
      }
    }
  }
}
