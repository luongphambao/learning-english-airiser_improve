# Data Model

> Nguồn sự thật runtime là `lib/domain/*` (zod schema, chưa viết ở thời điểm tài liệu này được tạo — xem `board.md` Phase 3). File này mô tả hình dạng entity, chỉ mục Dexie, và đường đi lên Firestore sau này. `types.ts` ở root sẽ trở thành barrel `export * from '@/lib/domain'` để không phải sửa import ở nơi khác.

## 1. Entity

### `Word`
```ts
interface Word {
  id: string;
  word: string;
  ipa: string;
  partOfSpeech: string;
  meaningVi: string;
  exampleSentence: string;
  distractors: string[];        // đúng 3 sau enrich; [] hợp lệ trên đường degraded — xem ADR-018
  collocations: Collocation[];  // đúng 3 sau enrich
  wordFamily: string[];         // 0..3
  source: WordSource;
  audioUrl: string | null;
  createdAt: number;
  dueAt: number;
  easeLevel: number;            // 0..5, index vào INTERVALS_DAYS
  reviewCount: number;
  lapseCount: number;
  consecutiveCorrect: number;   // MỞ RỘNG — xem ADR-007. Mặc định 0.
  isLeech: boolean;             // lapseCount >= 4
  status: 'new' | 'learning' | 'known';
  updatedAt: number;            // MỞ RỘNG — chuẩn bị sync/last-write-wins
  deletedAt: number | null;     // MỞ RỘNG — tombstone, chuẩn bị sync

  // v3 — MỞ RỘNG, xem ADR-014. Optional (absent nghĩa là giá trị mặc định), backfill
  // qua Dexie v3 upgrade().
  entryType?: 'word' | 'phrase' | 'grammar';  // absent = 'word'
  noteVi?: string;                             // vì sao đáng học / cách dùng / quy tắc ngữ pháp
  originalText?: string | null;                // chỉ grammar/rewrite: câu người dùng viết gốc

  // v4 — MỞ RỘNG, xem ADR-016. Optional, backfill 'unknown' qua Dexie v4 upgrade().
  cefr?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'unknown';  // absent = 'unknown' (chưa đánh giá)
}

interface Collocation { phrase: string; meaningVi: string; }
interface WordSource {
  kind: 'manual' | 'paste' | 'session' | 'share';
  label: string;
  at: number;
}
```

### `Review` (append-only audit log — trước đây bị vứt bỏ hoàn toàn, nay ghi thật)
```ts
interface Review {
  id: string;
  wordId: string;
  kind: ExerciseKind;           // 'fillBlank' | 'listen' | 'write' | 'recall' | 'grammar'
  correct: boolean;
  answeredAt: number;
  sessionId: string;            // MỞ RỘNG — nhóm review theo buổi học
  dayKey: string;                // "YYYY-MM-DD" theo Asia/Ho_Chi_Minh — MỞ RỘNG, tránh tính lại mỗi lần đọc
  updatedAt: number;
}
```

### `UserStats` / `UserSettings` — gộp trong 1 document `user` (Dexie table `user`, 1 row duy nhất)
```ts
interface UserStats {
  streak: number;
  longestStreak: number;
  lastStudiedOn: string | null;   // "YYYY-MM-DD"
  freezeUsedOn: string | null;
  totalReviews: number;
  totalCorrect: number;
  daysStudied: number;
  history: Record<string, number>; // dayKey -> số review, giữ tối đa 90 ngày gần nhất
}

interface UserSettings {
  reminderHour: number | null;    // 0..23, null = tắt
  studyTime: string | null;       // "HH:mm"
  theme: 'light' | 'dark' | 'system';
  contextTopic: string;
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';  // MỞ RỘNG từ 'B1'|'B2'|'C1' — xem ADR-017
  sessionSize: number;            // MỞ RỘNG, 3..20, mặc định 5 — xem ADR-018
  levelProfile: LevelProfile;     // MỞ RỘNG — bằng chứng đằng sau `level`, xem ADR-017
}

// MỞ RỘNG (ADR-017) — kho bằng chứng level, tính lại bởi lib/level/resolve.ts mỗi
// khi có tín hiệu mới. `declared` khác null thì ghim `level`.
interface LevelSignal { level: Cefr; weight: number; at: number; }
interface LevelProfile {
  declared: Cefr | null;
  placement: LevelSignal | null;   // từ bài kiểm tra trình độ
  work: LevelSignal | null;        // từ analyzeWork summary.estimatedLevel
  srs: LevelSignal | null;         // từ độ chính xác luyện tập theo band
  updatedAt: number | null;        // lần cuối `level` thật sự đổi (chặn cooldown)
  lastPromptedAt: number | null;   // lần cuối hiện gợi ý đổi level (chặn cooldown gợi ý)
}
```

