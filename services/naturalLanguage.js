/*
 * Natural-language entry parser.
 *
 * Understands free-form English, Hindi (romanised or Devanagari) and mixed "Hinglish":
 *   "Ramesh took items for 240 and paid 100"
 *   "nikhil paid 5000"
 *   "Anita ne 2 kg sugar 45 rate se aur 1 litre oil 180 ka liya, 100 diye"
 *   "received 300 from Mohan by upi"
 *   "sold 3 notebooks 40 each and a pen for 10 to Geeta, she paid half"  (half is not supported; amounts are)
 *
 * It extracts: customer, items (name / qty / unit / unit price / total), credit total,
 * payment total, payment method, an optional date, and a "settle everything" flag.
 */

const L = '\\p{L}\\p{M}';

const UNITS = new Set(('kg kgs kilo kilos kilogram kilograms g gm gms gram grams gramme l lt ltr litre litres liter liters ml ' +
  'pcs pc piece pieces packet packets pkt pack packs dozen dz box boxes bottle bottles bag bags sack sacks plate plates ' +
  'cup cups bundle bundles quintal ton tons metre metres meter meters ' +
  'किलो ग्राम लीटर पैकेट दर्जन').split(/\s+/));

const PAY_VERBS = ['paid', 'pay', 'pays', 'paying', 'payed', 'payment', 'received', 'recieved', 'receive', 'deposited', 'deposit',
  'settled', 'cleared', 'gave', 'give', 'given', 'jama', 'chukaya', 'chuka', 'chukaye', 'diye', 'diya', 'dia', 'di', 'bheja', 'bheje',
  'mila', 'mile', 'mili', 'दिए', 'दिया', 'जमा', 'मिले', 'मिला', 'चुकाया'];

const CUES = new Set(['at', '@', 'rate', 'each', 'per', 'ea', 'apiece', 'har', 'प्रति']);
const TOTAL_WORDS = new Set(['total', 'worth', 'bill', 'kul', 'amount', 'due', 'credit', 'udhaar', 'udhar', 'udhari', 'baki', 'baaki', 'उधार', 'कुल']);
const SEPARATORS = new Set(['and', 'aur', 'plus', 'also', 'then', 'और', ',', ';', '+', '&']);
const POSTPOSITIONS = new Set(['ne', 'ko', 'se', 'ने', 'को', 'से']);
const LEAD_SKIP = new Set(['today', 'aaj', 'आज', 'yesterday', 'kal', 'please', 'plz', 'add', 'new', 'entry', 'note', 'record', 'customer', 'party',
  'mr', 'mrs', 'ms', 'shri', 'shree', 'bhai', 'bhaiya', 'uncle', 'aunty', 'sir', 'madam']);
const ACTION_WORDS = new Set(['grabbed', 'picked', 'eduthan', 'eduthen', 'eduthaan', 'eduthachu', 'eduthar', 'vanginar', 'vanginaar', 'vanginan', 'vanginen', 'vangittan', 'vangitaan', 'vangitten', 'vaangittan', 'vaangi', 'vaanginaar', 'vaanginen', 'kuduthen', 'kuduthan', 'kuduthaen', 'kuduthar', 'kudukuren', 'kuduthachu', 'kudutha', 'panniten', 'pannitan', 'pannen', 'pannitaan', 'aayiduchu', 'aachu', 'வாங்கினார்', 'வாங்கினான்', 'வாங்கினேன்', 'எடுத்தான்', 'எடுத்தேன்', 'கொடுத்தேன்', 'கொடுத்தார்', 'took', 'take', 'taken', 'takes', 'bought', 'buy', 'buys', 'got', 'get', 'gets', 'purchased', 'purchase', 'borrowed', 'borrow',
  'owes', 'owe', 'owed', 'has', 'had', 'have', 'is', 'was', 'will', 'wants', 'want', 'needs', 'need', 'ordered', 'order', 'picked', 'collected', 'sold',
  'liya', 'liye', 'lia', 'le', 'lekar', 'gaya', 'gayi', 'gaye', 'kharida', 'kharidi', 'khareeda', 'udhaar', 'udhar', 'udhari', 'tha', 'thi', 'hai', 'लिया', 'ली', 'लिये', 'खरीदा',
  ...PAY_VERBS, ...POSTPOSITIONS]);

