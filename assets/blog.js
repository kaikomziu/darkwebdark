/* ひだまり日記：写真（キャンバス描画）と共通処理 */
(function () {
  'use strict';
  var B = (window.BLOG = {});

  // 既読の最大記事番号を更新
  B.markRead = function (n) {
    var r = DWD.get('read') || 0;
    if (n > r) DWD.set('read', n);
  };

  // 記事の写真を描く
  B.photo = function (canvas, kind) {
    var w = (canvas.width = 800),
      h = (canvas.height = 600);
    var c = canvas.getContext('2d');
    var f = PHOTOS[kind];
    if (f) f(c, w, h);
    // ほんのりフィルム感
    for (var i = 0; i < 2500; i++) {
      c.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '0,0,0' : '255,255,255') + ',' + Math.random() * 0.06 + ')';
      c.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    var v = c.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.9);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,.35)');
    c.fillStyle = v;
    c.fillRect(0, 0, w, h);
  };

  function blackCat(c, x, y, s, eyeColor) {
    c.fillStyle = '#1b1715';
    c.beginPath();
    c.ellipse(x, y + s * 0.55, s * 0.95, s * 0.6, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.arc(x, y, s * 0.5, 0, Math.PI * 2);
    c.fill();
    [-1, 1].forEach(function (d) {
      c.beginPath();
      c.moveTo(x + d * s * 0.45, y - s * 0.1);
      c.lineTo(x + d * s * 0.38, y - s * 0.68);
      c.lineTo(x + d * s * 0.08, y - s * 0.42);
      c.fill();
      c.fillStyle = eyeColor || '#e6d34a';
      c.beginPath();
      c.ellipse(x + d * s * 0.2, y - s * 0.02, s * 0.1, s * 0.12, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#000';
      c.fillRect(x + d * s * 0.2 - s * 0.018, y - s * 0.12, s * 0.036, s * 0.2);
      c.fillStyle = '#1b1715';
    });
    // しっぽ
    c.strokeStyle = '#1b1715';
    c.lineWidth = s * 0.14;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x + s * 0.8, y + s * 0.8);
    c.quadraticCurveTo(x + s * 1.5, y + s * 0.6, x + s * 1.3, y - s * 0.1);
    c.stroke();
  }

  var PHOTOS = {
    // 新しい部屋
    room: function (c, w, h) {
      c.fillStyle = '#efe4d0';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#c9a77c';
      c.fillRect(0, h * 0.68, w, h * 0.32);
      for (var i = 0; i < 9; i++) {
        c.fillStyle = 'rgba(120,80,40,.15)';
        c.fillRect(0, h * 0.68 + i * 22, w, 2);
      }
      // 窓
      c.fillStyle = '#fff';
      c.fillRect(w * 0.52, h * 0.12, w * 0.36, h * 0.42);
      var g = c.createLinearGradient(0, h * 0.12, 0, h * 0.54);
      g.addColorStop(0, '#a9d6f5');
      g.addColorStop(1, '#e8f6ff');
      c.fillStyle = g;
      c.fillRect(w * 0.54, h * 0.14, w * 0.15, h * 0.38);
      c.fillRect(w * 0.71, h * 0.14, w * 0.15, h * 0.38);
      // ひだまり
      c.fillStyle = 'rgba(255,230,160,.45)';
      c.beginPath();
      c.moveTo(w * 0.52, h * 0.7);
      c.lineTo(w * 0.88, h * 0.7);
      c.lineTo(w * 0.7, h);
      c.lineTo(w * 0.2, h);
      c.fill();
      // 段ボール
      [[0.08, 0.5, 0.22, 0.22], [0.14, 0.33, 0.17, 0.17], [0.32, 0.56, 0.16, 0.16]].forEach(function (b) {
        c.fillStyle = '#c8955c';
        c.fillRect(w * b[0], h * b[1], w * b[2], h * b[3]);
        c.fillStyle = '#e0b47e';
        c.fillRect(w * b[0], h * b[1] + h * b[3] * 0.42, w * b[2], h * 0.03);
      });
      // 隅の扉（となりの部屋側の壁）
      c.fillStyle = '#d9cbb2';
      c.fillRect(w * 0.02, h * 0.06, w * 0.03, h * 0.62);
    },
    // カフェラテ
    latte: function (c, w, h) {
      c.fillStyle = '#b98b5e';
      c.fillRect(0, 0, w, h);
      for (var i = 0; i < 14; i++) {
        c.fillStyle = 'rgba(80,50,20,.12)';
        c.fillRect(0, i * 46, w, 3);
      }
      c.fillStyle = '#fff';
      c.beginPath();
      c.ellipse(w * 0.62, h * 0.82, w * 0.3, h * 0.08, 0, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.arc(w * 0.5, h * 0.48, h * 0.34, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#9b6237';
      c.beginPath();
      c.arc(w * 0.5, h * 0.48, h * 0.28, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#f8ecd8';
      var x = w * 0.5,
        y = h * 0.5,
        s = h * 0.15;
      c.beginPath();
      c.moveTo(x, y + s * 0.9);
      c.bezierCurveTo(x - s * 1.6, y - s * 0.2, x - s * 0.6, y - s * 1.3, x, y - s * 0.4);
      c.bezierCurveTo(x + s * 0.6, y - s * 1.3, x + s * 1.6, y - s * 0.2, x, y + s * 0.9);
      c.fill();
      c.fillStyle = '#fff';
      c.beginPath();
      c.ellipse(w * 0.84, h * 0.48, w * 0.05, h * 0.08, 0, 0, Math.PI * 2);
      c.lineWidth = 18;
      c.strokeStyle = '#fff';
      c.stroke();
    },
    // クロ
    cat: function (c, w, h) {
      c.fillStyle = '#f4e9d8';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#f2b8a8';
      c.beginPath();
      c.ellipse(w * 0.5, h * 0.8, w * 0.38, h * 0.16, 0, 0, Math.PI * 2);
      c.fill();
      blackCat(c, w * 0.46, h * 0.48, h * 0.24);
    },
    // 夜の壁（クロが見つめている）
    night: function (c, w, h) {
      c.fillStyle = '#1d2230';
      c.fillRect(0, 0, w, h);
      var g = c.createRadialGradient(w * 0.3, h * 0.9, 10, w * 0.3, h * 0.9, w * 0.7);
      g.addColorStop(0, 'rgba(255,220,150,.25)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#272c3b';
      c.fillRect(w * 0.45, 0, w * 0.55, h * 0.75);
      // うっすら手形
      c.fillStyle = 'rgba(210,210,230,.07)';
      [[0.72, 0.3], [0.8, 0.42], [0.66, 0.5]].forEach(function (p) {
        c.beginPath();
        c.ellipse(w * p[0], h * p[1], 24, 30, 0, 0, Math.PI * 2);
        c.fill();
        for (var k = -2; k <= 2; k++) c.fillRect(w * p[0] + k * 10 - 3, h * p[1] - 70, 7, 42);
      });
      // 見つめるクロ（後ろ姿）
      c.fillStyle = '#0b0b0e';
      c.beginPath();
      c.ellipse(w * 0.3, h * 0.84, 70, 50, 0, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.arc(w * 0.33, h * 0.7, 40, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.moveTo(w * 0.33 - 30, h * 0.67);
      c.lineTo(w * 0.33 - 26, h * 0.6);
      c.lineTo(w * 0.33 - 6, h * 0.65);
      c.moveTo(w * 0.33 + 30, h * 0.67);
      c.lineTo(w * 0.33 + 26, h * 0.6);
      c.lineTo(w * 0.33 + 6, h * 0.65);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,.7)';
      c.font = '20px monospace';
      c.fillText('02:13', w - 90, h - 20);
    },
    // ドアのメモ
    note: function (c, w, h) {
      c.fillStyle = '#8c7a66';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#9d8a74';
      c.fillRect(w * 0.15, 0, w * 0.7, h);
      c.fillStyle = '#c8c0b0';
      c.beginPath();
      c.arc(w * 0.78, h * 0.55, 18, 0, Math.PI * 2);
      c.fill();
      c.save();
      c.translate(w * 0.45, h * 0.42);
      c.rotate(-0.06);
      c.fillStyle = '#f7ef9a';
      c.fillRect(-120, -100, 240, 220);
      c.fillStyle = '#5a1010';
      c.font = 'bold 30px serif';
      c.textAlign = 'center';
      c.fillText('ノックしたら', 0, -20);
      c.fillText('こたえて', 0, 30);
      c.font = '20px serif';
      c.fillText('２０３', 70, 100);
      c.restore();
    },
    // 空っぽのクッション
    empty: function (c, w, h) {
      c.fillStyle = '#d6cbbb';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#c99a8e';
      c.beginPath();
      c.ellipse(w * 0.5, h * 0.75, w * 0.38, h * 0.16, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(0,0,0,.08)';
      c.beginPath();
      c.ellipse(w * 0.5, h * 0.72, w * 0.2, h * 0.07, 0, 0, Math.PI * 2);
      c.fill();
      // 黒い毛が数本…と、爪あと
      c.strokeStyle = '#3a1410';
      c.lineWidth = 3;
      for (var i = 0; i < 4; i++) {
        c.beginPath();
        c.moveTo(w * 0.62 + i * 12, h * 0.2);
        c.lineTo(w * 0.6 + i * 12, h * 0.48);
        c.stroke();
      }
    },
    // 真っ暗（よく見ると顔）
    dark: function (c, w, h) {
      c.fillStyle = '#050505';
      c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(200,195,180,.10)';
      c.beginPath();
      c.ellipse(w * 0.66, h * 0.4, 46, 62, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#000';
      c.beginPath();
      c.ellipse(w * 0.66 - 15, h * 0.4 - 10, 9, 12, 0, 0, Math.PI * 2);
      c.ellipse(w * 0.66 + 15, h * 0.4 - 10, 9, 12, 0, 0, Math.PI * 2);
      c.ellipse(w * 0.66, h * 0.4 + 30, 7, 13, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,.5)';
      c.font = '20px monospace';
      c.fillText('10/31 03:03', w - 150, h - 20);
    }
  };

  // ページ内の [data-photo] をすべて描画
  document.addEventListener('DOMContentLoaded', function () {
    DWD.$$('canvas[data-photo]').forEach(function (cv) {
      B.photo(cv, cv.getAttribute('data-photo'));
    });
  });

  // 偽のコメント投稿（送信しても何も起きない…はず）
  B.fakeCommentForm = function (form, list, reply) {
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.querySelector('[name=n]').value.trim() || '名無し';
      var body = form.querySelector('[name=b]').value.trim();
      if (!body) return;
      var d = document.createElement('div');
      d.className = 'comment';
      d.innerHTML = '<span class="who"></span><span class="when">たった今</span><div class="body"></div>';
      d.querySelector('.who').textContent = name;
      d.querySelector('.body').textContent = body;
      list.appendChild(d);
      form.reset();
      DWD.set('name', DWD.get('name') || name);
      if (reply) setTimeout(function () { reply(list, name); }, 2500);
    });
  };
})();
