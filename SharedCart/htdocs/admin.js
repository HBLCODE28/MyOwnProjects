'use strict';

const API = '/api';
const LANGUAGE_KEY = 'cg_language';

const TABLER_SPRITE_URL = '/img/tabler-icons.svg';
const ADMIN_TIME_ZONE = 'Asia/Jerusalem';

const I18N = {
  he:{desktopOnlyTitle:'לוח הניהול זמין במחשב',desktopOnlyText:'מטעמי בטיחות ונוחות, לוח הניהול נפתח רק במסך ברוחב 1024 פיקסלים ומעלה.',backToSite:'חזרה לאתר',adminConsole:'מסוף ניהול',overview:'סקירה',users:'משתמשים',groups:'קבוצות',content:'תוכן',moderation:'סינון תוכן',audit:'יומן מנהל',health:'תקינות מערכת',workspace:'SharedCart workspace',days:'ימים',searchPlaceholder:'חיפוש',exportCsv:'ייצוא CSV',totalUsers:'משתמשים',activeUsers:'משתמשים פעילים',totalGroups:'קבוצות',activeItems:'פריטים פעילים',actions:'פעולות',blockedUsers:'משתמשים חסומים',pendingJoinRequests:'בקשות הצטרפות ממתינות',moderationEvents:'חסימות תוכן',activityTrend:'פעילות לפי יום',popularItems:'הפריטים הנצרכים ביותר',topConsumers:'מי לקח הכי הרבה',topWriters:'מי כתב הכי הרבה',topGroups:'הקבוצות הפעילות ביותר',anomalies:'פעילות חריגה',noData:'אין נתונים להצגה',status:'סטטוס',all:'הכל',active:'פעיל',blocked:'חסום',deleted:'נמחק',admins:'מנהלים',name:'שם',email:'אימייל',role:'תפקיד',groupsCount:'קבוצות',itemsAdded:'פריטים',completed:'נלקחו',comments:'הערות',lastLogin:'כניסה אחרונה',created:'נוצר',operations:'פעולות',block:'חסום זמנית',unblock:'בטל חסימה',delete:'מחק',restore:'שחזר',permanentDelete:'מחיקה סופית',permanentDeleteWarning:'הפעולה תמחק לצמיתות את המשתמש ואת הנתונים המקושרים אליו, כולל קבוצות שבבעלותו, פריטים, הערות והיסטוריה. לא ניתן לשחזר פעולה זו.',deletedUser:'משתמש שנמחק',yes:'כן',no:'לא',makeAdmin:'הפוך למנהל',makeUser:'הפוך למשתמש',blockUser:'חסימת משתמש',blockReason:'סיבת החסימה',blockHours:'משך החסימה בשעות',cancel:'ביטול',confirm:'אישור',owner:'יוצר',members:'חברים',lastActivity:'פעילות אחרונה',viewStats:'סטטיסטיקות',groupStats:'סטטיסטיקות קבוצה',items:'פריטים',terms:'מילים חסומות',events:'אירועי חסימה',addTerm:'הוסף מילה',term:'מילה או ביטוי',language:'שפה',severity:'חומרה',hebrew:'עברית',english:'English',save:'שמור',field:'שדה',matchedTerm:'מילה שנחסמה',excerpt:'קטע טקסט',user:'משתמש',date:'תאריך',action:'פעולה',target:'יעד',details:'פרטים',systemStatus:'מצב מערכת',database:'מסד נתונים',uploads:'אחסון תמונות',phpVersion:'גרסת PHP',serverTime:'זמן מערכת - שעון ישראל',healthy:'תקין',unavailable:'לא זמין',page:'עמוד',of:'מתוך',previous:'הקודם',next:'הבא',itemContent:'פריטים',commentContent:'הערות',loading:'טוען נתונים...',adminRequired:'אין הרשאת מנהל',contentBlocked:'הטקסט כולל מילה פוגענית או אסורה. יש לערוך אותו ולנסות שוב.',success:'הפעולה הושלמה',period:'תקופה',reports:'דיווחים',openReports:'דיווחים פתוחים',reporter:'מדווח',reason:'סיבה',resolve:'סגור דיווח',dismiss:'דחה דיווח',resolutionNote:'הערת טיפול',open:'פתוח',resolved:'טופל',dismissed:'נדחה',systemErrors:'שגיאות מערכת',storageUsed:'נפח אחסון',recentErrors:'שגיאות אחרונות',route:'נתיב',message:'הודעה',targetType:'סוג יעד',reportStatus:'מצב דיווח',showAll:'הכל',reportActions:'טיפול',resolveReport:'טיפול בדיווח',systemEvents:'אירועי מערכת',changeUsername:'שנה שם משתמש',resetPassword:'שלח איפוס סיסמה',newUsername:'שם משתמש חדש',passwordResetSent:'קוד איפוס נשלח באימייל',usernameRequired:'יש להזין שם משתמש',recentActivity:'פעולות אחרונות',activityItem:'פריט',activityQuantity:'כמות',securityAlerts:'התראות אבטחה',runFullCheck:'הרצת בדיקה מלאה',runningScan:'בודק את המערכת...',fullSecurityCheck:'בדיקת מערכת ואבטחה מלאה',markAlertsRead:'סמן התראות כנקראו',scanScore:'ציון אבטחה',passedChecks:'בדיקות תקינות',warningChecks:'אזהרות',criticalChecks:'תקלות חמורות',lastScan:'מועד בדיקה',loginProtection:'הגנת התחברות',failedLogins24h:'כניסות שנכשלו ב-24 שעות',successfulLogins24h:'כניסות מוצלחות ב-24 שעות',adminAttempts24h:'ניסיונות גישה למנהל ב-24 שעות',blockedLoginKeys:'חסימות התחברות פעילות',uploadFiles:'מספר תמונות',diskFree:'מקום פנוי',uploadLimits:'מגבלות העלאה',serverSoftware:'שרת',securityEvents:'אירועי אבטחה אחרונים',eventType:'סוג אירוע',ipAddress:'כתובת IP',browser:'דפדפן',occurrences:'מספר ניסיונות',firstSeen:'זוהה לראשונה',lastSeen:'זוהה לאחרונה',unread:'חדש',read:'נקרא',passStatus:'תקין',warningStatus:'אזהרה',criticalStatus:'חמור',scanExplanation:'הבדיקה מבצעת סריקה מעמיקה של JWT ועוגיות, HTTPS וכותרות אבטחה, הרשאות קבצים, קובצי העלאה ותוכן MIME, תקינות מסד הנתונים, הרשאות DB, דפוסי PHP חשודים וניסיונות התחברות.',relativePath:'נתיב יחסי',files:'קבצים',memoryLimit:'מגבלת זיכרון',fileUploads:'העלאת קבצים',enabled:'פעיל',disabled:'כבוי',securityCheckResults:'תוצאות בדיקת האבטחה',securityDetails:'פרטים',emailUsage:'שליחת אימיילים',emailsSent24h:'נשלחו ב-24 שעות',emailsRemaining:'נותרו לפי מונה האתר',emailFailures24h:'שליחות שנכשלו',emailUsageWarning:'מתקרבים למגבלת השליחה של Gmail. מומלץ לצמצם שליחות עד שהמונה יורד.',emailUsageCritical:'כמעט הגעת למגבלת השליחה של Gmail. שליחות נוספות עלולות להיחסם.',emailTrackingNote:'המונה כולל רק אימיילים שנשלחו מהאתר ולא הודעות שנשלחו ידנית מחשבון Gmail.',downloadSecurityReport:'הורדת דוח אבטחה',preparingSecurityReport:'מכין דוח...',securityReportReady:'דוח האבטחה הורד',securityReportNeedsScan:'יש להריץ בדיקה מלאה לפני הורדת הדוח'},
  en:{desktopOnlyTitle:'Admin dashboard is available on desktop',desktopOnlyText:'For safety and usability, the admin dashboard opens only on screens 1024px wide or larger.',backToSite:'Back to site',adminConsole:'Admin console',overview:'Overview',users:'Users',groups:'Groups',content:'Content',moderation:'Content moderation',audit:'Admin audit',health:'System health',workspace:'SharedCart workspace',days:'days',searchPlaceholder:'Search',exportCsv:'Export CSV',totalUsers:'Users',activeUsers:'Active users',totalGroups:'Groups',activeItems:'Active items',actions:'Actions',blockedUsers:'Blocked users',moderationEvents:'Blocked submissions',activityTrend:'Activity by day',popularItems:'Most consumed items',topConsumers:'Top consumers',topWriters:'Top contributors',topGroups:'Most active groups',anomalies:'Unusual activity',noData:'No data to display',status:'Status',all:'All',active:'Active',blocked:'Blocked',deleted:'Deleted',admins:'Admins',name:'Name',email:'Email',role:'Role',groupsCount:'Groups',itemsAdded:'Items',completed:'Completed',comments:'Comments',lastLogin:'Last login',created:'Created',operations:'Actions',block:'Temporary block',unblock:'Unblock',delete:'Delete',restore:'Restore',permanentDelete:'Delete permanently',permanentDeleteWarning:'This permanently deletes the user and related data, including owned groups, items, comments and history. This action cannot be undone.',deletedUser:'Deleted user',yes:'Yes',no:'No',makeAdmin:'Make admin',makeUser:'Make user',blockUser:'Block user',blockReason:'Block reason',blockHours:'Block duration in hours',cancel:'Cancel',confirm:'Confirm',owner:'Owner',members:'Members',lastActivity:'Last activity',viewStats:'View statistics',groupStats:'Group statistics',items:'Items',terms:'Blocked terms',events:'Blocked events',addTerm:'Add term',term:'Word or phrase',language:'Language',severity:'Severity',hebrew:'Hebrew',english:'English',save:'Save',field:'Field',matchedTerm:'Matched term',excerpt:'Text excerpt',user:'User',date:'Date',action:'Action',target:'Target',details:'Details',systemStatus:'System status',database:'Database',uploads:'Image storage',phpVersion:'PHP version',serverTime:'System time - Israel',healthy:'Healthy',unavailable:'Unavailable',page:'Page',of:'of',previous:'Previous',next:'Next',itemContent:'Items',commentContent:'Comments',loading:'Loading data...',adminRequired:'Administrator access is required',contentBlocked:'The text contains offensive or blocked language. Edit it and try again.',success:'Operation completed',period:'Period',reports:'Reports',openReports:'Open reports',reporter:'Reporter',reason:'Reason',resolve:'Resolve report',dismiss:'Dismiss report',resolutionNote:'Resolution note',open:'Open',resolved:'Resolved',dismissed:'Dismissed',systemErrors:'System errors',storageUsed:'Storage used',recentErrors:'Recent errors',route:'Route',message:'Message',targetType:'Target type',reportStatus:'Report status',showAll:'All',reportActions:'Review',resolveReport:'Review report',systemEvents:'System events',changeUsername:'Change username',resetPassword:'Send password reset',newUsername:'New username',passwordResetSent:'A reset code was sent by email',usernameRequired:'Enter a username',recentActivity:'Recent activity',activityItem:'Item',activityQuantity:'Quantity',securityAlerts:'Security alerts',runFullCheck:'Run full check',runningScan:'Checking the system...',fullSecurityCheck:'Full system and security check',markAlertsRead:'Mark alerts as read',scanScore:'Security score',passedChecks:'Passed checks',warningChecks:'Warnings',criticalChecks:'Critical issues',lastScan:'Scan time',loginProtection:'Login protection',failedLogins24h:'Failed logins in 24 hours',successfulLogins24h:'Successful logins in 24 hours',adminAttempts24h:'Admin access attempts in 24 hours',blockedLoginKeys:'Active login blocks',uploadFiles:'Image files',diskFree:'Free storage',uploadLimits:'Upload limits',serverSoftware:'Server',securityEvents:'Recent security events',eventType:'Event type',ipAddress:'IP address',browser:'Browser',occurrences:'Occurrences',firstSeen:'First seen',lastSeen:'Last seen',unread:'New',read:'Read',passStatus:'Passed',warningStatus:'Warning',criticalStatus:'Critical',scanExplanation:'The scan performs deep checks of JWT and cookies, HTTPS and security headers, file permissions, upload MIME integrity, database consistency and privileges, suspicious PHP patterns, and authentication activity.',relativePath:'Relative path',files:'Files',memoryLimit:'Memory limit',fileUploads:'File uploads',enabled:'Enabled',disabled:'Disabled',securityCheckResults:'Security check results',securityDetails:'Details',emailUsage:'Email sending',emailsSent24h:'Sent in the last 24 hours',emailsRemaining:'Remaining by site counter',emailFailures24h:'Failed sends',emailUsageWarning:'You are approaching the Gmail sending limit. Reduce sending until the counter falls.',emailUsageCritical:'You are very close to the Gmail sending limit. Additional messages may be blocked.',emailTrackingNote:'This counter includes only messages sent by the website, not messages sent manually from Gmail.',downloadSecurityReport:'Download security report',preparingSecurityReport:'Preparing report...',securityReportReady:'Security report downloaded',securityReportNeedsScan:'Run a full security check before downloading the report'}
};

