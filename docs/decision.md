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

---

### ADR-014 — "Học từ công việc thật": không bảng `phrases`/`workAnalyses` riêng, dùng `entryType` (viết bù)

**Bối cảnh:** Commit đưa tính năng "Học từ công việc thật" vào production đã trích dẫn "ADR-014" ở 5 nơi trong code (`lib/domain/word.ts`, `lib/db/dexie.ts`, `lib/repositories/types.ts`, `lib/db/rows.ts`, `stores/work-store.ts`) nhưng chưa từng ghi ADR thật — file này dừng ở ADR-013 trong khi code đã giả định ADR-014 tồn tại. Đánh số tiếp (ADR-015 trở đi) trên một lỗ hổng là sai; ADR này viết bù lại đúng quyết định code đã thực thi.

**Lựa chọn:** `analyzeWork` trả 4 mảng không đồng nhất (words/phrases/grammarInsights/professionalRewrites); mỗi mục được lưu như một dòng trong bảng `words` sẵn có, gắn thêm discriminator `entryType: 'word'|'phrase'|'grammar'` (mặc định `'word'` khi vắng, cho dữ liệu trước v3) — **không** dựng bảng `phrases` mới. Bản thân một work-analysis cũng không có bảng `workAnalyses` riêng — nó là một dòng trong bảng `imports` sẵn có với `kind:'work'` và payload `analysis`, cùng index `'id, createdAt, status'` mà các dòng `kind:'text'|'pdf'|'image'` đã dùng. Dexie v3 (`lib/db/dexie.ts`) chỉ thêm `entryType` + `[entryType+dueAt]` vào bảng `words`, với `upgrade()` backfill bắt buộc (IndexedDB bỏ một dòng khỏi index nếu key path là `undefined` tại thời điểm tạo index).

**Hệ quả:** `StudyRepository.recordReview`/`buildSession`/`nextSchedule`/`isEligible` không cần sửa gì để lên lịch và luyện một cụm từ hay một điểm ngữ pháp đã lưu — chúng chỉ từng thấy kiểu `Word`. Một cụm từ được lưu tay (dán đoạn văn) và cùng cụm đó được lưu lại từ "Học từ công việc" là **một dòng, không phải hai** (chung namespace `&wordLower`). Đánh đổi: `Word` mang một số field chỉ có ý nghĩa với `entryType!=='word'` (`noteVi`, `originalText`) — chấp nhận được, cùng tinh thần các field mở rộng optional từ ADR-007.

---

### ADR-015 — Nguồn corpus từ vựng: tự biên soạn thay vì NGSL/NAWL/BSL đã dự tính

**Bối cảnh:** Trước khi có tính năng này, app không hề có kho từ vựng — 5 từ demo hardcode (`lib/db/migrate-local-storage.ts`) là toàn bộ nội dung tĩnh. Kế hoạch ban đầu là suy CEFR band từ 3 danh sách tần suất mở (New General Service List, New Academic Word List, Business Service List — Browne/Culligan/Phillips, CC BY-SA 4.0, newgeneralservicelist.com), cộng một lô ~400 mục C2 do Gemini sinh (NGSL họ hết ở khoảng C1). Trong phiên làm việc đưa tính năng này vào code, không có cách nào tải, phân tích cú pháp và xác minh chính xác các file nguồn đó.

**Lựa chọn:** Ship một danh sách khởi đầu **tự biên soạn** (`scripts/corpus-source-data.ts` → `scripts/build-corpus.ts` → `public/corpus/v1/*.json`): ~190 từ tiếng Anh thật, tự chọn và tự gán band (A2/B1/B2/C1/C2), tự viết nghĩa tiếng Việt, thiên về từ vựng công sở/chuyên nghiệp — đúng đối tượng người dùng Lexio. **Không** gắn nhãn CC BY-SA 4.0 / NGSL cho nội dung này vì nó không thật sự bắt nguồn từ đó — gắn nhãn sai sẽ là khai man xuất xứ. `rank` trong mỗi file band là vị trí trong danh sách tự biên soạn (1-indexed), không phải tần suất đo được từ corpus thật. `public/corpus/v1/ATTRIBUTION.md` ghi rõ điều này và để lại đường dẫn cho người làm tiếp: trỏ `scripts/build-corpus.ts` vào `corpus-src/{ngsl,nawl,bsl}.csv` (gitignore, không commit file nguồn bên thứ ba), chạy qua `cefrFromRank(rank, list)` (`lib/level/cefr.ts`), giữ nguyên phần còn lại (`lib/corpus/**`, `lib/level/**`).

**Hệ quả:** Không có rủi ro pháp lý về giấy phép (nội dung tự viết, không phải derivative). Đổi lại: band không có độ chính xác ngôn ngữ học đã được đo lường — `lib/level/cefr.ts` gọi thẳng đây là "band độ khó nội bộ, không phải CEFR được chứng nhận". `lib/corpus/__tests__/corpus-data.test.ts` xác thực cấu trúc file thật đang ship (không trùng từ, rank tăng dần, manifest khớp số lượng) — bắt được một lần `corpus:build` hỏng trước khi lên production, bất kể nguồn dữ liệu là gì.

---

### ADR-016 — `Word.cefr` + Dexie v4: `'unknown'` nằm trong enum domain, không chỉ trong row

