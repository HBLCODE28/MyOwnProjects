const API = 'api/index.php';
const TOKEN_KEY = 'moviemeeet_token';
let currentEvent = null;
let cinemas = [];
let signedInUser = null;
const ISRAEL_CITIES = ['אבו גוש','אופקים','אור יהודה','אור עקיבא','אילת','אלעד','אריאל','אשדוד','אשקלון','באקה אל-גרבייה','באר יעקב','באר שבע','בית שאן','בית שמש','ביתר עילית','בני ברק','בת ים','גבעת שמואל','גבעתיים','דימונה','הוד השרון','הרצליה','חדרה','חולון','חיפה','חריש','טבריה','טייבה','טירה','טירת כרמל','טמרה','יבנה','יהוד-מונוסון','יוקנעם עילית','ירושלים','כפר יונה','כפר סבא','כפר קאסם','כרמיאל','לוד','מעלה אדומים','מגדל העמק','מודיעין-מכבים-רעות','מודיעין עילית','מגדל העמק','מעלה עירון','מעלות-תרשיחא','נהריה','נוף הגליל','נס ציונה','נצרת','נשר','נתיבות','נתניה','סחנין','עכו','עפולה','עראבה','ערד','פתח תקווה','צפת','קלנסווה','קריית אונו','קריית אתא','קריית ביאליק','קריית גת','קריית ים','קריית מוצקין','קריית מלאכי','קריית שמונה','קריית טבעון','ראש העין','ראשון לציון','רהט','רחובות','רמלה','רמת גן','רמת השרון','רעננה','שדרות','שוהם','טייבה','טירה','טמרה','תל אביב-יפו','תל מונד','אבן יהודה','אזור','אורנית','אילת השחר','אליכין','אפרת','באר טוביה','בנימינה-גבעת עדה','גדרה','גן יבנה','גן נר','גני תקווה','דליית אל-כרמל','זכרון יעקב','חצור הגלילית','חוף הכרמל','יסוד המעלה','כוכב יאיר צור יגאל','כפר ורדים','כפר תבור','כפר שמריהו','להבים','מבשרת ציון','מיתר','מזכרת בתיה','מטולה','מיתר','נוף איילון','נחף','נירית','סביון','עומר','עמנואל','פרדס חנה-כרכור','פרדסיה','קדימה-צורן','קצרין','קריית ארבע','קריית יערים','ראש פינה','רכסים','שיבלי-אום אל-גנם','שלומי','תל שבע'];
const GENRES = ['אקשן','אנימציה','הרפתקאות','דרמה','מדע בדיוני','מתח','מוזיקה','משפחה','פשע','פנטזיה','קומדיה','רומנטיקה','תעודה','אימה'];

const app = document.querySelector('#app');
const getToken = () => localStorage.getItem(TOKEN_KEY) || '';
const setToken = token => localStorage.setItem(TOKEN_KEY, token);
const manageKey = token => `moviemeeet_manage_${token}`;
const participantKey = token => `moviemeeet_participant_${token}`;
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
const initials = name => String(name ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('') || 'ח';

async function api(action, options = {}) {
  const headers = {...(options.headers || {})};
  headers['X-MovieMeet-Action'] = action;
  if (options.query?.token) {
    const manager = localStorage.getItem(manageKey(options.query.token)); const participant = localStorage.getItem(participantKey(options.query.token));
    if (manager) headers['X-MovieMeet-Manage'] = manager;
    if (participant) headers['X-MovieMeet-Participant'] = participant;
  }
  if (getToken()) {
    headers.Authorization = `Bearer ${getToken()}`;
    headers['X-Auth-Token'] = getToken();
  }
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const query = new URLSearchParams(options.query || {});
  const response = await fetch(query.size ? `${API}?${query}` : API, {...options, headers});
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = payload.code ? ` (${payload.code})` : '';
    throw new Error(`${payload.error || 'אירעה שגיאה. נסו שוב.'}${code}`);
  }
  return payload;
}

function setTemplate(id) { app.replaceChildren(document.querySelector(`#${id}`).content.cloneNode(true)); }
function showError(id, error) { const element = document.querySelector(`#${id}`); element.textContent = error.message || error; element.classList.remove('hidden'); }
function today() { return new Date().toISOString().slice(0, 10); }

