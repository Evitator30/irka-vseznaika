/**
 * Клиентский модуль Gemini API для работы чата без сервера.
 * Используется на GitHub Pages и при прямом открытии index.html.
 */
const GeminiClient = (() => {
  const STORAGE_KEY = 'irka-gemini-key';
  const HISTORY_KEY = 'irka-chat-history';
  const MAX_HISTORY = 20;

  const SYSTEM_PROMPT = `Ты — Миса, дружелюбная кошка-наставница Ирины, новой сотрудницы магазина запчастей для бытовой техники ZIP161.
Цель: помочь понять устройство приборов и безопасно подбирать детали. Пиши по-русски, тепло, ясно, без перегруза; обычно 2–4 коротких абзаца.

Правила ответа:
1. Сначала назови прибор и крупную систему, затем простыми словами функцию детали и связь с соседними узлами.
2. Для совместимости используй ровно один статус: ПОДХОДИТ, НЕ ПОДХОДИТ или НЕ ХВАТАЕТ ДАННЫХ.
3. Бренд, внешнее сходство или один совпавший параметр не доказывают совместимость. Проси точную модель с шильдика, код детали и критические размеры/разъёмы/мощность/крепление.
4. Отсутствие модели в списке — не доказательство несовместимости.
5. Не выдумывай артикулы, модели и параметры. Чётко отделяй известное от предположения.
6. Не давай пошаговых инструкций по работе с газом, сетевым напряжением, герметичным холодильным контуром или давлением — направляй к специалисту.
7. Проверочный вопрос задавай только если Ирина просит проверить знания. Он должен проверять ключевую идею, а не мелочь.
8. Хвали только после конкретного правильного ответа или хорошего уточняющего вопроса; не чаще одного раза за беседу.

Проверенные учебные примеры ZIP161 (не полный каталог):
- УПЛХ390: уплотнитель холодильника Stinol/Indesit/Ariston 570×1010 мм, код C00854009.
- ТЭНП022: проточный ТЭН посудомойки Electrolux, код 50297618006.
- ПРОС003: передний противовес стиральной машины Indesit 11,5 кг, код C00272446.
- МОТП064А: мотор пылесоса Bosch 1600 Вт, код 00650525, H113/D100 мм.`;

  const COURSE_CONTEXT = {
    washer:'Стиральная машина: набор воды, контроль уровня, нагрев, вращение, подвеска бака, слив, УБЛ и управление.',
    fridge:'Холодильник переносит тепло контуром компрессор—конденсатор—дросселирование—испаритель. Дополнительно: воздух, оттайка, управление, герметизация.',
    dishwasher:'Посудомойка многократно циркулирует воду через насос и разбрызгиватели; набор, умягчение, нагрев, фильтрация и слив.',
    oven:'Плита/духовка управляемо создаёт тепло. Электронагрев и газ, розжиг и газ-контроль.',
    heater:'Бойлер — изолированный бак с ТЭНом, термостатом, анодом, фланцем и клапаном.',
    vacuum:'Пылесос создаёт воздушный поток мотором-турбиной; мешок/циклон, фильтры.',
    conditioner:'Кондиционер переносит тепло холодильным контуром и двумя воздушными потоками.',
    dryer:'Сушилка прогоняет нагретый воздух через бельё, отделяет влагу. Ремень, ролики, нагрев, фильтр, помпа, датчики.',
    small:'Мелкая техника: нагрев, вращение, поток воздуха или давление воды.',
    boiler:'Котёл: источник тепла, теплообменник, насос, давление, дымоудаление, автоматика безопасности.',
    hood:'Вытяжка: мотор, крыльчатка, жировой фильтр, угольный фильтр.'
  };

  function getKey() {
    return localStorage.getItem(STORAGE_KEY) || '';
  }

  function setKey(key) {
    localStorage.setItem(STORAGE_KEY, key);
  }

  function hasKey() {
    return !!getKey();
  }

  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function saveHistory(history) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
  }

  function clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
  }

  async function sendMessage(text, courseId) {
    const apiKey = getKey();
    if (!apiKey) throw new Error('API ключ не задан. Нажми «Настроить ключ».');

    const model = 'gemini-2.5-flash-lite';
    const context = COURSE_CONTEXT[courseId] || 'Общий контекст: бытовая техника и безопасный подбор запчастей.';
    const history = getHistory();

    const contents = [];

    // Add conversation history
    for (const msg of history) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      });
    }

    // Add current message
    contents.push({ role: 'user', parts: [{ text }] });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: `${SYSTEM_PROMPT}\n\nКонтекст выбранного раздела: ${context}` }]
          },
          contents,
          generationConfig: { temperature: 0.35, maxOutputTokens: 900 }
        })
      }
    );

    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || 'Ошибка Gemini API');

    const answer = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim();
    if (!answer) throw new Error('Миса вернула пустой ответ.');

    // Save to history
    history.push({ role: 'user', text });
    history.push({ role: 'assistant', text: answer });
    saveHistory(history);

    return answer;
  }

  return { getKey, setKey, hasKey, sendMessage, clearHistory, getHistory };
})();
