const test = require('node:test');
const assert = require('node:assert/strict');
const { classify } = require('../services/classify');

test('a settled balance is healthy', () => {
  const r = classify({ balance: 0, daysSincePayment: 60 });
  assert.equal(r.level, 'healthy'); assert.equal(r.score, 0);
});
test('a large, long-overdue balance is urgent', () => {
  const r = classify({ balance: 1200, daysSincePayment: 35 });
  assert.equal(r.level, 'urgent'); assert.ok(r.score >= 6); assert.equal(r.reasons.length, 2);
});
test('a small recent balance stays low priority', () => {
  assert.equal(classify({ balance: 200, daysSincePayment: 2 }).level, 'healthy');
});
test('a moderate balance a few weeks old is on watch', () => {
  assert.equal(classify({ balance: 600, daysSincePayment: 15 }).level, 'watch');
});
