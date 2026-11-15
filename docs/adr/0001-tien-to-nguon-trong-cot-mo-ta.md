# Ghi nguồn trả sau bằng tiền tố trong cột mô tả

File Excel cần cho biết khoản nào trả bằng nguồn trả sau nào. Chọn ghép tiền tố
`[hsbc]` / `[vpb]` / `[spl]` / `[zlp]` vào đầu ô mô tả thay vì thêm một cột thứ tư, vì
cột thứ tư đụng cấu trúc **mọi** bảng trong workbook — `appendRow`, các phép đọc tổng
theo khối cột, và bước đối chiếu dòng của `/undo` — còn tiền tố thì không đụng gì: bảng
vẫn ba cột như trước.

## Consequences

- Nguồn là **chữ nằm trong mô tả, không phải dữ liệu**. Không lọc, không PivotTable,
  không tính tổng theo nguồn được. Ngày nào cần những thứ đó thì phải quay lại cột
  thứ tư — và quyết định này không giúp gì cho việc đó.
- Tiền tố ghép ở **đúng một chỗ, lúc ghi**. Mô tả người dùng gõ không bao giờ mang
  tiền tố, nên không đường phát lại nào — hàng đợi ghi lại, khoản mơ hồ chờ trả lời
  — có thể ghép hai lần.
- Dòng ghi **trước** quyết định này không có tiền tố. Dấu vết duy nhất của khoản thẻ
  thời đó là việc nó lệch tháng; ADR-0002 dùng đúng dấu vết ấy để gắn `[hsbc]` một
  lần trước khi dời dòng về đúng tháng. Ngoài trường hợp đó, không backfill được.
- "Không tiền tố" buộc phải mang nghĩa "tiền rời tài khoản ngay". Nếu sau này cần
  phân biệt tiền mặt với thẻ debit thì quy ước này hết chỗ chứa.
- Thẻ HSBC từng dùng token `cc`. Token đó đã nghỉ hưu và mọi `[cc]` trong file được
  đổi thành `[hsbc]`, để mỗi nguồn chỉ có đúng một tiền tố.
