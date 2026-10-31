/* ================================================================
   状态 · 持久化 · 派生
   ================================================================ */
const D_FIRST = keyOf(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
const D_RATED1 = offsetKey(-12), D_RATED2 = offsetKey(-5), D_SERVED = offsetKey(-1);
const D_GIFT = offsetKey(-7), D_GRANT = D_FIRST;

function seedState() {
  const dishes = SEED_DISHES.map(d => Object.assign({}, d, {
    cats: d.cats.slice(), ingredients: d.ingredients.slice(), steps: d.steps.slice(), reviews: [],
  }));
  const ledger = [
    { d: D_SERVED, t: '点菜 · 可乐鸡翅 + 玉米排骨汤', a: -11, k: 'dish', ref: 'xsf' + shortDate(D_SERVED) + '-03' },
    { d: D_RATED2, t: '点菜 · 番茄鸡蛋面 + 焦糖布丁×2', a: -10, k: 'dish', ref: 'xsf' + shortDate(D_RATED2) + '-02' },
    { d: D_RATED1, t: '点菜 · 红烧肉', a: -8, k: 'dish', ref: 'xsf' + shortDate(D_RATED1) + '-01' },
    { d: D_GIFT, t: '生日加餐补贴', a: 50, k: 'gift', ref: null },
    { d: D_GRANT, t: cnMonth(D_GRANT) + '零花钱到账', a: 100, k: 'coin', ref: null },
  ].map((e, i) => Object.assign({ id: 'l' + (i + 1), ts: dateOf(e.d).getTime() }, e));
  const orders = [
    { id: 'xsf' + shortDate(D_SERVED) + '-03', d: D_SERVED, items: { kele: 1, tang: 1 }, total: 11, chefState: 'served',
      when: '今晚 18:30', prefs: ['多放辣'], note: '', nagCount: 1, reviewed: false, review: null },
    { id: 'xsf' + shortDate(D_RATED2) + '-02', d: D_RATED2, items: { fanqie: 1, buding: 2 }, total: 10, chefState: 'rated',
      when: '今晚 18:30', prefs: [], note: '', nagCount: 0, reviewed: true,
      review: { hearts: 5, text: '布丁是我的，面也归我', d: D_RATED2 } },
    { id: 'xsf' + shortDate(D_RATED1) + '-01', d: D_RATED1, items: { hongshaorou: 1 }, total: 8, chefState: 'rated',
      when: '今晚 18:30', prefs: ['汤汁留多点'], note: '', nagCount: 0, reviewed: true,
      review: { hearts: 5, text: '连干三碗米饭，大厨今晚很可以', d: D_RATED1 } },
  ];
  /* 菜品评价由订单单向回写，避免 V1 里 dish.last 与 orders 两处数据打架 */
  orders.filter(o => o.reviewed).forEach(o => Object.keys(o.items).forEach(id => {
    const d = dishes.find(x => x.id === id);
    if (d) d.reviews.push({ d: o.d, hearts: o.review.hearts, text: o.review.text, ref: o.id });
  }));
  return {
    meta: { schemaVer: SCHEMA_VER, today: todayKey(), created: todayKey(), opening: 0,
      lastCopy: {}, copyHit: {}, seq: 4, grantMonth: monthKey(todayKey()), streak: 1,
      seenKitchen: false, degraded: false, refreshCount: 0 },
    me: 'baby',
    dishes: dishes,
    cart: {}, favs: ['hongshaorou', 'buding'],
    wished: [
      { id: 'w1', name: '酸汤肥牛', d: offsetKey(-2), status: 'learning', from: 'search' },
      { id: 'w2', name: '肉蟹煲', d: offsetKey(-6), status: 'new', from: 'search' },
    ],
    prefs: [], orderNote: '', when: 'tonight',
    wallet: { balance: 121 },
    ledger: ledger, orders: orders,
    inbox: [{ id: 'b1', kind: 'aegyo', d: todayKey(), ts: Date.now(), status: 'waiting', note: '想要纪念日那顿' }],
    ordersTab: 'all', cat: 'all', q: '', loading: false, screen: 'home',
    ledgerSync: 'ok', detailId: null, lastOrderId: null, reviewOrderId: null, scrollPos: {},
    reviewDraft: { hearts: 5, text: '' }, pickedArt: null, formForWish: null, editDishId: null,
    renderLimit: RENDER_STEP, kitchenLimit: 12, kitchenQ: '', filters: {}, filterDraft: null, filterMore: false, removedIds: [],
  };
}

/* ---------- 存储：不可用则降级内存，坏数据退回种子 ---------- */
let memStore = null;
const storage = (() => {
  let usable = true;
  try { const t = LS_KEY + '.__probe'; localStorage.setItem(t, '1'); localStorage.removeItem(t); }
  catch (e) { usable = false; }
  return {
    get usable() { return usable; },
    read() { try { return usable ? localStorage.getItem(LS_KEY) : memStore; } catch (e) { usable = false; return memStore; } },
    write(str) { try { if (usable) localStorage.setItem(LS_KEY, str); else memStore = str; return true; }
    catch (e) { usable = false; memStore = str; return false; } },
    drop() { try { if (usable) localStorage.removeItem(LS_KEY); } catch (e) {} memStore = null; },
  };
})();

/* 版本迁移表：key 是"旧版本号"，值是升到下一版的函数。目前没有旧版在野外 */
const MIGRATIONS = {};
/* v2→v3：补 10 道家常菜。只补本版新增的 id —— 用户自己下架的菜不会被复活 */
const V3_ADDED_IDS = ['fanqiechao', 'tudousi', 'xilanhua', 'doujiao', 'huaji', 'yuxiang', 'gongbao', 'danchaofan', 'zicaitang', 'donggua'];
MIGRATIONS[2] = function (s) {
  const have = new Set((s.dishes || []).map(d => d.id));
  const add = SEED_DISHES.filter(d => V3_ADDED_IDS.indexOf(d.id) >= 0 && !have.has(d.id)).map(d => Object.assign({}, d, {
    cats: d.cats.slice(), ingredients: d.ingredients.slice(), steps: d.steps.slice(), reviews: [],
  }));
  s.dishes = (s.dishes || []).concat(add);
  return s;
};
/* v3→v4：菜品库 20 → 302 道。补种子由 mergeState 统一做（按 id 差集），
   这一步只保证 removedIds 存在，避免老存档没有这个字段 */
MIGRATIONS[3] = function (s) { s.removedIds = Array.isArray(s.removedIds) ? s.removedIds : []; return s; };
/* 扩展菜旧位置 ID（d1、d2...）→ 新稳定 ID。映射冻结在 seed-dishes 的 legacyIds 里，
   换版本、加菜、重排都不会改变已有菜的 ID，老存档里的购物车/收藏/订单也跟着迁移 */
function remapDishId(id) { return LEGACY_DISH_IDS[id] || id; }
function remapIdMap(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  return Object.keys(obj).reduce((out, id) => (out[remapDishId(id)] = obj[id], out), {});
}
function migrateLegacyDishIds(s) {
  if (!s || !Object.keys(LEGACY_DISH_IDS).length) return s;
  if (Array.isArray(s.dishes)) s.dishes = s.dishes.map(d => d && typeof d === 'object'
    ? Object.assign({}, d, { id: remapDishId(d.id) }) : d);
  s.cart = remapIdMap(s.cart);
  if (Array.isArray(s.favs)) s.favs = s.favs.map(remapDishId);
  if (Array.isArray(s.removedIds)) s.removedIds = s.removedIds.map(remapDishId);
  if (Array.isArray(s.orders)) s.orders.forEach(o => {
    if (!o || typeof o !== 'object') return;
    o.items = remapIdMap(o.items);
    o.snap = remapIdMap(o.snap);
  });
  if (s.detailId) s.detailId = remapDishId(s.detailId);
  return s;
}
function normalize(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const meta0 = raw.meta && typeof raw.meta === 'object' ? raw.meta : null;
  const ver = meta0 && typeof meta0.schemaVer === 'number' ? meta0.schemaVer : null;
  if (ver === null) return null;                                   // 认不出结构
  if (ver > SCHEMA_VER) return null;                                // 新版本写的，读不懂就重来
  try { let cur = raw; for (let v = ver; v < SCHEMA_VER; v++) { if (!MIGRATIONS[v]) return null; cur = MIGRATIONS[v](cur); }
    /* 迁移结果必须继续往下走：V2 这里原本用的是 raw，迁移白做（MIGRATIONS 当时为空，未暴露） */
    cur = migrateLegacyDishIds(cur);
    return mergeState(seedState(), cur); }
  catch (e) { return null; }
}
function mergeState(base, raw) {
  /* Object.assign 会用存档覆盖 base 的字段，种子菜单要先留一份引用，
     否则下面"补种子"遍历的其实是存档自己 */
  const seedDishes = base.dishes;
  const meta0 = raw.meta && typeof raw.meta === 'object' ? raw.meta : null;
  const s = Object.assign(base, raw);
  s.meta = Object.assign(base.meta, meta0 || {});
  s.meta.schemaVer = SCHEMA_VER;
  s.wallet = Object.assign(base.wallet, raw.wallet || {});
  if (!Array.isArray(s.dishes) || !s.dishes.length) s.dishes = seedDishes;
  /* 菜品库会随版本增长：存档里缺的种子菜要补进来，否则老用户永远停在第一次见到的菜单。
     用户主动下架过的 id 记在 removedIds 里，这些不复活 */
  else {
    const removed = new Set(Array.isArray(s.removedIds) ? s.removedIds : []);
    const have = new Set(s.dishes.map(d => d.id));
    seedDishes.forEach(d => { if (!have.has(d.id) && !removed.has(d.id)) s.dishes.push(d); });
  }
  if (!Array.isArray(s.ledger)) s.ledger = base.ledger;
  if (!Array.isArray(s.orders)) s.orders = base.orders;
  if (!Array.isArray(s.inbox)) s.inbox = base.inbox;
  if (!Array.isArray(s.wished)) s.wished = base.wished;
  if (!Array.isArray(s.favs)) s.favs = base.favs;
  if (!Array.isArray(s.prefs)) s.prefs = [];
  s.dishes = s.dishes.map(d => Object.assign({}, d, {
    cats: d.cats || [], ingredients: d.ingredients || [], steps: d.steps || [], reviews: d.reviews || [],
  }));
  /* 购物车与订单只保留仍存在的菜品，避免 V1 那种按 id 取空直接抛错 */
  const known = new Set(s.dishes.map(d => d.id));
  const cleanItems = it => Object.keys(it || {}).filter(k => known.has(k)).reduce((a, k) => (a[k] = it[k], a), {});
  s.cart = cleanItems(s.cart);
  s.favs = s.favs.filter(id => known.has(id));   /* 老存档里的失效收藏也一并清掉 */
  /* 订单是历史快照：菜下架了也不能把条目从订单里删掉，补一份名字和图，
     否则历史订单会少一道菜、或者显示成「这道菜已下架」占位 */
  s.orders.forEach(o => {
    o.snap = o.snap || {};
    Object.keys(o.items).forEach(id => {
      if (o.snap[id]) return;
      const d = s.dishes.find(x => x.id === id);
      if (d) o.snap[id] = { name: d.name, art: d.art, price: d.price };
    });
  });
  s.orders = s.orders.filter(o => Object.keys(o.items).length);
  s.me = s.me === 'chef' ? 'chef' : 'baby';
  s.meta.opening = base.meta.opening;
  s.renderLimit = RENDER_STEP;   /* 刷新等于重新开始，列表别接着上次展开到 200 条 */
  s.meta.lastCopy = s.meta.lastCopy || {};
  s.meta.copyHit = s.meta.copyHit || {};
  return s;
}

function loadState() {
  const raw = storage.read();
  if (!raw) return { state: seedState(), reason: 'missing' };
  try {
    const s = normalize(JSON.parse(raw));
    if (!s) return { state: seedState(), reason: 'version' };
    const keep = state; state = s;
    const sane = balanceCheck();
    state = keep;
    if (!sane) { const fb = seedState(); fb.meta.degraded = true; return { state: fb, reason: 'inconsistent' }; }
    return { state: s, reason: 'ok' };
  } catch (e) { return { state: seedState(), reason: 'parse' }; }
}

let state = seedState();
const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => Array.prototype.slice.call((el || document).querySelectorAll(s));
const FOCUSABLE = 'button,[href],input,textarea,select,[tabindex]:not([tabindex="-1"])';
/* 会被 commit 重绘重建的输入框：重绘后要把焦点和光标位置还回去 */
const FOCUS_KEEP = /^(note-input|rv-text|ag-note|wish-name|kitchen-search|dn-name|dn-price|dn-time|dn-note|dn-ing|dn-steps)$/;

/* 全量序列化约 150KB，点一下加号就同步写一次 localStorage 会有可感知卡顿，
   改成 150ms 防抖；页面隐藏/关闭时补写一次，避免丢最后一步 */
let saveTimer = null;
function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveTimer = null; storage.write(JSON.stringify(state)); }, 150);
}
function saveNow() {
  clearTimeout(saveTimer); saveTimer = null;
  storage.write(JSON.stringify(state));
}
document.addEventListener('visibilitychange', () => { if (document.hidden && saveTimer) saveNow(); });
window.addEventListener('pagehide', () => { if (saveTimer) saveNow(); });
function balanceCheck() {
  const sum = state.ledger.reduce((a, e) => a + e.a, 0);
  const expect = +(state.meta.opening + sum).toFixed(1);
  return Math.abs(expect - state.wallet.balance) < 0.05;
}
/* 所有状态变更走这里：改 → 存 → 重绘当前屏；余额/账本不一致就在控制台喊出来。
   重绘会重建 DOM，所以滚动位置与输入焦点必须在重绘前存、重绘后还 */