### `CandidateWord` (kết quả `analyzeDocument`, dùng ở màn Phân loại từ)
```ts
interface CandidateWord {
  word: string;                                          // lemma
  cefr: 'B1' | 'B2' | 'C1' | 'C2';
  category: 'academic' | 'technical' | 'ielts' | 'phrasal' | 'idiom';
  meaningVi: string;
  sentenceFromDoc: string;
  sentenceSource: 'document' | 'generated';               // đã thêm — xem spec-gaps.md C1
  triage: 'known' | 'partial' | 'unknown' | null;
}
```

### `Import`, `Tutor`, `Session` (tutor booking), `GrammarQuestion`/`GrammarTopic`
Giữ nguyên hình dạng như `types.ts` hiện tại — không đổi ở lần tái kiến trúc này, chỉ bọc zod. Chi tiết: xem `types.ts` sau khi Phase 3 hoàn tất. `Import` có thêm `error?: string | null` (Phase 7 — nội dung màn "Lỗi đọc file" khi `status === 'failed'`).

### `GrammarAttempt` (Phase 7 — ADR-011, bảng riêng, thêm ở Dexie v2)
```ts
interface GrammarAttempt {
  id: string;
  topicId: string;
  score: number;
  total: number;
  at: number;
}
```
Một dòng mỗi lần hoàn thành một quiz (không ghi theo từng câu hỏi). Không tham chiếu `Word`/`Review` — xem ADR-011 lý do không đi qua `recordReview`.

## 2. Dexie schema (IndexedDB)

```ts
class LexioDb extends Dexie {
  words:         Table<WordRow, string>;
  reviews:       Table<ReviewRow, string>;
  user:          Table<UserRow, string>;
  studySessions: Table<StudySessionRow, string>;
  tutorSessions: Table<TutorSessionRow, string>;
  imports:       Table<ImportRow, string>;
  skipped:       Table<SkippedRow, string>;   // "đã biết rõ" — không gợi ý lại
  meta:          Table<MetaRow, string>;      // cờ migration, quarantine rows
  grammarAttempts: Table<GrammarAttempt, string>; // v2 — xem ADR-011
}

version(1).stores({
  words:         'id, &wordLower, dueAt, createdAt, status, [status+createdAt], [isLeech+dueAt], updatedAt',
  reviews:       'id, wordId, answeredAt, dayKey, [wordId+answeredAt]',
  user:          'id',
  studySessions: 'id, dayKey, status',
  tutorSessions: 'id, startsAt, status',
  imports:       'id, createdAt, status',
  skipped:       '&wordLower, at',
  meta:          'key',
});

version(2).stores({
  grammarAttempts: 'id, topicId, at',   // chỉ bảng mới — v1 giữ nguyên, không sửa
});

version(3).stores({
  // ADR-014 — chỉ words đổi: thêm entryType + [entryType+dueAt]. upgrade() backfill
  // entryType/noteVi/originalText cho mọi dòng cũ.
  words: 'id, &wordLower, dueAt, createdAt, status, [status+createdAt], [isLeech+dueAt], updatedAt, entryType, [entryType+dueAt]',
});

version(4).stores({
  // ADR-016 — words thêm cefr + [cefr+status]. upgrade() backfill cefr='unknown' cho
  // mọi dòng cũ, đồng thời merge sessionSize/levelProfile mặc định vào user.settings
  // (literal đóng băng ngay trong dexie.ts, không import từ user-repository.ts).
  words: 'id, &wordLower, dueAt, createdAt, status, [status+createdAt], [isLeech+dueAt], updatedAt, entryType, [entryType+dueAt], cefr, [cefr+status]',
});
```

**Kho từ vựng (corpus) không phải một bảng.** `public/corpus/v1/{A2,B1,B2,C1,C2}.json` được fetch từ `public/` (không `import`, để không vào JS bundle — xem ADR-015) rồi cache trong bảng `meta` sẵn có, dưới key `corpus:v1:<band>`. Không thêm bảng Dexie nào cho việc này — `meta` đã là KV store generic. `lib/repositories/dexie/meta-repository.ts` (`MetaRepository`) là lớp bọc mỏng, generic (`get<T>`/`put<T>`) cho mọi nhu cầu KV tương lai — không chỉ corpus, còn phục vụ van chống-spam của corpus top-up (`topup:lastRunAt`, `topup:addedOn:<dayKey>` — xem ADR-018).

