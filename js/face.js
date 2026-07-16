/* ============================================================
 * Turkocam — obličej ve stylu Doom HUD, pixel-art edice.
 * Stavový automat grimas + pixelový sprite skládaný z mřížky
 * a výměnných záplat (oči / obočí / ústa) podle výrazu.
 * Modul je nezávislý na pohledu hry (panel i zpětné zrcátko).
 * Vlastní PNG v assets/face/<stav>.png mají stále přednost.
 * ============================================================ */
(function () {
  "use strict";

  /* ---------------------- stavový automat ---------------------- */

  var PRIORITY = { ko: 100, pain: 80, panic: 70, kill: 50, redlight: 40, rage: 30 };
  var EXPR = { ko: "ko", pain: "pain", panic: "panic", kill: "grin", redlight: "wink", rage: "rage" };
  var DURATION = { ko: Infinity, pain: 0.7, panic: 1.6, kill: 0.9, redlight: 0.9, rage: 0.8 };

  var SPRITE_KEYS = ["neutral", "grin", "wink", "rage", "pain", "panic", "ko", "sunglasses"];
  var SPRITES = { tried: false, imgs: {} };

  function tryLoadSprites() {
    if (SPRITES.tried || typeof Image === "undefined") return;
    SPRITES.tried = true;
    SPRITE_KEYS.forEach(function (k) {
      var im = new Image();
      im.onload = function () { SPRITES.imgs[k] = im; };
      im.src = "assets/face/" + k + ".png";
    });
  }

  function FaceCam() {
    this.reset();
    tryLoadSprites();
  }

  FaceCam.prototype.reset = function () {
    this.expr = "neutral";
    this.exprUntil = 0;
    this.exprPrio = 0;
    this.t = 0;
    this.blinkAt = 2 + Math.random() * 2;
    this.blinking = 0;
    this.healthTier = 0;
    this.sunglasses = false;
  };

  FaceCam.prototype.trigger = function (event) {
    var prio = PRIORITY[event] || 0;
    var active = this.t < this.exprUntil;
    if (!active || prio >= this.exprPrio) {
      this.expr = EXPR[event] || "neutral";
      this.exprPrio = prio;
      this.exprUntil = this.t + (DURATION[event] || 0.8);
    }
  };

  FaceCam.prototype.update = function (dt, state) {
    this.t += dt;
    this.healthTier = state.health > 66 ? 0 : state.health > 33 ? 1 : 2;
    this.sunglasses = !!state.sunglasses;

    if (this.t >= this.exprUntil && this.expr !== "ko") {
      this.expr = "neutral";
      this.exprPrio = 0;
    }
    if (this.expr === "neutral") {
      if (this.blinking > 0) {
        this.blinking -= dt;
      } else if (this.t > this.blinkAt) {
        this.blinking = 0.14;
        this.blinkAt = this.t + 2 + Math.random() * 2.5;
      }
    } else {
      this.blinking = 0;
    }
  };

  /* ------------------------- pixel art ------------------------- */

  var GW = 36, GH = 42;   // mřížka spritu

  // palety: základ, vztek (rudá), potlučený (tier 2)
  var PALETTES = {
    base: {
      H: "#d9a441", h: "#a87b2c", L: "#edc76f",
      S: "#ecb489", s: "#cf9464", w: "#f6cf9f",
      E: "#f2f2f2", I: "#4f7d9e", B: "#8a6430",
      k: "#3a2e20", M: "#7c3428", T: "#ffffff",
      N: "#243250", n: "#172138", C: "#eef0f2", P: "#e07a8a"
    }
  };
  PALETTES.rage = Object.assign({}, PALETTES.base, {
    S: "#e0573c", s: "#bc3e28", w: "#ef8461"
  });
  PALETTES.tier2 = Object.assign({}, PALETTES.base, {
    S: "#d9a173", s: "#b97f52", w: "#e6b98d"
  });

  // základ hlavy: vlasy, tvář, uši, nos, krk, sako (bez očí/obočí/úst)
  var BASE = [
    "...........LHHHHHHHHh..............",
    ".........LLHHHHHHHHHHHh............",
    "........LHHHHhHHHHHHHHHHh..........",
    ".......LHHHhHHHHHhHHHHHHHHh........",
    "......LHHHhHHHHhHHHHHhHHHHHHh......",
    "......HHHhHHHHhHHHHHhHHHHHHHHh.....",
    ".....hHHhHHHHhHHHHHhHHHHHhHHHHh....",
    ".....hHHhHHHhHHHHHhHHHHHhHHHHHh....",
    ".....hHhHHHHhHHHHHHHHHhHHHHHHHh....",
    ".....HhHHHHHHHHHHHHHHHHHHHHHHHh....",
    ".....HHHHHHHHHHHHHHHHHHHHHHHHHh....",
    ".....HHSSSSSSSSSSSSSSSSSSSSSHHh....",
    ".....HSwSSSSSSSSSSSSSSSSSSSsSHh....",
    ".....HSwwSSSSSSSSSSSSSSSSSSssHh....",
    "....hHSwSSSSSSSSSSSSSSSSSSSssHh....",
    "....hHSSSSSSSSSSSSSSSSSSSSSSsHh....",
    "...sShSSSSSSSSSSSSSSSSSSSSSSshSs...",
    "...sShSSSSSSSSSSSSSSSSSSSSSSshSs...",
    "...sShSSSSSSSSSSSSSSSSSSSSSSshSs...",
    "....ssSSSSSSSSSwSsSSSSSSSSSSsss....",
    "....ssSSSSSSSSSwSsSSSSSSSSSSsss....",
    ".....sSSSSSSSSSwSsSSSSSSSSSSs......",
    ".....sSSsSSSSSSwSsSSSSSSsSSSs......",
    ".....sSSsSSSSSSwSssSSSSSsSSSs......",
    ".....sSSsSSSSSkssskSSSSSsSSSs......",
    ".....sSSSsSSSSSSSSSSSSSsSSSSs......",
    ".....sSSSsSSSSSSSSSSSSSsSSSSs......",
    ".....sSSSSSSSSSSSSSSSSSSSSSSs......",
    ".....sSSSSSSSSSSSSSSSSSSSSSSs......",
    ".....sSSSSSSSSSSSSSSSSSSSSSSs......",
    "......sSSSSSSSSSSSSSSSSSSSSs.......",
    "......sSSSSSSSSssssSSSSSSSSs.......",
    ".......sSSSSSSSSSSSSSSSSSSs........",
    ".......ssSSSSSSSSSSSSSSSSss........",
    "........sssSSSSSSSSSSSSsss.........",
    "..........ssSSSSSSSSSSss...........",
    "..........sSSSSSSSSSSSSs...........",
    "....NN....sSSSSSSSSSSSSs....NN.....",
    "..NNNNNN..sSSSSSSSSSSSSs..NNNNNN...",
    ".NNNNNNNNNnSSSSSSSSSSSSnNNNNNNNN...",
    "NNNNNNNNNNNnCCSSSSSSCCnNNNNNNNNNN..",
    "NNNNNNNNNNNNnCCCCCCCCnNNNNNNNNNNNN."
  ];

  // záplaty výrazů (kreslí se přes základ, '.' = beze změny)
  var PATCH = {
    browsFlat:   { x: 9,  y: 14, rows: ["BBBBBB.....BBBBBB"] },
    browsRaised: { x: 9,  y: 13, rows: ["BBBBBB.....BBBBBB"] },
    browsRage:   { x: 8,  y: 12, rows: [
      "Bk...............kB",
      ".BBk...........kBB.",
      "...BBk.......kBB...",
      ".....Bk.....kB....."
    ] },
    browsPain:   { x: 9,  y: 13, rows: [
      "..kBBB.....BBBk..",
      "kBB...........BBk"
    ] },
    eyesOpen:    { x: 10, y: 16, rows: [
      "kEEEEk...kEEEEk",
      "kEIIEk...kEIIEk"
    ] },
    eyesClosed:  { x: 10, y: 17, rows: ["kkkkkk...kkkkkk"] },
    eyesNarrow:  { x: 10, y: 17, rows: ["kEIIEk...kEIIEk"] },
    eyesWide:    { x: 10, y: 15, rows: [
      "kEEEEk...kEEEEk",
      "kEIIEk...kEIIEk",
      "kEEEEk...kEEEEk"
    ] },
    eyesSqueeze: { x: 10, y: 16, rows: [
      "kk..kk...kk..kk",
      "..kk.......kk.."
    ] },
    eyesX:       { x: 10, y: 15, rows: [
      "k...k.....k...k",
      ".k.k.......k.k.",
      "..k.........k..",
      ".k.k.......k.k.",
      "k...k.....k...k"
    ] },
    winkEye:     { x: 10, y: 17, rows: ["kkkkkk"] },
    winkOpen:    { x: 20, y: 16, rows: [
      "kEEEEk",
      "kEIIEk"
    ] },
    mouthSmirk:  { x: 13, y: 27, rows: [
      ".........k",
      "kkkkkkkkk.",
      ".sssssss.."
    ] },
    mouthGrin:   { x: 11, y: 26, rows: [
      ".kkkkkkkkkkkk.",
      "kTTTTTTTTTTTTk",
      "kTTTTTTTTTTTTk",
      ".kkkkkkkkkkkk."
    ] },
    mouthRage:   { x: 11, y: 25, rows: [
      ".kkkkkkkkkkkk.",
      "kTTTTTTTTTTTTk",
      "kMMMMMMMMMMMMk",
      "kTTTTTTTTTTTTk",
      ".kkkkkkkkkkkk."
    ] },
    mouthPain:   { x: 12, y: 27, rows: [
      ".kkkkkkkkk.",
      "kMMMMMMMMMk",
      ".kkkkkkkkk."
    ] },
    mouthO:      { x: 15, y: 27, rows: [
      ".kkk.",
      "kMMMk",
      ".kkk."
    ] },
    tongue:      { x: 17, y: 30, rows: ["PP", "PP"] }
  };

  var EXPR_PARTS = {
    neutral: ["browsFlat", "eyesOpen", "mouthSmirk"],
    grin:    ["browsRaised", "eyesOpen", "mouthGrin"],
    wink:    ["browsFlat", "winkEye", "winkOpen", "mouthSmirk"],
    rage:    ["browsRage", "eyesNarrow", "mouthRage"],
    pain:    ["browsPain", "eyesSqueeze", "mouthPain"],
    panic:   ["browsRaised", "eyesWide", "mouthO"],
    ko:      ["eyesX", "mouthO", "tongue"]
  };

  var cache = {};

  function buildCanvas(expr, blink, variant) {
    var buf = [];
    for (var r = 0; r < GH; r++) {
      var row = (BASE[r] || "") + "....................................";
      buf.push(row.slice(0, GW).split(""));
    }
    var parts = (EXPR_PARTS[expr] || EXPR_PARTS.neutral).slice();
    if (blink && expr === "neutral") {
      parts[parts.indexOf("eyesOpen")] = "eyesClosed";
    }
    for (var p = 0; p < parts.length; p++) {
      var patch = PATCH[parts[p]];
      if (!patch) continue;
      for (var pr = 0; pr < patch.rows.length; pr++) {
        var prow = patch.rows[pr];
        for (var pc = 0; pc < prow.length; pc++) {
          var ch = prow[pc];
          if (ch === ".") continue;
          var gy = patch.y + pr, gx = patch.x + pc;
          if (gy >= 0 && gy < GH && gx >= 0 && gx < GW) buf[gy][gx] = ch;
        }
      }
    }

    var canvas = document.createElement("canvas");
    canvas.width = GW;
    canvas.height = GH;
    var c = canvas.getContext("2d");
    var pal = PALETTES[variant] || PALETTES.base;
    for (var y = 0; y < GH; y++) {
      for (var x = 0; x < GW; x++) {
        var col = pal[buf[y][x]];
        if (!col) continue;
        c.fillStyle = col;
        c.fillRect(x, y, 1, 1);
      }
    }
    return canvas;
  }

  function getCanvas(expr, blink, variant) {
    var key = expr + "|" + (blink ? 1 : 0) + "|" + variant;
    if (!cache[key]) cache[key] = buildCanvas(expr, blink, variant);
    return cache[key];
  }

  /* --------------------------- kreslení --------------------------- */

  FaceCam.prototype.draw = function (ctx, x, y, size, opts) {
    opts = opts || {};
    var u = size / 100;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(u, u);

    var e = this.expr;
    var tier = this.healthTier;

    if (!opts.frameless) {
      ctx.fillStyle = "#151517";
      ctx.fillRect(0, 0, 100, 100);
    }

    // vlastní PNG sprite má přednost
    var spriteKey = (this.sunglasses && e !== "ko") ? "sunglasses" : e;
    var ext = SPRITES.imgs[spriteKey] || (spriteKey === "sunglasses" ? SPRITES.imgs[e] : null);
    var smoothing = ctx.imageSmoothingEnabled;
    if (ext) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(ext, 0, 0, 100, 100);
      ctx.imageSmoothingEnabled = smoothing;
      drawFrame(ctx, opts);
      ctx.restore();
      return;
    }

    // pixelový sprite
    var variant = e === "rage" ? "rage" : (tier === 2 ? "tier2" : "base");
    var img = getCanvas(e, this.blinking > 0, variant);
    var cell = 100 / GH;                       // výška mřížky = celý rám
    var wPx = GW * cell;
    var ox = (100 - wPx) / 2;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, GW, GH, ox, 0, wPx, 100);
    ctx.imageSmoothingEnabled = smoothing;

    /* -------- animované a stavové vrstvy nad pixel artem -------- */

    // modřiny podle zdraví
    if (tier >= 1) {
      ctx.fillStyle = "rgba(110,50,140,0.55)";
      ellipseRot(ctx, 66, 56, 5.5, 3.5, -0.5);
      ctx.strokeStyle = "#a1121a"; ctx.lineWidth = 1.4;
      line(ctx, 31, 33, 38, 36);
      line(ctx, 33, 37, 39, 38);
    }
    if (tier >= 2) {
      ctx.fillStyle = "rgba(90,40,120,0.55)";
      ellipseRot(ctx, 35, 60, 5, 3, 0.4);
      ctx.fillStyle = "rgba(60,20,80,0.4)";
      ellipseRot(ctx, 36, 48, 7, 3.5, 0);
      ctx.save();
      ctx.translate(63, 30); ctx.rotate(0.5);
      ctx.fillStyle = "#d8c9a3"; ctx.fillRect(-7, -2.6, 14, 5.2);
      ctx.fillStyle = "#c4b48d"; ctx.fillRect(-5.2, -2.6, 2, 5.2); ctx.fillRect(3.2, -2.6, 2, 5.2);
      ctx.restore();
    }

    // aviatorky při kombu
    if (this.sunglasses && e !== "ko") {
      ctx.fillStyle = "#17150f";
      ctx.fillRect(30, 36, 15, 10);
      ctx.fillRect(55, 36, 15, 10);
      ctx.fillRect(32, 46, 11, 2);
      ctx.fillRect(57, 46, 11, 2);
      ctx.strokeStyle = "#c9a25a"; ctx.lineWidth = 1.6;
      line(ctx, 45, 38, 55, 38);
      line(ctx, 46, 41, 54, 41);
      line(ctx, 13, 39, 30, 38);
      line(ctx, 87, 39, 70, 38);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(33, 38, 4, 2);
      ctx.fillRect(58, 38, 4, 2);
    }

    // pot při panice
    if (e === "panic") {
      var ph = (this.t * 2.2) % 1;
      ctx.fillStyle = "#7ec8ff";
      drop(ctx, 79, 34 + ph * 16, 2.4);
      drop(ctx, 21, 38 + ((ph + 0.45) % 1) * 14, 2);
    }

    // hvězdičky při KO
    if (e === "ko") {
      ctx.fillStyle = "#ffd23f";
      for (var k = 0; k < 3; k++) {
        var ang = this.t * 2.4 + k * (Math.PI * 2 / 3);
        star(ctx, 50 + Math.cos(ang) * 34, 18 + Math.sin(ang) * 8, 4.5, ang);
      }
    }

    drawFrame(ctx, opts);
    ctx.restore();
  };

  function drawFrame(ctx, opts) {
    if (opts.frameless) return;
    ctx.strokeStyle = "#000"; ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, 97, 97);
    ctx.strokeStyle = "#4c4c55"; ctx.lineWidth = 1.5; ctx.strokeRect(4, 4, 92, 92);
  }

  /* ----------------------- pomocné kreslení ----------------------- */

  function ellipseRot(ctx, cx, cy, rx, ry, rot) {
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2); ctx.fill();
  }
  function line(ctx, x1, y1, x2, y2) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  function drop(ctx, x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y - r * 1.6);
    ctx.quadraticCurveTo(x + r, y, x, y + r);
    ctx.quadraticCurveTo(x - r, y, x, y - r * 1.6);
    ctx.closePath(); ctx.fill();
  }
  function star(ctx, cx, cy, r, rot) {
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(rot);
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var rr = i % 2 ? r * 0.45 : r;
      var a = (i / 10) * Math.PI * 2;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  window.GTA = window.GTA || {};
  window.GTA.FaceCam = FaceCam;
})();
