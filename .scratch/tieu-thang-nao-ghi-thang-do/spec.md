# Spec: Tiêu tháng nào ghi tháng đó

Status: ready-for-agent

## Problem Statement

Khoản trả bằng nguồn trả sau, nếu tiêu sau ngày chốt sao kê của nguồn đó, đang được ghi sang
sheet tháng sau — tháng tiền rời tài khoản. Với bốn nguồn, mỗi nguồn một ngày chốt, mở file
ra không trả lời được câu "tháng 8 tôi tiêu bao nhiêu": một phần tiền tiêu tháng 8 nằm ở
sheet Tháng 9, lẫn với khoản tiêu thật của tháng 9. Khoản quẹt cuối tháng 12 còn bị bot từ
chối và phải chép tay sang file năm sau.

File hiện có sẵn nhiều **khoản lệch tháng** do quy tắc cũ tạo ra, kể cả những khoản thẻ ghi
từ trước khi có tiền tố nguồn (không có dấu gì ngoài việc lệch tháng).

## Solution

Mọi khoản nằm ở sheet của **tháng của khoản** (tháng của ngày tiêu). Nguồn trả sau chỉ còn là
nhãn: token vẫn được bóc khỏi mô tả và ghép thành tiền tố `[hsbc]` / `[vpb]` / `[spl]` /
`[zlp]` như hiện nay, nhưng không đổi tháng. Ngày chốt sao kê bỏ hẳn.

Dữ liệu cũ được sửa **một lần** bằng một công cụ chạy từ máy cá nhân:

1. Đổi mọi tiền tố `[cc]` thành `[hsbc]`.
2. Dời mọi khoản lệch tháng về sheet của tháng của khoản. Khoản lệch tháng ngày *sớm hơn*
   tháng của sheet, ở nhóm chi tiêu, chưa có tiền tố → gắn `[hsbc]` (thời đó chỉ thẻ HSBC
   bị dời tháng).

Xem `docs/adr/0002-khoan-nam-o-thang-tieu-khong-phai-thang-tra.md` cho lý do và cái giá.

## Hình dạng trước / sau

| | Tin gửi vào (ngày 20/8) | Dòng trong Excel | Bot trả lời |
|---|---|---|---|
| Trước | `/food ăn trưa 40k hsbc` | Tháng 9: `[hsbc] ăn trưa · 20/08 · 40.000` | `💳 tiêu 20/08 → trả tháng 9` |
| Sau | `/food ăn trưa 40k hsbc` | **Tháng 8**: `[hsbc] ăn trưa · 20/08 · 40.000` | `💳 Thẻ HSBC` |

## User Stories

1. Là người ghi chi tiêu, tôi muốn khoản trả bằng bất kỳ nguồn nào cũng nằm ở tháng tôi
   tiêu, để mỗi sheet tháng là "tháng đó tôi tiêu bao nhiêu".
2. Là người ghi chi tiêu, tôi muốn vẫn gõ được `hsbc` / `vpb` / `spl` / `zlp`, để biết
   khoản được trả bằng gì.
3. Là người ghi chi tiêu, tôi muốn khoản quẹt cuối tháng 12 được ghi bình thường vào Tháng
   12, để không phải chép tay.
4. Là người ghi chi tiêu, tôi muốn ghi lùi ngày vẫn rơi đúng tháng của ngày đó, với mọi nguồn.
5. Là người dùng bot, tôi muốn tin xác nhận ghi emoji kèm tên nguồn (`💳 Thẻ HSBC`), để liếc
   là biết mình gõ đúng token.
6. Là người dùng bot, tôi muốn `/help` liệt kê bốn token mà không còn ngày chốt, để không
   bị hiểu nhầm là ngày chốt còn tác dụng.
7. Là người dùng bot, tôi muốn `/thang` là tổng đã tiêu trong tháng này, và `/today` gom đủ
   khoản của hôm nay.
8. Là người dùng bot, tôi muốn khoản đang nằm trong hàng đợi ghi lại hoặc đang chờ tôi bấm nút
   số tiền lúc deploy được ghi vào tháng tiêu, không theo tháng đã tính bằng quy tắc cũ.
