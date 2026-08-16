# Changelog (theo phase)

> Mỗi dòng = một phase chốt xong. Không phải commit log — xem `git log` cho mức chi tiết dòng code. Định dạng: `YYYY-MM-DD — Phase N — tóm tắt 1 dòng — file/khu vực chính`.

## 2026-08-16 — Phase 10 — Bảng xếp hạng người học (ADR-023)

**Vấn đề ban đầu:** chủ dự án yêu cầu trực tiếp một bảng xếp hạng nhiều tiêu chí (số từ, chuỗi ngày, lượt ôn, độ chính xác, từ mới 7 ngày, từ khó đã chinh phục) — spec gốc liệt "Leaderboards" vào non-goal, nhưng chính tiêu đề mục đó cho phép ngoại lệ khi được yêu cầu trực tiếp (ADR-023).

**Thiết kế:** app local-first, không có người dùng khác thật — nên `lib/leaderboard/mock.ts` chứa 20 người học **viết tay, cố định**, gắn nhãn `mẫu` trên từng dòng + banner đầu trang. Chỉ dòng của chính người dùng (`isMe: true`) là số liệu thật, dựng từ `UserStats` + sổ tay Dexie qua `buildMyEntry()` (`lib/leaderboard/metrics.ts`, thuần — `now` do caller truyền vào, cùng quy ước `lib/srs/**`). `rankBy()` xếp hạng kiểu competition (1,2,2,4), độ chính xác cần tối thiểu 20 lượt ôn mới được xếp hạng (mẫu nhỏ không phản ánh gì). Mỗi người học (kể cả bản thân) mang theo `sampleWords` — vài từ tiếng Anh minh hoạ đang học, xem được khi bấm mở rộng một dòng.

**UI:** route mới `app/(stack)/leaderboard/page.tsx` (dãy chip đổi tiêu chí, podium top 3, danh sách đầy đủ có thể mở rộng từng dòng, thanh "vị trí của bạn" dính đáy — có copy khích lệ riêng cho người dùng chưa có dữ liệu). Vào từ một card ở `/progress` và một link ở footer `/today`, không đụng `TabBar` 4 mục.

**Xác minh:** `npx vitest run lib/leaderboard` — 50 test xanh trên cả `tz-utc` và `tz-ny` (bao gồm test biên múi giờ ICT lúc nửa đêm cho `newLast7`, và invariant của roster mẫu: không trùng tên/id, tỉ lệ lượt ôn/số từ hợp lý, có tie thật để kiểm ranking).

## 2026-08-15 — Phase 9 — Kho từ vựng CEFR, phân trình độ, tự nạp từ mới (ADR-014..020)

**Vấn đề ban đầu:** app không có kho từ vựng nào — 5 từ demo hardcode (`lib/db/migrate-local-storage.ts`) là toàn bộ nội dung tĩnh, và `level` chỉ là dropdown tự khai không liên hệ gì tới hiệu suất thật. AI đã trả `cefr`/`summary.estimatedLevel` từ lâu (tính năng "Học từ công việc thật") nhưng bị vứt lúc lưu.

**9.1 — Nền tảng schema:** `Word.cefr` (`CefrOrUnknownSchema`, 'unknown' nằm trong enum *domain* không chỉ row — xem ADR-016 lý do), Dexie v4 (`[cefr+status]` + backfill), `UserSettings.levelProfile`/`sessionSize`, `getProfile()` safe-parse (bẫy thứ hai ngoài `upgrade()`), `SkippedRepository` (bảng `skipped` có từ v1, lần đầu có repository — `applyTriage('known')` cuối cùng có nơi để ghi vào).

**9.2 — Kho từ vựng:** `scripts/{corpus-source-data,build-corpus}.ts` sinh `public/corpus/v1/{A2,B1,B2,C1,C2,manifest}.json` — **tự biên soạn ~190 từ**, không phải NGSL/NAWL/BSL như dự tính ban đầu (ADR-015 giải thích vì sao, và đường dẫn để thay bằng dữ liệu thật sau). `lib/corpus/{load,pick,exclude}.ts`: `load.ts` fetch từ `public/` (0 byte bundle, không `import`), cache trong `meta`; `pick.ts` chọn 70% đúng level / 30% level+1, loại trừ sổ tay + `skipped`.

