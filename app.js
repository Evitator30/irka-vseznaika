const STORE = 'irka-academy-v2';
const today = () => new Date();

const essentialCards = [
  {id:'core-model',course:'Основа продавца',q:'Какой главный идентификатор нужно попросить у покупателя?',a:'Полную модель и продуктовый/сервисный номер с шильдика; для детали — ещё её оригинальный код.'},
  {id:'core-brand',course:'Основа продавца',q:'Почему одного бренда недостаточно для подбора?',a:'Внутри одного бренда сотни моделей, ревизий, размеров, разъёмов и поставщиков узлов.'},
  {id:'core-status',course:'Основа продавца',q:'Какие три честных статуса совместимости существуют?',a:'ПОДХОДИТ, НЕ ПОДХОДИТ и НЕ ХВАТАЕТ ДАННЫХ.'},
  {id:'core-unknown',course:'Основа продавца',q:'Отсутствие модели в списке означает «не подходит»?',a:'Нет. Это может означать только отсутствие проверенных данных.'},
  {id:'core-code',course:'Основа продавца',q:'Что надёжнее: внешний вид детали или оригинальный код?',a:'Код надёжнее, но и его сверяют с моделью и критическими параметрами.'},
  {id:'core-safe',course:'Основа продавца',q:'Задача продавца — поставить диагноз по одному симптому?',a:'Нет. Продавец помогает сузить систему и подобрать подтверждённую деталь, не обещая диагноз без проверки.'}
];

const courseCards = COURSES.flatMap(c => c.cards.map((x, i) => ({
  id: `${c.id}-${i}`, course: c.name, courseId: c.id, q: x[0], a: x[1]
})));

const allCards = [...essentialCards, ...courseCards];

let state = loadState();
let currentCourse = COURSES.find(c => c.id === state.lastCourse) || COURSES[0];
let currentTab = 'principle';
let reviewOffset = 0;
let sessionDone = 0;

// ─── Storage ───

function loadState() {
  const base = {courses:{}, reviews:{}, stats:{answers:0, confident:0, xp:0}, firstSeen:new Date().toISOString(), lastCourse:'washer'};
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || '{}');
    return {
      ...base, ...saved,
      courses: saved.courses || {},
      reviews: saved.reviews || {},
      stats: {...base.stats, ...(saved.stats || {})}
    };
  } catch { return base; }
}

function save() {
  localStorage.setItem(STORE, JSON.stringify(state));
  updateStats();
}

// ─── Wiki helpers ───

const WIKI_NAME_MAP = {
  'Заливной клапан':'zalivnoy-klapan','Прессостат':'pressostat','ТЭН':'ten-stiralnoy',
  'Помпа':'pompa-stiralnoy','УБЛ':'ubl','Ремень':'remen','Амортизатор':'amortizator',
  'Манжета люка':'manzheta','Уплотнитель':'uplotnitel','Термостат':'termostat',
  'Компрессор':'kompressor','Пускозащитное реле':'rele-puska','Датчик NTC':'datchik-ntc',
  'ТЭН оттайки':'ten-ottayki','Вентилятор':'ventilyator-holodilnika',
  'Циркуляционный насос':'tsirkulyacionny-nasos','Разбрызгиватель':'razbryzgivatel',
  'Свеча розжига':'svecha-rozzhiga','Термопара':'termopara','ТЭН духовки':'ten-duhovki',
  'ТЭН':'ten-bojlera','Магниевый анод':'anod','Мотор-турбина':'motor-pylesosa',
  'HEPA-фильтр':'filtr-hepa','Компрессор кондиционера':'kompressor-kondicionera',
  'Дренажный насос':'drenazhny-nasos','Крыльчатка':'krylchatka',
  'Мотор вытяжки':'dvigatel-vytyazhki','Угольный фильтр':'ugolniy-filtr'
};

function findWikiKey(partName, courseId) {
  for (const [name, key] of Object.entries(WIKI_NAME_MAP)) {
    if (partName.includes(name)) return key;
  }
  return null;
}

// ─── Helpers ───

