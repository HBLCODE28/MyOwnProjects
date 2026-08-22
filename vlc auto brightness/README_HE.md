# VLC Auto Brightness - VLC 3.x

פילטר וידאו native ל-VLC שמזהה אוטומטית פריימים חשוכים ומבהיר בעיקר צללים ו-midtones בלי להרים בצורה אגרסיבית highlights.

## מה הוא עושה

- מנתח כל פריים בזמן הניגון. אין בחירת פריים ידנית.
- דוגם מספר קטן של פיקסלי luminance מכל פריים במקום לסרוק את כל הפיקסלים לצורך ההחלטה.
- מחשב histogram ו-p10, p50, p90, p95.
- אם ה-p50 נמוך מסף החושך, מחשב gamma אוטומטי.
- אם ה-p95 גבוה, מקטין את התיקון כדי לשמור על highlights.
- מגן על fade-to-black ופריימים כמעט שחורים כדי לא להפוך מסך שחור לאפור.
- משתמש ב-attack/release smoothing כדי למנוע קפיצות בין פריימים ושוטים.
- כאשר אין צורך בתיקון, מחזיר את הפריים המקורי בלי copy מלא.
- כאשר יש תיקון, מעתיק את הפריים ומשנה רק את ערכי ה-Y/luma. צבעי U/V נשארים ללא שינוי.

הפילטר אינו עושה pre-scan של כל הקובץ לפני הניגון. הוא מנתח את כל הסרט באופן רציף בזמן הניגון, ולכן אין decode כפול של סרט שלם ואין המתנה לפני תחילת צפייה.

## ברירות מחדל

- dark threshold: 90
- target median: 104
- black-frame p90: 24
- highlight guard p95: 210
- max gamma: 1.50
- strength: 1.0
- attack: 220 ms
- release: 850 ms
- target samples: בערך 12,000 לפריים

ב-1080p וב-4K, מספר דגימות ההחלטה נשאר בערך באותו סדר גודל כי sample step מחושב אוטומטית לפי גודל הפריים.

## פורמטים נתמכים ב-V1

8-bit:

- I420 / J420 / YV12
- I411 / I410
- I422 / J422
- I444 / J444
- YUVA
- NV12 / NV21 / NV16 / NV61 / NV24 / NV42
- GREY
- UYVY / VYUY / YUYV / YVYU

9/10-bit planar:

- I420 9-bit
- I444 9-bit
- I420 10-bit
- I444 10-bit

P010 ו-surfaces opaque של D3D11/DXVA אינם מטופלים ישירות ב-V1. אם VLC אינו מכניס converter אוטומטי והפילטר לא מופעל עם hardware decoding, נסה לבטל hardware-accelerated decoding ב-VLC. זה עלול להעלות שימוש CPU.

## מבנה הפרויקט

- `src/autobrightness.c` - adapter של VLC והפעלת הפילטר
- `src/autobrightness_algo.c` - אלגוריתם histogram, gamma, smoothing ו-LUT
- `src/autobrightness_algo.h` - API של האלגוריתם
- `tests/test_algo.c` - בדיקות unit ללא VLC
- `tests/run_tests.sh` - קומפילציה והרצת הבדיקות
- `scripts/integrate_vlc3.py` - שילוב אוטומטי בתוך source tree של VLC 3.x
- `scripts/enable_vlc3_windows.ps1` - הוספת `autobrightness` ל-`video-filter` ב-vlcrc
- `scripts/disable_vlc3_windows.ps1` - הסרת הפילטר מהגדרת VLC

## בדיקת האלגוריתם

Linux/WSL:

```bash
./tests/run_tests.sh
```

תוצאה צפויה:

```text
autobrightness algorithm tests: PASS
```

## שילוב בתוך VLC 3.x

נניח ש-source tree של VLC נמצא ב-`~/vlc-3.0`:

```bash
python3 scripts/integrate_vlc3.py ~/vlc-3.0
```

הסקריפט:

1. מעתיק את שלושת קבצי המקור אל `modules/video_filter/`.
2. מוסיף `libautobrightness_plugin_la_SOURCES` ל-`modules/video_filter/Makefile.am`.
3. מוסיף `libautobrightness_plugin.la` ל-`video_filter_LTLIBRARIES`.

אחרי השילוב צריך להריץ מחדש את build system של VLC, לדוגמה:

```bash
cd ~/vlc-3.0
./bootstrap
```

לאחר configure/build תקין של VLC ניתן לבנות את מודול הווידאו מתוך build tree. שם ה-plugin שייווצר הוא בדרך כלל:

```text
libautobrightness_plugin.dll
```

ב-Windows הוא צריך להיות בתוך תיקיית plugins של VLC, תחת `plugins/video_filter/`, ואז יש לאפס את plugin cache.

דוגמה:

```powershell
& "C:\Program Files\VideoLAN\VLC\vlc.exe" --reset-plugins-cache vlc://quit
```

## הפעלה זמנית לבדיקה

```text
vlc.exe --video-filter=autobrightness "movie.mkv"
```

עם debug:

```text
vlc.exe --video-filter=autobrightness --autobrightness-debug "movie.mkv"
```

## הפעלה אוטומטית לכל סרט ופרק ב-Windows

אחרי שה-DLL מותקן:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\enable_vlc3_windows.ps1
```

הסקריפט מגבה את `vlcrc` לפני שינויו ומוסיף `autobrightness` ל-`video-filter` הקיים במקום למחוק פילטרים אחרים.

לביטול:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\disable_vlc3_windows.ps1
```

## כוונון

דוגמה לתיקון עדין יותר:

```text
--autobrightness-strength=0.75 --autobrightness-max-gamma=1.35
```

דוגמה לתיקון חזק יותר לסדרות חשוכות במיוחד:

```text
--autobrightness-dark-threshold=100 --autobrightness-target-median=112 --autobrightness-max-gamma=1.60
```

לא מומלץ להעלות `max-gamma` בצורה קיצונית. gamma גבוה מדי ירים noise ו-compression artifacts בצללים גם אם highlights עצמם לא נשרפים.

## הערות ביצועים

ההחלטה אם פריים חשוך משתמשת ב-grid sampling בלבד. ברירת המחדל מכוונת לכ-12,000 samples לפריים, לא למיליוני פיקסלים.

כאשר correction פעיל, הפילטר חייב לעבור על מישור ה-Y המלא כדי להחיל LUT. זו פעולה O(width * height), אבל כל פיקסל דורש lookup קטן בלבד. כאשר correction לא פעיל, אין מעבר מלא נוסף ואין העתקת frame.

## מגבלות V1

- מיועד ל-VLC 3.x API.
- VLC 4.x דורש port נפרד ל-plugin API החדש.
- אין GPU implementation ייעודי ל-D3D11 בגרסה הזו.
- HDR/P010 אינו מטופל ישירות. עבור HDR עדיף tone mapping ייעודי ולא gamma SDR פשוט.
- לא בוצעה כאן קומפילציה של ה-DLL מול build מלא של VLC, כי סביבת הפרויקט אינה כוללת את VLC toolchain וה-import libraries. האלגוריתם העצמאי כן קומפל ועבר את בדיקות ה-unit המצורפות.
