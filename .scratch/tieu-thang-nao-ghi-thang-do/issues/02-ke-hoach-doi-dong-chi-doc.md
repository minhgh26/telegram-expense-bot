# 02: Công cụ dời dòng — kế hoạch và bản in xem trước (chỉ đọc)

**What to build:** Người dùng (hoặc agent) chạy `node scripts/realign-months.mjs` trên file mà
`.dev.vars` đang trỏ. Script quét 108 bảng (`<nhóm>_<tháng>`), **không ghi gì**, và in ra:

```
File đích: Theo dõi chi tiêu - TEST.xlsx
=== Dời tháng ===
food_9  → food_8   [hsbc] ăn trưa · 20/08 · 40.000
food_9  → food_8   ★ [hsbc] cơm tấm · 18/08 · 35.000      (gắn [hsbc] — dòng cũ không tiền tố)
...
=== Đổi [cc] → [hsbc] tại chỗ ===
force_3          [cc] → [hsbc] phí thường niên · 02/03 · 500.000
=== Ở yên ===
food_1           [cc] tất niên · 28/12/2025 · 300.000   (năm khác → ở yên, đổi [hsbc] tại chỗ)
other_4          gửi xe · (không có ngày) · 5.000
=== Tổng ===
dời 42 (★ 17) · đổi mô tả tại chỗ 9 · ở yên 3
```

Logic quyết định nằm trong một **hàm thuần** ở `scripts/lib/realign-plan.mjs`, test bằng vitest.
Quy tắc phân loại ở `../spec.md` mục "Công cụ dời dòng".

**Blocked by:** —

**Status:** ready-for-agent

- [x] `scripts/lib/realign-plan.mjs`: hàm thuần nhận (nhóm, tháng của sheet, các dòng) → danh sách thay đổi kèm chỉ số, giá trị cũ, giá trị mới, bảng đích, lý do, cờ ★
- [x] Không import gì từ `src/`; hằng `WORKBOOK_YEAR`, 9 nhóm, 6 nhóm chi tiêu, bốn tiền tố khai báo lại trong file kèm comment trỏ về `src/config.ts`
- [x] Quy đổi serial Excel → ngày/tháng/năm đúng (cùng mốc với `toExcelSerial`)
- [x] `tests/realign-plan.test.ts` phủ đủ các ca ở `../spec.md` mục Testing
- [x] `scripts/realign-months.mjs` mặc định chỉ đọc, in đúng bốn mục như trên, dòng đầu là tên file đích
- [x] Bảng không tồn tại → bỏ qua, báo trong bản in
- [x] In nhắc gửi `/reauth` ở cuối
- [x] `npm test` và `npm run typecheck` qua
- [ ] Nghiệm thu: chạy trên bản TEST mới tạo, người dùng đọc bản in và xác nhận danh sách hợp lý (đặc biệt các dòng ★)

## Comments

### 2026-11-14 — /mrs:deliver

Commit trên `feat/tieu-thang-nao-ghi-thang-do` (chưa push): `43b88cd`, `16a7cc9`; mốc so sánh `564d813`. Gate: agent báo `npm test` 298/298 (không test nào bị bỏ qua), `npm run typecheck` sạch; agent review chạy lại độc lập trên `43b88cd` cũng thấy xanh.

**Quyết định ticket không quy định**
- Dòng mang ngày năm khác (trước hoặc sau `WORKBOOK_YEAR`) luôn nằm ở mục "Ở yên", kể cả khi mô tả được đổi `[cc]` → `[hsbc]` hoặc gắn `[hsbc]` ★ tại chỗ; ghi chú cuối dòng cho biết việc đổi.
- Mục "Tổng": mỗi dòng đếm đúng một lần, ở mục nó được liệt kê. "đổi mô tả tại chỗ" = số dòng trong mục "Đổi [cc] → [hsbc] tại chỗ"; dòng năm khác có đổi mô tả chỉ đếm ở "ở yên".
- Dòng có ô ngày không phải số nhưng có nội dung → "Ở yên", in `(không có ngày)`. Dòng trống tính theo 3 ô mô tả/ngày/số tiền (như CONTEXT.md), ô thừa phía sau không tính.
- Mô tả là số (Excel lưu `100` thành số) được đổi thành chuỗi: `[hsbc] 100`.
- Ngày in `dd/mm` cho năm `WORKBOOK_YEAR`, `dd/mm/yyyy` cho năm khác.
- Thêm mục thứ năm "=== Bảng không tồn tại (N, bỏ qua) ===", chỉ in khi có bảng thiếu (bảng trả về 404).
- Script từ chối mọi tham số dòng lệnh (kể cả `--apply`) và thoát trước khi lấy token, nên chạy nhầm `--apply` không làm chết refresh token và không in kết quả giả là "đã dời".
- Dòng "(da luu refresh token moi vao .dev.vars)" của `getAccessToken` được giữ lại và in ở cuối, ngay trước lời nhắc `/reauth`, để "File đích: …" là dòng đầu. `getAccessToken` không đổi.
- Lời nhắc `/reauth` in ở mọi lối ra sau khi đã lấy token, kể cả khi đọc file hoặc bảng lỗi (khi đó mã thoát là 1).
- Mỗi mục kế hoạch có thêm cờ `descChanged` (mô tả có đổi không) bên cạnh `kind`, để ticket 03 khỏi phải so giá trị cũ/mới.
- `src/parse/message.ts`: thêm `export` cho `DEFERRED_ALLOWED`, để test kiểm 6 nhóm chi tiêu khai báo lại khớp với bot. Test mới `hằng khai báo lại khớp src/` cũng kiểm `WORKBOOK_YEAR`, 9 nhóm, 4 tiền tố. `scripts/lib/realign-plan.mjs` vẫn không import gì từ `src/`.
- Thêm `scripts/lib/realign-plan.d.mts` (khai báo kiểu) để test TypeScript import được file `.mjs` khi typecheck chặt.
- Không sửa ADR, CONTEXT.md, README. Không thêm thuật ngữ mới.

