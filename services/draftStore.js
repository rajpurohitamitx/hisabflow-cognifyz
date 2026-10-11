/**
 * Stateless, signed drafts.
 *
 * The first version kept previews in an in-memory Map. On Vercel every request can run in a
 * different serverless instance, so "parse" and "save" could land on different instances and the
 * preview would randomly "expire". Now the preview itself travels in a tamper-proof token:
 *   base64url(payload).HMAC-SHA256(payload)
 * The server never trusts a client-edited preview, and the token is bound to one shop and expires
 * after 10 minutes.
 */
const crypto = require('crypto');

const TTL_MS = 10 * 60 * 1000;
const b64 = (buf) => Buffer.from(buf).toString('base64url');

function sign(payload) {
  return crypto.createHmac('sha256', process.env.JWT_SECRET).update(payload).digest('base64url');
}

function createDraft(shopId, data) {
  const payload = b64(JSON.stringify({ sid: String(shopId), exp: Date.now() + TTL_MS, data }));
  return `${payload}.${sign(payload)}`;
}

function getDraft(shopId, token) {
  if (typeof token !== 'string' || token.length > 6000) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const body = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (body.sid !== String(shopId) || body.exp < Date.now()) return null;
    return body.data;
  } catch { return null; }
}

module.exports = { createDraft, getDraft };
