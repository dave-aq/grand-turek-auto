/* ============================================================
 * Bootstrap: canvas, vstup, smyčka, overlaye.
 * ============================================================ */
(function () {
  "use strict";

  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");
  var W = GTA.SIZE.W, H = GTA.SIZE.H;

  var face = new GTA.FaceCam();
  var audio = new GTA.AudioSys();
  var game = new GTA.Game(face, audio);

  var state = "menu";   // menu | playing | over
  var input = { left: false, right: false, up: false, down: false };

  var elStart = document.getElementById("overlay-start");
  var elOver = document.getElementById("overlay-over");
  var elHeadline = document.getElementById("np-headline");
  var elStats = document.getElementById("np-stats");
  var elBest = document.getElementById("np-best");

  var HEADLINES = [
    "PILOT T. DOJEZDIL!",
    "VETERÁN NA ŠROTIŠTI, HLASY V TRAPU",
    "KOMENTÁTOŘI: „TO SE NEDALO PŘEHLÉDNOUT“",
    "MAGISTRÁLA SI ODDECHLA",
    "GARÁŽ TRUCHLÍ: V8 UŽ NEZAŘVE"
  ];

  /* ------------------------------ resize ------------------------------ */

  function resize() {
    var scale = Math.min(window.innerWidth / W, window.innerHeight / H);
    var wrap = document.getElementById("game-wrap");
    wrap.style.width = canvas.style.width = Math.floor(W * scale) + "px";
    wrap.style.height = canvas.style.height = Math.floor(H * scale) + "px";
  }
  window.addEventListener("resize", resize);
  resize();

  /* ------------------------------ vstup ------------------------------ */

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
    game.reset();
    elOver.classList.add("hidden");
    state = "playing";
  }

  function showGameOver() {
    state = "over";
    elHeadline.textContent = HEADLINES[Math.floor(Math.random() * HEADLINES.length)];
    elStats.innerHTML =
      "Získáno <b>" + fmt(game.score) + "</b> preferenčních hlasů.<br>" +
      "Sestřeleno <b>" + game.wrecks + "</b> aut na <b>" +
      (game.distance / 1000).toFixed(1) + " km</b>.";
    elBest.textContent = game.score >= game.best && game.score > 0
      ? "NOVÝ REKORD!"
      : "Rekord: " + fmt(game.best) + " hlasů";
    elOver.classList.remove("hidden");
  }

  function fmt(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }

  /* ------------------------------ smyčka ------------------------------ */

  var last = performance.now();

  function frame(now) {
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    if (state === "playing") {
      game.update(dt, input);
      if (game.over) showGameOver();
    } else if (state === "over") {
      // svět stojí, ale obličej (KO hvězdičky) žije dál
      face.update(dt, { health: game.health, sunglasses: false });
    }

    ctx.clearRect(0, 0, W, H);
    game.draw(ctx);

    if (state === "menu") {
      // pod start overlayem se jen tiše kreslí prázdná silnice
      face.update(dt, { health: 100, sunglasses: false });
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
