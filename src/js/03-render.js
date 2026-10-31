/* ================================================================
   渲染
   ================================================================ */
const SCREEN_TITLE = { home: '今日菜单', detail: '菜品详情', order: '确认点菜', success: '点菜成功',
  orders: '我的订单', wallet: '我的零花钱', kitchen: '大厨工作台', review: '给这顿饭打分' };

/* 外壳：Tab 栏与身份徽章随角色变化 */
function renderChrome() {
  const chef = state.me === 'chef';
  const d = new Date();
  $('#sb-time').textContent = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  $('#avatar-use').setAttribute('href', chef ? '#i-avatar-chef' : '#i-avatar-baby');
  $('#avatar-tag').textContent = chef ? '厨' : '宝';
  $('#avatar-btn').classList.toggle('chef', chef);
  $('#avatar-btn').setAttribute('aria-label', '当前身份：' + (chef ? '大厨' : '宝贝') + '，点按切换身份');
  $('#head-balance').textContent = f1(state.wallet.balance);
  const tabs = chef
    ? [{ id: 'kitchen', icon: 'pot', label: '厨房', badge: kitchenTodo() }, { id: 'home', icon: 'bowl', label: '菜单' }, { id: 'orders', icon: 'book', label: '订单' }]
    : [{ id: 'home', icon: 'bowl', label: '今日' }, { id: 'orders', icon: 'book', label: '订单', badge: servedOrders().length },
      { id: 'wallet', icon: 'coin', label: '零花钱', badge: waitingAegyo().length }];
  $('#tab-bar').innerHTML = tabs.map(t =>
    '<button class="tab-item' + (state.screen === t.id ? ' on' : '') + '" data-action="tab" data-target="' + t.id + '" data-dir="fwd"' +
    ' aria-label="' + t.label + '"' + (state.screen === t.id ? ' aria-current="page"' : '') + '>' + IC(t.icon, 'width:24px;height:24px') + t.label +
    (t.badge ? '<span class="ti-badge">' + t.badge + '</span>' : '') + '</button>').join('');
}
function kitchenTodo() {
  return openOrders().length + waitingAegyo().length + state.wished.filter(w => w.status !== 'done').length;
}

/* ---------------- 首页 ---------------- */
function renderHome() {
  const chef = state.me === 'chef';
  $('#greet-h1').textContent = pick(chef ? 'greet.head.chef' : 'greet.head');
  /* 日期不进副标题：390 下 21 字会把场景文案挤到第二行，日期在订单/账本里都有 */
  $('#greet-sub').textContent = pick('greet.sub', { part: nowPart() });
  $('#cat-row').innerHTML = CATS.map(c => chipHTML('cat', c.id, c.label, state.cat === c.id)).join('')
    + '<button class="chip chip--fav' + (state.cat === 'fav' ? ' on' : '') + '" data-action="cat" data-id="fav" aria-pressed="' +
    (state.cat === 'fav') + '">' + IC('heart', 'width:13px;height:13px') + '收藏 ' + state.favs.length + '</button>';
  const fc = filterCount(), fb = $('#filter-btn');
  if (fb) {
    fb.className = 'chip chip--filter' + (fc ? ' has' : '');
    fb.innerHTML = IC('filter', 'width:14px;height:14px') + '筛选' + (fc ? '<b>' + fc + '</b>' : '');
  }
  const box = $('#home-list');
  if (state.loading) { box.innerHTML = skelHTML(3); return; }

  const list = filteredDishes();
  const kw = state.q.trim();
  const served = servedOrders();
  let html = '';
  /* 身份提示条：把"我现在是谁""要不要切过去"摆到台面上 */
  if (chef) {
    html += '<div class="role-note chef">' + IC('pot', 'width:18px;height:18px') +
      '<span>大厨视角 · 宝贝的点单和撒娇都在厨房等你</span>' +
      '<button class="rn-btn" data-action="role-set" data-id="baby">切回宝贝</button></div>';
  } else {
    const todo = waitingAegyo().length + openOrders().length;
    if (todo) html += '<button class="role-note baby" data-action="role-set" data-id="chef">' +
      IC('heart', 'width:18px;height:18px') +
      '<span>有 ' + todo + ' 件事等大厨处理 · 点这里去厨房</span></button>';
  }
  if (!chef && served.length) {
    html += '<button class="ready-ribbon" data-action="rate-open" data-id="' + served[0].id + '" data-dir="fwd">' +
      IC('spark', 'width:16px;height:16px') + '大厨说' + pick('badge.served') + '——' + esc(servedNameLine(served[0])) +
      '<span class="rr-go">去评价</span></button>';
  }
  if (!kw && state.cat === 'all' && !filterCount()) {
    const hero = heroDish();
    if (hero) html +=
      '<button class="hero-card" data-action="detail" data-id="' + esc(hero.id) + '" data-dir="fwd" aria-label="看' + esc(hero.name) + '的详情">' +
      '<span class="hc-art">' + artSvg(hero.art, hero.name) + '</span>' +
      '<span class="hero-shade"></span>' +
      '<span class="hero-ribbon">' + IC('spark', 'width:13px;height:13px') + '今日招牌 · ' + (hero.byChef ? '新学的一手' : (hero.sign ? '大厨拿手' : '今天推荐')) + '</span>' +
      '<span class="hero-info"><span><span class="hi-name">' + esc(hero.name) + '</span>' +
      '<span class="hi-sub">' + IC('clock', 'width:12px;height:12px') + '要做 ' + hero.time + ' 分钟 · ' + esc(hero.desc) + '</span></span>' +
      '<span class="hi-price"><small>零花钱</small>' + f1(hero.price) + '</span></span></button>';
  }
  if (filterCount()) {
    const f = state.filters || {};
    const bits = [];
    const catLabel = (CATS.find(c => c.id === state.cat) || {}).label;
    if (state.cat !== 'all' && state.cat !== 'fav' && catLabel) bits.push(catLabel);
    if (f.cuisine) bits.push(f.cuisine);
    if (f.main) bits.push(f.main);
    if (f.method) bits.push(f.method);
    if (f.time) { const t = TIME_BANDS.find(x => x.id === f.time); if (t) bits.push(t.label); }
    if (f.price) { const pb = PRICE_BANDS.find(x => x.id === f.price); if (pb) bits.push(pb.label + ' 元'); }
    if (f.spicy != null && f.spicy !== '') bits.push(['不辣', '微辣', '中辣'][+f.spicy]);
    html += '<div class="filter-summary">' + IC('filter', 'width:14px;height:14px') +
      '<span>' + esc(bits.join(' · ')) + ' · 共 ' + list.length + ' 道</span>' +
      '<button data-action="clear-filter">清空筛选</button></div>';
  }
  if (!list.length) {
    /* 空列表有三种来源：收藏为空、筛选筛没了、搜索没结果。三种文案不能混用，
       否则筛到 0 条时会渲染成「菜单里还没有「」」 */
    const favEmpty = state.cat === 'fav' && !kw;
    const filterEmpty = !kw && !favEmpty && filterCount() > 0;
    const near = (favEmpty || filterEmpty) ? [] : fuzzy(kw).slice(0, 3);
    const emptyTitle = favEmpty ? pick('empty.fav')
      : filterEmpty ? '这个组合下暂时没有菜'
      : copyWith('empty.search', kw);
    const emptyHint = favEmpty ? '在菜单里点心形，就会出现在这里'
      : filterEmpty ? '把条件放宽一点，或者清空筛选看全部'
      : (near.length ? '这几道有点像，先凑合一下？' : '大厨的学做清单还空着位置～');
    html += '<div class="empty-box" data-state="empty">' +
      '<div class="eb-art">' + IC('bowl', 'width:84px;height:84px') + '</div>' +
      '<h3>' + esc(emptyTitle) + '</h3>' +
      '<p>' + emptyHint + '</p>' +
      (near.length ? '<div class="suggest-row">' + near.map(d =>
        '<button class="chip chip--sm" data-action="detail" data-id="' + esc(d.id) + '" data-dir="fwd">' + esc(d.name) + '</button>').join('') + '</div>' : '') +
      (filterEmpty ? '<button class="btn btn-soft" data-action="clear-filter">' + IC('filter') + ' 清空筛选</button>'
        : (chef || favEmpty ? '' : '<button class="btn btn-soft" data-action="wish" data-name="' + esc(kw) + '">' + IC('spark') + ' 去馋大厨，让他学</button>')) +
      '</div>';
  } else {
    const limit = Math.max(RENDER_STEP, state.renderLimit || RENDER_STEP);
    html += list.slice(0, limit).map(cardHTML).join('');
    if (list.length > limit) {
      /* 哨兵在按钮前：滚到这儿就自动加载，按钮留给"不想等"和 IO 不支持的情况 */
      html += '<div class="load-sentinel" aria-hidden="true"></div>' +
        '<button class="btn btn-soft load-more" data-action="load-more">还有 ' +
        (list.length - limit) + ' 道，继续看</button>';
    }
  }
  const wishCount = state.wished.filter(w => w.status !== 'done').length;
  html += '<p class="home-foot">由大厨用爱维护 · 已收录 <b>' + state.dishes.length + '</b> 道菜 · 连续点菜 ' +
    state.meta.streak + ' 天<br>' + (chef
      ? '<button data-action="tab" data-target="kitchen" data-dir="fwd">去工作台（' + kitchenTodo() + ' 件事待办）</button>'
      : (wishCount ? '<button data-action="open-wish">' + '你馋的 ' + wishCount + ' 道还在学做清单里，去看看' + '</button>'
        : '<button data-action="open-wish">想吃什么还没被学？现在馋给大厨</button>')) + '</p>';
  box.innerHTML = html;
  armImgs(box);
  updateCartBar();
  centerActiveCat();
  armLoadMore();
}
/* 滚到底自动加载。每次重绘都要重新挂：哨兵是新 DOM，旧 observer 已经失效 */
let moreIO = null;
function armLoadMore() {
  if (moreIO) { moreIO.disconnect(); moreIO = null; }
  if (!('IntersectionObserver' in window)) return;
  const sentinel = $('.load-sentinel');
  if (!sentinel) return;
  moreIO = new IntersectionObserver(es => {
    if (!es.some(e => e.isIntersecting)) return;
    moreIO.disconnect(); moreIO = null;
    /* 自动加载不弹 toast：用户没点任何东西，弹提示反而吵 */
    state.renderLimit = (state.renderLimit || RENDER_STEP) + RENDER_STEP;
    commit();
  }, { root: $('#home-scroll'), rootMargin: '260px' });
  moreIO.observe(sentinel);
}
/* 横滚时选中的分类可能被右侧渐隐切掉一半：把它滚到可视区中间。
   用直接定位而不是 smooth：renderHome 每次都重建 innerHTML，平滑动画会被下一次重绘打断，
   实测连续点击时停在半路（偏差 27~54px）。等一帧是为了让新 DOM 完成布局 */
