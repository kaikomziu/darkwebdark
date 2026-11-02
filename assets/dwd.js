/* =========================================================
 * DarkWebDark 共通エンジン
 * - セーブ（localStorage）
 * - 効果音（WebAudio で全て合成。外部音源ファイルなし）
 * - 驚かし（ジャンプスケア）演出
 * - グリッチ / 文字化け / 砂嵐 / 画面遷移
 * ========================================================= */
(function () {
  'use strict';

  // ---- バージョン情報（更新したら必ずここと CHANGELOG を更新する） ----
  var VERSION = '1.0.0';
  var UPDATED = '2026-11-02';

  var DWD = (window.DWD = { VERSION: VERSION, UPDATED: UPDATED });

  /* ---------------------------------------------------------
   * セーブデータ
   * ------------------------------------------------------- */
  var KEY = 'dwd_save_v1';
  var memory = {}; // localStorage が使えない環境用の保険

  DWD.load = function () {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : memory;
    } catch (e) {
      return memory;
    }
  };
  DWD.save = function (s) {
    memory = s;
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch (e) {}
  };
  DWD.get = function (k) {
    return DWD.load()[k];
  };
  DWD.set = function (k, v) {
    var s = DWD.load();
    s[k] = v;
    DWD.save(s);
  };
  DWD.inc = function (k) {
    var v = (DWD.get(k) || 0) + 1;
    DWD.set(k, v);
    return v;
  };
  DWD.reset = function () {
    memory = {};
    try {
      localStorage.removeItem(KEY);
    } catch (e) {}
  };

  /* ---------------------------------------------------------
   * ちょっとした道具
   * ------------------------------------------------------- */
  DWD.wait = function (ms) {
    return new Promise(function (r) {
      setTimeout(r, ms);
    });
  };
  DWD.rand = function (a, b) {
    return a + Math.random() * (b - a);
  };
  DWD.pick = function (arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  };
  DWD.$ = function (sel, root) {
    return (root || document).querySelector(sel);
  };
  DWD.$$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  // 見ている端末をそれっぽく判定（不気味演出用。外部送信は一切しない）
  DWD.device = function () {
    var ua = navigator.userAgent || '';
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/iPad/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document)) return 'iPad';
    if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'Androidのスマホ' : 'Androidのタブレット';
    if (/Windows/.test(ua)) return 'Windowsのパソコン';
    if (/Mac/.test(ua)) return 'Mac';
    if (/Linux/.test(ua)) return 'パソコン';
    return 'その画面';
  };
  DWD.timeStr = function () {
    var d = new Date();
    return d.getHours() + '時' + ('0' + d.getMinutes()).slice(-2) + '分';
  };
  DWD.isTouch = function () {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  };

  /* ---------------------------------------------------------
   * 効果音（すべて WebAudio で合成）
   * ------------------------------------------------------- */
  var ctx = null;
  var master = null;
  var noiseBuf = null;

  DWD.audio = function () {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        ctx = new AC();
      } catch (e) {
        return null;
      }
      master = ctx.createGain();
      master.gain.value = 0.85;
      // 音割れ防止のコンプレッサー
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -10;
      comp.ratio.value = 6;
      master.connect(comp);
      comp.connect(ctx.destination);
      // ノイズ用バッファ（2秒）
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  // 最初の操作で音を有効化（スマホ対策）
  ['pointerdown', 'touchstart', 'keydown', 'click'].forEach(function (ev) {
    window.addEventListener(
      ev,
      function () {
        DWD.audio();
      },
      { passive: true }
    );
  });

  function now() {
    return ctx.currentTime;
  }
  function noiseSrc(loop) {
    var s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = !!loop;
    return s;
  }
  function env(gainNode, t, a, peak, hold, rel) {
    var g = gainNode.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(peak, t + a);
    g.setValueAtTime(peak, t + a + hold);
    g.exponentialRampToValueAtTime(0.0001, t + a + hold + rel);
  }
  function distCurve(amount) {
    var n = 2048,
      c = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var x = (i * 2) / n - 1;
      c[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x));
    }
    return c;
  }

  var SFX = (DWD.sfx = {});

  // 絶叫（ジャンプスケア用）
  SFX.scream = function (dur) {
    if (!DWD.audio()) return;
    dur = dur || 1.3;
    var t = now();
    var out = ctx.createGain();
    var shaper = ctx.createWaveShaper();
    shaper.curve = distCurve(60);
    out.connect(shaper);
    shaper.connect(master);
    env(out, t, 0.01, 0.9, dur * 0.6, dur * 0.4);

    [520, 780, 1130, 1390].forEach(function (f, i) {
      var o = ctx.createOscillator();
      o.type = i % 2 ? 'sawtooth' : 'square';
      o.frequency.setValueAtTime(f * 0.6, t);
      o.frequency.exponentialRampToValueAtTime(f * 1.25, t + 0.12);
      o.frequency.exponentialRampToValueAtTime(f * 0.7, t + dur);
      // 震え
      var lfo = ctx.createOscillator();
      var lg = ctx.createGain();
      lfo.frequency.value = 9 + i * 3;
      lg.gain.value = f * 0.08;
      lfo.connect(lg);
      lg.connect(o.frequency);
      var g = ctx.createGain();
      g.gain.value = 0.22;
      o.connect(g);
      g.connect(out);
      o.start(t);
      lfo.start(t);
      o.stop(t + dur + 0.1);
      lfo.stop(t + dur + 0.1);
    });
    // 息のノイズ
    var n = noiseSrc(true);
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    bp.Q.value = 0.7;
    var ng = ctx.createGain();
    ng.gain.value = 0.7;
    n.connect(bp);
    bp.connect(ng);
    ng.connect(out);
    n.start(t);
    n.stop(t + dur + 0.1);
    SFX.boom(0.9);
  };

  // ドンッという低音
  SFX.boom = function (vol) {
    if (!DWD.audio()) return;
    var t = now();
    var o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 0.8);
    var g = ctx.createGain();
    env(g, t, 0.005, vol || 0.9, 0.05, 0.9);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + 1.2);
  };

  // 不協和音のスティンガー（ジャーン）
  SFX.stinger = function () {
    if (!DWD.audio()) return;
    var t = now();
    var g = ctx.createGain();
    env(g, t, 0.01, 0.35, 0.3, 1.6);
    g.connect(master);
    [233, 247, 349, 370, 494, 523].forEach(function (f) {
      var o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = DWD.rand(-25, 25);
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(5000, t);
      lp.frequency.exponentialRampToValueAtTime(400, t + 2);
      o.connect(lp);
      lp.connect(g);
      o.start(t);
      o.stop(t + 2.2);
    });
    SFX.boom(0.7);
  };

  // 砂嵐
  SFX.static = function (dur, vol) {
    if (!DWD.audio()) return;
    var t = now();
    dur = dur || 0.4;
    var n = noiseSrc(true);
    var hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 900;
    var g = ctx.createGain();
    env(g, t, 0.005, vol || 0.35, dur, 0.05);
    n.connect(hp);
    hp.connect(g);
    g.connect(master);
    n.start(t);
    n.stop(t + dur + 0.1);
  };

  // ピッ / ブツッ（グリッチ音）
  SFX.blip = function () {
    if (!DWD.audio()) return;
    var t = now();
    var o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(DWD.rand(80, 1800), t);
    o.frequency.setValueAtTime(DWD.rand(80, 1800), t + 0.03);
    var g = ctx.createGain();
    env(g, t, 0.002, 0.12, 0.04, 0.02);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + 0.1);
  };

  // コン、コン、コン（ノック）
  SFX.knock = function (times, gap) {
    if (!DWD.audio()) return;
    times = times || 3;
    gap = gap || 0.32;
    for (var i = 0; i < times; i++) {
      var t = now() + i * gap;
      var o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(60, t + 0.08);
      var g = ctx.createGain();
      env(g, t, 0.002, 0.8, 0.01, 0.12);
      var n = noiseSrc(false);
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      var ng = ctx.createGain();
      env(ng, t, 0.001, 0.4, 0.005, 0.05);
      n.connect(lp);
      lp.connect(ng);
      ng.connect(master);
      o.connect(g);
      g.connect(master);
      o.start(t);
      o.stop(t + 0.2);
      n.start(t);
      n.stop(t + 0.1);
    }
  };

  // ドクン…（心音）
  SFX.heartbeat = function (count, interval) {
    if (!DWD.audio()) return;
    count = count || 1;
    interval = interval || 0.9;
    for (var i = 0; i < count; i++) {
      [0, 0.22].forEach(function (off, j) {
        var t = now() + i * interval + off;
        var o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(70 - j * 15, t);
        o.frequency.exponentialRampToValueAtTime(35, t + 0.15);
        var g = ctx.createGain();
        env(g, t, 0.01, j ? 0.5 : 0.8, 0.02, 0.2);
        o.connect(g);
        g.connect(master);
        o.start(t);
        o.stop(t + 0.35);
      });
    }
  };

  // ささやき（フィルタしたノイズを揺らす）
  SFX.whisper = function (dur) {
    if (!DWD.audio()) return;
    dur = dur || 1.6;
    var t = now();
    var n = noiseSrc(true);
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 6;
    bp.frequency.setValueAtTime(1800, t);
    for (var i = 0; i < 10; i++) {
      bp.frequency.linearRampToValueAtTime(DWD.rand(900, 3800), t + (dur * (i + 1)) / 10);
    }
    var g = ctx.createGain();
    var am = ctx.createOscillator();
    var amg = ctx.createGain();
    am.frequency.value = 7;
    amg.gain.value = 0.25;
    am.connect(amg);
    amg.connect(g.gain);
    env(g, t, 0.3, 0.35, dur - 0.6, 0.3);
    var pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    n.connect(bp);
    bp.connect(g);
    if (pan) {
      pan.pan.setValueAtTime(-1, t);
      pan.pan.linearRampToValueAtTime(1, t + dur);
      g.connect(pan);
      pan.connect(master);
    } else g.connect(master);
    n.start(t);
    am.start(t);
    n.stop(t + dur + 0.1);
    am.stop(t + dur + 0.1);
  };

  // ガリガリ（ひっかき音）
  SFX.scratch = function (dur) {
    if (!DWD.audio()) return;
    dur = dur || 1;
    var t = now();
    var n = noiseSrc(true);
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 3;
    bp.frequency.value = 3000;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    for (var i = 0; i < dur * 12; i++) {
      g.gain.setValueAtTime(DWD.rand(0.05, 0.5), t + i / 12);
      g.gain.setValueAtTime(0.0, t + i / 12 + 0.04);
    }
    n.connect(bp);
    bp.connect(g);
    g.connect(master);
    n.start(t);
    n.stop(t + dur);
  };

  // はぁ…（息づかい）
  SFX.breath = function () {
    if (!DWD.audio()) return;
    var t = now();
    var n = noiseSrc(true);
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 700;
    bp.Q.value = 1.2;
    var g = ctx.createGain();
    env(g, t, 0.5, 0.5, 0.2, 0.9);
    n.connect(bp);
    bp.connect(g);
    g.connect(master);
    n.start(t);
    n.stop(t + 1.8);
  };

  // ブログ用のかわいい通知音
  SFX.chime = function () {
    if (!DWD.audio()) return;
    [880, 1318].forEach(function (f, i) {
      var t = now() + i * 0.12;
      var o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      var g = ctx.createGain();
      env(g, t, 0.01, 0.15, 0.05, 0.5);
      o.connect(g);
      g.connect(master);
      o.start(t);
      o.stop(t + 0.7);
    });
  };

  // 低いうなり（ループ）。戻り値の stop() で止める
  DWD.drone = function (level) {
    if (!DWD.audio()) return { stop: function () {}, set: function () {} };
    var t = now();
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level || 0.18, t + 3);
    g.connect(master);
    var nodes = [];
    [41.2, 43.1, 82.4, 87.3].forEach(function (f, i) {
      var o = ctx.createOscillator();
      o.type = i < 2 ? 'sawtooth' : 'sine';
      o.frequency.value = f;
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 220;
      var og = ctx.createGain();
      og.gain.value = i < 2 ? 0.5 : 0.25;
      o.connect(lp);
      lp.connect(og);
      og.connect(g);
      o.start(t);
      nodes.push(o);
    });
    var n = noiseSrc(true);
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 300;
    bp.Q.value = 0.5;
    var ng = ctx.createGain();
    ng.gain.value = 0.25;
    var lfo = ctx.createOscillator();
    var lg = ctx.createGain();
    lfo.frequency.value = 0.13;
    lg.gain.value = 0.2;
    lfo.connect(lg);
    lg.connect(ng.gain);
    n.connect(bp);
    bp.connect(ng);
    ng.connect(g);
    n.start(t);
    lfo.start(t);
    nodes.push(n, lfo);
    return {
      set: function (v) {
        g.gain.linearRampToValueAtTime(Math.max(0.0001, v), now() + 0.5);
      },
      stop: function () {
        var tt = now();
        g.gain.cancelScheduledValues(tt);
        g.gain.setValueAtTime(g.gain.value, tt);
        g.gain.exponentialRampToValueAtTime(0.0001, tt + 1);
        nodes.forEach(function (o) {
          try {
            o.stop(tt + 1.1);
          } catch (e) {}
        });
      }
    };
  };

  DWD.vibrate = function (pattern) {
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch (e) {}
  };

  /* ---------------------------------------------------------
   * 共通CSS（驚かし演出用）を注入
   * ------------------------------------------------------- */
  var css =
    '.dwd-scare{position:fixed;inset:0;z-index:99999;background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden;cursor:none;touch-action:none}' +
    '.dwd-scare canvas{width:100vw;height:100vh;display:block;animation:dwdZoom .09s ease-out forwards, dwdShake .07s linear infinite .09s}' +
    '.dwd-scare.text{flex-direction:column;background:#0a0000}' +
    '.dwd-scare.text b{font:900 min(26vw,30vh)/1 "Hiragino Mincho ProN","Yu Mincho",serif;color:#f10;text-shadow:0 0 30px #f00,6px 0 #0ff,-6px 0 #f0f;animation:dwdZoom .08s ease-out forwards, dwdShake .06s linear infinite;writing-mode:horizontal-tb;text-align:center;padding:0 4vw;word-break:keep-all}' +
    '.dwd-scare .flash{position:absolute;inset:0;background:#fff;animation:dwdFlash .25s steps(2) forwards;pointer-events:none}' +
    '@keyframes dwdZoom{from{transform:scale(.35);filter:contrast(3) brightness(2)}to{transform:scale(1.12);filter:contrast(1.3)}}' +
    '@keyframes dwdShake{0%{translate:0 0}25%{translate:-14px 9px}50%{translate:12px -11px}75%{translate:-8px -6px}100%{translate:9px 12px}}' +
    '@keyframes dwdFlash{0%{opacity:1}50%{opacity:0}75%{opacity:.8}100%{opacity:0}}' +
    '.dwd-sub{position:fixed;inset:0;z-index:99998;pointer-events:none;mix-blend-mode:normal}' +
    '.dwd-sub canvas{width:100%;height:100%;display:block}' +
    '.dwd-glitch{animation:dwdGlitch .25s steps(3) infinite}' +
    '@keyframes dwdGlitch{0%{transform:translate(0);filter:none}33%{transform:translate(-4px,2px) skewX(8deg);filter:hue-rotate(90deg) saturate(4)}66%{transform:translate(5px,-3px) skewX(-6deg);filter:invert(1)}100%{transform:translate(0)}}' +
    '.dwd-shake{animation:dwdShake .08s linear infinite}' +
    '.dwd-tv{position:fixed;inset:0;z-index:99990;background:#000;display:flex;align-items:center;justify-content:center}' +
    '.dwd-tv canvas{width:100%;height:100%;image-rendering:pixelated;display:block}' +
    '.dwd-gate{position:fixed;inset:0;z-index:99995;background:#000;color:#bbb;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;text-align:center;padding:24px;font-family:"Courier New",monospace}' +
    '.dwd-gate .g-title{font-size:clamp(14px,4vw,18px);letter-spacing:.3em;color:#888}' +
    '.dwd-gate button{background:none;border:1px solid #a00;color:#e22;padding:16px 38px;font:inherit;font-size:18px;letter-spacing:.4em;cursor:pointer;min-width:200px;animation:dwdPulse 2s ease-in-out infinite}' +
    '.dwd-gate .g-warn{font-size:12px;color:#555;line-height:1.8}' +
    '@keyframes dwdPulse{0%,100%{box-shadow:0 0 0 #f000}50%{box-shadow:0 0 24px #f004}}' +
    '.dwd-ver{font:11px/1.6 "Courier New",monospace;opacity:.55;text-align:center;padding:14px 8px}';
  var st = document.createElement('style');
  st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  /* ---------------------------------------------------------
   * 絵（キャンバスで手描き風に生成）
   * ------------------------------------------------------- */
  function sizeCanvas(cv) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = window.innerWidth,
      h = window.innerHeight;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    return { w: cv.width, h: cv.height };
  }

  // こわい顔
  function drawFace(c, w, h, opt) {
    opt = opt || {};
    c.fillStyle = '#000';
    c.fillRect(0, 0, w, h);
    var cx = w / 2,
      cy = h / 2 + h * 0.03;
    var r = Math.min(w * 0.62, h * 0.48);
    // 赤い滲み
    var bg = c.createRadialGradient(cx, cy, r * 0.2, cx, cy, Math.max(w, h) * 0.7);
    bg.addColorStop(0, '#300');
    bg.addColorStop(1, '#000');
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);

    // 顔
    c.save();
    c.translate(cx, cy);
    c.rotate(DWD.rand(-0.08, 0.08));
    var fg = c.createRadialGradient(0, -r * 0.1, r * 0.1, 0, 0, r * 1.05);
    fg.addColorStop(0, '#e9e4d8');
    fg.addColorStop(0.55, '#a8a293');
    fg.addColorStop(0.85, '#3d3a33');
    fg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = fg;
    c.beginPath();
    c.ellipse(0, 0, r * 0.74, r * 1.02, 0, 0, Math.PI * 2);
    c.fill();

    // 汚れ・ひび
    for (var i = 0; i < 700; i++) {
      c.fillStyle = 'rgba(0,0,0,' + DWD.rand(0.03, 0.18) + ')';
      var a = Math.random() * Math.PI * 2,
        rr = Math.random() * r * 0.8;
      c.fillRect(Math.cos(a) * rr * 0.9, Math.sin(a) * rr, DWD.rand(1, r * 0.03), DWD.rand(1, r * 0.03));
    }
    c.strokeStyle = 'rgba(30,0,0,.55)';
    for (i = 0; i < 9; i++) {
      c.lineWidth = DWD.rand(1, r * 0.008);
      c.beginPath();
      var x = DWD.rand(-r * 0.5, r * 0.5),
        y = DWD.rand(-r * 0.8, r * 0.2);
      c.moveTo(x, y);
      for (var k = 0; k < 6; k++) {
        x += DWD.rand(-r * 0.08, r * 0.08);
        y += DWD.rand(0, r * 0.1);
        c.lineTo(x, y);
      }
      c.stroke();
    }

    // 目（真っ黒な穴）
    [-1, 1].forEach(function (s) {
      var ex = s * r * 0.29,
        ey = -r * 0.17;
      var eg = c.createRadialGradient(ex, ey, 0, ex, ey, r * 0.27);
      eg.addColorStop(0, '#000');
      eg.addColorStop(0.6, '#000');
      eg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = eg;
      c.beginPath();
      c.ellipse(ex, ey, r * 0.2, r * 0.25, s * 0.25, 0, Math.PI * 2);
      c.fill();
      // 黒い涙
      c.fillStyle = '#000';
      for (var t = 0; t < 3; t++) {
        var tx = ex + DWD.rand(-r * 0.1, r * 0.1);
        var tl = DWD.rand(r * 0.25, r * 0.8);
        var tw = DWD.rand(r * 0.012, r * 0.035);
        c.fillRect(tx, ey + r * 0.1, tw, tl);
        c.beginPath();
        c.arc(tx + tw / 2, ey + r * 0.1 + tl, tw * 0.9, 0, Math.PI * 2);
        c.fill();
      }
      // 小さく光る瞳
      if (!opt.noPupil) {
        c.fillStyle = '#fff';
        c.shadowColor = '#f00';
        c.shadowBlur = r * 0.06;
        c.beginPath();
        c.arc(ex + s * r * 0.02, ey + r * 0.02, r * 0.018, 0, Math.PI * 2);
        c.fill();
        c.shadowBlur = 0;
      }
    });

    // 口（縦に裂けた穴）
    var my = r * 0.47;
    var mg = c.createRadialGradient(0, my, 0, 0, my, r * 0.4);
    mg.addColorStop(0, '#000');
    mg.addColorStop(0.7, '#100');
    mg.addColorStop(1, 'rgba(40,0,0,0)');
    c.fillStyle = mg;
    c.beginPath();
    c.ellipse(0, my, r * 0.22, r * 0.36, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#000';
    c.beginPath();
    c.ellipse(0, my, r * 0.16, r * 0.3, 0, 0, Math.PI * 2);
    c.fill();
    // 歯
    c.fillStyle = '#d8d0b8';
    for (i = 0; i < 16; i++) {
      var ang = (i / 16) * Math.PI * 2;
      var px = Math.cos(ang) * r * 0.16,
        py = my + Math.sin(ang) * r * 0.3;
      c.beginPath();
      c.moveTo(px - r * 0.015, py);
      c.lineTo(px + r * 0.015, py);
      c.lineTo(px * 0.75, my + (py - my) * 0.75);
      c.closePath();
      c.fill();
    }
    c.restore();

    // 走査線
    c.fillStyle = 'rgba(0,0,0,.25)';
    for (var yy = 0; yy < h; yy += 4) c.fillRect(0, yy, w, 2);
    // 赤チャンネルずらし
    try {
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.25;
      c.drawImage(c.canvas, w * 0.012, 0);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    } catch (e) {}
  }

  // 巨大な目
  function drawEye(c, w, h) {
    c.fillStyle = '#000';
    c.fillRect(0, 0, w, h);
    var cx = w / 2,
      cy = h / 2,
      r = Math.min(w * 0.48, h * 0.42);
    c.save();
    c.translate(cx, cy);
    // 白目
    c.beginPath();
    c.moveTo(-r * 1.4, 0);
    c.quadraticCurveTo(0, -r * 1.25, r * 1.4, 0);
    c.quadraticCurveTo(0, r * 1.25, -r * 1.4, 0);
    c.closePath();
    var sg = c.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 1.4);
    sg.addColorStop(0, '#f2eee0');
    sg.addColorStop(0.7, '#c9b9a0');
    sg.addColorStop(1, '#5a1a10');
    c.fillStyle = sg;
    c.fill();
    c.save();
    c.clip();
    // 血管
    c.strokeStyle = 'rgba(170,0,0,.75)';
    for (var i = 0; i < 40; i++) {
      c.lineWidth = DWD.rand(0.5, r * 0.012);
      var a = Math.random() * Math.PI * 2;
      var x = Math.cos(a) * r * 1.4,
        y = Math.sin(a) * r * 0.9;
      c.beginPath();
      c.moveTo(x, y);
      for (var k = 0; k < 7; k++) {
        x += (-x / 7) * DWD.rand(0.5, 1.2) + DWD.rand(-r * 0.05, r * 0.05);
        y += (-y / 7) * DWD.rand(0.5, 1.2) + DWD.rand(-r * 0.05, r * 0.05);
        c.lineTo(x, y);
      }
      c.stroke();
    }
    // 虹彩
    var ig = c.createRadialGradient(0, 0, r * 0.1, 0, 0, r * 0.55);
    ig.addColorStop(0, '#000');
    ig.addColorStop(0.3, '#2a0000');
    ig.addColorStop(0.75, '#7a0a0a');
    ig.addColorStop(1, '#100');
    c.fillStyle = ig;
    c.beginPath();
    c.arc(0, 0, r * 0.55, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,.4)';
    for (i = 0; i < 60; i++) {
      var aa = (i / 60) * Math.PI * 2;
      c.beginPath();
      c.moveTo(Math.cos(aa) * r * 0.2, Math.sin(aa) * r * 0.2);
      c.lineTo(Math.cos(aa) * r * 0.55, Math.sin(aa) * r * 0.55);
      c.stroke();
    }
    c.fillStyle = '#000';
    c.beginPath();
    c.arc(0, 0, r * 0.24, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,.8)';
    c.beginPath();
    c.arc(-r * 0.12, -r * 0.12, r * 0.05, 0, Math.PI * 2);
    c.fill();
    c.restore();
    c.restore();
    c.fillStyle = 'rgba(0,0,0,.22)';
    for (var yy = 0; yy < h; yy += 4) c.fillRect(0, yy, w, 2);
  }
  DWD.drawFace = drawFace;
  DWD.drawEye = drawEye;

  /* ---------------------------------------------------------
   * 驚かし本体
   * type: 'face' | 'eye' | 'text'
   * ------------------------------------------------------- */
  var scaring = false;
  DWD.isScaring = function () {
    return scaring;
  };
  DWD.scare = function (opt) {
    opt = opt || {};
    if (scaring) return Promise.resolve();
    scaring = true;
    DWD.inc('scares');
    var type = opt.type || 'face';
    var dur = opt.dur || 1100;
    var el = document.createElement('div');
    el.className = 'dwd-scare' + (type === 'text' ? ' text' : '');
    if (type === 'text') {
      var b = document.createElement('b');
      b.textContent = opt.text || 'みつけた';
      el.appendChild(b);
    } else {
      var cv = document.createElement('canvas');
      el.appendChild(cv);
      var sz = sizeCanvas(cv);
      var c = cv.getContext('2d');
      if (type === 'eye') drawEye(c, sz.w, sz.h);
      else drawFace(c, sz.w, sz.h, opt);
    }
    var fl = document.createElement('div');
    fl.className = 'flash';
    el.appendChild(fl);
    document.body.appendChild(el);
    if (opt.sound !== false) {
      SFX.scream(dur / 1000 + 0.2);
      if (type !== 'face') SFX.stinger();
    }
    DWD.vibrate([300, 60, 400]);
    return DWD.wait(dur).then(function () {
      el.remove();
      scaring = false;
    });
  };

  // 一瞬だけ顔が映る（サブリミナル）
  DWD.flash = function (ms) {
    if (scaring) return;
    var el = document.createElement('div');
    el.className = 'dwd-sub';
    var cv = document.createElement('canvas');
    el.appendChild(cv);
    var sz = sizeCanvas(cv);
    drawFace(cv.getContext('2d'), sz.w, sz.h, { noPupil: Math.random() < 0.5 });
    el.style.opacity = DWD.rand(0.35, 0.8);
    document.body.appendChild(el);
    SFX.static(0.12, 0.3);
    setTimeout(function () {
      el.remove();
    }, ms || 90);
  };

  /* ---------------------------------------------------------
   * 砂嵐で画面遷移
   * ------------------------------------------------------- */
  DWD.tv = function (ms) {
    var el = document.createElement('div');
    el.className = 'dwd-tv';
    var cv = document.createElement('canvas');
    cv.width = 160;
    cv.height = 100;
    el.appendChild(cv);
    document.body.appendChild(el);
    var c = cv.getContext('2d');
    var img = c.createImageData(160, 100);
    var alive = true;
    (function loop() {
      if (!alive) return;
      for (var i = 0; i < img.data.length; i += 4) {
        var v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      c.putImageData(img, 0, 0);
      requestAnimationFrame(loop);
    })();
    SFX.static((ms || 900) / 1000, 0.4);
    return {
      el: el,
      stop: function () {
        alive = false;
        el.remove();
      }
    };
  };
  DWD.go = function (url, ms) {
    ms = ms || 900;
    DWD.tv(ms + 400);
    setTimeout(function () {
      location.href = url;
    }, ms);
  };

  /* ---------------------------------------------------------
   * 文字化け・タイプライター
   * ------------------------------------------------------- */
  var JUNK = '▓▒░█■□呪死目見誰縺繧ｦｨ譁ｼ蟄縺ｮ・ゑ';
  DWD.corrupt = function (str, p) {
    var out = '';
    for (var i = 0; i < str.length; i++) {
      out += str[i] !== ' ' && str[i] !== '\n' && Math.random() < p ? JUNK[Math.floor(Math.random() * JUNK.length)] : str[i];
    }
    return out;
  };
  // 要素の文字を一時的に化けさせる
  DWD.glitchText = function (el, ms, p) {
    if (!el) return;
    var orig = el.getAttribute('data-orig') || el.textContent;
    el.setAttribute('data-orig', orig);
    var end = Date.now() + (ms || 500);
    (function loop() {
      if (Date.now() > end) {
        el.textContent = orig;
        return;
      }
      el.textContent = DWD.corrupt(orig, p || 0.4);
      setTimeout(loop, 50);
    })();
  };
  DWD.type = function (el, text, speed, sound) {
    return new Promise(function (res) {
      var i = 0;
      el.textContent = '';
      (function step() {
        if (i >= text.length) return res();
        el.textContent += text[i++];
        if (sound && i % 2 === 0) SFX.blip();
        setTimeout(step, speed || 70);
      })();
    });
  };

  /* ---------------------------------------------------------
   * 開始ゲート（音を鳴らすには一度タップが必要なため）
   * ------------------------------------------------------- */
  DWD.gate = function (opt) {
    opt = opt || {};
    return new Promise(function (res) {
      var el = document.createElement('div');
      el.className = 'dwd-gate';
      el.innerHTML =
        '<div class="g-title"></div><button type="button"></button><div class="g-warn"></div>';
      el.querySelector('.g-title').textContent = opt.title || '接続を続けますか';
      el.querySelector('button').textContent = opt.button || 'つづける';
      el.querySelector('.g-warn').innerHTML = opt.warn || '';
      document.body.appendChild(el);
      el.querySelector('button').addEventListener('click', function () {
        DWD.audio();
        SFX.static(0.25, 0.3);
        el.remove();
        res();
      });
    });
  };

  /* ---------------------------------------------------------
   * 環境演出：ランダムに起きる怪現象
   * ------------------------------------------------------- */
  DWD.haunt = function (opt) {
    opt = opt || {};
    var min = opt.min || 9000,
      max = opt.max || 22000;
    var bigDone = false;
    var stopped = false;
    function tick() {
      if (stopped) return;
      setTimeout(function () {
        if (stopped) return;
        if (scaring || (opt.paused && opt.paused())) return tick();
        var r = Math.random();
        if (!bigDone && opt.big !== false && r < (opt.bigChance || 0.18)) {
          bigDone = true;
          DWD.scare({ type: DWD.pick(['face', 'face', 'eye', 'text']), text: DWD.pick(['みてる', 'うしろ', 'みつけた']) });
        } else if (r < 0.45) {
          DWD.flash(DWD.rand(60, 120));
        } else if (r < 0.72 && opt.silent) {
          // 音が手がかりのページでは、まぎらわしい音は鳴らさない
          DWD.flash(DWD.rand(60, 120));
        } else if (r < 0.6) {
          SFX.whisper();
        } else if (r < 0.72) {
          SFX.knock(3);
        } else if (r < 0.85) {
          document.body.classList.add('dwd-glitch');
          SFX.blip();
          setTimeout(function () {
            document.body.classList.remove('dwd-glitch');
          }, 220);
        } else {
          var els = DWD.$$(opt.textSel || 'p,h1,h2,li');
          if (els.length) DWD.glitchText(DWD.pick(els), 600, 0.5);
          SFX.blip();
        }
        tick();
      }, DWD.rand(min, max));
    }
    tick();
    return {
      stop: function () {
        stopped = true;
      }
    };
  };

  // 背景の砂嵐（薄く）
  DWD.noiseBg = function (opacity) {
    var cv = document.createElement('canvas');
    cv.width = 120;
    cv.height = 80;
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;opacity:' +
      (opacity || 0.06) +
      ';image-rendering:pixelated;mix-blend-mode:screen';
    document.body.appendChild(cv);
    var c = cv.getContext('2d');
    var img = c.createImageData(120, 80);
    setInterval(function () {
      for (var i = 0; i < img.data.length; i += 4) {
        var v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      c.putImageData(img, 0, 0);
    }, 70);
    return cv;
  };

  // フッターにバージョンと更新日を表示
  DWD.footer = function (el, label) {
    if (!el) return;
    el.classList.add('dwd-ver');
    el.textContent = (label || 'DarkWebDark') + ' v' + VERSION + ' / 更新 ' + UPDATED;
  };

  document.addEventListener('DOMContentLoaded', function () {
    DWD.$$('[data-dwd-ver]').forEach(function (el) {
      DWD.footer(el, el.getAttribute('data-dwd-ver') || undefined);
    });
  });
})();
