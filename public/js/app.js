(() => {
  const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  function message(target, text, type = 'success') {
    if (!target) return;
    target.replaceChildren();
    const box = document.createElement('div');
    box.className = `alert alert-${type} py-2 mb-0`;
    box.textContent = text;
    target.appendChild(box);
  }

  async function readJson(response) {
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) throw new Error('The server returned an unexpected response. Please try again.');
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Something went wrong.');
    return body;
  }

  // Task 4: a small hash router keeps the two entry modes switchable without a page reload.
  const entryTabs = document.querySelectorAll('[data-entry-route]');
  const entryPanels = document.querySelectorAll('[data-entry-panel]');
  function setEntryRoute() {
    if (!entryTabs.length) return;
    const route = window.location.hash === '#natural' ? 'natural' : 'structured';
    entryTabs.forEach(tab => tab.classList.toggle('active', tab.dataset.entryRoute === route));
    entryPanels.forEach(panel => panel.classList.toggle('d-none', panel.dataset.entryPanel !== route));
  }
  entryTabs.forEach(tab => tab.addEventListener('click', () => setTimeout(setEntryRoute, 0)));
  window.addEventListener('hashchange', setEntryRoute);
  setEntryRoute();

  const password = document.querySelector('#password');
  const strengthBar = document.querySelector('#strengthBar');
  const strengthText = document.querySelector('#strengthText');
  if (password) {
    password.addEventListener('input', () => {
      const value = password.value;
      let score = 0;
      if (value.length >= 8) score++;
      if (/[A-Z]/.test(value)) score++;
      if (/[0-9]/.test(value)) score++;
      if (/[^A-Za-z0-9]/.test(value)) score++;
      const widths = [0, 25, 50, 75, 100];
      strengthBar.style.width = `${widths[score]}%`;
      strengthText.textContent = ['Use 8+ characters with a capital letter and number.', 'Weak', 'Fair', 'Good', 'Strong'][score];
      strengthBar.classList.toggle('is-strong', score >= 4);
    });
  }

  const registerForm = document.querySelector('#registerForm');
  if (registerForm) registerForm.addEventListener('submit', (event) => {
    const value = password?.value || '';
    if (value.length < 8 || !/[A-Z]/.test(value) || !/[0-9]/.test(value)) {
      event.preventDefault();
      message(document.querySelector('#registerAlert') || document.querySelector('#strengthText'), 'Use at least 8 characters, one capital letter and one number.', 'danger');
    }
  });

  const customerSearch = document.querySelector('#customerSearch');
  if (customerSearch) customerSearch.addEventListener('input', () => {
    const query = customerSearch.value.trim().toLowerCase();
    document.querySelectorAll('#customerRows tr').forEach(row => {
      row.hidden = !row.textContent.toLowerCase().includes(query);
    });
  });

  const txForm = document.querySelector('#transactionForm');
  if (txForm) txForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!txForm.reportValidity()) return;
    const amount = Number(txForm.elements.amount.value);
    if (!Number.isFinite(amount) || amount <= 0) return message(document.querySelector('#txMessage'), 'Enter an amount greater than ₹0.', 'danger');

    try {
      const body = await readJson(await fetch('/api/transactions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(txForm)))
      }));
      message(document.querySelector('#txMessage'), `Saved ${money(body.transaction.amount)} ${body.transaction.type === 'credit' ? 'credit' : 'payment'}.`);
      txForm.reset();
    } catch (error) { message(document.querySelector('#txMessage'), error.message, 'danger'); }
  });

  const customerForm = document.querySelector('#customerForm');
  if (customerForm) customerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!customerForm.reportValidity()) return;
    const name = customerForm.elements.name.value.trim();
    if (name.length < 2) return message(document.querySelector('#customerMessage'), 'Enter a customer name with at least 2 characters.', 'danger');

    try {
      const body = await readJson(await fetch('/api/customers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(customerForm)))
      }));
      message(document.querySelector('#customerMessage'), `${body.customer.name} was added. Refresh the entry list when you are ready to record a transaction.`);
      customerForm.reset();
    } catch (error) { message(document.querySelector('#customerMessage'), error.message, 'danger'); }
  });

  document.querySelectorAll('[data-example]').forEach(chip => chip.addEventListener('click', () => {
    const box = document.querySelector('#naturalText');
    if (box) { box.value = chip.dataset.example; box.focus(); }
  }));

  const naturalBox = document.querySelector('#naturalText');
  if (naturalBox) naturalBox.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) document.querySelector('#parseNatural').click();
  });

  const parseButton = document.querySelector('#parseNatural');
  if (parseButton) parseButton.addEventListener('click', async () => {
    const input = document.querySelector('#naturalText');
    const result = document.querySelector('#naturalResult');
    const text = input.value.trim();
    if (!text) return message(result, 'Write the transaction in one sentence first.', 'danger');

    result.replaceChildren();
    result.textContent = 'Reading entry…';
    try {
      const body = await readJson(await fetch('/api/natural-language/parse', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text })
      }));

      const card = document.createElement('div');
      card.className = 'parse-card';
      const title = document.createElement('strong');
      title.textContent = 'Review before saving';
      card.appendChild(title);

      // Customer (editable, in case the sentence was read wrongly)
      const nameWrap = document.createElement('label');
      nameWrap.className = 'parse-name';
      const nameLabel = document.createElement('small');
      nameLabel.textContent = body.existingCustomer ? 'Customer (existing)' : 'Customer (new – will be added)';
      const nameInput = document.createElement('input');
      nameInput.className = 'form-control form-control-sm';
      nameInput.value = body.customer; nameInput.maxLength = 80; nameInput.setAttribute('aria-label', 'Customer name');
      nameWrap.append(nameLabel, nameInput);
      card.appendChild(nameWrap);

      if (body.items && body.items.length) {
        const list = document.createElement('div');
        list.className = 'parse-items';
        body.items.forEach(item => {
          const row = document.createElement('div');
          row.className = 'parse-item';
          const left = document.createElement('span');
          const qty = item.qty && (item.qty !== 1 || item.unit) ? `${item.qty}${item.unit ? ' ' + item.unit : ''} × ` : '';
          left.textContent = `${qty}${item.name}`;
          const right = document.createElement('b');
          right.textContent = item.total === null ? '—' : money(item.total);
          if (item.price !== null && item.qty && item.qty !== 1) { const sm = document.createElement('small'); sm.textContent = `@ ${money(item.price)}`; left.appendChild(sm); }
          row.append(left, right); list.appendChild(row);
        });
        card.appendChild(list);
      }

      const grid = document.createElement('div');
      grid.className = 'parse-grid';
      const cells = [];
      if (body.credit > 0) cells.push(['Credit given', `+${money(body.credit)}`, 'text-credit']);
      if (body.payment > 0) cells.push(['Payment received', `\u2212${money(body.payment)}`, 'text-payment']);
      cells.push(['Net change', `${body.net < 0 ? '\u2212' : '+'}${money(Math.abs(body.net))}`, '']);
      if (body.occurredAt) cells.push(['Date', new Date(body.occurredAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), '']);
      cells.forEach(([label, value, cls]) => {
        const cell = document.createElement('div');
        const small = document.createElement('small'); small.textContent = label;
        const strong = document.createElement('strong'); strong.textContent = value; if (cls) strong.className = cls;
        cell.append(small, strong); grid.appendChild(cell);
      });
      card.appendChild(grid);

      (body.hints || []).forEach(h => { const p = document.createElement('p'); p.className = 'parse-hint'; p.textContent = h; card.appendChild(p); });

      const confirm = document.createElement('button');
      confirm.className = 'btn btn-primary btn-sm rounded-pill w-100';
      confirm.textContent = 'Confirm & save';
      confirm.addEventListener('click', async () => {
        confirm.disabled = true;
        try {
          const saved = await readJson(await fetch('/api/natural-language/save', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ draftId: body.draftId, customer: nameInput.value.trim() })
          }));
          result.replaceChildren();
          input.value = '';
          message(result, `Saved for ${saved.customer.name}. Open the customer ledger to see the full history.`);
        } catch (error) {
          confirm.disabled = false;
          message(result, error.message, 'danger');
        }
      });
      card.appendChild(confirm);
      result.replaceChildren(card);
    } catch (error) { message(result, error.message, 'danger'); }
  });

  // Edit / delete an entry on the customer ledger
  const txModalEl = document.querySelector('#txModal');
  if (txModalEl && window.bootstrap) {
    const modal = new bootstrap.Modal(txModalEl);
    const fType = document.querySelector('#txType'), fAmount = document.querySelector('#txAmount'), fNote = document.querySelector('#txNote'), fErr = document.querySelector('#txError');
    let editingId = null;
    document.querySelectorAll('.tx-edit').forEach(btn => btn.addEventListener('click', () => {
      editingId = btn.dataset.id; fType.value = btn.dataset.type; fAmount.value = btn.dataset.amount; fNote.value = btn.dataset.note || '';
      fErr.replaceChildren(); modal.show();
    }));
    document.querySelector('#txSave').addEventListener('click', async (event) => {
      const save = event.currentTarget; save.disabled = true;
      try {
        await readJson(await fetch(`/api/transactions/${editingId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: fType.value, amount: fAmount.value, description: fNote.value })
        }));
        window.location.reload();
      } catch (error) { save.disabled = false; message(fErr, error.message, 'danger'); }
    });
    document.querySelectorAll('.tx-delete').forEach(btn => btn.addEventListener('click', async () => {
      if (!window.confirm(`Delete this ₹${Number(btn.dataset.amount).toLocaleString('en-IN')} entry? This cannot be undone.`)) return;
      btn.disabled = true;
      try { await readJson(await fetch(`/api/transactions/${btn.dataset.id}`, { method: 'DELETE' })); window.location.reload(); }
      catch (error) { btn.disabled = false; window.alert(error.message); }
    }));
  }
})();
