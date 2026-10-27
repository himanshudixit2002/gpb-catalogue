#!/usr/bin/env python3
"""Build the catalogue app.

    python3 build.py            build the website into public/ and the single-file copy into build/
    python3 build.py test <prefixes> <body.js> <name.html>    (engine test pages, used by test/)

public/ is what Firebase Hosting serves:
    index.html                 small page shell
    assets/app.<hash>.js       the app        } names change when the content changes,
    assets/fonts.<hash>.js     embedded fonts } so phones can keep them cached for good
    assets/app.<hash>.css      styles         }
    manifest.webmanifest, icons/, robots.txt, sw.js (offline, updates, sharing into the app)
    vendor/imgly/<v>/          AI cut-out: library, worker, engine and model files (from vendor/)

build/catalogue-maker.html is the same app in one file (works offline when opened from a website).
"""
import base64, glob, hashlib, json, os, re, shutil, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
FONTS = os.path.join(ROOT, 'fonts')
SITE_DIR = os.path.join(ROOT, 'site')
VENDOR = os.path.join(ROOT, 'vendor')
PUBLIC = os.path.join(ROOT, 'public')
BUILD = os.path.join(ROOT, 'build')
FONT_FILES = ['poppins-400', 'poppins-500', 'poppins-700', 'lora-400', 'lora-700']


def read(path, mode='r'):
    with open(path, mode, **({} if 'b' in mode else {'encoding': 'utf-8'})) as fh:
        return fh.read()


def write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb' if isinstance(data, bytes) else 'w', **({} if isinstance(data, bytes) else {'encoding': 'utf-8'})) as fh:
        fh.write(data)


def site_config():
    return json.loads(read(os.path.join(SITE_DIR, 'site.json')))


def ai_version():
    """The AI library version is pinned once, in package.json."""
    try:
        return json.loads(read(os.path.join(ROOT, 'package.json')))['devDependencies']['@imgly/background-removal']
    except (OSError, KeyError, ValueError):
        return '1.7.0'


AI_VERSION = ai_version()


def font_js():
    data = {f: base64.b64encode(read(os.path.join(FONTS, f + '.ttf'), 'rb')).decode('ascii') for f in FONT_FILES}
    return 'const FONT_DATA = ' + json.dumps(data) + ';\n'


def js_bundle(names=None):
    files = sorted(glob.glob(os.path.join(SRC, '*.js')))
    if names:
        files = [f for f in files if os.path.basename(f).split('-')[0] in names]
    return '\n'.join('/* ---- ' + os.path.basename(f) + ' ---- */\n' + read(f) for f in files)


def site_js(cfg, kind):
    """kind: 'site' (the website, with service worker) or 'single' (the one-file copy)"""
    site = {k: cfg[k] for k in ('name', 'short_name', 'url') if k in cfg}
    site.update({'repo': cfg.get('repo', ''), 'ai': AI_VERSION, 'build': kind})
    return 'const SITE = ' + json.dumps(site) + ';\n'


def check_js(js):
    if '</script' in js.lower():
        raise SystemExit('JS contains a closing script tag')


def short_hash(data):
    return hashlib.sha256(data.encode('utf-8') if isinstance(data, str) else data).hexdigest()[:10]


def build_single(cfg):
    """One self-contained HTML file (fonts, styles and code inline)."""
    html, css = read(os.path.join(SRC, 'index.html')), read(os.path.join(SRC, 'style.css'))
    js = site_js(cfg, 'single') + font_js() + js_bundle()
    check_js(js)
    html = html.replace('/*__CSS__*/', css).replace('/*__JS__*/', js)
    path = os.path.join(BUILD, 'catalogue-maker.html')
    write(path, html)
    print('built', os.path.relpath(path, ROOT), os.path.getsize(path), 'bytes')


def manifest(cfg):
    return {
        'id': './',
        'name': cfg['name'],
        'short_name': cfg['short_name'],
        'description': cfg['description'],
        'lang': cfg.get('lang', 'en'),
        'start_url': './?source=app',
        'scope': './',
        'display': 'standalone',
        'background_color': cfg['background_color'],
        'theme_color': cfg['theme_color'],
        'categories': ['business', 'productivity'],
        'icons': [
            {'src': 'icons/icon-192.png', 'sizes': '192x192', 'type': 'image/png', 'purpose': 'any'},
            {'src': 'icons/icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any'},
            {'src': 'icons/maskable-192.png', 'sizes': '192x192', 'type': 'image/png', 'purpose': 'maskable'},
            {'src': 'icons/maskable-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'}
        ],
        'shortcuts': [
            {'name': 'Add products', 'short_name': 'Add', 'url': './?action=add',
             'icons': [{'src': 'icons/shortcut-add.png', 'sizes': '96x96', 'type': 'image/png'}]},
            {'name': 'Make a catalogue', 'short_name': 'Catalogue', 'url': './?action=catalogue',
             'icons': [{'src': 'icons/shortcut-catalogue.png', 'sizes': '96x96', 'type': 'image/png'}]}
        ],
        'share_target': {
            'action': './share-target',
            'method': 'POST',
            'enctype': 'multipart/form-data',
            'params': {'title': 'title', 'text': 'text', 'files': [{
                'name': 'files',
                'accept': ['image/*', 'text/csv', 'text/comma-separated-values', '.csv', 'application/zip', '.zip']
            }]}
        }
    }


def copy_if_changed(src, dst):
    if os.path.exists(dst) and os.path.getsize(dst) == os.path.getsize(src) and os.path.getmtime(dst) >= os.path.getmtime(src):
        return False
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(src, dst)
    return True


