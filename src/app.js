/* ================================================================
   小食光 V2 · 数据层
   ================================================================ */
const SCHEMA_VER = 4;
const LS_KEY = 'xiaoshiguang.v2';
const TOAST_MS = 1800;
/* 列表分批渲染：300 道菜全量 innerHTML 会明显掉帧，一次只画 40 张 */
const RENDER_STEP = 40;
const AEGYO_DAILY_LIMIT = 3;
/* 撒娇只补今天要吃的：起步 10，今天每多吃 10 多给 10，一天封顶 30。
   30 ≈ 两顿饭（日均 10–16），被问"为什么是 30"有答案 */
const AEGYO_DAILY_CAP = 30;
const AEGYO_FLOOR = 10;

/* ---------- 时间与日期（全部真 Date 派生，无硬编码） ---------- */
const pad2 = n => String(n).padStart(2, '0');
const dateOf = key => { const p = key.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
const keyOf = dt => dt.getFullYear() + '-' + pad2(dt.getMonth() + 1) + '-' + pad2(dt.getDate());
const todayKey = () => keyOf(new Date());
function offsetKey(nDays) { const d = new Date(); d.setDate(d.getDate() + nDays); return keyOf(d); }
const cnDate = key => { const d = dateOf(key); return (d.getMonth() + 1) + '月' + d.getDate() + '日'; };
const shortDate = key => { const d = dateOf(key); return pad2(d.getMonth() + 1) + pad2(d.getDate()); };
const WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const cnWeekday = key => WD[dateOf(key).getDay()];
function relDate(key) {
  const t = todayKey();
  if (key === t) return '今天';
  if (key === offsetKey(-1)) return '昨天';
  if (key === offsetKey(-2)) return '前天';
  return cnDate(key);
}
const monthKey = key => key.slice(0, 7);
const cnMonth = key => (+key.slice(5, 7)) + '月';
const hourPart = h => h < 11 ? 'morning' : h < 14 ? 'noon' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'latenight';
const nowPart = () => hourPart(new Date().getHours());
function daysBetween(aKey, bKey) { return Math.round((dateOf(bKey) - dateOf(aKey)) / 86400000); }
function nextGrantKey() { const d = new Date(); return keyOf(new Date(d.getFullYear(), d.getMonth() + 1, 1)); }

/* ---------- 可复现随机：同一天同一序号，结果恒定 ---------- */
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(...parts) {
  let a = hashStr(parts.join('|'));
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ---------- 只读种子数据 ---------- */
const SEED_DISHES = [
  { id: 'hongshaorou', name: '红烧肉', cats: ['yingle'], price: 8, time: 90, spicy: 0, sign: true, art: 'hongshaorou',
    desc: '肥而不腻，入口即化，大厨的看家菜',
    note: '今天挑了块肥瘦刚好的五花肉，冰糖炒糖色，小火咕嘟足 90 分钟——入口即化的那种。',
    ingredients: ['五花肉 500g', '冰糖 8 颗', '黄酒', '生抽 · 老抽', '葱段 · 姜片'],
    steps: ['五花肉切块，冷水下锅焯出血沫', '冰糖小火炒出焦糖色，下肉翻炒上色', '加黄酒、生抽老抽和热水，放葱姜', '小火炖 90 分钟，大火收汁到亮'],
    servings: '两人份', difficulty: '中等', byChef: false },
  { id: 'jinian', name: '纪念日烛光晚餐', cats: ['yingle'], price: 131.4, time: 150, spicy: 0, sign: true, art: 'jinian',
    desc: '三道式 · 牛排配玫瑰，一年就一次的仪式感',
    note: '蜡烛我来点，玫瑰我来摆，你只管穿得漂漂亮亮坐下。一年就这一回，131.4 的定价不用多解释吧？',
    ingredients: ['当日现购牛排 2 块', '玫瑰 9 支', '香煎时蔬', '餐后焦糖布丁 2 杯'],
    steps: ['提前一天订好牛排和玫瑰', '傍晚点蜡烛、摆餐具、醒酒', '牛排煎五分熟，静置 3 分钟再上', '按头盘、主菜、甜品顺序端上桌'],
    servings: '两人份 · 三道式', difficulty: '高', byChef: false },
  { id: 'kele', name: '可乐鸡翅', cats: ['yingle'], price: 6, time: 45, spicy: 0, art: 'kele',
    desc: '甜口入门硬菜，收汁亮晶晶',
    note: '可乐放足一罐，收到亮晶晶再出锅。你负责啃，我负责帮你擦嘴边的酱。',
    ingredients: ['鸡中翅 10 只', '可乐 1 罐', '生抽', '姜片'],
    steps: ['鸡翅划两刀，煎到两面金黄', '倒可乐和生抽，没过鸡翅', '中火收汁，翻面裹匀酱汁'],
    servings: '两人份', difficulty: '简单', byChef: false },
  { id: 'zhengyu', name: '清蒸鲈鱼', cats: ['yingle'], price: 10, time: 30, spicy: 0, art: 'zhengyu',
    desc: '清淡鲜嫩，热油一浇滋啦一声',
    note: '鱼要现杀才鲜，蒸够八分钟立刻出锅。浇热油那声「滋啦」——是专门给你听的。',
    ingredients: ['鲜鲈鱼 1 条', '葱丝 · 姜丝', '蒸鱼豉油', '热油 1 勺'],
    steps: ['鱼身划刀，铺姜葱蒸 8 分钟', '倒掉汤汁，铺新葱姜丝', '淋豉油，浇一勺热油'],
    servings: '两人份', difficulty: '中等', byChef: false },
  { id: 'mapo', name: '麻婆豆腐', cats: ['yingle'], price: 5, time: 25, spicy: 2, art: 'mapo',
    desc: '嫩滑烫嘴，米饭杀手',
    note: '知道你能吃辣，但花椒我减了一半。麻可以，麻到说不出话不行。',
    ingredients: ['嫩豆腐 1 盒', '牛肉末', '豆瓣酱', '花椒粉（减半）'],
    steps: ['豆腐焯水定型，牛肉末炒香', '下豆瓣酱炒出红油，加水下豆腐', '勾芡两遍，撒花椒粉葱花'],
    servings: '两人份', difficulty: '中等', byChef: false },
  { id: 'fanqie', name: '番茄鸡蛋面', cats: ['zhushi'], price: 4, time: 20, spicy: 0, art: 'fanqie',
    desc: '酸甜浓汤，深夜救赎',
    note: '番茄要先炒出沙，汤才会浓。半夜饿了说一声，二十分钟端到你面前。',
    ingredients: ['鲜面条', '番茄 2 个', '鸡蛋 2 个', '小青菜'],
    steps: ['番茄去皮炒出沙，加水煮开', '淋蛋液成蛋花，下面条', '面条八分熟下青菜，调味出锅'],
    servings: '一人份', difficulty: '简单', byChef: false },
  { id: 'congyou', name: '葱油拌面', cats: ['zhushi'], price: 4, time: 15, spicy: 0, art: 'congyou',
    desc: '葱香扑鼻，简单上头',
    note: '葱油是周末熬好的一小罐，就等你半夜那句「想吃面」。',
    ingredients: ['细面', '小葱 1 把', '生抽 · 糖', '猪油 1 勺'],
    steps: ['小葱冷油慢炸到焦香', '生抽糖调成葱油汁', '面条煮熟沥干，拌匀开吃'],
    servings: '一人份', difficulty: '简单', byChef: false },
  { id: 'jufan', name: '芝士焗饭', cats: ['zhushi'], price: 7, time: 35, spicy: 0, art: 'jufan',
    desc: '双重芝士，拉丝自由',
    note: '拉丝的秘诀是两种芝士混着放。今晚可以拍慢动作视频，馋一馋别人。',
    ingredients: ['隔夜饭', '马苏里拉 · 切达', '番茄肉酱', '玉米粒'],
    steps: ['米饭铺底，浇番茄肉酱', '厚厚铺两层芝士', '200 度烤 15 分钟到金黄'],
    servings: '两人份', difficulty: '简单', byChef: false },
  { id: 'tang', name: '玉米排骨汤', cats: ['tang'], price: 5, time: 120, spicy: 0, art: 'tang',
    desc: '清甜滋补，暖到心里',
    note: '小火煨两小时，玉米的甜全进汤里。你负责喝汤，骨头归我啃。',
    ingredients: ['肋排 500g', '甜玉米 2 根', '胡萝卜', '姜片'],
    steps: ['排骨焯水去沫', '玉米胡萝卜切段同炖', '小火煨 2 小时，加盐出锅'],
    servings: '两人份', difficulty: '简单', byChef: false },
  { id: 'buding', name: '焦糖布丁', cats: ['tiandian'], price: 3, time: 50, spicy: 0, art: 'buding',
    desc: 'duang~ 会跳舞的布丁',
    note: '焦糖要熬到刚好发苦的那一秒才倒模。甜和苦的平衡——像我们。',
    ingredients: ['鸡蛋 3 个', '牛奶 250ml', '淡奶油', '糖（熬焦糖用）'],
    steps: ['糖加水熬成琥珀色焦糖', '蛋奶液过筛，注入模具', '烤箱水浴 40 分钟，冷藏更好吃'],
    servings: '3 小杯', difficulty: '中等', byChef: false },
  /* ---- 家常档：日常点得最多的一层，价格压在 2~7，让零花钱经得起天天花 ---- */
  { id: 'fanqiechao', name: '西红柿炒蛋', cats: ['jiachang'], price: 4, time: 15, spicy: 0, art: 'chaodan',
    desc: '十五分钟上桌，米饭永远不够',
    note: '蛋要嫩，就得在还带点流动的时候关火。番茄我挑了最红的那两个，炒出沙才加水。',
    ingredients: ['番茄 3 个', '鸡蛋 3 个', '小葱', '糖半勺'],
    steps: ['番茄去皮切块，鸡蛋加一点盐打散', '热油滑蛋，七成熟盛出', '番茄炒出沙，回锅翻匀，撒葱花'],
    servings: '两人份', difficulty: '简单', byChef: false },
  { id: 'tudousi', name: '青椒土豆丝', cats: ['jiachang', 'sucai'], price: 3, time: 20, spicy: 1, art: 'tudousi',
    desc: '爽脆带一点辣，配粥配饭都行',
    note: '切丝比刨丝好吃，我知道麻烦，但脆度差得远。泡过水再炒，不粘锅也不发黑。',
    ingredients: ['土豆 2 个', '青椒 1 个', '干辣椒 2 个', '白醋几滴'],
    steps: ['土豆切细丝，清水冲去淀粉', '热锅下干辣椒和青椒丝爆香', '下土豆丝大火快炒，出锅前点醋'],
    servings: '两人份', difficulty: '简单', byChef: false },
  { id: 'xilanhua', name: '蒜蓉西兰花', cats: ['sucai'], price: 4, time: 15, spicy: 0, art: 'xilanhua',
    desc: '清爽解腻，吃硬菜时必备',
    note: '焯水只烫四十秒，颜色才绿得发亮。蒜末分两次放，一半爆香一半出锅前撒。',
    ingredients: ['西兰花 1 颗', '蒜 5 瓣', '蚝油', '盐'],
    steps: ['西兰花掰小朵，盐水泡十分钟', '沸水加盐焯四十秒，过凉水', '蒜末爆香，下西兰花快炒调味'],
    servings: '两人份', difficulty: '简单', byChef: false },
  { id: 'doujiao', name: '干煸豆角', cats: ['sucai', 'jiachang'], price: 4, time: 25, spicy: 1, art: 'doujiao',
    desc: '外皮起皱，越嚼越香',
    note: '豆角必须煸到起虎皮才好吃，也别省这一步——生的豆角不能吃，这是规矩。',
    ingredients: ['豇豆 400g', '蒜末', '干辣椒', '芽菜碎'],
    steps: ['豆角掐段，沥干水', '宽油中火煸到表皮起皱，捞出', '蒜末辣椒芽菜炒香，回锅翻匀'],
    servings: '两人份', difficulty: '中等', byChef: false },
  { id: 'huaji', name: '香菇滑鸡', cats: ['jiachang', 'yingle'], price: 7, time: 40, spicy: 0, art: 'huaji',
    desc: '鸡肉滑嫩，汤汁能拌两碗饭',
    note: '鸡腿肉去骨切块，用生粉抓一下才滑。香菇的蒂别扔，垫在底下更香。',
    ingredients: ['鸡腿 2 只', '干香菇 6 朵', '生抽 · 蚝油', '生粉'],
    steps: ['鸡腿肉切块，加生抽生粉抓匀腌十分钟', '香菇泡发切片，铺在盘底', '上锅蒸十五分钟，撒葱花'],
    servings: '两人份', difficulty: '中等', byChef: false },
  { id: 'yuxiang', name: '鱼香肉丝', cats: ['jiachang', 'yingle'], price: 7, time: 30, spicy: 1, art: 'yuxiang',
    desc: '酸甜微辣，没有鱼但很下饭',
    note: '鱼香靠的是泡椒、糖、醋三样比例。我按你的口味把糖减了一点点，酸味留着。',
    ingredients: ['猪里脊 250g', '木耳', '胡萝卜', '泡椒 · 糖醋汁'],
    steps: ['肉丝上浆，滑油盛出', '泡椒炒出红油，下配菜', '回锅肉丝，倒糖醋汁收浓'],
    servings: '两人份', difficulty: '中等', byChef: false },
  { id: 'gongbao', name: '宫保鸡丁', cats: ['jiachang', 'yingle'], price: 7, time: 25, spicy: 2, art: 'gongbao',
    desc: '糊辣荔枝味，花生最后放',
    note: '花生要最后十秒才下，脆的才叫宫保。辣度我没减，你上次说这个辣得过瘾。',
    ingredients: ['鸡腿肉 300g', '油酥花生', '干辣椒 · 花椒', '糖醋汁'],
    steps: ['鸡丁上浆滑熟盛出', '干辣椒花椒小火炒香', '倒糖醋汁和鸡丁翻匀，撒花生'],
    servings: '两人份', difficulty: '中等', byChef: false },
  { id: 'danchaofan', name: '蛋炒饭', cats: ['zhushi'], price: 3, time: 15, spicy: 0, art: 'danchaofan',
    desc: '隔夜饭的最高礼遇',
    note: '锅要够热，饭要够干，蛋液裹住每一粒。凌晨一点想吃也有，我不嫌麻烦。',
    ingredients: ['隔夜饭 1 碗', '鸡蛋 2 个', '小葱', '猪油半勺'],
    steps: ['鸡蛋打散，倒入冷饭拌匀', '热锅下油，倒饭大火翻炒', '粒粒分明后调味，撒葱花'],
    servings: '一人份', difficulty: '简单', byChef: false },
  { id: 'zicaitang', name: '紫菜蛋花汤', cats: ['tang'], price: 2, time: 10, spicy: 0, art: 'zicaitang',
    desc: '十分钟的暖胃收尾',
    note: '蛋液要沿着筷子慢慢淋，蛋花才散得开。这碗汤不值钱，但每次你都会喝完。',
    ingredients: ['紫菜 1 小把', '鸡蛋 1 个', '虾皮', '香油几滴'],
    steps: ['水开下紫菜和虾皮', '转小火，淋入蛋液划散', '加盐和白胡椒，滴香油'],
    servings: '两人份', difficulty: '简单', byChef: false },
  { id: 'donggua', name: '冬瓜丸子汤', cats: ['tang'], price: 4, time: 35, spicy: 0, art: 'donggua',
    desc: '清淡鲜甜，夏天也能喝两碗',
    note: '肉馅顺一个方向搅上劲，丸子才弹。冬瓜切厚片，煮到透明就关火。',
    ingredients: ['冬瓜 400g', '猪肉馅 200g', '姜末', '白胡椒'],
    steps: ['肉馅加姜末调味，搅打上劲', '水微沸时挤丸子下锅', '下冬瓜片煮到透明，调味'],
    servings: '两人份', difficulty: '简单', byChef: false },
];

/* ---------- 内置 20 道补多维字段（扩展库自带，内置的没有） ---------- */
const BUILTIN_META = {
  hongshaorou: { cuisine: '融合', main: '猪', method: '炖' },
  jinian: { cuisine: '融合', main: '牛', method: '煎' },
  kele: { cuisine: '融合', main: '鸡鸭', method: '炖' },
  zhengyu: { cuisine: '融合', main: '鱼虾', method: '蒸' },
  mapo: { cuisine: '川', main: '蛋豆', method: '炒' },
  fanqie: { cuisine: '融合', main: '米面', method: '煮' },
  congyou: { cuisine: '融合', main: '米面', method: '煮' },
  jufan: { cuisine: '融合', main: '米面', method: '烤' },
  tang: { cuisine: '融合', main: '猪', method: '炖' },
  buding: { cuisine: '融合', main: '蛋豆', method: '烤' },
  fanqiechao: { cuisine: '融合', main: '蛋豆', method: '炒' },
  tudousi: { cuisine: '融合', main: '蔬菜', method: '炒' },
  xilanhua: { cuisine: '融合', main: '蔬菜', method: '炒' },
  doujiao: { cuisine: '融合', main: '蔬菜', method: '炒' },
  huaji: { cuisine: '融合', main: '鸡鸭', method: '蒸' },
  yuxiang: { cuisine: '川', main: '猪', method: '炒' },
  gongbao: { cuisine: '川', main: '鸡鸭', method: '炒' },
  danchaofan: { cuisine: '融合', main: '米面', method: '炒' },
  zicaitang: { cuisine: '融合', main: '蛋豆', method: '煮' },
  donggua: { cuisine: '融合', main: '猪', method: '煮' },
};
SEED_DISHES.forEach(d => { if (BUILTIN_META[d.id]) Object.assign(d, BUILTIN_META[d.id]); });

/* ---------- 扩展菜品库：内联 JSON，读不到就只用内置 20 道，不白屏 ---------- */
const SEED_PAYLOAD = (() => {
  try {
    const el = document.getElementById('seed-dishes');
    const raw = el ? JSON.parse(el.textContent || '{}') : null;
    return raw && typeof raw === 'object' ? raw : {};
  } catch (e) {
    console.warn('[小食光] 扩展菜品库解析失败，只用内置 20 道', e);
    return {};
  }
})();
const EXTRA_DISHES = Array.isArray(SEED_PAYLOAD.dishes) ? SEED_PAYLOAD.dishes : [];
const LEGACY_DISH_IDS = SEED_PAYLOAD.legacyIds && typeof SEED_PAYLOAD.legacyIds === 'object'
  ? SEED_PAYLOAD.legacyIds : {};
SEED_DISHES.push.apply(SEED_DISHES, EXTRA_DISHES);

/* 主料级插画：这些 art 是一类菜共用一张图，列表里连续出现分不清，
   所以卡片缩略图改用「主料色底 + 菜名首字」；有具体插画的菜仍用手绘图 */
const MAIN_ARTS = ['pork', 'beef', 'lamb', 'chicken', 'fish', 'egg', 'veg', 'rice'];
const MAIN_TINT = { '猪': '#FBE3DC', '牛': '#F7DCD6', '羊': '#F9E4D8', '鸡鸭': '#FCEBD3',
  '鱼虾': '#E4EEF0', '蛋豆': '#FBF0D0', '蔬菜': '#E6F0DE', '米面': '#F7EEDD' };

/* ---------- 筛选维度（300 道菜靠这个，不靠更多分类） ---------- */
const CUISINES = ['川', '粤', '湘', '鲁', '苏', '浙', '闽', '徽', '东北', '西北', '云贵', '融合'];
const MAINS = ['猪', '牛', '羊', '鸡鸭', '鱼虾', '蛋豆', '蔬菜', '米面'];
const METHODS = ['炒', '蒸', '炖', '煮', '烤', '炸', '凉拌', '煎'];
const SPICY_OPTS = [{ id: '0', label: '不辣' }, { id: '1', label: '微辣' }, { id: '2', label: '中辣' }];
const TIME_BANDS = [{ id: 't15', label: '15 分钟内', max: 15 }, { id: 't30', label: '30 分钟内', max: 30 },
  { id: 't60', label: '1 小时内', max: 60 }];
const PRICE_BANDS = [{ id: 'p3', label: '≤3', max: 3 }, { id: 'p5', label: '≤5', max: 5 },
  { id: 'p8', label: '≤8', max: 8 }, { id: 'p12', label: '≤12', max: 12 }];

const CATS = [
  { id: 'all', label: '全部' }, { id: 'jiachang', label: '家常' }, { id: 'yingle', label: '硬菜' },
  { id: 'sucai', label: '素菜' }, { id: 'zhushi', label: '主食' }, { id: 'tang', label: '汤羹' },
  { id: 'tiandian', label: '甜品' },
];
/* 搜索同义词：解决 V1 里"明明有却搜不到" */
const SYNONYM = {
  '不辣': ['spicy0'], '微辣': ['spicy1'], '中辣': ['spicy2'], '很辣': ['spicy2'], '辣': ['spicy1', 'spicy2'],
  '晚上': ['zhushi'], '夜宵': ['zhushi'], '深夜': ['zhushi'], '中午': ['zhushi'], '肉': ['yingle', 'jiachang'],
  '面': ['zhushi'], '饭': ['zhushi'], '汤': ['tang'], '甜': ['tiandian'],
  '家常': ['jiachang'], '家常菜': ['jiachang'], '日常': ['jiachang'], '下饭': ['jiachang', 'yingle'],
  '素': ['sucai'], '青菜': ['sucai'], '蔬菜': ['sucai'], '清淡': ['sucai', 'tang'],
  '简单': ['difficulty简单'], '快手': ['difficulty简单'], '快': ['difficulty简单'],
};
/* 这些是同义词而不是"菜名/食材里的字"：没命中标签时不能再走模糊兜底，
   否则搜「不辣」会把带「辣椒」的辣菜也捞进来 */
const STRICT_SYNONYM = ['不辣', '微辣', '中辣', '很辣', '辣', '简单', '快手', '快'];
const SPICY_LABEL = { 0: '不辣', 1: '微辣', 2: '中辣' };
const WHEN_OPTS = [
  { id: 'tonight', label: '今晚 18:30' }, { id: 'lunch', label: '明天午餐' }, { id: 'chef', label: '大厨看着办' },
];
/* 口味偏好＝粘性；本单备注＝一次性。V1 把两者混成一个字段导致串单 */
const TASTE_PREFS = ['多放辣', '不要香菜', '多加芝士', '米饭加量', '汤汁留多点'];
const CHEF_REJECT_REASONS = ['今天加班到很晚', '钱包也在减肥', '先欠着，周末双倍', '撒娇不管用，得亲自来'];
const ART_KEYS = ['hongshaorou', 'jinian', 'kele', 'zhengyu', 'mapo', 'fanqie', 'congyou', 'jufan', 'tang', 'buding',
  'chaodan', 'tudousi', 'xilanhua', 'doujiao', 'huaji', 'yuxiang', 'gongbao', 'danchaofan', 'zicaitang', 'donggua',
  /* 主料级：300 道扩展菜按主料复用这 8 张 */
  'pork', 'beef', 'lamb', 'chicken', 'fish', 'egg', 'veg', 'rice'];

/* ---------- 文案池（每 key ≥3 变体，pick() 保证不与上一次重复） ---------- */
const COPY = {
  'greet.head': [['宝贝，今天想吃点什么？', '锅已热，就差你点菜了', '宝贝，菜单在等你翻牌', '今天想被投喂哪一道？', '大厨已就位，请下单', '饿了吗？先看看有什么']],
  'greet.sub': [
    { ctx: { part: 'morning' }, v: ['早上好，先想好晚上吃啥', '早安，今天的肚子由我负责', '一早就开始盘算给你做什么了'] },
    { ctx: { part: 'noon' }, v: ['中午想吃点快的还是慢的', '饭点到了，别硬扛着', '午餐别凑合，我做得快'] },
    { ctx: { part: 'afternoon' }, v: ['有点馋的话现在就可以点', '下午先把晚上定了，省得到时候纠结', '提前点菜，大厨好去买菜'] },
    { ctx: { part: 'evening' }, v: ['晚上想吃热乎的还是清爽的', '今晚的锅已经空着了，就等一道菜', '晚饭别将就，点一个'] },
    { ctx: { part: 'latenight' }, v: ['深夜的胃需要一点温柔', '面已经想好了，就等你开口', '这个点饿，我懂'] },
  ],
  'chef.reply': [
    '收到！这就去备菜，锅已经烧上了——今晚给你露一手。',
    '菜单看到了，食材已在案板上列队，下班就开火。',
    '遵命。你负责点，我负责把厨房变成你的食堂。',
    '好嘞，今天这道我打算多放半勺糖，按你口味来。',
    '收到，先把米泡上——今晚的厨房归我管。',
    '点得漂亮。我去系围裙了，你先把肚子腾出来。',
    '订单已接。菜在等我，我在等你回来。',
    '行，那今晚不整虚的，硬菜安排上。',
  ],
  'success.sub': ['大厨已经收到今晚的菜单', '单子已贴冰箱，跑不掉了', '厨房那边亮灯了', '订单送达，锅铲已就位', '今晚的饭，从此有了名字'],
  'chef.nag': ['收到戳一下，火已经开到最大了', '别催啦，汤正在关键阶段', '看到了看到了，正在切最后一段葱', '催一次多给你加个蛋', '已经在收汁了，真的'],
  'aegyo.sent': ['撒娇信号已飞往厨房，等大厨那边点个头', '信号发出去了——这次得他亲自批', '已送达，大厨的手机震了一下'],
  'aegyo.ignore': ['今天的撒娇额度用完啦，大厨开始装忙', '大厨把手机翻过去扣在桌上：没有了啊', '撒娇免疫中，明天再来试一次', '今天已经撒满三次了，再撒就露馅啦'],
  'aegyo.reject': ['大厨说：今天先不给，攒着周末一起花', '被驳回。理由："钱包也在减肥"', '大厨回了一个"不行"，但加了个亲亲的表情'],
  'aegyo.approve': ['大厨批得很快，还多给了点', '批了。他说"这还用申请"', '秒批，附赠一句"想吃啥点啥"'],
  'wish.add': ['已把「%s」放进大厨的学做清单', '「%s」已记在小本本第一页', '「%s」发过去了，等他什么时候学会'],
  'wish.learn': ['大厨说「%s」已经学会了，可以点啦', '「%s」学成了，今晚就能做', '「%s」已进入菜单，去看看吧'],
  'pay.short': ['零花钱不够啦，去撒个娇试试（差 %s）', '还差 %s，先去问一下大厨', '余额撑不住这一单，差 %s'],
  'empty.search': ['菜单里还没有「%s」', '「%s」暂时不在菜单上', '翻了翻菜谱，没找到「%s」'],
  'empty.fav': ['还没收藏过菜', '看到喜欢的，点一下心就收在这', '收藏的菜会留在这里'],
  'badge.pending': ['待下厨', '等大厨接单', '已送达厨房'],
  'badge.accepted': ['已接单 · 备菜中', '大厨接了，正在处理食材'],
  'badge.cooking': ['正在下厨', '火开着，正在翻炒'],
  'badge.served': ['开饭了！', '菜已上桌，等你评价'],
  'badge.rated': ['已完成', '这顿已经归档'],
  'badge.declined': ['今天没做成', '大厨拒了这单'],
  'badge.cancelled': ['已撤单', '单撤了，钱回来了'],
  'line.pending': ['大厨已收到单子，还没点头', '单子贴在冰箱上，等他看见', '等待大厨接单中'],
  'line.accepted': ['食材已在案板上，围裙系好了', '接单了，慢慢来'],
  'line.cooking': ['锅已经热起来了，香味预定中', '正在收汁，别急着进厨房'],
  'line.served': ['菜凉了就不好吃了，先吃饭再打分', '开饭！吃完记得给个评价'],
  'line.rated': ['光盘行动达成，辛苦主厨', '这顿已记录进小食光'],
};
function matchCtx(ctx, now) {
  if (!ctx) return true;
  return Object.keys(ctx).every(k => {
    const want = ctx[k], has = now && now[k];
    if (Array.isArray(want)) return want.includes(has);
    return want === has;
  });
}
/* 文案池三种写法统一展平：['a','b'] / [['a','b']] / [{ctx:{...},v:['a']}] */
function poolOf(entry, ctx) {
  let out = [];
  entry.forEach(e => {
    if (typeof e === 'string') out.push(e);
    else if (Array.isArray(e)) out = out.concat(e);
    else if (e && Array.isArray(e.v) && matchCtx(e.ctx, ctx)) out = out.concat(e.v);
  });
  if (!out.length) entry.forEach(e => { if (e && Array.isArray(e.v)) out = out.concat(e.v); });
  return out.filter(s => typeof s === 'string' && s.length);
}
/* 取一条：同 key 不与上一次重复；序号进种子，同一天重放结果一致 */
function pick(key, ctx) {
  const entry = COPY[key];
  if (!entry) return '';
  const pool = poolOf(entry, ctx);
  if (!pool.length) return '';
  const meta = state.meta;
  const n = pool.length, hit = meta.copyHit[key] || 0;
  meta.copyHit[key] = hit + 1;
  let i = Math.floor(rng(LS_KEY, key, meta.today, hit)() * n);
  if (n > 1 && i === meta.lastCopy[key]) i = (i + 1) % n;
  meta.lastCopy[key] = i;
  return pool[i];
}
const copyWith = (key, sub, ctx) => pick(key, ctx).replace('%s', sub);
/* ================================================================
   大厨侧文案池补充（与 baby 侧同规则：每 key ≥3 变体，pick 保证不重复）
   ================================================================ */
Object.assign(COPY, {
  'greet.head.chef': [['今天想做点什么？', '厨房交给你了，大厨', '冰箱在等你开门', '今天露一手哪道？', '大厨，看看谁的单子最急']],
  'mood.good': [['今天心情不错，撒娇成功率高', '钱包开得比平时大方一点', '有心情加个菜']],
  'mood.plain': [['今天按规矩来，该多少是多少', '不多给，也不少给', '照常发挥']],
  'mood.busy': [['锅里正在收汁，长话短说', '今天事多，撒娇可能已读不回', '先顾锅里的']],
  'mood.diet': [['说好这个月省着花，钱包和你都要减', '今天先欠着，周末补给你', '这个月预算紧']],
  'streak.line': [['连续 %s 天点菜，大厨已经习惯被你翻牌', '%s 天没断了，这算长期饭票了吧', '连续 %s 天，冰箱贴都快写不下了', '今天重新开始，第一天也是第一天', '才 %s 天，稳住', '已经 %s 天了，值得加个鸡腿']],
  'wish.done': [['「%s」已学会，进菜单了', '「%s」学会了，今晚就能做', '「%s」已上架，去菜单看看它排第几']],
});

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
