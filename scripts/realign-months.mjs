// node scripts/realign-months.mjs [--apply] — dời dòng về sheet của tháng tiêu (ADR-0002).
// Quét 108 bảng <nhóm>_<tháng> của file mà .dev.vars (DRIVE_ITEM_ID) đang trỏ và in kế hoạch.
// Không có --apply: CHỈ ĐỌC. Có --apply: thực hiện kế hoạch mà KHÔNG BAO GIỜ làm mất dòng:
// thêm vào đích trước, xoá nguồn sau, xoá theo chỉ số tìm lại từ NỘI DUNG CŨ (không theo chỉ số kế hoạch).
// DELETE và rows/add không bao giờ gửi lại khi 5xx (có thể đã áp dụng); lỗi mơ hồ → "có thể trùng".
// Logic phân loại nằm ở scripts/lib/realign-plan.mjs (hàm thuần, có test).
import { getAccessToken, loadEnv } from './lib/dev-vars.mjs';
import {
  GROUPS, WORKBOOK_YEAR, findOldRow, isAmbiguousFailure, isSortedByDate, needsBlankRow, planSheet,
  serialToDate, shouldRetry,
} from './lib/realign-plan.mjs';

// Từ chối tham số lạ TRƯỚC khi lấy token (lấy token là xoay refresh token).
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const bad = args.filter((a) => a !== '--apply');
if (bad.length) {
  console.error(
    `Tham số không hợp lệ: ${bad.join(' ')}\n` +
    'Chạy không kèm tham số để chỉ in kế hoạch; thêm --apply để thực hiện.',
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

async function run(token) {
  const H = { authorization: `Bearer ${token}` };
  const ITEM = `https://graph.microsoft.com/v1.0/me/drive/items/${env.DRIVE_ITEM_ID}`;

  const meta = await fetch(`${ITEM}?$select=name`, { headers: H });
  if (!meta.ok) { console.error('Khong doc duoc file dich', meta.status, await meta.text()); process.exitCode = 1; return; }
  console.log(`File đích: ${(await meta.json()).name}`);

  const moves = [], retags = [], stays = [], missing = [];
  const counts = new Map(); // bảng -> số dòng dự kiến hiện tại (để nhận ra bản đọc cũ)
  for (const group of GROUPS) {
    for (let month = 1; month <= 12; month++) {
      const table = `${group}_${month}`;
      const res = await fetch(`${ITEM}/workbook/tables/${table}/rows?$select=index,values`, { headers: H });
      if (res.status === 404) { missing.push(table); continue; }
      if (!res.ok) { console.error(`${table}: loi doc`, res.status, await res.text()); process.exitCode = 1; return; }
      const rows = ((await res.json()).value ?? []).map((r) => r.values[0]);
      counts.set(table, rows.length);
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

  if (!APPLY) return;
  await apply({ ITEM, H, moves, retags, stays, counts });
}

// ───────────────────────── --apply ─────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const STALE_RETRIES = 4;
const STALE_WAIT_MS = 1500;
const tableUrl = (ITEM, t) => `${ITEM}/workbook/tables/${encodeURIComponent(t)}`;

/**
 * Gọi Graph. 429 gửi lại; 5xx chỉ gửi lại lệnh lặp được (GET, PATCH, hoặc `idempotent: true`).
 * DELETE theo chỉ số và rows/add KHÔNG bao giờ gửi lại khi 5xx: có thể Graph đã áp dụng rồi
 * (.scratch/ghi-trung), gửi lại là xoá nhầm dòng kế bên hoặc thêm bản thứ hai.
 * Ném Error có `.status` khi lỗi HTTP; lỗi mạng ném không có `.status` (xem isAmbiguousFailure).
 */
async function graph(H, url, { idempotent, ...init } = {}) {
  const safe = idempotent ?? ['GET', 'PATCH'].includes(init.method ?? 'GET');
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      ...init,
      headers: { ...H, ...(init.body ? { 'content-type': 'application/json' } : {}) },
    });
    if (res.ok) return res.status === 204 ? null : res.json();
    if (shouldRetry({ status: res.status, idempotent: safe, attempt })) {
      await sleep((Number(res.headers.get('retry-after')) || 2 ** attempt) * 1000);
      continue;
    }
    throw Object.assign(
      new Error(`${init.method ?? 'GET'} ${url.split('/workbook/')[1] ?? url} → ${res.status} ${await res.text()}`),
      { status: res.status },
    );
  }
}

async function apply({ ITEM, H, moves, retags, stays, counts }) {
  console.log('\n=== Thực hiện (--apply) ===');
  const done = { moved: [], retagged: [], notRetagged: [], duplicates: [], errors: [] };
  const received = new Set();
  const failedStays = new Set(); // dòng ở yên mà đổi mô tả hỏng: báo ở "Chưa đổi mô tả", không đếm lần nữa ở "Ở yên"
  const label = (c) => `${c.table} · ${describe(c.oldValue)}`;

  const readRows = async (table) => {
    const j = await graph(H, `${tableUrl(ITEM, table)}/rows?$select=index,values`);
    return (j.value ?? []).map((r) => r.values[0]);
  };
  // Đọc lại bảng tới khi `pick(rows)` trả giá trị khác undefined; hết lượt → null.
  const poll = async (table, pick, tries) => {
    for (let i = 0; i < tries; i++) {
      if (i > 0) await sleep(STALE_WAIT_MS);
      const got = await pick(await readRows(table));
      if (got !== undefined) return got;
    }
    return null;
  };
  // Tìm chỉ số của dòng theo NỘI DUNG CŨ. Chỉ tin bản đọc có số dòng đúng như dự kiến, rồi
  // đọc lại đúng dòng đó (itemAt) và so nội dung một lần nữa: số dòng bằng nhau vẫn có thể là
  // bản đọc cũ (thêm và xoá triệt tiêu nhau), xoá theo nó là xoá nhầm dòng. `prefer` = chỉ số
  // kế hoạch, chỉ là gợi ý ưu tiên, không bao giờ được tin mà không so nội dung.
  const locate = (table, oldValue, prefer) => poll(table, async (rows) => {
    if (rows.length !== counts.get(table)) return undefined;
    const idx = prefer !== undefined && rows[prefer] && findOldRow([rows[prefer]], oldValue) === 0
      ? prefer : findOldRow(rows, oldValue);
    if (idx === null) return undefined;
    const live = await graph(H, `${tableUrl(ITEM, table)}/rows/itemAt(index=${idx})`);
    return live?.values?.[0] && findOldRow([live.values[0]], oldValue) === 0 ? idx : undefined;
  }, STALE_RETRIES);
  // Sau lỗi mơ hồ (lệnh ghi có thể đã áp dụng) số dòng dự kiến không còn đáng tin: đo lại cho
  // tới khi hai lần đọc liền nhau cùng số dòng, để các dòng sau không bị kẹt "bản đọc không ổn định".
  const resync = async (table) => {
    let prev = null;
    for (let i = 0; i <= STALE_RETRIES; i++) {
      await sleep(STALE_WAIT_MS);
      let n;
      try { n = (await readRows(table)).length; } catch { continue; }
      if (n === prev) break;
      prev = n;
    }
    if (prev !== null) counts.set(table, prev);
  };

  // 1. Đổi mô tả tại chỗ (dòng không dời): đọc lại, khớp nội dung cũ rồi mới PATCH CHỈ ô mô tả
  //    (null = giữ nguyên ngày và số tiền, kể cả công thức người dùng gõ tay).
  for (const c of [...retags, ...stays.filter((s) => s.descChanged)]) {
    try {
      const idx = await locate(c.table, c.oldValue, c.index);
      if (idx === null) {
        done.notRetagged.push(`${label(c)} — không tìm thấy dòng cũ / bản đọc không ổn định, chưa đổi mô tả`);
        failedStays.add(c); continue;
      }
      await graph(H, `${tableUrl(ITEM, c.table)}/rows/itemAt(index=${idx})/range`, {
        method: 'PATCH', body: JSON.stringify({ values: [[c.newValue[0], null, null]] }),
      });
      if (c.kind === 'retag') done.retagged.push(label(c));
      console.log(`đổi mô tả: ${label(c)}`);
    } catch (err) { done.notRetagged.push(`${label(c)} — ${err.message}`); failedStays.add(c); }
  }

  // 2. Dời: kiểm nguồn còn đó → thêm vào đích → vá định dạng ngày → đọc lại nguồn → xoá.
  for (const c of moves) {
    if (!counts.has(c.target)) { done.errors.push(`${label(c)} — bảng đích ${c.target} không tồn tại, chưa dời`); continue; }
    // Không tìm được nguồn thì KHÔNG thêm: thêm rồi mới phát hiện là sinh dòng trùng.
    try {
      if ((await locate(c.table, c.oldValue)) === null) {
        done.errors.push(`${label(c)} — không tìm thấy dòng nguồn / bản đọc không ổn định, chưa dời`); continue;
      }
    } catch (err) { done.errors.push(`${label(c)} — chưa dời, đọc nguồn lỗi: ${err.message}`); continue; }
    let added;
    try {
      const r = await graph(H, `${tableUrl(ITEM, c.target)}/rows/add`, {
        method: 'POST', body: JSON.stringify({ values: [c.newValue.slice(0, 3)] }),
      });
      if (typeof r.index !== 'number') throw new Error('Graph không trả về index của dòng vừa thêm');
      added = r.index;
      counts.set(c.target, counts.get(c.target) + 1);
      received.add(c.target);
    } catch (err) {
      if (isAmbiguousFailure(err)) {
        // Có thể Graph đã thêm rồi: không thử lại, không xoá nguồn, để người dùng kiểm.
        done.duplicates.push(`${label(c)} — thêm vào ${c.target} báo lỗi nhưng CÓ THỂ ĐÃ THÊM, chưa xoá nguồn: ${err.message}`);
        received.add(c.target);
        await resync(c.target);
      } else done.errors.push(`${label(c)} — thêm vào ${c.target} lỗi: ${err.message}`);
      continue;
    }
    try {
      await graph(H, `${tableUrl(ITEM, c.target)}/rows/itemAt(index=${added})/range`, {
        method: 'PATCH', body: JSON.stringify({ numberFormat: [[null, 'd-mmm', null]] }),
      });
    } catch (err) { done.errors.push(`${c.target} dòng ${added}: chưa vá được định dạng ngày — ${err.message}`); }
    try {
      const idx = await locate(c.table, c.oldValue);
      if (idx === null) { done.duplicates.push(`${label(c)} — đã thêm vào ${c.target}, KHÔNG xoá được dòng nguồn (không thấy / bản đọc không ổn định)`); continue; }
      try {
        await graph(H, `${tableUrl(ITEM, c.table)}/rows/itemAt(index=${idx})`, { method: 'DELETE' });
      } catch (err) {
        done.duplicates.push(`${label(c)} — đã thêm vào ${c.target}, xoá nguồn lỗi (KHÔNG gửi lại; có thể đã xoá hoặc chưa): ${err.message}`);
        if (isAmbiguousFailure(err)) await resync(c.table);
        continue;
      }
      counts.set(c.table, counts.get(c.table) - 1);
      done.moved.push(`${label(c)} → ${c.target}`);
      console.log(`dời: ${label(c)} → ${c.target}`);
    } catch (err) { done.duplicates.push(`${label(c)} — đã thêm vào ${c.target}, đọc lại nguồn lỗi: ${err.message}`); }
  }

  // 3. Dọn bảng đã nhận dòng: chỉ sắp + thêm dòng trống, không xoá.
  for (const table of received) {
    try {
      await graph(H, `${tableUrl(ITEM, table)}/sort/apply`, {
        method: 'POST', idempotent: true, body: JSON.stringify({ fields: [{ key: 1, ascending: true }] }),
      });
      const rows = await poll(table, (r) => (isSortedByDate(r) ? r : undefined), 2);
      if (!rows) throw new Error('bản đọc sau khi sắp vẫn là thứ tự cũ, bỏ qua thêm dòng trống');
      if (needsBlankRow(rows)) {
        await graph(H, `${tableUrl(ITEM, table)}/rows/add`, { method: 'POST', body: JSON.stringify({ values: [[null, null, null]] }) });
      }
      console.log(`dọn: ${table}`);
    } catch (err) { done.errors.push(`dọn ${table} — ${err.message}`); }
  }

  // Mỗi dòng đếm đúng một lần (như bản in kế hoạch): dòng ở yên đã đổi mô tả chỉ nằm ở "Ở yên"
  // (in mô tả mới); dòng đổi mô tả hỏng chỉ nằm ở "Chưa đổi mô tả".
  const stayOk = stays.filter((c) => !failedStays.has(c));
  const list = (title, xs) => { console.log(`--- ${title} (${xs.length}) ---`); xs.forEach((x) => console.log(x)); };
  console.log('\n=== Báo cáo ===');
  list('Đã dời', done.moved);
  list('Đã đổi mô tả tại chỗ', done.retagged);
  list('Ở yên', stayOk.map((c) => `${c.table} · ${describe(c.descChanged ? c.newValue : c.oldValue)}${c.descChanged ? '   (đã đổi mô tả tại chỗ)' : ''}`));
  list('Chưa đổi mô tả (dòng vẫn như cũ, chạy lại được)', done.notRetagged);
  list('Có thể trùng (kiểm tay)', done.duplicates);
  list('Lỗi', done.errors);
  console.log(
    `\nđã dời ${done.moved.length} · đổi mô tả tại chỗ ${done.retagged.length} · ở yên ${stayOk.length} · ` +
    `chưa đổi mô tả ${done.notRetagged.length} · có thể trùng ${done.duplicates.length} · lỗi ${done.errors.length}`,
  );
  if (done.duplicates.length) {
    console.log('CẢNH BÁO: xoá tay các dòng trùng ở bảng đích TRƯỚC khi chạy lại --apply, nếu không dòng nguồn còn sót sẽ bị thêm lần nữa.');
  }
  if (done.duplicates.length || done.errors.length || done.notRetagged.length) process.exitCode = 1;
}

// Từ đây refresh token của bot đã chết: mọi lối ra đều phải nhắc /reauth.
try {
  await run(token);
} finally {
  for (const a of held) console.log(...a);
  console.log('\nChạy script làm chết chuỗi refresh token phía bot: gửi /reauth trong Telegram.');
}
