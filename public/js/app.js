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
      message(document.querySelector('#strengthText').parentElement, 'Use at least 8 characters, one capital letter and one number.', 'danger');
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

      const grid = document.createElement('div');
      grid.className = 'parse-grid';
      [['Customer', body.customer], ['Credit', money(body.credit)], ['Payment', money(body.payment)], ['Net outstanding', money(body.net)]].forEach(([label, value]) => {
        const cell = document.createElement('div');
        const small = document.createElement('small'); small.textContent = label;
        const strong = document.createElement('strong'); strong.textContent = value;
        cell.append(small, strong); grid.appendChild(cell);
      });
      card.appendChild(grid);

      const confirm = document.createElement('button');
      confirm.className = 'btn btn-primary btn-sm rounded-pill w-100';
      confirm.textContent = 'Confirm & save';
      confirm.addEventListener('click', async () => {
        confirm.disabled = true;
        try {
          const saved = await readJson(await fetch('/api/natural-language/save', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ draftId: body.draftId })
          }));
          result.replaceChildren();
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
})();
