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

