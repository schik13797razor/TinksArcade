// Tink's Table Push: flick items up a table; two of the same kind merge into the next one.
// Push one off the side or top edge and it's a spill. Three spills end the run.
//
// Shares the Emote Jar's skins, tier sizes, points, sounds and pixel bursts: those live in
// CONFIG and the skin helpers in game.js, which index.html loads first. Uses the arcade
// tools in arcade.js for best scores, seeds, difficulty and the Copy result line.

// ===================== TABLE_CONFIG: Table Push's tunable numbers =====================
const TABLE_CONFIG = {
  id: 'table-push',
  title: "Tink's Table Push",

  // Layout, in board units (the board is 636 x 1000; see arcade.js).
  hudHeight: 110,
  table: { left: 28, right: 608, top: 130, bottom: 900 }, // the playing surface
  launchY: 830,          // where the next item waits, centered left to right

  // The launch zone is a half circle on the bottom edge around the launch spot.
  // An item that sits inside it for launchZoneMs ends the run.
  launchZoneRadius: 170,
  launchZoneMs: 2000,
  warnAfter: 0.3,        // the zone starts flashing after this share of launchZoneMs

  maxStrikes: 3,         // spills allowed before the run ends
  spawnTiers: [1, 2, 3], // new items are picked at random from these

  physics: {
    friction: 0.025,     // how fast sliding items slow down (higher = stop sooner)
    restitution: 0.45,   // bounciness, 0 to 1
    contactFriction: 0.05,
    density: 0.001,
  },

  flick: {
    maxSpeed: 28,        // flick power: speed at a full pull (board units per frame)
    maxDrag: 220,        // pull this far (board units) for full power
    minDrag: 18,         // shorter pulls cancel, so a plain tap does nothing
    maxAngle: 80,        // degrees either side of straight up
    cooldownMs: 550,     // wait between flicks
    aimDots: 14,         // dots in the aim line at full power
    aimLength: 340,      // aim line length at full power
  },

  // Built-in sound for a spill. A skin's spill sound file (see skins in game.js) replaces it.
  sounds: {
    spill: [
      { freq: 520, to: 140, type: 'triangle', duration: 0.28, volume: 0.25 },
      { noise: true, filter: 600, duration: 0.18, volume: 0.25, delay: 0.22 },
    ],
  },

  // Weekly mode applies one of these, chosen by the week number (week 1 = first entry).
  // Fields you can use: frictionMul, zoneMul (multipliers), restitution, spawnTiers,
  // maxStrikes (replace the normal value).
  weeklyModifiers: [
    { name: 'Slick Table', desc: 'Items slide farther.', frictionMul: 0.7 },
    { name: 'Bouncy', desc: 'Everything bounces more.', restitution: 0.8 },
    { name: 'Big Start', desc: 'Items come in tiers 2 to 4.', spawnTiers: [2, 3, 4] },
    { name: 'Wide Zone', desc: 'The launch zone is bigger.', zoneMul: 1.3 },
    { name: 'Two Strikes', desc: 'Two spills end the run.', maxStrikes: 2 },
  ],
};
// ======================================================================================