async function renderHeader() {
  const area = document.querySelector('#accountArea');
  if (!getToken()) { signedInUser = null; area.innerHTML = '<button class="secondary header-button" data-open="auth">ניהול</button>'; return; }
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
  document.querySelector('[data-open="create"]').addEventListener('click', renderCreate);
  if (getToken()) loadHomeMeetings();
}

async function loadHomeMeetings() {
  try {
    const {user, meetings} = await api('meetings');
    const stats = user.is_admin ? await api('admin-stats') : null;
    if (stats) {
      document.querySelector('#homeProfile').classList.remove('hidden');
      document.querySelector('#homeProfileText').textContent = `שלום ${user.name}, כאן אפשר לעקוב אחרי הפעילות באתר.`;
      document.querySelector('#adminStats').innerHTML = `<div class="admin-stat"><strong>${Number(stats.events)}</strong><span>מפגשים</span></div><div class="admin-stat"><strong>${Number(stats.participants)}</strong><span>משתתפים</span></div><div class="admin-stat"><strong>${Number(stats.candidates)}</strong><span>הקרנות</span></div>`;
    }
    const section = document.querySelector('#myMeetingsSection'); section.classList.remove('hidden');
    document.querySelector('#myMeetings').innerHTML = meetings.length ? meetings.map(meeting => `<article class="meeting-card"><div><strong>${escapeHtml(meeting.name)}</strong><p>${meeting.date_start} עד ${meeting.date_end}</p></div><button class="secondary" data-meeting="${meeting.token}">פתיחת מפגש</button></article>`).join('') : '<p>עדיין אין מפגשים. אפשר ליצור את הראשון.</p>';
    document.querySelectorAll('[data-meeting]').forEach(button => button.addEventListener('click', () => { history.pushState({}, '', `?event=${button.dataset.meeting}`); renderEvent(button.dataset.meeting); }));
  } catch { }
}

function renderAuth() {
  setTemplate('authTemplate');
  document.querySelector('[data-open="home"]').addEventListener('click', renderHome);
  document.querySelector('#authSubmit').addEventListener('click', async () => {
    try {
      const payload = {email: document.querySelector('#authEmail').value.trim(), password: document.querySelector('#authPassword').value};
      const response = await api('login', {method:'POST', body:JSON.stringify(payload)});
      setToken(response.token); signedInUser = response.user || null; await renderHeader();
      const token = new URLSearchParams(location.search).get('event');
      token ? renderEvent(token) : renderHome();
    } catch (error) { showError('authError', error); }
  });
}

function renderCreate() {
  setTemplate('createTemplate');
  const start = document.querySelector('[name="date_start"]'); const end = document.querySelector('[name="date_end"]');
  start.min = end.min = today(); start.value = today(); end.value = today();
  start.addEventListener('change', () => { end.min = start.value; if (end.value < start.value) end.value = start.value; });
  enableCalendarPickers(app);
  document.querySelector('[data-open="home"]').addEventListener('click', renderHome);
  document.querySelector('#createForm').addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const form = new FormData(event.currentTarget);
      const response = await api('meeting-create', {method:'POST', body:JSON.stringify(Object.fromEntries(form))});
      localStorage.setItem(manageKey(response.token), response.manage_token);
      history.pushState({}, '', `?event=${response.token}`); renderEvent(response.token);
    } catch (error) { showError('createError', error); }
  });
}

