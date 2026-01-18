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

// Query modes for Single Query
export type QueryMode = "fast" | "thinking";

export interface Mode {
  id: QueryMode;
  name: string;
  icon: string;
}

export async function getModes(token: string): Promise<Mode[]> {
  const res = await fetch(`${API_URL}/api/query/modes`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error("Failed to fetch modes");
  const data = await res.json();
  return data.modes;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
}

// Stage update for single query with court practice integration
export interface SingleQueryStageUpdate {
  stage: string;
  message?: string;
}

// Result of single query including verified cases and NPA
export interface SingleQueryResult {
  content: string;
  verifiedCases: CourtPracticeCase[];
  verifiedNpa: VerifiedNpa[];
}

export async function sendQuery(
  token: string,
  messages: Message[],
  mode: QueryMode = "fast",
  searchEnabled: boolean = true,
  onChunk: (chunk: string) => void,
  onStageUpdate?: (update: SingleQueryStageUpdate) => void,
  fileContext?: string,
  chatSessionId?: string
): Promise<SingleQueryResult> {
  const res = await fetch(`${API_URL}/api/query/single`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messages,
      mode,
      search_enabled: searchEnabled,
      file_context: fileContext || null,
      chat_session_id: chatSessionId || null,
    }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Query failed");
  }

  const reader = res.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) throw new Error("No response body");

  let fullContent = "";
  let verifiedCases: CourtPracticeCase[] = [];
  let verifiedNpa: VerifiedNpa[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value);
      const lines = text.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") {
            return { content: fullContent, verifiedCases, verifiedNpa };
          }

          try {
            const parsed = JSON.parse(data);

            // Handle error
            if (parsed.error) {
              const errorMsg = typeof parsed.error === 'string'
                ? parsed.error
                : (typeof parsed.error === 'object' && parsed.error.message)
                  ? parsed.error.message
                  : JSON.stringify(parsed.error);
              throw new Error(errorMsg);
            }

            // Handle stage updates (search, extract, verify, npa_verify, generating)
            if (parsed.stage && onStageUpdate) {
              const stageMessage = typeof parsed.message === 'string'
                ? parsed.message
                : (parsed.message ? JSON.stringify(parsed.message) : '');
              onStageUpdate({ stage: parsed.stage, message: stageMessage });
              continue;
            }

            // Handle verified_cases at the end
            if (parsed.verified_cases) {
              verifiedCases = parsed.verified_cases;
              continue;
            }

            // Handle verified_npa at the end
            if (parsed.verified_npa) {
              verifiedNpa = parsed.verified_npa;
              continue;
            }

            // Handle LLM streaming chunks
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
              onChunk(content);
            }
          } catch (parseError) {
            // Re-throw if it's an actual error (not just JSON parse error)
            if (parseError instanceof Error && parseError.message && !parseError.message.includes('JSON')) {
              throw parseError;
            }
            // Skip non-JSON lines
          }
        }
      }
    }
  } catch (err) {
    // Handle connection errors (e.g., when app goes to background on mobile)
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    if (errorMessage.includes("Load failed") || errorMessage.includes("network") || errorMessage.includes("abort")) {
      throw new Error("Соединение прервано. Не сворачивайте приложение во время обработки запроса.");
    }
    throw err;
  }

  return { content: fullContent, verifiedCases, verifiedNpa };
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
    npa?: VerifiedNpa[];
  };
  final_answer: string;
  verified_cases: VerifiedCase[];
  verified_npa?: VerifiedNpa[];
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
  verification_source?: "damia_api" | "perplexity_google";
  verification: {
    exists?: boolean;
    confidence?: string;
    sources?: string[];
    links?: string[];
    damia_data?: Record<string, unknown>;
    actual_info?: string;
    [key: string]: unknown;
  };
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

  try {
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
            // Ensure message is always a string
            if (parsed.message && typeof parsed.message !== 'string') {
              parsed.message = JSON.stringify(parsed.message);
            }
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
  } catch (err) {
    // Handle connection errors (e.g., when app goes to background on mobile)
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    if (errorMessage.includes("Load failed") || errorMessage.includes("network") || errorMessage.includes("abort")) {
      throw new Error("Соединение прервано. Не сворачивайте приложение во время обработки запроса.");
    }
    throw err;
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
          // Ensure message is always a string
          if (parsed.message && typeof parsed.message !== 'string') {
            parsed.message = JSON.stringify(parsed.message);
          }
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

// Chat Sessions API functions (new history system)

export interface ChatSession {
  id: string;
  invite_code_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatSessionsResponse {
  chats: ChatSession[];
  count: number;
  limit: number;
  can_create: boolean;
}

export interface ChatSessionWithMessages {
  chat: ChatSession;
  messages: ChatHistoryMessage[];
}

export async function getChatSessions(token: string): Promise<ChatSessionsResponse> {
  const res = await fetch(`${API_URL}/api/chats`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch chat sessions");
  }

  return res.json();
}

export async function createChatSession(
  token: string,
  title?: string
): Promise<{ chat: ChatSession; count: number; limit: number }> {
  const res = await fetch(`${API_URL}/api/chats`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ title: title || "Новый чат" }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Failed to create chat session");
  }

  return res.json();
}

export async function getChatSessionWithMessages(
  token: string,
  chatId: string
): Promise<ChatSessionWithMessages> {
  const res = await fetch(`${API_URL}/api/chats/${chatId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch chat session");
  }

  return res.json();
}

export async function renameChatSession(
  token: string,
  chatId: string,
  title: string
): Promise<void> {
  const res = await fetch(`${API_URL}/api/chats/${chatId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ title }),
  });

  if (!res.ok) {
    throw new Error("Failed to rename chat session");
  }
}

