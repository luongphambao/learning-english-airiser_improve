# Lexio — Build Steps

11 bước, mỗi bước một prompt dán thẳng vào AI Studio. Thứ tự quan trọng: UI trước, dữ liệu sau, AI sau nữa, tích hợp cuối.

---

## Luật chơi (đọc một lần, áp dụng suốt)

**1. Mỗi phiên bắt đầu bằng context.** Dán `01-PROJECT-SPEC.md` (phần "AI Studio Context Block") vào trước, rồi mới dán prompt của bước. Nếu phiên đã dài và agent bắt đầu "quên" token màu hay cấu trúc thư mục → mở phiên mới và dán lại spec.

**2. Một prompt = một tính năng.** Mọi prompt dưới đây đã kết thúc bằng câu chặn phạm vi. Đừng bỏ câu đó.

**3. Nghiệm thu rồi mới đi tiếp.** Mỗi bước có mục *Nghiệm thu*. Chưa đạt thì đừng sang bước sau — lỗi ở bước 2 sẽ nhân lên ở bước 7.

**4. Checkpoint sau mỗi bước.** Save/commit khi vừa nghiệm thu xong. Hỏng thì **revert về checkpoint** rồi sửa prompt, đừng "sửa chồng sửa" — đó là cách nhanh nhất giết một app vibecode.

**5. Prompt bằng tiếng Anh.** Agent code bám yêu cầu sát hơn rõ rệt. UI vẫn ra tiếng Việt vì spec đã quy định.

**6. Đọc lại Security Rules bằng mắt** ở bước 3 và bước 10. Đây là lỗ hổng phổ biến nhất của app sinh bằng AI.

---

## Bảng tiến độ

| # | Bước | Kết quả | Ước lượng |
|---|---|---|---|
| 0 | Khung app + design system | 4 màn rỗng, đúng font/màu | 30' |
| 1 | Màn Hôm nay, dữ liệu giả | Chơi được 5 từ | 45' |
| 2 | Sổ từ + thêm từ | Thêm/xoá từ, lưu localStorage | 45' |
| 3 | Firebase Auth + Firestore | Đăng nhập, dữ liệu bền | 60' |
| 4 | Gemini enrich từ | Từ tự có IPA, nghĩa, ví dụ | 45' |
| 5 | Dạng bài "Nghe và chọn" | TTS + cache audio | 45' |
| 6 | Dạng bài "Tự đặt câu" | AI chấm có rubric | 45' |
| 7 | Lịch ôn tập (SRS) | Từ quay lại đúng ngày | 30' |
| 8 | Email nhắc học | Mail 7h sáng | 60' |
| 9 | Google Calendar | Lịch học lặp lại | 45' |
| 10 | Đặt buổi Meet với giảng viên | Meet link + invite | 90' |
| 11 | Đánh bóng + deploy | Chạy trên Cloud Run | 60' |
| 12 | Cụm từ đi chung (collocations) | Mỗi từ có 3 cụm thật | 30' |
| 13 | Màn Tiến độ | 4 con số + 7 chấm, không biểu đồ | 45' |
| 14 | Từ khó + ôn ngược | Từ hay sai được học kiểu khác | 45' |
| 15 | Thêm từ từ mọi nơi | Share target + email-in | 60' |
| 16 | Bộ đọc file mọi định dạng | PDF/Word/Excel/PPT → text | 75' |
| 17 | Phân tích, lọc từ chưa biết | Danh sách ứng viên kèm câu gốc | 60' |
| 18 | Màn phân loại 3 mức | Rõ / sơ sơ / chưa biết → vào sổ | 60' |
| 19 | Nhập từ Google Drive | Đọc Docs/Sheets/PDF, mở đường cho NotebookLM | 45' |

**Dừng ở bước 7 là đã có app dùng thật được.** Bước 8–10 là phần khiến người dùng quay lại. Bước 12–15 là phần khiến họ ở lại sau tháng thứ hai.

