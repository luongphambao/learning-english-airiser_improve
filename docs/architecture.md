# Architecture

## 1. Tầng và ranh giới server/client

```
Browser (React 19)
  components/*  hooks/*  stores/* (Zustand)
        │  chỉ được gọi qua getRepos() và lib/api/ai-client.ts
        ▼
  lib/repositories/**  (interface, seam duy nhất)
        │
        ▼
  lib/db (Dexie / IndexedDB — chạy trong browser)

  ──────────────── ranh giới mạng ────────────────

  app/api/ai/**/route.ts  (Next.js Route Handler, chạy trên server)
        │
        ▼
  lib/api/create-ai-route.ts  (wrapper: origin check, size cap, zod, rate limit, timeout, log)
        │
        ▼
  lib/ai/tasks/*.server.ts  (import 'server-only' — prompt không lọt vào bundle)
        │
        ▼
  lib/ai/provider.ts → providers/{openai,gemini}.ts
        │
        ▼
  Router OpenAI-compatible / Gemini API (mạng ngoài)
```

**Quy tắc cứng:** không component/hook/store nào import `lib/db/dexie.ts` trực tiếp — luôn qua `getRepos()`. Không component nào gọi `fetch` trực tiếp tới `/api/ai/*` — luôn qua `lib/api/ai-client.ts`. `*.server.ts` trong `lib/ai/tasks/` không được import từ bất kỳ file nào thiếu `'use client'`/route handler — build sẽ báo lỗi nếu vi phạm nhờ `server-only`.

## 2. Cây thư mục mục tiêu

```
app/
  layout.tsx  globals.css  providers.tsx  page.tsx (redirect)
  (tabs)/layout.tsx  today/  vocabulary/  calendar/  grammar/
  (stack)/layout.tsx  progress/  settings/
  api/ai/{enrich,extract,grade-sentence,analyze-doc,harvest,tts}/route.ts
  not-found.tsx  error.tsx

lib/
  ai/           config schema errors retry usage provider providers/ tasks/
  api/          create-ai-route guards rate-limit problem client ai-client
  db/           dexie rows read migrate-local-storage ids
  repositories/ types index dexie/*.ts  (firestore/ — slot dự phòng)
  domain/       word review user session import grammar index (zod schemas)
  srs/          date intervals schedule streak session types
  text/         blank shuffle normalize
  audio/        pcm-to-wav
  models.ts  format.ts  grammarData.ts   (giữ nguyên)

stores/     session-store  settings-store  enrichment-store
hooks/      use-words  use-profile  use-due-preview  use-theme  use-media-query
components/ ui/  layout/  exercises/  words/  progress/
types.ts    -> export * from '@/lib/domain'
```

`context/WordsContext.tsx`, `components/AppShell.tsx`, `screens/*`, `lib/utils.ts`, `hooks/use-mobile.ts` bị xoá — logic chuyển vào `app/(tabs)/*/page.tsx` + `components/*` + `stores/*`.

## 3. Luồng dữ liệu — 3 ví dụ cụ thể

### Thêm một từ mới
```
Field nhập từ (Sổ từ)
  → addWord(text, source)  [enrichment-store]
  → await repos.words.add(...)          // Dexie ghi ngay, có row thật với id
  → enrich(word.id)                     // đọc lại TỪ DB THEO ID, không dùng mảng in-memory
  → callTask('enrichWord', {word, contextTopic})  [lib/api/ai-client.ts]
  → POST /api/ai/enrich → createAiRoute → enrichWordTask → provider.generateJson()
  → repos.words.patch(id, {ipa, meaningVi, ...})
  → useLiveQuery ở Sổ từ tự re-render (observe bảng words, không cần setState thủ công)
```
So với bug #1 baseline: không còn mảng React state nào bị "tìm" ở giữa hai lần render — mọi bước đọc/ghi đều qua DB theo id.

### Trả lời một câu trong buổi học
```
useSessionStore.answer(correct)
  → repos.study.recordReview({wordId, kind, correct, now, sessionId})   // MỘT transaction
       ├─ đọc word từ DB (không nhận snapshot từ store)
       ├─ nextSchedule() thuần → ghi word
       ├─ ghi Review (append-only)
       └─ nextStats() thuần → tăng counter trên user
  → cập nhật session.index += 1, session.answers[...] = ...
  → lưu session (resume được sau F5)
  → session.items KHÔNG đổi độ dài — bug #2 không thể tái diễn
```

### Đọc màn Tiến độ
```
repos.user.getProfile()   // 1 document read duy nhất — đúng yêu cầu spec §8.4
  → { settings, stats: { streak, totalReviews, totalCorrect, history, ... } }
```
Không truy vấn `reviews` collection lúc render — `reviews` chỉ đọc khi mở lịch sử 1 từ cụ thể.

## 4. Routing

```
/                → redirect('/today')
(tabs)  — có TabBar, layout server-component
  /today  /vocabulary (?tu=<id> mở sheet chi tiết)  /calendar  /grammar
(stack) — có BackHeader, KHÔNG TabBar
  /progress  /settings
```
Route group `(tabs)`/`(stack)` tách theo việc có/không có tab bar, tránh mọi `if (pathname === ...)` trong shell. Layout của `(tabs)` là server component; chỉ `<TabBar/>`/`<AppHeader/>` là `'use client'` — layout tồn tại xuyên suốt điều hướng nên tab bar không bị tháo/dựng lại (điều `useState` tab switching baseline vốn có sẵn "miễn phí", giữ lại ưu điểm đó bằng cách khác).

## 5. Testing

Vitest, `fake-indexeddb` cho Dexie, `msw` cho HTTP tới provider AI. Suite SRS chạy 2 lần dưới `TZ=UTC` và `TZ=America/New_York` để bắt rò rỉ timezone y hệt bug từng có ở `lib/srs.ts` cũ.

Ưu tiên viết trước (thứ tự): `lib/srs/date.test.ts` → `schedule.test.ts` → `session.test.ts` → `lib/text/blank.test.ts` → `lib/ai/schema.test.ts` → `providers/*.test.ts` → `study-repository.test.ts` → `db/migrations.test.ts` → `create-ai-route.test.ts`.

CI (`.github/workflows/ci.yml`): `npm ci` → `tsc --noEmit` → `eslint` → `vitest run` → `next build`.

## 6. Vì sao không dùng TanStack Query

DB (Dexie) đã là cache cục bộ; server không có state riêng cần đồng bộ (mọi request AI là fire-and-forget task, không phải resource để cache theo key). Thêm TanStack Query nghĩa là có 2 cache phải giữ đồng nhất mà không có lợi ích tương xứng. `useLiveQuery` từ `dexie-react-hooks` đã cho reactivity cần thiết trực tiếp trên Dexie.

## 7. Liên quan

- Quyết định kiến trúc đầy đủ + lý do: `decision.md`
- Chi tiết entity/index/migration: `data-model.md`
- Chi tiết từng route AI: `api_document.md`
- Token & component design: `design.md`
- Tiến độ triển khai theo phase: `progress/board.md`