function centerActiveCat() {
  requestAnimationFrame(() => {
    const row = $('#cat-row');
    if (!row) return;
    const el = row.querySelector('.chip.on');
    if (!el) return;
    const rr = row.getBoundingClientRect(), er = el.getBoundingClientRect();
    const delta = (er.left - rr.left) - (rr.width - er.width) / 2;
    if (Math.abs(delta) < 6) return;
    row.scrollLeft += delta;
  });
}
/* 筛选抽屉：一组一组 chips，组内互斥，组间叠加。
   抽屉里改的是 filterDraft，点「看 N 道菜」才写回 filters——这样 ESC 关闭等于取消 */
function filterGroup(title, key, opts) {
  const f = state.filterDraft || state.filters || {};
  return '<div class="flt-group"><h5>' + title + '</h5><div class="flt-chips">' +
    opts.map(o => {
      const on = String(f[key]) === String(o.id);
      return '<button class="chip' + (on ? ' on' : '') + '" data-action="set-filter" data-key="' + key +
        '" data-id="' + esc(o.id) + '" aria-pressed="' + on + '">' + esc(o.label) + '</button>';
    }).join('') + '</div></div>';
}
/* 折叠组里已经选了条件时，按钮上标一下，否则关掉抽屉再打开完全看不出来 */
function extraFilterPicked() {
  const f = state.filterDraft || {};
  return ['time', 'price', 'spicy'].some(k => f[k] != null && f[k] !== '');
}
function moreFilterLabel() {
  if (state.filterMore) return '收起更多条件';
  return '更多条件' + (extraFilterPicked() ? '（已选）' : '') + '：耗时 · 价位 · 辣度';
}
function filterBody() {
  return '<div class="flt-body"><button class="x-btn" data-action="modal-close" aria-label="关闭">' + IC('close') + '</button>' +
    '<h3 class="ag-h3">筛选</h3><p class="ag-sub">菜系、主料、做法可以叠加，选完点下面看结果</p>' +
    filterGroup('菜系', 'cuisine', CUISINES.map(c => ({ id: c, label: c }))) +
    filterGroup('主料', 'main', MAINS.map(c => ({ id: c, label: c }))) +
    filterGroup('做法', 'method', METHODS.map(c => ({ id: c, label: c }))) +
    '<div id="flt-extra"' + (state.filterMore ? '' : ' hidden') + '>' +
      filterGroup('耗时', 'time', TIME_BANDS) +
      filterGroup('价位', 'price', PRICE_BANDS) +
      filterGroup('辣度', 'spicy', SPICY_OPTS) +
    '</div>' +
    '<div class="flt-foot">' +
      '<button class="flt-more" data-action="toggle-filter-more" aria-expanded="' + (!!state.filterMore) +
        '" aria-controls="flt-extra">' + moreFilterLabel() + '</button>' +
      '<div class="flt-btns"><button class="btn btn-ghost" data-action="clear-filter">清空筛选</button>' +
      '<button class="btn btn-primary" data-action="apply-filter">看 ' + countWith(state.filterDraft) + ' 道菜</button></div>' +
    '</div></div>';
}
function chipHTML(act, id, label, on) {
  return '<button class="chip' + (on ? ' on' : '') + '" data-action="' + act + '" data-id="' + esc(id) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + esc(label) + '</button>';
}
function skelHTML(n) {
  return '<div class="skel-card" aria-hidden="true"><div class="skel skel-thumb"></div><div class="skel-lines">' +
    '<div class="skel skel-line w60"></div><div class="skel skel-line w90"></div><div class="skel skel-line w40"></div></div></div>'.repeat(n);
}
function metaTags(d) {
  const inCart = state.cart[d.id] || 0;
  const lr = lastReview(d);
  const tags = ['<span class="tag-mini">' + IC('clock', 'width:12px;height:12px') + d.time + '分钟</span>'];
  if (d.spicy) tags.push('<span class="tag-mini">' + IC('flame', 'width:12px;height:12px') + SPICY_LABEL[d.spicy] + '</span>');
  if (lr) tags.push('<span class="tag-mini" style="background:#FFF3E8;color:#8C4A2F">' + IC('heart-fill', 'width:12px;height:12px;color:#E2798C') +
    relDate(lr.d) + ' ' + lr.hearts + '心</span>');
  if (inCart) tags.push('<span class="tag-mini" style="background:var(--rose-50);color:var(--rose-700)">已点×' + inCart + '</span>');
  if (tags.length > 3) return tags.slice(0, 3).join('') + '<span class="tag-mini">+' + (tags.length - 3) + '</span>';
  return tags.join('');
}
function dishThumb(d) {
  if (MAIN_ARTS.indexOf(d.art) >= 0) {
    return '<span class="art-block" style="background:' + (MAIN_TINT[d.main] || '#FCE9EC') + '">' +
      '<b>' + esc((d.name || '?').slice(0, 1)) + '</b></span>';
  }
  return artSvg(d.art, d.name);
}
function cardHTML(d) {
  const chef = state.me === 'chef';
  const fav = state.favs.includes(d.id);
  return '<article class="dish-card" data-card="' + esc(d.id) + '">' +
    '<button class="dish-art-box" data-action="detail" data-id="' + esc(d.id) + '" data-dir="fwd" aria-label="看' + esc(d.name) + '的详情">' +
    dishThumb(d) + '</button>' +
    '<div class="dish-main">' +
    '<button class="dish-open" data-action="detail" data-id="' + esc(d.id) + '" data-dir="fwd" aria-label="看' + esc(d.name) + '的详情">' +
    '<span class="dish-name">' + esc(d.name) + '</span><span class="dish-desc">' + esc(d.desc) + '</span></button>' +
    '<div class="dish-meta">' + metaTags(d) + '</div>' +
    '<div class="dish-foot"><span class="dish-price"><small>零花钱</small>' + f1(d.price) + '</span>' +
    '<span class="dish-acts">' +
    '<button class="fav-btn' + (fav ? ' on' : '') + '" data-action="fav" data-id="' + esc(d.id) + '" aria-label="' +
    (fav ? '取消收藏' : '收藏') + esc(d.name) + '" aria-pressed="' + fav + '">' + IC(fav ? 'heart-fill' : 'heart', 'width:23px;height:23px') + '</button>' +
    (chef ? '' : '<button class="add-btn" data-action="add" data-id="' + esc(d.id) + '" aria-label="把' + esc(d.name) + '加入今日点菜">' + IC('plus', 'width:22px;height:22px') + '</button>') +
    '</span></div></div></article>';
}
function fuzzy(kw) {
  if (!kw) return [];
  return state.dishes.map(d => ({ d: d, s: matchScore(d, kw) })).filter(x => x.s === 1).map(x => x.d);
}
/* 订单是历史快照：菜下架后仍要显示当时的名字和图，不能变成「这道菜已下架」 */
function orderDish(o, id) {
  const snap = o && o.snap && o.snap[id];
  return snap ? { name: snap.name, art: snap.art, price: snap.price, unknown: false } : dish(id);
}
function servedNameLine(o) {
  return Object.keys(o.items).map(id => orderDish(o, id).name).join(' + ');
}
function updateCartBar() {
  const bar = $('#cart-bar'), n = cartQty();
  const show = n > 0 && state.screen === 'home' && state.me === 'baby';
  bar.classList.toggle('show', show);
  bar.setAttribute('aria-hidden', show ? 'false' : 'true');
  if (!show) return;
  $('#cb-count').textContent = n;
  $('#cb-info').innerHTML = '已选 <b>' + cartDishes() + '</b> 道 · <b>' + n + '</b> 份';
  $('#cb-total').textContent = f1(cartTotal());
}