function timeOptions(selected) { return Array.from({length:96}, (_, index) => { const value = `${String(Math.floor(index / 4)).padStart(2, '0')}:${String((index % 4) * 15).padStart(2, '0')}`; return `<option value="${value}"${value === selected ? ' selected' : ''}>${value}</option>`; }).join(''); }
function enableCalendarPickers(root) {
  root.querySelectorAll('input[type="date"]').forEach(input => input.addEventListener('click', () => { try { input.showPicker?.(); } catch { } }));
}
function addWindow(container, date = today(), start = '19:00', end = '23:00', minDate = '', maxDate = '') {
  const row = document.createElement('div'); row.className = 'window-row';
  row.innerHTML = `<input type="date" name="window_date" value="${date}" min="${minDate}" max="${maxDate}" required><select name="window_start" required>${timeOptions(start)}</select><select name="window_end" required>${timeOptions(end)}</select><button class="remove-window" type="button" aria-label="הסרת חלון">×</button>`;
  row.querySelector('.remove-window').addEventListener('click', () => row.remove()); container.append(row);
  enableCalendarPickers(row);
}
function meetingDates(start, end) {
  const dates = []; const cursor = new Date(`${start}T12:00:00`); const last = new Date(`${end}T12:00:00`);
  while (cursor <= last) { dates.push(cursor.toISOString().slice(0, 10)); cursor.setDate(cursor.getDate() + 1); }
  return dates;
}
function addRandomWindow(container, startDate, endDate) {
  const slots = [['09:00','13:00'],['12:00','16:00'],['15:00','19:00'],['18:00','22:00'],['20:00','23:45']];
  const used = new Set([...container.querySelectorAll('.window-row')].map(row => `${row.querySelector('[name="window_date"]').value}|${row.querySelector('[name="window_start"]').value}|${row.querySelector('[name="window_end"]').value}`));
  const dates = meetingDates(startDate, endDate);
  const unusedDates = dates.filter(date => ![...used].some(value => value.startsWith(`${date}|`)));
  const choices = (unusedDates.length ? unusedDates : dates).flatMap(date => slots.map(([start, end]) => ({date, start, end})).filter(window => !used.has(`${window.date}|${window.start}|${window.end}`)));
  const choice = choices[Math.floor(Math.random() * choices.length)];
  if (choice) addWindow(container, choice.date, choice.start, choice.end, startDate, endDate);
}

function setupGenres() {
  const liked = new Set(); const disliked = new Set();
  const render = (target, kind) => {
    target.innerHTML = GENRES.map(genre => `<button class="genre-button ${kind}" type="button" data-genre="${genre}">${genre}</button>`).join('');
    target.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
      const genre = button.dataset.genre; const current = kind === 'disliked' ? disliked : liked; const other = kind === 'disliked' ? liked : disliked;
      current.has(genre) ? current.delete(genre) : current.add(genre); other.delete(genre);
      document.querySelector('[name="genres"]').value = JSON.stringify([...liked]);
      document.querySelector('[name="disliked_genres"]').value = JSON.stringify([...disliked]);
      document.querySelectorAll(`[data-genre="${genre}"]`).forEach(item => item.classList.toggle('selected', (item.classList.contains('disliked') ? disliked : liked).has(genre)));
    }));
  };
  render(document.querySelector('#likedGenres'), 'liked'); render(document.querySelector('#dislikedGenres'), 'disliked');
}

async function renderEvent(token) {
  setTemplate('eventTemplate');
  enableCalendarPickers(app);
  const data = await api('meeting', {query:{token}}).catch(error => { app.innerHTML = `<section class="card"><h1>לא ניתן לפתוח את המפגש</h1><p class="form-error">${escapeHtml(error.message)}</p></section>`; return null; });
  if (!data) return;
  currentEvent = data;
  const {event, participants, candidates} = data;
  document.querySelector('#eventName').textContent = event.name;
  document.querySelector('#eventDates').textContent = `${event.date_start} עד ${event.date_end}`;
  document.querySelector('#participantCount').textContent = `${participants.length} משתתפים`;
  document.querySelector('#israelCities').innerHTML = [...new Set(ISRAEL_CITIES)].sort((first, second) => first.localeCompare(second, 'he')).map(city => `<option value="${city}">`).join('');
  if (data.my_participant) {
    const nameInput = document.querySelector('[name="name"]');
    nameInput.value = data.my_participant.name || '';
    nameInput.readOnly = true;
    document.querySelector('#nameLockHint').classList.remove('hidden');
    document.querySelector('[name="city"]').value = data.my_participant.city || '';
    document.querySelector('#joinForm').classList.add('hidden');
    const complete = document.querySelector('#joinComplete');
    complete.textContent = `ההעדפות נשמרו בשם ${data.my_participant.name}. כבר מילאת את ההעדפות למפגש הזה.`;
    complete.classList.remove('hidden');
  } else {
    setupGenres();
    const windows = document.querySelector('#windows');
    addWindow(windows, event.date_start, '19:00', '23:00', event.date_start, event.date_end);
    document.querySelector('#addWindow').addEventListener('click', () => addRandomWindow(windows, event.date_start, event.date_end));
    document.querySelector('#joinForm').addEventListener('submit', joinEvent);
  }
  document.querySelector('#copyLink').addEventListener('click', async () => { await navigator.clipboard?.writeText(location.href); document.querySelector('#copyLink').textContent = 'הקישור הועתק'; });
  document.querySelectorAll('[data-event-view]').forEach(button => button.addEventListener('click', () => {
    const view = button.dataset.eventView;
    document.querySelectorAll('.event-pane').forEach(pane => pane.classList.toggle('hidden', pane.dataset.pane !== view));
    document.querySelectorAll('[data-event-view]').forEach(tab => tab.classList.toggle('active', tab === button));
  }));
  document.querySelectorAll('.event-pane').forEach(pane => pane.classList.toggle('hidden', pane.dataset.pane !== 'suggestions'));
  document.querySelector('#organizerCard').classList.toggle('hidden', !event.is_organizer);
  if (event.is_organizer) setupCandidateForm(token, event, data.cinema_options || {cinemas: []}, data.my_participant?.city || '');
  renderParticipants(participants);
  renderRecommendations(candidates, token, event.is_organizer);
}

