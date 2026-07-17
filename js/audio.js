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

    // motor: hluboký V8 teréňáku — dva rozladěné saw hluboko, sinusový
    // sub-bas pro váhu a pomalé LFO chvění pro „bublání" na volnoběh
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineLp = this.ctx.createBiquadFilter();
    this.engineLp.type = "lowpass";
    this.engineLp.frequency.value = 240;
    this.engineGain.connect(this.engineLp);
    this.engineLp.connect(this.master);

    this.osc1 = this.ctx.createOscillator();
    this.osc1.type = "sawtooth";
    this.osc1.frequency.value = 34;
    this.osc2 = this.ctx.createOscillator();
    this.osc2.type = "sawtooth";
    this.osc2.frequency.value = 17.9;      // mírné rozladění → pomalé záznějí
    this.sub = this.ctx.createOscillator();
    this.sub.type = "sine";
    this.sub.frequency.value = 17;
    var subG = this.ctx.createGain();
    subG.gain.value = 1.4;
    // střední harmonická vrstva — malé reproduktory (mobil) hluboké
    // frekvence nepřehrají, tahle nese motor i tam
    this.osc3 = this.ctx.createOscillator();
    this.osc3.type = "sawtooth";
    this.osc3.frequency.value = 136;
    var o3g = this.ctx.createGain();
    o3g.gain.value = 0.55;
    this.osc1.connect(this.engineGain);
    this.osc2.connect(this.engineGain);
    this.sub.connect(subG);
    subG.connect(this.engineGain);
    this.osc3.connect(o3g);
    o3g.connect(this.engineGain);
    this.osc1.start();
    this.osc2.start();
    this.sub.start();
    this.osc3.start();

    // LFO moduluje hlasitost motoru — loping idle velkého osmiválce
    this.lfo = this.ctx.createOscillator();
    this.lfo.type = "sine";
    this.lfo.frequency.value = 7;
    this.lfoGain = this.ctx.createGain();
    this.lfoGain.gain.value = 0.014;
    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.engineGain.gain);
    this.lfo.start();

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
    var target = running ? 0.07 + speed01 * 0.06 : 0;
    this.engineGain.gain.cancelScheduledValues(t);
    this.engineGain.gain.setTargetAtTime(target, t, 0.08);
    // LFO jen když motor běží — jinak by v tichu pulzoval
    this.lfoGain.gain.setTargetAtTime(running ? 0.014 : 0, t, 0.15);
    this.osc1.frequency.setTargetAtTime(34 + speed01 * 62, t, 0.05);
    this.osc2.frequency.setTargetAtTime(17.9 + speed01 * 32, t, 0.05);
    this.sub.frequency.setTargetAtTime(17 + speed01 * 31, t, 0.05);
    this.osc3.frequency.setTargetAtTime(136 + speed01 * 248, t, 0.05);
    this.engineLp.frequency.setTargetAtTime(220 + speed01 * 700, t, 0.1);
    this.lfo.frequency.setTargetAtTime(6 + speed01 * 10, t, 0.1);
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
    thump.frequency.setValueAtTime(80, t);
    thump.frequency.exponentialRampToValueAtTime(30, t + 0.24);
    var tg = this.ctx.createGain();
    tg.gain.setValueAtTime(vol * 0.9, t);
    tg.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    thump.connect(tg); tg.connect(this.master);
    thump.start(t); thump.stop(t + 0.3);
  };

  // cinknutí za červenou
  AudioSys.prototype.ding = function () {
    this._beep("square", 1046, 0.09, 0.06);
    this._beep("square", 1568, 0.09, 0.05, 0.09);
  };

  // bzučák za sanitku
  AudioSys.prototype.penalty = function () {
    this._beep("sawtooth", 130, 0.35, 0.12);
    this._beep("sawtooth", 98, 0.35, 0.12, 0.05);
  };

  // motor chcípá: otáčky spadnou, pár škytnutí, ticho
  AudioSys.prototype.stall = function () {
    if (!this.ctx) return;
    var t = this.ctx.currentTime;
    this.osc1.frequency.setTargetAtTime(16, t, 0.35);
    this.osc2.frequency.setTargetAtTime(8, t, 0.35);
    this.sub.frequency.setTargetAtTime(8, t, 0.35);
    this.osc3.frequency.setTargetAtTime(60, t, 0.35);
    this.engineLp.frequency.setTargetAtTime(120, t, 0.3);
    var g = this.engineGain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(g.value, 0.06), t);
    g.exponentialRampToValueAtTime(0.02, t + 0.25);
    g.setValueAtTime(0.09, t + 0.32);
    g.exponentialRampToValueAtTime(0.015, t + 0.55);
    g.setValueAtTime(0.07, t + 0.65);
    g.exponentialRampToValueAtTime(0.0001, t + 1.4);
    g.setValueAtTime(0, t + 1.45);
    this.lfoGain.gain.setTargetAtTime(0, t, 0.3);
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