function esc(s) {
  return String(s).replace(/[&<>'"]/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[c]));
}

function toast(text) {
  const e = document.querySelector('#toast');
  e.textContent = text;
  e.classList.add('show');
  setTimeout(() => e.classList.remove('show'), 2700);
}

function courseState(id) {
  return state.courses[id] || (state.courses[id] = {opened:false, completed:false, tab:'principle'});
}

function unlockedCards() {
  return allCards.filter(c => !c.courseId || courseState(c.courseId).opened);
}

function dueCards() {
  return unlockedCards().filter(c => {
    const r = state.reviews[c.id];
    return !r?.suspended && (!r?.due || new Date(r.due) <= today());
  });
}

function courseProgress(id) {
  const c = courseState(id);
  return c.completed ? 100 : c.opened ? 25 : 0;
}

// ─── Routing ───

function route(name, id) {
  if (name === 'course') {
    currentCourse = COURSES.find(c => c.id === (id || currentCourse.id)) || COURSES[0];
    state.lastCourse = currentCourse.id;
    courseState(currentCourse.id).opened = true;
    currentTab = courseState(currentCourse.id).tab || 'principle';
    save();
    renderCourse();
  }
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === `page-${name}`));
  document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('active',
    b.dataset.route === name || (name === 'course' && b.dataset.route === 'academy')
  ));
  document.querySelector('#sidebar').classList.remove('open');
  if (name === 'academy') renderAcademy();
  if (name === 'review') { reviewOffset = 0; renderReview(); }
  if (name === 'search') renderSearch();
  if (name === 'knowledge') renderKnowledgeBase();
  if (name === 'wiki') renderWiki();
  if (name === 'chat') renderChatSetup();
  history.replaceState(null, '', name === 'course' ? `#course/${currentCourse.id}` : `#${name}`);
  window.scrollTo({top:0, behavior:'smooth'});
}

// ─── Stats ───

function updateStats() {
  const completed = COURSES.filter(c => courseState(c.id).completed).length;
  const percent = Math.round(completed / COURSES.length * 100);
  const due = dueCards().length;
  const confidence = state.stats.answers
    ? `${Math.round(state.stats.confident / state.stats.answers * 100)}%`
    : '—';
  const xp = state.stats.xp || 0;
  const level = Math.floor(xp / 200);
  const within = xp % 200;
  const levels = ['Новичок-исследователь','Знаток систем','Навигатор деталей','Мастер подбора','Эксперт ZIP161'];

  document.querySelector('#levelName').textContent = levels[Math.min(level, levels.length - 1)];
  document.querySelector('#xpValue').textContent = within;
  document.querySelector('#xpLine').style.width = `${within / 2}%`;
  document.querySelector('#overallPercent').textContent = `${percent}%`;
  document.querySelector('#overallLine').style.width = `${percent}%`;
  document.querySelector('#coursesDone').textContent = `${completed} / ${COURSES.length}`;
  document.querySelector('#partsSeen').textContent = COURSES.filter(c => courseState(c.id).opened).reduce((n, c) => n + c.parts.length, 0);
  document.querySelector('#dueToday').textContent = due;
  document.querySelector('#dueBadge').textContent = due;
  document.querySelector('#confidence').textContent = confidence;
  document.querySelector('#academyProgress').textContent = `${percent}%`;
  const days = Math.max(1, Math.ceil((today() - new Date(state.firstSeen)) / 86400000));
  document.querySelector('#streak').textContent = days;
}

// ─── Academy Grid ───

function renderAcademy(filter = 'all') {
  const items = COURSES.filter(c => filter === 'all' || c.family === filter);
  document.querySelector('#courseGrid').innerHTML = items.map(c => {
    const p = courseProgress(c.id);
    return `<article class="course-card" style="--accent:${c.color}" data-course="${c.id}">
      <div class="course-top">
        <span class="course-icon">${c.icon}</span>
        <span class="course-status">${p===100?'✓ маршрут пройден':p?'в процессе':'не начат'}</span>
      </div>
      <h2>${c.name}</h2><p>${c.tagline}</p>
      <div class="course-meta">
        <span>◷ ${c.minutes} минут</span>
        <span>◫ ${c.parts.length} деталей</span>
        <span>✦ ${c.cards.length} вопросов</span>
      </div>
      <div class="card-progress"><i style="width:${p}%"></i></div>
      <div class="course-open"><span>${c.family}</span><span>Открыть →</span></div>
    </article>`;
  }).join('');
}

// ─── Course View ───

function renderCourse() {
  const c = currentCourse;
  const tabs = [
    ['principle','1. Как работает'],
    ['systems','2. Карта систем'],
    ['parts','3. Детали ZIP161'],
    ['diagnostics','4. Диагностика'],
    ['practice','5. Практика продавца']
  ];
  document.querySelector('#courseContent').innerHTML = `
    <section class="course-hero" style="--accent:${c.color}">
      <img src="assets/scenes/${c.scene}" alt="${c.name}: внутренние системы">
      <div class="course-hero-copy">
        <span class="course-emoji">${c.icon}</span>
        <span class="kicker"><i></i> ${c.family} · ${c.minutes} минут</span>
        <h1>${c.name}</h1><p>${c.tagline}</p>
      </div>
    </section>
    <nav class="course-tabs">${tabs.map(t =>
      `<button data-tab="${t[0]}" class="${currentTab===t[0]?'active':''}">${t[1]}</button>`
    ).join('')}</nav>
    <div id="lessonPanel"></div>`;
  renderCourseTab();
}