/* ---------------- 详情 ---------------- */
function renderDetail() {
  const d = dish(state.detailId);
  if (!state.detailId || (d.unknown && state.detailId !== '?')) { navTo('home'); return; }
  const chef = state.me === 'chef';
  const fav = state.favs.includes(d.id), inCart = state.cart[d.id] || 0;
  const rating = ratingOf(d), rebuy = rebuyOf(d.id), lr = lastReview(d);
  $('#detail-scroll').innerHTML =
    '<div class="dt-head">' +
    '<button class="icon-btn" data-action="nav" data-target="' + (chef ? 'kitchen' : 'home') + '" data-dir="back" aria-label="返回">' + IC('back') + '</button>' +
    '<h2 class="dt-title">菜品详情</h2><span class="ph"></span></div>' +
    '<div class="dt-body">' +
    '<div class="dt-hero"><span class="hc-art">' + artSvg(d.art, d.name) + '</span>' +
    '<button class="fav-float' + (fav ? ' on' : '') + '" data-action="fav" data-id="' + esc(d.id) + '" aria-label="' +
    (fav ? '取消收藏' : '收藏') + esc(d.name) + '" aria-pressed="' + fav + '">' + IC(fav ? 'heart-fill' : 'heart', 'width:24px;height:24px') + '</button></div>' +
    '<div class="dt-name-row"><h2 class="dt-name">' + esc(d.name) + '</h2>' +
    '<span class="dt-price"><small>零花钱/份</small>' + f1(d.price) + '</span></div>' +
    '<div class="dt-rating">' + (rating
      ? '<span class="hearts" style="display:flex;gap:2px;color:var(--rose-500)">' + heartsRow(Math.round(rating)) + '</span><span>她的评分 ' + rating + ' · 点过 ' + rebuy + ' 次</span>'
      : '<span class="hearts" style="display:flex;gap:2px;color:var(--rose-300)">' + heartsRow(0) + '</span><span>还没点过，等第一次夸奖</span>') + '</div>' +
    '<div class="dt-info"><span class="tag-mini">' + IC('clock', 'width:12px;height:12px') + d.time + ' 分钟</span>' +
    '<span class="tag-mini">难度 · ' + esc(d.difficulty) + '</span><span class="tag-mini">' + esc(d.servings) + '</span>' +
    '<span class="tag-mini">' + IC('flame', 'width:12px;height:12px') + SPICY_LABEL[d.spicy] + '</span>' +
    (inCart ? '<span class="tag-mini" style="background:var(--rose-100);color:var(--rose-700)">今日已点 ×' + inCart + '</span>' : '') +
    (d.byChef ? '<span class="tag-mini" style="background:var(--green-100);color:var(--green-700)">为新学的菜</span>' : '') + '</div>' +
    '<div class="dt-note"><div class="dn-label">' + IC('note', 'width:15px;height:15px') + (chef ? '当时我写的做法' : '大厨的话') + '</div>' +
    '<p class="dn-text">' + esc(d.note) + '</p></div>' +
    '<div class="dt-sec"><h4>' + IC('bowl') + ' 食材清单</h4><div class="ing-row">' +
    d.ingredients.map(i => '<span class="ing">' + esc(i) + '</span>').join('') + '</div></div>' +
    '<div class="dt-sec"><h4>' + IC('cal') + ' 做法步骤</h4>' +
    d.steps.map((s, i) => '<div class="step"><span class="st-no">' + (i + 1) + '</span><p>' + esc(s) + '</p></div>').join('') +
    (d.steps.length ? '<div class="step"><span class="st-no">…</span><p style="color:var(--ink-soft)">完整版只在这口锅里，不外传</p></div>' : '') + '</div>' +
    '<div class="dt-sec"><h4>' + IC('heart-fill', 'color:var(--rose-500)') + ' 她的食评' +
    (d.reviews.length ? '<span style="margin-left:auto;font-size:12px;color:var(--muted-ink);font-weight:700">共 ' + d.reviews.length + ' 条</span>' : '') + '</h4>' +
    (d.reviews.length ? d.reviews.slice(-2).reverse().map(r =>
      '<div class="review-card"><div class="review-head">宝贝 <span class="hearts">' + heartsRow(r.hearts) + '</span></div>' +
      '<p class="review-text">「' + esc(r.text) + '」</p><p class="review-date">' + relDate(r.d) + ' 点过 · 已回购 ' + rebuy + ' 次</p></div>').join('')
      : '<div class="review-card"><div class="review-head">宝贝 <span class="hearts">' + heartsRow(0) + '</span></div>' +
      '<p class="review-text">这道菜还欠我一次评价～</p><p class="review-date">点过之后来打分</p></div>') + '</div>' +
    '</div>';
  $('#detail-actions').innerHTML = chef
    ? '<button class="btn btn-ghost" style="min-width:56px" data-action="dish-edit" data-id="' + esc(d.id) + '" aria-label="编辑' + esc(d.name) + '">' + IC('note') + '</button>' +
      '<button class="btn btn-ghost" data-action="dish-del" data-id="' + esc(d.id) + '">' + IC('trash', 'width:19px;height:19px') + ' 下架</button>' +
      '<button class="btn btn-primary" style="flex:1" data-action="nav" data-target="kitchen" data-dir="back">回工作台</button>'
    : '<button class="btn btn-ghost" style="min-width:56px" data-action="fav" data-id="' + esc(d.id) + '" aria-label="' +
      (fav ? '取消收藏' : '收藏') + esc(d.name) + '" aria-pressed="' + fav + '">' + IC(fav ? 'heart-fill' : 'heart') + '</button>' +
      '<button class="btn btn-primary" style="flex:1" data-action="add" data-id="' + esc(d.id) + '">' + IC('plus', 'width:20px;height:20px') +
      ' 加入今日点菜 · ' + f1(d.price) + ' 零花钱</button>';
  updateDetailStrip();
}
function updateDetailStrip() {
  const strip = $('#dt-cart-strip'), n = cartQty();
  const show = n > 0 && state.screen === 'detail' && state.me === 'baby';
  strip.classList.toggle('show', show);
  strip.setAttribute('aria-hidden', show ? 'false' : 'true');
  if (show) $('#dcs-info').innerHTML = '今日已点 <b class="num" style="color:var(--rose-700)">' + cartDishes() + '</b> 道 · ' +
    '<b class="num" style="color:var(--rose-700)">' + n + '</b> 份 · <b class="num" style="color:var(--rose-700)">' + f1(cartTotal()) + '</b> 零花钱';
}

