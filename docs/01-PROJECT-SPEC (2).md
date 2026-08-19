# Lexio — Project Spec

> **Cách dùng file này:** dán TOÀN BỘ nội dung mục "AI Studio Context Block" (phần 1–10)
> vào đầu **mỗi** phiên làm việc mới với AI Studio, trước prompt của bước hiện tại.
> Agent quên rất nhanh giữa các phiên; file này là bộ nhớ ngoài của nó.
> Phần tiếng Việt là ghi chú cho bạn — có thể giữ lại, agent đọc được cả hai.

---

## 0. Tóm tắt cho người (không dán vào AI Studio)

**Một câu:** *Mỗi sáng 7h, 5 từ tới hộp mail của bạn. 3 phút. Cuối tuần nói chuyện 30 phút với giảng viên về đúng những từ đó.*

**Vòng lặp lõi:** thêm từ → nhận email sáng → làm 3 phút → cuối tuần dùng lại trong buổi Meet với giảng viên → từ mới giảng viên dùng quay lại thành từ cần học.

**Nguyên tắc thiết kế chủ đạo:** app trông như một **trang từ điển sống**, không như một game. Từ vựng là ngôi sao duy nhất trên màn hình.

---

# AI Studio Context Block

> Everything below is the permanent context for this project. Paste it at the start of every session.

## 1. Product definition

**Name:** Lexio
**One-liner:** A calm English vocabulary app where the words come from the learner's own life, and the practice fits into 3 minutes a day.
**Primary user:** Vietnamese professionals (25–40) learning English for work. UI language is **Vietnamese**; the vocabulary itself is **English**.
**Platform:** Mobile-first responsive web app, deployed to Cloud Run.

### Non-goals (do NOT build these, ever, unless explicitly asked)

- Friends, social feed, sharing, thông báo đẩy (bảng xếp hạng: đã được yêu cầu trực tiếp — xem ADR-023 rồi ADR-025; số liệu **thật** của người dùng thật qua collection `leaderboard/{uid}` riêng, nhưng chỉ số liệu tổng hợp + tên hiển thị, không sổ tay, không email; vẫn không có bạn bè/theo dõi/chia sẻ/thông báo/cập nhật thời gian thực)
- XP, coins, shops, avatars, or any collectible economy (mascot: đã được yêu cầu trực tiếp — xem ADR-030; một linh vật rắn CSS/SVG duy nhất, không phải hệ animal/skin sưu tầm được)
- Multiple learning languages (English only)
- Real-time voice conversation / Live API (phase 2)
- Charts, graphs, or any charting library. The Tiến độ screen is numbers and text only (§8.4)
- Onboarding tutorial carousels
- Push notifications in the browser

If a prompt seems to require one of these, ask before building it.

## 2. Tech stack (pinned — do not substitute)

| Layer | Choice |
|---|---|
| Framework | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS. Design tokens as CSS variables in `index.css`. No component libraries (no MUI, no shadcn, no Chakra). |
| Icons | `lucide-react`, stroke width 1.5 |
| Auth | Firebase Auth, Google Sign-In only |
| Database | Cloud Firestore |
| Hosting | Cloud Run (deploy from AI Studio) |
| Text model | `gemini-3-flash` |
| TTS model | `gemini-3.1-flash-tts-preview`, voice `Kore` |
| Scheduled jobs | Cloud Scheduler + Cloud Functions |

> Model IDs move fast. Keep them in `src/lib/models.ts` as exported constants — never inline a model ID anywhere else in the codebase.

## 3. Folder structure (create and keep this shape)

```
src/
  main.tsx
  index.css              # design tokens + Tailwind layers, single source of truth for color
  types.ts               # ALL shared TypeScript interfaces live here
  lib/
    models.ts            # exported model ID constants
    firebase.ts          # app init, auth, db exports
    firestore.ts         # every read/write to Firestore, typed. No component queries Firestore directly.
    gemini.ts            # every Gemini API call + its responseSchema
    srs.ts               # pure scheduling functions, no I/O, unit-testable
    format.ts            # date/time helpers
  context/
    AuthContext.tsx
    WordsContext.tsx
  components/
    AppShell.tsx         # tab bar + header + routing frame
    WordCard.tsx
    ExerciseFillBlank.tsx
    ExerciseListen.tsx
    ExerciseWrite.tsx
    EmptyState.tsx       # takes {icon, title, action} — used by EVERY empty screen
    Button.tsx           # variants: primary | quiet | danger. No other button styles exist.
    Sheet.tsx            # bottom sheet primitive
  screens/
    TodayScreen.tsx
    WordsScreen.tsx
    ScheduleScreen.tsx
    SettingsScreen.tsx
    SignInScreen.tsx
```

