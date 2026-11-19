// Buddy Radio - the radio on the home page: pick a frequency, read a typical exchange.
(function () {
  const stations = {
    overlord: {
      freq: "251.000", name: "Overlord", role: "GCI: the air and ground picture", role_hu: "GCI: a légi és földi helyzetkép",
      log: [
        ["you", "Kupi 3-1", "Overlord, Kupi 3-1, bogey dope."],
        ["stn", "Overlord", "Kupi 3-1, Overlord, BRAA, two-seven-zero, 25, 15 thousand, hot, single contact, Fishbed."],
        ["auto", "Overlord", "Kupi 3-1, Overlord, SAM threat, SA-6, zero-eight-five, 16, approaching its range."],
        ["you", "Kupi 3-1", "Overlord, Kupi 3-1, request tanker."],
        ["stn", "Overlord", "Kupi 3-1, Overlord, Texaco 1-1, KC-135, boom, bearing zero-two-three, 40 miles, angels 22, TACAN 51 Yankee, frequency two six zero decimal zero."],
      ],
      note: "Tanker calls pick a boom or basket tanker to suit your jet. Ground threat coordinates are read slowly, shown on screen, marked on your F10 map and posted to Discord.",
      note_hu: "A tankerhívásnál a gépedhez illő, gémes vagy kosaras tankert kapod. A földi célok koordinátáit lassan olvassa fel, kiírja a képernyődre, jelöli az F10 térképen és elküldi Discordra.",
    },
    tower: {
      freq: "251.500", name: "Tower", role: "Ground and tower for every airfield on every map", role_hu: "Föld és torony minden térkép minden repülőterén",
      log: [
        ["you", "Lama 1-1", "Kutaisi Tower, Lama 1-1, request information."],
        ["stn", "Tower", "Lama 1-1, Kutaisi Tower, Kutaisi information Golf. Runway in use zero seven. Wind two-five-zero at 12. Altimeter two niner niner two."],
        ["you", "Lama 1-1", "Tower, Lama 1-1, request taxi."],
        ["stn", "Tower", "Lama 1-1, Kutaisi Tower, taxi to holding point runway zero seven, wind two-five-zero at 12, altimeter two niner niner two, hold short runway zero seven."],
        ["auto", "Tower", "Lama 1-1, Kutaisi Tower, airborne, contact Overlord two five one decimal zero. Good day."],
      ],
      note: "Name the airfield, or just say Tower for the one you're nearest. Tower also calls go-arounds, traffic and runway incursions, and talks you down on a precision approach.",
      note_hu: "Mondd a reptér nevét, vagy csak annyit, hogy Tower, és a legközelebbi válaszol. A torony szól az átstartolásnál, a forgalomnál és ha engedély nélkül gurulsz a pályára, precíziós megközelítésnél pedig le is vezet.",
    },
    buddy: {
      freq: "252.000", name: "Buddy", role: "A squadron mate who read the manual", role_hu: "Egy szárnytárs, aki elolvasta a kézikönyvet",
      log: [
        ["you", "Lama 1-1", "Buddy, Lama 1-1, how do I set up a JDAM?"],
        ["stn", "Buddy", "Lama 1-1, Buddy. From the Hornet guide: Master Arm to ARM, pick GBU-38 on the stores page and set the mode to PP. Then choose a PP program and enter the target coordinates. Say next for the rest."],
        ["you", "Lama 1-1", "Next."],
        ["stn", "Buddy", "Fly toward the target until the HUD shows IN ZONE, then hold the pickle button. And no, the bomb won't fix your landing."],
      ],
      note: "Buddy looks things up in the manuals you drop in its folder, and answers mission and airfield questions from live data.",
      note_hu: "Buddy a mappájába tett kézikönyvekben keres, a küldetésről és a repterekről pedig élő adatból válaszol.",
    },
    paddles: {
      freq: "253.000", name: "Paddles", role: "Case I landing trainer and LSO", role_hu: "Case I leszállásoktató és LSO",
      log: [
        ["auto", "Paddles", "Kupi 3-1, Paddles, at the initial. B R C two-six-five. Eight hundred feet, three fifty knots."],
        ["auto", "Paddles", "Kupi 3-1, downwind, you're wide at 1.7 miles, move in, come down to six hundred."],
        ["auto", "Paddles", "Kupi 3-1, three quarters of a mile, call the ball."],
        ["auto", "Paddles", "Power. Right for lineup."],
        ["auto", "Paddles", "Kupi 3-1, trap, three wire. Fair pass. A little high in the middle."],
      ],
      note: "Every pass is graded and posted to your greenie board on Discord.",
      note_hu: "Minden leszállást értékel, és felteszi a Discordos greenie boardra.",
    },
  };

  const list = document.querySelector("[data-channels]");
  const freq = document.querySelector("[data-freq]");
  const who = document.querySelector("[data-who]");
  const log = document.querySelector("[data-log]");
  const note = document.querySelector("[data-note]");
  if (!list) return;
  const HU = document.documentElement.lang === "hu";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let timers = [];

  function tune(key, focus) {
    const s = stations[key];
    timers.forEach(clearTimeout); timers = [];
    list.querySelectorAll("button").forEach(b => {
      const on = b.dataset.key === key;
      b.setAttribute("aria-selected", on);
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    });
    freq.innerHTML = `${s.freq}<small>AM</small>`;
    who.textContent = `${s.name}. ${HU ? s.role_hu : s.role}.`;
    note.textContent = HU ? s.note_hu : s.note;
    log.innerHTML = "";
    s.log.forEach(([kind, from, text], i) => {
      const li = document.createElement("li");
      li.className = kind === "you" ? "you" : kind === "auto" ? "auto" : "stn";
      li.innerHTML = `<span class="from"></span><span class="txt"></span>`;
      li.querySelector(".from").textContent = kind === "auto" ? `${from}, ${HU ? "magától" : "unprompted"}` : from;
      li.querySelector(".txt").textContent = text;
      if (reduce) { log.appendChild(li); return; }
      timers.push(setTimeout(() => { li.classList.add("in"); log.appendChild(li); }, i * 650));
    });
  }

  list.addEventListener("click", e => {
    const b = e.target.closest("button"); if (b) tune(b.dataset.key);
  });
  list.addEventListener("keydown", e => {
    const keys = [...list.querySelectorAll("button")].map(b => b.dataset.key);
    const cur = keys.indexOf(list.querySelector('[aria-selected="true"]').dataset.key);
    const next = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (next) { e.preventDefault(); tune(keys[(cur + next + keys.length) % keys.length], true); }
  });
  tune("overlord");
})();