const NAME_FOLLOWERS = new Set(['ke', 'ka', 'ki', 'ku', 'kku', 'ukku', 'la', 'da', 'ne', 'ko', 'se', 'bought', 'grabbed', 'purchased']);
const STOP = new Set([
  // Tamil / Tanglish fillers
  'ku', 'kku', 'ukku', 'la', 'il', 'ila', 'da', 'di', 'macha', 'machan', 'machi', 'boss', 'bro', 'anna', 'akka', 'ippo', 'nethu', 'netru', 'inniki', 'ellam', 'mothama', 'moththam', 'kaasu', 'kasu', 'rubai', 'roobai', 'ruba', 'bucks', 'buck', 'vilai', 'meedhi', 'meethi', 'adjust', 'handover', 'deal', 'set', 'settle', 'buy', 'purchase', 'purchased', 'bought', 'grabbed', 'ho', 'kar', 'gaya', 'ok', 'okay', 'rs', 'ரூபாய்', 'ரூ', 'க்கு', 'ல', 'நேற்று',
  // English fillers & verbs
  'items', 'item', 'things', 'thing', 'stuff', 'goods', 'products', 'product', 'some', 'few', 'the', 'a', 'an', 'and', 'or', 'for', 'to', 'from', 'by', 'of',
  'on', 'in', 'at', 'with', 'worth', 'total', 'bill', 'credit', 'debit', 'amount', 'balance', 'due', 'rs', 'rupees', 'rupee', 'inr', 'today', 'yesterday',
  'tomorrow', 'please', 'plz', 'also', 'then', 'plus', 'only', 'just', 'each', 'per', 'every', 'back', 'full', 'all', 'everything', 'entire', 'whole', 'complete',
  'cash', 'online', 'upi', 'gpay', 'phonepe', 'paytm', 'cheque', 'check', 'via', 'using', 'as', 'advance', 'he', 'she', 'they', 'his', 'her', 'their', 'him', 'them',
  'again', 'old', 'new', 'customer', 'party', 'mr', 'mrs', 'ms', 'shri', 'shree', 'account', 'khata', 'hisab', 'hisaab', 'ledger', 'entry', 'note', 'record',
  'add', 'added', 'put', 'sold', 'sell', 'give', 'gave', 'given', 'gives', 'send', 'sent', 'it', 'this', 'that', 'my', 'our', 'sir', 'madam', 'bhai', 'bhaiya',
  'uncle', 'aunty', 'ji', 'ago', 'day', 'days', 'half', 'against', 'pending', 'up', 'settle', 'clear', 'cleared', 'settled', 'ea', 'apiece', 'rate', 'x',
  // Hinglish
  'ne', 'ko', 'se', 'ka', 'ki', 'ke', 'liya', 'liye', 'lia', 'le', 'lee', 'gaya', 'gayi', 'gaye', 'lekar', 'kiya', 'kiye', 'kar', 'karke', 'diya', 'diye', 'di', 'dia',
  'de', 'dena', 'jama', 'mila', 'mile', 'mili', 'bheja', 'bheje', 'chukaya', 'chuka', 'chukaye', 'udhaar', 'udhar', 'udhari', 'baki', 'baaki', 'aur', 'ya', 'tha', 'thi',
  'hai', 'hain', 'ho', 'hua', 'hui', 'abhi', 'aaj', 'kal', 'parso', 'parson', 'rupaye', 'rupay', 'rupiya', 'kul', 'sab', 'saara', 'sara', 'poora', 'pura', 'puri', 'pehle',
  'din', 'bhi', 'wala', 'wale', 'mein', 'me', 'par', 'pe', 'tak', 'sirf', 'bas', 'kitna', 'kuch', 'saman', 'samaan', 'saaman', 'saamaan', 'cheez', 'cheezein', 'kharida',
  'kharidi', 'khareeda', 'ek', 'liye', 'sath', 'saath', 'wapas', 'vapas', 'har',
  // Devanagari
  'ने', 'को', 'से', 'का', 'की', 'के', 'ली', 'लिया', 'लिये', 'दिए', 'दिया', 'जमा', 'मिले', 'मिला', 'और', 'रुपये', 'रुपए', 'उधार', 'कुल', 'खरीदा', 'चुकाया', 'में', 'पर', 'भी', 'आज', 'कल', 'सामान',
  ...PAY_VERBS, ...[...ACTION_WORDS]
]);

