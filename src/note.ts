import type { Env } from './env';
import { type SheetData, cellAt, colOffset } from './graph/sheet';
import { readRange } from './graph/workbook';

export interface NoteConfig {
  /** Mã viết tắt → tên đầy đủ. Nguồn: cột E–F của sheet Note */
  shortcodes: Record<string, string>;
}

/** Note là sheet cấu hình, không dài ra — vùng cố định là đủ và giữ chỉ số ổn định. */
const NOTE_RANGE = 'A1:Z50';

/** Chỉ số cột TUYỆT ĐỐI. */
const CODE_COL = 4;   // E
const FULL_COL = 5;   // F

function readShortcodes(sheet: SheetData, off: number): Record<string, string> {
  const shortcodes: Record<string, string> = {};
  for (const row of sheet.values) {
    const code = cellAt(row, CODE_COL, off);
    const full = cellAt(row, FULL_COL, off);
    if (typeof code === 'string' && typeof full === 'string' && code.trim() && full.trim()) {
      shortcodes[code.trim().toUpperCase()] = full.trim();
    }
  }
  return shortcodes;
}

/**
 * Tách cấu hình từ sheet Note. Bảng mã viết tắt quét theo cột nên đọc được ở
 * bất kỳ vùng nào — xem `colOffset`. Khối H–I (ngày chốt cũ) bot không đọc nữa.
 */
export function parseNote(sheet: SheetData): NoteConfig {
  const off = colOffset(sheet.address);
  return { shortcodes: readShortcodes(sheet, off) };
}

/**
 * Cache ở phạm vi module. Isolate của Worker sống qua nhiều request nên phần lớn
 * tin nhắn dùng lại được — bảng mã viết tắt về cùng một lệnh gọi.
 */
let cache: { at: number; data: NoteConfig } | null = null;
const TTL_MS = 10 * 60 * 1000;

export async function loadNote(env: Env): Promise<NoteConfig> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  try {
    const data = parseNote(await readRange(env, 'Note', NOTE_RANGE));
    cache = { at: Date.now(), data };
    return data;
  } catch {
    // Không đọc được thì vẫn phải ghi được chi tiêu: bỏ bung mã.
    return cache?.data ?? { shortcodes: {} };
  }
}
