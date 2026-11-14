import { describe, expect, it } from 'vitest';
import { parseNote } from '../src/note';

/** Đúng hình dạng usedRange thật của sheet Note: bắt đầu ở E4, cột E..K. */
const usedRangeShape = {
  address: 'Note!E4:K12',
  values: [
    ['WM', 'Winmart', '', '', '', '/food', 'Ăn uống sinh hoạt'],
    ['TC', 'TocoToco', '', '', '', '/other', 'Linh tinh'],
    ['MT', 'Mầm Trà', '', '', '', '/force', 'Chi tiêu bắt buộc'],
    ['VM', 'V-mart', '', '', '', '/other_expense', 'Chi tiêu khác'],
    ['', '', '', '', '', '/transport', 'Phương tiện di chuyển'],
  ],
};

/** Vùng cố định A1:K6 — cái mà loadNote thật sự đọc. Cột A..K = chỉ số 0..10. */
const fixedRange = (rows: unknown[][]) => ({ address: 'Note!A1:K6', values: rows });

describe('bảng mã viết tắt', () => {
  it('HỒI QUY: vùng bắt đầu từ E4 vẫn đọc được mã — lỗi này đã lên production', () => {
    expect(parseNote(usedRangeShape).shortcodes).toEqual({
      WM: 'Winmart', TC: 'TocoToco', MT: 'Mầm Trà', VM: 'V-mart',
    });
  });

  it('vùng cố định bắt đầu từ A1 cũng đọc được', () =>
    expect(parseNote(fixedRange([
      ['', '', '', '', 'WM', 'Winmart', '', '', '', '', ''],
      ['', '', '', '', 'TC', 'TocoToco', '', '', '', '', ''],
      ['', '', '', '', 'VM', 'V-mart', '', '', '', '', ''],
    ])).shortcodes).toEqual({ WM: 'Winmart', TC: 'TocoToco', VM: 'V-mart' }));

  it('viết thường trong file vẫn tra được bằng chữ hoa', () =>
    expect(parseNote({
      address: 'Note!A1:F4',
      values: [['', '', '', '', 'wm', 'Winmart']],
    }).shortcodes).toEqual({ WM: 'Winmart' }));

  it('dòng thiếu tên đầy đủ thì bỏ qua', () =>
    expect(parseNote({
      address: 'Note!A1:F4',
      values: [['', '', '', '', 'XX', '   ']],
    }).shortcodes).toEqual({}));
});

describe('khối H–I (ngày chốt cũ) không còn được đọc', () => {
  it('NoteConfig chỉ còn bảng mã viết tắt', () =>
    expect(Object.keys(parseNote(fixedRange([
      ['', '', '', '', 'WM', 'Winmart', '', 'hsbc', 20, '', ''],
    ])))).toEqual(['shortcodes']));
});
