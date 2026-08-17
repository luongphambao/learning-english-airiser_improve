# docs/ — Bản đồ tài liệu

Lexio là app học từ vựng tiếng Anh (UI tiếng Việt), khởi tạo bằng Google AI Studio, đang được tái kiến trúc để sửa 4 lỗi chí mạng, vá lỗ hổng bảo mật, và dựng nền vững để build tiếp.

## Đọc theo thứ tự nào

1. **`decision.md`** — bắt đầu ở đây. 26 quyết định kiến trúc (ADR-001 → ADR-026), mỗi cái có bối cảnh/lựa chọn/hệ quả. Trả lời câu hỏi "tại sao làm thế này mà không phải thế kia".
2. **`architecture.md`** — sơ đồ tầng, cây thư mục mục tiêu, luồng dữ liệu cụ thể (thêm từ / trả lời câu hỏi / đọc Tiến độ), routing.
3. **`data-model.md`** — entity, schema Dexie + index, chiến lược migration, đường lên Firestore sau này.
4. **`api_document.md`** — 6 route AI: input/output, mã lỗi, rate limit, prompt, biến môi trường.
5. **`design.md`** — token đang dùng thật (bảng màu giấy ấm / xanh rừng, ADR-013) + catalog 26 component primitive.
6. **`spec-gaps.md`** — 34 mâu thuẫn/lỗ hổng tìm thấy trong 2 file spec gốc (`01-PROJECT-SPEC (2).md`, `02-BUILD-STEPS (2).md`) và cách xử lý từng cái.
7. **`progress/`** — theo dõi tiến độ triển khai theo phase. Xem `progress/README.md`.
8. **`status.md`** — cái gì đã chạy được và cái gì còn thiếu, viết thẳng. Tách khỏi README vì README là bản giới thiệu sản phẩm.
9. **`competition-audit.md`** — rà soát toàn dự án đối chiếu bộ tiêu chí chấm điểm AI Riser Vietnam (17/08/2026). Khác `status.md`: file này không mô tả trạng thái mà xếp thứ tự **điều gì đang làm mất điểm và sửa theo thứ tự nào**. Đọc mục 9 trước nếu chỉ có 5 phút.

## 2 file spec gốc

`01-PROJECT-SPEC (2).md` và `02-BUILD-STEPS (2).md` là ý định sản phẩm ban đầu do AI Studio sinh, **không sửa** — mọi sai lệch/diễn giải được ghi ở `spec-gaps.md` và `decision.md` thay vì sửa đè lên file gốc.

`ui/` — 23 mockup HTML. Bảng màu của chúng **đã được áp dụng** (ADR-013 đảo ngược ADR-006); bản thân các file HTML vẫn chỉ là tham chiếu, không phải code đang chạy.

## Quyết định lớn nhất cần biết trước khi đọc code

- **Framework:** Next.js 15 App Router, không phải Vite như spec pin (ADR-001) — vì spec yêu cầu gọi AI trực tiếp từ client, sẽ lộ API key.
- **Lưu trữ:** Dexie (IndexedDB) sau `Repository` interface, không phải Firestore ngay (ADR-002) — chưa cần setup Firebase để chạy được.
- **AI:** trừu tượng hoá qua `AiProvider`, **mặc định Gemini** cho mọi tác vụ văn bản lẫn TTS; OpenAI-compatible lùi thành fallback bật bằng `AI_PROVIDER=openai` (ADR-003 dựng abstraction, ADR-012 đảo mặc định).
- **Design:** bảng màu **giấy ấm / xanh rừng** (`app/globals.css`, `design.md` §4), áp dụng theo ADR-013 sau khi ADR-006 quyết định ngược lại. Không còn indigo/slate và không có gradient nào — chúng bị bỏ có chủ đích.

## 4 lỗi chí mạng đang được sửa

Xem `progress/00-baseline-audit.md` §2 để biết chi tiết file:line — tóm tắt: enrich AI không bao giờ chạy (stale closure), buổi học bỏ sót từ (memo co lại giữa chừng), lịch ôn tập chết vì `now` bị hardcode về tháng 2/2025, và audio TTS luôn câm vì server trả PCM nhưng client đọc là WAV.
