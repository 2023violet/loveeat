# -*- coding: utf-8 -*-
"""小食光菜品数据生成器
数据源：build/dishes_1.py / dishes_2.py / dishes_3.py 里的 D 列表
产物：写入 src/seed-dishes.json，再调用 build/bundle.py 打包成 小食光-V2.html

菜品 ID 策略：扩展菜用"菜名 SHA-1 前 12 位"生成稳定 ID，不再用会随排序变化的位置 ID。
旧位置 ID → 新稳定 ID 的映射冻结在 build/legacy_ids.json，运行时用于迁移本地存档。

运行：python build/gen.py
"""
import io, json, sys, os, hashlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')
SRC_DATA = os.path.join(SRC, 'seed-dishes.json')
LEGACY_FILE = os.path.join(ROOT, 'build', 'legacy_ids.json')

# 主料 → 插画 key（8 张主料级 symbol，见 HTML 里的 art-pork 等）
ART_BY_MAIN = {
    '猪': 'pork', '牛': 'beef', '羊': 'lamb', '鸡鸭': 'chicken',
    '鱼虾': 'fish', '蛋豆': 'egg', '蔬菜': 'veg', '米面': 'rice',
}
# 做法 → 默认时长（分钟），数据里给了 time 就以数据为准
TIME_BY_METHOD = {'凉拌': 10, '炒': 15, '蒸': 25, '煮': 25, '煎': 15, '烤': 35, '炸': 30, '炖': 60}

NOTE_POOL = [
    '火候到了自然香，急不得，我盯着锅呢。',
    '这道我做过很多次，闭着眼也知道该放多少盐。',
    '食材是今天早上买的，新鲜得能掐出水。',
    '你上次说想吃，我记在小本本上了。',
    '不复杂，但要耐心，慢慢来才好吃。',
    '锅里咕嘟的时候，整个屋子都是这个味。',
    '我少放了点油，你吃着不腻。',
    '这道菜的秘诀是最后那一下，别提前关火。',
    '做得不算正宗，但按你的口味调过。',
    '今天有精神，给你认真做一顿。',
    '凉了也好吃，留一半明天带饭。',
    '看你吃得香，比什么都值。',
    '这个配方是我妈教的，传下来了。',
    '别急着吃，烫。',
    '配一碗白饭，能把盘子舔干净。',
    '我尝过了，咸淡刚好。',
    '锅里还留了一点汤，拌饭绝了。',
    '做这个要开窗，不然满屋子味。',
    '不难，就是费时间，正好今天有空。',
    '你负责吃，剩下的都归我。',
    '这道菜我练了好久，今天算是成了。',
    '食材简单，但火候差一点就不是这个味。',
    '我多做了半份，怕你不够。',
    '吃完记得说好不好吃，我下次改。',
    '这道适合天冷的时候吃，暖。',
    '今天想给你换个口味。',
    '看着复杂，其实步骤就那几步。',
    '我提前腌上了，入味。',
    '别看我做得随意，比例是称过的。',
    '这道菜的关键是收汁，收到发亮才行。',
    '厨房有点乱，但菜是干净的。',
    '你要是嫌淡，桌上还有酱油。',
    '这道我小时候最爱吃，现在做给你。',
    '火开小一点，慢慢煨，味道才进得去。',
    '我试了新做法，比上次好吃。',
    '这锅炖了一下午，值。',
    '剩的汤汁别倒，明天煮面。',
    '今天状态好，敢做这道。',
    '做这个的时候一直在想你什么时候回来。',
    '不摆盘了，直接吃。',
    '我把辣度调低了一点，你能吃。',
    '这道菜凉了会腥，趁热。',
    '食材不贵，但搭配起来很妙。',
    '我切得比平时细，好入味。',
    '锅气就是这么来的，火要大。',
    '你闻到味了吧，快好了。',
    '第一次做的时候糊了，这次不会。',
    '多做几次就熟练了，跟做饭一样。',
    '今天买的这个特别好，你看这颜色。',
    '我留了一份不放辣，给你。',
    '这道菜配汤最好，我另煮了一个。',
    '不用等凉，我盛出来晾了一会儿。',
    '盐最后放，早放肉会柴。',
    '这个做法简单，你也可以学。',
    '我算着时间做的，你进门刚好。',
    '厨房的灯我留着，别摸黑。',
    '吃完这顿，明天再想明天吃什么。',
    '做得有点多，叫上室友一起。',
    '我试了新的调味比例，你尝尝。',
    '这道菜不难，难在等。',
    '你上次夸过这个，我记住了。',
    '今天就这一道，认真吃。',
]

SERVINGS_BY_MAIN = {'猪': '两人份', '牛': '两人份', '羊': '两人份', '鸡鸭': '两人份',
                    '鱼虾': '两人份', '蛋豆': '两人份', '蔬菜': '两人份', '米面': '一人份'}
DIFF_BY_METHOD = {'凉拌': '简单', '炒': '简单', '蒸': '中等', '煮': '简单',
                  '煎': '简单', '烤': '中等', '炸': '中等', '炖': '中等'}

