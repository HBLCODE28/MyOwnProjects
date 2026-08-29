חדשות ישראל LIVE - גרסת InfinityFree
====================================

מה השתנה בגרסה הזאת
--------------------
הגרסה הוסבה לאתר סטטי שמתאים ל-InfinityFree Free Hosting:
- אין server.ps1.
- אין Start.cmd.
- אין Node.js או npm.
- אין .NET.
- אין מסד נתונים.
- אין proxy בצד השרת.
- רוב האתר הוא HTML/CSS/JavaScript בלבד.

איך מעלים ל-InfinityFree
------------------------
1. פתחי את File Manager של חשבון האחסון ב-InfinityFree.
2. היכנסי לתיקייה htdocs של הדומיין/ה-subdomain שלך.
3. מחקי את קובץ ברירת המחדל של InfinityFree אם קיים.
4. העלי לתוך htdocs את כל הקבצים שנמצאים בתיקיית htdocs שב-ZIP הזה:
   index.html
   styles.css
   app.js
   streams.js
   THIRD_PARTY_NOTICES.txt
   .htaccess
5. פתחי את כתובת האתר בדפדפן.

אין צורך להעלות את התיקייה htdocs עצמה אם כבר קיימת htdocs בחשבון - מעלים את התוכן שלה לתוך htdocs הקיימת.

חשוב לגבי שידורים חיים
----------------------
השידורים נטענים ישירות מה-CDN של כל ערוץ אל הדפדפן של הצופה. InfinityFree לא מעביר את הווידאו דרך השרת שלו.
זה מכוון: שירות האחסון החינמי של InfinityFree אינו מתאים לשמש כ-video proxy או כשרת streaming.

קשת 12
------
בגרסה המקומית היה proxy קטן כדי להתמודד עם הגבלות של ספק הווידאו. ב-InfinityFree אסור להשתמש ב-proxy כזה, ולכן גרסה זו משתמשת ישירות בשלושה מקורות HLS שפורסמו על ידי N12 בזמן הכנת הגרסה.
אם קשת תשנה את הכתובות או תחסום ניגון מאתר חיצוני, הערוץ עלול להפסיק לעבוד עד לעדכון streams.js. במקרה כזה עדיין קיים כפתור לפתיחת האתר הרשמי.

לוח כאן 11
-----------
הגרסה המקומית קראה HTML של אתר חיצוני ועיבדה אותו בצד השרת. InfinityFree אוסר שימוש בסקריפטים של scraping/crawling/proxy, ולכן הפעולה הזאת הוסרה מהגרסה לאחסון החינמי.
כפתור לוח השידורים של כאן פותח את הלוח הרשמי בתוך חלון כאשר האתר של כאן מאפשר iframe. אם הוא חוסם iframe, השתמשי בכפתור "פתיחה באתר הרשמי".

מזג אוויר
----------
מזג האוויר ממשיך לפעול ישירות מהדפדפן מול Open-Meteo. אין צורך ב-PHP.

קבצים עיקריים
-------------
index.html  - מבנה האתר
styles.css  - עיצוב
app.js      - נגנים, פריסה, איכות, מסך מלא, מזג אוויר ולוחות
streams.js  - רשימת הערוצים ומקורות ה-HLS
.htaccess   - הגדרות בסיסיות ל-Apache/InfinityFree

Git
---
אם הפרויקט שלך נמצא בתוך:
C:\Users\Cyber_User\Documents\Projects\israel-news-multiview

אחרי שתעתיקי את קבצי גרסת InfinityFree לפרויקט:

git status
git add "israel-news-multiview"
git commit -m "Add InfinityFree deployment version"
git push
