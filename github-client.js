/**
 * Клиент GitHub API для записи ошибок и дополнений из чата.
 * Использует персональный токен ( scope: repo ).
 */
const GitHubClient = (() => {
  const TOKEN_KEY = 'irka-github-token';
  const REPO = 'Evitator30/irka-vseznaika';

  function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
  function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
  function hasToken() { return !!getToken(); }

  async function getFileContent(path) {
    const token = getToken();
    if (!token) throw new Error('GitHub токен не задан.');
    const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' }
    });
    if (!res.ok) throw new Error(`GitHub API: ${res.status}`);
    const data = await res.json();
    return { content: atob(data.content.replace(/\n/g, '')), sha: data.sha };
  }

  async function appendToFile(path, header, text) {
    const { content, sha } = await getFileContent(path);
    const timestamp = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
    const entry = `\n### ${timestamp}\n${text}\n`;
    const newContent = content + entry;
    const token = getToken();
    const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `${header}: ${text.slice(0, 80)}...`,
        content: btoa(unescape(encodeURIComponent(newContent))),
        sha
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `GitHub API: ${res.status}`);
    }
    return true;
  }

  async function reportError(text) {
    return appendToFile('errors.md', 'Ошибка от Ирины', text);
  }

  async function reportAddition(text) {
    return appendToFile('additions.md', 'Дополнение от Ирины', text);
  }

  return { getToken, setToken, hasToken, reportError, reportAddition };
})();