# HTML 里 SEED_DISHES 已经手写了这 20 道（带 sign/byChef 和订单引用），扩展数据要避开重名
EXISTING_NAMES = {
    '红烧肉', '纪念日烛光晚餐', '可乐鸡翅', '清蒸鲈鱼', '麻婆豆腐', '番茄鸡蛋面',
    '葱油拌面', '芝士焗饭', '玉米排骨汤', '焦糖布丁', '西红柿炒蛋', '青椒土豆丝',
    '蒜蓉西兰花', '干煸豆角', '香菇滑鸡', '鱼香肉丝', '宫保鸡丁', '蛋炒饭',
    '紫菜蛋花汤', '冬瓜丸子汤',
}
# 内置菜的 ID 是手写 slug，扩展菜的稳定 ID 不能和它们撞
RESERVED_IDS = {
    'hongshaorou', 'jinian', 'kele', 'zhengyu', 'mapo', 'fanqie', 'congyou', 'jufan',
    'tang', 'buding', 'fanqiechao', 'tudousi', 'xilanhua', 'doujiao', 'huaji',
    'yuxiang', 'gongbao', 'danchaofan', 'zicaitang', 'donggua',
}


def stable_id(name):
    """菜名 → 稳定 ID。改名等于新菜，必须同时更新 legacy_ids.json"""
    return 'd' + hashlib.sha1(name.encode('utf-8')).hexdigest()[:12]



def cats_of(d):
    """按主料/做法/价位推导场景分类。目标是分布均衡，不是全塞进硬菜"""
    name, main, method, price = d['name'], d['main'], d['method'], d['price']
    sweet_kw = ('布丁', '糕', '圆子', '甜', '芋泥', '豆沙', '酒酿', '汤圆', '糖藕', '赤豆糊', '花生汤', '蜜汁', '糖油')
    if any(k in name for k in sweet_kw) and '糖醋' not in name:
        return ['tiandian']
    out = []
    if main == '米面':
        out.append('zhushi')
    if main == '蔬菜':
        out.append('sucai')
    # 硬菜只收"贵的大菜"，其余肉菜归家常，避免一半菜单都是硬菜
    if price >= 10 or (method in ('烤', '炸') and price >= 9) or (method == '炖' and price >= 12):
        out.append('yingle')
    if method == '煮' and any(k in name for k in ('汤', '羹', '粥')):
        out.append('tang')
    if not out:
        out.append('jiachang')
    return out


def build():
    data = []
    for i in (1, 2, 3):
        p = os.path.join(ROOT, 'build', 'dishes_%d.py' % i)
        if not os.path.exists(p):
            continue
        ns = {}
        exec(io.open(p, encoding='utf-8').read(), ns)
        data.extend(ns['D'])

    legacy = {}
    if os.path.exists(LEGACY_FILE):
        legacy = json.load(io.open(LEGACY_FILE, encoding='utf-8'))
        if not isinstance(legacy, dict):
            print('build/legacy_ids.json 必须是 JSON 对象')
            return 1
    else:
        print('找不到 build/legacy_ids.json：旧位置 ID 的迁移映射不能重建，拒绝生成')
        return 1

    seen_id, seen_name, out = set(RESERVED_IDS), set(), []
    for row in data:
        (name, cuisine, main, method, price, time_, spicy, desc, ing, steps, *rest) = row
        note = rest[0] if rest else ''
        if name in seen_name or name in EXISTING_NAMES:
            if name in EXISTING_NAMES:
                print('  跳过（内置已有）：' + name)
            continue
        seen_name.add(name)
        slug = stable_id(name)
        if slug in seen_id:
            raise ValueError('菜品 ID 冲突：%s -> %s，请检查菜名或 collision 策略' % (name, slug))
        cuisine = '融合' if cuisine == '家常' else cuisine
        d = {
            'id': slug, 'name': name,
            'cats': cats_of({'name': name, 'main': main, 'method': method, 'price': price}),
            'cuisine': cuisine, 'main': main, 'method': method,
            'price': price, 'time': time_ or TIME_BY_METHOD.get(method, 20), 'spicy': spicy,
            'art': ART_BY_MAIN.get(main, 'veg'),
            'desc': desc,
            'note': note or NOTE_POOL[len(out) % len(NOTE_POOL)],
            'ingredients': [x.strip() for x in ing.split('|') if x.strip()],
            'steps': [x.strip() for x in steps.split('|') if x.strip()],
            'servings': SERVINGS_BY_MAIN.get(main, '两人份'),
            'difficulty': DIFF_BY_METHOD.get(method, '简单'),
            'byChef': False, 'sign': False,
        }
        out.append(d)
        seen_id.add(slug)

    payload = {'dishes': out, 'legacyIds': legacy}
    compact = json.dumps(payload, ensure_ascii=False, separators=(',', ':'))
    os.makedirs(SRC, exist_ok=True)
    io.open(SRC_DATA, 'w', encoding='utf-8', newline='').write(
        json.dumps(payload, ensure_ascii=False, indent=2) + '\n')
    print('生成 %d 道菜，旧 ID 映射 %d 条，数据 %d 字符（打包前）' % (len(out), len(legacy), len(compact)))
    # 分类分布
    from collections import Counter
    c = Counter()
    for d in out:
        for k in d['cats']:
            c[k] += 1
    print('分类分布：' + ' '.join('%s=%d' % (k, v) for k, v in sorted(c.items())))
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import bundle
    return bundle.build()


if __name__ == '__main__':
    sys.exit(build())