I18N.en.pendingJoinRequests = 'Pending join requests';

const state={language:localStorage.getItem(LANGUAGE_KEY)==='en'?'en':'he',view:'overview',period:30,search:'',page:1,userStatus:'all',groupStatus:'active',contentKind:'items',contentStatus:'all',moderationTab:'terms',moderationStatus:'open',lastRows:[]};
let searchTimer=null;
let lastSecurityScan=null;
let lastHealthSnapshot=null;

const SECURITY_CHECK_LABELS={
  he:{database_connection:'חיבור למסד הנתונים',required_tables:'טבלאות מערכת נדרשות',active_admins:'חשבונות מנהל פעילים',password_hashes:'הצפנת סיסמאות',jwt_secret:'מפתח חתימת התחברות',php_version:'גרסת PHP נתמכת',display_errors:'הצגת שגיאות למבקרים',allow_url_include:'טעינת קוד מכתובות חיצוניות',expose_php:'חשיפת גרסת PHP',upload_directory:'תיקיית העלאת תמונות',upload_execution_protection:'חסימת הרצת קוד בתיקיית העלאות',suspicious_uploads:'קבצים חשודים בתיקיית התמונות',web_server_rules:'כללי אבטחת השרת',admin_gate:'שער כניסה ללוח הניהול',admin_probe_monitor:'ניטור ניסיונות גילוי עמוד מנהל',sensitive_public_files:'קבצים רגישים בתיקייה הציבורית',blocked_login_attempts:'חסימות התחברות פעילות',admin_access_attempts:'ניסיונות גישה ללוח הניהול',failed_logins:'התחברויות שנכשלו',system_errors:'שגיאות מערכת',duplicate_identities:'כפילויות בזהויות משתמשים',jwt_self_test:'בדיקת JWT פעילה',jwt_header_validation:'אימות כותרת JWT',auth_cookie_security:'אבטחת עוגיית התחברות',admin_token_storage:'אחסון טוקן בלוח המנהל',session_lifetime:'משך תוקף התחברות',password_policy:'מדיניות אורך סיסמה',password_reset_policy:'מדיניות איפוס סיסמה',https_request:'חיבור HTTPS פעיל',hsts_policy:'מדיניות HSTS',content_security_policy:'מדיניות CSP',csp_script_safety:'בטיחות script-src',security_headers:'כותרות אבטחה',api_private_files:'חסימת קובצי API פנימיים',config_file_permissions:'הרשאות config.php',admin_helper_permissions:'הרשאות admin_helper.php',root_rules_permissions:'הרשאות .htaccess ראשי',world_writable_paths:'קבצים ותיקיות הניתנים לכתיבה לכולם',upload_mime_integrity:'תקינות MIME של קובצי העלאה',upload_symlinks:'קישורים סמליים בתיקיית העלאות',upload_filename_integrity:'תקינות שמות קובצי העלאה',upload_size_integrity:'תקינות גודל קובצי העלאה',upload_validation_code:'בדיקות קוד העלאת תמונות',php_source_heuristics:'סריקת דפוסי PHP חשודים',fixed_admin_bootstrap:'הרשאת מנהל קבועה בקוד',database_strict_mode:'מצב SQL מחמיר',database_charset:'קידוד חיבור למסד',database_table_formats:'מנוע וקידוד טבלאות',database_privileges:'הרשאות משתמש מסד הנתונים',database_orphans:'רשומות יתומות במסד',database_clock:'סנכרון שעון מסד הנתונים',password_reset_state:'מצב בקשות איפוס סיסמה',token_json_exposure:'חשיפת JWT ל-JavaScript',rate_limit_failure_mode:'מצב כשל של הגבלת קצב'},
  en:{database_connection:'Database connection',required_tables:'Required system tables',active_admins:'Active administrator accounts',password_hashes:'Password hashing',jwt_secret:'Login signing key',php_version:'Supported PHP version',display_errors:'Error display to visitors',allow_url_include:'Remote code inclusion',expose_php:'PHP version exposure',upload_directory:'Image upload directory',upload_execution_protection:'Upload execution protection',suspicious_uploads:'Suspicious files in image storage',web_server_rules:'Web server security rules',admin_gate:'Admin access gate',admin_probe_monitor:'Admin path probe monitor',sensitive_public_files:'Sensitive files in the public directory',blocked_login_attempts:'Active login blocks',admin_access_attempts:'Admin access attempts',failed_logins:'Failed logins',system_errors:'System errors',duplicate_identities:'Duplicate user identities',jwt_self_test:'Active JWT self-test',jwt_header_validation:'JWT header validation',auth_cookie_security:'Authentication cookie security',admin_token_storage:'Admin token storage',session_lifetime:'Session lifetime',password_policy:'Password length policy',password_reset_policy:'Password reset policy',https_request:'Active HTTPS connection',hsts_policy:'HSTS policy',content_security_policy:'Content Security Policy',csp_script_safety:'script-src safety',security_headers:'Security headers',api_private_files:'Private API file protection',config_file_permissions:'config.php permissions',admin_helper_permissions:'admin_helper.php permissions',root_rules_permissions:'Root .htaccess permissions',world_writable_paths:'World-writable paths',upload_mime_integrity:'Upload MIME integrity',upload_symlinks:'Upload-directory symlinks',upload_filename_integrity:'Upload filename integrity',upload_size_integrity:'Upload size integrity',upload_validation_code:'Image upload validation code',php_source_heuristics:'Suspicious PHP source patterns',fixed_admin_bootstrap:'Hard-coded administrator bootstrap',database_strict_mode:'Strict SQL mode',database_charset:'Database connection charset',database_table_formats:'Database table engine and collation',database_privileges:'Database account privileges',database_orphans:'Orphaned database records',database_clock:'Database clock synchronization',password_reset_state:'Password reset request state',token_json_exposure:'JWT exposure to JavaScript',rate_limit_failure_mode:'Rate-limit failure mode'}
};

const SECURITY_EVENT_LABELS={
  he:{admin_access_denied:'גישה ללוח הניהול נחסמה',admin_path_probe:'ניסיון לנחש כתובת מנהל',admin_gate_error:'תקלה בשער לוח הניהול',admin_api_access_denied:'ניסיון גישה ל-API של המנהל',login_failed:'התחברות נכשלה',login_rate_limited:'נחסמו ניסיונות התחברות רבים',login_denied_deleted_account:'ניסיון כניסה לחשבון שנמחק',login_denied_blocked_account:'ניסיון כניסה לחשבון חסום',login_success:'התחברות הצליחה'},
  en:{admin_access_denied:'Admin access denied',admin_path_probe:'Admin path probe',admin_gate_error:'Admin gate error',admin_api_access_denied:'Admin API access denied',login_failed:'Login failed',login_rate_limited:'Login attempts rate limited',login_denied_deleted_account:'Login to deleted account denied',login_denied_blocked_account:'Login to blocked account denied',login_success:'Login succeeded'}
};

