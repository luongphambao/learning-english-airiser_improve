# Đánh giá trước hạn nộp — AI Riser Vietnam 2026

> Rà soát toàn bộ dự án (data flow, system flow, UI, bảo mật, vận hành) đối chiếu với bộ tiêu chí
> chấm điểm chính thức. Ngày rà soát: **17/08/2026**, trên commit `a44814a`.
>
> Khác với `status.md` (ghi cái gì chạy được / chưa chạy được), file này chỉ trả lời một câu:
> **điều gì đang làm mất điểm, và sửa theo thứ tự nào.**

---

## 1. Bộ tiêu chí và bài toán điểm số

Hạng Bạc = Top 500 bảng xếp hạng, xếp hoàn toàn theo tổng điểm bài nộp.

| Hạng mục | Điểm | Ghi chú |
|---|---:|---|
| **Đánh giá ý tưởng** | 100 | Sáng tạo 30% · **Khả thi 40%** · Tác động 30% |
| Tích hợp công nghệ Google | +10 | Mức độ chuyên sâu, hiệu quả, khai thác hợp lý |
| Xuất bản ứng dụng | +10 | Link công khai; web **bắt buộc** trên Cloud Run |
| Nộp Form hoàn thành sớm | +3 | 200 dự án đầu tiên |
| **Tổng tối đa** | **123** | |

Ba điều rút ra, và cả ba đều đổi thứ tự ưu tiên so với trực giác thông thường:

**a. Tính khả thi là khối lớn nhất (40 điểm).** Lớn hơn sáng tạo, lớn hơn tác động. Với dự án này
đó là tin tốt — nền kỹ thuật là điểm mạnh nhất. Nhưng nó cũng có nghĩa là mọi thứ khiến giám khảo
nghi ngờ độ hoàn thiện đều đắt gấp đôi so với cảm giác. Tài liệu tự khai là đang hỏng (mục 4) tấn
công thẳng vào đúng khối 40 điểm này.

**b. Hai điểm thưởng 10 là nhị phân, không phải thang trượt.** 20 điểm — bằng 2/3 toàn bộ hạng mục
sáng tạo — nằm ở hai việc cấu hình, không phải hai việc xây dựng. Một trong hai đã có; một đang bị
hỏng bởi đúng một biến môi trường (mục 3).

**c. 3 điểm nộp sớm đang hết hạn dần.** Giới hạn 200 dự án đầu. Đây là điểm duy nhất trong bảng
không mua được bằng công sức kỹ thuật — chỉ mua được bằng việc nộp form sớm.

> **Câu hỏi còn mở — cần tự xác minh:** thể lệ ghi Top 500 *"bao gồm các giải pháp đạt Hạng Đồng"*.
> Tức Hạng Đồng là **cửa ải bắt buộc** trước khi được xếp hạng Bạc. Tiêu chí đạt Hạng Đồng không có
> trong phần thể lệ đang có. Cần lấy từ ban tổ chức trước khi chốt kế hoạch — nếu Hạng Đồng có yêu
> cầu bắt buộc riêng (ví dụ phải hoàn thành một khoá học, một checklist nộp bài), thì việc đó phải
> đứng trước mọi mục trong file này.

---

## 2. Kết quả kiểm tra thực tế

Đã chạy thật, không suy đoán:

> **Cập nhật 17/08 (đợt sửa):** mục 5 và mục 6 **đã sửa xong**, kèm cổng đăng nhập + chế độ khách
> (ADR-026). Chi tiết ở cuối mỗi mục. Sau khi sửa: **608/608 test xanh**, typecheck sạch, lint 0 lỗi.

| Kiểm tra | Kết quả |
|---|---|
| `npx vitest run` | ~~**546/546 test xanh**~~ — sai. Thực tế lúc rà soát là **532/546**: 14 test `migrations.test.ts` đỏ vì Node 26 định nghĩa sẵn `localStorage` toàn cục trả `undefined`, chặn jsdom cấp bản thật. CI ghim Node 22 nên CI xanh. Đã vá bằng polyfill trong `vitest.setup.ts` |
| `npx tsc --noEmit` | Sạch — lỗi duy nhất đến từ `.next/` cũ tham chiếu route đã xoá |
| `npx eslint .` | 0 lỗi, 1 cảnh báo (`login/page.tsx:87` exhaustive-deps) |
| `curl` URL Cloud Run | **HTTP 200**, 7,6s (cold start) |

