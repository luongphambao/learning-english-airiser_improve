# Decision Log (ADR)

> Mỗi quyết định kiến trúc quan trọng của lần tái kiến trúc này, dạng rút gọn: bối cảnh / lựa chọn / hệ quả. Không xoá ADR cũ khi đổi ý — thêm ADR mới "supersedes" ADR cũ.

---

### ADR-001 — Giữ Next.js 15 App Router, không quay về Vite

**Bối cảnh:** `01-PROJECT-SPEC (2).md` §3 pin cứng React + Vite. Nhưng cùng spec đó lại bắt mọi lời gọi Gemini nằm trong `src/lib/gemini.ts` chạy trên **client** — với Vite, đó là gọi thẳng từ trình duyệt, nghĩa là `GEMINI_API_KEY` phải là biến `VITE_*` công khai. Đây là lỗ hổng bảo mật nghiêm trọng nhất trong toàn bộ spec (xem `spec-gaps.md` E1), và spec không hề đề cập backend proxy nào để vá nó.

**Lựa chọn:** Giữ Next.js 15 App Router (đã là baseline thực tế). Mọi lời gọi AI đi qua Route Handler phía server (`app/api/ai/**`); trình duyệt không bao giờ thấy API key.

**Hệ quả:** Lệch spec §3 và §7 (chỗ nói "no component libraries", ngụ ý no meta-framework overhead). Đổi lại: vá được lỗ hổng lớn nhất mà không cần dựng backend riêng; giữ được RSC, route-based code splitting, và toàn bộ baseline 41 file khỏi phải viết lại từ đầu. Migrate sang Vite sau này vẫn khả thi nếu cần (tầng AI/repository không phụ thuộc Next đặc thù, chỉ Route Handler thì có).

---

### ADR-002 — Local-first trên Dexie (IndexedDB), sau `Repository` interface

**Bối cảnh:** Spec pin Firestore từ Bước 3. Nhưng thiết lập Firebase project, bật Google Sign-In, deploy Security Rules cần thao tác thủ công ngoài code (tạo project, dán 6 biến config) mà lần này chưa có điều kiện làm ngay. Baseline hiện dùng `localStorage` không version, không transaction, không validate.

**Lựa chọn:** Dexie 4 (IndexedDB) đứng sau các interface `WordRepository`/`ReviewRepository`/`UserRepository`/`StudyRepository`. Không component/store nào import `lib/db/dexie.ts` trực tiếp — luôn qua `getRepos()`.

**Hệ quả:** Chạy được ngay, không cần setup ngoài. Có transaction thật (quan trọng cho `recordReview` — xem ADR-005). Có index đa cột nên không cần lọc mảng trong JS. Khi lên Firestore, chỉ viết implementation mới cho cùng interface — không đổi call site nào. Đánh đổi: chưa có sync đa thiết bị, dữ liệu mất nếu người dùng xoá dữ liệu trình duyệt (mọi entity đã có `updatedAt`/`deletedAt` sẵn từ v1 để migration path này rẻ).

---

### ADR-003 — AI provider trừu tượng, mặc định OpenAI-compatible

**Bối cảnh:** Spec pin `gemini-3-flash` / `gemini-3.1-flash-tts-preview`. Nhưng `.env` thực tế của dự án chỉ có credential cho một router OpenAI-compatible (`OPENAI_API_URL=https://router.bnksolution.com/v1`, `OPENAI_MODEL_NAME=cx/gpt-5.6-luna`); `GEMINI_API_KEY` chưa được điền giá trị thật.

**Lựa chọn:** Một interface `AiProvider` với 2 implementation — OpenAI-compatible (mặc định, chọn qua `AI_PROVIDER=openai`) và Gemini (`AI_PROVIDER=gemini`). Một zod schema định nghĩa 1 lần chiếu ra 2 hình dạng: JSON Schema `strict` cho OpenAI, `responseSchema` (Type.OBJECT) cho Gemini — xem `api_document.md`. TTS luôn thử Gemini trước (OpenAI-compatible router không đảm bảo có TTS), degrade 3 lớp về `speechSynthesis`.

