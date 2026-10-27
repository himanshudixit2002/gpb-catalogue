#!/usr/bin/env python3
"""Build the single-file app: inline CSS, JS modules and base64 fonts into one HTML file."""
import base64, json, os, re, sys, glob

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
FONTS = os.path.join(ROOT, 'fonts')
OUT = os.path.join(ROOT, 'build')

FONT_FILES = ['poppins-400', 'poppins-500', 'poppins-700', 'lora-400', 'lora-700']

def font_js():
    data = {}
    for f in FONT_FILES:
        with open(os.path.join(FONTS, f + '.ttf'), 'rb') as fh:
            data[f] = base64.b64encode(fh.read()).decode('ascii')
    return 'const FONT_DATA = ' + json.dumps(data) + ';\n'

def js_bundle(names=None):
    files = sorted(glob.glob(os.path.join(SRC, '*.js')))
    if names:
        files = [f for f in files if os.path.basename(f).split('-')[0] in names]
    out = []
    for f in files:
        with open(f, encoding='utf-8') as fh:
            out.append('/* ---- ' + os.path.basename(f) + ' ---- */\n' + fh.read())
    return '\n'.join(out)

def build_app():
    with open(os.path.join(SRC, 'index.html'), encoding='utf-8') as fh:
        html = fh.read()
    with open(os.path.join(SRC, 'style.css'), encoding='utf-8') as fh:
        css = fh.read()
    js = font_js() + js_bundle()
    if '</script' in js.lower():
        raise SystemExit('JS contains a closing script tag')
    html = html.replace('/*__CSS__*/', css).replace('/*__JS__*/', js)
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, 'catalogue-maker.html')
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write(html)
    print('built', path, os.path.getsize(path), 'bytes')

def build_test(prefixes, body_js, name):
    js = font_js() + js_bundle(prefixes)
    html = '<!doctype html><meta charset="utf-8"><body><script>' + js + '\n' + body_js + '</script></body>'
    os.makedirs(os.path.join(ROOT, 'test'), exist_ok=True)
    path = os.path.join(ROOT, 'test', name)
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write(html)
    print('test page', path)

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'test':
        prefixes = sys.argv[2].split(',')
        body = open(sys.argv[3], encoding='utf-8').read()
        build_test(prefixes, body, sys.argv[4])
    else:
        build_app()