function commit(mutate, opts) {
  const o = opts || {};
  const sc0 = $('#' + state.screen + '-scroll');
  const keepTop = sc0 ? sc0.scrollTop : 0;
  const ae = document.activeElement;
  const keepFocus = ae && ae.id && FOCUS_KEEP.test(ae.id)
    ? { id: ae.id, s: ae.selectionStart, e: ae.selectionEnd } : null;
  if (mutate) mutate();
  rolloverDay();
  saveState();
  if (!balanceCheck()) console.warn('[小食光] 余额与账本对不上：', state.wallet.balance, '≠', state.meta.opening, '+Σ流水');
  if (!o.noRender) RENDER[state.screen] && RENDER[state.screen]();
  if (!o.noChrome) renderChrome();
  if (!o.noRender) {
    const sc1 = $('#' + state.screen + '-scroll');
    if (sc1 && keepTop) sc1.scrollTop = keepTop;
    if (keepFocus) {
      const el = document.getElementById(keepFocus.id);
      if (el) {
        el.focus({ preventScroll: true });
        try { el.setSelectionRange(keepFocus.s, keepFocus.e); } catch (e) {}
      }
    }
  }
}

/* 跨天：撒娇次数（由 inbox 派生）自动过期、月度发放真实到账、连续天数递增 */
function rolloverDay() {
  const t = todayKey();
  if (state.meta.today === t) { ensureGrant(); return; }
  const gap = daysBetween(state.meta.today, t);
  state.meta.today = t;
  state.meta.streak = gap > 0 && gap <= 1 ? state.meta.streak + 1 : 1;
  state.inbox.forEach(b => { if (b.status === 'waiting' && b.d !== t) b.status = 'expired'; });
  ensureGrant();
  saveState();
}
function ensureGrant() {
  const m = monthKey(todayKey());
  if (state.meta.grantMonth === m) return;
  state.meta.grantMonth = m;
  state.wallet.balance = +(state.wallet.balance + 100).toFixed(1);
  state.ledger.unshift({ id: 'l' + (++state.meta.seq), d: todayKey(), ts: Date.now(), t: cnMonth(m) + '零花钱到账', a: 100, k: 'coin', ref: null });
}
function aegyoSentToday() { return state.inbox.filter(b => b.kind === 'aegyo' && b.d === todayKey()).length; }
function bookMoney(amount, title, kind, ref) {
  state.wallet.balance = +(state.wallet.balance + amount).toFixed(1);
  state.ledger.unshift({ id: 'l' + (++state.meta.seq), d: todayKey(), ts: Date.now(), t: title, a: +amount.toFixed(1), k: kind || 'coin', ref: ref || null });
}

