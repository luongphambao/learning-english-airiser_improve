# Spec Gaps — mâu thuẫn và lỗ hổng trong `01-PROJECT-SPEC` / `02-BUILD-STEPS`

> Hai file gốc trong `docs/` (`01-PROJECT-SPEC (2).md`, `02-BUILD-STEPS (2).md`) là nguồn ý định sản phẩm, nhưng chứa mâu thuẫn nội bộ và lỗ hổng kỹ thuật. File này liệt kê từng cái, cách ta xử lý, và tham chiếu ADR liên quan trong `decision.md`. Không sửa 2 file gốc — chỉ ghi đè quyết định ở đây.

## A. Mâu thuẫn giữa hai file spec

| # | Mâu thuẫn | Xử lý |
|---|---|---|
| A1 | Bước 13 dẫn "§8.3" cho màn Tiến độ, nhưng §8.3 thực ra là Triage mapping; màn Tiến độ đúng ra là §8.4 | Coi là lỗi đánh số, dùng §8.4 |
| A2 | Bước 10 dẫn `harvestWords()` là "spec 7.4" nhưng 7.4 là Interleaved sentence; harvest đúng là §7.5 | Dùng §7.5 |
| A3 | Build-steps tự nhận "11 bước" nhưng bảng liệt kê 0→19 = 20 bước | Bỏ qua con số tuyên bố, theo bảng thật |
| A4 | "Gộp phần streak của bước 14 vào bước 7" — nhưng bước 14 không có streak (chỉ có leech + recall); streak đã ở bước 7 rồi | Hiểu là ý muốn nói "gộp phần **leech**" |
| A5 | Bước 11 = "polish + deploy" nhưng còn 8 bước sau nó (12–19) sẽ phá vỡ các đảm bảo polish (dark mode, 360px, focus ring...) mà không có polish pass thứ 2 | Board của ta đặt Phase 8 (chốt/polish) là **phase cuối cùng**, sau mọi màn hình, không phải giữa chừng |
| A6 | Thứ tự bài tập mâu thuẫn 3 lớp — xem §B | Xem ADR-009 |

## B. Ba luật xung đột về thứ tự bài tập (giải quyết chi tiết)

1. Build bước 5/6: thứ tự thẻ cố định `fillBlank, listen, write, listen, fillBlank`.
2. §8.2: leech phải ở **vị trí 1** và **không bao giờ** là `fillBlank`.
3. Build bước 14: `recall` chỉ dùng cho từ có `reviewCount >= 3`.
4. §8.3: từ triage `partial` phải nhận `recall` **ngay ở lần review đầu tiên** (`reviewCount === 0`).

(1) và (2) đụng nhau ở vị trí 1. (3) và (4) đụng nhau trực tiếp.

**Quyết định (ADR-009):** thứ tự vị trí là *ưu tiên*, hàm `isEligible(kind, word)` là *luật*. Với mỗi vị trí, thử kind ưu tiên trước, không đủ điều kiện thì rơi xuống danh sách dự phòng `['listen','fillBlank','recall','write']`, cuối cùng luôn có một kind "chắc chắn trả lời được" làm chốt chặn. `recall` hợp lệ khi `reviewCount >= 3` **hoặc** (`easeLevel >= 2 && reviewCount === 0`) — nhánh thứ hai chỉ đạt được qua `applyTriage('partial')`, nên đây là một ngoại lệ hẹp và tự giải thích (người dùng tự nhận "biết sơ sơ" mới có).

**Đánh đổi chấp nhận:** nhịp 5 thẻ không còn cố định tuyệt đối giữa các buổi. Đổi lại tránh được vi phạm nặng hơn: hiện leech dưới dạng `fillBlank` (đúng loại bài mà spec nói leech "đã hỏng" với nó), hoặc bắt `recall` chờ 3 lần xem trong khi triage đã hứa dùng ngay.

## C. Lỗ hổng trong data model