9. Là người dùng bot, tôi muốn các luật token giữ nguyên: bóc khỏi mô tả, cấm với `/income`,
   `/invest`, `/saving`, không nhận `thẻ`/`ví`/`td`, hai token trong một tin là lỗi.
10. Là người mở file Excel, tôi muốn mọi dòng `[cc]` thành `[hsbc]`, để mỗi nguồn chỉ có một
    tiền tố.
11. Là người mở file Excel, tôi muốn mọi khoản lệch tháng về đúng sheet của tháng tiêu, kể cả
    dòng tôi gõ tay.
12. Là người mở file Excel, tôi muốn khoản thẻ cũ không tiền tố được gắn `[hsbc]` khi dời,
    để không mất dấu vết duy nhất cho biết đó là khoản thẻ.
13. Là người mở file Excel, tôi muốn dòng ở sheet cũ bị xoá hẳn, không để lại dòng trống.
14. Là người mở file Excel, tôi muốn bảng nhận dòng được dọn lại (sắp theo ngày, đáy có dòng
    trống).
15. Là chủ file, tôi muốn xem trước danh sách mọi thay đổi trên bản TEST trước khi đụng file
    thật, với các dòng sẽ được gắn `[hsbc]` đánh dấu riêng.
16. Là chủ file, tôi muốn công cụ không bao giờ làm mất dòng: lỗi giữa chừng thì tệ nhất là
    trùng một dòng, và dòng trùng được báo ra.
17. Là chủ file, tôi muốn dòng không dời được (ngày 12/2025 ở Tháng 1, ngày ở năm khác, không
    có ngày) được giữ nguyên và liệt kê ra.

## Implementation Decisions

### Bot

- Tháng ghi = tháng của ngày khoản (`entry.date.m`). Bỏ hàm tính tháng theo kỳ sao kê
  (`src/billing.ts`) cùng bộ test của nó, bỏ `cutoffDayFor`, `defaultCutoffDay` trong tập
  nguồn, và phần đọc khối `H`–`I` của sheet `Note`. `NoteConfig` chỉ còn bảng mã viết tắt.
- Bỏ đường từ chối khoản tháng 12 vượt mốc (`carryOverRefusal` và lời gọi trong router).
  Kiểm năm ngoài `WORKBOOK_YEAR` giữ nguyên.
- `targetMonth` bỏ khỏi `ExactEntry`; mọi chỗ cần tháng thì lấy từ `date.m`. Bản ghi cũ trong
  hàng đợi ghi lại và khoản mơ hồ đang chờ có thể còn mang `targetMonth` — **bỏ qua** trường
  đó, không đọc. Đây là cách đạt user story 8, không cần miếng vá riêng.
- `performWrite` chỉ đọc một sheet (bỏ nhánh `crossed` đọc thêm sheet tháng phát sinh).
- `/today` chỉ đọc sheet tháng hôm nay. `/thang` giữ nguyên logic, sửa comment về nghĩa.
- Tin xác nhận: dòng nguồn thành `${emoji} ${label}` (ví dụ `💳 Thẻ HSBC`), một hình dạng duy
  nhất. Ba dòng tổng dùng tháng của khoản.
- `/help`: mục "Nguồn trả sau" liệt kê `token emoji nhãn`, bỏ câu "Quẹt sau ngày chốt..." và
  ngày chốt. `helpText` vẫn nhận `NoteConfig` cho bảng mã viết tắt.
- `legacySource` giữ nguyên (đọc `isCard` / `source: 'cc'` từ bản ghi kiểu cũ) — vẫn cần
  cho tới khi hàng đợi ghi lại rỗng sau deploy. `LEGACY_HSBC_TOKEN` chỉ còn phục vụ nó; comment
  đổi cho đúng: các dòng `[cc]` trong file đã được đổi thành `[hsbc]`.
- Ô `Note!H:I` bot để nguyên, không xoá.

### Công cụ dời dòng

