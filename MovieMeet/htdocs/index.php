<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#5fa8d3">
  <title>MovieMeet — קובעים סרט יחד</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="style.css?v=2">
  <style>.auth-card .text-button{margin-top:12px}#accountArea{display:flex;align-items:center;gap:10px}</style>
</head>
<body>
  <header class="site-header"><a class="brand" href="index.php">MovieMeet</a><div id="accountArea"></div></header>
  <main id="app" class="app-shell" aria-live="polite"></main>
  <template id="homeTemplate">
    <section class="hero"><p class="eyebrow">קובעים סרט בלי אינסוף הודעות</p><h1>מוצאים ערב שמתאים לכולם.</h1><p>חברים בוחרים עיר, שעות וסגנונות. MovieMeet מדרג את הרעיונות ומאפשר להצביע יחד.</p><button class="primary" data-open="create">יוצרים מפגש חדש</button></section>
    <section class="info-grid"><article><strong>1</strong><h2>שולחים קישור</h2><p>כל חבר משתף מתי נוח לו, מאיפה הוא מגיע ומה הוא אוהב לראות.</p></article><article><strong>2</strong><h2>מקבלים סדר</h2><p>המערכת מאזנת זמינות, סגנונות וזמן נסיעה לכל הקבוצה.</p></article><article><strong>3</strong><h2>מצביעים ומזמינים</h2><p>פותחים את עמוד ההזמנה הרשמי, בודקים מושבים וסוגרים ערב.</p></article></section>
  </template>
  <template id="authTemplate">
    <section class="card auth-card"><button class="link-back" data-open="home">חזרה</button><h1 id="authTitle">כניסה</h1><div class="form-grid"><label>שם<input id="authName" maxlength="80" autocomplete="name"></label><label>אימייל<input id="authEmail" type="email" autocomplete="email" required></label><label>סיסמה<input id="authPassword" type="password" minlength="8" autocomplete="current-password" required></label></div><p id="authError" class="form-error hidden"></p><button id="authSubmit" class="primary">כניסה</button><button id="authSwitch" class="text-button">אין חשבון? הרשמה</button></section>
  </template>
  <template id="createTemplate">
    <section class="card"><button class="link-back" data-open="home">חזרה</button><h1>מפגש סרט חדש</h1><p>המארגן מוסיף מועמדים אחרי שהחברים מצטרפים.</p><form id="createForm" class="form-grid"><label>שם המפגש<input name="name" maxlength="120" placeholder="למשל: ערב סרט של החבורה" required></label><label>מתאריך<input name="date_start" type="date" required></label><label>עד תאריך<input name="date_end" type="date" required></label><button class="primary">יוצרים קישור למפגש</button></form><p id="createError" class="form-error hidden"></p></section>
  </template>
  <template id="eventTemplate">
    <section class="event-head"><p class="eyebrow">מפגש סרט</p><h1 id="eventName"></h1><p id="eventDates"></p><button id="copyLink" class="secondary">העתקת קישור לחברים</button></section>
    <section id="joinCard" class="card"><h2>הזמינות שלי</h2><p>אפשר להצטרף גם בלי חשבון. כדי להצביע ולשמור העדפות, יש להיכנס לחשבון.</p><form id="joinForm" class="form-grid"><label>שם<input name="name" maxlength="80" required></label><label>עיר מוצא<select name="city" required><option value="">בחרו עיר</option><option>תל אביב</option><option>ירושלים</option><option>ראשון לציון</option><option>חיפה</option><option>מודיעין</option><option>נתניה</option><option>רמת גן</option><option>פתח תקווה</option><option>הרצליה</option><option>באר שבע</option></select></label><label>סגנונות אהובים<input name="genres" maxlength="160" placeholder="למשל: קומדיה, אקשן, דרמה"></label><div class="availability"><div class="row-title"><strong>חלונות זמן</strong><button id="addWindow" class="text-button" type="button">+ הוספת חלון</button></div><div id="windows"></div></div><button class="primary">שמירת הזמינות</button></form><p id="joinError" class="form-error hidden"></p></section>
    <section id="organizerCard" class="card hidden"><h2>הוספת הקרנה</h2><p>מוסיפים רעיון שמצאת באתר הקולנוע הרשמי. בהמשך יתאפשר איסוף שעות אוטומטי.</p><form id="candidateForm" class="form-grid"><label>קולנוע<select name="cinema_id" id="cinemaSelect" required></select></label><label>חיפוש סרט ב־TMDb<input id="movieSearch" autocomplete="off" placeholder="הקלידו לפחות שתי אותיות"></label><div id="movieResults" class="movie-results hidden"></div><label>שם הסרט<input name="movie_title" maxlength="180" required></label><input name="tmdb_id" type="hidden"><input name="poster_path" type="hidden"><label>סגנונות הסרט<input name="genres" maxlength="160" placeholder="למשל: קומדיה, דרמה"></label><label>תאריך<input name="show_date" type="date" required></label><label>שעה<input name="show_time" type="time" required></label><button class="primary">הוספת רעיון לדירוג</button></form><p id="candidateError" class="form-error hidden"></p></section>
    <section><div class="section-heading"><div><p class="eyebrow">הצעות מדורגות</p><h2>מה הכי מתאים לכולם?</h2></div><span id="participantCount" class="pill"></span></div><div id="recommendations" class="recommendations"></div></section>
    <section class="card"><h2>מי כבר מילא?</h2><ul id="participantList" class="participant-list"></ul></section>
  </template>
  <script src="app.js?v=4"></script>
</body>
</html>