// Everything below is wrapped in one function so its helper names can't clash with game.js.
(() => {
  const SHARED = CONFIG; // from game.js: skins, tiers (sizes and points), bigBonus, sounds, effects
  const T = TABLE_CONFIG;

  function weeklyModifier(week) {
    const list = T.weeklyModifiers;
    return list[(week - 1) % list.length];
  }

  // Combines TABLE_CONFIG, the difficulty preset and (in Weekly) the week's modifier.
  //   speed:       higher = less friction, so items slide farther
  //   cooldown:    the wait between flicks
  //   forgiveness: how long an item may sit in the launch zone
  function buildRules(mode, difficultyId, period) {
    const d = Arcade.difficulty(difficultyId);
    const m = mode === 'weekly' ? weeklyModifier(period.week) : {};
    return {
      modifier: mode === 'weekly' ? m : null,
      frictionAir: (T.physics.friction * (m.frictionMul ?? 1)) / d.speed,
      restitution: m.restitution ?? T.physics.restitution,
      cooldownMs: T.flick.cooldownMs * d.cooldown,
      zoneMs: T.launchZoneMs * d.forgiveness,
      zoneRadius: T.launchZoneRadius * (m.zoneMul ?? 1),
      maxStrikes: m.maxStrikes ?? T.maxStrikes,
      spawnTiers: m.spawnTiers ?? T.spawnTiers,
    };
  }

  function bestKey(period, difficultyId) {
    return `${T.id}:${period.key}:${difficultyId}`;
  }

  // Draws a dashed line from (x1, y1) to (x2, y2).
  function dashedLine(g, x1, y1, x2, y2, dash = 16, gap = 12) {
    const length = Math.hypot(x2 - x1, y2 - y1);
    const ux = (x2 - x1) / length;
    const uy = (y2 - y1) / length;
    for (let d = 0; d < length; d += dash + gap) {
      const end = Math.min(d + dash, length);
      g.lineBetween(x1 + ux * d, y1 + uy * d, x1 + ux * end, y1 + uy * end);
    }
  }

  // ---------------------------------- Start screen ----------------------------------
  class TablePushStart extends Phaser.Scene {
    constructor() {
      super('TablePushStart');
    }

    preload() {
      loadSkinFiles(this);
    }

    create() {
      const W = Arcade.config.width;
      const col = Arcade.config.colors;
      const ui = Arcade.ui;
      const last = Arcade.store.get(T.id + ':last', {});
      // A first visit starts on the skin last used in the Emote Jar.
      const jarLast = Arcade.store.get(SHARED.id + ':last', {});
      this.mode = ['free', 'daily', 'weekly'].includes(last.mode) ? last.mode : 'free';
      this.difficultyId = Arcade.config.difficulties[last.difficulty] ? last.difficulty : 'normal';
      this.skinId = skinIdOrDefault(last.skin || jarLast.skin);
      this.skinIds = Object.keys(SHARED.skins);
      this.skinIds.forEach((id) => ensureSkinTextures(this, id));

      ui.muteButton(this, W - 48, 44);
      ui.text(this, W / 2, 95, T.title, 56);
      ui.text(this, W / 2, 152, 'Flick. Match two. Merge.', 30, col.muted, { bold: false });

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
      this.skinPreview = SHARED.tiers.map((t, i) => this.add.image(0, 590, tierTextureKey(this.skinId, i + 1)));

      this.info = ui.text(this, W / 2, 672, '', 28, col.text, { bold: false, wrap: 560 });
      this.bestText = ui.text(this, W / 2, 742, '', 28, col.muted);

      ui.button(this, W / 2, 815, 380, 90, 'Play', () => {
        this.scene.start('TablePushPlay', { mode: this.mode, difficulty: this.difficultyId, skin: this.skinId });
      }, { fontSize: 44 });
      ui.button(this, W / 2, 906, 260, 60, 'Back to arcade', () => this.scene.start('ArcadeMenu'),
        { kind: 'secondary', fontSize: 28 });

      ui.text(this, W / 2, 968, 'Drag back and let go to flick. Keep items on the table.', 22, col.muted,
        { bold: false, wrap: 600 });

      this.select(this.mode, this.difficultyId, this.skinId);
    }

    cycleSkin(step) {
      const i = this.skinIds.indexOf(this.skinId);
      const next = this.skinIds[(i + step + this.skinIds.length) % this.skinIds.length];
      this.select(this.mode, this.difficultyId, next);
    }

    // Shows the skin's 8 tiers in a row, growing from small to big.
    showSkinPreview() {
      const W = Arcade.config.width;
      const sizes = this.skinPreview.map((img, i) => 40 + i * 5);
      const gap = 8;
      const total = sizes.reduce((sum, s) => sum + s, 0) + gap * (sizes.length - 1);
      let x = W / 2 - total / 2;
      this.skinPreview.forEach((img, i) => {
        img.setTexture(tierTextureKey(this.skinId, i + 1));
        img.setDisplaySize(sizes[i], sizes[i]);
        img.x = x + sizes[i] / 2;
        x += sizes[i] + gap;
      });
    }

    select(mode, difficultyId, skinId) {
      this.mode = mode;
      this.difficultyId = difficultyId;
      this.skinId = skinId;
      Arcade.store.set(T.id + ':last', { mode, difficulty: difficultyId, skin: skinId });
      for (const id in this.modeButtons) this.modeButtons[id].setSelected(id === mode);
      for (const id in this.difficultyButtons) this.difficultyButtons[id].setSelected(id === difficultyId);
      this.skinName.setText(SHARED.skins[skinId].name);
      this.cameras.main.setBackgroundColor(SHARED.skins[skinId].background);
      this.showSkinPreview();

      const period = Arcade.getPeriod(T.id, mode);
      if (mode === 'daily') {
        this.info.setText(`${period.label}: the same items for everyone today.`);
      } else if (mode === 'weekly') {
        const m = weeklyModifier(period.week);
        this.info.setText(`${period.label}: ${m.name}. ${m.desc}\nSame items for everyone this week.`);
      } else {
        this.info.setText('New random items every game.');
      }
      const best = Arcade.getBest(bestKey(period, difficultyId));
      this.bestText.setText(best > 0 ? `Best: ${Arcade.formatScore(best)}` : '');
    }
  }

  // ---------------------------------- The game ----------------------------------
  class TablePushPlay extends Phaser.Scene {
    constructor() {
      super('TablePushPlay');
    }

    init(data) {
      this.mode = data.mode || 'free';
      this.difficultyId = data.difficulty || 'normal';
      this.skinId = skinIdOrDefault(data.skin);
      this.skin = SHARED.skins[this.skinId];
    }

    create() {
      this.period = Arcade.getPeriod(T.id, this.mode);
      this.rules = buildRules(this.mode, this.difficultyId, this.period);
      // The seeded generator only picks items, so everyone playing the same
      // Daily or Weekly gets the same sequence.
      this.rng = Arcade.createRng(this.period.seed);
      this.bestKey = bestKey(this.period, this.difficultyId);
      this.best = Arcade.getBest(this.bestKey);
      this.score = 0;
      this.strikes = 0;
      this.items = new Set();
      this.mergeQueue = [];
      this.lastFlickAt = -Infinity;
      this.isOver = false;
      this.aim = null; // while dragging: { x, y, dirX, dirY, power }

      ensureSkinTextures(this, this.skinId);
      this.cameras.main.setBackgroundColor(this.skin.background);

      this.launchX = Arcade.config.width / 2;
      this.launchY = T.launchY;

      this.setUpPhysics();
      this.drawTable();
      this.createHud();

      this.aimDots = this.add.graphics().setDepth(20);
      this.held = this.add.image(this.launchX, this.launchY, this.tierKey(1)).setDepth(5);
      this.current = this.rollTier();
      this.next = this.rollTier();
      this.refreshLauncher();

      this.setUpInput();
    }

    // ---------- Setup ----------
    setUpPhysics() {
      const world = this.matter.world;
      world.resume();
      world.disableGravity(); // top-down: nothing falls, items just slide and slow down
      world.engine.positionIterations = 10;
      world.engine.velocityIterations = 8;

      // Only the bottom edge has a bumper. The sides and top are open: off them is a spill.
      const { left, right, bottom } = T.table;
      const t = 60;
      this.matter.add.rectangle((left + right) / 2, bottom + t / 2, right - left, t,
        { isStatic: true, friction: 0, label: 'wall' });

      this.onCollision = (event) => {
        for (const pair of event.pairs) {
          const a = pair.bodyA.gameObject;
          const b = pair.bodyB.gameObject;
          if (!a || !b || a.tier === undefined || b.tier === undefined) continue;
          if (a.tier !== b.tier || a.merging || b.merging) continue;
          a.merging = true;
          b.merging = true;
          this.mergeQueue.push([a, b]);
        }
      };
      world.on('collisionstart', this.onCollision);
      world.on('collisionactive', this.onCollision);
      this.events.once('shutdown', () => {
        world.off('collisionstart', this.onCollision);
        world.off('collisionactive', this.onCollision);
      });
    }

    drawTable() {
      const W = Arcade.config.width;
      const col = Arcade.config.colors;
      const { left, right, top, bottom } = T.table;

      const g = this.add.graphics();
      g.fillStyle(0xffffff, 0.06);
      g.fillRect(left, top, right - left, bottom - top);
      // Open edges: dashed, because items can go over them.
      g.lineStyle(4, 0xffffff, 0.3);
      dashedLine(g, left, bottom, left, top);
      dashedLine(g, left, top, right, top);
      dashedLine(g, right, top, right, bottom);
      // The bumper along the bottom.
      g.fillStyle(col.border, 1);
      g.fillRect(left, bottom, right - left, 12);

      // The launch zone, plus a red copy that flashes when something sits in it.
      const zone = (gfx, color, fillAlpha, lineAlpha) => {
        gfx.fillStyle(color, fillAlpha);
        gfx.lineStyle(3, color, lineAlpha);
        gfx.beginPath();
        gfx.arc(this.launchX, bottom, this.rules.zoneRadius, Math.PI, Math.PI * 2, false);
        gfx.closePath();
        gfx.fillPath();
        gfx.strokePath();
      };
      zone(this.add.graphics(), 0xffffff, 0.05, 0.25);
      this.warnZone = this.add.graphics().setVisible(false);
      zone(this.warnZone, col.warn, 0.25, 1);

      Arcade.ui.text(this, W / 2, bottom + 50, this.contextLabel(), 24, col.muted, { bold: false });
      Arcade.ui.muteButton(this, W - 44, bottom + 50);
    }

    contextLabel() {
      const parts = [this.period.label, Arcade.difficulty(this.difficultyId).label];
      if (this.rules.modifier) parts.push(this.rules.modifier.name);
      return parts.join(' · ');
    }

    createHud() {
      const W = Arcade.config.width;
      const col = Arcade.config.colors;
      const ui = Arcade.ui;
      ui.button(this, 76, 55, 112, 62, 'Menu', () => this.scene.start('TablePushStart'),
        { kind: 'secondary', fontSize: 28 }).setDepth(50);

      const left = { originX: 0 };
      ui.text(this, 150, 26, 'SCORE', 24, col.muted, left);
      this.scoreText = ui.text(this, 150, 66, '0', 40, col.text, left);
      ui.text(this, 300, 26, 'BEST', 24, col.muted, left);
      this.bestText = ui.text(this, 300, 66, Arcade.formatScore(this.best), 40, col.text, left);
      ui.text(this, 440, 26, 'STRIKES', 24, col.muted, left);
      this.strikeDots = this.add.graphics();
      this.drawStrikes();

      ui.text(this, W - 50, 22, 'NEXT', 24, col.muted);
      this.nextPreview = this.add.image(W - 50, 68, this.tierKey(1));
    }

    // One dot per allowed spill: filled red once used.
    drawStrikes() {
      const col = Arcade.config.colors;
      const g = this.strikeDots;
      g.clear();
      for (let i = 0; i < this.rules.maxStrikes; i++) {
        const x = 452 + i * 30;
        if (i < this.strikes) {
          g.fillStyle(col.warn, 1);
          g.fillCircle(x, 66, 11);
        } else {
          g.lineStyle(3, col.border, 1);
          g.strokeCircle(x, 66, 10);
        }
      }
    }

    setUpInput() {
      // Press anywhere on the table, pull back, let go: the item flies the opposite way.
      this.input.on('pointerdown', (pointer, over) => {
        if (this.isOver || over.length > 0) return; // pressed a button, not the table
        this.aim = { x: pointer.worldX, y: pointer.worldY, dirX: 0, dirY: -1, power: 0 };
      });
      this.input.on('pointermove', (pointer) => {
        if (this.aim) this.updateAim(pointer.worldX, pointer.worldY);
      });
      this.input.on('pointerup', () => {
        if (!this.aim) return;
        const aim = this.aim;
        this.aim = null;
        if (aim.power > 0) this.flick(aim);
      });
    }

    // ---------- Aiming and flicking ----------
    rollTier() {
      return this.rng.pick(this.rules.spawnTiers);
    }

    radiusOf(tier) {
      return SHARED.tiers[tier - 1].radius;
    }

    tierKey(tier) {
      return tierTextureKey(this.skinId, tier);
    }

    colorOf(tier) {
      return this.skin.tiers[tier - 1].color;
    }

    playEffect(name, notes, rate) {
      playSkinSound(this, this.skinId, name, notes, rate);
    }

    refreshLauncher() {
      this.held.setTexture(this.tierKey(this.current));
      this.nextPreview.setTexture(this.tierKey(this.next));
      this.nextPreview.setScale(Math.min(1, 56 / (this.radiusOf(this.next) * 2)));
    }

    updateAim(px, py) {
      const F = T.flick;
      const dx = this.aim.x - px; // pulling back points the other way
      const dy = this.aim.y - py;
      const dist = Math.hypot(dx, dy);
      if (dist < F.minDrag) {
        this.aim.power = 0;
        return;
      }
      // Angle from straight up (positive = to the right), kept within maxAngle.
      const max = Phaser.Math.DegToRad(F.maxAngle);
      const angle = Phaser.Math.Clamp(Math.atan2(dx, -dy), -max, max);
      this.aim.dirX = Math.sin(angle);
      this.aim.dirY = -Math.cos(angle);
      this.aim.power = Math.min(1, dist / F.maxDrag);
    }

    drawAim(ready) {
      const g = this.aimDots;
      g.clear();
      if (!this.aim || this.aim.power <= 0) return;
      const F = T.flick;
      const count = Math.max(2, Math.round(F.aimDots * this.aim.power));
      const step = F.aimLength / F.aimDots;
      const start = this.radiusOf(this.current) + 10;
      for (let i = 0; i < count; i++) {
        const d = start + i * step;
        g.fillStyle(0xffffff, (ready ? 0.9 : 0.35) * (1 - (i / count) * 0.6));
        g.fillCircle(this.launchX + this.aim.dirX * d, this.launchY + this.aim.dirY * d, 6);
      }
    }

    flick(aim) {
      if (this.isOver || this.time.now - this.lastFlickAt < this.rules.cooldownMs) return;
      this.lastFlickAt = this.time.now;
      const speed = T.flick.maxSpeed * aim.power;
      const item = this.createItem(this.current, this.launchX, this.launchY);
      item.setVelocity(aim.dirX * speed, aim.dirY * speed);
      this.playEffect('drop', SHARED.sounds.drop);
      this.current = this.next;
      this.next = this.rollTier();
      this.refreshLauncher();
    }

    createItem(tier, x, y) {
      const item = this.matter.add.image(x, y, this.tierKey(tier), null, {
        shape: { type: 'circle', radius: this.radiusOf(tier) },
        restitution: this.rules.restitution,
        friction: T.physics.contactFriction,
        frictionStatic: 0,
        frictionAir: this.rules.frictionAir,
        density: T.physics.density,
        label: 'item',
      });
      item.tier = tier;
      item.merging = false;
      item.zoneSince = null;
      this.items.add(item);
      return item;
    }

    removeItem(item) {
      this.items.delete(item);
      item.destroy();
    }

    // ---------- Merging (same points as the jar) ----------
    processMerges() {
      const queue = this.mergeQueue;
      this.mergeQueue = [];
      for (const [a, b] of queue) {
        if (!a.active || !b.active) continue;
        const x = (a.x + b.x) / 2;
        const y = (a.y + b.y) / 2;
        // The merged item keeps the pair's average motion, so it carries on sliding.
        const vx = (a.body.velocity.x + b.body.velocity.x) / 2;
        const vy = (a.body.velocity.y + b.body.velocity.y) / 2;
        const tier = a.tier;
        this.removeItem(a);
        this.removeItem(b);

        if (tier < SHARED.tiers.length) {
          this.createItem(tier + 1, x, y).setVelocity(vx, vy);
          this.addScore(SHARED.tiers[tier - 1].points, x, y, this.colorOf(tier + 1));
          this.playEffect('merge', mergeSound(tier), 1 + SHARED.sounds.mergeRateStep * (tier - 1));
          this.mergeBurst(tier + 1, x, y);
        } else {
          // Two top-tier items: both vanish with a big bonus.
          this.addScore(SHARED.bigBonus, x, y, this.colorOf(tier), true);
          this.playEffect('bonus', SHARED.sounds.bonus);
          const fx = SHARED.effects;
          Arcade.fx.pixelBurst(this, x, y, {
            count: fx.bonusPixels,
            colors: this.skin.tiers.map((t) => t.color).concat('#ffffff'),
            speedMin: fx.bonusSpeed[0],
            speedMax: fx.bonusSpeed[1],
            lifeMs: fx.bonusLifeMs,
            size: fx.pixelSize * 1.3,
            gravity: 0,
          });
          this.cameras.main.shake(250, 0.008);
        }
      }
    }

    mergeBurst(newTier, x, y) {
      const fx = SHARED.effects;
      if (newTier < fx.burstFromTier) return;
      Arcade.fx.pixelBurst(this, x, y, {
        count: fx.burstPixels + (newTier - fx.burstFromTier) * fx.burstPixelsPerTier,
        colors: [this.colorOf(newTier), '#ffffff'],
        speedMin: fx.burstSpeed[0],
        speedMax: fx.burstSpeed[1],
        lifeMs: fx.burstLifeMs,
        size: fx.pixelSize,
        gravity: 0, // top-down: pixels spread out flat instead of falling
      });
    }

    addScore(points, x, y, color, big = false) {
      this.score += points;
      this.scoreText.setText(Arcade.formatScore(this.score));
      if (Arcade.saveBest(this.bestKey, this.score)) this.bestText.setText(Arcade.formatScore(this.score));

      const ring = this.add.circle(x, y, big ? 90 : 40, Phaser.Display.Color.HexStringToColor(color).color, 0.5);
      this.tweens.add({ targets: ring, scale: big ? 3 : 1.8, alpha: 0, duration: big ? 500 : 260, onComplete: () => ring.destroy() });

      const label = Arcade.ui.text(this, x, y, '+' + Arcade.formatScore(points), big ? 64 : 34, Arcade.config.colors.text);
      label.setDepth(40);
      this.tweens.add({ targets: label, y: y - (big ? 120 : 70), alpha: 0, duration: big ? 1100 : 650, onComplete: () => label.destroy() });
    }

    // ---------- Spills ----------
    spill(item) {
      const { left, right, top } = T.table;
      const x = Phaser.Math.Clamp(item.x, left + 50, right - 50);
      const y = Math.max(item.y, top + 30);
      this.removeItem(item);
      this.strikes += 1;
      this.drawStrikes();
      this.playEffect('spill', T.sounds.spill);

      const label = Arcade.ui.text(this, x, y, 'Spill!', 34, Arcade.config.colors.accent).setDepth(40);
      this.tweens.add({ targets: label, y: y + 50, alpha: 0, duration: 900, onComplete: () => label.destroy() });

      if (this.strikes >= this.rules.maxStrikes) this.gameOver('spills');
    }

    // ---------- Each frame ----------
    update(time) {
      if (this.isOver) return;
      this.processMerges();

      const { left, right, top, bottom } = T.table;
      let worst = 0;
      for (const item of this.items) {
        if (item.merging) continue;
        // Off the side or top edge (its center is past the edge): a spill.
        if (item.x < left || item.x > right || item.y < top || item.y > Arcade.config.height + 200) {
          this.spill(item);
          if (this.isOver) return;
          continue;
        }
        // Sitting in the launch zone for too long ends the run.
        const inZone = Phaser.Math.Distance.Between(item.x, item.y, this.launchX, bottom) < this.rules.zoneRadius;
        if (inZone) {
          if (item.zoneSince === null) item.zoneSince = time;
          const share = (time - item.zoneSince) / this.rules.zoneMs;
          if (share >= 1) { this.gameOver('zone'); return; }
          worst = Math.max(worst, share);
        } else {
          item.zoneSince = null;
        }
      }
      const warn = worst > T.warnAfter;
      this.warnZone.setVisible(warn);
      if (warn) this.warnZone.setAlpha(0.5 + 0.5 * Math.sin(time / 70));

      const ready = time - this.lastFlickAt >= this.rules.cooldownMs;
      this.held.setAlpha(ready ? 1 : 0.35);
      this.drawAim(ready);
    }

    // ---------- Game over ----------
    gameOver(reason) {
      this.isOver = true;
      this.aim = null;
      this.aimDots.clear();
      this.matter.world.pause();
      if (reason === 'zone') this.warnZone.setVisible(true).setAlpha(1);
      const isNewBest = this.score > this.best; // this.best is from before this round
      const best = Math.max(this.best, this.score);
      if (isNewBest) this.playEffect('newBest', SHARED.sounds.newBest);
      else this.playEffect('gameOver', SHARED.sounds.gameOver);

      const W = Arcade.config.width;
      const H = Arcade.config.height;
      const col = Arcade.config.colors;
      const ui = Arcade.ui;
      const depth = 100;
      const line = Arcade.resultLine(T.title, this.period, this.difficultyId, this.score, this.skin.name);
      const title = reason === 'zone' ? 'Launch spot blocked' : 'Too many spills';

      this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setDepth(depth);
      const panel = this.add.graphics().setDepth(depth);
      panel.fillStyle(col.panel, 1);
      panel.fillRoundedRect(W / 2 - 270, 210, 540, 660, 28);

      ui.text(this, W / 2, 285, title, 44).setDepth(depth + 1);
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
      ui.button(this, W / 2, 828, 400, 64, 'Menu', () => this.scene.start('TablePushStart'),
        { kind: 'secondary', fontSize: 28 }).setDepth(depth + 2);
    }
  }

  Arcade.registerGame(
    { id: T.id, title: T.title, blurb: 'Flick items up the table. Match two to merge them.', startScene: 'TablePushStart' },
    [TablePushStart, TablePushPlay],
  );
})();