/* ---------------- 确认点菜 ---------------- */
function renderOrder() {
  const scroll = $('#order-scroll'), bar = $('#pay-bar');
  const ids = liveItems();
  const head = '<div class="dt-head"><button class="icon-btn" data-action="nav" data-target="home" data-dir="back" aria-label="返回菜单">' +
    IC('back') + '</button><h2 class="dt-title">确认点菜</h2><span class="ph"></span></div>';
  if (!ids.length) {
    scroll.innerHTML = head + '<div class="od-body"><div class="empty-box" data-state="empty">' +
      '<div class="eb-art">' + IC('bowl', 'width:84px;height:84px') + '</div><h3>还没点菜哦</h3>' +
      '<p>菜单里 ' + state.dishes.length + ' 道菜正排着队等你翻牌</p>' +
      '<button class="btn btn-primary" data-action="nav" data-target="home" data-dir="back">去挑菜</button></div></div>';
    bar.innerHTML = '<button class="btn btn-primary" style="flex:1" aria-disabled="true" data-action="pay-blocked">零花钱支付</button>';
    return;
  }
  const total = cartTotal(), bal = state.wallet.balance;
  const after = +(bal - total).toFixed(1), lack = +(total - bal).toFixed(1);
  scroll.innerHTML = head + '<div class="od-body">' +
    '<div class="od-list">' + ids.map(id => {
      const d = dish(id), n = state.cart[id];
      return '<div class="od-item" data-item="' + esc(d.id) + '">' +
        '<button class="odi-art" data-action="detail" data-id="' + esc(d.id) + '" data-dir="fwd" aria-label="看' + esc(d.name) + '的详情">' + dishThumb(d) + '</button>' +
        '<div class="od-info"><div class="oi-name">' + esc(d.name) + '</div>' +
        '<div class="oi-price"><span class="num">' + f1(d.price) + '</span> 零花钱/份 · 小计 <span class="num">' + f1(d.price * n) + '</span></div></div>' +
        '<div class="stepper"><button class="st-btn trash" data-action="del" data-id="' + esc(d.id) + '" aria-label="移除' + esc(d.name) + '">' + IC('trash') + '</button>' +
        '<span class="st-num">' + n + '</span>' +
        '<button class="st-btn" data-action="inc" data-id="' + esc(d.id) + '" aria-label="' + esc(d.name) + ' 多来一份">' + IC('plus') + '</button></div></div>';
    }).join('') + '</div>' +
    '<div class="od-sec"><h4>' + IC('spark') + ' 我的口味偏好</h4>' +
    '<p class="sec-hint">粘性设置：会跟到每一单，随时能取消</p>' +
    '<div class="note-chips">' + TASTE_PREFS.map(p =>
      '<button class="chip chip--sm' + (state.prefs.includes(p) ? ' on' : '') + '" data-action="prefchip" data-id="' + esc(p) + '" aria-pressed="' +
      state.prefs.includes(p) + '">' + esc(p) + '</button>').join('') + '</div></div>' +
    '<div class="od-sec"><h4>' + IC('note') + ' 这一单想多说一句</h4>' +
    '<p class="sec-hint">只对本单有效，付完就清空</p>' +
    '<textarea class="note-input" id="note-input" maxlength="50" placeholder="比如：少放蒜，汤留多一点" aria-label="给大厨的本单备注">' + esc(state.orderNote) + '</textarea>' +
    '<div class="note-count" id="note-count">' + state.orderNote.length + '/50</div></div>' +
    '<div class="od-sec"><h4>' + IC('cal') + ' 什么时候做</h4><div class="when-chips">' + WHEN_OPTS.map(w =>
      '<button class="chip' + (state.when === w.id ? ' on' : '') + '" data-action="when" data-id="' + w.id + '" aria-pressed="' +
      (state.when === w.id) + '">' + esc(w.label) + '</button>').join('') + '</div></div>' +
    '<div class="od-sec"><div class="sum-row"><span>零花钱余额</span><b class="num">' + f1(bal) + '</b></div>' +
    '<div class="sum-row"><span>本单合计（' + cartDishes() + ' 道 · ' + cartQty() + ' 份）</span>' +
    '<b class="num" style="color:var(--rose-700)">' + f1(total) + '</b></div>' +
    '<div class="sum-row sum-total"><span class="st-label">支付后剩余</span>' +
    '<span class="st-num" style="color:' + (after >= 0 ? 'var(--ink)' : 'var(--rose-700)') + '">' + (after >= 0 ? f1(after) : '不够啦') + '</span></div></div></div>';
  bar.innerHTML = after >= 0
    ? '<div class="pb-total"><span class="t1">合计</span><span class="t2">' + f1(total) + ' 零花钱</span></div>' +
      '<button class="btn btn-primary" data-action="pay">' + IC('coin', 'width:20px;height:20px') + ' 零花钱支付</button>'
    : '<div class="pb-total"><span class="t1">合计</span><span class="t2">' + f1(total) + ' 零花钱</span></div>' +
      '<button class="btn btn-butter" data-action="aegyo">' + IC('heart', 'width:20px;height:20px') +
        (lack > aegyoBudget() ? ' 差 ' + f1(lack) + '，今天最多批 ' + aegyoBudget() : ' 差 ' + f1(lack) + '，去撒娇问一下') + '</button>';
  const ta = $('#note-input');
  if (ta) ta.addEventListener('input', () => {
    state.orderNote = ta.value;
    $('#note-count').textContent = ta.value.length + '/50';
    clearTimeout(renderOrder._t); renderOrder._t = setTimeout(saveState, 400);
  });
  armImgs(scroll);
}

