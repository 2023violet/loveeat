/* 小食光端到端检查：node audit/e2e.js [文件路径]
   依赖本机 Edge/Chrome（可用 XSG_BROWSER 指定）。使用临时浏览器配置，不碰真实 localStorage。
   覆盖：内置自检、搜索、点菜/支付、大厨状态机、评价回写、撒娇批复、新增/下架菜、持久化、旧 ID 迁移。 */
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');
const path = require('path');
const fs = require('fs');
const os = require('os');

const FILE = process.argv[2] || path.join(__dirname, '..', '小食光-V2.html');
const BROWSERS = [
  process.env.XSG_BROWSER,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);
const browser = BROWSERS.find(p => { try { return fs.existsSync(p); } catch (e) { return false; } });
if (!browser) {
  console.error('未找到 Edge/Chrome，请用 XSG_BROWSER 指定浏览器路径');
  process.exit(1);
}
if (!fs.existsSync(FILE)) {
  console.error('找不到文件：' + FILE);
  process.exit(1);
}

const PORT = 9400 + Math.floor(Math.random() * 200);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'xsg-e2e-'));
const child = spawn(browser, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
  '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile,
  '--allow-file-access-from-files', 'about:blank',
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitJson(url, tries) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); } catch (e) {}
    await sleep(250);
  }
  throw new Error('CDP 未就绪：' + url);
}

let msgId = 0;
function makeClient(ws) {
  const pending = new Map();
  const events = [];
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else events.push(m);
  });
  const send = (method, params) => new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, m => m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result));
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
  return { send, events };
}

async function evaluate(client, expression) {
  const r = await client.send('Runtime.evaluate', {
    expression, awaitPromise: true, returnByValue: true, userGesture: true,
  });
  if (r.exceptionDetails) throw new Error('页面执行出错：' + JSON.stringify(r.exceptionDetails));
  return r.result.value;
}

function cleanup() {
  try { child.kill(); } catch (e) {}
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
}

