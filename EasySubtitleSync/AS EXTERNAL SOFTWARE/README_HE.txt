Easy Subtitle Sync for VLC v1.0

מה תוקן
=======
השגיאה:
There is no Runspace available to run scripts in this thread
נגרמה בגלל BackgroundWorker של PowerShell.

בגרסה הזאת אין BackgroundWorker.
ה-helper מופעל כתהליך Windows נסתר והחלון בודק את מצבו עם Timer שפועל על ה-UI thread.

נראות
=====
- התוכנה אינה נמצאת תחת View של VLC.
- נוצר קיצור דרך על שולחן העבודה וב-Start Menu.
- החלון אינו Fullscreen.
- אפשר לשנות את הגודל.
- אפשר לגלול.
- Keep above VLC מסומן כברירת מחדל כדי שהתוכנה תישאר גלויה מעל VLC.

התקנה
=====
1. חלץ את ה-ZIP.
2. הפעל INSTALL.bat.
3. פתח Easy Subtitle Sync for VLC משולחן העבודה.

אם v0.9 כבר מותקנת ויש לה FFmpeg עובד, המתקין של v1.0 משתמש בו אוטומטית לפני החלפת ההתקנה הישנה.

העברה Offline למחשב אחר
========================
במחשב שבו התוכנה עובדת:
1. הפעל BUILD_OFFLINE_PACKAGE.bat.
2. יווצר EasySubtitleSync_v1.0_Offline.zip.
3. העבר אותו למחשב החדש.
4. חלץ והפעל INSTALL.bat.
5. אין הורדות בזמן ההתקנה במחשב החדש.