**Lưu ý về môi trường:** `node_modules` trong bản làm việc đang hỏng (rỗng) — phải chạy `npm ci`
mới đo được. Không ảnh hưởng CI, nhưng nếu bạn đang thấy cả trăm lỗi typecheck trong IDE thì đó là
nguyên nhân, không phải code.

---

## 3. Điểm thưởng Google — đang mất phần lớn 10 điểm vì một biến môi trường

**Đây là phát hiện quan trọng nhất của toàn bộ đợt rà soát, và cũng là thứ rẻ nhất để sửa.**

Bản export cấu hình Cloud Run (`service.yaml`, snapshot ngày 12/08) cho thấy môi trường production
đang chạy:

```yaml
- name: AI_PROVIDER
  value: openai
```

Đối chiếu với `lib/ai/provider.ts`: `getTextProvider()` đọc đúng biến này. Với giá trị `openai`,
**toàn bộ tác vụ văn bản đi tới một model không phải của Google.** `GEMINI_API_KEY` vẫn được đặt,
nên `getTtsProvider()` vẫn dùng Gemini — nhưng TTS là *một* trong sáu tính năng AI.

Nghĩa là trên bản deploy công khai mà giám khảo sẽ bấm vào:

| Tính năng AI | README tuyên bố | Production thực tế |
|---|---|---|
| Phân tích tài liệu công việc | `gemini-3.6-flash` | OpenAI-compatible |
| Đào từ vựng từ PDF/DOCX | `gemini-3.6-flash` | OpenAI-compatible |
| Trích xuất từ | `gemini-3.6-flash` | OpenAI-compatible |
| Làm giàu dữ liệu từ | `gemini-3.6-flash` | OpenAI-compatible |
| Chấm câu người dùng viết | `gemini-3.6-flash` | OpenAI-compatible |
| Đọc từ (TTS) | `gemini-3.1-flash-tts-preview` | ✅ Gemini |

README mở đầu bằng *"on Google technology end to end — Gemini for every AI feature"*. Với bản đang
chạy, câu đó đúng 1/6. Hạng mục được chấm là *"mức độ chuyên sâu, tính hiệu quả và việc khai thác
hợp lý các công nghệ của Google"* — một giám khảo mở network tab sẽ thấy ngay.

**Cách sửa — một dòng:**

```bash
gcloud run services update learning-english-airiser \
  --region=asia-southeast1 \
  --update-env-vars=AI_PROVIDER=gemini
```

Code không cần đổi gì cả. `lib/ai/config.ts` đã mặc định `gemini`, đã có `createGeminiProvider`
đầy đủ, ADR-012 đã ghi rõ Gemini là provider chính cho bản dự thi. Chỉ có production là chưa theo.

**Sau khi đổi, phải kiểm lại:** chạy hết một vòng qua `/learn` (dán văn bản), `/practice` (chấm câu
viết) và một lần tải PDF để chắc chắn output của Gemini vẫn khớp schema Zod. `lib/ai/gemini-schema.ts`
và `openai-schema.ts` là hai đường sinh schema khác nhau — đây là chỗ dễ hỏng nhất khi đổi provider,
và cũng là lý do phải đổi **sớm**, không phải đêm trước hạn nộp.

### 3b. `APP_URL` đang trỏ sai domain — và nhiều khả năng đây chính là lỗi Google Sign-In

```yaml
- name: APP_URL
  value: https://learning-english-airiser.ai.studio
```

Nhưng service thật phục vụ tại `https://learning-english-airiser-370616158892.asia-southeast1.run.app`.

`lib/auth/google.ts` → `resolveOrigin()` **ưu tiên `APP_URL`** hơn origin của request, rồi dựng
`redirect_uri = ${APP_URL}/api/auth/google/callback`. Tức luồng OAuth đang gửi Google một
redirect_uri thuộc domain `ai.studio`, trong khi người dùng đang đứng trên domain `run.app`.

`status.md` ghi Google Sign-In *"stalls on the Firebase auth handler, most likely a missing
authorized redirect URI"*. Chẩn đoán gần đúng nhưng nhầm chỗ: nhiều khả năng không phải Firebase
Console thiếu URI, mà là `APP_URL` đang khai một domain khác với domain đang chạy. Đây là giả
thuyết cần kiểm chứng, nhưng nó khớp với triệu chứng và kiểm chứng rất rẻ.

**Cách sửa:** đặt `APP_URL` bằng đúng URL Cloud Run sẽ nộp bài, rồi thêm chính
`${APP_URL}/api/auth/google/callback` vào authorized redirect URIs của OAuth client.

