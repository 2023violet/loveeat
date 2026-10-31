小食光 V2
=========

移动端电子菜谱 / 点菜原型。一个大厨、一个宝贝，用同一台手机切换身份：宝贝点菜、撒娇、评价；大厨接单、开火、开饭、管理菜单。

当前是单文件本地演示版：没有后端、没有账号、没有实时同步，数据存在浏览器 localStorage。

快速开始
--------

::

    # 直接打开（不需要构建）
    start 小食光-V2.html

    # 静态检查（不传路径时默认检查仓库根目录的主文件）
    node audit/check.js

    # 端到端检查（需要本机 Edge/Chrome；可用 XSG_BROWSER 指定路径）
    node audit/e2e.js

要求：Node 22+（端到端脚本依赖内置 fetch / WebSocket）。浏览器测试使用临时配置目录，不会污染真实 localStorage。

目录
----

::

    小食光-V2.html          唯一运行产物：CSS、SVG、菜谱 JSON、JS 全部内联
    build/dishes_1.py ...   扩展菜谱原始数据
    build/gen.py            读取菜谱数据，生成并注入 seed-dishes JSON
    build/legacy_ids.json   冻结的旧菜品 ID -> 新稳定 ID 映射，不要随手删改
    audit/check.js          静态检查：语法、动作实现、关键函数/常量、文案 key、插画引用
    audit/e2e.js            端到端检查：自检 + 主流程 + 持久化 + 旧 ID 迁移
    audit/tmp-hero.html     早期视觉稿临时文件，不被主文件引用

菜品 ID 策略（改数据前必读）
---------------------------

* 内置 20 道菜使用手写 ID（如 hongshaorou）。
* 扩展菜使用菜名 SHA-1 前 12 位：d6248f88c0b96 这种形式，与排序、插入位置无关。
* 旧版本的位置 ID（d1、d2...）对应新 ID 的映射冻结在 build/legacy_ids.json，由 gen.py 注入 HTML 的 legacyIds。运行时 migrateLegacyDishIds() 会把本地存档里的菜品、购物车、收藏、订单条目、订单快照、下架记录一起迁移。
* 不要重新生成 legacy_ids.json。它记录的是历史存档的映射，不是当前数据。
* 改名等于新建一道菜：稳定 ID 由菜名计算，改名后旧 ID 不会自动跟过去。需要保留旧评价/收藏时，必须另写迁移。
* 新增菜只需要在 dishes_*.py 里追加；重新运行 python build/gen.py 即可，已有菜的 ID 不变。

数据更新流程
------------

::

    1. 编辑 build/dishes_*.py
    2. python build/gen.py
    3. node audit/check.js
    4. node audit/e2e.js
    5. 提交

核心架构
--------

* 入口：boot()（HTML 末尾）-> loadState() -> rolloverDay() -> 首页 -> selfTest()。
* 状态：单个 state 对象，key 为 xiaoshiguang.v2，SCHEMA_VER = 4。
* 变更：所有状态变更走 commit()：改状态 -> 防抖保存 -> 重绘当前屏 -> 校验余额与账本。
* 页面：home / detail / order / success / orders / wallet / kitchen / review，集中在 RENDER 表。
* 角色：state.me = 'baby' | 'chef'，动作由 BABY_ONLY / CHEF_ONLY 门控。
* 订单：pending -> accepted -> cooking -> served -> rated；取消/拒单退款，评价回写菜品。
* 钱包：opening + Σledger === wallet.balance；每月 1 日自动发 100；撒娇每天 3 次，基础 10、每花 10 多给 10、封顶 30。
* 菜单管理：大厨可新增、编辑、下架菜品；表单包含菜系/主料/做法/份量，编辑保留原 ID、收藏和食评；厨房菜单支持搜索。
* 点菜发现：首页「手气」在当前分类/搜索/筛选和余额内随机推荐一道，先避开购物车已有菜。
* 撒娇闭环：零花钱页展示今天的撒娇记录，待批/已批金额/拒绝理由都能看到。
* 调试入口：浏览器控制台里的 window.__XSG。

已知限制
--------

* 单文件体积已超过 audit/check.js 的 JS 行数预算（当前约 2090 行），继续加功能前应考虑拆分。
* 角色切换是本机演示，不是实时同步；厨房页内也有提示。
* 字体 CSS 已改为异步加载；离线时使用系统字体兜底。
* audit/tmp-hero.html 是未引用的临时文件，保留仅作视觉参考。
