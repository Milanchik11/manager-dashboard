const API_URL = 'https://script.google.com/macros/s/AKfycbypl0EGBPezKJunQ5L1rOW6yxaYoFp06wdUlbCzdnOpyi3IUgsel6fTRvlZFp5Hb8j62A/exec';

const REFRESH_MS = 300000;

let data = [];
let summaries = [];
let monthly = [];
let charts = [];

const fmt = n =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })
    .format(Number(n) || 0) + ' ₽';

function monthSort(a, b) {
  const names = [
    'январ', 'феврал', 'март', 'апрел', 'май',
    'июн', 'июл', 'август', 'сентябр',
    'октябр', 'ноябр', 'декабр'
  ];

  const idx = s => {
    let p = String(s).split(' ');
    return Number(p[1] || 0) * 12 +
      Math.max(0, names.findIndex(n =>
        p[0]?.toLowerCase().startsWith(n)
      ));
  };

  return idx(a) - idx(b);
}

function updateFilters() {
  const es = [...new Set(
    data.map(x => x.employee).filter(x => x && x !== 'Анна')
  )].sort((a, b) => a.localeCompare(b, 'ru'));

  const ms = [...new Set(
    data.map(x => x.month).filter(Boolean)
  )].sort(monthSort);

  let e = document.getElementById('emp');
  let m = document.getElementById('month');

  let oe = e.value;
  let om = m.value;

  e.innerHTML = '<option value="all">Все сотрудники</option>' +
    es.map(x => `<option value="${x}">${x}</option>`).join('');

  m.innerHTML = '<option value="all">Все месяцы</option>' +
    ms.map(x => `<option value="${x}">${x}</option>`).join('');

  if (es.includes(oe)) e.value = oe;
  if (ms.includes(om)) m.value = om;
}

function current() {
  const e = document.getElementById('emp').value;
  const m = document.getElementById('month').value;
  const q = document.getElementById('search').value.toLowerCase();

  return data.filter(x =>
    (e === 'all' || x.employee === e) &&
    (m === 'all' || x.month === m) &&
    (!q || [x.id, x.type, x.status, x.category]
      .some(v => String(v || '').toLowerCase().includes(q)))
  );
}

function total(arr) {
  return arr.reduce((a, x) => a + (Number(x.amount) || 0), 0);
}

function by(arr, key) {
  let o = {};
  arr.forEach(x => o[x[key]] = (o[x[key]] || 0) + (Number(x.amount) || 0));
  return o;
}

function periodSummary(employee, month, category) {
  return summaries.filter(s =>
    s.employee === employee &&
    s.category === category &&
    (!month || month === 'all' || s.month === month)
  );
}

function sumSummaryForEmployee(emp, selectedMonth, cat) {
  if (selectedMonth === 'all') {
    return total(data.filter(x => x.employee === emp && x.category === cat));
  }

  let ss = periodSummary(emp, selectedMonth, cat);

  if (ss.length) return total(ss);

  return total(data.filter(x =>
    x.employee === emp &&
    x.month === selectedMonth &&
    x.category === cat
  ));
}

function sumCategory(arr, category) {
  const e = document.getElementById('emp').value;
  const m = document.getElementById('month').value;

  // При выбранном месяце используем сводные суммы по каждому сотруднику.
  // Это важно, когда "Все сотрудники" выбраны: summaries складываются,
  // а не заменяются суммой подробных строк.
  if (m !== 'all') {
    const employees = e === 'all'
      ? [...new Set(data.map(x => x.employee).filter(Boolean))]
      : [e];

    let result = 0;

    employees.forEach(emp => {
      const ss = periodSummary(emp, m, category);

      if (ss.length) {
        result += total(ss);
      } else {
        result += total(data.filter(x =>
          x.employee === emp &&
          x.month === m &&
          x.category === category
        ));
      }
    });

    return result;
  }

  // При выборе всех месяцев оставляем подсчет по подробным данным.
  return total(arr.filter(x => x.category === category));
}

function destroyCharts() {
  charts.forEach(c => c.destroy());
  charts = [];
}

function chartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: '#b9c6df' }
      }
    },
    scales: {
      x: {
        ticks: { color: '#aebbd4' },
        grid: { display: false }
      },
      y: {
        ticks: { color: '#aebbd4' },
        grid: { color: '#263247' }
      }
    }
  };
}