### 3c. Cruft trong cấu hình production

`SQL_DB_NAME=cloud_sql_production_database` — không có dòng code nào trong repo đọc biến này. Dự án
không dùng Cloud SQL. Đây là env var thừa sót lại từ template. Vô hại về mặt chạy, nhưng nếu giám
khảo được xem cấu hình thì nó là tín hiệu cẩu thả. Xoá đi.

---

## 4. Điểm thưởng xuất bản — đã có, nhưng đang có hai rủi ro

Tin tốt: yêu cầu *"web app bắt buộc lưu trữ trên Google Cloud Run"* đã thoả. Service đang chạy,
`ingress: all`, `invoker-iam-disabled: 'true'` → thật sự công khai, không cần đăng nhập IAM.
10 điểm này coi như đã vào túi.

Hai điều có thể làm hỏng nó:

**a. Nộp nhầm URL.** Có hai domain cùng sống: `run.app` (Cloud Run) và `ai.studio`. Thể lệ ghi rõ
web app **bắt buộc** trên Cloud Run. **Phải nộp URL `run.app`.** Nộp link `ai.studio` là tự bỏ
10 điểm dù ứng dụng vẫn chạy tốt.

**b. `maxScale: '1'` cộng cold start 7,6 giây.** Chỉ một instance được phép tồn tại. Trong giai
đoạn chấm bài, nếu nhiều giám khảo mở cùng lúc thì họ xếp hàng sau nhau; ai xui thì gặp trang trắng
gần 8 giây trước khi thấy gì. Ấn tượng đầu tiên của toàn bộ bài nộp nằm ở 8 giây đó.

**Cách sửa:** nâng `maxScale` lên 3–5 và đặt `minScale: 1` để giữ một instance ấm suốt kỳ chấm.
Chi phí không đáng kể trong vài tuần; đổi lại là trang mở tức thì.

```bash
gcloud run services update learning-english-airiser \
  --region=asia-southeast1 --min-instances=1 --max-instances=5
```

> Lưu ý phụ: `maxScale: 1` hiện đang vô tình khiến rate limiter trong bộ nhớ hoạt động đúng như
> thiết kế (chỉ một tiến trình). Nâng maxScale sẽ nhân hạn mức lên theo số instance — chấp nhận
> được, và mục 6 xử lý gốc rễ vấn đề đó.

---

## 5. Tài liệu đang tự khai là hỏng — tấn công thẳng vào khối 40 điểm

Đây là nhóm vấn đề đắt nhất về điểm và rẻ nhất về công. Giám khảo đọc README và `status.md` trước
khi mở code. Cả hai đang mô tả một phiên bản Lexio **cũ hơn và tệ hơn** phiên bản thật.

| Tài liệu nói | Thực tế trong code | Thiệt hại |
|---|---|---|
| README: bảng xếp hạng là *"sample roster"*, *"chỉ dòng của bạn là thật"* | ADR-025 đã thay bằng collection `leaderboard/{uid}` thật, có rules validate. `MOCK_ROSTER` không còn tồn tại | Tự khai một tính năng thật thành giả |
| Ảnh trong `UI/` còn nhãn "mẫu" trên từng dòng | Ảnh chụp trước ADR-025 | Bằng chứng hình ảnh cho lời khai sai ở trên |
| `status.md`: *"Seven migration tests are failing"* | **546/546 xanh**, gồm cả `migrations.test.ts` | Tự khai suite xanh thành suite đỏ |
| `docs/README.md`: *"10 quyết định kiến trúc"* | 23 ADR | Tự khai thấp đi hơn một nửa |
| `docs/README.md`: *"AI mặc định OpenAI-compatible, Gemini là lựa chọn thứ hai"* | ADR-012 đã đảo lại, `config.ts` mặc định `gemini` | Mâu thuẫn với chính thông điệp dự thi |
| `docs/README.md`: *"giữ diện mạo AI Studio (indigo/slate/gradient)"* | Giao diện thật là warm paper / forest green | Mô tả sai sản phẩm |

**Đã sửa toàn bộ.** README (bảng xếp hạng, mặc định Gemini, số ADR), `docs/README.md` (số ADR, mặc
định AI, bảng màu), `docs/design.md` (§1 đánh dấu là bản ghi lịch sử, §4 thành nguồn sự thật),
`docs/spec-gaps.md` (G2 và G4 gạch ngang), `docs/status.md` (bỏ lời khai test đỏ, thêm cổng đăng
nhập), và comment `MOCK_ROSTER` sót trong `lib/leaderboard/metrics.ts`.

