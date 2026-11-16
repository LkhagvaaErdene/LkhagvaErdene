import test from "node:test"; import assert from "node:assert/strict";
import { loadFn } from "./helpers.mjs";
const C = await loadFn("fn/mushroomCalc.js");
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);

test("drying: 1 kg fresh, 90% -> 10% moisture = 111.11 g; round trip", () => {
  const r = C.dryFromFresh(1000, 90, 10); near(r.dried, 100 / 0.9); near(r.waterRemoved, 1000 - 100 / 0.9); near(r.ratio, 9);
  near(C.freshFromDried(r.dried, 90, 10).fresh, 1000);
});
test("drying: same moisture keeps mass; invalid input -> null", () => {
  near(C.dryFromFresh(500, 80, 80).dried, 500);
  assert.equal(C.dryFromFresh(1, 100, 10), null); assert.equal(C.dryFromFresh(-1, 90, 10), null); assert.equal(C.dryFromFresh(NaN, 90, 10), null);
});
test("substrate: 10 kg @30% -> 65% needs 10 kg water; too wet gives negative", () => {
  const r = C.substrateWater(10, 30, 65); near(r.dry, 7); near(r.targetWet, 20); near(r.water, 10);
  assert.ok(C.substrateWater(10, 70, 60).water < 0);
});
test("biological efficiency: 7 kg dry, 3.5 kg fresh = 50%; wet basis", () => {
  const r = C.biologicalEfficiency(10, 30, [2, 1, 0.5]); near(r.dry, 7); near(r.total, 3.5); near(r.be, 50); near(r.wetBasis, 35);
  assert.equal(C.biologicalEfficiency(0, 30, [1]), null);
});
test("spawn rate", () => { const r = C.spawnAmount(10, 5); near(r.spawn, 0.5); near(r.total, 10.5); assert.equal(C.spawnAmount(10, 101), null); });
test("brine: resulting concentration equals target", () => {
  const r = C.brineSalt(1000, 5); near(r.salt, 1000 * 5 / 95); near(r.salt / r.total * 100, 5); assert.equal(C.brineSalt(1000, 100), null);
});
test("price conversion: fresh 10000/kg, 90%->10% => 9 kg fresh per kg dried", () => {
  const r = C.dryPrice(10000, 90, 10); near(r.freshPerKgDried, 9); near(r.pricePerKgDried, 90000);
});
test("cooking loss round trip", () => { near(C.cookedWeight(500, 40).cooked, 300); near(C.rawNeeded(300, 40).raw, 500); assert.equal(C.cookedWeight(1, 100), null); });

test("hoursBetween: exact, order-checked, invalid -> null", () => {
  near(C.hoursBetween("2026-11-13T08:00:00Z", "2026-11-13T14:30:00Z"), 6.5);
  assert.equal(C.hoursBetween("2026-11-13T14:00:00Z", "2026-11-13T08:00:00Z"), null);
  assert.equal(C.hoursBetween("", "2026-11-13T08:00:00Z"), null);
});
