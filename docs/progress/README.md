# progress/

Theo dõi tiến độ triển khai của lần tái kiến trúc Lexio.

- **`00-baseline-audit.md`** — chụp nhanh hiện trạng repo *trước* khi tái kiến trúc bắt đầu (2026-08-09). Không sửa file này khi code đổi — nó là mốc so sánh "trước/sau".
- **`board.md`** — bảng theo dõi Phase 0–8 (phạm vi lần này) + Phase 9+ (ngoài phạm vi, ghi điều kiện tiên quyết). Cập nhật trạng thái ở đây khi bắt đầu/xong một phase.
- **`changelog.md`** — nhật ký ngắn, mỗi dòng một lần chốt phase: ngày, tóm tắt, file chạm tới. Không phải commit log (git đã có) — đây là nhật ký ở mức "phase", đọc nhanh hơn `git log`.

## Quy trình cập nhật

1. Bắt đầu một phase → đổi trạng thái trong `board.md` thành 🟨.
2. Làm xong, acceptance check đạt → đổi thành ✅, thêm dòng vào `changelog.md`.
3. Bị chặn → đổi thành ⛔ kèm lý do ngắn ngay trong bảng.
4. Phát hiện mâu thuẫn/lỗ hổng spec mới trong lúc làm → thêm vào `../spec-gaps.md`, không ghi rải rác ở đây.
5. Quyết định kiến trúc mới phát sinh giữa chừng → thêm ADR mới vào `../decision.md`, không sửa đè ADR cũ.
