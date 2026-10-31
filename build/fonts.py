# -*- coding: utf-8 -*-
"""小食光字体子集生成器
把标题字体 ZCOOL KuaiLe 和数字字体 Baloo 2 按当前文案子集化，
输出内嵌 base64 的 src/fonts.css。

运行：python build/fonts.py
依赖：fonttools + brotli + 网络（首次下载原始字体）
生成后运行 python build/bundle.py 才会更新 HTML。
"""
import base64, glob, io, os, subprocess, sys, tempfile
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')
OUT = os.path.join(SRC, 'fonts.css')
URLS = {
    'zcool.ttf': 'https://gstatic.loli.net/s/zcoolkuaile/v22/tssqApdaRQokwFjFJjvM6h2Wpg.ttf',
    'baloo.ttf': 'https://gstatic.loli.net/s/baloo2/v23/wXK0E3kTposypRydzVT08TS3JnAmtdiayqpv.ttf',
}


def text_of_sources():
    text = ''
    paths = [os.path.join(SRC, 'template.html'), os.path.join(SRC, 'seed-dishes.json')]
    paths += sorted(glob.glob(os.path.join(SRC, 'js', '*.js')))
    for p in paths:
        text += io.open(p, encoding='utf-8').read()
    return ''.join(sorted(set(ch for ch in text if ord(ch) >= 32)))


def subset(src, text, out, text_file=None):
    cmd = [sys.executable, '-m', 'fontTools.subset', src]
    if text_file:
        cmd += ['--text-file=' + text_file]
    else:
        cmd += ['--text=' + text]
    cmd += ['--layout-features=*', '--name-IDs=*', '--flavor=woff2',
            '--output-file=' + out]
    subprocess.check_call(cmd)


def main():
    try:
        import fontTools  # noqa: F401
        import brotli  # noqa: F401
    except ImportError:
        print('需要先安装：pip install fonttools brotli')
        return 1
    with tempfile.TemporaryDirectory() as tmp:
        raw = {}
        for name, url in URLS.items():
            p = os.path.join(tmp, name)
            print('下载', url)
            req = urllib.request.Request(url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                              '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            })
            with urllib.request.urlopen(req, timeout=60) as r, open(p, 'wb') as f:
                f.write(r.read())
            raw[name] = p
        chars = text_of_sources()
        chars_path = os.path.join(tmp, 'chars.txt')
        io.open(chars_path, 'w', encoding='utf-8').write(chars)
        z = os.path.join(tmp, 'zcool.woff2')
        b = os.path.join(tmp, 'baloo.woff2')
        subset(raw['zcool.ttf'], None, z, chars_path)
        subset(raw['baloo.ttf'], '0123456789.,+-%/×:：', b)
        zr, br = open(z, 'rb').read(), open(b, 'rb').read()
        css = '''/* ZCOOL KuaiLe Regular · 按当前文案子集化 · SIL OFL 1.1（见 THIRD_PARTY_NOTICES.rst） */
@font-face{font-family:"ZCOOL KuaiLe";font-style:normal;font-weight:400;font-display:swap;src:url(data:font/woff2;base64,%s) format("woff2")}
/* Baloo 2 ExtraBold · 数字与符号子集 · SIL OFL 1.1（见 THIRD_PARTY_NOTICES.rst） */
@font-face{font-family:"Baloo 2";font-style:normal;font-weight:800;font-display:swap;src:url(data:font/woff2;base64,%s) format("woff2")}
''' % (base64.b64encode(zr).decode('ascii'), base64.b64encode(br).decode('ascii'))
        io.open(OUT, 'w', encoding='utf-8', newline='').write(css)
        print('生成 %s：ZCOOL %d / Baloo %d / CSS %d 字符' % (OUT, len(zr), len(br), len(css)))
        print('下一步：python build/bundle.py')
    return 0


if __name__ == '__main__':
    sys.exit(main())