function renderCourseTab() {
  const c = currentCourse;
  courseState(c.id).tab = currentTab;
  save();
  let html = '';

  if (currentTab === 'principle') {
    html = `<article class="lesson-panel">
      <span class="kicker"><i></i> Большая идея</span>
      <h2>${c.tagline}</h2>
      <p class="lesson-lead">${c.principle}</p>
      <div class="flow-track">${c.flow.map((x, i) =>
        `${i?'<span class="flow-arrow">→</span>':''}<div class="flow-step"><b>${i+1}</b><br>${x}</div>`
      ).join('')}</div>
      <div class="fact-box"><b>История и ассоциация.</b> ${c.history}</div>
      ${courseFooter()}</article>`;
  }

  if (currentTab === 'systems') {
    html = `<article class="lesson-panel">
      <span class="kicker"><i></i> От целого к узлам</span>
      <h2>Команды внутри прибора</h2>
      <p class="lesson-lead">Сначала определи, какая система выполняет задачу. Только потом ищи отдельную деталь.</p>
      <div class="system-grid">${c.systems.map((s, i) =>
        `<div class="system-card"><b>${String(i+1).padStart(2,'0')} · ${s[0]}</b><span>${s[1]}</span></div>`
      ).join('')}</div>
      <div class="fact-box"><b>Рабочий приём:</b> если покупатель описывает симптом, назови 2–4 возможные системы, но не обещай конкретную поломку без диагностики.</div>
      ${courseFooter()}</article>`;
  }

  if (currentTab === 'parts') {
    html = `<article class="lesson-panel">
      <span class="kicker"><i></i> Связь с каталогом</span>
      <h2>Детали и ключи подбора</h2>
      <p class="lesson-lead">Функция объясняет, зачем деталь существует. Колонка «что спросить» защищает от неверной продажи. Нажми на название детали — откроется вики.</p>
      <div class="part-table">${c.parts.map(p => {
        const wikiKey = findWikiKey(p.n, c.id);
        const wikiLink = wikiKey ? `data-wiki="${wikiKey}"` : '';
        return `<div class="part-row"><h3 ${wikiLink} class="${wikiKey ? 'wiki-link' : ''}">${p.n}</h3><p>${p.f}</p><p class="ask"><b>Спросить:</b> ${p.ask}</p><a href="${p.url}" target="_blank" rel="noopener" title="Открыть ZIP161">↗</a></div>`;
      }).join('')}</div>
      <div class="zip-example">
        <strong>${c.example.sku}</strong>
        <div><h3>${c.example.name}</h3><p>${c.example.note}</p></div>
        <a href="${c.example.url}" target="_blank" rel="noopener">Открыть ZIP161 ↗</a>
      </div>
      ${courseFooter()}</article>`;
  }

  if (currentTab === 'diagnostics') {
    const kb = window.KNOWLEDGE_BASE && window.KNOWLEDGE_BASE[c.id];
    if (kb && kb.diagnostics) {
      html = `<article class="lesson-panel">
        <span class="kicker"><i></i> Что говорит покупатель</span>
        <h2>Диагностика по симптомам</h2>
        <p class="lesson-lead">Покупатель описывает проблему. Ты предполагаешь причину и предлагаешь нужную деталь. Чем точнее вопрос — тем быстрее подбор.</p>
        ${kb.diagnostics.map(d => `
          <div class="kb-diagnostic">
            <h3>«${d.symptom}»</h3>
            <div class="kb-causes">${d.causes.map(c => `
              <div class="kb-cause ${c.probability === 'очень высокая' ? 'kb-hot' : c.probability === 'высокая' ? 'kb-warm' : ''}">
                <div class="kb-cause-head">
                  <span class="kb-probability">${c.probability}</span>
                  <b>${c.name}</b>
                  <span class="kb-price">${c.price}</span>
                </div>
                <p>Предложить: <strong>${c.part}</strong></p>
                <small>${c.note}</small>
              </div>
            `).join('')}</div>
            <div class="kb-tip">💬 <b>Продавцу:</b> ${d.tip}</div>
          </div>
        `).join('')}
        ${kb.repairOrReplace ? `
          <div class="kb-section" style="margin-top:20px">
            <h2>⚖️ Ремонт или замена?</h2>
            <div class="kb-decision">
              <div class="kb-repair"><h3>✅ Ремонтировать</h3><p>${kb.repairOrReplace.repair}</p></div>
              <div class="kb-replace"><h3>🔄 Заменить</h3><p>${kb.repairOrReplace.replace}</p></div>
            </div>
            <div class="kb-rule">📏 ${kb.repairOrReplace.rule}</div>
          </div>` : ''}
        ${kb.maintenance ? `
          <div class="kb-section" style="margin-top:20px">
            <h2>🛡️ Профилактика (совет покупателю)</h2>
            <ul class="kb-maintenance">${kb.maintenance.map(m => `<li>${m}</li>`).join('')}</ul>
          </div>` : ''}
        ${kb.prices ? `
          <div class="kb-section" style="margin-top:20px">
            <h2>💰 Типичные цены</h2>
            <div class="kb-prices">${Object.entries(kb.prices).map(([k, v]) =>
              `<div class="kb-price-row"><span>${k}</span><b>${v}</b></div>`
            ).join('')}</div>
          </div>` : ''}
        ${kb.safety ? `<div class="kb-section kb-safety" style="margin-top:20px"><h2>⚠️ Безопасность</h2><p>${kb.safety}</p></div>` : ''}
        ${courseFooter()}</article>`;
    } else {
      html = `<article class="lesson-panel">
        <span class="kicker"><i></i> Диагностика</span>
        <h2>Раздел в разработке</h2>
        <p class="lesson-lead">Для этого прибора пока нет данных по диагностике. Откройте «База знаний» в меню слева.</p>
        ${courseFooter()}</article>`;
    }
  }

  if (currentTab === 'practice') {
    html = `<article class="lesson-panel">
      <span class="kicker"><i></i> Язык покупателя</span>
      <h2>Симптом — это направление, не диагноз</h2>
      <p class="lesson-lead">Читай цепочку слева направо: от простого и внешнего к узлам, которые требуют проверки.</p>
      <div class="symptom-grid">${c.symptoms.map(s =>
        `<div class="symptom-card"><b>«${s[0]}»</b><p>${s[1]}</p></div>`
      ).join('')}</div>
      ${c.safety ? `<div class="safety-box"><b>Безопасность.</b> ${c.safety}</div>` : ''}
      <div class="case-box">
        <span>Мини-кейс у прилавка</span>
        <h3>${c.caseQ}</h3>
        <div class="case-options">${c.caseOptions.map((o, i) =>
          `<button data-case="${i}">${o}</button>`
        ).join('')}</div>
        <p id="caseFeedback"></p>
      </div>
      ${courseFooter()}</article>`;
  }

  document.querySelector('#lessonPanel').innerHTML = html;
}

