const test = require('node:test');
const assert = require('node:assert/strict');
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123456';
const { createDraft, getDraft } = require('../services/draftStore');
const { rateLimit } = require('../middleware/rateLimit');

test('a draft round-trips for the shop that created it', () => {
  const t = createDraft('shopA', { customer: 'Meena', credit: 100 });
  assert.deepEqual(getDraft('shopA', t), { customer: 'Meena', credit: 100 });
});
test('another shop cannot use the draft', () => {
  assert.equal(getDraft('shopB', createDraft('shopA', { credit: 1 })), null);
});
test('a tampered draft is rejected', () => {
  const t = createDraft('shopA', { credit: 100 });
  const [payload, sig] = t.split('.');
  const forged = Buffer.from(JSON.stringify({ sid: 'shopA', exp: Date.now() + 1e6, data: { credit: 999999 } })).toString('base64url');
  assert.equal(getDraft('shopA', `${forged}.${sig}`), null);
  assert.equal(getDraft('shopA', `${payload}.AAAA`), null);
  assert.equal(getDraft('shopA', 'garbage'), null);
  assert.equal(getDraft('shopA', undefined), null);
});
test('an expired draft is rejected', () => {
  const real = Date.now; const t = createDraft('shopA', { credit: 1 });
  Date.now = () => real() + 11 * 60 * 1000;
  try { assert.equal(getDraft('shopA', t), null); } finally { Date.now = real; }
});
test('the rate limiter blocks after the limit and sets Retry-After', () => {
  const mw = rateLimit({ windowMs: 60000, max: 3 });
  const make = () => { const r = { headers: {}, code: 200, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json() { return this; }, render() { return this; } }; return r; };
  const req = { ip: '1.2.3.4', path: '/api/x', originalUrl: '/api/x', is: () => true };
  let passed = 0;
  for (let i = 0; i < 5; i++) { const res = make(); mw(req, res, () => passed++); if (i === 4) { assert.equal(res.code, 429); assert.ok(res.headers['Retry-After']); } }
  assert.equal(passed, 3);
});