**Rules:**
- A screen never calls the Gemini API or Firestore SDK directly — it calls a function from `lib/`.
- All shared types live in `types.ts`. Never redefine an interface locally.
- One component per file, named export matching the filename.

## 4. Design system (exact values — never invent new ones)

The visual reference is `mockup.html`. Match it.

### Colors — define in `index.css` as CSS variables

```css
:root {
  --paper:      #FAF8F5;  /* app background */
  --surface:    #FFFFFF;  /* cards */
  --ink:        #232120;  /* primary text */
  --ink-soft:   #6B655E;  /* secondary text, labels */
  --rule:       #E5DFD6;  /* hairlines, dividers, borders */
  --green:      #2F6B4F;  /* THE accent: primary actions, correct answers, active tab */
  --green-wash: #EDF3EF;  /* accent background tint */
  --amber:      #B07C36;  /* "due for review" badges only — used sparingly */
  --wrong:      #9C4A3F;  /* incorrect answer state only */
}

[data-theme="dark"] {
  --paper:      #171614;
  --surface:    #211F1D;
  --ink:        #F2EDE6;
  --ink-soft:   #9A938A;
  --rule:       #322F2B;
  --green:      #6FA98A;
  --green-wash: #23302A;
  --amber:      #C79B5C;
  --wrong:      #C4736A;
}
```

**Hard rules:** exactly one accent color. **No gradients anywhere.** No purple, no blue, no violet. No colored shadows. Shadows are `0 1px 2px rgba(35,33,32,0.04), 0 8px 24px rgba(35,33,32,0.06)` only.

### Typography — three roles, three faces

| Role | Face | Usage |
|---|---|---|
| Display | **Instrument Serif**, 400 | English vocabulary words ONLY. 44–60px. Never used for UI labels. |
| UI | **Inter**, 400/500/600 | Everything else. Body 15px, labels 13px, buttons 15px/500. |
| Utility | **IBM Plex Mono**, 400 | IPA pronunciation, counters ("3 / 5"), dates, streak numbers. 12–13px, letter-spacing 0.02em. |

Load from Google Fonts. Part-of-speech labels are Inter *italic* 13px in `--ink-soft`.

### Shape & spacing

- Card radius **16px**; buttons **12px**; bottom sheet **24px** top corners
- Spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 only
- Screen padding 20px horizontal
- Hairlines are 1px `--rule` — used as dividers, never as card borders except on the exercise card
- Max content width 480px, centered on desktop, on a `--rule`-tinted page backdrop

### Signature element

**The dictionary entry card.** Every word is presented like a lexicon entry: the word in Instrument Serif, IPA directly beneath in IBM Plex Mono, part-of-speech in italic, then a hairline rule, then the meaning. In fill-in-the-blank exercises the missing word appears as a real ruled blank — a 1px underline of fixed width the eye can rest on, not a row of underscores.

This card is the one memorable thing in the app. Everything around it stays quiet.

### Motion

- Correct answer: card border transitions to `--green` over 200ms, then auto-advance after 600ms
- Wrong answer: card flips on the Y axis (400ms) to reveal the meaning; user taps to continue
- Screen transitions: 180ms fade + 8px upward slide
- Button press: `scale(0.97)`, 100ms
- Respect `prefers-reduced-motion: reduce` — disable flips and slides, keep color changes

**Nothing else animates.** No confetti, no bouncing, no looping ambient motion.

## 5. Voice & copy rules