export async function deleteChatSession(
  token: string,
  chatId: string
): Promise<void> {
  const res = await fetch(`${API_URL}/api/chats/${chatId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error("Failed to delete chat session");
  }
}

export async function deleteAllChatSessions(token: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/chats`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error("Failed to clear chat history");
  }
}

// Chat history API functions (legacy)

export interface ChatHistoryMessage {
  id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  created_at: string;
  chat_session_id?: string;
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
  description?: string;
}

export interface UserInfo {
  id: string;
  name: string;
  created_at: string;
}

export interface InviteCodeWithUsers extends InviteCode {
  last_used_at?: string;
  users: UserInfo[];
}

export interface InviteCodesDetailedResponse {
  codes: InviteCodeWithUsers[];
  error?: string;
}

export interface UsageStats {
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  by_model: Record<string, { count: number; tokens: number }>;
  by_type: Record<string, number>;
  by_user: Record<string, number>;
  recent: Array<{
    id: string;
    user_name: string;
    model: string;
    request_type: string;
    success: boolean;
    created_at: string;
  }>;
  period_days: number;
  error?: string;
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
  code?: string,
  description?: string
): Promise<InviteCode> {
  const res = await fetch(`${API_URL}/api/admin/invite-codes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name, uses, code, description }),
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

export async function getInviteCodesDetailed(
  token: string
): Promise<InviteCodesDetailedResponse> {
  const res = await fetch(`${API_URL}/api/admin/invite-codes-detailed`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error("Не удалось получить детальную информацию о кодах");
  }

  return res.json();
}

export async function resetInviteCode(
  token: string,
  codeId: string,
  uses: number = 1
): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/invite-codes/${codeId}/reset`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ uses }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Не удалось сбросить инвайт-код");
  }
}