- Một script `scripts/realign-months.mjs`, hai chế độ: mặc định **chỉ đọc** và in kế hoạch;
  `--apply` mới ghi. Đích là file mà `.dev.vars` đang trỏ (`DRIVE_ITEM_ID`), dùng
  `scripts/where.mjs` / `push-secrets` như các script khác để chọn TEST hay file thật. Script in
  rõ tên file đích ở dòng đầu.
- Phạm vi: 9 nhóm × 12 tháng = 108 bảng (`<nhóm>_<tháng>`). Bảng không tồn tại thì bỏ qua và báo.
- **Kế hoạch là hàm thuần** ở `scripts/lib/realign-plan.mjs` (JS thuần, không import gì từ
  `src/` — Node không tự phân giải import không đuôi của TS). Nhận: tên nhóm, tháng của sheet,
  các dòng của bảng. Trả về, cho mỗi dòng có thay đổi: chỉ số, giá trị cũ, giá trị mới, bảng
  đích (hoặc `null` nếu ở yên), và lý do. Test bằng vitest ở `tests/realign-plan.test.ts`.
- Quy tắc phân loại một dòng (ô ngày là số serial Excel; quy đổi ra ngày/tháng/năm):
  - Ô mô tả bắt đầu bằng `[cc] ` → mô tả mới bắt đầu bằng `[hsbc] `.
  - Ngày năm `WORKBOOK_YEAR`, tháng ≠ tháng của sheet → **dời** sang `<nhóm>_<tháng của ngày>`.
  - Dời, ngày sớm hơn tháng của sheet, nhóm là một trong 6 nhóm chi tiêu, mô tả không có tiền
    tố nguồn nào (sau khi đổi `[cc]`) → gắn `[hsbc] ` và **đánh dấu riêng** trong bản in.
  - Ngày năm khác (ví dụ 12/2025 ở Tháng 1) → **ở yên**, liệt kê. Nếu nằm ở nhóm chi tiêu, ngày
    sớm hơn tháng của sheet, không tiền tố → vẫn gắn `[hsbc]` tại chỗ, đánh dấu riêng.
  - Ô ngày không phải số, hoặc dòng trống → không đụng. Dòng có ô ngày không phải số nhưng có
    nội dung → liệt kê ở mục "không có ngày".
- Thứ tự khi `--apply`, cho từng dòng cần dời:
  1. `rows/add` vào bảng đích với giá trị mới, rồi vá định dạng ngày theo chỉ số trả về (như
     `appendRow` + `fixDateFormat`).
  2. Đọc lại bảng nguồn, tìm dòng theo **nội dung cũ** (cùng quy tắc so với `findRowIndex`:
     mô tả so chuỗi, ngày và số tiền so chặt), rồi xoá theo chỉ số vừa tìm. Không xoá theo chỉ
     số trong kế hoạch: Graph có lúc trả bản đọc cũ (xem commit 7d35edf).
  3. Không tìm thấy → không xoá, ghi vào mục "có thể trùng" của báo cáo cuối.
- Dòng chỉ đổi mô tả (đổi `[cc]` hoặc gắn `[hsbc]` tại chỗ): đọc lại dòng ở chỉ số đó, khớp nội
  dung cũ thì `PATCH` ô mô tả; không khớp thì tìm lại theo nội dung, vẫn không thấy thì báo.
- Dòng vừa cần dời vừa cần đổi mô tả: dời với mô tả mới, một bước.
- Sau khi xong mọi dòng: dọn mỗi bảng **đã nhận** dòng (sắp theo ngày + thêm dòng trống nếu đáy
  chưa có), cùng quy tắc `tidyTable` — không xoá dòng nào.
- Chạy tuần tự, một lệnh ghi tại một thời điểm. Chậm nhưng không đua với chính mình.
- Báo cáo cuối: số dòng đã dời / đổi mô tả / ở yên / có thể trùng, kèm danh sách từng loại.
  Mã thoát khác 0 nếu có dòng "có thể trùng" hoặc lỗi.