async function joinEvent(event) {
  event.preventDefault();
  try {
    const form = new FormData(event.currentTarget);
    const availability = [...document.querySelectorAll('.window-row')].map(row => ({date:row.querySelector('[name="window_date"]').value,start:row.querySelector('[name="window_start"]').value,end:row.querySelector('[name="window_end"]').value})).filter(window => window.date && window.start && window.end && window.start < window.end);
    const genres = JSON.parse(String(form.get('genres') || '[]'));
    const dislikedGenres = JSON.parse(String(form.get('disliked_genres') || '[]'));
    const response = await api('join', {method:'POST', query:{token:currentEvent.event.token}, body:JSON.stringify({name:form.get('name'),city:form.get('city'),genres,disliked_genres:dislikedGenres,availability})});
    localStorage.setItem(participantKey(currentEvent.event.token), response.participant_token);
    renderEvent(currentEvent.event.token);
  } catch (error) { showError('joinError', error); }
}

function setupCandidateForm(token, event, response, city) {
  const select = document.querySelector('#cinemaSelect');
  cinemas = response.cinemas || [];
  select.innerHTML = '<option value="">בחרו קולנוע</option>' + cinemas.map(cinema => `<option value="${cinema.id}">${escapeHtml(cinema.network)} — ${escapeHtml(cinema.name)}</option>`).join('');
  select.disabled = !cinemas.length;
  document.querySelector('#cinemaNote').textContent = cinemas.length ? (city ? (response.exact ? `מוצגים בתי קולנוע ב${city}.` : response.nearby ? `אין בית קולנוע ברשימה ב${city}; מוצגות האפשרויות הקרובות ביותר.` : `לא נמצאה התאמת מרחק ל${city}; מוצגים כל בתי הקולנוע.`) : 'מוצגים כל בתי הקולנוע.') : 'לא נמצאו בתי קולנוע. נסו לרענן את העמוד.';
  const form = document.querySelector('#candidateForm');
  form.querySelector('[name="show_date"]').min = event.date_start; form.querySelector('[name="show_date"]').max = event.date_end; form.querySelector('[name="show_date"]').value = event.date_start;
  document.querySelector('#showTime').innerHTML = `<option value="">בחרו שעה</option>${timeOptions('20:00')}`;
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
  list.innerHTML = participants.length ? participants.map(participant => `<li><strong>${escapeHtml(participant.name)}</strong><span>${escapeHtml(participant.city)} · ${participant.genres.map(escapeHtml).join(', ') || 'כל הסגנונות'}</span></li>`).join('') : '<li>עדיין לא הצטרפו חברים.</li>';
}

