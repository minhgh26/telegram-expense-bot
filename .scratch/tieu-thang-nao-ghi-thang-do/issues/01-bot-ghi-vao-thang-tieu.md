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

**Status:** ready-for-human

- [x] Tháng ghi = tháng của ngày khoản, với mọi nguồn và không nguồn
- [x] Bỏ `src/billing.ts`, `tests/billing.test.ts`, `cutoffDayFor`, `defaultCutoffDay(s)`
- [x] `NoteConfig` chỉ còn bảng mã viết tắt; bỏ đọc khối `H`–`I`
- [x] Bỏ `carryOverRefusal` và nhánh từ chối tháng 12; kiểm năm ngoài `WORKBOOK_YEAR` giữ nguyên
- [x] `targetMonth` bỏ khỏi `ExactEntry`; hàng đợi ghi lại và khoản mơ hồ bỏ qua `targetMonth` cũ trong payload
- [x] `performWrite` chỉ đọc một sheet
- [x] `/today` chỉ đọc sheet tháng hôm nay; comment ở `/thang` sửa đúng nghĩa mới
- [x] Tin xác nhận: dòng nguồn là `emoji nhãn`; không nguồn thì không có dòng đó
- [x] `/help`: bốn token kèm emoji và nhãn, không còn chữ "chốt"
- [x] Luật token không đổi (bóc khỏi mô tả, cấm với `/income` `/invest` `/saving`, hai token là lỗi)
- [x] `legacySource` giữ nguyên; comment `LEGACY_HSBC_TOKEN` sửa cho đúng
- [x] Test: `routing`, `note`, `format` viết lại theo `../spec.md` mục Testing
- [x] Script `setup-note`, `check-note`, `verify-card` gỡ phần mốc chốt (xoá script chỉ để kiểm mốc chốt, kèm mục `package.json`)
- [x] `README.md` mục "Nguồn trả sau" viết lại theo spec, thêm câu "không ghi khoản trả nợ thẻ"
- [x] `npm test` và `npm run typecheck` qua
- [ ] Nghiệm thu: deploy lên bot thật; người dùng gửi một khoản có `hsbc` mang ngày sau ngày 7 của tháng này, mở Excel thấy nó ở sheet tháng này; tin xác nhận ra `💳 Thẻ HSBC`

## Comments

### 2026-11-14 — /mrs:deliver

Commit trên `feat/tieu-thang-nao-ghi-thang-do` (chưa push): `d9eb7ff`, `12b43cf`, `c8c4c0f`; mốc so sánh `8ff8df2`. Gate chạy lại tay: `npm test` 280/280, `npm run typecheck` sạch, `node --check` qua mọi script trong `scripts/`.

**Quyết định ticket không quy định**
- Tháng đích của bảng chỉ tính ở một hàm `destinationOf` (`src/handlers/write.ts`); `performWrite` và `tests/routing.test.ts` cùng dùng nó.
- Payload cũ (hàng đợi ghi lại, khoản chờ nút số tiền) đọc qua một hàm `decodeStoredEntry` đặt cạnh `legacySource` trong `src/parse/message.ts`: bỏ `targetMonth`, `isCard`, đổi `cc` → `hsbc`. Có test đưa payload JSON mang `targetMonth: 9` vào và thấy khoản rơi vào `food_8`.
- `scripts/verify-card.mjs` bị xoá, nhưng hai kiểm tra không dính mốc chốt của nó (`/other TC 15k` → "TocoToco", `/income … hsbc` bị từ chối) chuyển sang `scripts/smoke.mjs` thành kiểm tra 13–15. `scripts/setup-note.mjs` và mục `setup:note` cũng bị xoá vì script đó chỉ ghi khối H–I.
- README giữ câu "`cc` không còn là token…" (mô tả hành vi hiện tại, không phải đoạn `[cc]` cũ về dòng cũ). Bỏ con số "110 test" khỏi bảng lệnh. Ví dụ bóc token đổi từ `/force trả nợ hsbc 5tr` sang `/force ăn tối hsbc 500k`, vì README giờ dặn không ghi khoản trả nợ thẻ.
- Không sửa ADR, CONTEXT.md. Không thêm thuật ngữ mới.

**Giới hạn đã biết** (ticket 02/03 sẽ xử lý)
- Dòng cũ đã nằm sai tháng trong Excel vẫn nằm sai tháng cho tới khi chạy công cụ đổi dòng.
- Từ lúc deploy tới lúc chạy ticket 03: `/today` và dòng "Hôm nay" chỉ đọc sheet tháng hôm nay, nên khoản ngày hôm nay đã bị ghi sang sheet tháng sau theo quy tắc cũ sẽ không được cộng (ví dụ: khoản `hsbc` sau ngày 7/11 đang nằm ở `Tháng 12`).
- Comment `LEGACY_HSBC_TOKEN` trong `src/config.ts` nói dòng `[cc]` "đã được đổi" — đúng theo spec, nhưng chỉ đúng sau ticket 03.
- Khoản đang nằm trong hàng đợi hoặc chờ nút lúc deploy sẽ được ghi vào tháng tiêu, không báo người dùng (đúng ý spec).

**Review: để nguyên có chủ ý**
- Tên `destinationOf` / "bảng đích" dùng chữ "đích" cho bảng (CONTEXT.md chỉ tránh "tháng đích").
- Quy tắc `date.m` xuất hiện ở cả `destinationOf` và nhãn tháng trong `confirmation` (spec nói mọi chỗ lấy `date.m`).
- Có sẵn từ trước: `/today` đòi dòng có mô tả mới cộng, còn `sumDay` (dòng "Hôm nay" trong tin xác nhận) thì không — dòng có tiền mà không có mô tả làm hai con số lệch nhau.
- Có sẵn từ trước: `askAmount` nhận `low`/`high` thừa; định dạng `dd/mm` và chuỗi `'Tổng chi'` lặp ở `query.ts`; README trỏ tới `docs/superpowers/...` không tồn tại.

**Tiêu chí chưa đạt:** "Nghiệm thu" — cần deploy và người dùng kiểm tay.

**For the maintainer**
- Deploy rồi làm bước nghiệm thu: gửi một khoản `hsbc` mang ngày sau ngày 7 tháng này, mở Excel thấy nó ở sheet tháng này, tin xác nhận ra `💳 Thẻ HSBC`. Xong thì tick tiêu chí cuối và đóng ticket.
- Trước khi chạy `scripts/smoke.mjs`: file TEST phải có mã `TC` = `TocoToco` trong sheet `Note`, nếu không kiểm tra 13 sẽ báo FAIL. Script chưa được chạy lần nào sau khi sửa.
- Xác nhận các mặc định: xoá `verify-card.mjs` nhưng chuyển hai kiểm tra sang `smoke.mjs`; giữ câu về `cc` trong README.
- Nên deploy ticket này sát lúc chạy ticket 03, để khoảng `/today` thiếu khoản nói ở trên ngắn nhất.
- **Needs triage:** cho `/today` và dòng "Hôm nay" dùng chung một quy tắc cộng (có cần mô tả hay không). Chưa lập ticket.