| # | Lỗ hổng | Xử lý |
|---|---|---|
| C1 | `CandidateWord` thiếu `sentenceSource` dù §7.6 responseSchema **required** nó và §8.3/Bước 18 render phụ thuộc hoàn toàn | Thêm field, giữ enum `'document' \| 'generated'` |
| C2 | `ExerciseKind` gốc không có `'recall'` dù §8.3 và Bước 14 đều cần nó | Đã có `'recall'` trong `types.ts` hiện tại — giữ, thêm `'grammar'` cho nhất quán |
| C3 | Không có field theo dõi "2 câu đúng liên tiếp" để clear leech (§8.2), suy ra từ `reviews` collection thì vi phạm nguyên tắc "không đọc cả collection" | Thêm `Word.consecutiveCorrect: number` — xem ADR-007 |
| C4 | `Import.status` không rõ khi nào set `'done'` | Quy ước: `'done'` khi user xác nhận xong màn triage (bấm "Thêm N từ vào sổ") |
| C9 | §8.3's 3-mức triage (Đã biết rõ/Biết sơ sơ/Chưa biết) với preselect theo CEFR được đặc tả từ spec gốc nhưng chưa từng có màn hình nào thật sự dùng đủ cả 3 mức + preselect — `/upload`'s triage (Phase 7) chỉ dùng `applyTriage('partial'\|'unknown')`, không có nút "Đã biết rõ" nối tới `skipped`. **Đã đóng ở Phase 9.4** (`components/TriageList.tsx`, dùng trong `app/(stack)/placement/page.tsx`) — `defaultTriageForCefr()` implement đúng bảng preselect gốc: C1/C2 → `unknown`, B2 → `partial`, B1 trở xuống → `known`. Xem ADR-017. **`analyzeDocument` (từng mồ côi, ADR-020) nay cũng dùng lại đúng component này** — `/learn?mode=doc`, xem ADR-021. |
| C5 | "5 từ sai nhiều nhất" (tutor brief, Bước 10) không có aggregate nào lưu wrong-count/word | Ngoài phạm vi lần này (tutor brief thuộc Phase 9+); khi làm, tính từ `reviews` theo `wordId` trong cửa sổ 30 ngày, cache vào `word.wrongCount30d` cập nhật trong `recordReview` |
| C6 | Không có Firestore composite index nào được đặc tả cho truy vấn due-words | Không áp dụng ở Dexie (index nhiều cột native); khi lên Firestore cần index `(dueAt)` + `(status, createdAt)` |
| C7 | Không có Cloud Storage security rules cho audio cache | Ngoài phạm vi (chưa dùng Cloud Storage) |
| C8 | **`Review.wordId` bắt buộc trỏ tới một `Word` có thật** (`StudyRepository.recordReview` đọc `db.words.get(wordId)`, throw `word_not_found` nếu không có) — nhưng `GrammarQuestion` (câu hỏi ngữ pháp) **không gắn với `Word` nào cả**. Phát hiện khi thử nối `GrammarScreen` vào SRS ở Phase 7: không có cách hợp lệ nào để gọi `recordReview({wordId: ..., kind: 'grammar', ...})` cho một câu hỏi ngữ pháp vì không tồn tại `wordId` phù hợp. | **Đã giải quyết — ADR-011.** Bảng `grammarAttempts` riêng (Dexie v2) + `GrammarRepository.recordAttempt()`, hoàn toàn tách khỏi `Word`/`Review`/`recordReview`. Ngữ pháp và Từ vựng là 2 hệ tiến độ song song có chủ đích, không phải một liên kết còn thiếu. |

## D. Mơ hồ trong SRS

