/* 小食光静态检查：node audit/check.js [文件路径]
   规则：任何一项不过 → exit 1；体积超预算只 warn，不算失败（体积不是正确性问题） */
const fs = require('fs');
const vm = require('vm');

const P = process.argv[2] || 'C:/Users/zsj_5/Documents/Qoder/2026-10-29/78e0c6f6/小食光-V2.html';
const html = fs.readFileSync(P, 'utf8');
const fails = [];
const warns = [];
const log = (ok, msg, detail) => {
  console.log((ok ? '  OK   ' : '  FAIL ') + msg + (detail ? '  ' + detail : ''));
  if (!ok) fails.push(msg);
};

/* ---- 1. 语法 ---- */
const scripts = html.match(/<script>([\s\S]*?)<\/script>/g) || [];
if (scripts.length !== 1) fails.push('单脚本约束');
log(scripts.length === 1, '单脚本约束', 'script 标签数 ' + scripts.length);
const js = (html.match(/<script>([\s\S]*?)<\/script>/) || [, ''])[1];

try { new vm.Script(js, { filename: 'inline.js' }); log(true, '语法'); }
catch (e) { log(false, '语法', e.message); }

/* ---- 2. 动作声明 vs 实现 ---- */
const declared = new Set();
for (const x of html.matchAll(/data-action="([a-z-]+)"/g)) declared.add(x[1]);
const implBlock = js.match(/const ACTIONS = \{[\s\S]*?\n\};/);
const handled = new Set();
if (implBlock) for (const x of implBlock[0].matchAll(/^  (?:'([a-z-]+)'|([a-z-]+)):.*=>/gm)) handled.add(x[1] || x[2]);
const missingImpl = [...declared].filter(a => !handled.has(a));
log(implBlock && missingImpl.length === 0, '动作都有实现', missingImpl.join(',') || (declared.size + ' 个'));

/* ---- 3. 关键函数与常量 ---- */
const fns = ['renderHome', 'renderDetail', 'renderOrder', 'renderSuccess', 'renderOrders', 'renderWallet',
  'renderKitchen', 'renderReview', 'renderChrome', 'syncA11y', 'navTo', 'commit', 'selfTest',
  'aegyoCap', 'aegyoBudget', 'aegyoAmounts', 'heroDish', 'balanceCheck'];
const missFn = fns.filter(f => !new RegExp('function ' + f + '\\s*\\(').test(js));
log(missFn.length === 0, '关键函数', missFn.join(',') || fns.length + ' 个');

const consts = ['ACTIONS', 'RENDER', 'FLOW', 'TABS', 'COPY', 'CATS', 'WHEN_OPTS', 'TASTE_PREFS', 'MOODS',
  'SYNONYM', 'ART_KEYS', 'CHEF_REJECT_REASONS', 'SEED_DISHES', 'SCHEMA_VER', 'LS_KEY', 'BABY_ONLY', 'CHEF_ONLY',
  'FOCUSABLE', 'TOAST_MS', 'AEGYO_DAILY_LIMIT', 'AEGYO_DAILY_CAP', 'V3_ADDED_IDS'];
const missConst = consts.filter(n => !new RegExp('(const|let) ' + n + '\\b').test(js));
log(missConst.length === 0, '关键常量', missConst.join(',') || consts.length + ' 个');

/* ---- 4. 文案 key 引用完整 ----
   只查字面量调用：pick('x') / copyWith('x', ...)，不查 pick('badge.' + k) 这种拼接 */
const copyKeys = new Set();
for (const x of js.matchAll(/^\s{2}'([a-z][a-z.]*)':/gm)) copyKeys.add(x[1]);
const usedKeys = new Set();
for (const x of js.matchAll(/(?:pick|copyWith)\('([a-z][a-z.]*)'\s*[,)]/g)) usedKeys.add(x[1]);
const unknownKeys = [...usedKeys].filter(k => !copyKeys.has(k));
log(unknownKeys.length === 0, '文案 key 都有定义', unknownKeys.join(',') || copyKeys.size + ' 个 key');

/* ---- 5. 插画双向差集 ---- */
const artKeys = new Set();
const artArr = js.match(/const ART_KEYS = \[([\s\S]*?)\];/);
if (artArr) for (const x of artArr[1].matchAll(/'([a-z]+)'/g)) artKeys.add(x[1]);
const symbols = new Set();
for (const x of html.matchAll(/<symbol id="art-([a-z]+)"/g)) symbols.add(x[1]);
const onlyKey = [...artKeys].filter(k => !symbols.has(k));
const onlySym = [...symbols].filter(k => k !== 'unknown' && !artKeys.has(k));
log(onlyKey.length === 0 && onlySym.length === 0, '插画一一对应',
  (onlyKey.length || onlySym.length) ? ('缺 symbol: ' + onlyKey.join(',') + ' | 缺 key: ' + onlySym.join(',')) : artKeys.size + ' 张');

/* ---- 6. 体积预算（warn，不 fail）。阈值含内联菜品数据：JSON 块是一行，行数不反映体积 ---- */
const htmlLines = html.split('\n').length, jsLines = js.split('\n').length;
const dataKB = Math.round(((html.match(/<script type="application\/json"[^>]*>([\s\S]*?)<\/script>/) || [, ''])[1].length) / 1024);
if (htmlLines > 3200 || jsLines > 1900) warns.push('体积超预算：HTML ' + htmlLines + ' / JS ' + jsLines + '，该考虑拆分了');
console.log('  INFO 行数 HTML ' + htmlLines + ' / JS ' + jsLines + ' · 内联菜品数据 ' + dataKB + 'KB');

/* ---- 7. 外部请求清单（w3.org 是 SVG 命名空间，不发请求，排除） ---- */
const urls = [...new Set([...html.matchAll(/https?:\/\/[^\s"')]+/g)].map(m => m[0]))]
  .filter(u => !/w3\.org/.test(u));
console.log('  INFO 外部请求 ' + urls.length + ' 个：' + (urls.length ? urls.join(' | ') : '无'));
console.log('  INFO assets/ 引用 ' + (html.match(/assets\//g) || []).length +
  ' · theme-color ' + (/theme-color/.test(html) ? '有' : '无'));

/* ---- 汇总 ---- */
console.log('');
if (warns.length) warns.forEach(w => console.log('  WARN ' + w));
if (fails.length) { console.log('检查未通过 ' + fails.length + ' 项：' + fails.join(' / ')); process.exit(1); }
console.log('检查通过');
process.exit(0);