function draw() {
  const arr = current();

  const categories = [
    'Новые проекты',
    'Закрытые проекты',
    'Кросс-продажи',
    'Оценка',
    'Наполнение'
  ];

  const totals = categories.map(c => sumCategory(arr, c));
  const counts = categories.map(c =>
    arr.filter(x => x.category === c).length
  );

  document.getElementById('kpis').innerHTML = categories.map((c, i) => `
    <div class="card">
      <div class="muted">${c}</div>
      <div class="metric">${fmt(totals[i])}</div>
      <div class="small">${counts[i]} записей · сумма категории</div>
    </div>
  `).join('');

  const employeeNames = [...new Set(
    arr.map(x => x.employee).filter(x => x && x !== 'Анна')
  )].sort((a, b) => a.localeCompare(b, 'ru'));

  document.getElementById('people').innerHTML = employeeNames.map(emp => {
    const items = arr.filter(x => x.employee === emp);

    const sum = categories.reduce((s, c) =>
      s + sumSummaryForEmployee(
        emp,
        document.getElementById('month').value,
        c
      ), 0);

    return `
      <div class="emp">
        <b>${emp}</b>
        <div class="metric">${fmt(sum)}</div>
        <div class="small">
          ${items.length} строк · новые:
          ${items.filter(x => x.category === 'Новые проекты').length}
          · закрытые:
          ${items.filter(x => x.category === 'Закрытые проекты').length}
        </div>
      </div>
    `;
  }).join('') || '<div class="empty">Нет записей</div>';

  document.getElementById('rows').innerHTML = arr.slice()
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .map(x => `
      <tr>
        <td>${x.employee}</td>
        <td>${x.month || '—'}</td>
        <td><span class="pill">${x.category}</span></td>
        <td>${x.type || x.status || '—'}</td>
        <td>
          ${x.id
            ? (/https?:\/\//.test(x.id)
              ? `<a href="${x.id}" target="_blank" rel="noopener">Открыть</a>`
              : x.id)
            : '—'}
        </td>
        <td>${x.date || '—'}</td>
        <td>${fmt(x.amount)}</td>
      </tr>
    `).join('') ||
    '<tr><td colspan="7" class="empty">Нет записей</td></tr>';

  // Общий месячный блок: суммы по подробным строкам,
  // группировка всех сотрудников и категорий.
  const months = [...new Set(data.map(x => x.month).filter(Boolean))]
    .sort(monthSort);

  const monthlyData = months.map(m => {
    const items = data.filter(x => x.month === m);

    return {
      month: m,
      total: total(items),
      breakdown: categories.map(c => ({
        category: c,
        amount: total(items.filter(x => x.category === c))
      })).filter(x => x.amount > 0),
      items
    };
  });

  const grandMonthlyTotal = monthlyData.reduce((s, m) => s + m.total, 0);

  document.getElementById('monthlyGrandTotal').textContent =
    fmt(grandMonthlyTotal);

  document.getElementById('monthlyMonthCount').textContent =
    `${monthlyData.length} ${
      monthlyData.length === 1 ? 'месяц' :
      monthlyData.length < 5 ? 'месяца' : 'месяцев'
    } в отчете`;

  document.getElementById('monthlyRows').innerHTML = monthlyData.map(m => `
    <tr>
      <td><b>${m.month}</b></td>
      <td>${fmt(m.total)}</td>
      <td>
        <div class="month-breakdown">
          ${m.breakdown.map(b => `
            <span class="category-chip">
              ${b.category} <b>${fmt(b.amount)}</b>
            </span>
          `).join('') || '<span class="monthly-empty">Нет категорий</span>'}
        </div>
      </td>
    </tr>
  `).join('') ||
  '<tr><td colspan="3" class="empty">Нет данных</td></tr>';

  document.getElementById('registerCount').textContent =
    `${arr.length} записей`;

  destroyCharts();

  if (typeof Chart !== 'undefined') {
    charts.push(new Chart(document.getElementById('categoryChart'), {
      type: 'bar',
      data: {
        labels: categories,
        datasets: [{
          label: 'Сумма по категориям',
          data: totals,
          backgroundColor: '#6388f5',
          borderRadius: 5
        }]
      },
      options: chartOptions()
    }));

    const eTotals = employeeNames.map(e =>
      categories.reduce((s, c) =>
        s + sumSummaryForEmployee(
          e,
          document.getElementById('month').value,
          c
        ), 0)
    );

    charts.push(new Chart(document.getElementById('employeeChart'), {
      type: 'bar',
      data: {
        labels: employeeNames,
        datasets: [{
          label: 'Общая сумма работ',
          data: eTotals,
          backgroundColor: [
            '#42b89a', '#8a79e6', '#e2a44c', '#6388f5'
          ],
          borderRadius: 5
        }]
      },
      options: chartOptions()
    }));

    charts.push(new Chart(document.getElementById('monthlyChart'), {
      type: 'bar',
      data: {
        labels: monthlyData.map(x => x.month),
        datasets: categories.map((c, i) => ({
          label: c,
          data: monthlyData.map(x =>
            x.breakdown.find(b => b.category === c)?.amount || 0
          ),
          backgroundColor: [
            '#6388f5', '#42b89a', '#8a79e6', '#e2a44c', '#55b5cf'
          ][i],
          borderRadius: 4
        }))
      },
      options: {
        ...chartOptions(),
        scales: {
          x: {
            stacked: true,
            ticks: { color: '#aebbd4' },
            grid: { display: false }
          },
          y: {
            stacked: true,
            ticks: { color: '#aebbd4' },
            grid: { color: '#263247' }
          }
        }
      }
    }));
  }
}

async function refresh() {
  try {
    const r = await fetch(API_URL + '?t=' + Date.now(), {
      cache: 'no-store'
    });

    if (!r.ok) throw new Error('HTTP ' + r.status);

    const p = await r.json();

    data = (p.data || []).filter(x => x.employee !== 'Анна');
    summaries = (p.summaries || []).filter(x => x.employee !== 'Анна');
    monthly = p.monthly || [];

    updateFilters();
    draw();

    document.getElementById('footer').textContent =
      'Онлайн-синхронизация активна · обновлено: ' +
      new Date(p.updatedAt || Date.now()).toLocaleString('ru-RU') +
      ' · обновление каждые 5 минут';

  } catch (e) {
    document.getElementById('footer').textContent =
      'Не удалось загрузить Google Sheets. Проверьте публикацию Apps Script ' +
      'и доступ Web App. ' + e.message;
  }
}

['emp', 'month', 'search'].forEach(id =>
  document.getElementById(id).addEventListener('input', draw)
);

document.getElementById('reset').onclick = () => {
  document.getElementById('emp').value = 'all';
  document.getElementById('month').value = 'all';
  document.getElementById('search').value = '';
  draw();
};

refresh();
setInterval(refresh, REFRESH_MS);