**Bối cảnh:** Cần một chỗ lưu CEFR band cho từng từ để phục vụ bộ máy phân trình độ (ADR-017) và corpus top-up (ADR-018), nhưng phần lớn dữ liệu hiện có (5 từ seed, mọi từ gõ tay/dán trước bản này) không có band nào cả.

**Lựa chọn:** `CefrOrUnknownSchema` (`A1..C2` cộng `'unknown'`) áp cho **cả** `Word.cefr` (domain) lẫn `WordRow.cefr` (Dexie row) — không phải chỉ row. `WordRow.cefr` cụ thể, không bao giờ `undefined` (như `entryType` ở ADR-014, để không rơi khỏi index `[cefr+status]`). Dexie v4 thêm index này, `upgrade()` backfill `cefr ??= 'unknown'` cho mọi dòng cũ, cùng lúc merge `sessionSize`/`levelProfile` mặc định vào `user.settings` qua một literal `V4_SETTINGS_DEFAULTS` đóng băng ngay trong `lib/db/dexie.ts` — không import từ `lib/repositories/dexie/user-repository.ts` (sẽ tạo vòng lặp module, và một migration phải đứng yên theo thời gian, không được đi theo hằng số mà phase sau có thể sửa).

**Vì sao `'unknown'` phải nằm trong enum domain, không chỉ enum row:** `fromRow()` (`lib/db/rows.ts`) là một phép spread thuần cộng đúng 1 chỗ sửa `isLeech`. Nếu domain chỉ nhận 6 band thật, `fromRow` phải ánh xạ thêm `'unknown' → undefined`, và quên làm việc đó nghĩa là **mọi từ trong sổ tay** fail `safeParseRow`, bị quarantine vào `meta`, sổ tay hiện trắng trong im lặng — không phải lỗi ồn ào, dễ phát hiện.

**Hệ quả:** Nơi duy nhất phải biết về `'unknown'` là helper `knownCefr()` (`lib/level/cefr.ts`), mọi nơi khác coi `cefr` là một trong 7 giá trị hợp lệ. Trường hợp xấu nhất khi quên xử lý `'unknown'` ở đâu đó chỉ là một badge hiện chữ "unknown" — không phải sổ tay biến mất.

---

### ADR-017 — Mô hình 4 tín hiệu phân trình độ: ghim / gieo hạt / trung vị có trọng số / một bậc / cooldown

**Bối cảnh:** `UserSettings.level` trước đây chỉ là dropdown tự khai (B1/B2/C1), không liên hệ gì với hiệu suất thật. AI đã trả về `cefr` cho từng từ trong `analyzeWork` và `summary.estimatedLevel` (ước lượng trình độ người viết) từ lâu — cả hai đều bị parse xong rồi vứt lúc lưu, chưa từng ảnh hưởng tới `level`.

**Lựa chọn:** `UserSettings.levelProfile` lưu tối đa 4 bằng chứng độc lập — `declared` (tự khai), `placement` (bài test), `work` (từ `analyzeWork`), `srs` (độ chính xác luyện tập theo band) — mỗi bằng chứng có `weight`/`at` riêng. `lib/level/resolve.ts` (`resolveLevel`, hàm thuần) áp 8 luật: `declared` khác null thì ghim `level`, mọi tín hiệu tự động vẫn tích luỹ nhưng không bao giờ đẩy (chỉ trả về một `suggestion` bỏ-qua-được, cooldown 14 ngày riêng); nếu chưa từng tự khai, lần giải quyết đầu tiên (thường là placement) gieo hạt trực tiếp, không bị kẹp một-bậc; sau đó mỗi lần thay đổi chỉ nhích một bậc CEFR, cách nhau tối thiểu 14 ngày, cần tổng trọng số ≥2 để lên và ≥3 để xuống (hạ sai hại hơn nâng chậm); các tín hiệu kết hợp bằng **trung vị có trọng số** (mở rộng mỗi tín hiệu thành `round(weight)` bản sao rồi lấy phần tử giữa), không phải trung bình — CEFR là thang thứ tự, trung bình có thể ra một band không tín hiệu nào thật sự nói tới và bị một outlier kéo lệch.

**Hệ quả:** Đổi `level` **luôn được thông báo** (dòng "vì sao" ở Settings, banner gợi ý khi tự khai và bằng chứng lệch nhau) — cố ý khác hẳn nguyên tắc "streak freeze never announced" (spec §8.1): đổi level thay đổi nội dung người dùng nhận, im lặng ở đây là sai, còn streak freeze chỉ là một sự khoan dung không ảnh hưởng nội dung. Đánh đổi: 8 luật này chỉ được cân bằng qua trực giác + test đơn vị (`lib/level/__tests__/resolve.test.ts`, 15 case), chưa có dữ liệu người dùng thật để hiệu chỉnh ngưỡng.

---

### ADR-018 — Corpus top-up: ghi `words` row thật, đường degraded, và mở hẹp `isEligible('recall')`

**Bối cảnh:** Trước tính năng này, sổ tay của người dùng mới chỉ có 5 từ demo rồi hết — không có cơ chế nào tự bổ sung từ khi buổi luyện tập cạn.

