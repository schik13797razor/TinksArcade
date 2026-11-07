// ambience.js: the background sound loop for each skin, made on the fly by the
// browser's audio engine (no files to load). Off until a player turns on
// "Background sound" in Settings, and it has its own volume slider there.
//
//   Tink          a crackling fireplace
//   Coffee Shop   café murmur, cup clinks and now and then the milk steamer
//   Fine Dining   a quiet restaurant: low murmur and the odd glass or fork
//
// To use a recording instead, put a looping file named ambient.mp3 in
// assets/skins/<skin>/ (keep it short, under 1 MB, and make sure the end joins the start
// smoothly). The player in arcade.js (Arcade.ambience) starts and stops these loops.
//
// Each recipe gets the audio engine (ctx) and an output to connect to, and returns
//   tick(now): called ten times a second, to schedule the next little sounds
//   stop():    stops everything it started

(() => {
  // ---------- Building blocks ----------
  // Two seconds of noise, made once and looped. 'white' is hiss; 'brown' is a deep rumble;
  // 'pink' sits in between and sounds like a room full of voices once it's filtered.
  const buffers = {};
  function noise(ctx, kind) {
    const key = kind + ctx.sampleRate;
    if (buffers[key]) return buffers[key];
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      if (kind === 'brown') {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      } else if (kind === 'pink') {
        b0 = 0.99765 * b0 + white * 0.099046;
        b1 = 0.963 * b1 + white * 0.2965164;
        b2 = 0.57 * b2 + white * 1.0526913;
        data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.2;
      } else {
        data[i] = white;
      }
    }
    buffers[key] = buffer;
    return buffer;
  }

  // A noise loop through a filter, at a set level. Returns its nodes so they can be stopped.
  function bed(ctx, out, kind, filterType, freq, q, level) {
    const src = ctx.createBufferSource();
    src.buffer = noise(ctx, kind);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = level;
    src.connect(filter).connect(gain).connect(out);
    src.start();
    return { src, filter, gain };
  }

  // A slow wobble on a setting (a filter's pitch, a level), so the bed doesn't sound frozen.
  function wobble(ctx, param, rate, depth) {
    const osc = ctx.createOscillator();
    osc.frequency.value = rate;
    const amount = ctx.createGain();
    amount.gain.value = depth;
    osc.connect(amount).connect(param);
    osc.start();
    return osc;
  }

  // A short burst of filtered noise: a crackle, a scrape or a hiss.
  function burst(ctx, out, at, { filterType = 'highpass', freq = 2000, length = 0.02, level = 0.2 }) {
    const src = ctx.createBufferSource();
    src.buffer = noise(ctx, 'white');
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(level, at + Math.min(0.004, length / 4));
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    src.connect(filter).connect(gain).connect(out);
    src.loop = length > 0.4; // long hisses outlast the two-second noise
    src.start(at, Math.random() * 1.5);
    src.stop(at + length + 0.05);
  }

  // A small bright ring: cups, glasses and cutlery.
  function ting(ctx, out, at, freq, length, level) {
    for (const [mul, share] of [[1, 1], [2.76, 0.5], [5.4, 0.25]]) {
      const osc = ctx.createOscillator();
      osc.frequency.value = freq * mul;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(level * share, at + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + length / mul);
      osc.connect(gain).connect(out);
      osc.start(at);
      osc.stop(at + length + 0.05);
    }
  }

  const between = (min, max) => min + Math.random() * (max - min);

  function stopAll(nodes) {
    for (const n of nodes) {
      try { n.stop(); } catch (e) { /* already stopped */ }
    }
  }

  // ---------- Tink: a crackling fireplace ----------
  function fireplace(ctx, out) {
    const roar = bed(ctx, out, 'brown', 'lowpass', 420, 0.5, 0.55);
    const flicker = wobble(ctx, roar.gain.gain, 0.23, 0.15);
    let nextCrackle = ctx.currentTime + 0.3;
    return {
      tick(now) {
        // Crackles come in little clusters, with quiet gaps between.
        while (nextCrackle < now + 0.2) {
          const big = Math.random() < 0.12;
          burst(ctx, out, nextCrackle, {
            freq: big ? 900 : between(1500, 3500),
            length: big ? between(0.03, 0.06) : between(0.006, 0.02),
            level: big ? between(0.25, 0.4) : between(0.05, 0.2),
          });
          nextCrackle += Math.random() < 0.7 ? between(0.03, 0.15) : between(0.4, 1.4);
        }
      },
      stop() { stopAll([roar.src, flicker]); },
    };
  }

  // ---------- Coffee Shop: café murmur, clinks, the milk steamer ----------
  function cafe(ctx, out) {
    const voices = bed(ctx, out, 'pink', 'bandpass', 600, 0.8, 0.5);
    const chatter = bed(ctx, out, 'pink', 'bandpass', 1300, 1.4, 0.12);
    const drift = [
      wobble(ctx, voices.filter.frequency, 0.31, 120),
      wobble(ctx, voices.gain.gain, 0.17, 0.12),
      wobble(ctx, chatter.gain.gain, 0.43, 0.05),
    ];
    let nextClink = ctx.currentTime + between(1, 3);
    let nextSteam = ctx.currentTime + between(12, 25);
    return {
      tick(now) {
        while (nextClink < now + 0.2) {
          ting(ctx, out, nextClink, between(1800, 2600), 0.35, 0.035);
          if (Math.random() < 0.35) ting(ctx, out, nextClink + between(0.08, 0.16), between(1800, 2600), 0.3, 0.025);
          nextClink += between(2, 6);
        }
        while (nextSteam < now + 0.2) {
          burst(ctx, out, nextSteam, { filterType: 'bandpass', freq: 4500, length: between(1.5, 2.5), level: 0.035 });
          nextSteam += between(20, 40);
        }
      },
      stop() { stopAll([voices.src, chatter.src, ...drift]); },
    };
  }

  // ---------- Fine Dining: a quiet restaurant ----------
  function restaurant(ctx, out) {
    const voices = bed(ctx, out, 'pink', 'bandpass', 380, 0.6, 0.38);
    const drift = [
      wobble(ctx, voices.filter.frequency, 0.13, 60),
      wobble(ctx, voices.gain.gain, 0.09, 0.08),
    ];
    let nextGlass = ctx.currentTime + between(2, 5);
    let nextFork = ctx.currentTime + between(4, 8);
    return {
      tick(now) {
        while (nextGlass < now + 0.2) {
          ting(ctx, out, nextGlass, between(2800, 3600), 0.7, 0.022);
          nextGlass += between(5, 12);
        }
        while (nextFork < now + 0.2) {
          burst(ctx, out, nextFork, { freq: 5000, length: 0.015, level: 0.04 });
          ting(ctx, out, nextFork + 0.01, between(4200, 5200), 0.12, 0.01);
          nextFork += between(4, 10);
        }
      },
      stop() { stopAll([voices.src, ...drift]); },
    };
  }

  Arcade.ambience.register('tink', fireplace);
  Arcade.ambience.register('coffee-shop', cafe);
  Arcade.ambience.register('fine-dining', restaurant);
})();
