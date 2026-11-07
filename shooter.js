// Tink's Pop Shot: shoot items up the table into the cluster at the far end.
// Three or more of the same kind touching pop, and anything left with no path back
// to the far edge falls away too. Every few shots a new row pushes in from the top;
// when the cluster reaches the line, the run ends.
//
// Shares the skins, item art and sounds in game.js and the table scenes in scenes.js
// (index.html loads both first). Uses the arcade tools in arcade.js for best scores,
// seeds, difficulty and the Copy result line.

// ===================== SHOOTER_CONFIG: Pop Shot's tunable numbers =====================
const SHOOTER_CONFIG = {
  id: 'pop-shot',
  title: "Tink's Pop Shot",

  // Layout, in board units (the board is 636 x 1000; see arcade.js).
  hudHeight: 110,
  // The same table as Table Push, so every skin's table art fits.
  table: { left: 28, right: 608, top: 130, bottom: 900 },
  itemRadius: 29,              // every item is this size here: 10 across the table
  launcher: { x: 318, y: 846 },
  lineY: 770,                  // the cluster reaching this line ends the run

  // Kinds of item in play (tiers 1 to N of the skin), by difficulty. More kinds = harder.
  colorsByDifficulty: { easy: 5, normal: 6, hard: 7 },

  startRows: 6,                // rows on the table at the start
  maxStartRows: 9,             // each cleared table refills with one more row, up to this
  shotsPerRow: 8,              // a new row pushes in after this many shots
  clumpChance: 0.5,            // how often a new item copies a neighbor, so groups form

  shot: {
    speed: 1500,               // board units per second
    cooldownMs: 250,           // wait after one shot lands before the next can go
    minAngle: 10,              // degrees above flat: stops shots that would only bounce sideways
    aimTurnSpeed: 2.2,         // arrow keys, radians per second
  },
  aim: { length: 720, dotGap: 30 }, // the dotted aim guide (it shows one bounce off the side)

  points: {
    pop: 10,                   // each item in a popped group
    drop: 20,                  // each item that falls away after a pop
    clear: 1000,               // clearing the whole table
  },

  // Built-in sound for a new row pushing in. (Shots, pops and the rest use the skin's
  // drop, merge, bonus, gameOver and newBest sounds, like the other games.)
  sounds: {
    push: [
      { freq: 200, to: 120, type: 'triangle', duration: 0.18, volume: 0.25 },
      { noise: true, filter: 500, duration: 0.12, volume: 0.2 },
    ],
  },

  // Weekly mode applies one of these, chosen by the week number (week 1 = first entry).
  // Fields you can use: colorsAdd, startRowsAdd (added), shotsMul, aimMul (multipliers).
  weeklyModifiers: [
    { name: 'Extra Kind', desc: 'One more kind of item.', colorsAdd: 1 },
    { name: 'Quick Push', desc: 'Rows push in sooner.', shotsMul: 0.7 },
    { name: 'Deep Start', desc: 'Two more rows to start.', startRowsAdd: 2 },
    { name: 'Short Sight', desc: 'A shorter aim guide.', aimMul: 0.5 },
    { name: 'Calm Table', desc: 'Rows push in later.', shotsMul: 1.4 },
  ],
};
// ======================================================================================

