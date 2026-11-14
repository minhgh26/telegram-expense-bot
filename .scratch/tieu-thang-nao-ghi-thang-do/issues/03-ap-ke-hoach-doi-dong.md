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
- [x] Chạy lại `realign-months.mjs` (chỉ đọc) ngay sau `--apply` → mục dời và mục đổi `[cc]` rỗng
- [x] `node scripts/audit-real.mjs` không báo công thức `Tóm tắt` hỏng
- [x] Nghiệm thu bản TEST: người dùng mở bản TEST, đối chiếu vài dòng trong bản in của ticket 02 đã nằm đúng chỗ, không còn `[cc]`
- [x] Người dùng đồng ý → `--apply` trên file thật (người dùng không ghi khoản trong lúc chạy)
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

### 2026-11-14 — /mrs:deliver: implement → review → sửa (commit 755dc11, c6d02d3, chưa push)

**Cách tick tiêu chí 1–5.** Spec không cho test tự động luồng `--apply`, nên test chỉ phủ các hàm thuần
(`findOldRow`, `isSortedByDate`, `needsBlankRow`, `shouldRetry`, `isAmbiguousFailure` trong
`tests/realign-plan.test.ts`). Tiêu chí 1–5 được tick dựa trên đọc code: review độc lập (trục Spec) liệt kê
từng tiêu chí là đạt, kèm dòng code. Agent báo đã chạy thử với một Graph giả trong bộ nhớ (thành công;
DELETE trả 504; `rows/add` trả 504; bản đọc xáo thứ tự), nhưng bản giả không nằm trong repo.
Lần chạy trên bản TEST (tiêu chí 6 và 8) mới là bằng chứng thật cho 1–5.

**Review đã bắt và đã sửa ở c6d02d3:** bản đầu tự gửi lại DELETE theo chỉ số và `rows/add` khi Graph trả 5xx.
Nếu Graph đã xoá xong mà vẫn báo lỗi, lần gửi lại sẽ xoá nhầm dòng kế bên và báo "đã dời", cùng loại với lỗi 7d35edf.
Bản sửa không bao giờ gửi lại hai lệnh đó, và đọc lại đúng dòng (`itemAt`) trước mỗi lần xoá hoặc đổi mô tả.

**Giới hạn đã biết**
- Chưa kiểm trên Graph thật rằng `null` trong `values` khi PATCH được bỏ qua. Lần nghiệm thu TEST sẽ bắt được:
  dòng đổi mô tả phải giữ nguyên ngày, số tiền và công thức.
- Việc kiểm bản đọc cũ (số dòng + đọc lại `itemAt`) chỉ giảm rủi ro, không chặn tuyệt đối. Bản đọc `itemAt` cũng có thể
  cũ trên lý thuyết. Lần chạy lại chế độ chỉ đọc (tiêu chí 6) là bước phải bắt được chuyện này.
- Chạy chậm hơn: mỗi dòng đọc thêm, và chờ khoảng 1,5 giây khi bản đọc có vẻ cũ.
- Ghi chú bàn giao ở trên nói "outbox nên rỗng ... theo spec". Spec (bước 4) chỉ nói người dùng không gửi tin ghi khoản,
  không nhắc outbox.

**Cố ý để nguyên (từ review)**
- Code lặp và đặt tên chưa gọn ở chỗ không bị sửa: hai định nghĩa "dòng trống"; `ITEM`/`H` truyền đi cùng nhau; số cột và
  `'d-mmm'` viết cứng; file script ôm nhiều việc; bản JS chép từ `tidy-plan.ts`/`find-row.ts` chưa có test đối chiếu.
  Thời gian chờ là 1500 ms, khác 2000 ms của bot.
- Chuỗi không dấu ở hai dòng in cũ của script.
- Tự kiểm bảng đích đã có dòng đó chưa trước khi thêm lại: không làm, vì hai khoản giống hệt nhau là hợp lệ.
  Thay vào đó script in cảnh báo.
- Bước hỏi xác nhận trước khi ghi: không thêm, vì spec không đòi.
- Chặn outbox của bot trong lúc chạy: không làm, vì ngoài phạm vi ticket (xem dưới).

**Tiêu chí chưa đạt:** 6 (chạy lại chỉ đọc → mục dời và mục `[cc]` rỗng), 7 (`audit-real.mjs` sạch),
8 (nghiệm thu bản TEST), 9 (`--apply` trên file thật), 10 (`/reauth` + khoản thử + `/undo`). Cả năm đều cần người dùng chạy thật.