const MONTHLESS_DATES = [
  { re: /\b(?:day before yesterday|parso|parson)\b|परसों/, days: 2 },
  { re: /\b(?:yesterday|kal|nethu|netru)\b|कल|நேற்று/u, days: 1 }
];

function round2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }
function titleCase(s) { return s.replace(/(^|[\s.-])([\p{L}])/gu, (m, p, c) => p + c.toUpperCase()); }
function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function fmtMoney(n) { return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }); }

/** Lower-cases and turns "₹1,200", "1.2k", "5 hazar", "240 rs", "240/-" into plain numbers with a ¤ currency marker. */
function normalise(text) {
  let s = String(text || '').toLowerCase().replace(/[“”"]/g, ' ').replace(/’/g, "'");
  s = s.replace(/\s+/g, ' ').trim();
  while (/(\d),(\d{3})(?!\d)/.test(s)) s = s.replace(/(\d),(\d{3})(?!\d)/g, '$1$2');
  s = s.replace(/(\d+(?:\.\d+)?)\s*(lakh|lac|lakhs)\b/g, (m, n) => String(round2(parseFloat(n) * 100000)));
  s = s.replace(/(\d+(?:\.\d+)?)\s*(hazar|hazaar|thousand|हज़ार|हजार)(?![\p{L}])/gu, (m, n) => String(round2(parseFloat(n) * 1000)));
  s = s.replace(/(\d+(?:\.\d+)?)\s*k\b/g, (m, n) => String(round2(parseFloat(n) * 1000)));
  // "2 x 30" / "2x30" => qty 2, price 30 each
  s = s.replace(/(\d+(?:\.\d+)?)\s*[x×]\s*(?:₹|rs\.?)?\s*(\d+(?:\.\d+)?)(?![\d.]*\s*(?:kg|g|ml|l)\b)/g, '$1 ¤$2 each ');
  // "2x sugar" / "x2 sugar"
  s = s.replace(/(\d+(?:\.\d+)?)\s*[x×]\s*(?=[\p{L}])/gu, '$1 ').replace(/\b[x×]\s*(\d+(?:\.\d+)?)/g, '$1 ');
  // "45/kg", "45 / kg"
  s = s.replace(/(\d+(?:\.\d+)?)\s*\/\s*(?=[a-z]{1,8}\b)/g, '$1 per ');
  // currency markers
  s = s.replace(/(?:₹|\brs\.?|\binr\b|ரூ)\s*(\d+(?:\.\d+)?)/g, '¤$1');
  s = s.replace(/(\d+(?:\.\d+)?)\s*(?:₹|\/-|rs(?![\p{L}])\.?|rupees?(?![\p{L}])|rupaye(?![\p{L}])|rupay(?![\p{L}])|rupiya(?![\p{L}])|rubai(?![\p{L}])|roobai(?![\p{L}])|ruba(?![\p{L}])|bucks?(?![\p{L}])|inr(?![\p{L}])|रुपये|रुपए|ரூபாய்|ரூ)/gu, '¤$1');
  return s.replace(/\s+/g, ' ').trim();
}

function tokenize(s) {
  const out = [];
  const re = new RegExp(`¤?\\d+(?:\\.\\d+)?|[${L}][${L}'.-]*|[@;,+&]`, 'gu');
  let m;
  while ((m = re.exec(s))) {
    const v = m[0];
    if (/^¤?\d/.test(v)) out.push({ t: 'n', v: parseFloat(v.replace('¤', '')), cur: v[0] === '¤' });
    else if (/^[@;,+&]$/.test(v)) out.push({ t: 's', v });
    else out.push({ t: 'w', v: v.replace(/[.'-]+$/, '').replace(/'s$/, ''), poss: /'s$/.test(v) });
  }
  return out;
}

function isNameWord(tok) {
  if (!tok || tok.t !== 'w') return false;
  const v = tok.v;
  return v.length >= 2 && !STOP.has(v) && !UNITS.has(v) && !CUES.has(v) && !TOTAL_WORDS.has(v);
}

function pickCustomer(norm, original, tokens, knownCustomers) {
  // 1. A customer already in the ledger, mentioned anywhere in the sentence
  const known = [...(knownCustomers || [])].filter(Boolean).sort((a, b) => b.length - a.length);
  for (const name of known) {
    const re = new RegExp(`(?<![${L}])${escapeRe(name.toLowerCase())}(?![${L}])`, 'u');
    if (re.test(norm)) return { name, known: true };
  }

  const run = (start, max = 3) => {
    const words = [];
    for (let i = start; i < tokens.length && words.length < max && isNameWord(tokens[i]); i++) words.push(tokens[i].v);
    return words;
  };
  const clean = (words) => titleCase(words.join(' '));

  // leading run of name words (skipping "today", "add", "customer" …)
  let s = 0;
  while (s < tokens.length && tokens[s].t === 'w' && LEAD_SKIP.has(tokens[s].v)) s++;
  const lead = run(s);
  const afterLead = tokens[s + lead.length];

  // 2. "Ramesh took…", "nikhil paid…", "Mohan se…", "Anita ne…"
  if (lead.length && afterLead && afterLead.t === 'w' && (ACTION_WORDS.has(afterLead.v) || NAME_FOLLOWERS.has(afterLead.v))) return { name: clean(lead) };

  // 3. "<name> ne/ko/se" anywhere
  for (let i = 1; i < tokens.length; i++) {
    if (tokens[i].t === 'w' && POSTPOSITIONS.has(tokens[i].v) && isNameWord(tokens[i - 1])) {
      const words = [tokens[i - 1].v];
      if (isNameWord(tokens[i - 2]) && tokens[i - 2].v !== undefined) words.unshift(tokens[i - 2].v);
      return { name: clean(words) };
    }
  }

  // 4. "… to Geeta", "… from Mohan"
  for (let i = tokens.length - 2; i >= 0; i--) {
    if (tokens[i].t === 'w' && ['to', 'from'].includes(tokens[i].v) && isNameWord(tokens[i + 1])) return { name: clean(run(i + 1, 2)) };
  }

  // 5. "gave Priya 2 kg rice", "credit Suresh 500", "sold Priya …"
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i].t === 'w' && ['gave', 'give', 'sold', 'sell', 'add', 'added', 'put', 'note', 'record', 'charge', 'bill', 'credit', 'debit', 'diya', 'diye'].includes(tokens[i].v) && isNameWord(tokens[i + 1])) {
      return { name: clean(run(i + 1, 2)) };
    }
  }

  // 6. "Ramesh 500", "Ramesh sugar 90"
  if (lead.length && afterLead && (afterLead.t === 'n' || (afterLead.t === 'w' && UNITS.has(afterLead.v)))) return { name: clean(lead.slice(0, 1)) };
  if (lead.length && !afterLead) return { name: clean(lead) };

  // 7. "for Ramesh", "by Ramesh", "of Ramesh"
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i].t === 'w' && ['for', 'by', 'of'].includes(tokens[i].v) && isNameWord(tokens[i + 1])) return { name: clean(run(i + 1, 2)) };
  }

  // 8. possessive "Ramesh's account"
  const poss = tokens.find(t => t.t === 'w' && t.poss && isNameWord(t));
  if (poss) return { name: clean([poss.v]) };

  // 9. any capitalised word in the original sentence
  const cap = String(original).match(new RegExp(`(?<![${L}])\\p{Lu}[${L}]{1,}`, 'gu')) || [];
  const capWord = cap.find(w => !STOP.has(w.toLowerCase()) && !UNITS.has(w.toLowerCase()));
  if (capWord) return { name: clean([capWord.toLowerCase()]) };

  return { name: '' };
}

