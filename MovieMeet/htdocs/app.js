const API = 'api/index.php';
const TOKEN_KEY = 'moviemeeet_token';
let authMode = 'login';
let currentEvent = null;
let cinemas = [];
let signedInUser = null;

const app = document.querySelector('#app');
const getToken = () => localStorage.getItem(TOKEN_KEY) || '';
const setToken = token => localStorage.setItem(TOKEN_KEY, token);
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));

async function api(action, options = {}) {
  const headers = {...(options.headers || {})};
  if (getToken()) {
    headers.Authorization = `Bearer ${getToken()}`;
    headers['X-Auth-Token'] = getToken();
  }
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${API}?${new URLSearchParams({action, ...(options.query || {})})}`, {...options, headers});
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'אירעה שגיאה. נסו שוב.');
  return payload;
}

function setTemplate(id) { app.replaceChildren(document.querySelector(`#${id}`).content.cloneNode(true)); }
function showError(id, error) { const element = document.querySelector(`#${id}`); element.textContent = error.message || error; element.classList.remove('hidden'); }
function today() { return new Date().toISOString().slice(0, 10); }

async function renderHeader() {
  const area = document.querySelector('#accountArea');
  if (!getToken()) { signedInUser = null; area.innerHTML = '<button class="secondary header-button" data-open="auth">כניסה / הרשמה</button>'; return; }
  try {
    const user = signedInUser || (await api('me')).user;
    if (!user) throw new Error('Not signed in');
    signedInUser = user;
    area.innerHTML = `<span class="account-name">${escapeHtml(user.name)}</span><button id="logout" class="secondary header-button">יציאה</button>`;
    document.querySelector('#logout')?.addEventListener('click', () => { localStorage.removeItem(TOKEN_KEY); signedInUser = null; renderHeader(); renderHome(); });
  } catch { localStorage.removeItem(TOKEN_KEY); renderHeader(); }
}

function renderHome() {
  currentEvent = null;
  setTemplate('homeTemplate');
  document.querySelector('[data-open="create"]').addEventListener('click', () => getToken() ? renderCreate() : renderAuth('register'));
}

function renderAuth(mode = 'login') {
  authMode = mode;
  setTemplate('authTemplate');
  const title = document.querySelector('#authTitle');
  const name = document.querySelector('#authName');
  const switchButton = document.querySelector('#authSwitch');
  title.textContent = mode === 'login' ? 'כניסה לחשבון' : 'יצירת חשבון';
  name.closest('label').classList.toggle('hidden', mode === 'login');
  name.required = mode !== 'login';
  document.querySelector('#authSubmit').textContent = mode === 'login' ? 'כניסה' : 'יצירת חשבון';
  switchButton.textContent = mode === 'login' ? 'אין חשבון? הרשמה' : 'כבר יש חשבון? כניסה';
  switchButton.addEventListener('click', () => renderAuth(mode === 'login' ? 'register' : 'login'));
  document.querySelector('[data-open="home"]').addEventListener('click', renderHome);
  document.querySelector('#authSubmit').addEventListener('click', async () => {
    try {
      const payload = {email: document.querySelector('#authEmail').value.trim(), password: document.querySelector('#authPassword').value};
      if (mode === 'register') payload.name = name.value.trim();
      const response = await api(mode, {method:'POST', body:JSON.stringify(payload)});
      setToken(response.token); signedInUser = response.user || null; await renderHeader();
      const token = new URLSearchParams(location.search).get('event');
      token ? renderEvent(token) : renderCreate();
    } catch (error) { showError('authError', error); }
  });
}

function renderCreate() {
  setTemplate('createTemplate');
  const start = document.querySelector('[name="date_start"]'); const end = document.querySelector('[name="date_end"]');
  start.min = end.min = today(); start.value = today(); end.value = today();
  document.querySelector('[data-open="home"]').addEventListener('click', renderHome);
  document.querySelector('#createForm').addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const form = new FormData(event.currentTarget);
      const response = await api('event-create', {method:'POST', body:JSON.stringify(Object.fromEntries(form))});
      history.pushState({}, '', `?event=${response.token}`); renderEvent(response.token);
    } catch (error) { showError('createError', error); }
  });
}

