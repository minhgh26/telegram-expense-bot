export const WORKBOOK_YEAR = 2026;
export const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** 9 lệnh ghi. Khoá = lệnh (không có dấu /). Nguồn: sheet Note cột J–K. */
export const CATEGORIES = {
  food:          { table: 'food',          label: 'Ăn uống sinh hoạt' },
  eat_out:       { table: 'eat_out',       label: 'Ăn ngoài' },
  transport:     { table: 'transport',     label: 'Phương tiện di chuyển' },
  force:         { table: 'force',         label: 'Chi tiêu bắt buộc' },
  other:         { table: 'other',         label: 'Linh tinh' },
  other_expense: { table: 'other_expense', label: 'Chi tiêu khác' },
  income:        { table: 'income',        label: 'Thu nhập' },
  invest:        { table: 'invest',        label: 'Đầu tư' },
  saving:        { table: 'saving',        label: 'Tiết kiệm' },
} as const;

export type CategoryKey = keyof typeof CATEGORIES;

export const isCategory = (s: string): s is CategoryKey =>
  Object.prototype.hasOwnProperty.call(CATEGORIES, s);

/**
 * Tập đóng nguồn trả sau. Khoá = token gõ trong tin nhắn, cũng là tiền tố ghép
 * vào ô mô tả khi ghi (xem `buildRow` ở src/handlers/write.ts).
 *
 * Nguồn chỉ là nhãn: nó không ảnh hưởng khoản nằm ở tháng nào (ADR-0002).
 */
export const DEFERRED_SOURCES = {
  hsbc: { label: 'Thẻ HSBC',           emoji: '💳' },
  vpb:  { label: 'Thẻ VPBank',         emoji: '🟢' },
  spl:  { label: 'SPayLater',          emoji: '🛍️' },
  zlp:  { label: 'Ví trả sau ZaloPay', emoji: '🔵' },
} as const;

/**
 * Token cũ của thẻ HSBC, chỉ còn phục vụ `legacySource` (src/parse/message.ts) đọc
 * các khoản trong hàng đợi ghi lại / khoản mơ hồ chờ nút lưu trước khi đổi token.
 * Các dòng `[cc]` trong file đã được đổi thành `[hsbc]`; `cc` không còn là token —
 * gõ vào tin nhắn thì nó là chữ thường trong mô tả.
 */
export const LEGACY_HSBC_TOKEN = 'cc';

/**
 * `null` (không phải thành viên của kiểu này) nghĩa là tiền rời tài khoản
 * ngay — xem CONTEXT.md, mục "Nguồn trả sau".
 */
export type DeferredSource = keyof typeof DEFERRED_SOURCES;

export const isDeferredSource = (s: string): s is DeferredSource =>
  Object.prototype.hasOwnProperty.call(DEFERRED_SOURCES, s);

export const sheetName = (month: number) => `Tháng ${month}`;
export const tableName = (cat: CategoryKey, month: number) =>
  `${CATEGORIES[cat].table}_${month}`;