def build_site(cfg):
    """The website for Firebase Hosting, written into public/."""
    css = read(os.path.join(SRC, 'style.css'))
    app_js, fonts = site_js(cfg, 'site') + js_bundle(), font_js()
    check_js(app_js)
    files = {
        f'assets/app.{short_hash(app_js)}.js': app_js,
        f'assets/fonts.{short_hash(fonts)}.js': fonts,
        f'assets/app.{short_hash(css)}.css': css,
    }
    js_files = [k for k in files if k.endswith('.js')]
    js_files.sort(key=lambda k: 0 if '/fonts.' in k else 1)  # fonts first, then the app
    css_file = next(k for k in files if k.endswith('.css'))

    html = read(os.path.join(SRC, 'index.html'))
    head_extra = '\n'.join([
        f'<link rel="manifest" href="manifest.webmanifest">',
        f'<link rel="icon" href="icons/favicon-32.png" sizes="32x32" type="image/png">',
        f'<link rel="icon" href="icons/favicon-48.png" sizes="48x48" type="image/png">',
        f'<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">',
        f'<meta name="robots" content="noindex">',
        f'<link rel="stylesheet" href="{css_file}">',
    ] + [f'<script defer src="{f}"></script>' for f in js_files])
    html = re.sub(r'<link id="manifest"[^>]*>\n?', '', html)
    html = re.sub(r'<link id="appicon"[^>]*>\n?', '', html)
    html = re.sub(r'<style>\s*/\*__CSS__\*/\s*</style>\n?', head_extra + '\n', html)
    html = re.sub(r'<script>\s*/\*__JS__\*/\s*</script>\n?', '', html)
    html = re.sub(r'<title>[^<]*</title>', f'<title>{cfg["name"]}</title>', html)
    html = re.sub(r'(<meta name="apple-mobile-web-app-title" content=")[^"]*(")', r'\g<1>' + cfg['short_name'] + r'\2', html)
    html = re.sub(r'(<meta name="theme-color" content=")[^"]*(")', r'\g<1>' + cfg['theme_color'] + r'\2', html)
    if '__CSS__' in html or '__JS__' in html:
        raise SystemExit('index.html placeholders were not replaced')
    files['index.html'] = html
    files['manifest.webmanifest'] = json.dumps(manifest(cfg), indent=1, ensure_ascii=False)

    # start clean (keep vendor/ to avoid copying big AI files again)
    if os.path.isdir(PUBLIC):
        for name in os.listdir(PUBLIC):
            p = os.path.join(PUBLIC, name)
            if name == 'vendor':
                continue
            shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
    for rel, data in files.items():
        write(os.path.join(PUBLIC, rel), data)
    os.makedirs(os.path.join(PUBLIC, 'icons'), exist_ok=True)
    for name in sorted(os.listdir(os.path.join(SITE_DIR, 'icons'))):
        shutil.copy2(os.path.join(SITE_DIR, 'icons', name), os.path.join(PUBLIC, 'icons', name))
    shutil.copy2(os.path.join(SITE_DIR, 'robots.txt'), os.path.join(PUBLIC, 'robots.txt'))

    # AI cut-out: self-hosted library + data (fetched by `npm run vendor`), plus our worker
    ai_src = os.path.join(VENDOR, 'imgly', AI_VERSION)
    ai_dst = os.path.join(PUBLIC, 'vendor', 'imgly', AI_VERSION)
    copied = 0
    if os.path.isdir(ai_src):
        for dirpath, _, names in os.walk(ai_src):
            for n in names:
                s = os.path.join(dirpath, n)
                copied += copy_if_changed(s, os.path.join(ai_dst, os.path.relpath(s, ai_src)))
        write(os.path.join(ai_dst, 'ai-worker.mjs'), read(os.path.join(SRC, 'ai-worker.mjs')))
        # remove AI versions no longer used
        vroot = os.path.join(PUBLIC, 'vendor', 'imgly')
        for v in os.listdir(vroot):
            if v != AI_VERSION:
                shutil.rmtree(os.path.join(vroot, v))
    else:
        print('note: vendor/imgly/%s is missing; run `npm run vendor` to add the AI cut-out files' % AI_VERSION)

    # service worker: version = hash of everything the page needs
    precache = ['./', *sorted(files.keys() - {'index.html'}), 'icons/favicon-32.png', 'icons/apple-touch-icon.png', 'icons/icon-192.png']
    version = short_hash(''.join(files[k] if isinstance(files[k], str) else '' for k in sorted(files)) + AI_VERSION)
    sw = read(os.path.join(SITE_DIR, 'sw.js')).replace('__VERSION__', version).replace('__AI_VERSION__', AI_VERSION)
    sw = sw.replace('__PRECACHE__', json.dumps(precache))
    write(os.path.join(PUBLIC, 'sw.js'), sw)
    size = sum(os.path.getsize(os.path.join(PUBLIC, k)) for k in files)
    print(f'built public/ version {version}: {len(files)} files, {size // 1024} KB'
          + (f', AI files {"updated" if copied else "unchanged"}' if os.path.isdir(ai_src) else ''))


def build_test(prefixes, body_js, name):
    js = font_js() + js_bundle(prefixes)
    html = '<!doctype html><meta charset="utf-8"><body><script>' + js + '\n' + body_js + '</script></body>'
    path = os.path.join(ROOT, 'test', name)
    write(path, html)
    print('test page', path)


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'test':
        build_test(sys.argv[2].split(','), read(sys.argv[3]), sys.argv[4])
    else:
        cfg = site_config()
        build_single(cfg)
        build_site(cfg)
