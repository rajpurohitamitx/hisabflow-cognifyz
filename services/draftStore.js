const crypto = require('crypto');

const drafts = new Map();
const TTL_MS = 10 * 60 * 1000;

function createDraft(shopId, data) {
  const token = crypto.randomBytes(18).toString('hex');
  drafts.set(token, { shopId: String(shopId), data, expiresAt: Date.now() + TTL_MS });
  return token;
}

function getDraft(shopId, token) {
  const draft = drafts.get(token);
  if (!draft || draft.shopId !== String(shopId) || draft.expiresAt < Date.now()) {
    drafts.delete(token);
    return null;
  }
  return draft.data;
}

function removeDraft(token) {
  drafts.delete(token);
}

module.exports = { createDraft, getDraft, removeDraft };
