"""Draws the tier art for the Coffee Shop and Fine Dining skins.

Each tier is a round token in the skin's tier color (the same colors as the
skins in game.js) with a simple flat drawing on top. The drawings are SVG,
written below as plain text, and headless Chrome or Edge turns each one into
a 512 x 512 PNG with a transparent background:

    assets/skins/<skin>/tier1.png ... tier8.png

Run it from the project folder after changing a drawing:

    python tools/make_skin_art.py

Needs only Python and Chrome or Edge (no extra packages). No brand logos:
these are generic placeholders until real art is approved.
"""

import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SIZE = 256   # drawing size; rendered at 2x, so the PNGs are 512 x 512
SCALE = 2

# ---------------------------------------------------------------------------
# The token every item sits on: a disc in the tier color, a soft rim and a shine.
# ---------------------------------------------------------------------------
def token(color, ink, drawing):
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{SIZE}" height="{SIZE}" viewBox="0 0 256 256">
  <circle cx="128" cy="128" r="122" fill="{color}"/>
  <circle cx="128" cy="128" r="116" fill="none" stroke="#000" stroke-opacity="0.18" stroke-width="10"/>
  <path d="M 37.4 85.7 A 100 100 0 0 1 85.7 37.4" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="10" stroke-linecap="round"/>
  <g stroke="{ink}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round">
{drawing}
  </g>
