/* ================================================================
   路由 · 无障碍收口 · 动作表
   ================================================================ */
const RENDER = { home: renderHome, detail: renderDetail, order: renderOrder, success: renderSuccess,
  orders: renderOrders, wallet: renderWallet, kitchen: renderKitchen, review: renderReview };
const TAB_SCREENS = ['home', 'orders', 'wallet', 'kitchen'];
let modalOpen = false;
const a11yBackup = new WeakMap();

function setA11yOff(el, off) {
  if (!el) return;
  el.setAttribute('aria-hidden', off ? 'true' : 'false');
  if ('inert' in HTMLElement.prototype) { el.inert = off; return; }
  if (off) {
    const saved = $$(FOCUSABLE, el).map(f => { const t = f.getAttribute('tabindex'); f.tabIndex = -1; return t; });
    a11yBackup.set(el, saved);
  } else {
    const saved = a11yBackup.get(el);
    if (saved) { $$(FOCUSABLE, el).forEach((f, i) => { const t = saved[i]; if (t === null || t === undefined) f.removeAttribute('tabindex'); else f.setAttribute('tabindex', t); }); a11yBackup.delete(el); }
  }
}
/* 只有一个源决定谁可交互：当前屏 + 是否有弹窗压在上面。
   屏内的悬浮条与底部操作条随父屏一起被 inert，不用单独处理 */
function syncA11y() {
  const active = $('.screen.active');
  $$('.screen').forEach(s => setA11yOff(s, modalOpen || s !== active));
  setA11yOff($('#tab-bar'), modalOpen);
}
function navTo(target, opts) {
  opts = opts || {};
  if (!RENDER[target]) { console.warn('[小食光] 没有这块屏：', target); return; }
  if (target === 'kitchen' && state.me !== 'chef') { toast('先切到大厨身份，才进得了厨房'); return; }
  if (target === 'order' && state.me !== 'baby') { toast('大厨不用付钱，去工作台接单'); target = 'kitchen'; }
  if (target === 'review' && !orderById(state.reviewOrderId)) { toast('先点一份，再回来打分'); return; }
  /* 进厨房前先把展开数量重置：管理界面每次进来都从头看，且必须在 RENDER 之前，
     否则这一次渲染用的还是上次的 300 条 */
  if (target === 'kitchen') {
    state.kitchenLimit = 12;
    state.kitchenQ = '';
    if (!state.meta.seenKitchen) { state.meta.seenKitchen = true; saveState(); }
  }
  const sc0 = $('#' + state.screen + '-scroll'); if (sc0) state.scrollPos[state.screen] = sc0.scrollTop;
  $('#shell').classList.toggle('nav-back', opts.dir === 'back');
  state.screen = target;
  $$('.screen').forEach(s => s.classList.remove('active'));
  const el = $('.screen[data-screen="' + target + '"]');
  RENDER[target]();
  if (state.screen !== target) return;                    // 渲染中被改道，交给内层 navTo 收尾
  el.classList.add('active');
  $('#tab-bar').classList.toggle('hidden', TAB_SCREENS.indexOf(target) < 0);
  renderChrome(); syncA11y(); updateCartBar(); updateDetailStrip();
  document.title = '小食光 · ' + SCREEN_TITLE[target];
  const sc = $('#' + target + '-scroll'); if (sc) sc.scrollTop = state.scrollPos[target] || 0;
  const h = el.querySelector('.scr-h'); if (h) h.focus({ preventScroll: true });
}
function patchCard(id) {
  const node = $('[data-card="' + id + '"]'); if (!node) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = cardHTML(dish(id));
  node.replaceWith(wrap.firstChild);
}

/* ---------------- 弹窗（焦点陷阱 + 关闭归还 + 定时器回收） ---------------- */
let modalOpener = null, modalTimers = [];
function later(fn, ms) { const t = setTimeout(fn, ms); modalTimers.push(t); return t; }
function openModal(html, label, focusSel) {
  const card = $('#modal-card');
  card.innerHTML = '<div class="modal-grab" aria-hidden="true"></div>' + html;
  card.setAttribute('aria-label', label || '小提示');
  $('#modal-root').classList.add('show');
  $('#modal-root').setAttribute('aria-hidden', 'false');
  if (!modalOpen) modalOpener = document.activeElement;   // 弹窗内换页不覆盖最初的触发点
  modalOpen = true;
  syncA11y();
  const f = focusSel ? $(focusSel, card) : $(FOCUSABLE, card);
  if (f) f.focus();
}
function closeModal() {
  modalTimers.forEach(clearTimeout); modalTimers = [];
  $('#modal-root').classList.remove('show');
  $('#modal-root').setAttribute('aria-hidden', 'true');
  modalOpen = false;
  $('#modal-card').innerHTML = '';
  syncA11y();
  /* 触发点已随重绘消失时，焦点退回当前屏标题，不落回 body */
  const back = modalOpener && document.contains(modalOpener) ? modalOpener : ($('.screen.active .scr-h') || $('#modal-card'));
  if (back) back.focus({ preventScroll: true });
  modalOpener = null;
}
/* ---------------- 订单状态机 ---------------- */
function applyTransition(id, action, payload) {
  const o = orderById(id);
  if (!o) { toast('这单找不到了'); return null; }
  const to = (FLOW[o.chefState] || {})[action];
  if (!to) { toast('这单现在的状态做不了这一步'); return null; }
  o.chefState = to;
  if (to === 'declined' || to === 'cancelled') bookMoney(o.total, '退款 · ' + o.id, 'refund', o.id);
  if (to === 'rated') {
    o.reviewed = true;
    o.review = { hearts: payload.hearts, text: payload.text || '（没写话，心就是话）', d: todayKey() };
    Object.keys(o.items).forEach(did => {
      const d = dish(did);
      if (!d.unknown) d.reviews.push({ d: todayKey(), hearts: payload.hearts, text: o.review.text, ref: o.id });
    });
  }
  return o;
}

