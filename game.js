// Tink's Emote Jar: drop emotes into a jar; two of the same kind merge into the next one.
// Uses the shared tools in arcade.js (best scores, seeded drops, difficulty, copy result).

// ===================== CONFIG: every tunable number lives here =====================
const CONFIG = {
  id: 'emote-jar',
  title: "Tink's Emote Jar",

  // Layout, in board units (the board is 636 x 1000; see arcade.js).
  hudHeight: 110,      // score bar at the top
  dropperY: 180,       // where new items hang before they drop
  lineY: 250,          // the game-over line
  jar: {
    width: 560,        // inside width
    bottomY: 940,      // inside floor
    wallThickness: 60, // physics walls; thick so fast items can't slip through
  },

  // 8 tiers, smallest first. points = score for merging two of this tier.
  // Placeholder circles for now; real emote art goes in assets/ later.
  tiers: [
    { radius: 26, color: '#ff9ecb', points: 2 },
    { radius: 36, color: '#ffd166', points: 5 },
    { radius: 48, color: '#7ee081', points: 10 },
    { radius: 60, color: '#5ec8ff', points: 20 },
    { radius: 74, color: '#b28dff', points: 40 },
    { radius: 90, color: '#ff8c42', points: 80 },
    { radius: 108, color: '#2ec4b6', points: 160 },
    { radius: 130, color: '#ffe14d', points: 0 }, // tier 8 can't merge up; see bigBonus
  ],
  bigBonus: 1000,       // two tier-8 items touching: both vanish, plus this

  spawnTiers: [1, 2, 3], // new drops are picked at random from these

  physics: {
    gravity: 1.6,
    restitution: 0.15,  // bounciness, 0 to 1
    friction: 0.08,
    frictionStatic: 0.4,
    frictionAir: 0.01,
    density: 0.001,
  },

  dropCooldownMs: 550,  // wait between drops
  overflowMs: 2000,     // an item above the line this long ends the game
  warnAfter: 0.3,       // the line starts flashing after this share of overflowMs
  dropperSpeed: 700,    // arrow keys, board units per second

  // Weekly mode applies one of these, chosen by the week number (week 1 = first entry).
  // Fields you can use: jarWidthMul, gravityMul, cooldownMul, frictionMul (multipliers),
  // restitution, spawnTiers (replace the normal value), lineDropPx (moves the line down).
  weeklyModifiers: [
    { name: 'Snug Jar', desc: 'The jar is narrower.', jarWidthMul: 0.85 },
    { name: 'Heavy Drops', desc: 'Items fall faster.', gravityMul: 1.5 },
    { name: 'Quick Hands', desc: 'Shorter wait between drops.', cooldownMul: 0.5 },
    { name: 'Bouncy', desc: 'Everything bounces more.', restitution: 0.55 },
    { name: 'Big Start', desc: 'Drops come in tiers 2 to 4.', spawnTiers: [2, 3, 4] },
    { name: 'Low Lid', desc: 'The line sits lower.', lineDropPx: 70 },
    { name: 'Slippery', desc: 'Items slide more.', frictionMul: 0.2 },
  ],
};
// ===================================================================================

function weeklyModifier(week) {
  const list = CONFIG.weeklyModifiers;
  return list[(week - 1) % list.length];
}

// Combines CONFIG, the difficulty preset and (in Weekly) the week's modifier.
function buildRules(mode, difficultyId, period) {
  const d = Arcade.difficulty(difficultyId);
  const m = mode === 'weekly' ? weeklyModifier(period.week) : {};
  const p = CONFIG.physics;
  return {
    modifier: mode === 'weekly' ? m : null,
    jarWidth: CONFIG.jar.width * (m.jarWidthMul ?? 1),
    lineY: CONFIG.lineY + (m.lineDropPx ?? 0),
    gravity: p.gravity * d.speed * (m.gravityMul ?? 1),
    cooldownMs: CONFIG.dropCooldownMs * d.cooldown * (m.cooldownMul ?? 1),
    overflowMs: CONFIG.overflowMs * d.forgiveness,
    restitution: m.restitution ?? p.restitution,
    friction: p.friction * (m.frictionMul ?? 1),
    spawnTiers: m.spawnTiers ?? CONFIG.spawnTiers,
  };
}

function tierTextureKey(tier) {
  return `${CONFIG.id}-tier-${tier}`;
}

