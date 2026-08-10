# Lexio

App học từ vựng và ngữ pháp tiếng Anh cho người Việt đi làm — thêm từ (gõ tay, dán đoạn văn, hoặc phân tích cả tài liệu bằng AI), ôn tập theo lịch giãn cách (spaced repetition), luyện ngữ pháp công sở, theo dõi chuỗi ngày học.

Khởi tạo ban đầu bằng Google AI Studio, hiện đã được tái kiến trúc lại phần nền (dữ liệu, AI, routing) để sửa các lỗi chí mạng và dễ build tiếp — xem [`docs/`](docs/README.md) để biết toàn bộ quyết định kiến trúc và tiến độ.

## Bắt đầu

```bash
npm ci
cp .env.example .env   # điền OPENAI_API_KEY/OPENAI_API_URL/OPENAI_MODEL_NAME hoặc GEMINI_API_KEY — xem chú thích trong file
npm run dev             # http://localhost:3000
```

Không cần Firebase/OAuth nào để chạy — dữ liệu lưu local trong IndexedDB (Dexie) của trình duyệt.

## Lệnh có sẵn

| Lệnh | Việc gì |
|---|---|
| `npm run dev` | Chạy dev server (Next.js, hot reload) |
| `npm run build` | Build production, kiểm tra type + prerender toàn bộ route |
| `npm start` | Chạy bản build production (chạy `build` trước) |
| `npm run lint` | ESLint (flat config, `eslint.config.mjs`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Chạy test suite (Vitest, 2 lần dưới `TZ=UTC` và `TZ=America/New_York`) |
| `npm run test:watch` | Test ở chế độ watch |
| `npm run format` | Prettier ghi đè toàn bộ file |

## Kiến trúc — tóm tắt 30 giây

- **Next.js 15 App Router** — Route Handler ở `app/api/ai/*` giữ API key AI ở server, không lộ ra client.
- **Dexie (IndexedDB)** sau một tầng `Repository` (`lib/repositories/`) — local-first, không cần backend để chạy; seam sẵn để sau này thay bằng Firestore.
- **AI đa nhà cung cấp** (`lib/ai/`) — mặc định gọi endpoint OpenAI-compatible (đọc từ `.env`), Gemini là lựa chọn thứ hai kiêm vai trò TTS. Một zod schema chiếu ra cả JSON Schema (OpenAI strict mode) lẫn `responseSchema` (Gemini) — không duy trì 2 bản tay.
- **Zustand + `dexie-react-hooks`** cho state — Dexie là nguồn sự thật duy nhất, không có cache thứ hai.
- **SRS thuần** (`lib/srs/`) — hàm lịch ôn tập không đọc đồng hồ hệ thống trực tiếp (`now` luôn là tham số), phiên học được "đóng băng" một lần lúc tạo để tránh lệch chỉ số giữa chừng.

Chi tiết đầy đủ + lý do từng quyết định: [`docs/decision.md`](docs/decision.md) (10+ ADR) và [`docs/architecture.md`](docs/architecture.md).

## Cấu trúc thư mục

```
app/(tabs)/       4 tab chính: hom-nay, so-tu, lich, ngu-phap
app/(stack)/      màn hình đẩy (back header, không tab bar): tien-do, cai-dat, tai-tai-lieu
app/api/ai/       5 route AI (enrich/extract/grade-sentence/analyze-doc/tts)
lib/domain/       zod schema — nguồn sự thật duy nhất cho mọi type dùng chung
lib/db/           Dexie schema + migration + đọc dữ liệu an toàn
lib/repositories/ tầng truy cập dữ liệu — component/store không import lib/db trực tiếp
lib/srs/          lịch ôn tập, streak, session builder (thuần, có test)
lib/ai/           provider abstraction, schema adapter, task registry
lib/api/          wrapper route AI (origin check, rate limit, retry...)
stores/           Zustand: session, settings, enrichment
components/       UI dùng chung (Button, Sheet, WordCard, các Exercise*)
docs/             toàn bộ tài liệu kiến trúc + tiến độ
```

## Tài liệu

Bắt đầu từ [`docs/README.md`](docs/README.md) — bản đồ đầy đủ. Đáng chú ý:

- [`docs/decision.md`](docs/decision.md) — vì sao chọn thế này chứ không phải thế kia (ADR).
- [`docs/api_document.md`](docs/api_document.md) — contract của từng route AI.
- [`docs/data-model.md`](docs/data-model.md) — entity, schema Dexie, chiến lược migration.
- [`docs/spec-gaps.md`](docs/spec-gaps.md) — mâu thuẫn/lỗ hổng trong spec gốc và cách xử lý.
- [`docs/progress/board.md`](docs/progress/board.md) — trạng thái từng phase, việc gì đã xong/còn thiếu.

## Tình trạng hiện tại

Phase 0–7 (nền tảng, dữ liệu, SRS, AI đa nhà cung cấp, routing, hầu hết màn hình) đã xong — xem [`docs/progress/board.md`](docs/progress/board.md) để biết chi tiết từng phase và những gì còn dở. Còn thiếu đáng chú ý: Phase 8 (a11y pass, bật ESLint lúc build, dọn nốt phần CSS token cũ) chưa bắt đầu; Cài đặt còn thiếu giờ nhắc học và xuất/xoá dữ liệu.