**Lựa chọn:** `stores/topup-store.ts` (`ensureSupply`) chạy trước `session-store.start()`: tính `deficit = targetSize - (due+fresh)`, nếu dương thì chọn từ corpus qua `pickCorpusWords` (loại trừ sổ tay + `skipped`), gọi `enrichWordBatch` (ADR-019), rồi **ghi thẳng `words` row thật** qua `WordRepository.addFromCorpus` — không phải một buffer gợi ý riêng. Khi AI không khả dụng (offline/429/timeout), vẫn ghi — chỉ với `meaningVi` = gloss tiếng Việt có sẵn trong corpus, `exampleSentence`/`distractors` rỗng ("đường degraded"). Để một từ degraded thật sự luyện được, `isEligible('recall')` (`lib/srs/session.ts`) được mở thêm đúng một mệnh đề: `reviewCount===0 && exampleSentence==='' && meaningVi!==''` — "một từ chỉ biết nghĩa và không biết gì khác thì chỉ có thể recall". `session-store.ts`'s `caps` cũng đổi từ hằng số cứng `{audioAvailable:true, aiAvailable:true}` sang đọc `navigator.onLine`, để mệnh đề trên thật sự với tới được lúc offline thay vì phục vụ thẻ `write`/`listen` chết.

**Vì sao ghi row thật chứ không phải buffer riêng:** `hooks/use-daily-plan.ts` và `stores/session-store.ts` đọc cùng một bộ method `WordRepository`. Ghi row thật khiến `useLiveQuery` tự bắn lại và cả hai nơi tự động thấy đúng số từ mới — không có nguồn sự thật thứ hai cần giữ đồng bộ tay.