**Hệ quả:** App chạy được ngay với credential đang có, không khoá cứng vào 1 vendor. Đổi lại: phải duy trì 2 adapter schema và test cả 2 provider song song; `analyzeDocument` cần đọc file trực tiếp (`inlineFiles`) — nếu provider đang chọn không hỗ trợ, route trả `501` rõ ràng thay vì âm thầm gửi prompt rỗng.

---

### ADR-004 — Session học là một object đóng băng (frozen), tạo một lần

**Bối cảnh:** Bug #2 trong baseline (`docs/progress/00-baseline-audit.md`): buổi học 5 từ bị bỏ sót ~2 từ vì danh sách "từ đến hạn" là `useMemo` phái sinh từ `words`, còn `recordReview` lại thay đổi chính `words` giữa chừng — memo co lại trong khi con trỏ vị trí tăng độc lập.

**Lựa chọn:** `buildSession()` là hàm thuần, chạy đúng 1 lần lúc bắt đầu buổi học, trả về `StudySession { items: SessionItem[], index, answers, status }` với `items` bất biến trong suốt vòng đời session. `recordReview` ghi vào Dexie (word/review/stats) nhưng **không** làm `items` thay đổi. Session được lưu lại sau mỗi câu trả lời để resume được sau F5.

**Hệ quả:** Bug #2 và bug #3 (`nowTimestamp` hardcode) biến mất về mặt cấu trúc, không phải do vá điều kiện biên. Đánh đổi: `SessionItem.snapshot` đóng băng nội dung từ tại thời điểm bắt đầu — nếu AI enrich xong ngay trong lúc user đang làm buổi học, thẻ đang hiển thị không tự cập nhật (chỉ cập nhật nếu chưa hiển thị tới).

---

### ADR-005 — `recordReview` là một transaction duy nhất (unit of work)

**Bối cảnh:** Baseline chưa từng ghi `Review` xuống đâu cả (tính điểm rồi vứt), và `UserStats` được cập nhật từ state React chứ không phải từ nguồn dữ liệu thật — nên số liệu Tiến độ dễ trôi khỏi thực tế. Spec §8.4 yêu cầu màn Tiến độ chỉ tốn **1 document read**.

**Lựa chọn:** `StudyRepository.recordReview()` mở một Dexie transaction đọc word **từ DB** (không nhận snapshot từ caller), tính lịch mới qua `nextSchedule()` thuần, ghi `word` + `review` (append-only) + tăng counter trên `user` — cả ba cùng thành công hoặc cùng rollback.

**Hệ quả:** Tiến độ = một lần đọc `user`. `reviews` trở thành audit log thật, dùng cho lịch sử theo từ và cho việc phục hồi nếu counter từng lệch. Khi lên Firestore, cùng interface này ánh xạ trực tiếp sang `runTransaction` + `FieldValue.increment()`.

---

### ADR-006 — Giữ nguyên design system AI Studio hiện tại, không áp dụng mockup `docs/ui/`

**Bối cảnh:** `docs/ui/` (23 file HTML) và spec §4 định nghĩa một ngôn ngữ thị giác khác hẳn bản đang chạy: giấy ấm `#FAF8F5`, xanh rừng `#2F6B4F`, Instrument Serif, **cấm gradient tuyệt đối**. Bản đang chạy dùng slate/indigo `#4F46E5` + gradient hero. Ban đầu kế hoạch dự định khôi phục đúng mockup.

**Lựa chọn:** Theo yêu cầu trực tiếp của chủ dự án — **giữ nguyên diện mạo AI Studio hiện tại**. Việc "token hoá" chỉ gom màu/token đang dùng về một nguồn (`@theme inline` trong `app/globals.css`) và sửa cơ chế dark mode, **không đổi giá trị màu**. UI lần này chỉ bổ sung các màn còn thiếu, vẽ theo cùng ngôn ngữ thị giác hiện tại.

