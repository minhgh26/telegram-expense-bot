// Kế hoạch dời dòng — hàm thuần, không đụng Graph, không import gì từ src/
// (Node không tự phân giải import không đuôi của TS). Các hằng dưới đây là bản
// khai báo lại; nếu src/config.ts đổi thì sửa theo.

// src/config.ts: WORKBOOK_YEAR
export const WORKBOOK_YEAR = 2026;

// src/config.ts: CATEGORIES (9 nhóm)
export const GROUPS = [
  'food', 'eat_out', 'transport', 'force', 'other', 'other_expense',
  'income', 'invest', 'saving',
];

// 6 nhóm chi tiêu: các nhóm có thể mang tiền tố nguồn (src/parse/message.ts cấm
// token với income / invest / saving).
export const SPEND_GROUPS = ['food', 'eat_out', 'transport', 'force', 'other', 'other_expense'];

// src/config.ts: DEFERRED_SOURCES (4 tiền tố)
export const SOURCE_TOKENS = ['hsbc', 'vpb', 'spl', 'zlp'];

// src/parse/date.ts: EXCEL_EPOCH_MS
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);

/** Ngược của toExcelSerial. */
export function serialToDate(serial) {
  const t = new Date(EXCEL_EPOCH_MS + Math.floor(serial) * 86_400_000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

const CC_PREFIX = '[cc] ';
const HSBC_PREFIX = '[hsbc] ';

// "Dòng trống" = 3 ô mô tả, ngày, số tiền (CONTEXT.md; cùng nghĩa với tidy-plan.ts).
const isBlank = (row) => row.slice(0, 3).every((c) => c === '' || c == null);
const hasSource = (desc) => SOURCE_TOKENS.some((t) => desc.startsWith(`[${t}] `));

/**
 * @param {string} group  tên nhóm (food, eat_out, ...)
 * @param {number} sheetMonth  tháng của bảng đang quét
 * @param {unknown[][]} rows  các dòng của bảng: [mô tả, serial ngày, số tiền, ...]
 * @returns danh sách thay đổi: { index, oldValue, newValue, target, reason, starred, kind, descChanged }
 *   kind: 'move' (dời sang `target`) | 'retag' (đổi mô tả tại chỗ) | 'stay' (ở yên;
 *   vẫn có thể đổi mô tả tại chỗ).
 *   descChanged: true nếu ô mô tả của newValue khác oldValue.
 *   reason: 'off-month' | 'cc' | 'other-year' | 'no-date'.
 *   Dòng trống và dòng không cần gì thì không có trong kết quả.
 */
export function planSheet(group, sheetMonth, rows) {
  const out = [];
  rows.forEach((row, index) => {
    if (isBlank(row)) return;
    const [rawDesc, rawDate] = row;
    if (typeof rawDate !== 'number') {
      out.push({ index, oldValue: row, newValue: row, target: null, reason: 'no-date', starred: false, kind: 'stay', descChanged: false });
      return;
    }
    const date = serialToDate(rawDate);
    let desc = String(rawDesc ?? '');
    let changed = false;
    let starred = false;
    if (desc.startsWith(CC_PREFIX)) {
      desc = `${HSBC_PREFIX}${desc.slice(CC_PREFIX.length)}`;
      changed = true;
    }
    const sameYear = date.y === WORKBOOK_YEAR;
    const earlier = date.y < WORKBOOK_YEAR || (sameYear && date.m < sheetMonth);
    const misplaced = !sameYear || date.m !== sheetMonth;
    if (misplaced && earlier && SPEND_GROUPS.includes(group) && !hasSource(desc)) {
      desc = `${HSBC_PREFIX}${desc}`;
      changed = true;
      starred = true;
    }
    const newValue = changed ? [desc, ...row.slice(1)] : row;
    if (!sameYear) {
      out.push({ index, oldValue: row, newValue, target: null, reason: 'other-year', starred, descChanged: changed, kind: 'stay' });
    } else if (date.m !== sheetMonth) {
      out.push({ index, oldValue: row, newValue, target: `${group}_${date.m}`, reason: 'off-month', starred, descChanged: changed, kind: 'move' });
    } else if (changed) {
      out.push({ index, oldValue: row, newValue, target: null, reason: 'cc', starred, descChanged: changed, kind: 'retag' });
    }
  });
  return out;
}
