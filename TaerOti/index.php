<?php
declare(strict_types=1);

$page = $_GET['page'] ?? '';
$legalPages = [
    'terms' => 'תנאי שימוש',
    'privacy' => 'מדיניות פרטיות',
];
?>
<!doctype html>
<html lang="he" dir="rtl">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="theme-color" content="#14121f">
    <title><?= isset($legalPages[$page]) ? htmlspecialchars($legalPages[$page], ENT_QUOTES, 'UTF-8') . ' | ' : '' ?>תאר אותי</title>
    <link rel="stylesheet" href="style.css">
    <link rel="stylesheet" href="landing.css">
    <link rel="stylesheet" href="results.css">
</head>
<body>
<?php if (isset($legalPages[$page])): ?>
    <main class="shell legal-shell">
        <article class="app legal-page">
            <a class="back-link" href="index.php">← חזרה לדף הבית</a>
            <h1><?= htmlspecialchars($legalPages[$page], ENT_QUOTES, 'UTF-8') ?></h1>
            <?php if ($page === 'terms'): ?>
                <h2>כללי המשחק</h2>
                <p>המשחק מיועד לחוויה חברתית חיובית. יש לבחור כינוי מכבד ולא להשתמש בתוכן פוגעני, מאיים או בלתי חוקי.</p>
                <h2>אחריות המשתתפים</h2>
                <p>כל משתתף אחראי למה שהוא אומר או משתף במהלך המשחק. המארגן אחראי לבחור משתתפים מתאימים ולוודא שהמשחק מתנהל בצורה נעימה ובטוחה.</p>
                <h2>שינויים וזמינות</h2>
                <p>המשחק ניתן כפי שהוא. ייתכנו עדכונים, הפסקות שירות או שינויים בתכונות המשחק ללא הודעה מוקדמת.</p>
            <?php else: ?>
                <h2>איזה מידע נשמר</h2>
                <p>המשחק שומר את הכינוי והדמות שבחרת, קוד החדר, מהלך המשחק והניקוד. מידע זה נחוץ רק כדי לאפשר את המשחק המשותף.</p>
                <h2>Cookies</h2>
                <p>נעשה שימוש ב־Cookie חיוני של session כדי לזהות את המשתתף בחדר גם לאחר רענון הדף. אין צורך בהרשמה או ביצירת חשבון.</p>
                <h2>שיתוף מידע</h2>
                <p>המידע מוצג רק למשתתפי אותו חדר ואינו מיועד למכירה או לשימוש פרסומי. אין להזין מידע אישי רגיש במשחק.</p>
            <?php endif; ?>
            <p class="legal-updated">עודכן לאחרונה: אוקטובר 2026</p>
        </article>
    </main>
<?php else: ?>
    <main class="shell">
        <section id="landing" class="landing" aria-labelledby="landing-title">
            <div class="brand" aria-label="תאר אותי"><span>תאר</span> אותי</div>
            <p class="eyebrow">משחק חברתי של היכרות, צחוק וניחושים</p>
            <h1 id="landing-title">כמה טוב החברים באמת מכירים אותך?</h1>
            <p class="landing-copy">בכל סבב אחד המשתתפים מתאר חבר או חברה במילה אחת, וכל השאר מנסים לנחש במי מדובר. מהירים, מדויקים ומכירים באמת? צוברים נקודות.</p>
            <ul class="how-it-works" aria-label="כך משחקים">
                <li><strong>1.</strong> יוצרים חדר ושולחים הזמנה</li>
                <li><strong>2.</strong> מצטרפים עם שם ודמות</li>
                <li><strong>3.</strong> מתארים, מנחשים וצוברים נקודות</li>
            </ul>
            <button id="start-game" type="button" class="start-button">התחל/י משחק</button>
            <nav class="legal-links" aria-label="מידע משפטי">
                <a href="?page=terms">תנאי שימוש</a>
                <a href="?page=privacy">מדיניות פרטיות</a>
            </nav>
        </section>
        <section id="game-app" class="app" aria-live="polite" hidden>
            <header><b><span>תאר</span> אותי</b><small id="room-code"></small></header>
            <div id="status" role="status"></div>
            <div id="screen"></div>
            <nav class="in-game-legal-links" aria-label="מידע משפטי">
                <a href="?page=terms">תנאי שימוש</a>
                <a href="?page=privacy">מדיניות פרטיות</a>
            </nav>
        </section>
    </main>
    <script src="app.js"></script>
<?php endif; ?>
</body>
</html>
