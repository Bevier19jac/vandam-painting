const test = require("node:test");
const assert = require("node:assert");
const C = require("../studio-core.js");

test("hex conversion round-trips", () => {
  assert.deepStrictEqual(C.hexToRgb("#22314A"), { r: 0x22, g: 0x31, b: 0x4A });
  assert.deepStrictEqual(C.hexToRgb("abc"), { r: 0xAA, g: 0xBB, b: 0xCC });
  assert.strictEqual(C.hexToRgb("#xyz"), null);
  assert.strictEqual(C.hexToRgb(null), null);
  assert.strictEqual(C.rgbToHex(34, 49, 74), "#22314a");
  assert.strictEqual(C.rgbToHex(300, -5, 12), "#ff000c"); // clamps
});

test("hsl round-trip is stable", () => {
  const rgb = { r: 94, g: 127, b: 143 };
  const h = C.rgbToHsl(rgb.r, rgb.g, rgb.b);
  const back = C.hslToRgb(h.h, h.s, h.l);
  assert.ok(Math.abs(back.r - rgb.r) < 1.5);
  assert.ok(Math.abs(back.g - rgb.g) < 1.5);
  assert.ok(Math.abs(back.b - rgb.b) < 1.5);
});

test("recolorPixel preserves relative shading (texture survives)", () => {
  const target = C.hexToRgb("#8A9A7E"); // Garden Sage
  const bright = C.recolorPixel({ r: 230, g: 228, b: 225 }, target, 0); // lit wall pixel
  const shadow = C.recolorPixel({ r: 120, g: 118, b: 115 }, target, 0); // shadowed pixel
  const lumBright = C.luminance(bright.r, bright.g, bright.b);
  const lumShadow = C.luminance(shadow.r, shadow.g, shadow.b);
  assert.ok(lumBright > lumShadow + 0.15, "highlights must stay brighter than shadows");
  // hue should be green-ish for both
  const hB = C.rgbToHsl(bright.r, bright.g, bright.b).h;
  const hT = C.rgbToHsl(target.r, target.g, target.b).h;
  assert.ok(Math.abs(hB - hT) < 0.05, "hue follows the chosen paint");
});

test("recolorPixel: dark paints come out dark, pale paints pale", () => {
  const wallPixel = { r: 225, g: 223, b: 220 }; // typical lit white wall
  const navy = C.recolorPixel(wallPixel, C.hexToRgb("#22314A"), 0);
  const white = C.recolorPixel(wallPixel, C.hexToRgb("#F6EFE0"), 0);
  assert.ok(C.luminance(navy.r, navy.g, navy.b) < 0.45);
  assert.ok(C.luminance(white.r, white.g, white.b) > 0.8);
});

test("pointInPolygon + area", () => {
  const sq = [[0, 0], [10, 0], [10, 10], [0, 10]];
  assert.ok(C.pointInPolygon(5, 5, sq));
  assert.ok(!C.pointInPolygon(15, 5, sq));
  assert.strictEqual(C.polygonArea(sq), 100);
});

test("image validation", () => {
  assert.ok(C.validateImageFile({ type: "image/jpeg", size: 1000 }).ok);
  assert.ok(C.validateImageFile({ type: "image/webp", size: 1000 }).ok);
  assert.ok(!C.validateImageFile({ type: "image/gif", size: 1000 }).ok);
  assert.ok(!C.validateImageFile({ type: "image/png", size: 26 * 1024 * 1024 }).ok);
  assert.ok(!C.validateImageFile(null).ok);
});

test("fitWithin scales down only", () => {
  assert.deepStrictEqual(C.fitWithin(800, 600, 1600), { w: 800, h: 600, scale: 1 });
  const r = C.fitWithin(4000, 3000, 1600);
  assert.strictEqual(r.w, 1600);
  assert.strictEqual(r.h, 1200);
});