// Draws the placeholder circles once. When real art arrives, load images with
// the same texture keys in preload() and this skips them.
function ensureTierTextures(scene) {
  CONFIG.tiers.forEach((t, i) => {
    const tier = i + 1;
    const key = tierTextureKey(tier);
    if (scene.textures.exists(key)) return;
    const r = t.radius;
    const tex = scene.textures.createCanvas(key, r * 2, r * 2);
    const ctx = tex.getContext();
    ctx.beginPath();
    ctx.arc(r, r, r - 3, 0, Math.PI * 2);
    ctx.fillStyle = t.color;
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(r * 0.62, r * 0.58, r * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fill();
    ctx.fillStyle = '#2a1640';
    ctx.font = `bold ${Math.round(r * 0.95)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(tier), r, r * 1.06);
    tex.refresh();
  });
}

function bestKey(period, difficultyId) {
  return `${CONFIG.id}:${period.key}:${difficultyId}`;
}

// ---------------------------------- Start screen ----------------------------------
class EmoteJarStart extends Phaser.Scene {
  constructor() {
    super('EmoteJarStart');
  }

  create() {
    const W = Arcade.config.width;
    const col = Arcade.config.colors;
    const ui = Arcade.ui;
    const last = Arcade.store.get(CONFIG.id + ':last', {});
    this.mode = ['free', 'daily', 'weekly'].includes(last.mode) ? last.mode : 'free';
    this.difficultyId = Arcade.config.difficulties[last.difficulty] ? last.difficulty : 'normal';

    ui.text(this, W / 2, 110, CONFIG.title, 56);
    ui.text(this, W / 2, 172, 'Drop. Match two. Merge.', 30, col.muted, { bold: false });

    ui.text(this, W / 2, 255, 'MODE', 26, col.muted);
    this.modeButtons = {};
    Arcade.config.modes.forEach((m, i) => {
      this.modeButtons[m.id] = ui.button(this, 108 + i * 210, 315, 190, 76, m.label,
        () => this.select(m.id, this.difficultyId), { kind: 'toggle', fontSize: 30 });
    });

    ui.text(this, W / 2, 410, 'DIFFICULTY', 26, col.muted);
    this.difficultyButtons = {};
    Arcade.config.difficultyOrder.forEach((id, i) => {
      this.difficultyButtons[id] = ui.button(this, 108 + i * 210, 470, 190, 76, Arcade.difficulty(id).label,
        () => this.select(this.mode, id), { kind: 'toggle', fontSize: 30 });
    });

    this.info = ui.text(this, W / 2, 590, '', 30, col.text, { bold: false, wrap: 560 });
    this.bestText = ui.text(this, W / 2, 670, '', 30, col.muted);

    ui.button(this, W / 2, 770, 380, 100, 'Play', () => {
      this.scene.start('EmoteJarPlay', { mode: this.mode, difficulty: this.difficultyId });
    }, { fontSize: 44 });
    ui.button(this, W / 2, 880, 260, 70, 'Back to arcade', () => this.scene.start('ArcadeMenu'),
      { kind: 'secondary', fontSize: 28 });

    ui.text(this, W / 2, 960, 'Aim with mouse, touch or arrows. Click, tap or Space to drop.', 24, col.muted,
      { bold: false, wrap: 580 });

    this.select(this.mode, this.difficultyId);
  }

  select(mode, difficultyId) {
    this.mode = mode;
    this.difficultyId = difficultyId;
    Arcade.store.set(CONFIG.id + ':last', { mode, difficulty: difficultyId });
    for (const id in this.modeButtons) this.modeButtons[id].setSelected(id === mode);
    for (const id in this.difficultyButtons) this.difficultyButtons[id].setSelected(id === difficultyId);

    const period = Arcade.getPeriod(CONFIG.id, mode);
    if (mode === 'daily') {
      this.info.setText(`${period.label}: the same drops for everyone today.`);
    } else if (mode === 'weekly') {
      const m = weeklyModifier(period.week);
      this.info.setText(`${period.label}: ${m.name}. ${m.desc}\nSame drops for everyone this week.`);
    } else {
      this.info.setText('New random drops every game.');
    }
    const best = Arcade.getBest(bestKey(period, difficultyId));
    this.bestText.setText(best > 0 ? `Best: ${Arcade.formatScore(best)}` : '');
  }
}

// ---------------------------------- The game ----------------------------------
class EmoteJarPlay extends Phaser.Scene {
  constructor() {
    super('EmoteJarPlay');
  }

  init(data) {
    this.mode = data.mode || 'free';
    this.difficultyId = data.difficulty || 'normal';
  }

  create() {
    const W = Arcade.config.width;
    this.period = Arcade.getPeriod(CONFIG.id, this.mode);
    this.rules = buildRules(this.mode, this.difficultyId, this.period);
    // The seeded generator is used only to pick drops, so everyone playing the
    // same Daily or Weekly gets the same sequence of items.
    this.rng = Arcade.createRng(this.period.seed);
    this.bestKey = bestKey(this.period, this.difficultyId);
    this.best = Arcade.getBest(this.bestKey);
    this.score = 0;
    this.items = new Set();
    this.mergeQueue = [];
    this.lastDropAt = -Infinity;
    this.isOver = false;
    this.aiming = false;

    ensureTierTextures(this);

    // Jar edges.
    this.jarLeft = W / 2 - this.rules.jarWidth / 2;
    this.jarRight = W / 2 + this.rules.jarWidth / 2;
    this.jarBottom = CONFIG.jar.bottomY;

    this.setUpPhysics();
    this.drawJar();
    this.createHud();

    // Dropper: a guide line and the item waiting to drop.
    this.guide = this.add.graphics();
    this.held = this.add.image(W / 2, CONFIG.dropperY, tierTextureKey(1));
    this.current = this.rollTier();
    this.next = this.rollTier();
    this.dropX = W / 2;
    this.refreshDropper();

    this.setUpInput();
  }

  // ---------- Setup ----------
  setUpPhysics() {
    const world = this.matter.world;
    world.resume();
    world.setGravity(0, this.rules.gravity);
    // More solver passes keep tall stacks steady.
    world.engine.positionIterations = 10;
    world.engine.velocityIterations = 8;

    const t = CONFIG.jar.wallThickness;
    const top = CONFIG.hudHeight;
    const height = this.jarBottom - top + t;
    const wall = { isStatic: true, friction: 0.3, label: 'wall' };
    this.matter.add.rectangle(this.jarLeft - t / 2, top + height / 2, t, height, wall);
    this.matter.add.rectangle(this.jarRight + t / 2, top + height / 2, t, height, wall);
    this.matter.add.rectangle(Arcade.config.width / 2, this.jarBottom + t / 2, this.rules.jarWidth + t * 2, t, wall);

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

  drawJar() {
    const col = Arcade.config.colors;
    const top = this.rules.lineY - 40;
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.05);
    g.fillRect(this.jarLeft, top, this.rules.jarWidth, this.jarBottom - top);
    g.lineStyle(8, col.border, 1);
    g.beginPath();
    g.moveTo(this.jarLeft - 4, top);
    g.lineTo(this.jarLeft - 4, this.jarBottom + 4);
    g.lineTo(this.jarRight + 4, this.jarBottom + 4);
    g.lineTo(this.jarRight + 4, top);
    g.strokePath();

    // The game-over line: calm dashes, plus a red copy that flashes when something lingers above it.
    const dashes = (gfx, color, alpha) => {
      gfx.lineStyle(4, color, alpha);
      for (let x = this.jarLeft; x < this.jarRight; x += 28) {
        gfx.lineBetween(x, this.rules.lineY, Math.min(x + 16, this.jarRight), this.rules.lineY);
      }
    };
    dashes(this.add.graphics(), 0xffffff, 0.25);
    this.warnLine = this.add.graphics().setVisible(false);
    dashes(this.warnLine, col.warn, 1);

    Arcade.ui.text(this, Arcade.config.width / 2, this.jarBottom + 34, this.contextLabel(), 24, col.muted, { bold: false });
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
    ui.button(this, 76, 55, 112, 62, 'Menu', () => this.scene.start('EmoteJarStart'),
      { kind: 'secondary', fontSize: 28 }).setDepth(50);

    const left = { originX: 0 };
    ui.text(this, 160, 26, 'SCORE', 24, col.muted, left);
    this.scoreText = ui.text(this, 160, 66, '0', 44, col.text, left);
    ui.text(this, 350, 26, 'BEST', 24, col.muted, left);
    this.bestText = ui.text(this, 350, 66, Arcade.formatScore(this.best), 44, col.text, left);

    ui.text(this, W - 56, 22, 'NEXT', 24, col.muted);
    this.nextPreview = this.add.image(W - 56, 68, tierTextureKey(1));
  }

  setUpInput() {
    // Mouse: moving aims. Touch: press and drag to aim, lift to drop.
    // A click or tap drops on release, so it works the same for both.
    this.input.on('pointermove', (pointer) => {
      if (!this.isOver) this.setDropX(pointer.worldX);
    });
    this.input.on('pointerdown', (pointer, over) => {
      if (this.isOver || over.length > 0) return; // pressed a button, not the jar
      this.aiming = true;
      this.setDropX(pointer.worldX);
    });
    this.input.on('pointerup', () => {
      if (!this.aiming) return;
      this.aiming = false;
      this.dropItem();
    });

    const kb = this.input.keyboard;
    this.keys = {
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      a: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      d: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      space: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
    };
  }

  // ---------- Dropping ----------
  rollTier() {
    return this.rng.pick(this.rules.spawnTiers);
  }

  radiusOf(tier) {
    return CONFIG.tiers[tier - 1].radius;
  }

  setDropX(x) {
    const r = this.radiusOf(this.current);
    this.dropX = Phaser.Math.Clamp(x, this.jarLeft + r + 2, this.jarRight - r - 2);
  }

  refreshDropper() {
    this.held.setTexture(tierTextureKey(this.current));
    this.nextPreview.setTexture(tierTextureKey(this.next));
    this.nextPreview.setScale(Math.min(1, 56 / (this.radiusOf(this.next) * 2)));
    this.setDropX(this.dropX);
  }

  dropItem() {
    if (this.isOver || this.time.now - this.lastDropAt < this.rules.cooldownMs) return;
    this.lastDropAt = this.time.now;
    this.createItem(this.current, this.dropX, CONFIG.dropperY);
    this.current = this.next;
    this.next = this.rollTier();
    this.refreshDropper();
  }

  createItem(tier, x, y) {
    const p = CONFIG.physics;
    const item = this.matter.add.image(x, y, tierTextureKey(tier), null, {
      shape: { type: 'circle', radius: this.radiusOf(tier) },
      restitution: this.rules.restitution,
      friction: this.rules.friction,
      frictionStatic: p.frictionStatic,
      frictionAir: p.frictionAir,
      density: p.density,
      label: 'item',
    });
    item.tier = tier;
    item.merging = false;
    item.aboveSince = null;
    this.items.add(item);
    return item;
  }

  removeItem(item) {
    this.items.delete(item);
    item.destroy();
  }

  // ---------- Merging ----------
  processMerges() {
    const queue = this.mergeQueue;
    this.mergeQueue = [];
    for (const [a, b] of queue) {
      if (!a.active || !b.active) continue;
      const x = (a.x + b.x) / 2;
      const y = (a.y + b.y) / 2;
      const tier = a.tier;
      this.removeItem(a);
      this.removeItem(b);

      if (tier < CONFIG.tiers.length) {
        this.createItem(tier + 1, x, y);
        this.addScore(CONFIG.tiers[tier - 1].points, x, y, CONFIG.tiers[tier].color);
      } else {
        // Two top-tier items: both vanish with a big bonus.
        this.addScore(CONFIG.bigBonus, x, y, CONFIG.tiers[tier - 1].color, true);
        this.cameras.main.flash(250, 255, 225, 77);
        this.cameras.main.shake(250, 0.01);
      }
    }
  }

  addScore(points, x, y, color, big = false) {
    this.score += points;
    this.scoreText.setText(Arcade.formatScore(this.score));
    // Save as soon as the best is beaten, so leaving mid-game (Menu, closing the tab) keeps it.
    if (Arcade.saveBest(this.bestKey, this.score)) this.bestText.setText(Arcade.formatScore(this.score));

    const ring = this.add.circle(x, y, big ? 90 : 40, Phaser.Display.Color.HexStringToColor(color).color, 0.5);
    this.tweens.add({ targets: ring, scale: big ? 3 : 1.8, alpha: 0, duration: big ? 500 : 260, onComplete: () => ring.destroy() });

    const label = Arcade.ui.text(this, x, y, '+' + Arcade.formatScore(points), big ? 64 : 34, Arcade.config.colors.text);
    label.setDepth(40);
    this.tweens.add({ targets: label, y: y - (big ? 120 : 70), alpha: 0, duration: big ? 1100 : 650, onComplete: () => label.destroy() });
  }

  // ---------- Each frame ----------
  update(time, delta) {
    if (this.isOver) return;

    const dir = (this.keys.right.isDown || this.keys.d.isDown ? 1 : 0) - (this.keys.left.isDown || this.keys.a.isDown ? 1 : 0);
    if (dir !== 0) this.setDropX(this.dropX + dir * CONFIG.dropperSpeed * (delta / 1000));
    if (Phaser.Input.Keyboard.JustDown(this.keys.space)) this.dropItem();

    this.processMerges();

    // Game-over check: an item whose top stays above the line for overflowMs.
    let worst = 0;
    for (const item of this.items) {
      if (item.merging) continue;
      if (item.y > Arcade.config.height + 300) { this.removeItem(item); continue; } // safety net
      if (item.y - this.radiusOf(item.tier) < this.rules.lineY) {
        if (item.aboveSince === null) item.aboveSince = time;
        const share = (time - item.aboveSince) / this.rules.overflowMs;
        if (share >= 1) { this.gameOver(); return; }
        worst = Math.max(worst, share);
      } else {
        item.aboveSince = null;
      }
    }
    const warn = worst > CONFIG.warnAfter;
    this.warnLine.setVisible(warn);
    if (warn) this.warnLine.setAlpha(0.5 + 0.5 * Math.sin(time / 70));

    // Dropper and guide line.
    const ready = time - this.lastDropAt >= this.rules.cooldownMs;
    this.held.setPosition(this.dropX, CONFIG.dropperY).setAlpha(ready ? 1 : 0.35);
    this.guide.clear();
    this.guide.lineStyle(3, 0xffffff, 0.12);
    this.guide.lineBetween(this.dropX, CONFIG.dropperY, this.dropX, this.jarBottom);
  }

  // ---------- Game over ----------
  gameOver() {
    this.isOver = true;
    this.aiming = false;
    this.matter.world.pause();
    this.warnLine.setVisible(true).setAlpha(1);
    // this.best is the best from before this round started.
    const isNewBest = this.score > this.best;
    const best = Math.max(this.best, this.score);

    const W = Arcade.config.width;
    const H = Arcade.config.height;
    const col = Arcade.config.colors;
    const ui = Arcade.ui;
    const depth = 100;
    const line = Arcade.resultLine(CONFIG.title, this.period, this.difficultyId, this.score);

    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setDepth(depth);
    const panel = this.add.graphics().setDepth(depth);
    panel.fillStyle(col.panel, 1);
    panel.fillRoundedRect(W / 2 - 270, 210, 540, 660, 28);

    ui.text(this, W / 2, 285, "The jar's full", 48).setDepth(depth + 1);
    ui.text(this, W / 2, 355, 'SCORE', 26, col.muted).setDepth(depth + 1);
    ui.text(this, W / 2, 420, Arcade.formatScore(this.score), 80).setDepth(depth + 1);
    ui.text(this, W / 2, 495, isNewBest ? 'New best!' : `Best: ${Arcade.formatScore(best)}`, 32,
      isNewBest ? col.accent : col.muted).setDepth(depth + 1);
    ui.text(this, W / 2, 550, line, 22, col.muted, { bold: false, wrap: 500 }).setDepth(depth + 1);

    ui.button(this, W / 2, 640, 400, 90, 'Restart',
      () => this.scene.restart({ mode: this.mode, difficulty: this.difficultyId }), { fontSize: 40 }).setDepth(depth + 2);
    const copy = ui.button(this, W / 2, 740, 400, 76, 'Copy result', async () => {
      const ok = await Arcade.copyText(line);
      copy.setLabel(ok ? 'Copied' : "Couldn't copy");
      this.time.delayedCall(1500, () => copy.setLabel('Copy result'));
    }, { kind: 'toggle', fontSize: 32 }).setDepth(depth + 2);
    ui.button(this, W / 2, 828, 400, 64, 'Menu', () => this.scene.start('EmoteJarStart'),
      { kind: 'secondary', fontSize: 28 }).setDepth(depth + 2);
  }
}

Arcade.registerGame(
  { id: CONFIG.id, title: CONFIG.title, blurb: 'Drop emotes. Match two to merge them.', startScene: 'EmoteJarStart' },
  [EmoteJarStart, EmoteJarPlay],
);
