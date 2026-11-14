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

- [ ] `scripts/lib/realign-plan.mjs`: hàm thuần nhận (nhóm, tháng của sheet, các dòng) → danh sách thay đổi kèm chỉ số, giá trị cũ, giá trị mới, bảng đích, lý do, cờ ★
- [ ] Không import gì từ `src/`; hằng `WORKBOOK_YEAR`, 9 nhóm, 6 nhóm chi tiêu, bốn tiền tố khai báo lại trong file kèm comment trỏ về `src/config.ts`
- [ ] Quy đổi serial Excel → ngày/tháng/năm đúng (cùng mốc với `toExcelSerial`)
- [ ] `tests/realign-plan.test.ts` phủ đủ các ca ở `../spec.md` mục Testing
- [ ] `scripts/realign-months.mjs` mặc định chỉ đọc, in đúng bốn mục như trên, dòng đầu là tên file đích
- [ ] Bảng không tồn tại → bỏ qua, báo trong bản in
- [ ] In nhắc gửi `/reauth` ở cuối
- [ ] `npm test` và `npm run typecheck` qua
- [ ] Nghiệm thu: chạy trên bản TEST mới tạo, người dùng đọc bản in và xác nhận danh sách hợp lý (đặc biệt các dòng ★)

## Comments
