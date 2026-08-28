StreamLocal Website Portable
============================

זוהי גרסת אתר רגילה, לא גרסת Windows App.

במחשב השני:
1. חלצו את כל התיקייה StreamLocal-Website-Portable.
2. הפעילו את Start StreamLocal.cmd.
3. הדפדפן ייפתח בכתובת הקבועה:
   http://127.0.0.1:17836/

אין צורך להתקין Node.js, npm, Vite, Python או .NET.

חשוב:
- אל תפתחו app\index.html ישירות עם file://.
- אל תמחקו את התיקייה app.
- שמרו את כל תיקיית ה-Portable ביחד.
- כדי להעביר Library/Watched/Resume, השתמשו ב-Settings -> Export Library
  במחשב הישן וב-Settings -> Import Library במחשב החדש.
- לאחר Import צריך לחבר מחדש את תיקיות המדיה, כי הרשאות File System Access
  אינן עוברות ממחשב למחשב.
- הכתובת נשארת תמיד 127.0.0.1:17836 כדי ש-IndexedDB וההרשאות יישארו
  תחת אותו origin.
