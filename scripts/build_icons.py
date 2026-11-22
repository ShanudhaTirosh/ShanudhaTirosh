#!/usr/bin/env python3
"""Generate local icon tiles into assets/icons/.

Glyphs come from the `simple-icons` npm package (CC0).
Setup:  npm i simple-icons   (run in the repo root; do not commit node_modules)
Usage:  python3 scripts/build_icons.py
To add an icon: add a (slug, label) pair to SKILLS or CONTACT below and re-run.
"""
import json
import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "node_modules" / "simple-icons" / "icons"
OUT = ROOT / "assets" / "icons"
OUT.mkdir(parents=True, exist_ok=True)

# (simple-icons slug, label shown under the tile)
SKILLS = [
    ("javascript", "JavaScript"), ("kotlin", "Kotlin"), ("python", "Python"),
    ("cplusplus", "C++"), ("gnubash", "Bash"), ("html5", "HTML"), ("css", "CSS"),
    ("react", "React"), ("nextdotjs", "Next.js"), ("vite", "Vite"),
    ("nodedotjs", "Node.js"), ("express", "Express"),
    ("firebase", "Firebase"), ("mongodb", "MongoDB"),
    ("vercel", "Vercel"), ("netlify", "Netlify"), ("githubactions", "Actions"),
    ("pm2", "PM2"), ("cloudflare", "Cloudflare"),
    ("linux", "Linux"), ("nginx", "Nginx"),
    ("android", "Android"), ("jetpackcompose", "Compose"), ("arduino", "Arduino"),
    ("espressif", "ESP8266"), ("mqtt", "MQTT"),
    ("git", "Git"), ("github", "GitHub"), ("figma", "Figma"), ("magisk", "Magisk"),
]
CONTACT = [
    ("youtube", "YouTube"), ("whatsapp", "WhatsApp"), ("gmail", "Email"), ("telegram", "Telegram"),
    ("discord", "Discord"), ("facebook", "Facebook"), ("tiktok", "TikTok"),
]
# No Simple Icons glyph exists for these:
# (file slug, tile colour, label, monogram text, font size)
MONO = [
    ("xray", "#1F6FEB", "Xray", "X", 30),
    ("termux", "#2D333B", "Termux", ">_", 22),
    ("linkedin", "#0A66C2", "LinkedIn", "in", 28),
    ("codepen", "#2D333B", "CodePen", "CP", 22),
]
GLOBE = (
    '<circle cx="12" cy="12" r="9.5" fill="none" stroke="#fff" stroke-width="2"/>'
    '<ellipse cx="12" cy="12" rx="4" ry="9.5" fill="none" stroke="#fff" stroke-width="2"/>'
    '<path d="M2.5 12h19M4.5 7h15M4.5 17h15" fill="none" stroke="#fff" stroke-width="2"/>'
)

FONT = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"


def lum(h):
    h = h.lstrip("#")
    r, g, b = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    f = lambda c: c / 12.92 if c <= .03928 else ((c + .055) / 1.055) ** 2.4
    return .2126 * f(r) + .7152 * f(g) + .0722 * f(b)


def tile(name, label, fill, inner):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 84" width="64" height="84" role="img" aria-label="{name}">'
        f'<title>{name}</title>'
        f'<rect x="4.5" y="2.5" width="55" height="55" rx="14" fill="{fill}" stroke="#8b949e" stroke-opacity=".35"/>'
        f'{inner}'
        f'<text x="32" y="76" text-anchor="middle" font-family="{FONT}" font-size="12" font-weight="600" fill="#848d97">{label}</text>'
        f'</svg>'
    )


def simple(slug, label, ext_hex):
    svg = (SRC / f"{slug}.svg").read_text()
    path = re.search(r'<path d="([^"]+)"', svg).group(1)
    fill = "#" + ext_hex
    L = lum(fill)
    if L < .03 or L > .9:  # near-black / near-white brands: neutral tile so they read in both themes
        fill, glyph = "#2D333B", "#fff"
    else:
        glyph = "#1b1f24" if L > .45 else "#fff"
    inner = f'<g transform="translate(18 16) scale(1.1667)"><path d="{path}" fill="{glyph}"/></g>'
    return tile(label, label, fill, inner)


HEX = json.loads(subprocess.check_output(
    ["node", "-e",
     "const s=require('simple-icons');const o={};"
     "for(const k in s){if(s[k]&&s[k].slug)o[s[k].slug]=s[k].hex}"
     "console.log(JSON.stringify(o))"],
    cwd=ROOT))

n = 0
for slug, label in SKILLS + CONTACT:
    (OUT / f"{slug}.svg").write_text(simple(slug, label, HEX[slug]))
    n += 1
for slug, color, label, text, size in MONO:
    inner = (f'<text x="32" y="{30 + size * .36:.0f}" text-anchor="middle" font-family="{FONT}" '
             f'font-size="{size}" font-weight="800" fill="#fff">{text.replace(">", "&gt;")}</text>')
    (OUT / f"{slug}.svg").write_text(tile(label, label, color, inner))
    n += 1
# Baileys has no logo of its own; it is a WhatsApp Web library, so it reuses the WhatsApp glyph.
(OUT / "baileys.svg").write_text(simple("whatsapp", "Baileys", HEX["whatsapp"]))
n += 1
inner = f'<g transform="translate(18 16) scale(1.1667)">{GLOBE}</g>'
(OUT / "website.svg").write_text(tile("Website", "Website", "#3D59A1", inner))
n += 1
print(f"wrote {n} tiles to {OUT}")
