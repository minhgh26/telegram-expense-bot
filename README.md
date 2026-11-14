# Bot Telegram ghi chi tiêu vào Excel

Ghi một khoản chi tiêu vào đúng bảng trong `Theo dõi chi tiêu.xlsx` trên OneDrive
bằng một tin nhắn Telegram, kèm xác nhận có số liệu tổng trong dưới một giây.

```
/food ăn trưa 40k
```
```
✅ ăn trưa · 40.000đ · 08/08 → Ăn uống sinh hoạt

Ăn uống sinh hoạt (T8)      215.000đ
Hôm nay                      40.000đ
Tổng chi T8                2.415.000đ
```

**Đang chạy tại:** `https://telegram-expense-bot.minhgh.workers.dev`

---

## Cách dùng

```
/<lệnh>  [ngày]  <mô tả>  <số tiền>
```

Vị trí của ngày và mô tả linh hoạt — bot quét token, không đọc theo vị trí cứng.

### 9 lệnh ghi

| Lệnh | Nhóm | Lệnh | Nhóm |
|---|---|---|---|
| `/food` | Ăn uống sinh hoạt | `/other_expense` | Chi tiêu khác |
| `/eat_out` | Ăn ngoài | `/income` | Thu nhập |
| `/transport` | Phương tiện di chuyển | `/invest` | Đầu tư |
| `/force` | Chi tiêu bắt buộc | `/saving` | Tiết kiệm |
| `/other` | Linh tinh | | |

### Lệnh khác

`/undo` hoàn tác khoản gần nhất · `/today` chi tiêu hôm nay · `/thang` tổng tháng này
· `/reauth` cấp quyền lại OneDrive · `/help`

### Số tiền

| Gõ | Thành |
|---|---|
| `40k` `40K` `40n` | 40.000 |
| `1tr` `1m` | 1.000.000 |
| `1tr5` `1.5tr` | 1.500.000 |
| `40.000` `40000` | 40.000 |
| `40` (số trần ≤ 999) | 40.000 — nhân 1000 |
| `3000` (số trần 1000–9999) | **bot hỏi lại bằng nút** |
| `40000` (số trần ≥ 10000) | 40.000 — giữ nguyên |

Vùng 1000–9999 thật sự mơ hồ (`3000` có thể là gửi xe 3.000đ hoặc 3 triệu) nên bot
đưa hai nút để bạn chọn. **Không bấm gì thì không ghi gì.**

### Ngày

Bỏ trống = hôm nay · `hqua` · `hkia` · `5/8` (ngày/tháng) · `8/8/2026`

### Mã viết tắt

Đọc trực tiếp từ sheet `Note` (cột E = mã, cột F = tên đầy đủ). Thêm mã mới bằng cách
gõ thêm một dòng trong Excel — **không cần sửa code, không cần deploy lại**.

### Nguồn trả sau

Thêm một token vào tin nhắn, ở bất kỳ vị trí nào:

```
/food ăn trưa 40k vpb
```

| Token | Nguồn | Emoji |
|---|---|---|
| `hsbc` | Thẻ HSBC | 💳 |
| `vpb` | Thẻ VPBank | 🟢 |
| `spl` | SPayLater | 🛍️ |
| `zlp` | Ví trả sau ZaloPay | 🔵 |

Nguồn chỉ là **nhãn** cho biết khoản được trả bằng gì: nó không đổi khoản nằm ở tháng
nào. Mọi khoản — tiền mặt hay trả sau — nằm ở sheet của **tháng tiêu** (tháng của ngày
trong khoản), kể cả khoản quẹt cuối tháng 12. Dòng Excel mang tiền tố `[hsbc]` /
`[vpb]` / `[spl]` / `[zlp]` trong ô mô tả; không tiền tố nghĩa là tiền rời tài khoản
ngay. Tin xác nhận ghi nguồn bằng `emoji nhãn`, ví dụ `💳 Thẻ HSBC`.

Hệ quả: cuối kì ở sheet `Tóm tắt` là thu − tiêu luỹ kế theo tháng tiêu, **không phải số dư
ngân hàng**. Và **không ghi khoản trả nợ thẻ / trả sao kê**: món tiêu đã được ghi lúc quẹt,
ghi thêm lúc trả là tính hai lần. Lý do: [ADR-0002](docs/adr/0002-khoan-nam-o-thang-tieu-khong-phai-thang-tra.md).

`cc` (token cũ của thẻ HSBC) không còn là token: gõ `/food ăn trưa 40k cc` thì bot ghi
mô tả "ăn trưa cc" như một khoản tiền mặt, không cảnh báo.

Các token chỉ dùng cho 6 nhóm chi tiêu. Với `/income`, `/invest`, `/saving` thì bot từ chối.

Chỉ nhận đúng bốn chữ `hsbc` / `vpb` / `spl` / `zlp`, **không nhận `thẻ`, `ví`, `td`** — vì
`/other nạp thẻ 100k` là câu hoàn toàn bình thường để ghi nạp thẻ điện thoại.

Ngược lại, bốn chữ đó **luôn** bị bóc khỏi mô tả và hiểu là nguồn: `/force trả nợ hsbc 5tr`
sẽ ghi thành `[hsbc] trả nợ` như một khoản quẹt thẻ. Muốn nhắc tên ngân hàng trong mô tả
thì gõ đầy đủ (`VPBank`) hoặc viết khác đi. Mã viết tắt tên `HSBC` hay `VPB` trong sheet
`Note` cũng sẽ không bao giờ được bung.

---

## Cách hoạt động

