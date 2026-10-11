(() => {
  const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  const $ = (sel, root = document) => root.querySelector(sel);

  function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([k, v]) => { if (k === 'class') node.className = v; else if (k === 'text') node.textContent = v; else node.setAttribute(k, v); });
    children.flat().forEach(c => c != null && node.append(c));
    return node;
  }

  function message(target, text, type = 'success') {
    if (!target) return;
    target.replaceChildren(el('div', { class: `msg msg-${type}`, role: type === 'danger' ? 'alert' : 'status', text }));
  }

  async function readJson(response) {
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) throw new Error(response.status === 401 ? 'Your session has ended. Please sign in again.' : 'The server returned an unexpected response. Please try again.');
    const body = await response.json();
    if (!response.ok) {
      if (response.status === 401) throw new Error('Your session has ended. Please sign in again.');
      throw new Error(body.error || 'Something went wrong.');
    }
    return body;
  }
  const postJson = (url, data, method = 'POST') => fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(readJson);

  function busy(button, text) {
    const original = button.textContent;
    button.disabled = true;
    button.replaceChildren(el('span', { class: 'spinner-dot', 'aria-hidden': 'true' }), text);
    return () => { button.disabled = false; button.textContent = original; };
  }

  // ---- Task 4: tiny hash router for the two entry modes (no page reload) -------------------------
  const tabs = document.querySelectorAll('[data-entry-route]');
  const panels = document.querySelectorAll('[data-entry-panel]');
  function setEntryRoute() {
    if (!tabs.length) return;
    const route = window.location.hash === '#structured' ? 'structured' : 'natural';
    tabs.forEach(t => { const on = t.dataset.entryRoute === route; t.classList.toggle('active', on); if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current'); });
    panels.forEach(p => p.classList.toggle('d-none', p.dataset.entryPanel !== route));
  }
  window.addEventListener('hashchange', setEntryRoute);
  setEntryRoute();

  // ---- Task 4: password strength + validation ----------------------------------------------------
  const password = $('#password');
  const strengthBar = $('#strengthBar');
  const strengthText = $('#strengthText');
  const rules = (v) => ({ length: v.length >= 8, upper: /[A-Z]/.test(v), digit: /[0-9]/.test(v) });
  if (password && strengthBar) {
    password.addEventListener('input', () => {
      const v = password.value;
      const r = rules(v);
      const score = [r.length, r.upper, r.digit, /[^A-Za-z0-9]/.test(v)].filter(Boolean).length;
      strengthBar.style.width = `${score * 25}%`;
      strengthBar.classList.toggle('is-strong', score >= 4);
      const missing = [!r.length && '8+ characters', !r.upper && 'a capital letter', !r.digit && 'a number'].filter(Boolean);
      strengthText.textContent = v ? (missing.length ? `Still needs ${missing.join(', ')}.` : (score === 4 ? 'Strong password.' : 'Good. Add a symbol to make it stronger.')) : 'At least 8 characters, with a capital letter and a number.';
    });
  }
  const registerForm = $('#registerForm');
  if (registerForm) registerForm.addEventListener('submit', (event) => {
    const f = registerForm.elements;
    const problem = !f.shopName.value.trim() || !f.ownerName.value.trim() ? 'Please enter your shop name and your name.'
      : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.value.trim()) ? 'Enter a valid email address.'
      : Object.values(rules(f.password.value)).includes(false) ? 'Use at least 8 characters, one capital letter and one number.' : '';
    if (problem) { event.preventDefault(); message($('#registerAlert'), problem, 'danger'); }
  });

  const search = $('#customerSearch');
  if (search) search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    document.querySelectorAll('#customerRows tr').forEach(row => { row.hidden = !row.textContent.toLowerCase().includes(q); });
  });

  // ---- Task 5: structured entry via the REST API -------------------------------------------------
  const txForm = $('#transactionForm');
  if (txForm) txForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const out = $('#txMessage');
    const amount = Number(txForm.elements.amount.value);
    if (!txForm.elements.customerId.value) return message(out, 'Choose a customer first.', 'danger');
    if (!Number.isFinite(amount) || amount <= 0) return message(out, 'Enter an amount greater than ₹0.', 'danger');
    const done = busy(txForm.querySelector('button'), 'Saving…');
    try {
      const body = await postJson('/api/transactions', Object.fromEntries(new FormData(txForm)));
      const name = txForm.elements.customerId.selectedOptions[0].textContent;
      message(out, `${body.transaction.type === 'credit' ? 'Credit' : 'Payment'} of ${money(body.transaction.amount)} saved for ${name}.`);
      txForm.reset();
    } catch (error) { message(out, error.message, 'danger'); }
    finally { done(); }
  });

  const customerForm = $('#customerForm');
  if (customerForm) customerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const out = $('#customerMessage');
    const name = customerForm.elements.name.value.trim();
    if (name.length < 2) return message(out, 'Enter a name with at least 2 characters.', 'danger');
    const done = busy(customerForm.querySelector('button'), 'Adding…');
    try {
      const { customer } = await postJson('/api/customers', { name, phone: customerForm.elements.phone.value });
      const select = $('#customerId');
      if (select) { select.append(el('option', { value: customer._id, text: customer.name })); select.value = customer._id; }
      message(out, `${customer.name} was added and is selected in the form.`);
      customerForm.reset();
    } catch (error) { message(out, error.message, 'danger'); }
    finally { done(); }
  });

  // ---- Natural-language entry --------------------------------------------------------------------
  const textarea = $('#naturalText');
  document.querySelectorAll('.example-chip').forEach(chip => chip.addEventListener('click', () => { textarea.value = chip.textContent; textarea.focus(); }));

  function renderPreview(body, result) {
    const head = el('h3', { text: 'Check this before saving' });
    const who = el('p', { class: 'who', text: `${body.customer} · ${body.knownCustomer ? 'existing customer' : 'new customer, will be added to your list'}` });
    const nodes = [head, who];

    if (body.items.length) {
      const rows = body.items.map(i => el('tr', {},
        el('td', { text: i.name }),
        el('td', { class: 'num', text: i.qty ? `${i.qty}${i.unit ? ' ' + i.unit : ''}` : '—' }),
        el('td', { class: 'num', text: i.price != null && i.qty !== 1 ? money(i.price) : '—' }),
        el('td', { class: 'num', text: i.total != null ? money(i.total) : '—' })));
      nodes.push(el('table', {},
        el('thead', {}, el('tr', {}, el('th', { text: 'Item' }), el('th', { class: 'num', text: 'Qty' }), el('th', { class: 'num', text: 'Rate' }), el('th', { class: 'num', text: 'Amount' }))),
        el('tbody', {}, rows)));
    }
    const foot = [];
    if (body.credit) foot.push(el('tr', {}, el('td', { text: 'Credit given' }), el('td', { class: 'num' }, el('span', { class: 'amt amt-credit', text: `+${money(body.credit)}` }))));
    if (body.payment) foot.push(el('tr', {}, el('td', { text: 'Payment received' }), el('td', { class: 'num' }, el('span', { class: 'amt amt-payment', text: `\u2212${money(body.payment)}` }))));
    if (body.credit && body.payment) foot.push(el('tr', {}, el('td', { text: 'Added to balance' }), el('td', { class: 'num', text: money(body.net) })));
    nodes.push(el('table', {}, el('tbody', {}, foot)));
    (body.warnings || []).forEach(w => nodes.push(el('div', { class: 'note', text: w })));

    const confirm = el('button', { type: 'button', class: 'btn btn-primary', text: 'Save entry' });
    const edit = el('button', { type: 'button', class: 'btn btn-quiet', text: 'Change sentence' });
    edit.addEventListener('click', () => { result.replaceChildren(); textarea.focus(); });
    confirm.addEventListener('click', async () => {
      const done = busy(confirm, 'Saving…');
      try {
        const saved = await postJson('/api/natural-language/save', { draftId: body.draftId });
        const link = el('a', { href: `/customers/${saved.customer._id}`, text: `Open ${saved.customer.name}’s ledger` });
        result.replaceChildren(el('div', { class: 'msg msg-success' }, `Saved. `, link, '.'));
        textarea.value = '';
      } catch (error) { done(); message(result, error.message, 'danger'); }
    });
    nodes.push(el('div', { class: 'actions' }, confirm, edit));
    result.replaceChildren(el('div', { class: 'preview' }, nodes));
    result.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  const parseButton = $('#parseNatural');
  if (parseButton) parseButton.addEventListener('click', async () => {
    const result = $('#naturalResult');
    const text = textarea.value.trim();
    if (!text) return message(result, 'Type the entry first, for example “Meena took 2 kg sugar at 45 and paid 50”.', 'danger');
    const done = busy(parseButton, 'Reading…');
    try { renderPreview(await postJson('/api/natural-language/parse', { text }), result); }
    catch (error) { message(result, error.message, 'danger'); }
    finally { done(); }
  });
  if (textarea) textarea.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') parseButton.click(); });

  // ---- Edit / delete on the customer ledger ------------------------------------------------------
  const modalEl = $('#txModal');
  if (modalEl && window.bootstrap) {
    const modal = new bootstrap.Modal(modalEl);
    const fType = $('#txType'), fAmount = $('#txAmount'), fNote = $('#txNote'), fErr = $('#txError');
    let editingId = null;
    document.querySelectorAll('.tx-edit').forEach(btn => btn.addEventListener('click', () => {
      editingId = btn.dataset.id; fType.value = btn.dataset.type; fAmount.value = btn.dataset.amount; fNote.value = btn.dataset.note || '';
      fErr.replaceChildren(); modal.show();
    }));
    $('#txSave').addEventListener('click', async (event) => {
      const save = event.currentTarget;
      const amount = Number(fAmount.value);
      if (!Number.isFinite(amount) || amount <= 0) return message(fErr, 'Enter an amount greater than ₹0.', 'danger');
      const done = busy(save, 'Saving…');
      try { await postJson(`/api/transactions/${editingId}`, { type: fType.value, amount: fAmount.value, description: fNote.value }, 'PUT'); window.location.reload(); }
      catch (error) { done(); message(fErr, error.message, 'danger'); }
    });
    document.querySelectorAll('.tx-delete').forEach(btn => btn.addEventListener('click', async () => {
      if (!window.confirm(`Delete this ${money(btn.dataset.amount)} entry? This cannot be undone.`)) return;
      btn.disabled = true;
      try { await readJson(await fetch(`/api/transactions/${btn.dataset.id}`, { method: 'DELETE' })); window.location.reload(); }
      catch (error) { btn.disabled = false; window.alert(error.message); }
    }));
  }
})();