/* ---------------- 支付成功 ---------------- */
function renderSuccess() {
  const o = orderById(state.lastOrderId);
  if (!o) { navTo('home'); return; }
  const noteLine = (o.prefs.length ? '口味：' + o.prefs.join('、') + '。' : '') + (o.note ? '另外「' + o.note + '」' : '');
  $('#success-scroll').innerHTML =
    '<div class="suc-body" id="suc-body">' +
    '<div class="suc-mark">' + IC('check', 'width:88px;height:88px') + '</div>' +
    '<h1 class="scr-h" tabindex="-1">点菜成功！</h1>' +
    '<p class="suc-sub">' + esc(pick('success.sub')) + '</p>' +
    '<div class="chef-reply"><div class="cr-head"><span class="cr-avatar">' + IC('avatar-chef', 'width:26px;height:26px') + '</span>' +
    '<span class="cr-name">大厨<small>刚刚</small></span></div>' +
    '<p class="cr-text">' + (noteLine ? esc(noteLine) + '<br>' : '') + esc(pick('chef.reply')) + '</p></div>' +
    '<div class="suc-sum"><div class="row"><span>订单号</span><b>' + esc(o.id) + '</b></div>' +
    '<div class="row"><span>菜品</span><b>' + esc(servedNameLine(o)) + '</b></div>' +
    '<div class="row"><span>实付</span><b class="num" style="color:var(--rose-700)" id="suc-pay">' + f1(o.total) + ' 零花钱</b></div>' +
    '<div class="row"><span>零花钱剩余</span><b class="num">' + f1(state.wallet.balance) + '</b></div>' +
    '<div class="suc-eta">' + IC('cal', 'width:16px;height:16px') + '预计 ' + esc(ETA_MAP[o.when] || o.when) + ' 出锅 · 大厨接单后会变</div>' +
    (state.me === 'baby' ? '<div class="row" style="margin-top:8px"><span>下一步</span><b>等他点头，或切到大厨身份替他接单（本机演示）</b></div>' : '') +
    '</div><div class="suc-btns">' +
    '<button class="btn btn-primary" data-action="nav" data-target="orders" data-dir="fwd">查看订单</button>' +
    '<button class="btn btn-ghost" data-action="nav" data-target="home" data-dir="back">再去逛逛菜单</button></div></div>';
  burstConfetti($('#suc-body'));
  rollNum($('#suc-pay'), o.total);
}
/* ---------------- 我的订单 ---------------- */
const FLOW = {
  pending: { accept: 'accepted', decline: 'declined', cancel: 'cancelled' },
  accepted: { cook: 'cooking', cancel: 'cancelled' },
  cooking: { serve: 'served' },
  served: { rate: 'rated' },
  rated: {}, declined: {}, cancelled: {},
};
const TABS = [
  { id: 'all', label: '全部' }, { id: 'open', label: '进行中' }, { id: 'served', label: '开饭了' }, { id: 'rated', label: '已完成' },
];
function inTab(o, tab) {
  if (tab === 'all') return true;
  if (tab === 'open') return ['pending', 'accepted', 'cooking'].includes(o.chefState);
  return o.chefState === tab;
}
function renderOrders() {
  const chef = state.me === 'chef';
  const list = state.orders.filter(o => inTab(o, state.ordersTab));
  $('#orders-scroll').innerHTML =
    '<h2 class="page-title scr-h" tabindex="-1">' + (chef ? '厨房的订单' : '我的订单') + '</h2>' +
    '<div class="odr-tabs">' + TABS.map(t => chipHTML('ordertab', t.id, t.label, state.ordersTab === t.id)).join('') + '</div>' +
    '<div class="odr-body">' + (list.length ? list.map(orderCardHTML).join('') :
      '<div class="empty-box" data-state="empty"><div class="eb-art">' + IC('bowl', 'width:84px;height:84px') + '</div>' +
      '<h3>' + (state.ordersTab === 'all' ? '还没有订单' : '这个状态下暂时没有订单') + '</h3>' +
      '<p>去馋大厨一次，菜单立刻就有动静</p>' +
      '<button class="btn btn-primary" data-action="nav" data-target="home" data-dir="fwd">去点菜</button></div>') + '</div>';
  armImgs($('#orders-scroll'));
}
function orderCardHTML(o) {
  const chef = state.me === 'chef';
  const ids = Object.keys(o.items);
  const st = { pending: 'badge.pending', accepted: 'badge.accepted', cooking: 'badge.cooking',
    served: 'badge.served', rated: 'badge.rated', declined: 'badge.declined', cancelled: 'badge.cancelled' }[o.chefState];
  const ln = { pending: 'line.pending', accepted: 'line.accepted', cooking: 'line.cooking',
    served: 'line.served', rated: 'line.rated', declined: 'line.pending', cancelled: 'line.pending' }[o.chefState];
  let acts = '';
  const B = (label, act, cls, extra) => '<button class="btn ' + (cls || 'btn-soft') + '" data-action="' + act + '" data-id="' + o.id + '"' + (extra || '') + '>' + label + '</button>';
  if (o.chefState === 'pending' && chef) acts += B('接单', 'chef-accept', 'btn-primary') + B('今天不行', 'chef-decline', 'btn-ghost');
  if (o.chefState === 'accepted' && chef) acts += B('开火', 'chef-cook', 'btn-primary');
  if (o.chefState === 'cooking' && chef) acts += B('开饭了！', 'chef-serve', 'btn-primary');
  if (o.chefState === 'served' && !chef) acts += B('去评价这顿', 'rate-open', 'btn-primary', ' data-dir="fwd"');
  if (!chef && ['pending', 'accepted', 'cooking'].includes(o.chefState)) acts += B(IC('flame', 'width:16px;height:16px') + ' 催一催', 'cuishou', 'btn-ghost');
  if (!chef && o.chefState === 'pending') acts += B('撤单退钱', 'order-cancel', 'btn-ghost');
  if (['rated', 'declined', 'cancelled'].includes(o.chefState) && !chef) acts += B(IC('plus', 'width:16px;height:16px') + ' 再来一份', 'again', 'btn-soft');
  return '<div class="order-card" data-order="' + o.id + '">' +
    '<div class="oc-head"><span class="oc-date">' + relDate(o.d) + '</span><span class="oc-id">' + esc(o.id) + '</span>' +
    '<span class="oc-badge ' + o.chefState + '">' + esc(pick(st)) + '</span></div>' +
    '<div class="oc-dishes">' + ids.slice(0, 4).map(id =>
      '<span class="od-d">' + dishThumb(orderDish(o, id)) + '</span>').join('') +
    (ids.length > 4 ? '<span class="more-dish">+' + (ids.length - 4) + '</span>' : '') + '</div>' +
    '<div class="oc-line"><span>' + esc(ids.map(id => orderDish(o, id).name + '×' + o.items[id]).join(' + ')) +
    (['pending', 'accepted', 'cooking'].includes(o.chefState) && o.when ? ' · ' + esc(o.when) : '') + '</span>' +
    '<span><span class="num">' + f1(o.total) + '</span> 零花钱</span></div>' +
    '<div class="oc-status">' + IC('spark', 'width:14px;height:14px;color:var(--rose-500)') + esc(pick(ln)) +
    (o.nagCount ? ' · 已被催 ' + o.nagCount + ' 次' : '') + '</div>' +
    ((o.prefs && o.prefs.length) || o.note ? '<div class="oc-note">' + IC('note', 'width:12px;height:12px') + ' ' +
      esc((o.prefs.length ? o.prefs.join('、') : '') + (o.note ? ' · ' + o.note : '')) + '</div>' : '') +
    (o.review ? '<div class="oc-review"><p class="rv-text">「' + esc(o.review.text) + '」</p>' +
      '<div class="rv-meta"><span class="hearts">' + heartsRow(o.review.hearts) + '</span> 宝贝的食评 · ' + relDate(o.review.d) + '</div></div>' : '') +
    (acts ? '<div class="oc-acts">' + acts + '</div>' : '') + '</div>';
}