function t(key){return I18N[state.language][key]||key}
function icon(name,cls=''){const safeName=String(name||'').replace(/[^a-z0-9-]/gi,'');const safeClass=String(cls||'').replace(/[^a-z0-9 _-]/gi,'');return `<svg class="icon icon-tabler icon-tabler-${safeName} ${safeClass}" aria-hidden="true" focusable="false"><use href="${TABLER_SPRITE_URL}#tabler-${safeName}"></use></svg>`}
function escapeHtml(value){return String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function formatNumber(v){return new Intl.NumberFormat(state.language==='he'?'he-IL':'en-US').format(Number(v)||0)}
function parseUtcDate(value){if(value===null||value===undefined||value==='')return null;if(typeof value==='number'){const ms=value<1000000000000?value*1000:value;const d=new Date(ms);return Number.isNaN(d.getTime())?null:d}const raw=String(value).trim();if(!raw)return null;let normalized=raw;if(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(raw)){normalized=raw.replace(' ','T')+'Z'}else if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(raw)){normalized=raw+'Z'}else if(/^\d{4}-\d{2}-\d{2}$/.test(raw)){normalized=raw+'T00:00:00Z'}const d=new Date(normalized);return Number.isNaN(d.getTime())?null:d}
function formatDate(v){if(!v)return '-';const d=parseUtcDate(v);if(!d)return String(v);return new Intl.DateTimeFormat(state.language==='he'?'he-IL':'en-US',{dateStyle:'medium',timeStyle:'short',hourCycle:'h23',timeZone:ADMIN_TIME_ZONE}).format(d)}
function formatBytes(value){const bytes=Number(value)||0;if(bytes<1024)return `${formatNumber(bytes)} B`;const units=['KB','MB','GB','TB'];let size=bytes/1024;let i=0;while(size>=1024&&i<units.length-1){size/=1024;i++}return `${new Intl.NumberFormat(state.language==='he'?'he-IL':'en-US',{maximumFractionDigits:1}).format(size)} ${units[i]}`}
function initials(name){return String(name||'A').trim().slice(0,1).toUpperCase()}
function securityCheckLabel(key){return SECURITY_CHECK_LABELS[state.language][String(key||'')]||String(key||'').replaceAll('_',' ')}
function securityEventLabel(key){return SECURITY_EVENT_LABELS[state.language][String(key||'')]||String(key||'').replaceAll('_',' ')}
function securityStatusLabel(status){return status==='pass'?t('passStatus'):status==='critical'?t('criticalStatus'):t('warningStatus')}
function setSecurityAlertCount(value){const count=Math.max(0,Number(value)||0);const badge=document.getElementById('securityAlertBadge');if(!badge)return;badge.textContent=count>99?'99+':String(count);badge.hidden=count===0;const button=document.getElementById('btnSecurityAlerts');if(button){button.classList.toggle('has-alerts',count>0);button.title=`${t('securityAlerts')}: ${count}`;button.setAttribute('aria-label',`${t('securityAlerts')}: ${count}`)}}
function switchAdminView(view){state.view=view;state.page=1;state.search='';document.querySelectorAll('.admin-nav-item').forEach(x=>x.classList.toggle('active',x.dataset.view===view));loadView()}
function renderSecurityMeta(meta){if(!meta||typeof meta!=='object')return '';const rows=[];for(const [key,value] of Object.entries(meta)){if(value===null||value===undefined||value===''||value===false)continue;let formatted='';if(Array.isArray(value)){if(!value.length)continue;formatted=value.join(', ')}else if(typeof value==='object'){formatted=Object.entries(value).filter(([,v])=>v!==null&&v!==undefined).map(([k,v])=>`${k}: ${Array.isArray(v)?v.join(', '):String(v)}`).join(', ')}else{formatted=String(value)}if(!formatted)continue;const label=key.replaceAll('_',' ');rows.push(`<span><b>${escapeHtml(label)}:</b> ${escapeHtml(formatted)}</span>`)}return rows.length?`<div class="security-check-meta">${rows.join('<br>')}</div>`:''}

function securityReportRouteFile(route){
  const path=String(route||'').split('?')[0].replace(/^\/+|\/+$/g,'');
  if(!path)return '';
  const first=path.split('/')[0].toLowerCase();
  const map={admin:'api/routes/admin.php',auth:'api/routes/auth.php',groups:'api/routes/groups.php',group:'api/routes/groups.php',items:'api/routes/items.php',item:'api/routes/items.php',comments:'api/routes/comments.php',comment:'api/routes/comments.php',profile:'api/routes/profile.php',users:'api/routes/users.php',user:'api/routes/users.php'};
  return map[first]||'';
}

function securityRecommendedUploads(scan,health){
  const files=new Map();
  const add=(path,reason,priority='helpful',redact=false)=>{
    if(!path)return;
    const clean=String(path).replace(/^\/+/, '');
    const current=files.get(clean)||{path:clean,priority,reasons:[],redact_secrets:redact};
    if(priority==='required')current.priority='required';
    current.redact_secrets=current.redact_secrets||redact;
    if(reason&&!current.reasons.includes(reason))current.reasons.push(reason);
    files.set(clean,current);
  };
  const map={
    database_connection:[['api/config.php',true],['database-schema.sql',false]],
    required_tables:[['database-schema.sql',false],['api/admin_helper.php',false]],
    active_admins:[['api/admin_helper.php',false]],
    password_hashes:[['api/routes/auth.php',false],['api/auth_helper.php',false]],
    duplicate_identities:[['database-schema.sql',false],['api/routes/auth.php',false]],
    jwt_secret:[['api/config.php',true],['api/auth_helper.php',false]],
    jwt_self_test:[['api/auth_helper.php',false],['api/config.php',true]],
    jwt_header_validation:[['api/auth_helper.php',false]],
    auth_cookie_security:[['api/auth_helper.php',false],['api/config.php',true]],
    admin_token_storage:[['admin.js',false],['api/auth_helper.php',false]],
    token_json_exposure:[['api/routes/auth.php',false],['admin.js',false]],
    rate_limit_failure_mode:[['api/routes/auth.php',false],['api/admin_helper.php',false]],
    session_lifetime:[['api/config.php',true],['api/auth_helper.php',false]],
    password_policy:[['api/config.php',true],['api/routes/auth.php',false]],
    password_reset_policy:[['api/config.php',true],['api/routes/auth.php',false]],
    password_reset_state:[['api/routes/auth.php',false],['api/routes/admin.php',false]],
    https_request:[['.htaccess',false]],
    hsts_policy:[['.htaccess',false]],
    content_security_policy:[['.htaccess',false]],
    csp_script_safety:[['.htaccess',false],['admin.js',false]],
    security_headers:[['.htaccess',false]],
    web_server_rules:[['.htaccess',false]],
    api_private_files:[['api/.htaccess',false],['api/routes/.htaccess',false],['.htaccess',false]],
    config_file_permissions:[['api/config.php',true]],
    admin_helper_permissions:[['api/admin_helper.php',false]],
    root_rules_permissions:[['.htaccess',false]],
    world_writable_paths:[['.htaccess',false]],
    upload_directory:[['api/config.php',true],['uploads/.htaccess',false]],
    upload_execution_protection:[['uploads/.htaccess',false],['.htaccess',false]],
    suspicious_uploads:[['uploads/.htaccess',false],['api/config.php',true]],
    upload_mime_integrity:[['api/config.php',true],['uploads/.htaccess',false]],
    upload_symlinks:[['uploads/.htaccess',false]],
    upload_filename_integrity:[['api/config.php',true]],
    upload_size_integrity:[['api/config.php',true]],
    upload_validation_code:[['api/config.php',true]],
    php_source_heuristics:[['.htaccess',false]],
    fixed_admin_bootstrap:[['api/admin_helper.php',false]],
    database_strict_mode:[['api/config.php',true],['database-schema.sql',false]],
    database_charset:[['api/config.php',true],['database-schema.sql',false]],
    database_table_formats:[['database-schema.sql',false]],
    database_privileges:[['api/config.php',true]],
    database_orphans:[['database-schema.sql',false],['api/routes/admin.php',false]],
    database_clock:[['api/config.php',true]],
    blocked_login_attempts:[['api/routes/auth.php',false],['api/admin_helper.php',false]],
    admin_access_attempts:[['admin-access-monitor.php',false],['api/admin_helper.php',false],['admin-29db540de5959343f303d392c63dcece.php',false]],
    failed_logins:[['api/routes/auth.php',false],['api/auth_helper.php',false]],
    system_errors:[['api/routes/admin.php',false],['api/admin_helper.php',false]]
  };
  for(const check of (scan?.checks||[])){
    if(check.status==='pass')continue;
    const key=String(check.key||'');
    for(const [path,redact] of (map[key]||[]))add(path,key,check.status==='critical'?'required':'helpful',redact);
    for(const path of (Array.isArray(check.meta?.files)?check.meta.files:[])){
      const clean=String(path||'').replace(/^\/+/, '');
      if(clean&&/\.(?:php|htaccess|ini|conf|json|js|sql)$/i.test(clean))add(clean,key,check.status==='critical'?'required':'helpful',/config\.php$/i.test(clean));
    }
  }
  for(const err of (health?.recent_errors||[])){
    const routeFile=securityReportRouteFile(err.route);
    if(routeFile)add(routeFile,`system_error:${String(err.route||'unknown')}`,'helpful',false);
  }
  return [...files.values()].sort((a,b)=>Number(b.priority==='required')-Number(a.priority==='required')||a.path.localeCompare(b.path));
}

function buildSecuritySupportReport(scan,health){
  const checks=(scan?.checks||[]).map(c=>({key:c.key,status:c.status,value:c.value,meta:c.meta||{}}));
  return {
    report_format:'sharedcart-security-support-report',
    report_version:1,
    generated_at:new Date().toISOString(),
    purpose:'Upload this JSON file to ChatGPT to diagnose SharedCart security findings and determine which source files are needed next.',
    privacy:{contains_passwords:false,contains_jwt_secret:false,contains_auth_token:false,note:'config.php is never embedded in this report. If it is requested separately, redact DB passwords, JWT secrets, SMTP passwords and API keys.'},
    client:{admin_time_zone:ADMIN_TIME_ZONE,protocol:location.protocol,host:location.host,admin_path:location.pathname},
    scan:{scan_version:scan?.scan_version||null,scanned_at:scan?.scanned_at||null,overall_status:scan?.overall_status||null,score:scan?.score??null,summary:scan?.summary||{},checks,findings:checks.filter(c=>c.status!=='pass')},
    environment:{database_version:health?.database_version||null,php_version:health?.php_version||null,server_software:health?.server_software||null,server_time:health?.server_time||null,uploads_path:health?.uploads_path||null,uploads_writable:health?.uploads_writable??null,uploads_bytes:health?.uploads_bytes??null,uploads_files:health?.uploads_files??null,disk_free_bytes:health?.disk_free_bytes??null,disk_total_bytes:health?.disk_total_bytes??null,upload_max_filesize:health?.upload_max_filesize||null,post_max_size:health?.post_max_size||null,memory_limit:health?.memory_limit||null,file_uploads:health?.file_uploads??null,email_usage:health?.email_usage||null,tables:health?.tables||{}},
    security_activity:health?.security||scan?.security||{},
    recent_security_events:(health?.recent_security_events||[]).slice(0,30).map(x=>({event_type:x.event_type,severity:x.severity,username:x.username||null,email_masked:x.email_masked||null,ip_address:x.ip_address||null,request_path:x.request_path||null,user_agent:x.user_agent||null,occurrence_count:Number(x.occurrence_count)||0,is_read:Number(x.is_read)||0,first_seen_at:x.first_seen_at||null,last_seen_at:x.last_seen_at||null})),
    recent_errors:(health?.recent_errors||[]).slice(0,20).map(x=>({event_type:x.event_type,route:x.route||null,message:x.message||null,created_at:x.created_at||null,ip_address:x.ip_address||null,username:x.username||null})),
    recommended_uploads:securityRecommendedUploads(scan,health),
    instructions_for_analysis:[
      'Analyze findings in severity order: critical, then warning.',
      'Use recommended_uploads to request only files needed to investigate failed checks.',
      'Do not ask for secrets. For api/config.php, request a redacted copy with constant names and non-secret settings preserved.',
      'If database-schema.sql is requested, export structure only without table data.',
      'Correlate recent_errors and recent_security_events with failed checks before requesting additional files.'
    ]
  };
}