> **Nếu bạn chưa bắt đầu code:** gộp bước 12 vào bước 4 (cùng một lệnh gọi Gemini, thêm field vào schema là xong) và gộp phần streak của bước 14 vào bước 7. Chỉ tách ra như dưới đây nếu bạn đã build xong phần trước rồi.

---

## Bước 0 — Khung app + design system

Bước quan trọng nhất. Nếu không chốt token ở đây, agent sẽ tự chế gradient tím và bạn phải sửa suốt 10 bước còn lại.

**Kèm theo prompt này:** đính `mockup.html` hoặc ảnh chụp màn hình của nó. Agent bám ảnh tốt hơn bám chữ rất nhiều.

```
Build the UI shell for Lexio, following the project spec I pasted above.

THIS STEP IS UI SHELL ONLY. No backend, no auth, no AI, no data persistence.

1. Set up React 19 + TypeScript + Vite + Tailwind.
2. Create index.css with ALL design tokens from the spec as CSS variables,
   including the [data-theme="dark"] block. Load Instrument Serif, Inter,
   and IBM Plex Mono from Google Fonts.
3. Create the exact folder structure from the spec. Leave lib/ files as
   empty stubs with their exported function signatures only.
4. Build AppShell.tsx: a bottom tab bar with exactly 3 tabs
   (Hôm nay, Sổ từ, Lịch), plus a gear icon top-right that opens Settings.
   Content area max-width 480px, centered.
5. Build the 4 screens as empty shells, each using a shared EmptyState
   component with a friendly Vietnamese invitation and one button.
6. Build Button.tsx with variants primary | quiet | danger, and Sheet.tsx
   as a bottom sheet primitive. These are the only button and sheet styles
   in the app.
7. Add a theme toggle in Settings that flips data-theme on <html>.

Match the attached mockup exactly for colors, type scale, spacing and card
shape. Do not add any feature not listed above.
```

**Nghiệm thu:** đổi tab mượt; dark mode đúng ở cả 4 màn; Instrument Serif hiện đúng; không có màu nào ngoài bảng token.

---

## Bước 1 — Màn Hôm nay với dữ liệu giả

```
Build the Today screen with hardcoded data. Still no backend, no AI.

Put an array of 5 sample Word objects (matching the Word interface in
types.ts) at the top of TodayScreen.tsx. Use real English words a
software professional would learn: trade-off, deprecate, bottleneck,
mitigate, redundant.

Flow — one card at a time, vertically centered:
- WordCard.tsx renders the dictionary-entry layout from the spec:
  word in Instrument Serif, IPA in IBM Plex Mono below it, part of speech
  in italic, hairline rule, then content.
- ExerciseFillBlank.tsx shows the example sentence with the target word
  replaced by a ruled blank (a 1px bottom-border span of fixed width,
  NOT underscores), and 4 answer buttons below.
- Correct: card border transitions to --green over 200ms, then
  auto-advance after 600ms.
- Wrong: the card flips on the Y axis over 400ms to show the meaning and
  the full sentence, with a "Tiếp tục" button the user taps.
- A counter in IBM Plex Mono at the top: "3 / 5". No progress bar.
- After the last card, a short congratulations screen: one serif line,
  a quiet button back to Sổ từ.

No modals anywhere. Respect prefers-reduced-motion. Do not change any
other screen or file.
```

**Nghiệm thu:** chơi hết 5 từ; sai thì lật thẻ chứ không hiện popup; bật "giảm chuyển động" trong hệ điều hành thì không còn lật.

---

## Bước 2 — Sổ từ + thêm từ

```
Build the Words screen and a WordsContext.

WordsScreen: a list of saved words. Each row shows the word in Instrument
Serif (24px), the Vietnamese meaning below in --ink-soft, and a small
status badge (new / learning / known) using --amber for "learning".
Rows are separated by hairlines, not cards. Tapping a row opens a bottom
sheet with the full dictionary entry and a "Xoá từ" danger button.

A floating "+" button opens a bottom sheet with two tabs:
1. "Gõ từ" — a text input plus a "Lưu từ" button.
2. "Dán đoạn văn" — a textarea; on submit, show a checkbox list of
   detected words (fake the extraction for now: split on spaces and take
   words longer than 6 characters), then "Thêm 5 từ đã chọn".

Create WordsContext.tsx holding the word list, persisted to localStorage.
TodayScreen must now read its words from this context instead of the
hardcoded array.

Do not add search, sort, filters, tags, or folders. Do not touch the
Schedule or Settings screens.
```