**Quy tắc versioning:** một `version(n).stores()` đã phát hành thì không bao giờ sửa — thêm bảng/đổi index luôn qua `version(n+1)`. Dexie chỉ cần khai lại bảng có thay đổi; bảng không đổi tự động giữ nguyên sang version mới, không cần liệt kê lại.

**Vì sao các index này:** truy vấn "5 từ đến hạn" là một lần quét index `dueAt` (`.where('dueAt').belowOrEqual(now).limit(5)`), truy vấn "từ mới chưa từng review" là một lần quét `[status+createdAt]`, leech là `[isLeech+dueAt]`. Không có bước lọc mảng trong JS.

**IndexedDB không index được boolean** — `WordRow` khác `Word` ở chỗ `isLeech: 0 | 1` và có thêm `wordLower` (index unique, dùng để phát hiện trùng từ ở O(log n) thay vì `Array.find`). `lib/db/rows.ts` là nơi duy nhất chuyển đổi qua lại.

**`&wordLower` unique** biến việc "từ đã có trong sổ chưa" từ tìm kiếm tuyến tính thành ràng buộc DB: chèn trùng ném `ConstraintError`, repository bắt lỗi này và trả về bản ghi đã có (đúng hành vi baseline đang cố làm nhưng làm sai — xem audit #13).

## 3. Migration strategy — 3 cơ chế tách biệt

1. **Dexie version chain, chỉ được cộng thêm.** Một `version(n)` đã phát hành không bao giờ bị sửa; thay đổi mới luôn là `version(n+1).upgrade()`. Ví dụ v2 backfill `consecutiveCorrect`:
   ```ts
   version(2).stores({}).upgrade(tx =>
     tx.table('words').toCollection().modify(w => {
       w.consecutiveCorrect ??= 0;
       w.deletedAt ??= null;
     })
   );
   ```
   Mỗi upgrade có một test seed DB ở version cũ rồi assert shape ở version mới.

2. **`migrateFromLocalStorage()`** chạy đúng 1 lần, canh bằng cờ `meta['migrated:localStorage']`. Đọc `lexio_words`/`lexio_stats`/`lexio_settings`, chạy qua `safeParseRow` (có `repair` vì dữ liệu cũ có `dueAt` từ tháng 2/2025 do bug #3 và thiếu `consecutiveCorrect`), ghi trong 1 transaction. **Không xoá key localStorage cũ** — nếu import parse sai, dữ liệu gốc vẫn còn để cứu thủ công.

3. **Seed.** Nếu sau migration `words` rỗng, chèn 5 từ demo với `dueAt = now` (không phải timestamp cứng) và cờ `meta['seeded'] = true` — người dùng xoá hết thì không bị tự chèn lại.

## 4. Đọc dữ liệu an toàn — `safeParseRow`

```ts
function safeParseRow<T>(schema: ZodType<T>, row: unknown, repair?: (row: any) => any):
  { ok: true; value: T } | { ok: false; issues: ZodIssue[] };
```
Thứ tự: parse thẳng → nếu lỗi, chạy `repair` (điền default cho field migration bỏ sót) → parse lại → nếu vẫn lỗi, ghi row gốc vào `meta['quarantine:<table>:<id>']`, loại khỏi kết quả, `console.warn`. **Không bao giờ throw vào React render, không bao giờ xoá âm thầm.**

## 5. Đường lên Firestore (khi cần, không phải lần này)

```
users/{uid}                        -> UserSettings + UserStats + { email, displayName }
users/{uid}/words/{wordId}         -> Word
users/{uid}/reviews/{reviewId}     -> Review
users/{uid}/sessions/{sessionId}   -> Session (tutor booking)
users/{uid}/imports/{importId}     -> Import
users/{uid}/skipped/{wordLower}    -> { word, at }
tutors/{tutorId}                   -> Tutor (đọc-only cho user)
```
Repository interface (`WordRepository`, `ReviewRepository`, `UserRepository`, `StudyRepository`, `SkippedRepository`, `MetaRepository` — 2 cái sau thêm cùng đợt corpus/leveling, ADR-016/017/018) đã được thiết kế để một implementation Firestore slot vào cùng chữ ký — `RecordReviewResult` trả giá trị tính cục bộ thay vì đọc lại, đúng thứ Firestore transaction cũng yêu cầu.

Security Rules mục tiêu (từ spec §3.3, giữ nguyên khi implement):
```
match /users/{uid} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
  match /{sub=**} { allow read, write: if request.auth != null && request.auth.uid == uid; }
}
match /tutors/{tutorId} {
  allow read: if request.auth != null;
  allow write: if false;
}
```
Không bao giờ ship rule chứa `allow read, write: if true`.