async function downloadSecuritySupportReport(){
  if(!lastSecurityScan)lastSecurityScan=await api('/admin/security/scan',{method:'POST'});
  lastHealthSnapshot=await api('/admin/health');
  const report=buildSecuritySupportReport(lastSecurityScan,lastHealthSnapshot);
  const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`sharedcart-security-report-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
  document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(a.href);
  toast(t('securityReportReady'));
  return true;
}


const AUDIT_ACTION_LABELS={
  he:{report_resolved:'דיווח טופל',report_dismissed:'דיווח נדחה',user_blocked:'משתמש נחסם',user_unblocked:'חסימת משתמש בוטלה',user_deleted:'משתמש נמחק',user_restored:'משתמש שוחזר',user_permanently_deleted:'משתמש נמחק לצמיתות',user_role_changed:'תפקיד משתמש שונה',username_changed:'שם משתמש שונה',password_reset_requested:'נשלח איפוס סיסמה',group_deleted:'קבוצה נמחקה',group_restored:'קבוצה שוחזרה',item_deleted:'פריט נמחק',item_restored:'פריט שוחזר',comment_deleted:'הערה נמחקה',comment_restored:'הערה שוחזרה',blocked_term_saved:'מילה חסומה נשמרה',blocked_term_disabled:'מילה חסומה הושבתה',security_scan_run:'בוצעה בדיקת אבטחה',security_alerts_read:'התראות אבטחה סומנו כנקראו'},
  en:{report_resolved:'Report resolved',report_dismissed:'Report dismissed',user_blocked:'User blocked',user_unblocked:'User unblocked',user_deleted:'User deleted',user_restored:'User restored',user_permanently_deleted:'User permanently deleted',user_role_changed:'User role changed',username_changed:'Username changed',password_reset_requested:'Password reset requested',group_deleted:'Group deleted',group_restored:'Group restored',item_deleted:'Item deleted',item_restored:'Item restored',comment_deleted:'Comment deleted',comment_restored:'Comment restored',blocked_term_saved:'Blocked term saved',blocked_term_disabled:'Blocked term disabled',security_scan_run:'Security scan run',security_alerts_read:'Security alerts marked as read'}
};
const AUDIT_TARGET_LABELS={he:{user:'משתמש',group:'קבוצה',item:'פריט',comment:'הערה',report:'דיווח',blocked_term:'מילה חסומה',system:'מערכת'},en:{user:'User',group:'Group',item:'Item',comment:'Comment',report:'Report',blocked_term:'Blocked term',system:'System'}};
const AUDIT_DETAIL_LABELS={he:{note:'הערה',reason:'סיבה',hours:'משך בשעות',role:'תפקיד',username:'שם משתמש',language:'שפה',severity:'חומרה',groups_deleted:'קבוצות שנמחקו',items_deleted:'פריטים שנמחקו',comments_deleted:'הערות שנמחקו',score:'ציון',warnings:'אזהרות',critical:'תקלות חמורות',status:'סטטוס'},en:{note:'Note',reason:'Reason',hours:'Hours',role:'Role',username:'Username',language:'Language',severity:'Severity',groups_deleted:'Groups deleted',items_deleted:'Items deleted',comments_deleted:'Comments deleted',score:'Score',warnings:'Warnings',critical:'Critical issues',status:'Status'}};
function auditActionLabel(value){return AUDIT_ACTION_LABELS[state.language][String(value||'')]||String(value||'').replaceAll('_',' ')}
function auditTargetLabel(type,id){const label=AUDIT_TARGET_LABELS[state.language][String(type||'')]||String(type||'');return id?`${label} #${id}`:label}
function auditDetailValue(value){if(typeof value==='boolean')return value?t('yes'):t('no');if(value===null||value===undefined||value==='')return '-';if(Array.isArray(value))return value.map(auditDetailValue).join(', ');if(typeof value==='object')return Object.entries(value).map(([k,v])=>`${k}: ${auditDetailValue(v)}`).join(', ');return String(value)}
function renderAuditDetails(value){
  if(value===null||value===undefined||String(value).trim()==='')return '<span class="table-secondary">-</span>';
  let parsed=value;
  if(typeof value==='string'){
    try{parsed=JSON.parse(value)}catch{return `<span>${escapeHtml(value)}</span>`}
  }
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return `<span>${escapeHtml(auditDetailValue(parsed))}</span>`;
  const rows=Object.entries(parsed).filter(([,v])=>v!==null&&v!==undefined&&v!=='');
  if(!rows.length)return '<span class="table-secondary">-</span>';
  return `<div class="audit-detail-list">${rows.map(([key,val])=>`<div class="audit-detail-row"><span>${escapeHtml(AUDIT_DETAIL_LABELS[state.language][key]||key.replaceAll('_',' '))}</span><strong>${escapeHtml(auditDetailValue(val))}</strong></div>`).join('')}</div>`;
}

function installIcons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.icon)})}
function applyLanguage(){document.documentElement.lang=state.language;document.documentElement.dir=state.language==='he'?'rtl':'ltr';document.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=t(el.dataset.i18n));document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>el.placeholder=t(el.dataset.i18nPlaceholder));document.getElementById('pageTitle').textContent=t(state.view);const badge=document.getElementById('securityAlertBadge');if(badge)setSecurityAlertCount(badge.hidden?0:Number(badge.textContent)||0);localStorage.setItem(LANGUAGE_KEY,state.language)}
async function api(path,options={}){const headers={...(options.headers||{})};if(options.body&&!(options.body instanceof FormData)){headers['Content-Type']='application/json';options.body=JSON.stringify(options.body)}const res=await fetch(API+path,{credentials:'same-origin',...options,headers});let data={};try{data=await res.json()}catch{}if(!res.ok){const err=new Error(data.error||data.message||`HTTP ${res.status}`);err.status=res.status;err.data=data;throw err}return data}
function toast(message,error=false){const el=document.getElementById('adminToast');el.textContent=message;el.classList.toggle('error',error);el.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.hidden=true,3200)}
function loading(){document.getElementById('adminContent').innerHTML=`<div class="loading-state"><div><div class="spinner"></div><p>${escapeHtml(t('loading'))}</p></div></div>`}
function renderError(err){document.getElementById('adminContent').innerHTML=`<div class="error-state">${escapeHtml(err.message||'Error')}</div>`}
function metric(label,value,iconName,tone=''){return `<article class="metric-card"><div class="metric-card-top"><span class="metric-icon ${tone}">${icon(iconName)}</span></div><div class="metric-value">${formatNumber(value)}</div><div class="metric-label">${escapeHtml(label)}</div></article>`}
function rankList(items,valueKey='count',metaFn=null){if(!items?.length)return `<div class="empty-table">${t('noData')}</div>`;return `<div class="rank-list">${items.map((it,i)=>`<div class="rank-row"><span class="rank-number">${i+1}</span><div><div class="rank-name">${escapeHtml(it.name||it.username)}</div>${metaFn?`<div class="rank-meta">${escapeHtml(metaFn(it))}</div>`:''}</div><span class="rank-value">${formatNumber(it[valueKey])}</span></div>`).join('')}</div>`}
function pagination(page,per,total){const pages=Math.max(1,Math.ceil((Number(total)||0)/per));return `<div class="pagination"><button class="md-button secondary" data-page="${page-1}" ${page<=1?'disabled':''}>${t('previous')}</button><span>${t('page')} ${page} ${t('of')} ${pages}</span><button class="md-button secondary" data-page="${page+1}" ${page>=pages?'disabled':''}>${t('next')}</button></div>`}

function showModal(title,body,actions=[]){const modal=document.getElementById('adminModal');document.getElementById('adminModalTitle').textContent=title;document.getElementById('adminModalBody').innerHTML=body;const a=document.getElementById('adminModalActions');a.innerHTML='';actions.forEach(act=>{const b=document.createElement('button');b.className=`md-button ${act.className||'secondary'}`;b.textContent=act.label;b.onclick=act.onClick;a.appendChild(b)});modal.hidden=false;installIcons(modal)}
function closeModal(){document.getElementById('adminModal').hidden=true}
document.getElementById('adminModalClose').onclick=closeModal;document.getElementById('adminModal').addEventListener('click',e=>{if(e.target.id==='adminModal')closeModal()});

async function loadMe(){const me=await api('/admin/me');document.getElementById('adminName').textContent=me.username||'Admin';document.getElementById('adminEmail').textContent=me.email||'';document.getElementById('adminAvatar').textContent=initials(me.username);setSecurityAlertCount(me.security_alerts);if(!localStorage.getItem(LANGUAGE_KEY)&&me.language){state.language=me.language==='en'?'en':'he';applyLanguage();setSecurityAlertCount(me.security_alerts)}}