| # | Mơ hồ | Xử lý |
|---|---|---|
| D1 | `dueAt = now + INTERVALS_DAYS[easeLevel] * 86400000` — dùng `easeLevel` trước hay sau khi cập nhật? | Sau khi cập nhật (đúng đúng → level tăng → dùng interval mới luôn). Test bao phủ ở `lib/srs/__tests__/schedule.test.ts` |
| D2 | Triage `partial` gán `easeLevel: 2` nhưng `dueAt: now + 3 ngày` — `INTERVALS_DAYS[2] === 7`, còn 3 ngày là `INTERVALS_DAYS[1]` | `applyTriage()` set `dueAt` tường minh, không tra bảng `INTERVALS_DAYS` cho case này — hai nguồn giá trị độc lập có chủ đích |
| D3 | "gap of exactly 1 day" trong luật streak — mơ hồ | Định nghĩa lại bằng số: `daysBetween(lastStudiedOn, today) === 1` |
| D4 | `freezeUsedOn` "> 7 days ago" — so với ngày nào? | So với `today`: `daysBetween(freezeUsedOn, today) > 7` |
| D5 | Recall gate dùng `reviewCount` nhưng không nói rõ nguồn — và xung đột với triage `partial` (xem §B) | Đã giải ở §B; `reviewCount` lấy từ `Word.reviewCount`, tăng trong `recordReview` |

## E. Hạ tầng / vận hành spec không đặc tả

| # | Thiếu | Trạng thái trong lần tái kiến trúc này |
|---|---|---|
| E1 | API key Gemini gọi từ client Vite → lộ key trong bundle | **Đã vá bằng kiến trúc:** giữ Next.js, mọi gọi AI qua Route Handler server. Xem ADR-001 |
| E2 | Không có email provider cho outbound/inbound | Ngoài phạm vi — Phase 9+ |
| E3 | Không có cơ chế lấy Google Meet transcript cho harvest | Ngoài phạm vi — Phase 9+ |
| E4 | Không có mô tả CI/CD, service account, project setup cho Cloud Run + Firebase + Cloud Functions + Cloud Scheduler | Ngoài phạm vi lần này; `docs/progress/board.md` liệt kê là điều kiện tiên quyết cho Phase 9+ |
| E5 | Model ID (`gemini-3-flash`...) có thể đổi | Tập trung vào `lib/ai/config.ts`, một chỗ sửa |
| E6 | Không có testing strategy ngoài "srs.ts unit-testable" | Vitest + tối thiểu 9 file test — xem `architecture.md` §Testing |
| E7 | Không có rate limiting / cost control cho Gemini | Đã thiết kế: `createAiRoute` wrapper + `MemoryRateLimiter` — xem `api_document.md` |
| E8 | Không có migration/versioning strategy cho schema | Đã thiết kế: Dexie version chain, additive-only — xem `data-model.md` |
| E9 | Không có analytics/error monitoring | Ngoài phạm vi lần này |

## F. Drift đã xác nhận giữa spec và code baseline

Xem `docs/progress/00-baseline-audit.md` §1 — framework thực tế là Next.js không phải Vite, không có Firebase, cấu trúc thư mục ở root không phải `src/`, dependency shadcn-adjacent (`class-variance-authority` v.v.) tồn tại nhưng không dùng.

## G. Sai lệch có chủ đích của lần tái kiến trúc này

| # | Sai lệch | Lý do |
|---|---|---|
| G1 | Không dùng Vite — giữ Next.js App Router | Vá lỗ hổng E1 rẻ hơn nhiều so với build backend proxy riêng cho Vite |
| G2 | ~~Không áp dụng design system trong `docs/ui/`~~ — **đã áp dụng** (warm paper/forest green/Instrument Serif/cấm gradient) | ADR-006 ban đầu giữ diện mạo AI Studio; ADR-013 đảo ngược và áp dụng bảng màu mockup. Xem ADR-013 |
| G3 | Không dùng Firebase Auth/Firestore ở vòng này | Local-first trước, có seam rõ ràng để chuyển sau — xem ADR-002 |
| G4 | ~~AI provider mặc định là OpenAI-compatible~~ — **mặc định đã là Gemini**, khớp lại với spec | ADR-003 dựng abstraction với mặc định OpenAI-compatible; ADR-012 đảo mặc định sang Gemini, OpenAI-compatible lùi thành fallback |
