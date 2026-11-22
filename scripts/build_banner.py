#!/usr/bin/env python3
"""Generate the hero banner (dark + light) and the divider into assets/.
Edit the PALETTE or TEXT values below and re-run:  python3 scripts/build_banner.py
Text uses a system font stack (external fonts do not load inside GitHub-rendered images).
The only animation is one slow glow drift (SMIL); it is static where SMIL is unsupported.
"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
NAME = "Shanudha Tirosh"
TAGLINE = "Building Ideas into Reality."
ALT = "Banner: Shanudha Tirosh, Building Ideas into Reality."
FONT = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

PALETTE = {
    "dark": dict(bg1="#1a1b26", bg2="#14151f", name="#c0caf5", tag="#7aa2f7",
                 glow="#7aa2f7", glow_op=".20", a="#7aa2f7", b="#bb9af7",
                 plate1="#24283b", plate1s="#3b4261", plate2="#2a2f4a", plate2s="#565f89",
                 bar="#1a1b26", grid="#c0caf5"),
    "light": dict(bg1="#f5f6fa", bg2="#e9ecf6", name="#1f2335", tag="#34548a",
                  glow="#7aa2f7", glow_op=".28", a="#3d59a1", b="#7e57c2",
                  plate1="#e1e5f2", plate1s="#b9c0dc", plate2="#d3d9ee", plate2s="#8e99c4",
                  bar="#f5f6fa", grid="#1f2335"),
}


def banner(c):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 300" width="1200" height="300" role="img" aria-label="{ALT}">
  <title>{NAME}</title>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{c['bg1']}"/><stop offset="1" stop-color="{c['bg2']}"/></linearGradient>
    <radialGradient id="glow"><stop offset="0" stop-color="{c['glow']}" stop-opacity="{c['glow_op']}"/><stop offset="1" stop-color="{c['glow']}" stop-opacity="0"/></radialGradient>
    <linearGradient id="top" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{c['a']}"/><stop offset="1" stop-color="{c['b']}"/></linearGradient>
    <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="{c['grid']}" fill-opacity=".07"/></pattern>
    <clipPath id="r"><rect width="1200" height="300" rx="20"/></clipPath>
  </defs>
  <g clip-path="url(#r)">
    <rect width="1200" height="300" fill="url(#bg)"/>
    <rect width="1200" height="300" fill="url(#dots)"/>
    <circle cx="960" cy="150" r="260" fill="url(#glow)">
      <animate attributeName="cx" values="900;1020;900" dur="16s" repeatCount="indefinite" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1"/>
    </circle>
    <g>
      <rect x="880" y="44" width="250" height="150" rx="20" fill="{c['plate1']}" stroke="{c['plate1s']}" stroke-width="2"/>
      <rect x="860" y="74" width="250" height="150" rx="20" fill="{c['plate2']}" stroke="{c['plate2s']}" stroke-width="2"/>
      <rect x="840" y="104" width="250" height="150" rx="20" fill="url(#top)"/>
      <circle cx="872" cy="136" r="9" fill="{c['bar']}" fill-opacity=".85"/>
      <rect x="892" y="130" width="120" height="12" rx="6" fill="{c['bar']}" fill-opacity=".85"/>
      <rect x="862" y="166" width="190" height="10" rx="5" fill="{c['bar']}" fill-opacity=".55"/>
      <rect x="862" y="188" width="150" height="10" rx="5" fill="{c['bar']}" fill-opacity=".55"/>
      <rect x="862" y="210" width="90" height="10" rx="5" fill="{c['bar']}" fill-opacity=".55"/>
    </g>
    <text x="64" y="150" font-family="{FONT}" font-size="84" font-weight="800" letter-spacing="-2" fill="{c['name']}">{NAME}</text>
    <rect x="68" y="182" width="64" height="5" rx="2.5" fill="{c['a']}"/>
    <text x="66" y="236" font-family="{FONT}" font-size="38" font-weight="600" fill="{c['tag']}">{TAGLINE}</text>
  </g>
</svg>
'''


DIVIDER = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 24" width="1200" height="24" aria-hidden="true">
  <defs><linearGradient id="l" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#7aa2f7" stop-opacity="0"/><stop offset=".5" stop-color="#7aa2f7" stop-opacity=".7"/><stop offset="1" stop-color="#bb9af7" stop-opacity="0"/>
  </linearGradient></defs>
  <rect x="0" y="11" width="1200" height="2" fill="url(#l)"/>
  <rect x="588" y="6" width="24" height="12" rx="6" fill="#7aa2f7" fill-opacity=".85"/>
</svg>
'''

for mode, c in PALETTE.items():
    (ROOT / "assets/banner" / f"hero-{mode}.svg").write_text(banner(c))
(ROOT / "assets/dividers/divider.svg").write_text(DIVIDER)
print("banner + divider written")