**Nghiệm thu:** thêm từ → nó xuất hiện ở Hôm nay; reload trang vẫn còn; xoá được.

---

## Bước 3 — Firebase Auth + Firestore

Đây là lần đầu agent được đụng backend. Chỉ làm đúng việc này.

```
Enable Firebase for this app: Firebase Auth with Google Sign-In, and
Cloud Firestore.

1. SignInScreen.tsx — shown whenever the user is not authenticated.
   One serif line naming the product, one sentence of Vietnamese, one
   "Đăng nhập với Google" button. Match the design system.
2. AuthContext.tsx exposing { user, loading, signIn, signOut }.
   Add "Đăng xuất" to Settings.
3. Migrate WordsContext from localStorage to Firestore using the exact
   collection layout in the spec (users/{uid}/words/{wordId}).
   All reads and writes go through src/lib/firestore.ts — no component
   touches the Firestore SDK directly.
4. Create the user document on first sign-in with the default
   UserSettings from the spec.
5. Write Firestore Security Rules exactly as specified in the spec.

Show a skeleton list while words are loading — the skeleton must match
the final row height so there is no layout shift.

Do not add any new feature or screen beyond sign-in.
```

**Nghiệm thu:** đăng nhập → thêm từ → mở trên máy khác vẫn thấy. **Mở tab Rules trong Firebase Console và đọc bằng mắt** — không được có `if true`.

---

## Bước 4 — Gemini enrich từ

```
When a word is saved, enrich it with the Gemini API.

Implement enrichWord() in src/lib/gemini.ts using the model constant from
src/lib/models.ts, with the system instruction and responseSchema from
section 7.1 of the spec. Pass the user's contextTopic setting into the
prompt (default it to "software engineering").

Flow: save the word immediately with status "new" and empty fields, then
enrich in the background. While enriching, the word row shows a subtle
shimmer on the meaning line only — the word itself is already visible.
On success, write ipa, partOfSpeech, meaningVi, exampleSentence and
distractors to the word document.
On failure, show an inline retry affordance on that row:
"Chưa tải được nghĩa. Thử lại" — never a toast, never a modal.

Also implement extractWords() per section 7.2 and wire it to the
"Dán đoạn văn" tab, replacing the fake extraction.

The Today screen now uses the real distractors instead of fake options.
Do not change the exercise UI.
```

**Nghiệm thu:** thêm từ "leverage" → 3 giây sau có IPA, nghĩa tiếng Việt, câu ví dụ về công việc; 3 đáp án nhiễu đều cùng loại từ và nghe hợp lý.

---

## Bước 5 — Dạng bài "Nghe và chọn"

```
Add the second exercise type: ExerciseListen.tsx.

Use the TTS model constant from models.ts with voice "Kore" to read the
example sentence aloud. The card shows a large circular play button in
--green-wash, a replay button, and 4 word options — the sentence text
stays hidden until the user answers.

Cache the audio: generate once, upload to Cloud Storage, save the URL to
word.audioUrl, and reuse it on every later review. Never regenerate audio
for a word that already has audioUrl.

Alternate exercise types across the 5 daily cards: fillBlank, listen,
fillBlank, listen, fillBlank.

Handle the case where audio fails to load: fall back to the fillBlank
exercise for that word, silently. Do not change any other exercise.
```

**Nghiệm thu:** nghe được câu; lần thứ hai gặp từ đó thì phát ngay (đã cache, không gọi API lại).

---

## Bước 6 — Dạng bài "Tự đặt câu"

