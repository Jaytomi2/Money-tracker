// ==========================================================
// Simple Money Tracker - Application Logic
// ==========================================================

(function () {
  'use strict';

  // --- Storage Key ---
  const STORAGE_KEY = 'money_tracker_data_v1';

  // --- State ---
  let transactions = [];
  let currentEditId = null;
  let activeFilter = 'all'; // 'all' | 'Income' | 'Expense'
  let searchQuery = '';

  // --- DOM Elements ---
  const headerCountEl = document.getElementById('header-transaction-count');
  const totalBalanceEl = document.getElementById('total-balance');
  const totalIncomeEl = document.getElementById('total-income');
  const totalExpenseEl = document.getElementById('total-expense');

  const form = document.getElementById('transaction-form');
  const formTitle = document.getElementById('form-title');
  const formModeIndicator = document.getElementById('form-mode-indicator');
  const editIdInput = document.getElementById('edit-id');
  const nameInput = document.getElementById('transaction-name');
  const amountInput = document.getElementById('transaction-amount');
  const typeRadios = document.querySelectorAll('input[name="transaction-type"]');
  const submitBtn = document.getElementById('submit-btn');
  const cancelBtn = document.getElementById('cancel-btn');
  const nameError = document.getElementById('name-error');
  const amountError = document.getElementById('amount-error');

  const searchInput = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('clear-search-btn');
  const filterTabs = document.querySelectorAll('.filter-tab');
  const transactionListEl = document.getElementById('transaction-list');
  const visibleCountBadge = document.getElementById('visible-count-badge');

  const emptyStateEl = document.getElementById('empty-state');
  const emptyIconEl = document.getElementById('empty-icon');
  const emptyTitleEl = document.getElementById('empty-title');
  const emptyMessageEl = document.getElementById('empty-message');
  const emptyActionBtn = document.getElementById('empty-action-btn');

  // --- Currency Helpers (Nigerian Naira ₦) ---
  function formatCurrency(amount) {
    const num = Math.abs(Number(amount) || 0);
    const formatted = num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return '₦' + formatted;
  }

  function formatBalance(amount) {
    const num = Number(amount) || 0;
    const formatted = Math.abs(num).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return (num < 0 ? '-₦' : '₦') + formatted;
  }

  // --- Amount Input Helpers (Commas as Thousand Separators) ---
  function formatAmountValue(val) {
    if (val === null || val === undefined || val === '') return '';
    let clean = val.toString().replace(/,/g, '').replace(/[^0-9.]/g, '');
    const dotIndex = clean.indexOf('.');
    let integerPart = dotIndex !== -1 ? clean.slice(0, dotIndex) : clean;
    let decimalPart = dotIndex !== -1 ? clean.slice(dotIndex + 1).replace(/\./g, '').slice(0, 2) : null;

    if (integerPart.length > 1 && integerPart.startsWith('0')) {
      integerPart = integerPart.replace(/^0+/, '') || '0';
    }

    const formattedInt = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    if (dotIndex !== -1) {
      return (formattedInt === '' ? '0' : formattedInt) + '.' + decimalPart;
    }
    return formattedInt;
  }

  function parseNumericAmount(val) {
    if (typeof val === 'number') return val;
    if (!val) return NaN;
    const clean = val.toString().replace(/,/g, '').trim();
    return parseFloat(clean);
  }

  // --- Local Storage Helpers ---
  function loadTransactions() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          transactions = parsed;
        }
      }
    } catch (err) {
      console.error('Failed to load transactions from localStorage:', err);
      transactions = [];
    }
  }

  function saveTransactions() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    } catch (err) {
      console.error('Failed to save transactions to localStorage:', err);
    }
  }

  // --- Calculations & Stats ---
  function updateSummary() {
    // Total count at the top header
    headerCountEl.textContent = transactions.length;

    let incomeTotal = 0;
    let expenseTotal = 0;

    transactions.forEach(t => {
      const amt = parseFloat(t.amount) || 0;
      if (t.type === 'Income') {
        incomeTotal += amt;
      } else {
        expenseTotal += amt;
      }
    });

    const balance = incomeTotal - expenseTotal;

    totalBalanceEl.textContent = formatBalance(balance);
    if (balance < 0) {
      totalBalanceEl.classList.add('expense-text');
      totalBalanceEl.classList.remove('income-text');
    } else if (balance > 0) {
      totalBalanceEl.classList.add('income-text');
      totalBalanceEl.classList.remove('expense-text');
    } else {
      totalBalanceEl.classList.remove('income-text', 'expense-text');
    }

    totalIncomeEl.textContent = '+' + formatCurrency(incomeTotal);
    totalExpenseEl.textContent = '-' + formatCurrency(expenseTotal);
  }

  // --- Filtering & Searching ---
  function getFilteredTransactions() {
    return transactions.filter(t => {
      // Type filter
      if (activeFilter !== 'all' && t.type !== activeFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim() !== '') {
        const query = searchQuery.trim().toLowerCase();
        const nameMatch = t.name.toLowerCase().includes(query);
        const amountClean = t.amount.toString();
        const formattedAmount = formatCurrency(t.amount).toLowerCase();
        const amountMatch = amountClean.includes(query.replace(/,/g, '')) || formattedAmount.includes(query);
        const typeMatch = t.type.toLowerCase().includes(query);
        return nameMatch || amountMatch || typeMatch;
      }

      return true;
    });
  }

  // --- Render Transaction List ---
  function renderList() {
    const filtered = getFilteredTransactions();

    // Update visible counter
    if (transactions.length === 0) {
      visibleCountBadge.textContent = '0 items';
    } else if (filtered.length === transactions.length) {
      visibleCountBadge.textContent = `${transactions.length} ${transactions.length === 1 ? 'item' : 'items'}`;
    } else {
      visibleCountBadge.textContent = `${filtered.length} of ${transactions.length}`;
    }

    // Handle Empty States
    if (filtered.length === 0) {
      transactionListEl.innerHTML = '';
      emptyStateEl.style.display = 'flex';

      if (transactions.length === 0) {
        emptyIconEl.textContent = '🌱';
        emptyTitleEl.textContent = 'No transactions yet';
        emptyMessageEl.textContent = 'Your list is empty. Add your first transaction above to start tracking your money!';
        emptyActionBtn.style.display = 'none';
      } else {
        emptyIconEl.textContent = '🔍';
        emptyTitleEl.textContent = 'No matching transactions';
        emptyMessageEl.textContent = `No results found for your current search or filter.`;
        emptyActionBtn.style.display = 'inline-block';
      }
      return;
    }

    emptyStateEl.style.display = 'none';

    // Build List Items HTML
    transactionListEl.innerHTML = filtered.map(t => {
      const isIncome = t.type === 'Income';
      const formattedAmount = (isIncome ? '+' : '-') + formatCurrency(t.amount);
      const isCurrentlyEditing = t.id === currentEditId;

      return `
        <li class="transaction-item ${isIncome ? 'type-income' : 'type-expense'} ${isCurrentlyEditing ? 'editing' : ''}" data-id="${t.id}">
          <div class="item-left">
            <span class="item-name" title="${escapeHtml(t.name)}">${escapeHtml(t.name)}</span>
            <span class="item-badge">${escapeHtml(t.type)}</span>
          </div>
          <div class="item-right">
            <span class="item-amount ${isIncome ? 'income' : 'expense'}">${formattedAmount}</span>
            <div class="item-actions">
              <button 
                type="button" 
                class="action-btn edit-btn" 
                title="Edit transaction" 
                aria-label="Edit ${escapeHtml(t.name)}"
                data-action="edit" 
                data-id="${t.id}"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              <button 
                type="button" 
                class="action-btn delete-btn" 
                title="Delete transaction" 
                aria-label="Delete ${escapeHtml(t.name)}"
                data-action="delete" 
                data-id="${t.id}"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
              </button>
            </div>
          </div>
        </li>
      `;
    }).join('');
  }

  function renderAll() {
    updateSummary();
    renderList();
  }

  // --- Form Validation & Submission ---
  function validateForm() {
    let isValid = true;

    const nameVal = nameInput.value.trim();
    if (!nameVal) {
      nameInput.classList.add('has-error');
      nameError.classList.add('visible');
      isValid = false;
    } else {
      nameInput.classList.remove('has-error');
      nameError.classList.remove('visible');
    }

    const amountVal = parseNumericAmount(amountInput.value);
    if (isNaN(amountVal) || amountVal <= 0) {
      amountInput.classList.add('has-error');
      amountError.classList.add('visible');
      isValid = false;
    } else {
      amountInput.classList.remove('has-error');
      amountError.classList.remove('visible');
    }

    return isValid;
  }

  function getSelectedType() {
    for (const radio of typeRadios) {
      if (radio.checked) return radio.value;
    }
    return 'Income';
  }

  function setSelectedType(type) {
    typeRadios.forEach(radio => {
      radio.checked = (radio.value === type);
    });
  }

  function resetForm() {
    form.reset();
    editIdInput.value = '';
    currentEditId = null;
    formTitle.textContent = 'Add New Transaction';
    formModeIndicator.style.display = 'none';
    submitBtn.textContent = 'Add Transaction';
    cancelBtn.style.display = 'none';
    nameInput.classList.remove('has-error');
    nameError.classList.remove('visible');
    amountInput.classList.remove('has-error');
    amountError.classList.remove('visible');
    setSelectedType('Income');
  }

  function handleFormSubmit(e) {
    e.preventDefault();

    if (!validateForm()) return;

    const name = nameInput.value.trim();
    const amount = parseFloat(parseNumericAmount(amountInput.value).toFixed(2));
    const type = getSelectedType();

    if (currentEditId) {
      // Editing existing transaction
      const index = transactions.findIndex(t => t.id === currentEditId);
      if (index !== -1) {
        transactions[index] = {
          ...transactions[index],
          name,
          amount,
          type,
          updatedAt: Date.now()
        };
      }
    } else {
      // Adding new transaction
      const newTransaction = {
        id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        name,
        amount,
        type,
        createdAt: Date.now()
      };
      // Add to front of the list
      transactions.unshift(newTransaction);
    }

    saveTransactions();
    resetForm();
    renderAll();
  }

  // --- Edit Transaction ---
  function startEditing(id) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    currentEditId = id;
    editIdInput.value = tx.id;
    nameInput.value = tx.name;
    amountInput.value = formatAmountValue(tx.amount.toString());
    setSelectedType(tx.type);

    formTitle.textContent = 'Edit Transaction';
    formModeIndicator.style.display = 'inline-block';
    submitBtn.textContent = 'Save Changes';
    cancelBtn.style.display = 'inline-block';

    nameInput.classList.remove('has-error');
    nameError.classList.remove('visible');
    amountInput.classList.remove('has-error');
    amountError.classList.remove('visible');

    // Scroll up smoothly to form
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    nameInput.focus();

    renderList();
  }

  function cancelEditing() {
    resetForm();
    renderList();
  }

  // --- Delete Transaction ---
  function deleteTransaction(id) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    // Confirm deletion first
    const confirmed = window.confirm(`Are you sure you want to delete "${tx.name}" (${formatCurrency(tx.amount)})?`);
    if (!confirmed) return;

    transactions = transactions.filter(t => t.id !== id);
    saveTransactions();

    if (currentEditId === id) {
      resetForm();
    }

    renderAll();
  }

  // --- Event Delegations & Listeners ---
  function setupEventListeners() {
    // Form submit
    form.addEventListener('submit', handleFormSubmit);

    // Cancel edit button
    cancelBtn.addEventListener('click', cancelEditing);

    // Clear form error states as user types
    nameInput.addEventListener('input', () => {
      if (nameInput.value.trim()) {
        nameInput.classList.remove('has-error');
        nameError.classList.remove('visible');
      }
    });

    // Automatically format amount with commas as thousand separators while typing
    amountInput.addEventListener('input', () => {
      const originalValue = amountInput.value;
      const cursor = amountInput.selectionStart;

      const nonCommaBefore = originalValue.slice(0, cursor).replace(/,/g, '').length;
      const formatted = formatAmountValue(originalValue);
      amountInput.value = formatted;

      let newCursor = 0;
      let nonCommaCount = 0;
      while (newCursor < formatted.length && nonCommaCount < nonCommaBefore) {
        if (formatted[newCursor] !== ',') {
          nonCommaCount++;
        }
        newCursor++;
      }
      amountInput.setSelectionRange(newCursor, newCursor);

      const val = parseNumericAmount(formatted);
      if (!isNaN(val) && val > 0) {
        amountInput.classList.remove('has-error');
        amountError.classList.remove('visible');
      }
    });

    // Handle Backspace when cursor is immediately after a comma
    amountInput.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && amountInput.selectionStart === amountInput.selectionEnd) {
        const pos = amountInput.selectionStart;
        if (pos > 0 && amountInput.value[pos - 1] === ',') {
          e.preventDefault();
          const before = amountInput.value.slice(0, pos - 2);
          const after = amountInput.value.slice(pos);
          const updated = before + after;
          const nonCommaBefore = before.replace(/,/g, '').length;
          const formatted = formatAmountValue(updated);
          amountInput.value = formatted;

          let newCursor = 0;
          let nonCommaCount = 0;
          while (newCursor < formatted.length && nonCommaCount < nonCommaBefore) {
            if (formatted[newCursor] !== ',') {
              nonCommaCount++;
            }
            newCursor++;
          }
          amountInput.setSelectionRange(newCursor, newCursor);
        }
      }
    });

    // Transaction list action delegation (Edit & Delete)
    transactionListEl.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const id = btn.dataset.id;

      if (action === 'edit') {
        startEditing(id);
      } else if (action === 'delete') {
        deleteTransaction(id);
      }
    });

    // Search input
    searchInput.addEventListener('input', () => {
      searchQuery = searchInput.value;
      clearSearchBtn.style.display = searchQuery.length > 0 ? 'block' : 'none';
      renderList();
    });

    // Clear search button
    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      clearSearchBtn.style.display = 'none';
      searchInput.focus();
      renderList();
    });

    // Filter tabs
    filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        filterTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        activeFilter = tab.dataset.filter;
        renderList();
      });
    });

    // Action button in empty search state
    emptyActionBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      clearSearchBtn.style.display = 'none';
      activeFilter = 'all';
      filterTabs.forEach(t => {
        t.classList.toggle('active', t.dataset.filter === 'all');
      });
      renderList();
    });

    // Keyboard accessibility: Escape clears search or cancels edit
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (currentEditId) {
          cancelEditing();
        } else if (searchQuery) {
          searchInput.value = '';
          searchQuery = '';
          clearSearchBtn.style.display = 'none';
          renderList();
        }
      }
    });
  }

  // --- Helper: Escape HTML to prevent XSS ---
  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- Initialize App ---
  function init() {
    loadTransactions();
    setupEventListeners();
    renderAll();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

