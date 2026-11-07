// scenes.js: the themed scene behind each skin, for both games. Cosmetic only.
//
// Each skin has four layers of art:
//   Emote Jar (side view)   jar-background  the room behind the jar, including the surface it sits on
//                           jar             the glass jar (drawn behind the items, so they stay clear)
//   Table Push (top down)   table           the table top the items slide on
//                           table-surround  what shows around the table's edges
//
// They're drawn below in code (layered shapes and gradients), once per skin, into a cached
// image, so nothing is redrawn while playing. To use your own art instead, put a PNG with
// that name in assets/skins/<skin>/. Sizes, in pixels (the board is 636 x 1000):
//   jar-background.png  636 x 1000  fills the board
//   jar.png             600 x 760   placed at x 18, y 200. Inside the jar is x 20 to 580 of the
//                                   image, and its floor is at y 740. The Snug Jar weekly
//                                   squeezes it sideways to 516 wide.
//   table.png           580 x 770   the playing surface, placed at x 28, y 130
//   table-surround.png  636 x 1000  fills the board, under the table
//   sponsor.png         260 x 100   Coffee Shop only: a sign on the brick wall, seen through the
//                                   upper left of the jar. Transparent background; any shape
//                                   works (it's fitted inside 260 x 100, keeping its shape).
// Other sizes get stretched to fit. A soft vignette and a shade behind the play area are
// always added on top, so items stay readable on any art.
//
// Uses CONFIG and skinFileKey from game.js, so index.html loads this file after game.js.