Thêm hai việc audit chưa bắt: `docs/decision.md` giờ có nhãn "bị thay thế" trên ADR-003 và ADR-006
(trước chỉ ADR-023 có), và **ADR-024 đã được viết bù** — `lib/domain/user.ts:6` trích dẫn nó cho
quyết định i18n nhưng nó chưa từng tồn tại. ADR-026 ghi lại cổng đăng nhập + chế độ khách.

Ảnh `UI/10-…18-…` (bảng xếp hạng còn nhãn "mẫu") **đã xoá**: không file markdown nào trỏ tới chúng
— mọi ảnh README đều trỏ `UI/readme/*` — nên `npm run screenshots` sẽ không bao giờ thay được chúng.

---

## 6. Bảo mật

Không hạng mục nào chấm riêng bảo mật, nhưng một lỗ hổng bị phát hiện trong lúc demo sẽ đánh
thẳng vào "tính khả thi". Ngoài ra hai mục đầu là rủi ro vận hành thật cho chính bạn.

### 6.1 · Nghiêm trọng — `app/api/gmail/send-reminder/route.ts` không có lớp bảo vệ nào

Mọi route `/api/ai/*` đi qua `createAiRoute` và nhận đủ bốn lớp: kiểm tra origin, giới hạn kích
thước body, validate Zod, rate limit. Route Gmail **không có lớp nào trong bốn lớp đó** — nó đọc
thẳng `req.json()` rồi dùng luôn.

Bốn vấn đề trong cùng file:

- **Chèn header email.** `` `To: ${recipient}` `` được nối bằng `\r\n`. Một `recipient` chứa ký tự
  xuống dòng sẽ chèn được header tuỳ ý (`Bcc`, …) vào email gửi từ Gmail thật của người dùng.
- **Chèn HTML vào thân email.** `w.word`, `w.meaningVi`, `w.exampleSentence`, `w.ipa` nội suy thô,
  không escape. Đây là chuỗi đáng lo nhất: *tài liệu tải lên → Gemini trích xuất từ → nếu tài liệu
  chứa prompt injection thì HTML/link do kẻ tấn công soạn đi thẳng vào email gửi từ tài khoản Gmail
  thật.* README quảng cáo *"nội dung tải lên luôn được coi là dữ liệu, không phải chỉ thị"* — đây
  đúng là chỗ lời hứa đó bị hở.
- **Không rate limit.** Gọi liên tục đốt hạn ngạch Gmail API của tài khoản.
- **Rò lỗi upstream.** `message: msg` trả nguyên văn Error của googleapis về client.

Thêm một chi tiết không phải lỗ hổng nhưng sẽ rất khó coi khi demo: body rỗng → route gửi email
chứa ba từ hard-code `constitute` / `throughput` / `leverage`. Giám khảo bấm thử tính năng nhắc học
trên tài khoản trống sẽ nhận đúng email đó.

**Sửa:** bọc bằng đúng bộ guard của `createAiRoute`; validate `recipient` bằng regex email và từ
chối mọi ký tự xuống dòng; escape HTML cho cả bốn trường; trả mã lỗi cố định; **bỏ hẳn danh sách
từ demo mặc định** — không có từ thì trả 400.

**Đã sửa.** Route giờ chạy đúng thứ tự guard của `createAiRoute` (origin → cap body 64KB → Zod →
rate limit 3/phút·20/ngày), `recipient` qua `z.string().email()` cộng một `.refine()` chặn `\r\n`,
`words` bắt buộc `.min(1)` nên body rỗng trả 422 thay vì gửi email mẫu, cả bốn trường đi qua
`lib/api/html-escape.ts` (file mới — repo trước đó không có tiện ích escape nào), và lỗi upstream
chỉ còn nằm ở `console.error`. `app/api/gmail/__tests__/send-reminder.test.ts` khoá lại từng điểm:
chèn header, body rỗng, escape HTML, rate limit, và rò lỗi.

### 6.2 · Cao — guard origin có đường vòng, route AI chưa cần đăng nhập

`lib/api/guards.ts:17`:

```ts
if (!origin) return secFetchSite === null;
```

Trình duyệt luôn gửi `Sec-Fetch-Site`, nên logic này đúng với trình duyệt. Nhưng `curl` — và mọi
script — không gửi cả `Origin` lẫn `Sec-Fetch-Site`, tức rơi đúng vào nhánh `true`. Guard này chặn
được trang web khác, **không chặn được script.**

