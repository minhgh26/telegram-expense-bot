# 03: Công cụ dời dòng — áp kế hoạch (`--apply`)

**What to build:** `node scripts/realign-months.mjs --apply` thực hiện đúng kế hoạch mà ticket 02
in ra: dời khoản lệch tháng về bảng của tháng tiêu, đổi `[cc]` → `[hsbc]`, gắn `[hsbc]` cho dòng
★, xoá dòng ở bảng cũ, rồi dọn các bảng đã nhận dòng. Mở Excel ra: không còn dòng `[cc]` nào,
không còn dòng nào có ngày khác tháng của sheet (trừ mục "ở yên"), mỗi bảng nhận dòng xếp theo
ngày và đáy có dòng trống.

Ràng buộc **không được làm mất dòng**:

- Thêm vào bảng đích **trước**, xoá ở bảng nguồn **sau**.
- Xoá theo chỉ số tìm được bằng cách **đọc lại** bảng nguồn và so **nội dung cũ** — không bao giờ
  xoá theo chỉ số trong kế hoạch. Graph có lúc trả bản đọc cũ; đó chính là lỗi đã xoá mất khoản
  160k ngày 04/10 (commit 7d35edf).
- Không tìm thấy dòng cũ → không xoá, đưa vào mục "có thể trùng" của báo cáo cuối, mã thoát ≠ 0.
- Đổi mô tả tại chỗ: đọc lại dòng, khớp nội dung cũ mới `PATCH`.
- Dọn bảng sau khi dời: chỉ sắp và thêm dòng trống, không xoá dòng nào.

Chi tiết ở `../spec.md` mục "Công cụ dời dòng" và "Thứ tự triển khai".

**Blocked by:** 01 — deploy trước để bot không tạo thêm khoản lệch tháng trong lúc dời; 02 — dùng chung hàm kế hoạch

**Status:** ready-for-agent

- [x] `--apply` chạy tuần tự từng dòng, đúng thứ tự thêm → vá định dạng ngày → đọc lại → xoá
- [x] Dòng vừa dời vừa đổi mô tả: dời với mô tả mới trong một bước
- [x] Đổi mô tả tại chỗ có kiểm nội dung trước khi `PATCH`
- [x] Dọn mỗi bảng đã nhận dòng (sắp theo ngày + thêm dòng trống nếu đáy chưa có), không xoá dòng
- [x] Báo cáo cuối: số dòng đã dời / đổi mô tả / ở yên / có thể trùng, kèm danh sách; mã thoát ≠ 0 nếu có "có thể trùng" hoặc lỗi
- [ ] Chạy lại `realign-months.mjs` (chỉ đọc) ngay sau `--apply` → mục dời và mục đổi `[cc]` rỗng
- [ ] `node scripts/audit-real.mjs` không báo công thức `Tóm tắt` hỏng
- [ ] Nghiệm thu bản TEST: người dùng mở bản TEST, đối chiếu vài dòng trong bản in của ticket 02 đã nằm đúng chỗ, không còn `[cc]`
- [ ] Người dùng đồng ý → `--apply` trên file thật (người dùng không ghi khoản trong lúc chạy)
- [ ] Người dùng gửi `/reauth`; gửi một khoản thử và `/undo` để chắc bot ghi lại bình thường

## Comments

### Bàn giao (code xong, chưa chạy thật)

- `node scripts/realign-months.mjs --apply`; không tham số vẫn chỉ đọc. Hàm thuần `findOldRow` / `isSortedByDate` / `needsBlankRow` ở `scripts/lib/realign-plan.mjs` (có test).
- Thêm một lớp an toàn: bản đọc nguồn chỉ được tin khi số dòng bằng số dự kiến (script tự theo dõi); bản đọc cũ → thử lại, vẫn không ổn định thì KHÔNG xoá, vào "có thể trùng".
- Đã chạy thử với Graph giả trong bộ nhớ (dời + `[cc]` + ★ + dọn): đúng. Chưa chạy trên Graph thật.
- Còn lại cho người dùng: tiêu chí 7 trở đi (chạy `--apply` trên bản TEST, nghiệm thu, file thật, `/reauth`). Tiêu chí 6 (chạy lại chỉ đọc) và 7 (`audit-real.mjs`) tick theo lần chạy thật.