/* ---------------- 零花钱 ---------------- */
function renderWallet() {
  const chef = state.me === 'chef';
  const bal = state.wallet.balance, cheap = minPrice();
  const gk = nextGrantKey(), left = daysBetween(todayKey(), gk);
  /* 进度条走的是"这个月过了多少"：分母必须是本月天数，不是下月天数 */
  const dim = new Date(+todayKey().slice(0, 4), +todayKey().slice(5, 7), 0).getDate();
  const dom = +todayKey().slice(8, 10);
  const wait = waitingAegyo().length;
  $('#wallet-scroll').innerHTML =
    '<h2 class="page-title scr-h" tabindex="-1">我的零花钱</h2><div class="wa-body">' +
    '<div class="balance-card"><span class="bc-deco" aria-hidden="true">' + IC('coin', 'width:130px;height:130px') + '</span>' +
    '<div class="bc-label">' + IC('coin', 'width:17px;height:17px') + ' 可用零花钱</div>' +
    '<div class="bc-num"><span class="n">' + f1(bal) + '</span><span class="u">零花钱</span></div>' +
    '<p class="bc-sub">还够点 <b>' + Math.floor(bal / cheap) + '</b> 份最便宜的菜（' + f1(cheap) + ' 零花钱）<br>' +
    esc(copyWith('streak.line', state.meta.streak)) + '</p>' +
    '<div class="bc-acts">' +
    (chef
      ? '<button class="btn btn-w" data-action="nav-kitchen">' + IC('pot', 'width:17px;height:17px') + ' 去工作台批复' + (wait ? '（' + wait + '）' : '') + '</button>'
      : '<button class="btn btn-w" data-action="aegyo">' + IC('heart', 'width:17px;height:17px') + ' 撒娇充值</button>') +
    '<button class="btn btn-wt" data-action="scroll-ledger">看账本</button></div></div>' +
    '<div class="info-card"><h5>' + IC('cal') + ' 下月零花钱</h5>' +
    '<p>' + cnDate(gk) + '（' + cnWeekday(gk) + '）自动发放 <b class="num">100</b> 零花钱 · 还剩 ' + left + ' 天</p>' +
    '<div class="cycle-bar"><i style="width:' + Math.round(dom / dim * 100) + '%"></i></div></div>' +
    '<div class="info-card"><h5>' + IC('info') + ' 撒娇额度</h5>' +
    '<p>今天已发出 <b class="num">' + aegyoSentToday() + ' / ' + AEGYO_DAILY_LIMIT + '</b> 次' +
    (wait ? ' · 有 ' + wait + ' 条正等大厨点头' : '') +
    '<br>今天最多能批 <b class="num">' + aegyoCap() + '</b>，已到账 ' + aegyoApprovedToday() +
    '。撒娇只补今天的饭钱，攒不下来。</p></div>' +
    '<div class="info-card"><h5>' + IC('inbox') + ' 今天的撒娇记录</h5>' +
    '<div class="ag-log">' + aegyoLogHTML() + '</div></div>' +
    '<div class="ledger-sec" id="ledger-sec"><div class="ledger-head"><h4>' + IC('note') + ' 账本明细</h4>' +
    '<button class="icon-btn refresh' + (state.ledgerSync === 'retrying' ? ' busy' : '') + '" id="ledger-refresh" data-action="refresh" aria-label="刷新账本">' +
    IC('refresh', 'width:20px;height:20px') + '</button></div>' +
    '<div id="ledger-area">' + ledgerHTML() + '</div></div>' +
    '<div class="storage-note">' + (storage.usable
      ? '数据存在这台设备的浏览器里（localStorage），关掉页面也还在。'
      : '这台设备暂时存不了数据（隐私模式或配额不足），本次操作关掉就不保留了。') +
    ' <button data-action="reset-demo">重置演示数据</button></div></div>';
}
function ledgerHTML() {
  if (state.ledgerSync === 'fail') {
    return '<div class="sync-banner" data-state="error">' + IC('info', 'width:16px;height:16px') +
      '小金库打了个盹，账本没同步上<button class="btn-retry" data-action="sync-retry">重试一下</button></div>';
  }
  if (state.ledgerSync === 'retrying') return skelHTML(1);
  const groups = {};
  state.ledger.forEach(e => { (groups[monthKey(e.d)] = groups[monthKey(e.d)] || []).push(e); });
  const ICONK = { coin: 'coin', dish: 'bowl', gift: 'gift', refund: 'refresh' };
  return Object.keys(groups).sort().reverse().map(m =>
    '<div class="ledger-month">' + cnMonth(m + '-01') + ' · 净额 ' + f1(groups[m].reduce((a, e) => a + e.a, 0)) + '</div>' +
    groups[m].map(e => '<div class="lg-row"><span class="lg-icon ' + e.k + '">' + IC(ICONK[e.k] || 'coin', 'width:20px;height:20px') + '</span>' +
      '<div class="lg-info"><div class="t">' + esc(e.t) + '</div><div class="d">' + relDate(e.d) + (e.ref ? ' · ' + esc(e.ref) : '') + '</div></div>' +
      '<span class="lg-amt ' + (e.a > 0 ? 'plus' : 'minus') + '">' + (e.a > 0 ? '+' : '') + f1(e.a) + '</span></div>').join('')).join('');
}
function aegyoLogHTML() {
  const list = state.inbox.filter(b => b.kind === 'aegyo' && b.d === todayKey());
  if (!list.length) return '<p style="margin-top:0">今天还没撒过娇，点上面的「撒娇充值」试试。</p>';
  return list.map(b => {
    const st = ['waiting', 'approved', 'rejected', 'expired'].indexOf(b.status) >= 0 ? b.status : 'expired';
    const label = st === 'approved' ? '+' + f1(b.amount || 0) + ' · 已到账'
      : st === 'rejected' ? '没批' + (b.reason ? ' · ' + b.reason : '')
      : st === 'expired' ? '过期了' : '等大厨点头';
    return '<div class="ag-row"><span class="ag-note">' + esc(b.note || '想要一点零花钱') + '</span>' +
      '<span class="ag-status ' + st + '">' + esc(label) + '</span></div>';
  }).join('');
}

