# 01: Bot ghi khoản vào tháng tiêu, nguồn chỉ còn là nhãn

**What to build:** Ngày 20/8 người dùng gửi `/food ăn trưa 40k hsbc`. Dòng
`[hsbc] ăn trưa · 20/08 · 40.000` vào bảng `food_8` (không phải `food_9`), và bot trả lời:

```
✅ ăn trưa · 40.000đ · 20/08 → Ăn uống sinh hoạt
💳 Thẻ HSBC

Ăn uống sinh hoạt (T8)   ...
Hôm nay                  ...
Tổng chi T8              ...
```

Ngày 30/12 gửi `/food quà 500k spl` → ghi vào `food_12`, không còn bị từ chối. Ngày chốt
sao kê bỏ hẳn: bot không đọc khối `H`–`I` của sheet `Note`, `/help` không in ngày chốt.
Xem `../spec.md` mục "Bot" và `docs/adr/0002-khoan-nam-o-thang-tieu-khong-phai-thang-tra.md`.

Một ràng buộc dễ sai: khoản đang nằm trong hàng đợi ghi lại hoặc đang chờ nút số tiền lúc
deploy có thể còn mang `targetMonth` theo quy tắc cũ. **Bỏ qua trường đó**, lấy tháng từ ngày.

**Blocked by:** —

**Status:** ready-for-agent

- [ ] Tháng ghi = tháng của ngày khoản, với mọi nguồn và không nguồn
- [ ] Bỏ `src/billing.ts`, `tests/billing.test.ts`, `cutoffDayFor`, `defaultCutoffDay(s)`
- [ ] `NoteConfig` chỉ còn bảng mã viết tắt; bỏ đọc khối `H`–`I`
- [ ] Bỏ `carryOverRefusal` và nhánh từ chối tháng 12; kiểm năm ngoài `WORKBOOK_YEAR` giữ nguyên
- [ ] `targetMonth` bỏ khỏi `ExactEntry`; hàng đợi ghi lại và khoản mơ hồ bỏ qua `targetMonth` cũ trong payload
- [ ] `performWrite` chỉ đọc một sheet
- [ ] `/today` chỉ đọc sheet tháng hôm nay; comment ở `/thang` sửa đúng nghĩa mới
- [ ] Tin xác nhận: dòng nguồn là `emoji nhãn`; không nguồn thì không có dòng đó
- [ ] `/help`: bốn token kèm emoji và nhãn, không còn chữ "chốt"
- [ ] Luật token không đổi (bóc khỏi mô tả, cấm với `/income` `/invest` `/saving`, hai token là lỗi)
- [ ] `legacySource` giữ nguyên; comment `LEGACY_HSBC_TOKEN` sửa cho đúng
- [ ] Test: `routing`, `note`, `format` viết lại theo `../spec.md` mục Testing
- [ ] Script `setup-note`, `check-note`, `verify-card` gỡ phần mốc chốt (xoá script chỉ để kiểm mốc chốt, kèm mục `package.json`)
- [ ] `README.md` mục "Nguồn trả sau" viết lại theo spec, thêm câu "không ghi khoản trả nợ thẻ"
- [ ] `npm test` và `npm run typecheck` qua
- [ ] Nghiệm thu: deploy lên bot thật; người dùng gửi một khoản có `hsbc` mang ngày sau ngày 7 của tháng này, mở Excel thấy nó ở sheet tháng này; tin xác nhận ra `💳 Thẻ HSBC`

## Comments