/* ---------- 派生：份 / 道 / 价 / 评分 ---------- */
const dish = id => state.dishes.find(d => d.id === id) || {
  id: '?', name: '这道菜已下架', cats: [], price: 0, time: 0, spicy: 0, art: 'unknown',
  desc: '大厨把它从菜单里撤下了', note: '', ingredients: [], steps: [], servings: '—', difficulty: '—', reviews: [], unknown: true,
};
const liveItems = () => Object.keys(state.cart).filter(id => !dish(id).unknown);
const cartQty = () => liveItems().reduce((a, id) => a + state.cart[id], 0);
const cartDishes = () => liveItems().length;
const cartTotal = () => +liveItems().reduce((a, id) => a + dish(id).price * state.cart[id], 0).toFixed(1);
const minPrice = () => Math.max(1, Math.min.apply(null, state.dishes.map(d => d.price)));
const lastReview = d => d.reviews.length ? d.reviews[d.reviews.length - 1] : null;
const ratingOf = d => d.reviews.length ? +(d.reviews.reduce((a, r) => a + r.hearts, 0) / d.reviews.length).toFixed(1) : null;
function rebuyOf(id) {
  return state.orders.filter(o => o.items[id] && ['pending', 'accepted', 'cooking', 'served', 'rated'].includes(o.chefState))
    .reduce((a, o) => a + o.items[id], 0);
}
const orderById = id => state.orders.find(o => o.id === id);
const servedOrders = () => state.orders.filter(o => o.chefState === 'served');
const openOrders = () => state.orders.filter(o => ['pending', 'accepted', 'cooking'].includes(o.chefState));
const waitingAegyo = () => state.inbox.filter(b => b.kind === 'aegyo' && b.status === 'waiting');
/* 角色门控：只列"另一方才能做"的动作，其余双方共用 */
const BABY_ONLY = ['add', 'inc', 'del', 'pay', 'pay-blocked', 'again', 'cuishou', 'order-cancel',
  'aegyo', 'aegyo-send', 'rate-open', 'rate-hearts', 'rate-quick', 'rate-submit',
  'prefchip', 'when', 'wish', 'wish-submit', 'open-wish'];