- Chạy script làm chết chuỗi refresh token phía bot (xem `CONTEXT.md`, **Người giữ chuỗi**).
  Script in nhắc ở cuối: gửi `/reauth`.

### Thứ tự triển khai

1. Ticket 01 deploy lên bot thật — từ đây không còn khoản lệch tháng mới.
2. Chạy công cụ chỉ đọc trên bản TEST (tạo bằng `npm run spike:prepare` cho mới), người dùng
   xem danh sách.
3. `--apply` trên bản TEST, người dùng mở bản TEST đối chiếu.
4. Người dùng đồng ý → `--apply` trên file thật. Trong lúc chạy, người dùng không gửi tin ghi
   khoản.
5. Người dùng gửi `/reauth`.

### Tài liệu

- `README.md`: mục "Nguồn trả sau" viết lại — nguồn chỉ là nhãn; bỏ bảng cột "Mốc chốt mặc
  định", bỏ đoạn mốc chốt, đoạn tháng 12, đoạn "ngày của tháng trước nằm trong sheet tháng sau",
  đoạn `[cc]` cũ. Thêm một câu: không ghi khoản trả nợ thẻ.
- Script `setup-note.mjs`, `check-note.mjs`, `verify-card.mjs` còn nói về mốc chốt: gỡ phần mốc
  chốt; script nào chỉ tồn tại để kiểm mốc chốt thì xoá (cùng mục `verify:card` trong
  `package.json`).
- `CONTEXT.md` và hai ADR đã viết xong trong lượt grilling.

## Testing Decisions

Như các spec trước: hàm thuần, không dựng `Env`, không giả lập Graph. Test hành vi quan sát
được.

- **Từ tin nhắn tới dòng Excel** (`tests/routing.test.ts`): viết lại nhóm test theo hành vi
  mới — mọi nguồn, mọi ngày (kể cả sau ngày chốt cũ, kể cả cuối tháng 12) rơi vào
  `<nhóm>_<tháng của ngày>`; tiền tố đúng từng nguồn; ghi lùi ngày. Bỏ nhóm test chặn năm sau
  và `cutoffDayFor`.
- **`tests/billing.test.ts`**: xoá cùng `src/billing.ts`.
- **Sheet `Note`** (`tests/note.test.ts`): bỏ các ca mốc chốt; giữ ca bảng mã viết tắt, kể cả
  ca `address` lệch.
- **Định dạng** (`tests/format.test.ts`): dòng nguồn `emoji + nhãn` cho từng nguồn; không nguồn
  thì không có dòng đó; `/help` liệt kê bốn token, không chứa chữ "chốt".
- **Kế hoạch dời** (`tests/realign-plan.test.ts`, mới): `[cc]` → `[hsbc]`; dời lùi một tháng có
  tiền tố (giữ tiền tố); dời lùi không tiền tố ở nhóm chi tiêu (gắn `[hsbc]`, đánh dấu); dời
  lùi không tiền tố ở `income` (không gắn); dời tiến (không gắn); `[cc]` lệch tháng (dời + đổi
  một bước); năm 2025 ở Tháng 1 (ở yên, gắn tại chỗ nếu đủ điều kiện); ô ngày là chữ; dòng
  trống; dòng đúng tháng (không có trong kế hoạch); mô tả là số (Excel lưu `100` thành số).

Không test script `--apply` tự động — nó cần Graph. Nghiệm thu là chạy trên bản TEST.

## Out of Scope

- Thêm tiền tố cho tiền mặt / thẻ debit. "Không tiền tố" vẫn nghĩa là tiền rời tài khoản ngay.
- Xoá khối `H`–`I` khỏi sheet `Note` — người dùng tự xoá khi muốn.
- Đối chiếu số dư ngân hàng. Cuối kì trong `Tóm tắt` không còn là số dư thật (ADR-0002).
- Dời khoản 12/2025 ra khỏi file 2026.
- Sửa `/undo` cho khoản bị công cụ dời đi: ngay sau khi dời, `/undo` có thể không tìm thấy khoản
  gần nhất nếu nó vừa đổi bảng. Chấp nhận.