function extractDate(norm) {
  const now = new Date();
  for (const d of MONTHLESS_DATES) {
    if (d.re.test(norm)) return { norm: norm.replace(d.re, ' '), when: new Date(now.getTime() - d.days * 86400000) };
  }
  const ago = norm.match(/(\d+)\s*(?:days?\s+ago|din\s+pehle)/);
  if (ago && Number(ago[1]) <= 365) return { norm: norm.replace(ago[0], ' '), when: new Date(now.getTime() - Number(ago[1]) * 86400000) };
  return { norm, when: null };
}

function extractPayments(norm) {
  const verbs = PAY_VERBS.join('|');
  const num = '¤?(\\d+(?:\\.\\d+)?)';
  const unitLook = `(?!\\s*(?:${[...UNITS].join('|')})(?![${L}]))`;
  const fillers = `(?:\\s+(?:back|off|only|of|rs|just|us|me|cash|online|upi|gpay|phonepe|paytm|by|via|in|amount|ne|ko|ka))*`;
  const A = new RegExp(`(?<![${L}])(?:${verbs})(?![${L}])${fillers}\\s*${num}(?!\\d|\\.\\d)${unitLook}`, 'giu');
  const B = new RegExp(`${num}(?!\\d|\\.\\d)\\s*(?:rs\\s*)?(?:was\\s+|were\\s+|ne\\s+)?(?:${verbs})(?![${L}])`, 'giu');
  let payment = 0;
  let rest = norm;
  let m;
  // Pattern A first ("paid 100"), then pattern B ("100 diye")
  while ((m = A.exec(rest))) { payment += parseFloat(m[1]); rest = rest.slice(0, m.index) + ' | ' + rest.slice(m.index + m[0].length); A.lastIndex = 0; }
  while ((m = B.exec(rest))) { payment += parseFloat(m[1]); rest = rest.slice(0, m.index) + ' | ' + rest.slice(m.index + m[0].length); B.lastIndex = 0; }
  return { payment: round2(payment), rest };
}