function updateToolbar(){
  const toolbar=document.getElementById('adminToolbar');
  toolbar.hidden=state.view==='overview'||state.view==='health';
  document.getElementById('adminSearch').value=state.search;
  const filters=document.getElementById('viewFilters');
  filters.innerHTML='';
  let select=null;
  if(state.view==='users'){
    filters.innerHTML=`<select id="userStatusFilter" class="filter-select"><option value="all">${t('all')}</option><option value="active">${t('active')}</option><option value="blocked">${t('blocked')}</option><option value="deleted">${t('deleted')}</option><option value="admins">${t('admins')}</option></select>`;
    select=filters.querySelector('select');select.value=state.userStatus;select.onchange=e=>{state.userStatus=e.target.value;state.page=1;loadView()};
  }else if(state.view==='groups'){
    filters.innerHTML=`<select id="groupStatusFilter" class="filter-select"><option value="active">${t('active')}</option><option value="deleted">${t('deleted')}</option><option value="all">${t('all')}</option></select>`;
    select=filters.querySelector('select');select.value=state.groupStatus;select.onchange=e=>{state.groupStatus=e.target.value;state.page=1;loadView()};
  }else if(state.view==='content'){
    filters.innerHTML=`<select id="contentStatusFilter" class="filter-select"><option value="all">${t('all')}</option><option value="active">${t('active')}</option><option value="deleted">${t('deleted')}</option></select>`;
    select=filters.querySelector('select');select.value=state.contentStatus;select.onchange=e=>{state.contentStatus=e.target.value;state.page=1;loadView()};
  }
}

async function loadView(){document.getElementById('pageTitle').textContent=t(state.view);updateToolbar();loading();try{if(state.view==='overview')await renderOverview();else if(state.view==='users')await renderUsers();else if(state.view==='groups')await renderGroups();else if(state.view==='content')await renderContent();else if(state.view==='moderation')await renderModeration();else if(state.view==='audit')await renderAudit();else if(state.view==='health')await renderHealth()}catch(err){if(err.status===401||err.status===403){location.replace('index.html?admin_access=denied');return}renderError(err)}}

async function renderOverview(){
  const d=await api(`/admin/overview?period=${state.period}`);
  state.lastRows=d.popular_items||[];
  const daily=d.daily_activity||[];
  const pendingJoinRequests=d.pending_join_requests||[];
  const max=Math.max(1,...daily.map(x=>Number(x.count)||0));
  document.getElementById('adminContent').innerHTML=`
    <section class="metrics-grid">
      ${metric(t('totalUsers'),d.stats.users,'users')}
      ${metric(t('activeUsers'),d.stats.active_users,'user-check','success')}
      ${metric(t('totalGroups'),d.stats.groups,'users-group')}
      ${metric(t('activeItems'),d.stats.active_items,'package')}
      ${metric(t('actions'),d.stats.actions,'chart-bar')}
      ${metric(t('blockedUsers'),d.stats.blocked_users,'user-off','warning')}
      ${metric(t('pendingJoinRequests'),d.stats.pending_join_requests,'users-group','warning')}
      ${metric(t('moderationEvents'),d.stats.moderation_events,'shield-check','danger')}
      ${metric(t('openReports'),d.stats.open_reports,'flag','warning')}
      ${metric(t('systemErrors'),d.stats.system_errors,'alert-triangle',Number(d.stats.system_errors)>0?'danger':'success')}
    </section>
    <section class="dashboard-grid">
      <article class="panel"><div class="panel-header"><div><h2 class="panel-title">${t('activityTrend')}</h2><p class="panel-subtitle">${state.period} ${t('days')}</p></div></div><div class="bar-chart">${daily.map(x=>`<div class="bar-chart-column"><span class="bar-chart-value">${formatNumber(x.count)}</span><div class="bar-chart-bar" style="height:${Math.max(3,(Number(x.count)/max)*190)}px"></div><span class="bar-chart-label">${escapeHtml(String(x.day).slice(5))}</span></div>`).join('')||`<div class="empty-table">${t('noData')}</div>`}</div></article>
      <article class="panel"><div class="panel-header"><h2 class="panel-title">${t('popularItems')}</h2></div>${rankList(d.popular_items,'consumed',x=>`${formatNumber(x.activity_count)} ${t('actions')}`)}</article>
    </section>
    <section class="dashboard-grid">
      <article class="panel"><div class="panel-header"><h2 class="panel-title">${t('topConsumers')}</h2></div>${rankList(d.top_consumers)}</article>
      <article class="panel"><div class="panel-header"><h2 class="panel-title">${t('topWriters')}</h2></div>${rankList(d.top_writers,'total_count',x=>`${formatNumber(x.items_count)} ${t('items')} · ${formatNumber(x.comments_count)} ${t('comments')}`)}</article>
    </section>
    <section class="dashboard-grid">
      <article class="panel"><div class="panel-header"><h2 class="panel-title">${t('topGroups')}</h2></div>${rankList((d.top_groups||[]).map(x=>({...x,count:x.actions})), 'count',x=>`${formatNumber(x.members)} ${t('members')} · ${formatNumber(x.items)} ${t('items')}`)}</article>
      <article class="panel"><div class="panel-header"><h2 class="panel-title">${t('anomalies')}</h2></div>${rankList((d.anomalies||[]).map(x=>({...x,name:x.username,count:x.actions})),'count',x=>x.day)}</article>
    </section>
    ${pendingJoinRequests.length?`<section class="panel"><div class="panel-header"><h2 class="panel-title">${t('pendingJoinRequests')}</h2><span>${formatNumber(pendingJoinRequests.length)}</span></div><div class="rank-list">${pendingJoinRequests.map(request=>`<div class="rank-row"><div><div class="rank-name">${escapeHtml(request.username)}</div><div class="rank-meta">${escapeHtml(request.group_name)}</div></div><span class="rank-value">${formatDate(request.requested_at)}</span></div>`).join('')}</div></section>`:''}`;
}
function userStatus(row){if(row.deleted_at)return ['deleted','deleted'];if(row.blocked_until&&new Date(row.blocked_until.replace(' ','T')+'Z')>new Date())return ['blocked','blocked'];if(row.role==='admin')return ['admin','admins'];return ['','active']}
async function renderUsers(){
  const d=await api(`/admin/users?page=${state.page}&search=${encodeURIComponent(state.search)}&status=${encodeURIComponent(state.userStatus)}`);
  state.lastRows=d.items||[];
  const rows=(d.items||[]).map(u=>{
    const [cls,label]=userStatus(u);
    const actions=u.deleted_at
      ? `<button class="row-action" data-user-action="restore" data-id="${u.id}" title="${t('restore')}">${icon('restore')}</button><button class="row-action danger" data-user-action="purge" data-id="${u.id}" title="${t('permanentDelete')}">${icon('trash')}</button>`
      : `<button class="row-action" data-user-action="username" data-id="${u.id}" data-username="${escapeHtml(u.username)}" title="${t('changeUsername')}">${icon('pencil')}</button><button class="row-action" data-user-action="password-reset" data-id="${u.id}" title="${t('resetPassword')}">${icon('key')}</button><button class="row-action" data-user-action="block" data-id="${u.id}" title="${t('block')}">${icon('user-off')}</button><button class="row-action" data-user-action="unblock" data-id="${u.id}" title="${t('unblock')}">${icon('user-check')}</button><button class="row-action" data-user-action="role" data-id="${u.id}" data-role="${u.role}" title="${u.role==='admin'?t('makeUser'):t('makeAdmin')}">${icon('shield')}</button><button class="row-action danger" data-user-action="delete" data-id="${u.id}" title="${t('delete')}">${icon('trash')}</button>`;
    return `<tr><td><div class="table-primary">${escapeHtml(u.username)}</div><div class="table-secondary">${escapeHtml(u.email)}</div></td><td><span class="status-pill ${cls}"><span class="status-dot"></span>${t(label)}</span></td><td>${formatNumber(u.groups_count)}</td><td>${formatNumber(u.items_added)}</td><td>${formatNumber(u.items_completed)}</td><td>${formatNumber(u.comments_count)}</td><td>${formatDate(u.last_login_at)}</td><td><div class="row-actions">${actions}</div></td></tr>`;
  }).join('');
  document.getElementById('adminContent').innerHTML=`<div class="data-card"><div class="data-card-header"><h2 class="data-card-title">${t('users')}</h2><span>${formatNumber(d.total)}</span></div><div class="data-table-wrap"><table class="data-table"><thead><tr><th>${t('name')}</th><th>${t('status')}</th><th>${t('groupsCount')}</th><th>${t('itemsAdded')}</th><th>${t('completed')}</th><th>${t('comments')}</th><th>${t('lastLogin')}</th><th>${t('operations')}</th></tr></thead><tbody>${rows||`<tr><td colspan="8" class="empty-table">${t('noData')}</td></tr>`}</tbody></table></div>${pagination(d.page,d.per_page,d.total)}</div>`;
  bindPaging();
  document.querySelectorAll('[data-user-action]').forEach(b=>b.onclick=()=>handleUserAction(b.dataset.userAction,Number(b.dataset.id),b.dataset.role,b.dataset.username));
}

function handleUserAction(action,id,role,username){
  if(action==='block'){
    showModal(t('blockUser'),`<div class="form-grid"><div class="form-field"><label>${t('blockHours')}</label><input id="blockHours" type="number" min="1" max="8760" value="24"></div><div class="form-field" style="grid-column:span 2"><label>${t('blockReason')}</label><input id="blockReason" type="text" maxlength="255"></div></div>`,[
      {label:t('cancel'),onClick:closeModal},
      {label:t('confirm'),className:'primary',onClick:async()=>{try{await api(`/admin/users/${id}/block`,{method:'PATCH',body:{hours:Number(document.getElementById('blockHours').value),reason:document.getElementById('blockReason').value}});closeModal();toast(t('success'));loadView()}catch(e){toast(e.message,true)}}}
    ]);
    return;
  }
  if(action==='username'){
    showModal(t('changeUsername'),`<div class="form-field"><label>${t('newUsername')}</label><input id="adminNewUsername" type="text" maxlength="50" value="${escapeHtml(username||'')}"></div>`,[
      {label:t('cancel'),onClick:closeModal},
      {label:t('save'),className:'primary',onClick:async()=>{const value=document.getElementById('adminNewUsername').value.trim();if(!value){toast(t('usernameRequired'),true);return}try{await api(`/admin/users/${id}/username`,{method:'PATCH',body:{username:value}});closeModal();toast(t('success'));loadView()}catch(e){toast(e.message,true)}}}
    ]);
    return;
  }
  if(action==='password-reset'){
    showModal(t('resetPassword'),`<p>${t('resetPassword')}?</p>`,[
      {label:t('cancel'),onClick:closeModal},
      {label:t('confirm'),className:'primary',onClick:async()=>{try{await api(`/admin/users/${id}/password-reset`,{method:'POST'});closeModal();toast(t('passwordResetSent'));}catch(e){toast(e.message,true)}}}
    ]);
    return;
  }
  const map={unblock:['PATCH','unblock'],restore:['PATCH','restore'],delete:['DELETE',''],purge:['DELETE','purge'],role:['PATCH','role']};
  const [method,path]=map[action];
  const body=action==='role'?{role:role==='admin'?'user':'admin'}:undefined;
  const isDanger=action==='delete'||action==='purge';
  const message=action==='purge'?t('permanentDeleteWarning'):`${t('confirm')}?`;
  showModal(t(action==='purge'?'permanentDelete':action==='delete'?'delete':'confirm'),`<p>${escapeHtml(message)}</p>`,[
    {label:t('cancel'),onClick:closeModal},
    {label:action==='purge'?t('permanentDelete'):t('confirm'),className:isDanger?'danger':'primary',onClick:async()=>{try{await api(`/admin/users/${id}${path?'/'+path:''}`,{method,body});closeModal();toast(t('success'));loadView()}catch(e){toast(e.message,true)}}}
  ]);
}

