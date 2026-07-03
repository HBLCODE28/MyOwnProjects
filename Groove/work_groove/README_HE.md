# Groove

**Pick what you love.**

Groove היא אפליקציית Windows להורדת מוזיקה וסרטונים. היא מאפשרת לחפש אמנים, אלבומים, שירים וסרטונים, לבדוק את הרשימה לפני ההורדה, להסיר פריטים לא רצויים, ולהפריד בין הורדת שירים כ-MP3 לבין הורדת סרטונים כ-MP4.

## מבנה התיקייה

התיקייה התקינה צריכה להיראות כך:

```text
Groove
  build_exe.bat
  build_installer.bat
  main.py
  requirements.txt
  assets\
  installer\
  music_downloader_app\
  vendor\
```

## בדיקה לפני בנייה

פתחי CMD בתיקיית הפרויקט והריצי:

```bat
run_dev.bat
```

אם האפליקציה נפתחת, אפשר לבנות EXE או Installer.

## בניית EXE בלבד

```bat
build_exe.bat
```

בסיום ייווצר:

```text
dist\Groove.exe
```

זה מתאים למחשב שלך, אבל אם את רוצה לשלוח למחשב אחר בצורה מסודרת, עדיף לבנות Installer.

## בניית Installer מלא

צריך להתקין Inno Setup 6 רק במחשב שבו בונים את האפליקציה. המחשב שמקבל את ההתקנה לא צריך Inno Setup, Python, requirements או קבצי פרויקט.

אחרי שהתקנת Inno Setup, הריצי:

```bat
build_installer.bat
```

בסיום ייווצר:

```text
installer\GrooveSetup.exe
```

זה הקובץ ששולחים למחשב אחר. הוא מתקין את Groove כמו אפליקציה רגילה: Start Menu shortcut, אפשרות לקיצור דרך בשולחן העבודה, והסרה דרך Apps & Features של Windows.

## FFmpeg

האפליקציה צריכה FFmpeg בשביל הורדת MP3/MP4 תקינה.

כדי שה-Installer יעבוד גם במחשב שאין בו FFmpeg, שימי את הקובץ כאן לפני בניית ה-Installer:

```text
vendor\ffmpeg\bin\ffmpeg.exe
```

אם לא תשימי שם את `ffmpeg.exe`, ה-Installer עדיין ייבנה, אבל במחשב שאין בו FFmpeg מותקן ההורדות עלולות להיכשל.

## שם, מוטו ולוגו

שם האפליקציה בקוד הוא:

```text
Groove
```

המוטו שמופיע מתחת לשם באפליקציה הוא:

```text
Pick what you love.
```

הלוגו הפעיל הוא:

```text
assets\app_icon.ico
```

נוספו אפשרויות דומות ללוגו שביקשת:

```text
assets\logo_options\groove_record_purple.ico
assets\logo_options\groove_record_blue.ico
assets\logo_options\groove_record_dark.ico
```

כדי להחליף לוגו, העתיקי אחד מהם מעל:

```text
assets\app_icon.ico
```

ואז בנה מחדש:

```bat
build_installer.bat
```


## שינויים בגרסה v5

- הכנת רשימת ההורדה לאמן/אלבום עוברת עכשיו ברקע, כדי שהחלון הראשי לא יקפא בזמן בדיקת אלבומים, סינגלים, covers ו-unreleased.
- חלונות CMD שנפתחו בזמן הורדה/המרה הוסתרו באמצעות הרצה שקטה של yt-dlp ו-FFmpeg.

## קבצים שאפשר לשלוח לאחרים

לא שולחים את כל תיקיית הפרויקט. שולחים רק:

```text
installer\GrooveSetup.exe
```

זה קובץ ההתקנה הסופי.


## תיקון עטיפות אלבומים - v6

בגרסה זו האפליקציה שומרת `cover.jpg` בתיקיית האלבום וגם מטמיעה את העטיפה בתוך קובצי ה-MP3 בעזרת Mutagen, בלי לפתוח חלון CMD נוסף. בנוסף, אם Cover Art Archive לא מחזיר עטיפה ל-release-group, האפליקציה בודקת גם releases ספציפיים של אותו אלבום.
