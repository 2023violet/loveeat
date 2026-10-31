# -*- coding: utf-8 -*-
"""小食光源码打包器
把 src/template.html、src/styles.css、src/seed-dishes.json、src/app.js
打包成可直接打开的 小食光-V2.html。

运行：python build/bundle.py
"""
import io, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')
ENTRY = os.path.join(ROOT, '小食光-V2.html')
FILES = {
    '@@XSG_STYLES@@': os.path.join(SRC, 'styles.css'),
    '@@XSG_DATA@@': os.path.join(SRC, 'seed-dishes.json'),
}


def read(path):
    return io.open(path, encoding='utf-8', newline='').read()


def read_js():
    js_dir = os.path.join(SRC, 'js')
    names = sorted(n for n in os.listdir(js_dir) if n.endswith('.js'))
    if not names:
        raise ValueError('src/js 下没有 JS 文件')
    return '\n'.join(read(os.path.join(js_dir, n)) for n in names)


def build():
    template = read(os.path.join(SRC, 'template.html'))
    styles = read(FILES['@@XSG_STYLES@@'])
    app = read_js()
    payload = json.loads(read(FILES['@@XSG_DATA@@']))
    data = json.dumps(payload, ensure_ascii=False, separators=(',', ':'))
    # 防止数据里的 </script> 提前结束脚本块
    data = data.replace('</script>', '<\\/script>')
    values = {'@@XSG_STYLES@@': styles, '@@XSG_DATA@@': data, '@@XSG_APP_JS@@': app}
    for token, value in values.items():
        if template.count(token) != 1:
            print('模板占位符异常：%s 出现 %d 次' % (token, template.count(token)))
            return 1
        template = template.replace(token, value, 1)
    io.open(ENTRY, 'w', encoding='utf-8', newline='').write(template)
    print('打包完成：HTML %d 字符 / %d 行，CSS %d，JS %d，数据 %d' % (
        len(template), template.count('\n') + 1, len(styles), len(app), len(data)))
    return 0


if __name__ == '__main__':
    sys.exit(build())