/** "remaining is 50", "50 baki", "balance 50 left" – what is still due AFTER the payment in this sentence. */
function extractRemaining(norm) {
  const words = '(?:remaining|remains|remaining balance|left|pending|balance|due|outstanding|baki|baaki|bacha|bache|bachha|shesh|बाकी|बचा)';
  const num = '¤?(\\d+(?:\\.\\d+)?)';
  const A = new RegExp(`(?<![${L}])${words}(?![${L}])\\s*(?:is|are|was|will be|=|:|hai|rahe|raha|rahi|hain|है)?\\s*(?:only|just|rs|to pay|to be paid)?\\s*${num}(?!\\d|\\.\\d)`, 'iu');
  const B = new RegExp(`${num}(?!\\d|\\.\\d)\\s*(?:rs\\s*)?(?:is\\s+|are\\s+)?${words}(?![${L}])`, 'iu');
  const m = norm.match(A) || norm.match(B);
  if (!m) return null;
  return { amount: parseFloat(m[1]), rest: norm.replace(m[0], ' | ') };
}

function paymentMethod(norm) {
  if (/\b(upi|gpay|google pay|phonepe|paytm|bhim)\b/.test(norm)) return 'UPI';
  if (/\b(cash|naqad|nakad)\b/.test(norm)) return 'cash';
  if (/\b(online|net ?banking|neft|imps|rtgs|transfer)\b/.test(norm)) return 'online';
  if (/\b(cheque|check)\b/.test(norm)) return 'cheque';
  return '';
}

function wantsSettleAll(norm) {
  return /\b(?:paid|pay|payed|cleared|settled|clear|settle|chukaya|chuka)\b.*\b(?:full|all|everything|entire|whole|poora|pura|puri|sab|saara|sara|complete)\b/.test(norm)
    || /\b(?:full|poora|pura|puri|complete)\s+(?:payment|hisab|hisaab|udhaar|udhar|baki|baaki|balance|amount|due)\b/.test(norm)
    || /\b(?:hisab|hisaab|khata|account|balance)\s+(?:clear|cleared|settled|chuka)/.test(norm)
    || /\b(?:sab|saara|sara|poora|pura)\s+(?:chuka|chukaya|clear|de diya|de diye)/.test(norm);
}

