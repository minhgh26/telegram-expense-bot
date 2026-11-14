import { describe, expect, it } from 'vitest';
import { planSheet as plan, serialToDate } from '../scripts/lib/realign-plan.mjs';

// Serial Excel của ngày d/m/y, cùng mốc với toExcelSerial (src/parse/date.ts).
const serial = (y: number, m: number, d: number) =>
  Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86_400_000);
const dong = (mo: unknown, y: number, m: number, d: number, tien = 40_000) => [
  mo,
  serial(y, m, d),
  tien,
];

const one = (...a: Parameters<typeof plan>) => {
  const r = plan(...a);
  expect(r).toHaveLength(1);
  return r[0]!;
};

describe('serialToDate', () => {
  it('đổi serial ra ngày/tháng/năm, cùng mốc toExcelSerial', () => {
    expect(serialToDate(serial(2026, 8, 20))).toEqual({ y: 2026, m: 8, d: 20 });
    expect(serialToDate(serial(2025, 12, 28))).toEqual({ y: 2025, m: 12, d: 28 });
    expect(serialToDate(serial(2026, 3, 1))).toEqual({ y: 2026, m: 3, d: 1 });
  });
});

describe('planSheet — kế hoạch dời dòng', () => {
  it('[cc] đúng tháng → đổi thành [hsbc] tại chỗ', () => {
    const c = one('force', 3, [dong('[cc] phí', 2026, 3, 2)]);
    expect(c).toMatchObject({ index: 0, kind: 'retag', target: null, starred: false });
    expect(c.newValue[0]).toBe('[hsbc] phí');
    expect(c.oldValue[0]).toBe('[cc] phí');
  });

  it('dời lùi một tháng có tiền tố → giữ tiền tố, không ★', () => {
    const c = one('food', 9, [dong('[vpb] ăn trưa', 2026, 8, 20)]);
    expect(c).toMatchObject({ kind: 'move', target: 'food_8', starred: false });
    expect(c.newValue[0]).toBe('[vpb] ăn trưa');
  });

  it('dời lùi không tiền tố ở nhóm chi tiêu → gắn [hsbc] và ★', () => {
    const c = one('food', 9, [dong('cơm tấm', 2026, 8, 18, 35_000)]);
    expect(c).toMatchObject({ kind: 'move', target: 'food_8', starred: true });
    expect(c.newValue).toEqual(['[hsbc] cơm tấm', serial(2026, 8, 18), 35_000]);
  });

  it('dời lùi không tiền tố ở income → không gắn', () => {
    const c = one('income', 9, [dong('lương', 2026, 8, 30)]);
    expect(c).toMatchObject({ kind: 'move', target: 'income_8', starred: false });
    expect(c.newValue[0]).toBe('lương');
  });

  it('dời tiến (ngày muộn hơn tháng sheet) không tiền tố → không gắn', () => {
    const c = one('food', 8, [dong('cơm', 2026, 9, 2)]);
    expect(c).toMatchObject({ kind: 'move', target: 'food_9', starred: false });
    expect(c.newValue[0]).toBe('cơm');
  });

  it('[cc] lệch tháng → dời và đổi một bước', () => {
    const c = one('eat_out', 9, [dong('[cc] phở', 2026, 8, 3)]);
    expect(c).toMatchObject({ kind: 'move', target: 'eat_out_8', starred: false });
    expect(c.newValue[0]).toBe('[hsbc] phở');
  });

  it('ngày 2025 ở Tháng 1, không tiền tố, nhóm chi tiêu → ở yên, gắn [hsbc] tại chỗ, ★', () => {
    const c = one('food', 1, [dong('tất niên', 2025, 12, 28, 300_000)]);
    expect(c).toMatchObject({ kind: 'stay', target: null, starred: true });
    expect(c.newValue[0]).toBe('[hsbc] tất niên');
  });

  it('ngày 2025 có [cc] → ở yên, đổi [hsbc] tại chỗ, không ★', () => {
    const c = one('food', 1, [dong('[cc] tất niên', 2025, 12, 28)]);
    expect(c).toMatchObject({ kind: 'stay', target: null, starred: false });
    expect(c.newValue[0]).toBe('[hsbc] tất niên');
  });

  it('ngày 2025 ở income → ở yên, không đổi gì', () => {
    const c = one('income', 1, [dong('thưởng', 2025, 12, 28)]);
    expect(c).toMatchObject({ kind: 'stay', target: null });
    expect(c.newValue).toEqual(c.oldValue);
  });

  it('ô ngày là chữ nhưng có nội dung → ở yên, lý do không có ngày', () => {
    const c = one('other', 4, [['gửi xe', 'hôm qua', 5_000]]);
    expect(c).toMatchObject({ kind: 'stay', target: null, reason: 'no-date' });
    expect(c.newValue).toEqual(c.oldValue);
  });

  it('dòng trống → không có trong kế hoạch', () => {
    expect(plan('food', 4, [['', '', ''], ['', '', '']])).toEqual([]);
  });

  it('dòng đúng tháng, không [cc] → không có trong kế hoạch', () => {
    expect(plan('food', 8, [dong('cơm', 2026, 8, 5), dong('[hsbc] phở', 2026, 8, 6)])).toEqual([]);
  });

  it('mô tả là số (Excel lưu 100 thành số) → không vỡ, gắn tiền tố dạng chuỗi', () => {
    const c = one('food', 9, [dong(100, 2026, 8, 20)]);
    expect(c).toMatchObject({ kind: 'move', target: 'food_8', starred: true });
    expect(c.newValue[0]).toBe('[hsbc] 100');
    expect(plan('food', 8, [dong(100, 2026, 8, 20)])).toEqual([]);
  });

  it('chỉ số là vị trí dòng trong bảng', () => {
    const cs = plan('food', 9, [dong('a', 2026, 9, 1), dong('b', 2026, 8, 1)]);
    expect(cs.map((c: { index: number }) => c.index)).toEqual([1]);
  });
});
