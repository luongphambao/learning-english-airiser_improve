# docs/ — Bản đồ tài liệu

Lexio là app học từ vựng tiếng Anh (UI tiếng Việt), khởi tạo bằng Google AI Studio, đang được tái kiến trúc để sửa 4 lỗi chí mạng, vá lỗ hổng bảo mật, và dựng nền vững để build tiếp.

## Đọc theo thứ tự nào

1. **`decision.md`** — bắt đầu ở đây. 10 quyết định kiến trúc (ADR), mỗi cái có bối cảnh/lựa chọn/hệ quả. Trả lời câu hỏi "tại sao làm thế này mà không phải thế kia".
2. **`architecture.md`** — sơ đồ tầng, cây thư mục mục tiêu, luồng dữ liệu cụ thể (thêm từ / trả lời câu hỏi / đọc Tiến độ), routing.
3. **`data-model.md`** — entity, schema Dexie + index, chiến lược migration, đường lên Firestore sau này.
4. **`api_document.md`** — 6 route AI: input/output, mã lỗi, rate limit, prompt, biến môi trường.
5. **`design.md`** — token đang dùng thật (giữ nguyên diện mạo AI Studio) + catalog 26 component primitive + bảng token mockup (chỉ tham chiếu, không áp dụng).
6. **`spec-gaps.md`** — 34 mâu thuẫn/lỗ hổng tìm thấy trong 2 file spec gốc (`01-PROJECT-SPEC (2).md`, `02-BUILD-STEPS (2).md`) và cách xử lý từng cái.
7. **`progress/`** — theo dõi tiến độ triển khai theo phase. Xem `progress/README.md`.

## 2 file spec gốc

`01-PROJECT-SPEC (2).md` và `02-BUILD-STEPS (2).md` là ý định sản phẩm ban đầu do AI Studio sinh, **không sửa** — mọi sai lệch/diễn giải được ghi ở `spec-gaps.md` và `decision.md` thay vì sửa đè lên file gốc.

`ui/` — 23 mockup HTML mô tả một design system khác với bản đang chạy. Xem `design.md` §4 — hiện **không áp dụng** (ADR-006), chỉ giữ làm tham chiếu.

## Quyết định lớn nhất cần biết trước khi đọc code

- **Framework:** Next.js 15 App Router, không phải Vite như spec pin (ADR-001) — vì spec yêu cầu gọi AI trực tiếp từ client, sẽ lộ API key.
- **Lưu trữ:** Dexie (IndexedDB) sau `Repository` interface, không phải Firestore ngay (ADR-002) — chưa cần setup Firebase để chạy được.
- **AI:** trừu tượng hoá qua `AiProvider`, mặc định OpenAI-compatible theo `.env` hiện có, Gemini là lựa chọn thứ hai + vai trò TTS (ADR-003).
- **Design:** **giữ nguyên diện mạo AI Studio hiện tại** (indigo/slate/gradient), không áp dụng mockup `docs/ui/` (ADR-006) — quyết định này dễ đảo ngược nhất nếu sau này đổi ý, vì primitive tách khỏi giá trị màu cụ thể.

## 4 lỗi chí mạng đang được sửa

Xem `progress/00-baseline-audit.md` §2 để biết chi tiết file:line — tóm tắt: enrich AI không bao giờ chạy (stale closure), buổi học bỏ sót từ (memo co lại giữa chừng), lịch ôn tập chết vì `now` bị hardcode về tháng 2/2025, và audio TTS luôn câm vì server trả PCM nhưng client đọc là WAV.