/** Turns one comma/"and"-separated chunk into an item (or a grand total). */
function parseSegment(tokens, nameWords) {
  const words = tokens.filter(t => t.t === 'w');
  const nums = tokens.map((t, i) => ({ ...t, i })).filter(t => t.t === 'n');
  const unitAfter = (i) => { const n = tokens[i + 1]; return n && n.t === 'w' && UNITS.has(n.v) ? n.v : null; };
  const unitBefore = (i) => { const p = tokens[i - 1]; return p && p.t === 'w' && UNITS.has(p.v) ? p.v : null; };

  const itemWords = words.filter(w => !STOP.has(w.v) && !UNITS.has(w.v) && !CUES.has(w.v) && !TOTAL_WORDS.has(w.v) && !nameWords.has(w.v) && w.v.length > 0);
  const hasCue = tokens.some(t => (t.t === 'w' && CUES.has(t.v)) || (t.t === 's' && t.v === '@'));
  const hasTotalWord = words.some(w => TOTAL_WORDS.has(w.v));
  // Numbers (outside of a mention of the name) that the user has marked up
  let qty = null, unit = null, price = null;
  const bare = [];
  nums.forEach(n => {
    const u = n.cur ? null : unitAfter(n.i);
    if (u && qty === null) { qty = n.v; unit = u; }
    else if (n.cur && price === null) price = n.v;
    else if (!n.cur) bare.push(n);
  });
  const firstWordIdx = tokens.findIndex(t => t.t === 'w' && itemWords.includes(t));
  const firstItemWordIdx = firstWordIdx === -1 ? Infinity : firstWordIdx;

  if (qty === null && price === null) {
    if (bare.length >= 2) { qty = bare[0].v; price = bare[bare.length - 1].v; }
    else if (bare.length === 1) {
      const n = bare[0];
      const wordBefore = itemWords.length && firstItemWordIdx < n.i;
      const wordAfter = itemWords.length && firstItemWordIdx > n.i;
      if (wordAfter && !wordBefore && !hasTotalWord && n.v <= 30 && Number.isInteger(n.v) && !hasCue) qty = n.v;
      else price = n.v;
    }
  } else if (qty !== null && price === null) {
    if (bare.length) price = bare[0].v;
  } else if (qty === null && price !== null) {
    if (bare.length) qty = bare[0].v;
  }

  const name = itemWords.map(w => w.v).join(' ');
  if (!name && qty === null && price === null) return null;

  // A chunk with only an amount is the bill total
  if (!name && qty === null && price !== null) return { grand: true, total: round2(price) };

  const isUnitPrice = hasCue && price !== null;
  let total = null, unitPrice = null;
  if (price !== null) {
    if (isUnitPrice) { unitPrice = price; total = price * (qty ?? 1); }
    else { total = price; unitPrice = qty ? price / qty : price; }
  }
  return {
    name: name ? titleCase(name) : 'Item',
    qty: qty ?? (name ? 1 : null),
    unit: unit || '',
    price: unitPrice === null ? null : round2(unitPrice),
    total: total === null ? null : round2(total),
    unitCue: isUnitPrice
  };
}

function describeItems(items) {
  return items.map(it => {
    const q = it.qty && (it.qty !== 1 || it.unit) ? `${it.qty}${it.unit ? ' ' + it.unit : ''} ` : '';
    const p = it.price !== null && it.qty && it.qty !== 1 ? ` @ ${fmtMoney(it.price)}` : (it.total !== null && (!it.qty || it.qty === 1) ? ` ${fmtMoney(it.total)}` : '');
    return `${q}${it.name}${p}`.trim();
  }).join(', ');
}

