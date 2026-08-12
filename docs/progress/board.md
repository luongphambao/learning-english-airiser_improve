# Board

> Trạng thái từng phase của lần tái kiến trúc. Cập nhật ô Trạng thái khi bắt đầu/xong; ghi 1 dòng vào `changelog.md` khi một phase chốt xong. Chi tiết kỹ thuật của mỗi phase nằm trong plan gốc (`decision.md` + `architecture.md` + `data-model.md` + `api_document.md` + `design.md`) — board này chỉ theo dõi tiến độ + acceptance check.

| Phase | Nội dung | Trạng thái | Acceptance check |
|---|---|---|---|
| 0 | Dọn nền: lockfile, gỡ dep chết, thêm zod/dexie/zustand/vitest, config test + prettier + CI | ✅ Xong | `npm ci && npm run build` xanh; `npm test` chạy được |
| 1 | Token hoá design hiện tại (thu hẹp — xem ghi chú dưới): `@theme inline`, `@custom-variant dark`, `next/font`, FOUC-free theme init | ✅ Xong (thu hẹp) | Build/dev render đúng font + `data-theme` trước hydrate; dark mode theo nút, không theo OS |
| 2 | Routing thật: route group `(tabs)`/`(stack)`, xoá `AppShell` + `screens/` | ✅ Xong | Deep-link `/progress` render đúng; nút Back trình duyệt hoạt động |
| 3 | Tầng dữ liệu: zod domain, Dexie schema + index, repositories, `recordReview` transaction, migrate localStorage | ✅ Xong | Test: review+stats+word cùng chuyển hoặc cùng rollback; migrate chạy 2 lần không nhân đôi |
| 4 | SRS + session builder đóng băng, date 1 timezone, blank splitter escape regex | ✅ Xong | Suite SRS xanh dưới 2 `TZ`; `splitForBlank('trade-off', ...)` không throw |
| 5 | State: 3 store Zustand, giết bug stale-closure enrich, xoá `WordsContext` | ✅ Xong | Thêm từ → nghĩa thật hiện sau vài giây; F5 giữa buổi học resume đúng thẻ |
| 6 | Tầng AI đa provider: schema adapter, 2 provider, 4 task JSON + tts, `createAiRoute`, typed client, PCM→WAV | ✅ Xong (thu hẹp — bỏ `harvestWords`, xem ghi chú) | Đổi `AI_PROVIDER` không đổi gì phía caller; lỗi upstream không lộ `sk-`/`key`; thẻ Nghe phát tiếng thật |
| 7 | Màn hình: sửa dữ liệu giả (Tiến độ) + thêm 6 màn thiếu (chi tiết từ, import, phân tích, triage, thành công, lỗi file) + nối Ngữ pháp vào SRS | 🟨 Một phần — xem ghi chú | Tiến độ: 1 read `user`, 0 read `reviews`; không màn nào trắng lúc tải |
| 8 | Chốt: loading/empty/error đủ 3 trạng thái, a11y, 360px, bật ESLint lúc build, README, bật `noUncheckedIndexedAccess` | ⬜ Chưa bắt đầu | Duyệt hết app chỉ bằng bàn phím, focus ring luôn thấy; `npm run build` pass với lint bật |

**Chú giải trạng thái:** ⬜ Chưa bắt đầu · 🟨 Đang làm · ✅ Xong · ⛔ Chặn (ghi lý do bên dưới)

**Điều chỉnh so với plan gốc:** cờ TS `noUncheckedIndexedAccess`/`exactOptionalPropertyTypes`/`verbatimModuleSyntax` dời từ Phase 0 sang Phase 8. Bật ở Phase 0 tạo fallout ngay trên `TodayScreen.tsx`/`GrammarScreen.tsx`/`Exercise*.tsx` — toàn bộ những file này bị xoá hoặc viết lại ở Phase 2/4/7, nên vá chúng trước rồi vá lại lần nữa là phí công. Bật sau khi viết lại xong thì chỉ tốn công một lần, trên code cuối cùng.