/* ---------------- 大厨工作台 ---------------- */
/* 心情按天种子：同一天刷新结果一致；被催太多次只会更差 */
const MOODS = {
  good: { label: '心情不错 · 好说话', range: [40, 60] },
  plain: { label: '平常 · 按规矩给', range: [10, 39] },
  busy: { label: '有点忙 · 短平快', range: [10, 19] },
  diet: { label: '在减肥 · 钱包和你都要', range: [10, 25] },
};
function chefMood() {
  const keys = ['good', 'plain', 'busy', 'diet'];
  /* 只算还没做完的单：上个月催过 5 次，不该让这个月的心情永久变差 */
  const nag = state.orders.filter(o => ['pending', 'accepted', 'cooking'].indexOf(o.chefState) >= 0)
    .reduce((a, o) => a + (o.nagCount || 0), 0);
  let i = Math.floor(rng(LS_KEY, 'mood', state.meta.today)() * keys.length);
  if (nag > 3) i = Math.min(keys.length - 1, i + 1);
  const key = keys[i];
  return { key: key, label: MOODS[key].label, range: MOODS[key].range };
}
function aegyoSuggest(blob) {
  const m = chefMood();
  const o = orderById(blob.ref) || null;
  const r = rng(LS_KEY, 'aegyo', blob.d, blob.id);
  const base = Math.round((m.range[0] + (m.range[1] - m.range[0]) * r()) / 5) * 5;
  const bumped = o && o.nagCount ? base + Math.min(15, o.nagCount * 5) : base;
  return Math.max(AEGYO_FLOOR, Math.min(AEGYO_DAILY_CAP, bumped));
}
/* 今日净餐费（支出 - 退款）：撒娇的"报销"基数 */
function aegyoSpentToday() {
  return state.ledger.filter(e => e.d === todayKey() && (e.k === 'dish' || e.k === 'refund'))
    .reduce((a, e) => a - e.a, 0);
}
/* 上限必须把购物车算进去：否则"没花过钱 → 上限 10 → 补不齐 → 花不了钱"会死锁 */
function aegyoCapFor(spent) {
  return Math.min(AEGYO_DAILY_CAP, AEGYO_FLOOR + Math.floor(Math.max(0, spent) / 10) * 10);
}
function aegyoCap() { return aegyoCapFor(aegyoSpentToday() + cartTotal()); }
function aegyoApprovedToday() {
  return state.inbox.filter(b => b.kind === 'aegyo' && b.d === todayKey() && b.status === 'approved')
    .reduce((a, b) => a + (b.amount || 0), 0);
}
function aegyoBudget() { return Math.max(0, aegyoCap() - aegyoApprovedToday()); }
/* 还差多少才付得起这一单 */
function aegyoGap() { return Math.max(0, +(cartTotal() - state.wallet.balance).toFixed(1)); }
/* 可批档位：10/20/30，再补一个「刚好够付这单」的档，都受当日剩余额度约束 */
function aegyoAmounts() {
  const budget = aegyoBudget(), gap = aegyoGap();
  const all = [AEGYO_FLOOR, 20, AEGYO_DAILY_CAP];
  if (gap > 0) all.push(Math.ceil(gap / 10) * 10);
  const uniq = all.filter((a, i) => all.indexOf(a) === i).sort((x, y) => x - y);
  return uniq.filter(a => a <= budget);
}
/* 推荐档位：有缺口就推「刚好够」，否则按心情建议就近取档 */
function aegyoHint(blob) {
  const list = aegyoAmounts();
  if (!list.length) return 0;
  const gap = aegyoGap();
  if (gap > 0) { const fit = list.find(a => a >= gap); if (fit) return fit; }
  const want = aegyoSuggest(blob);
  return list.reduce((best, a) => Math.abs(a - want) < Math.abs(best - want) ? a : best, list[0]);
}
function renderKitchen() {
  const m = chefMood(), wait = waitingAegyo();
  const todo = state.orders.filter(o => o.chefState === 'pending');
  const doing = state.orders.filter(o => ['accepted', 'cooking'].includes(o.chefState));
  const nagged = state.orders.filter(o => o.nagCount > 0 && ['pending', 'accepted', 'cooking'].includes(o.chefState));
  const wishes = state.wished.filter(w => w.status !== 'done');
  /* 菜单管理：362 道菜必须能搜；自己新加的排前面，被点过的其次 */
  const kq = (state.kitchenQ || '').trim();
  const menuAll = state.dishes.slice().sort((a, b) =>
    (b.byChef ? 1 : 0) - (a.byChef ? 1 : 0) || (b.reviews.length - a.reviews.length));
  const menuList = kq ? menuAll.filter(d => hayOf(d).indexOf(kq.toLowerCase()) >= 0) : menuAll;
  const menuLimit = state.kitchenLimit || 12;
  $('#kitchen-scroll').innerHTML =
    '<h2 class="page-title scr-h" tabindex="-1">大厨工作台</h2><div class="kt-body">' +
    '<div class="kt-note">' + IC('info') + '<span>本机演示：切换身份等于把手机交给对方，<b>不是实时同步</b>。' +
    '宝贝那边发的撒娇和点菜单，要切到大厨才能处理。</span></div>' +
    '<div class="mood-card"><span class="mc-face">' + IC('heart', 'width:22px;height:22px') + '</span>' +
    '<div><div class="mc-t">今天' + esc(m.label) + '</div>' +
    '<div class="mc-d">' + esc(pick('mood.' + m.key)) + ' · 今天最多批 ' + AEGYO_DAILY_CAP + '</div></div></div>' +
    (wait.length ? '<h3 class="sec-h">' + IC('inbox') + ' 撒娇待批<span class="count">' + wait.length + '</span></h3>' +
      wait.map(b => '<div class="task-card"><div class="tk-h">' + IC('heart', 'width:16px;height:16px;color:var(--rose-500)') +
        ' ' + esc(b.note || '想要一点零花钱') + '<span class="tk-time">' + relDate(b.d) + '</span></div>' +
        '<div class="tk-b">' + (aegyoAmounts().length
          ? '批多少看心情，今天还能批 ' + aegyoBudget() + '。已发 ' + aegyoSentToday() + '/' + AEGYO_DAILY_LIMIT + ' 次。'
          : '今天能批的都批完了，明天再来。') + '</div>' +
        '<div class="amt-row">' + aegyoAmounts().map(a => '<button class="amount-chip' + (a === aegyoHint(b) ? ' hint' : '') +
          '" data-action="aegyo-approve" data-id="' + b.id + '" data-amount="' + a + '">+' + a + '</button>').join('') + '</div>' +
        '<div class="tk-a"><button class="btn btn-ghost btn-sm" data-action="aegyo-reject" data-id="' + b.id + '">今天先不给</button></div></div>').join('') : '') +
    (nagged.length ? '<div class="kt-note" style="background:var(--rose-50);color:var(--rose-700)">' + IC('flame') +
      '<span>被催了 ' + nagged.reduce((a, o) => a + o.nagCount, 0) + ' 次：' + esc(pick('chef.nag')) + '</span></div>' : '') +
    '<h3 class="sec-h">' + IC('book') + ' 等你接单<span class="count">' + todo.length + '</span></h3>' +
    (todo.length ? todo.map(orderCardHTML).join('') :
      '<div class="empty-box"><div class="eb-art">' + IC('bowl', 'width:72px;height:72px') + '</div><h3>暂时没有待接的单</h3>' +
      '<p>宝贝那边点了菜就会出现在这里</p></div>') +
    (doing.length ? '<h3 class="sec-h">' + IC('pot') + ' 厨房进行中<span class="count">' + doing.length + '</span></h3>' +
      doing.map(orderCardHTML).join('') : '') +
    '<h3 class="sec-h">' + IC('spark') + ' 学做清单<span class="count">' + wishes.length + '</span></h3>' +
    (wishes.length ? wishes.map(w => '<div class="wish-row"><div style="flex:1;min-width:0"><div class="wr-n">' + esc(w.name) + '</div>' +
      '<div class="wr-s">' + relDate(w.d) + ' · ' + (w.status === 'learning' ? '在偷师中' : '刚提交') + '</div></div>' +
      '<div class="wr-act"><button class="mini-btn" data-action="wish-learn" data-id="' + w.id + '">已学会</button>' +
      '<button class="mini-btn ghost" data-action="wish-remove" data-id="' + w.id + '" aria-label="删掉' + esc(w.name) + '">' + IC('trash', 'width:14px;height:14px') + '</button></div></div>').join('')
      : '<p style="font-size:12.5px;color:var(--muted-ink);line-height:1.7">清单空的。宝贝搜不到的菜名会自动写在这里。</p>') +
    '<h3 class="sec-h">' + IC('bowl') + ' 菜单管理<span class="count">' + state.dishes.length + ' 道' +
      (kq ? ' · 匹配 ' + menuList.length : '') + '</span></h3>' +
    '<div class="search-bar kt-search">' + IC('search', 'width:18px;height:18px') +
      '<input id="kitchen-search" type="search" autocomplete="off" value="' + esc(state.kitchenQ) +
      '" placeholder="搜菜名、食材或菜系" aria-label="搜索菜单">' + '</div>' +
    '<button class="btn btn-primary" style="width:100%" data-action="dish-new">' + IC('plus', 'width:20px;height:20px') + ' 新增一道菜</button>' +
    '<div style="height:12px"></div>' +
    (menuList.length ? menuList.slice(0, menuLimit).map(d => '<div class="wish-row"><span class="od-d" style="width:40px;height:40px;border-radius:10px">' +
      dishThumb(d) + '</span><div style="flex:1;min-width:0"><div class="wr-n">' + esc(d.name) + '</div>' +
      '<div class="wr-s">' + f1(d.price) + ' 零花钱 · ' + d.time + ' 分钟 · 点过 ' + rebuyOf(d.id) + ' 次</div></div>' +
      '<div class="wr-act"><button class="mini-btn" data-action="dish-edit" data-id="' + esc(d.id) + '" aria-label="编辑' + esc(d.name) + '">' +
      IC('note', 'width:14px;height:14px') + '</button>' +
      '<button class="mini-btn ghost" data-action="dish-del" data-id="' + esc(d.id) + '" aria-label="下架' + esc(d.name) + '">' +
      IC('trash', 'width:14px;height:14px') + '</button></div></div>').join('') +
      (menuList.length > menuLimit ? '<button class="btn btn-ghost load-more" data-action="kitchen-more">还有 ' +
        (menuList.length - menuLimit) + ' 道，展开看</button>' : '')
      : '<p style="font-size:12.5px;color:var(--muted-ink);line-height:1.7">' +
        (kq ? '没搜到「' + esc(kq) + '」' : '菜单还是空的，先加一道菜吧') + '</p>') +
    '</div>';
  armImgs($('#kitchen-scroll'));
}