/* ---------------- 动作表（一个 action 一个函数，不存在 switch 漏 break） ---------------- */
const ACTIONS = {
  tab: b => navTo(b.dataset.target, { dir: b.dataset.dir }),
  nav: b => navTo(b.dataset.target, { dir: b.dataset.dir }),
  'nav-kitchen': () => navTo('kitchen', { dir: 'fwd' }),
  cat: b => {
    state.cat = b.dataset.id; state.q = ''; state.renderLimit = RENDER_STEP;
    $('#search-input').value = ''; $('#search-clear').classList.remove('show');
    renderHome();
    /* 换了分类就是一批新菜，列表要回到顶部；横向位置交给 centerActiveCat */
    const sc = $('#home-scroll');
    if (sc) sc.scrollTop = 0;
    saveState();
  },
  'load-more': () => { state.renderLimit = (state.renderLimit || RENDER_STEP) + RENDER_STEP; commit(); toast('又加了 ' + RENDER_STEP + ' 道，往下滑看看'); },
  'kitchen-more': () => { state.kitchenLimit = (state.kitchenLimit || 12) + 48; commit(); },
  /* 手气不错：只在当前分类/搜索/筛选/余额范围内选，先避开已在购物车里的菜 */
  surprise: () => {
    const list = filteredDishes().filter(d => state.me === 'chef' || d.price <= state.wallet.balance);
    if (!list.length) {
      toast(state.me === 'chef' ? '当前条件里没有能推荐的菜' : '零花钱不够，先撒个娇再来');
      return;
    }
    const fresh = list.filter(d => !state.cart[d.id]);
    const pool = fresh.length ? fresh : list;
    const d = pool[Math.floor(Math.random() * pool.length)];
    state.detailId = d.id;
    navTo('detail', { dir: 'fwd' });
    toast('今天就它了：' + d.name);
  },
  'open-filter': () => {
    state.filterMore = false;
    state.filterDraft = Object.assign({}, state.filters || {});
    openModal(filterBody(), '筛选菜品', '.flt-chips .chip');
  },
  'set-filter': b => {
    const k = b.dataset.key, v = b.dataset.id;
    const f = state.filterDraft = state.filterDraft || {};
    const on = String(f[k]) === String(v);
    if (on) delete f[k]; else f[k] = v;
    b.classList.toggle('on', !on);
    b.setAttribute('aria-pressed', String(!on));
    /* 同组互斥：点一个，同组其他按钮自动关掉 */
    Array.prototype.forEach.call(b.parentElement.children, x => {
      if (x !== b) { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); }
    });
    const btn = $('[data-action="apply-filter"]');
    if (btn) btn.textContent = '看 ' + countWith(state.filterDraft) + ' 道菜';
  },
  'toggle-filter-more': () => {
    state.filterMore = !state.filterMore;
    const box = $('#flt-extra'), btn = $('.flt-more');
    /* 局部切换而不是重开抽屉：重开会把滚动位置和焦点都重置回顶部 */
    if (box) box.hidden = !state.filterMore;
    if (btn) {
      btn.setAttribute('aria-expanded', String(state.filterMore));
      btn.textContent = moreFilterLabel();
    }
  },
  'apply-filter': () => {
    state.filters = Object.assign({}, state.filterDraft || {});
    state.filterDraft = null;
    closeModal(); state.renderLimit = RENDER_STEP; commit();
  },
  /* 「清空」的语义就是"清空并看全部"，不管在抽屉里还是空态里，一步到位 */
  'clear-filter': () => {
    state.filters = {}; state.filterDraft = null;
    if (modalOpen) closeModal();
    state.renderLimit = RENDER_STEP;
    commit();
  },
  ordertab: b => { state.ordersTab = b.dataset.id; renderOrders(); saveState(); },
  detail: b => { state.detailId = b.dataset.id; navTo('detail', { dir: b.dataset.dir || 'fwd' }); },
  add: b => {
    const id = b.dataset.id, d = dish(id);
    if (d.unknown) return;
    if ((state.cart[id] || 0) >= 99) { toast('一餐点 99 份，大厨的锅要冒烟啦'); return; }
    state.cart[id] = (state.cart[id] || 0) + 1;
    toast('已把「' + d.name + '」放进今日点菜');
    announce('已点 ' + cartDishes() + ' 道，共 ' + cartQty() + ' 份');
    commit(() => { }, { noRender: true });
    if (state.screen === 'home') { patchCard(id); updateCartBar(); }
    else if (state.screen === 'detail') { renderDetail(); }
    b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
  },
  fav: b => {
    const id = b.dataset.id, d = dish(id), i = state.favs.indexOf(id);
    if (i >= 0) { state.favs.splice(i, 1); toast('取消收藏'); } else { state.favs.push(id); toast('已收藏，大厨看到了会开心'); }
    b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    commit(() => { }, { noRender: true });
    if (state.screen === 'home') { patchCard(id); renderChrome(); }
    else if (state.screen === 'detail') renderDetail();
  },
  inc: b => { if ((state.cart[b.dataset.id] || 0) >= 99) { toast('一餐点 99 份，大厨的锅要冒烟啦'); return; } state.cart[b.dataset.id]++; commit(); },
  del: b => {
    const id = b.dataset.id, d = dish(id);
    if (!state.cart[id]) return;
    delete state.cart[id];
    commit();
    toast('已移除「' + d.name + '」' + (cartQty() ? '' : '，篮子空了'));
    announce('已移除 1 道');
  },
  prefchip: b => { const p = b.dataset.id, i = state.prefs.indexOf(p); if (i >= 0) state.prefs.splice(i, 1); else state.prefs.push(p); commit(); },
  when: b => { state.when = b.dataset.id; commit(); },
  pay: () => {
    const ids = liveItems();
    if (!ids.length) { toast('还没点菜呢'); return; }
    const total = cartTotal();
    if (total > state.wallet.balance) { toast(pick('pay.short').replace('%s', f1(+(total - state.wallet.balance).toFixed(1)))); return; }
    const seq = ++state.meta.seq;
    const oid = 'xsf' + shortDate(todayKey()) + '-' + pad2(seq);
    const names = ids.map(i => dish(i).name + (state.cart[i] > 1 ? '×' + state.cart[i] : '')).join(' + ');
    const snap = {};
    Object.keys(state.cart).forEach(id => { const d = dish(id); snap[id] = { name: d.name, art: d.art, price: d.price }; });
    const order = { id: oid, d: todayKey(), items: Object.assign({}, state.cart), snap: snap, total: total, chefState: 'pending',
      when: WHEN_LABEL(state.when), prefs: state.prefs.slice(), note: state.orderNote.trim(), nagCount: 0, reviewed: false, review: null };
    commit(() => {
      state.orders.unshift(order);
      bookMoney(-total, '点菜 · ' + names, 'dish', oid);
      state.cart = {}; state.orderNote = ''; state.lastOrderId = oid;
    }, { noRender: true });
    navTo('success', { dir: 'fwd' });
  },
  'pay-blocked': () => toast('先把菜放进篮子，再付零花钱'),
  cuishou: b => { const o = orderById(b.dataset.id); if (!o) return;
    if (o.nagCount >= 3) { toast('已经催到第四遍了，大厨开始装死'); return; }
    commit(() => { o.nagCount++; }, { noRender: state.screen !== 'orders' });
    toast(pick('chef.nag')); },
  again: b => {
    const o = orderById(b.dataset.id); if (!o) return;
    let added = 0;
    commit(() => { Object.keys(o.items).forEach(id => {
      if (dish(id).unknown) return;
      state.cart[id] = Math.min(99, (state.cart[id] || 0) + o.items[id]); added++;
    }); }, { noRender: true });
    toast(added ? '已把 ' + added + ' 道菜加回今日点菜（原来的没被覆盖）' : '这单里的菜都被下架了');
    navTo('order', { dir: 'fwd' });
  },
  'order-cancel': b => { const o = applyTransition(b.dataset.id, 'cancel'); if (o) { commit(); toast('单撤了，' + f1(o.total) + ' 零花钱已退回'); } },
  'chef-accept': b => { if (applyTransition(b.dataset.id, 'accept')) { commit(); toast(pick('badge.accepted')); } },
  'chef-decline': b => { const o = orderById(b.dataset.id); if (applyTransition(b.dataset.id, 'decline')) { commit(); toast('已退回 ' + f1(o.total) + ' 零花钱'); } },
  'chef-cook': b => { if (applyTransition(b.dataset.id, 'cook')) { commit(); toast('开火了'); } },
  'chef-serve': b => { if (applyTransition(b.dataset.id, 'serve')) { commit(); toast('已喊开饭，等宝贝打分'); } },
  'rate-open': b => { state.reviewOrderId = b.dataset.id; state.reviewDraft = { hearts: 5, text: '' }; navTo('review', { dir: b.dataset.dir || 'fwd' }); },
  'rate-hearts': b => { commit(() => { state.reviewDraft = Object.assign(state.reviewDraft || { hearts: 5, text: '' }, { hearts: +b.dataset.id }); }); },
  'rate-quick': b => { commit(() => {
    const cur = (state.reviewDraft || {}).text || '';
    state.reviewDraft = Object.assign({ hearts: 5, text: '' }, state.reviewDraft, { text: (cur ? cur + '，' : '') + b.dataset.id });
  }); },
  'rate-submit': () => {
    const draft = Object.assign({ hearts: 5, text: '' }, state.reviewDraft);
    const o = applyTransition(state.reviewOrderId, 'rate', draft);
    if (!o) return;
    commit(() => { }, { noRender: true });
    toast('食评已写进这几道菜的详情页');
    navTo('orders', { dir: 'back' });
  },
  aegyo: () => {
    /* 先判额度再开窗：让人写完附言才被拒，是最差的一种反馈 */
    if (aegyoSentToday() >= AEGYO_DAILY_LIMIT) { toast(pick('aegyo.ignore')); return; }
    if (aegyoBudget() <= 0) { toast('今天能批的都批完了，明天再来撒'); return; }
    const gap = aegyoGap();
    const lackHint = state.screen === 'order' && gap > 0
      ? '这单还差 ' + f1(gap) + ' 零花钱，今天最多能批 ' + aegyoBudget() + '。'
      : '';
    openModal(
      '<button class="x-btn" data-action="modal-close" aria-label="关闭">' + IC('close') + '</button>' +
      '<div class="aegyo-art">' + IC('heart-fill', 'width:84px;height:84px;color:var(--rose-500)') + '</div>' +
      '<h3 class="ag-h3">向大厨撒娇</h3>' +
      '<p class="ag-sub">信号发过去，<b>得他那边批了才到账</b><br>' + esc(lackHint) +
      '今天已发出 ' + aegyoSentToday() + ' / ' + AEGYO_DAILY_LIMIT + ' 次</p>' +
      '<textarea class="note-input" id="ag-note" maxlength="30" placeholder="想说的话（可留空）" aria-label="撒娇附言" style="height:56px;margin-top:14px"></textarea>' +
      '<button class="btn btn-primary ag-btn" data-action="aegyo-send">' + IC('spark', 'width:19px;height:19px') + ' 发送撒娇信号</button>',
      '发送撒娇', '.note-input');
  },
  'aegyo-send': () => {
    if (aegyoSentToday() >= AEGYO_DAILY_LIMIT) { toast(pick('aegyo.ignore')); closeModal(); return; }
    const note = ($('#ag-note') || {}).value || '';
    const blob = { id: 'b' + (++state.meta.seq), kind: 'aegyo', d: todayKey(), ts: Date.now(),
      status: 'waiting', note: note.trim() || '想要一点零花钱', amount: null };
    commit(() => { state.inbox.unshift(blob); }, { noRender: true });
    openModal(
      '<div class="aegyo-art done">' + IC('heart-fill', 'width:84px;height:84px;color:var(--rose-500)') + '</div>' +
      '<h3 class="ag-h3">已发出</h3><p class="ag-sub">' + esc(pick('aegyo.sent')) + '<br>余额还是 ' + f1(state.wallet.balance) + '，没动。</p>' +
      '<button class="btn btn-butter ag-btn" data-action="role-set" data-id="chef">' + IC('swap', 'width:19px;height:19px') + ' 切到大厨批复</button>' +
      '<button class="btn btn-ghost ag-btn" data-action="modal-close">先等着</button>', '撒娇已发出', '.btn-butter');
    if (state.screen === 'order') renderOrder();
  },
  'aegyo-approve': b => {
    const blob = state.inbox.find(x => x.id === b.dataset.id);
    if (!blob || blob.status !== 'waiting') { toast('这条已经处理过了'); commit(); return; }
    /* 批复额受当日剩余额度约束：界面显示多少，点下去就是多少 */
    const amount = Math.min(Math.max(0, +b.dataset.amount || 0), aegyoBudget());
    if (!amount) { toast('今天能批的都批完了，明天再来撒'); commit(); return; }
    commit(() => { blob.status = 'approved'; blob.amount = amount; bookMoney(amount, '撒娇充值 · 大厨批的', 'coin'); });
    toast('+' + amount + ' 零花钱到账 · ' + pick('aegyo.approve'));
    burstConfetti($('.screen.active'), 18);
  },
  'aegyo-reject': b => {
    openModal('<h3 class="ag-h3">给个理由</h3><p class="ag-sub">拒绝也要说句话，不然她要继续撒了</p>' +
      '<div style="display:flex;flex-direction:column;gap:10px;margin-top:16px">' +
      CHEF_REJECT_REASONS.map(r => '<button class="btn btn-ghost" style="width:100%" data-action="aegyo-reject-do" data-id="' +
        b.dataset.id + '" data-note="' + esc(r) + '">' + esc(r) + '</button>').join('') +
      '<button class="btn btn-soft" style="width:100%" data-action="modal-close">算了，还是批吧</button></div>', '拒绝撒娇', '.btn-ghost');
  },
  'aegyo-reject-do': b => {
    const blob = state.inbox.find(x => x.id === b.dataset.id);
    if (!blob) { closeModal(); return; }
    commit(() => { blob.status = 'rejected'; blob.reason = b.dataset.note; });
    closeModal(); toast(pick('aegyo.reject'));
  },
  wish: b => {
    const name = (b.dataset.name || '').trim();
    if (!name) { ACTIONS['open-wish'](); return; }
    addWish(name, 'search'); commit();
  },
  'open-wish': () => {
    const list = state.wished.filter(w => w.status !== 'done');
    openModal('<button class="x-btn" data-action="modal-close" aria-label="关闭">' + IC('close') + '</button>' +
      '<h3 class="ag-h3">馋大厨</h3><p class="ag-sub">说个菜名，它进学做清单；大厨那边学会就自动进菜单</p>' +
      '<div style="display:flex;gap:10px;margin-top:14px"><input id="wish-name" placeholder="比如：酸汤肥牛" aria-label="想吃的菜名" ' +
      'style="flex:1;min-height:44px;border:1.5px solid var(--line);border-radius:12px;padding:0 12px;font:inherit;font-size:16px;background:var(--bg);color:var(--ink);outline:none">' +
      '<button class="btn btn-primary" data-action="wish-submit" style="min-height:44px;padding:0 18px">馋一下</button></div>' +
      (list.length ? '<h4 class="sec-h" style="margin:20px 0 8px">' + IC('book') + ' 清单里已有<span class="count">' + list.length + '</span></h4>' +
        list.map(w => '<div class="wish-row"><div style="flex:1;min-width:0"><div class="wr-n">' + esc(w.name) + '</div>' +
        '<div class="wr-s">' + relDate(w.d) + ' · ' + (w.status === 'learning' ? '大厨在偷师' : '刚提交，还没看到') + '</div></div></div>').join('') : ''),
      '馋大厨', '#wish-name');
  },
  'wish-submit': () => {
    const el = $('#wish-name'), name = (el || {}).value ? el.value.trim() : '';
    if (!name) { toast('先说个菜名呀'); return; }
    addWish(name, 'wish'); commit();
    closeModal(); toast(copyWith('wish.add', name));
  },
  'wish-learn': b => { openDishForm(b.dataset.id); },
  'wish-remove': b => { const i = state.wished.findIndex(w => w.id === b.dataset.id); if (i >= 0) state.wished.splice(i, 1); commit(); toast('从学做清单里划掉了'); },
  'dish-new': () => openDishForm(null),
  'dish-edit': b => openDishForm(null, b.dataset.id),
  'dish-submit': () => {
    const g = id => { const el = $('#' + id); return el ? el.value.trim() : ''; };
    const name = g('dn-name'), price = parseFloat(g('dn-price')), time = parseInt(g('dn-time'), 10);
    if (!name) { toast('菜名总要写一个'); return; }
    if (!(price >= 0) || !(time >= 0)) { toast('价格和分钟数得是数字'); return; }
    const editId = state.editDishId, wishId = state.formForWish;
    const dup = state.dishes.find(x => x.name === name && x.id !== editId);
    if (dup) { toast('菜单里已经有「' + name + '」了，换个名字吧'); return; }
    const editDish = editId ? state.dishes.find(x => x.id === editId) : null;
    const cat = g('dn-cat') || 'yingle';
    /* 内置菜可能同时属于多个分类（家常 + 素菜）；只改别的字段时保留原分类 */
    const oldCats = editDish && Array.isArray(editDish.cats) ? editDish.cats : [];
    const cats = editDish && oldCats[0] === cat ? oldCats.slice() : [cat];
    const art = state.pickedArt || ART_KEYS[0];
    const fields = {
      name: name, cats: cats,
      cuisine: g('dn-cuisine') || '融合', main: g('dn-main') || '蔬菜', method: g('dn-method') || '炒',
      price: +price.toFixed(1), time: time, spicy: +g('dn-spicy') || 0, art: art,
      desc: g('dn-desc') || (editId ? '' : '刚进菜单，等着被翻牌'),
      note: g('dn-note') || (editId ? '' : '这道是今天新加的，做法还在磨合，你先把肚子准备好。'),
      ingredients: g('dn-ing').split(/[、,，]/).map(s => s.trim()).filter(Boolean),
      steps: g('dn-steps').split(/[、,，\n]/).map(s => s.trim()).filter(Boolean),
      servings: g('dn-servings') || '两人份', difficulty: g('dn-diff') || '中等',
    };
    commit(() => {
      if (editId) {
        const d = state.dishes.find(x => x.id === editId);
        if (d) { Object.assign(d, fields); hayCache.delete(d); }   /* 保留 id / reviews / byChef / sign；搜索缓存要失效 */
      } else {
        /* ID 不掺菜名：菜名可以带引号/尖括号，放进 data-* 属性会破坏 DOM */
        const id = 'c' + shortDate(todayKey()) + '-' + pad2(++state.meta.seq);
        state.dishes.push(Object.assign({ id: id, reviews: [], byChef: true, sign: false }, fields));
      }
      if (wishId) { const w = state.wished.find(x => x.id === wishId); if (w) w.status = 'done'; }
      state.formForWish = null; state.editDishId = null; state.pickedArt = null;
    });
    closeModal();
    toast(editId ? '「' + name + '」已更新' : (wishId ? copyWith('wish.done', name) : '「' + name + '」已进菜单'));
  },
  'dish-del': b => {
    const d = dish(b.dataset.id);
    openModal('<h3 class="ag-h3">下架「' + esc(d.name) + '」？</h3>' +
      '<p class="ag-sub">已有的订单和食评会保留，只是菜单里不再出现，也没法再点。</p>' +
      '<button class="btn btn-primary ag-btn" data-action="dish-del-do" data-id="' + esc(d.id) + '">确认下架</button>' +
      '<button class="btn btn-ghost ag-btn" data-action="modal-close">先不下架</button>', '确认下架', '.btn-primary');
  },
  'dish-del-do': b => {
    const i = state.dishes.findIndex(x => x.id === b.dataset.id);
    if (i >= 0) {
      const nm = state.dishes[i].name;
      state.dishes.splice(i, 1);
      delete state.cart[b.dataset.id];
      /* 收藏也要跟着清：否则 chip 仍写「收藏 2」，点进去只剩一张卡 */
      state.favs = state.favs.filter(x => x !== b.dataset.id);
      /* 记下"用户主动下架"，否则下次补种子会把它复活 */
      state.removedIds = state.removedIds || [];
      if (state.removedIds.indexOf(b.dataset.id) < 0) state.removedIds.push(b.dataset.id);
      closeModal(); toast('「' + nm + '」已从菜单下架');
    }
    else closeModal();
    commit();
  },
  'art-pick': b => { state.pickedArt = b.dataset.id; $$('.art-pick button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.id === state.pickedArt))); },
  /* 头像点击直接切到另一方：只有两个身份，二元操作不需要二次确认。
     想保留选择弹窗的话，这里换回 openModal 即可，但两处行为要一致 */
  'role-switch': () => {
    const to = state.me === 'chef' ? 'baby' : 'chef';
    commit(() => { state.me = to; }, { noRender: true });
    navTo(to === 'chef' ? 'kitchen' : 'home', { dir: 'back' });
    toast(to === 'chef' ? '现在是主厨视角，冰箱归你管' : '切回宝贝视角，可以继续点菜');
  },
  'role-set': b => {
    const role = b.dataset.id === 'chef' ? 'chef' : 'baby';
    closeModal();
    commit(() => { state.me = role; }, { noRender: true });
    navTo(role === 'chef' ? 'kitchen' : 'home', { dir: 'back' });
    toast(role === 'chef' ? '现在是主厨视角，冰箱归你管' : '切回宝贝视角，可以继续点菜');
  },
  refresh: () => {
    const n = (state.meta.refreshCount = (state.meta.refreshCount || 0) + 1);
    commit(() => { state.ledgerSync = 'retrying'; }, { noRender: false });
    const willFail = n > 1 && rng(LS_KEY, 'sync', state.meta.today, n)() < .35;
    setTimeout(() => { state.ledgerSync = willFail ? 'fail' : 'ok'; saveState(); renderWallet(); if (!willFail) toast('账本已同步到最新'); else toast('同步出了点小状况'); }, 700);
  },
  'sync-retry': () => {
    commit(() => { state.ledgerSync = 'retrying'; });
    setTimeout(() => { state.ledgerSync = 'ok'; saveState(); renderWallet(); toast('账本已同步到最新'); }, 800);
  },
  'scroll-ledger': () => { const el = $('#ledger-sec'); if (el) el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); },
  'search-clear': () => { state.q = ''; const i = $('#search-input'); i.value = ''; $('#search-clear').classList.remove('show'); renderHome(); i.focus(); },
  'modal-close': () => closeModal(),
  'reset-demo': () => {
    openModal('<h3 class="ag-h3">重置演示数据？</h3><p class="ag-sub">只清掉小食光存在这台设备上的记录：余额、账本、订单、收藏、许愿、新增的菜。<br>不会碰你浏览器的其他数据。</p>' +
      '<button class="btn btn-primary ag-btn" data-action="reset-do">确认重置</button>' +
      '<button class="btn btn-ghost ag-btn" data-action="modal-close">先不重置</button>', '重置演示数据', '.btn-primary');
  },
  'reset-do': () => {
    const me = state.me;
    storage.drop(); state = seedState(); state.me = me; saveState(); closeModal();
    navTo('home', { dir: 'back' }); toast('演示数据已回到初始状态');
  },
};
function addWish(name, from) {
  if (state.wished.some(w => w.name === name && w.status !== 'done')) { toast('「' + name + '」已经在学做清单里啦'); return; }
  state.wished.unshift({ id: 'w' + (++state.meta.seq), name: name, d: todayKey(), status: 'new', from: from });
  toast(copyWith('wish.add', name));
}
function openDishForm(wishId, dishId) {
  const w = wishId ? state.wished.find(x => x.id === wishId) : null;
  const d = dishId ? dish(dishId) : null;
  if (dishId && d.unknown) { toast('这道菜已经不在了'); return; }
  state.formForWish = wishId || null;
  state.editDishId = dishId || null;
  state.pickedArt = d ? d.art : (state.pickedArt || ART_KEYS[Math.floor(rng(LS_KEY, 'artpick', state.meta.today)() * ART_KEYS.length)]);
  const field = (id, label, val, ph, type) =>
    '<label for="' + id + '">' + label + '</label><input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(val || '') + '" placeholder="' + esc(ph || '') + '">';
  const select = (id, label, options, selected) =>
    '<div><label for="' + id + '">' + label + '</label><select id="' + id + '">' +
    options.map(o => '<option value="' + esc(o.id) + '"' + (String(o.id) === String(selected) ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('') +
    '</select></div>';
  const catOpts = CATS.filter(c => c.id !== 'all').map(c => ({ id: c.id, label: c.label }));
  const textOpts = arr => arr.map(x => ({ id: x, label: x }));
  const diffOpts = ['简单', '中等', '高'].map(x => ({ id: x, label: x }));
  const curCat = (d && d.cats && d.cats[0]) || 'yingle';
  const curCuisine = d ? d.cuisine : '融合';
  const curMain = d ? d.main : '蔬菜';
  const curMethod = d ? d.method : '炒';
  const curSpicy = d ? d.spicy : 0;
  const curDiff = d ? d.difficulty : '中等';
  const title = d ? '编辑「' + esc(d.name) + '」' : (w ? '学会「' + esc(w.name) + '」了' : '新增一道菜');
  openModal('<button class="x-btn" data-action="modal-close" aria-label="关闭">' + IC('close') + '</button>' +
    '<h3 class="ag-h3">' + title + '</h3>' +
    '<p class="ag-sub">' + (d ? '保存后保留原来的 ID、收藏和食评' : '写完就进菜单，宝贝那边立刻能点到') + '</p>' +
    '<div class="dish-new-form">' +
    field('dn-name', '菜名', d ? d.name : (w ? w.name : ''), '比如：酸汤肥牛') +
    '<div class="two"><div>' + field('dn-price', '零花钱/份', d ? d.price : '', '12', 'number') + '</div>' +
      '<div>' + field('dn-time', '要做几分钟', d ? d.time : '', '40', 'number') + '</div></div>' +
    '<div class="two">' + select('dn-cat', '分类', catOpts, curCat) + select('dn-spicy', '辣度', SPICY_OPTS, curSpicy) + '</div>' +
    '<div class="two">' + select('dn-cuisine', '菜系', textOpts(CUISINES), curCuisine) + select('dn-main', '主料', textOpts(MAINS), curMain) + '</div>' +
    '<div class="two">' + select('dn-method', '做法', textOpts(METHODS), curMethod) + select('dn-diff', '难度', diffOpts, curDiff) + '</div>' +
    field('dn-servings', '份量', d ? d.servings : '两人份', '两人份') +
    field('dn-desc', '列表里的一句话', d ? d.desc : '', '酸甜开胃，下饭第一名') +
    '<label for="dn-note">大厨的话（显示在详情页）</label>' +
    '<textarea id="dn-note" class="note-input" style="height:56px" placeholder="今晚我请客，你负责吃">' + esc((d && d.note) || '') + '</textarea>' +
    '<label for="dn-ing">食材（用、隔开）</label><input id="dn-ing" value="' + esc(d ? (d.ingredients || []).join('、') : '') + '" placeholder="肥牛卷、金针菇、酸汤料">' +
    '<label for="dn-steps">步骤（用、或换行隔开）</label><textarea id="dn-steps" class="note-input" style="height:64px" placeholder="烧水、下料、肥牛烫十秒">' + esc(d ? (d.steps || []).join('\n') : '') + '</textarea>' +
    '<label>选一张插画</label><div class="art-pick">' + ART_KEYS.map(k =>
      '<button data-action="art-pick" data-id="' + k + '" aria-pressed="' + (state.pickedArt === k) + '" aria-label="插画 ' + k + '">' +
      artSvg(k, k) + '</button>').join('') + '</div>' +
    '</div><button class="btn btn-primary ag-btn" data-action="dish-submit">' + (d ? '保存修改' : '放进菜单') + '</button>',
    d ? '编辑菜品' : '新增菜品', '#dn-name');
}

/* ---------------- 事件绑定 ---------------- */
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const act = btn.dataset.action, fn = ACTIONS[act];
  if (!fn) { console.warn('[小食光] 动作没实现：', act); return; }
  if (!can(act)) { toast('这一步得由' + (state.me === 'chef' ? '宝贝' : '大厨') + '来做'); return; }
  fn(btn, e);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && modalOpen) { closeModal(); return; }
  if (e.key === 'Tab' && modalOpen) {
    const f = $$(FOCUSABLE, $('#modal-card')).filter(x => !x.disabled && x.tabIndex >= 0);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
$('#modal-root').addEventListener('click', e => { if (e.target.id === 'modal-root') closeModal(); });

let searchTimer = null;
let kitchenTimer = null;
function bindSearch() {
  const input = $('#search-input');
  input.addEventListener('input', () => {
    $('#search-clear').classList.toggle('show', !!input.value);
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.q = input.value; state.renderLimit = RENDER_STEP; renderHome(); }, 160);
  });
  /* 厨房菜单搜索是渲染出来的输入框，走委托；重绘后由 FOCUS_KEEP 还焦点 */
  document.addEventListener('input', e => {
    if (!e.target || e.target.id !== 'kitchen-search') return;
    const value = e.target.value;
    clearTimeout(kitchenTimer);
    kitchenTimer = setTimeout(() => {
      state.kitchenQ = value;
      state.kitchenLimit = 12;
      commit();
    }, 160);
  });
  /* 真机键盘别挡住输入：这些字段是渲染出来的，绑定时还不存在，所以走委托 */
  document.addEventListener('focusin', e => {
    const t = e.target;
    if (t && (t.id === 'note-input' || t.id === 'rv-text' || t.id === 'wish-name' || t.id === 'ag-note' || t.id === 'kitchen-search')) {
      setTimeout(() => t.scrollIntoView({ block: 'center', behavior: 'auto' }), 260);
    }
  });
  if (window.visualViewport) {
    visualViewport.addEventListener('resize', () => {
      const kb = Math.max(0, innerHeight - visualViewport.height - visualViewport.offsetTop);
      $$('.action-bar').forEach(b => { b.style.transform = kb ? 'translateY(-' + kb + 'px)' : ''; });
    });
  }
}