</svg>"""


def sparkle(x, y, s, fill="#fff"):
    """A four-point star centered on (x, y)."""
    return (f'<path d="M {x} {y - s} Q {x} {y} {x + s} {y} Q {x} {y} {x} {y + s} '
            f'Q {x} {y} {x - s} {y} Q {x} {y} {x} {y - s} Z" fill="{fill}" stroke-width="4"/>')


# ---------------------------------------------------------------------------
# Coffee Shop
# ---------------------------------------------------------------------------
COFFEE_INK = "#3b2416"

COFFEE = [
    # 1. Coffee bean
    ("#a8714a", """
    <g transform="rotate(-30 128 128)">
      <ellipse cx="128" cy="128" rx="56" ry="76" fill="#5a3420"/>
      <path d="M 128 62 C 100 98, 156 158, 128 194" fill="none" stroke="#e8c39a" stroke-width="9"/>
      <ellipse cx="106" cy="98" rx="9" ry="17" fill="#fff" fill-opacity="0.25" stroke="none"/>
    </g>"""),

    # 2. Powder scoop: a teal scoop heaped with powder
    ("#f3e6cc", """
    <g transform="translate(-8 6)">
      <rect x="160" y="122" width="64" height="20" rx="10" fill="#2a8f84" transform="rotate(-25 166 132)"/>
      <path d="M 62 132 C 70 96, 98 82, 112 82 C 128 82, 156 96, 162 132 Z" fill="#fffaf0"/>
      <circle cx="96" cy="112" r="3" fill="#e2cfae" stroke="none"/>
      <circle cx="124" cy="100" r="3" fill="#e2cfae" stroke="none"/>
      <circle cx="140" cy="118" r="3" fill="#e2cfae" stroke="none"/>
      <path d="M 58 132 A 54 54 0 0 0 166 132 Z" fill="#2a8f84"/>
      <rect x="52" y="126" width="120" height="12" rx="6" fill="#36a99c"/>
    </g>"""),

    # 3. Small iced cup: flat lid, straw, coffee and ice
    ("#a8dcef", """
    <rect x="136" y="40" width="12" height="62" rx="4" fill="#2a8f84" transform="rotate(12 142 100)"/>
    <path d="M 80 100 L 176 100 L 164 204 L 92 204 Z" fill="#eaf6fb"/>
    <path d="M 83.2 128 L 172.8 128 L 164 204 L 92 204 Z" fill="#b9784a" stroke="none"/>
    <rect x="98" y="136" width="24" height="22" rx="5" fill="#fff" fill-opacity="0.55" stroke="none" transform="rotate(-12 110 147)"/>
    <rect x="130" y="146" width="22" height="22" rx="5" fill="#fff" fill-opacity="0.55" stroke="none" transform="rotate(15 141 157)"/>
    <rect x="110" y="172" width="22" height="20" rx="5" fill="#fff" fill-opacity="0.45" stroke="none"/>
    <path d="M 80 100 L 176 100 L 164 204 L 92 204 Z" fill="none"/>
    <rect x="72" y="88" width="112" height="14" rx="6" fill="#f5fbff"/>"""),

    # 4. Large iced cup: tall cup, dome lid, milk on top
    ("#4fa3d1", """
    <rect x="140" y="26" width="12" height="54" rx="4" fill="#2a8f84" transform="rotate(10 146 80)"/>
    <path d="M 76 96 L 180 96 L 166 214 L 90 214 Z" fill="#eaf6fb"/>
    <path d="M 78.8 120 L 177.2 120 L 173.6 150 L 82.4 150 Z" fill="#e9c39b" stroke="none"/>
    <path d="M 82.4 150 L 173.6 150 L 166 214 L 90 214 Z" fill="#a8683c" stroke="none"/>
    <path d="M 84 152 C 100 140, 112 162, 128 150 C 144 140, 156 162, 172 150" fill="none" stroke="#e9c39b" stroke-width="7"/>
    <rect x="100" y="166" width="24" height="22" rx="5" fill="#fff" fill-opacity="0.5" stroke="none" transform="rotate(-10 112 177)"/>
    <rect x="134" y="178" width="22" height="22" rx="5" fill="#fff" fill-opacity="0.5" stroke="none" transform="rotate(14 145 189)"/>
    <path d="M 76 96 L 180 96 L 166 214 L 90 214 Z" fill="none"/>
    <path d="M 72 96 Q 72 64 128 62 Q 184 64 184 96 Z" fill="#f5fbff"/>
    <rect x="66" y="92" width="124" height="12" rx="6" fill="#f5fbff"/>"""),

    # 5. Shaker bottle: screw cap, flip spout, coffee inside
    ("#f07c5a", """
    <rect x="86" y="96" width="84" height="112" rx="14" fill="#f2f7fa"/>
    <rect x="89" y="146" width="78" height="59" rx="11" fill="#c98b55" stroke="none"/>
    <path d="M 150 116 H 162 M 150 130 H 162 M 150 144 H 162" stroke-width="4"/>
    <rect x="86" y="96" width="84" height="112" rx="14" fill="none"/>
    <circle cx="166" cy="62" r="11" fill="none" stroke="#4a4a55" stroke-width="7"/>
    <rect x="104" y="52" width="40" height="24" rx="8" fill="#4a4a55"/>
    <rect x="80" y="72" width="96" height="28" rx="8" fill="#4a4a55"/>"""),

    # 6. Cold brew tub: dark tub, cream label with a snowflake
    ("#3f8f7a", """
    <path d="M 72 104 L 184 104 L 176 204 Q 128 212 80 204 Z" fill="#3a2418"/>
    <rect x="84" y="124" width="88" height="62" rx="8" fill="#f3e6cc"/>
    <g stroke="#3f8fbf" stroke-width="6">
      <path d="M 128 135 V 175 M 110.7 145 L 145.3 165 M 110.7 165 L 145.3 145"/>
    </g>
    <rect x="66" y="80" width="124" height="26" rx="8" fill="#5b3a29"/>"""),

    # 7. Coffee bag: crimped top, valve, label with a bean
    ("#d9a54a", """
    <path d="M 82 84 L 174 84 L 182 204 Q 128 212 74 204 Z" fill="#8a5a36"/>
    <rect x="78" y="64" width="100" height="24" rx="4" fill="#a8714a"/>
    <path d="M 88 68 V 84 M 98 68 V 84 M 108 68 V 84 M 118 68 V 84 M 128 68 V 84 M 138 68 V 84 M 148 68 V 84 M 158 68 V 84 M 168 68 V 84"
          stroke-opacity="0.35" stroke-width="3"/>
    <circle cx="152" cy="106" r="7" fill="#3b2416"/>
    <rect x="92" y="126" width="72" height="60" rx="6" fill="#f3e6cc"/>
    <g transform="rotate(-30 128 156)">
      <ellipse cx="128" cy="156" rx="14" ry="20" fill="#5a3420" stroke-width="4"/>
      <path d="M 128 140 C 121 150, 135 162, 128 172" fill="none" stroke="#e8c39a" stroke-width="4"/>
    </g>"""),

    # 8. Tink's signature tub: white tub, gold lid, pink band, heart and sparkles
    ("#ff5fa2", """
    <path d="M 68 102 L 188 102 L 178 206 Q 128 216 78 206 Z" fill="#fff8f0"/>
    <path d="M 69.9 122 L 186.1 122 L 183.4 150 L 72.6 150 Z" fill="#ff5fa2" stroke="none"/>
    <path d="M 128 198 C 96 178, 104 152, 120 156 C 126 158, 128 164, 128 168 C 128 164, 130 158, 136 156 C 152 152, 160 178, 128 198 Z" fill="#ff5fa2" stroke-width="5"/>
    <path d="M 68 102 L 188 102 L 178 206 Q 128 216 78 206 Z" fill="none"/>
    <rect x="62" y="76" width="132" height="28" rx="9" fill="#ffd166"/>
    """ + sparkle(56, 62, 16) + sparkle(204, 56, 12) + sparkle(210, 152, 10)),
]

# ---------------------------------------------------------------------------
# Fine Dining
# ---------------------------------------------------------------------------
FINE_INK = "#1e1418"

FINE = [
    # 1. Grape: a small bunch with a leaf
    ("#9a6ab8", """
    <path d="M 128 58 C 128 48, 134 40, 142 36" fill="none" stroke-width="7"/>
    <path d="M 132 60 C 150 34, 192 40, 196 62 C 174 74, 146 74, 132 60 Z" fill="#5f9e4a"/>
    <path d="M 140 60 C 158 56, 174 58, 190 62" fill="none" stroke-width="3" stroke-opacity="0.5"/>
    <g fill="#4a1f5c">
      <circle cx="104" cy="88" r="20"/><circle cx="144" cy="88" r="20"/>
      <circle cx="84" cy="122" r="20"/><circle cx="124" cy="122" r="20"/><circle cx="164" cy="122" r="20"/>
      <circle cx="104" cy="156" r="20"/><circle cx="144" cy="156" r="20"/>
      <circle cx="124" cy="190" r="20"/>
    </g>
    <g fill="#fff" fill-opacity="0.35" stroke="none">
      <circle cx="98" cy="82" r="6"/><circle cx="138" cy="82" r="6"/><circle cx="78" cy="116" r="6"/>
      <circle cx="118" cy="116" r="6"/><circle cx="158" cy="116" r="6"/><circle cx="98" cy="150" r="6"/>
      <circle cx="138" cy="150" r="6"/><circle cx="118" cy="184" r="6"/>
    </g>"""),

    # 2. Cork: a tilted cork with a wine-stained end
    ("#e2c590", """
    <g transform="rotate(-35 128 128)">
      <rect x="92" y="70" width="72" height="116" rx="10" fill="#c99a5e"/>
      <g fill="#8a6234" stroke="none">
        <circle cx="110" cy="100" r="4"/><circle cx="142" cy="116" r="5"/><circle cx="118" cy="140" r="3"/>
        <circle cx="146" cy="160" r="4"/><circle cx="108" cy="166" r="5"/><circle cx="132" cy="92" r="3"/>
      </g>
      <ellipse cx="128" cy="70" rx="36" ry="12" fill="#8a1538"/>
      <ellipse cx="128" cy="70" rx="22" ry="6" fill="#b8325a" stroke="none"/>
      <path d="M 102 84 V 172" stroke="#fff" stroke-width="6" stroke-opacity="0.35"/>
    </g>"""),

    # 3. Wine glass with red wine
    ("#c0395e", """
    <g transform="translate(0 -4)">
      <path d="M 84 58 L 172 58 C 176 110, 160 140, 128 146 C 96 140, 80 110, 84 58 Z" fill="#f4fbff"/>
      <path d="M 83 96 L 173 96 C 172 120, 158 140, 128 146 C 98 140, 84 120, 83 96 Z" fill="#7a1030" stroke="none"/>
      <path d="M 84 58 L 172 58 C 176 110, 160 140, 128 146 C 96 140, 80 110, 84 58 Z" fill="none"/>
      <path d="M 98 70 C 96 88, 98 104, 104 116" fill="none" stroke="#fff" stroke-width="7" stroke-opacity="0.8"/>
      <rect x="122" y="146" width="12" height="48" fill="#f4fbff"/>
      <ellipse cx="128" cy="198" rx="42" ry="10" fill="#f4fbff"/>
    </g>"""),

    # 4. Champagne flute with bubbles
    ("#f5dd7a", """
    <path d="M 104 34 L 152 34 C 156 90, 148 128, 128 136 C 108 128, 100 90, 104 34 Z" fill="#f4fbff"/>
    <path d="M 104.6 62 L 151.4 62 C 153 100, 146 128, 128 136 C 110 128, 103 100, 104.6 62 Z" fill="#e8b93c" stroke="none"/>
    <g fill="#fff6d0" stroke="none">
      <circle cx="120" cy="80" r="4"/><circle cx="136" cy="96" r="3"/><circle cx="124" cy="110" r="4"/><circle cx="132" cy="72" r="3"/>
    </g>
    <path d="M 104 34 L 152 34 C 156 90, 148 128, 128 136 C 108 128, 100 90, 104 34 Z" fill="none"/>
    <path d="M 113 46 C 112 70, 113 92, 118 110" fill="none" stroke="#fff" stroke-width="6" stroke-opacity="0.8"/>
    <rect x="122" y="136" width="12" height="62" fill="#f4fbff"/>
    <ellipse cx="128" cy="202" rx="40" ry="10" fill="#f4fbff"/>"""),

    # 5. Decanter: wide crystal base, long neck, red wine
    ("#46a6ad", """
    <path d="M 112 40 L 144 40 L 144 92 C 196 112, 204 196, 172 208 L 84 208 C 52 196, 60 112, 112 92 Z" fill="#f4fbff"/>
    <path d="M 64 156 L 192 156 C 194 186, 186 202, 172 208 L 84 208 C 70 202, 62 186, 64 156 Z" fill="#7a1030" stroke="none"/>
    <path d="M 112 40 L 144 40 L 144 92 C 196 112, 204 196, 172 208 L 84 208 C 52 196, 60 112, 112 92 Z" fill="none"/>
    <path d="M 84 132 C 76 150, 76 172, 84 190" fill="none" stroke="#fff" stroke-width="7" stroke-opacity="0.8"/>
    <rect x="104" y="30" width="48" height="14" rx="6" fill="#f4fbff"/>"""),

    # 6. Wine bottle: dark green glass, red foil, cream label
    ("#4f9a5c", """
    <path d="M 116 40 L 140 40 L 140 84 C 140 98, 160 102, 160 122 L 160 204 Q 160 212 152 212 L 104 212 Q 96 212 96 204 L 96 122 C 96 102, 116 98, 116 84 Z" fill="#1f5a34"/>
    <path d="M 106 128 V 196" stroke="#fff" stroke-width="6" stroke-opacity="0.35"/>
    <rect x="102" y="142" width="52" height="48" rx="4" fill="#f3e6cc"/>
    <g fill="#7a1030" stroke="none">
      <circle cx="122" cy="158" r="6"/><circle cx="134" cy="158" r="6"/><circle cx="128" cy="168" r="6"/>
    </g>
    <rect x="112" y="34" width="32" height="36" rx="4" fill="#8a1538"/>"""),

    # 7. Ice bucket: silver bucket, handles, a bottle neck and ice
    ("#b8c2cc", """
    <g transform="rotate(14 150 80)">
      <path d="M 136 30 L 162 30 L 164 112 L 134 112 Z" fill="#123d2c"/>
      <rect x="133" y="24" width="32" height="34" rx="4" fill="#e0b84a"/>
    </g>
    <path d="M 82 104 L 104 84 L 126 102 Z" fill="#eaf8ff"/>
    <path d="M 168 100 L 184 82 L 196 102 Z" fill="#eaf8ff"/>
    <path d="M 70 102 L 186 102 L 172 206 Q 128 214 84 206 Z" fill="#dfe6ec"/>
    <path d="M 90 116 Q 84 160 96 196" fill="none" stroke="#fff" stroke-width="8" stroke-opacity="0.8"/>
    <rect x="62" y="94" width="132" height="16" rx="6" fill="#aab4be"/>
    <path d="M 66 124 C 46 124, 46 156, 70 156" fill="none" stroke="#7d8892" stroke-width="7"/>
    <path d="M 190 124 C 210 124, 210 156, 186 156" fill="none" stroke="#7d8892" stroke-width="7"/>
    <rect x="80" y="180" width="96" height="10" rx="5" fill="#aab4be" stroke="none"/>"""),

    # 8. Wine barrel: oak staves and iron hoops
    ("#b8743f", """
    <path d="M 82 56 Q 62 128 82 200 L 174 200 Q 194 128 174 56 Z" fill="#a0612f"/>
    <path d="M 112 56 Q 104 128 112 200 M 144 56 Q 152 128 144 200" fill="none" stroke-width="4" stroke-opacity="0.5"/>
    <path d="M 90 66 Q 76 128 90 190" fill="none" stroke="#fff" stroke-width="7" stroke-opacity="0.25"/>
    <rect x="70" y="84" width="116" height="14" rx="6" fill="#3e3a3a"/>
    <rect x="70" y="158" width="116" height="14" rx="6" fill="#3e3a3a"/>
    <ellipse cx="128" cy="56" rx="46" ry="10" fill="#c98a50"/>
    <ellipse cx="128" cy="200" rx="46" ry="10" fill="#7a4520"/>
    <circle cx="128" cy="128" r="9" fill="#5a3418"/>"""),
]

SKINS = {
    "coffee-shop": (COFFEE_INK, COFFEE),
    "fine-dining": (FINE_INK, FINE),
}


def find_browser():
    candidates = [
        os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%LocalAppData%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"),
        os.path.expandvars(r"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"),
        "/usr/bin/google-chrome",
        "/usr/bin/chromium",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    sys.exit("Couldn't find Chrome or Edge. Install one, or add its path to find_browser().")


def render(browser, svg_path, png_path):
    subprocess.run(
        [
            browser,
            "--headless=new",
            "--disable-gpu",
            "--hide-scrollbars",
            "--default-background-color=00000000",  # transparent
            f"--window-size={SIZE},{SIZE}",
            f"--force-device-scale-factor={SCALE}",
            f"--screenshot={png_path}",
            svg_path.as_uri(),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def main():
    browser = find_browser()
    with tempfile.TemporaryDirectory() as tmp:
        for skin, (ink, tiers) in SKINS.items():
            out_dir = ROOT / "assets" / "skins" / skin
            out_dir.mkdir(parents=True, exist_ok=True)
            for n, (color, drawing) in enumerate(tiers, start=1):
                svg_path = Path(tmp) / f"{skin}-tier{n}.svg"
                svg_path.write_text(token(color, ink, drawing), encoding="utf-8")
                png_path = out_dir / f"tier{n}.png"
                render(browser, svg_path, png_path)
                print(f"  {png_path.relative_to(ROOT)}")
    print("Done.")


if __name__ == "__main__":
    main()