```
📱 Telegram  ──webhook──▶  ⚡ Cloudflare Worker  ──Graph API──▶  📊 Excel trên OneDrive
                                    │
                                    └──▶  🗄️ Cloudflare D1
                                          refresh token · con trỏ undo
                                          khoản chờ · hàng đợi ghi lại
```

Không có bộ phận nào chạy trên máy cá nhân. Excel được ghi bởi chính engine của
Microsoft nên `SUBTOTAL` và sheet `Tóm tắt` tự tính lại — bot không đụng vào công thức.

Bảng đích suy ra trực tiếp: `/food` + ngày trong tháng 8 → bảng `food_8`.

**Bảng tự dọn.** Sau khi trả lời xác nhận, bot dọn bảng vừa nhận khoản: các khoản xếp theo
ngày tăng dần (cùng ngày giữ thứ tự ghi), dòng thiếu ngày nằm dưới, và đáy bảng luôn có
ít nhất một dòng trống để gõ tay. Bot chỉ thêm dòng trống, **không bao giờ xoá dòng nào**
khi dọn — dòng trống thừa thì bạn tự xoá tay. Chỉ bảng vừa ghi được dọn — bảng khác tự được dọn ở lần ghi
kế tiếp vào nó. Dọn lỗi thì bot gửi một tin `⚠️` riêng; khoản vẫn đã nằm trong file và không
bị ghi lại. `/undo` tìm khoản theo nội dung nên vẫn xoá đúng khoản dù nó đã đổi chỗ.

**Ghi một khoản = 3 lệnh gọi Graph:** thêm dòng, vá định dạng ô ngày, đọc tổng.
Bước vá định dạng là cần thiết — `rows/add` không kế thừa định dạng cột Ngày, không vá
thì ô hiện số serial thô `46242`. Xem `docs/SPIKE-RESULT.md`. Dọn bảng tốn thêm tối thiểu
hai lệnh (sắp + đọc), chạy sau tin xác nhận.

---

## Vận hành

### Việc bảo trì duy nhất

**Refresh token chết thì cấp lại ngay trong chat.** Bot báo `🔑 Hết hiệu lực xác thực`
thì gửi `/reauth`, bấm link, đăng nhập — bot tự lấy quyền về qua redirect, không cần gửi
lại `/reauth`. Không cần mở laptop. Chi tiết ở `docs/SETUP.md` mục 5.

Bot in ra refresh token mới — **chép vào `.dev.vars`**, vì D1 và `.dev.vars` dùng chung
một chuỗi token nên chạy `scripts/*.mjs` là làm token phía bot chết, và ngược lại.

App là public client thật (không có client secret nào trên Azure để mà hết hạn) — xem
`docs/SETUP.md` mục 1.

### Đừng mở file gốc bằng Excel desktop khi đang dùng bot

Excel desktop khoá file khi mở, Graph sẽ ghi thất bại. Khoản chi **không bị mất** —
bot đưa vào hàng đợi và cron thử lại mỗi 5 phút — nhưng bạn nhận `⏳ Đã nhận, đang ghi lại`
thay vì xác nhận ngay. Xem file thì dùng Excel Online hoặc app điện thoại.

### Sang năm 2027

File hiện tại là của năm 2026. Bot **từ chối** ghi ngày ngoài 2026 thay vì ghi nhầm
tháng. Khi có file 2027, đổi `WORKBOOK_YEAR` trong `src/config.ts` và `DRIVE_ITEM_ID`.

### Lệnh hay dùng

| Lệnh | Việc |
|---|---|
| `npm test` | 110 test đơn vị (parser, tính tổng, định dạng) |
| `npm run typecheck` | |
| `npm run deploy` | |
| `npm run tail` | xem log Worker thời gian thực |
| `node scripts/audit-real.mjs` | quét file gốc tìm dòng rác, kiểm công thức tổng hợp |
| `node scripts/where.mjs` | vị trí và link của file gốc / bản TEST |
| `node scripts/set-webhook.mjs` | xem trạng thái webhook |
| `node scripts/push-secrets.mjs --target=test\|real` | đổi file đích |

### Kiểm thử trên bản sao

Trước khi thay đổi gì đáng kể, nên trỏ bot vào bản sao thay vì file thật:

```bash
npm run spike:prepare                          # tạo bản sao TEST trên OneDrive
node scripts/push-secrets.mjs --target=test
npm run deploy
node scripts/smoke.mjs <url-worker>            # 15 phép kiểm end-to-end
```

Xong thì `node scripts/push-secrets.mjs --target=real && npm run deploy`, và
`npm run spike:cleanup` để xoá bản sao.

---

## Tài liệu

| File | Nội dung |
|---|---|
| `docs/superpowers/specs/2026-08-08-telegram-expense-bot-design.md` | Thiết kế: khảo sát file, ràng buộc, quyết định và lý do |
| `docs/superpowers/plans/2026-08-08-telegram-expense-bot.md` | Kế hoạch triển khai 14 task |
| `docs/SPIKE-RESULT.md` | Biên bản kiểm chứng `rows/add` không phá công thức |
| `docs/SETUP.md` | Các bước thiết lập thủ công (Azure, BotFather, webhook) |

### Ràng buộc quan trọng nhất của file Excel

Sheet `Tóm tắt` tổng hợp cả năm bằng **địa chỉ ô cố định** (`='Tháng 8'!N2`), không
phải bằng tên bảng. Mọi lần ghi đều chèn dòng, làm dịch chuyển hàng — nên trước khi
viết dòng code nào, `docs/SPIKE-RESULT.md` đã kiểm chứng rằng Excel tự điều chỉnh
tham chiếu và `Tóm tắt` vẫn đúng. Nếu sửa cách ghi, **chạy lại phép kiểm đó**.