**Giới hạn đã biết**
- `scripts/realign-months.mjs` chưa từng chạy với Graph. Theo agent báo, nó chỉ được kiểm bằng `node --check` và một lần chạy với `--apply` (bị từ chối, thoát 1 như mong muốn). Thứ tự dòng in, bản in mới và lời nhắc ở lối ra lỗi chỉ đọc từ code. Bước nghiệm thu là chỗ bắt các lỗi này.
- Bảng thiếu chỉ được nhận ra khi Graph trả về 404; mọi lỗi khác dừng cả lượt chạy.
- Nếu chính `getAccessToken` ném lỗi thì không có lời nhắc `/reauth`.
- Chỉ số dòng là vị trí trong mảng Graph trả về (không phân trang). Ticket 03 đọc lại dòng trước khi xoá, nên lệch sẽ bị chặn ở đó.
- `oldValue`, và `newValue` khi không đổi, là chính mảng dòng đầu vào: ticket 03 không được sửa trực tiếp vào chúng.

**Review: để nguyên có chủ ý**
- Code chia nhánh theo `kind`/`reason` bằng ternary lồng nhau. Tên bảng `${group}_${month}` dựng ở hai file. Điều kiện `date.m !== sheetMonth` tính lại.
- Hằng xuất ra nhưng chỉ test dùng. Kiểu union `reason`/`kind` ghi ở cả JSDoc lẫn `.d.mts`. Tên nhóm là `string` thay vì union.
- Tên ngắn trong test/script (`one`, `dong(mo…)`, `c`, `v`). Thông báo lỗi không dấu (theo kiểu `dev-vars.mjs`). `$select=index` lấy về rồi bỏ.

**Tiêu chí chưa đạt:** "Nghiệm thu" — cần chạy trên bản TEST mới tạo và người dùng xác nhận.

**For the maintainer**
- Nghiệm thu: `npm run spike:prepare` để tạo bản TEST mới, trỏ `.dev.vars` vào nó, chạy `node scripts/realign-months.mjs`, đọc bản in (nhất là các dòng ★ "gắn [hsbc] — dòng cũ không tiền tố"). Xong thì gửi `/reauth` trong Telegram, tick tiêu chí cuối và đóng ticket.
- ~~Quyết định: dòng `[cc]` có ô ngày là chữ hiện được giữ nguyên `[cc]` (spec: "Ô ngày không phải số … → không đụng"). Điều này vướng user story 10 ("mọi dòng `[cc]` thành `[hsbc]`") và tiêu chí ticket 03 "không còn dòng `[cc]` nào". Chọn một: (a) vẫn đổi `[cc]` → `[hsbc]` tại chỗ cho dòng này, không dời; (b) giữ như hiện tại và nới tiêu chí ticket 03. Đề xuất (a).~~ Không cần quyết: file thật không có dòng nào như vậy (xem mục quét ngày 2026-11-14 bên dưới).
- Xác nhận các mặc định: dòng năm khác nằm ở "Ở yên" và đếm một lần; script từ chối mọi tham số cho tới ticket 03; export `DEFERRED_ALLOWED` trong `src/parse/message.ts`.

### 2026-11-14 — quét file thật tìm dòng `[cc]` không có ngày

Quét chỉ đọc file thật `Theo dõi chi tiêu.xlsx` (`DRIVE_ITEM_ID`), đủ 108 bảng, không bảng nào thiếu. Script quét để ở thư mục tạm, không nằm trong repo.

- 1.181 dòng có dữ liệu (dòng trống = cả 3 ô mô tả, ngày, số tiền đều trống).
- Dòng có mô tả bắt đầu bằng `[cc] `: **0**. Biến thể gần giống (`[CC]`, `[cc]` thiếu dấu cách, có khoảng trắng đầu): 0.
- Vì vậy quyết định "dòng `[cc]` có ô ngày là chữ" không cần chốt cho file này: (a) hay (b) cho cùng kết quả. Trên file thật, bước đổi `[cc]` → `[hsbc]` của ticket 03 cũng không có dòng nào để đổi.
- 13 dòng có nội dung nhưng ô ngày trống (không dòng nào là `[cc]`). Bản in ticket 02 sẽ xếp chúng vào "Ở yên" với `(không có ngày)`:

| Bảng | Mô tả | Số tiền |
|---|---|---|
| other_expense_2 | biếu ông bà cô bác ngày Tết | 2.600.000 |
| other_expense_3 | thanh toán bằng zalopay | 1.145.000 |
| other_expense_4 | thanh toán bằng zalopay | 4.086.000 |
| income_5 | lương CMC | 12.594.867 |
| income_5 | lương FPT | 13.571.536 |
| income_6 | Điều chỉnh số dư | -846.593 |
| income_10 | hoàn tiền mua sắm | 53.966 |
| invest_5 | CCQ | 3.000.000 |
| saving_1 | zalopay | 5.000.000 |
| saving_2 | zalopay | 7.785.494 |
| saving_4 | *(mô tả trống)* | 17.454 |
| saving_4 | zalopay | *(tiền trống)* |
| saving_5 | zalopay | 14.183.548 |

Lần quét này đã xoay refresh token, nên bot cần `/reauth`.
