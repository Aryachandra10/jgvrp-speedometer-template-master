/* ==========================================================
   hud.js — render layer untuk script.js (FiveM GTA V)
   ----------------------------------------------------------
   Layout : kotak digital kanan-bawah, background transparan
   Fitur  : RPM bar (20 segmen), chips, fuel/health, welcome
   ----------------------------------------------------------
   Format data dari script.js (element hidden #engine dst):
     engine     → "On" / "Off"
     speed      → "120 MPH" / "88 KMH" / "42 Knots"
     rpm        → "0.6500 RPM"  (0-1, ternormalisasi)
     fuel       → "78.5%"
     health     → "92.0%"
     gear       → "4" / "0"  (0 = N)
     headlights → "Off" / "On" / "High Beam"
     indicators → "On / Off"  (kiri / kanan)
     seatbelts  → "On" / "Off"
     odometer   → "48213.4 Miles"
   ========================================================== */
(function () {
  'use strict';

  /* =======================================================
     0. KONFIGURASI
     ======================================================= */
  const DEMO_MODE   = false;   // true = preview tanpa game
  const MAX_RPM     = 8000;
  const REDLINE_RPM = 6600;
  const RPM_SEGS    = 20;      // jumlah segmen bar RPM
  const WELCOME_TEXT = 'Selamat datang Bos Shaquille Carvinson';
  const $ = id => document.getElementById(id);

  /* =======================================================
     1. ELEMEN HUD
     ======================================================= */
  const hud      = $('hud');
  const vSpeed   = $('vSpeed');
  const vRpm     = $('vRpm');
  const vRpmMid  = $('vRpmMid');
  const vGear    = $('vGear');
  const vOdo     = $('vOdo');
  const vFuel    = $('vFuel');
  const vHealth  = $('vHealth');
  const vUnit    = $('vUnit');
  const fFuel    = $('fFuel');
  const fHealth  = $('fHealth');

  const chipEngine   = $('chipEngine');
  const chipLights   = $('chipLights');
  const chipBelt     = $('chipBelt');
  const indLeft      = $('indLeft');
  const indRight     = $('indRight');
  const mFuel        = $('mFuel');
  const mHealth      = $('mHealth');
  const seatbeltWarn = $('seatbeltWarning');
  const beltSound    = $('seatbeltSound');
  const rpmBarsCont  = $('rpmBars');

  /* =======================================================
     2. BANGUN SEGMEN BAR RPM (kotak-kotak)
     ======================================================= */
  let rpmSegs = [];
  if (rpmBarsCont) {
    rpmBarsCont.innerHTML = '';
    for (let i = 0; i < RPM_SEGS; i++) {
      const s = document.createElement('span');
      s.className = 'seg' + (i >= 15 ? ' red' : '');
      rpmBarsCont.appendChild(s);
    }
    rpmSegs = Array.from(rpmBarsCont.children);
  }

  /* =======================================================
     3. SUMBER DATA (diisi oleh script.js)
     ======================================================= */
  const SRC = {
    engine:     $('engine'),
    speed:      $('speed'),
    rpm:        $('rpm'),
    fuel:       $('fuel'),
    health:     $('health'),
    gear:       $('gear'),
    headlights: $('headlights'),
    indicators: $('indicators'),
    seatbelts:  $('seatbelts'),
    odometer:   $('odometer')
  };
  const txt = id => (SRC[id] && SRC[id].textContent || '').trim();

  /* ---------- Parser format script.js ---------- */
  function parseSpeed(){
    const m = /^(-?\d+(?:\.\d+)?)/.exec(txt('speed'));
    return m ? Math.max(0, parseFloat(m[1])) : 0;
  }
  function parseSpeedUnit(){
    const t = txt('speed');
    if (/KMH/i.test(t))   return 'km/h';
    if (/Knots/i.test(t)) return 'kn';
    return 'mph';
  }
  function parseRpm(){
    const m = /^(-?\d+(?:\.\d+)?)/.exec(txt('rpm'));
    if (!m) return 0;
    const raw = parseFloat(m[1]);
    // script.js kirim 0-1 → kalikan MAX_RPM; kalau >1 anggap RPM mentah
    return raw <= 1 ? raw * MAX_RPM : raw;
  }
  function parsePercent(id){
    const m = /^(-?\d+(?:\.\d+)?)/.exec(txt(id));
    return m ? Math.min(100, Math.max(0, parseFloat(m[1]))) : 0;
  }
  function parseGear(){
    const t = txt('gear');
    if (!t) return 'N';
    if (t === '0') return 'N';
    return t.toUpperCase().slice(0,2);
  }
  function parseBoolOnOff(id){
    return /^(on|high beam|true|1|yes)$/i.test(txt(id));
  }
  function parseIndicators(){
    const t = txt('indicators');
    if (!t) return 'off';
    const parts = t.split('/').map(s=>s.trim());
    const L = /^on$/i.test(parts[0]||'');
    const R = /^on$/i.test(parts[1]||'');
    if (L && R) return 'both';
    if (L) return 'left';
    if (R) return 'right';
    return 'off';
  }
  function parseOdometer(){
    const m = /^(-?\d+(?:\.\d+)?)/.exec(txt('odometer'));
    return m ? Math.max(0, parseFloat(m[1])) : 0;
  }

  function readState(){
    return {
      engine:     parseBoolOnOff('engine'),
      speed:      parseSpeed(),
      speedUnit:  parseSpeedUnit(),
      rpm:        parseRpm(),
      fuel:       parsePercent('fuel'),
      health:     parsePercent('health'),
      gear:       parseGear(),
      headlights: parseBoolOnOff('headlights'),
      indicators: parseIndicators(),
      seatbelts:  parseBoolOnOff('seatbelts'),
      odometer:   parseOdometer()
    };
  }

  /* =======================================================
     4. DEMO AUTOPILOT (hanya jika DEMO_MODE = true)
     ======================================================= */
  let demoT=0, dSpeed=0, dRpm=0, dFuel=78, dOdo=48213.4;
  const GEAR_TABLE = [
    { max:0,    g:'N', lo:0.08, hi:0.35, span:1   },
    { max:25,   g:'1', lo:0.12, hi:0.78, span:25  },
    { max:48,   g:'2', lo:0.20, hi:0.77, span:48  },
    { max:72,   g:'3', lo:0.25, hi:0.76, span:72  },
    { max:100,  g:'4', lo:0.28, hi:0.75, span:100 },
    { max:128,  g:'5', lo:0.32, hi:0.73, span:128 },
    { max:9999, g:'6', lo:0.36, hi:0.71, span:190 }
  ];
  function writeDemo(id, val){
    const el = SRC[id];
    if (el && el.textContent !== val) el.textContent = val;
  }
  function demoStep(dt){
    demoT += dt;
    const wave = Math.sin(demoT*0.34)*0.5 + 0.5;
    const targetSpeed = 18 + wave*152;
    dSpeed += (targetSpeed - dSpeed) * Math.min(1, dt*0.9);
    const row = GEAR_TABLE.find(r=>dSpeed<=r.max) || GEAR_TABLE[6];
    const frac = Math.min(1, dSpeed/row.span);
    const targetRpm = row.lo + (row.hi-row.lo)*frac + Math.sin(demoT*9)*0.01;
    dRpm += (targetRpm - dRpm) * Math.min(1, dt*2.6);
    dFuel = Math.max(4, dFuel - dt*0.045);
    dOdo += dSpeed*dt/3600;

    const phase = Math.floor(demoT/5) % 4;
    const indicators = phase===1 ? 'On / Off' : phase===3 ? 'Off / On' : 'Off / Off';
    const beltOn = Math.floor(demoT/8) % 2 === 0;

    writeDemo('engine','On');
    writeDemo('speed', dSpeed.toFixed(1)+' MPH');
    writeDemo('rpm', dRpm.toFixed(4)+' RPM');
    writeDemo('fuel', dFuel.toFixed(1)+'%');
    writeDemo('health','92.0%');
    writeDemo('gear', row.g==='N' ? '0' : row.g);
    writeDemo('headlights','On');
    writeDemo('indicators', indicators);
    writeDemo('seatbelts', beltOn ? 'On' : 'Off');
    writeDemo('odometer', dOdo.toFixed(1)+' Miles');
  }

  /* =======================================================
     5. STATE TAMPILAN (di-lerp agar mulus)
     ======================================================= */
  const view = {
    speed:0, rpm:0, fuel:0, health:0, odo:0,
    gear:'N', engine:false, headlights:false,
    seatbelts:false, indicators:'off', speedUnit:'mph'
  };
  const lerp  = (a,b,t)=>a+(b-a)*t;
  const clamp = (v,a,b)=>Math.min(b,Math.max(a,v));
  const setText = (el,v)=>{ if (el && el.textContent!==v) el.textContent=v; };

  function updateView(s, dt){
    const k  = Math.min(1, dt*8);   // RPM cepat
    const ks = Math.min(1, dt*4);   // speed/fuel halus
    view.speed     = lerp(view.speed,  s.speed,    ks);
    view.rpm       = lerp(view.rpm,    s.rpm,      k);
    view.fuel      = lerp(view.fuel,   s.fuel,     ks);
    view.health    = lerp(view.health, s.health,   ks);
    view.odo       = lerp(view.odo,    s.odometer, ks);
    view.gear        = s.gear;
    view.engine      = s.engine;
    view.headlights  = s.headlights;
    view.seatbelts   = s.seatbelts;
    view.indicators  = s.indicators;
    view.speedUnit   = s.speedUnit;
  }

  /* =======================================================
     6. RENDER
     ======================================================= */
  let lastGear    = null;
  let lastBelt    = null;
  let lastRpmLit  = -1;

  function render(){
    /* --- Bar RPM (20 segmen kotak) --- */
    const rpmFrac = clamp(view.rpm / MAX_RPM, 0, 1);
    const lit     = Math.round(rpmFrac * RPM_SEGS);
    if (lit !== lastRpmLit) {
      for (let i = 0; i < rpmSegs.length; i++) {
        rpmSegs[i].classList.toggle('on', i < lit);
      }
      lastRpmLit = lit;
    }
    if (hud) hud.classList.toggle('redline', view.rpm >= REDLINE_RPM);

    /* --- Angka --- */
    setText(vSpeed, String(Math.round(view.speed)));
    const rpmRounded = String(Math.round(view.rpm/10)*10);
    setText(vRpm, rpmRounded);
    if (vRpmMid) setText(vRpmMid, rpmRounded);
    setText(vUnit, view.speedUnit);

    /* --- Gear (pop saat berubah) --- */
    if (view.gear !== lastGear){
      const span = vGear && vGear.querySelector('span');
      if (span)             span.textContent = view.gear;
      else if (vGear)       vGear.textContent = view.gear;

      if (vGear) {
        vGear.classList.remove('pop');
        void vGear.offsetWidth;   // reflow supaya animasi replay
        vGear.classList.add('pop');
      }
      lastGear = view.gear;
    }

    /* --- Odometer --- */
    setText(vOdo, String(Math.round(view.odo)).padStart(6,'0'));

    /* --- Fuel & Health --- */
    const fuelPct   = clamp(view.fuel,   0, 100);
    const healthPct = clamp(view.health, 0, 100);
    if (fFuel)   fFuel.style.width   = fuelPct   + '%';
    if (fHealth) fHealth.style.width = healthPct + '%';
    setText(vFuel,   Math.round(fuelPct)   + '%');
    setText(vHealth, Math.round(healthPct) + '%');
    if (mFuel)   mFuel.classList.toggle('low',   fuelPct   <= 15);
    if (mHealth) mHealth.classList.toggle('low', healthPct <= 30);

    /* --- Chips (CSS: .active) --- */
    if (chipEngine) chipEngine.classList.toggle('active', view.engine);
    if (chipLights) chipLights.classList.toggle('active', view.headlights);
    if (chipBelt)   chipBelt.classList.toggle('active', view.seatbelts);

    /* --- Indikator sein (CSS: .active) --- */
    const ind  = view.indicators;
    const both = ind === 'both';
    if (indLeft)  indLeft.classList.toggle('active',  both || ind === 'left');
    if (indRight) indRight.classList.toggle('active', both || ind === 'right');

    /* --- Seatbelt: banner + sound manual --- */
    const beltOn = view.seatbelts;
    if (beltOn !== lastBelt){
      lastBelt = beltOn;

      if (seatbeltWarn) seatbeltWarn.classList.toggle('show', !beltOn);

      if (beltSound) {
        if (beltOn) {
          beltSound.pause();
          beltSound.currentTime = 0;
        } else {
          beltSound.play().catch(()=>{});
        }
      }
    }
  }

  /* =======================================================
     7. LOOP UTAMA
     ======================================================= */
  let last = performance.now();
  function loop(now){
    const dt = Math.min(0.05, (now - last)/1000);
    last = now;
    if (DEMO_MODE) demoStep(dt);
    const s = readState();
    updateView(s, dt);
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  /* =======================================================
     8. API PUBLIK
        window.HUD.update({ speed:"120 MPH", rpm:"0.65 RPM", ... })
     ======================================================= */
  window.HUD = {
    update(data){
      if (!data) return;
      Object.keys(data).forEach(k=>{
        const el = SRC[k];
        if (!el) return;
        const v = typeof data[k] === 'boolean'
                ? (data[k] ? 'On' : 'Off')
                : data[k];
        el.textContent = v;
      });
    }
  };

  /* =======================================================
     9. 🔔 SOUND SEATBELT — kontrol dari Lua
        SendNUIMessage({ type = 'seatbeltSound', on = true/false })
     ======================================================= */
  window.addEventListener('message', e => {
    const d = e.data;
    if (!d) return;

    /* seatbelt manual */
    if (d.type === 'seatbeltSound' && beltSound){
      if (d.on) {
        beltSound.pause();
        beltSound.currentTime = 0;
      } else {
        beltSound.play().catch(()=>{});
      }
      return;
    }

    /* update massal dari Lua */
    if (d.type === 'hudUpdate' && d.data) {
      window.HUD.update(d.data);
      return;
    }

    /* 🔊 trigger welcome manual */
    if (d.action === 'welcome' || d.type === 'welcome') {
      speakWelcome(true);
      return;
    }
    if (d.action === 'resetWelcome') {
      welcomeDone = false;
      return;
    }
  });

  /* =======================================================
     10. 🔊 WELCOME SOUND
         "Selamat datang Bos Shaquille Carvinson"
         Cara pakai:
           - Otomatis saat NUI load
           - window.playWelcomeSound(true)   → manual
           - SendNUIMessage({ action = 'welcome' })  → dari Lua
           - SendNUIMessage({ action = 'resetWelcome' }) → reset
     ======================================================= */
  let welcomeDone = false;
  let audioCtxUnlocked = false;

  /* Chime pembuka — Web Audio API (tanpa file) */
  function playChime(){
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();

      // beberapa browser butuh resume dulu
      if (ctx.state === 'suspended') ctx.resume().catch(()=>{});

      const notes = [
        { freq: 587.33, start: 0.00, dur: 0.35 },  // D5
        { freq: 880.00, start: 0.18, dur: 0.55 }   // A5
      ];
      notes.forEach(n => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = n.freq;

        const t0 = ctx.currentTime + n.start;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.25, t0 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.dur);

        osc.connect(gain).connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + n.dur + 0.05);
      });
    } catch(e){ /* diamkan */ }
  }

  /* TTS: ucapkan sambutan */
  function speakWelcome(force){
    if (welcomeDone && !force) return;
    welcomeDone = true;

    playChime();

    setTimeout(() => {
      if (!('speechSynthesis' in window)) return;

      const u = new SpeechSynthesisUtterance(WELCOME_TEXT);
      u.lang   = 'id-ID';
      u.rate   = 0.95;
      u.pitch  = 1.05;
      u.volume = 1.0;

      const voices  = speechSynthesis.getVoices();
      const idVoice = voices.find(v => /id[-_]ID/i.test(v.lang))
                   || voices.find(v => /indonesia/i.test(v.name));
      if (idVoice) u.voice = idVoice;

      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    }, 500);
  }

  /* Preload daftar voice */
  if ('speechSynthesis' in window) {
    speechSynthesis.onvoiceschanged = () => {};
    speechSynthesis.getVoices();
  }

  /* Auto-play saat NUI pertama kali dibuka */
  window.addEventListener('load', () => {
    setTimeout(() => speakWelcome(false), 1200);
  });

  /* Fallback: unlock AudioContext saat interaksi pertama
     (untuk bypass autoplay policy di browser biasa) */
  function unlockAudio(){
    if (audioCtxUnlocked) return;
    audioCtxUnlocked = true;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        const c = new Ctx();
        if (c.state === 'suspended') c.resume();
      }
      // putar speech sekali tanpa suara untuk unlock
      if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(' ');
        u.volume = 0;
        speechSynthesis.speak(u);
      }
    } catch(e){}
  }
  window.addEventListener('pointerdown', unlockAudio, { once:true });
  window.addEventListener('keydown',     unlockAudio, { once:true });

  /* API global supaya bisa dipanggil manual dari script lain */
  window.playWelcomeSound = function(force){ speakWelcome(!!force); };

})();