```
Add the third exercise type: ExerciseWrite.tsx.

The card shows the word, its IPA and its Vietnamese meaning, then a
textarea: "Đặt một câu với từ này". A "Kiểm tra" button submits.

Implement gradeSentence() in gemini.ts using the rubric and
responseSchema from section 7.3 of the spec.

Show the result inline, below the textarea, never in a modal:
- Correct: a --green hairline appears above the feedback, feedbackVi is
  shown, and improvedSentence appears under a small italic label
  "Cách nói tự nhiên hơn".
- Incorrect: --wrong hairline, feedbackVi, then improvedSentence under
  the same label.
Either way the user taps "Tiếp tục" themselves — no auto-advance here.

Use this exercise type for the 3rd card of each session, replacing one
fillBlank. Do not change the other two exercise types.
```

**Nghiệm thu:** viết câu sai ngữ pháp nhẹ nhưng dùng đúng từ → vẫn được tính đúng, feedback chỉ ra chỗ cần sửa. Viết câu dùng sai nghĩa → tính sai.

---

## Bước 7 — Lịch ôn tập (SRS)

```
Implement spaced repetition.

1. src/lib/srs.ts — pure functions exactly as specified in section 8 of
   the spec. No I/O, no Date.now() inside; pass `now` as an argument.
2. Every answered exercise writes a Review document and updates the
   word's easeLevel, dueAt, reviewCount, lapseCount and status.
3. TodayScreen loads the 5 words with the earliest dueAt where
   dueAt <= now, filling the remainder with never-reviewed new words.
4. If nothing is due and no new words exist, show the caught-up empty
   state: one serif line, plus a quiet button "Thêm từ mới".
5. Implement the streak exactly as specified in §8.1: a day qualifies if
   the user reviewed AT LEAST ONE word that day. Update streak,
   longestStreak, lastStudiedOn, freezeUsedOn, daysStudied, totalReviews
   and totalCorrect on the user document as part of the same write that
   records a Review.
6. Show the streak in the Today screen header in IBM Plex Mono:
   "chuỗi 12 ngày". Nothing else — no flame icon, no percentage.

The silent freeze is never announced, and there is no warning when a
streak is at risk. Do not change any exercise UI. Do not add charts.
```

**Nghiệm thu:** trả lời đúng → hôm sau từ đó không xuất hiện lại; trả lời sai → mai gặp lại; hết từ → màn "đã xong" tử tế.

---

## Bước 8 — Email nhắc học

```
Add a daily reminder email.

1. In Settings, add "Giờ nhắc học": an on/off switch plus an hour picker,
   saved to the user document as reminderHour.
2. Create a Cloud Function that runs hourly via Cloud Scheduler. It finds
   users whose reminderHour matches the current hour in Asia/Ho_Chi_Minh,
   loads their 5 due words, and sends an email.
3. The email is simple HTML matching the app: --paper background, the
   words in a serif webfont with their Vietnamese meaning and example
   sentence, and one large --green button "Học 3 phút" linking to the
   Today screen. Subject: "5 từ cho hôm nay".
4. If a user has no due words, send nothing at all that day.
5. Include an unsubscribe line linking to Settings.

Do not add any other notification channel. Do not add browser push.
```

**Nghiệm thu:** đặt giờ nhắc = giờ kế tiếp, đợi, nhận được mail đúng 5 từ đang đến hạn. Không có từ đến hạn → không có mail.

---

## Bước 9 — Google Calendar

```
Add Google Calendar integration.

Request the calendar scope on the existing Firebase Auth Google sign-in
(incremental consent — only ask when the user first uses this feature,
not at sign-in).

In the Schedule screen, add a "Giờ học hằng ngày" section: a time picker
and a switch. Turning it on creates a recurring daily calendar event
titled "Học từ vựng — Lexio", 15 minutes long, with a deep link to the
Today screen in the description. Turning it off deletes the event.
Save studyTime and the event ID on the user document.

If the user misses the event, do nothing — no rescheduling notification,
no email about it.

Handle the consent-denied case gracefully with an inline message and a
retry button. Do not touch any other screen.
```

