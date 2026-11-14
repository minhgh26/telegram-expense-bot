// node scripts/realign-months.mjs — kế hoạch dời dòng về sheet của tháng tiêu (ADR-0002).
// CHỈ ĐỌC: quét 108 bảng <nhóm>_<tháng> của file mà .dev.vars (DRIVE_ITEM_ID) đang trỏ
// và in kế hoạch. Không có chế độ ghi trong script này.
// Logic phân loại nằm ở scripts/lib/realign-plan.mjs (hàm thuần, có test).
import { getAccessToken, loadEnv } from './lib/dev-vars.mjs';
import { GROUPS, WORKBOOK_YEAR, planSheet, serialToDate } from './lib/realign-plan.mjs';

// Script chỉ đọc: từ chối mọi tham số, TRƯỚC khi lấy token (lấy token là xoay refresh token).
if (process.argv.length > 2) {
  console.error(
    `Tham số không hợp lệ: ${process.argv.slice(2).join(' ')}
` +
    'Script này chỉ đọc và in kế hoạch, chưa có chế độ ghi (--apply sẽ có ở ticket 03). Chạy không kèm tham số.',
  );
  process.exit(1);
}

const CC = '[cc] ';
const HSBC = '[hsbc] ';

const fmtDate = (serial) => {
  const { y, m, d } = serialToDate(serial);
  const dd = String(d).padStart(2, '0'), mm = String(m).padStart(2, '0');
  return y === WORKBOOK_YEAR ? `${dd}/${mm}` : `${dd}/${mm}/${y}`;
};
const fmtMoney = (n) => (typeof n === 'number' ? n.toLocaleString('de-DE') : String(n));
const describe = (v) => {
  const date = typeof v[1] === 'number' ? fmtDate(v[1]) : '(không có ngày)';
  return `${v[0]} · ${date} · ${fmtMoney(v[2])}`;
};
const wasCc = (c) => String(c.oldValue[0] ?? '').startsWith(CC);

const env = loadEnv();
// getAccessToken in một dòng về refresh token mới; giữ lại để in sau dòng "File đích".
const held = [];
const origLog = console.log;
console.log = (...a) => held.push(a);
let token;
try {
  token = await getAccessToken(env);
} finally {
  console.log = origLog;
}

// Từ đây refresh token của bot đã chết: mọi lối ra đều phải nhắc /reauth.
try {
  await run(token);
} finally {
  for (const a of held) console.log(...a);
  console.log('\nChạy script làm chết chuỗi refresh token phía bot: gửi /reauth trong Telegram.');
}

async function run(token) {
  const H = { authorization: `Bearer ${token}` };
  const ITEM = `https://graph.microsoft.com/v1.0/me/drive/items/${env.DRIVE_ITEM_ID}`;

  const meta = await fetch(`${ITEM}?$select=name`, { headers: H });
  if (!meta.ok) { console.error('Khong doc duoc file dich', meta.status, await meta.text()); process.exitCode = 1; return; }
  console.log(`File đích: ${(await meta.json()).name}`);

  const moves = [], retags = [], stays = [], missing = [];
  for (const group of GROUPS) {
    for (let month = 1; month <= 12; month++) {
      const table = `${group}_${month}`;
      const res = await fetch(`${ITEM}/workbook/tables/${table}/rows?$select=index,values`, { headers: H });
      if (res.status === 404) { missing.push(table); continue; }
      if (!res.ok) { console.error(`${table}: loi doc`, res.status, await res.text()); process.exitCode = 1; return; }
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
    const note = c.starred ? `   (gắn ${HSBC.trim()} — dòng cũ không tiền tố)` : wasCc(c) ? `   (đổi ${CC.trim()} → ${HSBC.trim()})` : '';
    console.log(`${c.table.padEnd(16)} → ${c.target.padEnd(14)} ${star}${describe(c.newValue)}${note}`);
  }
  console.log('=== Đổi [cc] → [hsbc] tại chỗ ===');
  for (const c of retags) {
    const rest = String(c.oldValue[0]).slice(CC.length);
    console.log(`${c.table.padEnd(16)} ${CC.trim()} → ${HSBC.trim()} ${describe([rest, ...c.oldValue.slice(1)])}`);
  }
  console.log('=== Ở yên ===');
  for (const c of stays) {
    let note = '';
    if (c.reason === 'other-year') {
      note = !c.descChanged ? '   (năm khác → ở yên)'
        : wasCc(c) ? `   (năm khác → ở yên, đổi ${HSBC.trim()} tại chỗ)`
        : `   (năm khác → ở yên, gắn ${HSBC.trim()} tại chỗ ★)`;
    }
    console.log(`${c.table.padEnd(16)} ${describe(c.oldValue)}${note}`);
  }
  if (missing.length) {
    console.log(`=== Bảng không tồn tại (${missing.length}, bỏ qua) ===`);
    console.log(missing.join(', '));
  }
  // Mỗi dòng đếm đúng một lần, ở mục nó được liệt kê.
  console.log('=== Tổng ===');
  console.log(
    `dời ${moves.length} (★ ${moves.filter((c) => c.starred).length}) · ` +
    `đổi mô tả tại chỗ ${retags.length} · ở yên ${stays.length}`,
  );
}