**Hệ quả:** Bỏ lỡ phần copy/UX rất kỹ trong mockup (không gradient, hairline thay vì card, "guilt is not a feature"...). `docs/design.md` vẫn lưu lại bảng token mockup như tài liệu tham chiếu, để dễ quay lại nếu quyết định đổi hướng sau này. Đây là ADR có khả năng cao nhất bị đảo ngược — nếu đảo, chỉ cần đổi giá trị trong `@theme inline`, không cần viết lại component vì primitive đã tách khỏi giá trị màu cụ thể.

---

### ADR-007 — Thêm field `Word.consecutiveCorrect`

**Bối cảnh:** Spec §8.2 yêu cầu leech được gỡ trạng thái sau "2 câu trả lời đúng liên tiếp", nhưng `Word` không có chỗ lưu điều đó. Suy ra từ `reviews` collection mỗi lần chấm bài sẽ vi phạm nguyên tắc thuần (I/O trong hàm lẽ ra thuần) và tốn một query không cần thiết.

**Lựa chọn:** Thêm `consecutiveCorrect: number` vào `Word`, cập nhật ngay trong `nextSchedule()` (hàm thuần, không I/O). Dexie v2 `upgrade()` backfill `consecutiveCorrect ??= 0` cho dữ liệu cũ.

**Hệ quả:** `nextSchedule()` giữ được tính thuần, dễ test. Đánh đổi: thêm 1 field vào domain model không có trong spec gốc — ghi rõ trong `data-model.md` là field mở rộng, không phải field spec.

---

### ADR-008 — Session học và eligibility tách rời khỏi thứ tự bài tập cố định

Xem `spec-gaps.md` §B — nội dung kỹ thuật đầy đủ nằm ở đó để tránh trùng lặp. Tóm tắt: thứ tự vị trí (`fillBlank, listen, write, listen, fillBlank`) là *ưu tiên*, `isEligible()` là *luật*; leech luôn ở vị trí đầu và không bao giờ `fillBlank`; `recall` mở khoá sớm cho từ triage `partial`.

---

### ADR-009 — Một zod schema, hai phép chiếu (OpenAI strict JSON Schema / Gemini `responseSchema`)

**Bối cảnh:** Cần structured output nhất quán trên 2 provider có định dạng schema khác nhau, mà không muốn duy trì 2 bản định nghĩa tay dễ lệch nhau (baseline đã có vấn đề này: response schema lặp lại ở 3 nơi không đồng bộ — route, `types.ts`, interface cục bộ trong component).

**Lựa chọn:** `defineSchema(name, zodSchema)` dùng `z.toJSONSchema()` (zod v4) làm gốc, rồi chạy qua 2 adapter thuần: `strictifyForOpenAi` (ép `additionalProperties:false`, `required` đủ mọi key, bỏ `minItems`/`maxItems` vì OpenAI strict mode từ chối 2 keyword này) và `toGeminiSchema` (viết hoa kiểu dữ liệu, giữ `enum`, thêm `propertyOrdering`). Ràng buộc số lượng (đúng 3 distractor...) không còn được model tự đảm bảo qua schema OpenAI — chuyển sang bước `repair()` sau khi parse.

**Hệ quả:** Một nguồn sự thật duy nhất; đổi field chỉ sửa 1 chỗ. Đánh đổi: `repair()` là bước bắt buộc phải nhớ viết cho mỗi task có ràng buộc số lượng, nếu quên thì OpenAI có thể trả nhiều/ít hơn dự kiến mà không bị chặn ở tầng schema.

---

### ADR-010 — Không cài `nexu-io/open-design`

**Bối cảnh:** Chủ dự án đề nghị dùng `github.com/nexu-io/open-design` để "làm đẹp" UI.