function renderRecommendations(candidates, token, isOrganizer) {
  const target = document.querySelector('#recommendations');
  if (!candidates.length) { target.innerHTML = '<article class="card"><h3>אין עדיין הצעות</h3><p>המארגן יכול להוסיף הקרנה שמצא באתר קולנוע רשמי.</p></article>'; return; }
  target.innerHTML = candidates.map((candidate, index) => {
    const participantCount = Number(candidate.score.participant_count) || 0;
    const availableCount = Number(candidate.score.available) || 0;
    const availableNames = Array.isArray(candidate.score.available_participants) ? candidate.score.available_participants : [];
    const availabilityText = `${availableCount} ${availableCount === 1 ? 'חבר זמין' : 'חברים זמינים'}${participantCount > availableCount ? ` מתוך ${participantCount}` : ''}`;
    const availabilityAvatars = availableNames.slice(0, 4).map(name => `<span class="availability-avatar" title="${escapeHtml(name)}" aria-label="${escapeHtml(name)}">${escapeHtml(initials(name))}</span>`).join('') + (availableNames.length > 4 ? `<span class="availability-avatar more">+${availableNames.length - 4}</span>` : '');
    const genresText = candidate.score.genres >= 24 ? 'הסרט מתאים לרוב הסגנונות שנבחרו' : 'הסרט מתאים לחלק מהסגנונות שנבחרו';
    const travelText = `זמן הנסיעה הארוך ביותר: עד ${candidate.score.max_travel_minutes} דקות`;
    return `<article class="recommendation ${index === 0 ? 'top' : ''}"><p class="match-label">${candidate.score.total >= 75 ? 'התאמה גבוהה לקבוצה' : candidate.score.total >= 50 ? 'התאמה טובה לקבוצה' : 'התאמה חלקית לקבוצה'}</p><p class="eyebrow">${escapeHtml(candidate.network)} · ${escapeHtml(candidate.cinema_city)}</p><h3>${escapeHtml(candidate.movie_title)}</h3><p>${escapeHtml(candidate.cinema_name)} · ${candidate.show_date} · ${String(candidate.show_time).slice(0,5)}</p><p>${candidate.genres.map(escapeHtml).join(' · ') || 'ללא סגנונות'}</p><div class="score-details"><div class="score-detail"><strong>זמינות</strong><div class="availability-people"><div class="availability-avatars">${availabilityAvatars}</div><span>${availabilityText}</span></div></div><div class="score-detail"><strong>סגנונות</strong><span>${genresText}</span></div><div class="score-detail"><strong>נסיעה</strong><span>${travelText}</span></div></div><div class="actions"><a class="secondary" href="${escapeHtml(cinemaSearchUrl(candidate))}" target="_blank" rel="noopener">חיפוש והזמנת מושבים</a><button class="vote ${candidate.my_vote == 1 ? 'active' : ''}" data-vote="1" data-id="${candidate.id}">👍 ${candidate.votes.yes_votes || 0}</button><button class="vote ${candidate.my_vote == -1 ? 'active' : ''}" data-vote="-1" data-id="${candidate.id}">👎 ${candidate.votes.no_votes || 0}</button>${candidate.seats_checked == 1 ? '<span class="seats">מישהו אישר שיש מקומות</span>' : `<button class="vote" data-seats="${candidate.id}">מצאתי מקומות</button>`}${isOrganizer ? `<button class="vote delete-candidate" data-delete="${candidate.id}">מחיקת הקרנה</button>` : ''}</div></article>`;
  }).join('');
  target.querySelectorAll('[data-vote]').forEach(button => button.addEventListener('click', async () => { try { await api('vote', {method:'POST', query:{token}, body:JSON.stringify({candidate_id:Number(button.dataset.id),vote:Number(button.dataset.vote)})}); renderEvent(token); } catch (error) { alert(error.message); } }));
  target.querySelectorAll('[data-seats]').forEach(button => button.addEventListener('click', async () => { try { await api('seats-checked', {method:'POST', query:{token}, body:JSON.stringify({candidate_id:Number(button.dataset.seats)})}); renderEvent(token); } catch (error) { alert(error.message); } }));
  target.querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', async () => { if (!confirm('למחוק את ההקרנה?')) return; try { await api('candidate-delete', {method:'POST', query:{token}, body:JSON.stringify({candidate_id:Number(button.dataset.delete)})}); renderEvent(token); } catch (error) { alert(error.message); } }));
}

function cinemaSearchUrl(candidate) {
  if (candidate.network === 'Cinema City') return `https://www.cinema-city.co.il/search?q=${encodeURIComponent(candidate.movie_title)}`;
  const domain = candidate.network === 'HOT Cinema' ? 'hotcinema.co.il' : 'movieland.co.il';
  return `https://www.google.com/search?q=${encodeURIComponent(`site:${domain} ${candidate.movie_title}`)}`;
}

document.addEventListener('click', event => { const opener = event.target.closest('[data-open]'); if (!opener) return; if (opener.dataset.open === 'home') renderHome(); if (opener.dataset.open === 'auth') renderAuth(); });
window.addEventListener('popstate', () => { const token = new URLSearchParams(location.search).get('event'); token ? renderEvent(token) : renderHome(); });
renderHeader();
const initialToken = new URLSearchParams(location.search).get('event');
initialToken ? renderEvent(initialToken) : renderHome();