function courseFooter() {
  const done = courseState(currentCourse.id).completed;
  return `<div class="complete-row">
    <p>Карточки этого маршрута уже добавлены в повторение.</p>
    <button class="complete-button ${done?'done':''}" data-complete="${currentCourse.id}">
      ${done ? '✓ Маршрут пройден' : 'Завершить маршрут +50 XP'}
    </button>
  </div>`;
}

function completeCourse(id) {
  const cs = courseState(id);
  if (!cs.completed) {
    cs.completed = true;
    state.stats.xp += 50;
    save();
    toast('Маршрут завершён — сильная работа с системой!');
  }
  renderCourseTab();
}

// ─── Search / Reference ───

function renderSearch(query = '') {
  document.querySelector('#sellerChecklist').innerHTML = SELLER_CHECKLIST.map(x =>
    `<div class="check-item"><b>${x[0]}</b><div><span>${x[1]}</span><small>${x[2]}</small></div></div>`
  ).join('');

  const q = query.trim().toLowerCase();
  const results = COURSES.flatMap(c => c.parts.map(p => ({...p, course:c.name, icon:c.icon})))
    .filter(p => !q || `${p.n} ${p.f} ${p.ask} ${p.course}`.toLowerCase().includes(q));

  document.querySelector('#searchCount').textContent = q
    ? `Найдено: ${results.length}`
    : `В справочнике: ${results.length} ключевых деталей`;

  document.querySelector('#partResults').innerHTML = results.map(p =>
    `<article class="result-card"><div>
      <span>${p.icon} ${p.course}</span>
      <h3>${p.n}</h3><p>${p.f}</p>
      <p><b>Для подбора:</b> ${p.ask}</p>
    </div><a href="${p.url}" target="_blank" rel="noopener">↗</a></article>`
  ).join('') || '<p>Ничего не нашлось. Попробуй более общее слово.</p>';
}

// ─── Wiki (энциклопедия деталей) ───

let currentWikiKey = '';