const CHEF_ONLY = ['chef-accept', 'chef-decline', 'chef-cook', 'chef-serve', 'aegyo-approve', 'aegyo-reject',
  'aegyo-reject-do', 'wish-learn', 'wish-remove', 'dish-new', 'dish-edit', 'dish-submit', 'dish-del', 'dish-del-do',
  'art-pick', 'nav-kitchen'];
const can = action => (state.me === 'chef' ? BABY_ONLY : CHEF_ONLY).indexOf(action) < 0;
function tagsOf(d) { return (d.cats || []).concat(['spicy' + d.spicy, 'difficulty' + d.difficulty]); }
/* 搜索热路径：haystack 按菜品对象缓存。WeakMap 以对象为 key，存档重载后自动失效，
   不会写进 localStorage */
const hayCache = new WeakMap();
function hayOf(d) {
  let h = hayCache.get(d);
  if (h === undefined) {
    h = [d.name, d.desc, d.note, d.difficulty, d.servings, d.cuisine, d.main, d.method]
      .concat(d.ingredients || [], d.steps || []).filter(Boolean).join('|').toLowerCase();
    hayCache.set(d, h);
  }
  return h;
}
function matchScore(d, kw) {
  if (!kw) return 1;
  const k = kw.toLowerCase();
  const hay = hayOf(d);
  const syn = SYNONYM[kw];
  if (syn) {
    if (syn.some(t => tagsOf(d).indexOf(t) >= 0)) return 2;
    if (STRICT_SYNONYM.indexOf(kw) >= 0) return 0;
  }
  if (hay.indexOf(k) >= 0) return 2;
  const catHit = (d.cats || []).some(c => { const cc = CATS.find(x => x.id === c); return cc && cc.label.indexOf(kw) >= 0; });
  if (catHit) return 2;
  const set = Array.from(new Set(k.replace(/\s/g, '')));
  if (!set.length) return 1;
  const hit = set.filter(ch => hay.indexOf(ch) >= 0).length;
  return hit / set.length >= .6 ? 1 : 0;
}
/* 多维筛选：菜系/主料/做法/耗时/价位/辣度，单值，与分类、搜索是"与"关系 */
function passFilters(d) {
  const f = state.filters || {};
  if (f.cuisine && d.cuisine !== f.cuisine) return false;
  if (f.main && d.main !== f.main) return false;
  if (f.method && d.method !== f.method) return false;
  if (f.spicy != null && f.spicy !== '' && d.spicy !== +f.spicy) return false;
  if (f.time) { const t = TIME_BANDS.find(x => x.id === f.time); if (t && d.time > t.max) return false; }
  if (f.price) { const p = PRICE_BANDS.find(x => x.id === f.price); if (p && d.price > p.max) return false; }
  return true;
}
function filterCount() { return Object.keys(state.filters || {}).filter(k => state.filters[k] !== '' && state.filters[k] != null).length; }
/* 用一组候选筛选算命中数，不污染 state.filters（抽屉预览用） */
function countWith(f) {
  const keep = state.filters;
  state.filters = f || {};
  try { return filteredDishes().length; }
  finally { state.filters = keep; }
}
function filteredDishes() {
  const kw = state.q.trim();
  return state.dishes.filter(d => {
    if (state.cat === 'fav') { if (!state.favs.includes(d.id)) return false; }
    else if (state.cat !== 'all' && (d.cats || []).indexOf(state.cat) < 0) return false;
    if (!passFilters(d)) return false;
    return matchScore(d, kw) > 0;
  }).sort((a, b) => matchScore(b, kw) - matchScore(a, kw));
}
/* 首屏插画铺满 390×168，相当于把 96×96 的图放大约 4 倍、只保留中间一段。
   构图密度不够的图放大后会糊成几条色块（实测土豆丝、蛋炒饭就是），
   所以轮换池用白名单：这 8 道元素够多，经得起放大。其余菜在列表里用 92px 缩略图，不受影响 */
