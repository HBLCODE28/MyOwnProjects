StreamLocal Website Portable
============================

הפעלה:
1. חלצו את כל התיקייה.
2. לחצו פעמיים על Start StreamLocal.cmd.
3. StreamLocal ייפתח בדפדפן ב-http://127.0.0.1:17836

אין צורך ב-Node.js, npm, Python או .NET במחשב הזה.

תיקיות מקומיות:
Library -> Add folder
בחרו תיקייה דרך חלון Chrome/Edge.

תיקיות רשת / NAS:
Library -> Add network path
הדביקו נתיב UNC ישיר, לדוגמה:
\\SERVER\Movies
\\NAS\Series

אין צורך למפות את התיקייה ל-Z: ואין צורך ב-Shortcut.
Windows חייב להיות מסוגל לפתוח את ה-share עם המשתמש הנוכחי. אם נדרשים credentials, פתחו את ה-share פעם אחת ב-File Explorer והתחברו אליו, ואז נסו שוב ב-StreamLocal.

Network folders זמינים רק כאשר האתר הופעל דרך Start StreamLocal.cmd על פורט 17836. בזמן npm run dev הכפתור קיים, אבל החיבור לרשת יציג הודעה שצריך את Website Portable.

האתר נשאר אתר רגיל בדפדפן. השרת המקומי הקטן משמש להגשת קבצי האתר ולקריאת תיקיות רשת בלבד.
