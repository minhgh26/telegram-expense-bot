# Khoản nằm ở tháng tiêu, không phải tháng tiền rời tài khoản

Trước đây khoản trả bằng nguồn trả sau, nếu tiêu sau ngày chốt sao kê của nguồn đó, được
ghi sang sheet tháng sau — để dòng tiền chạy liên tục ở sheet `Tóm tắt` (cuối kì = đầu kì
+ thu − chi − đầu tư, nối tháng này sang tháng sau) khớp số dư ngân hàng thật. Bỏ quy tắc
đó: mọi khoản nằm ở sheet của tháng tiêu, nguồn chỉ còn là nhãn. Lý do: với bốn nguồn,
mỗi nguồn một ngày chốt, đọc file không còn trả lời được câu "tháng này tôi tiêu bao
nhiêu", và khoản quẹt cuối tháng 12 phải chép tay sang file năm sau.

## Consequences

- **Cuối kì trong `Tóm tắt` không còn là số dư ngân hàng.** Nó là thu − tiêu luỹ kế theo
  tháng tiêu. Muốn đối chiếu số dư thật thì phải xem sao kê, không xem file.
- **Không được ghi khoản trả nợ thẻ / trả sao kê.** Món tiêu đã được ghi lúc quẹt; ghi
  thêm lúc trả là tính hai lần.
- Ngày chốt sao kê không còn ý nghĩa với bot. Khối `H`–`I` của sheet `Note` bot không
  đọc nữa.
- Dữ liệu cũ đã được **dời một lần** về đúng tháng tiêu (mọi khoản lệch tháng, kể cả dòng
  gõ tay); dòng lệch tháng không tiền tố được gắn `[hsbc]` vì thời đó chỉ thẻ HSBC mới
  bị dời tháng. Quay lại quy tắc cũ không chỉ là đổi code — phải dời dữ liệu ngược lại,
  mà thông tin ngày chốt tại thời điểm tiêu thì không còn lưu ở đâu.
- Tổng chi và cuối kì của các tháng đã qua thay đổi sau lần dời này.