/* 首屏插画铺满 390×168 相当于把 96×96 放大约 4 倍、只保留中间 41%。
   试过改成 meet 完整显示，但 168×168 在 390 宽卡片里只占 43%，两侧大片留白，
   单张看像图没加载出来，所以维持 slice + 只放构图经得起裁切的 8 道。
   要扩池得先补画，不是改参数能解决的 */
const HERO_POOL = ['hongshaorou', 'jinian', 'kele', 'zhengyu', 'mapo', 'xilanhua', 'gongbao', 'tang'];
function heroDish() {
  /* sign 只影响角标文案，不再决定曝光资格：池从 2 道扩到 8 道，按日哈希轮换 */
  const pool = state.dishes.filter(d => HERO_POOL.indexOf(d.id) >= 0);
  const list = pool.length ? pool : state.dishes;
  if (!list.length) return null;
  return list[Math.floor(rng(LS_KEY, 'hero', state.meta.today)() * list.length)];
}

/* ---------- 小工具 ---------- */
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const f1 = x => String(+(x).toFixed(1));
const IC = (name, style) => '<svg class="icon" viewBox="0 0 24 24"' + (style ? ' style="' + style + '"' : '') +
  ' aria-hidden="true" focusable="false"><use href="#i-' + name + '"></use></svg>';
