// node scripts/realign-months.mjs — kế hoạch dời dòng về sheet của tháng tiêu (ADR-0002).
// CHỈ ĐỌC: quét 108 bảng <nhóm>_<tháng> của file mà .dev.vars (DRIVE_ITEM_ID) đang trỏ
// và in kế hoạch. Không có chế độ ghi trong script này.
// Logic phân loại nằm ở scripts/lib/realign-plan.mjs (hàm thuần, có test).
import { getAccessToken, loadEnv } from './lib/dev-vars.mjs';
import { GROUPS, planSheet, serialToDate } from './lib/realign-plan.mjs';

const env = loadEnv();
const token = await getAccessToken(env);
const H = { authorization: `Bearer ${token}` };
const ITEM = `https://graph.microsoft.com/v1.0/me/drive/items/${env.DRIVE_ITEM_ID}`;

const meta = await fetch(`${ITEM}?$select=name`, { headers: H });
if (!meta.ok) { console.error('Khong doc duoc file dich', meta.status, await meta.text()); process.exit(1); }
console.log(`File đích: ${(await meta.json()).name}`);

const fmtDate = (serial) => {
  const { y, m, d } = serialToDate(serial);
  const dd = String(d).padStart(2, '0'), mm = String(m).padStart(2, '0');
  return y === 2026 ? `${dd}/${mm}` : `${dd}/${mm}/${y}`;
};
const fmtMoney = (n) => (typeof n === 'number' ? n.toLocaleString('de-DE') : String(n));
const describe = (v) => {
  const date = typeof v[1] === 'number' ? fmtDate(v[1]) : '(không có ngày)';
  return `${v[0]} · ${date} · ${fmtMoney(v[2])}`;
};

const moves = [], retags = [], stays = [], missing = [];
for (const group of GROUPS) {
  for (let month = 1; month <= 12; month++) {
    const table = `${group}_${month}`;
    const res = await fetch(`${ITEM}/workbook/tables/${table}/rows?$select=index,values`, { headers: H });
    if (res.status === 404) { missing.push(table); continue; }
    if (!res.ok) { console.error(`${table}: loi doc`, res.status, await res.text()); process.exit(1); }
    const rows = ((await res.json()).value ?? []).map((r) => r.values[0]);
    for (const c of planSheet(group, month, rows)) {
      const item = { ...c, table };
      (c.kind === 'move' ? moves : c.kind === 'retag' ? retags : stays).push(item);
    }
  }
}

console.log('=== Dời tháng ===');
for (const c of moves) {
  const star = c.starred ? '★ ' : '';
  console.log(`${c.table.padEnd(16)} → ${c.target.padEnd(14)} ${star}${describe(c.newValue)}`);
}
console.log('=== Đổi [cc] → [hsbc] tại chỗ ===');
for (const c of retags) console.log(`${c.table.padEnd(16)} ${describe(c.oldValue)}`);
console.log('=== Ở yên ===');
let inPlace = 0;
for (const c of stays) {
  const note = c.reason === 'no-date' ? '' :
    c.newValue[0] !== c.oldValue[0]
      ? `   (năm khác → ở yên, đổi mô tả tại chỗ${c.starred ? ' ★ gắn [hsbc]' : ''})`
      : '   (năm khác → ở yên)';
  if (c.newValue[0] !== c.oldValue[0]) inPlace++;
  console.log(`${c.table.padEnd(16)} ${describe(c.oldValue)}${note}`);
}
if (missing.length) {
  console.log(`=== Bảng không tồn tại (${missing.length}, bỏ qua) ===`);
  console.log(missing.join(', '));
}
console.log('=== Tổng ===');
console.log(
  `dời ${moves.length} (★ ${moves.filter((c) => c.starred).length}) · ` +
  `đổi mô tả tại chỗ ${retags.length + inPlace} · ở yên ${stays.length}`,
);
console.log('\nChạy script làm chết chuỗi refresh token phía bot: gửi /reauth trong Telegram.');