**Lựa chọn:** Không cài. Đã kiểm tra README của repo: đây là một Electron desktop app + CLI + MCP server sinh artifact (HTML prototype, dashboard, deck, ảnh, video) cho agent — bản mã nguồn mở tương tự "Claude Design". Nó không phải component library hay bộ design token cho React/Tailwind, và không có cơ chế xuất trực tiếp thành component cho một app Next.js đang chạy.

**Hệ quả:** Không giúp gì cho việc "làm đẹp" component thực tế của Lexio. Kết hợp với ADR-006 (giữ nguyên design AI Studio), việc làm đẹp UI lần này đến từ việc dọn dẹp/token hoá những gì đang có, không phải công cụ ngoài. Nếu sau này chủ dự án muốn dùng open-design như một công cụ phác thảo ý tưởng riêng biệt (không phải để sinh code cho repo này), đó là một quyết định khác, cần yêu cầu lại rõ ràng.

---

### ADR-011 — Ngữ pháp có lịch sử riêng (`grammarAttempts`), không đi qua `recordReview`

**Bối cảnh:** spec-gaps.md C8 — `StudyRepository.recordReview()` bắt buộc một `wordId` trỏ tới `Word` có thật (đọc từ DB, throw nếu không có), nhưng `GrammarQuestion` không có quan hệ nào với `Word`: câu hỏi ngữ pháp kiểm tra cấu trúc câu, không phải một từ vựng cụ thể. `isEligible()` (`lib/srs/session.ts`) đã coi `'grammar'` là "màn hình riêng, không phải một item trong session SRS" từ Phase 4 — ép nó vào `recordReview` sẽ đi ngược thiết kế đó, không phải nối dây đơn thuần.

**3 lựa chọn cân nhắc** (nêu trong spec-gaps.md C8 gốc): (a) entity `GrammarReview`/lịch sử riêng, tách khỏi `Word`/`Review`; (b) gán tạm một `Word` liên quan cho mỗi câu hỏi ngữ pháp; (c) bỏ hẳn việc lưu kết quả, giữ ngữ pháp hoàn toàn ephemeral như hiện trạng baseline.

**Lựa chọn: (a).** Thêm bảng Dexie `grammarAttempts` (schema v2 — bảng mới qua `version(2).stores()`, không sửa `version(1)` đã phát hành) và `GrammarRepository.recordAttempt(topicId, score, total, now)`. Mỗi lần hoàn thành một quiz ghi đúng 1 dòng — không ghi theo từng câu hỏi (không cần độ chi tiết đó, và tránh 10 dòng/quiz làm phình bảng vô ích). `lastAttemptByTopic()` phục vụ badge "Lần trước: N/M" trên danh sách chủ đề ở `/grammar`.

**Vì sao không chọn (b):** một câu hỏi ngữ pháp như "chia đúng thì hoàn thành" không kiểm tra một từ vựng cụ thể nào — gán `wordId` sẽ là một liên kết giả tạo ra chỉ để thoả mãn kiểu dữ liệu, không phản ánh gì thật. Vì sao không chọn (c): điểm số bị tính xong rồi vứt ngay là hành vi baseline vốn đã bị coi là thiếu sót (không phải chủ đích thiết kế) — có một bảng lịch sử độc lập, rẻ, không đụng gì tới SRS là chi phí thấp để sửa nó.

**Hệ quả:** Ngữ pháp và Từ vựng là 2 hệ thống tiến độ song song, không chia sẻ `Review`/`recordReview`/lịch ôn tập — nhất quán với việc `isEligible('grammar', ...)` luôn `false`. Đánh đổi: nếu sau này sản phẩm thực sự muốn "làm tốt ngữ pháp giúp từ vựng liên quan được ôn sớm hơn", đây sẽ là một tính năng mới cần thiết kế lại từ đầu (map câu hỏi ↔ từ vựng liên quan), không phải bật lại nhánh (b) đã bỏ qua.

---