- UI copy is **Vietnamese**, sentence case, no exclamation marks, no emoji.
- Address the user as **"bạn"**. Never use "chúng tôi".
- Buttons name the action: `Lưu từ`, `Bắt đầu học`, `Đặt lịch` — never `Submit`, `OK`, `Gửi`.
- An action keeps the same name through the whole flow.
- Empty states are invitations, not reports. Not `Chưa có dữ liệu` — instead `Sổ từ đang trống. Thêm từ đầu tiên để bắt đầu.` plus a button.
- Errors say what happened and what to do: `Không lưu được từ. Kiểm tra kết nối rồi thử lại.`
- Never guilt the user about missed days. No "Bạn đã mất chuỗi!". Missed days are silently rescheduled.

## 6. Data model

```ts
// src/types.ts

export type ExerciseKind = 'fillBlank' | 'listen' | 'write';

export interface Collocation {
  phrase: string;            // English, contains the word, e.g. "make a trade-off"
  meaningVi: string;         // one short line
}

export interface WordSource {
  kind: 'manual' | 'paste' | 'session' | 'share';
  label: string;             // "Buổi học với Minh Trang" | "Bài đọc trên The Verge" | "Tự thêm"
  at: number;                // epoch ms
}

export interface Word {
  id: string;
  word: string;              // English, lowercase unless proper noun
  ipa: string;               // e.g. "/ˈtreɪd ɒf/"
  partOfSpeech: string;      // "noun" | "verb" | "adjective" | ...
  meaningVi: string;         // one short Vietnamese line
  exampleSentence: string;   // English, workplace/tech context, contains `word`
  distractors: string[];     // exactly 3, same part of speech
  collocations: Collocation[]; // exactly 3, the phrases this word actually lives in
  wordFamily: string[];      // e.g. ["deprecation", "deprecated"] — 0 to 3 items
  source: WordSource;
  audioUrl: string | null;   // cached TTS, generated once
  createdAt: number;         // epoch ms
  dueAt: number;             // epoch ms
  easeLevel: number;         // 0..5, index into SRS intervals
  reviewCount: number;
  lapseCount: number;
  isLeech: boolean;          // true once lapseCount >= 4 — see §8.2
  status: 'new' | 'learning' | 'known';
}

export interface Review {
  id: string;
  wordId: string;
  kind: ExerciseKind;
  correct: boolean;
  answeredAt: number;
}

export interface Tutor {
  id: string;
  name: string;
  email: string;
  photoUrl: string;
  bio: string;               // one line
  availableSlots: number[];  // epoch ms
}

export interface Session {
  id: string;
  tutorId: string;
  tutorName: string;
  startsAt: number;
  meetUrl: string;
  calendarEventId: string;
  status: 'upcoming' | 'done' | 'cancelled';
  harvestedWordIds: string[]; // words extracted from this session afterwards
}

export type KnownState = 'known' | 'partial' | 'unknown';

export interface CandidateWord {
  word: string;              // lemma form
  cefr: 'B1' | 'B2' | 'C1' | 'C2';
  category: 'academic' | 'technical' | 'ielts' | 'phrasal' | 'idiom';
  meaningVi: string;
  sentenceFromDoc: string;   // the sentence it appeared in, verbatim from the user's document
  triage: KnownState | null; // null until the user decides
}

export interface Import {
  id: string;
  fileName: string;          // "IELTS Reading Test 4.pdf" | "Dán từ Notion"
  kind: 'pdf' | 'image' | 'text';
  createdAt: number;
  status: 'analyzing' | 'ready' | 'done' | 'failed';
  candidates: CandidateWord[];
  addedCount: number;
}

export interface UserStats {
  streak: number;              // consecutive qualifying days
  longestStreak: number;
  lastStudiedOn: string | null;// "YYYY-MM-DD" in Asia/Ho_Chi_Minh
  freezeUsedOn: string | null; // "YYYY-MM-DD" — one freeze per 7 days
  totalReviews: number;        // every answered exercise, ever
  totalCorrect: number;
  daysStudied: number;
}

export interface UserSettings {
  reminderHour: number | null;   // 0..23, null = off
  studyTime: string | null;      // "HH:mm" for the recurring calendar event
  theme: 'light' | 'dark' | 'system';
  contextTopic: string;          // e.g. "software engineering" — steers example sentences
  level: 'B1' | 'B2' | 'C1';     // steers which words count as "probably unknown"
}
```

### Firestore layout