**Hệ quả:** Buổi luyện tập không bao giờ trống, kể cả offline (đã xác minh bằng trình duyệt thật: notebook rỗng + không có `GEMINI_API_KEY` cấu hình → 5 từ vẫn được ghi, một bài `recall` render đúng). Đánh đổi: van chống phình sổ tay (`meta['topup:lastRunAt']` 60s, `meta['topup:addedOn:<dayKey>']` tối đa 20 từ/ngày) là số tuỳ chọn, chưa có dữ liệu thật để hiệu chỉnh. Phát hiện phụ trong lúc build: `app/providers.tsx` từng gọi `seedIfEmpty()` (5 từ demo cũ) ngay khi sổ tay rỗng — đua với và luôn thắng CTA "Kiểm tra trình độ" mới (ADR-017's placement flow), khiến CTA biến mất trong ~1 giây thực tế. Đã bỏ lời gọi tự động đó (giữ hàm + test, chỉ không còn gọi từ `Providers`) — bằng chứng cho thấy manual browser testing bắt được lỗi mà lint/typecheck/test đơn vị không thấy.

---

### ADR-019 — `enrichWordBatch` thay vì N lần `enrichWord`; re-key nằm ở store, không phải `repair()`

**Bối cảnh:** Top-up (ADR-018) cần làm giàu vài từ corpus (thường 3-8 từ) cùng lúc lúc build session. Dùng lại `enrichWord` nghĩa là N request — ở giới hạn 20/phút mỗi IP, một NAT văn phòng chung với vài người dùng đồng thời sẽ chạm 429; N round-trip cũng tốn N lần chi phí system prompt cho cùng một nội dung.

**Lựa chọn:** Một task mới `enrichWordBatch` (1-8 từ/request, `rateLimit: 8/phút, 120/ngày`, `maxOutputTokens: 4096`), tái dùng nguyên văn system prompt của `enrichWord` cộng yêu cầu echo lại `word` verbatim trong mỗi item (mỏ neo để khớp ngược). `repair()` chỉ làm được việc trong phạm vi MỘT item nó thấy (cắt distractor, dedupe...) — nó **không** biết những từ nào thực sự được yêu cầu, vì chữ ký của nó chỉ nhận output, không nhận input. Việc re-key theo `word.toLowerCase()`, âm thầm bỏ mục thừa mô hình trả về ngoài yêu cầu, và cho mục thiếu rơi về đường degraded (ADR-018) — nằm ở `stores/topup-store.ts`, không phải `repair()`.

**Hệ quả:** 1 request thay vì N, ~1 đơn vị rate-limit thay vì N. Đã xác minh bằng test msw (`stores/__tests__/topup-store.test.ts`) rằng mô hình trả thừa/thiếu/đảo thứ tự đều được xử lý đúng, không throw. Đánh đổi: một request lớn hơn có rủi ro timeout/truncate cao hơn N request nhỏ — giảm nhẹ bằng `maxOutputTokens` rộng rãi và `retries: 0` (không retry phía client, cùng lý do đã ghi ở `stores/work-store.ts`: một request 15s bị retry sẽ khiến người dùng chờ thêm gần gấp đôi trong một rate-limit bucket vốn đã hẹp).

---

### ADR-020 — Giữ nguyên `analyzeDocument` mồ côi; xoá hẳn `gradeSentence` mode `rewriteProfessionally`

**Bối cảnh:** Hai mảnh code không có caller nào tồn tại từ trước phiên làm việc này: task `analyzeDocument` (đào tối đa 40 từ có gắn CEFR từ một tài liệu, cùng `ImportRepository.setCandidates`/`setTriage`) và `gradeSentence`'s `mode: 'rewriteProfessionally'`. Cả hai được xây xong ở server nhưng route `/upload` đã bị xoá từ trước (thay bằng `/learn`), nên không UI nào gọi tới.

**Lựa chọn — không đối xứng, vì rủi ro khác nhau:**
- `gradeSentence.rewriteProfessionally`: **xoá hẳn.** Đây là một nhánh cô lập trong một hàm (`mode` field + ternary trong `system()`/`prompt()`), không phần nào khác của app phụ thuộc vào nó. Xoá sạch, không còn `mode`/`original` trong `GradeSentenceInput`.
- `analyzeDocument` + `ImportRepository.setCandidates`/`setTriage` + `CandidateWordSchema`: **giữ nguyên, không đụng.** Khác `rewriteProfessionally`, đây là một trục hạ tầng chia sẻ: `Import.candidates` là field bắt buộc trên schema `Import` dùng chung cho **mọi** `kind` (`'pdf'|'image'|'text'|'work'`), không riêng gì `analyzeDocument`. Xoá nửa vời (chỉ xoá task+route, để lại `setCandidates`/`setTriage`/`CandidateWordSchema` không người gọi lẫn không người tạo) còn tệ hơn giữ nguyên cả cụm — biến một hạ tầng "đã xây, chưa nối" thành hạ tầng "chết hẳn, không ai sờ tới". Xây một màn hình tải tài liệu + duyệt 40 ứng viên thật sự (dùng lại `TriageList`, ADR-017) là phạm vi một tính năng riêng, vượt quá phiên làm việc tập trung vào corpus/phân trình độ/top-up lần này.

**Hệ quả:** `docs/spec-gaps.md`/`docs/progress/board.md` cần ghi rõ `analyzeDocument` vẫn là nợ kỹ thuật treo, không phải đã đóng — người làm tiếp có 2 lựa chọn thật (nối UI dùng `TriageList` sẵn có, hoặc xoá cả cụm bao gồm cả field `Import.candidates`), không lấp lửng. `gradeSentence`'s API surface nhỏ lại đúng bằng những gì có người dùng thật.

---

### ADR-021 — Nối `analyzeDocument` vào UI thật: "Đào từ vựng từ tài liệu" (chọn lựa chọn 1 của ADR-020)

**Bối cảnh:** Yêu cầu trực tiếp từ chủ dự án — tải một tài liệu lên, AI trích từ vựng đáng học (có thể nhiều), người dùng phân loại từng từ theo 3 mức thông thạo/biết sơ sơ/chưa biết, và câu ví dụ phải lấy từ chính ngữ cảnh tài liệu chứ không phải AI bịa. ADR-020 đã để lại đúng hai lựa chọn cho việc này; ADR này chọn lựa chọn 1 — nối UI dùng `TriageList` sẵn có — và ghi lại các quyết định kỹ thuật phát sinh khi làm.

**Lựa chọn:**
- **Một lần gọi AI có kèm `distractors`, không phải `analyzeDocument` + `enrichWordBatch` hai lần gọi.** `enrichWord`/`enrichWordBatch` sinh câu ví dụ chung chung ("đặt trong ngữ cảnh {contextTopic}"), phá đúng yêu cầu "câu ví dụ từ ngữ cảnh tài liệu". Thay vào đó thêm thẳng `distractors: string[]` vào `CandidateWordOutput` (contracts.ts, khai báo cuối cùng cùng lý do với `EnrichWordOutput`'s `cefr`), và siết prompt bắt `sentenceFromDoc` chứa `word` **đúng nguyên dạng** (không phải lemma nếu tài liệu chỉ có dạng biến cách) — mượn nguyên văn cách diễn đạt đã dùng ở `analyzeWorkTask`. Đổi lại: giảm trần ứng viên 40 → 24 (`MAX_DOC_CANDIDATES`, dùng chung giữa prompt và `repair()` để không lệch nhau) và nâng `maxOutputTokens` 4096 → 8192.
- **Lý do bắt buộc nguyên dạng:** `splitForBlank` (`lib/text/blank.ts`) không có word boundary — lemma `leverage` khớp *bên trong* `leveraged`, nên `isEligible('fillBlank')` cho qua và bài tập hiện ra dạng hỏng `We ____d the API`. Đây không phải một bài tập bị bỏ qua, mà là một bài tập render sai — buộc câu ví dụ phải chứa đúng dạng từ, không chỉ chứa từ.
- **`repair()` dedupe theo `word` (không phân biệt hoa/thường), lấy bản đầu tiên.** `TriageList` khoá mỗi thẻ theo `word` — một model lặp từ (dù prompt đã dặn không lặp) sẽ làm hai thẻ cùng id, giữ đè lên nhau ngầm.
- **Bóc PDF/DOCX chạy phía server** (`app/api/parse-doc`, không dùng `createAiRoute` vì đây không phải lời gọi AI): (i) Node không có `Worker` toàn cục nên `pdfjs-dist` tự dùng fake worker trong tiến trình — không cần cấu hình `GlobalWorkerOptions.workerSrc`, né hẳn cạm bẫy worker của build `output: 'standalone'`; (ii) `serverExternalPackages: ['pdfjs-dist', 'mammoth']` (next.config.ts) giữ hai gói này ngoài quá trình parse của webpack lúc `next build` — có lợi trực tiếp cho lỗi OOM vừa gặp khi build Docker; (iii) văn bản bóc ra dù sao cũng gửi lên Gemini ngay sau đó, bóc phía client không có lợi ích riêng tư thật. `pdfjs-dist`'s `PDFDocumentProxy` (bản 6.2.108) không có `.destroy()` — phải gọi `loadingTask.destroy()` thay vào đó.
- **Dùng lại `WordRepository.addFromCorpus` cho từ tài liệu, không thêm method mới.** Nhánh trùng `wordLower` của nó là fill-if-empty và không đụng SRS state — đúng ý khi một từ tài liệu trùng với từ đã có trong sổ. `addFromInsight` (dùng cho "Học từ công việc thật") sai ở đây vì nó ghi đè nội dung vô điều kiện và hardcode `applyTriage('unknown')`, không nhận triage do người dùng chọn.
- **Triage ghi một lần lúc xác nhận** (`ImportRepository.setTriage` cho mọi ứng viên, không phải mỗi lần bấm đổi ý) — 24 thẻ × số lần đổi ý sẽ là bấy nhiêu lần ghi + kích `useLiveQuery`; ghi khi xác nhận vẫn đủ bền để mở lại import cũ đúng lựa chọn (`components/TriageList.tsx`'s `initialTriage`, mới thêm).
- **`stores/doc-store.ts` là store riêng, không phải mode trên `stores/work-store.ts`** — khác kiểu output (`CandidateWord[]` so với 4 mảng insight), khác field lưu (`setCandidates` so với `setAnalysis`), khác đường lưu.

**Hệ quả:** `analyzeDocument` không còn mồ côi — `docs/spec-gaps.md` C9 và `docs/progress/board.md` Phase 9.6 cần cập nhật để không còn liệt nó là nợ treo. `Import.kind` giữ nguyên enum cũ (`'pdf'|'image'|'text'|'work'`) — tệp `.docx` được gắn `kind:'text'` (đã là văn bản thuần sau khi bóc), không thêm giá trị enum mới chỉ để phân biệt định dạng nguồn. Đánh đổi còn treo: `.txt`/`.md`/`.pdf` được test qua msw + tệp PDF thật; `.docx` (`mammoth`) chỉ được viết theo tài liệu API, chưa test bằng tệp thật trong phiên này.

---

### ADR-022 — Chia tài liệu theo trang/đoạn, gọi song song không giới hạn, và cờ tắt reasoning cho provider hỗ trợ

**Bối cảnh:** Ngay sau ADR-021, chủ dự án chỉ ra hai vấn đề thật khi thử `analyzeDocument` với tài liệu nhiều trang: (1) `AnalyzeDocumentInput.documentText` bị cắt cứng ở 10.000 ký tự đầu — với tệp PDF 25 trang dùng để test (`2606.03264v1.pdf`, ~74.000 ký tự), hơn 2/3 tài liệu chưa từng được AI nhìn thấy; (2) không có tiến trình hiển thị cho người dùng trong lúc chờ. Việc đổi provider để test (FPT Cloud DeepSeek-V4-Flash, rồi Xiaomi MiMo) còn lộ ra một vấn đề thứ ba nghiêm trọng hơn: cả hai đều là **model suy luận (reasoning)** — response trả về một field `reasoning_content` riêng, và với một tác vụ trích xuất có cấu trúc (24 ứng viên kèm distractors), phần suy luận này có thể ăn **83% ngân sách token** (đo được: 6797/8192 completion tokens, MiMo) trước khi model kịp viết JSON, khiến 1 lần gọi mất 117 giây và JSON bị cắt giữa chừng do hết token.

**Lựa chọn:**
- **Tách tài liệu theo đơn vị tự nhiên — trang PDF thật (`pdfjs` trả text theo từng trang, không gộp) hoặc đoạn văn (DOCX/văn bản dán, tách bằng dòng trống, dự phòng tách theo câu nếu một đoạn quá dài) — rồi gom các đơn vị liền kề thành từng "batch" ~6000 ký tự** (`lib/documents/extract.ts`: `splitIntoUnits`, `chunkUnits`, cả hai thuần/không phụ thuộc thư viện nặng nên test được trực tiếp). Không bao giờ cắt đôi một đơn vị — một trang/đoạn dài hơn cả ngưỡng vẫn thành một batch riêng, chỉ là batch đó lớn hơn dự kiến. Trần **20 đơn vị/tài liệu** (`MAX_UNITS`); vượt trần thì báo rõ "Tài liệu dài hơn 20 trang — chỉ phân tích 20 trang đầu" thay vì âm thầm cắt như bản cũ.
- **Gọi AI cho mọi batch cùng lúc (`Promise.allSettled`), không hàng đợi/giới hạn concurrency thủ công** — quyết định trực tiếp từ chủ dự án: đây là lời gọi mạng lên cloud, không phải việc tính toán cục bộ tranh chấp tài nguyên máy, nên không có lý do phải tuần tự hoá. Rủi ro duy nhất là vượt rate limit của chính app; xử lý bằng cách bật `retries: 1` cho riêng lời gọi này (khác quy ước `retries: 0` ở nơi khác) — `postJson` (lib/api/client.ts) đã sẵn có cơ chế đọc header `retry-after` do rate limiter trả về và lùi lại đúng ngần ấy trước khi thử lại, đúng cơ chế "tự giãn cách" cần cho một loạt burst mà không cần code hàng đợi riêng. Nâng `analyzeDocumentTask.rateLimit` từ `{perMinute:5, perDay:40}` lên `{perMinute:20, perDay:200}` để khớp trần `MAX_UNITS=20` — một đợt tải tài liệu tối đa không tự chặn chính nó nữa.
- **Một batch lỗi không huỷ cả kết quả.** `doc-store.ts`'s `analyze()` gộp candidates từ mọi batch *thành công*, dedupe theo `word` (batch đứng trước trong mảng `chunks` thắng nếu trùng — thứ tự mảng giữ nguyên bất kể batch nào trả lời trước do mạng), và chỉ báo lỗi cứng khi **toàn bộ** batch đều fail. Một phần fail giữa chừng thì set `degraded: true`, hiển thị thông báo nhẹ thay vì mất trắng kết quả các batch đã xong.
- **`MAX_DOC_CANDIDATES` giảm tiếp 24 → 12** (registry.server.ts) — vì giờ gọi 1 lần/batch thay vì 1 lần/toàn tài liệu, tổng số ứng viên cuối cùng (12 × tới 20 batch) vượt xa mức cũ dù mỗi lần gọi xin ít hơn; xin ít hơn mỗi lần cũng giảm rủi ro reasoning-model bị hụt token JSON giữa chừng.
- **`OPENAI_DISABLE_THINKING` — cờ môi trường tắt hẳn phần suy luận, KHÔNG bật mặc định.** Test trực tiếp xác nhận MiMo chấp nhận field `thinking: {type: 'disabled'}` trong request body (cùng cấu trúc ứng dụng đã gửi `max_tokens` — không cần đổi gì khác): cùng một yêu cầu trích 12 ứng viên từ 6000 ký tự tài liệu thật, có suy luận mất 117s/8192 completion token (6797 token suy luận), tắt suy luận còn **15s**, `reasoning_tokens: 0`, JSON đầy đủ hợp lệ. Không bật mặc định vì đây là field không chuẩn OpenAI — gửi cho một backend "openai-compatible" khác (OpenAI thật, hay gateway khác) có thể bị từ chối 400 do field lạ; `lib/ai/providers/openai.ts` chỉ thêm field này vào body khi `OPENAI_DISABLE_THINKING=true`, tuyệt đối không gửi `thinking: {type: 'enabled'}` hay tương tự khi tắt (bỏ hẳn field, không gửi `false`) để không đánh cược với backend không nhận diện được nó.

---

### ADR-023 — Bảng xếp hạng: thu hẹp non-goal "Leaderboards" thay vì xoá, dữ liệu mẫu có nhãn thay vì người dùng thật

> **Bị thay thế bởi ADR-025**: roster mẫu 20 người viết tay đã bị xoá, thay bằng dữ liệu thật của người dùng thật qua Firestore. Phần dưới đây giữ nguyên để lưu bối cảnh quyết định ban đầu.

**Bối cảnh:** `01-PROJECT-SPEC (2).md` liệt "Leaderboards, friends, social feed, sharing" và "XP, coins, shops, avatars, mascots, or any collectible economy" vào mục *"Non-goals (do NOT build these, ever, unless explicitly asked)"*. Chủ dự án đã yêu cầu trực tiếp một bảng xếp hạng người học theo nhiều tiêu chí — đúng cửa thoát mà chính tiêu đề mục non-goal nêu ra. App là local-first (Dexie/IndexedDB, một người dùng một máy), không có dữ liệu người học khác để xếp hạng thật.

Ba rủi ro mà non-goal gốc thực sự đang phòng, và cách thiết kế né từng cái:
- **Áp lực xã hội giả** (kéo người dùng quay lại bằng lo âu thay vì giá trị thật): không notification, không "bạn tụt N hạng", không delta thứ hạng theo thời gian. Màn `/leaderboard` là nơi người dùng *ghé thăm*, không bao giờ tự tìm đến họ (không badge đếm trên tab, không banner ở Home ngoài một link chữ).
- **Kinh tế phù phiếm** (XP/coin/huy hiệu sưu tầm): không điểm tổng hợp bịa ra. Mọi tiêu chí (số từ, chuỗi ngày, lượt ôn, độ chính xác, từ mới 7 ngày, từ khó đã chinh phục) là số liệu **đã tồn tại thật** trong `UserStats`/`Word`, không phát minh thêm. "Avatar" chỉ là monogram 2 chữ suy từ tên, không ảnh, không tuỳ biến, không sưu tầm — không vi phạm dòng "avatars, mascots, collectible economy".
- **Lừa dối** (làm người dùng tưởng có cộng đồng thật): 20/21 dòng trên bảng là **dữ liệu mẫu cố định, viết tay** (`lib/leaderboard/mock.ts`), gắn nhãn `mẫu` trên từng dòng + banner đầu trang nói rõ. Chỉ dòng của chính người dùng (`isMe: true`) là số liệu thật, dựng từ `UserStats` + sổ tay Dexie thật qua `buildMyEntry()` — thuần, nhận `now` từ caller (cùng quy ước ADR-004/007/017 của `lib/srs/**`/`lib/level/**`). Tiền lệ: ADR-013 xoá màn tutor-booking cũ chính vì nó fake một link Google Meet không có thật.

**Lựa chọn:**
- Sửa `01-PROJECT-SPEC (2).md`: thu hẹp dòng "Leaderboards" thành "Friends, social feed, sharing, tương tác giữa người dùng thật", tách bảng xếp hạng ra và trỏ về ADR này. **Giữ nguyên** dòng XP/coins/avatars/mascots — thiết kế không đụng tới nó.
- `lib/leaderboard/{types,mock,metrics}.ts`: roster 20 người viết tay (không PRNG) + `buildMyEntry`/`rankBy` thuần, ranking kiểu competition (1,2,2,4), ngưỡng tối thiểu 20 lượt ôn để được xếp hạng theo độ chính xác (mẫu nhỏ không phản ánh gì). Không store Zustand mới, không bảng Dexie mới, không repository mới — màn hình không ghi gì cả.
- Route mới `app/(stack)/leaderboard/page.tsx`, vào từ một card ở `/progress` và một link chữ ở footer `/today` — không đụng `TabBar` 4 mục.

**Hệ quả:** Tính năng xã hội đầu tiên của app, nhưng phạm vi cố tình bị giữ nhỏ nhất có thể để không mở lại đúng những rủi ro mà non-goal gốc dựng lên: không backend, không danh tính người dùng khác, không cơ chế viral/mời bạn. Nếu sau này có backend nhiều người dùng thật, roster mẫu này sẽ cần thay bằng dữ liệu thật + cơ chế ẩn danh/tuỳ chọn tham gia — chưa nằm trong phạm vi ADR này.
- **`timeoutMs` nâng lên 70s** (từ 50s, `maxDuration` route theo là 80) làm biên an toàn cho trường hợp `OPENAI_DISABLE_THINKING` không bật hoặc provider không hỗ trợ tắt suy luận — không nâng tới mức đủ chịu được 117s vì đó không còn là điểm nghẽn chính nữa với cờ trên, và một timeout dài vô hạn chỉ che giấu một provider thật sự có vấn đề thay vì báo lỗi rõ ràng.

**Hệ quả:** Xác minh bằng trình duyệt thật với `2606.03264v1.pdf` (25 trang, ~74.000 ký tự, provider MiMo + `OPENAI_DISABLE_THINKING=true`): 20 trang được cắt xử lý (đúng trần), ra 15 batch, **15/15 gọi AI thành công** (0 rate-limit, 0 timeout), tổng 129 ứng viên, toàn bộ luồng tải-phân tích-lưu-luyện tập chạy trong 74 giây không lỗi console. Đánh đổi còn treo: `OPENAI_DISABLE_THINKING` mới xác minh với MiMo — chưa rõ các provider "openai-compatible" khác (kể cả OpenAI thật) có chấp nhận field `thinking` hay không; ai đổi sang backend khác cần tự thử trước khi bật cờ này.

### ADR-025 — Bảng xếp hạng thật: collection `leaderboard/{uid}` công khai-cho-người-đã-đăng-nhập, tự động đăng, chỉ số liệu tổng hợp

**Bối cảnh:** ADR-023 dựng bảng xếp hạng với 20 dòng mẫu viết tay vì lúc đó app chưa có dữ liệu người học thật để xếp hạng, và chính ADR đó đã ghi trước lối ra: *"Nếu sau này có backend nhiều người dùng thật, roster mẫu này sẽ cần thay bằng dữ liệu thật"*. Chủ dự án nay yêu cầu trực tiếp đúng việc đó: hai tài khoản khác nhau đăng nhập vẫn không thấy nhau trên bảng, vì `firestore.rules` cũ chỉ cho phép đọc/ghi `users/{uid}/**` của chính mình.

**Quyết định:**
- **Collection mới, tách khỏi `users/{uid}`**: `leaderboard/{uid}` chỉ chứa `{ uid, name, level, words, longestStreak, totalReviews, totalCorrect, newLast7, leechesConquered, updatedAt }` — không `email`, không `settings`, không `sampleWords`. `users/{uid}` mang email và toàn bộ settings nên không bao giờ được mở công khai; tách collection là cách duy nhất để một phần dữ liệu học tập được đọc bởi người dùng khác mà không kéo theo phần còn lại.
- **Tự động publish, không opt-in**: mọi user đã đăng nhập được publish sau mỗi lần `syncOnce` thành công. Người dùng được thông báo bằng một dòng chữ rõ ràng ở Settings (`settings.leaderboard.publicNotice`), không phải bằng một công tắc phải tự tìm.
- **`stores/sync-store.ts` gọi `publishLeaderboard`, không phải `lib/sync/engine.ts`**: nếu publish thất bại (ví dụ quên deploy rules), nó không được phép làm status của sync chuyển sang lỗi — dữ liệu thật của người dùng đã đồng bộ ổn, chỉ mỗi bảng xếp hạng (một tính năng trang trí) là chưa lên kịp. Bọc try/catch riêng, log lỗi, không ném lại.
- **Chống ghi thừa bằng digest, không phải throttle thời gian**: `SyncScheduler` gọi sync từ nhiều nơi (tải trang, mỗi lần tab focus, interval nền) — publish mỗi lần sẽ là rất nhiều write vô ích. `lib/leaderboard/publish.ts` so một digest JSON của payload (trừ `updatedAt`) với giá trị lưu ở `meta['leaderboard:publishedDigest']`, bỏ qua write khi không đổi.
- **Đọc bằng một query duy nhất `orderBy('updatedAt', 'desc') limit(200)`**, xếp hạng cả 6 tiêu chí ở client bằng `rankBy()` sẵn có. Không dùng `orderBy(metric)` riêng cho từng tiêu chí — sẽ đổi tập người trên bảng mỗi khi chuyển chip, làm "#7 / 21" mất ý nghĩa. Không cần composite index; `firestore.indexes.json` giữ nguyên rỗng.
- **Trần 200 = "200 người học hoạt động gần nhất", tự lành**: vì publish chỉ chạy khi có thay đổi thật, `updatedAt` giảm dần đúng là thứ tự "còn đang học". Tài khoản bỏ bê tự rơi khỏi trần theo thời gian, không cần cron dọn dẹp (app không có server). UI chỉ hiện dòng chú thích về trần này khi nó thực sự chạm tới (`leaderboardPage.capNotice`), không hiện thường trực.
- **`newLast7` được làm mới hạn (decay), không đóng băng**: field này khác 5 field còn lại — nó gắn với một cửa sổ thời gian, nên một giá trị publish một lần rồi đứng yên là **sai**, không chỉ là cũ. `lib/leaderboard/map.ts`'s `entryFromDoc(doc, myUid, now)` ép `newLast7 = 0` khi `now - doc.updatedAt >= 7 ngày` — chính xác tuyệt đối ở biên đó (không thể có từ nào thêm trong 7 ngày qua nếu sổ tay không đổi suốt 7 ngày). Khoảng giữa vẫn có thể đếm dư nhẹ (một doc 3 ngày tuổi coi cả 3 ngày là "còn trong cửa sổ" dù người đó có thể đã dừng lại từ hôm publish) — chấp nhận, cùng tinh thần với việc `isConqueredHardWord` đếm dư có chủ ý (`docs/progress/board.md`). Phương án chính xác hơn (một mảng `newDaily[7]` theo từng ngày, cộng lại theo đồng hồ người xem) được cân nhắc và để lại làm việc sau nếu field này cần chính xác tuyệt đối.
- **Tên hiển thị**: `settings.leaderboardName` (tuỳ chọn, sửa được ở Settings) → `displayName` của Firebase Auth → `"Người học"`. **Không** rơi về phần trước `@` của email — dù tiện, nó sẽ công khai một định danh gần-thật cho mọi người dùng đã đăng nhập khác, đi ngược đúng lý do collection này tách khỏi `users/{uid}` (không email). `leaderboardName` **không** có `.max()` trong Zod schema (`lib/domain/user.ts`): `getProfile()` safe-parse cả khối settings và fallback nguyên khối về `DEFAULT_SETTINGS` khi fail — một field có cap length sẽ khiến một nickname lỡ dài quá làm reset cả theme/locale/level. Giới hạn 40 ký tự được ép ở hai nơi không phá hoại: `maxLength` của ô nhập, và `resolveDisplayName()` tự cắt chuỗi.
- **Rules xác thực được hình dạng, không xác thực được sự thật**: `firestore.rules`'s `leaderboard/{uid}` whitelist đúng field, đúng kiểu, đúng khoảng giá trị (`totalCorrect <= totalReviews`, `newLast7 <= words`, `leechesConquered <= words`), và chặn `updatedAt` tương lai (biên +5 phút) để không ai tự ghim mình đầu bảng vĩnh viễn. Nhưng không có server nào đối chiếu với sổ tay thật của người dùng — một người mở devtools vẫn `setDoc` được số liệu bịa cho chính doc của họ. Chấp nhận cho một app cá nhân; đường nâng cấp (một Cloud Function đọc `users/{uid}` rồi ghi `leaderboard/{uid}`, cấm client ghi trực tiếp) được ghi lại chứ không làm ngay.
- **`allow delete` có trong rules, không có nút trong UI**: cho phép một dòng bị gỡ (từ Firebase console, hoặc một nút "gỡ khỏi bảng" sau này) mà không cần sửa rules lại. Không xoá khi đăng xuất — đăng xuất trên một thiết bị không phải là rời bảng, và lần đăng nhập tiếp theo sẽ publish lại ngay.
- **Xoá hẳn `lib/leaderboard/mock.ts`** và test của nó; `initialsFromName` chuyển sang `lib/leaderboard/name.ts`, nay dùng thật (không còn chỉ để đối chiếu với roster viết tay).
- Sửa `01-PROJECT-SPEC (2).md`: dòng non-goal không còn đúng ("chỉ một bảng dữ liệu mẫu") — cập nhật để phản ánh dữ liệu thật, trỏ về ADR này thay vì ADR-023.

**Ba rủi ro ADR-023 từng phòng, xét lại với dữ liệu thật:**
- **Lừa dối** (tưởng có cộng đồng thật): *được giải quyết* — không còn dữ liệu mẫu để gây hiểu lầm.
- **Áp lực xã hội giả**: vẫn được giữ nguyên như ADR-023 — không notification, không "bạn tụt N hạng", không delta thứ hạng theo thời gian, không kết bạn/theo dõi/chia sẻ. Đọc dữ liệu bằng `getDocs` một lần, không `onSnapshot` (không cập nhật trực tiếp khi đang xem).
- **Kinh tế phù phiếm**: không đổi — mọi tiêu chí vẫn là số liệu có sẵn trong `UserStats`/`Word`, monogram vẫn suy từ tên, không ảnh, không sưu tầm.

**Hệ quả:** `npx vitest run lib/leaderboard` — 88 test xanh trên cả `tz-utc` và `tz-ny` (bao gồm biên đóng băng 7 ngày của `newLast7`, dedupe doc-của-chính-mình khỏi roster fetch, và tie thật trong roster giả lập cho `buildLeaderboard`). Cần `firebase deploy --only firestore:rules` trước khi thử thật — thiếu bước này thì mọi lượt đọc `leaderboard/**` trả về `permission-denied` và người dùng chỉ thấy đúng một dòng của chính họ, dễ nhầm là "chưa ai khác dùng app" thay vì "quên deploy rules".