function parseTransaction(text, options = {}) {
  const original = String(text || '').trim();
  if (!original) return { ok: false, error: 'Write what happened first, in any words you like.' };

  let norm = normalise(original);
  const dated = extractDate(norm);
  norm = dated.norm;

  const tokensAll = tokenize(norm);
  const who = pickCustomer(norm, original, tokensAll, options.customers);
  const customer = who.name;
  const nameWords = new Set(customer.toLowerCase().split(/\s+/).filter(Boolean));

  const method = paymentMethod(norm);
  let pay = extractPayments(norm);
  let remaining = null;
  const rem = extractRemaining(norm);
  if (rem) {
    const withRem = extractPayments(rem.rest);
    // "remaining" only means "still due after paying" when a payment is also mentioned
    if (withRem.payment > 0) { pay = withRem; remaining = rem.amount; }
  }
  const settleAll = pay.payment === 0 && wantsSettleAll(norm);

  // Credit side
  const creditTokens = tokenize(pay.rest);
  const segments = [[]];
  creditTokens.forEach(tok => {
    const sep = (tok.t === 's' && tok.v !== '@') || (tok.t === 'w' && SEPARATORS.has(tok.v)) || (tok.t === 's' && tok.v === '|');
    if (sep) { if (segments[segments.length - 1].length) segments.push([]); } else segments[segments.length - 1].push(tok);
  });
  // the " | " marker used where a payment phrase was cut out
  const parsed = [];
  segments.forEach(seg => { const r = seg.length ? parseSegment(seg.filter(t => !(t.t === 's' && t.v === '|')), nameWords) : null; if (r) parsed.push(r); });

  let items = parsed.filter(p => !p.grand);
  const grand = parsed.filter(p => p.grand).reduce((a, p) => a + p.total, 0);
  const priced = items.filter(i => i.total !== null);
  let credit = 0;
  const hints = [];

  if (grand > 0) {
    credit = round2(grand);
    if (priced.length) {
      const sum = round2(priced.reduce((a, i) => a + i.total, 0));
      if (sum !== credit) hints.push(`Item prices add up to ${fmtMoney(sum)}, but you said the total is ${fmtMoney(credit)} – using ${fmtMoney(credit)}.`);
    }
  } else if (priced.length === 1 && items.length >= 2 && !priced[0].unitCue) {
    credit = priced[0].total;
    items = items.map(i => ({ ...i, price: null, total: null }));
    hints.push('One amount for several items was treated as the bill total.');
  } else {
    credit = round2(priced.reduce((a, i) => a + i.total, 0));
  }

  if (remaining !== null) {
    const implied = round2(pay.payment + remaining);
    if (!credit && !items.length) {
      hints.push(`${fmtMoney(remaining)} is what should be left on the ledger after this payment.`);
    } else if (!credit) {
      credit = implied;
      hints.push(`Bill worked out as paid ${fmtMoney(pay.payment)} + remaining ${fmtMoney(remaining)} = ${fmtMoney(implied)}.`);
    } else if (credit !== implied) {
      hints.push(`You said ${fmtMoney(remaining)} remains, which doesn't match the bill (${fmtMoney(credit)} − ${fmtMoney(pay.payment)} = ${fmtMoney(round2(credit - pay.payment))}). Please check the amounts.`);
    }
  }
  // one item with no price but a known bill: the bill is that item's price
  if (items.length === 1 && items[0].total === null && credit > 0) {
    const it = items[0];
    items = [{ ...it, total: credit, price: round2(credit / (it.qty || 1)) }];
  }

  if (!customer) return { ok: false, error: 'Could not tell which customer this is. Add a name, e.g. “Ramesh took 2 kg sugar for 90”.' };
  if (!credit && items.length && !pay.payment) return { ok: false, error: `Found ${describeItems(items)} but no price. Add the price, e.g. “… for 90” or “… at 45 each”.` };
  if (!credit && !pay.payment && !settleAll) return { ok: false, error: 'Could not find an amount. Try “Ramesh paid 500” or “Ramesh took 2 kg sugar at 45”.' };

  const description = items.length ? describeItems(items) : '';
  return {
    ok: true,
    customer,
    customerKnown: !!who.known,
    remaining,
    items,
    credit,
    payment: pay.payment,
    settleAll,
    method,
    net: round2(credit - pay.payment),
    occurredAt: dated.when ? dated.when.toISOString() : null,
    description,
    hints,
    original
  };
}

module.exports = { parseTransaction, describeItems };
