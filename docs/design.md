# Design System

> **Quyết định:** giữ nguyên diện mạo AI Studio hiện tại (xem ADR-006 trong `decision.md`). Phần dưới đây trước hết ghi lại token **đang dùng thật** (nguồn sự thật), sau đó là bảng token trong mockup `docs/ui/` như tài liệu tham chiếu — không áp dụng, chỉ để tra cứu nếu sau này đổi ý.

## 1. Token đang dùng (nguồn sự thật, sau Phase 1)

Trước Phase 1, các giá trị này là 9 CSS custom property rời rạc trong `app/globals.css`, tiêu thụ qua cú pháp arbitrary value (`bg-[var(--surface)]`) hàng trăm lần, và song song đó là raw Tailwind palette hardcode (`indigo-600`, `emerald-*`, `rose-*`) rải ở ~12 file khác — hai hệ thống màu không khớp nhau (`--green` là `#4F46E5`, tức tím-indigo, không phải xanh lá). Phase 1 gom hai hệ thống này thành một, **giữ nguyên giá trị màu**, không đổi giá trị.

```css
:root {
  --paper:      #F8FAFC;   /* nền app */
  --surface:    #FFFFFF;   /* card, sheet, input */
  --ink:        #0F172A;   /* chữ chính */
  --ink-soft:   #64748B;   /* chữ phụ, nhãn */
  --rule:       #E2E8F0;   /* hairline, viền */
  --green:      #4F46E5;   /* accent chính — thực chất là indigo, giữ tên biến */
  --green-wash: #EEF2FF;   /* nền tint accent */
  --amber:      #D97706;   /* trạng thái learning/due/leech */
  --wrong:      #E11D48;   /* trạng thái sai */
}
[data-theme="dark"] {
  --paper: #0F172A; --surface: #1E293B; --ink: #F8FAFC; --ink-soft: #94A3B8;
  --rule: #334155;  --green: #818CF8;   --green-wash: #1E1B4B;
  --amber: #FBBF24; --wrong: #FB7185;
}
```
Sau Phase 1, các giá trị trên được khai báo lại trong `@theme inline` (Tailwind v4) để sinh utility `bg-paper`, `text-ink-soft`, `border-rule`, `bg-green`, v.v. — **cùng một giá trị**, chỉ đổi cách gọi. Bổ sung token còn thiếu ở baseline: `--radius-card: 16px`, `--radius-btn: 12px`, `--radius-sheet: 24px`, `--shadow-card`, và một token `--accent-gradient` (`from-indigo-600 to-violet-500`) để hero banner ở Hôm nay/Tiến độ dùng chung 1 nguồn thay vì hardcode 2 nơi.

**Font:** Instrument Serif (chỉ cho từ vựng tiếng Anh, hero word), Inter (UI, subset `vietnamese` bắt buộc vì UI tiếng Việt), IBM Plex Mono (IPA, counter, ngày tháng, streak). Chuyển sang `next/font` ở Phase 1 — bỏ `<link>` Google Fonts chặn render trong `layout.tsx`.

**Dark mode:** cơ chế là `[data-theme="dark"]` trên `<html>`, gán bởi settings store. **Bug baseline:** Tailwind v4 `dark:` variant mặc định theo `prefers-color-scheme` (theo OS), không theo `[data-theme]` — 60 chỗ dùng `dark:` trong code hiện theo OS trong khi biến CSS theo nút bấm, hai cơ chế đá nhau. **Vá bằng 1 dòng:** `@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));` trong `globals.css`.

## 2. Component primitive (`components/ui/`)

