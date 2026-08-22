Auto Brightness for VLC - Windows Installer Builder
===================================================

המטרה:
ליצור קובץ אחד:
  dist\AutoBrightnessSetup.exe

המתקין הסופי:
- מזהה אוטומטית VLC 3.x ב-32-bit וב-64-bit.
- מתקין את ה-DLL המתאים לכל VLC שנמצא.
- מפעיל autobrightness כברירת מחדל ב-vlcrc בלי למחוק פילטרים אחרים.
- מאפס את מטמון התוספים של VLC.
- מוסיף Uninstall ל-Windows Apps & Features.
- בהסרה מוחק את התוסף ומסיר autobrightness מ-video-filter.

בניית המתקין במחשב שבו בוצעו ה-builds:
1. ודא ששני הקבצים קיימים:
   \\wsl.localhost\Ubuntu\home\cyber_user\vlc-build32\win32\modules\.libs\libautobrightness_plugin.dll
   \\wsl.localhost\Ubuntu\home\cyber_user\vlc-build\win64\modules\.libs\libautobrightness_plugin.dll

2. לחץ פעמיים על:
   BUILD_INSTALLER.cmd

3. אם NSIS לא מותקן ו-winget זמין, הסקריפט יתקין NSIS אוטומטית.

4. בסיום ייווצר:
   dist\AutoBrightnessSetup.exe

הערה:
המתקין מיועד ל-VLC 3.x. הוא לא מתקין את התוסף על VLC 4.x.
