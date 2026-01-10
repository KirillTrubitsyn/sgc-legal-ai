# SGC Legal AI - Техническая документация

## Оглавление

1. [Общее описание](#общее-описание)
2. [Технологический стек](#технологический-стек)
3. [Конфигурация](#конфигурация)
4. [Архитектура приложения](#архитектура-приложения)
5. [API Endpoints](#api-endpoints)
6. [Алгоритмы работы](#алгоритмы-работы)
7. [Схема базы данных](#схема-базы-данных)
8. [Интеграции с внешними сервисами](#интеграции-с-внешними-сервисами)
9. [Frontend архитектура](#frontend-архитектура)
10. [Деплой и инфраструктура](#деплой-и-инфраструктура)

---

## Общее описание

**SGC Legal AI** - интеллектуальная система для анализа юридических вопросов в сфере российского права. Приложение объединяет возможности нескольких передовых языковых моделей (LLM) для предоставления точных юридических консультаций с верификацией судебной практики.

### Ключевые возможности

- **Мультимодельный анализ** - использование 4-5 различных LLM для получения разносторонних мнений
- **Верификация судебной практики** - проверка ссылок на судебные дела через API реестров
- **Режим Consilium** - консилиум AI-экспертов с peer-review и синтезом лучших ответов
- **Обработка документов** - загрузка и анализ PDF, DOCX, изображений и аудио
- **Экспорт в DOCX** - генерация юридических аналитических справок

### Структура проекта

```
sgc-legal-ai/
├── backend/                 # Python FastAPI приложение
│   ├── app/
│   │   ├── main.py         # Точка входа
│   │   ├── config.py       # Конфигурация
│   │   ├── database.py     # Работа с Supabase
│   │   ├── routers/        # API роутеры
│   │   │   ├── auth.py
│   │   │   ├── query.py
│   │   │   ├── consilium.py
│   │   │   ├── files.py
│   │   │   └── admin.py
│   │   └── services/       # Бизнес-логика
│   │       ├── openrouter.py
│   │       ├── consilium.py
│   │       ├── court_practice_search.py
│   │       ├── damia.py
│   │       ├── web_search.py
│   │       ├── file_processor.py
│   │       └── docx_generator.py
│   ├── Dockerfile
│   ├── requirements.txt
│   └── railway.toml
├── frontend/               # Next.js React приложение
│   ├── src/
│   │   ├── app/           # Страницы (App Router)
│   │   ├── components/    # React компоненты
│   │   └── lib/           # API клиент и утилиты
│   ├── package.json
│   └── next.config.js
└── database/              # SQL схемы для Supabase
    └── schema.sql
```

---

## Технологический стек

### Backend

| Компонент | Технология | Версия | Назначение |
|-----------|------------|--------|------------|
| Фреймворк | FastAPI | 0.115.0 | REST API, WebSockets, OpenAPI |
| Сервер | Uvicorn | 0.32.0 | ASGI сервер |
| Python | Python | 3.12 | Язык программирования |
| HTTP клиент | httpx | 0.28.0 | Асинхронные запросы к API |
| HTTP клиент | requests | 2.32.3 | Синхронные запросы |
| Валидация | pydantic-settings | 2.6.0 | Конфигурация и валидация |
| Документы | python-docx | 1.1.0 | Создание DOCX файлов |
| PDF | pdfplumber | 0.11.0 | Извлечение текста из PDF |
| Async Files | aiofiles | 24.1.0 | Асинхронная работа с файлами |

### Frontend

| Компонент | Технология | Версия | Назначение |
|-----------|------------|--------|------------|
| Фреймворк | Next.js | 14.2.0 | React фреймворк с SSR |
| UI | React | 18.3.0 | Компоненты интерфейса |
| Типизация | TypeScript | 5.3.3 | Статическая типизация |
| Стили | Tailwind CSS | 3.4.0 | Utility-first CSS |

### Инфраструктура

| Компонент | Технология | Назначение |
|-----------|------------|------------|
| База данных | Supabase (PostgreSQL) | Основное хранилище |
| Кэширование | Redis | Кэш (опционально) |
| Контейнеризация | Docker | Развертывание |
| Хостинг Backend | Railway | Cloud платформа |
| Хостинг Frontend | Vercel | Edge-развертывание |

### Языковые модели (LLM)

| Модель | Провайдер | Роль в приложении |
|--------|-----------|-------------------|
| Claude Opus 4.5 | Anthropic | Chairman, извлечение дел, синтез |
| GPT 5.2 | OpenAI | Expert 1 в Consilium |
| Gemini 3 Pro | Google | Expert 2 в Consilium |
| Gemini 3 Flash | Google | OCR изображений, транскрибация аудио |
| Sonar Pro | Perplexity | Поиск судебной практики, верификация |

---

## Конфигурация

### Переменные окружения Backend

```bash
# ═══════════════════════════════════════════════════
# БАЗА ДАННЫХ (Supabase)
# ═══════════════════════════════════════════════════
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJxxx...

# ═══════════════════════════════════════════════════
# LLM API (OpenRouter)
# ═══════════════════════════════════════════════════
OPENROUTER_API_KEY=sk-or-v1-xxx

# Модели (настраиваемые)
LLM_CHAIRMAN=anthropic/claude-opus-4.5      # Председатель консилиума
LLM_EXPERT_1=openai/gpt-5.2                 # Эксперт 1
LLM_EXPERT_2=google/gemini-3-pro-preview    # Эксперт 2
LLM_VERIFICATION=perplexity/sonar-pro       # Верификация

# ═══════════════════════════════════════════════════
# ВЕРИФИКАЦИЯ СУДЕБНЫХ ДЕЛ
# ═══════════════════════════════════════════════════
DAMIA_API_KEY=xxx                           # DaMIA API для kad.arbitr.ru

# ═══════════════════════════════════════════════════
# ПОИСК (опционально)
# ═══════════════════════════════════════════════════
GOOGLE_API_KEY=AIzaxxxxx                    # Google Custom Search
GOOGLE_CX=xxxxx                             # Search Engine ID

# ═══════════════════════════════════════════════════
# ПРИЛОЖЕНИЕ
# ═══════════════════════════════════════════════════
ENVIRONMENT=production                       # production / development
ALLOWED_ORIGINS=https://app.example.com     # CORS (через запятую)
JWT_SECRET=your-super-secret-key            # Секрет для токенов
ADMIN_PASSWORD=ADMIN2026                    # Пароль администратора

# ═══════════════════════════════════════════════════
# ЛИМИТЫ
# ═══════════════════════════════════════════════════
MAX_FILE_SIZE=25                            # Максимальный размер файла (МБ)
MAX_AUDIO_DURATION=300                      # Максимальная длина аудио (сек)
```

### Переменные окружения Frontend

```bash
NEXT_PUBLIC_API_URL=https://api.example.com
```

### Конфигурационный класс (backend/app/config.py)

```python
class Settings(BaseSettings):
    # Supabase
    supabase_url: str
    supabase_service_key: str

    # Redis (опционально)
    redis_url: str = ""

    # LLM API
    openrouter_api_key: str

    # Модели
    llm_chairman: str = "anthropic/claude-opus-4.5"
    llm_expert_1: str = "openai/gpt-5.2"
    llm_expert_2: str = "google/gemini-3-pro-preview"
    llm_verification: str = "perplexity/sonar-pro"

    # Поиск
    google_api_key: str = ""
    google_cx: str = ""

    # Верификация
    damia_api_key: str = ""

    # Лимиты
    max_file_size: int = 25  # MB
    max_audio_duration: int = 300  # seconds

    # Админ
    admin_password: str = "ADMIN2026"

    # Приложение
    environment: str = "production"
    allowed_origins: str = "*"
    jwt_secret: str
```

---

## Архитектура приложения

### Общая схема

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐    │
│  │   /       │  │   /chat   │  │  /saved   │  │  /admin   │    │
│  │   Login   │  │   Chat    │  │  Saved    │  │   Admin   │    │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘    │
│        │              │              │              │           │
│        └──────────────┴──────────────┴──────────────┘           │
│                              │                                   │
│                    ┌─────────▼─────────┐                        │
│                    │    API Client     │                        │
│                    │   (lib/api.ts)    │                        │
│                    └─────────┬─────────┘                        │
└──────────────────────────────│──────────────────────────────────┘
                               │ HTTP/SSE
┌──────────────────────────────▼──────────────────────────────────┐
│                         BACKEND                                  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                       FastAPI App                          │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │ │
│  │  │  auth    │ │  query   │ │consilium │ │  files   │      │ │
│  │  │  router  │ │  router  │ │  router  │ │  router  │      │ │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘      │ │
│  └───────│────────────│────────────│────────────│─────────────┘ │
│          │            │            │            │               │
│  ┌───────▼────────────▼────────────▼────────────▼─────────────┐ │
│  │                        SERVICES                            │ │
│  │ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌───────────┐│ │
│  │ │ openrouter │ │ consilium  │ │court_search│ │  damia    ││ │
│  │ └──────┬─────┘ └──────┬─────┘ └──────┬─────┘ └─────┬─────┘│ │
│  │ ┌──────┴─────┐ ┌──────┴─────┐ ┌──────┴─────┐ ┌─────┴─────┐│ │
│  │ │ web_search │ │file_process│ │docx_generat│ │ database  ││ │
│  │ └────────────┘ └────────────┘ └────────────┘ └───────────┘│ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────│──────────────────────────────────┘
                               │
      ┌────────────────────────┼────────────────────────┐
      │                        │                        │
      ▼                        ▼                        ▼
┌───────────┐          ┌───────────┐            ┌───────────┐
│ Supabase  │          │OpenRouter │            │  DaMIA    │
│PostgreSQL │          │  LLM API  │            │   API     │
└───────────┘          └───────────┘            └───────────┘
```

### Backend: Роутеры

#### auth.py - Аутентификация
- `POST /api/auth/login` - Вход по инвайт-коду
- `POST /api/auth/validate` - Проверка токена сессии

#### query.py - Основной режим запросов
- `POST /api/query/single` - Отправка запроса с поиском судебной практики
- `GET /api/query/models` - Список доступных моделей
- `POST /api/query/search` - Веб-поиск через Perplexity
- `GET /api/query/history` - История чата пользователя
- `DELETE /api/query/history` - Очистка истории
- `POST /api/query/saved` - Сохранение ответа
- `GET /api/query/saved` - Получение сохраненных ответов
- `DELETE /api/query/saved/{id}` - Удаление сохраненного ответа
- `POST /api/query/export/docx` - Экспорт в DOCX

#### consilium.py - Режим консилиума
- `POST /api/consilium/run` - Запуск консилиума (без стриминга)
- `POST /api/consilium/stream` - Запуск со стриминговыми обновлениями

#### files.py - Загрузка файлов
- `POST /api/files/upload` - Загрузка и обработка файла
- `GET /api/files/supported` - Поддерживаемые форматы

#### admin.py - Администрирование
- `POST /api/admin/login` - Вход администратора
- `POST /api/admin/logout` - Выход
- `GET /api/admin/invite-codes` - Список инвайт-кодов
- `POST /api/admin/invite-codes` - Создание инвайт-кода
- `DELETE /api/admin/invite-codes/{id}` - Удаление
- `PATCH /api/admin/invite-codes/{id}` - Обновление лимитов
- `POST /api/admin/test-damia` - Тестирование DaMIA API

### Backend: Сервисы

#### openrouter.py - Интеграция с LLM
```python
# Синхронный запрос
def chat_completion(model: str, messages: list, max_tokens: int = 4096) -> str

# Потоковый запрос (генератор)
def chat_completion_stream(model: str, messages: list) -> Generator[str, None, None]

# Список доступных моделей
def get_available_models() -> list[dict]
```

#### consilium.py - Мультимодельный анализ
```python
# Запуск полного консилиума (5 стадий)
async def run_consilium(question: str, on_stage_update: Callable) -> ConsiliumResult
```

#### court_practice_search.py - Поиск судебной практики
```python
# Поиск через Perplexity + верификация
async def search_court_practice(
    query: str,
    on_update: Callable
) -> list[CourtPracticeCase]
```

#### damia.py - Верификация дел
```python
# Проверка дела в kad.arbitr.ru
async def verify_case_damia(case_number: str) -> DamiaVerificationResult
```

#### file_processor.py - Обработка файлов
```python
# Извлечение текста из различных форматов
async def process_file(file: UploadFile) -> FileProcessResult
```

#### docx_generator.py - Генерация документов
```python
# Создание юридической справки
def generate_docx(question: str, answer: str, model: str) -> bytes
```

---

## API Endpoints

### Аутентификация

#### POST /api/auth/login
Вход в систему по инвайт-коду.

**Request:**
```json
{
  "code": "INVITE123"
}
```

**Response (200):**
```json
{
  "success": true,
  "token": "session-token-uuid",
  "user_name": "Иванов И.И."
}
```

**Response (401):**
```json
{
  "detail": "Invalid or expired invite code"
}
```

#### POST /api/auth/validate
Проверка валидности токена сессии.

**Request:**
```json
{
  "token": "session-token-uuid"
}
```

**Response:**
```json
{
  "valid": true,
  "user_name": "Иванов И.И."
}
```

### Single Query (Основной режим)

#### GET /api/query/models
Получение списка доступных моделей.

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "models": [
    {
      "id": "anthropic/claude-opus-4.5",
      "name": "Claude Opus 4.5",
      "description": "Флагманская модель Anthropic",
      "price_per_1k": 0.015
    },
    {
      "id": "openai/gpt-5.2",
      "name": "GPT 5.2",
      "description": "Модель OpenAI",
      "price_per_1k": 0.01
    }
  ]
}
```

#### POST /api/query/single
Отправка запроса с поиском и верификацией судебной практики.

**Headers:**
```
Authorization: Bearer {token}
```

**Request:**
```json
{
  "model": "anthropic/claude-opus-4.5",
  "messages": [
    {"role": "user", "content": "Какие последствия расторжения договора аренды?"}
  ],
  "stream": true
}
```

**Response (SSE Stream):**
```
data: {"stage": "search", "message": "Поиск судебной практики..."}

data: {"stage": "extract", "message": "Извлечение номеров дел..."}

data: {"stage": "verify", "message": "Верификация дела А40-12345/2024..."}

data: {"stage": "generating", "message": "Генерация ответа..."}

data: {"choices":[{"delta":{"content":"При расторжении..."}}]}

data: {"verified_cases": [
  {
    "case_number": "А40-12345/2024",
    "court": "Арбитражный суд г. Москвы",
    "date": "2024-05-15",
    "summary": "О взыскании задолженности по аренде",
    "status": "VERIFIED",
    "verification_source": "damia_api"
  }
]}

data: [DONE]
```

#### POST /api/query/export/docx
Экспорт ответа в DOCX формат.

**Headers:**
```
Authorization: Bearer {token}
```

**Request:**
```json
{
  "question": "Вопрос пользователя",
  "answer": "Ответ системы с markdown форматированием",
  "model": "anthropic/claude-opus-4.5"
}
```

**Response:**
```
Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document
Content-Disposition: attachment; filename="legal_analysis.docx"

[Binary DOCX content]
```

### Consilium (Мультимодельный анализ)

#### POST /api/consilium/stream
Запуск консилиума со стриминговыми обновлениями.

**Headers:**
```
Authorization: Bearer {token}
```

**Request:**
```json
{
  "question": "Как правильно оформить выход участника из ООО?"
}
```

**Response (SSE Stream):**
```
data: {"stage": "starting", "message": "Запуск консилиума..."}

data: {"stage": "stage_1", "progress": 33, "message": "Claude Opus: формирует мнение..."}

data: {"stage": "stage_1", "progress": 66, "message": "GPT 5.2: формирует мнение..."}

data: {"stage": "stage_1", "progress": 100, "message": "Gemini: формирует мнение..."}

data: {"stage": "stage_2", "message": "Извлечение судебных дел из ответов..."}

data: {"stage": "stage_3", "message": "Верификация дел через DaMIA API..."}

data: {"stage": "stage_4", "message": "Peer Review: оценка ответов..."}

data: {"stage": "stage_5", "message": "Синтез финального ответа..."}

data: {"stage": "complete", "result": {
  "question": "...",
  "final_answer": "...",
  "verified_cases": [...],
  "stages": {
    "stage_1": {...},
    "stage_2": [...],
    "stage_3": [...],
    "stage_4": {...},
    "stage_5": {...}
  }
}}

data: [DONE]
```

### Загрузка файлов

#### POST /api/files/upload
Загрузка и обработка файла.

**Headers:**
```
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

**Request:**
```
file: [Binary file content]
```

**Response:**
```json
{
  "success": true,
  "file_type": "document",
  "extracted_text": "Содержимое документа...",
  "summary": "Загружен DOCX: contract.docx | 1500 слов, 8000 символов"
}
```

#### GET /api/files/supported
Список поддерживаемых форматов.

**Response:**
```json
{
  "formats": {
    "documents": {
      "extensions": [".docx", ".pdf", ".txt", ".md"],
      "description": "Текстовые документы"
    },
    "images": {
      "extensions": [".jpg", ".jpeg", ".png", ".gif", ".webp"],
      "description": "Изображения (OCR через Gemini)"
    },
    "audio": {
      "extensions": [".mp3", ".wav", ".m4a", ".ogg"],
      "description": "Аудио (транскрибация через Gemini)"
    }
  },
  "limits": {
    "max_file_size_mb": 25,
    "max_audio_duration_sec": 300
  }
}
```

### Администрирование

#### POST /api/admin/login
Вход в админ-панель.

**Request:**
```json
{
  "password": "ADMIN2026"
}
```

**Response:**
```json
{
  "success": true,
  "token": "admin-token-uuid"
}
```

#### GET /api/admin/invite-codes
Список всех инвайт-кодов.

**Headers:**
```
Authorization: Bearer {admin-token}
```

**Response:**
```json
[
  {
    "id": "uuid",
    "code": "INVITE123",
    "name": "Иванов И.И.",
    "uses_remaining": 3,
    "created_at": "2024-01-15T10:30:00Z"
  }
]
```

#### POST /api/admin/invite-codes
Создание нового инвайт-кода.

**Headers:**
```
Authorization: Bearer {admin-token}
```

**Request:**
```json
{
  "code": "CUSTOM_CODE",
  "name": "Петров П.П.",
  "uses": 5
}
```

**Response:**
```json
{
  "id": "uuid",
  "code": "CUSTOM_CODE",
  "name": "Петров П.П.",
  "uses_remaining": 5,
  "created_at": "2024-01-15T12:00:00Z"
}
```

### Health Checks

#### GET /health
Базовая проверка работоспособности.

**Response:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "service": "SGC Legal AI Backend"
}
```

#### GET /health/ready
Проверка готовности с зависимостями.

**Response:**
```json
{
  "status": "ready",
  "checks": {
    "supabase": true
  }
}
```

---

## Алгоритмы работы

### Single Query Mode (Основной режим)

Режим Single Query предоставляет юридическую консультацию с автоматическим поиском и верификацией судебной практики.

```
┌─────────────────────────────────────────────────────────────────┐
│                    SINGLE QUERY FLOW                             │
└─────────────────────────────────────────────────────────────────┘

1. ВВОД ПОЛЬЗОВАТЕЛЯ
   │
   ├── Вопрос + выбранная модель
   │
   ▼
2. ПОИСК СУДЕБНОЙ ПРАКТИКИ (Stage: search)
   │
   ├── Запрос к Perplexity Sonar Pro
   ├── Поиск в: sudact.ru, kad.arbitr.ru, consultant.ru, garant.ru
   ├── Получение релевантных дел с источниками
   │
   ▼
3. ИЗВЛЕЧЕНИЕ НОМЕРОВ ДЕЛ (Stage: extract)
   │
   ├── Claude анализирует результаты поиска
   ├── Извлекает: номера дел, суды, даты, краткое описание
   ├── Формирует структурированный список
   │
   ▼
4. ВЕРИФИКАЦИЯ ДЕЛ (Stage: verify)
   │
   ├── Для каждого дела:
   │   │
   │   ├─► DaMIA API (приоритет)
   │   │   ├── GET api.damia.ru/arb/delo?regn={номер}
   │   │   ├── Возвращает: полные данные из kad.arbitr.ru
   │   │   └── Статус: VERIFIED (high confidence)
   │   │
   │   └─► Perplexity (fallback, если DaMIA не нашел)
   │       ├── Поиск в открытых источниках
   │       └── Статус: VERIFIED / LIKELY_EXISTS / NOT_FOUND
   │
   ▼
5. ГЕНЕРАЦИЯ ОТВЕТА (Stage: generating)
   │
   ├── Формирование системного промпта с:
   │   ├── Ролью юридического эксперта
   │   ├── Верифицированными делами
   │   └── Инструкциями по форматированию
   │
   ├── Запрос к выбранной LLM модели
   ├── Streaming ответа пользователю
   │
   ▼
6. РЕЗУЛЬТАТ
   │
   ├── Текстовый ответ с markdown
   ├── Таблица верифицированных дел
   └── Сохранение в историю чата
```

### Consilium Mode (Консилиум AI-экспертов)

Режим Consilium обеспечивает максимальную точность через мультимодельный анализ с взаимной оценкой и синтезом.

```
┌─────────────────────────────────────────────────────────────────┐
│                      CONSILIUM FLOW                              │
│                      (5 стадий)                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ STAGE 1: СБОР НЕЗАВИСИМЫХ МНЕНИЙ                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Claude    │  │    GPT      │  │   Gemini    │              │
│  │  Opus 4.5   │  │    5.2      │  │   3 Pro     │              │
│  │ (Chairman)  │  │ (Expert 1)  │  │ (Expert 2)  │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│         ▼                ▼                ▼                      │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              ПАРАЛЛЕЛЬНАЯ ОБРАБОТКА                         ││
│  │  Каждая модель независимо анализирует вопрос               ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 2: ИЗВЛЕЧЕНИЕ СУДЕБНЫХ ДЕЛ                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Chairman (Claude) анализирует все мнения и извлекает:          │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ {                                                           ││
│  │   "cases": [                                                ││
│  │     {                                                       ││
│  │       "case_number": "А40-12345/2024",                     ││
│  │       "court": "Арбитражный суд г. Москвы",                ││
│  │       "date": "2024-05-15",                                ││
│  │       "summary": "О взыскании задолженности",              ││
│  │       "mentioned_by": ["claude", "gpt"]                    ││
│  │     }                                                       ││
│  │   ]                                                         ││
│  │ }                                                           ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 3: ВЕРИФИКАЦИЯ ДЕЛ                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Для каждого извлеченного дела:                                 │
│                                                                  │
│  ┌───────────────────┐     ┌───────────────────┐                │
│  │    DaMIA API      │────▶│  Статус: VERIFIED │                │
│  │  (kad.arbitr.ru)  │     │  Confidence: HIGH │                │
│  └─────────┬─────────┘     └───────────────────┘                │
│            │                                                     │
│            │ (если не найдено)                                  │
│            ▼                                                     │
│  ┌───────────────────┐     ┌───────────────────┐                │
│  │    Perplexity     │────▶│  Статус: VERIFIED/│                │
│  │   (web search)    │     │  LIKELY_EXISTS/   │                │
│  └───────────────────┘     │  NOT_FOUND        │                │
│                            └───────────────────┘                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 4: PEER REVIEW (Взаимная оценка)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Chairman оценивает каждый ответ по критериям:                  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ КРИТЕРИИ ОЦЕНКИ (1-10):                                     ││
│  │                                                             ││
│  │ • Правовая точность        (вес: 25%)                      ││
│  │ • Практическая применимость (вес: 20%)                      ││
│  │ • Достоверность ссылок     (вес: 40%) ← Приоритет!         ││
│  │ • Качество аргументации    (вес: 15%)                      ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Результат:                                                      │
│  ┌───────────────┬────────┬────────────────────────────────────┐│
│  │    Модель     │ Рейтинг│ Комментарий                        ││
│  ├───────────────┼────────┼────────────────────────────────────┤│
│  │ Claude Opus   │  9.2   │ Отличная правовая аргументация     ││
│  │ GPT 5.2       │  8.5   │ Хорошая структура, мало ссылок     ││
│  │ Gemini 3 Pro  │  8.1   │ Некоторые дела не верифицированы   ││
│  └───────────────┴────────┴────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 5: СИНТЕЗ ФИНАЛЬНОГО ОТВЕТА                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Chairman объединяет лучшие элементы:                           │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ • Берет аргументацию модели с высшим рейтингом              ││
│  │ • Включает ТОЛЬКО верифицированные дела                     ││
│  │ • Структурирует ответ логически                             ││
│  │ • Формирует стиль аналитической справки                     ││
│  │ • Очищает от markdown разметки                              ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Итоговый ответ:                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ЮРИДИЧЕСКИЙ АНАЛИЗ                                          ││
│  │                                                             ││
│  │ [Структурированный ответ с верифицированными                ││
│  │  ссылками на судебную практику]                             ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Алгоритм верификации судебных дел

```
┌─────────────────────────────────────────────────────────────────┐
│              АЛГОРИТМ ВЕРИФИКАЦИИ СУДЕБНЫХ ДЕЛ                  │
└─────────────────────────────────────────────────────────────────┘

ВХОД: Номер дела (например, "А40-12345/2024")
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. НОРМАЛИЗАЦИЯ НОМЕРА                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  • Удаление лишних пробелов                                     │
│  • Замена латиницы на кириллицу: A→А, C→С, B→В                  │
│  • Нормализация тире: ‐ → -                                      │
│  • Нормализация слешей                                          │
│                                                                  │
│  Пример: "A40-12345/2024" → "А40-12345/2024"                    │
└─────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. ЗАПРОС К DaMIA API (приоритет)                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  GET https://api.damia.ru/arb/delo                              │
│  Parameters:                                                     │
│    - regn: А40-12345/2024                                       │
│    - key: {DAMIA_API_KEY}                                       │
│                                                                  │
│  Timeout: 10 секунд                                             │
└─────────────────────────────────────────────────────────────────┘
      │
      ├──► УСПЕХ (200 OK)
      │    │
      │    ▼
      │    ┌───────────────────────────────────────────────────┐
      │    │ Парсинг ответа DaMIA:                             │
      │    │                                                   │
      │    │ {                                                 │
      │    │   "РегНомер": "А40-12345/2024",                  │
      │    │   "Суд": "АС г. Москвы",                         │
      │    │   "Дата": "2024-05-10",                          │
      │    │   "Статус": "Завершено",                         │
      │    │   "Судья": "Иванов И.И.",                        │
      │    │   "Истец": "ООО Компания",                       │
      │    │   "Ответчик": "ИП Петров",                       │
      │    │   "Сумма": "1 000 000 руб.",                     │
      │    │   "Url": "https://kad.arbitr.ru/..."             │
      │    │ }                                                 │
      │    └───────────────────────────────────────────────────┘
      │    │
      │    ▼
      │    РЕЗУЛЬТАТ: VERIFIED (источник: damia_api)
      │
      └──► НЕУДАЧА (ошибка или не найдено)
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. FALLBACK: PERPLEXITY SEARCH                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Поисковый запрос:                                              │
│  "судебное дело А40-12345/2024 арбитражный суд"                 │
│                                                                  │
│  Приоритетные источники:                                        │
│    - sudact.ru                                                  │
│    - kad.arbitr.ru                                              │
│    - consultant.ru                                              │
│    - garant.ru                                                  │
└─────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. АНАЛИЗ РЕЗУЛЬТАТОВ PERPLEXITY                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Определение статуса:                                            │
│                                                                  │
│  ┌──────────────────┬─────────────────────────────────────────┐ │
│  │ Confidence       │ Условие                                 │ │
│  ├──────────────────┼─────────────────────────────────────────┤ │
│  │ HIGH → VERIFIED  │ Найдена прямая ссылка на kad.arbitr.ru  │ │
│  │ MEDIUM → LIKELY  │ Упоминание в юридических источниках     │ │
│  │ LOW → NOT_FOUND  │ Не найдено или противоречивая инфо      │ │
│  └──────────────────┴─────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
      │
      ▼
ВЫХОД: {
  case_number: "А40-12345/2024",
  status: "VERIFIED" | "LIKELY_EXISTS" | "NOT_FOUND",
  verification_source: "damia_api" | "perplexity",
  confidence: "high" | "medium" | "low",
  court: "...",
  date: "...",
  summary: "...",
  url: "..."
}
```

### Обработка файлов

```
┌─────────────────────────────────────────────────────────────────┐
│                  АЛГОРИТМ ОБРАБОТКИ ФАЙЛОВ                      │
└─────────────────────────────────────────────────────────────────┘

ВХОД: Загруженный файл
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. ВАЛИДАЦИЯ                                                    │
├─────────────────────────────────────────────────────────────────┤
│  • Проверка размера (макс 25 МБ)                                │
│  • Определение типа по расширению                               │
│  • Для аудио: проверка длительности (макс 5 минут)              │
└─────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. ОБРАБОТКА ПО ТИПУ                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┬───────────────────────────────────────────────┐│
│  │ Тип файла   │ Метод обработки                               ││
│  ├─────────────┼───────────────────────────────────────────────┤│
│  │ .docx       │ python-docx → текст + таблицы                 ││
│  │ .pdf        │ pdfplumber → текст со всех страниц + таблицы  ││
│  │ .txt, .md   │ Прямое чтение с определением кодировки        ││
│  │ .jpg, .png  │ Gemini 3 Flash (multimodal) → OCR             ││
│  │ .mp3, .wav  │ Gemini 3 Flash (multimodal) → транскрибация   ││
│  └─────────────┴───────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. ГЕНЕРАЦИЯ ОПИСАНИЯ                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Пример: "Загружен DOCX: contract.docx | 1500 слов, 8000 симв." │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
      │
      ▼
ВЫХОД: {
  success: true,
  file_type: "document" | "pdf" | "text" | "image" | "audio",
  extracted_text: "...",
  summary: "..."
}
```

---

## Схема базы данных

### ER-диаграмма

```
┌─────────────────────────────────────────────────────────────────┐
│                      СХЕМА БАЗЫ ДАННЫХ                          │
│                        (Supabase/PostgreSQL)                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────┐       ┌─────────────────┐
│  invite_codes   │       │     users       │
├─────────────────┤       ├─────────────────┤
│ id: UUID (PK)   │◄──────│ id: UUID (PK)   │
│ code: TEXT (UQ) │       │ invite_code_id  │───┐
│ name: TEXT      │       │ name: TEXT      │   │
│ uses_remaining  │       │ created_at      │   │
│ created_at      │       └────────┬────────┘   │
└─────────────────┘                │             │
                                   │             │
                    ┌──────────────┴───────┐    │
                    │                      │    │
                    ▼                      ▼    │
           ┌─────────────────┐    ┌─────────────────┐
           │    sessions     │    │  chat_messages  │
           ├─────────────────┤    ├─────────────────┤
           │ id: UUID (PK)   │    │ id: UUID (PK)   │
           │ user_id (FK)    │    │ user_id (FK)    │
           │ token: TEXT(UQ) │    │ role: TEXT      │
           │ created_at      │    │ content: TEXT   │
           └─────────────────┘    │ model: TEXT     │
                                  │ created_at      │
                                  └─────────────────┘

                                  ┌─────────────────┐
                                  │ saved_responses │
                                  ├─────────────────┤
                                  │ id: UUID (PK)   │
                                  │ user_id (FK)    │
                                  │ question: TEXT  │
                                  │ answer: TEXT    │
                                  │ model: TEXT     │
                                  │ created_at      │
                                  └─────────────────┘
```

### SQL-схема

```sql
-- Инвайт-коды для авторизации
CREATE TABLE invite_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    uses_remaining INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_invite_codes_code ON invite_codes(code);

-- Пользователи
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invite_code_id UUID REFERENCES invite_codes(id),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_users_invite_code ON users(invite_code_id);

-- Сессии авторизации
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- История чата
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    model TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_chat_messages_user ON chat_messages(user_id);

-- Сохраненные ответы
CREATE TABLE saved_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    model TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_saved_responses_user ON saved_responses(user_id);

-- Row Level Security
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_responses ENABLE ROW LEVEL SECURITY;
```

---

## Интеграции с внешними сервисами

### OpenRouter (LLM Gateway)

OpenRouter используется как единая точка доступа ко всем языковым моделям.

**Endpoint:** `https://openrouter.ai/api/v1/chat/completions`

**Аутентификация:**
```
Authorization: Bearer {OPENROUTER_API_KEY}
HTTP-Referer: https://sgc-legal-ai.vercel.app
X-Title: SGC Legal AI
```

**Используемые модели:**

| Модель | ID | Назначение | Цена/1K токенов |
|--------|----|-----------:|-----------------|
| Claude Opus 4.5 | `anthropic/claude-opus-4.5` | Chairman, синтез | $0.015 |
| GPT 5.2 | `openai/gpt-5.2` | Expert 1 | $0.010 |
| Gemini 3 Pro | `google/gemini-3-pro-preview` | Expert 2 | $0.008 |
| Gemini 3 Flash | `google/gemini-3-flash-preview` | OCR, транскрибация | $0.001 |
| Sonar Pro | `perplexity/sonar-pro-search` | Поиск, верификация | $0.003 |

**Пример запроса:**
```python
response = requests.post(
    "https://openrouter.ai/api/v1/chat/completions",
    headers={
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": "https://sgc-legal-ai.vercel.app",
        "X-Title": "SGC Legal AI"
    },
    json={
        "model": "anthropic/claude-opus-4.5",
        "messages": [
            {"role": "system", "content": "Вы юридический эксперт..."},
            {"role": "user", "content": "Вопрос пользователя"}
        ],
        "max_tokens": 4096,
        "stream": True
    }
)
```

### DaMIA API (Верификация судебных дел)

DaMIA предоставляет доступ к данным арбитражных дел из kad.arbitr.ru.

**Endpoint:** `https://api.damia.ru/arb/delo`

**Параметры запроса:**
| Параметр | Тип | Описание |
|----------|-----|----------|
| `regn` | string | Номер дела (например, А40-12345/2024) |
| `key` | string | API ключ |

**Пример запроса:**
```python
async with httpx.AsyncClient(timeout=10) as client:
    response = await client.get(
        "https://api.damia.ru/arb/delo",
        params={
            "regn": "А40-12345/2024",
            "key": DAMIA_API_KEY
        }
    )
```

**Пример ответа:**
```json
{
    "РегНомер": "А40-12345/2024",
    "Суд": "Арбитражный суд г. Москвы",
    "Дата": "2024-05-10",
    "Статус": "Завершено",
    "Судья": "Иванов И.И.",
    "Истец": "ООО \"Компания\"",
    "Ответчик": "ИП Петров П.П.",
    "Сумма": "1 000 000 руб.",
    "Категория": "Договорные споры",
    "Результат": "Иск удовлетворен",
    "Url": "https://kad.arbitr.ru/Card/abc123"
}
```

### Supabase (PostgreSQL + REST API)

**REST API:** `{SUPABASE_URL}/rest/v1`

**Аутентификация:**
```
apikey: {SUPABASE_SERVICE_KEY}
Authorization: Bearer {SUPABASE_SERVICE_KEY}
```

**Пример операций:**
```python
# Чтение
response = await client.get(
    f"{supabase_url}/rest/v1/users",
    params={"id": f"eq.{user_id}"},
    headers={
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}"
    }
)

# Создание
response = await client.post(
    f"{supabase_url}/rest/v1/chat_messages",
    headers={
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    },
    json={
        "user_id": user_id,
        "role": "user",
        "content": "Текст сообщения"
    }
)
```

### Perplexity (Web Search)

Используется через OpenRouter для веб-поиска с приоритетными юридическими источниками.

**Модель:** `perplexity/sonar-pro-search`

**Системный промпт для поиска:**
```
Вы помощник по поиску юридической информации в российском праве.
Приоритетные источники:
- sudact.ru (судебные акты)
- kad.arbitr.ru (картотека арбитражных дел)
- consultant.ru (КонсультантПлюс)
- garant.ru (Гарант)
```

---

## Frontend архитектура

### Структура папок

```
frontend/src/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # / - Страница входа
│   ├── chat/page.tsx             # /chat - Основной чат
│   ├── saved/page.tsx            # /saved - Сохраненные ответы
│   ├── admin/page.tsx            # /admin - Админ панель
│   └── layout.tsx                # Основной layout
│
├── components/                   # React компоненты
│   ├── InviteForm.tsx           # Форма входа по инвайт-коду
│   ├── ModeSelector.tsx         # Выбор режима (Single/Consilium)
│   ├── ModelSelector.tsx        # Выбор LLM модели
│   ├── ChatInput.tsx            # Поле ввода сообщения
│   ├── ChatMessage.tsx          # Отображение сообщения
│   ├── MarkdownText.tsx         # Рендер markdown
│   ├── LoadingSpinner.tsx       # Индикатор загрузки
│   ├── FileUpload.tsx           # Загрузка файла
│   ├── FilePreview.tsx          # Предпросмотр файла
│   ├── ConsiliumProgress.tsx    # Прогресс консилиума
│   ├── ConsiliumResult.tsx      # Результаты консилиума
│   ├── CourtPracticeProgress.tsx # Прогресс поиска практики
│   └── VerifiedCasesDisplay.tsx # Таблица верифицированных дел
│
└── lib/
    └── api.ts                   # API клиент
```

### API клиент (lib/api.ts)

```typescript
// Аутентификация
export async function loginWithInvite(code: string): Promise<LoginResult>
export async function validateToken(token: string): Promise<ValidationResult>

// Модели
export async function getModels(token: string): Promise<Model[]>

// Single Query
export async function sendQuery(
    token: string,
    model: string,
    messages: Message[],
    onChunk: (chunk: string) => void,
    onStageUpdate?: (update: StageUpdate) => void
): Promise<QueryResult>

// Consilium
export async function runConsilium(
    token: string,
    question: string,
    onStageUpdate: (update: StageUpdate) => void
): Promise<ConsiliumResult>

// Файлы
export async function uploadFile(token: string, file: File): Promise<FileResult>
export async function getSupportedFormats(): Promise<SupportedFormats>

// История
export async function getChatHistory(token: string): Promise<Message[]>
export async function clearChatHistory(token: string): Promise<void>

// Сохраненные ответы
export async function saveResponse(token: string, data: SaveData): Promise<{id: string}>
export async function getSavedResponses(token: string): Promise<SavedResponse[]>
export async function deleteSavedResponse(token: string, id: string): Promise<void>

// Экспорт
export async function exportAsDocx(token: string, data: ExportData): Promise<Blob>
```

### Типы данных

```typescript
// Сообщение в чате
interface Message {
    role: "user" | "assistant"
    content: string
}

// Верифицированное судебное дело
interface CourtPracticeCase {
    case_number: string
    court: string
    date: string
    summary: string
    status: "VERIFIED" | "LIKELY_EXISTS" | "NOT_FOUND"
    verification_source: "damia_api" | "perplexity"
    verification: {
        exists: boolean
        confidence: "high" | "medium" | "low"
        sources: string[]
        links?: string[]
        actual_info: string
    }
}

// Результат консилиума
interface ConsiliumResult {
    question: string
    final_answer: string
    verified_cases: VerifiedCase[]
    stages: {
        stage_1: Record<string, ModelOpinion>
        stage_2: CaseReference[]
        stage_3: VerifiedCase[]
        stage_4: PeerReview
        stage_5: { synthesis: string }
    }
}

// Модель LLM
interface Model {
    id: string
    name: string
    description: string
    price_per_1k: number
}
```

### Хранилище состояния (localStorage)

| Ключ | Тип | Описание |
|------|-----|----------|
| `sgc_token` | string | Токен сессии пользователя |
| `sgc_user` | string | Имя пользователя |
| `admin_token` | string | Токен администратора |
| `sgc_continue_chat` | JSON | Контекст для продолжения чата |

### Стилизация (Tailwind CSS)

**Цветовая палитра:**
```css
/* Основные цвета SGC */
--sgc-blue-500: #1e3a5f;  /* Основной синий */
--sgc-blue-700: #0f2035;  /* Темнее */
--sgc-blue-900: #0a1520;  /* Самый темный */
--sgc-orange-500: #f7941d; /* Акцентный оранжевый */
```

**Ключевые классы:**
```css
/* Контейнеры */
.max-w-4xl, .max-w-6xl

/* Типографика */
.font-sans (Inter), .font-mono

/* Интерактивные элементы */
.hover:bg-sgc-blue-700
.focus:ring-2 .focus:ring-sgc-orange-500
```

---

## Деплой и инфраструктура

### Docker (Backend)

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Установка зависимостей
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копирование кода
COPY . .

# Запуск
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
```

### Railway.toml

```toml
[build]
builder = "dockerfile"

[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 180
```

### Переменные окружения для Production

**Backend (Railway):**
```bash
# Обязательные
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJxxx...
OPENROUTER_API_KEY=sk-or-v1-xxx
JWT_SECRET=your-super-secret-key
DAMIA_API_KEY=xxx

# Опциональные
LLM_CHAIRMAN=anthropic/claude-opus-4.5
LLM_EXPERT_1=openai/gpt-5.2
LLM_EXPERT_2=google/gemini-3-pro-preview
LLM_VERIFICATION=perplexity/sonar-pro

ADMIN_PASSWORD=ADMIN2026
ALLOWED_ORIGINS=https://yourdomain.com
ENVIRONMENT=production
MAX_FILE_SIZE=25
MAX_AUDIO_DURATION=300
```

**Frontend (Vercel):**
```bash
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

### CORS настройка

```python
from fastapi.middleware.cors import CORSMiddleware

origins = settings.allowed_origins.split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Health Checks

```python
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "version": "1.0.0",
        "service": "SGC Legal AI Backend"
    }

@app.get("/health/ready")
async def health_ready():
    # Проверка подключения к Supabase
    supabase_ok = await check_supabase_connection()

    return {
        "status": "ready" if supabase_ok else "degraded",
        "checks": {
            "supabase": supabase_ok
        }
    }
```

---

## Ключевые особенности архитектуры

### 1. Мультимодельность
- Использование 4-5 различных LLM одновременно
- OpenRouter как единая точка входа для всех моделей
- Возможность сравнения результатов и fallback между моделями

### 2. Верификация судебной практики
- DaMIA API как приоритетный источник (прямой доступ к kad.arbitr.ru)
- Perplexity как fallback с веб-поиском
- Нормализация номеров дел для корректного сравнения
- Три статуса верификации: VERIFIED, LIKELY_EXISTS, NOT_FOUND

### 3. Потоковая обработка (Streaming)
- Server-Sent Events (SSE) для real-time обновлений
- Показ стадий обработки пользователю
- Возможность отмены запроса на клиенте

### 4. Обработка мультимедиа
- Изображения: OCR через Gemini 3 Flash (multimodal)
- Аудио: транскрибация через Gemini 3 Flash (до 5 минут)
- DOCX/PDF: извлечение текста и таблиц
- Лимит: 25 МБ на файл

### 5. Экспорт в DOCX
- Корпоративный стиль аналитической справки
- Times New Roman, 11pt, профессиональное форматирование
- Логотип компании, дата, модель, источники
- Поддержка markdown форматирования

### 6. Управление сессиями
- Инвайт-коды с настраиваемыми лимитами использований
- Уникальные токены для каждой сессии
- Административная панель для управления доступом
- История чата привязана к пользователю

---

*Документация актуальна на январь 2026 года.*
