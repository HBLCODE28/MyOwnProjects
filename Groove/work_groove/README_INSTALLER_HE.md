# בניית Installer ל-Groove

## מטרה

ה-Installer הסופי הוא:

```text
installer\GrooveSetup.exe
```

זה הקובץ שמתקין את Groove במחשב אחר בלי צורך ב-Python, בלי requirements, ובלי תיקיית הפרויקט.

## מה צריך רק במחשב הבנייה

1. Python מותקן.
2. Inno Setup 6 מותקן.
3. FFmpeg בתוך:

```text
vendor\ffmpeg\bin\ffmpeg.exe
```

FFmpeg לא חובה לבניית ה-Installer, אבל הוא חובה אם רוצים שהאפליקציה תעבוד גם במחשבים שאין בהם FFmpeg מותקן.

## פקודת בנייה

פתחי CMD בתיקיית הפרויקט והריצי:

```bat
build_installer.bat
```

הסקריפט עושה שלושה דברים:

1. בונה `dist\Groove.exe` עם PyInstaller.
2. בודק אם Inno Setup קיים.
3. מייצר את `installer\GrooveSetup.exe`.

## מה לשלוח למשתמש אחר

שלחי רק:

```text
installer\GrooveSetup.exe
```

המשתמש האחר לא צריך את קבצי הקוד, תיקיית assets, תיקיית services, Python או Inno Setup.