/* ---------------- 评价 ---------------- */
function renderReview() {
  const o = orderById(state.reviewOrderId);
  if (!o) { navTo('orders'); return; }
  const draft = state.reviewDraft || { hearts: 5, text: '' };
  const quick = ['还是那个味道', '汤留得刚好', '下次少放点盐', '今晚的米饭赢麻了', '盘子比菜先空'];
  $('#review-scroll').innerHTML =
    '<div class="dt-head"><button class="icon-btn" data-action="nav" data-target="orders" data-dir="back" aria-label="返回订单">' + IC('back') + '</button>' +
    '<h2 class="dt-title scr-h" tabindex="-1">给这顿饭打分</h2><span class="ph"></span></div>' +
    '<div class="rv-body"><p style="font-size:13.5px;color:var(--ink-soft);line-height:1.7">' +
    '菜凉了就不好吃了，先吃饭。吃完这一顿的印象，会写回每道菜的详情页——评分和「点过几次」都是从这儿长出来的。</p>' +
    '<div class="rv-order"><div class="ro-line"><span>订单</span><b>' + esc(o.id) + '</b></div>' +
    '<div class="ro-line"><span>菜品</span><b>' + esc(servedNameLine(o)) + '</b></div>' +
    '<div class="ro-line"><span>实付</span><b class="num">' + f1(o.total) + ' 零花钱</b></div>' +
    (o.prefs.length ? '<div class="ro-line"><span>口味</span><b>' + esc(o.prefs.join('、')) + '</b></div>' : '') +
    (o.note ? '<div class="ro-line"><span>备注</span><b>' + esc(o.note) + '</b></div>' : '') + '</div>' +
    '<div class="hearts-pick" role="group" aria-label="给这顿饭打几心">' + [1, 2, 3, 4, 5].map(n =>
      '<button data-action="rate-hearts" data-id="' + n + '" aria-pressed="' + (draft.hearts === n) + '" aria-label="' + n + ' 心">' +
      IC(n <= draft.hearts ? 'heart-fill' : 'heart', 'width:28px;height:28px') + '</button>').join('') + '</div>' +
    '<p class="rv-mood">' + esc(['不太行', '还行吧', '不错', '很可以', '碗都舔了'][draft.hearts - 1]) + '</p>' +
    '<div class="rv-quick">' + quick.map(q => '<button class="chip chip--sm" data-action="rate-quick" data-id="' + esc(q) + '">' + esc(q) + '</button>').join('') + '</div>' +
    '<textarea class="note-input" id="rv-text" maxlength="60" placeholder="一句话食评（可留空）" aria-label="食评">' + esc(draft.text) + '</textarea>' +
    '<div class="note-count" id="rv-count">' + draft.text.length + '/60</div></div>';
  $('#review-actions').innerHTML = '<button class="btn btn-primary" style="flex:1" data-action="rate-submit">' +
    IC('check', 'width:20px;height:20px') + ' 提交给大厨</button>';
  const ta = $('#rv-text');
  ta.addEventListener('input', () => {
    state.reviewDraft = Object.assign(state.reviewDraft || { hearts: 5, text: '' }, { text: ta.value });
    $('#rv-count').textContent = ta.value.length + '/60';
    clearTimeout(renderReview._t); renderReview._t = setTimeout(saveState, 400);
  });
}
