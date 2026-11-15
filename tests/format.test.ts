import { describe, expect, it } from 'vitest';
import { DEFERRED_SOURCES } from '../src/config';
import {
  confirmation, formatVND, helpText, reauthCodeFailed, reauthDone, reauthPrompt,
} from '../src/telegram/format';

describe('formatVND', () => {
  it.each([[40_000, '40.000đ'], [3_240_000, '3.240.000đ'], [0, '0đ'], [999, '999đ']])(
    '%i → %s', (n, want) => expect(formatVND(n)).toBe(want));
});

describe('confirmation', () => {
  const entry = {
    description: 'cơm trưa', amount: 40_000,
    date: { y: 2026, m: 8, d: 8 }, label: 'Ăn uống sinh hoạt',
    source: null,
  };
  const totals = { categoryMonth: 890_000, today: 75_000, monthSpend: 3_240_000 };
  const html = confirmation(entry, totals, true);

  it('có dòng xác nhận đủ 4 mảnh thông tin', () => {
    expect(html).toContain('cơm trưa');
    expect(html).toContain('40.000đ');
    expect(html).toContain('08/08');
    expect(html).toContain('Ăn uống sinh hoạt');
  });
  it('có đủ ba dòng tổng', () => {
    expect(html).toContain('890.000đ');
    expect(html).toContain('75.000đ');
    expect(html).toContain('3.240.000đ');
  });
  it('dùng khối <pre> để các con số thẳng cột', () => expect(html).toContain('<pre>'));
  it('nhãn nhóm luôn có số tháng, không bao giờ là undefined', () =>
    expect(html).toContain('(T8)'));
  it('ghi hôm nay → nhãn "Hôm nay"', () => expect(html).toContain('Hôm nay'));
  it('ghi lùi ngày → nhãn là ngày đó, không phải "Hôm nay"', () => {
    const back = confirmation({ ...entry, date: { y: 2026, m: 8, d: 5 } }, totals, false);
    expect(back).toContain('Ngày 05/08');
    expect(back).not.toContain('Hôm nay');
  });
  it('thoát ký tự HTML trong mô tả', () =>
    expect(confirmation({ ...entry, description: 'cơm <b>ngon</b>' }, totals, true))
      .toContain('&lt;b&gt;'));
});

const CARD_TOTALS = { categoryMonth: 215_000, today: 117_000, monthSpend: 2_503_667 };
const card = {
  description: 'cơm trưa', amount: 40_000,
  date: { y: 2026, m: 8, d: 10 }, label: 'Ăn uống sinh hoạt',
};

describe('confirmation — dòng nguồn', () => {
  it('không nguồn thì không có dòng nguồn nào', () => {
    const s = confirmation({ ...card, source: null }, CARD_TOTALS, false);
    expect(s).not.toMatch(/💳|🟢|🛍️|🔵/);
    expect((s.split('\n\n')[0] ?? '').split('\n')).toHaveLength(1);
  });

  it.each([
    ['hsbc', '💳 Thẻ HSBC'], ['vpb', '🟢 Thẻ VPBank'],
    ['spl', '🛍️ SPayLater'], ['zlp', '🔵 Ví trả sau ZaloPay'],
  ] as const)('nguồn %s → dòng "%s"', (source, line) => {
    const s = confirmation({ ...card, source }, CARD_TOTALS, false);
    expect(s.split('\n')[1]).toBe(line);
    expect(s).not.toContain('trả tháng');
  });

  it('nhãn nhóm và tổng chi mang tháng của khoản', () => {
    const s = confirmation({ ...card, source: 'hsbc' }, CARD_TOTALS, false);
    expect(s).toContain('Ăn uống sinh hoạt (T8)');
    expect(s).toContain('Tổng chi T8');
  });

  it('ghi lùi ngày thì dòng giữa mang ngày đó', () =>
    expect(confirmation({ ...card, source: null }, CARD_TOTALS, false)).toContain('Ngày 10/08'));

  it('mô tả trong tin xác nhận không bao giờ mang tiền tố nguồn', () => {
    const s = confirmation({ ...card, source: 'spl' }, CARD_TOTALS, false);
    expect(s).toContain('cơm trưa');
    expect(s).not.toContain('[spl]');
  });
});

describe('helpText — mục Nguồn trả sau', () => {
  const html = helpText({ shortcodes: {} });

  it('liệt kê đủ bốn token kèm emoji và nhãn', () => {
    for (const [token, s] of Object.entries(DEFERRED_SOURCES)) {
      expect(html).toContain(`<code>${token}</code> ${s.emoji} ${s.label}`);
    }
  });

  it('mục có tiêu đề "Nguồn trả sau"', () => expect(html).toContain('Nguồn trả sau'));

  it('không còn chữ "chốt"', () => expect(html).not.toContain('chốt'));

  it('vẫn in bảng mã viết tắt', () =>
    expect(helpText({ shortcodes: { WM: 'Winmart' } })).toContain('WM = Winmart'));
});

describe('reauthPrompt', () => {
  const html = reauthPrompt('https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?a=b');

  it('có link /authorize để mở', () =>
    expect(html).toContain('https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize'));

  it('nói rõ không cần gửi lại /reauth — luồng tự hoàn tất qua redirect', () =>
    expect(html).toContain('không cần gửi lại /reauth'));

  it('thoát ký tự HTML trong link', () =>
    expect(reauthPrompt('https://x?a=1&b=2')).toContain('a=1&amp;b=2'));
});

describe('reauthCodeFailed', () => {
  const html = reauthCodeFailed('AADSTS70008: mã hết hạn');

  it('nêu nguyên văn lỗi Microsoft trong <code>', () =>
    expect(html).toContain('<code>AADSTS70008: mã hết hạn</code>'));

  it('dặn gửi /reauth để lấy link mới', () => expect(html).toContain('Gửi /reauth'));

  it('thoát ký tự HTML trong lỗi', () =>
    expect(reauthCodeFailed('a<b>c')).toContain('a&lt;b&gt;c'));
});

describe('reauthDone', () => {
  const html = reauthDone('0.AY8-refresh-token');

  it('trả refresh token mới trong <code> để chép vào .dev.vars', () =>
    expect(html).toContain('<code>0.AY8-refresh-token</code>'));

  it('nhắc .dev.vars để biết chép đi đâu', () => expect(html).toContain('.dev.vars'));

  it('cảnh báo chạy script sẽ làm token phía bot chết', () =>
    expect(html).toContain('/reauth lần nữa'));

  it('thoát ký tự HTML trong token', () =>
    expect(reauthDone('a<b>c')).toContain('a&lt;b&gt;c'));
});
