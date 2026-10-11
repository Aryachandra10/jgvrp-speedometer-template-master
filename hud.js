/* ==========================================================
   hud.js — render layer untuk script.js (FiveM GTA V)
   ----------------------------------------------------------
   Format data yang dibaca dari script.js:
     engine     → "On" / "Off"
     speed      → "120 MPH" / "88 KMH" / "42 Knots"
     rpm        → "0.6500 RPM"  (0-1, dinormalisasi)
     fuel       → "78.5%"
     health     → "92.0%"
     gear       → "4" / "0"  (0 = N)
     headlights → "Off" / "On" / "High Beam"
     indicators → "On / Off"  (kiri / kanan)
     seatbelts  → "On" / "Off"
     odometer   → "48213.4 Miles"
   ----------------------------------------------------------
   Sound seatbelt dikontrol manual (tidak ada chime otomatis).
   ========================================================== */
(function () {
  'use strict';

  /* =======================================================
     0. KONFIGURASI
     ======================================================= */
  const DEMO_MODE   = false;   // true = preview tanpa game
  const MAX_RPM     = 8000;
  const REDLINE_RPM = 6600;

  const CX = 200, CY = 200, R = 136;
  const START = 135, SWEEP = 270;
  const CIRC  = 2 * Math.PI * R;
  const ARC   = CIRC * (SWEEP / 360);
  const SVGNS = 'http://www.w3.org/2000/svg';
  const $ = id => document.getElementById(id);

  /* =======================================================
     1. ELEMEN HUD
     ======================================================= */
  const hud     = $('hud');
  const dial    = $('dial');
  const rpmFill = $('rpmFill');
  const rpmTrk  = $('rpmTrack');
  const marker  = $('marker');
  const ticksG  = $('ticks');
  const labelsG = $('labels');

  const vSpeed = $('vSpeed');
  const vRpm   = $('vRpm');
  const vGear  = $('vGear');
  const vOdo   = $('vOdo');
  const vFuel  = $('vFuel');
  const vHealth= $('vHealth');
  const vUnit  = $('vUnit');
  const fFuel  = $('fFuel');
  const fHealth= $('fHealth');

  const chipEngine  = $('chipEngine');
  const chipLights  = $('chipLights');
  const chipBelt    = $('chipBelt');
  const indLeft     = $('indLeft');
  const indRight    = $('indRight');
  const mFuel       = $('mFuel');
  const mHealth     = $('mHealth');
  const seatbeltWarn= $('seatbeltWarning');
  const beltSound   = $('seatbeltSound');   // 🔊 audio manual

  /* =======================================================
     2. BANGUN TICK & LABEL
     ======================================================= */
  rpmTrk.style.strokeDasharray  = ARC + ' ' + CIRC;
  rpmFill.style.strokeDasharray = '0 ' + CIRC;

  const polar = (deg, r) => {
    const a = deg * Math.PI / 180;
    return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
  };
  function mkLine(x1,y1,x2,y2,cls){
    const l = document.createElementNS(SVGNS,'line');
    l.setAttribute('x1',x1.toFixed(2));
    l.setAttribute('y1',y1.toFixed(2));
    l.setAttribute('x2',x2.toFixed(2));
    l.setAttribute('y2',y2.toFixed(2));
    l.setAttribute('class',cls);
    return l;
  }
  for (let i=0;i<=8;i++){
    const deg = START + SWEEP * i/8;
    const [x1,y1]=polar(deg,108), [x2,y2]=polar(deg,124);
    ticksG.appendChild(mkLine(x1,y1,x2,y2,'tick major'));
    const [lx,ly]=polar(deg,90);
    const t=document.createElementNS(SVGNS,'text');
    t.setAttribute('x',lx.toFixed(2));
    t.setAttribute('y',ly.toFixed(2));
    t.setAttribute('text-anchor','middle');
    t.setAttribute('dominant-baseline','middle');
    t.setAttribute('class','label');
    t.textContent=i;
    labelsG.appendChild(t);
  }
  for (let i=0;i<8;i++){
    for (let j=1;j<=4;j++){
      const deg = START + SWEEP * (i + j/5)/8;
      const [x1,y1]=polar(deg,117), [x2,y2]=polar(deg,124);
      ticksG.appendChild(mkLine(x1,y1,x2,y2,'tick'));
    }
  }

  /* =======================================================
     3. SUMBER DATA (diisi oleh script.js)
     ======================================================= */
  const SRC = {
    engine:$('engine'), speed:$('speed'), rpm:$('rpm'),
    fuel:$('fuel'), health:$('health'), gear:$('gear'),
    headlights:$('headlights'), indicators:$('indicators'),
    seatbelts:$('seatbelts'), odometer:$('odometer')
  };
  const txt = id => (SRC[id] && SRC[id].textContent || '').trim();

  /* ---------- Parser format script.js ---------- */

  // "120 MPH" → 120
  function parseSpeed(){
    const m = /^(-?\d+(?:\.\d+)?)/.exec(txt('speed'));
    return m ? Math.max(0, parseFloat(m[1])) : 0;
  }

  // "120 MPH" → "mph" | "88 KMH" → "km/h" | "42 Knots" → "kn"
  function parseSpeedUnit(){
    const t = txt('speed');
    if (/KMH/i.test(t))   return 'km/h';
    if (/Knots/i.test(t)) return 'kn';
    return 'mph';
  }

  // "0.6500 RPM" (0-1) → 5200 RPM
  function parseRpm(){
    const m = /^(-?\d+(?:\.\d+)?)/.exec(txt('rpm'));
    if (!m) return 0;
    const raw = parseFloat(m[1]);
    // script.js kirim nilai 0-1; kalau > 1 anggap RPM mentah
    return raw <= 1 ? raw * MAX_RPM : raw;
  }

  // "78.5%" → 78.5
  function parsePercent(id){
    const m = /^(-?\d+(?:\.\d+)?)/.exec(txt(id));
    return m ? Math.min(100, Math.max(0, parseFloat(m[1]))) : 0;
  }

  // "4" → "4" | "0" → "N"
  function parseGear(){
    const t = txt('gear');
    if (!t) return 'N';
    if (t === '0') return 'N';
    return t.toUpperCase().slice(0,2);
  }

  // "On" / "Off" / "High Beam" → boolean
  function parseBoolOnOff(id){
    return /^(on|high beam|true|1|yes)$/i.test(txt(id));
  }

  // "On / Off" → 'left' | 'right' | 'both' | 'off'
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

  // "48213.4 Miles" → 48213.4
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
     4. DEMO AUTOPILOT (hanya kalau DEMO_MODE = true)
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
    const k  = Math.min(1, dt*8);   // jarum RPM (cepat)
    const ks = Math.min(1, dt*4);   // angka speed/fuel (halus)
    view.speed  = lerp(view.speed,  s.speed,  ks);
    view.rpm    = lerp(view.rpm,    s.rpm,    k);
    view.fuel   = lerp(view.fuel,   s.fuel,   ks);
    view.health = lerp(view.health, s.health, ks);
    view.odo    = lerp(view.odo,    s.odometer, ks);
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
  let lastGear = null;
  let lastBelt = null;

  function render(){
    /* --- RPM Ring --- */
    const rpmFrac = clamp(view.rpm / MAX_RPM, 0, 1);
    rpmFill.style.strokeDasharray = (ARC*rpmFrac).toFixed(2)+' '+CIRC.toFixed(2);

    const deg = START + SWEEP*rpmFrac;
    const rad = deg*Math.PI/180;
    marker.setAttribute('transform',
      'translate('+(CX+R*Math.cos(rad)).toFixed(2)+' '+
                    (CY+R*Math.sin(rad)).toFixed(2)+')');
    dial.classList.toggle('redline', view.rpm >= REDLINE_RPM);

    /* --- Angka tengah --- */
    setText(vSpeed, String(Math.round(view.speed)));
    setText(vRpm,   String(Math.round(view.rpm/10)*10));
    setText(vUnit,  view.speedUnit);

    /* --- Gear (animasi pop saat berubah) --- */
    if (view.gear !== lastGear){
      const span = vGear.querySelector('span');
      if (span) span.textContent = view.gear;
      vGear.classList.remove('pop');
      void vGear.offsetWidth;
      vGear.classList.add('pop');
      lastGear = view.gear;
    }

    /* --- Odometer --- */
    setText(vOdo, String(Math.round(view.odo)).padStart(6,'0'));

    /* --- Fuel & Health --- */
    const fuelPct   = clamp(view.fuel,   0, 100);
    const healthPct = clamp(view.health, 0, 100);
    fFuel.style.width   = fuelPct+'%';
    fHealth.style.width = healthPct+'%';
    setText(vFuel,   Math.round(fuelPct)+'%');
    setText(vHealth, Math.round(healthPct)+'%');
    mFuel.classList.toggle('low',   fuelPct   <= 15);
    mHealth.classList.toggle('low', healthPct <= 30);

    /* --- Chips --- */
    chipEngine.classList.toggle('on', view.engine);
    chipLights.classList.toggle('on', view.headlights);
    chipBelt.classList.toggle('on',   view.seatbelts);

    /* --- Indikator sein --- */
    const ind = view.indicators;
    const both = ind === 'both';
    indLeft.classList.toggle('on',  both || ind === 'left');
    indRight.classList.toggle('on', both || ind === 'right');

    /* --- 🔔 SEATBELT: visual + sound manual --- */
    const beltOn = view.seatbelts;
    if (beltOn !== lastBelt){
      lastBelt = beltOn;

      // Banner visual
      if (seatbeltWarn) seatbeltWarn.classList.toggle('on', !beltOn);

      // Sound manual (dikontrol dari <audio id="seatbeltSound">)
      if (beltSound) {
        if (beltOn) {
          beltSound.pause();
          beltSound.currentTime = 0;
        } else {
          beltSound.play().catch(()=>{});   // .catch untuk autoplay policy
        }
      }
    }
  }

  /* =======================================================
     7. PARALLAX 3D (mouse / sentuh)
     ======================================================= */
  const BASE_RX = 7;
  function tiltTo(nx, ny){
    hud.style.setProperty('--ry', (nx*11).toFixed(2)+'deg');
    hud.style.setProperty('--rx', (BASE_RX - ny*9).toFixed(2)+'deg');
  }
  window.addEventListener('pointermove', e=>{
    const nx = (e.clientX/window.innerWidth )*2 - 1;
    const ny = (e.clientY/window.innerHeight)*2 - 1;
    tiltTo(clamp(nx,-1,1), clamp(ny,-1,1));
  }, { passive:true });
  window.addEventListener('pointerleave', ()=>tiltTo(0,0), { passive:true });

  /* Idle drift halus saat tidak ada input */
  let idleTimer = null;
  function idleTilt(){
    const t = performance.now()/2600;
    tiltTo(Math.sin(t)*0.35, Math.cos(t*0.8)*0.3);
    idleTimer = requestAnimationFrame(idleTilt);
  }
  window.addEventListener('pointermove', ()=>{
    if (idleTimer){ cancelAnimationFrame(idleTimer); idleTimer = null; }
    clearTimeout(window.__idleT);
    window.__idleT = setTimeout(()=>{ if (!idleTimer) idleTilt(); }, 2600);
  }, { passive:true });
  idleTilt();

  /* =======================================================
     8. LOOP UTAMA
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
     9. API PUBLIK
        window.HUD.update({ speed:"120 MPH", rpm:"0.65 RPM", ... })
     ======================================================= */
  window.HUD = {
    update(data){
      if (!data) return;
      Object.keys(data).forEach(k=>{
        const el = SRC[k];
        if (!el) return;
        const v = typeof data[k] === 'boolean' ? (data[k]?'On':'Off') : data[k];
        el.textContent = v;
      });
    }
  };

  /* =======================================================
     10. NUI MESSAGE HANDLER (FiveM)
         Dukung kontrol sound manual via SendNUIMessage
     ======================================================= */
  window.addEventListener('message', e => {
    const d = e.data;
    if (!d) return;

    // Kontrol sound seatbelt dari Lua
    if (d.type === 'seatbeltSound' && beltSound){
      if (d.on) { beltSound.pause(); beltSound.currentTime = 0; }
      else      { beltSound.play().catch(()=>{}); }
      return;
    }

    // Update data HUD massal via NUI
    if (d.type === 'hudUpdate' && d.data) {
      window.HUD.update(d.data);
    }
  });

})();