function numberPattern() {
  return '(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d{1,2})?';
}

function toNumber(value) {
  return Number(String(value).replace(/,/g, ''));
}

function parseTransaction(text) {
  const input = String(text || '').trim();
  if (!input) return { ok: false, error: 'Enter a transaction sentence first.' };

  const number = numberPattern();
  const creditMatch = input.match(new RegExp(`(?:for|worth|credit|total)\\s*(?:₹|rs\\.?\\s*)?(${number})`, 'i'));
  const paidMatch = input.match(new RegExp(`(?:paid|pay|gave|received)\\s*(?:₹|rs\\.?\\s*)?(${number})`, 'i'));
  const amountMatches = [...input.matchAll(new RegExp(`(?:₹|rs\\.?\\s*)?(${number})`, 'gi'))].map(m => toNumber(m[1]));

  const credit = creditMatch ? toNumber(creditMatch[1]) : (amountMatches[0] || 0);
  const payment = paidMatch ? toNumber(paidMatch[1]) : 0;

  let customer = '';
  const beforeAction = input.match(/^(.+?)\s+(?:took|bought|got|purchased|borrowed|owes)\b/i);
  if (beforeAction) customer = beforeAction[1].trim();
  if (!customer) {
    const beforeCredit = input.match(/^(.+?)\s+(?:for|worth|credit)\b/i);
    if (beforeCredit) customer = beforeCredit[1].trim();
  }

  customer = customer.replace(/^customer\s+/i, '').replace(/[,.]$/, '').trim();

  if (!customer) return { ok: false, error: 'Could not identify the customer name. Try: “Ramesh took items for 240 and paid 100.”' };
  if (!credit) return { ok: false, error: 'Could not identify the credit amount.' };
  if (payment > credit) return { ok: false, error: 'Payment cannot be greater than the credit amount in one entry.' };

  return { ok: true, customer, credit, payment, net: credit - payment, original: input };
}

module.exports = { parseTransaction };
