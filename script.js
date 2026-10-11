/* ==========================================================
   script.js — jembatan data game -> HUD
   ----------------------------------------------------------
   - Fungsi & parameter SAMA seperti versi asli
   - Aman dipanggil sebelum DOM siap
   - Aman terhadap undefined/NaN
   - Nilai dibatasi ke rentang valid
   - DOM hanya disentuh kalau teksnya benar-benar berubah
   - 🎮 NUI listener untuk FiveM (SendNUIMessage)
   ========================================================== */

let elements = {};
let speedMode = 1;   // 0: KMH, 1: MPH, 2: Knots
let indicators = 0;  // bit 0 = kiri, bit 1 = kanan

const ELEMENT_IDS = [
    'engine', 'speed', 'rpm', 'fuel', 'health',
    'gear', 'headlights', 'indicators', 'seatbelts', 'odometer',
];

const lastText = {};

const onOrOff = state => state ? 'On' : 'Off';
const num = (v, fallback = 0) => {
    v = Number(v);
    return Number.isFinite(v) ? v : fallback;
};
const clamp01 = v => Math.min(1, Math.max(0, num(v)));

/** Ambil elemen secara lazy: aman walau dipanggil sebelum DOMContentLoaded. */
function getEl(name) {
    const cached = elements[name];
    if (cached && cached.isConnected) return cached;
    return (elements[name] = document.getElementById(name));
}

/** Tulis teks hanya jika berubah (mengurangi kerja DOM & observer). */
function write(name, text) {
    if (lastText[name] === text) return;
    const e = getEl(name);
    if (!e) return;
    lastText[name] = text;
    e.textContent = text;
}

/**
 * Updates the display of the engine state.
 * @param {boolean} state If true, the engine is on; otherwise, it is off.
 */
function setEngine(state) {
    write('engine', onOrOff(!!state));
}

/**
 * Updates the speed display based on the current speed mode.
 * @param {number} speed - The speed value in meters per second (m/s).
 */
function setSpeed(speed) {
    speed = Math.max(0, num(speed));
    switch (speedMode) {
        case 1: write('speed', `${Math.round(speed * 2.236936)} MPH`); break;   // MPH
        case 2: write('speed', `${Math.round(speed * 1.943844)} Knots`); break; // Knots
        default: write('speed', `${Math.round(speed * 3.6)} KMH`);              // KMH
    }
}

/**
 * Updates the RPM (Revolutions Per Minute) display.
 * @param {number} rpm - The RPM value to display. (0 to 1).
 */
function setRPM(rpm) {
    write('rpm', `${clamp01(rpm).toFixed(4)} RPM`);
}

/**
 * Updates the fuel level display as a percentage.
 * @param {number} fuel - The fuel level (0 to 1).
 */
function setFuel(fuel) {
    write('fuel', `${(clamp01(fuel) * 100).toFixed(1)}%`);
}

/**
 * Updates the vehicle health display as a percentage.
 * @param {number} health - The vehicle health level (0 to 1).
 */
function setHealth(health) {
    write('health', `${(clamp01(health) * 100).toFixed(1)}%`);
}

/**
 * Updates the current gear display.
 * @param {number} gear - The current gear to display. 0 represents neutral/reverse.
 */
function setGear(gear) {
    write('gear', String(Math.trunc(num(gear))));
}

/**
 * Updates the headlights status display.
 * @param {number} state - The headlight state (0: Off, 1: On, 2: High Beam).
 */
function setHeadlights(state) {
    switch (Math.trunc(num(state))) {
        case 1: write('headlights', 'On'); break;
        case 2: write('headlights', 'High Beam'); break;
        default: write('headlights', 'Off');
    }
}

function renderIndicators() {
    write('indicators', `${indicators & 0b01 ? 'On' : 'Off'} / ${indicators & 0b10 ? 'On' : 'Off'}`);
}

/**
 * Sets the state of the left turn indicator and updates the display.
 * @param {boolean} state
 */
function setLeftIndicator(state) {
    indicators = (indicators & 0b10) | (state ? 0b01 : 0b00);
    renderIndicators();
}

/**
 * Sets the state of the right turn indicator and updates the display.
 * @param {boolean} state
 */
function setRightIndicator(state) {
    indicators = (indicators & 0b01) | (state ? 0b10 : 0b00);
    renderIndicators();
}

/**
 * Updates the seatbelt status display.
 * @param {boolean} state - If true, seatbelts are fastened.
 */
function setSeatbelts(state) {
    write('seatbelts', onOrOff(!!state));
}

/**
 * Sets the speed display mode.
 * @param {number} mode - The speed mode to set (0: KMH, 1: MPH, 2: Knots).
 */
function setSpeedMode(mode) {
    speedMode = Math.trunc(num(mode, 1));
}

/**
 * Updates the odometer display.
 * @param {number} distance - The distance in miles.
 */
function setOdometer(distance) {
    write('odometer', Math.max(0, num(distance)).toFixed(1) + ' Miles');
}

// Cache elemen begitu DOM siap (getEl tetap bekerja walau lebih awal)
document.addEventListener('DOMContentLoaded', () => {
    ELEMENT_IDS.forEach(getEl);
});

/* ==========================================================
   🎮 NUI MESSAGE LISTENER — jembatan dari FiveM client.lua
   ----------------------------------------------------------
   Lua kirim: SendNUIMessage({ type = 'updateHUD', speed = 25.4, ... })
   Listener ini panggil fungsi setter yang sudah ada.
   Tidak mengubah fungsi asli di atas.
   ========================================================== */
window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || data.type !== 'updateHUD') return;

    // Engine (boolean)
    if (data.engine !== undefined) setEngine(data.engine);

    // Speed (meter/detik — auto convert sesuai speedMode)
    if (data.speed !== undefined) setSpeed(data.speed);

    // RPM (0-1)
    if (data.rpm !== undefined) setRPM(data.rpm);

    // Fuel (0-1)
    if (data.fuel !== undefined) setFuel(data.fuel);

    // Health (0-1)
    if (data.health !== undefined) setHealth(data.health);

    // Gear (angka, 0 = N)
    if (data.gear !== undefined) setGear(data.gear);

    // Headlights (0 = Off, 1 = On, 2 = High Beam)
    if (data.headlights !== undefined) setHeadlights(data.headlights);

    // Indicators (boolean terpisah kiri & kanan)
    if (data.indicatorLeft  !== undefined) setLeftIndicator(data.indicatorLeft);
    if (data.indicatorRight !== undefined) setRightIndicator(data.indicatorRight);

    // Seatbelts (boolean)
    if (data.seatbelts !== undefined) setSeatbelts(data.seatbelts);

    // Odometer (angka, dalam miles)
    if (data.odometer !== undefined) setOdometer(data.odometer);

    // Speed mode (opsional, kalau mau ganti unit dari Lua)
    if (data.speedMode !== undefined) setSpeedMode(data.speedMode);
});

/* ==========================================================
   🔊 SOUND SEATBELT (opsional — dikontrol dari Lua)
   ----------------------------------------------------------
   Untuk kontrol sound manual dari client.lua via:
   SendNUIMessage({ type = 'seatbeltSound', on = false })
   ========================================================== */
window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || data.type !== 'seatbeltSound') return;

    const snd = document.getElementById('seatbeltSound');
    if (!snd) return;

    if (data.on) {
        snd.pause();
        snd.currentTime = 0;
    } else {
        snd.play().catch(() => {});
    }
});