**9.3 — Bộ máy phân trình độ:** `lib/level/{cefr,placement,srs-signal,resolve}.ts` (thuần, cùng rule eslint với `lib/srs/**`). `resolveLevel()` kết hợp 4 tín hiệu (tự khai/placement/work/srs) bằng **trung vị có trọng số** (không phải trung bình), ghim khi tự khai, một bậc mỗi lần, cooldown 14 ngày, sàn bằng chứng khắt khe hơn cho hạ bậc — chi tiết 8 luật ở ADR-017. `stores/level-store.ts` nối `analyzeWork.summary.estimatedLevel` (cuối cùng không còn bị vứt) và tín hiệu SRS (cuối buổi học).

**9.4 — Placement:** `components/TriageList.tsx` (spec §8.3's triage 3 mức, preselect theo CEFR — dùng chung cho placement, top-up preview, và `analyzeDocument` nếu hồi sinh sau này), `app/(stack)/placement/page.tsx` (20 từ yes/no, không gọi AI — chạy được offline). **Bug phát hiện lúc test bằng trình duyệt thật:** `app/providers.tsx` gọi `seedIfEmpty()` (5 từ demo cũ) ngay khi sổ tay rỗng, đua với và luôn thắng CTA placement mới trong ~1 giây — CTA "Kiểm tra trình độ" không bao giờ thực sự bấm được. Đã bỏ lời gọi tự động (giữ hàm + test).

**9.5 — Tự nạp từ mới:** `enrichWordBatch` (task mới, 1 request cho tối đa 8 từ — ADR-019) + `stores/topup-store.ts` (ghi `words` row thật, không phải buffer riêng — Home/practice không thể lệch số). Đường degraded khi AI không khả dụng: ghi từ chỉ với gloss tiếng Việt từ corpus, mở hẹp `isEligible('recall')` một mệnh đề để từ đó luyện được. **Đã xác minh bằng trình duyệt thật** (dev env không có `GEMINI_API_KEY`, nên đây tự nhiên là bằng chứng sống cho đường degraded): sổ tay rỗng → vào `/practice` → 5 từ được ghi (4 B2 + 1 C1, đúng tỉ lệ 70/30) → bài `recall` render đúng, 0 lỗi console.

**9.6 — Nợ mồ côi:** xoá hẳn `gradeSentence`'s `mode: 'rewriteProfessionally'` (cô lập, không caller). **Giữ nguyên** `analyzeDocument` + `ImportRepository.setCandidates`/`setTriage` mồ côi — không xoá nửa vời, không xây UI mới ngoài phạm vi phiên này (ADR-020).

**Xác minh:** `npm run typecheck` ✅, `npx eslint .` ✅ (0 lỗi), `npx vitest run` — chỉ 14/332 test lỗi, toàn bộ cùng nguyên nhân môi trường có sẵn từ trước (`localStorage` không tương thích Node 26 + jsdom trong `lib/db/__tests__/migrations.test.ts`, xác nhận bằng `git stash` — không phải regression). Playwright thủ công xác nhận 2 luồng chính hoạt động đúng bằng trình duyệt thật (screenshot + kiểm tra dữ liệu Dexie thực tế).

## 2026-08-10 — Phase 7 — Ngữ pháp: lịch sử riêng thay vì nối vào SRS (đóng spec-gaps.md C8)

**ADR-011:** `GrammarQuestion` không có `Word` nào để gắn `wordId`, và `isEligible('grammar', ...)` (Phase 4) đã coi ngữ pháp là màn hình độc lập với session SRS — ép nó qua `StudyRepository.recordReview()` sẽ là một liên kết giả, không phải nối dây còn thiếu. Chọn phương án (a) trong 3 phương án nêu ở C8: bảng Dexie mới `grammarAttempts` — **thêm qua `version(2).stores()`**, giữ nguyên `version(1)` đã phát hành đúng quy tắc đã đặt ra từ Phase 3 (`lib/db/dexie.ts`). Chỉ bảng mới cần khai — Dexie tự giữ nguyên các bảng không đổi.

`lib/repositories/dexie/grammar-repository.ts` (`GrammarRepository`, repository thứ 6): `recordAttempt(topicId, score, total, now)` ghi đúng 1 dòng mỗi lần hoàn thành quiz (không phải mỗi câu hỏi); `lastAttemptByTopic()` gộp thành `Record<topicId, GrammarAttempt>` phục vụ badge. `hooks/use-grammar.ts` bọc `useLiveQuery`.

`app/(tabs)/grammar/page.tsx`: `handleAnswerQuestion` khi câu cuối cùng được trả lời, gọi `recordAttempt()` với điểm cuối cùng tính trực tiếp (`correct ? score + 1 : score`, không dựa vào `score` state có thể chưa kịp cập nhật do closure) thay vì tính-rồi-vứt như baseline. Danh sách chủ đề hiện `{N câu hỏi} · Lần trước: {score}/{total}` khi đã có lịch sử.

**Xác minh:** `tsc --noEmit` ✅, 148/148 test xanh (không đổi — chưa viết test riêng cho `GrammarRepository`, cùng loại rủi ro như `ImportRepository` ở mục trên), `next build` ✅.

## 2026-08-10 — Phase 7 — Màn "Tải tài liệu" / "Phân loại từ" (dùng `analyzeDocument` từ Phase 6)

**`ImportRepository`** (`lib/repositories/dexie/import-repository.ts`) — repository thứ 5, thao tác trên bảng `imports` đã có schema Dexie từ Phase 3 nhưng chưa từng có consumer: `create`/`get`/`list`/`setCandidates`/`setTriage`/`fail`/`complete`. Thêm field `error?: string|null` vào `ImportSchema` (`lib/domain/import.ts`) để màn "Lỗi đọc file" có nội dung tiếng Việt cụ thể để hiện, không phải throw text kỹ thuật.

**Màn mới `/upload`** (`app/(stack)/upload/page.tsx`) — 5 bước dồn vào 1 route bằng state cục bộ `Step`, không tách route riêng cho mỗi bước (khớp cách app hiện dùng sheet/step-trong-1-trang thay vì stack sâu nhiều tầng): `input` (dán văn bản hoặc tải `.txt`/`.md`, tối đa 10.000 ký tự, có danh sách các lần tải trước từ `useImportsList()` để tiếp tục dở dang sau khi rời trang) → `analyzing` (tạo `Import` row trước khi gọi AI để trạng thái sống sót qua điều hướng) → `triage` (lọc theo CEFR, 3 nút Biết rõ/Sơ sơ/Chưa biết mỗi từ, thanh sticky "Thêm N từ") → `success`/`error`. Xác nhận triage: mỗi ứng viên `partial`/`unknown` được `words.add()` rồi patch `meaningVi`/`exampleSentence` ngay từ dữ liệu `analyzeDocument` (hiện có nội dung tức thì, không trắng), riêng `partial` áp thêm `applyTriage('partial', now)` (easeLevel 2, due 3 ngày — đúng luật spec §8.3 dùng lại nguyên hàm đã có từ Phase 4), rồi gọi `enrich()` nền để bổ sung IPA/distractors/collocations/wordFamily như luồng "Gõ từ" thường.

`vocabulary/page.tsx`: tab "Tải tệp" trong sheet Thêm từ đổi từ đọc file cục bộ (hack tạm — đọc xong nhét vào textarea của tab "Dán đoạn văn", không tạo `Import`, không triage) thành nút mở `/upload`. Sheet chi tiết từ thêm khối "Ngày thêm / Đã ôn tập / Ôn lại tiếp" bên cạnh "Nguồn" — phần "provenance" còn thiếu mà `board.md` Phase 7 ghi chú (collocations/wordFamily hoá ra đã có sẵn trong `WordCard.tsx` từ baseline, chỉ luôn rỗng vì bug #1 chưa sửa — không phải thiếu UI).

**Chưa làm trong lượt này** (giữ nguyên trong `board.md`): nối Ngữ pháp vào SRS (chặn bởi C8), màn "Đang phân tích" dạng route riêng (gộp vào step trong `/upload` thay vì route riêng — coi là tương đương, không phải thiếu), Cài đặt vẫn 3 field.

**Xác minh:** `tsc --noEmit` ✅, **148/148 test xanh** (không đổi — không thêm test cho `ImportRepository`, xem ghi chú rủi ro ở `board.md`), `next build` ✅ (`/upload` 6.49 kB, prerender tĩnh), lint: tăng từ 192→198 lỗi, toàn bộ 198 vẫn cùng 1 loại `no-restricted-syntax` đã biết (6 lỗi mới ở khối provenance vừa thêm vào `vocabulary/page.tsx`, file này vốn đã nằm trong diện dọn ở Phase 8 nên không phải nợ mới về loại).

## 2026-08-10 — Phase 7 — Bắt đầu: sửa dữ liệu giả ở Tiến độ

`app/(stack)/progress/page.tsx`: 7 chấm hoạt động dùng `lastNDays(dayKey(now), 7)` + `weekdayVi()` từ `lib/srs/date.ts`, đọc thật `stats.history[dayKey]` thay vì `idx <= 4` hardcode (audit §I70). Accuracy fallback 0% thay vì 100% khi `totalReviews === 0` (audit §I72). Dòng "bắt đầu hành trình từ..." suy ra từ `Math.min(...words.map(w => w.createdAt))`, ẩn nếu sổ từ rỗng, thay vì luôn hiện ngày hôm nay (audit §I71).

**Phát hiện lỗ hổng data model khi thử nối Ngữ pháp vào SRS:** `StudyRepository.recordReview` bắt buộc `wordId` trỏ tới một `Word` thật (đọc từ DB, throw nếu không có) — nhưng `GrammarQuestion` không có quan hệ nào với `Word`. Đây không phải việc nối dây đơn giản như dự kiến; cần quyết định kiến trúc trước (entity `GrammarReview` riêng? liên kết `GrammarQuestion`→`Word`? hay giữ ngữ pháp độc lập hoàn toàn?). Ghi vào `spec-gaps.md` C8, **chưa làm**, để phiên sau quyết định.

6 màn còn thiếu (Chi tiết từ, Tải tài liệu, Đang phân tích, Phân loại từ, Thêm từ thành công, Lỗi đọc file) **chưa build** — xem `board.md` Phase 7 để biết điểm bắt đầu đề xuất cho phiên tiếp theo (luồng Dán văn bản → `analyzeDocument` → triage khả thi ngay vì task đã sẵn sàng từ Phase 6).

**Xác minh:** `tsc --noEmit` ✅, 148/148 test xanh (không đổi), `next build` ✅.

## 2026-08-10 — Phase 6 — Tầng AI đa provider (thu hẹp — bỏ `harvestWords`)

**Cơ chế một-schema-hai-phép-chiếu** (ADR-009): `lib/ai/schema.ts` dùng `z.toJSONSchema()` (zod v4.4.3 — đã xác nhận tự sinh `additionalProperties:false` + `required` đủ cho object lồng nhau) làm gốc, `lib/ai/openai-schema.ts` chỉ cần bóc `minItems`/`maxItems` (OpenAI strict mode từ chối 2 keyword này), `lib/ai/gemini-schema.ts` viết hoa kiểu dữ liệu + set `propertyOrdering` theo đúng thứ tự khai báo. `lib/ai/parse.ts` (`parseStructured`) là nơi duy nhất gọi `JSON.parse` trên phản hồi model.

**2 provider:** `lib/ai/providers/openai.ts` (mặc định, đọc `OPENAI_API_URL`/`OPENAI_MODEL_NAME` từ `.env`) và `lib/ai/providers/gemini.ts` (có thêm `generateSpeech` cho TTS). `lib/ai/provider.ts` hoisted singleton — sửa đúng bug baseline "tạo `new GoogleGenAI()` mỗi request".

**Sửa bug #4 (PCM/WAV) tận gốc:** `lib/audio/pcm-to-wav.ts` đọc `mimeType` thật từ Gemini (`audio/L16;rate=24000`), chèn header RIFF 44 byte thật. Route `/api/ai/tts` trả `Content-Type: audio/wav` kèm bytes thật (không còn base64 giả danh); `ExerciseListen.tsx` đổi từ `data:audio/wav;base64,...` sang `URL.createObjectURL(blob)`.

**`lib/api/create-ai-route.ts`** — wrapper dùng chung cho 4 route JSON: request-id → **kiểm origin** (`Sec-Fetch-Site`/allowlist) → **giới hạn kích thước body** (8KB, riêng analyze-doc 2MB) → **zod validate** → **rate limit** (`MemoryRateLimiter`, key theo IP+task) → timeout+retry → repair → log → map lỗi qua bảng tiếng Việt tĩnh (không bao giờ lộ text lỗi upstream). Route `tts` có wrapper riêng (trả bytes, không phải JSON) nhưng dùng lại đúng 4 guard.

**4 task JSON** (`enrichWord`, `extractWords`, `gradeSentence`, `analyzeDocument`) — prompt giữ **nguyên văn** từ 5 route `/api/gemini/*` cũ. `lib/ai/tasks/contracts.ts` (client-safe) tách khỏi `registry.server.ts` (`'server-only'`) — hai loại type input: `TaskInput` (client được phép bỏ field có default) và `TaskParsedInput` (server nhận sau khi default đã áp).

**Typed client:** `lib/api/client.ts` (`postJson`, `ApiError`, retry+backoff, gộp abort signal) + `lib/api/ai-client.ts` (`callTask`, `fetchSpeech`) — nơi duy nhất trong browser gọi `fetch` tới `/api/ai/*`.

**Nối lại toàn bộ client cũ:** `stores/enrichment-store.ts`, `vocabulary/page.tsx` (extract), `ExerciseListen.tsx` (tts, dùng Blob thay base64), `ExerciseWrite.tsx` (grade-sentence — **nhân tiện sửa bug #43**: nhánh lỗi mạng cũ tự chế một kết quả "đúng" giả và gán cho AI một câu nó chưa từng viết; giờ hiện lỗi thật). **Xoá `app/api/gemini/**` và `lib/models.ts`.**

**Bug hạ tầng test tự phát hiện:** package `server-only` throw ngay khi import ngoài bundler của Next (không phải lỗi code, là cơ chế của chính package đó khi chạy dưới Vitest thuần). Sửa bằng alias `server-only` → stub rỗng trong `vitest.config.ts`, cho phép test cả những file lẽ ra chỉ chạy trên server.

**Thu hẹp so với plan gốc:** không có `harvestWords` (không consumer), không có route `/api/ai/capabilities` riêng (`session-store` tạm hardcode capability), không viết `openai-provider.test.ts`/`gemini-provider.test.ts` bằng `msw`. Lý do đầy đủ ở `board.md`.

**Xác minh:** `tsc --noEmit` ✅, **148/148 test xanh** (thêm schema/pcm-to-wav/rate-limit), `next build` ✅ (5 route `/api/ai/*` mới cùng tồn tại, sau đó xoá 5 route cũ và rebuild sạch lại thành công). **Smoke test bảo mật thật trên server production** (không phải chỉ đọc code): `curl` không có `Origin`/`Sec-Fetch-Site` hợp lệ → `403 forbidden_origin`; JSON hỏng → `400 bad_request`; `{"word":123}` → `422 invalid_input`; body 9KB (vượt trần 8KB) → `413 payload_too_large`. Cả 4 khớp chính xác `api_document.md`. **Chưa xác minh được:** gọi thật tới AI provider và rate-limit 429 khi vượt 20 req/phút — 22 request liên tiếp treo tới timeout (25s/request) vì môi trường sandbox không có đường ra mạng thật tới `router.bnksolution.com`; logic rate-limit tự nó đã có unit test riêng (`rate-limit.test.ts`) xác nhận đúng hành vi ở mức code.

## 2026-08-10 — Phase 5 — State: Zustand + repositories, xoá WordsContext

`stores/session-store.ts`: `start({now})`/`answer(correct)`/`reset()` trên `lib/srs/session.ts` + `StudyRepository`. Resume sau F5 hoạt động thật: `start()` gọi `loadActiveSession(dayKey(now))` trước khi build session mới; mỗi câu trả lời gọi `saveSession()` ngay sau `recordReview()`. Thêm 2 method `saveSession`/`loadActiveSession` vào `StudyRepository` (không có trong thiết kế gốc ở Phase 3, bổ sung ở đây vì đây là nơi đầu tiên thực sự cần) + bảng `studySessions` trong Dexie giờ dùng type `StudySession` thật thay vì placeholder.

`stores/enrichment-store.ts`: `enrich(wordId)` đọc word **từ repository theo id**, gọi `/api/gemini/enrich` (route cũ — Phase 6 mới đổi sang `/api/ai/enrich`), `patch()` kết quả vào Dexie. Đây là bản sửa thật của bug #1 — không còn mảng in-memory nào để mà "tìm rồi không thấy".

`stores/settings-store.ts` + `hooks/use-theme.ts`: `updateSettings()` ghi qua `UserRepository`, đồng bộ `data-theme` trên DOM và mirror `theme` vào `localStorage['lexio_settings']` để script chống nháy sáng trong `layout.tsx` (đã viết từ Phase 1) tiếp tục hoạt động đúng dù nguồn dữ liệu chính đã chuyển sang Dexie.

`hooks/use-words.ts` (`useWordsList`, `useWord`) + `hooks/use-profile.ts` (`useProfile`): mỏng, chỉ bọc `useLiveQuery` quanh `getRepos()` — Dexie là cache, không có cache thứ hai.

`app/providers.tsx` thay `WordsProvider`: chạy `migrateFromLocalStorage()` + `seedIfEmpty()` một lần lúc mount, gate `children` sau cờ `ready` để tránh nháy trạng thái rỗng trong lúc import xong.

**Nối toàn bộ 6 trang + `AppHeader`** (`/today`, `/vocabulary`, `/calendar`, `/progress`, `/settings`, `AppHeader`) từ `useWords()` sang store/hook mới — `/grammar` không đổi vì chưa từng dùng `WordsContext`. **Xoá `context/WordsContext.tsx`** (không còn nơi nào import).

**Xác minh:** `tsc --noEmit` ✅, **122/122 test xanh**, `next build` ✅ (7 route vẫn prerender tĩnh — xác nhận `getDb()`/Dexie không crash lúc SSR/build), smoke test server production: cả 7 route trả `200`, không "Application error"/"Unhandled Runtime" trong HTML. **Giới hạn xác minh:** môi trường này không có trình duyệt headless (Playwright/Puppeteer) để click-through thật — hành vi runtime (thêm từ → enrich hiển thị, F5 giữa buổi resume đúng thẻ) được xác nhận qua test tích hợp `study-repository.test.ts`/`migrations.test.ts` chạy trên `fake-indexeddb` (IndexedDB thật, không phải mock) cộng với đọc lại code, **chưa** phải kiểm thử UI đầu-cuối trong trình duyệt thật.

## 2026-08-10 — Phase 4 — Session builder + text utils (date/schedule/streak đã xong từ Phase 3)

`lib/srs/session.ts`: `buildSession()` thuần, tạo **một lần**, đóng băng — `items.length` không đổi trong suốt vòng đời session. `isEligible()` hoà giải 3 luật xung đột của spec (`spec-gaps.md` §B / `decision.md` ADR-008): thứ tự vị trí là ưu tiên, tính hợp lệ mới là luật; leech luôn vị trí 0 và không bao giờ `fillBlank`; `recall` mở khoá sớm cho từ triage `partial` (`easeLevel>=2 && reviewCount===0`) song song với luật cũ `reviewCount>=3`. Giới hạn tối đa 1 `write`/buổi, thẻ dư bị hạ cấp.

`lib/text/blank.ts`: `splitForBlank()` escape regex đúng cách — **sửa bug crash thật** khi từ có ký tự đặc biệt (`trade-off`, `C++`). `lib/text/shuffle.ts`: gộp 2 bản `seededShuffle` giống hệt nhau ở `ExerciseFillBlank.tsx`/`ExerciseListen.tsx` thành `optionsForWord()` dùng chung, giữ nguyên thuật toán (tránh lệch hydration SSR/CSR).

**Xoá `lib/srs.ts` (file cũ)** — phát hiện xung đột tên với thư mục `lib/srs/` mới tạo ở Phase 3 (`@/lib/srs` có thể trỏ nhầm về file cũ còn bug timezone thay vì module mới); `context/WordsContext.tsx` (2 chỗ gọi `calculateNextReview`/`calculateUpdatedStats`) được vá tối thiểu sang `nextSchedule`/`nextStats` — tính năng SRS **đang chạy thật** trong app giờ dùng logic đã sửa bug, dù `WordsContext` bản thân vẫn còn tồn tại tới Phase 5.

**Vá trực tiếp 2 component đang sống** (`ExerciseFillBlank.tsx`, `ExerciseListen.tsx`) sang dùng `splitForBlank`/`optionsForWord` thay vì code trùng lặp/lỗi cũ — không đợi Phase 5/7 vì đây là bug crash thật trên component hiện đang hiển thị ở `/today`.

**Xác minh:** `tsc --noEmit` ✅, **118/118 test xanh** (thêm 12 test session + 7 test blank + 4 test shuffle so với Phase 3), `next build` ✅, smoke test production server: `/today` trả `200`, render từ mẫu **"trade-off"** không crash (bug regex đã sửa xác nhận ở runtime thật, không chỉ unit test).

## 2026-08-09/10 — Phase 3 — Tầng dữ liệu (+ lõi SRS kéo sớm từ Phase 4)

`lib/domain/*.ts`: zod schema cho toàn bộ entity (`Word`, `Review`, `UserStats`, `UserSettings`, `Tutor`/`Session`, `CandidateWord`/`Import`, `GrammarQuestion`/`GrammarTopic`). `types.ts` ở root giờ chỉ là `export * from '@/lib/domain'`. 3 field mở rộng theo ADR-007 (`consecutiveCorrect`, `updatedAt`, `deletedAt`) khai báo **optional** (không `.default()`) để `context/WordsContext.tsx` (chưa đổi tới Phase 5) vẫn typecheck nguyên trạng.

`lib/db/dexie.ts`: schema Dexie v1 đủ 8 bảng + index đúng như `data-model.md` (`&wordLower`, `[status+createdAt]`, `[isLeech+dueAt]`...). `lib/db/rows.ts` chuyển đổi `Word` ↔ `WordRow` (boolean `isLeech` ↔ `0|1` vì IndexedDB không index được boolean). `lib/db/read.ts` (`safeParseRow`/`quarantineRow`) — row hỏng không throw vào render, không mất dữ liệu, cách ly vào `meta`.

`lib/repositories/`: `WordRepository`/`ReviewRepository`/`UserRepository`/`StudyRepository` + implementation Dexie, `getRepos()` là seam duy nhất. **`StudyRepository.recordReview()`** (ADR-005) là 1 transaction word+review+user — sửa đúng lỗi "Review bị vứt bỏ hoàn toàn, stats tính từ state cũ" của baseline.

Kéo sớm từ Phase 4 (`recordReview` cần ngay): `lib/srs/date.ts` (1 timezone Asia/Ho_Chi_Minh, không còn 3 cách tính ngày khác nhau như `lib/srs.ts` cũ), `lib/srs/schedule.ts` (`nextSchedule`, `applyTriage`, hoà giải D1/D2 trong `spec-gaps.md`), `lib/srs/streak.ts` (`nextStats`, hoà giải D3/D4).

`lib/db/migrate-local-storage.ts`: `migrateFromLocalStorage()` (đọc 3 key `lexio_words/stats/settings`, repair + validate, ghi 1 transaction, cờ trong `meta`, không xoá key cũ) + `seedIfEmpty()` (5 từ demo, `dueAt = now` thay vì timestamp cứng).

**2 bug tự tìm thấy qua test, đã sửa ngay trong lúc viết** (không phải bug baseline — bug mới do chính implementation Phase 3 này gây ra): (1) `readRows()` validate thẳng `WordRow` thô (có `isLeech: 0|1`) bằng `WordSchema` (đợi `boolean`) → mọi word đọc ra đều bị quarantine oan; sửa: validate sau khi `fromRow()` chuyển đổi. (2) `add()` dựa vào bắt `ConstraintError` sau khi ghi trùng `&wordLower` — fake-indexeddb không surface lỗi theo cách `try/catch` bắt được; sửa thành check-rồi-put trong 1 transaction (atomic, không phụ thuộc cách 1 implementation IndexedDB cụ thể báo lỗi).

**Xác minh:** `tsc --noEmit` ✅, `next build` ✅, **72/72 test xanh** (10 file, chạy dưới cả `TZ=UTC`/`TZ=America/New_York`) — bao gồm `study-repository.test.ts` (transaction atomic, không mất update khi 2 review liên tiếp) và `migrations.test.ts` (idempotent, quarantine hoạt động, không xoá localStorage gốc).

## 2026-08-09 — Phase 2 — Routing thật

Thay `useState<TabType>` trong `AppShell.tsx` bằng App Router thật. `app/(tabs)/layout.tsx` (server) + `components/layout/app-header.tsx` + `components/layout/tab-bar.tsx` (client) giữ nguyên markup/hành vi header + tab strip cũ, chỉ đổi cơ chế điều hướng (`Link`/`usePathname` thay vì state). `app/(stack)/layout.tsx` không có tab bar; mỗi trang stack tự render `<BackHeader title="..."/>` (lệch nhẹ so với plan gốc — layout không sở hữu header dùng chung được vì tiêu đề khác nhau theo route, xem lý do trong `board.md`). `app/page.tsx` thành server component `redirect('/today')` — bỏ client boundary ở root. 5 màn (`TodayScreen`→`/today`, `WordsScreen`→`/vocabulary`, `ScheduleScreen`→`/calendar`, `GrammarScreen`→`/grammar`, `ProgressScreen`→`/progress`) chuyển nguyên logic vào `page.tsx` tương ứng, vẫn đọc `WordsContext` (chưa đổi sang repository — đó là Phase 5). Cài đặt tách khỏi Sheet-trong-AppShell thành trang thật `/settings`. Nhân tiện sửa 2 chỗ a11y nhỏ khi di chuyển file (`<div onClick>` → `<button>` ở dòng từ vựng và chọn tutor) và 1 chỗ ép kiểu `as any` → `as UserSettings['level']`. Xoá `components/AppShell.tsx` và `screens/`.

**Xác minh:** `tsc --noEmit` ✅, `next build` ✅ (7 route tĩnh, mỗi route 2-7KB thay vì 1 bundle 20KB dùng chung), server production chạy thật: `/` trả `307` → `/today`, cả 7 route trả `200`, không lỗi hydration/runtime trong HTML.

## 2026-08-09 — Phase 1 — Token hoá design (thu hẹp phạm vi)

`app/globals.css`: thêm `@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));` (vá dark mode theo OS thay vì theo nút — bug lớn nhất của baseline ở lớp design), thêm `@theme inline` chiếu 9 CSS var hiện có + `--radius-card/btn/sheet` + `--shadow-card` + `--violet` (đặt tên cho gradient indigo→violet đang dùng rải rác) thành Tailwind utility, **giữ nguyên mọi giá trị màu**. `app/fonts.ts` mới: 3 font qua `next/font/google` (subset `vietnamese` cho Inter), thay `<link>` chặn render trong `layout.tsx`. Thêm script chống nháy sáng chạy trước hydrate trong `<head>`, đọc cùng key `lexio_settings` mà `WordsContext` đang dùng (sẽ đổi sang key đồng bộ riêng khi Phase 5 chuyển sang Dexie).

**Thu hẹp so với plan gốc:** không dựng 26 component primitive, không quét thay hardcode `indigo-600`/`rose-600`/`emerald-*` ngay — lý do và cách xử lý ghi ở `board.md`.

**Xác minh:** `npm run build` ✅; HTML render có `data-theme` đúng trước hydrate và class font-hash từ `next/font`.

## 2026-08-09 — Phase 0 — Dọn nền

Sinh `package-lock.json` thật (575 packages). Gỡ 7 dependency chết (`motion`, `class-variance-authority`, `clsx`, `tailwind-merge`, `@hookform/resolvers`, `@tailwindcss/typography`, `tw-animate-css`, `firebase-tools`) và file không ai import (`lib/utils.ts`, `hooks/use-mobile.ts`, `.eslintrc.json` trùng `eslint.config.mjs`). Thêm `zod` `dexie` `dexie-react-hooks` `zustand` `server-only`; dev thêm `vitest` `fake-indexeddb` `msw` `@testing-library/react` `jsdom` `prettier` `@eslint/eslintrc`. Sửa `eslint-config-next` khớp major với `next@15` và viết lại `eslint.config.mjs` bằng `FlatCompat` (bản cũ dùng `import ... extends: [...next]` — crash ngay khi chạy vì `eslint-config-next` 15.x là legacy CJS, không phải flat-config-native; đây là lý do baseline gốc phải ghim `eslint-config-next@16` lệch major để né lỗi này). Thêm `vitest.config.ts` (2 project chạy dưới `TZ=UTC`/`TZ=America/New_York`), `.prettierrc.json`, `.github/workflows/ci.yml`. Thêm 2 ESLint rule tuỳ chỉnh (chặn `Date.now()`/`new Date()` trong `lib/srs/**`, chặn `bg-[var(--...)]` arbitrary value) — rule thứ 2 cố ý còn đỏ ~216 lỗi trên code cũ, sẽ xanh sau Phase 1.

Điều chỉnh so với plan gốc: dời cờ TS `noUncheckedIndexedAccess`/`exactOptionalPropertyTypes`/`verbatimModuleSyntax` sang Phase 8 — lý do ghi ở `board.md`.

**Xác minh:** `npm run build` ✅, `npx tsc --noEmit` ✅, `npm test` ✅ (suite rỗng, `passWithNoTests`), `npm run lint` chạy được (không crash), 3 lỗ hổng `npm audit` còn lại (`postcss`/`sharp` transitive qua `next@15`) chấp nhận rủi ro — vá đòi hỏi nhảy lên `next@16`, ngoài phạm vi ADR-001.

## 2026-08-09 — Khởi tạo bộ tài liệu

Viết bộ `docs/` cho lần tái kiến trúc: `README.md`, `architecture.md`, `design.md`, `api_document.md`, `decision.md` (ADR-001..010), `data-model.md`, `spec-gaps.md`, `progress/00-baseline-audit.md`, `progress/board.md`. Chưa chạm code. Quyết định lớn: giữ Next.js, Dexie trước Firestore, AI provider trừu tượng (mặc định OpenAI-compatible), **giữ nguyên design AI Studio hiện tại** (không áp dụng mockup `docs/ui/`), không cài `nexu-io/open-design`.

<!-- Thêm dòng mới ở trên, mới nhất lên đầu, khi mỗi phase 0-8 chốt xong. -->