function addWindow(container, date = today(), start = '19:00', end = '23:00') {
  const row = document.createElement('div'); row.className = 'window-row';
  row.innerHTML = `<input type="date" name="window_date" value="${date}" required><input type="time" name="window_start" value="${start}" required><input type="time" name="window_end" value="${end}" required><button class="remove-window" type="button" aria-label="הסרת חלון">×</button>`;
  row.querySelector('.remove-window').addEventListener('click', () => row.remove()); container.append(row);
}

async function renderEvent(token) {
  setTemplate('eventTemplate');
  const data = await api('event', {query:{token}}).catch(error => { app.innerHTML = `<section class="card"><h1>לא ניתן לפתוח את המפגש</h1><p class="form-error">${escapeHtml(error.message)}</p></section>`; return null; });
  if (!data) return;
  currentEvent = data;
  const {event, participants, candidates} = data;
  document.querySelector('#eventName').textContent = event.name;
  document.querySelector('#eventDates').textContent = `${event.date_start} עד ${event.date_end}`;
  document.querySelector('#participantCount').textContent = `${participants.length} משתתפים`;
  document.querySelector('#copyLink').addEventListener('click', async () => { await navigator.clipboard?.writeText(location.href); document.querySelector('#copyLink').textContent = 'הקישור הועתק'; });
  const windows = document.querySelector('#windows'); addWindow(windows, event.date_start);
  document.querySelector('#addWindow').addEventListener('click', () => addWindow(windows, event.date_start));
  document.querySelector('#joinForm').addEventListener('submit', joinEvent);
  document.querySelector('#organizerCard').classList.toggle('hidden', !event.is_organizer);
  if (event.is_organizer) setupCandidateForm(token, event);
  renderParticipants(participants);
  renderRecommendations(candidates, token);
}

async function joinEvent(event) {
  event.preventDefault();
  try {
    const form = new FormData(event.currentTarget);
    const availability = [...document.querySelectorAll('.window-row')].map(row => ({date:row.querySelector('[name="window_date"]').value,start:row.querySelector('[name="window_start"]').value,end:row.querySelector('[name="window_end"]').value})).filter(window => window.date && window.start && window.end && window.start < window.end);
    const genres = String(form.get('genres') || '').split(',').map(item => item.trim()).filter(Boolean);
    await api('join', {method:'POST', query:{token:currentEvent.event.token}, body:JSON.stringify({name:form.get('name'),city:form.get('city'),genres,availability})});
    renderEvent(currentEvent.event.token);
  } catch (error) { showError('joinError', error); }
}

async function setupCandidateForm(token, event) {
  if (!cinemas.length) cinemas = (await api('cinemas')).cinemas;
  const select = document.querySelector('#cinemaSelect');
  select.innerHTML = '<option value="">בחרו קולנוע</option>' + cinemas.map(cinema => `<option value="${cinema.id}">${escapeHtml(cinema.network)} — ${escapeHtml(cinema.name)}</option>`).join('');
  const form = document.querySelector('#candidateForm');
  form.querySelector('[name="show_date"]').min = event.date_start; form.querySelector('[name="show_date"]').max = event.date_end; form.querySelector('[name="show_date"]').value = event.date_start;
  let movieSearchTimer = null;
  document.querySelector('#movieSearch').addEventListener('input', input => {
    clearTimeout(movieSearchTimer);
    const query = input.target.value.trim();
    movieSearchTimer = setTimeout(async () => {
      const results = document.querySelector('#movieResults');
      if (query.length < 2) { results.classList.add('hidden'); return; }
      try {
        const response = await api('movies', {query:{q:query}});
        results.innerHTML = response.movies.map(movie => `<button type="button" data-id="${movie.id}" data-poster="${escapeHtml(movie.poster_path)}" data-title="${escapeHtml(movie.title)}">${escapeHtml(movie.title)}</button>`).join('') || `<span>${escapeHtml(response.notice || 'לא נמצאו סרטים')}</span>`;
        results.classList.remove('hidden');
        results.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
          form.querySelector('[name="movie_title"]').value = button.dataset.title;
          form.querySelector('[name="tmdb_id"]').value = button.dataset.id;
          form.querySelector('[name="poster_path"]').value = button.dataset.poster;
          results.classList.add('hidden');
        }));
      } catch { results.classList.add('hidden'); }
    }, 350);
  });
  form.addEventListener('submit', async submit => {
    submit.preventDefault();
    try {
      const values = Object.fromEntries(new FormData(form));
      values.genres = String(values.genres || '').split(',').map(item => item.trim()).filter(Boolean);
      await api('candidate-create', {method:'POST', query:{token}, body:JSON.stringify(values)});
      renderEvent(token);
    } catch (error) { showError('candidateError', error); }
  });
}