**Nghiệm thu:** bật → mở Google Calendar thấy sự kiện lặp lại có link; tắt → sự kiện biến mất.

---

## Bước 10 — Đặt buổi học với giảng viên (Meet)

Bước nặng nhất. Nếu thấy agent đuối, tách thành 10a (danh sách + đặt lịch) và 10b (thu hoạch từ sau buổi).

```
Add tutor booking to the Schedule screen.

1. Seed a top-level "tutors" collection with 3 sample tutors matching the
   Tutor interface, each with 6 availableSlots over the next 2 weeks.
2. Above the daily study time section, show "Buổi học sắp tới" — the
   user's upcoming sessions with the tutor's name, time in IBM Plex Mono,
   and a --green "Vào Meet" button. If none, show an EmptyState inviting
   them to book one.
3. "Đặt buổi học" opens a bottom sheet: pick a tutor (photo, name, one
   line of bio), then pick a slot. Confirming creates a Google Calendar
   event with a Google Meet conference link, invites both the user and
   the tutor's email, and writes a Session document.
4. Ten minutes before the session, a Cloud Function emails the tutor a
   short brief: the learner's 20 most recent words and the 5 they get
   wrong most often.
5. After the session ends, mark it "done" and show a card on the Today
   screen: "Buổi học với {tên} đã xong. Thêm từ mới từ buổi này?" —
   tapping it runs harvestWords() (spec 7.4) on the session transcript
   and shows the extracted words as a checkbox list to add.

If no transcript is available, the card offers manual entry instead.
Do not build tutor-side screens, payments, or chat.
```

**Nghiệm thu:** đặt buổi → cả hai email nhận invite có Meet link; sau buổi, màn Hôm nay mời thêm từ mới.

---

## Bước 11 — Đánh bóng và deploy

```
Polish pass. NO new features.

1. Add the page transitions from the spec: 180ms fade + 8px slide.
2. Verify every screen has a styled loading state, empty state and error
   state. Fix any that show a blank screen.
3. Verify dark mode on all 5 screens including sheets and the sign-in
   screen.
4. Add visible focus rings: 2px --green outline, 2px offset, on every
   interactive element. Tab through the whole app and fix anything
   unreachable by keyboard.
5. Check the layout at 360px width. Nothing may overflow horizontally.
6. Confirm no hex color, font name or model ID is inlined anywhere
   outside index.css and models.ts. Move any you find.
7. Add a <title>, favicon, and meta description.

Then deploy to Cloud Run and give me the URL.
```

**Nghiệm thu cuối:** duyệt toàn app chỉ bằng bàn phím; thu trình duyệt còn 360px không vỡ; đọc lại Security Rules lần cuối.

---

## Bước 12 — Cụm từ đi chung (collocations)

Đây là bổ sung đáng giá nhất trong nhóm này. Người học thuộc nghĩa từ mà vẫn nói sai vì không biết từ đó **sống chung với từ nào**.

```
Extend word enrichment with collocations and word family.

1. Update enrichWord() to use the extended responseSchema in §7.1 of the
   spec: three collocations (phrase + meaningVi) and up to three
   word-family members.
2. Add a backfill: for existing words missing collocations, enrich them
   lazily the next time they appear in a session. Do not batch-process
   the whole collection on app start.
3. In the word detail sheet, add a section under a hairline labelled
   "Thường đi với". Each collocation is one row: the phrase in Instrument
   Serif 20px with the target word visually emphasised at 500 weight, and
   the Vietnamese meaning below in --ink-soft 13px.
4. Add the word family as a single quiet line of comma-separated words
   under a "Cùng họ" label. No links, no navigation.
5. On the ExerciseWrite card, show one randomly chosen collocation as a
   hint under the textarea, in --ink-soft italic: "Gợi ý: {phrase}".

Do not create a new exercise type for collocations in this step.
```

