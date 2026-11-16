// Buddy Radio - live map. Reads /api/state from a Radio Ops PC (through an https tunnel),
// or plays a built-in demo when no address is set.
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const HU = document.documentElement.lang === "hu";
  const T = HU ? {"tilesOutline": "A térképcsempék nem töltődtek be, ezért ez egy egyszerű körvonaltérkép. Az egységek ugyanúgy élőben látszanak.", "tilesFail": "A térkép háttere nem töltődött be. Az egységek így is látszanak.", "fromYou": "Tőled", "fromBull": "Bullseye-tól", "pick": "Válaszd ki a gépedet", "heading": "irány", "fuel": "üzemanyag", "unit": "egység", "units": "egység", "moving": "mozog", "range": "hatótáv", "runway": "pálya", "wind": "szél", "tower": "torony", "forCs": "kérte:", "noAirfields": "Még nincs adat", "noTargets": "Még nincs. Kérd Overlordtól a földi fenyegetéseket.", "noPasses": "Még nincs leszállás", "avgRow": "{0} átlag, {1} leszállás", "missionTime": "küldetésidő", "noData": "A Radio Ops fut, de még nincs küldetésadat", "live": "Élő", "wrongKey": "Rossz térképkulcs", "noReach": "A Radio Ops nem érhető el", "keyToast": "A térképkulcs nem egyezik a stations.json map_key értékével.", "noAnswer": "Nincs válasz innen: {0}. Fut a Radio Ops, és nyitva van a tunnel?", "demo": "Demó", "needHttps": "A cím https://-sel kezdődik", "mixed": "A tunnel https címét használd. A böngészők biztonságos oldalról letiltják a sima http-t.", "pasteAddr": "Illeszd be a címet, amit a tunnel kiírt, vagy válaszd a demót.", "connecting": "Csatlakozás", "addFirst": "Előbb add meg a Radio Ops címét.", "copied": "Link kimásolva. Aki megkapja, látja a küldetéstérképet.", "demoToast": "Ez egy demó küldetés. Felül a Demó gombbal csatlakoztathatod a sajátodat."} : {"tilesOutline": "Map tiles didn't load, so this is a simple outline map. Units are live as usual.", "tilesFail": "Map background didn't load. Units are still shown.", "fromYou": "From you", "fromBull": "From bullseye", "pick": "Pick your aircraft", "heading": "heading", "fuel": "fuel", "unit": "unit", "units": "units", "moving": "moving", "range": "range", "runway": "runway", "wind": "wind", "tower": "tower", "forCs": "for", "noAirfields": "None reported yet", "noTargets": "None yet. Ask Overlord for ground threats.", "noPasses": "No passes yet", "avgRow": "{0} over {1} passes", "missionTime": "mission time", "noData": "Radio Ops is up, but no mission data yet", "live": "Live", "wrongKey": "Wrong map key", "noReach": "Can't reach Radio Ops", "keyToast": "The map key doesn't match map_key in stations.json.", "noAnswer": "No answer from {0}. Is Radio Ops running and the tunnel open?", "demo": "Demo", "needHttps": "The address starts with https://", "mixed": "Use the https address from your tunnel. Browsers block plain http from a secure page.", "pasteAddr": "Paste the address your tunnel printed, or choose Show the demo.", "connecting": "Connecting", "addFirst": "Add the Radio Ops address first.", "copied": "Link copied. Anyone with it can see your mission map.", "demoToast": "Showing a demo mission. Choose Demo at the top to connect your own."};
  const tr = (k, ...a) => T[k].replace(/\{(\d)\}/g, (_, i) => a[i]);
  const store = {
    get(k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } },
    set(k, v) { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) {} },
  };

  // ----- connection settings: ?server=&key= wins, then what this browser remembers -----
  const qs = new URLSearchParams(location.search);
  let server = (qs.get("server") || store.get("buddy.server")).trim().replace(/\/+$/, "");
  let key = (qs.get("key") || store.get("buddy.key")).trim();
  if (qs.get("server")) { store.set("buddy.server", server); store.set("buddy.key", key); history.replaceState(null, "", location.pathname); }
  let mode = server ? "live" : "demo";

  // ----- map -----
  const map = L.map("map", { zoomControl: false, attributionControl: true }).setView([33.1, 35.2], 8);
  map.attributionControl.setPrefix(false);
  L.control.zoom({ position: "bottomleft" }).addTo(map);
  L.control.scale({ imperial: true, metric: false, position: "bottomright" }).addTo(map);
  // Background: OpenStreetMap tiles. If they can't load (offline, blocked), fall back to a
  // simple coastline and border outline shipped with the site (Natural Earth, public domain).
  let tileErrors = 0, fallback = null;
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 15, attribution: "© OpenStreetMap contributors" })
    .on("tileerror", () => { if (++tileErrors === 4) useFallback(); })
    .addTo(map);
  async function useFallback() {
    if (fallback) return;
    fallback = L.layerGroup().addTo(map);
    try {
      const g = await (await fetch("/assets/basemap.json")).json();
      L.geoJSON(g.land, { style: { color: "#55626c", weight: 1, fillColor: "#25303a", fillOpacity: 1 }, interactive: false }).addTo(fallback);
      L.geoJSON(g.borders, { style: { color: "#55626c", weight: 1, dashArray: "4 4" }, interactive: false }).addTo(fallback);
      fallback.eachLayer(l => l.bringToBack());
      toast(T.tilesOutline);
    } catch (e) { toast(T.tilesFail); }
  }

  const layers = { air: L.layerGroup().addTo(map), ground: L.layerGroup().addTo(map), rings: L.layerGroup().addTo(map),
                   ab: L.layerGroup().addTo(map), tgt: L.layerGroup().addTo(map), misc: L.layerGroup().addTo(map) };
  const markers = {};
  let state = null, tick = 0, me = store.get("buddy.me"), follow = false, rings = true, labels = true, centred = false;

  const C = { friend: "#4fa3ff", foe: "#ff5a5a", own: "#5fd68f", deck: "#f2b705" };
  const plane = c => `<svg viewBox="0 0 24 24"><path fill="${c}" stroke="#000" stroke-width=".6" d="M12 2 L14 9 L22 13 L22 15 L14 13 L13.5 19 L16 21 L16 22 L12 21 L8 22 L8 21 L10.5 19 L10 13 L2 15 L2 13 L10 9 Z"/></svg>`;
  const heli = c => `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="${c}" stroke="#000" stroke-width=".6"/><path stroke="${c}" stroke-width="2" d="M3 3 L21 21 M21 3 L3 21"/></svg>`;
  const ship = c => `<svg viewBox="0 0 24 24"><path fill="${c}" stroke="#000" stroke-width=".6" d="M12 2 L17 7 L17 20 L7 20 L7 7 Z"/></svg>`;
  const HELI = /Hip|Hind|Havoc|Hokum|Apache|Cobra|Huey|Black Hawk|Chinook|Kiowa|Gazelle|Halo|Helix/;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const deg3 = n => String(Math.round(((n % 360) + 360) % 360) % 360 || 360).padStart(3, "0");

  function braa(a, b) {
    const R = 3440.065, r = Math.PI / 180;
    const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
    const nm = 2 * R * Math.asin(Math.sqrt(h));
    const y = Math.sin(dLon) * Math.cos(b.lat * r);
    const x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos(dLon);
    return { brg: deg3(Math.atan2(y, x) / r - (state.magvar || 0)), nm: nm < 10 ? nm.toFixed(1) : Math.round(nm) };
  }
  function popup(title, sub, pos) {
    const mine = state.air.find(a => a.name === me);
    let s = `<b>${esc(title)}</b>${sub ? "<br>" + sub : ""}`;
    if (mine && pos && (mine.lat !== pos.lat || mine.lon !== pos.lon)) { const b = braa(mine, pos); s += `<br>${T.fromYou}: <b>${b.brg} / ${b.nm} nm</b>`; }
    if (state.bullseye && state.bullseye.lat && pos) { const b = braa(state.bullseye, pos); s += `<br>${T.fromBull}: ${b.brg} / ${b.nm} nm`; }
    return s;
  }
  function upsert(k, layer, ll, opts) {
    let m = markers[k];
    if (!m) { m = L.marker(ll, opts).addTo(layer); markers[k] = m; }
    else { m.setLatLng(ll); if (opts.icon) m.setIcon(opts.icon); }
    m._seen = tick;
    return m;
  }
  function airIcon(u, showLabel) {
    const c = u.side === "hostile" ? C.foe : (u.name === me ? C.own : C.friend);
    const name = esc(u.player || u.type);
    const lbl = labels && showLabel ? `<div class="lbl" style="color:${c}">${name}<small>${Math.round(u.alt_ft / 100) / 10}k ft, ${u.kt} kt${u.player ? ", " + esc(u.type) : ""}</small></div>` : "";
    return L.divIcon({ className: "", iconSize: [26, 26], iconAnchor: [13, 13],
      html: `<div class="ac" style="transform:rotate(${u.hdg}deg)">${HELI.test(u.type) ? heli(c) : plane(c)}</div>${lbl}` });
  }

  function render() {
    tick++;
    const sel = $("me");
    const humans = state.air.filter(a => a.player && a.side === "friendly");
    const opts = `<option value="">${T.pick}</option>` + humans.map(a => `<option value="${esc(a.name)}"${a.name === me ? " selected" : ""}>${esc(a.player)}</option>`).join("");
    if (sel.dataset.last !== opts) { sel.innerHTML = opts; sel.dataset.last = opts; }

    // one label per flight when its aircraft fly close together (wingmen would overlap the lead)
    const labelled = [];
    const close = (a, b) => Math.abs(a.lat - b.lat) < 0.03 && Math.abs(a.lon - b.lon) < 0.04;
    state.air.forEach(u => {
      const show = u.name === me || !labelled.some(l => l.group && l.group === u.group && close(l, u));
      if (show) labelled.push(u);
      upsert("a:" + u.name, layers.air, [u.lat, u.lon], { icon: airIcon(u, show), zIndexOffset: u.side === "hostile" ? 500 : 400 })
        .bindPopup(() => popup(u.player || u.type, `${esc(u.type)}<br>${u.alt_ft.toLocaleString()} ft, ${u.kt} kt, ${T.heading} ${deg3(u.hdg - state.magvar)}${u.player && u.fuel != null ? `, ${T.fuel} ${Math.round(u.fuel * 100)}%` : ""}`, u));
    });
    layers.rings.clearLayers();
    state.ground.forEach(g => {
      upsert("g:" + g.group, layers.ground, [g.lat, g.lon], { icon: L.divIcon({ className: "", iconSize: [13, 13], iconAnchor: [7, 7], html: `<div class="gnd${g.sam_nm ? " sam" : ""}"></div>` }) })
        .bindPopup(() => popup(g.name, `${g.count} ${g.count > 1 ? T.units : T.unit}${g.moving ? ", " + T.moving : ""}${g.sam_nm ? `, ${T.range} ${g.sam_nm} nm` : ""}`, g));
      if (rings && g.sam_nm) L.circle([g.lat, g.lon], { radius: g.sam_nm * 1852, color: C.deck, weight: 1, fillColor: C.deck, fillOpacity: .07, interactive: false }).addTo(layers.rings);
    });
    state.airbases.forEach(a => {
      if (a.kind === "helipad" && map.getZoom() < 10) return;
      upsert("b:" + a.name, layers.ab, [a.lat, a.lon], { icon: L.divIcon({ className: "", iconSize: [10, 10], iconAnchor: [5, 5], html: `<div class="ab ${esc(a.side)}"></div>` }), zIndexOffset: -100 })
        .bindPopup(() => popup(a.name, [a.runway && `${T.runway} ${esc(a.runway)}`, a.wind && `${T.wind} ${esc(a.wind)}`, a.freq && `${T.tower} ${a.freq.toFixed(3)}`].filter(Boolean).join(", "), a));
    });
    state.carriers.forEach(c => {
      const col = c.side === "blue" ? C.friend : C.foe;
      upsert("c:" + c.name, layers.misc, [c.lat, c.lon], { icon: L.divIcon({ className: "", iconSize: [26, 26], iconAnchor: [13, 13],
        html: `<div class="ac" style="transform:rotate(${c.hdg}deg)">${ship(col)}</div>${labels ? `<div class="lbl" style="color:${col}">${esc(c.name)}<small>BRC ${deg3(c.hdg - state.magvar)}, ${c.kt} kt</small></div>` : ""}` }) })
        .bindPopup(() => popup(c.name, `BRC ${deg3(c.hdg - state.magvar)}, ${c.kt} kt`, c));
    });
    state.targets.forEach(t => {
      upsert("t:" + t.key, layers.tgt, [t.lat, t.lon], { icon: L.divIcon({ className: "", iconSize: [18, 18], iconAnchor: [9, 9], html: '<div class="tgt"></div>' }), zIndexOffset: 600 })
        .bindPopup(() => popup(t.name, `${T.forCs} ${esc(t.callsign)}<br><code>${esc(t.latlong)}</code><br><code>${esc(t.mgrs)}</code>, ${t.elev_ft} ft`, t));
    });
    if (state.bullseye && state.bullseye.lat)
      upsert("bull", layers.misc, [state.bullseye.lat, state.bullseye.lon], { icon: L.divIcon({ className: "", iconSize: [22, 22], iconAnchor: [11, 11], html: '<div class="bull" title="Bullseye"></div>' }), interactive: false, zIndexOffset: -200 });
    for (const k in markers) if (markers[k]._seen !== tick) { markers[k].remove(); delete markers[k]; }

    const mine = state.air.find(a => a.name === me);
    if (follow && mine) map.panTo([mine.lat, mine.lon], { animate: false });
    if (!centred) {
      const pts = mine ? [[mine.lat, mine.lon]] : state.air.concat(state.carriers, state.airbases.filter(a => a.kind !== "helipad")).map(a => [a.lat, a.lon]);
      if (pts.length) { mine ? map.setView(pts[0], 9) : map.fitBounds(pts, { padding: [60, 60], maxZoom: 9 }); centred = true; }
    }

    const rows = (arr, f, empty) => arr.length ? arr.map(f).join("") : `<div class="row"><span>${empty}</span></div>`;
    $("abList").innerHTML = rows(state.airbases.filter(a => a.kind !== "helipad").slice(0, 12), a => `<div class="row"><span>${esc(a.name)}</span><span>${a.runway ? T.runway + " " + esc(a.runway) : ""} ${esc(a.wind || "")}</span></div>`, T.noAirfields);
    $("tgtList").innerHTML = rows(state.targets.slice().reverse(), t => `<div class="row"><span>${esc(t.name)}<br><small>${esc(t.callsign)}</small></span><span>${esc(t.mgrs)}</span></div>`, T.noTargets);
    $("greenie").innerHTML = rows(state.greenie || [], (g, i) => `<div class="row"><span>${i + 1}. ${esc(g.pilot)}</span><span>${tr("avgRow", g.avg, g.passes)} ${esc(g.squares)}</span></div>`, T.noPasses);
    $("stations").innerHTML = rows(state.stations || [], s => `<div class="row"><span>${esc(s.name)}</span><span>${s.freq.toFixed(3)} AM</span></div>`, "");
    const t = state.time;
    $("clock").textContent = t == null ? "" : `${String(Math.floor(t / 3600) % 24).padStart(2, "0")}:${String(Math.floor(t / 60) % 60).padStart(2, "0")} ${T.missionTime}`;
  }

  // ----- data: live or demo -----
  let failures = 0;
  async function fetchLive() {
    const url = `${server}/api/state${key ? "?key=" + encodeURIComponent(key) : ""}`;
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 5000);
    try {
      const r = await fetch(url, { cache: "no-store", signal: ctl.signal });
      if (r.status === 403) throw new Error("key");
      const s = await r.json();
      if (s.error && !s.air.length) setStatus("down", s.error.includes("no DCS data") ? T.noData : s.error);
      else setStatus("live", T.live);
      failures = 0;
      return s;
    } catch (e) {
      failures++;
      setStatus("down", e.message === "key" ? T.wrongKey : T.noReach);
      if (failures === 3) toast(e.message === "key" ? T.keyToast : tr("noAnswer", server));
      return null;
    } finally { clearTimeout(to); }
  }
  function setStatus(kind, text) { const b = $("status"); b.className = "status " + kind; b.textContent = text; }

  async function loop() {
    let s = null;
    if (mode === "live") s = await fetchLive();
    else { s = demo(Date.now() / 1000); setStatus("demo", T.demo); }
    if (s) { state = s; render(); }
    setTimeout(loop, 1000);
  }

  // A small made-up mission off the Levant coast, so the page has something to show.
  function demo(t) {
    const rad = Math.PI / 180;
    const orbit = (lat, lon, rNm, period, phase, cw) => {
      const dir = cw ? 1 : -1;
      const at = a => ({ lat: lat + rNm / 60 * Math.cos(a), lon: lon + rNm / 60 * Math.sin(a) / Math.cos(lat * rad) });
      const a = dir * (t / period) * 2 * Math.PI + phase;
      const p = at(a), q = at(a + dir * 0.01);
      return { lat: p.lat, lon: p.lon, hdg: (Math.atan2((q.lon - p.lon) * Math.cos(lat * rad), q.lat - p.lat) / rad + 360) % 360 };
    };
    const air = [];
    const add = (name, side, type, player, p, altFt, kt, group) => air.push({ name, side, type, player, lat: p.lat, lon: p.lon, hdg: p.hdg, alt_ft: altFt, kt, inAir: true, fuel: .62, group });
    add("K31", "friendly", "Hornet", "Kupi 3-1", orbit(33.25, 35.15, 9, 260, 0, true), 22000, 420, "K3");
    add("K32", "friendly", "Hornet", "Kupi 3-2", orbit(33.25, 35.15, 9, 260, -.06, true), 22000, 420, "K3");
    add("L11", "friendly", "Hornet", "Lama 1-1", orbit(32.98, 35.57, 4, 120, 1.2, false), 3500, 250, "L1");
    add("V11", "friendly", "Apache", "Viking 1-1", orbit(33.05, 35.75, 2.5, 140, 2, true), 300, 110, "V1");
    add("B1", "hostile", "Fulcrum", "", orbit(33.55, 36.1, 7, 300, 3, false), 18000, 450, "R1");
    add("B2", "hostile", "Fulcrum", "", orbit(33.55, 36.1, 7, 300, 2.94, false), 18000, 450, "R1");
    add("H1", "hostile", "Hind", "", orbit(33.18, 36.05, 2, 160, 0, true), 600, 120, "R2");
    const shipLon = 34.45 - ((t % 3600) / 3600) * 0.12;
    return {
      time: 11 * 3600 + 30 * 60 + (t % 3600), theatre: "Syria", magvar: 5,
      bullseye: { lat: 33.3, lon: 35.9 },
      air,
      ground: [
        { group: "SA6", name: "SA-6", lat: 33.32, lon: 36.18, count: 4, sam_nm: 13, moving: false },
        { group: "AAA", name: "Shilka triple-A", lat: 33.12, lon: 35.98, count: 2, sam_nm: 1.5, moving: false },
        { group: "TR", name: "4 vehicles, BTR-80", lat: 33.2, lon: 35.93, count: 4, sam_nm: null, moving: true },
      ],
      airbases: [
        { name: "Rosh Pina", kind: "airdrome", side: "blue", lat: 32.983, lon: 35.571, runway: "33", wind: "330/10", freq: 251.5 },
        { name: "Ramat David", kind: "airdrome", side: "blue", lat: 32.665, lon: 35.18, runway: "33", wind: "320/9" },
        { name: "Kiryat Shmona", kind: "airdrome", side: "blue", lat: 33.217, lon: 35.6, runway: "03", wind: "330/8" },
        { name: "Mezzeh", kind: "airdrome", side: "red", lat: 33.477, lon: 36.223, runway: "24", wind: "310/7" },
      ],
      carriers: [{ name: "Mother", type: "Stennis", side: "blue", lat: 33.2, lon: shipLon, hdg: 270, kt: 20 }],
      targets: [{ key: "demo-sa6", name: "SA-6", callsign: "Kupi 3-1", lat: 33.32, lon: 36.18, latlong: "N 33 19.200  E 036 10.800", mgrs: "37S BS 37480 90313", elev_ft: 2310 }],
      greenie: [{ pilot: "Kupi 3-1", avg: 3.75, passes: 8, squares: "" }, { pilot: "Lama 1-1", avg: 3.4, passes: 5, squares: "" }],
      stations: [{ name: "Overlord", freq: 251 }, { name: "Rosh Pina Tower", freq: 251.5 }, { name: "Rosh Pina ATIS", freq: 251.75 }, { name: "Buddy", freq: 252 }, { name: "Paddles", freq: 253 }],
    };
  }

  // ----- controls -----
  let toastT;
  function toast(msg) { const el = $("toast"); el.textContent = msg; el.style.display = "block"; clearTimeout(toastT); toastT = setTimeout(() => el.style.display = "none", 5000); }
  const press = (id, on) => $(id).setAttribute("aria-pressed", on);
  $("me").onchange = e => { me = e.target.value; store.set("buddy.me", me); centred = false; };
  $("follow").onclick = () => { follow = !follow; press("follow", follow); };
  $("rings").onclick = () => { rings = !rings; press("rings", rings); if (state) render(); };
  $("lbls").onclick = () => { labels = !labels; press("lbls", labels); if (state) render(); };
  $("panelBtn").onclick = () => { const open = $("side").classList.toggle("open"); $("panelBtn").setAttribute("aria-expanded", open); };
  map.on("dragstart", () => { follow = false; press("follow", false); });
  map.on("zoomend", () => { if (state) render(); });
  const fitSide = () => { if (innerWidth > 720) $("side").style.top = $("bar").offsetHeight + "px"; else $("side").style.top = ""; };
  addEventListener("resize", fitSide); fitSide();

  const dlg = $("connect");
  $("status").onclick = () => { $("server").value = server; $("key").value = key; $("connErr").textContent = ""; dlg.showModal(); };
  $("connectForm").addEventListener("submit", e => {
    const s = $("server").value.trim().replace(/\/+$/, "");
    const err = s ? (!/^https?:\/\//.test(s) ? T.needHttps
      : (location.protocol === "https:" && s.startsWith("http://") && !/^http:\/\/(localhost|127\.0\.0\.1)/.test(s))
        ? T.mixed : "")
      : T.pasteAddr;
    if (err) { e.preventDefault(); $("connErr").textContent = err; return; }
    server = s; key = $("key").value.trim(); store.set("buddy.server", server); store.set("buddy.key", key);
    mode = "live"; failures = 0; centred = false; setStatus("down", T.connecting);
  });
  $("useDemo").onclick = () => { mode = "demo"; server = ""; store.set("buddy.server", ""); centred = false; dlg.close(); };
  $("share").onclick = async () => {
    const s = $("server").value.trim().replace(/\/+$/, ""), k = $("key").value.trim();
    if (!s) { $("connErr").textContent = T.addFirst; return; }
    const link = `${location.origin}${location.pathname}?server=${encodeURIComponent(s)}${k ? "&key=" + encodeURIComponent(k) : ""}`;
    try { await navigator.clipboard.writeText(link); $("connErr").textContent = ""; toast(T.copied); }
    catch (e) { $("connErr").textContent = link; }
  };

  if (mode === "demo") toast(T.demoToast);
  loop();
})();