async function renderGroups(){
  const d=await api(`/admin/groups?page=${state.page}&period=${state.period}&search=${encodeURIComponent(state.search)}&status=${encodeURIComponent(state.groupStatus)}`);
  state.lastRows=d.items||[];
  document.getElementById('adminContent').innerHTML=`<div class="data-card"><div class="data-card-header"><h2 class="data-card-title">${t('groups')}</h2><span>${formatNumber(d.total)}</span></div><div class="data-table-wrap"><table class="data-table"><thead><tr><th>${t('name')}</th><th>${t('owner')}</th><th>${t('status')}</th><th>${t('members')}</th><th>${t('items')}</th><th>${t('actions')}</th><th>${t('lastActivity')}</th><th>${t('operations')}</th></tr></thead><tbody>${(d.items||[]).map(g=>`<tr><td><div class="table-primary">${escapeHtml(g.name)}</div><div class="table-secondary">#${g.id}</div></td><td>${escapeHtml(g.owner_name)}</td><td><span class="status-pill ${g.deleted_at?'deleted':''}"><span class="status-dot"></span>${g.deleted_at?t('deleted'):t('active')}</span></td><td>${formatNumber(g.members_count)}</td><td>${formatNumber(g.active_items)}</td><td>${formatNumber(g.period_actions)}</td><td>${formatDate(g.last_activity)}</td><td><div class="row-actions"><button class="row-action" data-group-stats="${g.id}" title="${t('viewStats')}">${icon('eye')}</button>${g.deleted_at?`<button class="row-action" data-group-restore="${g.id}" title="${t('restore')}">${icon('restore')}</button>`:`<button class="row-action danger" data-group-delete="${g.id}" title="${t('delete')}">${icon('trash')}</button>`}</div></td></tr>`).join('')||`<tr><td colspan="8" class="empty-table">${t('noData')}</td></tr>`}</tbody></table></div>${pagination(d.page,d.per_page,d.total)}</div>`;
  bindPaging();
  document.querySelectorAll('[data-group-stats]').forEach(b=>b.onclick=()=>showGroupStats(Number(b.dataset.groupStats)));
  document.querySelectorAll('[data-group-delete]').forEach(b=>b.onclick=()=>groupMutation(Number(b.dataset.groupDelete),'DELETE',''));
  document.querySelectorAll('[data-group-restore]').forEach(b=>b.onclick=()=>groupMutation(Number(b.dataset.groupRestore),'PATCH','restore'));
}
async function groupMutation(id,method,path){if(!confirm(t('confirm')+'?'))return;try{await api(`/admin/groups/${id}${path?'/'+path:''}`,{method});toast(t('success'));loadView()}catch(e){toast(e.message,true)}}
async function showGroupStats(id){
  try{
    const d=await api(`/admin/groups/${id}/stats?period=${state.period}`);
    const recent=(d.recent_activity||[]).map(x=>`<tr><td>${formatDate(x.created_at)}</td><td>${escapeHtml(x.username||(state.lang==='he'?'מערכת/אורח':'System/guest'))}</td><td>${escapeHtml(auditActionLabel(x.action))}</td><td>${escapeHtml(x.item_name||'-')}</td><td>${formatNumber(x.quantity)}</td></tr>`).join('');
    showModal(`${t('groupStats')}: ${d.group.name}`,`
      <div class="dashboard-grid">
        <section><h3>${t('topConsumers')}</h3>${rankList(d.top_consumers)}</section>
        <section><h3>${t('topWriters')}</h3>${rankList(d.top_writers,'total_count',x=>`${formatNumber(x.items_count)} ${t('items')} · ${formatNumber(x.comments_count)} ${t('comments')}`)}</section>
      </div>
      <section><h3>${t('popularItems')}</h3>${rankList(d.popular_items)}</section>
      <section><h3>${t('members')}</h3>${rankList((d.members||[]).map(x=>({name:x.username,count:x.is_creator?1:0})),'count',x=>x.email||'')}</section>
      <section><h3>${t('recentActivity')}</h3><div class="data-table-wrap"><table class="data-table"><thead><tr><th>${t('date')}</th><th>${t('user')}</th><th>${t('action')}</th><th>${t('activityItem')}</th><th>${t('activityQuantity')}</th></tr></thead><tbody>${recent||`<tr><td colspan="5" class="empty-table">${t('noData')}</td></tr>`}</tbody></table></div></section>
    `,[{label:t('confirm'),className:'primary',onClick:closeModal}]);
  }catch(e){toast(e.message,true)}
}

async function renderContent(){
  const d=await api(`/admin/content?kind=${state.contentKind}&page=${state.page}&search=${encodeURIComponent(state.search)}&status=${encodeURIComponent(state.contentStatus)}`);
  state.lastRows=d.items||[];
  const tabs=`<div class="tabs"><button class="tab-button ${state.contentKind==='items'?'active':''}" data-content-tab="items">${t('itemContent')}</button><button class="tab-button ${state.contentKind==='comments'?'active':''}" data-content-tab="comments">${t('commentContent')}</button></div>`;
  const rows=state.contentKind==='items'?(d.items||[]).map(x=>`<tr><td><div class="table-primary">${escapeHtml(x.name||'[image]')}</div><div class="table-secondary">#${x.id}</div></td><td>${escapeHtml(x.username)}</td><td>${escapeHtml(x.group_name)}</td><td><span class="status-pill ${x.deleted_at?'deleted':''}"><span class="status-dot"></span>${x.deleted_at?t('deleted'):t('active')}</span></td><td>${formatDate(x.created_at)}</td><td>${x.deleted_at?`<button class="row-action" data-content-action="restore" data-kind="item" data-id="${x.id}" title="${t('restore')}">${icon('restore')}</button>`:`<button class="row-action danger" data-content-action="delete" data-kind="item" data-id="${x.id}" title="${t('delete')}">${icon('trash')}</button>`}</td></tr>`).join(''):(d.items||[]).map(x=>`<tr><td><div class="table-primary">${escapeHtml(x.body)}</div><div class="table-secondary">${escapeHtml(x.item_name||'')}</div></td><td>${escapeHtml(x.username)}</td><td>${escapeHtml(x.group_name)}</td><td><span class="status-pill ${x.deleted_at?'deleted':''}"><span class="status-dot"></span>${x.deleted_at?t('deleted'):t('active')}</span></td><td>${formatDate(x.created_at)}</td><td>${x.deleted_at?`<button class="row-action" data-content-action="restore" data-kind="comment" data-id="${x.id}" title="${t('restore')}">${icon('restore')}</button>`:`<button class="row-action danger" data-content-action="delete" data-kind="comment" data-id="${x.id}" title="${t('delete')}">${icon('trash')}</button>`}</td></tr>`).join('');
  document.getElementById('adminContent').innerHTML=`${tabs}<div class="data-card"><div class="data-card-header"><h2 class="data-card-title">${state.contentKind==='items'?t('itemContent'):t('commentContent')}</h2><span>${formatNumber(d.total)}</span></div><div class="data-table-wrap"><table class="data-table"><thead><tr><th>${state.contentKind==='items'?t('items'):t('comments')}</th><th>${t('user')}</th><th>${t('groups')}</th><th>${t('status')}</th><th>${t('date')}</th><th>${t('operations')}</th></tr></thead><tbody>${rows||`<tr><td colspan="6" class="empty-table">${t('noData')}</td></tr>`}</tbody></table></div>${pagination(d.page,d.per_page,d.total)}</div>`;
  document.querySelectorAll('[data-content-tab]').forEach(b=>b.onclick=()=>{state.contentKind=b.dataset.contentTab;state.page=1;loadView()});
  document.querySelectorAll('[data-content-action]').forEach(b=>b.onclick=async()=>{try{await api(`/admin/content/${b.dataset.id}/${b.dataset.kind}`,{method:b.dataset.contentAction==='delete'?'DELETE':'PATCH'});toast(t('success'));loadView()}catch(e){toast(e.message,true)}});
  bindPaging();
}

