#!/usr/bin/env python3
"""Make the English pages (en/*.html) from the Japanese pages.

The Japanese pages are the source: text-only elements carry data-ja / data-en, and English text
with markup sits in <template data-lang="en">. This script writes en/<page> with the English text
in place, Japanese-only elements removed, links and asset paths adjusted, and English metadata.

  python3 _dev/build_en.py           write en/*.html
  python3 _dev/build_en.py --check   exit 1 if en/*.html is out of date (used by the tests)

Do not edit en/*.html by hand; edit the Japanese page and run this script.
"""
import html
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGES = ['index.html', 'research.html', 'publications.html', 'tools.html']
BASE = 'https://yosuke-matsuo.github.io/'
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}


def page_url(page, en):
    path = '' if page == 'index.html' else page
    return BASE + ('en/' if en else '') + path


class Ranges(HTMLParser):
    """Character ranges of elements whose start tag matches want(tag, attrs)."""

    def __init__(self, text, want):
        super().__init__(convert_charrefs=False)
        self.text, self.want, self.stack, self.found = text, want, [], []
        self.offsets = [0]
        for line in text.split('\n')[:-1]:
            self.offsets.append(self.offsets[-1] + len(line) + 1)
        self.feed(text)

    def _pos(self):
        line, col = self.getpos()
        return self.offsets[line - 1] + col

    def handle_starttag(self, tag, attrs):
        if tag in VOID:
            return
        start = self._pos()
        open_end = self.text.index('>', start) + 1
        self.stack.append((tag, start, open_end, self.want(tag, dict(attrs))))

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        while self.stack:
            t, start, open_end, hit = self.stack.pop()
            if t == tag:
                if hit:
                    close_start = self._pos()
                    self.found.append((start, open_end, close_start, self.text.index('>', close_start) + 1))
                return


def outermost(ranges):
    out = []
    for r in sorted(ranges):
        if out and r[0] < out[-1][3]:
            continue
        out.append(r)
    return out


def replace_ranges(text, ranges, fn):
    for r in reversed(outermost(ranges)):
        text = text[:r[0]] + fn(text, *r) + text[r[3]:]
    return text


ATTR = re.compile(r'([\w:-]+)(?:="([^"]*)")?')


def set_attr(tag_text, name, value):
    """Set an attribute in a start tag (value already HTML-escaped)."""
    if re.search(r'\s' + re.escape(name) + r'="', tag_text):
        return re.sub(r'(\s' + re.escape(name) + r'=")[^"]*(")', lambda m: m.group(1) + value + m.group(2), tag_text, count=1)
    return re.sub(r'\s*/?>$', lambda m: f' {name}="{value}"' + m.group(0), tag_text, count=1)


def english(page):
    src = (ROOT / page).read_text(encoding='utf-8')
    s = src
    # 1. Japanese-only elements go; English templates become plain elements
    s = replace_ranges(s, Ranges(s, lambda t, a: a.get('data-lang') == 'ja').found, lambda text, a, b, c, d: '')
    def unwrap(text, a, b, c, d):
        inner = text[b:c]
        return re.sub(r'^(<[^>]*?)\s+hidden(?=[\s>])', r'\1', inner, count=1)
    s = replace_ranges(s, Ranges(s, lambda t, a: t == 'template' and a.get('data-lang') == 'en').found, unwrap)
    assert 'data-lang="ja"' not in s and '<template' not in s, page

    # 2. text-only elements, meta and img with data-ja / data-en
    def text_swap(m):
        tag, attrs = m.group(1), m.group(0)
        en = re.search(r'\sdata-en="([^"]*)"', attrs).group(1)
        if tag == 'meta':
            return set_attr(attrs, 'content', en)
        if tag == 'img':
            return set_attr(attrs, 'alt', en)
        return attrs + '\x00' + en + '\x01'
    s = re.sub(r'<(\w+)(?:\s[^>]*)?\sdata-ja="[^"]*"[^>]*>', text_swap, s)
    # the text of a swapped element ends at its first tag
    s = re.sub(r'\x00([^\x01]*)\x01[^<]*', lambda m: m.group(1), s)
    assert '\x00' not in s and '\x01' not in s, page

    # 3. language, address, sharing tags, language buttons
    s = s.replace('<html lang="ja">', '<html lang="en">', 1)
    canonical = f'<link rel="canonical" href="{page_url(page, False)}"/>'
    assert s.count(canonical) == 1, page
    s = s.replace(canonical, f'<link rel="canonical" href="{page_url(page, True)}"/>')
    title = re.search(r'<title[^>]*>([^<]*)</title>', s).group(1)
    s = re.sub(r'(<meta property="og:title" content=")[^"]*(")', lambda m: m.group(1) + title + m.group(2), s, count=1)
    s = s.replace(f'<meta property="og:url" content="{page_url(page, False)}"/>', f'<meta property="og:url" content="{page_url(page, True)}"/>', 1)
    s = s.replace('<meta property="og:locale" content="ja_JP"/>', '<meta property="og:locale" content="en_US"/>', 1)
    s = s.replace('data-language="ja" lang="ja" aria-pressed="true"', 'data-language="ja" lang="ja" aria-pressed="false"', 1)
    s = s.replace('data-language="en" lang="en" aria-pressed="false"', 'data-language="en" lang="en" aria-pressed="true"', 1)

    # 4. paths: personal pages are siblings in en/, everything else is one level up; HRMS Calc opens in English
    def path(m):
        attr, value = m.group(1), m.group(2)
        if not value.startswith('./'):
            return m.group(0)
        rest = value[2:]
        name = re.split(r'[?#]', rest)[0]
        if name in PAGES:
            return f'{attr}="./{rest}"'
        if name.startswith('hrms-calc/'):
            rest = re.sub(r'^(hrms-calc/[^?#]*)', r'\1?lang=en', rest) if '?' not in rest else rest
        return f'{attr}="../{rest}"'
    s = re.sub(r'\b(href|src)="([^"]*)"', path, s)

    note = f'<!-- English page generated from ../{page} by _dev/build_en.py. Edit the Japanese page and run the script. -->\n'
    return s.replace('<!DOCTYPE html>\n', '<!DOCTYPE html>\n' + note, 1)


def main():
    check = '--check' in sys.argv
    (ROOT / 'en').mkdir(exist_ok=True)
    stale = []
    for page in PAGES:
        out = english(page)
        dest = ROOT / 'en' / page
        if check:
            if not dest.exists() or dest.read_text(encoding='utf-8') != out:
                stale.append(page)
        else:
            dest.write_text(out, encoding='utf-8')
    if stale:
        print('en/ is out of date for: ' + ', '.join(stale) + ' (run python3 _dev/build_en.py)')
        sys.exit(1)
    print('en/ is up to date' if check else 'wrote en/' + ', en/'.join(PAGES))


if __name__ == '__main__':
    main()