function renderParticipants(participants) {
  const list = document.querySelector('#participantList');
  list.innerHTML = participants.length ? participants.map(participant => `<li><strong>${escapeHtml(participant.name)}</strong><span>${escapeHtml(participant.city)} · ${participant.genres.map(escapeHtml).join(', ') || 'כל הסוגות'}</span></li>`).join('') : '<li>עדיין לא הצטרפו חברים.</li>';
}

function renderRecommendations(candidates, token) {
  const target = document.querySelector('#recommendations');
  if (!candidates.length) { target.innerHTML = '<article class="card"><h3>אין עדיין הצעות</h3><p>המארגן יכול להוסיף הקרנה שמצא באתר קולנוע רשמי.</p></article>'; return; }
  target.innerHTML = candidates.map((candidate, index) => `<article class="recommendation ${index === 0 ? 'top' : ''}"><span class="score">${candidate.score.total}</span><p class="eyebrow">${escapeHtml(candidate.network)} · ${escapeHtml(candidate.cinema_city)}</p><h3>${escapeHtml(candidate.movie_title)}</h3><p>${escapeHtml(candidate.cinema_name)} · ${candidate.show_date} · ${String(candidate.show_time).slice(0,5)}</p><p>${candidate.genres.map(escapeHtml).join(' · ') || 'ללא סוגות'}</p><div class="score-details"><span>זמינות ${candidate.score.availability}/45</span><span>סוגות ${candidate.score.genres}/35</span><span>נסיעה ${candidate.score.travel}/20</span><span>עד ${candidate.score.max_travel_minutes} דק׳</span></div><div class="actions"><a class="secondary" href="${escapeHtml(candidate.booking_url)}" target="_blank" rel="noopener">בדיקת מושבים באתר הקולנוע</a><button class="vote ${candidate.my_vote == 1 ? 'active' : ''}" data-vote="1" data-id="${candidate.id}">👍 ${candidate.votes.yes_votes || 0}</button><button class="vote ${candidate.my_vote == -1 ? 'active' : ''}" data-vote="-1" data-id="${candidate.id}">👎 ${candidate.votes.no_votes || 0}</button>${candidate.seats_checked == 1 ? '<span class="seats">מישהו אישר שיש מקומות</span>' : `<button class="vote" data-seats="${candidate.id}">מצאתי מקומות</button>`}</div></article>`).join('');
  target.querySelectorAll('[data-vote]').forEach(button => button.addEventListener('click', async () => { try { await api('vote', {method:'POST', query:{token}, body:JSON.stringify({candidate_id:Number(button.dataset.id),vote:Number(button.dataset.vote)})}); renderEvent(token); } catch (error) { alert(error.message); } }));
  target.querySelectorAll('[data-seats]').forEach(button => button.addEventListener('click', async () => { try { await api('seats-checked', {method:'POST', query:{token}, body:JSON.stringify({candidate_id:Number(button.dataset.seats)})}); renderEvent(token); } catch (error) { alert(error.message); } }));
}

document.addEventListener('click', event => { const opener = event.target.closest('[data-open]'); if (!opener) return; if (opener.dataset.open === 'home') renderHome(); if (opener.dataset.open === 'auth') renderAuth('login'); });
window.addEventListener('popstate', () => { const token = new URLSearchParams(location.search).get('event'); token ? renderEvent(token) : renderHome(); });
renderHeader();
const initialToken = new URLSearchParams(location.search).get('event');
initialToken ? renderEvent(initialToken) : renderHome();
