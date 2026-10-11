/**
 * Natural-language transaction parser (rule-based, no external AI).
 *
 * Accepts free-form sentences such as:
 *   "Ramesh took notebooks for 240 and paid 100"
 *   "Meena bought 2 kg sugar at 45 and 1 litre oil 130, paid 100"
 *   "add 500 credit for Suresh"      "received 300 from Anita"
 *   "kumar udhaar 250"               "Priya cleared her dues"
 *
 * It returns a structured preview (customer, items with qty / rate / amount,
 * credit, payment). The user always confirms the preview before anything is saved.
 */

const UNIT_MAP = {
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg',
  g: 'g', gm: 'g', gms: 'g', gram: 'g', grams: 'g',
  l: 'L', ltr: 'L', ltrs: 'L', litre: 'L', litres: 'L', liter: 'L', liters: 'L',
  ml: 'ml', pc: 'pcs', pcs: 'pcs', piece: 'pcs', pieces: 'pcs',
  packet: 'packet', packets: 'packet', pkt: 'packet', pkts: 'packet',
  pack: 'pack', packs: 'pack', box: 'box', boxes: 'box', dozen: 'dozen', dozens: 'dozen',
  bottle: 'bottle', bottles: 'bottle', bag: 'bag', bags: 'bag', tin: 'tin', tins: 'tin',
  sachet: 'sachet', sachets: 'sachet', strip: 'strip', strips: 'strip'
};
const UNIT_WORDS = Object.keys(UNIT_MAP).sort((a, b) => b.length - a.length).join('|');

const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, half: 0.5, ek: 1, do: 2, teen: 3, char: 4, paanch: 5 };

const PAYMENT_VERB = /\b(?:paid|pays?|payment|gave|give|given|received|recd|returned|deposited|settled|cleared|jama|diya|dia)\b/i;
const CREDIT_VERB = /\b(?:took|taken|take|bought|buy|got|get|purchased|borrowed|owes?|owing|udhaar|udhar|baaki|liya|lia|credit|wants|needs)\b/i;
const SETTLE_ALL = /\b(?:full|fully|all|everything|dues?|balance|entire|whole|poora|pura|sab)\b/i;

const FILLER = new Set(('a an the some my his her their our your its of to for from at on in by with and or but then also ' +
  'took taken take bought buy got get purchased borrowed owes owe owing udhaar udhar baaki liya lia credit debit ' +
  'wants needs paid pay pays gave give given received recd returned deposited settled cleared jama diya dia ne ' +
  'add enter note record write put mark entry items item stuff things today yesterday ' +
  'each per rate price worth cost costing total altogether overall bill sum rs inr rupees rupee rupaye rupay ' +
  'qty quantity x customer cust mr mrs ms shri sri smt shop store pending due amount balance back cash upi online ' +
  'is was are were will please plz ka ki ke ko se me mein').split(' '));

const STOP_NAME = new Set(['today', 'yesterday', 'add', 'enter', 'note', 'record', 'write', 'put', 'mark', 'customer', 'cust',
  'he', 'she', 'they', 'i', 'we', 'it', 'and', 'then', 'also', 'credit', 'payment', 'received', 'paid', 'give', 'gave']);

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
function titleCase(s) { return s.replace(/\s+/g, ' ').trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '); }

/** Normalise currency, thousands separators, "2k", "2kg", number words. */
function normalise(raw) {
  let t = ' ' + String(raw).replace(/\s+/g, ' ').trim() + ' ';
  t = t.replace(/(\d),(?=\d{3}(?!\d))/g, '$1');                                   // 1,200 -> 1200
  t = t.replace(/(\d+(?:\.\d+)?)\s*(?:rupees|rupee|rupaye|rupay|rs\.?|inr|₹|\/-)/gi, '₹$1'); // 240 rupees -> ₹240
  t = t.replace(/(?:₹|\brs\.?|\binr\b)\s*(\d)/gi, '₹$1');                         // Rs 240 / ₹ 240 -> ₹240
  t = t.replace(/\b(?:rupees|rupee|rupaye|rupay)\b/gi, ' ');
  t = t.replace(/(\d+(?:\.\d+)?)\s?k\b/gi, (_, n) => String(Number(n) * 1000));  // 2k -> 2000
  t = t.replace(new RegExp(`(\\d)(${UNIT_WORDS})\\b`, 'gi'), '$1 $2');            // 2kg -> 2 kg
  t = t.replace(/\b(\d+)\s?[x×]\b/gi, 'x$1').replace(/[x×]\s?(\d+)\b/gi, 'x$1');   // 3x / x3 -> x3
  t = t.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|half)\b(?=\s+(?:kg|g|l|ltr|litre|liter|dozen|packet|box|bottle|bag|pcs|piece|pack)\b)/gi,
    (w) => String(NUMBER_WORDS[w.toLowerCase()]));
  t = t.replace(/\b(a|one)\s+(dozen)\b/gi, '1 $2');
  return t.replace(/\s+/g, ' ').trim();
}