**Thuật ngữ thêm vào glossary:** không có.

**For the maintainer**
- Chạy trên bản TEST: `npm run spike:prepare` để `.dev.vars` trỏ vào bản TEST. Xem dòng "File đích: …" rồi mới để
  `node scripts/realign-months.mjs --apply` chạy tiếp (không có bước hỏi, Ctrl+C nếu sai). Sau đó chạy lại không có
  `--apply`, rồi `node scripts/audit-real.mjs`.
- Khi nghiệm thu bản TEST, kiểm thêm: dòng ★ và dòng đổi mô tả vẫn giữ ngày, số tiền và công thức gõ tay
  (xác nhận `null` khi PATCH).
- Mặc định cần xác nhận: `--apply` ghi ngay sau khi in kế hoạch, không hỏi lại.
- Mặc định cần xác nhận: khi có "Có thể trùng", phải xoá tay dòng trùng ở bảng đích trước khi chạy lại `--apply`.
- **Needs triage** (chưa tạo ticket): cho script từ chối chạy khi outbox của bot còn khoản xếp hàng. Lý do: trong khoảng
  1 giờ sau khi script xoay token, bot vẫn có thể ghi và sắp bảng giữa chừng. Có làm không, hay chỉ cần dặn
  "kiểm outbox rỗng trước khi chạy"?

### 2026-11-14 — chạy `--apply` trên bản TEST mới tạo

- Bản TEST tạo lại từ file thật (`spike:cleanup` rồi `spike:prepare`). `DRIVE_ITEM_ID` trỏ tạm vào TEST, chạy xong đã trả về file thật.
- Bản in trước khi chạy: dời 115 (★ 9) · đổi mô tả tại chỗ 0 · ở yên 13.
- `--apply`: đã dời 114 · đổi mô tả tại chỗ 0 · ở yên 13 · chưa đổi mô tả 0 · có thể trùng 1 · lỗi 0. Mã thoát 1, đúng vì có "có thể trùng".
- Dòng "có thể trùng" là `[hsbc] bạc xỉu M CK · 27/08 · 20.000`. Đã thêm vào `other_8`, nhưng lệnh xoá ở `other_9` bị Graph trả 500 `GenericFileOpenError`. Script không gửi lại lệnh xoá, nên không xoá nhầm dòng nào.
- Đọc lại thấy dòng này nằm ở cả `other_8` (index 42) và `other_9` (index 0): Graph thực sự **chưa** xoá.
- Chạy lại chế độ chỉ đọc: mục dời còn đúng 1 dòng (chính dòng trên), mục `[cc]` rỗng.
- `audit-real.mjs` (trên TEST): công thức `Tóm tắt` đúng, không có dòng rác.
- Người dùng đã xoá tay bản thừa ở `other_9`. Chạy lại chế độ chỉ đọc trên TEST: dời 0 · đổi mô tả tại chỗ 0 · ở yên 13. Tick tiêu chí 6 và 7 theo bản TEST; sẽ chạy lại cả hai sau lần chạy trên file thật.

### 2026-11-14 — chạy `--apply` trên file thật

- Người dùng xác nhận bản TEST ổn (tiêu chí 8), đã `/reauth`, rồi đồng ý chạy trên file thật.
- Bản in chỉ đọc trên `Theo dõi chi tiêu.xlsx` trước khi chạy giống hệt bản in của TEST: dời 115 (★ 9) · ở yên 13.
- `--apply`: đã dời 115 · đổi mô tả tại chỗ 0 · ở yên 13 · chưa đổi mô tả 0 · có thể trùng 0 · lỗi 0. Mã thoát 0. Dọn 25 bảng.
- Chạy lại chế độ chỉ đọc: dời 0 · đổi mô tả tại chỗ 0 · ở yên 13. `audit-real.mjs`: công thức `Tóm tắt` đúng, không có dòng rác. Tiêu chí 6 và 7 đạt cả trên file thật.
- Còn tiêu chí 10: người dùng gửi `/reauth` (script lại xoay token), gửi một khoản thử rồi `/undo`.
- Bản TEST (`Theo dõi chi tiêu - TEST.xlsx`) vẫn còn trên OneDrive; xoá bằng `npm run spike:cleanup` khi không cần nữa.