```
users/{uid}                        -> UserSettings + UserStats + { email, displayName }
users/{uid}/words/{wordId}         -> Word
users/{uid}/reviews/{reviewId}     -> Review
users/{uid}/sessions/{sessionId}   -> Session
users/{uid}/imports/{importId}     -> Import
users/{uid}/skipped/{wordLower}    -> { word, at }   // "đã biết rõ" — never suggest again
tutors/{tutorId}                   -> Tutor            (read-only for users)
```

### Security rules (must be exactly this shape)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
      match /{sub=**} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }
    }
    match /tutors/{tutorId} {
      allow read: if request.auth != null;
      allow write: if false;
    }
  }
}
```

**Never** ship a rule containing `allow read, write: if true`.

## 7. Gemini contracts

All calls live in `src/lib/gemini.ts` and use structured output. No free-text parsing anywhere.

### 7.1 Enrich a new word

System instruction:
> You enrich English vocabulary entries for a Vietnamese professional learning English for work. Example sentences must be natural, under 16 words, and set in a {contextTopic} workplace context. The Vietnamese meaning must be one short line, no more than 12 words. Distractors must be real English words of the same part of speech, plausible in the same sentence slot, but clearly wrong on reflection. Collocations must be phrases a native speaker actually says — verb + noun, adjective + noun, or noun + preposition — not dictionary definitions. Prefer collocations common in professional writing.

`responseSchema`:

```json
{
  "type": "object",
  "properties": {
    "ipa": { "type": "string" },
    "partOfSpeech": { "type": "string" },
    "meaningVi": { "type": "string" },
    "exampleSentence": { "type": "string" },
    "distractors": { "type": "array", "items": { "type": "string" }, "minItems": 3, "maxItems": 3 },
    "collocations": {
      "type": "array", "minItems": 3, "maxItems": 3,
      "items": {
        "type": "object",
        "properties": { "phrase": { "type": "string" }, "meaningVi": { "type": "string" } },
        "required": ["phrase", "meaningVi"]
      }
    },
    "wordFamily": { "type": "array", "items": { "type": "string" }, "maxItems": 3 }
  },
  "required": ["ipa", "partOfSpeech", "meaningVi", "exampleSentence", "distractors", "collocations", "wordFamily"]
}
```

### 7.2 Extract words from pasted text

`responseSchema`: `{ "type": "array", "items": { "type": "object", "properties": { "word": {"type":"string"}, "reason": {"type":"string"} }, "required": ["word","reason"] } }`

Return at most 12 words, ordered by usefulness to an intermediate learner. `reason` is one short Vietnamese clause.

### 7.3 Grade a user-written sentence

Rubric, in the system instruction: correct if the target word is used with the right meaning and part of speech, and the sentence is grammatical enough to be understood by a native speaker. Minor article or preposition slips do not make it incorrect — mention them in feedback instead.

`responseSchema`:

```json
{
  "type": "object",
  "properties": {
    "isCorrect": { "type": "boolean" },
    "feedbackVi": { "type": "string" },
    "improvedSentence": { "type": "string" }
  },
  "required": ["isCorrect", "feedbackVi", "improvedSentence"]
}
```

`feedbackVi` is one or two short Vietnamese sentences, encouraging in tone, and always names the specific thing to fix.

### 7.4 Interleaved example sentence

When generating an exercise for word A, if the user has another due word B of a compatible part of speech, generate a sentence that uses **both**. This doubles review density without adding a single second of study time.

System instruction: *Write one natural sentence under 18 words, set in a {contextTopic} workplace context, that uses both "{A}" and "{B}" correctly. If the two words cannot appear in one natural sentence, return useBoth: false and a sentence using only "{A}".*

`responseSchema`: `{ "type": "object", "properties": { "useBoth": {"type":"boolean"}, "sentence": {"type":"string"} }, "required": ["useBoth","sentence"] }`

Only the primary word A counts for scheduling. B is a free exposure — do not update B's `dueAt`.

### 7.5 Harvest words from a tutor session

Input: session transcript. Output: same schema as 7.2, filtered to words not already in the user's word list.

### 7.6 Analyse a document for unknown words

The single most valuable call in the app. Input: a PDF, an image, or pasted text, plus the user's `level` and `contextTopic`, plus the list of words already in their word list and skip list.

System instruction:
> You find vocabulary worth learning in a document, for a Vietnamese professional at CEFR level {level} working in {contextTopic}. Return only words at or above the level just past theirs — a B2 learner gets B2, C1 and C2 words, never A2 or B1. Prefer words that recur across many texts over one-off jargon: "constitute" is worth more than "photoluminescence". Include multi-word phrasal verbs and idioms when they carry meaning that cannot be guessed from the parts. Return the lemma, not the inflected form found in the text. For sentenceFromDoc, copy the sentence from the document verbatim, trimmed to at most 24 words. Never invent a sentence. Exclude any word in the provided exclusion list. Return at most 40 words, ordered by how useful they are to this learner.

`responseSchema`:

```json
{
  "type": "object",
  "properties": {
    "candidates": {
      "type": "array", "maxItems": 40,
      "items": {
        "type": "object",
        "properties": {
          "word": { "type": "string" },
          "cefr": { "type": "string", "enum": ["B1","B2","C1","C2"] },
          "category": { "type": "string", "enum": ["academic","technical","ielts","phrasal","idiom"] },
          "meaningVi": { "type": "string" },
          "sentenceFromDoc": { "type": "string" },
          "sentenceSource": { "type": "string", "enum": ["document", "generated"] }
        },
        "required": ["word","cefr","category","meaningVi","sentenceFromDoc","sentenceSource"]
      }
    }
  },
  "required": ["candidates"]
}
```

Add to the system instruction:
> For sentenceFromDoc, copy the sentence from the document verbatim and set sentenceSource to "document". Only when no complete sentence containing the word exists in the source — a spreadsheet cell, a slide bullet, a table heading — write one natural sentence yourself using the surrounding subject matter, and set sentenceSource to "generated". Never present an invented sentence as a quotation.

## 7.7 File ingestion (`src/lib/extract.ts`)

Gemini reads PDF and images natively. Office formats are ZIP archives of XML and must be turned into text in the browser first. One entry point handles all of it:

```ts
extractDocument(file: File): Promise<{
  kind: 'native' | 'text';
  parts: Array<{ base64: string; mime: string } | { text: string }>;
  pageCount: number;
  label: string;       // section, sheet or slide name, for provenance
}>
```

| Định dạng | Cách xử lý | Thư viện |
|---|---|---|
| `.pdf` ≤ 25 trang | Gửi thẳng cho model dạng base64 — đọc được cả file scan | — |
| `.pdf` > 25 trang | Cắt thành từng tệp 25 trang, gọi song song, gộp kết quả | `pdf-lib` |
| `.png` `.jpg` `.webp` | Gửi thẳng cho model | — |
| `.docx` | Bóc text thuần, giữ ranh giới đoạn văn | `mammoth` |
| `.xlsx` `.xls` `.csv` | Từng sheet → CSV, ghép lại kèm tên sheet làm nhãn | `xlsx` (SheetJS) |
| `.pptx` | Giải nén, đọc `ppt/slides/slideN.xml`, lấy mọi node `<a:t>`, cộng thêm ghi chú trong `notesSlides` | `jszip` + `fast-xml-parser` |
| `.txt` `.md` | Đọc thẳng | — |
| `.doc` `.xls` `.ppt` (định dạng cũ) | Từ chối: `File định dạng cũ chưa đọc được. Bạn mở bằng Word rồi lưu lại dạng .docx nhé.` | — |

**Ràng buộc:**
- Tối đa 20MB mỗi file, 200.000 ký tự sau khi bóc text. Vượt thì cắt và báo cho người dùng biết đã đọc bao nhiêu phần trăm.
- Bóc text xong mà được dưới 200 ký tự thì coi như file rỗng hoặc là ảnh scan — với PDF thì chuyển sang gửi native, với các định dạng khác thì báo lỗi rõ ràng.
- Việc bóc text chạy trong Web Worker để giao diện không đứng ở file lớn.
- Không bao giờ lưu file gốc lên Cloud Storage. Chỉ lưu tên file, số trang và danh sách từ. Tài liệu của người dùng là của họ.

**Về chất lượng câu ví dụ theo từng định dạng:** PDF và Word cho câu văn hoàn chỉnh, dùng nguyên văn được. Excel và PowerPoint phần lớn là mảnh vụn — ô dữ liệu, gạch đầu dòng ba từ. Với chúng, model được phép tự viết câu và **phải** đánh dấu `sentenceSource: "generated"`. Giao diện hiển thị hai loại này khác nhau (§8.3), vì trích dẫn sai nguồn còn tệ hơn không trích dẫn.

**Implementation notes:**
- Send the exclusion list as lemmas only, and cap it at the 500 most recent. If the user has more words than that, filter the response client-side as well.
- `sentenceFromDoc` becomes the word's `exampleSentence`, so a word learned from an IELTS paper is practised in the sentence the user actually read. Set `source.kind = 'paste'` and `source.label` to the file name.
- Merge and de-duplicate candidates across chunks by lemma, keeping the first `sentenceFromDoc` whose `sentenceSource` is `"document"`.

## 7.8 Nhập từ Google Drive (và NotebookLM)

**NotebookLM không có API công khai.** Không có endpoint nào để đọc notebook, nguồn hay ghi chú của người dùng, và mọi thư viện "NotebookLM API" trên GitHub đều là bản không chính thức, dựa vào phiên đăng nhập của trình duyệt — không dùng được trong sản phẩm thật.

Nhưng NotebookLM xuất được sang Google Drive, và Drive thì có API chính thức. Đường đi thực tế là hai chạm:

| Người dùng làm trong NotebookLM | Lexio nhận được |
|---|---|
| Ghi chú / study guide → **Xuất sang Google Docs** | Google Doc |
| Bảng dữ liệu → **Xuất sang Google Sheets** | Google Sheet |
| Video overview → **Tải PDF / PPTX** rồi lưu vào Drive | file trong Drive |
| Nguồn gốc đã úp lên notebook | vốn đã nằm sẵn trong Drive |

Nên **không xây tích hợp NotebookLM**. Xây tích hợp Drive — nó phục vụ luôn Docs, Sheets, Slides và mọi PDF người dùng có, chứ không riêng NotebookLM.

**Kỹ thuật:**
- Dùng Google Picker API, xin thêm scope `drive.file`. Scope này chỉ cho phép đọc đúng file người dùng tự chọn trong hộp thoại Picker — không phải toàn bộ Drive. Xin quyền theo kiểu tăng dần, chỉ khi người dùng bấm "Chọn từ Google Drive".
- Google Docs → export dạng `text/plain` qua `files.export`.
- Google Sheets → export dạng `text/csv` từng sheet.
- Google Slides → export dạng `text/plain`.
- File thường trong Drive (PDF, DOCX, XLSX, PPTX) → tải nhị phân rồi đưa vào đúng đường ống ở §7.7. Không viết nhánh xử lý riêng.
- `source.label` ghi tên file kèm nguồn: `Ghi chú NotebookLM — Coral Reefs.gdoc`.
- Không lưu file, không lưu refresh token dài hạn. Xin quyền, đọc một lần, quên đi.

**Về AI Studio:** agent dựng được phần Picker và gọi Drive API bình thường — đây chỉ là REST API kèm OAuth, không cần hỗ trợ đặc biệt nào. Phần dễ sai là màn hình xin quyền: agent hay xin scope ngay lúc đăng nhập thay vì xin lúc người dùng thật sự cần. Ràng buộc "incremental consent" ở trên là để chặn đúng chỗ đó.

## 8. Spaced repetition (`src/lib/srs.ts`)

```ts
const INTERVALS_DAYS = [1, 3, 7, 16, 35, 90];