async function renderModeration(){
  let content='';
  if(state.moderationTab==='terms'){
    const d=await api('/admin/moderation/terms');
    state.lastRows=d.items||[];
    content=`<div class="panel" style="margin-bottom:16px"><div class="panel-header"><h2 class="panel-title">${t('addTerm')}</h2></div><div class="form-grid"><div class="form-field"><label>${t('term')}</label><input id="newBlockedTerm"></div><div class="form-field"><label>${t('language')}</label><select id="newTermLanguage"><option value="he">${t('hebrew')}</option><option value="en">${t('english')}</option></select></div><div class="form-field"><label>${t('severity')}</label><select id="newTermSeverity"><option value="1">1</option><option value="2" selected>2</option><option value="3">3</option></select></div></div><div style="margin-top:14px"><button id="saveBlockedTerm" class="md-button primary">${icon('plus')} ${t('save')}</button></div></div><div class="data-card"><div class="data-table-wrap"><table class="data-table"><thead><tr><th>${t('term')}</th><th>${t('language')}</th><th>${t('severity')}</th><th>${t('status')}</th><th>${t('operations')}</th></tr></thead><tbody>${(d.items||[]).map(x=>`<tr><td class="table-primary">${escapeHtml(x.term)}</td><td><span class="language-chip">${icon('language')}${x.language==='he'?t('hebrew'):t('english')}</span></td><td>${x.severity}</td><td>${x.is_active==1?t('active'):t('deleted')}</td><td><button class="row-action danger" data-term-delete="${x.id}">${icon('trash')}</button></td></tr>`).join('')}</tbody></table></div></div>`;
  }else if(state.moderationTab==='events'){
    const d=await api(`/admin/moderation/events?page=${state.page}&search=${encodeURIComponent(state.search)}`);
    state.lastRows=d.items||[];
    content=`<div class="data-card"><div class="data-card-header"><h2 class="data-card-title">${t('events')}</h2><span>${formatNumber(d.total)}</span></div><div class="data-table-wrap"><table class="data-table"><thead><tr><th>${t('user')}</th><th>${t('field')}</th><th>${t('matchedTerm')}</th><th>${t('excerpt')}</th><th>${t('date')}</th></tr></thead><tbody>${(d.items||[]).map(x=>`<tr><td><div class="table-primary">${escapeHtml(x.username||'-')}</div><div class="table-secondary">${escapeHtml(x.email||'')}</div></td><td>${escapeHtml(x.field_name)}</td><td>${escapeHtml(x.matched_term)}</td><td>${escapeHtml(x.content_excerpt)}</td><td>${formatDate(x.created_at)}</td></tr>`).join('')||`<tr><td colspan="5" class="empty-table">${t('noData')}</td></tr>`}</tbody></table></div>${pagination(d.page,d.per_page,d.total)}</div>`;
  }else{
    const d=await api(`/admin/moderation/reports?status=${encodeURIComponent(state.moderationStatus)}&page=${state.page}&search=${encodeURIComponent(state.search)}`);
    state.lastRows=d.items||[];
    const statusFilter=`<div class="report-filter"><label>${t('reportStatus')}</label><select id="reportStatusFilter" class="filter-select"><option value="open">${t('open')}</option><option value="resolved">${t('resolved')}</option><option value="dismissed">${t('dismissed')}</option><option value="all">${t('showAll')}</option></select></div>`;
    content=`${statusFilter}<div class="data-card"><div class="data-table-wrap"><table class="data-table"><thead><tr><th>${t('target')}</th><th>${t('reporter')}</th><th>${t('reason')}</th><th>${t('date')}</th><th>${t('status')}</th><th>${t('reportActions')}</th></tr></thead><tbody>${(d.items||[]).map(x=>`<tr><td><div class="table-primary">${escapeHtml(x.target_label||`${x.target_type} #${x.target_id}`)}</div><div class="table-secondary">${escapeHtml(x.target_type)} #${x.target_id}</div></td><td><div class="table-primary">${escapeHtml(x.reporter_name||'-')}</div><div class="table-secondary">${escapeHtml(x.reporter_email||'')}</div></td><td>${escapeHtml(x.reason)}</td><td>${formatDate(x.created_at)}</td><td><span class="status-pill ${x.status==='open'?'blocked':x.status==='resolved'?'':'deleted'}"><span class="status-dot"></span>${t(x.status)}</span></td><td>${x.status==='open'?`<div class="row-actions"><button class="row-action" data-report-action="resolved" data-id="${x.id}" title="${t('resolve')}">${icon('shield-check')}</button><button class="row-action danger" data-report-action="dismissed" data-id="${x.id}" title="${t('dismiss')}">${icon('x')}</button></div>`:`<div class="table-secondary">${escapeHtml(x.resolver_name||'')} ${escapeHtml(x.resolution_note||'')}</div>`}</td></tr>`).join('')||`<tr><td colspan="6" class="empty-table">${t('noData')}</td></tr>`}</tbody></table></div>${pagination(d.page,d.per_page,d.total)}</div>`;
  }
  document.getElementById('adminContent').innerHTML=`<div class="tabs"><button class="tab-button ${state.moderationTab==='terms'?'active':''}" data-mod-tab="terms">${t('terms')}</button><button class="tab-button ${state.moderationTab==='events'?'active':''}" data-mod-tab="events">${t('events')}</button><button class="tab-button ${state.moderationTab==='reports'?'active':''}" data-mod-tab="reports">${t('reports')}</button></div>${content}`;
  document.querySelectorAll('[data-mod-tab]').forEach(b=>b.onclick=()=>{state.moderationTab=b.dataset.modTab;state.page=1;loadView()});
  document.querySelectorAll('[data-term-delete]').forEach(b=>b.onclick=async()=>{try{await api(`/admin/moderation/${b.dataset.termDelete}/term`,{method:'DELETE'});loadView()}catch(e){toast(e.message,true)}});
  const save=document.getElementById('saveBlockedTerm');
  if(save)save.onclick=async()=>{try{await api('/admin/moderation/terms',{method:'POST',body:{term:document.getElementById('newBlockedTerm').value,language:document.getElementById('newTermLanguage').value,severity:Number(document.getElementById('newTermSeverity').value)}});toast(t('success'));loadView()}catch(e){toast(e.message,true)}};
  const reportFilter=document.getElementById('reportStatusFilter');
  if(reportFilter){reportFilter.value=state.moderationStatus;reportFilter.onchange=()=>{state.moderationStatus=reportFilter.value;state.page=1;loadView()}}
  document.querySelectorAll('[data-report-action]').forEach(b=>b.onclick=()=>reviewReport(Number(b.dataset.id),b.dataset.reportAction));
  bindPaging();
}
function reviewReport(id,status){
  showModal(t('resolveReport'),`<div class="form-field"><label>${t('resolutionNote')}</label><textarea id="reportResolutionNote" rows="5" maxlength="500"></textarea></div>`,[
    {label:t('cancel'),onClick:closeModal},
    {label:status==='resolved'?t('resolve'):t('dismiss'),className:status==='resolved'?'primary':'danger',onClick:async()=>{try{await api(`/admin/moderation/${id}/report`,{method:'PATCH',body:{status,note:document.getElementById('reportResolutionNote').value}});closeModal();toast(t('success'));loadView()}catch(e){toast(e.message,true)}}}
  ]);
}

async function renderAudit(){
  const d=await api(`/admin/audit?page=${state.page}&search=${encodeURIComponent(state.search)}`);
  state.lastRows=d.items||[];
  const rows=(d.items||[]).map(x=>`<tr><td>${formatDate(x.created_at)}</td><td><div class="table-primary">${escapeHtml(x.admin_name||t('deletedUser'))}</div><div class="table-secondary">${escapeHtml(x.admin_email||'')}</div></td><td><div class="table-primary">${escapeHtml(auditActionLabel(x.action))}</div><div class="table-secondary">${escapeHtml(x.action)}</div></td><td>${escapeHtml(auditTargetLabel(x.target_type,x.target_id))}</td><td>${renderAuditDetails(x.details)}</td></tr>`).join('');
  document.getElementById('adminContent').innerHTML=`<div class="data-card"><div class="data-card-header"><h2 class="data-card-title">${t('audit')}</h2><span>${formatNumber(d.total)}</span></div><div class="data-table-wrap"><table class="data-table"><thead><tr><th>${t('date')}</th><th>${t('user')}</th><th>${t('action')}</th><th>${t('target')}</th><th>${t('details')}</th></tr></thead><tbody>${rows||`<tr><td colspan="5" class="empty-table">${t('noData')}</td></tr>`}</tbody></table></div>${pagination(d.page,d.per_page,d.total)}</div>`;
  bindPaging();
}

