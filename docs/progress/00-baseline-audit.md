# 00 — Baseline Audit (trước khi tái kiến trúc)

> Chụp nhanh hiện trạng repo tại thời điểm bắt đầu tái kiến trúc (2026-08-09), trước khi Phase 0 chạy. Giữ nguyên để sau này so sánh "trước / sau". Không sửa file này khi code thay đổi — mọi cập nhật đi vào `changelog.md`.

**Git state lúc audit:** 2 commit (`00f7ecd` Initial commit, `a40bc8b` chore: initialize project scaffolding). `docs/` chưa track. Không có lockfile, không `node_modules` committed.

**Quy mô:** 41 file source đã track, ~3.543 LOC (không tính `docs/ui`).

---

## 1. Tech stack thực tế lúc audit

| Package | Version | Ghi chú |
|---|---|---|
| `next` | `^15.4.9` | App Router |
| `react` / `react-dom` | `^19.2.1` | |
| `typescript` | `5.9.3` | `strict: true` |
| `tailwindcss` | `4.1.11` | v4, CSS-first, **không có `@theme` block** |
| `@google/genai` | `^2.4.0` | server-side only — điểm làm đúng |
| `lucide-react` | `^0.553.0` | icon duy nhất thực sự dùng |
| `eslint` | `9.39.1` | flat config, nhưng `.eslintrc.json` legacy vẫn còn — 2 config song song |
| `eslint-config-next` | `16.0.8` | lệch major với `next@15` |

**Dependency chết (khai báo nhưng không nơi nào import):** `motion`, `class-variance-authority`, `clsx`+`tailwind-merge` (`cn()` không ai gọi), `@hookform/resolvers` (không có `react-hook-form`), `@tailwindcss/typography`, `tw-animate-css`, `firebase-tools` (chỉ là CLI, không có SDK `firebase`/`firebase-admin`).

**Thiếu hoàn toàn:** test runner, lockfile, Prettier, CI, state library, DB client, auth, validation lib (zod/valibot), i18n lib, `Dockerfile`, `middleware.ts`, `error.tsx`/`not-found.tsx`/`loading.tsx`.

## 2. Bốn lỗi chí mạng (tính năng lõi không hoạt động)

| # | Lỗi | Vị trí | Hệ quả |
|---|---|---|---|
| 1 | `enrichWordAsync(id)` đọc `words.find()` trên stale closure ngay sau `setWords` | `context/WordsContext.tsx:214-216, 284-287` | Mọi từ thêm mới kẹt vĩnh viễn ở placeholder AI |
| 2 | `dueWords` là `useMemo` trên `words`; `recordReview` làm memo co lại trong khi `currentIndex` tăng độc lập | `screens/TodayScreen.tsx:26-49` | Buổi 5 từ chỉ hiện ~3 từ, báo sai "đã học xong 5 từ" |
| 3 | `const nowTimestamp = 1738800000000` (06/02/2025) hardcode | `screens/TodayScreen.tsx:23` | Bộ lọc SRS `dueAt <= now` không bao giờ khớp |
| 4 | Route TTS trả PCM thô nhưng client đọc là WAV | `app/api/gemini/tts/route.ts:40` → `components/ExerciseListen.tsx:47,80` | Luôn fallback `speechSynthesis`, trả tiền TTS vô ích |

## 3. Nhóm vấn đề khác (đầy đủ 120 mục, rút gọn theo nhóm)

- **Kiến trúc:** client boundary ở root (`app/page.tsx:1`), không routing thật (`useState<TabType>`), không service layer (4 nơi tự viết `fetch`), `analyze-doc` route mồ côi, copy-paste lớn (shuffle x2, class string x3, nav button x5, hero gradient x2).
- **State:** context đơn lẻ giữ cả words/stats/settings, `ScheduleScreen` giữ sessions ở local state (mất khi đổi tab), `GrammarScreen` tính điểm rồi vứt.
- **Persistence:** chỉ `localStorage`, không version/migration/validate, flash 5 từ demo trước khi load thật, ghi toàn bộ mảng mỗi lần thay đổi.
- **API:** 5 route không auth/rate-limit/length-cap, envelope phản hồi không nhất quán, `JSON.parse` không guard, lỗi model bị nuốt thành `200 {}`, client `GoogleGenAI` tạo mới mỗi request.
- **Type safety:** 6 chỗ `any` tường minh, 5 boundary API không kiểu, response schema lặp lại 3 nơi không đồng bộ.
- **Bảo mật:** không auth, không rate limit, prompt injection qua `contextTopic`/`word`, lộ `error.message` upstream, thiếu security header.
- **UI/UX:** dark mode hỏng (`data-theme` vs Tailwind `dark:` theo OS), 9 giá trị border-radius trôi dạt, `--green` đang là indigo `#4F46E5`, 7 chấm tiến độ giả (`idx <= 4` hardcode), streak giả seed sẵn cho user mới, regex không escape làm crash `trade-off`.
- **A11y:** 4 chỗ `<div onClick>` không keyboard được, `Sheet` không phải dialog thật (không focus trap), không `aria-live` cho phản hồi đúng/sai, `lang="vi"` phủ luôn nội dung tiếng Anh.
- **Testing:** 0 test, kể cả `lib/srs.ts` vốn thuần và dễ test nhất.

> Danh sách đầy đủ 120 mục kèm số dòng chính xác nằm trong lịch sử audit của phiên tái kiến trúc này (không paste lại toàn bộ ở đây để tránh trùng lặp) — xem `spec-gaps.md` cho phần liên quan đến sai lệch spec, và `board.md` cho việc từng mục được xử lý ở phase nào.

## 4. Đối chiếu với `docs/ui/` mockup

23 file mockup (`01`–`22` + `index.html`) dùng chung 1 stylesheet ~410 dòng, thủ công, không Tailwind. Định nghĩa design system khác hẳn bản đang chạy: `--paper #FAF8F5` / `--green #2F6B4F` (forest, không phải indigo) / Instrument Serif + Inter + IBM Plex Mono / **cấm gradient**. Chi tiết đầy đủ ở `design.md` §Mockup reference.

**11/22 màn mockup chưa có trong app:** Đăng nhập, Tải tài liệu, Đang phân tích, Phân loại từ (quan trọng nhất), Email nhắc học, Lỗi đọc file, Google Drive, Thêm từ thành công, Sau buổi học, Thiết lập lần đầu. 5 màn lệch/thiếu một phần: Lịch, Cài đặt, Đã học xong, Tiến độ, Chi tiết từ.

**Ngược lại:** `GrammarScreen` tồn tại trong app nhưng không có trong mockup — giữ lại vì nội dung 10 câu hỏi B1-B2 có giá trị, nhưng cần nối vào SRS (xem `board.md` Phase 7).

## 5. Điểm tốt, giữ nguyên

- API key luôn ở server, không `NEXT_PUBLIC_` — đúng ngay từ đầu.
- Structured output (`responseSchema`) + prompt được viết cẩn thận trên cả 4 route text — giữ nguyên văn prompt khi chuyển sang task layer mới.
- `lib/srs.ts` thuần, nhận `now` làm tham số — đúng hướng, chỉ cần sửa bug timezone.
- Seeded shuffle giải quyết đúng vấn đề hydration mismatch SSR/CSR — giữ thuật toán, chỉ gộp code trùng.
- `types.ts` là một domain model thật, viết trước code — đúng bộ khung để bọc zod lên trên.
- `lib/grammarData.ts`: 10 câu hỏi ngữ pháp chất lượng, nội dung sư phạm thật.
