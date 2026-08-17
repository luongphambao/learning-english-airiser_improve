# Kế hoạch — Đặt lịch học 5–10 phút bằng Google Calendar

> Chưa triển khai. Viết theo yêu cầu ngày 17/08/2026, sau đợt sửa bảo mật + cổng đăng nhập.
> Đọc mục "Vì sao đáng làm" trước — nếu không đồng ý với phần đó thì không cần đọc tiếp.

## Vì sao đáng làm

Ba lý do, xếp theo sức nặng thật:

1. **Đây là tích hợp Google thứ năm, và là cái duy nhất thêm được mà không phải bịa ra nhu cầu.**
   Hạng mục "Tích hợp công nghệ Google" (+10) chấm *"mức độ chuyên sâu, hiệu quả, khai thác hợp lý"*.
   Lexio đã có Gemini, Firebase, Gmail, Cloud Run. Calendar là thứ khớp tự nhiên với một sản phẩm
   mà toàn bộ luận điểm là "3 phút mỗi ngày" — lời hứa đó hiện không có gì bảo vệ nó ngoài ý chí
   người dùng.
2. **Nó vá đúng lỗ hổng `status.md` đang tự khai.** Hiện ghi: *"Reminder emails are sent on demand.
   There is no scheduler."* Nhắc học mà phải tự bấm thì không phải nhắc học. Calendar là scheduler
   **của Google**, không phải scheduler ta phải tự dựng và tự trả tiền chạy.
3. **Chi phí hạ tầng bằng không.** Không cron, không Cloud Scheduler, không worker. Sự kiện nằm
   trong lịch của người dùng, và chính Google gửi thông báo.

**Vì sao Calendar chứ không phải Meet:** một buổi ôn từ vựng 5 phút là việc một mình. Một phòng
video không ai vào chỉ làm giám khảo bối rối. Bạn đã tự sửa lại điều này — ghi ra đây để sau không
ai đề xuất lại.

## Phạm vi

**Làm:**
- Ở Cài đặt: chọn giờ học hằng ngày và độ dài (5 hoặc 10 phút) → tạo **một sự kiện định kỳ**
  (`RRULE:FREQ=DAILY`) trên lịch chính, có `reminders.overrides` popup ngay lúc bắt đầu.
- Mô tả sự kiện chứa deep link vào `/practice` và số từ đến hạn *tại thời điểm tạo*.
- Sửa giờ / đổi độ dài → `events.patch` đúng sự kiện đó, không tạo cái mới.
- Tắt → `events.delete`.

**Không làm (và lý do):**
- Không tạo mỗi ngày một sự kiện. Một chuỗi định kỳ là một object, không phải 365 object.
- Không đồng bộ hai chiều. Người dùng xoá sự kiện trong Google Calendar thì app phát hiện lúc gọi
  API lần sau và tự nhận là đã tắt — không polling.
- Không Google Meet, không mời người khác.
- Không đặt số từ đến hạn *động* trong tiêu đề sự kiện: sẽ cần một job chạy hằng ngày để cập nhật,
  tức đúng cái scheduler mà cả thiết kế này sinh ra để tránh.

## Việc phải làm

### 1 · Scope OAuth (**đây là rủi ro lớn nhất, làm trước**)