Lớp còn lại là rate limit, mà nó theo IP và nằm trong bộ nhớ tiến trình — đổi IP là reset. Không
route AI nào yêu cầu đăng nhập. Với một URL công khai đang được quảng bá cho cuộc thi, đây là một
endpoint tính tiền AI để mở.

Comment ngay trên hàm ghi *"No accounts exist yet in this pass"* — câu này đã sai, Firebase Auth
đã có.

**Sửa:** yêu cầu session hợp lệ (`getUserSession()` vốn đã verify Firebase ID token) cho các route
tốn kém (`analyze-work`, `analyze-doc`, `enrich-batch`), rate limit theo `uid` thay vì IP. Muốn giữ
trải nghiệm dùng thử không cần tài khoản thì đặt hạn mức ẩn danh riêng, thật thấp. Đổi nhánh
`!origin` thành từ chối.

**Đã sửa, theo hướng khác một chút.** Nhánh `!origin` giờ từ chối. Thay vì bắt đăng nhập cho cả ba
route tốn kém, app dựng hẳn **cổng đăng nhập kèm chế độ khách** (ADR-026): khách vẫn dùng được
`analyze-work` và `enrich-batch` — đó là câu chuyện khác biệt của sản phẩm, mục 10 — nhưng đường tài
liệu (`analyze-doc` **và** `parse-doc`, chỗ file thật sự được nhận) yêu cầu session. Rate limit giờ
tính **cả hai khoá**: theo IP và theo `uid` khi có session, chặn nếu một trong hai cạn.

> **Rủi ro còn lại, cố ý chấp nhận:** `lexio_user_session` chỉ là base64 chưa ký nên script tự chế
> được cookie để qua guard `requireSession`. Guard này vì thế là *cổng sản phẩm*, không phải biên
> bảo mật — phần chi tiền vẫn được che bằng kiểm tra origin và rate limit theo IP, cả hai không bị
> cookie bỏ qua. Ký cookie (hoặc dùng Firebase session cookie qua Admin SDK) nằm ở P3.

### 6.3 · Cao — cookie chứa OAuth refresh token thiếu cờ `secure`

`gmail_auth_tokens` và `lexio_user_session` đều đặt `httpOnly` + `sameSite: 'lax'` nhưng **không**
đặt `secure: true`. `httpOnly` chặn JavaScript đọc, nó không chặn cookie đi qua HTTP thường.

Cookie Gmail đang mang **refresh token của Google**, chỉ base64 — không mã hoá, không ký. Base64 là
mã hoá ký tự, không phải bảo vệ.

**Sửa:** thêm `secure: process.env.NODE_ENV === 'production'` vào cả hai chỗ `cookieStore.set()`.

**Đã sửa.** Cả `lib/auth/google.ts` lẫn `lib/auth/user-session.ts`.

---

## 7. Giao diện và luồng người dùng

> **Cập nhật 17/08:** 7.1, 7.2 và 7.3 **đã sửa xong** — chi tiết ở cuối mỗi mục. 7.4 chưa làm.
> Sau khi sửa: typecheck sạch, lint 0 lỗi, 546/546 test xanh, `npm run build` thành công, và đã
> kiểm chứng bằng ảnh chụp thật ở 3 khung hình (390 / 1280 / 1536 px).

### 7.1 · Trên desktop, khoảng 60% khung hình là chỗ trống

`app/(tabs)/layout.tsx:15` dùng `max-w-3xl mx-auto`. README mô tả sản phẩm *"thiết kế cho điện
thoại và mở rộng lên trên"* — thực tế nó không mở rộng lên, chỉ căn giữa cột điện thoại rồi để
trống hai bên. Giám khảo gần như chắc chắn xem trên desktop.

**Đã sửa.** `app/(tabs)/layout.tsx` và `app/(stack)/layout.tsx` nới lên `lg:max-w-5xl`; Trang chủ
(`app/(tabs)/today/page.tsx`) thành lưới hai cột từ `lg`: cột trái là kế hoạch hôm nay + "Học từ
công việc", rail phải là streak + hai ô điều hướng + "cần chú ý".

Hai điểm đáng ghi lại:

- **Thứ tự trên điện thoại không đổi một pixel nào.** Dưới `lg` đây vẫn là `flex flex-col`, nên thứ
  tự DOM chính là thứ tự hiển thị. Việc xếp cột dùng `lg:col-start`/`lg:row-start` tường minh thay
  vì auto-placement — vừa tránh auto-placement xé đôi rail, vừa không phải đảo DOM (đảo DOM sẽ đảo
  luôn thứ tự Tab của người dùng bàn phím). Đã đối chiếu ảnh chụp 390px trước/sau: giống hệt.
- **Sổ tay trống thì không có rail** (streak và "cần chú ý" đều chỉ hiện khi `hasNotebook`), nên
  khối onboarding tự trải cả hai cột thay vì để trống nửa phải — giới hạn `lg:max-w-2xl` để nút CTA
  không kéo dài 1024px.

Không cần đụng tới 4 component bài tập: cả bốn đã tự giới hạn `max-w-md`/`max-w-lg mx-auto`, nên
việc nới shell không làm chúng giãn ra.

### 7.2 · Màn hình chờ của vòng lặp cốt lõi là một dòng chữ trên nền trắng

"Đang chuẩn bị bài học..." hiện giữa một trang trống hoàn toàn, ngay trước tính năng quan trọng
nhất của sản phẩm. Trông như trang bị lỗi. `components/layout/app-boot-skeleton.tsx` đã có sẵn,
chỉ chưa dùng ở đây.

**Đã sửa.** Thêm `SessionSkeleton` trong `app/(tabs)/practice/page.tsx`. Điểm khác biệt so với một
skeleton thường: **banner xanh không phải ô xám mà là banner thật** — nhãn và tiêu đề của nó là chuỗi
tĩnh, không phải chờ dữ liệu gì cả. Chỉ những phần thật sự cần dữ liệu buổi học mới là placeholder
(dòng mô tả, hàng chấm tiến trình, thẻ bài tập). Số chấm lấy từ `settings.sessionSize` nên đúng bằng
độ dài buổi học đang được dựng, và lúc bàn giao sang màn thật gần như không có layout shift.

Dòng thông báo cho trình đọc màn hình được giữ nguyên dưới dạng `sr-only` + `aria-live="polite"`;
toàn bộ placeholder mang `aria-hidden`.

### 7.3 · Vài chuỗi tiếng Việt lọt ra ngoài lớp i18n

`app/(stack)/placement/page.tsx:167` — `confirmLabel="Bắt đầu học"` là chuỗi UI thật, không dịch
khi chuyển sang tiếng Anh. Ba nhãn nguồn ghi thẳng vào Dexie (`'Tự thêm'`, `'Đoạn văn đã dán'`,
`'Bài kiểm tra trình độ'`) bị đóng băng vĩnh viễn theo ngôn ngữ lúc tạo.

**Đã sửa.** `confirmLabel` giờ đi qua `t('placement.triage.confirmCta')`.

Ba nhãn nguồn xử lý qua `lib/i18n/source-label.ts` (file mới). `Word.source.label` là một field
**lẫn lộn**: một số giá trị là dữ liệu người dùng tuyệt đối không được dịch (tên tài liệu tải lên,
ví dụ `"Công việc: report.pdf"`), số còn lại là nhãn hệ thống cần đổi theo ngôn ngữ. Nên cách sửa là
writer hệ thống lưu **khoá i18n có gắn dấu** (`@vocabulary.sourceKind.manual`) thay vì lưu câu chữ,
còn `resolveSourceLabel()` chỉ dịch những giá trị mang dấu và trả nguyên văn mọi giá trị khác.

Hệ quả: **không cần migration.** Các dòng ghi trước thay đổi này chứa tiếng Việt trần, không có dấu,
nên vẫn hiển thị y như cũ — không phải backfill gì, và tên file của người dùng không bao giờ bị nhầm
thành khoá.

### 7.4 · Chưa từng chạy đợt rà soát accessibility nào

Ghi nhận từ chính `status.md` (Phase 8). Nền có sẵn khá tốt — `aria-current` đã đặt đúng trên tab
bar, `prefers-reduced-motion` đã có trong CSS — nên đây có thể chỉ là rà soát, không phải làm lại.
Ưu tiên thấp hơn mọi mục trên.

**Đã làm.** Dự đoán "chỉ là rà soát" đúng — bốn lỗi, đều nhỏ:

- `eslint.config.mjs` giờ bật **22 quy tắc `jsx-a11y` ở mức error** (preset của Next chỉ có 6, đều
  `warn`, và không quy tắc nào chạm tới bàn phím, nhãn hay thứ tự heading). Bắt được: `<label>` cho
  select trình độ ở Settings không liên kết với control, và backdrop của `Sheet` là `<div>` có
  `onClick` — bàn phím không tới được. Backdrop giờ là `<button>`; `Sheet` cũng được thêm
  `role="dialog"` + `aria-modal`.
- `npm run a11y` (mới, `scripts/a11y-scan.mjs` + `@axe-core/playwright`) quét 9 route × 2 theme.
  Bắt được thứ ESLint không thể thấy vì chỉ tồn tại sau khi render: `<select>` giờ nhắc email ở
  Calendar không có tên khả truy cập, và **ba lỗi tương phản màu** — badge `bg-white/20` cùng dòng
  mô tả `text-paper/80` trên banner xanh, và chip "Từ mới" `bg-rule text-ink-soft` trong Sổ tay.
- Sau khi sửa: **0 vi phạm ở mọi mức**, cả sáng lẫn tối.

Còn treo (ghi vào `status.md` thay vì cố làm sát hạn nộp): đi bàn phím thủ công từng màn, thử với
trình đọc màn hình thật, và bẫy focus trong bottom sheet.

---

## 8. Những thứ đang thật sự tốt — không đụng vào trước hạn nộp

Phần lớn codebase này tốt hơn mặt bằng sản phẩm dự thi. Nếu định refactor gì đó, đây là danh sách
**không** nên đụng:

- **`lib/sync/merge.ts`** — xử lý va chạm khi hai thiết bị cùng tạo một từ với hai `id` khác nhau,
  giữ bản tạo trước làm canonical để các `wordId` đang tham chiếu không treo, gộp tiến độ SRS bằng
  `max()` theo từng trường. Và `recomputeStatsFromReviews` chọn **tính lại** thống kê từ đầu thay
  vì merge như dữ liệu — vì merge kiểu nào cũng đếm sai khi hai thiết bị cùng ghi. Đây là tư duy
  hệ phân tán thật.
- **Pipeline `createAiRoute`** — mọi route AI rút gọn thành một dòng, thứ tự guard nhất quán,
  retry, timeout, log usage. Chính vì nó tốt nên vấn đề route Gmail ở mục 6.1 mới nổi bật: đó là
  ngoại lệ duy nhất.
- **`firestore.rules`** — whitelist trường trên collection leaderboard là cách *thực thi* lời hứa
  "không rò dữ liệu cá nhân", không phải chỉ ghi chú về nó. Chặn `updatedAt` tương lai để không ai
  ghim mình lên đầu bảng vĩnh viễn là chi tiết được nghĩ kỹ.
- **CI** — Workload Identity Federation không lưu key dài hạn, job riêng chặn `service.yaml` lọt
  vào repo, smoke test revision sau deploy. Mức thực hành production.
- **`npm run demo`** — kịch bản Playwright đi hết mọi tính năng, trả lời mọi lời gọi AI từ bảng
  fixture nên không cần API key, không tốn tiền, kết quả giống nhau mỗi lần chạy. **Đây là tài sản
  demo giá trị nhất trong repo — dùng nó để quay video nộp bài.**
- **23 ADR** — mỗi quyết định lệch khỏi spec đều có lý do viết ra. Bằng chứng mạnh cho khối 40 điểm
  "tính khả thi".

---

## 9. Thứ tự làm

### P0 — làm ngay, xong trước mọi thứ khác

1. **Xác minh tiêu chí Hạng Đồng** với ban tổ chức. Đây là cửa ải bắt buộc; mọi thứ dưới đây vô
   nghĩa nếu chưa qua được nó.
2. **Nộp Form hoàn thành** để lấy 3 điểm nộp sớm (giới hạn 200 dự án đầu). Điểm duy nhất không mua
   được bằng công sức kỹ thuật.
3. **`AI_PROVIDER=gemini` trên production** (mục 3). Một lệnh `gcloud`, cứu phần lớn 10 điểm tích
   hợp Google. **Đổi sớm để còn thời gian test lại schema Gemini.**
4. **Sửa `APP_URL`** về đúng domain Cloud Run và cập nhật authorized redirect URI (mục 3b) — nhiều
   khả năng mở khoá luôn Google Sign-In.
5. **Chốt URL nộp bài là link `run.app`**, không phải `ai.studio` (mục 4a).

### P1 — trước hạn nộp

