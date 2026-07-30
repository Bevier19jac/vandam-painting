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
