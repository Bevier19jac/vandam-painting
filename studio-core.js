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


  /* ================= COLOR STUDIO PRO ADDITIONS ================= */

  /* ---------- surface types & roles ---------- */
  var SURFACE_TYPES = {
    interior: ["Main walls","Accent wall","Ceiling","Trim","Doors","Cabinets","Custom surface"],
    exterior: ["Main siding","Secondary siding","Brick / masonry","Exterior trim","Fascia & soffits","Garage door","Front door","Shutters","Porch","Deck","Fence","Custom exterior"]
  };
  var ROLE_OF_TYPE = {
    "Main walls":"main","Accent wall":"accent","Ceiling":"ceiling","Trim":"trim","Doors":"door","Cabinets":"secondary","Custom surface":"main",
    "Main siding":"main","Secondary siding":"secondary","Brick / masonry":"main","Exterior trim":"trim","Fascia & soffits":"trim","Garage door":"secondary","Front door":"door","Shutters":"accent","Porch":"secondary","Deck":"secondary","Fence":"secondary","Custom exterior":"main"
  };
  function roleForType(t){ return ROLE_OF_TYPE[t] || "main"; }

  function makeSurface(type, name, id){
    return { id: id || ("s" + Math.random().toString(36).slice(2,9)),
      name: name || type, type: type, points: [], closed: false,
      color: null, intensity: 1, brightness: 0, visible: true, locked: false };
  }

  /* ---------- coordinated schemes (generic colors) ---------- */
  function col(name, hex){ return { name: name, hex: hex }; }
  var SCHEMES = [
    // interior
    { key:"warm-welcome", type:"interior", name:"Warm & Welcoming",
      why:"A creamy main wall with an earthy accent keeps the room cozy; warm white trim ties it together without harsh contrast.",
      tags:{warm:1},
      colors:{ main:col("Fresh Linen","#F3ECDD"), accent:col("Terracotta Pot","#C07B57"), trim:col("Soft Warm White","#F5F0E6"), ceiling:col("Candlelight White","#F6EFE0"), door:col("Cinnamon Stick","#8E5B3F"), secondary:col("Wheat Field","#DFC9A2") } },
    { key:"clean-modern", type:"interior", name:"Clean Modern Neutral",
      why:"Griege walls read current and calm; crisp cool trim and a charcoal door add definition without color commitment.",
      tags:{modern:1},
      colors:{ main:col("Greige Stone","#CFC8BA"), accent:col("Charcoal Slate","#3B4045"), trim:col("Crisp Cool White","#F4F6F5"), ceiling:col("Gallery White","#EFF1EE"), door:col("Charcoal Slate","#3B4045"), secondary:col("Rain Cloud","#AEB4B2") } },
    { key:"calm-coastal", type:"interior", name:"Calm Coastal",
      why:"Misty blue walls with bright white trim borrow the lake-house feel; a deeper harbor accent anchors one wall.",
      tags:{cool:1},
      colors:{ main:col("Coastal Mist","#BFD1D4"), accent:col("Harbor Slate","#4A6274"), trim:col("Crisp Cool White","#F4F6F5"), ceiling:col("First Frost","#F2F4F3"), door:col("Lake House Blue","#5E7F8F"), secondary:col("Chambray","#8FA8B8") } },
    { key:"natural-grounded", type:"interior", name:"Natural & Grounded",
      why:"Sage and eucalyptus pair naturally with wood tones; the olive accent keeps it organic rather than minty.",
      tags:{warm:1,natural:1},
      colors:{ main:col("Sage Whisper","#C3CBB4"), accent:col("Juniper","#5F7161"), trim:col("Soft Warm White","#F5F0E6"), ceiling:col("Candlelight White","#F6EFE0"), door:col("Olive Grove","#7F7A54"), secondary:col("Eucalyptus","#A8B79E") } },
    { key:"dramatic-contrast", type:"interior", name:"Dramatic Contrast",
      why:"Light neutral walls make the ink-navy accent feel intentional; repeating navy on the door balances the room.",
      tags:{bold:1},
      colors:{ main:col("Oat Milk","#E4DCCB"), accent:col("Ink Navy","#22314A"), trim:col("Classic White","#F5F4F0"), ceiling:col("Gallery White","#EFF1EE"), door:col("Ink Navy","#22314A"), secondary:col("Smoke Gray","#8E9494") } },
    { key:"soft-traditional", type:"interior", name:"Soft Traditional",
      why:"Warm whites layered on warm whites is the classic trim-and-wall play; the bordeaux door adds heritage character.",
      tags:{warm:1,traditional:1},
      colors:{ main:col("Antique Lace","#EFE5D3"), accent:col("Mushroom","#B7AC9C"), trim:col("Soft Warm White","#F5F0E6"), ceiling:col("Candlelight White","#F6EFE0"), door:col("Bordeaux","#5E3A3E"), secondary:col("Buttermilk","#F4E9CF") } },
    { key:"contemporary-blue", type:"interior", name:"Contemporary Blue",
      why:"Chambray walls stay livable while the midnight accent brings depth; cool whites keep edges sharp.",
      tags:{cool:1,modern:1},
      colors:{ main:col("Chambray","#8FA8B8"), accent:col("Midnight Harbor","#2E4155"), trim:col("Crisp Cool White","#F4F6F5"), ceiling:col("First Frost","#F2F4F3"), door:col("Midnight Harbor","#2E4155"), secondary:col("Morning Fog","#E8ECEA") } },
    { key:"earthy-green", type:"interior", name:"Earthy Green",
      why:"Garden sage as the main color is bolder than a white room but just as calm; forest floor grounds the accent wall.",
      tags:{natural:1,bold:1},
      colors:{ main:col("Garden Sage","#8A9A7E"), accent:col("Forest Floor","#43523F"), trim:col("Soft Warm White","#F5F0E6"), ceiling:col("Candlelight White","#F6EFE0"), door:col("Forest Floor","#43523F"), secondary:col("Sage Whisper","#C3CBB4") } },
    // exterior
    { key:"cream-navy", type:"exterior", name:"Classic Cream & Navy",
      why:"Cream siding with navy shutters and door is a hundred-year-old combination because it flatters almost every roof.",
      tags:{warm:1,traditional:1},
      colors:{ main:col("Fresh Linen","#F3ECDD"), accent:col("Ink Navy","#22314A"), trim:col("Classic White","#F5F4F0"), door:col("Ink Navy","#22314A"), secondary:col("Wheat Field","#DFC9A2") } },
    { key:"modern-charcoal", type:"exterior", name:"Modern Charcoal",
      why:"Charcoal siding with bright trim reads current and crisp; the terracotta door keeps it from going cold.",
      tags:{modern:1,dark:1},
      colors:{ main:col("Charcoal Slate","#3B4045"), accent:col("Smoke Gray","#8E9494"), trim:col("Crisp Cool White","#F4F6F5"), door:col("Terracotta Pot","#C07B57"), secondary:col("Rain Cloud","#AEB4B2") } },
    { key:"warm-craftsman", type:"exterior", name:"Warm Craftsman",
      why:"Olive-and-clay earth tones honor craftsman detailing and sit beautifully against wood and brick.",
      tags:{warm:1,natural:1,traditional:1},
      colors:{ main:col("Olive Grove","#7F7A54"), accent:col("Toasted Clay","#A9714F"), trim:col("Soft Warm White","#F5F0E6"), door:col("Cinnamon Stick","#8E5B3F"), secondary:col("Wheat Field","#DFC9A2") } },
    { key:"lake-house", type:"exterior", name:"Lake-House Palette",
      why:"Soft blue siding with white trim belongs near water — calm, bright, and Michigan-summer friendly.",
      tags:{cool:1},
      colors:{ main:col("Chambray","#8FA8B8"), accent:col("Harbor Slate","#4A6274"), trim:col("Crisp Cool White","#F4F6F5"), door:col("Midnight Harbor","#2E4155"), secondary:col("Coastal Mist","#BFD1D4") } },
    { key:"white-black", type:"exterior", name:"Timeless White & Black",
      why:"White siding, soft-black accents: maximum curb appeal with minimum risk, on trend for a decade and counting.",
      tags:{modern:1,traditional:1},
      colors:{ main:col("Classic White","#F5F4F0"), accent:col("Soft Black","#2E2B28"), trim:col("Classic White","#F5F4F0"), door:col("Soft Black","#2E2B28"), secondary:col("Smoke Gray","#8E9494") } },
    { key:"natural-woodland", type:"exterior", name:"Natural Woodland",
      why:"Deep green siding disappears into trees in the best way; warm white trim keeps windows bright.",
      tags:{natural:1,dark:1},
      colors:{ main:col("Deep Evergreen","#2F4038"), accent:col("Garden Sage","#8A9A7E"), trim:col("Soft Warm White","#F5F0E6"), door:col("Toasted Clay","#A9714F"), secondary:col("Juniper","#5F7161") } },
    { key:"brick-neutral", type:"exterior", name:"Brick-Friendly Neutral",
      why:"Warm greige plays nicely with red and brown brick instead of fighting it; the navy door adds contrast the brick can't.",
      tags:{warm:1,brick:1},
      colors:{ main:col("Pebble Path","#A79E8E"), accent:col("Mushroom","#B7AC9C"), trim:col("Soft Warm White","#F5F0E6"), door:col("Ink Navy","#22314A"), secondary:col("Oat Milk","#E4DCCB") } },
    { key:"bold-door", type:"exterior", name:"Bold Front-Door Accent",
      why:"Keep the body quiet and let the door do the talking — the cheapest curb-appeal upgrade in painting.",
      tags:{modern:1,bold:1},
      colors:{ main:col("Greige Stone","#CFC8BA"), accent:col("Charcoal Slate","#3B4045"), trim:col("Classic White","#F5F4F0"), door:col("Terracotta Pot","#C07B57"), secondary:col("Rain Cloud","#AEB4B2") } }
  ];
  function schemesFor(type){ return SCHEMES.filter(function(s){ return s.type===type; }); }

  /* apply a scheme to surfaces (pure): returns [{id, color}] */
  function applyScheme(surfaces, scheme){
    var out = [];
    (surfaces||[]).forEach(function(s){
      if (s.locked) return;
      var role = roleForType(s.type);
      var c = scheme.colors[role] || scheme.colors.main;
      if (c) out.push({ id: s.id, color: { name: c.name, hex: c.hex, family: "Scheme", undertone: undertoneOfHex(c.hex) } });
    });
    return out;
  }
  function undertoneOfHex(hex){
    var rgb = hexToRgb(hex); if (!rgb) return "neutral";
    var h = rgbToHsl(rgb.r,rgb.g,rgb.b);
    if (h.s < 0.08) return "neutral";
    return (h.h > 0.05 && h.h < 0.2) || h.h > 0.9 ? "warm" : (h.h > 0.4 && h.h < 0.75) ? "cool" : "neutral";
  }

  /* rank exterior schemes against permanent materials (deterministic, honest heuristic) */
  function rankExteriorSchemes(permanent){
    var p = permanent || {};
    return schemesFor("exterior").map(function(s){
      var score = 0, t = s.tags||{};
      if (p.brick === "red" || p.brick === "brown"){ score += (t.brick?3:0) + (t.warm?2:0) - (t.cool?1:0); }
      if (p.roof === "warm"){ score += (t.warm?2:0) - (t.cool?1:0); }
      if (p.roof === "gray" || p.roof === "black"){ score += (t.modern?2:0) + (t.cool?1:0); }
      if (p.roof === "green"){ score += (t.natural?2:0); }
      if (p.stone === "warm"){ score += (t.warm?1:0); }
      if (p.style === "modern"){ score += (t.modern?3:0) - (t.traditional?1:0); }
      if (p.style === "traditional"){ score += (t.traditional?3:0) - (t.modern?1:0); }
      if (p.setting === "wooded"){ score += (t.natural?2:0); }
      return { scheme: s, score: score };
    }).sort(function(a,b){ return b.score - a.score || a.scheme.name.localeCompare(b.scheme.name); });
  }

  /* ---------- lighting (approximation, applied as composite ops) ---------- */
  var LIGHTING = {
    original: { label: "Original photo", ops: [] },
    daylight: { label: "Bright daylight", ops: [ { op:"screen", color:"#ffffff", alpha:0.10 } ] },
    evening:  { label: "Warm evening",   ops: [ { op:"multiply", color:"#ffd9a8", alpha:0.20 }, { op:"screen", color:"#ff9a3c", alpha:0.05 } ] },
    overcast: { label: "Cool overcast",  ops: [ { op:"multiply", color:"#c7d3dc", alpha:0.16 } ] }
  };
  function lightingOps(mode){ return (LIGHTING[mode] || LIGHTING.original).ops; }

  /* ---------- project persistence ---------- */
  var PROJECT_VERSION = 1;
  function serializeProject(p){
    return JSON.stringify({
      v: PROJECT_VERSION, id: p.id, name: p.name || "Untitled project", type: p.type || "interior",
      updatedAt: p.updatedAt || 0, createdAt: p.createdAt || 0,
      photo: p.photo || null, lighting: p.lighting || "original",
      surfaces: (p.surfaces||[]).map(function(s){ return {
        id:s.id, name:s.name, type:s.type, points:s.points, closed:!!s.closed,
        color:s.color, intensity:s.intensity, brightness:s.brightness,
        visible:s.visible!==false, locked:!!s.locked }; }),
      permanent: p.permanent || null, schemes: p.schemes || [], quiz: p.quiz || null
    });
  }
  function deserializeProject(str){
    var p;
    try { p = typeof str === "string" ? JSON.parse(str) : str; } catch(e){ return null; }
    if (!p || typeof p !== "object" || p.v !== PROJECT_VERSION) return null;
    if (!Array.isArray(p.surfaces)) return null;
    p.surfaces = p.surfaces.filter(function(s){
      return s && Array.isArray(s.points) && typeof s.id === "string";
    });
    p.name = p.name || "Untitled project";
    p.type = p.type === "exterior" ? "exterior" : "interior";
    p.lighting = LIGHTING[p.lighting] ? p.lighting : "original";
    return p;
  }

  /* ---------- estimate summary ---------- */
  function estimateSummaryFromProject(p){
    var lines = ["Color Studio project" + (p.name && p.name !== "Untitled project" ? " — " + p.name : "") +
      " (" + (p.type==="exterior"?"exterior":"interior") + ", " + (p.surfaces||[]).length + " surface" + ((p.surfaces||[]).length===1?"":"s") + "):"];
    (p.surfaces||[]).forEach(function(s){
      if (s.color) lines.push("- " + (s.name||s.type) + ": " + s.color.name + " (" + s.color.hex.toUpperCase() + ")");
      else lines.push("- " + (s.name||s.type) + ": color still open");
    });
    return lines.join("\n");
  }

  /* ---------- painting plan (planner) ---------- */
  function plannerSummary(plan){
    var L = [];
    L.push("Painting plan" + (plan.name ? " — " + plan.name : "") + ":");
    if (plan.projectType) L.push("Type: " + plan.projectType);
    (plan.areas||[]).forEach(function(a){
      var bits = [];
      if (a.size) bits.push(a.size);
      if (a.surfaces && a.surfaces.length) bits.push(a.surfaces.join(", "));
      if (a.currentColor) bits.push("now: " + a.currentColor);
      if (a.desiredColor) bits.push("want: " + a.desiredColor);
      if (a.occupancy) bits.push(a.occupancy);
      L.push("- " + a.name + (bits.length ? " (" + bits.join(" · ") + ")" : ""));
    });
    if (plan.condition && plan.condition.length) L.push("Condition: " + plan.condition.join(", "));
    if (plan.colorApproach) L.push("Colors: " + plan.colorApproach);
    if (plan.studioColors) L.push(plan.studioColors);
    if (plan.timeline) L.push("Timeline: " + plan.timeline);
    if (plan.logistics && plan.logistics.length) L.push("Logistics: " + plan.logistics.join(", "));
    if (plan.notes) L.push("Notes: " + plan.notes);
    if (plan.photoCount) L.push("(" + plan.photoCount + " project photo" + (plan.photoCount===1?"":"s") + " ready to show Bryan)");
    return L.join("\n");
  }
  function plannerReadiness(plan){
    var areas = (plan.areas||[]).length > 0;
    var color = !!plan.colorApproach;
    var cond = (plan.condition||[]).length > 0;
    var risky = (plan.condition||[]).some(function(c){
      return /peeling|water|wallpaper currently|unsure/i.test(c);
    });
    var done = [], todo = [];
    done.push(areas ? "Areas listed" : null);
    done.push(color ? "Color direction chosen" : null);
    done.push(cond ? "Condition noted" : null);
    done.push(plan.timeline ? "Timeline set" : null);
    done = done.filter(Boolean);
    if (!areas) todo.push("Add at least one room or area");
    if (!color) todo.push("Pick a color direction (or let Bryan recommend)");
    if (!cond) todo.push("Note the surface condition");
    if (!plan.timeline) todo.push("Pick a rough timeline");
    var state;
    if (risky && areas) state = "Surface evaluation recommended";
    else if (areas && color && cond) state = "Ready for a walkthrough";
    else if (areas && !color) state = "Color decision still open";
    else state = "Mostly planned";
    return { state: state, done: done, todo: todo };
  }

  return {
    PALETTE: PALETTE,
    SURFACE_TYPES: SURFACE_TYPES, ROLE_OF_TYPE: ROLE_OF_TYPE, roleForType: roleForType,
    makeSurface: makeSurface, SCHEMES: SCHEMES, schemesFor: schemesFor,
    applyScheme: applyScheme, rankExteriorSchemes: rankExteriorSchemes,
    LIGHTING: LIGHTING, lightingOps: lightingOps,
    serializeProject: serializeProject, deserializeProject: deserializeProject,
    estimateSummaryFromProject: estimateSummaryFromProject,
    plannerSummary: plannerSummary, plannerReadiness: plannerReadiness,
    undertoneOfHex: undertoneOfHex, FAMILIES: FAMILIES, TRIM: TRIM, trimFor: trimFor,
    hexToRgb: hexToRgb, rgbToHex: rgbToHex, rgbToHsl: rgbToHsl, hslToRgb: hslToRgb,
    luminance: luminance, recolorPixel: recolorPixel,
    pointInPolygon: pointInPolygon, polygonArea: polygonArea,
    validateImageFile: validateImageFile, fitWithin: fitWithin,
    quizRecommend: quizRecommend, buildEstimateMessage: buildEstimateMessage,
  };
});
