/* ============================================================
   VDP STUDIO CORE — pure functions + palette data
   Used by studio.html in the browser and by test/core.test.js
   in Node (UMD-lite: window.VDPCore or module.exports).
   ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.VDPCore = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------------- palette ----------------
     Generic, non-proprietary color names. */
  var TRIM = {
    warm: { name: "Soft Warm White", hex: "#F5F0E6" },
    cool: { name: "Crisp Cool White", hex: "#F4F6F5" },
    neutral: { name: "Classic White", hex: "#F5F4F0" },
  };

  var PALETTE = [
    // Warm whites
    { name: "Candlelight White", hex: "#F6EFE0", family: "Warm Whites", undertone: "warm" },
    { name: "Fresh Linen",       hex: "#F3ECDD", family: "Warm Whites", undertone: "warm" },
    { name: "Buttermilk",        hex: "#F4E9CF", family: "Warm Whites", undertone: "warm" },
    { name: "Antique Lace",      hex: "#EFE5D3", family: "Warm Whites", undertone: "warm" },
    // Cool whites
    { name: "First Frost",       hex: "#F2F4F3", family: "Cool Whites", undertone: "cool" },
    { name: "Gallery White",     hex: "#EFF1EE", family: "Cool Whites", undertone: "cool" },
    { name: "Morning Fog",       hex: "#E8ECEA", family: "Cool Whites", undertone: "cool" },
    { name: "Icicle",            hex: "#EAF0F2", family: "Cool Whites", undertone: "cool" },
    // Neutrals
    { name: "Oat Milk",          hex: "#E4DCCB", family: "Neutrals", undertone: "warm" },
    { name: "Greige Stone",      hex: "#CFC8BA", family: "Neutrals", undertone: "neutral" },
    { name: "Mushroom",          hex: "#B7AC9C", family: "Neutrals", undertone: "warm" },
    { name: "Rain Cloud",        hex: "#AEB4B2", family: "Neutrals", undertone: "cool" },
    { name: "Smoke Gray",        hex: "#8E9494", family: "Neutrals", undertone: "cool" },
    { name: "Pebble Path",       hex: "#A79E8E", family: "Neutrals", undertone: "neutral" },
    // Blues
    { name: "Coastal Mist",      hex: "#BFD1D4", family: "Blues", undertone: "cool" },
    { name: "Chambray",          hex: "#8FA8B8", family: "Blues", undertone: "cool" },
    { name: "Lake House Blue",   hex: "#5E7F8F", family: "Blues", undertone: "cool" },
    { name: "Harbor Slate",      hex: "#4A6274", family: "Blues", undertone: "cool" },
    { name: "Midnight Harbor",   hex: "#2E4155", family: "Blues", undertone: "cool" },
    // Greens
    { name: "Sage Whisper",      hex: "#C3CBB4", family: "Greens", undertone: "neutral" },
    { name: "Eucalyptus",        hex: "#A8B79E", family: "Greens", undertone: "cool" },
    { name: "Garden Sage",       hex: "#8A9A7E", family: "Greens", undertone: "neutral" },
    { name: "Juniper",           hex: "#5F7161", family: "Greens", undertone: "cool" },
    { name: "Forest Floor",      hex: "#43523F", family: "Greens", undertone: "warm" },
    // Warm earth tones
    { name: "Wheat Field",       hex: "#DFC9A2", family: "Earth Tones", undertone: "warm" },
    { name: "Terracotta Pot",    hex: "#C07B57", family: "Earth Tones", undertone: "warm" },
    { name: "Toasted Clay",      hex: "#A9714F", family: "Earth Tones", undertone: "warm" },
    { name: "Cinnamon Stick",    hex: "#8E5B3F", family: "Earth Tones", undertone: "warm" },
    { name: "Olive Grove",       hex: "#7F7A54", family: "Earth Tones", undertone: "warm" },
    // Dramatic
    { name: "Ink Navy",          hex: "#22314A", family: "Dramatic", undertone: "cool" },
    { name: "Charcoal Slate",    hex: "#3B4045", family: "Dramatic", undertone: "neutral" },
    { name: "Aubergine Night",   hex: "#463A4B", family: "Dramatic", undertone: "cool" },
    { name: "Bordeaux",          hex: "#5E3A3E", family: "Dramatic", undertone: "warm" },
    { name: "Deep Evergreen",    hex: "#2F4038", family: "Dramatic", undertone: "cool" },
  ];

  var FAMILIES = ["All", "Warm Whites", "Cool Whites", "Neutrals", "Blues", "Greens", "Earth Tones", "Dramatic"];

  function trimFor(undertone) { return TRIM[undertone] || TRIM.neutral; }

  /* ---------------- color math ---------------- */
  function hexToRgb(hex) {
    if (typeof hex !== "string") return null;
    var m = hex.trim().replace(/^#/, "");
    if (m.length === 3) m = m[0] + m[0] + m[1] + m[1] + m[2] + m[2];
    if (!/^[0-9a-fA-F]{6}$/.test(m)) return null;
    return {
      r: parseInt(m.slice(0, 2), 16),
      g: parseInt(m.slice(2, 4), 16),
      b: parseInt(m.slice(4, 6), 16),
    };
  }
  function rgbToHex(r, g, b) {
    function c(v) { v = Math.max(0, Math.min(255, Math.round(v))); return v.toString(16).padStart(2, "0"); }
    return "#" + c(r) + c(g) + c(b);
  }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, h = 0, s = 0;
    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return { h: h, s: s, l: l };
  }
  function hslToRgb(h, s, l) {
    function f(p, q, t) {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }
    var r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
      r = f(p, q, h + 1 / 3); g = f(p, q, h); b = f(p, q, h - 1 / 3);
    }
    return { r: r * 255, g: g * 255, b: b * 255 };
  }
  function luminance(r, g, b) { return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }

  /* Luminance-preserving recolor of one pixel.
     Keeps the original pixel's light/shadow/texture, adopts the
     target color's hue+saturation. brightness: -0.3..0.3 shift.
     The target's own lightness anchors the midtone so dark paints
     actually look dark and pale paints look pale. */
  function recolorPixel(orig, target, brightness) {
    var L = luminance(orig.r, orig.g, orig.b);            // 0..1 texture/shading
    var tHsl = rgbToHsl(target.r, target.g, target.b);
    // Map original luminance around the target's lightness:
    // original mid-gray (~0.72 typical lit wall) lands on target L.
    var WALL_MID = 0.72;
    var newL = tHsl.l + (L - WALL_MID) * 0.85 + (brightness || 0);
    newL = Math.max(0.02, Math.min(0.98, newL));
    return hslToRgb(tHsl.h, tHsl.s, newL);
  }

  /* ---------------- geometry ---------------- */
  function pointInPolygon(x, y, pts) {
    var inside = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function polygonArea(pts) {
    var a = 0;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++)
      a += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
    return Math.abs(a / 2);
  }

  /* ---------------- image validation ---------------- */
  var MAX_BYTES = 25 * 1024 * 1024;
  function validateImageFile(file) {
    if (!file) return { ok: false, error: "No file selected." };
    var okTypes = ["image/jpeg", "image/png", "image/webp"];
    if (okTypes.indexOf(file.type) === -1)
      return { ok: false, error: "Please choose a JPEG, PNG, or WebP photo." };
    if (file.size > MAX_BYTES)
      return { ok: false, error: "That photo is over 25 MB. Please choose a smaller one." };
    return { ok: true };
  }
  function fitWithin(w, h, max) {
    if (w <= max && h <= max) return { w: w, h: h, scale: 1 };
    var s = max / Math.max(w, h);
    return { w: Math.round(w * s), h: Math.round(h * s), scale: s };
  }

  /* ---------------- quiz ----------------
     Deterministic recommendation engine — no AI involved. */
  var FEELS = {
    airy:     { families: ["Cool Whites", "Warm Whites"], blurb: "keeps the room open and full of light" },
    warm:     { families: ["Warm Whites", "Earth Tones"], blurb: "makes the space feel welcoming and lived-in" },
    calm:     { families: ["Blues", "Greens"],            blurb: "settles the room into something quiet and restful" },
    modern:   { families: ["Neutrals", "Cool Whites"],    blurb: "reads clean, current, and easy to decorate around" },
    dramatic: { families: ["Dramatic", "Blues"],          blurb: "gives the room depth and real presence" },
    natural:  { families: ["Greens", "Earth Tones"],      blurb: "brings the outdoors in and pairs well with wood" },
  };

  function quizRecommend(answers) {
    // answers: { room, light: low|medium|high, time: day|evening,
    //            tones: warmwood|darkwood|graywhite|mixed,
    //            feel: airy|warm|calm|modern|dramatic|natural,
    //            pref: warm|cool|neutral|bold }
    var feel = FEELS[answers.feel] || FEELS.calm;
    var pool = PALETTE.filter(function (c) { return feel.families.indexOf(c.family) !== -1; });

    // undertone preference filter (soft)
    if (answers.pref === "warm" || answers.pref === "cool" || answers.pref === "neutral") {
      var pref = pool.filter(function (c) { return c.undertone === answers.pref; });
      if (pref.length >= 3) pool = pref;
    }
    if (answers.pref === "bold") {
      var bold = PALETTE.filter(function (c) { return c.family === "Dramatic"; });
      pool = pool.concat(bold);
    }

    // light level steers lightness
    function lightOf(c) { var rgb = hexToRgb(c.hex); return rgbToHsl(rgb.r, rgb.g, rgb.b).l; }
    var wantLight = answers.light === "low" ? 0.8 : answers.light === "high" ? 0.55 : 0.68;
    if (answers.time === "evening") wantLight -= 0.06;
    if (answers.feel === "dramatic") wantLight = Math.min(wantLight, 0.4);

    var scored = pool.map(function (c) {
      var score = -Math.abs(lightOf(c) - wantLight);
      // floor/furniture harmony
      if (answers.tones === "warmwood" && c.undertone === "warm") score += 0.08;
      if (answers.tones === "graywhite" && c.undertone === "cool") score += 0.08;
      if (answers.tones === "darkwood" && lightOf(c) > 0.6) score += 0.06;
      return { c: c, score: score };
    }).sort(function (a, b) { return b.score - a.score; });

    // dedupe by family for variety
    var picks = [], seen = {};
    for (var i = 0; i < scored.length && picks.length < 3; i++) {
      var fam = scored[i].c.family;
      if (seen[fam] && picks.length < 2) continue;
      seen[fam] = true;
      picks.push(scored[i].c);
    }
    while (picks.length < 3 && scored.length) picks.push(scored[Math.min(picks.length, scored.length - 1)].c);

    var accents = PALETTE.filter(function (c) { return c.family === "Dramatic" || c.family === "Earth Tones"; });
    return picks.map(function (c, idx) {
      var accent = accents[(idx * 2 + (answers.feel === "dramatic" ? 1 : 0)) % accents.length];
      if (accent.hex === c.hex) accent = accents[(idx * 2 + 2) % accents.length];
      return {
        main: c,
        accent: c.family === "Dramatic" ? null : accent,
        trim: trimFor(c.undertone),
        why: c.name + " " + feel.blurb +
          (answers.light === "low" ? ", and its lighter value helps a low-light room." :
           answers.light === "high" ? ", and it holds its own in strong daylight." : "."),
      };
    });
  }

  /* ---------------- estimate payload ---------------- */
  function buildEstimateMessage(o) {
    var lines = [];
    lines.push("Estimate request — " + (o.service || "Interior painting"));
    if (o.name) lines.push("Name: " + o.name);
    if (o.phone) lines.push("Phone: " + o.phone);
    if (o.colorName) lines.push("Color I previewed: " + o.colorName + " (" + o.colorHex + ")");
    if (o.details) lines.push("Project: " + o.details);
    if (o.fromStudio) lines.push("(Preview made with the Van Dam Color Studio)");
    return lines.join("\n");
  }

  return {
    PALETTE: PALETTE, FAMILIES: FAMILIES, TRIM: TRIM, trimFor: trimFor,
    hexToRgb: hexToRgb, rgbToHex: rgbToHex, rgbToHsl: rgbToHsl, hslToRgb: hslToRgb,
    luminance: luminance, recolorPixel: recolorPixel,
    pointInPolygon: pointInPolygon, polygonArea: polygonArea,
    validateImageFile: validateImageFile, fitWithin: fitWithin,
    quizRecommend: quizRecommend, buildEstimateMessage: buildEstimateMessage,
  };
});
