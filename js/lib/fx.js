// Son & vibrations — bips courts générés par Web Audio (aucun fichier à charger) + navigator.vibrate.
// Coupé/activé depuis l'accueil, mémorisé dans les préférences.
import { getPrefs } from "./prefs.js";

let ctx = null;
const on = () => getPrefs().sound !== false;

function buzz(pattern) {
  if (!on()) return;
  try { navigator.vibrate && navigator.vibrate(pattern); } catch {}
}

function tone(freq, dur = 0.08, type = "sine", vol = 0.06, when = 0) {
  if (!on()) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = ctx || new AC();
    if (ctx.state === "suspended") ctx.resume();
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + dur + 0.03);
  } catch {}
}

export const fx = {
  tap() { buzz(6); tone(880, 0.03, "sine", 0.03); },
  like() { buzz(14); tone(660, 0.09, "triangle"); tone(990, 0.1, "triangle", 0.05, 0.06); },
  pass() { buzz(8); tone(240, 0.09, "sine", 0.05); },
  seen() { buzz([6, 40, 6]); tone(520, 0.06, "sine", 0.04); tone(520, 0.06, "sine", 0.04, 0.09); },
  tick() { tone(1300, 0.02, "square", 0.015); },
  match() { buzz([20, 50, 20]); tone(784, 0.12, "triangle", 0.06); tone(1175, 0.18, "triangle", 0.05, 0.1); },
  win() { buzz([30, 60, 30, 60, 90]); [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.24, "triangle", 0.06, i * 0.11)); },
};