function renderWiki(wikiKey) {
  if (wikiKey) currentWikiKey = wikiKey;
  const entry = WIKI[currentWikiKey];
  if (!entry) { document.querySelector('#wikiContent').innerHTML = '<p>Деталь не найдена.</p>'; return; }

  let html = `<article class="wiki-page">
    <div class="wiki-header">
      <span class="wiki-icon">${entry.icon}</span>
      <div><span class="wiki-course">${entry.courseName}</span><h1>${entry.name}</h1></div>
    </div>

    <div class="wiki-section wiki-simple">
      <span class="kicker"><i></i> Простыми словами</span>
      <p>${entry.simple}</p>
    </div>

    <div class="wiki-section wiki-technical">
      <span class="kicker"><i></i> Как устроено технически</span>
      <p>${entry.technical}</p>
    </div>

    <div class="wiki-section wiki-system">
      <span class="kicker"><i></i> В какой системе работает</span>
      <p><b>${entry.system}</b></p>
      <div class="wiki-connects"><span>Связано с:</span> ${entry.connects.map(c => `<span class="wiki-tag">${c}</span>`).join(' ')}</div>
    </div>

    <div class="wiki-section wiki-breakdowns">
      <span class="kicker"><i></i> Что ломается и почему</span>
      ${entry.breakdowns.map(b => `
        <div class="wiki-breakdown">
          <h3>«${b.symptom}»</h3>
          <p><b>Причина:</b> ${b.cause}</p>
        </div>
      `).join('')}
    </div>

    <div class="wiki-section wiki-seller">
      <span class="kicker"><i></i> Что спросить у покупателя</span>
      <div class="wiki-ask">${entry.ask}</div>
    </div>

    <div class="wiki-section wiki-links">
      <a href="${entry.zip161}" target="_blank" rel="noopener" class="neon-button">Открыть в каталоге ZIP161 ↗</a>
      <button class="glass-button" data-route="course" data-course="${entry.course}">← Вернуться к уроку</button>
    </div>
  </article>`;

  document.querySelector('#wikiContent').innerHTML = html;
}

// ─── Knowledge Base (справочник продавца) ───

let currentKBKey = 'washer';

function renderKnowledgeBase(key) {
  if (key) currentKBKey = key;
  const kb = window.KNOWLEDGE_BASE;
  if (!kb) return;

  const tabMap = {
    washer:'🫧 Стиралка', fridge:'❄️ Холодильник', dishwasher:'🍽️ Посудомойка',
    oven:'♨️ Плиты', heater:'🚿 Бойлер', vacuum:'🌪️ Пылесос',
    conditioner:'🌬️ Кондиционер', dryer:'🌀 Сушилка', small:'☕ Мелкая',
    boiler:'🔥 Котлы', hood:'💨 Вытяжка'
  };

  const tabsEl = document.querySelector('#knowledgeTabs');
  if (tabsEl) {
    tabsEl.innerHTML = Object.entries(tabMap).map(([k, v]) =>
      `<button class="${k === currentKBKey ? 'active' : ''}" data-kb="${k}">${v}</button>`
    ).join('');
    document.querySelectorAll('[data-kb]').forEach(b => {
      b.onclick = () => renderKnowledgeBase(b.dataset.kb);
    });
  }

  const data = kb[currentKBKey];
  if (!data) { const el = document.querySelector('#knowledgeContent'); if (el) el.innerHTML = '<p>Раздел в разработке.</p>'; return; }

  let html = `<div class="kb-header"><span class="kb-icon">${data.icon}</span><h1>${data.name}</h1></div>`;

  // Top breakdowns
  if (data.topBreakdowns && data.topBreakdowns.length) {
    html += `<div class="kb-section"><h2>🔧 Топ поломок</h2>`;
    data.topBreakdowns.forEach(b => {
      html += `<div class="kb-breakdown-card">
        <div class="kb-breakdown-head"><b>${b.name}</b><span class="kb-pct">${b.pct}</span></div>
        <p class="kb-symptoms"><b>Симптомы:</b> ${b.symptoms}</p>
        <p class="kb-cause-text"><b>Причина:</b> ${b.cause}</p>
        <p class="kb-price-text"><b>Цена:</b> ${b.price}</p>
        <p class="kb-fix"><b>Решение:</b> ${b.fix}</p>
        <p class="kb-tip-seller">💬 <b>Продавцу:</b> ${b.sellerTip}</p>
      </div>`;
    });
    html += '</div>';
  }

  // Diagnostics
  if (data.diagnostics && data.diagnostics.length) {
    html += `<div class="kb-section"><h2>🔍 Диагностика</h2>
      <p class="kb-intro">Покупатель описывает проблему → ты предполагаешь причину → предлагаешь деталь.</p>`;
    data.diagnostics.forEach(d => {
      html += `<div class="kb-diag-card">
        <h3>«${d.symptom}»</h3>
        ${d.causes.map(c => `<p><b>${c.name}</b> (${c.probability}) — ${c.part} ${c.price}<br><small>${c.note}</small></p>`).join('')}
        <p class="kb-tip">💬 ${d.tip}</p>
      </div>`;
    });
    html += '</div>';
  }

  // Brands
  if (data.brands && Object.keys(data.brands).length) {
    html += `<div class="kb-section"><h2>🏭 Совместимость брендов</h2>`;
    Object.entries(data.brands).forEach(([name, desc]) => {
      html += `<div class="kb-brand-row"><b>${name}</b><span>${desc}</span></div>`;
    });
    html += '</div>';
  }

  // Types
  if (data.types && Object.keys(data.types).length) {
    html += `<div class="kb-section"><h2>📐 Типы техники</h2>`;
    Object.entries(data.types).forEach(([name, desc]) => {
      html += `<div class="kb-type-row"><b>${name}</b><p>${desc}</p></div>`;
    });
    html += '</div>';
  }

  // Repair or replace
  if (data.repairOrReplace) {
    const r = data.repairOrReplace;
    html += `<div class="kb-section"><h2>⚖️ Ремонт или замена?</h2>
      <div class="kb-decision">
        <div class="kb-repair"><h3>Ремонтировать</h3><p>${r.repair}</p></div>
        <div class="kb-replace"><h3>Заменить</h3><p>${r.replace}</p></div>
      </div></div>`;
  }

  // Prevention
  if (data.prevention && data.prevention.length) {
    html += `<div class="kb-section"><h2>🛡️ Профилактика</h2><ul class="kb-prevention">`;
    data.prevention.forEach(p => { html += `<li>${p}</li>`; });
    html += '</ul></div>';
  }

  // Safety
  if (data.safety) {
    html += `<div class="kb-section kb-safety"><h2>⚠️ Безопасность</h2><p>${data.safety}</p></div>`;
  }

  const el = document.querySelector('#knowledgeContent');
  if (el) el.innerHTML = html;
}