test("quiz returns 3 distinct, explained palettes and is deterministic", () => {
  const a = { room: "bedroom", light: "low", time: "evening", tones: "warmwood", feel: "calm", pref: "cool" };
  const r1 = C.quizRecommend(a);
  const r2 = C.quizRecommend(a);
  assert.strictEqual(r1.length, 3);
  assert.deepStrictEqual(r1.map(x => x.main.hex), r2.map(x => x.main.hex));
  r1.forEach(rec => {
    assert.ok(rec.main.name && rec.main.hex);
    assert.ok(rec.trim && rec.trim.hex);
    assert.ok(rec.why.length > 10);
    if (rec.accent) assert.notStrictEqual(rec.accent.hex, rec.main.hex);
  });
  // low light should skew light: at least 2 of 3 mains lighter than mid
  const light = r1.filter(rec => {
    const rgb = C.hexToRgb(rec.main.hex);
    return C.rgbToHsl(rgb.r, rgb.g, rgb.b).l > 0.5;
  });
  assert.ok(light.length >= 2);
});

test("quiz dramatic preference goes dark", () => {
  const r = C.quizRecommend({ room: "dining", light: "high", time: "evening", tones: "darkwood", feel: "dramatic", pref: "bold" });
  const rgb = C.hexToRgb(r[0].main.hex);
  assert.ok(C.rgbToHsl(rgb.r, rgb.g, rgb.b).l < 0.5);
});

test("estimate message includes color and omits missing fields", () => {
  const msg = C.buildEstimateMessage({ colorName: "Garden Sage", colorHex: "#8A9A7E", fromStudio: true });
  assert.ok(msg.includes("Garden Sage"));
  assert.ok(msg.includes("#8A9A7E"));
  assert.ok(msg.includes("Color Studio"));
  assert.ok(!msg.includes("Name:"));
});

test("palette integrity: ~30 swatches, all valid, all families represented", () => {
  assert.ok(C.PALETTE.length >= 28 && C.PALETTE.length <= 36);
  const fams = new Set();
  C.PALETTE.forEach(c => {
    assert.ok(C.hexToRgb(c.hex), c.name + " has valid hex");
    assert.ok(["warm", "cool", "neutral"].includes(c.undertone));
    fams.add(c.family);
  });
  assert.strictEqual(fams.size, 7);
});

/* ================= PRO FEATURE TESTS ================= */

test("surface types & roles cover both studios", () => {
  assert.ok(C.SURFACE_TYPES.interior.length >= 6);
  assert.ok(C.SURFACE_TYPES.exterior.length >= 10);
  C.SURFACE_TYPES.interior.concat(C.SURFACE_TYPES.exterior).forEach(t => {
    assert.ok(["main","accent","trim","ceiling","door","secondary"].includes(C.roleForType(t)), t);
  });
});

test("makeSurface produces complete editable surfaces with unique ids", () => {
  const a = C.makeSurface("Main walls");
  const b = C.makeSurface("Trim", "Window trim");
  assert.notStrictEqual(a.id, b.id);
  assert.strictEqual(b.name, "Window trim");
  assert.strictEqual(a.visible, true);
  assert.strictEqual(a.locked, false);
  assert.strictEqual(a.intensity, 1);
  assert.deepStrictEqual(a.points, []);
});

test("16 coordinated schemes, valid colors, both types, explanations", () => {
  assert.strictEqual(C.SCHEMES.length, 16);
  assert.strictEqual(C.schemesFor("interior").length, 8);
  assert.strictEqual(C.schemesFor("exterior").length, 8);
  C.SCHEMES.forEach(s => {
    assert.ok(s.why.length > 20, s.key + " has explanation");
    Object.values(s.colors).forEach(c => assert.ok(C.hexToRgb(c.hex), s.key));
    assert.ok(s.colors.main && s.colors.trim);
  });
});

test("applyScheme assigns role-appropriate colors and respects locks", () => {
  const scheme = C.schemesFor("interior")[4]; // Dramatic Contrast
  const surfaces = [
    C.makeSurface("Main walls"), C.makeSurface("Accent wall"),
    C.makeSurface("Trim"), C.makeSurface("Ceiling"),
  ];
  surfaces[2].locked = true;
  const out = C.applyScheme(surfaces, scheme);
  assert.strictEqual(out.length, 3); // trim locked out
  const byId = Object.fromEntries(out.map(o => [o.id, o.color]));
  assert.strictEqual(byId[surfaces[0].id].hex, scheme.colors.main.hex);
  assert.strictEqual(byId[surfaces[1].id].hex, scheme.colors.accent.hex);
  assert.strictEqual(byId[surfaces[3].id].hex, scheme.colors.ceiling.hex);
});

