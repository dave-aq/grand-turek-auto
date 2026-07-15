/* ============================================================
 * Herní logika: hráčovo auto, provoz, kolize, skóre, semafory.
 * Svět scrolluje vertikálně; 1 km/h rychlosti ≈ K px/s scrollu.
 * ============================================================ */
(function () {
  "use strict";

  var W = 480, H = 720;
  var PANEL_H = 110;                 // spodní Doom panel
  var ROAD_X = 90, ROAD_W = 300;     // silnice
  var LANES = [140, 240, 340];       // středy pruhů
  var K = 3.0;                       // px/s na km/h
  var MAX_SPEED = 190;

  // typy aut v provozu: [šance, jméno, hlasy, barvy, šířka, délka]
  var CAR_TYPES = [
    { p: 0.34, name: "hatchback",   votes: 60,  color: "#c8cdd4", roof: "#9aa1ab", w: 30, l: 52 },
    { p: 0.22, name: "sedan",       votes: 80,  color: "#7d4e2d", roof: "#5d3820", w: 32, l: 58 },
    { p: 0.18, name: "dodávka",     votes: 100, color: "#4a6b8a", roof: "#3a5570", w: 36, l: 68, tough: 1.5 },
    { p: 0.16, name: "elektromobil",votes: 120, color: "#3fc1a9", roof: "#2e9a86", w: 32, l: 56, ev: true },
    { p: 0.10, name: "sanitka",     votes: 0,   color: "#f2f2f2", roof: "#e0e0e0", w: 36, l: 68, ambulance: true }
  ];

  function pickType() {
    var r = Math.random(), acc = 0;
    for (var i = 0; i < CAR_TYPES.length; i++) {
      acc += CAR_TYPES[i].p;
      if (r <= acc) return CAR_TYPES[i];
    }
    return CAR_TYPES[0];
  }

  function Game(face, audio) {
    this.face = face;
    this.audio = audio;
    this.best = parseInt(localStorage.getItem("gta_best") || "0", 10);
    this.reset();
  }

  Game.prototype.reset = function () {
    this.player = { x: LANES[1], y: 520, vx: 0, speed: 0, halfW: 17, halfL: 30 };
    this.health = 100;
    this.score = 0;
    this.wrecks = 0;
    this.distance = 0;       // metry
    this.time = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.cars = [];
    this.gantries = [];
    this.floats = [];
    this.sparks = [];
    this.spawnTimer = 1.2;
    this.gantryTimer = 6;
    this.laneOffset = 0;
    this.shake = 0;
    this.rageCooldown = 0;
    this.over = false;
    this.overReason = "";
    this.face.reset();
  };

  Game.prototype.mult = function () {
    return this.comboTimer > 0 ? Math.min(this.combo, 5) : 1;
  };

  /* ------------------------------ update ------------------------------ */

  Game.prototype.update = function (dt, input) {
    if (this.over) return;
    var p = this.player;
    this.time += dt;

    // --- rychlost ---
    if (input.up) p.speed += 65 * dt;
    else if (input.down) p.speed -= 130 * dt;
    else p.speed -= 14 * dt;

    var onGrass = p.x < ROAD_X + p.halfW || p.x > ROAD_X + ROAD_W - p.halfW;
    if (onGrass && p.speed > 60) p.speed -= 80 * dt;
    p.speed = Math.max(0, Math.min(MAX_SPEED, p.speed));

    // --- řízení (při nulové rychlosti se netočí) ---
    var steerPower = 300 * Math.min(1, p.speed / 80);
    var target = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    p.vx += (target * steerPower - p.vx) * Math.min(1, 12 * dt);
    p.x += p.vx * dt;

    // krajnice: tvrdý okraj kousek za trávou
    var minX = ROAD_X - 24 + p.halfW, maxX = ROAD_X + ROAD_W + 24 - p.halfW;
    if (p.x < minX || p.x > maxX) {
      p.x = Math.max(minX, Math.min(maxX, p.x));
      p.vx = 0;
      if (p.speed > 40 && this.rageCooldown <= 0) {
        this.face.trigger("rage");
        this.rageCooldown = 0.9;
        this.shake = Math.max(this.shake, 0.15);
      }
    }
    this.rageCooldown -= dt;

    var scroll = p.speed * K;
    this.distance += (p.speed / 3.6) * dt;
    this.laneOffset = (this.laneOffset + scroll * dt) % 60;

    // --- kombo ---
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    // --- spawnování provozu ---
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.75 + Math.random() * 0.9;
      this.spawnCar();
    }

    // --- spawnování semaforů ---
    this.gantryTimer -= dt;
    if (this.gantryTimer <= 0) {
      this.gantryTimer = 9 + Math.random() * 5;
      this.gantries.push({ y: -60, phase: Math.random() * 7.7, scored: false });
    }

    // --- pohyb provozu ---
    for (var i = this.cars.length - 1; i >= 0; i--) {
      var c = this.cars[i];
      if (c.wrecked) {
        c.angle += c.spin * dt;
        c.x += c.vx * dt;
        c.vx *= Math.max(0, 1 - 2.2 * dt);
        c.speed *= Math.max(0, 1 - 3 * dt);
      } else {
        // nenajíždět do pomalejšího auta ve stejném pruhu
        for (var j = 0; j < this.cars.length; j++) {
          var o = this.cars[j];
          if (o !== c && !o.wrecked && o.lane === c.lane &&
              o.y < c.y && c.y - o.y < 150 && o.speed < c.speed) {
            c.speed = o.speed;
          }
        }
      }
      c.y += (p.speed - c.speed) * K * dt;
      if (c.y > H + 100 || c.y < -300) this.cars.splice(i, 1);
    }

    // --- semafory: pohyb + vyhodnocení červené ---
    for (var g = this.gantries.length - 1; g >= 0; g--) {
      var ga = this.gantries[g];
      ga.y += scroll * dt;
      ga.phase += dt;
      if (!ga.scored && ga.y > p.y - p.halfL) {
        ga.scored = true;
        if (lightState(ga.phase) === "red" && p.speed > 20) {
          this.score += 200;
          this.face.trigger("redlight");
          this.audio.ding();
          this.addFloat(p.x, p.y - 50, "Na červenou! +200", "#ff5d5d");
        }
      }
      if (ga.y > H + 40) this.gantries.splice(g, 1);
    }

    // --- kolize ---
    this.checkCollisions();

    // --- téměř-minutí ---
    for (var n = 0; n < this.cars.length; n++) {
      var nm = this.cars[n];
      if (nm.wrecked || nm.nearMissed) continue;
      if (nm.y > p.y && nm.y - p.y < 30 && p.speed > 90) {
        var gap = Math.abs(nm.x - p.x) - (p.halfW + nm.type.w / 2);
        if (gap > 0 && gap < 14) {
          nm.nearMissed = true;
          this.score += 25;
          this.addFloat(nm.x, nm.y - 20, "Těsně! +25", "#ffd23f");
        }
      }
    }

    // --- částice a texty ---
    for (var s = this.sparks.length - 1; s >= 0; s--) {
      var sp = this.sparks[s];
      sp.x += sp.vx * dt; sp.y += sp.vy * dt + scroll * dt * 0.5;
      sp.life -= dt;
      if (sp.life <= 0) this.sparks.splice(s, 1);
    }
    for (var f = this.floats.length - 1; f >= 0; f--) {
      var fl = this.floats[f];
      fl.y -= 30 * dt; fl.life -= dt;
      if (fl.life <= 0) this.floats.splice(f, 1);
    }

    this.shake = Math.max(0, this.shake - dt);

    // --- obličej + motor ---
    this.face.update(dt, {
      health: this.health,
      sunglasses: this.comboTimer > 0 && this.combo >= 3
    });
    this.audio.setEngine(p.speed / MAX_SPEED, true);
  };

  Game.prototype.spawnCar = function () {
    var lane = Math.floor(Math.random() * 3);
    for (var i = 0; i < this.cars.length; i++) {
      var c = this.cars[i];
      if (c.lane === lane && c.y < 170) return;   // pruh nahoře obsazený
    }
    var type = pickType();
    this.cars.push({
      lane: lane,
      x: LANES[lane],
      y: -90,
      speed: 40 + Math.random() * 50,
      type: type,
      angle: 0, spin: 0, vx: 0,
      wrecked: false, nearMissed: false
    });
  };

  Game.prototype.checkCollisions = function () {
    var p = this.player;
    for (var i = 0; i < this.cars.length; i++) {
      var c = this.cars[i];
      if (c.wrecked) continue;
      var dx = c.x - p.x, dy = c.y - p.y;
      if (Math.abs(dx) < p.halfW + c.type.w / 2 &&
          Math.abs(dy) < p.halfL + c.type.l / 2) {
        this.hitCar(c, dx);
      }
    }
  };

  Game.prototype.hitCar = function (c, dx) {
    var p = this.player;
    var rel = Math.max(10, p.speed - c.speed);
    var front = Math.abs(dx) < 22;

    // z auta je vrak
    c.wrecked = true;
    c.spin = (dx >= 0 ? 1 : -1) * (2 + Math.random() * 3);
    c.vx = (dx >= 0 ? 1 : -1) * (70 + Math.random() * 90);
    c.speed *= 0.3;

    // odezva hráče
    p.speed *= front ? 0.55 : 0.8;
    p.vx -= (dx >= 0 ? 1 : -1) * 90;
    this.shake = Math.max(this.shake, 0.25 + rel / 500);
    this.spawnSparks(c.x, c.y - 20);

    var dmg = (5 + rel * 0.14) * (c.type.tough || 1);

    if (c.type.ambulance) {
      dmg *= 1.4;
      this.score = Math.max(0, this.score - 500);
      this.combo = 0; this.comboTimer = 0;
      this.face.trigger("panic");
      this.audio.penalty();
      this.audio.crash(rel / 150);
      this.addFloat(c.x, c.y - 30, "SANITKA! SKANDÁL! −500", "#ff2222");
    } else {
      this.combo += 1;
      this.comboTimer = 4;
      var m = this.mult();
      var gain = c.type.votes * m;
      this.score += gain;
      this.wrecks += 1;
      this.face.trigger("kill");
      this.audio.crash(rel / 150);
      var label = "+" + gain + " hlasů" + (m > 1 ? " ×" + m : "");
      this.addFloat(c.x, c.y - 30, label, "#7dff6e");
      if (c.type.ev) this.addFloat(c.x, c.y - 8, "Emise −100 %?", "#3fc1a9");
    }

    this.damage(dmg);
  };

  Game.prototype.damage = function (dmg) {
    if (this.over) return;
    this.health -= dmg;
    this.face.trigger("pain");
    if (this.health <= 0) {
      this.health = 0;
      this.gameOver();
    }
  };

  Game.prototype.gameOver = function () {
    this.over = true;
    this.face.trigger("ko");
    this.audio.ko();
    this.audio.setEngine(0, false);
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem("gta_best", String(this.best));
    }
  };

  Game.prototype.addFloat = function (x, y, text, color) {
    this.floats.push({ x: x, y: y, text: text, color: color, life: 1.4 });
  };

  Game.prototype.spawnSparks = function (x, y) {
    for (var i = 0; i < 10; i++) {
      var a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 160;
      this.sparks.push({
        x: x, y: y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: 0.25 + Math.random() * 0.3,
        color: Math.random() < 0.6 ? "#ffb347" : "#ffe66e"
      });
    }
  };

  /* ------------------------------- draw ------------------------------- */

  Game.prototype.draw = function (ctx) {
    ctx.save();
    if (this.shake > 0) {
      ctx.translate((Math.random() - 0.5) * this.shake * 24,
                    (Math.random() - 0.5) * this.shake * 24);
    }

    this.drawRoad(ctx);

    for (var g = 0; g < this.gantries.length; g++) this.drawGantry(ctx, this.gantries[g]);
    for (var i = 0; i < this.cars.length; i++) this.drawCar(ctx, this.cars[i]);
    this.drawPlayer(ctx);

    for (var s = 0; s < this.sparks.length; s++) {
      var sp = this.sparks[s];
      ctx.globalAlpha = Math.max(0, sp.life / 0.5);
      ctx.fillStyle = sp.color;
      ctx.fillRect(sp.x - 2, sp.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    ctx.font = "bold 15px Arial";
    ctx.textAlign = "center";
    for (var f = 0; f < this.floats.length; f++) {
      var fl = this.floats[f];
      ctx.globalAlpha = Math.min(1, fl.life);
      ctx.fillStyle = "#000";
      ctx.fillText(fl.text, fl.x + 1.5, fl.y + 1.5);
      ctx.fillStyle = fl.color;
      ctx.fillText(fl.text, fl.x, fl.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    this.drawPanel(ctx);
  };

  Game.prototype.drawRoad = function (ctx) {
    // tráva s pruhy pro pocit rychlosti
    ctx.fillStyle = "#3f7a37";
    ctx.fillRect(0, 0, W, H - PANEL_H);
    ctx.fillStyle = "#376c30";
    var stripe = 60;
    for (var y = -stripe + this.laneOffset; y < H; y += stripe * 2) {
      ctx.fillRect(0, y, ROAD_X - 10, stripe);
      ctx.fillRect(ROAD_X + ROAD_W + 10, y, W - ROAD_X - ROAD_W - 10, stripe);
    }

    // asfalt + krajnice
    ctx.fillStyle = "#43434b";
    ctx.fillRect(ROAD_X - 10, 0, ROAD_W + 20, H - PANEL_H);
    ctx.fillStyle = "#55555e";
    ctx.fillRect(ROAD_X, 0, ROAD_W, H - PANEL_H);
    ctx.fillStyle = "#dedede";
    ctx.fillRect(ROAD_X - 3, 0, 4, H - PANEL_H);
    ctx.fillRect(ROAD_X + ROAD_W - 1, 0, 4, H - PANEL_H);

    // přerušované čáry pruhů
    ctx.fillStyle = "#d8d8d0";
    for (var lx = 1; lx < 3; lx++) {
      var x = ROAD_X + lx * 100 - 2;
      for (var yy = -60 + this.laneOffset; yy < H; yy += 60) {
        ctx.fillRect(x, yy, 4, 30);
      }
    }
  };

  Game.prototype.drawGantry = function (ctx, ga) {
    var y = ga.y;
    // stopčára
    ctx.fillStyle = "#e8e8e0";
    ctx.fillRect(ROAD_X, y + 16, ROAD_W, 8);
    // rameno přes silnici
    ctx.fillStyle = "#2c2c30";
    ctx.fillRect(ROAD_X - 26, y - 8, ROAD_W + 52, 10);
    ctx.fillRect(ROAD_X - 26, y - 8, 8, 26);
    ctx.fillRect(ROAD_X + ROAD_W + 18, y - 8, 8, 26);
    // budka semaforu vpravo
    var st = lightState(ga.phase);
    ctx.fillStyle = "#1d1d20";
    ctx.fillRect(ROAD_X + ROAD_W + 4, y - 30, 18, 44);
    circle(ctx, ROAD_X + ROAD_W + 13, y - 20, 5, st === "red" ? "#ff3131" : "#4a1414");
    circle(ctx, ROAD_X + ROAD_W + 13, y - 8,  5, st === "orange" ? "#ffb62e" : "#4a3a12");
    circle(ctx, ROAD_X + ROAD_W + 13, y + 4,  5, st === "green" ? "#42e05c" : "#12421c");
  };

  Game.prototype.drawCar = function (ctx, c) {
    ctx.save();
    ctx.translate(c.x, c.y);
    if (c.wrecked) {
      ctx.rotate(c.angle);
      ctx.globalAlpha = 0.9;
    }
    var t = c.type, w = t.w, l = t.l;
    var body = c.wrecked ? "#6e6e6e" : t.color;
    var roof = c.wrecked ? "#565656" : t.roof;

    rr(ctx, -w / 2, -l / 2, w, l, 6, body);
    ctx.fillStyle = "#22262c";
    ctx.fillRect(-w / 2 + 3, -l / 2 + 8, w - 6, 7);        // čelní sklo
    ctx.fillRect(-w / 2 + 3, l / 2 - 13, w - 6, 6);        // zadní sklo
    rr(ctx, -w / 2 + 4, -l / 2 + 17, w - 8, l - 34, 3, roof);

    if (!c.wrecked && t.ambulance) {
      ctx.fillStyle = "#e02121";
      ctx.fillRect(-w / 2, -4, w, 8);
      ctx.fillRect(-3, -l / 2 + 20, 6, 18);
      ctx.fillRect(-9, -l / 2 + 26, 18, 6);
      // maják bliká
      if (Math.floor(this.time * 6) % 2 === 0) circle(ctx, 0, -l / 2 + 10, 4, "#4aa8ff");
    }
    if (!c.wrecked && t.ev) {
      ctx.fillStyle = "#eafff9";
      ctx.font = "bold 13px Arial";
      ctx.textAlign = "center";
      ctx.fillText("⚡", 0, 5);
    }
    if (c.wrecked) {
      ctx.strokeStyle = "#33363b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-w / 2 + 4, -l / 4); ctx.lineTo(w / 2 - 6, 0); ctx.lineTo(-w / 2 + 8, l / 4);
      ctx.stroke();
    }
    ctx.restore();
  };

  Game.prototype.drawPlayer = function (ctx) {
    var p = this.player;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.vx / 1400);                    // náklon dle řízení

    rr(ctx, -17, -30, 34, 60, 7, "#1d5c33");    // british racing green
    ctx.fillStyle = "#22262c";
    ctx.fillRect(-13, -20, 26, 8);
    ctx.fillRect(-13, 16, 26, 6);
    rr(ctx, -13, -10, 26, 24, 3, "#174a29");
    // chromová maska a světla
    ctx.fillStyle = "#cfd6dd";
    ctx.fillRect(-13, -30, 26, 4);
    circle(ctx, -10, -27, 3, "#fff3b0");
    circle(ctx, 10, -27, 3, "#fff3b0");
    // pruh po kapotě
    ctx.fillStyle = "#e9e4d0";
    ctx.fillRect(-2.5, -30, 5, 60);
    ctx.restore();
  };

  Game.prototype.drawPanel = function (ctx) {
    var top = H - PANEL_H;
    ctx.fillStyle = "#26262c";
    ctx.fillRect(0, top, W, PANEL_H);
    ctx.fillStyle = "#3a3a42";
    ctx.fillRect(0, top, W, 4);
    ctx.fillStyle = "#111114";
    ctx.fillRect(0, top + 4, W, 2);

    // vlevo: zdraví
    ctx.fillStyle = "#9aa0a8";
    ctx.font = "bold 13px Arial";
    ctx.textAlign = "left";
    ctx.fillText("KAROSERIE", 18, top + 30);
    ctx.fillStyle = "#0f0f12";
    ctx.fillRect(18, top + 40, 130, 16);
    var hw = Math.max(0, this.health / 100) * 126;
    ctx.fillStyle = this.health > 50 ? "#42e05c" : this.health > 25 ? "#ffb62e" : "#ff3131";
    ctx.fillRect(20, top + 42, hw, 12);
    ctx.strokeStyle = "#4c4c55";
    ctx.strokeRect(18.5, top + 40.5, 129, 15);
    ctx.fillStyle = "#e8e8e8";
    ctx.font = "bold 15px Arial";
    ctx.fillText(Math.round(this.player.speed) + " km/h", 18, top + 82);

    // střed: Turkocam
    this.face.draw(ctx, W / 2 - 48, top + 7, 96);

    // vpravo: hlasy + kombo
    ctx.textAlign = "right";
    ctx.fillStyle = "#9aa0a8";
    ctx.font = "bold 13px Arial";
    ctx.fillText("PREFERENČNÍ HLASY", W - 18, top + 30);
    ctx.fillStyle = "#ffd23f";
    ctx.font = "bold 26px Arial";
    ctx.fillText(fmt(this.score), W - 18, top + 58);
    if (this.comboTimer > 0 && this.combo > 1) {
      ctx.fillStyle = "#ff8c42";
      ctx.font = "bold 18px Arial";
      ctx.fillText("KOMBO ×" + this.mult(), W - 18, top + 82);
    } else {
      ctx.fillStyle = "#6a6a74";
      ctx.font = "12px Arial";
      ctx.fillText("rekord: " + fmt(this.best), W - 18, top + 80);
    }
  };

  /* --------------------------- pomocníci --------------------------- */

  // 7,7s cyklus: zelená 3 s, oranžová 1,2 s, červená 3,5 s
  function lightState(phase) {
    var t = phase % 7.7;
    if (t < 3) return "green";
    if (t < 4.2) return "orange";
    return "red";
  }

  function circle(ctx, x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  function rr(ctx, x, y, w, h, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath(); ctx.fill();
  }

  function fmt(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }

  window.GTA = window.GTA || {};
  window.GTA.Game = Game;
  window.GTA.SIZE = { W: W, H: H };
})();