**Nghiệm thu:** mở "leverage" → thấy `leverage existing infrastructure`, `leverage our position`, chứ không phải định nghĩa từ điển viết dài ra.

---

## Bước 13 — Màn Tiến độ

```
Add the Tiến độ screen, following §8.3 of the spec exactly.

Reachable from the gear menu, NOT as a fourth tab. The tab bar stays at
three tabs.

It contains, in this order:
1. Four large numbers in IBM Plex Mono (42px) with small Inter labels
   below: chuỗi ngày, từ đã thuộc, đang học, bài tập đã làm.
   Two per row, separated by hairlines.
2. A row of 7 dots for the last 7 days, labelled T2 to CN in mono 10px.
   Filled --green if the day qualified, hollow with a --rule border if
   not, --amber ring if it was frozen. Built with divs.
3. One line: "Tỉ lệ đúng 87%".
4. A "Từ khó" section listing up to 5 leech words as tappable rows.
   Omit the whole section if there are none.
5. A closing line in --ink-soft: "Bạn bắt đầu học từ 12/06/2026."

All numbers read from the user document. Do NOT query the reviews
collection to compute them. Do NOT install a charting library — if you
think you need one, you have misread the spec.
```

**Nghiệm thu:** màn này load tức thì (chỉ 1 document read); không có canvas, không có svg biểu đồ.

---

## Bước 14 — Từ khó và ôn ngược

```
Two related additions.

A. Leech handling, per §8.2 of the spec:
   - Set isLeech = true when lapseCount reaches 4.
   - A leech is never served as fillBlank. Only write or listen.
   - Its card always shows the collocations next to the meaning.
   - It appears at most once per session, as the first card.
   - Two consecutive correct answers clear isLeech and reset lapseCount
     to 2.

B. A recall-direction exercise. Multiple choice only trains recognition;
   the user also needs to produce the word from nothing.
   Add ExerciseRecall.tsx: show the Vietnamese meaning and the IPA, with
   the English word hidden. The user types the English word. Compare
   case-insensitively and ignore leading/trailing whitespace; accept a
   one-character typo as correct but show the correct spelling.
   Serve this only to words with status "learning" or "known" — never to
   a word the user has seen fewer than 3 times.

Do not change the existing three exercise types.
```

**Nghiệm thu:** cố tình sai một từ 4 lần → lần sau nó lên đầu buổi và hỏi kiểu tự viết, không còn trắc nghiệm.

---

## Bước 15 — Thêm từ từ mọi nơi

Rào cản lớn nhất của app học từ vựng là khoảnh khắc gặp từ mới và khoảnh khắc mở app cách nhau quá xa.

```
Make adding a word possible without opening the app.

1. Turn the app into an installable PWA with a Web Share Target so that
   selecting a word on Android Chrome and tapping Share shows Lexio.
   The shared text goes straight into the add-word flow, pre-filled,
   with source.kind = "share" and source.label set to the sharing app or
   page title when available.
2. Add an email-in address: a Cloud Function triggered by inbound mail
   that adds every word in the subject line to the sender's word list
   (match on the sender address; ignore mail from unknown addresses),
   with source.kind = "share" and label "Gửi qua email".
3. In the word detail sheet, show the provenance line under the meaning
   in --ink-soft 12px: "Thêm từ Buổi học với Minh Trang · 16/08".
   For manually typed words, show nothing rather than "Tự thêm".

Do not build a browser extension in this step.
```

**Nghiệm thu:** bôi đen một từ khi đọc báo trên điện thoại → Share → Lexio → từ đã nằm trong sổ, không cần mở app.

---

## Bước 16 — Bộ đọc file mọi định dạng

**Không có AI trong bước này.** Đây thuần là kỹ thuật bóc text, và trộn nó với phần gọi Gemini là cách chắc chắn nhất để hỏng cả hai. Làm xong bước này bạn phải test được bằng `console.log` trước khi sang bước 17.