[app/api/auth/google/login/route.ts:20-24](app/api/auth/google/login/route.ts#L20-L24) hiện xin
`gmail.send` + `userinfo.*`. Thêm `https://www.googleapis.com/auth/calendar.events` — **chỉ sự kiện
do app tạo**, không phải `calendar` (toàn quyền đọc/ghi cả lịch). Xin scope hẹp nhất là thứ giám
khảo bảo mật sẽ nhìn.

Hai điều phải xử lý, không được bỏ qua:

- **Người đã kết nối Gmail sẽ không tự có scope mới.** Refresh token đang lưu gắn với bộ scope cũ.
  Cần phát hiện thiếu scope (Google trả `insufficient_scope`/403) và hiện lời mời kết nối lại, thay
  vì để tính năng gãy im lặng.
- **`calendar.events` là sensitive scope.** Với OAuth client đang ở chế độ Testing thì chỉ tài
  khoản trong danh sách test user dùng được — đủ cho demo cuộc thi, **không đủ cho người lạ**. Nếu
  muốn giám khảo tự bấm thử bằng tài khoản của họ thì phải thêm họ vào test users, hoặc đi
  verification (mất nhiều tuần — **không kịp hạn nộp**). Quyết định điều này trước khi viết code.

### 2 · Route mới `app/api/calendar/study-slot/route.ts`

Một route, ba method, dùng lại nguyên bộ guard vừa dựng ở đợt này:

- `isAllowedOrigin` → `getUserSession()` bắt buộc (đây là tính năng của tài khoản, khách không có)
  → `readBodyWithCap` → Zod → rate limit.
- `POST` tạo, `PATCH` sửa, `DELETE` gỡ. Lỗi trả qua `problemResponse` — **không** trả nguyên văn lỗi
  googleapis, đúng bài học mục 6.1 của audit.
- Zod: `hour` 0–23, `minute` ∈ {0,15,30,45}, `durationMinutes` ∈ {5,10}, `timeZone` là chuỗi IANA
  đối chiếu `Intl.supportedValuesOf('timeZone')` — **không** nhận chuỗi tự do rồi nhét thẳng vào
  API.

Token đọc/ghi qua `getStoredTokens`/`setStoredTokens` sẵn có
([lib/auth/google.ts](lib/auth/google.ts)) — cùng cookie `gmail_auth_tokens`, không thêm cookie mới.

### 3 · Lưu id sự kiện

Cần nhớ đã tạo sự kiện nào để `patch`/`delete` đúng cái đó. Không thêm bảng Dexie: dùng
`UserSettings` (đã đồng bộ sẵn qua Firestore) thêm một field:

```ts
studySlot: { eventId: string; hour: number; minute: number; durationMinutes: 5 | 10 } | null
```

Nhớ bài học ADR-025 về `leaderboardName`: `getProfile()` safe-parse **cả khối** settings và fallback
nguyên khối về `DEFAULT_SETTINGS` khi fail — nên field mới phải `.optional()`/`.nullable()`, nếu
không mọi profile cũ sẽ bị reset sạch theme/locale/level.

### 4 · Giao diện

Đặt trong [app/(stack)/calendar/page.tsx](app/(stack)/calendar/page.tsx) — đã có khối "Email nhắc
học" với `<select>` giờ, khối lịch học đặt ngay cạnh là đúng chỗ, không phải Cài đặt.

Trạng thái cần vẽ: chưa kết nối Google → mời kết nối; đã kết nối chưa đặt lịch → chọn giờ + độ dài;
đã đặt → hiện giờ đang đặt, nút sửa, nút gỡ, link mở sự kiện trong Google Calendar. Khách (`useIsGuest`)
→ thẻ mời đăng nhập, giống hệt cách tab tài liệu đang làm.

i18n: khoá mới vào khối `calendar` ở **cả hai** `vi.json` và `en.json`, giữ hai file thẳng hàng.

### 5 · Múi giờ

Chỗ dễ sai nhất. Sự kiện phải gửi kèm `timeZone` IANA (`Asia/Ho_Chi_Minh`), **không** gửi UTC
offset — nếu không, giờ học sẽ trôi khi Việt Nam đổi giờ hoặc khi người dùng đi công tác. Lấy từ
`Intl.DateTimeFormat().resolvedOptions().timeZone` phía client rồi validate lại phía server.

Lưu ý: repo có sẵn quy tắc ESLint cấm `Date.now()` trong `lib/srs/**`, `lib/level/**`,
`lib/leaderboard/**`, và vitest chạy mọi test dưới hai múi giờ (`tz-utc`, `tz-ny`) đúng vì loại bug
này. Logic dựng thời điểm sự kiện nên là **hàm thuần nhận `now` tham số**, đặt ở
`lib/calendar/slot.ts`, để test được dưới cả hai múi giờ.

### 6 · Test

- `lib/calendar/__tests__/slot.test.ts` — dựng `start`/`end`/`RRULE` từ (hour, minute, duration,
  timeZone), chạy dưới cả hai project múi giờ.
- `app/api/calendar/__tests__/study-slot.test.ts` — mock `googleapis` như
  [app/api/gmail/__tests__/send-reminder.test.ts](app/api/gmail/__tests__/send-reminder.test.ts) đã
  làm: không session → 401; timeZone rác → 422; duration ngoài {5,10} → 422; lỗi upstream không rò
  ra client; thiếu scope → mã lỗi riêng chứ không phải 500 chung.
- Thêm một cảnh vào `npm run demo` (fixture, không gọi Google thật) để tính năng có mặt trong video
  nộp bài.

### 7 · Tài liệu

`docs/api_document.md` (route mới), `docs/status.md` (bỏ dòng "There is no scheduler"), README
(mục "Built on Google" thêm Calendar), và một ADR mới — ADR-027 — ghi lại **vì sao Calendar chứ
không phải Meet**, vì sao sự kiện định kỳ chứ không phải mỗi ngày một sự kiện, và ràng buộc
verification của sensitive scope.

## Thứ tự làm

1. Quyết định chuyện test users / verification (mục 1). **Nếu không giải quyết được cái này thì
   phần còn lại chỉ chạy trên tài khoản của bạn** — vẫn đủ để quay video, nhưng phải biết trước.
2. `lib/calendar/slot.ts` + test múi giờ — thuần, không cần mạng, làm xong trước khi đụng OAuth.
3. Thêm scope + xử lý kết nối lại.
4. Route + test.
5. Giao diện + i18n.
6. Tài liệu + cảnh demo.

## Ước lượng

Bước 2–5 gọn: một buổi làm việc tập trung. Bước 1 không ước lượng được bằng công sức — nó phụ thuộc
Google, và đó chính là lý do nó đứng đầu danh sách.
