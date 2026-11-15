import { describe, expect, it } from 'vitest';
import { buildRow, destinationOf, type ExactEntry } from '../src/handlers/write';
import { decodeStoredEntry, parseMessage } from '../src/parse/message';

/**
 * Nối cả chuỗi quyết định lại: chữ người dùng gõ → bảng Excel nhận dòng.
 *
 * Mọi khoản nằm ở sheet của tháng của khoản (tháng của ngày tiêu), bất kể nguồn
 * — xem docs/adr/0002-khoan-nam-o-thang-tieu-khong-phai-thang-tra.md. Cả chuỗi
 * là hàm thuần nên kiểm được mà không cần dựng Env hay giả lập Graph.
 */
const NOW = Date.UTC(2026, 7, 10, 5, 0); // 12:00 ngày 10/08/2026 giờ VN

interface Destination { table: string; sheet: string; description: string }

// Ô mô tả đọc qua `buildRow` — chính hàm hàng ghi thật gọi — và bảng đích qua
// `destinationOf` — chính hàm `performWrite` gọi.
const destination = (text: string): Destination => {
  const parsed = parseMessage(text, NOW, {});
  if (!parsed.ok) throw new Error(`không phân tích được: ${parsed.error}`);
  if (parsed.entry.amount.kind !== 'exact') throw new Error('seam này không xử lý số tiền mơ hồ');
  const exact: ExactEntry = { ...parsed.entry, amount: parsed.entry.amount.amount };
  const [description] = buildRow(exact);
  return { ...destinationOf(exact), description: String(description) };
};

describe('từ tin nhắn tới bảng đích', () => {
  it('tiền mặt ngày 10/8 → bảng tháng 8', () =>
    expect(destination('/food ăn trưa 40k'))
      .toEqual({ table: 'food_8', sheet: 'Tháng 8', description: 'ăn trưa' }));

  it('thẻ HSBC ngày 10/8 (sau ngày chốt cũ 7) → vẫn bảng tháng 8, mô tả mang [hsbc]', () =>
    expect(destination('/food ăn trưa 40k hsbc'))
      .toMatchObject({ table: 'food_8', description: '[hsbc] ăn trưa' }));

  it.each(['hsbc', 'vpb', 'spl', 'zlp'] as const)(
    'ghi lùi ngày sang tháng trước: 10/7 → bảng tháng 7, nguồn %s',
    (source) => expect(destination(`/food ăn trưa 40k 10/7 ${source}`))
      .toMatchObject({ table: 'food_7', description: `[${source}] ăn trưa` }),
  );

  it('ghi lùi ngày sang tháng trước: 10/7 → bảng tháng 7, không nguồn', () =>
    expect(destination('/food ăn trưa 40k 10/7'))
      .toMatchObject({ table: 'food_7', description: 'ăn trưa' }));

  it('nhóm khác cũng đi theo cùng quy tắc', () =>
    expect(destination('/transport grab 55k hsbc'))
      .toMatchObject({ table: 'transport_8', description: '[hsbc] grab' }));

  it('token nguồn đứng ở vị trí nào trong câu cũng cho cùng kết quả', () => {
    expect(destination('/food hsbc ăn trưa 40k'))
      .toMatchObject({ table: 'food_8', description: '[hsbc] ăn trưa' });
    expect(destination('/food ăn hsbc trưa 40k'))
      .toMatchObject({ table: 'food_8', description: '[hsbc] ăn trưa' });
  });
});

describe.each([
  ['hsbc', 7], ['vpb', 26], ['spl', 24], ['zlp', 28],
] as const)('nguồn %s: tháng không phụ thuộc ngày chốt cũ (%i)', (source, oldCutoff) => {
  it('đúng ngày chốt cũ → bảng tháng 8, đúng tiền tố', () =>
    expect(destination(`/food test 40k ${oldCutoff}/8 ${source}`))
      .toMatchObject({ table: 'food_8', description: `[${source}] test` }));

  it('sau ngày chốt cũ → vẫn bảng tháng 8', () =>
    expect(destination(`/food test 40k ${oldCutoff + 1}/8 ${source}`))
      .toMatchObject({ table: 'food_8', description: `[${source}] test` }));

  it('cuối tháng 12 sau ngày chốt cũ → bảng tháng 12, không bị từ chối', () =>
    expect(destination(`/food test 40k ${oldCutoff + 1}/12 ${source}`))
      .toMatchObject({ table: 'food_12', sheet: 'Tháng 12', description: `[${source}] test` }));
});

describe('cc cũ', () => {
  it('giờ là chữ thường: ngày 10/8 ở bảng tháng 8, không tiền tố', () =>
    expect(destination('/food ăn trưa 40k cc'))
      .toMatchObject({ table: 'food_8', description: 'ăn trưa cc' }));
});

describe('khoản trong hàng đợi / chờ nút mang targetMonth cũ', () => {
  it('bảng đích lấy từ ngày, bỏ qua targetMonth và isCard trong payload', () => {
    const stale = JSON.stringify({
      category: 'food', description: 'x', amount: 1, isCard: true,
      date: { y: 2026, m: 8, d: 10 }, targetMonth: 9,
    });
    const entry = decodeStoredEntry<ExactEntry>(stale);
    expect(entry).not.toHaveProperty('targetMonth');
    expect(entry).not.toHaveProperty('isCard');
    expect(entry.source).toBe('hsbc');
    expect(destinationOf(entry)).toEqual({ table: 'food_8', sheet: 'Tháng 8' });
  });

  it('source: "cc" cũ được đọc thành hsbc', () =>
    expect(decodeStoredEntry<ExactEntry>(JSON.stringify({
      category: 'food', description: 'x', amount: 1, source: 'cc',
      date: { y: 2026, m: 8, d: 10 },
    })).source).toBe('hsbc'));
});
