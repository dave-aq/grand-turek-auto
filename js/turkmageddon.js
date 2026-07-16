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
  var MAXS = 325;                  // km/h — rekord od Ostravy
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
        cross: false, zebra: false, bldg: null,
        p1: { world: { x: 0, y: yAt(i), z: i * SEG_L }, camera: {}, screen: {} },
        p2: { world: { x: 0, y: yAt(i + 1), z: (i + 1) * SEG_L }, camera: {}, screen: {} }
      });
    }

    // semafory — každý pruh má vlastní náhodnou fázi
    var g = 220;
    while (g < N - 120) {
      var ga = {
        seg: segments[g], z: g * SEG_L,
        offs: [Math.random() * 7.7, Math.random() * 7.7, Math.random() * 7.7]
      };
      gantries.push(ga);
      gantryBySeg[g] = ga;
      g += 260 + Math.floor(Math.random() * 180);
    }

    // křižovatky kolem semaforů: příčná ulice + přechod pro chodce
    for (var gi = 0; gi < gantries.length; gi++) {
      var gs = Math.floor(gantries[gi].z / SEG_L);
      for (var d = -8; d <= 8; d++) {
        var sIdx = (gs + d + N) % N;
        segments[sIdx].cross = true;
        if (d === -3 || d === -4) segments[sIdx].zebra = true;
      }
    }

    // domy podél silnice (mimo křižovatky)
    for (var bi = 0; bi < N; bi += 4) {
      var sb = segments[bi];
      if (sb.cross) continue;
      var hsh = Math.abs(Math.sin(bi * 12.9898) * 43758.5453) % 1;
      sb.bldg = {
        side: Math.floor(bi / 4) % 2 === 0 ? -1 : 1,
        h: 900 + hsh * 1700,
        color: BLDG_COLORS[Math.floor(hsh * BLDG_COLORS.length)]
      };
    }
  }

  var BLDG_COLORS = ["#6e7681", "#7a7066", "#5f6a74", "#857e6f", "#5d675f"];

  function findSegment(z) {
    return segments[Math.floor(z / SEG_L) % N];
  }

  // 8s cyklus: zelená 2 s (25 %), oranžová 2 s (25 %), červená 4 s (50 %)
  function lightState(phase) {
    var t = phase % 8;
    if (t < 2) return "green";
    if (t < 4) return "orange";
    return "red";
  }

  /* --------------------------- stav hry --------------------------- */

  var face = new GTA.FaceCam();
  var audio = new GTA.AudioSys();
  var state = "menu";  // menu | playing | over
  var input = { left: false, right: false, up: false, down: false };

  var position, prevPos, speed, playerX, wheelAngle;
  var health, lastTier, score, best, combo, comboTimer, wrecksN, distanceM, timeT;
  var cars, floats, sparks, cracks, banners, shake, rageCd, over, mtOff;
  var flowActive, flowOstrava, flowTotal, flowCarry;

  best = parseInt(localStorage.getItem("gta_best_stunts") || "0", 10);

  function reset() {
    position = 0; prevPos = 0; speed = 0; playerX = 0; wheelAngle = 0;
    health = 100; lastTier = 0; score = 0; combo = 0; comboTimer = 0;
    wrecksN = 0; distanceM = 0; timeT = 0;
    floats = []; sparks = []; cracks = []; banners = [];
    shake = 0; rageCd = 0; mtOff = 0;
    flowActive = false; flowOstrava = false; flowTotal = 0; flowCarry = 0;
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

    var steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);

    if (input.up) speed += 60 * dt;
    else if (input.down) speed -= 125 * dt;
    else speed -= 12 * dt;

    // zatáčení žere rychlost — BOMBY udržíš jen rovně
    if (steer !== 0) speed -= dt * (20 + 70 * (speed / MAXS));

    var offroad = Math.abs(playerX) > 1.02;
    if (offroad && speed > 70) speed -= 100 * dt;
    speed = Math.max(0, Math.min(MAXS, speed));

    // PLYNULÁ JÍZDA: od 200 km/h naskakují hlasy (100/s);
    // na maximálce 325 se přepne REŽIM OSTRAVA (300/s)
    if (speed >= 200) {
      if (!flowActive) { flowActive = true; flowTotal = 0; flowCarry = 0; }
      flowOstrava = speed >= MAXS - 0.5;
      flowCarry += (flowOstrava ? 300 : 100) * dt;
      var whole = Math.floor(flowCarry);
      if (whole > 0) { score += whole; flowTotal += whole; flowCarry -= whole; }
    } else if (flowActive) {
      flowActive = false;
      flowOstrava = false;
      if (flowTotal > 0) {
        addFloat(W / 2, H * 0.35, "Plynulá jízda! +" + flowTotal + " hlasů", "#ffd23f");
      }
    }

    var speedPct = speed / MAXS;
    prevPos = position;
    position = (position + speed * UNITS * dt) % trackLen;
    distanceM += (speed / 3.6) * dt;

    var base = findSegment(position);

    var dx = dt * 1.8 * speedPct;
    playerX += steer * dx;
    playerX -= dx * speedPct * base.curve * CENTRIFUGAL;
    playerX = Math.max(-1.15, Math.min(1.15, playerX));   // městský obrubník
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
        // rozhoduje semafor pruhu, kterým hráč zrovna projíždí
        var lane = playerX < -0.33 ? 0 : playerX > 0.33 ? 2 : 1;
        if (lightState(timeT + ga.offs[lane]) === "red" && speed > 25) {
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
    updateBanners(dt);

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

    // hranatá legenda má pořádné auto — vydrží řádově víc ran
    var dmg = (3 + relKmh * 0.08) * (c.type.tough || 1);

    if (c.type.ambulance) {
      dmg *= 1.4;
      score = Math.max(0, score - 500);
      combo = 0; comboTimer = 0;
      face.trigger("panic");
      audio.penalty();
      audio.crash(relKmh / 150);
      addBanner("SANITKA! SKANDÁL! −500", "#e01414", 46, 3.2, 118, true);
    } else {
      var prevM = mult();
      combo += 1;
      comboTimer = 4;
      var m = mult();
      // velké oznámení pokaždé, když násobič povyroste
      if (m > 1 && m > prevM) {
        addBanner("SPIRÁLA REALISMU ×" + m + "!", "#ff8c42", 20 + m * 4, 1.7, 196, false);
      }
      var gain = c.type.votes * m;
      if (c.type.ev) gain += 150;              // bonus za elektromobil
      score += gain;
      wrecksN += 1;
      face.trigger("kill");
      audio.crash(relKmh / 150);
      addFloat(fx, fy - 30, "+" + gain + " hlasů" + (m > 1 ? " ×" + m : ""), "#7dff6e");
      if (c.type.ev) {
        addBanner("⚡ ELEKTROMOBIL! +" + gain, "#5ff0d4", 32, 2.2, 152, false);
        addFloat(fx, fy - 8, "Emise −100 %?", "#3fc1a9");
      }
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

  function addBanner(text, color, size, life, y, blood) {
    var b = { text: text, color: color, size: size, life: life, maxLife: life,
              y: y, shake: blood, drips: null };
    if (blood) {
      ctx.save();
      ctx.font = "bold " + size + "px Arial";
      var tw = ctx.measureText(text).width;
      ctx.restore();
      b.drips = [];
      for (var i = 0; i < 10; i++) {
        b.drips.push({
          x: -tw / 2 + 12 + Math.random() * (tw - 24),
          len: 0,
          v: 22 + Math.random() * 42,
          max: 26 + Math.random() * 70
        });
      }
    }
    banners.push(b);
  }

  function updateBanners(dt) {
    for (var i = banners.length - 1; i >= 0; i--) {
      var b = banners[i];
      b.life -= dt;
      if (b.drips) {
        for (var d = 0; d < b.drips.length; d++) {
          var dr = b.drips[d];
          dr.len = Math.min(dr.max, dr.len + dr.v * dt);
        }
      }
      if (b.life <= 0) banners.splice(i, 1);
    }
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
      if (sg.bldg) drawBuilding(sg);
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
    drawBanners();
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

    // pražské panorama — Hradčany s katedrálou a střechy Starého Města
    var hy = H * 0.45;
    pragueCastleLayer(hy + 6, mtOff * 5);
    oldTownLayer(hy + 22, mtOff * 10);
    ctx.fillStyle = "rgba(207,230,242,0.22)";   // letní opar nad Vltavou
    ctx.fillRect(0, hy - 80, W, 100);
  }

  // vrstva 1: silueta Hradčan — hradní kopec, dlouhý palác, sv. Vít
  function pragueCastleLayer(baseY, sc) {
    var P = 900;
    var off = -(((sc % P) + P) % P);
    for (var x0 = off - P; x0 < W + P; x0 += P) {
      drawHradcany(x0, baseY);
    }
    ctx.fillStyle = "#8c937f";
    ctx.fillRect(0, baseY + 12, W, 12);
  }

  function drawHradcany(x0, baseY) {
    // zelený hradní kopec, zbytek periody nízký hřeben
    ctx.fillStyle = "#7d8a72";
    ctx.beginPath();
    ctx.moveTo(x0 - 60, baseY + 14);
    ctx.lineTo(x0 + 30, baseY - 16);
    ctx.lineTo(x0 + 540, baseY - 16);
    ctx.lineTo(x0 + 640, baseY + 14);
    ctx.lineTo(x0 + 900, baseY + 14);
    ctx.lineTo(x0 + 900, baseY + 24);
    ctx.lineTo(x0 - 60, baseY + 24);
    ctx.closePath(); ctx.fill();

    // dlouhá fasáda paláce
    ctx.fillStyle = "#cfc2a3";
    ctx.fillRect(x0 + 40, baseY - 42, 470, 28);
    ctx.fillStyle = "#8f8672";
    ctx.fillRect(x0 + 40, baseY - 48, 470, 8);
    ctx.fillStyle = "rgba(90,80,60,0.5)";
    for (var wx = x0 + 52; wx < x0 + 500; wx += 16) {
      ctx.fillRect(wx, baseY - 34, 3, 8);
    }
    // věžičky se zelenými báněmi na krajích paláce
    towerRound(x0 + 52, baseY - 48, 10, 16);
    towerRound(x0 + 492, baseY - 48, 10, 16);

    // katedrála sv. Víta
    var cx = x0 + 250;
    ctx.fillStyle = "#6b6257";
    ctx.fillRect(cx - 8, baseY - 78, 62, 36);                 // loď
    ctx.beginPath();
    ctx.moveTo(cx - 8, baseY - 78);
    ctx.lineTo(cx + 23, baseY - 86);
    ctx.lineTo(cx + 54, baseY - 78);
    ctx.closePath(); ctx.fill();
    // dvě západní gotické věže
    gothicSpire(cx - 26, baseY - 42, 9, 42, 22, "#5c554b");
    gothicSpire(cx - 12, baseY - 42, 9, 42, 22, "#5c554b");
    // hlavní jižní věž se zelenou špicí
    ctx.fillStyle = "#6b6257";
    ctx.fillRect(cx + 34, baseY - 96, 13, 54);
    ctx.fillStyle = "#5f8a74";
    ctx.beginPath();
    ctx.moveTo(cx + 32, baseY - 96);
    ctx.lineTo(cx + 40.5, baseY - 118);
    ctx.lineTo(cx + 49, baseY - 96);
    ctx.closePath(); ctx.fill();
    // fiály na lodi
    for (var f = 0; f < 3; f++) {
      gothicSpire(cx + 2 + f * 16, baseY - 80, 3, 6, 8, "#5c554b");
    }
  }

  // vrstva 2: střechy Starého Města — domy, Týn, měděné kupole
  function oldTownLayer(baseY, sc) {
    var bw = 36;
    var first = Math.floor(sc / bw);
    var shift = sc - first * bw;
    for (var i = -2; i <= W / bw + 2; i++) {
      var col = first + i;
      var hsh = Math.abs(Math.sin(col * 12.9898) * 43758.5453) % 1;
      var bx = i * bw - shift;
      var kind = ((col % 11) + 11) % 11;
      if (kind === 0) {
        // týnské dvojvěží
        gothicSpire(bx + 4, baseY, 8, 22, 14, "#4a463f");
        gothicSpire(bx + 20, baseY, 8, 22, 14, "#4a463f");
      } else if (kind === 5) {
        // věž s měděnou kupolí (sv. Mikuláš)
        ctx.fillStyle = "#d8cdb2";
        ctx.fillRect(bx + 8, baseY - 20, 16, 20);
        ctx.fillStyle = "#5f8a74";
        ctx.beginPath(); ctx.arc(bx + 16, baseY - 20, 9, Math.PI, 0); ctx.fill();
        ctx.fillRect(bx + 14, baseY - 33, 4, 7);
      } else {
        // měšťanský dům s červenou střechou
        var wallH = 12 + hsh * 10;
        ctx.fillStyle = ["#d8cdb2", "#cec2a4", "#c9bc9e"][Math.floor(hsh * 3)];
        ctx.fillRect(bx, baseY - wallH, bw - 4, wallH);
        ctx.fillStyle = hsh > 0.5 ? "#a35a44" : "#b06a4e";
        ctx.beginPath();
        ctx.moveTo(bx - 2, baseY - wallH);
        ctx.lineTo(bx + (bw - 4) / 2, baseY - wallH - 9 - hsh * 6);
        ctx.lineTo(bx + bw - 2, baseY - wallH);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(80,70,55,0.55)";
        ctx.fillRect(bx + 6, baseY - wallH + 4, 3, 4);
        ctx.fillRect(bx + 14, baseY - wallH + 4, 3, 4);
      }
    }
    // souvislý pás fasád pod střechami
    ctx.fillStyle = "#c9bc9e";
    ctx.fillRect(0, baseY - 2, W, 24);
  }

  function gothicSpire(x, baseY, w, bodyH, spikeH, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, baseY - bodyH, w, bodyH);
    ctx.beginPath();
    ctx.moveTo(x - 1, baseY - bodyH);
    ctx.lineTo(x + w / 2, baseY - bodyH - spikeH);
    ctx.lineTo(x + w + 1, baseY - bodyH);
    ctx.closePath(); ctx.fill();
  }

  function towerRound(x, baseY, w, h) {
    ctx.fillStyle = "#c5b898";
    ctx.fillRect(x - w / 2, baseY - h, w, h);
    ctx.fillStyle = "#5f8a74";
    ctx.beginPath();
    ctx.arc(x, baseY - h, w / 2 + 1, Math.PI, 0);
    ctx.fill();
  }

  function renderSegment(seg) {
    var p1 = seg.p1.screen, p2 = seg.p2.screen;
    var alt = Math.floor(seg.index / 3) % 2;

    // okolí: chodníky, na křižovatce asfalt příčné ulice přes celou šíři
    ctx.fillStyle = seg.cross ? "#46464e" : (alt ? "#84898f" : "#7b8086");
    ctx.fillRect(0, p2.y, W, p1.y - p2.y);

    // obrubník (mimo křižovatku)
    if (!seg.cross) {
      poly(p1.x - p1.w * 1.15, p1.y, p1.x + p1.w * 1.15, p1.y,
           p2.x + p2.w * 1.15, p2.y, p2.x - p2.w * 1.15, p2.y,
           alt ? "#d84a4a" : "#e8e8e0");
    }

    // asfalt
    poly(p1.x - p1.w, p1.y, p1.x + p1.w, p1.y,
         p2.x + p2.w, p2.y, p2.x - p2.w, p2.y,
         alt ? "#55555e" : "#50505a");

    // přechod pro chodce před semaforem
    if (seg.zebra) {
      for (var zi = 0; zi < 9; zi += 2) {
        var t0 = zi / 9, t1 = (zi + 1) / 9;
        poly(lerp(p1.x - p1.w, p1.x + p1.w, t0), p1.y,
             lerp(p1.x - p1.w, p1.x + p1.w, t1), p1.y,
             lerp(p2.x - p2.w, p2.x + p2.w, t1), p2.y,
             lerp(p2.x - p2.w, p2.x + p2.w, t0), p2.y, "#e8e8e0");
      }
    }

    // dělicí čáry (přerušované, mimo křižovatku)
    if (alt && !seg.cross) {
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

  // dům podél silnice — fasáda s okny, mizí v oparu
  function drawBuilding(seg) {
    var b = seg.bldg;
    var p = seg.p1.screen;
    if (p.w <= 0) return;
    var u = p.scale * (W / 2);
    var bw2 = u * 780, bh2 = u * b.h;
    if (bw2 < 3) return;
    var x = p.x + p.w * b.side * 1.95;

    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, seg.clip); ctx.clip();
    ctx.globalAlpha = Math.max(0.15, seg.fog);
    ctx.fillStyle = b.color;
    ctx.fillRect(x - bw2 / 2, p.y - bh2, bw2, bh2);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(x - bw2 / 2, p.y - bh2, bw2, Math.max(1.5, u * 60));
    if (bw2 > 16) {
      ctx.fillStyle = "rgba(255,226,140,0.55)";
      var rows = Math.min(7, Math.floor(bh2 / (u * 300)) + 2);
      for (var wy = 0; wy < rows; wy++) {
        for (var wx = 0; wx < 3; wx++) {
          if ((seg.index + wy * 3 + wx) % 3 === 0) continue;
          ctx.fillRect(x - bw2 / 2 + bw2 * (0.16 + wx * 0.28),
                       p.y - bh2 + bh2 * (0.1 + wy * 0.82 / rows),
                       bw2 * 0.13, Math.max(1.5, u * 100));
        }
      }
    }
    ctx.restore();
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

    // budka se světly nad každým pruhem — každý pruh svítí jinak
    var bw = u * 130, bh = u * 380;
    if (bw > 4) {
      for (var li = 0; li < 3; li++) {
        var cx2 = p.x + p.w * (-0.66 + 0.66 * li);
        var bx = cx2 - bw / 2, by = p.y - h + u * 100;
        ctx.fillStyle = "#1d1d20";
        ctx.fillRect(bx, by, bw, bh);
        var st = lightState(timeT + ga.offs[li]);
        var r = bw * 0.26;
        circle(cx2, by + bh * 0.2, r, st === "red" ? "#ff3131" : "#4a1414");
        circle(cx2, by + bh * 0.5, r, st === "orange" ? "#ffb62e" : "#4a3a12");
        circle(cx2, by + bh * 0.8, r, st === "green" ? "#42e05c" : "#12421c");
      }
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

    // kapota G-čka s blinkry na blatnících (z kokpitu jsou vidět)
    ctx.fillStyle = "#26282c";
    ctx.beginPath();
    ctx.moveTo(36, DASH_TOP); ctx.lineTo(W - 36, DASH_TOP);
    ctx.lineTo(W - 78, DASH_TOP - 30); ctx.lineTo(78, DASH_TOP - 30);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#3a3e44"; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(78, DASH_TOP - 29); ctx.lineTo(W - 78, DASH_TOP - 29);
    ctx.stroke();
    blinkerPod(96, DASH_TOP - 30);
    blinkerPod(W - 96, DASH_TOP - 30);

    // palubní deska — černá kůže s prošitím
    ctx.fillStyle = "#1b1c1f";
    ctx.fillRect(0, DASH_TOP, W, H - DASH_TOP);
    ctx.fillStyle = "#0e0f11";
    ctx.fillRect(0, DASH_TOP, W, 4);
    ctx.strokeStyle = "rgba(200,200,210,0.16)";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 4]);
    line(0, DASH_TOP + 9, W, DASH_TOP + 9);
    ctx.setLineDash([]);

    // levý hliníkový panel s kruhovými výdechy
    rr(24, 366, 150, 58, 29, "#b9c0c7");
    drawVent(64, 395, 22);
    drawVent(134, 395, 22);

    // přístrojový štít (widescreen se dvěma kulatými budíky)
    rr(198, 358, 244, 64, 10, "#0a0b0d");
    ctx.strokeStyle = "#4c4f55"; ctx.lineWidth = 2;
    ctx.beginPath(); roundRectPath(198, 358, 244, 64, 10); ctx.stroke();
    drawDial(240, 390, 24, Math.min(1, speed / MAXS));
    var revs = over ? 0 : 0.12 + (speed / MAXS) * 0.72 +
      Math.sin(timeT * 31) * 0.02 * (speed / MAXS);
    drawDial(400, 390, 24, Math.min(1, revs));
    ctx.textAlign = "center";
    ctx.fillStyle = "#e8e8e8"; ctx.font = "bold 22px Arial";
    ctx.fillText(String(Math.round(speed)), 320, 392);
    ctx.fillStyle = "#9aa0a8"; ctx.font = "9px Arial";
    ctx.fillText("km/h", 320, 403);
    // stav karoserie jako proužek ve štítu
    ctx.fillStyle = "#0f0f12";
    ctx.fillRect(284, 406, 72, 8);
    ctx.fillStyle = health > 50 ? "#42e05c" : health > 25 ? "#ffb62e" : "#ff3131";
    ctx.fillRect(286, 408, Math.max(0, health / 100) * 68, 4);

    // infotainment displej vpravo — skóre jako palubní obrazovka
    rr(470, 358, 160, 72, 8, "#0a0b0d");
    ctx.strokeStyle = "#4c4f55"; ctx.lineWidth = 2;
    ctx.beginPath(); roundRectPath(470, 358, 160, 72, 8); ctx.stroke();
    drawStar(486, 372, 7);
    ctx.textAlign = "left";
    ctx.fillStyle = "#9aa0a8"; ctx.font = "bold 10px Arial";
    ctx.fillText("PREFERENČNÍ HLASY", 500, 376);
    ctx.fillStyle = "#ffd23f"; ctx.font = "bold 22px Arial";
    ctx.fillText(fmt(score), 484, 402);
    if (comboTimer > 0 && combo > 1) {
      ctx.fillStyle = "#ff8c42"; ctx.font = "bold 14px Arial";
      ctx.fillText("KOMBO ×" + mult(), 484, 420);
    } else {
      ctx.fillStyle = "#6a6a74"; ctx.font = "10px Arial";
      ctx.fillText("rekord: " + fmt(best), 484, 420);
    }

    // střední panel s výdechy pod displejem
    rr(470, 436, 160, 38, 10, "#b9c0c7");
    drawVent(505, 455, 13);
    drawVent(550, 455, 13);
    drawVent(595, 455, 13);

    drawWheel();
    drawMirror();
  }

  function blinkerPod(cx, baseY) {
    rr(cx - 9, baseY - 9, 18, 10, 3, "#26282c");
    rr(cx - 6, baseY - 13, 12, 5, 2, "#ffb62e");
  }

  function drawVent(cx, cy, r) {
    circle(cx, cy, r, "#8f979e");
    circle(cx, cy, r - 2, "#1f2124");
    ctx.strokeStyle = "#585d64"; ctx.lineWidth = 2;
    for (var i = 0; i < 8; i++) {
      var a = i * Math.PI / 4 + 0.4;
      line(cx + Math.cos(a) * r * 0.35, cy + Math.sin(a) * r * 0.35,
           cx + Math.cos(a) * (r - 4), cy + Math.sin(a) * (r - 4));
    }
    circle(cx, cy, r * 0.28, "#b9c0c7");
  }

  // trojcípá hvězda v kroužku (pocta předloze)
  function drawStar(cx, cy, r) {
    ctx.strokeStyle = "#b9c0c7"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#d9dee3";
    for (var i = 0; i < 3; i++) {
      var a = -Math.PI / 2 + i * (Math.PI * 2 / 3);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.92, cy + Math.sin(a) * r * 0.92);
      ctx.lineTo(cx + Math.cos(a + 2.2) * r * 0.22, cy + Math.sin(a + 2.2) * r * 0.22);
      ctx.lineTo(cx + Math.cos(a - 2.2) * r * 0.22, cy + Math.sin(a - 2.2) * r * 0.22);
      ctx.closePath(); ctx.fill();
    }
  }

  // moderní kulatý budík na displeji přístrojového štítu
  function drawDial(cx, cy, r, val01) {
    var a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;

    circle(cx, cy, r, "#101114");
    ctx.strokeStyle = "#dfe3e8"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r - 2, a0, a1); ctx.stroke();
    ctx.strokeStyle = "#e02121"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, r - 2, a0 + (a1 - a0) * 0.82, a1); ctx.stroke();

    ctx.strokeStyle = "#8f979e"; ctx.lineWidth = 1.5;
    for (var i = 0; i <= 6; i++) {
      var a = a0 + (a1 - a0) * (i / 6);
      line(cx + Math.cos(a) * (r - 3), cy + Math.sin(a) * (r - 3),
           cx + Math.cos(a) * (r - 8), cy + Math.sin(a) * (r - 8));
    }

    var an = a0 + (a1 - a0) * Math.max(0, Math.min(1, val01));
    ctx.strokeStyle = "#ff5039"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
    line(cx, cy, cx + Math.cos(an) * (r - 6), cy + Math.sin(an) * (r - 6));
    circle(cx, cy, 3, "#dfe3e8");
  }

  function drawWheel() {
    var cx = 320, cy = 474, R = 132;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(wheelAngle);

    // věnec — černá kůže, nahoře dřevěný segment jako na předloze
    ctx.strokeStyle = "#101114"; ctx.lineWidth = 19;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "#26282e"; ctx.lineWidth = 13;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "#4a3018"; ctx.lineWidth = 13;
    ctx.beginPath(); ctx.arc(0, 0, R, Math.PI * 1.22, Math.PI * 1.78); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, R - 3, Math.PI * 1.3, Math.PI * 1.6); ctx.stroke();

    // tři paprsky (9–3–6) stříbrné
    ctx.strokeStyle = "#b9c0c7"; ctx.lineWidth = 13; ctx.lineCap = "round";
    spoke(Math.PI, R);
    spoke(0, R);
    spoke(Math.PI / 2, R);

    // tlačítkové pody na vodorovných paprscích
    rr(-88, -11, 34, 22, 6, "#17181b");
    rr(54, -11, 34, 22, 6, "#17181b");
    ctx.fillStyle = "#585d64";
    ctx.fillRect(-82, -6, 9, 5); ctx.fillRect(-70, -6, 9, 5);
    ctx.fillRect(-82, 2, 21, 4);
    ctx.fillRect(60, -6, 9, 5); ctx.fillRect(72, -6, 9, 5);
    ctx.fillRect(60, 2, 21, 4);

    // náboj s hvězdou
    circle(0, 0, 30, "#17181b");
    ctx.strokeStyle = "#8f979e"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.stroke();
    drawStar(0, 0, 21);

    // ruce: sako, manžeta, dlaň — „za deset dvě"
    drawHand(Math.PI * 1.28, R);
    drawHand(Math.PI * 1.72, R);

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

  // velké vyskakovací nápisy (elektromobil, sanitka s krví, kombo, BOMBY)
  function drawBanners() {
    // trvalý banner PLYNULÁ JÍZDA / REŽIM OSTRAVA, dokud hráč drží 200+
    if (flowActive) {
      var pulse = 1 + (flowOstrava ? 0.1 : 0.06) * Math.sin(timeT * (flowOstrava ? 16 : 11));
      var jitter = flowOstrava ? 6 : 3;
      ctx.save();
      ctx.translate(W / 2 + (Math.random() - 0.5) * jitter, 128);
      ctx.scale(pulse, pulse);
      ctx.textAlign = "center";
      ctx.lineJoin = "round";
      ctx.font = "bold " + (flowOstrava ? 52 : 46) + "px Arial";
      ctx.lineWidth = 8;
      ctx.strokeStyle = flowOstrava ? "#4a0d05" : "#7a1010";
      ctx.strokeText(flowOstrava ? "REŽIM OSTRAVA!" : "PLYNULÁ JÍZDA!", 0, 0);
      ctx.fillStyle = flowOstrava ? "#ff5d3d" : "#ffd23f";
      ctx.fillText(flowOstrava ? "REŽIM OSTRAVA!" : "PLYNULÁ JÍZDA!", 0, 0);
      ctx.font = "italic bold 16px Arial";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#000";
      ctx.strokeText(flowOstrava ? "325 km/h!" : "německá dálnice", 0, 23);
      ctx.fillStyle = "#e8e8e8";
      ctx.fillText(flowOstrava ? "325 km/h!" : "německá dálnice", 0, 23);
      // počítadlo roste s nasbíranými hlasy
      var cSize = 16 + Math.min(30, flowTotal * 0.03);
      ctx.font = "bold " + cSize + "px Arial";
      ctx.lineWidth = Math.max(4, cSize * 0.14);
      ctx.strokeStyle = "#000";
      ctx.strokeText("+" + flowTotal + " hlasů", 0, 30 + cSize);
      ctx.fillStyle = "#fff";
      ctx.fillText("+" + flowTotal + " hlasů", 0, 30 + cSize);
      ctx.restore();
    }

    // DOJEZDOVÁ TÍSEŇ — bliká, když je karoserie skoro na šrot
    if (health < 25 && health > 0 && Math.floor(timeT * 2.5) % 3 !== 2) {
      ctx.save();
      ctx.textAlign = "center";
      ctx.lineJoin = "round";
      ctx.font = "bold 26px Arial";
      ctx.lineWidth = 5;
      ctx.strokeStyle = "#3d1a02";
      ctx.strokeText("DOJEZDOVÁ TÍSEŇ!", W / 2, 308);
      ctx.fillStyle = "#ffb62e";
      ctx.fillText("DOJEZDOVÁ TÍSEŇ!", W / 2, 308);
      ctx.restore();
    }
    for (var i = 0; i < banners.length; i++) {
      var b = banners[i];
      var age = b.maxLife - b.life;
      var alpha = b.life < 0.5 ? Math.max(0, b.life / 0.5) : 1;
      var pop = 1 + Math.max(0, 0.5 - age * 3);
      var bx = W / 2, by = b.y;
      if (b.shake) {
        bx += (Math.random() - 0.5) * 9;
        by += (Math.random() - 0.5) * 7;
      }
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(bx, by);
      ctx.scale(pop, pop);
      ctx.font = "bold " + b.size + "px Arial";
      ctx.textAlign = "center";
      ctx.lineJoin = "round";        // bez špičatých artefaktů na rozích glyfů
      ctx.lineWidth = Math.max(4, b.size * 0.13);
      ctx.strokeStyle = b.drips ? "#3d0303" : "#000";
      ctx.strokeText(b.text, 0, 0);
      ctx.fillStyle = b.color;
      ctx.fillText(b.text, 0, 0);
      if (b.drips) {
        ctx.fillStyle = "#b00d0d";
        for (var d = 0; d < b.drips.length; d++) {
          var dr = b.drips[d];
          ctx.fillRect(dr.x - 2, 4, 4, dr.len);
          ctx.beginPath();
          ctx.arc(dr.x, 4 + dr.len, 3.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  /* --------------------------- pomocníci --------------------------- */

  function lerp(a, b, t) { return a + (b - a) * t; }

  function line(x1, y1, x2, y2) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }

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
    "NEJEZDĚTE JAK DEBILOVÉ!",
    "PILOT T. DOJEZDIL!",
    "ZRCÁTKO SE UŽ NEŠKLEBÍ",
    "HRANATÁ LEGENDA NA ŠROTIŠTI, HLASY V TRAPU",
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

  // debug hook pro testy a ladění efektů z konzole
  window.__gtaDebug = {
    addBanner: addBanner,
    face: face,
    boost: function (v) { speed = Math.min(MAXS, Math.max(0, v)); }
  };

  var last = performance.now();
  function frame(now) {
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    if (state === "playing") {
      update(dt);
      if (over) showGameOver();
    } else {
      face.update(dt, { health: health, sunglasses: false });
      updateBanners(dt);
    }

    ctx.clearRect(0, 0, W, H);
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