**Điều chỉnh Phase 7 (đang dở, ghi rõ để tiếp tục):**
- ✅ **Tiến độ đã sửa dữ liệu giả**: 7 chấm đọc `stats.history` thật qua `lastNDays()`/`weekdayVi()` (trước đây hardcode T2–T6 xanh mãi mãi), accuracy fallback về 0% thay vì 100% giả khi chưa có review, dòng "bắt đầu từ ngày..." suy ra từ `Math.min(...words.map(w => w.createdAt))` thay vì luôn là hôm nay (và ẩn hẳn nếu sổ từ rỗng). Stats seed giả (`streak:3, totalReviews:14`) đã tự động biến mất từ Phase 5 (đổi seed sang `DEFAULT_STATS` all-zero) — không cần sửa thêm.
- ✅ **Màn "Tải tài liệu" / "Phân loại từ" đã build**: `/upload` (`ImportRepository` mới + 5 bước input→analyzing→triage→success/error dồn vào 1 trang bằng state cục bộ, xem `changelog.md`). Dùng `analyzeDocument` task đã có từ Phase 6. Đã gộp "Đang phân tích"/"Thêm từ thành công"/"Lỗi đọc file" làm step trong cùng trang thay vì route riêng — coi là tương đương yêu cầu gốc, không phải thiếu. "Chi tiết từ" hoá ra KHÔNG thiếu collocations/wordFamily như audit cũ ghi (baseline `WordCard.tsx` đã render sẵn, chỉ luôn rỗng do bug #1 chưa sửa) — phần thật sự thiếu là "provenance", đã thêm vào sheet chi tiết ở `vocabulary/page.tsx` (ngày thêm, số lần ôn, ngày ôn tiếp).
- ✅ **Ngữ pháp giờ có lịch sử riêng (ADR-011), không nối vào SRS.** Quyết định: `recordReview`/`Review`/`Word` không tự nhiên áp dụng cho câu hỏi ngữ pháp (không có `wordId` thật để gắn — `isEligible('grammar', ...)` đã coi ngữ pháp là màn riêng từ Phase 4). Thay vào đó: bảng Dexie mới `grammarAttempts` (schema v2, additive — không sửa `version(1)`) + `GrammarRepository.recordAttempt()`, ghi 1 dòng mỗi lần hoàn thành quiz. `/grammar` hiện badge "Lần trước: N/M" trên mỗi chủ đề. Điểm số không còn bị tính-rồi-vứt như baseline. Xem `spec-gaps.md` C8 (đã đóng) + `decision.md` ADR-011.
- ⛔ **`ImportRepository` chưa có test riêng** (`study-repository.test.ts`/`migrations.test.ts` không phủ nó) — rủi ro thật sự vì `setTriage`/`complete` mỗi cái là một `db.transaction` riêng, không phải 1 transaction bao trọn cả phiên triage; nếu người dùng đóng tab giữa lúc `confirmTriage()` đang lặp `words.add()` cho từng candidate, một số từ được thêm còn `Import.status` vẫn dừng ở `'ready'` (không tự chuyển `'done'`) — về lại trang sẽ triage lại từ đầu và có thể thêm trùng những từ đã thêm (dedupe theo `wordLower` ở tầng `WordRepository` sẽ chặn trùng thật, nhưng UX "N từ đã thêm" sẽ sai). Cần test + có thể cần optimistic-lock hoặc idempotency key nếu ưu tiên xử lý sớm.
- Cài đặt vẫn chỉ 3 field cũ (contextTopic/level/theme) — chưa thêm giờ nhắc học, xuất/xoá dữ liệu.

**Điều chỉnh Phase 6:** không build `harvestWords` (task thứ 6 trong plan gốc) — không có consumer UI nào (harvest-sau-buổi-học thuộc Phase 9+, cần transcript mà app chưa có cách lấy). Không build `/api/ai/capabilities` GET riêng — `session-store.ts` tạm hardcode `caps = {audioAvailable:true, aiAvailable:true}`, việc probe capability thật sẽ làm khi Phase 7 cần (màn triage cần biết `inlineFiles` trước khi cho phép tải PDF/ảnh). Không viết `openai-provider.test.ts`/`gemini-provider.test.ts` bằng `msw` (baseline plan có đề cập) — thay vào đó xác minh 4 guard (origin/size/validate/rate-limit) bằng smoke test `curl` thật trên server production, xem `changelog.md`. Không mở rộng `optionsForWord`/`ExerciseFillBlank` v.v. sang dùng `lib/ai/tasks/*` cho phần audio-button chuyên dụng (đó là `components/exercises/audio-button.tsx` trong `architecture.md` §9.4 — Phase 7 mới có consumer thật ngoài `ExerciseListen.tsx` hiện tại).

**Điều chỉnh Phase 1:** thu hẹp so với plan gốc — chỉ làm phần hạ tầng token thật sự tồn tại lâu dài (`globals.css`, `app/fonts.ts`, script chống nháy sáng trong `layout.tsx`). **Không** rút 26 component primitive và **không** quét thay `indigo-600`/`rose-600`/`emerald-*` hardcode ngay bây giờ, vì mọi consumer hiện tại của các màu đó (`AppShell.tsx`, `Button.tsx`, `screens/*`) đều bị xoá hoặc viết lại ở Phase 2/4/7 — dựng primitive trước khi có consumer thật là trừu tượng hoá sớm (component API sẽ phải đoán mò, dễ sai). Primitive trong `components/ui/` sẽ được dựng **just-in-time** khi từng phase thực sự cần, dùng đúng token đã có sẵn từ `@theme inline`. Quét màu hardcode còn lại sẽ tự nhiên biến mất khi các file chứa chúng bị xoá/viết lại ở phase sau — không cần một đợt quét riêng.
**Đã xác minh không đổi diện mạo:** `next build` xanh, HTML render có `data-theme` set trước hydrate và class font hash từ `next/font` — cùng font-family/weight như bản `<link>` cũ, chỉ đổi cách nạp.

## Phase 9+ (ngoài phạm vi lần này — điều kiện tiên quyết)

| Hạng mục | Điều kiện tiên quyết |
|---|---|
| Firebase Auth + Firestore | Tạo Firebase project, bật Google Sign-In, dán config vào `.env` |
| Email nhắc học (outbound) + email-in | Chọn email provider (SendGrid/Mailgun/Postmark), domain + DKIM/SPF |
| Google Calendar + Meet (đặt buổi tutor) | OAuth consent screen, scope `calendar`, incremental consent |
| Google Drive Picker | OAuth scope `drive.file`, Picker API key |
| Bộ đọc file đa định dạng (`pdf-lib`/`mammoth`/`xlsx`/`jszip`) trong Web Worker | Không phụ thuộc hạ tầng ngoài — có thể làm sớm hơn nếu ưu tiên |
| PWA + Web Share Target | Cần `manifest.json` + service worker, quyết định chiến lược offline (spec không đặc tả) |
| Thu hoạch từ sau buổi tutor (harvest) | Phụ thuộc có transcript — Meet transcript cần Google Workspace + Meet API, chưa có trong spec |
| Tutor brief email (20 từ gần nhất + 5 từ sai nhiều nhất) | Cần outbound email + aggregate `wrongCount30d` (xem `spec-gaps.md` C5) |

## Ghi chú khi làm

- Không sửa `version(n)` Dexie đã phát hành — luôn `version(n+1)`.
- Mỗi phase xong, cập nhật dòng trạng thái ở đây **và** thêm 1 mục vào `changelog.md` (ngày + tóm tắt + file chạm tới).
- Nếu một phase bị chặn, đổi trạng thái thành ⛔ kèm lý do ngay trong ô Trạng thái, đừng để trống.