// ─── Spaced Repetition Review ───

function renderReview() {
  const due = dueCards();
  if (reviewOffset >= due.length) reviewOffset = 0;
  const card = due[reviewOffset];

  document.querySelector('#sessionDone').textContent = sessionDone;
  document.querySelector('#sessionLeft').textContent = due.length;
  const box = document.querySelector('#memoryCard');

  if (!card) {
    box.innerHTML = `<div class="memory-empty">
      <img src="assets/misa-success.png" alt="Радостная Миса">
      <h2>Сегодня всё!</h2>
      <p>Следующие карточки появятся тогда, когда память начнёт их отпускать.</p>
      <button class="neon-button" data-route="academy">Открыть новый маршрут</button>
    </div>`;
    return;
  }

  box.innerHTML = `
    <span class="memory-tag">${card.course}</span>
    <h2>${card.q}</h2>
    <button class="reveal" id="revealCard">Показать ответ</button>
    <div class="memory-controls">
      <button id="skipCard">Пропустить сейчас</button>
      <button id="suspendCard">Не показывать больше</button>
    </div>`;

  document.querySelector('#revealCard').onclick = () => revealCard(card);
  document.querySelector('#skipCard').onclick = () => {
    reviewOffset = (reviewOffset + 1) % due.length;
    renderReview();
  };
  document.querySelector('#suspendCard').onclick = () => suspendCard(card);
}

function revealCard(card) {
  document.querySelector('#memoryCard').innerHTML = `
    <span class="memory-tag">${card.course}</span>
    <h2>${card.q}</h2>
    <div class="memory-answer">${card.a}</div>
    <div class="grades">
      <button data-grade="again">Не помню<br><small>10 мин</small></button>
      <button data-grade="hard">Трудно<br><small>1 день</small></button>
      <button data-grade="good">Знаю<br><small>неск. дней</small></button>
      <button data-grade="easy">Легко<br><small>подальше</small></button>
    </div>
    <div class="memory-controls">
      <button id="suspendCard">Не показывать больше</button>
    </div>`;

  document.querySelectorAll('[data-grade]').forEach(b =>
    b.onclick = () => grade(card, b.dataset.grade)
  );
  document.querySelector('#suspendCard').onclick = () => suspendCard(card);
}

function suspendCard(card) {
  state.reviews[card.id] = {...(state.reviews[card.id] || {}), suspended: true};
  save();
  toast('Вопрос убран из повторения');
  renderReview();
}

function grade(card, g) {
  const old = state.reviews[card.id] || {level: 0};
  const level = Math.min(old.level || 0, 4);
  const due = today();

  if (g === 'again') {
    due.setMinutes(due.getMinutes() + 10);
  } else {
    const intervals = {
      hard: 1,
      good: [2, 5, 12, 28, 60][level],
      easy: [4, 10, 24, 60, 120][level]
    };
    due.setDate(due.getDate() + intervals[g]);
  }

  state.reviews[card.id] = {
    level: g === 'again' ? 0 : level + 1,
    due: due.toISOString(),
    lastGrade: g
  };
  state.stats.answers++;
  if (g === 'good' || g === 'easy') state.stats.confident++;
  state.stats.xp += g === 'again' ? 1 : g === 'hard' ? 2 : 4;
  sessionDone++;
  reviewOffset = 0;
  save();

  if (sessionDone === 3) toast('Три честных ответа — хороший темп, Ирина');
  renderReview();
}