/** Find a customer name: known customers first, then sentence patterns. */
function findCustomer(text, knownNames) {
  const known = (knownNames || []).filter(Boolean);
  if (known.length) {
    const firstCount = {};
    known.forEach(n => { const f = n.split(/\s+/)[0].toLowerCase(); firstCount[f] = (firstCount[f] || 0) + 1; });
    const candidates = [];
    known.forEach(n => {
      candidates.push({ label: n, needle: n });
      const first = n.split(/\s+/)[0];
      if (first.length >= 3 && firstCount[first.toLowerCase()] === 1 && first !== n) candidates.push({ label: n, needle: first });
    });
    candidates.sort((a, b) => b.needle.length - a.needle.length);
    for (const c of candidates) {
      if (new RegExp(`(?:^|[^\\p{L}\\p{N}])${esc(c.needle)}(?![\\p{L}\\p{N}])`, 'iu').test(text)) return { name: c.label, needle: c.needle, known: true };
    }
  }

  const verbs = 'took|taken|take|bought|buy|got|get|purchased|borrowed|owes?|owing|paid|pays?|pay|gave|give|given|received|recd|returned|settled|cleared|deposited|wants|needs|udhaar|udhar|baaki|liya|lia|diya|dia|jama|ne';
  const cleaned = text.replace(/^(?:\s*(?:add|enter|note|record|write|put|mark|today|yesterday)\b[\s,:-]*)+/i, '');
  let m = cleaned.match(new RegExp(`^(?:(?:customer|cust|mr|mrs|ms|shri|sri|smt)\\.?\\s+)?([\\p{L}][\\p{L}'.-]*(?:\\s+[\\p{L}][\\p{L}'.-]*){0,2}?)\\s+(?:${verbs})\\b`, 'iu'));
  if (m && !STOP_NAME.has(m[1].toLowerCase()) && !/\d/.test(m[1])) return { name: titleCase(m[1]), needle: m[1], known: false };

  m = text.match(/\b(?:for|to|from|of|by)\s+(?:customer\s+|mr\.?\s+|mrs\.?\s+|ms\.?\s+|shri\s+|smt\.?\s+)?(\p{Lu}[\p{L}'.-]*(?:\s+\p{Lu}[\p{L}'.-]*){0,2})/u);
  if (m && !STOP_NAME.has(m[1].toLowerCase())) return { name: titleCase(m[1]), needle: m[1], known: false };

  m = text.match(/\b(?:customer|name)\s*[:\-]?\s*([\p{L}][\p{L}'.-]*(?:\s+[\p{L}][\p{L}'.-]*){0,2})/iu);
  if (m && !STOP_NAME.has(m[1].toLowerCase())) return { name: titleCase(m[1]), needle: m[1], known: false };
  return null;
}

