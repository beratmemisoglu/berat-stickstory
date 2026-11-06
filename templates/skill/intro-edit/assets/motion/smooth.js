/*
  motion/smooth.js — the only motion vocabulary allowed in this project.
  Encodes editing-style.md: three graphs (snapOut / mid / exitIn) + drift,
  overlapping "null" wrappers, word ramps, card entrances/exits, punch zooms,
  deterministic camera wiggle. Everything is placed on one paused GSAP timeline.
*/
(function (global) {
  // ---- cubic-bezier → GSAP ease (same maths as CSS transitions) ----
  function bezier(x1, y1, x2, y2) {
    const A = (a1, a2) => 1 - 3 * a2 + 3 * a1, B = (a1, a2) => 3 * a2 - 6 * a1, C = (a1) => 3 * a1;
    const calc = (t, a1, a2) => ((A(a1, a2) * t + B(a1, a2)) * t + C(a1)) * t;
    const slope = (t, a1, a2) => 3 * A(a1, a2) * t * t + 2 * B(a1, a2) * t + C(a1);
    return function (x) {
      if (x <= 0) return 0; if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) { const s = slope(t, x1, x2); if (Math.abs(s) < 1e-6) break; t -= (calc(t, x1, x2) - x) / s; }
      return calc(t, y1, y2);
    };
  }
  const E = {
    snapOut: bezier(0.08, 0.98, 0.18, 1),  // fast first, long flat tail (entrances, punches)
    mid:     bezier(0.70, 0.00, 0.30, 1),  // slow-fast-slow, influence ~70 (repositions, zoom-outs)
    exitIn:  bezier(0.70, 0.00, 0.84, 0),  // slow first, fast at the cut (exits)
    drift:   bezier(0.30, 0.00, 0.70, 1),  // near-linear prolongation
  };
  Object.keys(E).forEach((k) => gsap.registerEase(k, E[k]));

  const FPS = 30;
  const q = (t) => Math.round(t * FPS) / FPS;   // quantize to frames
  const f = (n) => n / FPS;                      // frames → seconds
  const OP = f(5);                               // 5-frame opacity helper

  const S = {};
  S.ease = E; S.q = q; S.f = f; S.OP = OP;

  // ---- word splitting: <span class="w"> per word (keeps inline flow) ----
  S.words = function (el) {
    if (el.dataset.split) return el.querySelectorAll(".w");
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const s = document.createElement("span"); s.className = "w"; s.textContent = part; frag.appendChild(s);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && !n.classList.contains("w")) walk(n);
      });
    };
    walk(el); el.dataset.split = "1";
    return el.querySelectorAll(".w");
  };

  // ---- 4.1 word ramp: position +0.9em, opacity 0, blur 0.12em, Ramp Up, snapOut ----
  S.ramp = function (tl, sel, at, opt) {
    opt = opt || {};
    const el = typeof sel === "string" ? document.querySelector(sel) : sel;
    const ws = S.words(el);
    const dur = opt.dur || 0.5, st = opt.stagger || 0.085;
    tl.fromTo(ws, { yPercent: 90, opacity: 0, filter: "blur(0.12em)" },
      { yPercent: 0, opacity: 1, filter: "blur(0em)", duration: dur, ease: "snapOut", stagger: st }, q(at));
    if (opt.scaleHit) tl.fromTo(el, { scale: 1.06, transformOrigin: "left center" }, { scale: 1, duration: 0.6, ease: "snapOut" }, q(at));
    return at + dur + st * (ws.length - 1);
  };
  // word ramp OUT (exit): words leave upward with exitIn, tight stagger
  S.rampOut = function (tl, sel, at, opt) {
    opt = opt || {};
    const el = typeof sel === "string" ? document.querySelector(sel) : sel;
    const ws = S.words(el);
    tl.to(ws, { yPercent: -70, opacity: 0, duration: opt.dur || 0.38, ease: "exitIn", stagger: opt.stagger || 0.03 }, q(at));
  };

  // ---- 4.2 slide-up inside a square mask (element must sit in a .mask wrapper) ----
  S.maskUp = function (tl, sel, at, opt) {
    opt = opt || {};
    tl.fromTo(sel, { yPercent: 115, opacity: 0 }, { yPercent: 0, opacity: 1, duration: opt.dur || 0.7, ease: "snapOut" }, q(at));
    tl.set(sel, { opacity: 1 }, q(at + OP)); // opacity helper is 5 frames, not the whole move
  };

  // ---- 4.3 card entrance along a slight curve with settling rotation ----
  // dir: "left" (home is left column → comes from further left) | "right" | "up" | "down"
  S.cardIn = function (tl, sel, at, opt) {
    opt = opt || {};
    const dir = opt.dir || "left", d = opt.dist || 220, dur = opt.dur || 0.8;
    const from = { x: 0, y: 60, rotation: dir === "left" ? -3 : 3, scale: 0.96, opacity: 0, transformOrigin: "center" };
    if (dir === "left") from.x = -d; if (dir === "right") from.x = d; if (dir === "up") { from.y = -d; from.rotation = 0; } if (dir === "down") from.y = d;
    tl.fromTo(sel, from, { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1, duration: dur, ease: "snapOut" }, q(at));
    tl.fromTo(sel, { opacity: 0 }, { opacity: 1, duration: OP, ease: "none" }, q(at));
    return at + dur;
  };
  // ---- 5. exits ----
  S.cardOut = function (tl, sel, at, opt) {
    opt = opt || {};
    const dir = opt.dir || "left", d = opt.dist || 260, dur = opt.dur || 0.45;
    const to = { x: 0, y: 0, duration: dur, ease: "exitIn" };
    if (dir === "left") to.x = -d; if (dir === "right") to.x = d; if (dir === "up") to.y = -d; if (dir === "down") to.y = d;
    tl.to(sel, to, q(at));
    tl.to(sel, { opacity: 0, duration: OP, ease: "none" }, q(at + dur - OP));
    return at + dur;
  };
  S.scaleAway = function (tl, sel, at, opt) {
    opt = opt || {};
    const dur = opt.dur || 0.4;
    tl.to(sel, { scale: 1.08, duration: dur, ease: "exitIn", transformOrigin: "center" }, q(at));
    tl.to(sel, { opacity: 0, duration: OP, ease: "none" }, q(at + dur - OP));
    return at + dur;
  };

  // ---- drift: prolong on a parent null (never let a keyframe rest) ----
  S.drift = function (tl, sel, at, dur, props) {
    tl.to(sel, Object.assign({ duration: dur, ease: "drift" }, props), q(at));
  };
  // ---- reposition (mid graph) ----
  S.move = function (tl, sel, at, props, dur) {
    tl.to(sel, Object.assign({ duration: dur || 0.6, ease: "mid" }, props), q(at));
  };
  // ---- 10-frame reaction (only overshoot allowed) ----
  S.react = function (tl, sel, at) {
    tl.fromTo(sel, { scale: 0.6, opacity: 0, transformOrigin: "center" }, { scale: 1, opacity: 1, duration: f(10), ease: "back.out(1.2)" }, q(at));
  };
  // ---- grow (bars, strikes, rules): snapOut, scaleX from 0 ----
  S.grow = function (tl, sel, at, dur, origin) {
    tl.fromTo(sel, { scaleX: 0, transformOrigin: origin || "left center" }, { scaleX: 1, duration: dur || 0.6, ease: "snapOut" }, q(at));
  };
  // ---- counter, tabular, snapOut ----
  S.count = function (tl, sel, at, from, to, dur, fmt) {
    const o = { v: from };
    tl.to(o, { v: to, duration: dur, ease: "snapOut", onUpdate: () => { const n = document.querySelector(sel); if (n) n.textContent = (fmt || ((x) => Math.round(x)))(o.v); } }, q(at));
  };

  // ---- 4.4 camera: two nested nulls (#cam-snap inside #cam-drift) ----
  S.punchIn = function (tl, at, opt) {
    opt = opt || {};
    const s = opt.scale || 1.06, origin = opt.origin || "50% 42%";
    tl.set(["#cam-snap", "#cam-drift"], { transformOrigin: origin }, q(at));
    tl.to("#cam-snap", { scale: s, duration: opt.dur || 0.45, ease: "snapOut" }, q(at));
    tl.to("#cam-drift", { scale: opt.driftTo || 1.02, duration: opt.driftDur || 3, ease: "none" }, q(at + (opt.dur || 0.45) * 0.5));
  };
  S.zoomOut = function (tl, at, opt) {
    opt = opt || {};
    tl.to("#cam-snap", { scale: 1, duration: opt.dur || 0.7, ease: "mid" }, q(at));
    tl.to("#cam-drift", { scale: 1, duration: (opt.dur || 0.7) * 1.2, ease: "mid" }, q(at));
  };

  // ---- 7. deterministic wiggle(1,8)/(1,0.3) on the graphics null ----
  S.wiggle = function (tl, sel, dur, amp, rot) {
    amp = amp == null ? 16 : amp; rot = rot == null ? 0.3 : rot;
    const o = { t: 0 };
    tl.to(o, { t: dur, duration: dur, ease: "none", onUpdate: () => {
      const t = o.t, TAU = Math.PI * 2;
      const x = amp * (0.6 * Math.sin(TAU * 1.0 * t) + 0.4 * Math.sin(TAU * 2.3 * t + 1.7));
      const y = amp * (0.6 * Math.sin(TAU * 0.9 * t + 0.6) + 0.4 * Math.sin(TAU * 2.1 * t + 2.9));
      const r = rot * (0.7 * Math.sin(TAU * 0.8 * t + 1.1) + 0.3 * Math.sin(TAU * 1.9 * t));
      gsap.set(sel, { x, y, rotation: r });
    } }, 0);
  };

  global.SMOOTH = S;
})(window);