function artSvg(artKey, label, fit) {
  const key = ART_KEYS.indexOf(artKey) >= 0 ? artKey : 'unknown';
  /* 大图（hero）用 meet 完整显示：96×96 铺 390×168 只保留中间 41%，
     香菇滑鸡会只剩两朵蘑菇、鱼香肉丝只剩三条线；小图（92px 缩略图）仍 slice 填满 */
  return '<svg class="art" viewBox="0 0 96 96" preserveAspectRatio="xMidYMid ' + (fit || 'slice') + '" role="img" aria-label="' +
    esc((label || '菜品') + '插画') + '"><use href="#art-' + key + '"></use></svg>';
}
/* 保留 V1 的函数名与调用点：现在只给真实 <img>（未来用户上传图片）挂兜底 */
function armImgs(scope) {
  $$('img', scope).forEach(im => {
    if (im.dataset.armed) return;
    im.dataset.armed = '1'; im.loading = 'lazy';
    im.addEventListener('error', () => { im.onerror = null; im.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"/>'; }, { once: true });
  });
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), TOAST_MS);
}
function announce(msg) { const l = $('#live-region'); l.textContent = ''; setTimeout(() => { l.textContent = msg; }, 40); }
function heartsRow(n) { let h = ''; for (let i = 0; i < 5; i++) h += IC(i < n ? 'heart-fill' : 'heart', 'width:15px;height:15px'); return h; }
function burstConfetti(scope, n) {
  if (reduced() || !scope) return;
  const colors = ['#EFA9B5', '#E2798C', '#F2B33D', '#FBEFD3', '#F8D9DE'];
  for (let i = 0; i < (n || 30); i++) {
    const s = document.createElement('i'); s.className = 'cf';
    const size = 5 + Math.random() * 7;
    s.style.cssText = 'left:' + (Math.random() * 100) + '%;width:' + size + 'px;height:' + (size * (Math.random() > .5 ? 1 : .45)) + 'px;' +
      'background:' + colors[i % colors.length] + ';border-radius:' + (Math.random() > .5 ? '50%' : '3px') +
      ';animation:cfFall ' + (.9 + Math.random() * .6) + 's ' + (Math.random() * .25) + 's cubic-bezier(.2,0,0,1) forwards;';
    scope.appendChild(s);
    setTimeout(() => s.remove(), 1900);
  }
}
function rollNum(el, to, suffix) {
  if (!el) return;
  const sfx = suffix === undefined ? ' 零花钱' : suffix, dec = to % 1 ? 1 : 0;
  if (reduced()) { el.textContent = to.toFixed(dec) + sfx; return; }
  const t0 = performance.now(), dur = 550;
  requestAnimationFrame(function tick(t) {
    const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    el.textContent = (to * e).toFixed(dec) + sfx;
    if (p < 1) requestAnimationFrame(tick);
  });
}
const WHEN_LABEL = id => (WHEN_OPTS.find(w => w.id === id) || WHEN_OPTS[0]).label;
const ETA_MAP = { tonight: '今晚 18:30', lunch: '明天午餐', chef: '大厨看着安排，但不会让你久等' };
