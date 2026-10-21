"use client";

import { BookOpen, ChevronDown, FileText, Heart, Search, Send, Sparkles } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

const summaries = [
  { title: "מערכת ההובלה בגוף האדם", subject: "ביולוגיה", grade: "כיתה ט׳", pages: 7, tone: "bg-lilac" },
  { title: "פונקציות קוויות — כל מה שצריך", subject: "מתמטיקה", grade: "כיתה ח׳", pages: 5, tone: "bg-yellow" },
  { title: "הלאומיות באירופה במאה ה־19", subject: "היסטוריה", grade: "כיתה י׳", pages: 9, tone: "bg-mint" },
  { title: "מבנה האטום והטבלה המחזורית", subject: "כימיה", grade: "כיתה ט׳", pages: 6, tone: "bg-peach" },
  { title: "סיכום לקראת מבחן — שירת ימי הביניים", subject: "ספרות", grade: "כיתה י״א", pages: 8, tone: "bg-blue" },
  { title: "Past Simple & Present Perfect", subject: "אנגלית", grade: "כיתה ח׳", pages: 4, tone: "bg-pink" },
];
const subjects = ["הכול", "מתמטיקה", "ביולוגיה", "היסטוריה", "כימיה", "ספרות", "אנגלית"];
const grades = ["כל השכבות", "כיתה ח׳", "כיתה ט׳", "כיתה י׳", "כיתה י״א", "כיתה י״ב"];

export default function Home() {
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("הכול");
  const [grade, setGrade] = useState("כל השכבות");
  const [sent, setSent] = useState(false);
  const results = useMemo(() => summaries.filter((item) =>
    (subject === "הכול" || item.subject === subject) && (grade === "כל השכבות" || item.grade === grade) && `${item.title} ${item.subject}`.includes(query.trim())
  ), [query, subject, grade]);
  function submitRequest(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSent(true); event.currentTarget.reset(); }
  return <main>
    <header className="site-header"><a className="brand" href="#top"><span className="brand-mark"><BookOpen size={22} /></span><span>מחברת פתוחה</span></a><nav aria-label="ניווט ראשי"><a href="#summaries">סיכומים</a><a href="#request">בקשי סיכום</a></nav></header>
    <section className="hero" id="top"><div className="hero-copy"><p className="eyebrow"><Sparkles size={16} /> לומדים יחד, בחינם</p><h1>סיכומים טובים<br />פותחים דלתות.</h1><p className="hero-text">מאגר קטן וחופשי של סיכומים ברורים, שנכתב כדי לעשות סדר רגע לפני המבחן.</p><a className="primary-button" href="#summaries">לכל הסיכומים <span>←</span></a></div><div className="hero-art" aria-hidden="true"><div className="sun" /><div className="plant"><i /><i /><i /></div><div className="notebook"><div className="notebook-lines" /><span>לומדים<br />יחד</span><b>✦</b></div><div className="pencil" /><div className="tape tape-one" /><div className="tape tape-two" /></div></section>
    <section className="library" id="summaries"><div className="section-heading"><div><p className="eyebrow">המאגר</p><h2>מה בא לך ללמוד היום?</h2></div><p>כל הסיכומים פתוחים לצפייה ולהורדה.</p></div><div className="filters" aria-label="סינון סיכומים"><label className="search-box"><Search size={19} /><span className="sr-only">חיפוש סיכומים</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="חפשי נושא או מקצוע..." /></label><label className="select-box"><span className="sr-only">מקצוע</span><select value={subject} onChange={(e) => setSubject(e.target.value)}>{subjects.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={16} /></label><label className="select-box"><span className="sr-only">שכבת לימוד</span><select value={grade} onChange={(e) => setGrade(e.target.value)}>{grades.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={16} /></label></div><div className="summary-grid">{results.map((item) => <article className="summary-card" key={item.title}><div className={`file-cover ${item.tone}`}><FileText size={42} strokeWidth={1.5} /><span>{item.subject}</span><i>✦</i></div><div className="card-content"><div className="chip-row"><span>{item.grade}</span><span>{item.pages} עמודים</span></div><h3>{item.title}</h3><p>{item.subject} · PDF</p><button type="button" onClick={() => alert("הקובץ יהיה זמין כאן לאחר העלאתו לאתר.")}>לצפייה בסיכום <span>←</span></button></div></article>)}</div>{!results.length && <p className="empty-state">לא מצאנו סיכום מתאים עדיין. אפשר לשלוח בקשה למטה.</p>}</section>
    <section className="request-section" id="request"><div className="request-intro"><p className="eyebrow"><Heart size={16} /> חסר לך משהו?</p><h2>בקשי סיכום</h2><p>לא מצאת את מה שחיפשת? כתבי מה היית רוצה ללמוד, ואנסה להוסיף אותו למאגר.</p><small>לא צריך להירשם ולא משאירים פרטים אישיים.</small></div><form className="request-form" onSubmit={submitRequest}><label>מקצוע<input required name="subject" placeholder="למשל: גאוגרפיה" /></label><label>שכבת לימוד<input required name="grade" placeholder="למשל: כיתה י׳" /></label><label>מה בדיוק צריך?<textarea required name="details" rows={4} placeholder="נושא, פרק או מבחן שמתקרב..." /></label><button className="primary-button" type="submit"><Send size={17} /> שלחי בקשה</button>{sent && <p className="form-success" role="status">הבקשה נשלחה. תודה שעזרת להרחיב את המאגר!</p>}</form></section>
    <footer>מחברת פתוחה <span>·</span> נבנה באהבה ללמידה <span>✦</span></footer>
  </main>;
}
