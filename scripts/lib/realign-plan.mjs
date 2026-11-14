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

/**
 * Tìm dòng nguồn theo NỘI DUNG CŨ trong bản đọc mới (cùng quy tắc src/graph/find-row.ts:
 * mô tả so chuỗi; ngày và số tiền so chặt theo kiểu). Nhiều dòng giống hệt → dòng dưới
 * cùng. Không bao giờ dùng chỉ số trong kế hoạch: Graph có lúc trả bản đọc cũ (7d35edf).
 * @returns chỉ số trong `rows`, hoặc null nếu không thấy.
 */
export function findOldRow(rows, oldValue) {
  const [desc, serial, amount] = oldValue;
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    if (!row) continue;
    if (String(row[0] ?? '') === String(desc ?? '') && row[1] === serial && row[2] === amount) return i;
  }
  return null;
}

// Bản JS của src/graph/tidy-plan.ts (cùng quy tắc; sửa một bên thì sửa bên kia).
const isEmpty = (v) => v === '' || v === null || v === undefined;
const isBlankRow = (row) => row.slice(0, 3).every(isEmpty);

/** Ngày tăng dần, dòng không ngày nằm dưới mọi dòng có ngày. */
export function isSortedByDate(rows) {
  let previous = -Infinity;
  let seenUndated = false;
  for (const row of rows) {
    const date = row[1];
    if (typeof date !== 'number') { seenUndated = true; continue; }
    if (seenUndated || date < previous) return false;
    previous = date;
  }
  return true;
}

/** Đáy bảng (đã sắp) chưa có dòng trống. Dọn bảng chỉ THÊM dòng, không xoá. */
export function needsBlankRow(rows) {
  const last = rows[rows.length - 1];
  return !last || !isBlankRow(last);
}

/**
 * Có gửi lại yêu cầu HTTP không. 429 = Graph chưa làm gì → luôn gửi lại được. 5xx có thể là
 * "đã áp dụng nhưng trả lời lỗi" (xem .scratch/ghi-trung): chỉ gửi lại lệnh LẶP ĐƯỢC (đọc,
 * PATCH giá trị cố định, sắp). DELETE theo chỉ số và rows/add thì KHÔNG: gửi lại là xoá nhầm
 * dòng kế bên hoặc thêm bản thứ hai.
 */
export function shouldRetry({ status, idempotent, attempt, max = 4 }) {
  if (attempt >= max) return false;
  if (status === 429) return true;
  return status >= 500 && idempotent;
}

/** Lệnh ghi lỗi mà Graph CÓ THỂ đã áp dụng (lỗi mạng / 5xx). 4xx và 429 thì chắc chắn chưa. */
export function isAmbiguousFailure(err) {
  const status = err?.status;
  return status === undefined || status >= 500;
}
