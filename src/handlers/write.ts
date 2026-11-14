import { CATEGORIES, type CategoryKey, sheetName, tableName } from '../config';
import { logWrite, setLastWrite } from '../db';
import type { Env } from '../env';
import type { RowValues } from '../graph/sheet';
import { computeTotals } from '../graph/totals';
import { appendRow, fixDateFormat, readSheet } from '../graph/workbook';
import { toExcelSerial, vnToday } from '../parse/date';
import type { ParsedEntry } from '../parse/message';
import { sendMessage } from '../telegram/api';
import { confirmation } from '../telegram/format';
import { tidyTable } from './tidy';

export type ExactEntry = Omit<ParsedEntry, 'amount'> & {
  amount: number;
};

/**
 * Bảng và sheet nhận khoản: luôn là tháng của khoản (`date.m`), bất kể nguồn —
 * xem docs/adr/0002-khoan-nam-o-thang-tieu-khong-phai-thang-tra.md. Bản ghi cũ
 * trong hàng đợi ghi lại có thể còn mang `targetMonth`; trường đó bị bỏ qua.
 */
export function destinationOf(e: { category: CategoryKey; date: { m: number } }):
{ table: string; sheet: string } {
  return { table: tableName(e.category, e.date.m), sheet: sheetName(e.date.m) };
}

/**
 * Ba ô sẽ ghi vào Excel. Hàm thuần — không cần Env hay Graph để gọi.
 *
 * CHỖ DUY NHẤT ghép tiền tố nguồn (`[hsbc] `, `[vpb] `, `[spl] `, `[zlp] `) vào mô tả —
 * xem docs/adr/0001-tien-to-nguon-trong-cot-mo-ta.md.
 */
export function buildRow(e: ExactEntry): RowValues {
  const description = e.source ? `[${e.source}] ${e.description}` : e.description;
  return [description, toExcelSerial(e.date), e.amount];
}

export async function performWrite(
  env: Env, chatId: number, e: ExactEntry,
): Promise<void> {
  const { table, sheet } = destinationOf(e);
  // Bản ghi vào Excel và bản lưu để /undo đối chiếu PHẢI là cùng một mảng — dựng
  // hai lần thì một chỗ đổi mà quên chỗ kia sẽ khiến /undo xoá nhầm dòng.
  const values = buildRow(e);
  const [description, serial] = values;

  const index = await appendRow(env, table, values);

  // Vá định dạng và ghi D1 chạy song song với lệnh đọc: chúng không đụng tới
  // `values` nên không ảnh hưởng kết quả đọc, mà lại tiết kiệm được thời gian chờ.
  const [dest] = await Promise.all([
    readSheet(env, sheet),
    fixDateFormat(env, table, index),
    setLastWrite(env.DB, chatId, {
      sheet, tableName: table, rowIndex: index,
      valuesJson: JSON.stringify(values),
    }),
    logWrite(env.DB, {
      tableName: table, rowIndex: index,
      description, amount: e.amount, dateSerial: serial,
    }),
  ]);

  const label = CATEGORIES[e.category].label;
  // Tổng theo ngày CỦA KHOẢN VỪA GHI, không phải hôm nay — để con số hiện ra
  // luôn chứa khoản vừa ghi, kể cả khi ghi lùi ngày.
  const totals = computeTotals(dest, label, serial);

  const today = vnToday(Date.now());
  const isToday = today.y === e.date.y && today.m === e.date.m && today.d === e.date.d;

  await sendMessage(env, chatId, confirmation({ ...e, label }, totals, isToday));

  // Dọn SAU tin xác nhận và không bao giờ ném ra ngoài: ném ra là khoản bị đẩy vào hàng
  // đợi ghi lại và ghi trùng dù nó đã nằm trong Excel.
  await tidyTable(env, chatId, table);
}