// Everything below is wrapped in one function so its helper names can't clash with the other games.
(() => {
  const SHARED = CONFIG; // from game.js: skins, sounds, effects
  const S = SHOOTER_CONFIG;
  const R = S.itemRadius;
  const D = R * 2;
  const ROW_H = D * Math.sqrt(3) / 2; // rows nest into each other, honeycomb style
  const COLS = Math.floor((S.table.right - S.table.left) / D);

  function weeklyModifier(week) {
    const list = S.weeklyModifiers;
    return list[(week - 1) % list.length];
  }

  // Combines SHOOTER_CONFIG, the difficulty preset and (in Weekly) the week's modifier.
  //   speed:       how fast shots fly
  //   cooldown:    the wait between shots
  //   forgiveness: how many shots before a new row pushes in
  function buildRules(mode, difficultyId, period) {
    const d = Arcade.difficulty(difficultyId);
    const m = mode === 'weekly' ? weeklyModifier(period.week) : {};
    const kinds = Math.min(SHARED.tiers.length, (S.colorsByDifficulty[difficultyId] ?? 6) + (m.colorsAdd ?? 0));
    return {
      modifier: mode === 'weekly' ? m : null,
      tiers: Array.from({ length: kinds }, (_, i) => i + 1),
      startRows: S.startRows + (m.startRowsAdd ?? 0),
      shotsPerRow: Math.max(3, Math.round(S.shotsPerRow * d.forgiveness * (m.shotsMul ?? 1))),
      shotSpeed: S.shot.speed * d.speed,
      cooldownMs: S.shot.cooldownMs * d.cooldown,
      aimLength: S.aim.length * (m.aimMul ?? 1),
    };
  }

  function bestKey(period, difficultyId) {
    return `${S.id}:${period.key}:${difficultyId}`;
  }

  // ---------------------------------- Start screen ----------------------------------
  class PopShotStart extends Phaser.Scene {
    constructor() {
      super('PopShotStart');
    }

    preload() {
      loadSkinFiles(this);
    }

    create() {
      const W = Arcade.config.width;
      const ui = Arcade.ui;
      const last = Arcade.store.get(S.id + ':last', {});
      // A first visit starts on the skin last used in the Emote Jar.
      const jarLast = Arcade.store.get(SHARED.id + ':last', {});
      this.mode = ['free', 'daily', 'weekly'].includes(last.mode) ? last.mode : 'free';
      this.difficultyId = Arcade.config.difficulties[last.difficulty] ? last.difficulty : 'normal';
      this.skinId = skinIdOrDefault(last.skin || jarLast.skin);
      this.skinIds = Object.keys(SHARED.skins);

      // The chosen skin's table scene, dimmed, with its button colors.
      Arcade.ui.setColors(this, SHARED.skins[this.skinId].ui);
      const col = Arcade.ui.colors(this);
      this.cameras.main.setBackgroundColor(SHARED.skins[this.skinId].background);
      SkinScenes.addTableScene(this, this.skinId, S.table);
      this.add.rectangle(W / 2, Arcade.config.height / 2, W, Arcade.config.height, col.panel, 0.62);
      startAmbience(this, this.skinId);

      ui.settingsButton(this, 48, 44, () =>
        this.scene.start('ArcadeSettings', { back: 'PopShotStart', colors: SHARED.skins[this.skinId].ui }));
      ui.muteButton(this, W - 48, 44);
      ui.text(this, W / 2, 95, S.title, 56);
      ui.text(this, W / 2, 152, 'Aim. Match three. Pop.', 30, col.muted, { bold: false });

      ui.text(this, W / 2, 215, 'MODE', 26, col.muted);
      this.modeButtons = {};
      Arcade.config.modes.forEach((m, i) => {
        this.modeButtons[m.id] = ui.button(this, 108 + i * 210, 268, 190, 70, m.label,
          () => this.select(m.id, this.difficultyId, this.skinId), { kind: 'toggle', fontSize: 30 });
      });

      ui.text(this, W / 2, 340, 'DIFFICULTY', 26, col.muted);
      this.difficultyButtons = {};
      Arcade.config.difficultyOrder.forEach((id, i) => {
        this.difficultyButtons[id] = ui.button(this, 108 + i * 210, 393, 190, 70, Arcade.difficulty(id).label,
          () => this.select(this.mode, id, this.skinId), { kind: 'toggle', fontSize: 30 });
      });

      ui.text(this, W / 2, 465, 'SKIN', 26, col.muted);
      ui.button(this, 58, 518, 90, 70, '‹', () => this.cycleSkin(-1), { kind: 'secondary', fontSize: 48 });
      ui.button(this, W - 58, 518, 90, 70, '›', () => this.cycleSkin(1), { kind: 'secondary', fontSize: 48 });
      this.skinName = ui.text(this, W / 2, 518, '', 34);
      this.skinPreview = [];

      this.info = ui.text(this, W / 2, 672, '', 28, col.text, { bold: false, wrap: 560 });
      this.bestText = ui.text(this, W / 2, 742, '', 28, col.muted);

      ui.button(this, W / 2, 815, 380, 90, 'Play', () => {
        this.scene.start('PopShotPlay', { mode: this.mode, difficulty: this.difficultyId, skin: this.skinId });
      }, { fontSize: 44 });
      ui.button(this, W / 2, 906, 260, 60, 'Back to arcade', () => this.scene.start('ArcadeMenu'),
        { kind: 'secondary', fontSize: 28 });

      ui.text(this, W / 2, 968, 'Aim, then let go to shoot. Tap the waiting item to swap.', 22, col.muted,
        { bold: false, wrap: 600 });

      this.select(this.mode, this.difficultyId, this.skinId);
    }

    // Saves the new skin, then redraws the screen in its scene and colors.
    cycleSkin(step) {
      const i = this.skinIds.indexOf(this.skinId);
      const next = this.skinIds[(i + step + this.skinIds.length) % this.skinIds.length];
      this.select(this.mode, this.difficultyId, next);
      this.scene.restart();
    }

    // Shows the kinds of item in play at this difficulty, all one size, like on the table.
    showSkinPreview() {
      const W = Arcade.config.width;
      const kinds = S.colorsByDifficulty[this.difficultyId] ?? 6;
      this.skinPreview.forEach((img) => img.destroy());
      const size = 54;
      const gap = 10;
      const start = W / 2 - (kinds * size + (kinds - 1) * gap) / 2 + size / 2;
      this.skinPreview = Array.from({ length: kinds }, (_, i) =>
        this.add.image(start + i * (size + gap), 590, tierTextureAtRadius(this, this.skinId, i + 1, R))
          .setDisplaySize(size, size));
    }

    select(mode, difficultyId, skinId) {
      this.mode = mode;
      this.difficultyId = difficultyId;
      this.skinId = skinId;
      Arcade.store.set(S.id + ':last', { mode, difficulty: difficultyId, skin: skinId });
      for (const id in this.modeButtons) this.modeButtons[id].setSelected(id === mode);
      for (const id in this.difficultyButtons) this.difficultyButtons[id].setSelected(id === difficultyId);
      this.skinName.setText(SHARED.skins[skinId].name);
      this.showSkinPreview();

      const period = Arcade.getPeriod(S.id, mode);
      if (mode === 'daily') {
        this.info.setText(`${period.label}: the same table for everyone today.`);
      } else if (mode === 'weekly') {
        const m = weeklyModifier(period.week);
        this.info.setText(`${period.label}: ${m.name}. ${m.desc}\nSame table for everyone this week.`);
      } else {
        this.info.setText('A new table every game.');
      }
      const best = Arcade.getBest(bestKey(period, difficultyId));
      this.bestText.setText(best > 0 ? `Best: ${Arcade.formatScore(best)}` : '');
    }
  }

  // ---------------------------------- The game ----------------------------------
  // The cluster is a grid of rows. Every other row sits half an item to the right, so
  // items nest like a honeycomb. grid[row][col] is { tier, img } or null; row 0 is the
  // far edge. "parity" flips each time a row pushes in, so the shifted rows stay put.
  class PopShotPlay extends Phaser.Scene {
    constructor() {
      super('PopShotPlay');
    }

    init(data) {
      this.mode = data.mode || 'free';
      this.difficultyId = data.difficulty || 'normal';
      this.skinId = skinIdOrDefault(data.skin);
      this.skin = SHARED.skins[this.skinId];
    }

    create() {
      this.period = Arcade.getPeriod(S.id, this.mode);
      this.rules = buildRules(this.mode, this.difficultyId, this.period);
      // The seeded generator builds the table and picks every item, so everyone playing
      // the same Daily or Weekly starts from the same table.
      this.rng = Arcade.createRng(this.period.seed);
      this.bestKey = bestKey(this.period, this.difficultyId);
      this.best = Arcade.getBest(this.bestKey);
      this.score = 0;
      this.level = 1;
      this.shots = 0;
      this.isOver = false;
      this.flying = null;  // the item in the air: { tier, img, x, y, vx, vy }
      this.lastShotAt = -Infinity;
      this.aiming = false;
      this.aimAngle = -Math.PI / 2; // straight up
      this.grid = [];
      this.parity = 0;

      Arcade.ui.setColors(this, this.skin.ui);
      this.cameras.main.setBackgroundColor(this.skin.background);
      startAmbience(this, this.skinId);
      this.drawTable();
      this.createHud();

      this.fillBoard(this.rules.startRows);

      this.guide = this.add.graphics().setDepth(20);
      this.held = this.add.image(S.launcher.x, S.launcher.y, this.keyOf(1)).setDepth(6);
      // The waiting item: tap it to swap with the one in the launcher.
      this.waiting = this.add.image(S.launcher.x + 110, S.launcher.y + 22, this.keyOf(1))
        .setDepth(6).setScale(0.75).setInteractive({ useHandCursor: true });
      this.waiting.on('pointerup', () => this.swap());
      this.current = this.rollTier();
      this.next = this.rollTier();
      this.refreshLauncher();

      this.setUpInput();
    }

    // ---------- Setup ----------
    // The skin's table (scenes.js), then the walls, the line and the launcher.
    // Lines are light on a dark edge, so they show on a dark table and a white tablecloth alike.
    drawTable() {
      const W = Arcade.config.width;
      const col = Arcade.ui.colors(this);
      const { left, right, top } = S.table;
      SkinScenes.addTableScene(this, this.skinId, S.table);

      // Side walls (shots bounce off them) and the far edge (the cluster hangs from it).
      const g = this.add.graphics();
      for (const [width, color, alpha] of [[9, 0x000000, 0.4], [4, 0xffffff, 0.7]]) {
        g.lineStyle(width, color, alpha);
        g.beginPath();
        g.moveTo(left, S.lineY + 40);
        g.lineTo(left, top);
        g.lineTo(right, top);
        g.lineTo(right, S.lineY + 40);
        g.strokePath();
      }

      // The line: light dashes on a dark edge, plus a red copy that flashes when the
      // next row pushing in would reach it.
      const dashes = (gfx, width, color, alpha, grow = 0) => {
        gfx.lineStyle(width, color, alpha);
        for (let x = left; x < right; x += 28) {
          gfx.lineBetween(Math.max(left, x - grow), S.lineY, Math.min(x + 16 + grow, right), S.lineY);
        }
      };
      const line = this.add.graphics();
      dashes(line, 9, 0x000000, 0.45, 2);
      dashes(line, 4, 0xffffff, 0.8);
      this.warnLine = this.add.graphics().setVisible(false);
      dashes(this.warnLine, 10, 0x000000, 0.5, 2);
      dashes(this.warnLine, 5, col.warn, 1);

      // A ring where the next shot waits.
      const base = this.add.graphics();
      base.fillStyle(0x000000, 0.3);
      base.fillCircle(S.launcher.x, S.launcher.y, R + 12);
      base.lineStyle(4, col.border, 1);
      base.strokeCircle(S.launcher.x, S.launcher.y, R + 12);

      Arcade.ui.text(this, W / 2, S.table.bottom + 50, this.contextLabel(), 24, col.text, { bold: false, stroke: true });
      Arcade.ui.muteButton(this, W - 44, S.table.bottom + 50);
    }

    contextLabel() {
      const parts = [this.period.label, Arcade.difficulty(this.difficultyId).label];
      if (this.rules.modifier) parts.push(this.rules.modifier.name);
      return parts.join(' · ');
    }

    createHud() {
      const W = Arcade.config.width;
      const col = Arcade.ui.colors(this);
      const ui = Arcade.ui;
      // A solid bar behind the score, so it reads the same on every scene.
      const bar = this.add.graphics().setDepth(45);
      bar.fillStyle(col.panel, 0.92);
      bar.fillRect(0, 0, W, S.hudHeight);
      bar.fillStyle(col.border, 1);
      bar.fillRect(0, S.hudHeight - 3, W, 3);

      ui.button(this, 76, 55, 112, 62, 'Menu', () => this.scene.start('PopShotStart'),
        { kind: 'secondary', fontSize: 28 }).setDepth(50);

      const left = { originX: 0 };
      ui.text(this, 150, 26, 'SCORE', 24, col.muted, left).setDepth(46);
      this.scoreText = ui.text(this, 150, 66, '0', 40, col.text, left).setDepth(46);
      ui.text(this, 310, 26, 'BEST', 24, col.muted, left).setDepth(46);
      this.bestText = ui.text(this, 310, 66, Arcade.formatScore(this.best), 40, col.text, left).setDepth(46);
      ui.text(this, W - 24, 26, 'NEW ROW IN', 24, col.muted, { originX: 1 }).setDepth(46);
      this.pushText = ui.text(this, W - 24, 66, '', 40, col.text, { originX: 1 }).setDepth(46);
      this.refreshPushText();
    }

    refreshPushText() {
      const left = this.rules.shotsPerRow - (this.shots % this.rules.shotsPerRow);
      this.pushText.setText(String(left));
      this.pushText.setColor(left <= 2 ? Arcade.ui.colors(this).accent : Arcade.ui.colors(this).text);
    }

    setUpInput() {
      // Mouse: moving aims. Touch: press and drag to aim, lift to shoot.
      // A click or tap shoots on release, so it works the same for both.
      this.input.on('pointermove', (pointer) => {
        if (!this.isOver) this.aimAt(pointer.worldX, pointer.worldY);
      });
      this.input.on('pointerdown', (pointer, over) => {
        if (this.isOver || over.length > 0) return; // pressed a button or the waiting item
        this.aiming = true;
        this.aimAt(pointer.worldX, pointer.worldY);
      });
      this.input.on('pointerup', () => {
        if (!this.aiming) return;
        this.aiming = false;
        this.shoot();
      });

      const kb = this.input.keyboard;
      this.keys = {
        left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
        right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
        a: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        d: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        space: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
        swap: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      };
    }

    // ---------- The grid ----------
    isShifted(row) {
      return (row + this.parity) % 2 === 1;
    }

    colsIn(row) {
      return this.isShifted(row) ? COLS - 1 : COLS;
    }

    cellX(row, col) {
      return S.table.left + R + col * D + (this.isShifted(row) ? R : 0);
    }

    cellY(row) {
      return S.table.top + R + row * ROW_H;
    }

    cell(row, col) {
      return (this.grid[row] && this.grid[row][col]) || null;
    }

    // The up to six cells touching this one.
    neighbors(row, col) {
      const out = [[row, col - 1], [row, col + 1]];
      const cols = this.isShifted(row) ? [col, col + 1] : [col - 1, col];
      for (const r of [row - 1, row + 1]) for (const c of cols) out.push([r, c]);
      return out.filter(([r, c]) => r >= 0 && c >= 0 && c < this.colsIn(r));
    }

    // Every item on the table, as [row, col] pairs.
    occupied() {
      const out = [];
      this.grid.forEach((cells, r) => cells.forEach((c, col) => { if (c) out.push([r, col]); }));
      return out;
    }

    keyOf(tier) {
      return tierTextureAtRadius(this, this.skinId, tier, R);
    }

    colorOf(tier) {
      return this.skin.tiers[tier - 1].color;
    }

    playEffect(name, notes, rate) {
      playSkinSound(this, this.skinId, name, notes, rate);
    }

    place(row, col, tier) {
      while (this.grid.length <= row) this.grid.push(new Array(this.colsIn(this.grid.length)).fill(null));
      const img = this.add.image(this.cellX(row, col), this.cellY(row), this.keyOf(tier)).setDepth(5);
      this.grid[row][col] = { tier, img };
    }

    // A random kind for a new table item: often a copy of a neighbor already placed, so groups form.
    tableTier(row, col) {
      if (this.rng.next() < S.clumpChance) {
        const near = this.neighbors(row, col).map(([r, c]) => this.cell(r, c)).filter(Boolean);
        if (near.length) return this.rng.pick(near).tier;
      }
      return this.rng.pick(this.rules.tiers);
    }

    fillBoard(rows) {
      for (const [r, c] of this.occupied()) this.grid[r][c].img.destroy();
      this.grid = [];
      this.parity = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < this.colsIn(r); c++) this.place(r, c, this.tableTier(r, c));
      }
    }

    // A new row slides in at the far edge and everything moves one row closer.
    pushRow() {
      this.parity ^= 1;
      this.grid.unshift(new Array(this.colsIn(0)).fill(null));
      for (const [r, c] of this.occupied()) {
        this.tweens.add({ targets: this.grid[r][c].img, x: this.cellX(r, c), y: this.cellY(r), duration: 160 });
      }
      for (let c = 0; c < this.colsIn(0); c++) {
        this.place(0, c, this.tableTier(0, c));
        const img = this.grid[0][c].img;
        img.y -= ROW_H;
        this.tweens.add({ targets: img, y: this.cellY(0), duration: 160 });
      }
      this.playEffect('push', S.sounds.push);
    }

    // The kinds still on the table, so the launcher never offers one you can't match.
    presentTiers() {
      const kinds = new Set(this.occupied().map(([r, c]) => this.grid[r][c].tier));
      return [...kinds].sort((a, b) => a - b);
    }

    rollTier() {
      const present = this.presentTiers();
      return this.rng.pick(present.length ? present : this.rules.tiers);
    }

    // ---------- Aiming and shooting ----------
    aimAt(px, py) {
      let angle = Math.atan2(py - S.launcher.y, px - S.launcher.x);
      if (angle > 0) angle = angle < Math.PI / 2 ? 0 : -Math.PI; // below the launcher: aim flat that way
      const min = Phaser.Math.DegToRad(S.shot.minAngle);
      this.aimAngle = Phaser.Math.Clamp(angle, -Math.PI + min, -min);
    }

    refreshLauncher() {
      this.held.setTexture(this.keyOf(this.current));
      this.waiting.setTexture(this.keyOf(this.next));
    }

    swap() {
      if (this.isOver) return;
      [this.current, this.next] = [this.next, this.current];
      this.refreshLauncher();
      Arcade.sfx.play(this, Arcade.config.sounds.click, 'click');
    }

    shoot() {
      if (this.isOver || this.flying || this.time.now - this.lastShotAt < this.rules.cooldownMs) return;
      const speed = this.rules.shotSpeed;
      this.flying = {
        tier: this.current,
        img: this.add.image(S.launcher.x, S.launcher.y, this.keyOf(this.current)).setDepth(10),
        x: S.launcher.x,
        y: S.launcher.y,
        vx: Math.cos(this.aimAngle) * speed,
        vy: Math.sin(this.aimAngle) * speed,
      };
      this.playEffect('drop', SHARED.sounds.drop);
      this.current = this.next;
      this.next = this.rollTier();
      this.refreshLauncher();
    }

    // True if a item at (x, y) touches the far edge or an item on the table.
    hitsCluster(x, y) {
      if (y - R <= S.table.top) return true;
      const reach = (D - 8) * (D - 8); // a little forgiving, so shots can slip through gaps
      for (const [r, c] of this.occupied()) {
        const dx = this.cellX(r, c) - x;
        const dy = this.cellY(r) - y;
        if (dx * dx + dy * dy < reach) return true;
      }
      return false;
    }

    // Moves the item in the air, in small steps so it can't skip past anything.
    moveShot(dt) {
      const f = this.flying;
      const { left, right } = S.table;
      const steps = Math.max(1, Math.ceil((this.rules.shotSpeed * dt) / (R / 2)));
      for (let i = 0; i < steps; i++) {
        f.x += (f.vx * dt) / steps;
        f.y += (f.vy * dt) / steps;
        if (f.x < left + R) { f.x = 2 * (left + R) - f.x; f.vx = -f.vx; }
        if (f.x > right - R) { f.x = 2 * (right - R) - f.x; f.vx = -f.vx; }
        if (this.hitsCluster(f.x, f.y)) {
          this.land();
          return;
        }
      }
      f.img.setPosition(f.x, f.y);
    }

    // Snaps the item into the nearest free cell that touches the cluster or the far edge.
    land() {
      const f = this.flying;
      this.flying = null;
      f.img.destroy();
      const guess = Math.max(0, Math.round((f.y - S.table.top - R) / ROW_H));
      let best = null;
      for (let r = Math.max(0, guess - 1); r <= guess + 1; r++) {
        for (let c = 0; c < this.colsIn(r); c++) {
          if (this.cell(r, c)) continue;
          const touches = r === 0 || this.neighbors(r, c).some(([nr, nc]) => this.cell(nr, nc));
          if (!touches) continue;
          const dist = Phaser.Math.Distance.Squared(f.x, f.y, this.cellX(r, c), this.cellY(r));
          if (!best || dist < best.dist) best = { r, c, dist };
        }
      }
      if (!best) best = { r: guess, c: Phaser.Math.Clamp(Math.round((f.x - S.table.left - R) / D), 0, this.colsIn(guess) - 1) };
      this.place(best.r, best.c, f.tier);
      this.lastShotAt = this.time.now;
      this.resolve(best.r, best.c);
    }

    // Everything connected to (row, col) with the same kind.
    findGroup(row, col) {
      const tier = this.cell(row, col).tier;
      const seen = new Set([`${row},${col}`]);
      const group = [[row, col]];
      for (let i = 0; i < group.length; i++) {
        for (const [r, c] of this.neighbors(...group[i])) {
          const key = `${r},${c}`;
          const n = this.cell(r, c);
          if (n && n.tier === tier && !seen.has(key)) {
            seen.add(key);
            group.push([r, c]);
          }
        }
      }
      return group;
    }

    // Items with no path back to the far edge: they fall away.
    findLoose() {
      const seen = new Set();
      const queue = [];
      (this.grid[0] || []).forEach((c, col) => { if (c) { queue.push([0, col]); seen.add(`0,${col}`); } });
      for (let i = 0; i < queue.length; i++) {
        for (const [r, c] of this.neighbors(...queue[i])) {
          if (this.cell(r, c) && !seen.has(`${r},${c}`)) {
            seen.add(`${r},${c}`);
            queue.push([r, c]);
          }
        }
      }
      return this.occupied().filter(([r, c]) => !seen.has(`${r},${c}`));
    }

    // After a shot lands: pop a group of three or more, drop anything left loose,
    // push a new row if it's due, then check for a cleared table or the line.
    resolve(row, col) {
      const group = this.findGroup(row, col);
      if (group.length >= 3) {
        const tier = this.cell(row, col).tier;
        let sx = 0;
        let sy = 0;
        for (const [r, c] of group) {
          const { img } = this.grid[r][c];
          sx += img.x;
          sy += img.y;
          this.grid[r][c] = null;
          this.tweens.add({ targets: img, scale: img.scale * 1.4, alpha: 0, duration: 140, onComplete: () => img.destroy() });
        }
        const loose = this.findLoose();
        loose.forEach(([r, c], i) => {
          const { img } = this.grid[r][c];
          this.grid[r][c] = null;
          this.tweens.add({
            targets: img, y: img.y + 260, alpha: 0, angle: (this.rng.next() - 0.5) * 120,
            duration: 520, delay: i * 14, onComplete: () => img.destroy(),
          });
        });
        const x = sx / group.length;
        const y = sy / group.length;
        const points = group.length * S.points.pop + loose.length * S.points.drop;
        this.addScore(points, x, y, this.colorOf(tier));
        this.playEffect('merge', mergeSound(Math.min(tier, 7)), 1 + SHARED.sounds.mergeRateStep * (group.length - 3));
        if (group.length + loose.length >= 6) {
          const fx = SHARED.effects;
          Arcade.fx.pixelBurst(this, x, y, {
            count: fx.burstPixels + (group.length + loose.length) * 2,
            colors: [this.colorOf(tier), '#ffffff'],
            speedMin: fx.burstSpeed[0], speedMax: fx.burstSpeed[1],
            lifeMs: fx.burstLifeMs, size: fx.pixelSize, gravity: 0,
          });
        }
      }
      while (this.grid.length && this.grid[this.grid.length - 1].every((c) => !c)) this.grid.pop();

      if (this.occupied().length === 0) {
        this.clearTable();
      } else {
        this.shots += 1;
        if (this.shots % this.rules.shotsPerRow === 0) this.pushRow();
      }
      this.refreshPushText();
      if (!this.presentTiers().includes(this.current)) this.current = this.rollTier();
      if (!this.presentTiers().includes(this.next)) this.next = this.rollTier();
      this.refreshLauncher();
      if (this.lowestRowBottom() > S.lineY) this.gameOver();
    }

    clearTable() {
      const W = Arcade.config.width;
      this.addScore(S.points.clear, W / 2, 420, this.colorOf(this.rules.tiers.length), true);
      this.playEffect('bonus', SHARED.sounds.bonus);
      const label = Arcade.ui.text(this, W / 2, 330, 'Table cleared!', 48, Arcade.ui.colors(this).accent, { stroke: true }).setDepth(40);
      this.tweens.add({ targets: label, alpha: 0, delay: 900, duration: 500, onComplete: () => label.destroy() });
      this.level += 1;
      this.shots = 0;
      this.fillBoard(Math.min(this.rules.startRows + this.level - 1, S.maxStartRows));
    }

    // How far down the cluster reaches (the bottom edge of its lowest item).
    lowestRowBottom() {
      const rows = this.occupied().map(([r]) => r);
      return rows.length ? this.cellY(Math.max(...rows)) + R : 0;
    }

    addScore(points, x, y, color, big = false) {
      this.score += points;
      this.scoreText.setText(Arcade.formatScore(this.score));
      // Save as soon as the best is beaten, so leaving mid-game keeps it.
      if (Arcade.saveBest(this.bestKey, this.score)) this.bestText.setText(Arcade.formatScore(this.score));

      const ring = this.add.circle(x, y, big ? 90 : 40, Phaser.Display.Color.HexStringToColor(color).color, 0.5).setDepth(30);
      this.tweens.add({ targets: ring, scale: big ? 3 : 1.8, alpha: 0, duration: big ? 500 : 260, onComplete: () => ring.destroy() });

      const label = Arcade.ui.text(this, x, y, '+' + Arcade.formatScore(points), big ? 64 : 34, Arcade.ui.colors(this).text,
        { stroke: true });
      label.setDepth(40);
      this.tweens.add({ targets: label, y: y - (big ? 120 : 70), alpha: 0, duration: big ? 1100 : 650, onComplete: () => label.destroy() });
    }

    // The dotted aim guide: follows the shot's path, with its bounces, until it meets the cluster.
    drawGuide(ready) {
      const g = this.guide;
      g.clear();
      const { left, right } = S.table;
      let x = S.launcher.x;
      let y = S.launcher.y;
      let dx = Math.cos(this.aimAngle);
      let dy = Math.sin(this.aimAngle);
      const step = 6;
      let travelled = 0;
      let nextDot = R + 14;
      while (travelled < this.rules.aimLength) {
        x += dx * step;
        y += dy * step;
        travelled += step;
        if (x < left + R) { x = 2 * (left + R) - x; dx = -dx; }
        if (x > right - R) { x = 2 * (right - R) - x; dx = -dx; }
        if (travelled >= nextDot) {
          if (this.hitsCluster(x, y)) break;
          const alpha = (ready ? 0.9 : 0.35) * (1 - (travelled / this.rules.aimLength) * 0.6);
          g.fillStyle(0x000000, alpha * 0.6); // dark ring, so the dots show on light tables
          g.fillCircle(x, y, 8);
          g.fillStyle(0xffffff, alpha);
          g.fillCircle(x, y, 5);
          nextDot += S.aim.dotGap;
        }
      }
    }

    // ---------- Each frame ----------
    update(time, delta) {
      if (this.isOver) return;
      const dir = (this.keys.right.isDown || this.keys.d.isDown ? 1 : 0) - (this.keys.left.isDown || this.keys.a.isDown ? 1 : 0);
      if (dir !== 0) {
        const min = Phaser.Math.DegToRad(S.shot.minAngle);
        this.aimAngle = Phaser.Math.Clamp(this.aimAngle + dir * S.shot.aimTurnSpeed * (delta / 1000), -Math.PI + min, -min);
      }
      if (Phaser.Input.Keyboard.JustDown(this.keys.space)) this.shoot();
      if (Phaser.Input.Keyboard.JustDown(this.keys.swap)) this.swap();

      if (this.flying) this.moveShot(Math.min(delta, 50) / 1000);
      if (this.isOver) return;

      // The line flashes when the next row pushing in would reach it.
      const warn = this.lowestRowBottom() + ROW_H > S.lineY;
      this.warnLine.setVisible(warn);
      if (warn) this.warnLine.setAlpha(0.5 + 0.5 * Math.sin(time / 70));

      const ready = !this.flying && time - this.lastShotAt >= this.rules.cooldownMs;
      this.held.setAlpha(ready ? 1 : 0.35);
      this.drawGuide(ready);
    }

    // ---------- Game over ----------
    gameOver() {
      this.isOver = true;
      this.aiming = false;
      this.guide.clear();
      this.warnLine.setVisible(true).setAlpha(1);
      const isNewBest = this.score > this.best; // this.best is from before this round
      const best = Math.max(this.best, this.score);
      if (isNewBest) this.playEffect('newBest', SHARED.sounds.newBest);
      else this.playEffect('gameOver', SHARED.sounds.gameOver);

      const W = Arcade.config.width;
      const H = Arcade.config.height;
      const col = Arcade.ui.colors(this);
      const ui = Arcade.ui;
      const depth = 100;
      const line = Arcade.resultLine(S.title, this.period, this.difficultyId, this.score, this.skin.name);

      this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setDepth(depth);
      const panel = this.add.graphics().setDepth(depth);
      panel.fillStyle(col.panel, 1);
      panel.fillRoundedRect(W / 2 - 270, 210, 540, 660, 28);

      ui.text(this, W / 2, 285, 'Out of room', 48).setDepth(depth + 1);
      ui.text(this, W / 2, 355, 'SCORE', 26, col.muted).setDepth(depth + 1);
      ui.text(this, W / 2, 420, Arcade.formatScore(this.score), 80).setDepth(depth + 1);
      ui.text(this, W / 2, 495, isNewBest ? 'New best!' : `Best: ${Arcade.formatScore(best)}`, 32,
        isNewBest ? col.accent : col.muted).setDepth(depth + 1);
      ui.text(this, W / 2, 550, line, 22, col.muted, { bold: false, wrap: 500 }).setDepth(depth + 1);

      ui.button(this, W / 2, 640, 400, 90, 'Restart',
        () => this.scene.restart({ mode: this.mode, difficulty: this.difficultyId, skin: this.skinId }),
        { fontSize: 40 }).setDepth(depth + 2);
      const copy = ui.button(this, W / 2, 740, 400, 76, 'Copy result', async () => {
        const ok = await Arcade.copyText(line);
        copy.setLabel(ok ? 'Copied' : "Couldn't copy");
        this.time.delayedCall(1500, () => copy.setLabel('Copy result'));
      }, { kind: 'toggle', fontSize: 32 }).setDepth(depth + 2);
      ui.button(this, W / 2, 828, 400, 64, 'Menu', () => this.scene.start('PopShotStart'),
        { kind: 'secondary', fontSize: 28 }).setDepth(depth + 2);
    }
  }

  Arcade.registerGame(
    { id: S.id, title: S.title, blurb: 'Shoot items into the cluster. Match three to pop them.', startScene: 'PopShotStart' },
    [PopShotStart, PopShotPlay],
  );
})();