/* ---------------- 自检：跑不跑得过，先看这几条 ---------------- */
function selfTest() {
  const report = { pass: [], fail: [] };
  const t = (name, ok) => (ok ? report.pass : report.fail).push(name);
  const cartBefore = state.cart;
  state.cart = { tang: 2, kele: 1 };
  t('份/道拆分', cartQty() === 3 && cartDishes() === 2 && cartTotal() === 16);
  state.cart = cartBefore;
  const declared = new Set($$('[data-action]').map(b => b.dataset.action));
  const handled = new Set(Object.keys(ACTIONS));
  t('动作都有实现', [...declared].every(a => handled.has(a)));
  const renderersUsed = ['home', 'detail', 'order', 'success', 'orders', 'wallet', 'kitchen', 'review'];
  t('八屏渲染器齐全', renderersUsed.every(k => typeof RENDER[k] === 'function'));
  t('余额与账本对得上', balanceCheck());
  t('文案池不与上一次重复', (() => {
    const a = pick('chef.reply'), b = pick('chef.reply');
    return a !== b;
  })());
  t('文案池每条都取得出字符串', Object.keys(COPY).every(k => {
    const v = pick(k, { part: 'evening' });
    return typeof v === 'string' && v.length > 0;
  }));
  t('零花钱种子自洽', +(state.meta.opening + state.ledger.reduce((s, e) => s + e.a, 0)).toFixed(1) === +(state.wallet.balance).toFixed(1));
  /* ---- 以下 8 项守引用完整性：这一轮所有改动都在改引用关系 ---- */
  const catIds = new Set(CATS.map(c => c.id));
  t('分类引用完整', state.dishes.every(d => d.cats.length && d.cats.every(c => catIds.has(c))));
  t('每个菜系都有菜', CATS.filter(c => c.id !== 'all').every(c => state.dishes.some(d => d.cats.indexOf(c.id) >= 0)));
  t('插画引用完整', state.dishes.every(d => ART_KEYS.indexOf(d.art) >= 0)
    && ART_KEYS.every(k => !!document.getElementById('art-' + k)));
  t('首屏池 ≥ 4', state.dishes.filter(d => HERO_POOL.indexOf(d.id) >= 0).length >= 4);
  t('收藏无失效引用', state.favs.every(id => !dish(id).unknown));
  t('撒娇上限 ≤ 30', aegyoCapFor(0) === 10 && aegyoCapFor(15) === 20 && aegyoCapFor(99) === 30
    && [0, 9, 10, 19, 20, 99].every(s => aegyoCapFor(s) >= 10 && aegyoCapFor(s) <= 30));
  t('状态机自洽', Object.keys(FLOW).every(k => Object.keys(FLOW[k]).every(a => !!FLOW[FLOW[k][a]]))
    && Object.keys(FLOW).every(k => typeof pick('badge.' + k) === 'string' && pick('badge.' + k).length > 0));
  t('迁移链完整且幂等', (() => {
    for (let v = 2; v < SCHEMA_VER; v++) if (typeof MIGRATIONS[v] !== 'function') return false;
    const s = { dishes: [{ id: 'hongshaorou' }] };
    MIGRATIONS[2](s); const n = s.dishes.length;
    MIGRATIONS[2](s);
    return s.dishes.length === n && V3_ADDED_IDS.every(id => s.dishes.some(d => d.id === id));
  })());
  t('账本种类合法', state.ledger.every(e => ['coin', 'dish', 'gift', 'refund'].indexOf(e.k) >= 0));
  if (report.fail.length) console.warn('[小食光] 自检未过：', report.fail);
  else console.info('[小食光] 自检通过 ' + report.pass.length + ' 项');
  window.__XSG = { state: state, ACTIONS: ACTIONS, RENDER: RENDER, pick: pick, report: report,
    cartQty: cartQty, cartDishes: cartDishes, cartTotal: cartTotal, balanceCheck: balanceCheck,
    aegyoSentToday: aegyoSentToday, chefMood: chefMood, aegyoSuggest: aegyoSuggest, navTo: navTo,
    commit: commit, applyTransition: applyTransition, openModal: openModal, closeModal: closeModal, dish: dish,
    aegyoCap: aegyoCap, aegyoCapFor: aegyoCapFor, aegyoBudget: aegyoBudget, aegyoAmounts: aegyoAmounts,
    heroDish: heroDish, HERO_POOL: HERO_POOL, CATS: CATS, ART_KEYS: ART_KEYS, FLOW: FLOW, MIGRATIONS: MIGRATIONS, COPY: COPY };
  return report;
}

/* ---------------- 启动 ---------------- */
(function boot() {
  const loaded = loadState();
  state = loaded.state;
  rolloverDay();
  renderChrome();
  state.loading = true;
  navTo('home');
  bindSearch();
  setTimeout(() => { state.loading = false; if (state.screen === 'home') renderHome(); syncA11y(); }, 460);
  if (loaded.reason === 'parse' || loaded.reason === 'version' || loaded.reason === 'inconsistent') {
    state.meta.degraded = true;
    toast(loaded.reason === 'inconsistent' ? '存档的账对不上，已用演示数据重新开始' : '数据格式读不懂，已用演示数据重新开始');
    saveState();
  }
  const styleEl = document.createElement('style');
  styleEl.textContent = '@keyframes cfFall{to{transform:translateY(620px) rotate(230deg);opacity:0}}';
  document.head.appendChild(styleEl);
  selfTest();
})();