const SkinScenes = (() => {
  const BOARD_W = 636;
  const BOARD_H = 1000;

  // Where the jar image sits, relative to the inside of the jar (see jar.png above).
  const JAR = { side: 20, floor: 740, height: 760 };

  const SCENE_FILES = ['jar-background.png', 'jar.png', 'table.png', 'table-surround.png'];

  // ---------- Drawing helpers (plain 2D canvas) ----------
  // A seeded random generator, so the bricks, grain and stars come out the same every time.
  function rand(name) {
    return Arcade.createRng(Arcade.hashString(name));
  }

  function linear(ctx, x0, y0, x1, y1, stops) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    for (const [at, color] of stops) g.addColorStop(at, color);
    return g;
  }

  function radial(ctx, x, y, r0, r1, stops) {
    const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
    for (const [at, color] of stops) g.addColorStop(at, color);
    return g;
  }

  // A soft round light: color is 'r,g,b'.
  function glow(ctx, x, y, r, color, alpha) {
    ctx.fillStyle = radial(ctx, x, y, 0, r, [[0, `rgba(${color},${alpha})`], [1, `rgba(${color},0)`]]);
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // A rectangle path with rounded corners (rTop for the top two, rBottom for the bottom two).
  function rrect(ctx, x, y, w, h, rTop, rBottom = rTop) {
    ctx.beginPath();
    ctx.moveTo(x + rTop, y);
    ctx.lineTo(x + w - rTop, y);
    ctx.arcTo(x + w, y, x + w, y + rTop, rTop);
    ctx.lineTo(x + w, y + h - rBottom);
    ctx.arcTo(x + w, y + h, x + w - rBottom, y + h, rBottom);
    ctx.lineTo(x + rBottom, y + h);
    ctx.arcTo(x, y + h, x, y + h - rBottom, rBottom);
    ctx.lineTo(x, y + rTop);
    ctx.arcTo(x, y, x + rTop, y, rTop);
    ctx.closePath();
  }

  // A wavy vertical line, for wood grain.
  function grain(ctx, x, y0, y1, r, wobble) {
    ctx.beginPath();
    ctx.moveTo(x, y0);
    for (let y = y0; y < y1; y += 70) {
      ctx.quadraticCurveTo(x + (r.next() - 0.5) * wobble * 2, y + 35, x + (r.next() - 0.5) * wobble, y + 70);
    }
    ctx.stroke();
  }

  function leaf(ctx, x, y, length, angle, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, -length / 2, length * 0.3, length / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // The surface along the bottom of the jar scene: a top face and a front edge.
  function ledge(ctx, w, topColors, frontColor) {
    ctx.fillStyle = linear(ctx, 0, 944, 0, 972, [[0, topColors[0]], [1, topColors[1]]]);
    ctx.fillRect(0, 944, w, 28);
    ctx.fillStyle = frontColor;
    ctx.fillRect(0, 972, w, BOARD_H - 972);
    ctx.fillStyle = 'rgba(255,230,200,0.22)';
    ctx.fillRect(0, 944, w, 2);
    ctx.fillStyle = 'rgba(255,230,200,0.14)';
    ctx.fillRect(0, 972, w, 2);
  }

  // A glass jar with straight inside walls (the physics walls) and a flat floor.
  //   tint, edge: 'r,g,b' for the glass and its outline; wall, base: glass thickness;
  //   radius: rounding of the bottom corners; top: where the glass starts.
  function glassJar(ctx, w, o) {
    const { side, floor } = JAR;
    const x0 = side - o.wall;
    const x1 = w - side + o.wall;
    const top = o.top;
    const bottom = floor + o.base;

    rrect(ctx, x0, top, x1 - x0, bottom - top, 6, o.radius);
    ctx.fillStyle = `rgba(${o.tint},0.06)`;
    ctx.fill();
    // The walls and base are denser glass.
    ctx.save();
    ctx.clip();
    ctx.fillStyle = `rgba(${o.tint},0.24)`;
    ctx.fillRect(x0, top, o.wall, bottom - top);
    ctx.fillRect(x1 - o.wall, top, o.wall, bottom - top);
    ctx.fillRect(x0, floor, x1 - x0, bottom - floor);
    ctx.restore();

    rrect(ctx, x0, top, x1 - x0, bottom - top, 6, o.radius);
    ctx.strokeStyle = `rgba(${o.edge},0.65)`;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = `rgba(${o.edge},0.25)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(side, top + 30);
    ctx.lineTo(side, floor);
    ctx.lineTo(w - side, floor);
    ctx.lineTo(w - side, top + 30);
    ctx.stroke();

    // Shine streaks down the glass.
    ctx.fillStyle = linear(ctx, 0, top, 0, floor, [
      [0, 'rgba(255,255,255,0)'], [0.15, 'rgba(255,255,255,0.15)'],
      [0.85, 'rgba(255,255,255,0.1)'], [1, 'rgba(255,255,255,0)'],
    ]);
    rrect(ctx, side + 10, top + 50, 12, floor - top - 100, 6);
    ctx.fill();
    rrect(ctx, w - side - 20, top + 90, 6, floor - top - 220, 3);
    ctx.fill();
  }

  // ======================================================================
  // Tink: a cozy cottage
  // ======================================================================
  const tink = {
    jarBackground(ctx, w, h) {
      const r = rand('tink-wall');
      // Warm wood plank walls.
      ctx.fillStyle = linear(ctx, 0, 0, 0, h, [[0, '#4a2f22'], [1, '#2f1d16']]);
      ctx.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 72) {
        ctx.fillStyle = `rgba(255,215,170,${r.next() * 0.07})`;
        ctx.fillRect(x, 0, 72, h);
        ctx.strokeStyle = 'rgba(25,12,6,0.3)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) grain(ctx, x + 8 + r.next() * 56, 0, h, r, 6);
        ctx.fillStyle = '#1f120c';
        ctx.fillRect(x, 0, 3, h);
        if (r.next() < 0.6) {
          ctx.strokeStyle = 'rgba(25,12,6,0.45)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(x + 20 + r.next() * 32, 150 + r.next() * 720, 5, 9, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // A window with a night sky.
      const win = { x: 62, y: 250, w: 230, h: 250 };
      const sky = linear(ctx, 0, win.y, 0, win.y + win.h, [[0, '#121a3a'], [1, '#2a3160']]);
      ctx.fillStyle = sky;
      ctx.fillRect(win.x, win.y, win.w, win.h);
      const stars = rand('tink-stars');
      ctx.fillStyle = 'rgba(255,248,225,0.8)';
      for (let i = 0; i < 34; i++) {
        ctx.beginPath();
        ctx.arc(win.x + stars.next() * win.w, win.y + stars.next() * win.h * 0.8, 0.8 + stars.next() * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#efe4c4';
      ctx.beginPath();
      ctx.arc(win.x + 170, win.y + 62, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = sky;
      ctx.beginPath();
      ctx.arc(win.x + 182, win.y + 54, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#6a4630';
      ctx.lineWidth = 18;
      ctx.strokeRect(win.x, win.y, win.w, win.h);
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(win.x + win.w / 2, win.y);
      ctx.lineTo(win.x + win.w / 2, win.y + win.h);
      ctx.moveTo(win.x, win.y + win.h / 2);
      ctx.lineTo(win.x + win.w, win.y + win.h / 2);
      ctx.stroke();
      ctx.fillStyle = '#7a5238';
      ctx.fillRect(win.x - 22, win.y + win.h + 6, win.w + 44, 18);

      // A shelf with plants.
      const shelfY = 610;
      ctx.fillStyle = '#5a3a28';
      ctx.beginPath();
      ctx.moveTo(380, shelfY + 16); ctx.lineTo(380, shelfY + 56); ctx.lineTo(420, shelfY + 16);
      ctx.moveTo(580, shelfY + 16); ctx.lineTo(580, shelfY + 56); ctx.lineTo(540, shelfY + 16);
      ctx.fill();
      ctx.fillStyle = '#7a5238';
      ctx.fillRect(350, shelfY, 270, 16);
      ctx.fillStyle = 'rgba(255,230,200,0.2)';
      ctx.fillRect(350, shelfY, 270, 3);
      const pot = (x, top, potW, potH, color) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x - potW / 2, top);
        ctx.lineTo(x + potW / 2, top);
        ctx.lineTo(x + potW * 0.38, shelfY);
        ctx.lineTo(x - potW * 0.38, shelfY);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(x - potW / 2, top, potW, 7);
      };
      for (const [a, len] of [[-0.9, 50], [-0.45, 64], [0, 72], [0.45, 62], [0.9, 48]]) {
        leaf(ctx, 400, shelfY - 40, len, a, a === 0 ? '#5c8a48' : '#4b783c');
      }
      pot(400, shelfY - 44, 54, 44, '#9a5a3c');
      ctx.fillStyle = '#6f9a58';
      ctx.beginPath();
      ctx.arc(482, shelfY - 40, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(30,50,20,0.4)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(482, shelfY - 40);
        ctx.lineTo(482 + Math.cos(i * 1.26) * 18, shelfY - 40 + Math.sin(i * 1.26) * 18);
        ctx.stroke();
      }
      pot(482, shelfY - 28, 42, 28, '#b97a52');
      // A trailing vine over the shelf edge.
      ctx.strokeStyle = '#4b783c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(560, shelfY - 30);
      ctx.bezierCurveTo(600, shelfY + 20, 540, shelfY + 70, 575, shelfY + 130);
      ctx.stroke();
      for (let i = 0; i < 7; i++) {
        const t = i / 6;
        leaf(ctx, 565 + Math.sin(t * 6) * 14, shelfY + t * 130, 22, 1.2 - t * 2.4, '#5c8a48');
      }
      pot(560, shelfY - 36, 46, 36, '#8a4e34');

      // Lamp glow, and the hanging lamp it comes from.
      glow(ctx, 500, 190, 430, '255,185,110', 0.3);
      ctx.strokeStyle = '#1a0f0a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(500, 0);
      ctx.lineTo(500, 138);
      ctx.stroke();
      ctx.fillStyle = linear(ctx, 445, 0, 555, 0, [[0, '#8a5a2e'], [0.5, '#c98a4a'], [1, '#7a4e28']]);
      ctx.beginPath();
      ctx.moveTo(478, 136); ctx.lineTo(522, 136); ctx.lineTo(554, 182); ctx.lineTo(446, 182);
      ctx.fill();
      glow(ctx, 500, 186, 60, '255,225,160', 0.9);

      // The wooden counter the jar sits on.
      ledge(ctx, w, ['#8a5d3e', '#6a4630'], '#46301f');
    },

    // A mason-style jar: aqua glass with screw threads at the top.
    jar(ctx, w) {
      const o = { tint: '185,235,235', edge: '220,250,250', wall: 14, base: 18, radius: 34, top: 8 };
      glassJar(ctx, w, o);
      for (const y of [4, 21, 38]) {
        rrect(ctx, JAR.side - o.wall - 5, y, w - 2 * (JAR.side - o.wall) + 10, 11, 5);
        ctx.fillStyle = `rgba(${o.tint},0.16)`;
        ctx.fill();
        ctx.strokeStyle = `rgba(${o.edge},0.5)`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    },

    // A worn wooden tabletop: long planks, scuffs and scratches.
    table(ctx, w, h) {
      const r = rand('tink-table');
      const colors = ['#6c4731', '#724c35', '#67432d', '#6f4a33', '#69452f', '#744f37'];
      const plank = w / 6;
      colors.forEach((c, i) => {
        const x = i * plank;
        ctx.fillStyle = c;
        ctx.fillRect(x, 0, plank + 1, h);
        ctx.strokeStyle = 'rgba(30,14,6,0.28)';
        ctx.lineWidth = 1.5;
        for (let n = 0; n < 5; n++) grain(ctx, x + 6 + r.next() * (plank - 12), 0, h, r, 8);
        ctx.fillStyle = '#2a170e';
        ctx.fillRect(x, 0, 3, h);
        ctx.fillStyle = 'rgba(20,10,5,0.55)';
        for (const y of [16, h - 16]) {
          ctx.beginPath();
          ctx.arc(x + plank / 2, y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      for (let i = 0; i < 10; i++) glow(ctx, r.next() * w, r.next() * h, 40 + r.next() * 60, '255,225,190', 0.07);
      ctx.strokeStyle = 'rgba(255,230,200,0.08)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 26; i++) {
        const x = r.next() * w;
        const y = r.next() * h;
        const a = r.next() * Math.PI;
        const len = 12 + r.next() * 40;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, w - 8, h - 8);
    },

    // A braided rug under the table, on a dark wood floor.
    tableSurround(ctx, w, h) {
      ctx.fillStyle = '#22160f';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,220,180,0.05)';
      for (let y = 0; y < h; y += 48) ctx.fillRect(0, y, w, 2);
      const colors = ['#764848', '#56644a', '#83704e', '#4a5766', '#6a5672'];
      for (let i = 0; i < 12; i++) {
        const inset = i * 19;
        const args = [4 + inset, 104 + inset, w - 8 - inset * 2, h - 108 - inset * 2, Math.max(24, 140 - inset)];
        rrect(ctx, ...args);
        ctx.strokeStyle = colors[i % colors.length];
        ctx.lineWidth = 19;
        ctx.setLineDash([]);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(0,0,0,0.22)';
        ctx.setLineDash([7, 9]);
        ctx.lineDashOffset = i * 5;
        ctx.stroke();
      }
      ctx.setLineDash([]);
    },
  };

  // ======================================================================
  // Coffee Shop: exposed brick, a chalkboard menu, pendant lights
  // ======================================================================
  const coffeeShop = {
    // Where sponsor.png goes, if it's there: on the brick wall, seen through the upper
    // left of the jar (opposite the chalkboard), where items only reach late in a run.
    sponsor: { x: 52, y: 280, w: 260, h: 100 },

    jarBackground(ctx, w, h) {
      const r = rand('coffee-bricks');
      // Exposed brick.
      ctx.fillStyle = '#3a2d27';
      ctx.fillRect(0, 0, w, h);
      const bw = 64;
      const bh = 26;
      const gap = 4;
      const bricks = ['#74432f', '#6a3b2b', '#7c4b37', '#653828', '#6e402f', '#5e3a2e'];
      for (let row = 0; row * (bh + gap) < h; row++) {
        const y = row * (bh + gap);
        for (let x = row % 2 ? -bw / 2 : 0; x < w; x += bw + gap) {
          ctx.fillStyle = bricks[Math.floor(r.next() * bricks.length)];
          ctx.fillRect(x, y, bw, bh);
          ctx.fillStyle = 'rgba(255,220,190,0.06)';
          ctx.fillRect(x, y, bw, 3);
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          ctx.fillRect(x, y + bh - 3, bw, 3);
        }
      }
      ctx.fillStyle = linear(ctx, 0, 0, 0, h, [[0, 'rgba(10,5,2,0.1)'], [0.4, 'rgba(10,5,2,0.15)'], [1, 'rgba(10,5,2,0.45)']]);
      ctx.fillRect(0, 0, w, h);

      // A chalkboard menu.
      const b = { x: 340, y: 262, w: 250, h: 270 };
      ctx.fillStyle = '#6a4a32';
      rrect(ctx, b.x - 14, b.y - 14, b.w + 28, b.h + 28, 8);
      ctx.fill();
      ctx.fillStyle = linear(ctx, b.x, b.y, b.x + b.w, b.y + b.h, [[0, '#26332e'], [1, '#1b2521']]);
      ctx.fillRect(b.x, b.y, b.w, b.h);
      glow(ctx, b.x + 80, b.y + 150, 120, '230,235,225', 0.05);
      ctx.fillStyle = 'rgba(240,238,228,0.85)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 36px "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive';
      ctx.fillText('MENU', b.x + b.w / 2, b.y + 38);
      ctx.font = '22px "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive';
      const menu = [['Espresso', '3'], ['Latte', '4'], ['Cold brew', '4'], ['Mocha', '5'], ['Tea', '3']];
      menu.forEach(([item, price], i) => {
        const y = b.y + 88 + i * 36;
        ctx.textAlign = 'left';
        ctx.fillText(item, b.x + 22, y);
        ctx.textAlign = 'right';
        ctx.fillText(price, b.x + b.w - 22, y);
        ctx.fillStyle = 'rgba(240,238,228,0.35)';
        for (let x = b.x + 140; x < b.x + b.w - 44; x += 9) ctx.fillRect(x, y + 6, 3, 3);
        ctx.fillStyle = 'rgba(240,238,228,0.85)';
      });
      ctx.textAlign = 'center';

      // A shelf of mugs.
      const shelfY = 660;
      ctx.fillStyle = '#5e3f29';
      ctx.fillRect(40, shelfY, 270, 14);
      ctx.fillStyle = 'rgba(255,230,200,0.18)';
      ctx.fillRect(40, shelfY, 270, 3);
      [['#c9b79c', 74], ['#6d8a87', 136], ['#b5654a', 198], ['#d8cdb8', 260]].forEach(([c, x]) => {
        ctx.fillStyle = c;
        rrect(ctx, x - 22, shelfY - 46, 44, 46, 4, 10);
        ctx.fill();
        ctx.strokeStyle = c;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(x + 24, shelfY - 24, 11, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(x - 22, shelfY - 46, 44, 6);
      });

      // Pendant lights and their warm pools of light.
      for (const x of [118, 518]) {
        glow(ctx, x, 210, 330, '255,195,120', 0.26);
        ctx.strokeStyle = '#120a06';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 140);
        ctx.stroke();
        ctx.fillStyle = linear(ctx, x - 44, 0, x + 44, 0, [[0, '#1d1d1d'], [0.45, '#4a4a48'], [1, '#161616']]);
        ctx.beginPath();
        ctx.arc(x, 178, 44, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#b8924a';
        ctx.fillRect(x - 46, 176, 92, 5);
        glow(ctx, x, 184, 40, '255,230,170', 0.95);
      }

      // The café counter: a butcher-block top over a slatted front.
      ledge(ctx, w, ['#8c5b37', '#6c4428'], '#33221a');
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      for (let x = 20; x < w; x += 36) ctx.fillRect(x, 974, 3, BOARD_H - 974);
    },

    // A glass canister with a steel band at the top.
    jar(ctx, w) {
      const o = { tint: '230,238,236', edge: '240,248,246', wall: 12, base: 18, radius: 20, top: 10 };
      glassJar(ctx, w, o);
      const x = JAR.side - o.wall - 6;
      rrect(ctx, x, 0, w - 2 * x, 30, 8);
      ctx.fillStyle = linear(ctx, 0, 0, 0, 30, [[0, '#b9c1c4'], [0.5, '#6c7478'], [1, '#9aa3a7']]);
      ctx.fill();
      ctx.strokeStyle = 'rgba(20,20,20,0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
    },

    // A dark terrazzo café tabletop with a steel edge.
    table(ctx, w, h) {
      const r = rand('coffee-table');
      ctx.fillStyle = linear(ctx, 0, 0, w, h, [[0, '#3d3a36'], [1, '#32302d']]);
      ctx.fillRect(0, 0, w, h);
      const flecks = ['rgba(230,220,200,0.22)', 'rgba(170,125,90,0.25)', 'rgba(15,15,15,0.3)', 'rgba(200,200,200,0.14)'];
      for (let i = 0; i < 900; i++) {
        ctx.fillStyle = flecks[i % flecks.length];
        ctx.beginPath();
        ctx.arc(r.next() * w, r.next() * h, 1 + r.next() * 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(140,95,60,0.12)';
      ctx.lineWidth = 3;
      for (const [x, y, rad] of [[470, 610, 34], [104, 190, 30]]) {
        ctx.beginPath();
        ctx.arc(x, y, rad, 0.3, Math.PI * 1.85);
        ctx.stroke();
      }
      ctx.strokeStyle = linear(ctx, 0, 0, w, h, [[0, '#9aa2a6'], [0.5, '#5a6266'], [1, '#8a9296']]);
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, w - 10, h - 10);
    },

    // A checkered tile floor.
    tableSurround(ctx, w, h) {
      const tile = 64;
      for (let y = 0; y < h; y += tile) {
        for (let x = 0; x < w; x += tile) {
          ctx.fillStyle = (x / tile + y / tile) % 2 ? '#2b2623' : '#4a423c';
          ctx.fillRect(x, y, tile, tile);
        }
      }
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let x = 0; x < w; x += tile) ctx.fillRect(x, 0, 2, h);
      for (let y = 0; y < h; y += tile) ctx.fillRect(0, y, w, 2);
    },
  };

  // ======================================================================
  // Fine Dining: dark wood paneling, candlelight, marble
  // ======================================================================
  const fineDining = {
    jarBackground(ctx, w, h) {
      const r = rand('fine-wall');
      // Dark wood paneling.
      ctx.fillStyle = linear(ctx, 0, 0, 0, h, [[0, '#2c1b15'], [1, '#1a100c']]);
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1.2;
      for (let x = 4; x < w; x += 11) grain(ctx, x + r.next() * 4, 0, h, r, 3);
      const col = w / 4;
      for (let i = 0; i < 4; i++) {
        for (const [y, ph] of [[226, 330], [626, 300]]) {
          const x = i * col + 20;
          const pw = col - 40;
          ctx.fillStyle = 'rgba(255,200,150,0.04)';
          ctx.fillRect(x, y, pw, ph);
          ctx.strokeStyle = 'rgba(255,215,170,0.12)'; // lit top-left edge
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(x, y + ph); ctx.lineTo(x, y); ctx.lineTo(x + pw, y);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(0,0,0,0.45)'; // shadowed bottom-right edge
          ctx.beginPath();
          ctx.moveTo(x + pw, y); ctx.lineTo(x + pw, y + ph); ctx.lineTo(x, y + ph);
          ctx.stroke();
        }
      }
      // Chair rail molding.
      ctx.fillStyle = linear(ctx, 0, 578, 0, 600, [[0, '#4a3022'], [0.5, '#2a1a12'], [1, '#3a251a']]);
      ctx.fillRect(0, 578, w, 22);

      // A framed painting: a dusky landscape.
      const p = { x: 214, y: 282, w: 208, h: 152 };
      ctx.fillStyle = linear(ctx, 0, p.y, 0, p.y + p.h, [[0, '#4a3446'], [0.6, '#8a5a44'], [1, '#5a3a2c']]);
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = '#2a2420';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y + p.h);
      ctx.quadraticCurveTo(p.x + 60, p.y + 80, p.x + 120, p.y + 110);
      ctx.quadraticCurveTo(p.x + 170, p.y + 90, p.x + p.w, p.y + 105);
      ctx.lineTo(p.x + p.w, p.y + p.h);
      ctx.fill();
      ctx.strokeStyle = linear(ctx, p.x, p.y, p.x + p.w, p.y + p.h, [[0, '#d8b25e'], [0.5, '#8a6a32'], [1, '#c8a050']]);
      ctx.lineWidth = 14;
      ctx.strokeRect(p.x - 7, p.y - 7, p.w + 14, p.h + 14);

      // Candle sconces and their glow.
      glow(ctx, w / 2, 300, 520, '255,170,90', 0.12);
      for (const x of [92, 544]) {
        glow(ctx, x, 140, 250, '255,175,90', 0.34);
        ctx.fillStyle = linear(ctx, x - 16, 0, x + 16, 0, [[0, '#8a6a32'], [0.5, '#d8b25e'], [1, '#7a5a2a']]);
        ctx.beginPath();
        ctx.ellipse(x, 186, 14, 26, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(x - 22, 174, 44, 6);
        ctx.fillStyle = '#efe4cc';
        ctx.fillRect(x - 6, 134, 12, 42);
        ctx.fillStyle = '#ffcf6a';
        ctx.beginPath();
        ctx.moveTo(x, 110);
        ctx.quadraticCurveTo(x + 8, 124, x, 132);
        ctx.quadraticCurveTo(x - 8, 124, x, 110);
        ctx.fill();
        glow(ctx, x, 124, 34, '255,235,180', 0.9);
      }

      // The marble top the jar stands on.
      ledge(ctx, w, ['#a39b91', '#878077'], '#5e5852');
      ctx.strokeStyle = 'rgba(60,52,48,0.35)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 7; i++) {
        const x = r.next() * w;
        ctx.beginPath();
        ctx.moveTo(x, 946);
        ctx.bezierCurveTo(x + 30, 952, x - 20, 962, x + 60 + r.next() * 60, 971);
        ctx.stroke();
      }
    },

    // An elegant glass jar: thin, clear glass with a gold rim.
    jar(ctx, w) {
      const o = { tint: '240,234,222', edge: '250,244,232', wall: 9, base: 16, radius: 26, top: 14 };
      glassJar(ctx, w, o);
      const x = JAR.side - o.wall - 5;
      const gold = linear(ctx, 0, 0, w, 0, [[0, '#9a7a3a'], [0.3, '#e8c878'], [0.7, '#c8a050'], [1, '#8a6a32']]);
      rrect(ctx, x, 4, w - 2 * x, 14, 7);
      ctx.fillStyle = gold;
      ctx.fill();
      ctx.fillStyle = gold;
      ctx.fillRect(JAR.side - o.wall + 6, JAR.floor + 7, w - 2 * (JAR.side - o.wall + 6), 3);
    },

    // A white tablecloth in candlelight, with place settings around the edges.
    table(ctx, w, h) {
      ctx.fillStyle = radial(ctx, w / 2, h / 2, 60, 520, [[0, '#b8ae9c'], [1, '#8a806f']]);
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      for (let x = 0; x < w; x += 6) ctx.fillRect(x, 0, 1, h);
      ctx.fillStyle = 'rgba(0,0,0,0.02)';
      for (let y = 0; y < h; y += 6) ctx.fillRect(0, y, w, 1);
      for (const x of [w / 3, (w * 2) / 3]) { // fold creases
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(x, 0, 2, h);
        ctx.fillStyle = 'rgba(0,0,0,0.05)';
        ctx.fillRect(x + 2, 0, 3, h);
      }

      // Candles in the top corners.
      for (const x of [44, w - 44]) {
        glow(ctx, x, 44, 150, '255,185,105', 0.28);
        ctx.fillStyle = '#efe6d2';
        ctx.beginPath();
        ctx.arc(x, 44, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffcf6a';
        ctx.beginPath();
        ctx.arc(x, 44, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Place settings: pale plates with a fork and knife, half off each side edge.
      const silver = 'rgba(205,208,212,0.6)';
      const setting = (cx, cy, inward) => {
        ctx.fillStyle = 'rgba(238,232,222,0.45)';
        ctx.beginPath();
        ctx.arc(cx, cy, 46, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, 34, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(80,70,60,0.22)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 46, 0, Math.PI * 2);
        ctx.stroke();
        // Fork above the plate, knife below, both pointing in toward the table.
        ctx.fillStyle = silver;
        const x0 = inward > 0 ? cx - 30 : cx - 44;
        rrect(ctx, x0, cy - 64, 74, 6, 3);
        ctx.fill();
        rrect(ctx, x0, cy + 58, 74, 7, 3);
        ctx.fill();
        const tips = inward > 0 ? x0 + 74 : x0;
        ctx.strokeStyle = silver;
        ctx.lineWidth = 2;
        for (const dy of [-8, -3, 2, 7]) {
          ctx.beginPath();
          ctx.moveTo(tips, cy - 61);
          ctx.lineTo(tips + inward * 14, cy - 61 + dy);
          ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; // a wine glass, from above
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx + inward * 64, cy - 44, 14, 0, Math.PI * 2);
        ctx.stroke();
      };
      for (const y of [260, 560]) {
        setting(4, y, 1);
        setting(w - 4, y, -1);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; // the hem
      ctx.lineWidth = 4;
      ctx.strokeRect(3, 3, w - 6, h - 6);
    },

    // A deep red carpet, with the tablecloth hanging over the table's edge.
    tableSurround(ctx, w, h, t) {
      ctx.fillStyle = linear(ctx, 0, 0, 0, h, [[0, '#3a1a20'], [1, '#261014']]);
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,200,150,0.05)';
      for (let y = 0; y < h; y += 48) {
        for (let x = (y / 48) % 2 ? 24 : 0; x < w; x += 48) {
          ctx.beginPath();
          ctx.moveTo(x, y - 8); ctx.lineTo(x + 8, y); ctx.lineTo(x, y + 8); ctx.lineTo(x - 8, y);
          ctx.fill();
        }
      }
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = 24;
      ctx.fillStyle = '#7a7062';
      ctx.fillRect(t.left - 14, t.top - 10, t.right - t.left + 28, t.bottom - t.top + 26);
      ctx.restore();
    },
  };

  const PAINTERS = { tink, 'coffee-shop': coffeeShop, 'fine-dining': fineDining };

  // ---------- Shades that keep items readable (drawn small and stretched, which is cheap) ----------
  function shadeTexture(scene, key, w, h, paint) {
    if (!scene.textures.exists(key)) {
      const tex = scene.textures.createCanvas(key, w, h);
      paint(tex.getContext(), w, h);
      tex.refresh();
    }
    return key;
  }

  // Darker toward the edges of the board.
  function vignetteKey(scene) {
    return shadeTexture(scene, 'skin-scenes-vignette', 80, 126, (ctx, w, h) => {
      ctx.fillStyle = radial(ctx, w / 2, h / 2, w * 0.3, w * 0.85, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.5)']]);
      ctx.fillRect(0, 0, w, h);
    });
  }

  // Inside the jar: a soft darkening, a little stronger near the glass.
  function jarShadeKey(scene) {
    return shadeTexture(scene, 'skin-scenes-jar-shade', 32, 1, (ctx, w, h) => {
      ctx.fillStyle = linear(ctx, 0, 0, w, 0, [[0, 'rgba(0,0,0,0.45)'], [0.5, 'rgba(0,0,0,0.26)'], [1, 'rgba(0,0,0,0.45)']]);
      ctx.fillRect(0, 0, w, h);
    });
  }

  // Over the table: clear in the middle, a little darker toward its edges.
  function tableShadeKey(scene) {
    return shadeTexture(scene, 'skin-scenes-table-shade', 58, 77, (ctx, w, h) => {
      ctx.fillStyle = radial(ctx, w / 2, h / 2, w * 0.25, w * 0.75, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.3)']]);
      ctx.fillRect(0, 0, w, h);
    });
  }

  // ---------- Layers ----------
  // The texture for one layer: the skin's PNG if it loaded, otherwise the code-drawn
  // version, painted once and kept until another skin is picked.
  function layer(scene, skinId, name, w, h, extra) {
    const file = skinFileKey(skinId, name + '.png');
    if (scene.textures.exists(file)) return file;
    const key = `${CONFIG.id}-${skinId}-scene-${name}-${w}x${h}`;
    if (!scene.textures.exists(key)) {
      const tex = scene.textures.createCanvas(key, w, h);
      const painter = PAINTERS[skinId];
      const paint = {
        'jar-background': painter.jarBackground,
        jar: painter.jar,
        table: painter.table,
        'table-surround': painter.tableSurround,
      }[name];
      paint(tex.getContext(), w, h, extra);
      tex.refresh();
    }
    return key;
  }

  // Drops other skins' painted scenes, so only one skin's big images sit in memory (phones).
  function freeOtherSkins(scene, skinId) {
    for (const key of scene.textures.getTextureKeys()) {
      if (key.includes('-scene-') && !key.startsWith(`${CONFIG.id}-${skinId}-scene-`)) scene.textures.remove(key);
    }
  }

  function addImage(scene, key, x, y, w, h) {
    return scene.add.image(x, y, key).setOrigin(0).setDisplaySize(w, h);
  }

  // The files each skin may have; game.js loads them along with the tier art.
  function filesFor(skinId) {
    return PAINTERS[skinId] && PAINTERS[skinId].sponsor ? [...SCENE_FILES, 'sponsor.png'] : SCENE_FILES;
  }

  // The sponsor sign, if the skin has a spot for one and the file is there.
  function addSponsor(scene, skinId) {
    const spot = PAINTERS[skinId].sponsor;
    const key = skinFileKey(skinId, 'sponsor.png');
    if (!spot || !scene.textures.exists(key)) return;
    const img = scene.add.image(spot.x + spot.w / 2, spot.y + spot.h / 2, key).setAlpha(0.92);
    img.setScale(Math.min(spot.w / img.width, spot.h / img.height));
  }

  // Emote Jar: the room, the shade inside the jar, then the jar.
  //   jar: { left, right, bottom }, the inside edges of the jar (the physics walls).
  function addJarScene(scene, skinId, jar) {
    freeOtherSkins(scene, skinId);
    addImage(scene, layer(scene, skinId, 'jar-background', BOARD_W, BOARD_H), 0, 0, BOARD_W, BOARD_H);
    addImage(scene, vignetteKey(scene), 0, 0, BOARD_W, BOARD_H);
    const top = jar.bottom - JAR.floor + 10;
    addImage(scene, jarShadeKey(scene), jar.left, top, jar.right - jar.left, jar.bottom - top);
    addSponsor(scene, skinId); // above the shade, so the sign isn't dimmed
    const width = jar.right - jar.left + JAR.side * 2;
    addImage(scene, layer(scene, skinId, 'jar', width, JAR.height), jar.left - JAR.side, jar.bottom - JAR.floor, width, JAR.height);
  }

  // Table Push: what's around the table, then the table and its shade.
  //   table: { left, right, top, bottom }, the playing surface.
  function addTableScene(scene, skinId, table) {
    freeOtherSkins(scene, skinId);
    const w = table.right - table.left;
    const h = table.bottom - table.top;
    addImage(scene, layer(scene, skinId, 'table-surround', BOARD_W, BOARD_H, table), 0, 0, BOARD_W, BOARD_H);
    addImage(scene, vignetteKey(scene), 0, 0, BOARD_W, BOARD_H);
    addImage(scene, layer(scene, skinId, 'table', w, h), table.left, table.top, w, h);
    addImage(scene, tableShadeKey(scene), table.left, table.top, w, h);
  }

  return { filesFor, addJarScene, addTableScene };
})();