```
Build the file extraction layer. NO Gemini calls in this step.

1. Add a third option to the add-word sheet: "Tải tài liệu".
2. Build ImportScreen.tsx: a drop zone accepting pdf, png, jpg, webp,
   docx, xlsx, xls, csv, pptx, txt and md, plus a "Dán văn bản" textarea
   below a hairline. Max 20MB.
3. Implement extractDocument() in src/lib/extract.ts following the table
   in §7.7 of the spec, using mammoth for .docx, SheetJS for
   spreadsheets, jszip + fast-xml-parser for .pptx, and pdf-lib to split
   long PDFs into 25-page chunks. PDFs and images are passed through as
   base64 without text extraction — the model reads them natively, which
   is what makes scanned files work.
4. Run extraction inside a Web Worker so the UI never freezes.
5. Reject legacy .doc/.xls/.ppt with the exact message in §7.7.
   If extraction yields under 200 characters from an Office file, show
   "File này hầu như không có chữ. Bạn kiểm tra lại giúp mình nhé."
6. For spreadsheets, prefix each sheet's text with its sheet name; for
   presentations, prefix each slide's text with "Slide N". This label
   becomes the provenance shown later.
7. Show the parsed result as a plain preview: file name, detected type,
   page or sheet or slide count, and character count. Nothing else.

Verify each format works before moving on. Do not call the Gemini API.
```

**Nghiệm thu:** úp thử đủ 5 loại — PDF text, PDF scan, .docx, .xlsx, .pptx — và cả năm đều ra đúng số trang/sheet/slide cùng phần text đọc được.

---

## Bước 17 — Phân tích, lọc từ chưa biết

```
Add word extraction on top of the file layer built in step 16.

1. Implement analyzeDocument() in gemini.ts per §7.6: pass the user's
   level and contextTopic, and an exclusion list built from their
   existing word lemmas plus the skipped collection (500 most recent).
   Native parts go as inline base64; text parts go as text.
2. Call chunks in parallel, then merge and de-duplicate by lemma,
   preferring candidates whose sentenceSource is "document".
3. Write an Import document with status "analyzing", then update it to
   "ready" with the candidates array. On failure set "failed" and show a
   retry button — never lose the user's file from the UI.
4. While analyzing, show skeleton rows matching the final row height and
   a mono progress line: "Đang đọc trang 12 / 24" (or sheet / slide).
   No spinner overlay, no blocking modal — the user can leave the screen
   and come back to a finished result.
5. On the Words screen, add a "Tài liệu đã đọc" section listing past
   imports with file name, date and how many words were added.

Do not build the triage controls yet. Do not write anything to the word
list in this step.
```

**Nghiệm thu:** úp một đề IELTS Reading → 20–40 từ, không trùng từ đã có trong sổ, và câu ví dụ khớp đúng câu trong bài đọc. Úp một file Excel → các từ vẫn ra, nhưng câu ví dụ được đánh dấu là do AI viết.

---

## Bước 18 — Màn phân loại 3 mức

```
Add the triage UI to the import result, per §8.3 of the spec.

1. Each candidate row shows: the word in Instrument Serif 22px, the
   Vietnamese meaning below, a small mono badge with the CEFR level, and
   a three-segment control on its own line below:
   "Rõ" | "Sơ sơ" | "Chưa".
   The segments sit in a single rounded container with hairline dividers.
   Selected segment: --green-wash background, --green text, weight 500.
2. Pre-select each row using the default rules in §8.3 (C1/C2 and
   technical -> Chưa, B2 -> Sơ sơ, B1 -> Rõ). The user taps only to
   correct a wrong guess.
3. Tapping the word itself expands the row to show sentenceFromDoc.
   If sentenceSource is "document", render it with a 1px --rule left
   border and the target word at weight 500 — it is a quotation from the
   user's own file. If it is "generated", drop the border and add a small
   italic --ink-soft label above it: "Câu ví dụ do AI viết".
   Tapping again collapses the row.
4. Filter pills at the top: Tất cả / B2 / C1–C2 / Chuyên ngành.
   Filtering only hides rows; it never changes a triage choice.
5. A sticky bottom bar shows the live count and one primary button:
   "Thêm 18 từ vào sổ". Words marked "Rõ" are counted out of that number
   and written to users/{uid}/skipped instead.
6. On confirm, write words using the entry points in the §8.3 table —
   "Sơ sơ" enters at easeLevel 2 with dueAt in 3 days, "Chưa" at
   easeLevel 0 due now. Set exampleSentence to sentenceFromDoc and
   source.label to the file name. Then enrich each new word in the
   background with enrichWord(), throttled to 5 concurrent calls.
7. Show a confirmation screen: one serif line "Đã thêm 18 từ.", the
   count of skipped words in --ink-soft, and a primary button
   "Học ngay 5 từ đầu tiên".

The screen must stay usable with 40 rows: virtualise or paginate if
scrolling stutters. Do not add bulk "select all" controls — the whole
point is that the user thinks about each word for one second.
```