// ─── Chat (Gemini client-side) ───

function addMessage(type, text, id = '') {
  const m = document.querySelector('#messages');
  m.insertAdjacentHTML('beforeend',
    `<div class="message ${type}" ${id ? `id="${id}` : ''}>
      <b>${type === 'user' ? 'Ирина' : 'Миса'}</b>
      <p>${esc(text)}</p>
    </div>`
  );
  m.scrollTop = m.scrollHeight;
}

function renderChatSetup() {
  const statusEl = document.querySelector('#apiStatus');
  if (GeminiClient.hasKey()) {
    statusEl.textContent = 'ключ установлен';
  } else {
    statusEl.textContent = 'нужен ключ Gemini';
  }
}

function showKeyPrompt() {
  const overlay = document.createElement('div');
  overlay.className = 'key-overlay';
  overlay.innerHTML = `
    <div class="key-modal">
      <h3>Настройка Gemini API</h3>
      <p>Введи свой ключ Gemini API для работы чата с Мисой. Ключ хранится только в твоём браузере.</p>
      <input id="keyInput" type="password" placeholder="Вставь ключ сюда..." autocomplete="off">
      <div class="key-modal-buttons">
        <button id="keySave" class="neon-button">Сохранить</button>
        <button id="keyCancel" class="glass-button">Отмена</button>
      </div>
      <small>Получить ключ: <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio</a></small>
    </div>`;
  document.body.appendChild(overlay);

  document.querySelector('#keySave').onclick = () => {
    const key = document.querySelector('#keyInput').value.trim();
    if (key) {
      GeminiClient.setKey(key);
      toast('Ключ сохранён!');
      renderChatSetup();
      overlay.remove();
    }
  };
  document.querySelector('#keyCancel').onclick = () => overlay.remove();
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  document.querySelector('#keyInput').focus();
}

function showGitHubPrompt() {
  const overlay = document.createElement('div');
  overlay.className = 'key-overlay';
  overlay.innerHTML = `
    <div class="key-modal">
      <h3>Настройка GitHub</h3>
      <p>Введи персональный токен GitHub (scope: repo) для отправки ошибок и дополнений.</p>
      <input id="ghTokenInput" type="password" placeholder="ghp_xxxx..." autocomplete="off">
      <div class="key-modal-buttons">
        <button id="ghTokenSave" class="neon-button">Сохранить</button>
        <button id="ghTokenCancel" class="glass-button">Отмена</button>
      </div>
      <small>Создать токен: <a href="https://github.com/settings/tokens" target="_blank" rel="noopener">GitHub Settings → Tokens</a> (нужен scope: repo)</small>
    </div>`;
  document.body.appendChild(overlay);

  document.querySelector('#ghTokenSave').onclick = () => {
    const token = document.querySelector('#ghTokenInput').value.trim();
    if (token) {
      GitHubClient.setToken(token);
      toast('GitHub токен сохранён!');
      overlay.remove();
    }
  };
  document.querySelector('#ghTokenCancel').onclick = () => overlay.remove();
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  document.querySelector('#ghTokenInput').focus();
}

async function askMisa(text) {
  addMessage('user', text);

  // Check for special commands: Ошибка / Дополнение
  const errorMatch = text.match(/^ошибка[:\s]+(.+)/i);
  const additionMatch = text.match(/^дополнение[:\s]+(.+)/i);

  if (errorMatch || additionMatch) {
    if (!GitHubClient.hasToken()) {
      addMessage('bot', 'Для отправки в репозиторий нужен GitHub токен. Нажми «Настроить GitHub» в памятке ниже.');
      return;
    }
    addMessage('bot loading', 'Отправляю в репозиторий…', 'chatLoading');
    try {
      if (errorMatch) {
        await GitHubClient.reportError(errorMatch[1].trim());
        document.querySelector('#chatLoading')?.remove();
        addMessage('bot', '✅ Ошибка записана! Спасибо, Ирина. Мы это исправим.');
      } else {
        await GitHubClient.reportAddition(additionMatch[1].trim());
        document.querySelector('#chatLoading')?.remove();
        addMessage('bot', '✅ Дополнение записано! Хорошая находка, Ирина.');
      }
    } catch (e) {
      document.querySelector('#chatLoading')?.remove();
      addMessage('bot', `Не удалось отправить: ${e.message}`);
    }
    return;
  }

  if (!GeminiClient.hasKey()) {
    showKeyPrompt();
    return;
  }

  addMessage('bot loading', 'Думаю', 'chatLoading');
  document.querySelector('#apiStatus').textContent = 'сообщение отправлено…';

  try {
    const courseId = document.querySelector('#chatContext').value;
    const answer = await GeminiClient.sendMessage(text, courseId);
    document.querySelector('#chatLoading')?.remove();
    addMessage('bot', answer);
    document.querySelector('#apiStatus').textContent = 'работает';
  } catch (e) {
    document.querySelector('#chatLoading')?.remove();
    addMessage('bot', e.message);
    document.querySelector('#apiStatus').textContent = 'ошибка — проверь ключ';
  }
}

// ─── Event Listeners ───

document.addEventListener('click', e => {
  const r = e.target.closest('[data-route]');
  if (r) { e.preventDefault(); route(r.dataset.route, r.dataset.course); return; }

  const c = e.target.closest('[data-course]');
  if (c) { route('course', c.dataset.course); return; }

  const tab = e.target.closest('[data-tab]');
  if (tab) { currentTab = tab.dataset.tab; renderCourse(); return; }

  const complete = e.target.closest('[data-complete]');
  if (complete) { completeCourse(complete.dataset.complete); return; }

  const answer = e.target.closest('[data-case]');
  if (answer) {
    const buttons = [...document.querySelectorAll('[data-case]')];
    buttons.forEach(b => b.disabled = true);
    const ok = Number(answer.dataset.case) === currentCourse.caseAnswer;
    answer.classList.add(ok ? 'correct' : 'wrong');
    if (!ok) buttons[currentCourse.caseAnswer].classList.add('correct');
    document.querySelector('#caseFeedback').textContent = ok
      ? 'Верно. Ты запросила данные, которые действительно различают детали.'
      : 'Лучший ответ выделен зелёным: он проверяет совместимость, а не угадывает.';
    if (ok) { state.stats.xp += 5; save(); toast('Верный вопрос покупателю +5 XP'); }
    return;
  }

  const world = e.target.closest('[data-world]');
  if (world) { route('academy'); return; }

  const wiki = e.target.closest('[data-wiki]');
  if (wiki) { route('wiki'); renderWiki(wiki.dataset.wiki); return; }
});

document.querySelectorAll('.filter-row button').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('.filter-row button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    renderAcademy(b.dataset.filter);
  };
});

document.querySelector('#partSearch').addEventListener('input', e => renderSearch(e.target.value));
document.querySelector('#partSearch').addEventListener('keydown', e => {
  if (e.key === 'Escape') { e.target.value = ''; renderSearch(); e.target.blur(); }
});

document.querySelector('#continueButton').onclick = () => route('course', state.lastCourse || 'washer');
document.querySelector('#menuButton').onclick = () => document.querySelector('#sidebar').classList.add('open');
document.querySelector('#sideClose').onclick = () => document.querySelector('#sidebar').classList.remove('open');

document.querySelector('#resetProgress').onclick = () => {
  if (confirm('Вернуть все вопросы и удалить учебный прогресс?')) {
    localStorage.removeItem(STORE);
    state = loadState();
    sessionDone = 0;
    renderReview();
    updateStats();
  }
};

// Chat context dropdown
document.querySelector('#chatContext').innerHTML =
  '<option value="general">Общий вопрос</option>' +
  COURSES.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');

// Chat form
document.querySelector('#chatForm').onsubmit = e => {
  e.preventDefault();
  const i = document.querySelector('#chatInput');
  const text = i.value.trim();
  if (text) { i.value = ''; askMisa(text); }
};

// Quick questions
document.querySelectorAll('#quickList button').forEach(b => {
  b.onclick = () => askMisa(b.textContent);
});

// Clear chat
document.querySelector('#clearChat').onclick = () => {
  GeminiClient.clearHistory();
  document.querySelector('#messages').innerHTML =
    '<div class="message bot"><b>Миса</b><p>Начинаем новую тему. Что разберём?</p></div>';
};

// API key setup button — add to chat sidebar
const keyBtn = document.createElement('button');
keyBtn.className = 'glass-button key-setup-btn';
keyBtn.textContent = 'Настроить ключ Gemini';
keyBtn.onclick = showKeyPrompt;
const chatAbout = document.querySelector('.chat-about');
if (chatAbout) chatAbout.appendChild(keyBtn);

// GitHub token setup button
const ghBtn = document.createElement('button');
ghBtn.className = 'glass-button key-setup-btn';
ghBtn.textContent = 'Настроить GitHub';
ghBtn.onclick = showGitHubPrompt;
if (chatAbout) chatAbout.appendChild(ghBtn);

// ─── Init ───

renderAcademy();
renderSearch();
updateStats();

const hash = location.hash.slice(1);
if (hash.startsWith('course/')) route('course', hash.split('/')[1]);
else route(['home','academy','search','knowledge','wiki','review','chat'].includes(hash) ? hash : 'home');

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('service-worker.js').catch(() => {});
}
