/** Pure follow-up scoring rules (no database access, easy to unit-test). */
function classify({ balance, daysSincePayment }) {
  if (balance <= 0) return { level: 'healthy', score: 0, reasons: [] };

  const reasons = [];
  let score = 0;
  if (daysSincePayment >= 30) { score += 5; reasons.push(`No payment for ${daysSincePayment} days`); }
  else if (daysSincePayment >= 14) { score += 3; reasons.push(`No payment for ${daysSincePayment} days`); }
  else if (daysSincePayment >= 7) { score += 1; reasons.push(`No payment for ${daysSincePayment} days`); }

  if (balance >= 1000) { score += 3; reasons.push('Outstanding amount is high'); }
  else if (balance >= 500) { score += 2; reasons.push('Outstanding amount is moderate'); }
  else { score += 1; reasons.push('Outstanding amount is pending'); }

  const level = score >= 6 ? 'urgent' : score >= 3 ? 'watch' : 'healthy';
  return { level, score, reasons };
}

module.exports = { classify };
