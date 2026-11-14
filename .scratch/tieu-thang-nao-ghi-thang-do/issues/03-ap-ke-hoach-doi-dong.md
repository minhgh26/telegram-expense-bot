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

### 2026-11-14 — bàn giao (code xong, chưa chạy thật), sửa sau review

Gate: `npx tsc --noEmit` sạch, `npx vitest run` xanh. `--apply` không có test tự động (đúng spec); đã chạy thử với Graph giả trong bộ nhớ: đường thành công, DELETE trả 504, `rows/add` trả 504, bản đọc xáo thứ tự. Chưa chạy trên Graph thật.

- `node scripts/realign-months.mjs --apply`; không tham số vẫn chỉ đọc. Hàm thuần `findOldRow` / `isSortedByDate` / `needsBlankRow` / `shouldRetry` / `isAmbiguousFailure` ở `scripts/lib/realign-plan.mjs` (có test).

**Quyết định ticket không quy định (người dùng cần biết)**
- Trước khi xoá hoặc đổi mô tả, script đọc lại bảng, chỉ tin bản đọc có số dòng đúng như dự kiến, rồi đọc lại đúng dòng đó (`itemAt`) và so nội dung lần nữa. Trước khi THÊM vào đích cũng kiểm nguồn còn đó; không thấy thì không thêm, báo ở "Lỗi". Bản đọc không ổn định → KHÔNG xoá.
- Gặp 429 thì chờ và gửi lại. Gặp 5xx hoặc lỗi mạng: đọc/PATCH/sắp được gửi lại, nhưng DELETE và `rows/add` KHÔNG bao giờ gửi lại (có thể Graph đã làm rồi). Khi đó dòng vào "Có thể trùng (kiểm tay)", script đo lại số dòng bảng rồi đi tiếp. Tệ nhất: một dòng trùng ở bảng đích, hoặc một dòng nguồn chưa xoá.
- Đổi mô tả hỏng không phải "có thể trùng": nằm ở mục riêng "Chưa đổi mô tả" (dòng vẫn như cũ, chạy lại được), mã thoát vẫn khác 0.
- Báo cáo đếm mỗi dòng một lần: dòng năm khác đã đổi mô tả chỉ nằm ở "Ở yên" (in mô tả mới); "Đã đổi mô tả tại chỗ" chỉ gồm dòng của mục "Đổi [cc] → [hsbc] tại chỗ" như bản in kế hoạch.
- Đổi mô tả chỉ ghi ô mô tả (ngày và số tiền gửi `null` = giữ nguyên, kể cả công thức gõ tay). Chưa kiểm trên Graph thật rằng `null` trong `values` được bỏ qua như trong `numberFormat`: kiểm khi nghiệm thu bản TEST (dòng đổi mô tả vẫn giữ ngày/số tiền/công thức).
- Có "có thể trùng": xoá tay dòng trùng ở bảng đích TRƯỚC khi chạy lại `--apply` (script in cảnh báo). Chưa tự kiểm bảng đích đã có dòng đó chưa, vì hai khoản giống hệt hợp lệ.
- `--apply` in kế hoạch rồi ghi ngay trong cùng một lần chạy, không hỏi xác nhận; file đích chọn bằng `.dev.vars` (như spec). Kiểm dòng "File đích: …" trước khi chạy; Ctrl+C được nếu sai. Không thêm bước xác nhận vì spec không đòi.
- Chưa chặn bot ghi trong lúc chạy (lệnh outbox còn xếp hàng có thể ghi + sắp xếp bảng giữa chừng): theo spec, người dùng không gửi tin ghi khoản và outbox nên rỗng trước khi chạy.

**Còn lại cho người dùng:** tiêu chí 6 trở đi (chạy lại chỉ đọc, `audit-real.mjs`, `--apply` trên bản TEST, nghiệm thu, file thật, `/reauth`). Tiêu chí 6 và 7 tick theo lần chạy thật.
