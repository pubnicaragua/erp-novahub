(() => {
  const valueDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  const monthNames = Array.from({ length: 12 }, (_, month) =>
    new Intl.DateTimeFormat('es', { month: 'long' }).format(new Date(2020, month, 1))
  );
  const weekDays = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];
  const pad = value => String(value).padStart(2, '0');
  const toISO = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const parseISO = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '')
    ? new Date(`${value}T12:00:00`)
    : null;
  const formatValue = value => {
    const date = parseISO(value);
    return date ? `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}` : '';
  };
  const monthStart = (year, month) => toISO(new Date(year, month, 1));
  const monthEnd = (year, month) => toISO(new Date(year, month + 1, 0));

  function enhance(input) {
    if (input.dataset.novaDatePicker === 'ready') return;
    input.dataset.novaDatePicker = 'ready';
    const oldLabels = Array.from(input.labels || []);
    const label = oldLabels.map(item => item.textContent.trim()).filter(Boolean).join(' · ')
      || (input.previousElementSibling?.tagName === 'LABEL' ? input.previousElementSibling.textContent.trim() : '')
      || 'Seleccionar fecha';
    const wrapper = document.createElement('div');
    wrapper.className = 'nova-date-picker';
    input.before(wrapper);
    wrapper.append(input);
    input.classList.add('nova-date-source');
    input.tabIndex = -1;
    input.setAttribute('aria-hidden', 'true');

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'nova-date-trigger';
    button.id = input.id ? `${input.id}-calendar-trigger` : `nova-date-trigger-${Math.random().toString(36).slice(2)}`;
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', label);
    button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg><span class="nova-date-trigger-label"></span>';
    wrapper.append(button);
    oldLabels.forEach(item => { item.htmlFor = button.id; });

    const popover = document.createElement('div');
    popover.className = 'nova-date-calendar';
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', `Calendario: ${label}`);
    popover.id = `${button.id}-calendar`;
    button.setAttribute('aria-controls', popover.id);
    popover.hidden = true;
    wrapper.dataset.calendarId = popover.id;
    document.body.append(popover);

    let viewDate = parseISO(input.value) || new Date();
    let view = 'days';
    const triggerLabel = button.querySelector('.nova-date-trigger-label');

    const isDateAllowed = value => (!input.min || value >= input.min) && (!input.max || value <= input.max);
    const isMonthAllowed = (year, month) => {
      const normalized = new Date(year, month, 1);
      const start = monthStart(normalized.getFullYear(), normalized.getMonth());
      const end = monthEnd(normalized.getFullYear(), normalized.getMonth());
      return (!input.min || end >= input.min) && (!input.max || start <= input.max);
    };
    const isYearAllowed = year => year >= 1000 && year <= 9999
      && Array.from({ length: 12 }, (_, month) => isMonthAllowed(year, month)).some(Boolean);

    const refreshTrigger = () => {
      triggerLabel.textContent = formatValue(input.value) || 'Seleccione fecha';
      button.setAttribute('aria-label', `${label}: ${formatValue(input.value) || 'sin fecha'}`);
      button.disabled = input.disabled;
    };
    Object.defineProperty(input, 'value', {
      configurable: true,
      enumerable: valueDescriptor.enumerable,
      get() { return valueDescriptor.get.call(input); },
      set(value) { valueDescriptor.set.call(input, value); refreshTrigger(); },
    });
    refreshTrigger();

    function render() {
      const year = viewDate.getFullYear();
      const month = viewDate.getMonth();
      const decade = Math.floor(year / 10) * 10;
      if (view === 'years') {
        const start = decade - 1;
        const years = Array.from({ length: 12 }, (_, index) => start + index);
        const hasDecade = anchor => Array.from({ length: 12 }, (_, index) => Math.floor(anchor / 10) * 10 - 1 + index).some(isYearAllowed);
        popover.innerHTML = `<div class="nova-date-calendar-header"><button class="nova-date-nav" type="button" data-action="back-months" aria-label="Volver a seleccionar mes">‹</button><div style="display:flex;align-items:center;gap:3px"><button class="nova-date-nav" type="button" data-action="prev-decade" aria-label="Década anterior" ${hasDecade(year - 10) ? '' : 'disabled'}>‹</button><span class="nova-date-calendar-heading" aria-live="polite">${decade}–${decade + 9}</span><button class="nova-date-nav" type="button" data-action="next-decade" aria-label="Década siguiente" ${hasDecade(year + 10) ? '' : 'disabled'}>›</button></div></div><div class="nova-date-calendar-years" role="group" aria-label="Seleccionar año">${years.map(item => `<button type="button" class="nova-date-calendar-cell ${item === year ? 'is-selected' : ''}" data-action="select-year" data-year="${item}" ${isYearAllowed(item) ? '' : 'disabled'}>${item}</button>`).join('')}</div>`;
        return;
      }

      if (view === 'months') {
        popover.innerHTML = `<div class="nova-date-calendar-header"><button class="nova-date-nav" type="button" data-action="back-days" aria-label="Volver al calendario">‹</button><button class="nova-date-calendar-heading" type="button" data-action="to-years" aria-label="Elegir año, actualmente ${year}">${year}</button><span class="nova-date-nav" aria-hidden="true"></span></div><div class="nova-date-calendar-months" role="group" aria-label="Seleccionar mes">${monthNames.map((name, index) => `<button type="button" class="nova-date-calendar-cell ${index === month ? 'is-selected' : ''}" data-action="select-month" data-month="${index}" ${isMonthAllowed(year, index) ? '' : 'disabled'}>${name}</button>`).join('')}</div>`;
        return;
      }

      const first = new Date(year, month, 1);
      const offset = (first.getDay() + 6) % 7;
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const total = Math.ceil((offset + daysInMonth) / 7) * 7;
      const today = toISO(new Date());
      const cells = Array.from({ length: total }, (_, index) => {
        const date = new Date(year, month, index - offset + 1, 12, 0, 0);
        const iso = toISO(date);
        const isCurrent = date.getMonth() === month;
        const classes = ['nova-date-calendar-cell'];
        if (!isCurrent) classes.push('is-outside');
        if (iso === today) classes.push('is-today');
        if (iso === input.value) classes.push('is-selected');
        const disabled = !isDateAllowed(iso);
        return `<button type="button" class="${classes.join(' ')}" data-action="select-day" data-date="${iso}" aria-label="${date.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}" ${disabled ? 'disabled' : ''}>${date.getDate()}</button>`;
      }).join('');
      const previousMonth = isMonthAllowed(year, month - 1);
      const nextMonth = isMonthAllowed(year, month + 1);
      const title = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(viewDate);
      popover.innerHTML = `<div class="nova-date-calendar-header"><button class="nova-date-nav" type="button" data-action="prev-month" aria-label="Mes anterior" ${previousMonth ? '' : 'disabled'}>‹</button><button class="nova-date-calendar-heading" type="button" data-action="to-months" aria-label="Elegir mes y año, actualmente ${title}">${title}</button><button class="nova-date-nav" type="button" data-action="next-month" aria-label="Mes siguiente" ${nextMonth ? '' : 'disabled'}>›</button></div><div class="nova-date-calendar-weekdays">${weekDays.map(day => `<span>${day}</span>`).join('')}</div><div class="nova-date-calendar-grid">${cells}</div>`;
    }

    function setOpen(open) {
      if (open) {
        document.querySelectorAll('.nova-date-picker[data-open="true"]').forEach(item => {
          if (item !== wrapper) {
            document.getElementById(item.dataset.calendarId).hidden = true;
            item.dataset.open = 'false';
            item.querySelector('.nova-date-trigger').setAttribute('aria-expanded', 'false');
          }
        });
        viewDate = parseISO(input.value) || new Date();
        view = 'days';
        render();
      }
      popover.hidden = !open;
      wrapper.dataset.open = open ? 'true' : 'false';
      button.setAttribute('aria-expanded', String(open));
      if (open) {
        const rect = button.getBoundingClientRect();
        const panel = popover.getBoundingClientRect();
        const left = Math.max(12, Math.min(rect.left, window.innerWidth - panel.width - 12));
        const spaceBelow = window.innerHeight - rect.bottom - 8;
        const top = spaceBelow >= panel.height
          ? rect.bottom + 5
          : rect.top - panel.height - 5 >= 8
            ? rect.top - panel.height - 5
            : Math.max(8, window.innerHeight - panel.height - 8);
        popover.style.left = `${left}px`;
        popover.style.top = `${top}px`;
      }
    }

    button.addEventListener('click', () => setOpen(popover.hidden));
    popover.addEventListener('click', event => {
      const control = event.target.closest('button[data-action]');
      if (!control || control.disabled) return;
      const action = control.dataset.action;
      if (action === 'prev-month') viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
      else if (action === 'next-month') viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
      else if (action === 'to-months') view = 'months';
      else if (action === 'to-years') view = 'years';
      else if (action === 'back-days') view = 'days';
      else if (action === 'back-months') view = 'months';
      else if (action === 'prev-decade') viewDate = new Date(viewDate.getFullYear() - 10, viewDate.getMonth(), 1);
      else if (action === 'next-decade') viewDate = new Date(viewDate.getFullYear() + 10, viewDate.getMonth(), 1);
      else if (action === 'select-year') {
        viewDate = new Date(Number(control.dataset.year), viewDate.getMonth(), 1);
        view = 'months';
      } else if (action === 'select-month') {
        viewDate = new Date(viewDate.getFullYear(), Number(control.dataset.month), 1);
        view = 'days';
      } else if (action === 'select-day') {
        input.value = control.dataset.date;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        setOpen(false);
        button.focus();
        return;
      }
      render();
    });

    input.addEventListener('change', refreshTrigger);
    const stateObserver = new MutationObserver(refreshTrigger);
    stateObserver.observe(input, { attributes: true, attributeFilter: ['disabled', 'min', 'max'] });
  }

  const scan = root => {
    if (root.matches?.('input[type="date"]')) enhance(root);
    root.querySelectorAll?.('input[type="date"]').forEach(enhance);
  };
  scan(document);
  const observer = new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
    if (node.nodeType === Node.ELEMENT_NODE) scan(node);
  })));
  [document.getElementById('historyView'), document.getElementById('map')].filter(Boolean).forEach(root => {
    observer.observe(root, { childList: true, subtree: true });
  });
  document.addEventListener('pointerdown', event => {
    document.querySelectorAll('.nova-date-picker[data-open="true"]').forEach(wrapper => {
      const popover = document.getElementById(wrapper.dataset.calendarId);
      if (!wrapper.contains(event.target) && !popover.contains(event.target)) {
        popover.hidden = true;
        wrapper.dataset.open = 'false';
        wrapper.querySelector('.nova-date-trigger').setAttribute('aria-expanded', 'false');
      }
    });
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const wrapper = document.querySelector('.nova-date-picker[data-open="true"]');
    if (!wrapper) return;
    document.getElementById(wrapper.dataset.calendarId).hidden = true;
    wrapper.dataset.open = 'false';
    wrapper.querySelector('.nova-date-trigger').setAttribute('aria-expanded', 'false');
    wrapper.querySelector('.nova-date-trigger').focus();
  });
  document.addEventListener('scroll', event => {
    const wrapper = document.querySelector('.nova-date-picker[data-open="true"]');
    if (!wrapper) return;
    const popover = document.getElementById(wrapper.dataset.calendarId);
    if (event.target !== popover && !popover.contains(event.target)) {
      popover.hidden = true;
      wrapper.dataset.open = 'false';
      wrapper.querySelector('.nova-date-trigger').setAttribute('aria-expanded', 'false');
    }
  }, true);
})();