| Primitive | Props chính | Ghi chú |
|---|---|---|
| `Button` | `variant: 'primary'\|'quiet'\|'danger'`, `size: 'md'\|'sm'`, `block`, `loading`, `icon` | 3 variant — baseline hiện có nhưng string-concat tay, không type-safe |
| `IconButton` | `icon`, `label` (bắt buộc → `aria-label`), `tone` | |
| `Fab` | `icon`, `label`, `onPress` | Cố định góc dưới-phải, phía trên tab bar |
| `Card` | children | surface + rule + `rounded-card` + `shadow-card` |
| `EntryCard` | `word`, `ipa?`, `partOfSpeech?`, `size: 'lg'\|'sm'`, `state: 'default'\|'correct'\|'wrong'` | Thẻ từ vựng dùng trong bài tập |
| `Field` / `Textarea` | `label`, `hint`, `error` (→ `aria-invalid`+`aria-describedby`) | |
| `Option` | `label`, `state: 'idle'\|'correct'\|'wrong'\|'muted'`, `index` (phím tắt 1-4) | Nút đáp án trắc nghiệm |
| `Badge` | `tone: 'new'\|'learning'\|'known'` | |
| `Pill` | `selected` | Filter chip |
| `Seg` | `options`, `value`, `onChange` | Triage 3 mức |
| `Switch` | `checked`, `onChange`, `label` | `role="switch"` thật |
| `Sheet` | `open`, `onClose`, `title`, `footer`, `dismissible` | Dựng trên `<dialog>` + `showModal()` — focus trap/Esc/inert nền miễn phí, thay bản cũ không có `role="dialog"` |
| `StickyBar` | children | Thanh hành động dính đáy có đếm số |
| `Row` | `title`, `subtitle`, `trailing`, `onPress`/`href` | Dòng trong Sổ từ — render `<button>` khi có `onPress`, tránh `<div onClick>` |
| `EmptyState` | `icon`, `title`, `description`, `action` | |
| `Skeleton` | `w`, `h`, `radius` | Kích thước phải khớp row thật — chống layout shift |
| `SectionLabel` / `Counter` / `StatGrid` / `Avatar` / `TabBar` | | |

Xoá trùng lặp khi rút primitive: 5 nút tab chép tay trong `AppShell.tsx`, chuỗi class option chép ở 3 file, seeded-shuffle chép ở 2 file, 2 hero gradient chép đôi.

## 3. Quy tắc

- Không dùng arbitrary value `bg-[var(--...)]` sau Phase 1 — luôn qua utility token (`bg-paper`, không `bg-[var(--paper)]`). ESLint chặn bằng `no-restricted-syntax` trên pattern `\[var\(--`.
- Không hardcode `indigo-*`/`emerald-*`/`rose-*` trực tiếp trong component — luôn qua token.
- Motion: `prefers-reduced-motion: reduce` tắt animation toàn cục, giữ transition màu.
- 360px không được tràn ngang ở bất kỳ màn nào (kiểm ở Phase 8).

## 4. Mockup reference (`docs/ui/`, KHÔNG áp dụng — chỉ tham chiếu)

Bảng token định nghĩa trong 23 file mockup, khác hẳn bảng token đang dùng ở §1:

```css
--paper:#FAF8F5;  --surface:#FFFFFF;  --ink:#232120;    --ink-soft:#6B655E;
--rule:#E5DFD6;   --green:#2F6B4F;    --green-wash:#EDF3EF;
--amber:#B07C36;  --wrong:#9C4A3F;
--r-card:16px; --r-btn:12px; --r-sheet:24px;
--shadow: 0 1px 2px rgba(35,33,32,.04), 0 8px 24px rgba(35,33,32,.06);
```
Dark: `#171614 / #211F1D / #F2EDE6 / #9A938A / #322F2B / #6FA98A / #23302A / #C79B5C / #C4736A`.

Đặc điểm chính (nếu sau này quyết định áp dụng): **cấm gradient hoàn toàn**, một accent hue duy nhất, hairline phân cách row thay vì bọc card, không progress bar/ring (chỉ số + chấm tròn), không toast/modal (chỉ bottom sheet), typography 3 tầng rất nghiêm ngặt (Serif chỉ cho từ vựng, Mono chỉ cho thứ "máy móc" như IPA/đếm/ngày, Inter cho UI). 11 màn trong mockup chưa có implementation nào trong app — xem `progress/00-baseline-audit.md` §4 và `board.md` Phase 7.

**Vì sao ghi lại dù không dùng:** ADR-006 là quyết định có khả năng đảo ngược cao nhất trong toàn bộ lần tái kiến trúc này. Vì primitive ở §2 được thiết kế tách khỏi giá trị màu cụ thể (chỉ tiêu thụ token), đảo ngược ADR-006 sau này chỉ cần đổi giá trị trong `@theme inline`, không cần viết lại component.
