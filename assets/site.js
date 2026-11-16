// Buddy Radio - the radio on the home page: pick a frequency, read a typical exchange.
(function () {
  const stations = {
    overlord: {
      freq: "251.000", name: "Overlord", role: "GCI: the air and ground picture",
      log: [
        ["you", "Kupi 3-1", "Overlord, Kupi 3-1, bogey dope."],
        ["stn", "Overlord", "Kupi 3-1, Overlord, BRAA, two-seven-zero, 25, 15 thousand, hot, single contact, Fishbed."],
        ["auto", "Overlord", "Kupi 3-1, Overlord, SAM threat, SA-6, zero-eight-five, 16, approaching its range."],
        ["you", "Kupi 3-1", "Overlord, Kupi 3-1, ground threats."],
        ["stn", "Overlord", "Two ground threats. Nearest, SA-6, zero-eight-five, 16. Next, Ural-375, zero-niner-two, 21. Stand by to copy coordinates for the SA-6."],
      ],
      note: "Coordinates are read slowly, shown on your screen, marked on your F10 map and posted to Discord.",
    },
    tower: {
      freq: "251.500", name: "Rosh Pina Tower", role: "Ground and tower for one airfield",
      log: [
        ["you", "Lama 1-1", "Rosh Pina Tower, Lama 1-1, request taxi."],
        ["stn", "Tower", "Lama 1-1, Rosh Pina Tower, taxi to holding point runway three three, wind three-three-zero at 10, altimeter two niner niner two, hold short runway three three."],
        ["you", "Lama 1-1", "Lama 1-1, ready for takeoff."],
        ["stn", "Tower", "Lama 1-1, runway three three, wind three-three-zero at 10, cleared for takeoff."],
        ["auto", "Tower", "Lama 1-1, Rosh Pina Tower, airborne, contact Overlord two five one decimal zero. Good day."],
      ],
      note: "Tower also calls go-arounds, traffic and runway incursions, and talks you down on a precision approach.",
    },
    atis: {
      freq: "251.750", name: "Rosh Pina ATIS", role: "Weather broadcast on a loop",
      log: [
        ["auto", "ATIS", "Rosh Pina information Bravo. One one three zero zulu. Runway in use three three. Wind three-three-zero at 10. Visibility one zero kilometres or more. Scattered four thousand niner hundred. Temperature one eight. Altimeter two niner niner two, QNH one zero one three."],
        ["auto", "ATIS", "Advise on initial contact you have information Bravo."],
      ],
      note: "Built from the live mission weather. The letter changes every hour and whenever the runway changes.",
    },
    buddy: {
      freq: "252.000", name: "Buddy", role: "A squadron mate who read the manual",
      log: [
        ["you", "Lama 1-1", "Buddy, Lama 1-1, how do I set up a JDAM?"],
        ["stn", "Buddy", "Lama 1-1, Buddy. From the Hornet guide: Master Arm to ARM, pick GBU-38 on the stores page and set the mode to PP. Then choose a PP program and enter the target coordinates. Say next for the rest."],
        ["you", "Lama 1-1", "Next."],
        ["stn", "Buddy", "Fly toward the target until the HUD shows IN ZONE, then hold the pickle button. And no, the bomb won't fix your landing."],
      ],
      note: "Buddy looks things up in the manuals you drop in its folder, and answers mission and airfield questions from live data.",
    },
    paddles: {
      freq: "253.000", name: "Paddles", role: "Case I landing trainer and LSO",
      log: [
        ["auto", "Paddles", "Kupi 3-1, Paddles, at the initial. B R C two-six-five. Eight hundred feet, three fifty knots."],
        ["auto", "Paddles", "Kupi 3-1, downwind, you're wide at 1.7 miles, move in, come down to six hundred."],
        ["auto", "Paddles", "Kupi 3-1, three quarters of a mile, call the ball."],
        ["auto", "Paddles", "Power. Right for lineup."],
        ["auto", "Paddles", "Kupi 3-1, trap, three wire. Fair pass. A little high in the middle."],
      ],
      note: "Every pass is graded and posted to your greenie board on Discord.",
    },
  };

  const list = document.querySelector("[data-channels]");
  const freq = document.querySelector("[data-freq]");
  const who = document.querySelector("[data-who]");
  const log = document.querySelector("[data-log]");
  const note = document.querySelector("[data-note]");
  if (!list) return;
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
    who.textContent = `${s.name}. ${s.role}.`;
    note.textContent = s.note;
    log.innerHTML = "";
    s.log.forEach(([kind, from, text], i) => {
      const li = document.createElement("li");
      li.className = kind === "you" ? "you" : kind === "auto" ? "auto" : "stn";
      li.innerHTML = `<span class="from"></span><span class="txt"></span>`;
      li.querySelector(".from").textContent = kind === "auto" ? `${from}, unprompted` : from;
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