// correct  -> easeLevel = min(easeLevel + 1, 5)
// wrong    -> easeLevel = max(easeLevel - 2, 0), lapseCount += 1
// dueAt    = now + INTERVALS_DAYS[easeLevel] * 86400000
// status: easeLevel 0 = 'new', 1..3 = 'learning', 4..5 = 'known'
```

- The Today screen loads the **5** words with the earliest `dueAt` where `dueAt <= now`.
- If fewer than 5 are due, fill the remainder with `status: 'new'` words that have never been reviewed.
- If nothing is due and there are no new words, show the caught-up empty state.
- These functions are pure. No Firestore, no Date.now() inside — pass `now` in as an argument.

### 8.1 Streak rules

A day **qualifies** if the user reviewed **at least one word** that day. Not five — one. The bar is deliberately low: the streak measures showing up, not effort.

```
today  = date in Asia/Ho_Chi_Minh, "YYYY-MM-DD"
- lastStudiedOn == today          -> no change
- lastStudiedOn == yesterday      -> streak += 1
- gap of exactly 1 day AND freezeUsedOn is null or > 7 days ago
                                  -> streak += 1, freezeUsedOn = the missed day (silent freeze)
- any larger gap                  -> streak = 1
- always: longestStreak = max(longestStreak, streak), daysStudied += 1 on a new day
```

The freeze is **never announced**. No "Bạn đã dùng lượt đóng băng!" — the user simply finds their streak intact. No warning notification when a streak is at risk. Guilt is not a feature.

### 8.2 Từ khó (leech)

When `lapseCount` reaches 4, set `isLeech = true`. A leech is handled differently, because more multiple-choice repetitions clearly are not working for it:

- It is never shown as `fillBlank` again — only `write` (produce it yourself) or `listen`.
- Its card shows the collocations alongside the meaning, always.
- It appears at most once per session, at position 1 when the user is freshest.
- After two consecutive correct answers, `isLeech` returns to false and `lapseCount` resets to 2.

### 8.3 Triage mapping

When the user classifies a candidate word from an import, it enters the system at a different point — the same word does not deserve the same schedule for someone who half-knows it.

| Choice | Label | What happens |
|---|---|---|
| `known` | Đã biết rõ | Not added to the word list. Written to `users/{uid}/skipped/{wordLower}` so it never appears in a future import. |
| `partial` | Biết sơ sơ | Added with `easeLevel: 2`, `status: 'learning'`, `dueAt: now + 3 days`. Skips the easiest exercises — first review is `recall`, not `fillBlank`. |
| `unknown` | Chưa biết | Added with `easeLevel: 0`, `status: 'new'`, `dueAt: now`. |

**Default pre-selection** (so the user taps to correct, not to fill in):
- `cefr` C1 or C2, or `category` technical → `unknown`
- `cefr` B2 → `partial`
- `cefr` B1 → `known`

The user can change any of them. Nothing is written to the word list until they confirm with the bottom action button.

**Quoted vs generated sentences.** A candidate whose `sentenceSource` is `"document"` shows the sentence with a 1px `--rule` left border and the target word at weight 500 — it is a quotation from the user's own file. A `"generated"` sentence has no left border and carries a small italic `--ink-soft` label above it: `Câu ví dụ do AI viết`. Never render the two identically.



### 8.4 Tiến độ screen

Reached from the gear menu, not a fourth tab. **No charts, no libraries.** The whole screen is:

1. Four numbers in IBM Plex Mono, large, each with a small Inter label: `Chuỗi ngày`, `Từ đã thuộc` (status `known`), `Đang học` (status `learning`), `Bài tập đã làm` (totalReviews).
2. A row of 7 dots for the last 7 days — filled `--green` if the day qualified, hollow `--rule` if not, `--amber` ring if frozen. Days are labelled T2…CN in mono. This is the only "chart" allowed and it is made of divs.
3. `Tỉ lệ đúng` as one line of text: `totalCorrect / totalReviews` as a percentage.
4. A `Từ khó` section listing up to 5 leeches, each a tappable row opening its detail sheet. If there are none, omit the section entirely — do not show an empty state for it.
5. A single line at the bottom in `--ink-soft`: `Bạn bắt đầu học từ {ngày}.`

All values come from the user document, incremented on write. **Never** compute these by reading the whole reviews collection on load.

## 9. Quality floor (every step must hold these)

- Works down to 360px width
- Visible keyboard focus ring on every interactive element: 2px `--green` outline, 2px offset
- Every async surface has a loading state and an error state — never a blank screen
- Dark mode verified on every screen
- No layout shift when content loads: skeletons match final dimensions
- All text passes 4.5:1 contrast

## 10. Rules for the agent

1. Build **only** what the current step's prompt asks for. Do not add features, screens, settings, or "nice to have" extras.
2. Do not modify files outside the current step's scope. If a change requires touching something else, say so first and wait.
3. Never change the design tokens in `index.css` after Step 0. If you need a new color, stop and ask.
4. Never inline a hex color, font name, or model ID in a component.
5. When finished with a step, list the files you created or changed and nothing else.
6. If a request is ambiguous, ask one question rather than guessing.
