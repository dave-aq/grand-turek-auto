/* ============================================================
 * Zvuk přes Web Audio API — žádné externí soubory.
 * Motor V8 (dva rozladěné oscilátory), rány, cinkání, bzučák.
 * ============================================================ */
(function () {
  "use strict";

  function AudioSys() {
    this.ctx = null;
    this.muted = false;
  }

  // Musí se volat až po prvním gestu uživatele (autoplay policy).
  AudioSys.prototype.init = function () {
    if (this.ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();

    this.master = this.ctx.createGain();
    this.master.gain.value = 1;
    this.master.connect(this.ctx.destination);

    // motor: saw + saw o oktávu níž, lowpass
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineLp = this.ctx.createBiquadFilter();
    this.engineLp.type = "lowpass";
    this.engineLp.frequency.value = 400;
    this.engineGain.connect(this.engineLp);
    this.engineLp.connect(this.master);

    this.osc1 = this.ctx.createOscillator();
    this.osc1.type = "sawtooth";
    this.osc1.frequency.value = 50;
    this.osc2 = this.ctx.createOscillator();
    this.osc2.type = "sawtooth";
    this.osc2.frequency.value = 27;
    this.osc1.connect(this.engineGain);
    this.osc2.connect(this.engineGain);
    this.osc1.start();
    this.osc2.start();

    // buffer bílého šumu pro rány
    var len = Math.floor(this.ctx.sampleRate * 0.5);
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    var data = this.noise.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  };

  AudioSys.prototype.toggleMute = function () {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 1;
    return this.muted;
  };

  // speed01: 0..1 podíl maximální rychlosti; running: hra běží
  AudioSys.prototype.setEngine = function (speed01, running) {
    if (!this.ctx) return;
    var t = this.ctx.currentTime;
    var target = running ? 0.035 + speed01 * 0.03 : 0;
    this.engineGain.gain.setTargetAtTime(target, t, 0.08);
    this.osc1.frequency.setTargetAtTime(48 + speed01 * 150, t, 0.05);
    this.osc2.frequency.setTargetAtTime(26 + speed01 * 72, t, 0.05);
    this.engineLp.frequency.setTargetAtTime(300 + speed01 * 1100, t, 0.1);
  };

  // intensity 0..1
  AudioSys.prototype.crash = function (intensity) {
    if (!this.ctx) return;
    var t = this.ctx.currentTime;
    var vol = 0.25 + 0.45 * Math.min(intensity, 1);

    var src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    var g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    src.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + 0.4);

    var thump = this.ctx.createOscillator();
    thump.type = "sine";
    thump.frequency.setValueAtTime(95, t);
    thump.frequency.exponentialRampToValueAtTime(38, t + 0.22);
    var tg = this.ctx.createGain();
    tg.gain.setValueAtTime(vol * 0.9, t);
    tg.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    thump.connect(tg); tg.connect(this.master);
    thump.start(t); thump.stop(t + 0.3);
  };

  // cinknutí za červenou
  AudioSys.prototype.ding = function () {
    this._beep("square", 1046, 0.09, 0.12);
    this._beep("square", 1568, 0.09, 0.1, 0.09);
  };

  // bzučák za sanitku
  AudioSys.prototype.penalty = function () {
    this._beep("sawtooth", 130, 0.35, 0.18);
    this._beep("sawtooth", 98, 0.35, 0.18, 0.05);
  };

  // klesající tón při KO
  AudioSys.prototype.ko = function () {
    if (!this.ctx) return;
    var t = this.ctx.currentTime;
    var o = this.ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(320, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.9);
    var g = this.ctx.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.95);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 1);
    this.crash(1);
  };

  AudioSys.prototype._beep = function (type, freq, dur, vol, delay) {
    if (!this.ctx) return;
    var t = this.ctx.currentTime + (delay || 0);
    var o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    var g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  };

  window.GTA = window.GTA || {};
  window.GTA.AudioSys = AudioSys;
})();