(async () => {
  const list = await waitJson(`http://127.0.0.1:${PORT}/json/list`, 60);
  const page = list.find(p => p.type === 'page');
  if (!page) throw new Error('没有可用的页面');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const client = makeClient(ws);
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Network.enable');
  /* 外部字体只影响外观，测试里直接阻断，避免网络波动影响结果 */
  await client.send('Network.setBlockedURLs', { urls: ['*fonts.loli.net*', '*fileup.chatglm.cn*'] });
  await client.send('Page.navigate', { url: pathToFileURL(FILE).href });

  let ready = '';
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    ready = await evaluate(client, `document.readyState + '|' + (window.__XSG ? 'xsg' : 'no')`);
    if (ready === 'complete|xsg') break;
  }
  if (ready !== 'complete|xsg') throw new Error('页面未启动：' + ready);
  await sleep(800);

  const flow = await evaluate(client, `(async () => {
    const out = [];
    const ok = (name, cond, detail) => out.push({ name, ok: !!cond, detail: detail === undefined ? '' : String(detail) });
    const fail = (name, e) => out.push({ name, ok: false, detail: e && e.message ? e.message : String(e) });
    const click = sel => {
      const el = document.querySelector(sel);
      if (!el) throw new Error('找不到元素：' + sel);
      el.click();
      return el;
    };
    const before = {};

    try {
      const bootReport = window.__XSG.report;
      ok('内置自检', bootReport.fail.length === 0, bootReport.fail.join(',') || bootReport.pass.length + ' 项');

      const count0 = state.dishes.length;
      ok('菜品库非空', count0 >= 20, count0);
      ok('菜品 ID 唯一', new Set(state.dishes.map(d => d.id)).size === count0, count0);

      /* 搜索：严格同义词不能落回模糊匹配 */
      state.q = '不辣'; state.cat = 'all'; state.filters = {}; state.renderLimit = RENDER_STEP; renderHome();
      const noSpicy = filteredDishes();
      ok('搜索不辣只返回不辣', noSpicy.length > 0 && noSpicy.every(d => d.spicy === 0),
        noSpicy.length + ' 道，辣菜 ' + noSpicy.filter(d => d.spicy > 0).length);

      state.q = ''; state.filters = {}; state.cat = 'all'; state.renderLimit = RENDER_STEP; renderHome();
      click('[data-card="fanqie"] [data-action="add"]');
      ok('加入购物车', state.cart.fanqie === 1, JSON.stringify(state.cart));
      const bal0 = state.wallet.balance;
      const total0 = cartTotal();
      click('#cart-bar');
      ok('进入确认点菜', state.screen === 'order', state.screen);
      click('#pay-bar [data-action="pay"]');
      ok('支付成功页', state.screen === 'success', state.screen);
      const o1 = orderById(state.lastOrderId);
      ok('订单创建并扣款', o1 && o1.chefState === 'pending' && state.wallet.balance === +(bal0 - o1.total).toFixed(1),
        o1 && (o1.total + ' / ' + state.wallet.balance));
      ok('余额与账本一致', balanceCheck(), state.wallet.balance);

      /* 大厨状态机 */
      click('#avatar-btn');
      ok('切换大厨进厨房', state.me === 'chef' && state.screen === 'kitchen', state.me + '/' + state.screen);
      click('[data-action="chef-accept"][data-id="' + o1.id + '"]');
      ok('接单', orderById(o1.id).chefState === 'accepted', orderById(o1.id).chefState);
      click('[data-action="chef-cook"][data-id="' + o1.id + '"]');
      ok('开火', orderById(o1.id).chefState === 'cooking', orderById(o1.id).chefState);
      click('[data-action="chef-serve"][data-id="' + o1.id + '"]');
      ok('开饭', orderById(o1.id).chefState === 'served', orderById(o1.id).chefState);

      /* 评价回写 */
      const reviews0 = dish('fanqie').reviews.length;
      click('#avatar-btn');
      ok('切回宝贝', state.me === 'baby' && state.screen === 'home', state.me + '/' + state.screen);
      click('[data-action="rate-open"][data-id="' + o1.id + '"]');
      ok('进入评价页', state.screen === 'review', state.screen);
      click('[data-action="rate-hearts"][data-id="5"]');
      click('[data-action="rate-submit"]');
      ok('订单完成', orderById(o1.id).chefState === 'rated', orderById(o1.id).chefState);
      ok('食评回写菜品', dish('fanqie').reviews.length === reviews0 + 1, dish('fanqie').reviews.length);
      ok('完成后账本一致', balanceCheck(), state.wallet.balance);

      /* 撒娇：发出 → 大厨批复 */
      click('#tab-bar [data-target="wallet"]');
      const wait0 = waitingAegyo().length;
      const bal1 = state.wallet.balance;
      click('[data-action="aegyo"]');
      document.querySelector('#ag-note').value = '想加个菜';
      click('[data-action="aegyo-send"]');
      ok('撒娇进入待批箱', waitingAegyo().length === wait0 + 1, waitingAegyo().length);
      click('[data-action="role-set"][data-id="chef"]');
      ok('撒娇后切大厨', state.me === 'chef' && state.screen === 'kitchen', state.me + '/' + state.screen);
      const amountEl = document.querySelector('.amount-chip');
      ok('存在可批档位', !!amountEl, amountEl ? amountEl.textContent : '无');
      const amount = amountEl ? +amountEl.dataset.amount : 0;
      if (amountEl) amountEl.click();
      ok('批复到账', waitingAegyo().length === wait0 && state.wallet.balance === +(bal1 + amount).toFixed(1),
        state.wallet.balance + ' (+' + amount + ')');
      ok('批复后账本一致', balanceCheck(), state.wallet.balance);

      /* 新增菜：ID 不掺菜名，菜名必须转义 */
      click('[data-action="dish-new"]');
      document.querySelector('#dn-name').value = '坏名字\\"><b>pwn</b>';
      document.querySelector('#dn-price').value = '5';
      document.querySelector('#dn-time').value = '20';
      document.querySelector('#dn-desc').value = '自动化验证';
      click('[data-action="dish-new-submit"]');
      const added = state.dishes.find(d => d.name === '坏名字\\"><b>pwn</b>');
      ok('大厨新增菜品', !!added && added.byChef, added && added.id);
      ok('自建菜 ID 安全', !!added && /^c\\d{4}-\\d+$/.test(added.id), added && added.id);

      click('#avatar-btn');
      state.q = '坏名字'; state.renderLimit = RENDER_STEP; renderHome();
      const listHTML = document.querySelector('#home-list').innerHTML;
      ok('菜名已转义', listHTML.indexOf('<b>pwn</b>') < 0, listHTML.indexOf('&lt;b&gt;pwn&lt;/b&gt;') >= 0 ? '编码正常' : '未找到编码结果');

      click('#avatar-btn');
      click('[data-action="dish-del"][data-id="' + added.id + '"]');
      click('[data-action="dish-del-do"][data-id="' + added.id + '"]');
      ok('下架新增菜', !state.dishes.some(d => d.id === added.id) && state.removedIds.includes(added.id), state.removedIds.length);

      /* 持久化与旧 ID 迁移 */
      saveNow();
      const saved = JSON.parse(localStorage.getItem(LS_KEY));
      ok('localStorage 可读回', !!saved && saved.meta.schemaVer === SCHEMA_VER && saved.dishes.length === state.dishes.length,
        saved && saved.dishes.length);

      const oldId = 'd1';
      const newId = LEGACY_DISH_IDS[oldId];
      const probe = {
        dishes: [{ id: oldId }], cart: { [oldId]: 1 }, favs: [oldId], removedIds: [oldId],
        detailId: oldId, orders: [{ items: { [oldId]: 1 }, snap: { [oldId]: { name: '旧菜' } } }],
      };
      migrateLegacyDishIds(probe);
      ok('旧位置 ID 可迁移', !!newId && probe.dishes[0].id === newId && probe.cart[newId] === 1
        && probe.favs[0] === newId && probe.removedIds[0] === newId && probe.detailId === newId
        && probe.orders[0].items[newId] === 1 && !!probe.orders[0].snap[newId], newId);

      const fontLink = document.querySelector('link[href*="fonts.loli.net/css2"]');
      ok('字体 CSS 非阻塞加载', !!fontLink && fontLink.getAttribute('onload') === "this.media='all'",
        fontLink && fontLink.getAttribute('media'));

      ok('收尾账本一致', balanceCheck(), state.wallet.balance);
    } catch (e) {
      fail('流程异常', e);
    }
    return JSON.stringify({ out, final: { screen: state.screen, me: state.me, dishes: state.dishes.length, balance: state.wallet.balance } });
  })()`);

  const parsed = JSON.parse(flow);
  parsed.out.forEach(r => console.log((r.ok ? '  PASS ' : '  FAIL ') + r.name + (r.detail ? '  ' + r.detail : '')));

  const errors = client.events.filter(e => {
    if (e.method === 'Runtime.exceptionThrown') return true;
    if (e.method === 'Runtime.consoleAPICalled') {
      const type = e.params.type;
      const text = e.params.args.map(a => a.value !== undefined ? a.value : a.description).join(' ');
      return type === 'error' || (type === 'warning' && /\[小食光\]/.test(text));
    }
    return false;
  }).map(e => {
    if (e.method === 'Runtime.exceptionThrown') return e.params.exceptionDetails.text;
    return e.params.args.map(a => a.value !== undefined ? a.value : a.description).join(' ');
  });
  if (errors.length) {
    errors.forEach(x => console.log('  FAIL 控制台错误  ' + x));
  } else {
    console.log('  PASS 无控制台错误');
  }

  ws.close();
  cleanup();
  const fails = parsed.out.filter(r => !r.ok).length + errors.length;
  console.log('');
  console.log(fails ? '端到端检查未通过：' + fails + ' 项' : '端到端检查通过');
  setTimeout(() => process.exit(fails ? 1 : 0), 300);
})().catch(e => {
  console.error('端到端检查失败：' + (e && e.stack ? e.stack : e));
  cleanup();
  process.exit(1);
});