test("rankExteriorSchemes: brick pushes brick-friendly; deterministic", () => {
  const r1 = C.rankExteriorSchemes({ brick: "red", roof: "warm", style: "traditional" });
  const r2 = C.rankExteriorSchemes({ brick: "red", roof: "warm", style: "traditional" });
  assert.deepStrictEqual(r1.map(x => x.scheme.key), r2.map(x => x.scheme.key));
  const topKeys = r1.slice(0, 3).map(x => x.scheme.key);
  assert.ok(topKeys.includes("brick-neutral"), "brick-friendly ranks high: " + topKeys);
  const modern = C.rankExteriorSchemes({ roof: "black", style: "modern" });
  assert.ok(["modern-charcoal","white-black","bold-door"].includes(modern[0].scheme.key));
});

test("lighting modes: known ops, invalid falls back to original", () => {
  assert.deepStrictEqual(C.lightingOps("original"), []);
  assert.ok(C.lightingOps("evening").length >= 1);
  assert.ok(C.lightingOps("daylight")[0].op === "screen");
  assert.deepStrictEqual(C.lightingOps("disco-mode"), []);
  Object.values(C.LIGHTING).forEach(m => m.ops.forEach(o => {
    assert.ok(C.hexToRgb(o.color) && o.alpha > 0 && o.alpha < 0.5);
  }));
});

test("project serialize/deserialize round-trips surfaces and rejects junk", () => {
  const s1 = C.makeSurface("Main walls"); s1.points = [[1,2],[3,4],[5,6]]; s1.closed = true;
  s1.color = { name: "Garden Sage", hex: "#8A9A7E", family: "Greens", undertone: "neutral" };
  const p = { id: "p1", name: "My bedroom", type: "interior", surfaces: [s1], lighting: "evening", photo: "data:image/jpeg;base64,xx" };
  const round = C.deserializeProject(C.serializeProject(p));
  assert.strictEqual(round.name, "My bedroom");
  assert.strictEqual(round.lighting, "evening");
  assert.strictEqual(round.surfaces.length, 1);
  assert.deepStrictEqual(round.surfaces[0].points, [[1,2],[3,4],[5,6]]);
  assert.strictEqual(round.surfaces[0].color.hex, "#8A9A7E");
  assert.strictEqual(C.deserializeProject("not json"), null);
  assert.strictEqual(C.deserializeProject('{"v":99}'), null);
  assert.strictEqual(C.deserializeProject('{"v":1}'), null);
});

test("estimate summary lists every surface with color or open status", () => {
  const s1 = C.makeSurface("Main walls"); s1.color = { name: "Oat Milk", hex: "#E4DCCB" };
  const s2 = C.makeSurface("Trim");
  const txt = C.estimateSummaryFromProject({ name: "Living room refresh", type: "interior", surfaces: [s1, s2] });
  assert.ok(txt.includes("Living room refresh"));
  assert.ok(txt.includes("2 surfaces"));
  assert.ok(txt.includes("Oat Milk (#E4DCCB)"));
  assert.ok(txt.includes("Trim: color still open"));
});

test("planner summary and readiness states", () => {
  const plan = {
    name: "Bevier house", projectType: "Interior",
    areas: [{ name: "Living room", size: "large", surfaces: ["Walls","Trim"], occupancy: "furnished" }],
    condition: ["Small nail holes or scuffs"], colorApproach: "Chose in Color Studio",
    timeline: "Within one month", logistics: ["Pets"], photoCount: 2
  };
  const txt = C.plannerSummary(plan);
  assert.ok(txt.includes("Living room"));
  assert.ok(txt.includes("Walls, Trim"));
  assert.ok(txt.includes("2 project photos"));
  assert.strictEqual(C.plannerReadiness(plan).state, "Ready for a walkthrough");
  assert.strictEqual(C.plannerReadiness({ areas: [{name:"x"}], condition:["Ready to paint"] }).state, "Color decision still open");
  assert.strictEqual(C.plannerReadiness({ areas: [{name:"x"}], condition:["Peeling or flaking"], colorApproach:"help" }).state, "Surface evaluation recommended");
  assert.strictEqual(C.plannerReadiness({}).state, "Mostly planned");
});