/** Parse one credit clause ("2 kg sugar at 45") into an item. */
function parseSegment(seg) {
  const numRe = /₹?\d+(?:\.\d+)?|x\d+(?:\.\d+)?/g;
  const nums = [];
  let m;
  while ((m = numRe.exec(seg))) nums.push({ raw: m[0], index: m.index, end: m.index + m[0].length });
  if (!nums.length) return null;

  const unitAfter = new RegExp(`^\\s*(${UNIT_WORDS})\\b`, 'i');
  const priceBefore = /(?:\b(?:at|for|rate|price|worth|costing|cost|total|each)|@)\s*$/i;
  const eachAfter = /^\s*(?:each|per|a piece|apiece|\/-?\s*(?:kg|piece|pc|l|ltr|dozen))/i;

  let qty = null, unit = '', price = null, lineTotal = null, hasPriceUnit = false;
  const used = [];
  nums.forEach(n => {
    const before = seg.slice(0, n.index), after = seg.slice(n.end);
    const val = Number(n.raw.replace(/[₹x]/g, ''));
    const um = after.match(unitAfter);
    if (n.raw.startsWith('x')) {
      const earlier = nums.some(o => o !== n && o.index < n.index && !o.raw.startsWith('₹'));
      if (earlier) { price = val; hasPriceUnit = true; } else qty = val; // "2 soaps x 35" => rate, "soap x2" => qty
      used.push(n); return;
    }
    if (um && !n.raw.startsWith('₹')) { qty = val; unit = UNIT_MAP[um[1].toLowerCase()]; n.unitLen = um[0].length; used.push(n); return; }
    if (/\bqty\s*:?\s*$|\bquantity\s*:?\s*$/i.test(before)) { qty = val; used.push(n); return; }
    const each = eachAfter.test(after) || /\b(?:at|@|rate|price|each)\s*$/i.test(before) && /\beach|per\b/i.test(after);
    if (each || (/(?:\bat|@|\brate|\bprice|\bcosting)\s*$/i.test(before))) { price = val; hasPriceUnit = true; used.push(n); return; }
    if (n.raw.startsWith('₹') || priceBefore.test(before)) { lineTotal = val; used.push(n); return; }
    used.push({ ...n, unmarked: true, val });
  });

  const unmarked = used.filter(n => n.unmarked);
  if (unmarked.length === 1 && qty === null && price === null && lineTotal === null) {
    const n = unmarked[0], after = seg.slice(n.end), before = seg.slice(0, n.index);
    const followedByWord = /^\s*[\p{L}]/u.test(after) && !/^\s*(?:rupees?|rs)/i.test(after);
    const nameBefore = /[\p{L}]/u.test(before.replace(/\b(?:took|bought|got|credit|add|udhaar|owes?)\b/gi, ''));
    // "3 notebooks" => quantity; "notebooks 240" / "240" => amount
    if (followedByWord && !nameBefore && Number.isInteger(n.val) && n.val <= 100) n.asQty = true;
    if (n.asQty) qty = n.val; else lineTotal = n.val;
  } else if (unmarked.length >= 1) {
    const [first, ...rest] = unmarked;
    if (qty === null && unmarked.length >= 2) { qty = first.val; rest.forEach(r => { if (lineTotal === null && price === null) lineTotal = r.val; }); }
    else unmarked.forEach(r => { if (lineTotal === null && price === null) lineTotal = r.val; else if (qty === null) qty = r.val; });
  }

  let name = seg;
  used.slice().sort((a, b) => b.index - a.index).forEach(n => { name = name.slice(0, n.index) + ' ' + name.slice(n.end + (n.unitLen || 0)); });
  name = name.replace(/[₹@,:;()"“”]/g, ' ').split(/\s+/).filter(w => w && !FILLER.has(w.toLowerCase()) && !/^x\d/.test(w)).join(' ');
  name = name.replace(/[^\p{L}\p{N}\s'.&-]/gu, '').trim();

  const q = qty && qty > 0 ? qty : 1;
  if (price !== null) lineTotal = round2(q * price);
  if (lineTotal === null) return { name, qty: qty || null, unit, price: null, total: null };
  if (price === null) price = round2(lineTotal / q);
  return { name, qty: q, unit, price, total: round2(lineTotal) };
}

function parseTransaction(text, knownNames = []) {
  const original = String(text || '').trim();
  if (!original) return { ok: false, error: 'Type what happened first, for example “Meena took 2 kg sugar at 45 and paid 50”.' };
  if (original.length > 300) return { ok: false, error: 'Please keep the sentence under 300 characters.' };

  let t = normalise(original);
  let occurredAt = null;
  if (/\byesterday\b/i.test(t)) { occurredAt = new Date(Date.now() - 86400000).toISOString(); }

  const found = findCustomer(t, knownNames);
  if (!found) return { ok: false, error: 'I could not find the customer name. Try “Meena took 2 kg sugar at 45” or “received 300 from Anita”.' };
  let body = t.replace(new RegExp(`(?:^|\\s)${esc(found.needle)}(?=\\s|$|[,.])`, 'iu'), ' ').replace(/\bne\b/gi, ' ');

  // Statement of a total / bill, e.g. "total 300", "bill of 450"
  let statedTotal = null;
  body = body.replace(/\b(?:total|altogether|overall|in all|bill(?: of)?|sum)\s*(?:of|is|was|=|:)?\s*₹?(\d+(?:\.\d+)?)/i, (_, n) => { statedTotal = Number(n); return ' '; });

  body = body.replace(/(\d)\s+(?=(?:paid|pays?|gave|received|recd|returned|deposited|settled|cleared|jama|diya)\b)/gi, '$1; ');
  const clauses = body.split(/\s+(?:and|but|then|also|aur|while)\s+|[;,&+]|\s\/\s/i).map(s => s.trim()).filter(Boolean);
  const itemSegs = [];
  let payment = 0, settleAll = false;

  clauses.forEach((c, i) => {
    const hasPay = PAYMENT_VERB.test(c);
    const hasCredit = CREDIT_VERB.test(c.replace(/\bcredit\b/gi, hasPay ? 'credit' : ''));
    const money = c.match(/₹?\d+(?:\.\d+)?/);
    if (hasPay && (!hasCredit || /^\s*(?:paid|pays?|gave|give|given|received|recd|returned|deposited|settled|cleared|jama|diya|dia)\b/i.test(c)) ) {
      if (money && !/\bcredit\b/i.test(c.replace(PAYMENT_VERB, ''))) { if (!payment) payment = Number(money[0].replace('₹', '')); return; }
      if (!money && SETTLE_ALL.test(c)) { settleAll = true; return; }
    }
    if (money) itemSegs.push(c);
    else if (hasPay && SETTLE_ALL.test(c)) settleAll = true;
  });

  const parsedItems = itemSegs.map(parseSegment).filter(Boolean);
  const warnings = [];

  // "2 pens and 3 notebooks for 500": a single trailing price covers the group
  const priced = parsedItems.filter(i => i.total !== null);
  if (statedTotal === null && parsedItems.length > 1 && priced.length === 1 && parsedItems[parsedItems.length - 1].total !== null) {
    statedTotal = priced[0].total; priced[0].total = null; priced[0].price = null;
  }

  let items = parsedItems.map(i => ({ ...i, name: i.name ? i.name.charAt(0).toUpperCase() + i.name.slice(1) : '' }));
  const missing = items.filter(i => i.total === null);
  let credit = 0;
  if (statedTotal !== null) {
    credit = statedTotal;
    const sum = round2(items.reduce((a, i) => a + (i.total || 0), 0));
    if (sum && !missing.length && Math.abs(sum - statedTotal) > 0.01) warnings.push(`The items add up to ₹${sum}, but the total you gave is ₹${statedTotal}. Using ₹${statedTotal}.`);
    if (items.length === 1 && missing.length === 1) { items[0].total = statedTotal; items[0].price = round2(statedTotal / (items[0].qty || 1)); }
  } else if (missing.length) {
    const label = missing[0].name || 'one of the items';
    return { ok: false, error: `I found “${label}” but not its price. Add the rate or the amount, e.g. “${label} at 40” or “${label} for 120”.` };
  } else {
    credit = round2(items.reduce((a, i) => a + i.total, 0));
  }

  if (!items.length && credit > 0) items = [{ name: '', qty: 1, unit: '', price: credit, total: credit }];
  items = items.map(i => ({ ...i, name: i.name || (items.length === 1 ? 'Credit entry' : 'Items') }));

  if (!credit && !payment && !settleAll) return { ok: false, error: 'I could not find an amount. Include a number, e.g. “took rice for 300” or “paid 200”.' };
  if (credit && payment > credit) return { ok: false, error: 'The payment is larger than the credit in the same sentence. Record the payment as its own entry.' };

  return { ok: true, customer: found.name, knownCustomer: found.known, items: credit ? items : [], credit, payment, settleAll, net: round2(credit - payment), occurredAt, warnings, original };
}

/** One-line description stored on the ledger row. */
function describeItems(items) {
  return items.map(i => {
    const q = i.qty && i.qty !== 1 ? `${i.qty}${i.unit ? ' ' + i.unit : ''} ` : (i.unit ? `1 ${i.unit} ` : '');
    return `${q}${i.name}`.trim();
  }).join(', ').slice(0, 200);
}

module.exports = { parseTransaction, describeItems, normalise };