async function renderHealth(){
  const d=await api('/admin/health');
  lastHealthSnapshot=d;
  const security=d.security||{};
  const emailUsage=d.email_usage||{};
  const emailSent=Math.max(0,Number(emailUsage.sent_24h)||0);
  const emailLimit=Math.max(1,Number(emailUsage.limit)||500);
  const emailRemaining=Math.max(0,Number(emailUsage.remaining)||0);
  const emailFailed=Math.max(0,Number(emailUsage.failed_24h)||0);
  const emailPercent=Math.min(100,Math.max(0,Number(emailUsage.percent)||0));
  const emailLevel=String(emailUsage.level||'normal');
  const emailTone=emailLevel==='critical'?'#d93025':emailLevel==='warning'?'#b06000':'#188038';
  const emailAlert=emailLevel==='critical'?t('emailUsageCritical'):emailLevel==='warning'?t('emailUsageWarning'):'';
  setSecurityAlertCount(security.unread_alerts);
  state.lastRows=Object.entries(d.tables||{}).map(([name,count])=>({name,count}));
  const scan=lastSecurityScan;
  const scanBlock=scan?`
    <section class="security-scan-result">
      <div class="security-scan-summary">
        <article class="security-score-card ${escapeHtml(scan.overall_status)}"><span>${t('scanScore')}</span><strong>${formatNumber(scan.score)}</strong><small>${securityStatusLabel(scan.overall_status)}</small></article>
        <article><span>${t('passedChecks')}</span><strong>${formatNumber(scan.summary?.pass)}</strong></article>
        <article><span>${t('warningChecks')}</span><strong>${formatNumber(scan.summary?.warning)}</strong></article>
        <article><span>${t('criticalChecks')}</span><strong>${formatNumber(scan.summary?.critical)}</strong></article>
      </div>
      <div class="data-card security-checks-card">
        <div class="data-card-header"><h2 class="data-card-title">${t('securityCheckResults')}</h2><span>${t('lastScan')}: ${formatDate(scan.scanned_at)}</span></div>
        <div class="security-check-list">${(scan.checks||[]).map(check=>`<div class="security-check-row ${escapeHtml(check.status)}"><span class="security-check-icon">${icon(check.status==='pass'?'check':check.status==='critical'?'alert-triangle':'shield')}</span><div><strong>${escapeHtml(securityCheckLabel(check.key))}</strong>${check.value!==''?`<span>${escapeHtml(check.value)}</span>`:''}${renderSecurityMeta(check.meta)}</div><span class="security-check-status">${escapeHtml(securityStatusLabel(check.status))}</span></div>`).join('')}</div>
      </div>
    </section>`:'';
  const securityRows=(d.recent_security_events||[]).map(x=>`<tr class="${Number(x.is_read)===0?'security-unread-row':''}"><td>${formatDate(x.last_seen_at)}</td><td><div class="table-primary">${escapeHtml(securityEventLabel(x.event_type))}</div><div class="table-secondary">${escapeHtml(x.severity)} · ${Number(x.is_read)===0?t('unread'):t('read')}</div></td><td><div class="table-primary">${escapeHtml(x.username||x.email_masked||'-')}</div><div class="table-secondary">${escapeHtml(x.email_masked||'')}</div></td><td>${escapeHtml(x.ip_address||'-')}</td><td><div class="table-primary">${escapeHtml(x.request_path||'-')}</div><div class="table-secondary security-user-agent" title="${escapeHtml(x.user_agent||'')}">${escapeHtml(x.user_agent||'-')}</div></td><td>${formatNumber(x.occurrence_count)}</td></tr>`).join('');
  document.getElementById('adminContent').innerHTML=`
    <section class="security-control-card">
      <div><span class="security-control-icon">${icon('shield-check')}</span><div><h2>${t('fullSecurityCheck')}</h2><p>${t('scanExplanation')}</p></div></div>
      <div class="security-control-actions"><button id="btnRunSecurityScan" type="button" class="md-button primary">${icon('search')}<span>${t('runFullCheck')}</span></button><button id="btnDownloadSecurityReport" type="button" class="icon-button" title="${escapeHtml(t('downloadSecurityReport'))}" aria-label="${escapeHtml(t('downloadSecurityReport'))}">${icon('download')}</button></div>
    </section>
    ${emailAlert?`<div style="margin:0 0 18px;padding:14px 16px;border:1px solid ${emailLevel==='critical'?'#f1b2ad':'#f7d58b'};border-radius:12px;background:${emailLevel==='critical'?'#fff5f4':'#fff9ec'};color:${emailTone};font-weight:600">${icon('alert-triangle')}<span style="margin-inline-start:8px">${escapeHtml(emailAlert)}</span></div>`:''}
    <section class="health-grid enhanced-health-grid">
      <article class="health-card"><strong>${t('database')}</strong><span class="health-ok">${t('healthy')}</span><p>${escapeHtml(d.database_version)}</p><strong>${t('serverSoftware')}</strong><p>${escapeHtml(d.server_software||'-')}</p></article>
      <article class="health-card"><strong>${t('uploads')}</strong><span class="${d.uploads_writable?'health-ok':'health-bad'}">${d.uploads_writable?t('healthy'):t('unavailable')}</span><p><span class="path-chip">${escapeHtml(d.uploads_path)}</span></p><strong>${t('storageUsed')}</strong><p>${formatBytes(d.uploads_bytes)} · ${formatNumber(d.uploads_files)} ${t('files')}</p>${d.disk_free_bytes!==null?`<strong>${t('diskFree')}</strong><p>${formatBytes(d.disk_free_bytes)}</p>`:''}</article>
      <article class="health-card"><strong>${t('phpVersion')}</strong><p>${escapeHtml(d.php_version)}</p><strong>${t('serverTime')}</strong><p>${formatDate(d.server_time)}</p><strong>${t('memoryLimit')}</strong><p>${escapeHtml(d.memory_limit||'-')}</p></article>
      <article class="health-card"><strong>${t('uploadLimits')}</strong><p>${escapeHtml(d.upload_max_filesize||'-')} / ${escapeHtml(d.post_max_size||'-')}</p><strong>${t('fileUploads')}</strong><span class="${d.file_uploads?'health-ok':'health-bad'}">${d.file_uploads?t('enabled'):t('disabled')}</span></article>
      <article class="health-card security-health-card"><strong>${t('loginProtection')}</strong><p>${t('failedLogins24h')}: <b>${formatNumber(security.failed_logins_24h)}</b></p><p>${t('successfulLogins24h')}: <b>${formatNumber(security.successful_logins_24h)}</b></p><p>${t('blockedLoginKeys')}: <b>${formatNumber(security.blocked_login_keys)}</b></p></article>
      <article class="health-card security-health-card"><strong>${t('securityAlerts')}</strong><span class="${Number(security.unread_alerts)>0?'health-bad':'health-ok'}">${formatNumber(security.unread_alerts)}</span><p>${t('adminAttempts24h')}: <b>${formatNumber(security.admin_attempts_24h)}</b></p><p>${t('criticalChecks')}: <b>${formatNumber(security.critical_alerts)}</b></p></article>
      <article class="health-card security-health-card"><strong>${t('emailUsage')}</strong><span style="color:${emailTone};font-weight:700">${formatNumber(emailSent)} / ${formatNumber(emailLimit)}</span><div style="height:8px;margin:11px 0 10px;border-radius:999px;background:#edf0f2;overflow:hidden"><span style="display:block;width:${emailPercent}%;height:100%;border-radius:inherit;background:${emailTone}"></span></div><p>${t('emailsRemaining')}: <b>${formatNumber(emailRemaining)}</b></p><p>${t('emailFailures24h')}: <b>${formatNumber(emailFailed)}</b></p><p style="font-size:11px">${t('emailTrackingNote')}</p></article>
      <article class="health-card"><strong>${t('systemErrors')}</strong><span class="${Number(d.errors_24h)>0?'health-bad':'health-ok'}">${formatNumber(d.errors_24h)}</span><p>24h</p></article>
    </section>
    ${scanBlock}
    <div class="data-card" style="margin-top:18px"><div class="data-card-header"><h2 class="data-card-title">${t('securityEvents')}</h2><div class="card-header-actions"><span>${formatNumber(security.unread_alerts)} ${t('unread')}</span><button id="btnMarkSecurityRead" type="button" class="md-button secondary" ${Number(security.unread_alerts)===0?'disabled':''}>${t('markAlertsRead')}</button></div></div><div class="data-table-wrap"><table class="data-table"><thead><tr><th>${t('lastSeen')}</th><th>${t('eventType')}</th><th>${t('user')}</th><th>${t('ipAddress')}</th><th>${t('route')} / ${t('browser')}</th><th>${t('occurrences')}</th></tr></thead><tbody>${securityRows||`<tr><td colspan="6" class="empty-table">${t('noData')}</td></tr>`}</tbody></table></div></div>
    <div class="data-card" style="margin-top:18px"><div class="data-table-wrap"><table class="data-table"><thead><tr><th>${t('database')}</th><th>${t('items')}</th></tr></thead><tbody>${Object.entries(d.tables||{}).map(([k,v])=>`<tr><td>${escapeHtml(k)}</td><td>${v===null?'-':formatNumber(v)}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="data-card" style="margin-top:18px"><div class="data-card-header"><h2 class="data-card-title">${t('recentErrors')}</h2></div><div class="data-table-wrap"><table class="data-table"><thead><tr><th>${t('date')}</th><th>${t('user')}</th><th>${t('ipAddress')}</th><th>${t('action')}</th><th>${t('route')}</th><th>${t('message')}</th></tr></thead><tbody>${(d.recent_errors||[]).map(x=>`<tr><td>${formatDate(x.created_at)}</td><td>${escapeHtml(x.username||(state.lang==='he'?'מערכת/אורח':'System/guest'))}</td><td>${escapeHtml(x.ip_address||'-')}</td><td>${escapeHtml(x.event_type)}</td><td>${escapeHtml(x.route||'-')}</td><td>${escapeHtml(x.message)}</td></tr>`).join('')||`<tr><td colspan="6" class="empty-table">${t('noData')}</td></tr>`}</tbody></table></div></div>`;

  document.getElementById('btnRunSecurityScan').onclick=async()=>{
    const button=document.getElementById('btnRunSecurityScan');
    button.disabled=true;
    button.querySelector('span').textContent=t('runningScan');
    try{
      lastSecurityScan=await api('/admin/security/scan',{method:'POST'});
      toast(t('success'));
      await renderHealth();
    }catch(e){toast(e.message,true);button.disabled=false;button.querySelector('span').textContent=t('runFullCheck')}
  };
  document.getElementById('btnDownloadSecurityReport').onclick=async()=>{
    const button=document.getElementById('btnDownloadSecurityReport');
    button.disabled=true;
    button.title=t('preparingSecurityReport');
    button.setAttribute('aria-label',t('preparingSecurityReport'));
    try{await downloadSecuritySupportReport();await renderHealth()}catch(e){toast(e.message,true);button.disabled=false;button.title=t('downloadSecurityReport');button.setAttribute('aria-label',t('downloadSecurityReport'))}
  };
  document.getElementById('btnMarkSecurityRead').onclick=async()=>{
    try{await api('/admin/security/read',{method:'POST'});setSecurityAlertCount(0);toast(t('success'));await renderHealth()}catch(e){toast(e.message,true)}
  };
}

function bindPaging(){document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{state.page=Math.max(1,Number(b.dataset.page));loadView()})}
function exportCsv(){if(!state.lastRows.length){toast(t('noData'),true);return}const keys=[...new Set(state.lastRows.flatMap(Object.keys))];const csv=[keys.join(','),...state.lastRows.map(row=>keys.map(k=>`"${String(row[k]??'').replace(/"/g,'""')}"`).join(','))].join('\n');const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`sharedcart-${state.view}-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(a.href)}

function syncDesktopGuard(){const desktop=matchMedia('(min-width:1024px)').matches;document.getElementById('desktopOnly').hidden=desktop;document.getElementById('adminApp').hidden=!desktop;return desktop}
function bootEvents(){
  document.querySelectorAll('.admin-nav-item').forEach(b=>b.onclick=()=>switchAdminView(b.dataset.view));
  document.querySelectorAll('[data-period]').forEach(b=>b.onclick=()=>{state.period=Number(b.dataset.period);document.querySelectorAll('[data-period]').forEach(x=>x.classList.toggle('active',x===b));loadView()});
  document.getElementById('btnAdminLanguage').onclick=async()=>{state.language=state.language==='he'?'en':'he';applyLanguage();try{await api('/profile/language',{method:'PATCH',body:{language:state.language}})}catch{}loadView()};
  document.getElementById('btnRefreshAdmin').onclick=loadView;
  document.getElementById('btnSecurityAlerts').onclick=()=>switchAdminView('health');
  document.getElementById('adminSearch').oninput=e=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{state.search=e.target.value.trim();state.page=1;loadView()},350)};
  document.getElementById('btnExportCsv').onclick=exportCsv;
  window.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
  window.addEventListener('resize',syncDesktopGuard);
}


async function boot(){installIcons();applyLanguage();if(!syncDesktopGuard())return;bootEvents();try{await loadMe();await loadView()}catch(e){if(e.status===401||e.status===403){location.replace('index.html?admin_access=denied');return}renderError(e);toast(e.message,true)}}
boot();