**Nghiệm thu:** phân loại 40 từ mất dưới một phút; chọn "Rõ" cho một từ rồi úp lại đúng tài liệu đó → từ đó không xuất hiện nữa.

---

## Bước 19 — Nhập từ Google Drive

Bước này là cách duy nhất khả thi để lấy nội dung NotebookLM vào app — xem §7.8. Đừng cho agent đi tìm "NotebookLM API", nó sẽ bịa ra một endpoint không tồn tại và bạn mất nửa ngày.

```
Add Google Drive import, per §7.8 of the spec.

1. On the import screen, add a row above the drop zone:
   "Chọn từ Google Drive", with the Drive icon, separated from the drop
   zone by a hairline.
2. Use the Google Picker API with the drive.file scope, requested with
   incremental consent — ONLY when the user taps this row, never at
   sign-in. Restrict the picker to documents, spreadsheets,
   presentations, PDFs and images.
3. Convert by type before handing off to extractDocument():
   - Google Docs   -> files.export as text/plain
   - Google Sheets -> files.export as text/csv, per sheet
   - Google Slides -> files.export as text/plain
   - Any binary file (pdf, docx, xlsx, pptx) -> download bytes and pass
     straight into the existing §7.7 pipeline. Do not write a second
     extraction path.
4. Set source.label to the Drive file name.
5. If the user denies the scope, show an inline explanation and a retry
   button. Do not block the rest of the screen.
6. Do not store the file, its Drive ID, or any long-lived token. Read
   once, then discard.

Do NOT attempt to call any NotebookLM API — none exists publicly. The
Drive path IS the NotebookLM path.
```

**Nghiệm thu:** trong NotebookLM, xuất một ghi chú sang Google Docs → mở Lexio → Chọn từ Google Drive → file đó xuất hiện → phân tích ra danh sách từ như mọi tài liệu khác.

---

## Khi agent bắt đầu hỏng

| Triệu chứng | Xử lý |
|---|---|
| Sửa file bạn không nhắc tới | Revert về checkpoint. Thêm vào cuối prompt: *"Only modify these files: [danh sách]. List every file you changed."* |
| Bảo "đã xong" nhưng UI không đổi | *"Show me the full contents of [file] as it is now."* Thường nó chỉ mô tả chứ chưa ghi. |
| Tự chế màu / gradient / font mới | Dán lại nguyên khối token ở mục 4 của spec + *"Restore these exact values. Remove every color not in this list."* |
| Mất dần cấu trúc thư mục | Mở phiên mới, dán lại spec, rồi: *"Reorganise the project to match this folder structure. Do not change behaviour."* |
| Vòng lặp sửa lỗi không thoát ra được | Dừng. Revert. Chia bước hiện tại làm đôi và làm lại từng nửa. |
| Prompt quá dài nó làm nửa vời | Cắt prompt thành 2–3 lượt, mỗi lượt một mục đánh số. |

**Quy tắc 3 lần:** cùng một lỗi mà sửa 3 lượt không xong thì đừng sửa lượt thứ 4 — revert và viết lại prompt từ đầu với phạm vi hẹp hơn.
