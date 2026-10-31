小食光 V2
=========

移动端电子菜谱 / 点菜原型。一个大厨、一个宝贝，用同一台手机切换身份：宝贝点菜、撒娇、评价；大厨接单、开火、开饭、管理菜单。

当前是本地演示版：没有后端、没有账号、没有实时同步，数据存在浏览器 localStorage。源码拆分为模板 / CSS / JS / 数据四部分，发布时打包成单文件 HTML，保持双击即用。

快速开始
--------

::

    # 直接打开（仓库里已有打包好的产物）
    start 小食光-V2.html

    # 只改了 CSS / JS / 模板后，重新打包
    python build/bundle.py

    # 改了菜谱数据后，重新生成数据并自动打包
    python build/gen.py

    # 大量改文案/新增生僻字后，重新生成内嵌字体子集（需要 fonttools、brotli 和网络）
    python build/fonts.py
    python build/bundle.py

    # 静态检查（不传路径时默认检查打包产物）
    node audit/check.js

    # 端到端检查（需要本机 Edge/Chrome；可用 XSG_BROWSER 指定路径）
    node audit/e2e.js

要求：Node 22+（端到端脚本依赖内置 fetch / WebSocket）。浏览器测试使用临时配置目录，不会污染真实 localStorage。

目录
----

::

    小食光-V2.html          发布产物：由 src/ + build/bundle.py 生成，不要直接手改
    src/template.html       静态页面、SVG、弹窗和屏结构
    src/styles.css          设计 token、组件样式、响应式规则
    src/fonts.css           内嵌 base64 的 ZCOOL KuaiLe / Baloo 2 子集字体
    src/js/01-data.js       数据层、文案池、筛选维度
    src/js/02-state.js      状态、存储、迁移、派生与工具
    src/js/03-render.js     八屏渲染
    src/js/04-actions.js    路由、动作表、事件绑定、自检、启动
    src/seed-dishes.json    生成后的菜谱 JSON（含历史 ID 映射）
    build/dishes_1.py ...   扩展菜谱原始数据
    build/gen.py            生成 src/seed-dishes.json，并调用 bundle.py 打包
    build/bundle.py         把模板、CSS、JS、数据打包成 小食光-V2.html
    build/fonts.py          按当前文案重新生成 src/fonts.css
    build/legacy_ids.json   冻结的旧菜品 ID -> 新稳定 ID 映射，不要随手删改
    audit/check.js          静态检查：语法、动作实现、关键函数/常量、文案 key、插画引用
    audit/e2e.js            端到端检查：自检 + 主流程 + 持久化 + 旧 ID 迁移
    audit/tmp-hero.html     早期视觉稿临时文件，不被主文件引用
    THIRD_PARTY_NOTICES.rst 内嵌字体的 SIL OFL 许可文本

菜品 ID 策略（改数据前必读）
---------------------------

* 内置 20 道菜使用手写 ID（如 hongshaorou）。
* 扩展菜使用菜名 SHA-1 前 12 位：d6248f88c0b96 这种形式，与排序、插入位置无关。
* 旧版本的位置 ID（d1、d2...）对应新 ID 的映射冻结在 build/legacy_ids.json，由 gen.py 写入 src/seed-dishes.json，再由 bundle.py 打包进 HTML。运行时 migrateLegacyDishIds() 会把本地存档里的菜品、购物车、收藏、订单条目、订单快照、下架记录一起迁移。
* 不要重新生成 legacy_ids.json。它记录的是历史存档的映射，不是当前数据。
* 改名等于新建一道菜：稳定 ID 由菜名计算，改名后旧 ID 不会自动跟过去。需要保留旧评价/收藏时，必须另写迁移。
* 新增菜只需要在 dishes_*.py 里追加；重新运行 python build/gen.py 即可，已有菜的 ID 不变。

数据更新流程
------------

::

    1. 编辑 build/dishes_*.py
    2. python build/gen.py          # 生成数据并打包
    3. node audit/check.js
    4. node audit/e2e.js
    5. 提交

只改 src/styles.css / src/fonts.css / src/js/*.js / src/template.html 时，运行 python build/bundle.py 即可；这些源码不要直接改输出文件 小食光-V2.html。

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

字体
----

* ZCOOL KuaiLe（标题）和 Baloo 2（数字）按当前文案子集化后以 base64 内嵌在 src/fonts.css，发布产物零外部字体请求。
* 手写体改用系统楷体（Kaiti SC / STKaiti / KaiTi），不再下载寒蝉正楷。
* 新增生僻字或大量改文案后，运行 python build/fonts.py 重新子集化，再运行 python build/bundle.py；否则新字会回退到系统字体。
* 字体许可全文见 THIRD_PARTY_NOTICES.rst。

已知限制
--------

* 发布产物仍是单文件，打包后 JS 约 2099 行；源码已按数据/状态/渲染/动作拆到 src/js/，后续可继续按模块细化。
* 角色切换是本机演示，不是实时同步；厨房页内也有提示。
* 字体按当前文案子集化；新增生僻字不会自动进入内嵌字体，需要重新运行 build/fonts.py。
* audit/tmp-hero.html 是未引用的临时文件，保留仅作视觉参考。