6. ~~**Vá route Gmail** (mục 6.1)~~ — **xong**.
7. ~~**Bắt đăng nhập cho đường tài liệu** và chặn nhánh `!origin` (mục 6.2)~~ — **xong**, kèm cổng
   đăng nhập + chế độ khách (ADR-026).
8. ~~**Thêm `secure: true`** cho cả hai cookie (mục 6.3)~~ — **xong**.
9. ~~**Sửa toàn bộ doc drift** ở mục 5~~ — **xong**. Chụp lại ảnh `UI/readme/` vẫn còn treo: bố cục
   desktop và màn đăng nhập đều đã đổi.
10. **`minScale: 1`, `maxScale: 5`** để giám khảo không gặp cold start 8 giây (mục 4b).
11. **Xoá `SQL_DB_NAME`** khỏi env production.

### P2 — nếu còn thời gian

12. ~~Bố cục desktop hai cột cho Trang chủ / Tiến độ / Bảng xếp hạng~~ — **xong** (mục 7.1).
13. ~~Skeleton cho màn hình chờ Luyện tập~~ — **xong** (mục 7.2).
14. ~~i18n cho `confirmLabel` và ba nhãn nguồn~~ — **xong** (mục 7.3).
15. ~~Xoá `.next/` cũ để `npm run typecheck` sạch tuyệt đối~~ — **xong**, typecheck giờ sạch hoàn toàn.
16. Chụp lại ảnh README (`npm run screenshots`) — bố cục desktop đã đổi nên ảnh cũ không còn đúng.
    Gộp chung với việc chụp lại ở P1 mục 9.

### P3 — sau cuộc thi

17. ~~Rà soát accessibility (mục 7.4)~~ — **xong**; còn lại là đi bàn phím thủ công và thử
    trình đọc màn hình thật.
18. **Ký cookie session** (hoặc chuyển sang Firebase session cookie qua Admin SDK). Hiện
    `lexio_user_session` là base64 chưa ký nên guard `requireSession` là cổng sản phẩm, không phải
    biên bảo mật — xem 6.2.
19. Rate limit dùng Redis — seam đã chừa sẵn trong `lib/api/rate-limit.ts`.
20. Cloud Function đối chiếu số liệu leaderboard, nếu tính năng này từng cần chống gian lận.

---

## 10. Một nhận xét về định vị

`lexio_ai_riser_top500_strategy.md` lập luận rằng Lexio nên định vị là "AI English Coach cho người
đi làm Việt Nam" thay vì một app từ vựng có AI. Lập luận đó đúng, và điều đáng nói là:
**sản phẩm đã đúng như thế rồi, chỉ phần trưng bày chưa theo kịp.**

Tab "Học từ công việc" là tab thứ hai trong thanh điều hướng, luồng đã hoàn chỉnh, và nó thật sự
nhận email công việc thật rồi trả về từ vựng, cụm từ, ghi chú ngữ pháp và bản viết lại. Đó chính là
câu chuyện khác biệt — thứ nuôi cả 30 điểm sáng tạo lẫn 30 điểm tác động. Nhưng README mở đầu bằng
kiến trúc, ảnh chụp đưa Trang chủ lên trước, và bảng xếp hạng — thứ ít khác biệt nhất trong toàn
sản phẩm — lại là thứ README tự bôi xấu dài nhất.

Nếu chỉ được sửa một thứ ngoài danh sách P0: dựng lại phần trưng bày quanh vòng lặp *"mang việc
thật của bạn vào"*. Dán một email → Gemini phân tích → luyện luôn những từ đó. Đó là 30 giây đầu
tiên của video demo, và là điều một app từ vựng chung chung không làm được.

---

## Nguồn và giới hạn của đợt rà soát này

- Kiểm tra sức khoẻ (mục 2): **chạy thật** trên commit `a44814a` sau `npm ci`.
- URL Cloud Run: **kiểm chứng thật** bằng `curl`, HTTP 200.
- Cấu hình production (mục 3, 4): đọc từ `service.yaml` — **snapshot ngày 12/08, không phải trạng
  thái trực tiếp.** Xác minh lại bằng `gcloud run services describe learning-english-airiser
  --region=asia-southeast1` trước khi hành động.
- Phát hiện bảo mật (mục 6): **đọc code**, chưa khai thác thử trên môi trường chạy.
- Giả thuyết `APP_URL` là nguyên nhân lỗi Google Sign-In (mục 3b): **suy luận từ code**, chưa kiểm
  chứng thực nghiệm.
- Tiêu chí Hạng Đồng: **chưa có dữ liệu.**
