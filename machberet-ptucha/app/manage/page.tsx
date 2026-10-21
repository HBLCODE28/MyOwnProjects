"use client";

import { CheckCircle2, FileUp, Inbox, LogOut, Plus, Settings, Upload } from "lucide-react";
import { FormEvent, useState } from "react";

const incoming = [
  ["גאוגרפיה", "כיתה י׳", "סיכום על אקלים ומזג אוויר", "היום"],
  ["אזרחות", "כיתה י״ב", "עקרונות הדמוקרטיה", "אתמול"],
  ["מתמטיקה", "כיתה ט׳", "פירוק לגורמים", "לפני 3 ימים"],
];

export default function ManagePage() {
  const [view, setView] = useState<"dashboard" | "upload">("dashboard");
  const [done, setDone] = useState(false);
  function upload(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setDone(true); }
  return <main className="admin-shell">
    <aside className="admin-side"><a className="brand" href="/"><span className="brand-mark">מ</span><span>מחברת פתוחה</span></a><div className="admin-label">ניהול האתר</div><button className={view === "dashboard" ? "side-active" : ""} onClick={() => setView("dashboard")}><Inbox size={18} /> בקשות מבקרים <b>3</b></button><button className={view === "upload" ? "side-active" : ""} onClick={() => setView("upload")}><FileUp size={18} /> העלאת סיכום</button><button><Settings size={18} /> הגדרות</button><a className="logout" href="/"><LogOut size={18} /> יציאה</a></aside>
    <section className="admin-main">{view === "dashboard" ? <><header className="admin-head"><div><p>שלום!</p><h1>בקשות חדשות</h1></div><button className="admin-add" onClick={() => setView("upload")}><Plus size={18} /> העלאת סיכום</button></header><div className="admin-note"><Inbox size={22} /><span>הבקשות אנונימיות — אין בהן פרטים אישיים של תלמידים.</span></div><div className="request-list">{incoming.map(([subject, grade, text, date]) => <article key={text}><div className="request-icon">✦</div><div><div className="admin-tags"><span>{subject}</span><span>{grade}</span></div><h2>{text}</h2><p>נשלח {date}</p></div><button className="handle"><CheckCircle2 size={18} /> סמן כטופל</button></article>)}</div></> : <><header className="admin-head"><div><p>המאגר</p><h1>העלאת סיכום חדש</h1></div></header><form className="upload-form" onSubmit={upload}><label>כותרת הסיכום<input required placeholder="למשל: מערכת ההובלה בגוף האדם" /></label><div><label>מקצוע<input required placeholder="למשל: ביולוגיה" /></label><label>שכבת לימוד<input required placeholder="למשל: כיתה ט׳" /></label></div><label>תיאור קצר<textarea rows={3} placeholder="מה כולל הסיכום?" /></label><label className="drop-zone"><Upload size={27} /><strong>בחירת קובץ</strong><span>PDF, Word או תמונה · עד 25MB</span><input type="file" required accept=".pdf,.docx,.png,.jpg,.jpeg" /></label><button className="admin-add" type="submit">פרסום הסיכום</button>{done && <p className="form-success">הסיכום מוכן לפרסום לאחר חיבור האחסון.</p>}</form></>}</section>
  </main>;
}
