/* ============================================================
 * Turkocam — obličej ve stylu Doom HUD
 * Stavový automat grimas + procedurálně kreslená karikatura.
 * Modul je nezávislý na pohledu hry: v konceptu A se kreslí do
 * spodního panelu, v konceptu B (STUNTS FPV) do zpětného zrcátka.
 * ============================================================ */
(function () {
  "use strict";

  // Priorita událostí: vyšší číslo přebije nižší.
  var PRIORITY = { ko: 100, pain: 80, panic: 70, kill: 50, redlight: 40, rage: 30 };
  var EXPR = { ko: "ko", pain: "pain", panic: "panic", kill: "grin", redlight: "wink", rage: "rage" };
  var DURATION = { ko: Infinity, pain: 0.7, panic: 1.6, kill: 0.9, redlight: 0.9, rage: 0.8 };

  function FaceCam() {
    this.reset();
    // Statické tečky strniště (jednou vygenerované, ať neblikají).
    this.stubble = [];
    for (var i = 0; i < 46; i++) {
      var a = Math.random() * Math.PI;             // spodní půlkruh čelisti
      var r = 20 + Math.random() * 12;
      this.stubble.push({ x: 50 + Math.cos(a) * r * 0.95, y: 62 + Math.sin(a) * r * 0.62 });
    }
  }

  FaceCam.prototype.reset = function () {
    this.expr = "neutral";
    this.exprUntil = 0;
    this.exprPrio = 0;
    this.t = 0;
    this.blinkAt = 2 + Math.random() * 2;
    this.blinking = 0;
    this.healthTier = 0;   // 0 svěží, 1 potlučený, 2 na maděru
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
    // Mrkání jen v klidu.
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

  /* --------- kreslení (souřadnice v prostoru 0..100, škáluje se) --------- */

  FaceCam.prototype.draw = function (ctx, x, y, size) {
    var u = size / 100;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(u, u);

    var e = this.expr;
    var tier = this.healthTier;

    // pozadí rámečku
    ctx.fillStyle = "#151517";
    ctx.fillRect(0, 0, 100, 100);

    // hlava
    ctx.fillStyle = tier === 2 ? "#d9a173" : "#e8b98a";
    ellipse(ctx, 50, 54, 33, 40);
    // uši
    ellipse(ctx, 16, 54, 6, 10);
    ellipse(ctx, 84, 54, 6, 10);

    // ruměnec vzteku
    if (e === "rage") {
      ctx.fillStyle = "rgba(210,40,20,0.38)";
      ellipse(ctx, 50, 60, 30, 34);
    }

    // strniště
    ctx.fillStyle = "rgba(45,28,15,0.16)";
    beginJaw(ctx); ctx.fill();
    ctx.fillStyle = "rgba(45,28,15,0.5)";
    for (var i = 0; i < this.stubble.length; i++) {
      ctx.fillRect(this.stubble[i].x, this.stubble[i].y, 1.1, 1.1);
    }

    // vlasy — tmavé, sčesané dozadu, mírné kouty
    ctx.fillStyle = "#33231a";
    ctx.beginPath();
    ctx.moveTo(17, 42);
    ctx.quadraticCurveTo(16, 12, 50, 11);
    ctx.quadraticCurveTo(84, 12, 83, 42);
    ctx.quadraticCurveTo(76, 30, 64, 27);
    ctx.quadraticCurveTo(57, 22, 50, 26);   // kout
    ctx.quadraticCurveTo(43, 22, 36, 27);
    ctx.quadraticCurveTo(24, 30, 17, 42);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1;
    for (var s = 0; s < 3; s++) {
      ctx.beginPath();
      ctx.moveTo(30 + s * 14, 16 + s * 1.5);
      ctx.quadraticCurveTo(50, 12 + s * 2, 70 - s * 12, 17 + s * 1.5);
      ctx.stroke();
    }

    // modřiny podle zdraví
    if (tier >= 1) {
      ctx.fillStyle = "rgba(110,50,140,0.5)";
      ellipseRot(ctx, 68, 60, 6.5, 4, -0.5);
      ctx.strokeStyle = "#a1121a"; ctx.lineWidth = 1.4;
      line(ctx, 30, 34, 37, 37); line(ctx, 32, 38, 38, 39);
    }
    if (tier >= 2) {
      ctx.fillStyle = "rgba(90,40,120,0.55)";
      ellipseRot(ctx, 33, 61, 5.5, 3.5, 0.4);
      ctx.fillStyle = "rgba(60,20,80,0.45)";
      ellipse(ctx, 35, 49, 8, 4.5);           // monokl
      // náplast
      ctx.save();
      ctx.translate(63, 32); ctx.rotate(0.5);
      ctx.fillStyle = "#d8c9a3"; ctx.fillRect(-7, -2.6, 14, 5.2);
      ctx.fillStyle = "#c4b48d"; ctx.fillRect(-5.2, -2.6, 2, 5.2); ctx.fillRect(3.2, -2.6, 2, 5.2);
      ctx.restore();
    }

    // oči / brýle
    this.drawEyes(ctx, e);

    // nos — výrazný
    ctx.strokeStyle = "#b07948"; ctx.lineWidth = 2.4; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(50, 48);
    ctx.lineTo(47, 61);
    ctx.quadraticCurveTo(50, 65, 54, 62);
    ctx.stroke();

    // ústa
    this.drawMouth(ctx, e);

    // pot při panice
    if (e === "panic") {
      var ph = (this.t * 2.2) % 1;
      ctx.fillStyle = "#7ec8ff";
      drop(ctx, 78, 36 + ph * 16, 2.4);
      drop(ctx, 23, 40 + ((ph + 0.45) % 1) * 14, 2);
    }

    // hvězdičky při KO
    if (e === "ko") {
      ctx.fillStyle = "#ffd23f";
      for (var k = 0; k < 3; k++) {
        var ang = this.t * 2.4 + k * (Math.PI * 2 / 3);
        star(ctx, 50 + Math.cos(ang) * 34, 22 + Math.sin(ang) * 9, 4.5, ang);
      }
    }

    // rámeček
    ctx.strokeStyle = "#000"; ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, 97, 97);
    ctx.strokeStyle = "#4c4c55"; ctx.lineWidth = 1.5; ctx.strokeRect(4, 4, 92, 92);

    ctx.restore();
  };

  FaceCam.prototype.drawEyes = function (ctx, e) {
    if (this.sunglasses && e !== "ko") {
      // Sluneční brýle při extázi z komba.
      ctx.fillStyle = "#111";
      roundRect(ctx, 24, 40, 22, 11, 4); ctx.fill();
      roundRect(ctx, 54, 40, 22, 11, 4); ctx.fill();
      ctx.fillRect(45, 43, 10, 2.6);
      ctx.fillRect(17, 42, 8, 2.4); ctx.fillRect(75, 42, 8, 2.4);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillRect(27, 42, 5, 2); ctx.fillRect(57, 42, 5, 2);
      return;
    }
    var L = { x: 36, y: 45 }, R = { x: 64, y: 45 };
    var openL = 1, openR = 1;
    var browLA = 0, browRA = 0, browLift = 0;

    switch (e) {
      case "grin":  browLift = -3; break;
      case "wink":  openL = 0; browLA = -0.35; browLift = -1; break;
      case "rage":  browLA = 0.55; browRA = -0.55; browLift = 2; openL = openR = 0.7; break;
      case "pain":  browLA = -0.4; browRA = 0.4; browLift = -1; openL = openR = 0.55; break;
      case "panic": browLift = -4; openL = openR = 1.3; break;
      case "ko":    openL = openR = -1; break;   // křížky
      default:
        if (this.blinking > 0) { openL = openR = 0.06; }
    }

    drawEye(ctx, L, openL, e);
    drawEye(ctx, R, openR, e);

    // obočí — hustá
    ctx.strokeStyle = "#2c1d13"; ctx.lineWidth = 3.4; ctx.lineCap = "round";
    brow(ctx, L.x, 36 + browLift, browLA);
    brow(ctx, R.x, 36 + browLift, browRA || -browLA);
  };

  FaceCam.prototype.drawMouth = function (ctx, e) {
    ctx.lineCap = "round";
    switch (e) {
      case "grin": { // široký zubatý úsměv
        ctx.fillStyle = "#5e1414";
        ctx.beginPath();
        ctx.moveTo(32, 71);
        ctx.quadraticCurveTo(50, 88, 68, 71);
        ctx.quadraticCurveTo(50, 76, 32, 71);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.moveTo(34, 71.5);
        ctx.quadraticCurveTo(50, 76, 66, 71.5);
        ctx.quadraticCurveTo(50, 80, 34, 71.5);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "#3c0d0d"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(32, 71); ctx.quadraticCurveTo(50, 88, 68, 71); ctx.stroke();
        break;
      }
      case "rage": { // zatnuté zuby
        ctx.fillStyle = "#fff";
        roundRect(ctx, 35, 69, 30, 9, 2.5); ctx.fill();
        ctx.strokeStyle = "#3c0d0d"; ctx.lineWidth = 1.4;
        for (var i = 1; i < 5; i++) line(ctx, 35 + i * 6, 69, 35 + i * 6, 78);
        ctx.lineWidth = 2.2;
        ctx.strokeRect(35, 69, 30, 9);
        line(ctx, 35, 73.5, 65, 73.5);
        break;
      }
      case "pain": { // bolestivá grimasa
        ctx.fillStyle = "#5e1414";
        ellipseRot(ctx, 49, 74, 8, 5.5, 0.18);
        ctx.strokeStyle = "#3c0d0d"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(41, 71); ctx.quadraticCurveTo(49, 66.5, 57, 72); ctx.stroke();
        break;
      }
      case "panic": { // roztřesená vlnovka
        ctx.strokeStyle = "#3c0d0d"; ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(38, 74);
        for (var x = 38; x <= 62; x += 4) ctx.lineTo(x, 74 + ((x / 4) % 2 ? -2.4 : 2.4));
        ctx.stroke();
        break;
      }
      case "wink": { // spiklenecký úšklebek
        ctx.strokeStyle = "#3c0d0d"; ctx.lineWidth = 2.6;
        ctx.beginPath(); ctx.moveTo(36, 73); ctx.quadraticCurveTo(52, 80, 66, 68); ctx.stroke();
        break;
      }
      case "ko": { // omráčený, jazyk venku
        ctx.strokeStyle = "#3c0d0d"; ctx.lineWidth = 2.4;
        ellipseStroke(ctx, 48, 73, 5, 4);
        ctx.fillStyle = "#e07a8a";
        ellipseRot(ctx, 53, 78, 3.4, 5, 0.5);
        break;
      }
      default: { // sebevědomý úsměšek
        ctx.strokeStyle = "#3c0d0d"; ctx.lineWidth = 2.6;
        ctx.beginPath(); ctx.moveTo(38, 73.5); ctx.quadraticCurveTo(54, 77.5, 63, 70.5); ctx.stroke();
      }
    }
  };

  /* ----------------------- pomocné kreslení ----------------------- */

  function ellipse(ctx, cx, cy, rx, ry) {
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  }
  function ellipseRot(ctx, cx, cy, rx, ry, rot) {
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2); ctx.fill();
  }
  function ellipseStroke(ctx, cx, cy, rx, ry) {
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
  }
  function line(ctx, x1, y1, x2, y2) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function beginJaw(ctx) {
    ctx.beginPath();
    ctx.moveTo(24, 62);
    ctx.quadraticCurveTo(28, 90, 50, 92);
    ctx.quadraticCurveTo(72, 90, 76, 62);
    ctx.quadraticCurveTo(50, 72, 24, 62);
    ctx.closePath();
  }
  function drawEye(ctx, p, open, expr) {
    if (open < 0) { // KO křížky
      ctx.strokeStyle = "#2c1d13"; ctx.lineWidth = 2.6;
      line(ctx, p.x - 4, p.y - 4, p.x + 4, p.y + 4);
      line(ctx, p.x + 4, p.y - 4, p.x - 4, p.y + 4);
      return;
    }
    if (open <= 0.08) { // zavřené / mrknutí
      ctx.strokeStyle = "#2c1d13"; ctx.lineWidth = 2.4;
      line(ctx, p.x - 6, p.y + 1, p.x + 6, p.y + 1);
      return;
    }
    var ry = 4.6 * Math.min(open, 1.4);
    ctx.fillStyle = "#fff";
    ellipse(ctx, p.x, p.y, 7, ry);
    ctx.fillStyle = "#5c4326";
    ellipse(ctx, p.x, p.y, 3, Math.min(ry, 3.4));
    ctx.fillStyle = "#191919";
    ellipse(ctx, p.x, p.y, 1.5, Math.min(ry, 1.8));
    if (expr === "panic") {
      ctx.fillStyle = "#fff";
      ellipse(ctx, p.x - 1.4, p.y - 1.4, 0.9, 0.9);
    }
  }
  function brow(ctx, cx, y, angle) {
    ctx.save();
    ctx.translate(cx, y); ctx.rotate(angle);
    ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.stroke();
    ctx.restore();
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
