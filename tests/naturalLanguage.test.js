const test = require('node:test');
const assert = require('node:assert/strict');
const { parseTransaction: parse, describeItems } = require('../services/naturalLanguage');

const ok = (text, known) => { const r = parse(text, known); assert.equal(r.ok, true, `${text} -> ${r.error}`); return r; };

test('classic credit + payment sentence', () => {
  const r = ok('Ramesh took notebooks for 240 and paid 100');
  assert.equal(r.customer, 'Ramesh'); assert.equal(r.credit, 240); assert.equal(r.payment, 100); assert.equal(r.net, 140);
  assert.equal(r.items[0].name, 'Notebooks');
});

test('several items with quantity, unit and rate', () => {
  const r = ok('Meena bought 2 kg sugar at 45 and 1 litre oil 130, paid 100');
  assert.deepEqual(r.items.map(i => [i.name, i.qty, i.unit, i.price, i.total]), [['Sugar', 2, 'kg', 45, 90], ['Oil', 1, 'L', 130, 130]]);
  assert.equal(r.credit, 220); assert.equal(r.payment, 100);
});

test('"each" multiplies quantity by rate', () => {
  const r = ok('ramesh took 3 notebooks at 40 each and 2 pens at ₹10');
  assert.equal(r.credit, 140); assert.equal(r.items[0].total, 120);
});

test('"x 35" after a quantity is a rate; "x2" alone is a quantity', () => {
  assert.equal(ok('Hari took 2 soaps x 35 and shampoo 120 paid 50').credit, 190);
  assert.equal(ok('Hari took soap x3 at 20').items[0].qty, 3);
});

test('amount-only phrasings', () => {
  assert.equal(ok('add 500 credit for Suresh').credit, 500);
  assert.equal(ok('Kumar udhaar 250').credit, 250);
  assert.equal(ok('Meena Devi took rice 5kg 300').customer, 'Meena Devi');
});

test('payment-only sentences', () => {
  const a = ok('received 300 from Anita'); assert.equal(a.credit, 0); assert.equal(a.payment, 300); assert.equal(a.customer, 'Anita');
  assert.equal(ok('Suresh paid 1,200 rupees').payment, 1200);
  assert.equal(ok('Hari took rice 200 paid 50').payment, 50);
});

test('settle-everything sentences are flagged for the server', () => {
  const r = ok('Priya cleared her dues'); assert.equal(r.settleAll, true);
});

test('currency styles and thousands separators', () => {
  assert.equal(ok('Asha took 1 dozen eggs for Rs. 84').credit, 84);
  assert.equal(ok('Asha took oil ₹ 1,250').credit, 1250);
  assert.equal(ok('Asha took flour 2k').credit, 2000);
});

test('one trailing price covers a group of items', () => {
  const r = ok('Ravi bought 2 pens and 3 notebooks for 500'); assert.equal(r.credit, 500); assert.equal(r.items.length, 2);
});

test('stated total that disagrees with items warns and uses the total', () => {
  const r = ok('Anil took biscuits 3 packets 10 each, total 35'); assert.equal(r.credit, 35); assert.ok(r.warnings.length);
});

test('existing customers are recognised, even by first name only', () => {
  assert.equal(ok('ramesh took 2 pens at 10', ['Ramesh Kumar', 'Suresh']).customer, 'Ramesh Kumar');
  assert.equal(ok('ramesh took 2 pens at 10', ['Ramesh Kumar', 'Ramesh Patel']).customer, 'Ramesh');
});

test('yesterday sets the date', () => { assert.ok(ok('yesterday Asha took eggs for 84').occurredAt); });

test('rejects unusable input with helpful messages', () => {
  assert.equal(parse('').ok, false);
  assert.equal(parse('took rice').ok, false);
  assert.match(parse('Kavi took 3 notebooks').error, /price/);
  assert.equal(parse('Ramesh took items for 200 and paid 250').ok, false);
  assert.equal(parse('x'.repeat(301)).ok, false);
});

test('describeItems makes a readable one-liner', () => {
  const r = ok('Meena bought 2 kg sugar at 45 and 1 litre oil 130');
  assert.equal(describeItems(r.items), '2 kg Sugar, 1 L Oil');
});
