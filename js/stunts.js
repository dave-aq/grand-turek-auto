/* ============================================================
 * Koncept B — „STUNTS mód": first-person kokpit.
 * Pseudo-3D silnice (segmentová projekce à la OutRun), provoz
 * jako škálované sprity, kokpit s volantem, budíky a zpětným
 * zrcátkem, ve kterém se šklebí Turkocam (sdílený face.js).
 * ============================================================ */
(function () {
  "use strict";

  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");
  var W = 640, H = 480;

  /* --------------------------- konstanty --------------------------- */
  var SEG_L = 200;                 // délka segmentu (světové jednotky)
  var ROAD_W = 2200;               // polovina šířky silnice
  var CAM_H = 1050;
  var DRAW_DIST = 180;             // segmentů dopředu
  var FOV = 100;
  var CAM_DEPTH = 1 / Math.tan((FOV / 2) * Math.PI / 180);
  var PLAYER_Z = CAM_H * CAM_DEPTH;
  var MAXS = 200;                  // km/h
  var UNITS = 55;                  // světové jednotky za s na 1 km/h
  var CENTRIFUGAL = 0.28;
  var FOG_DENSITY = 5;
  var DASH_TOP = H - 128;

  // typy aut: šance, hlasy, barvy, světová šířka
  var CAR_TYPES = [
    { p: 0.34, votes: 60,  color: "#c8cdd4", roof: "#9aa1ab", ww: 620 },
    { p: 0.22, votes: 80,  color: "#7d4e2d", roof: "#5d3820", ww: 660 },
    { p: 0.18, votes: 100, color: "#4a6b8a", roof: "#3a5570", ww: 780, tough: 1.5 },
    { p: 0.16, votes: 120, color: "#3fc1a9", roof: "#2e9a86", ww: 650, ev: true },
    { p: 0.10, votes: 0,   color: "#f2f2f2", roof: "#e0e0e0", ww: 780, ambulance: true }
  ];

  function pickType() {
    var r = Math.random(), acc = 0;
    for (var i = 0; i < CAR_TYPES.length; i++) {
      acc += CAR_TYPES[i].p;
      if (r <= acc) return CAR_TYPES[i];
    }
    return CAR_TYPES[0];
  }

  /* ----------------------------- trať ----------------------------- */

  var segments = [], N = 0, trackLen = 0;
  var gantries = [], gantryBySeg = {};

  function yAt(i) {
    var k = (i % N) / N;
    return 750 * Math.sin(Math.PI * 2 * 3 * k) + 420 * Math.sin(Math.PI * 2 * 7 * k + 1.3);
  }

  function buildTrack() {
    // plán sekcí: délka + cílové zakřivení, ease-in prvních 24 segmentů
    var plan = [], total = 0;
    plan.push({ len: 90, target: 0 });
    total += 90;
    while (total < 1450) {
      var len = 60 + Math.floor(Math.random() * 80);
      var target = Math.random() < 0.3 ? 0 : (Math.random() * 8 - 4);
      plan.push({ len: len, target: target });
      total += len;
    }
    plan.push({ len: 90, target: 0 });

    var curveArr = [], last = 0;
    plan.forEach(function (s) {
      for (var k = 0; k < s.len; k++) {
        var t = Math.min(1, k / 24);
        curveArr.push(last + (s.target - last) * t);
      }
      last = s.target;
    });

    N = curveArr.length;
    trackLen = N * SEG_L;
    for (var i = 0; i < N; i++) {
      segments.push({
        index: i, curve: curveArr[i], clip: H,
        p1: { world: { x: 0, y: yAt(i), z: i * SEG_L }, camera: {}, screen: {} },
        p2: { world: { x: 0, y: yAt(i + 1), z: (i + 1) * SEG_L }, camera: {}, screen: {} }
      });
    }

    // semafory
    var g = 220;
    while (g < N - 120) {
      var ga = { seg: segments[g], z: g * SEG_L, off: Math.random() * 7.7 };
      gantries.push(ga);
      gantryBySeg[g] = ga;
      g += 260 + Math.floor(Math.random() * 180);
    }
  }

  function findSegment(z) {
    return segments[Math.floor(z / SEG_L) % N];
  }

  // 7,7s cyklus: zelená 3 s, oranžová 1,2 s, červená 3,5 s
  function lightState(phase) {
    var t = phase % 7.7;
    if (t < 3) return "green";
    if (t < 4.2) return "orange";
    return "red";
  }

  /* --------------------------- stav hry --------------------------- */

  var face = new GTA.FaceCam();
  var audio = new GTA.AudioSys();
  var state = "menu";  // menu | playing | over
  var input = { left: false, right: false, up: false, down: false };

  var position, prevPos, speed, playerX, wheelAngle;
  var health, lastTier, score, best, combo, comboTimer, wrecksN, distanceM, timeT;
  var cars, floats, sparks, cracks, shake, rageCd, over, mtOff;

  best = parseInt(localStorage.getItem("gta_best_stunts") || "0", 10);

  function reset() {
    position = 0; prevPos = 0; speed = 0; playerX = 0; wheelAngle = 0;
    health = 100; lastTier = 0; score = 0; combo = 0; comboTimer = 0;
    wrecksN = 0; distanceM = 0; timeT = 0;
    floats = []; sparks = []; cracks = []; shake = 0; rageCd = 0; mtOff = 0;
    over = false;
    face.reset();
    cars = [];
    for (var i = 0; i < 26; i++) {
      var car = {};
      respawn(car);
      car.z = ((i + 1) * (trackLen / 28)) % trackLen;
      cars.push(car);
    }
  }

  function respawn(car) {
    car.type = pickType();
    var lane = [-0.66, 0, 0.66][Math.floor(Math.random() * 3)];
    car.offset = lane + (Math.random() - 0.5) * 0.12;
    car.z = (position + (DRAW_DIST + 15 + Math.random() * 90) * SEG_L) % trackLen;
    car.speedU = (55 + Math.random() * 50) * UNITS;
    car.wrecked = false;
    car.vx = 0;
    car.wreckT = 0;
    car.nearMissed = false;
    car.prevRel = 1e9;
  }

  function mult() {
    return comboTimer > 0 ? Math.min(combo, 5) : 1;
  }

  /* ---------------------------- update ---------------------------- */

  function update(dt) {
    timeT += dt;

    if (input.up) speed += 60 * dt;
    else if (input.down) speed -= 125 * dt;
    else speed -= 12 * dt;

    var offroad = Math.abs(playerX) > 1.02;
    if (offroad && speed > 70) speed -= 100 * dt;
    speed = Math.max(0, Math.min(MAXS, speed));

    var speedPct = speed / MAXS;
    prevPos = position;
    position = (position + speed * UNITS * dt) % trackLen;
    distanceM += (speed / 3.6) * dt;

    var base = findSegment(position);

    var steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    var dx = dt * 1.8 * speedPct;
    playerX += steer * dx;
    playerX -= dx * speedPct * base.curve * CENTRIFUGAL;
    playerX = Math.max(-2.1, Math.min(2.1, playerX));
    wheelAngle += (steer * 0.85 - wheelAngle) * Math.min(1, 10 * dt);

    if (offroad && speed > 40 && rageCd <= 0) {
      face.trigger("rage");
      rageCd = 0.9;
      shake = Math.max(shake, 0.12);
    }
    rageCd -= dt;

    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) combo = 0;
    }

    // --- provoz ---
    for (var i = 0; i < cars.length; i++) {
      var c = cars[i];
      if (c.wrecked) {
        c.speedU *= Math.max(0, 1 - 2.5 * dt);
        c.offset += c.vx * dt;
        c.wreckT += dt;
      } else {
        // nenajet do pomalejšího vpředu
        for (var j = 0; j < cars.length; j++) {
          var o = cars[j];
          if (o === c || o.wrecked) continue;
          var rz = (o.z - c.z + trackLen) % trackLen;
          if (rz > 0 && rz < SEG_L * 6 && Math.abs(o.offset - c.offset) < 0.4 &&
              o.speedU < c.speedU) {
            c.speedU = o.speedU;
          }
        }
      }
      c.z = (c.z + c.speedU * dt) % trackLen;

      var rel = (c.z - position + trackLen) % trackLen;

      // projeté nebo dosloužilé vraky → respawn dopředu
      if (rel > trackLen * 0.6 || (c.wrecked && c.wreckT > 6)) {
        respawn(c);
        continue;
      }

      // kolize s hráčem
      if (!c.wrecked && rel > PLAYER_Z - 260 && rel < PLAYER_Z + 340 &&
          Math.abs(c.offset - playerX) < 0.34) {
        hitCar(c);
      }

      // téměř-minutí
      if (!c.wrecked && !c.nearMissed && c.prevRel > PLAYER_Z && rel <= PLAYER_Z &&
          Math.abs(c.prevRel - rel) < 6000 && speed > 90) {
        var gap = Math.abs(c.offset - playerX);
        if (gap >= 0.34 && gap < 0.55) {
          c.nearMissed = true;
          score += 25;
          addFloat(centerXOf(c), H * 0.5, "Těsně! +25", "#ffd23f");
        }
      }
      c.prevRel = rel;
    }

    // --- semafory ---
    var travel = (position - prevPos + trackLen) % trackLen;
    for (var g = 0; g < gantries.length; g++) {
      var ga = gantries[g];
      var relBefore = (ga.z - (prevPos + PLAYER_Z) + trackLen) % trackLen;
      if (relBefore < travel) {
        if (lightState(timeT + ga.off) === "red" && speed > 25) {
          score += 200;
          face.trigger("redlight");
          audio.ding();
          addFloat(W / 2, H * 0.4, "Na červenou! +200", "#ff5d5d");
        }
      }
    }

    // --- částice/texty ---
    for (var s = sparks.length - 1; s >= 0; s--) {
      var sp = sparks[s];
      sp.x += sp.vx * dt; sp.y += sp.vy * dt; sp.life -= dt;
      if (sp.life <= 0) sparks.splice(s, 1);
    }
    for (var f = floats.length - 1; f >= 0; f--) {
      var fl = floats[f];
      fl.y -= 26 * dt; fl.life -= dt;
      if (fl.life <= 0) floats.splice(f, 1);
    }

    shake = Math.max(0, shake - dt);
    mtOff -= base.curve * speedPct * dt * 1.4;

    face.update(dt, { health: health, sunglasses: comboTimer > 0 && combo >= 3 });
    audio.setEngine(speedPct, true);
  }

  function centerXOf(car) {
    return W / 2 + (car.offset - playerX) * W * 0.28;
  }

  function hitCar(c) {
    var relKmh = Math.max(10, speed - c.speedU / UNITS);

    c.wrecked = true;
    c.wreckT = 0;
    c.vx = (c.offset >= playerX ? 1 : -1) * 0.9;
    c.speedU *= 0.25;

    speed *= 0.6;
    shake = Math.max(shake, 0.25 + relKmh / 500);
    var fx = centerXOf(c), fy = H * 0.55;
    spawnSparks(fx, fy);

    var dmg = (5 + relKmh * 0.14) * (c.type.tough || 1);

    if (c.type.ambulance) {
      dmg *= 1.4;
      score = Math.max(0, score - 500);
      combo = 0; comboTimer = 0;
      face.trigger("panic");
      audio.penalty();
      audio.crash(relKmh / 150);
      addFloat(fx, fy - 30, "SANITKA! SKANDÁL! −500", "#ff2222");
    } else {
      combo += 1;
      comboTimer = 4;
      var m = mult();
      var gain = c.type.votes * m;
      score += gain;
      wrecksN += 1;
      face.trigger("kill");
      audio.crash(relKmh / 150);
      addFloat(fx, fy - 30, "+" + gain + " hlasů" + (m > 1 ? " ×" + m : ""), "#7dff6e");
      if (c.type.ev) addFloat(fx, fy - 8, "Emise −100 %?", "#3fc1a9");
    }

    health -= dmg;
    face.trigger("pain");
    var tier = health > 66 ? 0 : health > 33 ? 1 : 2;
    if (tier > lastTier) addCrack();
    lastTier = tier;
    if (health <= 0) {
      health = 0;
      gameOver();
    }
  }

  function gameOver() {
    over = true;
    face.trigger("ko");
    audio.ko();
    audio.setEngine(0, false);
    if (score > best) {
      best = score;
      localStorage.setItem("gta_best_stunts", String(best));
    }
  }

  function addFloat(x, y, text, color) {
    floats.push({ x: x, y: y, text: text, color: color, life: 1.4 });
  }

  function spawnSparks(x, y) {
    for (var i = 0; i < 12; i++) {
      var a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 180;
      sparks.push({
        x: x, y: y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40,
        life: 0.25 + Math.random() * 0.3,
        color: Math.random() < 0.6 ? "#ffb347" : "#ffe66e"
      });
    }
  }

  function addCrack() {
    var ox = 120 + Math.random() * 400, oy = 100 + Math.random() * 180;
    var branches = [];
    var n = 4 + Math.floor(Math.random() * 3);
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var pts = [{ x: ox, y: oy }];
      var x = ox, y = oy;
      for (var s = 0; s < 3; s++) {
        var len = 18 + Math.random() * 34;
        a += (Math.random() - 0.5) * 0.9;
        x += Math.cos(a) * len; y += Math.sin(a) * len;
        pts.push({ x: x, y: y });
      }
      branches.push(pts);
    }
    cracks.push(branches);
  }

  /* ---------------------------- projekce ---------------------------- */

  function project(p, camX, camY, camZ) {
    p.camera.x = (p.world.x || 0) - camX;
    p.camera.y = (p.world.y || 0) - camY;
    p.camera.z = (p.world.z || 0) - camZ;
    p.screen.scale = CAM_DEPTH / p.camera.z;
    p.screen.x = Math.round(W / 2 + p.screen.scale * p.camera.x * W / 2);
    p.screen.y = Math.round(H / 2 - p.screen.scale * p.camera.y * H / 2);
    p.screen.w = Math.round(p.screen.scale * ROAD_W * W / 2);
  }

  /* ----------------------------- render ----------------------------- */

  function render() {
    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake * 26,
                    (Math.random() - 0.5) * shake * 26);
    }

    drawSky();

    var base = findSegment(position);
    var basePct = (position % SEG_L) / SEG_L;
    var playerY = base.p1.world.y + (base.p2.world.y - base.p1.world.y) * basePct;
    var camY = playerY + CAM_H;

    var maxy = H;
    var x = 0, dxAcc = -(base.curve * basePct);

    for (var n = 0; n < DRAW_DIST; n++) {
      var seg = segments[(base.index + n) % N];
      var looped = seg.index < base.index;
      var camZ = position - (looped ? trackLen : 0);

      project(seg.p1, playerX * ROAD_W - x, camY, camZ);
      project(seg.p2, playerX * ROAD_W - x - dxAcc, camY, camZ);
      x += dxAcc;
      dxAcc += seg.curve;

      seg.clip = maxy;
      seg.fog = 1 / Math.pow(Math.E, (n / DRAW_DIST) * (n / DRAW_DIST) * FOG_DENSITY);

      if (seg.p1.camera.z <= CAM_DEPTH ||
          seg.p2.screen.y >= seg.p1.screen.y ||
          seg.p2.screen.y >= maxy) continue;

      renderSegment(seg);
      maxy = seg.p2.screen.y;
    }

    // sprity zezadu dopředu: semafory a auta
    var buckets = {};
    for (var i = 0; i < cars.length; i++) {
      var c = cars[i];
      var rel = (c.z - position + trackLen) % trackLen;
      // auta těsně u kamery / vedle hráče už nekreslit (projekce degeneruje)
      if (rel > PLAYER_Z * 0.75 && rel < DRAW_DIST * SEG_L) {
        var si = Math.floor(c.z / SEG_L) % N;
        (buckets[si] = buckets[si] || []).push(c);
      }
    }
    for (var m = DRAW_DIST - 1; m >= 1; m--) {
      var sg = segments[(base.index + m) % N];
      var ga = gantryBySeg[sg.index];
      if (ga) drawGantry(sg, ga);
      var arr = buckets[sg.index];
      if (arr) {
        for (var k = 0; k < arr.length; k++) drawCarSprite(sg, arr[k]);
      }
    }

    // částice a texty (světová vrstva)
    for (var s = 0; s < sparks.length; s++) {
      var sp = sparks[s];
      ctx.globalAlpha = Math.max(0, sp.life / 0.5);
      ctx.fillStyle = sp.color;
      ctx.fillRect(sp.x - 2, sp.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    for (var f = 0; f < floats.length; f++) {
      var fl = floats[f];
      ctx.globalAlpha = Math.min(1, fl.life);
      ctx.fillStyle = "#000";
      ctx.fillText(fl.text, fl.x + 1.5, fl.y + 1.5);
      ctx.fillStyle = fl.color;
      ctx.fillText(fl.text, fl.x, fl.y);
    }
    ctx.globalAlpha = 1;

    drawCockpit();
    ctx.restore();
  }

  function drawSky() {
    var grad = ctx.createLinearGradient(0, 0, 0, H * 0.55);
    grad.addColorStop(0, "#6fb9f2");
    grad.addColorStop(1, "#dff2fb");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // slunce
    ctx.fillStyle = "rgba(255,240,180,0.9)";
    ctx.beginPath(); ctx.arc(500, 62, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,240,180,0.25)";
    ctx.beginPath(); ctx.arc(500, 62, 44, 0, Math.PI * 2); ctx.fill();

    // hory (parallax podle zatáček)
    var hy = H * 0.45;
    ctx.fillStyle = "#3d5a52";
    ctx.beginPath();
    ctx.moveTo(0, hy + 40);
    for (var px = 0; px <= W; px += 8) {
      var yy = hy - Math.sin(px * 0.012 + mtOff) * 20 - Math.sin(px * 0.027 + mtOff * 1.7) * 10;
      ctx.lineTo(px, yy);
    }
    ctx.lineTo(W, hy + 60); ctx.lineTo(0, hy + 60);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#4c6e63";
    ctx.beginPath();
    ctx.moveTo(0, hy + 60);
    for (var px2 = 0; px2 <= W; px2 += 8) {
      var y2 = hy + 16 - Math.sin(px2 * 0.02 + mtOff * 0.6 + 2) * 12;
      ctx.lineTo(px2, y2);
    }
    ctx.lineTo(W, hy + 60); ctx.lineTo(0, hy + 60);
    ctx.closePath(); ctx.fill();
  }

  function renderSegment(seg) {
    var p1 = seg.p1.screen, p2 = seg.p2.screen;
    var alt = Math.floor(seg.index / 3) % 2;

    // tráva
    ctx.fillStyle = alt ? "#3f7a37" : "#376c30";
    ctx.fillRect(0, p2.y, W, p1.y - p2.y);

    // krajnice (červenobílá)
    poly(p1.x - p1.w * 1.15, p1.y, p1.x + p1.w * 1.15, p1.y,
         p2.x + p2.w * 1.15, p2.y, p2.x - p2.w * 1.15, p2.y,
         alt ? "#d84a4a" : "#e8e8e0");

    // asfalt
    poly(p1.x - p1.w, p1.y, p1.x + p1.w, p1.y,
         p2.x + p2.w, p2.y, p2.x - p2.w, p2.y,
         alt ? "#55555e" : "#50505a");

    // dělicí čáry (přerušované)
    if (alt) {
      var lw1 = p1.w * 0.018, lw2 = p2.w * 0.018;
      for (var l = -1; l <= 1; l += 2) {
        var c1 = p1.x + p1.w * (l / 3), c2 = p2.x + p2.w * (l / 3);
        poly(c1 - lw1, p1.y, c1 + lw1, p1.y, c2 + lw2, p2.y, c2 - lw2, p2.y, "#d8d8d0");
      }
    }

    // mlha
    if (seg.fog < 1) {
      ctx.globalAlpha = 1 - seg.fog;
      ctx.fillStyle = "#cfe6f2";
      ctx.fillRect(0, p2.y, W, p1.y - p2.y);
      ctx.globalAlpha = 1;
    }
  }

  function poly(x1, y1, x2, y2, x3, y3, x4, y4, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4);
    ctx.closePath(); ctx.fill();
  }

  function drawGantry(seg, ga) {
    var p = seg.p1.screen;
    var u = p.scale * (W / 2);
    var h = u * 1500;
    if (h < 8 || p.w <= 0) return;

    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, seg.clip); ctx.clip();

    var lx = p.x - p.w * 1.18, rx = p.x + p.w * 1.18;
    var pw = Math.max(2, u * 70);
    ctx.fillStyle = "#2c2c30";
    ctx.fillRect(lx - pw / 2, p.y - h, pw, h);
    ctx.fillRect(rx - pw / 2, p.y - h, pw, h);
    ctx.fillRect(lx - pw / 2, p.y - h, rx - lx + pw, Math.max(2, u * 100));

    // budka se světly uprostřed
    var bw = u * 150, bh = u * 400;
    if (bw > 5) {
      var bx = p.x - bw / 2, by = p.y - h + u * 100;
      ctx.fillStyle = "#1d1d20";
      ctx.fillRect(bx, by, bw, bh);
      var st = lightState(timeT + ga.off);
      var r = bw * 0.28;
      circle(p.x, by + bh * 0.2, r, st === "red" ? "#ff3131" : "#4a1414");
      circle(p.x, by + bh * 0.5, r, st === "orange" ? "#ffb62e" : "#4a3a12");
      circle(p.x, by + bh * 0.8, r, st === "green" ? "#42e05c" : "#12421c");
    }
    ctx.restore();
  }

  function drawCarSprite(seg, car) {
    var pct = (car.z % SEG_L) / SEG_L;
    var scale = lerp(seg.p1.screen.scale, seg.p2.screen.scale, pct);
    var roadX = lerp(seg.p1.screen.x, seg.p2.screen.x, pct);
    var baseY = lerp(seg.p1.screen.y, seg.p2.screen.y, pct);
    var cx = roadX + scale * car.offset * ROAD_W * (W / 2);
    var wPx = scale * (W / 2) * car.type.ww;
    if (wPx < 4) return;

    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, seg.clip); ctx.clip();
    ctx.translate(cx, baseY);
    var s = wPx / 100;
    ctx.scale(s, s);
    if (car.wrecked) ctx.rotate(0.2 * (car.vx >= 0 ? 1 : -1));

    var t = car.type;
    var body = car.wrecked ? "#6e6e6e" : t.color;
    var roof = car.wrecked ? "#565656" : t.roof;

    // kola
    ctx.fillStyle = "#191b1e";
    ctx.fillRect(-46, -14, 15, 14);
    ctx.fillRect(31, -14, 15, 14);
    // karoserie zezadu
    rr(-44, -56, 88, 52, 8, body);
    rr(-34, -86, 68, 36, 7, roof);
    rr(-28, -80, 56, 22, 4, "#22262c");
    ctx.fillStyle = "#cfd6dd";
    ctx.fillRect(-44, -12, 88, 7);
    ctx.fillStyle = car.wrecked ? "#552222" : "#e02121";
    ctx.fillRect(-42, -30, 12, 8);
    ctx.fillRect(30, -30, 12, 8);

    if (t.ambulance && !car.wrecked) {
      ctx.fillStyle = "#e02121";
      ctx.fillRect(-44, -44, 88, 10);
      ctx.fillRect(-5, -74, 10, 26);
      ctx.fillRect(-13, -66, 26, 10);
      if (Math.floor(timeT * 6) % 2 === 0) circle(0, -92, 7, "#4aa8ff");
    }
    if (t.ev && !car.wrecked) {
      ctx.fillStyle = "#eafff9";
      ctx.font = "bold 24px Arial";
      ctx.textAlign = "center";
      ctx.fillText("⚡", 0, -60);
    }
    if (car.wrecked) {
      ctx.strokeStyle = "#33363b"; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-36, -70); ctx.lineTo(20, -46); ctx.lineTo(-16, -22);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ----------------------------- kokpit ----------------------------- */

  function drawCockpit() {
    // A-sloupky
    ctx.fillStyle = "#17130f";
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(26, 0); ctx.lineTo(5, DASH_TOP); ctx.lineTo(0, DASH_TOP);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(W, 0); ctx.lineTo(W - 26, 0); ctx.lineTo(W - 5, DASH_TOP); ctx.lineTo(W, DASH_TOP);
    ctx.closePath(); ctx.fill();
    ctx.fillRect(0, 0, W, 6);

    // praskliny na skle
    if (cracks.length) {
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1.4;
      for (var c = 0; c < cracks.length; c++) {
        var branches = cracks[c];
        for (var b = 0; b < branches.length; b++) {
          var pts = branches[b];
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (var p = 1; p < pts.length; p++) ctx.lineTo(pts[p].x, pts[p].y);
          ctx.stroke();
        }
      }
    }

    // palubní deska — ořechové dřevo
    ctx.fillStyle = "#241a12";
    ctx.fillRect(0, DASH_TOP, W, H - DASH_TOP);
    ctx.strokeStyle = "rgba(140,95,50,0.3)";
    ctx.lineWidth = 2;
    for (var wgl = 0; wgl < 4; wgl++) {
      ctx.beginPath();
      ctx.moveTo(0, DASH_TOP + 26 + wgl * 26);
      ctx.quadraticCurveTo(W / 2, DASH_TOP + 14 + wgl * 28, W, DASH_TOP + 26 + wgl * 26);
      ctx.stroke();
    }
    ctx.fillStyle = "#cfd6dd";
    ctx.fillRect(0, DASH_TOP, W, 5);
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(0, DASH_TOP + 5, W, 3);

    // budíky
    drawGauge(150, 416, 46, Math.min(1, speed / MAXS), "km/h", 0.85, Math.round(speed));
    var revs = over ? 0 : 0.12 + (speed / MAXS) * 0.72 +
      Math.sin(timeT * 31) * 0.02 * (speed / MAXS);
    drawGauge(490, 416, 46, Math.min(1, revs), "ot/min", 0.8, null);

    // stav vozu
    ctx.fillStyle = "#9aa0a8";
    ctx.font = "bold 10px Arial";
    ctx.textAlign = "center";
    ctx.fillText("KAROSERIE", 320, DASH_TOP + 15);
    ctx.fillStyle = "#0f0f12";
    ctx.fillRect(250, DASH_TOP + 20, 140, 12);
    var hw = Math.max(0, health / 100) * 136;
    ctx.fillStyle = health > 50 ? "#42e05c" : health > 25 ? "#ffb62e" : "#ff3131";
    ctx.fillRect(252, DASH_TOP + 22, hw, 8);
    ctx.strokeStyle = "#4c4c55";
    ctx.strokeRect(250.5, DASH_TOP + 20.5, 139, 11);

    drawWheel();
    drawMirror();
    drawHud();
  }

  function drawGauge(cx, cy, r, val01, label, redFrom, digital) {
    var a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;

    ctx.fillStyle = "#101014";
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#cfd6dd"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();

    // červené pole
    ctx.strokeStyle = "#e02121"; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 8, a0 + (a1 - a0) * redFrom, a1);
    ctx.stroke();

    // rysky
    ctx.strokeStyle = "#d8d8d0"; ctx.lineWidth = 2;
    for (var i = 0; i <= 8; i++) {
      var a = a0 + (a1 - a0) * (i / 8);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (r - 6), cy + Math.sin(a) * (r - 6));
      ctx.lineTo(cx + Math.cos(a) * (r - 13), cy + Math.sin(a) * (r - 13));
      ctx.stroke();
    }

    // ručička
    var an = a0 + (a1 - a0) * Math.max(0, Math.min(1, val01));
    ctx.strokeStyle = "#ff5039"; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(an) * (r - 12), cy + Math.sin(an) * (r - 12));
    ctx.stroke();
    circle(cx, cy, 5, "#cfd6dd");

    ctx.fillStyle = "#9aa0a8";
    ctx.font = "bold 9px Arial";
    ctx.textAlign = "center";
    ctx.fillText(label, cx, cy + r * 0.55);
    if (digital !== null) {
      ctx.fillStyle = "#e8e8e8";
      ctx.font = "bold 13px Arial";
      ctx.fillText(String(digital), cx, cy + r + 14);
    }
  }

  function drawWheel() {
    var cx = 320, cy = 562, R = 168;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(wheelAngle);

    // dřevěný věnec
    ctx.strokeStyle = "#3a2413"; ctx.lineWidth = 19;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "#5a3a20"; ctx.lineWidth = 13;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, R - 4, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();

    // paprsky (jen horní jsou vidět — střed volantu je pod obrazovkou)
    ctx.strokeStyle = "#b9c0c7"; ctx.lineWidth = 10; ctx.lineCap = "round";
    spoke(Math.PI * 1.3, R);
    spoke(Math.PI * 1.7, R);

    // ruce: sako, manžeta, dlaň — „za deset dvě"
    drawHand(Math.PI * 1.3, R);
    drawHand(Math.PI * 1.7, R);

    ctx.restore();
  }

  function spoke(a, R) {
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 34, Math.sin(a) * 34);
    ctx.lineTo(Math.cos(a) * (R - 10), Math.sin(a) * (R - 10));
    ctx.stroke();
  }

  function drawHand(a, R) {
    ctx.save();
    ctx.translate(Math.cos(a) * R, Math.sin(a) * R);
    ctx.rotate(a + Math.PI / 2);
    rr(-11, 8, 22, 26, 6, "#1c2a4a");     // rukáv saka
    rr(-11, 2, 22, 8, 3, "#e9e9e9");      // manžeta
    ctx.fillStyle = "#e8b98a";
    ctx.beginPath(); ctx.ellipse(0, -3, 11, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-9, -8, 4.5, 6, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawMirror() {
    // stopka a chromový rám
    ctx.fillStyle = "#17130f";
    ctx.fillRect(310, 0, 20, 12);
    rr(218, 8, 204, 90, 12, "#cfd6dd");
    rr(224, 14, 192, 78, 8, "#101014");

    // tvář v zrcadle (zrcadlově převrácená)
    ctx.save();
    ctx.beginPath();
    roundRectPath(224, 14, 192, 78, 8);
    ctx.clip();
    ctx.save();
    ctx.translate(320 + 39, 12);
    ctx.scale(-1, 1);
    face.draw(ctx, 0, 0, 78, { frameless: true });
    ctx.restore();
    // odlesk skla
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.moveTo(238, 14); ctx.lineTo(300, 14); ctx.lineTo(252, 92); ctx.lineTo(224, 92);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawHud() {
    ctx.textAlign = "left";
    outlineText("HLASY " + fmt(score), 14, 56, "bold 22px Arial", "#ffd23f");
    if (comboTimer > 0 && combo > 1) {
      outlineText("KOMBO ×" + mult(), 14, 80, "bold 17px Arial", "#ff8c42");
    }
    ctx.textAlign = "right";
    outlineText("REKORD " + fmt(best), W - 14, 30, "bold 14px Arial", "#c9c9d4");
  }

  function outlineText(text, x, y, font, color) {
    ctx.font = font;
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#000";
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  /* --------------------------- pomocníci --------------------------- */

  function lerp(a, b, t) { return a + (b - a) * t; }

  function circle(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  function roundRectPath(x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function rr(x, y, w, h, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    roundRectPath(x, y, w, h, r);
    ctx.fill();
  }

  function fmt(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }

  /* ---------------------------- bootstrap ---------------------------- */

  buildTrack();
  reset();

  var elStart = document.getElementById("overlay-start");
  var elOver = document.getElementById("overlay-over");
  var elHeadline = document.getElementById("np-headline");
  var elStats = document.getElementById("np-stats");
  var elBest = document.getElementById("np-best");

  var HEADLINES = [
    "PILOT T. DOJEZDIL!",
    "ZRCÁTKO SE UŽ NEŠKLEBÍ",
    "VETERÁN NA ŠROTIŠTI, HLASY V TRAPU",
    "BUDÍKY SPADLY NA NULU",
    "KOMENTÁTOŘI: „TO SE NEDALO PŘEHLÉDNOUT“"
  ];

  function resize() {
    var scale = Math.min(window.innerWidth / W, window.innerHeight / H);
    var wrap = document.getElementById("game-wrap");
    wrap.style.width = canvas.style.width = Math.floor(W * scale) + "px";
    wrap.style.height = canvas.style.height = Math.floor(H * scale) + "px";
  }
  window.addEventListener("resize", resize);
  resize();

  var KEYMAP = {
    ArrowLeft: "left", KeyA: "left",
    ArrowRight: "right", KeyD: "right",
    ArrowUp: "up", KeyW: "up",
    ArrowDown: "down", KeyS: "down"
  };

  window.addEventListener("keydown", function (e) {
    if (e.code in KEYMAP) { input[KEYMAP[e.code]] = true; e.preventDefault(); }
    if (e.code === "KeyM") audio.toggleMute();
    if (e.code === "Enter" && state === "menu") start();
    if (e.code === "KeyR" && state !== "menu") restart();
    if (e.code === "Escape") location.href = "index.html";
  });
  window.addEventListener("keyup", function (e) {
    if (e.code in KEYMAP) input[KEYMAP[e.code]] = false;
  });

  document.getElementById("btn-start").addEventListener("click", start);
  document.getElementById("btn-restart").addEventListener("click", restart);

  function start() {
    audio.init();
    if (audio.ctx && audio.ctx.state === "suspended") audio.ctx.resume();
    elStart.classList.add("hidden");
    state = "playing";
  }

  function restart() {
    audio.init();
    reset();
    elOver.classList.add("hidden");
    state = "playing";
  }

  function showGameOver() {
    state = "over";
    elHeadline.textContent = HEADLINES[Math.floor(Math.random() * HEADLINES.length)];
    elStats.innerHTML =
      "Získáno <b>" + fmt(score) + "</b> preferenčních hlasů.<br>" +
      "Sestřeleno <b>" + wrecksN + "</b> aut na <b>" +
      (distanceM / 1000).toFixed(1) + " km</b>.";
    elBest.textContent = score >= best && score > 0
      ? "NOVÝ REKORD!"
      : "Rekord: " + fmt(best) + " hlasů";
    elOver.classList.remove("hidden");
  }

  var last = performance.now();
  function frame(now) {
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    if (state === "playing") {
      update(dt);
      if (over) showGameOver();
    } else {
      face.update(dt, { health: health, sunglasses: false });
    }

    ctx.clearRect(0, 0, W, H);
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