export async function getUsageStats(
  token: string,
  days: number = 30
): Promise<UsageStats> {
  const res = await fetch(`${API_URL}/api/admin/stats?days=${days}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error("Не удалось получить статистику");
  }

  return res.json();
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

// Google Search API functions

export interface GoogleSearchItem {
  title: string;
  link: string;
  snippet: string;
  is_legal_source: boolean;
  priority: number;
}

export interface GoogleSearchResult {
  success: boolean;
  content: string;
  total_results?: string;
  items?: GoogleSearchItem[];
  search_time?: number;
  raw_results?: {
    topic: string;
    court_cases: Array<{ title: string; link: string; snippet: string }>;
    legislation: Array<{ title: string; link: string; snippet: string }>;
    total_found: number;
  };
  search_type?: string;
  error?: string;
}

export async function googleSearch(
  token: string,
  query: string,
  searchType: "general" | "court_cases" | "legal_topic" = "general",
  numResults: number = 10,
  siteRestrict?: string
): Promise<GoogleSearchResult> {
  const res = await fetch(`${API_URL}/api/query/google-search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      query,
      num_results: numResults,
      site_restrict: siteRestrict,
      search_type: searchType,
    }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Google Search failed");
  }

  return res.json();
}

// Court Practice Case type (used in Single Query results)

export interface CourtPracticeCase {
  case_number: string;
  court: string;
  date: string;
  summary: string;
  status?: "VERIFIED" | "LIKELY_EXISTS" | "NOT_FOUND" | "NEEDS_MANUAL_CHECK";
  verification_source?: "damia_api" | "perplexity";
  verification?: {
    exists?: boolean;
    confidence?: string;
    sources?: string[];
    links?: string[];
    damia_data?: Record<string, unknown>;
    actual_info?: string;
    [key: string]: unknown;
  };
}

// NPA (Normative Legal Acts) verification types

export interface VerifiedNpa {
  act_type: string;  // Тип акта: ГК, УК, ФЗ, и т.д.
  act_name: string;  // Полное название акта
  article: string;   // Номер статьи
  part?: string;     // Часть статьи
  paragraph?: string;  // Пункт статьи
  subparagraph?: string;  // Подпункт
  raw_reference: string;  // Исходная ссылка в тексте
  status: "VERIFIED" | "AMENDED" | "REPEALED" | "NOT_FOUND";
  is_active: boolean;
  current_text?: string;
  verification_source: string;
  amendment_info?: string;
  repeal_info?: string;
  sources: string[];
  confidence: "high" | "medium" | "low";
}

// Web Search API functions (Perplexity)

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

// Audio Transcription API functions

export interface TranscriptionProgress {
  stage: "preparing" | "transcribing" | "complete" | "error";
  progress: number; // 0.0 to 1.0
  message: string;
  chunk_index?: number;
  total_chunks?: number;
  text?: string;
  word_count?: number;
}

export interface TranscriptionResult {
  success: boolean;
  text: string;
  duration_seconds: number;
  chunks_processed: number;
  word_count: number;
  error?: string;
}

export async function transcribeAudio(
  token: string,
  file: File,
  onProgress: (progress: TranscriptionProgress) => void
): Promise<TranscriptionResult> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_URL}/api/files/transcribe`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Ошибка транскрибации");
  }

  const reader = res.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) throw new Error("No response body");

  let result: TranscriptionResult = {
    success: false,
    text: "",
    duration_seconds: 0,
    chunks_processed: 0,
    word_count: 0,
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value);
      const lines = text.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") {
            return result;
          }

          try {
            const parsed = JSON.parse(data) as TranscriptionProgress;
            onProgress(parsed);

            if (parsed.stage === "complete" && parsed.text) {
              result = {
                success: true,
                text: parsed.text,
                duration_seconds: 0,
                chunks_processed: parsed.total_chunks || 1,
                word_count: parsed.word_count || 0,
              };
            }

            if (parsed.stage === "error") {
              throw new Error(parsed.message);
            }
          } catch (parseError) {
            if (parseError instanceof Error && !parseError.message.includes("JSON")) {
              throw parseError;
            }
          }
        }
      }
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    if (errorMessage.includes("Load failed") || errorMessage.includes("network")) {
      throw new Error("Соединение прервано. Не сворачивайте приложение во время транскрибации.");
    }
    throw err;
  }

  return result;
}