### ADR-012 — Gemini là provider mặc định, OpenAI-compatible lùi thành fallback

**Bối cảnh:** ADR-003 chọn OpenAI-compatible làm mặc định vì tại thời điểm đó `.env` chỉ có credential thật cho router đó. Production hiện chạy `AI_PROVIDER=openai` trỏ tới `DeepSeek-V4-Flash` qua FPT Cloud; `GEMINI_API_KEY` có sẵn nhưng chỉ được dùng cho TTS. Dự án dự thi Google AI Riser Vietnam 2026 — hạng mục có thêm điểm cộng cho việc tích hợp công nghệ Google, và bản demo hiện tại không thật sự chạy trên Gemini dù key đã có.

**Lựa chọn:** Đổi giá trị mặc định của `AI_PROVIDER` (`lib/ai/config.ts`) từ `'openai'` sang `'gemini'`. Giữ nguyên toàn bộ interface `AiProvider` và implementation OpenAI-compatible — không xoá, chỉ không còn là lựa chọn ngầm định. Đã xác minh model `gemini-3.6-flash` (hằng số `GEMINI_TEXT_MODEL`) gọi được thật với key đang cấu hình trước khi đổi mặc định.

**Hệ quả:** Structured output nghiêm ngặt hơn khi chạy Gemini — provider Gemini dùng `responseSchema` thật, còn provider OpenAI-compatible phải nhét schema vào system prompt vì router hiện tại trả rỗng nếu gửi `response_format` (xem `lib/ai/providers/openai.ts`). Môi trường Cloud Run (`service.yaml`, không commit vào repo) cần cập nhật `AI_PROVIDER=gemini` thủ công — đổi giá trị trong code không tự động đổi service đang chạy. `OPENAI_*` vẫn nên giữ trong env để fallback dùng được nếu Gemini gặp sự cố khi demo.

---

### ADR-013 — Đảo ngược ADR-006: áp dụng bảng màu ấm (`docs/design.md` §4) thay cho AI Studio indigo

**Bối cảnh:** ADR-006 tự nhận là "ADR có khả năng cao nhất bị đảo ngược" và ghi rõ lý do có thể đảo ngược rẻ: primitive tiêu thụ token (`@theme inline`), không tiêu thụ giá trị màu cụ thể. Với mục tiêu dự thi AI Riser, diện mạo indigo/gradient hiện tại đọc như một dashboard SaaS mẫu (AI Studio/Tailwind admin) thay vì một sản phẩm có bản sắc riêng — bảng màu giấy ấm/xanh rừng đã có sẵn trong `docs/design.md` §4 và 23 file mockup ở `docs/ui/` từ trước, chỉ chưa từng được áp dụng vào code đang chạy.

**Lựa chọn:** Theo yêu cầu trực tiếp của chủ dự án — áp dụng bảng màu ở `docs/design.md` §4 vào `app/globals.css` (`:root` và `[data-theme="dark"]`), xoá token `--violet`/`--color-violet` (hệ mới cấm gradient hoàn toàn), và quét thay toàn bộ class Tailwind hardcode (`indigo-*`, `emerald-*`, `rose-*`, `bg-gradient-to-*`) sang token ngữ nghĩa (`bg-green`/`text-wrong`/...) ở các file liệt kê trong `progress/board.md` Phase 1/7 kế tiếp.

**Hệ quả:** Đúng như ADR-006 dự đoán — không cần viết lại `Button`/`Sheet`/`EmptyState`/... vì các component này vốn đã tiêu thụ token, chỉ các nơi dùng trực tiếp `indigo-*`/`emerald-*`/`rose-*` (không qua token) mới cần sửa tay. Không dựng 26 primitive `components/ui/` liệt kê ở `docs/design.md` §2 — `board.md` Phase 1 đã hoãn việc đó lại vì trừu tượng hoá sớm khi chưa có đủ consumer thật, và lý do đó vẫn đúng ở phạm vi lần này.
