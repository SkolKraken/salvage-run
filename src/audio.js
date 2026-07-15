/**
 * Procedural dark-ambient soundtrack. No audio files — everything is
 * synthesized with WebAudio: a breathing low drone, slow minor pad swells,
 * and sparse distant percussion. Starts on the first user gesture (browser
 * autoplay policy); mute state persists in localStorage.
 */
const MASTER_LEVEL = 0.32;
const MUTE_KEY = "sr-muted";
let ctx = null;
let master = null;
let muted = localStorage.getItem(MUTE_KEY) === "1";
/** Pentatonic-ish A-minor pool for pad swells (Hz). */
const PAD_NOTES = [110, 130.81, 146.83, 164.81, 196, 220];
function rand(lo, hi) {
    return lo + Math.random() * (hi - lo);
}
function startDrone(ac, out) {
    const filter = ac.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 260;
    filter.Q.value = 0.8;
    const droneGain = ac.createGain();
    droneGain.gain.value = 0.14;
    filter.connect(droneGain);
    droneGain.connect(out);
    const mk = (type, freq, detune) => {
        const osc = ac.createOscillator();
        osc.type = type;
        osc.frequency.value = freq;
        osc.detune.value = detune;
        osc.connect(filter);
        osc.start();
    };
    mk("sawtooth", 55, 0); // A1
    mk("sawtooth", 55, 8); // slow beat against the first
    mk("triangle", 82.41, -5); // E2, a bare fifth
    // Slow filter sweep so the drone never sits still.
    const lfo = ac.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.045;
    const lfoAmt = ac.createGain();
    lfoAmt.gain.value = 90;
    lfo.connect(lfoAmt);
    lfoAmt.connect(filter.frequency);
    lfo.start();
    // Breathing amplitude, out of phase with the filter sweep.
    const breath = ac.createOscillator();
    breath.type = "sine";
    breath.frequency.value = 0.07;
    const breathAmt = ac.createGain();
    breathAmt.gain.value = 0.05;
    breath.connect(breathAmt);
    breathAmt.connect(droneGain.gain);
    breath.start();
}
function schedulePad(ac, out) {
    const loop = () => {
        const freq = PAD_NOTES[Math.floor(Math.random() * PAD_NOTES.length)];
        const now = ac.currentTime;
        const attack = rand(2, 3.5);
        const hold = rand(1, 3);
        const release = rand(4, 6);
        const gain = ac.createGain();
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(rand(0.03, 0.05), now + attack);
        gain.gain.setValueAtTime(0.04, now + attack + hold);
        gain.gain.linearRampToValueAtTime(0, now + attack + hold + release);
        gain.connect(out);
        for (const detune of [-4, 3]) {
            const osc = ac.createOscillator();
            osc.type = "sine";
            osc.frequency.value = freq;
            osc.detune.value = detune;
            osc.connect(gain);
            osc.start(now);
            osc.stop(now + attack + hold + release + 0.1);
        }
        window.setTimeout(loop, rand(7000, 14000));
    };
    window.setTimeout(loop, rand(1500, 4000));
}
function scheduleThuds(ac, out) {
    // Pre-render one noise buffer, reused for every thump.
    const len = Math.floor(ac.sampleRate * 0.4);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++)
        data[i] = Math.random() * 2 - 1;
    const loop = () => {
        const now = ac.currentTime;
        if (Math.random() < 0.72) {
            // distant impact: lowpassed noise burst
            const src = ac.createBufferSource();
            src.buffer = buf;
            const filter = ac.createBiquadFilter();
            filter.type = "lowpass";
            filter.frequency.value = rand(90, 150);
            const gain = ac.createGain();
            gain.gain.setValueAtTime(rand(0.1, 0.2), now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
            src.connect(filter);
            filter.connect(gain);
            gain.connect(out);
            src.start(now);
        }
        else {
            // stray metallic tick
            const osc = ac.createOscillator();
            osc.type = "square";
            osc.frequency.value = rand(900, 1600);
            const gain = ac.createGain();
            gain.gain.setValueAtTime(0.012, now);
            gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.09);
            osc.connect(gain);
            gain.connect(out);
            osc.start(now);
            osc.stop(now + 0.1);
        }
        window.setTimeout(loop, rand(3500, 9000));
    };
    window.setTimeout(loop, rand(2500, 6000));
}
/** Idempotent; call from any user gesture. */
export function ensureAudio() {
    if (ctx) {
        if (ctx.state === "suspended")
            void ctx.resume();
        return;
    }
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER_LEVEL;
    master.connect(ctx.destination);
    startDrone(ctx, master);
    schedulePad(ctx, master);
    scheduleThuds(ctx, master);
}
export function audioMuted() {
    return muted;
}
/** Flip mute; returns the new muted state. */
export function toggleMute() {
    muted = !muted;
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    if (ctx && master) {
        const now = ctx.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(master.gain.value, now);
        master.gain.linearRampToValueAtTime(muted ? 0 : MASTER_LEVEL, now + 0.4);
    }
    return muted;
}
