// Grocery App - Frontend Logic (jQuery 3.x)

const API       = '/api';
const TOKEN_KEY = 'cg_token';
const LANGUAGE_KEY = 'cg_language';
const POLL_MS   = 5000;


const TABLER_SPRITE_URL = '/img/tabler-icons.svg';

function tablerIcon(name, className = 'tabler-icon') {
    const safeName = String(name || '').replace(/[^a-z0-9-]/gi, '');
    const safeClassName = String(className || 'tabler-icon').replace(/[^a-z0-9 _-]/gi, '');
    return $(`<svg class="icon icon-tabler icon-tabler-${safeName} ${safeClassName}" aria-hidden="true" focusable="false"><use href="${TABLER_SPRITE_URL}#tabler-${safeName}"></use></svg>`);
}

function renderNewItemImageButton(hasImage) {
    const $button = $('#btnPickItemImage').empty();
    $button.append(tablerIcon('photo'));
    if (hasImage) {
        $button.append(tablerIcon('check', 'tabler-icon image-picker-check'));
    }
    $button.toggleClass('has-image', !!hasImage)
        .attr('aria-label', hasImage ? uiText('נבחרה תמונה - החלף תמונה', 'Image selected - replace image') : uiText('הוסף תמונה', 'Add image'));
}

const MAIN_LANGUAGE_TEXT = {
    he: {
        siteTitle: 'סל שיתופי', skip: 'דלג לתוכן', back: 'חזור', login: 'כניסה', registerLink: 'אין לי חשבון - הרשמה',
        forgot: 'שכחתי סיסמה', register: 'הרשמה', loginLink: 'יש לי חשבון - כניסה', profile: 'פרופיל', logout: 'יציאה',
        rename: 'שנה שם', groupsTitle: 'הקבוצות שלי', newGroup: 'קבוצה חדשה', joinGroup: 'הצטרף לקבוצה קיימת', create: 'צור', join: 'הצטרף',
        addItem: 'הוסף פריט', itemPlaceholder: 'שם פריט (לא חובה עם תמונה)', list: 'רשימה', history: 'היסטוריה', members: 'חברים', share: 'שתף',
        email: 'אימייל', loginIdentifier: 'שם משתמש או אימייל', password: 'סיסמה', username: 'שם משתמש', confirmPassword: 'אימות סיסמה', authSub: 'קניות משותפות, בקלות',
        groupName: 'שם הקבוצה', invitePlaceholder: 'הדבק קישור הצטרפות...', profileDescription: 'כאן אפשר לשנות את שם המשתמש ואת סיסמת החשבון.',
        saveChanges: 'שמור שינויים', cancel: 'ביטול', addImage: 'הוסף תמונה', notifications: 'התראות', admin: 'לוח ניהול',
        minPassword: 'לפחות 8 תווים', yourName: 'השם שלך', passwordAgain: 'יש להזין את הסיסמה שוב', sendCode: 'שלח קוד אימות',
        backToLogin: 'חזרה לכניסה', verificationCode: 'קוד אימות', verifyCode: 'אמת קוד', changePassword: 'שינוי סיסמה', newPassword: 'סיסמה חדשה',
        changePasswordButton: 'שנה סיסמה', codeVerified: 'הקוד אומת. אפשר להגדיר סיסמה חדשה.', copy: 'העתק', close: 'סגור',
        existingItem: 'הפריט כבר קיים', addExisting: 'הוסף לכמות הקיימת', emptyList: 'הרשימה ריקה', quantity: 'כמות', leaveGroup: 'עזוב קבוצה',
        clearHistory: 'מחק היסטוריה', noActivity: 'אין פעילות עדיין', groupMembers: 'חברי הקבוצה', noMembers: 'אין חברים בקבוצה',
        deleteGroup: 'מחק קבוצה', moreActions: 'פעולות נוספות', message: 'הודעה', ok: 'אישור', itemActions: 'פעולות לפריט',
        addComment: 'הוסף הערה', reportItem: 'דווח על הפריט', deleteItem: 'מחק פריט', commentsTitle: 'הערות', noComments: 'אין הערות לפריט הזה.',
        commentTitle: 'הוספת הערה', commentLabel: 'תוכן ההערה', commentPlaceholder: 'כתבו הערה...', saveComment: 'הוסף הערה', backToGroups: 'חזרה לקבוצות',
        groupManagement: 'ניהול קבוצה', groupAdminTitle: 'הגדרות והרשאות', backToList: 'חזרה לרשימה', emailNotifications: 'התראות במייל',
        emailNotificationsDescription: 'שליחת מייל ליוצר הקבוצה בכל פעם שמשתתף אחר מסמן פריט כנלקח.', emailNotificationsLabel: 'קבלת התראות במייל',
        manageMembers: 'ניהול משתתפים', manageContent: 'ניהול תוכן', manageContentDescription: 'אפשר למחוק פריטים שנוספו על ידי כל משתתף. מחיקת פריט מסתירה גם את ההערות המשויכות אליו.',
        deleteComment: 'מחק הערה', report: 'דיווח', reportReason: 'סיבת הדיווח', reportPlaceholder: 'תארו בקצרה מה הבעיה', sendReport: 'שלח דיווח', imageClose: 'סגור תמונה'
    },
    en: {
        siteTitle: 'SharedCart', skip: 'Skip to content', back: 'Back', login: 'Sign in', registerLink: 'Create an account',
        forgot: 'Forgot password', register: 'Register', loginLink: 'I already have an account', profile: 'Profile', logout: 'Sign out',
        rename: 'Rename', groupsTitle: 'My groups', newGroup: 'New group', joinGroup: 'Join an existing group', create: 'Create', join: 'Join',
        addItem: 'Add item', itemPlaceholder: 'Item name (optional with image)', list: 'List', history: 'History', members: 'Members', share: 'Share',
        email: 'Email', loginIdentifier: 'Username or email', password: 'Password', username: 'Username', confirmPassword: 'Password confirmation', authSub: 'Shared shopping, made simple',
        groupName: 'Group name', invitePlaceholder: 'Paste an invitation link...', profileDescription: 'Change your display name and account password.',
        saveChanges: 'Save changes', cancel: 'Cancel', addImage: 'Add image', notifications: 'Notifications', admin: 'Admin dashboard',
        minPassword: 'At least 8 characters', yourName: 'Your name', passwordAgain: 'Enter the password again', sendCode: 'Send verification code',
        backToLogin: 'Back to sign in', verificationCode: 'Verification code', verifyCode: 'Verify code', changePassword: 'Change password', newPassword: 'New password',
        changePasswordButton: 'Change password', codeVerified: 'The code was verified. You can set a new password.', copy: 'Copy', close: 'Close',
        existingItem: 'The item already exists', addExisting: 'Add to existing quantity', emptyList: 'The list is empty', quantity: 'Quantity', leaveGroup: 'Leave group',
        clearHistory: 'Clear history', noActivity: 'No activity yet', groupMembers: 'Group members', noMembers: 'No members in this group',
        deleteGroup: 'Delete group', moreActions: 'More actions', message: 'Message', ok: 'OK', itemActions: 'Item actions',
        addComment: 'Add comment', reportItem: 'Report item', deleteItem: 'Delete item', commentsTitle: 'Comments', noComments: 'No comments for this item.',
        commentTitle: 'Add comment', commentLabel: 'Comment', commentPlaceholder: 'Write a comment...', saveComment: 'Add comment', backToGroups: 'Back to groups',
        groupManagement: 'Group management', groupAdminTitle: 'Settings and permissions', backToList: 'Back to list', emailNotifications: 'Email notifications',
        emailNotificationsDescription: 'Email the group creator whenever another member marks an item as taken.', emailNotificationsLabel: 'Receive email notifications',
        manageMembers: 'Manage members', manageContent: 'Manage content', manageContentDescription: 'Delete items added by any member. Deleting an item also hides its associated comments.',
        deleteComment: 'Delete comment', report: 'Report', reportReason: 'Report reason', reportPlaceholder: 'Briefly describe the problem', sendReport: 'Send report', imageClose: 'Close image'
    }
};

function uiText(he, en) {
    return currentLanguage === 'he' ? he : en;
}

function applyMainLanguage() {
    const text = MAIN_LANGUAGE_TEXT[currentLanguage];
    document.documentElement.lang = currentLanguage;
    document.documentElement.dir = currentLanguage === 'he' ? 'rtl' : 'ltr';
    document.title = text.siteTitle;
    localStorage.setItem(LANGUAGE_KEY, currentLanguage);

    $('.skip-link').text(text.skip);
    $('#btnBack').attr('aria-label', text.back);
    if (!currentGroupId) $('#hdrTitle').text(text.siteTitle);
    $('#btnLogin').text(text.login);
    $('#btnShowRegister').text(text.registerLink);
    $('#btnShowForgotPassword').text(text.forgot);
    $('#btnRegister').text(text.register);
    $('#btnShowLogin').text(text.loginLink);
    $('#btnProfile, #btnHomeProfileLabel, #mobileMenuProfile span:last-child').text(text.profile);
    $('#btnLogout, #mobileMenuLogout span:last-child').text(text.logout);
    $('#mobileMenuLeave span:last-child').text(text.leaveGroup);
    $('#mobileMenuBack span:last-child').text(text.backToGroups);
    $('#btnRenameGroup').text(text.rename);
    $('#btnGroupManage, #mobileMenuManage span:last-child, #groupAdminEyebrow').text(text.groupManagement);
    $('#mobileMenuRename span:last-child').text(currentLanguage === 'he' ? 'שנה שם קבוצה' : 'Rename group');
    $('#screenGroups .section-label').eq(0).text(text.groupsTitle);
    $('#screenGroups .section-label').eq(1).text(text.newGroup);
    $('#screenGroups .section-label').eq(2).text(text.joinGroup);
    $('#btnCreateGroup').text(text.create);
    $('#btnJoinGroup').text(text.join);
    $('#newItemName').attr({placeholder: text.itemPlaceholder, 'aria-label': text.itemPlaceholder});
    $('#newItemQty').attr('aria-label', text.quantity);
    $('#addItemForm .add-btn').text(text.addItem).attr('aria-label', text.addItem);
    $('.nav-btn[data-tab="items"] span:last-child').text(text.list);
    $('.nav-btn[data-tab="activity"] span:last-child').text(text.history);
    $('.nav-btn[data-tab="members"] span:last-child').text(text.members);
    $('.nav-btn[data-tab="share"] span:last-child').text(text.share);
    $('#btnLanguage').attr({
        'aria-label': currentLanguage === 'he' ? 'Switch to English' : 'מעבר לעברית',
        title: currentLanguage === 'he' ? 'English' : 'עברית'
    });
    $('.auth-title').text(text.siteTitle);
    $('.auth-sub').first().text(text.authSub);
    $('label[for="loginEmail"]').text(text.loginIdentifier);
    $('label[for="regEmail"], label[for="forgotEmail"], label[for="resetEmail"]').text(text.email);
    $('#loginEmail').attr('placeholder', currentLanguage === 'he' ? 'שם משתמש או your@email.com' : 'Username or your@email.com');
    $('label[for="loginPassword"], label[for="regPassword"]').text(text.password);
    $('label[for="newPassword"]').text(text.newPassword);
    $('label[for="regUsername"], label[for="profileUsername"]').text(text.username);
    $('label[for="regPasswordConfirm"], label[for="newPasswordConfirm"]').text(text.confirmPassword);
    $('label[for="resetCode"]').text(text.verificationCode);
    $('#loginPassword, #regPassword, #newPassword').attr('placeholder', text.minPassword);
    $('#regUsername').attr('placeholder', text.yourName);
    $('#regPasswordConfirm, #newPasswordConfirm').attr('placeholder', text.passwordAgain);
    $('#btnSendResetCode').text(text.sendCode);
    $('#btnBackToLoginFromForgot, #btnBackToLoginFromReset, #btnBackToLoginFromNewPassword').text(text.backToLogin);
    $('#btnVerifyResetCode').text(text.verifyCode);
    $('#formNewPassword .section-label').text(text.changePassword);
    $('#newPasswordHint').text(text.codeVerified);
    $('#btnResetPassword').text(text.changePasswordButton);
    $('#newGroupName').attr('placeholder', text.groupName);
    $('#joinInviteLink').attr('placeholder', text.invitePlaceholder);
    $('#btnCopyLink').text(text.copy);
    $('#btnShareClose').attr('aria-label', text.close);
    $('#existingItemTitle').text(text.existingItem);
    $('#btnExistingItemAdd').text(text.addExisting);
    $('#btnExistingItemCancel').text(text.cancel);
    $('#emptyState').text(text.emptyList);
    $('#btnLeaveGroup').text(text.leaveGroup);
    $('#screenActivity .section-label').text(text.history);
    $('#btnClearActivity').text(text.clearHistory);
    $('#activityEmpty').text(text.noActivity);
    $('#screenMembers .section-label').text(text.groupMembers);
    $('#membersEmpty').text(text.noMembers);
    $('#btnDeleteGroup').text(text.deleteGroup);
    $('#groupAdminTitle').text(text.groupAdminTitle);
    $('#btnGroupAdminBack').text(text.backToList);
    $('#groupAdminEmailTitle').text(text.emailNotifications);
    $('#groupAdminEmailDescription').text(text.emailNotificationsDescription);
    $('#groupEmailNotificationsLabel').text(text.emailNotificationsLabel);
    $('#groupAdminMembersTitle').text(text.manageMembers);
    $('#groupAdminContentTitle').text(text.manageContent);
    $('#groupAdminContentDescription').text(text.manageContentDescription);
    $('.mobile-menu-secondary').attr('aria-label', text.moreActions);
    $('#uiAlertTitle').text(text.message);
    $('#uiAlertOk').text(text.ok);
    $('#profileTitle').text(text.profile);
    $('.profile-description').text(text.profileDescription);
    $('#profileUsername').attr('placeholder', currentLanguage === 'he' ? 'שם המשתמש שלך' : 'Your username');
    $('#btnSaveProfile').text(text.saveChanges);
    $('#btnCancelProfile').text(text.cancel);
    $('#profilePasswordTitle').text(text.changePassword);
    $('#profileCurrentPasswordLabel').text(currentLanguage === 'he' ? 'סיסמה נוכחית' : 'Current password');
    $('#profileNewPasswordLabel').text(text.newPassword);
    $('#profilePasswordConfirmLabel').text(currentLanguage === 'he' ? 'אימות סיסמה חדשה' : 'Confirm new password');
    $('#profileCurrentPassword').attr('placeholder', currentLanguage === 'he' ? 'הסיסמה הנוכחית' : 'Current password');
    $('#profileNewPassword').attr('placeholder', text.minPassword);
    $('#profilePasswordConfirm').attr('placeholder', currentLanguage === 'he' ? 'יש להזין שוב את הסיסמה החדשה' : 'Enter the new password again');
    $('#btnChangeProfilePassword').text(text.changePasswordButton);
    $('#itemActionsTitle').text(text.itemActions);
    $('#itemActionCommentsText, #btnAddCommentFromModal').text(text.addComment);
    $('#btnItemActionReport .item-action-text').text(text.reportItem);
    $('#btnItemActionDelete .item-action-text').text(text.deleteItem);
    $('#commentsTitle').text(text.commentsTitle);
    $('#commentsEmpty').text(text.noComments);
    $('#commentComposerTitle').text(text.commentTitle);
    $('#commentComposerLabel').text(text.commentLabel);
    $('#commentComposerBody').attr('placeholder', text.commentPlaceholder);
    $('#btnSubmitComment').text(text.saveComment);
    $('#btnCancelComment').text(text.cancel);
    $('#reportTitle').text(text.report);
    $('.report-label').text(text.reportReason);
    $('#reportReason').attr('placeholder', text.reportPlaceholder);
    $('#btnSubmitReport').text(text.sendReport);
    $('#btnCancelReport').text(text.cancel);
    $('#btnPickItemImage').attr('aria-label', text.addImage);
    $('#btnNotifications').attr('aria-label', text.notifications);
    $('#btnHomeProfile').attr('aria-label', currentLanguage === 'he' ? 'פתח פרופיל' : 'Open profile');
    $('#profilePasswordTitle').text(currentLanguage === 'he' ? 'אבטחת החשבון' : 'Account security');
    $('#profilePasswordIntro').text(currentLanguage === 'he' ? 'שינוי סיסמה מחייב קוד אימות שיישלח לאימייל של החשבון.' : 'Changing the password requires a verification code sent to the account email.');
    $('#btnStartProfilePasswordChange').text(text.changePassword);
    $('#profilePasswordCodeLabel').text(text.verificationCode);
    $('#btnVerifyProfilePasswordCode').text(text.verifyCode);
    $('#btnResendProfilePasswordCode').text(currentLanguage === 'he' ? 'שלח שוב' : 'Send again');
    $('#profileNewPasswordLabel').text(text.newPassword);
    $('#profilePasswordConfirmLabel').text(currentLanguage === 'he' ? 'אימות סיסמה חדשה' : 'Confirm new password');
    $('#btnConfirmProfilePasswordChange').text(currentLanguage === 'he' ? 'שמור סיסמה חדשה' : 'Save new password');
    $('#btnAdminDashboard').attr({'aria-label': text.admin, title: text.admin});
    $('#adminDashboardLabel').text(text.admin);
    updateHomeProfileName();
    $('#itemActionsClose, #commentsClose, #commentComposerClose, #reportClose, #imagePreviewClose').attr('aria-label', text.close);
}

function updateAdminDashboardButton() {
    $('#btnAdminDashboard').toggleClass('hidden', currentUserRole !== 'admin' || !currentAdminPath);
}

function loadCurrentProfile() {
    return apiCall('GET', '/profile/me')
        .done(profile => {
            currentUsername = String(profile.username || '');
            currentUserEmail = String(profile.email || '').trim().toLowerCase();
            updateHomeProfileName();
            currentUserRole = String(profile.role || 'user');
            currentAdminPath = currentUserRole === 'admin' ? String(profile.admin_path || '') : '';
            if (!localStorage.getItem(LANGUAGE_KEY) && profile.preferred_language) {
                currentLanguage = profile.preferred_language === 'en' ? 'en' : 'he';
            }
            updateAdminDashboardButton();
            applyMainLanguage();
        })
        .fail(() => {
            currentUserRole = 'user';
            currentUserEmail = '';
            updateHomeProfileName();
            currentAdminPath = '';
            updateAdminDashboardButton();
        });
}

let currentGroupId        = null;
let currentGroupCanRename = false;
let currentUserId         = null;
let currentUsername       = '';
let currentUserEmail      = '';
let currentUserRole       = 'user';
let currentAdminPath      = '';
let currentLanguage       = localStorage.getItem(LANGUAGE_KEY) === 'en' ? 'en' : 'he';
let pollTimer             = null;
let serverClockOffsetMs   = 0;
let resetSessionToken     = sessionStorage.getItem('cg_reset_token') || '';
let resetSessionEmail     = sessionStorage.getItem('cg_reset_email') || '';
let pendingExistingItem   = null;
let pendingNewItemImage   = null;
let imagePreviewReturnFocus = null;
let profileReturnFocus      = null;
let commentsReturnFocus     = null;
let commentsModalItemId     = null;
let commentsModalItemName   = '';
let commentComposerReturnFocus = null;
let commentComposerContext     = null;
let commentComposerOnAdded     = null;
let itemActionsReturnFocus   = null;
let itemActionsContext       = null;
let reportReturnFocus         = null;
let reportContext             = null;
let notificationsPanelOpen = false;
let profilePasswordResetToken = '';
let profilePasswordCodeSent = false;
const shareLinkCache = new Map();
const shareLinkRequests = new Map();

// API
function apiCall(method, endpoint, data) {
    const opts = {
        url: API + endpoint,
        method,
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + getToken() }
    };
    if (data !== undefined) opts.data = JSON.stringify(data);
    return $.ajax(opts);
}

function apiUpload(method, endpoint, formData) {
    return $.ajax({
        url: API + endpoint,
        method,
        data: formData,
        processData: false,
        contentType: false,
        headers: { Authorization: 'Bearer ' + getToken() }
    });
}

const nativeAlert = window.alert.bind(window);
function setStyledAlertIcon(type = 'warning') {
    const isSuccess = type === 'success';
    const iconName = isSuccess ? 'check' : 'alert-triangle';
    const $icon = $('#uiAlertIcon');
    const $svg = $icon.find('svg');

    $icon.toggleClass('is-success', isSuccess).toggleClass('is-warning', !isSuccess);
    $svg.attr('class', `icon icon-tabler icon-tabler-${iconName} tabler-icon`);
    $svg.find('use').attr('href', `/img/tabler-icons.svg#tabler-${iconName}`);
}

function showStyledAlert(message, title = uiText('הודעה', 'Message'), type = 'warning') {
    const $modal = $('#uiAlertModal');
    if (!$modal.length) {
        nativeAlert(String(message ?? ''));
        return;
    }
    setStyledAlertIcon(type);
    $('#uiAlertTitle').text(title);
    $('#uiAlertText').text(String(message ?? ''));
    $modal.removeClass('hidden');
    $('#uiAlertOk').trigger('focus');
}
window.alert = showStyledAlert;

function hideStyledAlert() {
    $('#uiAlertModal').addClass('hidden');
}

$(document).on('keydown', event => {
    if (event.key === 'Escape') {
        if (!$('#commentComposerModal').hasClass('hidden')) {
            hideCommentComposer();
            return;
        }
        hideExistingItemSheet();
        hideStyledAlert();
        hideImagePreview();
        hideProfileModal();
        hideCommentsModal();
        hideItemActionsModal();
        hideReportModal();
        closeMobileGroupMenu();
    }
});

$('#uiAlertOk').on('click', hideStyledAlert);
$('#uiAlertModal').on('click', event => {
    if (event.target && event.target.id === 'uiAlertModal') hideStyledAlert();
});

function showImagePreview(src, itemName, trigger) {
    const cleanSrc = String(src || '').trim();
    const cleanName = String(itemName || '').trim();
    if (!cleanSrc) return;

    imagePreviewReturnFocus = trigger || document.activeElement;
    $('#imagePreviewImage')
        .attr('src', cleanSrc)
        .attr('alt', cleanName ? `תמונה מוגדלת של ${cleanName}` : 'תמונה מוגדלת של פריט');
    $('#imagePreviewTitle')
        .text(cleanName)
        .toggleClass('hidden', !cleanName);
    $('#imagePreviewModal').removeClass('hidden');
    $('body').addClass('image-preview-open');
    $('#imagePreviewClose').trigger('focus');
}

function hideImagePreview() {
    const $modal = $('#imagePreviewModal');
    if (!$modal.length || $modal.hasClass('hidden')) return;

    $modal.addClass('hidden');
    $('#imagePreviewImage').attr('src', '').attr('alt', '');
    $('body').removeClass('image-preview-open');

    if (imagePreviewReturnFocus && document.contains(imagePreviewReturnFocus)) {
        imagePreviewReturnFocus.focus();
    }
    imagePreviewReturnFocus = null;
}


function clearProfileFeedback() {
    $('#profileError, #profilePasswordError').text('').addClass('hidden');
    $('#profileMessage, #profilePasswordMessage').text('').addClass('hidden');
    $('#profileUsername, #profilePasswordCode, #profileNewPassword, #profilePasswordConfirm').removeAttr('aria-invalid');
}

function maskEmail(email) {
    const value = String(email || '').trim();
    const parts = value.split('@');
    if (parts.length !== 2) return value;
    const local = parts[0];
    const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
    return `${visible}${'*'.repeat(Math.max(2, local.length - visible.length))}@${parts[1]}`;
}

function updateHomeProfileName() {
    const label = currentUsername
        ? uiText(`מחובר/ת כ-${currentUsername}`, `Signed in as ${currentUsername}`)
        : uiText('הגדרות החשבון ושינוי סיסמה', 'Account settings and password');
    $('#homeProfileName').text(label);
}

function resetProfilePasswordFlow() {
    profilePasswordResetToken = '';
    profilePasswordCodeSent = false;
    $('#profilePasswordCode, #profileNewPassword, #profilePasswordConfirm').val('');
    $('#profilePasswordVerification, #profilePasswordNewFields').addClass('hidden');
    $('#btnStartProfilePasswordChange').removeClass('hidden').prop('disabled', false).text(uiText('שינוי סיסמה', 'Change password'));
    clearProfileFeedback();
}

function showProfileModal(trigger) {
    profileReturnFocus = trigger || document.activeElement;
    clearProfileFeedback();
    resetProfilePasswordFlow();
    $('#profileUsername').val(currentUsername || '');
    $('#profileModal').removeClass('hidden');
    $('body').addClass('profile-modal-open');
    setTimeout(() => $('#profileUsername').trigger('focus').trigger('select'), 0);
}

function hideProfileModal() {
    const $modal = $('#profileModal');
    if (!$modal.length || $modal.hasClass('hidden')) return;

    $modal.addClass('hidden');
    $('body').removeClass('profile-modal-open');
    resetProfilePasswordFlow();

    if (profileReturnFocus && document.contains(profileReturnFocus)) {
        profileReturnFocus.focus();
    }
    profileReturnFocus = null;
}

function saveProfileUsername() {
    clearProfileFeedback();
    const username = $('#profileUsername').val().trim();

    if (!username) {
        $('#profileUsername').attr('aria-invalid', 'true').trigger('focus');
        $('#profileError').text(uiText('יש להזין שם משתמש', 'Enter a username')).removeClass('hidden');
        return;
    }
    if (Array.from(username).length > 50) {
        $('#profileUsername').attr('aria-invalid', 'true').trigger('focus');
        $('#profileError').text(uiText('שם המשתמש יכול להכיל עד 50 תווים', 'The username can contain up to 50 characters')).removeClass('hidden');
        return;
    }
    if (/[\x00-\x1F\x7F]/u.test(username)) {
        $('#profileUsername').attr('aria-invalid', 'true').trigger('focus');
        $('#profileError').text(uiText('שם המשתמש מכיל תווים שאינם נתמכים', 'The username contains unsupported characters')).removeClass('hidden');
        return;
    }

    const $button = $('#btnSaveProfile').prop('disabled', true).text(uiText('שומר...', 'Saving...'));
    apiCall('PATCH', '/profile/username', { username })
        .done(response => {
            currentUsername = String(response.username || username);
            $('#profileUsername').val(currentUsername);
            updateHomeProfileName();
            $('#profileMessage').text(uiText('שם המשתמש עודכן בהצלחה', 'Username updated successfully')).removeClass('hidden');
            if (currentGroupId) loadMembers();
        })
        .fail(xhr => {
            $('#profileError').text(apiErr(xhr)).removeClass('hidden');
        })
        .always(() => $button.prop('disabled', false).text(uiText('שמור שינויים', 'Save changes')));
}

function requestProfilePasswordCode() {
    clearProfileFeedback();
    const send = () => {
        if (!currentUserEmail) {
            $('#profilePasswordError').text(uiText('לא נמצאה כתובת אימייל בחשבון', 'No email address was found for this account')).removeClass('hidden');
            return;
        }
        const $buttons = $('#btnStartProfilePasswordChange, #btnResendProfilePasswordCode').prop('disabled', true);
        $('#btnStartProfilePasswordChange').text(uiText('שולח קוד...', 'Sending code...'));
        apiCall('POST', '/auth/forgot-password', { email: currentUserEmail })
            .done(() => {
                profilePasswordResetToken = '';
                profilePasswordCodeSent = true;
                $('#btnStartProfilePasswordChange').addClass('hidden');
                $('#profilePasswordNewFields').addClass('hidden');
                $('#profilePasswordVerification').removeClass('hidden');
                $('#profilePasswordEmailHint').text(uiText(`קוד אימות נשלח אל ${maskEmail(currentUserEmail)}`, `A verification code was sent to ${maskEmail(currentUserEmail)}`));
                $('#profilePasswordMessage').text(uiText('בדקי את האימייל והזיני את הקוד בן 6 הספרות.', 'Check your email and enter the 6-digit code.')).removeClass('hidden');
                $('#profilePasswordCode').val('').trigger('focus');
            })
            .fail(xhr => $('#profilePasswordError').text(apiErr(xhr)).removeClass('hidden'))
            .always(() => {
                $buttons.prop('disabled', false);
                $('#btnStartProfilePasswordChange').text(uiText('שינוי סיסמה', 'Change password'));
            });
    };

    if (currentUserEmail) {
        send();
    } else {
        loadCurrentProfile().done(send).fail(() => {
            $('#profilePasswordError').text(uiText('לא ניתן לטעון את פרטי החשבון', 'Could not load the account details')).removeClass('hidden');
        });
    }
}

function verifyProfilePasswordCode() {
    clearProfileFeedback();
    const code = $('#profilePasswordCode').val().trim();
    if (!/^\d{6}$/.test(code)) {
        $('#profilePasswordCode').attr('aria-invalid', 'true').trigger('focus');
        $('#profilePasswordError').text(uiText('יש להזין קוד אימות בן 6 ספרות', 'Enter the 6-digit verification code')).removeClass('hidden');
        return;
    }

    const $button = $('#btnVerifyProfilePasswordCode').prop('disabled', true).text(uiText('מאמת...', 'Verifying...'));
    apiCall('POST', '/auth/verify-reset-code', { email: currentUserEmail, code })
        .done(response => {
            profilePasswordResetToken = String(response.reset_token || '');
            if (!profilePasswordResetToken) {
                $('#profilePasswordError').text(uiText('אימות הקוד נכשל', 'Code verification failed')).removeClass('hidden');
                return;
            }
            $('#profilePasswordVerification').addClass('hidden');
            $('#profilePasswordNewFields').removeClass('hidden');
            $('#profilePasswordMessage').text(uiText('האימייל אומת. עכשיו אפשר לבחור סיסמה חדשה.', 'The email was verified. You can now choose a new password.')).removeClass('hidden');
            $('#profileNewPassword').trigger('focus');
        })
        .fail(xhr => $('#profilePasswordError').text(apiErr(xhr)).removeClass('hidden'))
        .always(() => $button.prop('disabled', false).text(uiText('אמת קוד', 'Verify code')));
}

function confirmProfilePasswordChange() {
    clearProfileFeedback();
    const newPassword = $('#profileNewPassword').val();
    const confirmation = $('#profilePasswordConfirm').val();

    if (!profilePasswordResetToken) {
        $('#profilePasswordError').text(uiText('יש לאמת קודם את הקוד שנשלח לאימייל', 'Verify the code sent to your email first')).removeClass('hidden');
        return;
    }
    if (!newPassword || !confirmation) {
        $('#profilePasswordError').text(uiText('יש למלא את שני שדות הסיסמה', 'Complete both password fields')).removeClass('hidden');
        return;
    }
    if (Array.from(newPassword).length < 8) {
        $('#profileNewPassword').attr('aria-invalid', 'true').trigger('focus');
        $('#profilePasswordError').text(uiText('הסיסמה חייבת להכיל לפחות 8 תווים', 'The password must contain at least 8 characters')).removeClass('hidden');
        return;
    }
    if (Array.from(newPassword).length > 256) {
        $('#profileNewPassword').attr('aria-invalid', 'true').trigger('focus');
        $('#profilePasswordError').text(uiText('הסיסמה יכולה להכיל עד 256 תווים', 'The password can contain up to 256 characters')).removeClass('hidden');
        return;
    }
    if (newPassword !== confirmation) {
        $('#profilePasswordConfirm').attr('aria-invalid', 'true').trigger('focus');
        $('#profilePasswordError').text(uiText('הסיסמאות אינן תואמות', 'The passwords do not match')).removeClass('hidden');
        return;
    }

    const $button = $('#btnConfirmProfilePasswordChange').prop('disabled', true).text(uiText('שומר...', 'Saving...'));
    apiCall('POST', '/auth/reset-password', {
        email: currentUserEmail,
        reset_token: profilePasswordResetToken,
        password: newPassword,
        password_confirmation: confirmation
    })
        .done(() => {
            const loginEmail = currentUserEmail;
            $.ajax({url: API + '/auth/logout', method: 'POST'});
            clearToken();
            stopPoll();
            currentGroupId = null;
            currentGroupCanRename = false;
            currentUserEmail = '';
            profilePasswordResetToken = '';
            $('#profileModal').addClass('hidden');
            $('body').removeClass('profile-modal-open');
            $('#appHeader, #bottomNav').addClass('hidden');
            showScreen('screenAuth');
            $('#loginEmail').val(loginEmail || '');
            $('#loginPassword').val('');
            authErr(uiText('הסיסמה שונתה בהצלחה. יש להתחבר מחדש.', 'The password was changed successfully. Sign in again.'));
        })
        .fail(xhr => $('#profilePasswordError').text(apiErr(xhr)).removeClass('hidden'))
        .always(() => $button.prop('disabled', false).text(uiText('שמור סיסמה חדשה', 'Save new password')));
}

$('#profileClose, #btnCancelProfile').on('click', hideProfileModal);
$('#profileModal').on('click', event => {
    if (event.target && event.target.id === 'profileModal') hideProfileModal();
});
$('#btnSaveProfile').on('click', saveProfileUsername);
$('#btnStartProfilePasswordChange, #btnResendProfilePasswordCode').on('click', requestProfilePasswordCode);
$('#btnVerifyProfilePasswordCode').on('click', verifyProfilePasswordCode);
$('#btnConfirmProfilePasswordChange').on('click', confirmProfilePasswordChange);
$('#profilePasswordCode').on('input', clearProfileFeedback).on('keydown', event => {
    if (event.key === 'Enter') {
        event.preventDefault();
        verifyProfilePasswordCode();
    }
});
$('#profileNewPassword, #profilePasswordConfirm').on('input', clearProfileFeedback).on('keydown', event => {
    if (event.key === 'Enter') {
        event.preventDefault();
        confirmProfilePasswordChange();
    }
});
$('#profileUsername').on('input', clearProfileFeedback).on('keydown', event => {
    if (event.key === 'Enter') {
        event.preventDefault();
        saveProfileUsername();
    }
});

$('#imagePreviewClose').on('click', hideImagePreview);
$('#imagePreviewModal').on('click', event => {
    if (event.target && event.target.id === 'imagePreviewModal') hideImagePreview();
});


function openReportModal(targetType, targetId, label, trigger) {
    reportContext = {
        targetType: String(targetType || ''),
        targetId: Number(targetId) || 0,
        label: String(label || '').trim()
    };
    if (!reportContext.targetId || !['item', 'comment', 'user'].includes(reportContext.targetType)) {
        reportContext = null;
        return;
    }

    reportReturnFocus = trigger || document.activeElement;
    const titleByType = {
        item: uiText('דיווח על פריט', 'Report item'),
        comment: uiText('דיווח על הערה', 'Report comment'),
        user: uiText('דיווח על משתמש', 'Report user')
    };
    $('#reportTitle').text(titleByType[reportContext.targetType]);
    $('#reportTarget').text(reportContext.label);
    $('#reportReason').val('').removeAttr('aria-invalid');
    $('#reportError').text('').addClass('hidden');
    $('#reportModal').removeClass('hidden');
    $('body').addClass('report-modal-open');
    setTimeout(() => $('#reportReason').trigger('focus'), 0);
}

function hideReportModal(restoreFocus = true) {
    const $modal = $('#reportModal');
    if (!$modal.length || $modal.hasClass('hidden')) return;
    $modal.addClass('hidden');
    $('body').removeClass('report-modal-open');
    $('#reportError').text('').addClass('hidden');
    reportContext = null;
    if (restoreFocus && reportReturnFocus && document.contains(reportReturnFocus)) {
        reportReturnFocus.focus();
    }
    if (restoreFocus) reportReturnFocus = null;
}

function submitReport() {
    if (!reportContext) return;
    const reason = $('#reportReason').val().trim();
    if (!reason) {
        $('#reportReason').attr('aria-invalid', 'true').trigger('focus');
        $('#reportError').text(uiText('יש לכתוב סיבה לדיווח', 'Enter a reason for the report')).removeClass('hidden');
        return;
    }
    if (Array.from(reason).length > 500) {
        $('#reportReason').attr('aria-invalid', 'true').trigger('focus');
        $('#reportError').text(uiText('סיבת הדיווח יכולה להכיל עד 500 תווים', 'The report reason can contain up to 500 characters')).removeClass('hidden');
        return;
    }

    const context = {...reportContext};
    const $button = $('#btnSubmitReport').prop('disabled', true).text(uiText('שולח...', 'Sending...'));
    apiCall('POST', '/reports', {
        target_type: context.targetType,
        target_id: context.targetId,
        reason
    })
        .done(() => {
            hideReportModal(false);
            reportReturnFocus = null;
            showStyledAlert(uiText('הדיווח נשלח למנהל', 'The report was sent to an administrator'), uiText('הדיווח נשלח', 'Report sent'), 'success');
        })
        .fail(xhr => $('#reportError').text(apiErr(xhr)).removeClass('hidden'))
        .always(() => $button.prop('disabled', false).text(uiText('שלח דיווח', 'Send report')));
}

$('#reportClose, #btnCancelReport').on('click', () => hideReportModal());
$('#reportModal').on('click', event => {
    if (event.target && event.target.id === 'reportModal') hideReportModal();
});
$('#reportReason').on('input', function () {
    $(this).removeAttr('aria-invalid');
    $('#reportError').text('').addClass('hidden');
});
$('#btnSubmitReport').on('click', submitReport);

function renderCommentsModal(items) {
    const comments = Array.isArray(items) ? items : [];
    const $list = $('#commentsList').empty();
    $('#commentsStatus').addClass('hidden').text('');
    $('#commentsEmpty').toggleClass('hidden', comments.length > 0);

    comments.forEach(comment => {
        const username = String(comment.username || uiText('משתמש/ת', 'User'));
        const body = String(comment.body || '');
        const timeValue = comment.created_ts || comment.created_at || '';
        const $reportButton = $('<button type="button" class="comments-entry-report">')
            .attr('aria-label', uiText(`דווח על ההערה של ${username}`, `Report ${username}'s comment`))
            .append(tablerIcon('flag'))
            .on('click', function () {
                openReportModal('comment', comment.id, `${username}: ${body}`, this);
            });
        const $metaActions = $('<span class="comments-entry-meta-actions">').append(
            $('<span class="relative-time comments-entry-time">')
                .attr('data-time', timeValue)
                .text(relTime(timeValue)),
            $reportButton
        );
        if (Number(comment.can_delete)) {
            $metaActions.append(
                $('<button type="button" class="comments-entry-delete">')
                    .attr('aria-label', uiText(`מחק את ההערה של ${username}`, `Delete ${username}'s comment`))
                    .append(tablerIcon('trash'))
                    .on('click', () => deleteComment(comment.id, username))
            );
        }
        const $meta = $('<div class="comments-entry-meta">').append(
            $('<strong class="comments-entry-user">').text(username),
            $metaActions
        );
        $('<li class="comments-entry">').append(
            $meta,
            $('<p class="comments-entry-body">').text(body)
        ).appendTo($list);
    });

    refreshRelativeTimes();
}

function deleteComment(commentId, username) {
    if (!commentsModalItemId || !commentId) return;
    if (!confirm(uiText(`למחוק את ההערה של "${username}"?`, `Delete ${username}'s comment?`))) return;
    apiCall('DELETE', `/items/${commentsModalItemId}/comments?comment_id=${encodeURIComponent(commentId)}`)
        .done(() => {
            loadCommentsModal();
            loadItems();
            if (!$('#screenGroupAdmin').hasClass('hidden')) loadGroupManagement();
        })
        .fail(xhr => $('#commentsStatus').text(apiErr(xhr)).removeClass('hidden'));
}

function loadCommentsModal() {
    if (!commentsModalItemId) return;

    $('#commentsList').empty();
    $('#commentsEmpty').addClass('hidden');
    $('#commentsStatus').text(uiText('טוען הערות...', 'Loading comments...')).removeClass('hidden');

    apiCall('GET', `/items/${commentsModalItemId}/comments`)
        .done(response => {
            if (response && response.server_now) syncServerClock(response.server_now);
            renderCommentsModal(response && Array.isArray(response.items) ? response.items : []);
        })
        .fail(xhr => {
            $('#commentsStatus').text(apiErr(xhr)).removeClass('hidden');
        });
}

function openCommentsModal(itemId, itemName, trigger) {
    commentsReturnFocus = trigger || document.activeElement;
    commentsModalItemId = Number(itemId) || null;
    commentsModalItemName = String(itemName || '').trim();
    if (!commentsModalItemId) return;

    $('#commentsTitle').text(commentsModalItemName ? uiText(`הערות - ${commentsModalItemName}`, `Comments - ${commentsModalItemName}`) : uiText('הערות', 'Comments'));
    $('#commentsModal').removeClass('hidden');
    $('body').addClass('comments-modal-open');
    loadCommentsModal();
    $('#commentsClose').trigger('focus');
}

function hideCommentsModal() {
    const $modal = $('#commentsModal');
    if (!$modal.length || $modal.hasClass('hidden')) return;

    $modal.addClass('hidden');
    $('body').removeClass('comments-modal-open');
    $('#commentsList').empty();
    $('#commentsStatus').addClass('hidden').text('');
    $('#commentsEmpty').addClass('hidden');
    commentsModalItemId = null;
    commentsModalItemName = '';

    if (commentsReturnFocus && document.contains(commentsReturnFocus)) {
        commentsReturnFocus.focus();
    }
    commentsReturnFocus = null;
}

$('#commentsClose').on('click', hideCommentsModal);
$('#commentsModal').on('click', event => {
    if (event.target && event.target.id === 'commentsModal') hideCommentsModal();
});
$('#btnAddCommentFromModal').on('click', function () {
    if (!commentsModalItemId) return;
    addComment(commentsModalItemId, commentsModalItemName || uiText('הפריט', 'the item'), loadCommentsModal, this);
});

function openItemActionsModal(context, trigger) {
    itemActionsContext = context || null;
    if (!itemActionsContext || !itemActionsContext.id) return;

    itemActionsReturnFocus = trigger || document.activeElement;
    const name = String(itemActionsContext.name || '').trim();
    const commentCount = Math.max(0, Number(itemActionsContext.commentCount) || 0);
    $('#itemActionsTitle').text(name ? uiText(`פעולות - ${name}`, `Actions - ${name}`) : uiText('פעולות לפריט', 'Item actions'));
    $('#itemActionCommentsText').text(commentCount > 0 ? uiText('הצג הערות', 'View comments') : uiText('הוסף הערה', 'Add comment'));
    $('#itemActionCommentsCount').text(commentCount).toggleClass('hidden', commentCount < 1);
    $('#itemActionImageText').text(itemActionsContext.hasImage ? uiText('החלף תמונה', 'Replace image') : uiText('הוסף תמונה', 'Add image'));
    $('#btnItemActionDelete').toggleClass('hidden', !itemActionsContext.canDelete);
    $('#itemActionsModal').removeClass('hidden');
    $('body').addClass('item-actions-modal-open');
    $('#itemActionsClose').trigger('focus');
}

function hideItemActionsModal(restoreFocus = true) {
    const $modal = $('#itemActionsModal');
    if (!$modal.length || $modal.hasClass('hidden')) return;

    $modal.addClass('hidden');
    $('body').removeClass('item-actions-modal-open');
    if (restoreFocus && itemActionsReturnFocus && document.contains(itemActionsReturnFocus)) {
        itemActionsReturnFocus.focus();
    }
    if (restoreFocus) itemActionsReturnFocus = null;
    itemActionsContext = null;
}

$('#itemActionsClose').on('click', () => hideItemActionsModal());
$('#itemActionsModal').on('click', event => {
    if (event.target && event.target.id === 'itemActionsModal') hideItemActionsModal();
});
$('#btnItemActionComments').on('click', () => {
    const context = itemActionsContext;
    const returnFocus = itemActionsReturnFocus;
    if (!context) return;
    hideItemActionsModal(false);
    itemActionsReturnFocus = null;
    if (context.commentCount > 0) openCommentsModal(context.id, context.name, returnFocus);
    else addComment(context.id, context.actionName, null, returnFocus);
});
$('#btnItemActionImage').on('click', () => {
    const context = itemActionsContext;
    if (!context) return;
    hideItemActionsModal(false);
    itemActionsReturnFocus = null;
    pickItemImage(context.id, context.actionName);
});
$('#btnItemActionReport').on('click', () => {
    const context = itemActionsContext;
    const returnFocus = itemActionsReturnFocus;
    if (!context) return;
    hideItemActionsModal(false);
    itemActionsReturnFocus = null;
    openReportModal('item', context.id, context.actionName, returnFocus);
});
$('#btnItemActionDelete').on('click', () => {
    const context = itemActionsContext;
    if (!context || !context.canDelete) return;
    hideItemActionsModal(false);
    itemActionsReturnFocus = null;
    deleteItem(context.id, context.actionName);
});

function closeMobileGroupMenu() {
    $('#bottomNav').removeClass('mobile-open');
    $('#btnGroupMenu').attr('aria-expanded', 'false');
}

$('#btnGroupMenu').on('click', event => {
    event.stopPropagation();
    const willOpen = !$('#bottomNav').hasClass('mobile-open');
    $('#bottomNav').toggleClass('mobile-open', willOpen);
    $('#btnGroupMenu').attr('aria-expanded', willOpen ? 'true' : 'false');
});
$(document).on('click', event => {
    if (!$(event.target).closest('#bottomNav, #btnGroupMenu').length) closeMobileGroupMenu();
});
$('#mobileMenuProfile').on('click', () => {
    closeMobileGroupMenu();
    $('#btnProfile').trigger('click');
});
$('#mobileMenuRename').on('click', () => {
    closeMobileGroupMenu();
    $('#btnRenameGroup').trigger('click');
});
$('#mobileMenuManage').on('click', () => {
    closeMobileGroupMenu();
    openGroupManagement();
});
$('#mobileMenuLeave').on('click', () => {
    closeMobileGroupMenu();
    $('#btnLeaveGroup').trigger('click');
});
$('#mobileMenuBack').on('click', () => {
    closeMobileGroupMenu();
    $('#btnBack').trigger('click');
});
$('#mobileMenuLogout').on('click', () => {
    closeMobileGroupMenu();
    $('#btnLogout').trigger('click');
});

// Keep the fixed composer directly above the real rendered navigation height.
function syncFixedUiOffsets() {
    const nav = document.getElementById('bottomNav');
    const addBar = document.getElementById('addItemForm');
    const header = document.getElementById('appHeader');
    const compactMobileMenu = window.matchMedia('(max-width: 600px)').matches;
    const navHeight = !compactMobileMenu && nav && !nav.classList.contains('hidden')
        ? Math.ceil(nav.getBoundingClientRect().height)
        : 0;
    const addBarHeight = addBar && !addBar.closest('.screen')?.classList.contains('hidden')
        ? Math.ceil(addBar.getBoundingClientRect().height)
        : 0;
    const headerHeight = header && !header.classList.contains('hidden')
        ? Math.ceil(header.getBoundingClientRect().height)
        : 0;

    document.documentElement.style.setProperty('--bottom-nav-height', `${navHeight}px`);
    document.documentElement.style.setProperty('--add-bar-height', `${addBarHeight}px`);
    document.documentElement.style.setProperty('--app-header-height', `${headerHeight}px`);
}

if ('ResizeObserver' in window) {
    const fixedUiObserver = new ResizeObserver(() => syncFixedUiOffsets());
    const nav = document.getElementById('bottomNav');
    const addBar = document.getElementById('addItemForm');
    if (nav) fixedUiObserver.observe(nav);
    if (addBar) fixedUiObserver.observe(addBar);
}

$(window).on('resize orientationchange', syncFixedUiOffsets);
requestAnimationFrame(syncFixedUiOffsets);

// Token
function saveToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
    currentUserId = parseUserId(token);
}
function getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
}
function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    currentUserId = null;
    shareLinkCache.clear();
    shareLinkRequests.clear();
}
function parseUserId(token) {
    try {
        let encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        encoded += '='.repeat((4 - encoded.length % 4) % 4);
        return JSON.parse(atob(encoded)).sub || null;
    } catch (e) {
        return null;
    }
}

// Screens
function showScreen(id) {
    $('.screen').addClass('hidden');
    $('#' + id).removeClass('hidden');
}

function setHeader(title, showBack, canRename = false) {
    $('#appHeader').removeClass('hidden');
    $('#hdrTitle').text(title);
    $('#btnBack').toggleClass('hidden', !showBack);
    $('#btnGroupMenu').toggleClass('hidden', !showBack);
    $('#btnRenameGroup').toggleClass('hidden', !showBack || !canRename);
    $('#mobileMenuRename').toggleClass('hidden', !showBack || !canRename);
    if (!showBack) closeMobileGroupMenu();
    requestAnimationFrame(syncFixedUiOffsets);
}

// Auth
const authFieldConfig = {
    loginEmail: { errorId: 'loginEmailError', label: uiText('שם משתמש או אימייל', 'Username or email') },
    loginPassword: { errorId: 'loginPasswordError', label: uiText('סיסמה', 'Password') },
    regUsername: { errorId: 'regUsernameError', label: uiText('שם משתמש', 'Username') },
    regEmail: { errorId: 'regEmailError', label: uiText('אימייל', 'Email') },
    regPassword: { errorId: 'regPasswordError', label: uiText('סיסמה', 'Password') },
    regPasswordConfirm: { errorId: 'regPasswordConfirmError', label: uiText('אימות סיסמה', 'Password confirmation') }
};

function setAuthFieldError(inputId, message) {
    const config = authFieldConfig[inputId];
    if (!config) return;

    $('#' + inputId).attr('aria-invalid', 'true');
    $('#' + config.errorId).text(message).removeClass('hidden');
}

function clearAuthFieldError(inputId) {
    const config = authFieldConfig[inputId];
    if (!config) return;

    $('#' + inputId).removeAttr('aria-invalid');
    $('#' + config.errorId).text('').addClass('hidden');
}

function clearAuthFieldErrors() {
    Object.keys(authFieldConfig).forEach(clearAuthFieldError);
}

function focusFirstInvalid(fieldIds) {
    if (fieldIds.length) $('#' + fieldIds[0]).trigger('focus');
}

function validEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function unicodeLength(value) {
    return Array.from(value).length;
}

function missingFieldsMessage(labels) {
    return uiText(`חסרים הפרטים הבאים: ${labels.join(', ')}`, `Missing fields: ${labels.join(', ')}`);
}

function showAuthForm(formId) {
    $('#formLogin, #formRegister, #formForgotPassword, #formResetPassword, #formNewPassword').addClass('hidden');
    $('#' + formId).removeClass('hidden');
    clearAuthErr();
    clearAuthFieldErrors();
}

function clearResetFlow() {
    resetSessionToken = '';
    resetSessionEmail = '';
    sessionStorage.removeItem('cg_reset_token');
    sessionStorage.removeItem('cg_reset_email');
    $('#newPasswordHint').text('');
    $('#forgotEmail, #resetEmail, #resetCode, #newPassword, #newPasswordConfirm').val('');
}

$('#btnShowRegister').on('click', () => {
    clearResetFlow();
    showAuthForm('formRegister');
});
$('#btnShowLogin').on('click', () => {
    clearResetFlow();
    showAuthForm('formLogin');
});

$('#btnShowForgotPassword').on('click', () => {
    const loginIdentifier = $('#loginEmail').val().trim();
    const registrationEmail = $('#regEmail').val().trim();
    clearResetFlow();
    $('#forgotEmail').val(validEmail(loginIdentifier) ? loginIdentifier : registrationEmail);
    showAuthForm('formForgotPassword');
});

$('#btnBackToLoginFromForgot, #btnBackToLoginFromReset, #btnBackToLoginFromNewPassword').on('click', () => {
    clearResetFlow();
    showAuthForm('formLogin');
});

$('#formLogin input, #formRegister input, #formForgotPassword input, #formResetPassword input, #formNewPassword input').on('input', function () {
    clearAuthFieldError(this.id);
    clearAuthErr();
});

$('#formLogin').on('submit', event => {
    event.preventDefault();
    clearAuthErr();
    clearAuthFieldErrors();

    const identifier = $('#loginEmail').val().trim();
    const password = $('#loginPassword').val();
    const missing = [];
    const invalidFields = [];

    if (!identifier) {
        missing.push(uiText('שם משתמש או אימייל', 'Username or email'));
        invalidFields.push('loginEmail');
        setAuthFieldError('loginEmail', uiText('יש להזין שם משתמש או אימייל', 'Enter a username or email'));
    }
    if (!password) {
        missing.push(uiText('סיסמה', 'Password'));
        invalidFields.push('loginPassword');
        setAuthFieldError('loginPassword', uiText('יש להזין סיסמה', 'Enter a password'));
    }
    if (missing.length) {
        authErr(missingFieldsMessage(missing));
        focusFirstInvalid(invalidFields);
        return;
    }
    if (unicodeLength(identifier) > 254 || /[\x00-\x1F\x7F]/u.test(identifier)) {
        setAuthFieldError('loginEmail', uiText('שם המשתמש או האימייל אינם תקינים', 'The username or email is invalid'));
        authErr(uiText('שם המשתמש או האימייל אינם תקינים', 'The username or email is invalid'));
        focusFirstInvalid(['loginEmail']);
        return;
    }

    const $button = $('#btnLogin').prop('disabled', true);
    apiCall('POST', '/auth/login', { identifier, password })
        .done(res => {
            saveToken(res.token);
            currentUserRole = String(res.role || 'user');
            currentAdminPath = currentUserRole === 'admin' ? String(res.admin_path || '') : '';
            updateAdminDashboardButton();
            if (res.language) currentLanguage = res.language === 'en' ? 'en' : 'he';
            applyMainLanguage();
            loadCurrentProfile().always(() => {
                redeemPendingInvite() || loadGroups();
            });
        })
        .fail(xhr => authErr(apiErr(xhr)))
        .always(() => $button.prop('disabled', false));
});

$('#btnRegister').on('click', () => {
    clearAuthErr();
    clearAuthFieldErrors();

    const username = $('#regUsername').val().trim();
    const email = $('#regEmail').val().trim().toLowerCase();
    const password = $('#regPassword').val();
    const passwordConfirmation = $('#regPasswordConfirm').val();
    const missing = [];
    const invalidFields = [];

    if (!username) {
        missing.push(uiText('שם משתמש', 'Username'));
        invalidFields.push('regUsername');
        setAuthFieldError('regUsername', uiText('יש להזין שם משתמש', 'Enter a username'));
    }
    if (!email) {
        missing.push(uiText('אימייל', 'Email'));
        invalidFields.push('regEmail');
        setAuthFieldError('regEmail', uiText('יש להזין כתובת אימייל', 'Enter an email address'));
    }
    if (!password) {
        missing.push(uiText('סיסמה', 'Password'));
        invalidFields.push('regPassword');
        setAuthFieldError('regPassword', uiText('יש להזין סיסמה', 'Enter a password'));
    }
    if (!passwordConfirmation) {
        missing.push(uiText('אימות סיסמה', 'Password confirmation'));
        invalidFields.push('regPasswordConfirm');
        setAuthFieldError('regPasswordConfirm', uiText('יש להזין שוב את הסיסמה', 'Enter the password again'));
    }

    if (missing.length) {
        authErr(missingFieldsMessage(missing));
        focusFirstInvalid(invalidFields);
        return;
    }

    if (unicodeLength(username) > 50) {
        setAuthFieldError('regUsername', uiText('שם המשתמש יכול להכיל עד 50 תווים', 'The username can contain up to 50 characters'));
        authErr(uiText('שם המשתמש יכול להכיל עד 50 תווים', 'The username can contain up to 50 characters'));
        focusFirstInvalid(['regUsername']);
        return;
    }
    if (/[\x00-\x1F\x7F]/u.test(username)) {
        setAuthFieldError('regUsername', uiText('שם המשתמש מכיל תווים שאינם נתמכים', 'The username contains unsupported characters'));
        authErr(uiText('שם המשתמש מכיל תווים שאינם נתמכים', 'The username contains unsupported characters'));
        focusFirstInvalid(['regUsername']);
        return;
    }
    if (email.length > 254) {
        setAuthFieldError('regEmail', uiText('כתובת האימייל ארוכה מדי', 'The email address is too long'));
        authErr(uiText('כתובת האימייל ארוכה מדי', 'The email address is too long'));
        focusFirstInvalid(['regEmail']);
        return;
    }
    if (!validEmail(email)) {
        setAuthFieldError('regEmail', uiText('כתובת האימייל אינה תקינה', 'The email address is invalid'));
        authErr(uiText('כתובת האימייל אינה תקינה', 'The email address is invalid'));
        focusFirstInvalid(['regEmail']);
        return;
    }
    if (unicodeLength(password) < 8) {
        setAuthFieldError('regPassword', uiText('הסיסמה חייבת להכיל לפחות 8 תווים', 'The password must contain at least 8 characters'));
        authErr(uiText('הסיסמה חייבת להכיל לפחות 8 תווים', 'The password must contain at least 8 characters'));
        focusFirstInvalid(['regPassword']);
        return;
    }
    if (unicodeLength(password) > 256) {
        setAuthFieldError('regPassword', uiText('הסיסמה יכולה להכיל עד 256 תווים', 'The password can contain up to 256 characters'));
        authErr(uiText('הסיסמה יכולה להכיל עד 256 תווים', 'The password can contain up to 256 characters'));
        focusFirstInvalid(['regPassword']);
        return;
    }
    if (password !== passwordConfirmation) {
        setAuthFieldError('regPasswordConfirm', uiText('הסיסמאות אינן תואמות', 'The passwords do not match'));
        authErr(uiText('הסיסמאות אינן תואמות', 'The passwords do not match'));
        focusFirstInvalid(['regPasswordConfirm']);
        return;
    }

    const $button = $('#btnRegister').prop('disabled', true).text(uiText('נרשם...', 'Registering...'));
    apiCall('POST', '/auth/register', {
        username,
        email,
        password,
        password_confirmation: passwordConfirmation,
        language: currentLanguage
    })
        .done(res => {
            saveToken(res.token);
            if (res.language) currentLanguage = res.language === 'en' ? 'en' : 'he';
            $('#regUsername, #regEmail, #regPassword, #regPasswordConfirm').val('');
            applyMainLanguage();
            loadCurrentProfile().always(() => {
                redeemPendingInvite() || loadGroups();
            });
        })
        .fail(xhr => authErr(apiErr(xhr)))
        .always(() => $button.prop('disabled', false).text(uiText('הרשמה', 'Register')));
});

$('#btnSendResetCode').on('click', () => {
    clearAuthErr();

    const email = $('#forgotEmail').val().trim().toLowerCase();
    if (!email) {
        authErr(uiText('יש להזין כתובת אימייל', 'Enter an email address'));
        return;
    }
    if (email.length > 254) {
        authErr(uiText('כתובת האימייל ארוכה מדי', 'The email address is too long'));
        return;
    }
    if (!validEmail(email)) {
        authErr(uiText('כתובת האימייל אינה תקינה', 'The email address is invalid'));
        return;
    }

    const $button = $('#btnSendResetCode').prop('disabled', true);
    apiCall('POST', '/auth/forgot-password', { email })
        .done(res => {
            resetSessionEmail = email;
            sessionStorage.setItem('cg_reset_email', email);
            $('#resetEmail').val(email);
            $('#resetCode').val('');
            showAuthForm('formResetPassword');
            authErr(res.message || uiText('אם הכתובת קיימת, נשלח קוד אימות לאימייל', 'If the address exists, a verification code was sent by email'));
        })
        .fail(xhr => authErr(apiErr(xhr)))
        .always(() => $button.prop('disabled', false));
});

$('#btnVerifyResetCode').on('click', () => {
    clearAuthErr();

    const email = $('#resetEmail').val().trim().toLowerCase();
    const code = $('#resetCode').val().trim();

    if (!email || !code) {
        authErr(uiText('חסרים הפרטים הבאים: אימייל, קוד אימות', 'Missing fields: email, verification code'));
        return;
    }

    const $button = $('#btnVerifyResetCode').prop('disabled', true);
    apiCall('POST', '/auth/verify-reset-code', { email, code })
        .done(res => {
            resetSessionToken = res.reset_token || '';
            resetSessionEmail = res.email || email;
            sessionStorage.setItem('cg_reset_token', resetSessionToken);
            sessionStorage.setItem('cg_reset_email', resetSessionEmail);
            $('#newPasswordHint').text(uiText('הקוד אומת. אפשר להגדיר סיסמה חדשה.', 'The code was verified. You can set a new password.'));
            showAuthForm('formNewPassword');
            $('#newPassword').trigger('focus');
        })
        .fail(xhr => authErr(apiErr(xhr)))
        .always(() => $button.prop('disabled', false));
});

$('#btnResetPassword').on('click', () => {
    clearAuthErr();

    const email = $('#resetEmail').val().trim().toLowerCase() || resetSessionEmail;
    const resetToken = resetSessionToken || sessionStorage.getItem('cg_reset_token') || '';
    const password = $('#newPassword').val();
    const passwordConfirmation = $('#newPasswordConfirm').val();

    if (!email || !resetToken) {
        authErr(uiText('יש לאמת קודם את קוד האימות', 'Verify the code first'));
        return;
    }
    if (!password || !passwordConfirmation) {
        authErr(uiText('חסרים הפרטים הבאים: סיסמה, אימות סיסמה', 'Missing fields: password, password confirmation'));
        return;
    }
    if (unicodeLength(password) < 8) {
        authErr(uiText('הסיסמה חייבת להכיל לפחות 8 תווים', 'The password must contain at least 8 characters'));
        return;
    }
    if (password !== passwordConfirmation) {
        authErr(uiText('הסיסמאות אינן תואמות', 'The passwords do not match'));
        return;
    }

    const $button = $('#btnResetPassword').prop('disabled', true);
    apiCall('POST', '/auth/reset-password', {
        email,
        reset_token: resetToken,
        password,
        password_confirmation: passwordConfirmation
    })
        .done(res => {
            clearResetFlow();
            showAuthForm('formLogin');
            $('#loginEmail').val(email);
            $('#loginPassword').val('');
            authErr(res.message || uiText('הסיסמה עודכנה בהצלחה', 'The password was updated successfully'));
        })
        .fail(xhr => authErr(apiErr(xhr)))
        .always(() => $button.prop('disabled', false));
});

$('#btnLogout').on('click', () => {
    closeMobileGroupMenu();
    $.ajax({url: API + '/auth/logout', method: 'POST'});
    clearToken();
    stopPoll();
    currentGroupId = null;
    currentGroupCanRename = false;
    currentUserRole = 'user';
    currentUserEmail = '';
    updateHomeProfileName();
    currentAdminPath = '';
    updateAdminDashboardButton();
    hideExistingItemSheet();
    updateMemberCount(0);
    sessionStorage.removeItem('last_group');
    $('#appHeader, #bottomNav, #btnNotifications, #notifBadge, #notifPanel').addClass('hidden');
    showScreen('screenAuth');
});

function authErr(message) {
    $('#authError').text(message).removeClass('hidden');
}
function clearAuthErr() {
    $('#authError').text('').addClass('hidden');
}

// Groups
function updateGroupActions() {
    $('#btnDeleteGroup').toggleClass('hidden', !currentGroupCanRename);
    $('#btnLeaveGroup').toggleClass('hidden', currentGroupCanRename);
    $('#btnGroupManage, #mobileMenuManage, #mobileMenuRename').toggleClass('hidden', !currentGroupCanRename);
    $('#mobileMenuLeave').toggleClass('hidden', currentGroupCanRename);
}

function normalizeGroupsResponse(response) {
    if (Array.isArray(response)) return response;
    if (response && Array.isArray(response.groups)) return response.groups;
    if (response && typeof response === 'object') {
        const numericKeys = Object.keys(response).filter(key => /^\d+$/.test(key));
        if (numericKeys.length) return numericKeys.sort((a, b) => Number(a) - Number(b)).map(key => response[key]);
    }
    return null;
}

function loadGroups() {
    setHeader(uiText('סל שיתופי', 'SharedCart'), false, false);
    $('#bottomNav').addClass('hidden');
    $('#btnNotifications').addClass('hidden');
    $('#notifBadge, #notifPanel').addClass('hidden');
    $('#notifBadge').text('');
    notificationsPanelOpen = false;
    $('#btnLeaveGroup, #btnDeleteGroup, #btnGroupManage, #mobileMenuManage, #mobileMenuLeave').addClass('hidden');
    showScreen('screenGroups');

    apiCall('GET', '/groups')
        .done(response => {
            const groups = normalizeGroupsResponse(response);
            if (!groups) {
                $('#groupList').empty();
                alert(uiText('השרת החזיר תשובה לא תקינה עבור הקבוצות', 'The server returned an invalid groups response'));
                return;
            }
            renderGroups(groups);
        })
        .fail(xhr => {
            if (xhr.status === 401 || xhr.status === 403) {
                clearToken();
                showScreen('screenAuth');
                $('#appHeader').addClass('hidden');
                return;
            }
            alert(apiErr(xhr));
        });
}

function renderGroups(groups) {
    const $list = $('#groupList').empty();
    if (!groups.length) {
        sessionStorage.removeItem('last_group');
        $list.append($('<li style="color:var(--text-2);font-size:14px;padding:8px 0">').text(uiText('אין קבוצות עדיין - צרי קבוצה חדשה למטה', 'No groups yet - create a new group below')));
        return;
    }

    groups.forEach(group => {
        const $open = $('<button class="group-open" type="button">')
            .attr('aria-label', uiText(`כניסה לקבוצה ${group.name}`, `Open group ${group.name}`))
            .append(
                $('<div>').append(
                    $('<div class="group-name">').text(group.name),
                    $('<div class="group-id">').text(uiText(`מספר קבוצה: ${group.id}`, `Group ID: ${group.id}`))
                ),
                $('<span class="group-arrow" aria-hidden="true">').append(tablerIcon('arrow-back-up'))
            )
            .on('click', () => showItems(group.id, group.name, !!group.can_rename));

        const $actions = $('<div class="group-row-actions">');
        if (group.can_rename) {
            $('<button class="group-delete-inline" type="button">')
                .attr('aria-label', uiText(`מחיקת הקבוצה ${group.name}`, `Delete group ${group.name}`))
                .append(tablerIcon('trash'))
                .on('click', event => {
                    event.stopPropagation();
                    if (!confirm(uiText(`למחוק את הקבוצה "${group.name}"?`, `Delete the group "${group.name}"?`))) return;
                    apiCall('DELETE', `/groups/${group.id}`)
                        .done(() => {
                            const saved = sessionStorage.getItem('last_group');
                            if (saved) {
                                try {
                                    if (Number(JSON.parse(saved).id) === Number(group.id)) sessionStorage.removeItem('last_group');
                                } catch (e) {
                                    sessionStorage.removeItem('last_group');
                                }
                            }
                            loadGroups();
                        })
                        .fail(xhr => alert(apiErr(xhr)));
                })
                .appendTo($actions);
        }

        $list.append($('<li class="group-item">').append($open, $actions));
    });
}

$('#btnCreateGroup').on('click', () => {
    const name = $('#newGroupName').val().trim();
    if (!name) return;

    apiCall('POST', '/groups', { name })
        .done(group => {
            $('#newGroupName').val('');
            showItems(group.id, group.name, true);
            showShareBanner(group.id);
        })
        .fail(xhr => alert(apiErr(xhr)));
});

$('#btnJoinGroup').on('click', () => {
    const raw = $('#joinInviteLink').val().trim();
    if (!raw) return;

    let token = raw;
    try {
        const url = new URL(raw);
        token = url.searchParams.get('t') || raw;
    } catch (e) {
        // The input may be a token instead of a complete URL.
    }

    if (!/^[0-9a-zA-Z]{10}$/.test(token)) return alert(uiText('קישור לא תקין', 'Invalid link'));

    apiCall('GET', `/invite/join?t=${encodeURIComponent(token)}`)
        .done(group => {
            $('#joinInviteLink').val('');
            showItems(group.id, group.name, !!group.can_rename);
        })
        .fail(xhr => alert(apiErr(xhr)));
});

$('#btnDeleteGroup').on('click', () => {
    if (!currentGroupId || !currentGroupCanRename) return;
    if (!confirm(uiText('למחוק את הקבוצה? הפעולה לא ניתנת לביטול.', 'Delete the group? This action cannot be undone.'))) return;

    apiCall('DELETE', `/groups/${currentGroupId}`)
        .done(() => {
            currentGroupId = null;
            currentGroupCanRename = false;
            hideExistingItemSheet();
            sessionStorage.removeItem('last_group');
            $('#appHeader, #bottomNav').addClass('hidden');
            showScreen('screenGroups');
            loadGroups();
        })
        .fail(xhr => alert(apiErr(xhr)));
});

$('#btnLeaveGroup').on('click', () => {
    if (!currentGroupId || currentGroupCanRename) return;
    if (!confirm(uiText('לעזוב את הקבוצה?', 'Leave the group?'))) return;

    apiCall('POST', `/groups/${currentGroupId}/leave`)
        .done(() => {
            currentGroupId = null;
            hideExistingItemSheet();
            sessionStorage.removeItem('last_group');
            $('#appHeader, #bottomNav').addClass('hidden');
            showScreen('screenGroups');
            loadGroups();
        })
        .fail(xhr => alert(apiErr(xhr)));
});

// Items
function showItems(groupId, groupName, canRename = false) {
    currentGroupId = Number(groupId);
    currentGroupCanRename = !!canRename;
    hideExistingItemSheet();
    sessionStorage.setItem('last_group', JSON.stringify({
        id: currentGroupId,
        name: groupName,
        can_rename: currentGroupCanRename
    }));

    setHeader(groupName, true, currentGroupCanRename);
    updateGroupActions();
    showScreen('screenItems');
    $('.nav-btn').removeClass('active').removeAttr('aria-current');
    $('[data-tab="items"]').addClass('active').attr('aria-current', 'page');
    $('#bottomNav').removeClass('hidden');
    $('#btnNotifications').removeClass('hidden');
    $('#notifBadge').text('').addClass('hidden');
    notificationsPanelOpen = false;
    $('#notifPanel, #shareBanner').addClass('hidden');
    updateMemberCount(0);
    loadItems();
    loadNotifications();
    loadMembers();
    prefetchShareLink(currentGroupId);
    requestAnimationFrame(syncFixedUiOffsets);
    startPoll();
}

$('#btnBack').on('click', () => {
    stopPoll();
    currentGroupId = null;
    currentGroupCanRename = false;
    hideExistingItemSheet();
    updateMemberCount(0);
    sessionStorage.removeItem('last_group');
    loadGroups();
});

$('#btnRenameGroup').on('click', () => {
    if (!currentGroupId || !currentGroupCanRename) return;

    const oldName = $('#hdrTitle').text();
    const name = prompt(uiText('שם חדש לקבוצה:', 'New group name:'), oldName);
    if (name === null) return;

    const cleanName = name.trim();
    if (!cleanName || cleanName === oldName) return;

    apiCall('PATCH', `/groups/${currentGroupId}`, { name: cleanName })
        .done(group => {
            $('#hdrTitle').text(group.name);
            sessionStorage.setItem('last_group', JSON.stringify({
                id: currentGroupId,
                name: group.name,
                can_rename: true
            }));
        })
        .fail(xhr => alert(apiErr(xhr)));
});

$('#btnPickItemImage').on('click', () => $('#newItemImage').trigger('click'));

$('#newItemImage').on('change', function () {
    pendingNewItemImage = this.files && this.files[0] ? this.files[0] : null;
    renderNewItemImageButton(!!pendingNewItemImage);
});

$('#btnProfile, #btnHomeProfile').on('click', function () {
    closeMobileGroupMenu();
    showProfileModal(this);
});

$('#btnAdminDashboard').on('click', () => {
    if (currentUserRole !== 'admin') return;
    if (window.innerWidth < 900) {
        alert(uiText('לוח הניהול זמין במסך מחשב רחב', 'The admin dashboard is available on a desktop-sized screen'));
        return;
    }
    const openAdmin = () => {
        if (currentAdminPath) window.location.assign(currentAdminPath);
    };
    if (currentAdminPath) {
        openAdmin();
    } else {
        loadCurrentProfile().done(openAdmin);
    }
});

$('#btnGroupManage').on('click', openGroupManagement);

$('#btnLanguage').on('click', () => {
    currentLanguage = currentLanguage === 'he' ? 'en' : 'he';
    applyMainLanguage();
    if (getToken()) {
        apiCall('PATCH', '/profile/language', { language: currentLanguage });
    }
});

$(window).on('resize', updateAdminDashboardButton);

function loadItems() {
    if (!currentGroupId) return;
    apiCall('GET', `/items?group_id=${currentGroupId}`)
        .done(response => {
            const items = Array.isArray(response) ? response : response.items;
            if (!Array.isArray(response) && response.server_now) syncServerClock(response.server_now);
            if (!Array.isArray(response) && Array.isArray(response.suggestions)) renderSuggestions(response.suggestions);
            renderItems(items || []);
        })
        .fail(xhr => {
            $('#itemList').empty();
            $('#emptyState').removeClass('hidden').text(uiText('לא ניתן לטעון את הרשימה כרגע', 'The list cannot be loaded right now'));
            alert(apiErr(xhr));
        });
}

function renderSuggestions(suggestions) {
    const $list = $('#itemSuggestions').empty();
    Array.from(new Set((suggestions || []).map(value => String(value).trim()).filter(Boolean)))
        .slice(0, 12)
        .forEach(value => {
            $list.append($('<option>').attr('value', value));
        });
}

function resetNewItemComposer() {
    $('#newItemName').val('');
    $('#newItemQty').val(1);
    $('#newItemImage').val('');
    pendingNewItemImage = null;
    renderNewItemImageButton(false);
}

function renderItems(items) {
    const $list = $('#itemList').empty();
    $('#emptyState').toggleClass('hidden', !!items.length);
    items.forEach(item => $list.append(buildRow(item)));
    refreshRelativeTimes();
}

function buildRow(item) {
    const isDone = !!Number(item.is_completed);
    const isCreator = Number(currentUserId) === Number(item.created_by);
    const canDelete = isCreator || currentGroupCanRename;
    const myContributionQty = Math.max(0, Number(item.my_contribution_qty) || 0);
    const totalLimit = Math.max(0, Number(item.total_limit) || 10);
    const totalRemaining = Math.max(0, Number(item.total_remaining) || Math.max(0, totalLimit - Number(item.quantity || 0)));
    const timeValue = isDone ? (item.completed_ts || item.completed_at) : (item.created_ts || item.created_at);
    const person = item.creator;
    const latestComment = item.latest_comment_body ? {
        user: item.latest_comment_user || '',
        body: item.latest_comment_body || '',
        createdAt: item.latest_comment_ts || item.latest_comment_created_at || ''
    } : null;
    const commentCount = Math.max(0, Number(item.comment_count) || (latestComment ? 1 : 0));
    const imagePath = String(item.image_path || '').trim();
    const rawItemName = String(item.name || '').trim();
    const actionName = rawItemName || uiText('פריט עם תמונה', 'Image item');
    const isImageOnly = !rawItemName && !!imagePath;

    const $check = $('<button class="item-check" role="checkbox">')
        .attr('aria-pressed', isDone)
        .attr('aria-label', isDone ? uiText('הסר סימון', 'Uncheck item') : uiText('סמן כנלקח', 'Mark as taken'));
    if (isDone) $check.append(tablerIcon('check'));

    if (isDone) $check.on('click', () => uncompleteItem(item.id));
    else $check.on('click', () => completeItem(item.id));

    const $time = $('<span class="relative-time">')
        .attr('data-time', timeValue || '')
        .text(relTime(timeValue));

    const $sub = $('<div class="item-sub">');
    if (rawItemName) {
        if (isDone) {
            $sub.append(document.createTextNode(uiText('נלקח ', 'Taken ')), $time);
        } else {
            $sub.append(document.createTextNode(`${person || ''} - `), $time);
        }
    }


    const $actionsButton = $('<button type="button" class="item-actions-trigger">')
        .attr('aria-label', commentCount > 0 ? uiText(`פעולות לפריט, ${commentCount} הערות`, `Item actions, ${commentCount} comments`) : uiText('פעולות לפריט', 'Item actions'))
        .append(tablerIcon('dots'))
        .on('click', function () {
            openItemActionsModal({
                id: Number(item.id),
                name: rawItemName,
                actionName,
                commentCount,
                hasImage: !!imagePath,
                isCreator,
                canDelete
            }, this);
        });
    if (commentCount > 0) {
        $actionsButton.append($('<span class="item-comment-badge" aria-hidden="true">').text(commentCount));
    }

    const $itemActions = $('<div class="item-actions-compact">').append($actionsButton);

    const $titleWrap = $('<div class="item-title-wrap">');
    if (imagePath) {
        const imageAlt = rawItemName ? uiText(`תמונה של ${rawItemName}`, `Image of ${rawItemName}`) : uiText('תמונת פריט', 'Item image');
        const imageAria = rawItemName ? uiText(`פתח תמונה מוגדלת של ${rawItemName}`, `Open enlarged image of ${rawItemName}`) : uiText('פתח תמונה מוגדלת', 'Open enlarged image');
        const $thumbImage = $('<img class="item-thumb">')
            .attr({
                src: imagePath,
                alt: imageAlt
            })
            .on('error', function () {
                $(this).closest('.item-thumb-button').remove();
            });

        $('<button type="button" class="item-thumb-button">')
            .attr('aria-label', imageAria)
            .append($thumbImage)
            .on('click', function () {
                showImagePreview(imagePath, rawItemName, this);
            })
            .appendTo($titleWrap);
    }

    const itemQuantity = Math.max(0, Number(item.quantity) || 0);
    const canDecreaseQuantity = isCreator ? itemQuantity > 1 : myContributionQty > 0;
    const $minus = $('<button type="button" class="qty-btn minus">')
        .attr('aria-label', uiText('הורד כמות', 'Decrease quantity'))
        .append(tablerIcon('minus'))
        .toggleClass('hidden', isDone || !canDecreaseQuantity)
        .prop('disabled', isDone || !canDecreaseQuantity)
        .on('click', () => adjustContribution(item.id, -1));

    const $plus = $('<button type="button" class="qty-btn plus">')
        .attr('aria-label', uiText('הוסף כמות', 'Increase quantity'))
        .append(tablerIcon('plus'))
        .prop('disabled', isDone || totalRemaining <= 0)
        .toggleClass('hidden', isDone)
        .on('click', () => adjustContribution(item.id, 1));

    const $qtyControl = $('<div class="qty-control">').append(
        $minus,
        $('<span class="item-qty" aria-live="polite">').text('×' + item.quantity),
        $plus
    );

    const $nameAndActions = $('<div class="item-name-and-actions">')
        .toggleClass('image-only', isImageOnly);
    if (rawItemName) {
        $nameAndActions.append(
            $('<div class="item-name">').text(rawItemName).toggleClass('done', isDone)
        );
    }
    if (rawItemName) $titleWrap.append($nameAndActions);

    const $head = $('<div class="item-head">').append($titleWrap);

    const $body = $('<div class="item-body">').append($head);
    if (rawItemName) $body.append($sub);

    // Keep quantity controls as a direct row child. In the RTL row this places
    // them at the far left, away from the item name on the right.
    const $row = $('<li class="item-row">')
        .attr('data-item-id', item.id)
        .toggleClass('image-only', isImageOnly)
        .append($check, $itemActions, $body, $qtyControl);
    return $row;
}

$('#addItemForm').on('submit', event => {
    event.preventDefault();
    const name = $('#newItemName').val().trim();
    const quantity = parseInt($('#newItemQty').val(), 10) || 1;
    const imageFile = pendingNewItemImage || ($('#newItemImage')[0] && $('#newItemImage')[0].files ? $('#newItemImage')[0].files[0] : null);

    if (!name && !imageFile) {
        alert(uiText('יש להזין שם פריט או לבחור תמונה', 'Enter an item name or select an image'));
        return;
    }

    if (imageFile) {
        const formData = new FormData();
        formData.append('group_id', String(currentGroupId));
        formData.append('name', name);
        formData.append('quantity', String(quantity));
        formData.append('image', imageFile);

        apiUpload('POST', '/items', formData)
            .done(() => {
                resetNewItemComposer();
                loadItems();
            })
            .fail(xhr => {
                alert(apiErr(xhr));
            });
        return;
    }

    apiCall('POST', '/items', { group_id: currentGroupId, name, quantity })
        .done(() => {
            resetNewItemComposer();
            loadItems();
        })
        .fail(xhr => {
            if (xhr.status === 409) {
                const response = xhr.responseJSON || {};
                const existingItem = response.existing_item;
                if (existingItem) {
                    if (response.can_add_to_existing) {
                        showExistingItemSheet(existingItem, quantity);
                    } else {
                        if (Number(existingItem.total_remaining) <= 0) {
                            alert(`"${name}" כבר קיים, אבל הגעת למגבלת הכמות של 10.`);
                        } else {
                            alert(`"${name}" כבר קיים כרגע אבל מסומן כהושלם.`);
                        }
                    }
                    return;
                }
            }
            alert(apiErr(xhr));
        });
});

function completeItem(id) {
    apiCall('PATCH', `/items/${id}/complete`)
        .done(() => {
            loadItems();
            loadActivity();
            loadNotifications();
        })
        .fail(xhr => alert(apiErr(xhr)));
}
function uncompleteItem(id) {
    apiCall('PATCH', `/items/${id}/uncomplete`).done(loadItems).fail(xhr => alert(apiErr(xhr)));
}
function deleteItem(id, name) {
    if (!confirm(`למחוק את "${name}"?`)) return;
    apiCall('DELETE', `/items/${id}`).done(loadItems).fail(xhr => alert(apiErr(xhr)));
}

function addComment(itemId, itemName, onAdded, trigger) {
    const id = Number(itemId) || null;
    if (!id) return;

    commentComposerReturnFocus = trigger || document.activeElement;
    commentComposerContext = {
        itemId: id,
        itemName: String(itemName || '').trim()
    };
    commentComposerOnAdded = typeof onAdded === 'function' ? onAdded : null;

    const target = commentComposerContext.itemName
        ? uiText(`לפריט: ${commentComposerContext.itemName}`, `Item: ${commentComposerContext.itemName}`)
        : '';
    $('#commentComposerTarget').text(target).toggleClass('hidden', !target);
    $('#commentComposerBody').val('').removeAttr('aria-invalid');
    $('#commentComposerError').text('').addClass('hidden');
    $('#commentComposerModal').removeClass('hidden');
    $('body').addClass('comment-composer-open');
    $('#commentComposerBody').trigger('focus');
}

function hideCommentComposer(restoreFocus = true) {
    const $modal = $('#commentComposerModal');
    if (!$modal.length || $modal.hasClass('hidden')) return;

    $modal.addClass('hidden');
    $('body').removeClass('comment-composer-open');
    $('#commentComposerBody').val('').removeAttr('aria-invalid');
    $('#commentComposerError').text('').addClass('hidden');
    $('#commentComposerTarget').text('').addClass('hidden');
    commentComposerContext = null;
    commentComposerOnAdded = null;

    if (restoreFocus && commentComposerReturnFocus && document.contains(commentComposerReturnFocus)) {
        commentComposerReturnFocus.focus();
    }
    commentComposerReturnFocus = null;
}

function submitComment() {
    if (!commentComposerContext) return;
    const body = String($('#commentComposerBody').val() || '').trim();
    if (!body) {
        $('#commentComposerBody').attr('aria-invalid', 'true').trigger('focus');
        $('#commentComposerError').text(uiText('יש להזין הערה', 'Enter a comment')).removeClass('hidden');
        return;
    }
    if (Array.from(body).length > 500) {
        $('#commentComposerBody').attr('aria-invalid', 'true').trigger('focus');
        $('#commentComposerError').text(uiText('ההערה יכולה להכיל עד 500 תווים', 'The comment can contain up to 500 characters')).removeClass('hidden');
        return;
    }

    const context = {...commentComposerContext};
    const onAdded = commentComposerOnAdded;
    const $button = $('#btnSubmitComment').prop('disabled', true).text(uiText('מוסיף...', 'Adding...'));
    apiCall('POST', `/items/${context.itemId}/comments`, { body })
        .done(() => {
            hideCommentComposer(false);
            loadItems();
            if (typeof onAdded === 'function') onAdded();
        })
        .fail(xhr => {
            $('#commentComposerBody').attr('aria-invalid', 'true');
            $('#commentComposerError').text(apiErr(xhr)).removeClass('hidden');
        })
        .always(() => $button.prop('disabled', false).text(MAIN_LANGUAGE_TEXT[currentLanguage].saveComment));
}

$('#commentComposerClose, #btnCancelComment').on('click', () => hideCommentComposer());
$('#commentComposerModal').on('click', event => {
    if (event.target && event.target.id === 'commentComposerModal') hideCommentComposer();
});
$('#commentComposerBody').on('input', function () {
    $(this).removeAttr('aria-invalid');
    $('#commentComposerError').text('').addClass('hidden');
}).on('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') submitComment();
});
$('#btnSubmitComment').on('click', submitComment);

function pickItemImage(itemId, itemName) {
    const $input = $('<input type="file" accept="image/*" class="hidden">').appendTo('body');
    $input.on('change', function () {
        const file = this.files && this.files[0] ? this.files[0] : null;
        if (!file) {
            $input.remove();
            return;
        }

        const formData = new FormData();
        formData.append('image', file);

        apiUpload('POST', `/items/${itemId}/image`, formData)
            .done(() => {
                loadItems();
            })
            .fail(xhr => alert(apiErr(xhr)))
            .always(() => $input.remove());
    });
    $input.trigger('click');
}

function adjustContribution(itemId, delta) {
    const method = delta > 0 ? 'POST' : 'DELETE';
    const $row = $(`.item-row[data-item-id="${itemId}"]`);
    const $buttons = $row.find('.qty-btn').prop('disabled', true);

    apiCall(method, `/items/${itemId}/contribution`, { quantity: Math.abs(delta) })
        .done(response => {
            const updated = response && response.item ? response.item : null;
            if (updated) {
                const quantity = Math.max(0, Number(updated.quantity) || 0);
                const myQuantity = Math.max(0, Number(updated.my_contribution_qty) || 0);
                const remaining = Math.max(0, Number(updated.total_remaining) || 0);
                const isCreator = Number(currentUserId) === Number(updated.created_by);
                const canDecrease = isCreator ? quantity > 1 : myQuantity > 0;

                $row.find('.item-qty').text('×' + quantity);
                $row.find('.qty-btn.minus')
                    .toggleClass('hidden', !canDecrease)
                    .prop('disabled', !canDecrease);
                $row.find('.qty-btn.plus').prop('disabled', remaining <= 0);
            } else {
                $buttons.prop('disabled', false);
            }

            loadItems();
            loadActivity();
            loadNotifications();
        })
        .fail(xhr => {
            $buttons.prop('disabled', false);
            alert(apiErr(xhr));
        });
}

function showExistingItemSheet(item, requestedQty) {
    const remaining = Math.max(0, Number(item.total_remaining) || 0);
    const allowedQty = remaining > 0 ? Math.min(Math.max(1, Number(requestedQty) || 1), remaining) : 0;
    pendingExistingItem = {
        id: Number(item.id),
        name: item.name,
        quantity: allowedQty || Math.max(1, Number(requestedQty) || 1),
        remaining
    };

    $('#existingItemTitle').text(uiText('הפריט כבר קיים', 'The item already exists'));
    const $text = $('#existingItemText').empty();
    $text.append(
        $('<span>').text(uiText(`"${item.name}" כבר נמצא ברשימה.`, `"${item.name}" is already in the list.`)),
        $('<br>'),
        $('<span>').html(
            remaining > 0
                ? uiText(`אפשר להוסיף עוד <strong>${remaining}</strong> בלבד.`, `You can add only <strong>${remaining}</strong> more.`)
                : uiText('הגעת למגבלת הכמות של 10.', 'The quantity limit of 10 has been reached.')
        )
    );
    $('#btnExistingItemAdd')
        .toggleClass('hidden', remaining <= 0)
        .prop('disabled', remaining <= 0)
        .text(remaining > 0 ? uiText(`הוסף ${pendingExistingItem.quantity}`, `Add ${pendingExistingItem.quantity}`) : uiText('אין אפשרות להוסיף', 'Cannot add more'));
    $('#existingItemSheet').removeClass('hidden');
    $('#btnExistingItemAdd').trigger('focus');
}

function hideExistingItemSheet() {
    pendingExistingItem = null;
    $('#existingItemSheet').addClass('hidden');
}

$('#btnExistingItemCancel').on('click', hideExistingItemSheet);
$('#existingItemSheet').on('click', event => {
    if (event.target && event.target.id === 'existingItemSheet') hideExistingItemSheet();
});

$('#btnExistingItemAdd').on('click', () => {
    if (!pendingExistingItem) return;

    const { id, quantity } = pendingExistingItem;
    apiCall('POST', `/items/${id}/contribution`, { quantity })
        .done(() => {
            hideExistingItemSheet();
            resetNewItemComposer();
            loadItems();
            loadNotifications();
        })
        .fail(xhr => {
            hideExistingItemSheet();
            alert(apiErr(xhr));
        });
});

$(document).on('keydown', event => {
    if (event.key === 'Escape' && !$('#existingItemSheet').hasClass('hidden')) {
        hideExistingItemSheet();
    }
});

// Notifications
function loadNotifications() {
    if (!currentGroupId) {
        notificationsPanelOpen = false;
        $('#btnNotifications, #notifBadge, #notifPanel').addClass('hidden');
        $('#notifBadge').text('');
        return;
    }
    $('#btnNotifications').removeClass('hidden');
    apiCall('GET', `/notifications?group_id=${encodeURIComponent(currentGroupId)}`).done(renderNotifs).fail(() => {});
}

function renderNotifs(notifications) {
    const unread = notifications.filter(notification => !Number(notification.is_read));
    $('#notifBadge').text(unread.length).toggleClass('hidden', !unread.length);

    const $panel = $('#notifPanel').empty();
    if (!unread.length) {
        notificationsPanelOpen = false;
        $panel.addClass('hidden');
        return;
    }

    const visible = unread.slice(0, 3);
    $panel.append(
        $('<div class="notif-panel-head">').append(
            $('<span class="notif-panel-title">').text(uiText('התראות הקבוצה', 'Group notifications')),
            $('<button type="button" class="btn-clear-notifications" id="btnClearNotifications">').text(uiText('מחק התראות בקבוצה', 'Clear group notifications'))
        )
    );

    visible.forEach(notification => {
        const $close = $('<button class="notif-x">')
            .attr('aria-label', uiText('סמן כנקראה', 'Mark as read'))
            .append(tablerIcon('x'))
            .on('click', () => apiCall('PATCH', `/notifications/${notification.id}/read?group_id=${encodeURIComponent(currentGroupId)}`).done(loadNotifications));

        const text = notificationText(notification);
        $panel.append(
            $('<div class="notif-item">').append(
                $('<span>').append(
                    $('<span class="notif-actor">').text(notification.actor),
                    document.createTextNode(' ' + text)
                ),
                $close
            )
        );
    });

    $panel.toggleClass('hidden', !notificationsPanelOpen);
}

function notificationText(notification) {
    const amount = Math.max(1, Number(notification.amount) || 1);
    const itemName = String(notification.item_name || '').trim() || uiText('פריט ללא שם', 'Unnamed item');
    const action = notification.event_type || 'completed';

    switch (action) {
        case 'contribution_added':
            return amount === 1
                ? uiText(`הוסיף/ה כמות ל${itemName}`, `added quantity to ${itemName}`)
                : uiText(`הוסיף/ה ${amount} ל${itemName}`, `added ${amount} to ${itemName}`);
        case 'contribution_removed':
            return amount === 1
                ? uiText(`הסיר/ה כמות מ${itemName}`, `removed quantity from ${itemName}`)
                : uiText(`הסיר/ה ${amount} מ${itemName}`, `removed ${amount} from ${itemName}`);
        case 'completed':
        default:
            return uiText(`לקח/ה את ${itemName}`, `took ${itemName}`);
    }
}

$(document).on('click', '#btnClearNotifications', () => {
    apiCall('DELETE', `/notifications?group_id=${encodeURIComponent(currentGroupId)}`)
        .done(() => {
            notificationsPanelOpen = false;
            $('#notifPanel').addClass('hidden').empty();
            loadNotifications();
        })
        .fail(xhr => alert(apiErr(xhr)));
});

$('#btnNotifications').on('click', () => {
    if (!currentGroupId) return;
    notificationsPanelOpen = !notificationsPanelOpen;
    if (!notificationsPanelOpen) {
        $('#notifPanel').addClass('hidden');
        return;
    }

    $('#notifPanel').removeClass('hidden');
    loadNotifications();
});

// Members
function updateMemberCount(count) {
    const safeCount = Number.isFinite(Number(count)) ? Math.max(0, Number(count)) : 0;
    $('#memberCount').text(safeCount);
    $('.nav-btn[data-tab="members"]').attr('aria-label', uiText(`חברים בקבוצה: ${safeCount}`, `Group members: ${safeCount}`));
}

function loadMembers() {
    if (!currentGroupId) {
        updateMemberCount(0);
        return;
    }

    apiCall('GET', `/groups/${currentGroupId}/members`)
        .done(response => {
            const members = Array.isArray(response.members) ? response.members : [];
            const currentMember = members.find(member => Number(member.id) === Number(currentUserId));
            if (currentMember && currentMember.username) {
                currentUsername = String(currentMember.username);
            }
            updateMemberCount(members.length);
            currentGroupCanRename = !!response.can_manage;
            $('#btnRenameGroup').toggleClass('hidden', !currentGroupCanRename);
            updateGroupActions();

            const saved = sessionStorage.getItem('last_group');
            if (saved) {
                try {
                    const group = JSON.parse(saved);
                    group.can_rename = currentGroupCanRename;
                    sessionStorage.setItem('last_group', JSON.stringify(group));
                } catch (e) {
                    // Ignore invalid session data.
                }
            }

            renderMembers(members);
        })
        .fail(xhr => alert(apiErr(xhr)));
}

function renderMembers(members) {
    const $list = $('#memberList').empty();
    $('#membersEmpty').toggleClass('hidden', !!members.length);

    members.forEach(member => {
        const labels = [];
        if (member.is_creator) labels.push(uiText('יוצר/ת הקבוצה', 'Group creator'));
        if (Number(member.id) === Number(currentUserId)) labels.push(uiText('את/ה', 'You'));

        const $details = $('<div class="member-details">').append(
            $('<div class="member-name">').text(member.username),
            $('<div class="member-role">').text(labels.join(' - ') || uiText('חבר/ת קבוצה', 'Group member'))
        );

        const $row = $('<li class="member-row">').append($details);
        const $actions = $('<div class="member-actions">');

        if (Number(member.id) !== Number(currentUserId)) {
            $actions.append(
                $('<button type="button" class="btn-report-member">')
                    .attr('aria-label', uiText(`דווח על ${member.username}`, `Report ${member.username}`))
                    .append(tablerIcon('flag'))
                    .on('click', function () {
                        openReportModal('user', member.id, member.username, this);
                    })
            );
        }

        if (currentGroupCanRename && !member.is_creator) {
            $actions.append(
                $('<button class="btn-remove-member">')
                    .attr('aria-label', uiText(`הסר את ${member.username} מהקבוצה`, `Remove ${member.username} from the group`))
                    .text(uiText('הסר', 'Remove'))
                    .on('click', () => removeMember(member.id, member.username))
            );
        }

        if ($actions.children().length) $row.append($actions);
        $list.append($row);
    });
}

function removeMember(userId, username) {
    if (!currentGroupId || !currentGroupCanRename) return;
    if (!confirm(uiText(`להסיר את "${username}" מהקבוצה?`, `Remove "${username}" from the group?`))) return;

    apiCall('DELETE', `/groups/${currentGroupId}/members?user_id=${encodeURIComponent(userId)}`)
        .done(loadMembers)
        .fail(xhr => alert(apiErr(xhr)));
}

// Group management
function openGroupManagement() {
    if (!currentGroupId || !currentGroupCanRename) return;
    closeMobileGroupMenu();
    $('.nav-btn').removeClass('active').removeAttr('aria-current');
    showScreen('screenGroupAdmin');
    $('#btnNotifications, #notifPanel').addClass('hidden');
    notificationsPanelOpen = false;
    loadGroupManagement();
    requestAnimationFrame(syncFixedUiOffsets);
}

function closeGroupManagement() {
    if (!currentGroupId) return;
    showScreen('screenItems');
    $('.nav-btn').removeClass('active').removeAttr('aria-current');
    $('.nav-btn[data-tab="items"]').addClass('active').attr('aria-current', 'page');
    $('#btnNotifications').removeClass('hidden');
    loadItems();
    requestAnimationFrame(syncFixedUiOffsets);
}

function setGroupAdminStatus(message, isError = false) {
    $('#groupAdminEmailStatus')
        .text(message || '')
        .toggleClass('hidden', !message)
        .toggleClass('is-error', !!isError);
}

function loadGroupManagement() {
    if (!currentGroupId || !currentGroupCanRename) return;
    $('#groupAdminMemberList, #groupAdminContentList').empty();
    $('#groupAdminMembersEmpty, #groupAdminContentEmpty').addClass('hidden');
    $('#groupEmailNotifications').prop('disabled', true);
    setGroupAdminStatus(uiText('טוען הגדרות...', 'Loading settings...'));

    apiCall('GET', `/groups/${currentGroupId}/management`)
        .done(response => {
            const group = response && response.group ? response.group : {};
            const members = response && Array.isArray(response.members) ? response.members : [];
            const items = response && Array.isArray(response.items) ? response.items : [];
            $('#groupEmailNotifications').prop('checked', !!group.notify_creator_on_item_taken).prop('disabled', false);
            renderGroupAdminMembers(members);
            renderGroupAdminContent(items);
            setGroupAdminStatus('');
        })
        .fail(xhr => {
            setGroupAdminStatus(apiErr(xhr), true);
            if (xhr.status === 403) {
                currentGroupCanRename = false;
                updateGroupActions();
                closeGroupManagement();
            }
        });
}

function renderGroupAdminMembers(members) {
    const $list = $('#groupAdminMemberList').empty();
    $('#groupAdminMemberCount').text(members.length);
    $('#groupAdminMembersEmpty').toggleClass('hidden', members.length > 1);

    members.forEach(member => {
        const isCreator = !!member.is_creator;
        const role = isCreator ? uiText('יוצר/ת הקבוצה', 'Group creator') : uiText('משתתף/ת', 'Member');
        const $row = $('<li class="group-admin-row">').append(
            $('<div class="group-admin-row-copy">').append(
                $('<strong>').text(member.username || uiText('משתמש/ת', 'User')),
                $('<span>').text(role)
            )
        );
        if (!isCreator) {
            $row.append(
                $('<button type="button" class="group-admin-remove">')
                    .text(uiText('הסר מהקבוצה', 'Remove from group'))
                    .on('click', () => removeManagedMember(member.id, member.username))
            );
        }
        $list.append($row);
    });
}

function removeManagedMember(userId, username) {
    if (!currentGroupId || !currentGroupCanRename) return;
    if (!confirm(uiText(`להסיר את "${username}" מהקבוצה?`, `Remove "${username}" from the group?`))) return;
    apiCall('DELETE', `/groups/${currentGroupId}/members?user_id=${encodeURIComponent(userId)}`)
        .done(() => {
            loadGroupManagement();
            loadMembers();
        })
        .fail(xhr => setGroupAdminStatus(apiErr(xhr), true));
}

function renderGroupAdminContent(items) {
    const $list = $('#groupAdminContentList').empty();
    $('#groupAdminContentCount').text(items.length);
    $('#groupAdminContentEmpty').toggleClass('hidden', items.length > 0);

    items.forEach(item => {
        const name = String(item.name || '').trim() || uiText('פריט עם תמונה', 'Image item');
        const commentCount = Math.max(0, Number(item.comment_count) || 0);
        const status = Number(item.is_completed) ? uiText('נלקח', 'Taken') : uiText('פעיל', 'Active');
        const details = uiText(
            `${item.creator || ''} - ${status}${commentCount ? ` - ${commentCount} הערות` : ''}`,
            `${item.creator || ''} - ${status}${commentCount ? ` - ${commentCount} comments` : ''}`
        );
        $list.append(
            $('<li class="group-admin-row group-admin-content-row">').append(
                $('<div class="group-admin-row-copy">').append(
                    $('<strong>').text(name),
                    $('<span>').text(details)
                ),
                $('<button type="button" class="group-admin-delete">')
                    .text(uiText('מחק תוכן', 'Delete content'))
                    .on('click', () => deleteManagedItem(item.id, name))
            )
        );
    });
}

function deleteManagedItem(itemId, name) {
    if (!currentGroupId || !currentGroupCanRename) return;
    if (!confirm(uiText(`למחוק את "${name}" ואת ההערות שלו?`, `Delete "${name}" and its comments?`))) return;
    apiCall('DELETE', `/items/${itemId}`)
        .done(() => {
            loadGroupManagement();
            loadItems();
            loadActivity();
        })
        .fail(xhr => setGroupAdminStatus(apiErr(xhr), true));
}

$('#btnGroupAdminBack').on('click', closeGroupManagement);
$('#groupEmailNotifications').on('change', function () {
    if (!currentGroupId || !currentGroupCanRename) return;
    const enabled = this.checked;
    const $checkbox = $(this).prop('disabled', true);
    setGroupAdminStatus(uiText('שומר...', 'Saving...'));
    apiCall('PATCH', `/groups/${currentGroupId}/management`, { notify_creator_on_item_taken: enabled })
        .done(response => {
            $checkbox.prop('checked', !!response.notify_creator_on_item_taken);
            setGroupAdminStatus(uiText('ההגדרה נשמרה', 'Setting saved'));
        })
        .fail(xhr => {
            $checkbox.prop('checked', !enabled);
            setGroupAdminStatus(apiErr(xhr), true);
        })
        .always(() => $checkbox.prop('disabled', false));
});

// Share
function buildShareUrl(token) {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('t', token);
    return url.toString();
}

function requestShareLink(groupId) {
    const key = Number(groupId);
    if (!key) return Promise.reject(new Error('Missing group ID'));
    if (shareLinkCache.has(key)) return Promise.resolve(shareLinkCache.get(key));
    if (shareLinkRequests.has(key)) return shareLinkRequests.get(key);

    const request = new Promise((resolve, reject) => {
        apiCall('POST', '/invite/create', { group_id: key })
            .done(response => {
                const url = buildShareUrl(response.token);
                shareLinkCache.set(key, url);
                resolve(url);
            })
            .fail(reject);
    }).finally(() => shareLinkRequests.delete(key));

    shareLinkRequests.set(key, request);
    return request;
}

function prefetchShareLink(groupId) {
    requestShareLink(groupId).catch(() => {
        // The visible Share action will report the error if the user opens it.
    });
}

function legacyCopyTextToClipboard(text) {
    return new Promise((resolve, reject) => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        textarea.style.pointerEvents = 'none';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();

        try {
            const copied = document.execCommand('copy');
            textarea.remove();
            copied ? resolve() : reject(new Error('Copy command failed'));
        } catch (error) {
            textarea.remove();
            reject(error);
        }
    });
}

function copyTextToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text)
            .catch(() => legacyCopyTextToClipboard(text));
    }
    return legacyCopyTextToClipboard(text);
}

function renderShareLink(url) {
    $('#shareText').text(url).data('link', url).removeClass('share-error');
    $('#btnCopyLink').removeClass('hidden').text(uiText('העתק', 'Copy'));
    $('#shareBanner').removeClass('hidden');
}

function markShareCopied() {
    $('#btnCopyLink').removeClass('hidden').text(uiText('הועתק', 'Copied'));
    setTimeout(() => $('#btnCopyLink').text(uiText('העתק', 'Copy')), 2000);
}

function copyVisibleShareLink() {
    const link = String($('#shareText').data('link') || '');
    if (!link) return Promise.reject(new Error('Share link is unavailable'));
    return copyTextToClipboard(link).then(markShareCopied);
}

function showShareBanner(groupId, autoCopy = false) {
    const key = Number(groupId);
    const cachedLink = shareLinkCache.get(key);

    $('#shareText').text(cachedLink || uiText('יוצר קישור...', 'Creating link...')).removeClass('share-error').removeData('link');
    $('#btnCopyLink').toggleClass('hidden', !cachedLink).text(uiText('העתק', 'Copy'));
    $('#shareBanner').removeClass('hidden');

    if (cachedLink) {
        renderShareLink(cachedLink);
        if (autoCopy) {
            copyVisibleShareLink().catch(() => {
                alert(uiText('לא ניתן להעתיק אוטומטית. אפשר ללחוץ על כפתור "העתק".', 'Automatic copying was blocked. Use the Copy button.'));
            });
        }
        return;
    }

    requestShareLink(key)
        .then(url => {
            renderShareLink(url);
            if (autoCopy) {
                return copyVisibleShareLink().catch(() => {
                    alert(uiText('הקישור נוצר, אך הדפדפן חסם העתקה אוטומטית. לחצי על "העתק".', 'The link was created, but the browser blocked automatic copying. Select Copy.'));
                });
            }
        })
        .catch(xhr => {
            $('#shareText')
                .text(uiText(`לא ניתן ליצור קישור: ${apiErr(xhr)}`, `Could not create link: ${apiErr(xhr)}`))
                .addClass('share-error');
            $('#btnCopyLink').addClass('hidden');
        });
}

$('#btnCopyLink').on('click', () => {
    copyVisibleShareLink().catch(() => {
        alert(uiText('לא ניתן להעתיק אוטומטית. אפשר לסמן ולהעתיק את הקישור.', 'Automatic copying was blocked. Select and copy the link manually.'));
    });
});

$('#btnShareClose').on('click', () => $('#shareBanner').addClass('hidden'));

function copyGroupShareLink(groupId) {
    const key = Number(groupId);
    if (!key) {
        showStyledAlert(uiText('לא נמצאה קבוצה לשיתוף', 'No group was found to share'), uiText('שיתוף', 'Share'));
        return;
    }

    $('#shareBanner').addClass('hidden');
    requestShareLink(key)
        .then(url => copyTextToClipboard(url))
        .then(() => showStyledAlert(uiText('הקישור הועתק ללוח', 'The link was copied to the clipboard'), uiText('שיתוף', 'Share'), 'success'))
        .catch(xhr => showStyledAlert(uiText(`לא ניתן להעתיק את הקישור: ${apiErr(xhr)}`, `Could not copy the link: ${apiErr(xhr)}`), uiText('שיתוף', 'Share')));
}

// Navigation
$('.nav-btn').on('click', function () {
    const tab = $(this).data('tab');
    closeMobileGroupMenu();
    if (tab === 'share') {
        copyGroupShareLink(currentGroupId);
        return;
    }

    $('.nav-btn').removeClass('active').removeAttr('aria-current');
    $(this).addClass('active').attr('aria-current', 'page');
    $('#screenItems').toggleClass('hidden', tab !== 'items');
    $('#screenActivity').toggleClass('hidden', tab !== 'activity');
    $('#screenMembers').toggleClass('hidden', tab !== 'members');
    $('#screenGroupAdmin').addClass('hidden');
    $('#btnNotifications').removeClass('hidden');
    if (tab === 'activity') loadActivity();
    if (tab === 'members') loadMembers();
    requestAnimationFrame(syncFixedUiOffsets);
});

// Activity
function loadActivity() {
    if (!currentGroupId) return;

    const labels = currentLanguage === 'he' ? {
        added: 'הוסיף/ה',
        contribution_added: 'הוסיף/ה כמות',
        contribution_removed: 'הסיר/ה כמות',
        completed: 'לקח/ה',
        deleted: 'מחק/ה'
    } : {
        added: 'added',
        contribution_added: 'added quantity',
        contribution_removed: 'removed quantity',
        completed: 'took',
        deleted: 'deleted'
    };

    apiCall('GET', `/activity?group_id=${currentGroupId}`)
        .done(response => {
            const items = Array.isArray(response) ? response : (response.items || []);
            if (!Array.isArray(response)) {
                if (response.server_now) syncServerClock(response.server_now);
                if (Object.prototype.hasOwnProperty.call(response, 'can_manage')) {
                    currentGroupCanRename = !!response.can_manage;
                    $('#btnRenameGroup').toggleClass('hidden', !currentGroupCanRename);
                    updateGroupActions();
                }
            }

            const $list = $('#activityList').empty();
            $('#activityEmpty').toggleClass('hidden', !!items.length);
            $('#btnClearActivity').toggleClass('hidden', !currentGroupCanRename || !items.length);

            items.forEach(activity => {
                const timeValue = activity.created_ts || activity.created_at;
                const amount = Math.max(1, Number(activity.quantity) || 1);
                let actionText = labels[activity.action] || activity.action;
                if (activity.action === 'contribution_added') actionText = uiText(`הוסיף/ה +${amount}`, `added +${amount}`);
                if (activity.action === 'contribution_removed') actionText = uiText(`הסיר/ה -${amount}`, `removed -${amount}`);
                $list.append(
                    $('<li>').append(
                        $('<span class="act-who">').text(activity.username),
                        document.createTextNode(` ${actionText}: ${String(activity.item_name || '').trim() || uiText('פריט ללא שם', 'Unnamed item')} `),
                        $('<span class="act-time relative-time">')
                            .attr('data-time', timeValue || '')
                            .text(`- ${relTime(timeValue)}`)
                    )
                );
            });
            refreshRelativeTimes();
        })
        .fail(xhr => alert(apiErr(xhr)));
}

$('#btnClearActivity').on('click', () => {
    if (!currentGroupId || !currentGroupCanRename) return;
    if (!confirm(uiText('למחוק את כל היסטוריית הקבוצה? לא ניתן לבטל פעולה זו.', 'Delete the entire group history? This cannot be undone.'))) return;

    apiCall('DELETE', `/activity?group_id=${currentGroupId}`)
        .done(() => loadActivity())
        .fail(xhr => alert(apiErr(xhr)));
});

// Polling
function startPoll() {
    stopPoll();
    pollTimer = setInterval(() => {
        loadItems();
        loadNotifications();
        refreshRelativeTimes();
    }, POLL_MS);
}
function stopPoll() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
}

// Time helpers
function syncServerClock(serverNowSeconds) {
    const value = Number(serverNowSeconds);
    if (Number.isFinite(value) && value > 0) {
        serverClockOffsetMs = value * 1000 - Date.now();
    }
}

function toEpochMs(value) {
    if (value === null || value === undefined || value === '') return null;

    if (typeof value === 'number' || /^\d+(?:\.\d+)?$/.test(String(value))) {
        const numeric = Number(value);
        return numeric > 100000000000 ? numeric : numeric * 1000;
    }

    let text = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text)) {
        text = text.replace(' ', 'T') + 'Z';
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(text)) {
        text += 'Z';
    }

    const parsed = Date.parse(text);
    return Number.isNaN(parsed) ? null : parsed;
}

function relTime(value) {
    const timestamp = toEpochMs(value);
    if (timestamp === null) return '';

    const seconds = Math.max(0, Math.floor((Date.now() + serverClockOffsetMs - timestamp) / 1000));
    if (currentLanguage === 'en') {
        if (seconds < 5) return 'now';
        if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'} ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
        const days = Math.floor(hours / 24);
        return `${days} day${days === 1 ? '' : 's'} ago`;
    }
    if (seconds < 5) return 'עכשיו';
    if (seconds < 60) return seconds === 1 ? 'לפני שנייה' : `לפני ${seconds} שניות`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes === 1 ? 'לפני דקה' : `לפני ${minutes} דקות`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours === 1 ? 'לפני שעה' : `לפני ${hours} שעות`;

    const days = Math.floor(hours / 24);
    return days === 1 ? 'לפני יום' : `לפני ${days} ימים`;
}

function refreshRelativeTimes() {
    $('.relative-time').each(function () {
        const prefix = $(this).hasClass('act-time') ? '- ' : '';
        $(this).text(prefix + relTime($(this).attr('data-time')));
    });
}

function formatBlockedUntil(value) {
    const timestamp = toEpochMs(value);
    if (timestamp === null) return String(value || '');
    return new Intl.DateTimeFormat(currentLanguage === 'he' ? 'he-IL' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Jerusalem'
    }).format(new Date(timestamp));
}

function apiErr(xhr) {
    let message = '';
    let response = {};
    try {
        response = JSON.parse(xhr.responseText);
        message = String(response.error || response.message || '').trim();
    } catch (e) {
        message = '';
        response = {};
    }

    if (message === 'Account temporarily blocked') {
        const reason = String(response.reason || '').trim();
        const until = response.blocked_until ? formatBlockedUntil(response.blocked_until) : '';
        if (currentLanguage === 'en') {
            return `The account is temporarily blocked${until ? ` until ${until}` : ''}${reason ? `. Reason: ${reason}` : ''}.`;
        }
        return `החשבון חסום זמנית${until ? ` עד ${until}` : ''}${reason ? `. סיבה: ${reason}` : ''}.`;
    }

    if (currentLanguage === 'en') {
        const englishMessages = {
            'Content contains blocked language': 'The text contains offensive or blocked language. Edit it and try again.',
            'Account deleted': 'The account has been deleted and is not active.',
            'Admin access required': 'Administrator access is required.',
            'Report target required': 'A report target is required.',
            'Report reason required': 'Enter a reason for the report.',
            'Report reason too long': 'The report reason is too long.',
            'Report target not accessible': 'You cannot access the reported content.',
            'Report already submitted': 'You already submitted an open report for this content.',
            'Item name or image required': 'Enter an item name or select an image.',
            'Contribution limit reached': 'The total quantity limit is 10.',
            'Too many login attempts': 'Too many login attempts. Try again in 15 minutes.',
            'Invalid login identifier': 'The username or email is invalid.',
            'Invalid credentials': 'The username/email or password is incorrect.'
        };
        if (englishMessages[message]) return englishMessages[message];
        if (message) return message;
        const englishStatus = {
            0: 'Cannot connect to the server. Check the internet connection and try again.',
            400: 'The request is invalid.', 401: 'The username/email or password is incorrect, or you need to sign in again.',
            403: 'You do not have permission to perform this action.', 404: 'The requested information was not found.',
            405: 'This action is not supported.', 409: 'The information already exists.', 410: 'The information is no longer available.',
            422: 'Some of the entered information is invalid.', 429: 'Too many attempts. Try again later.',
            500: 'A server error occurred. Try again later.', 502: 'The server is currently unavailable.', 503: 'The service is currently unavailable.'
        };
        return englishStatus[xhr.status] || 'An error occurred. Try again.';
    }

    const translations = {
        'Already completed': 'הפריט כבר סומן כהושלם',
        'Could not generate token': 'לא ניתן ליצור קישור שיתוף',
        'Database connection failed': 'החיבור למסד הנתונים נכשל',
        'Database operation failed': 'פעולת מסד הנתונים נכשלה',
        'Email or username already taken': 'האימייל או שם המשתמש כבר קיימים',
        'Forbidden': 'אין הרשאה לבצע את הפעולה',
        'Group name required': 'יש להזין שם לקבוצה',
        'Group not found or access denied': 'הקבוצה לא נמצאה או שאין הרשאה לצפות בה',
        'Group not found': 'הקבוצה לא נמצאה',
        'Group deleted': 'הקבוצה נמחקה',
        'Left group': 'עזבת את הקבוצה',
        'Internal Server Error': 'אירעה שגיאה פנימית בשרת',
        'Invalid credentials': 'שם המשתמש/האימייל או הסיסמה אינם נכונים',
        'Invalid login identifier': 'שם המשתמש או האימייל אינם תקינים',
        'Invalid email': uiText('כתובת האימייל אינה תקינה', 'The email address is invalid'),
        'Invalid token': 'קישור ההצטרפות אינו תקין',
        'Invite storage unavailable': 'אחסון קישורי השיתוף לא הוגדר במסד הנתונים',
        'Item already completed': 'הפריט כבר הושלם',
        'Item already exists': 'הפריט כבר קיים ברשימה',
        'Item name required': 'יש להזין שם פריט',
        'Item name or image required': 'יש להזין שם פריט או לבחור תמונה',
        'Item not found': 'הפריט לא נמצא',
        'Member not found': 'המשתמש אינו חבר בקבוצה',
        'Method not allowed': 'הפעולה אינה נתמכת',
        'Missing authorization header': 'נדרשת התחברות מחדש',
        'Missing fields': 'חסרים שדות נדרשים',
        'Name too long': 'השם ארוך מדי',
        'Not completed': 'הפריט אינו מסומן כהושלם',
        'Not found': 'הכתובת המבוקשת לא נמצאה',
        'Only the creator can delete': 'רק יוצר הפריט יכול למחוק אותו',
        'Only the creator can add contribution': 'רק יוצר הפריט יכול לנהל את תוספות הכמות',
        'Only the group creator can clear activity history': 'רק יוצר הקבוצה יכול למחוק את ההיסטוריה',
        'Only the group creator can delete it': 'רק יוצר הקבוצה יכול למחוק אותה',
        'Only the group creator can remove members': 'רק יוצר הקבוצה יכול להסיר חברים',
        'Only the group creator can rename it': 'רק יוצר הקבוצה יכול לשנות את שמה',
        'Password too short': uiText('הסיסמה חייבת להכיל לפחות 8 תווים', 'The password must contain at least 8 characters'),
        'Passwords do not match': uiText('הסיסמאות אינן תואמות', 'The passwords do not match'),
        'Current password is incorrect': uiText('הסיסמה הנוכחית אינה נכונה', 'The current password is incorrect'),
        'All password fields are required': uiText('יש למלא את כל שדות הסיסמה', 'Complete all password fields'),
        'Password must contain at least 8 characters': uiText('הסיסמה חייבת להכיל לפחות 8 תווים', 'The password must contain at least 8 characters'),
        'Password is too long': uiText('הסיסמה יכולה להכיל עד 256 תווים', 'The password can contain up to 256 characters'),
        'Password update failed': uiText('עדכון הסיסמה נכשל', 'Password update failed'),
        'Email verification required': uiText('שינוי סיסמה מחייב אימות דרך האימייל', 'Changing the password requires email verification'),
        'Registration failed': 'יצירת החשבון נכשלה בשרת',
        'Server operation failed': 'פעולת השרת נכשלה',
        'The group creator cannot be removed': 'אי אפשר להסיר את יוצר הקבוצה',
        'The group creator cannot leave the group': 'יוצר הקבוצה לא יכול לעזוב את הקבוצה',
        'Token already used or expired': 'קישור ההצטרפות כבר נוצל או פג תוקפו',
        'Token already used': 'קישור ההצטרפות כבר נוצל',
        'Token expired': 'קישור ההצטרפות פג תוקף',
        'Token not found': 'קישור ההצטרפות לא נמצא',
        'Contribution updated': 'הכמות עודכנה',
        'Contribution limit reached': 'אפשר להוסיף עד 10 בלבד',
        'Comment required': 'יש להזין הערה',
        'Comment too long': 'ההערה ארוכה מדי',
        'Content contains blocked language': currentLanguage === 'he' ? 'הטקסט כולל מילה פוגענית או אסורה. יש לערוך אותו ולנסות שוב.' : 'The text contains offensive or blocked language. Edit it and try again.',
        'Account temporarily blocked': currentLanguage === 'he' ? 'החשבון חסום זמנית. הסיבה ותאריך הסיום מופיעים בהודעה.' : 'The account is temporarily blocked.',
        'Account deleted': currentLanguage === 'he' ? 'החשבון נמחק ואינו פעיל.' : 'The account has been deleted.',
        'Too many login attempts': currentLanguage === 'he' ? 'בוצעו יותר מדי ניסיונות התחברות. יש לנסות שוב בעוד 15 דקות.' : 'Too many login attempts. Try again in 15 minutes.',
        'Admin access required': currentLanguage === 'he' ? 'נדרשת הרשאת מנהל.' : 'Administrator access is required.',
        'Invalid report target': uiText('יעד הדיווח אינו תקין', 'The report target is invalid'),
        'Report target required': uiText('חסר יעד לדיווח', 'A report target is required'),
        'Report reason required': uiText('יש לכתוב סיבה לדיווח', 'Enter a reason for the report'),
        'Report reason too long': uiText('סיבת הדיווח ארוכה מדי', 'The report reason is too long'),
        'Report target not accessible': uiText('אין גישה לתוכן שעליו ניסית לדווח', 'You cannot access the reported content'),
        'Report already submitted': uiText('כבר נשלח דיווח פתוח על התוכן הזה', 'You already submitted an open report for this content'),
        'Report submitted': uiText('הדיווח נשלח', 'Report submitted'),
        'Image upload failed': 'העלאת התמונה נכשלה',
        'Image storage unavailable': 'אחסון התמונות אינו זמין',
        'Image is too large': 'התמונה גדולה מדי',
        'Unsupported image type': 'סוג התמונה אינו נתמך',
        'Image updated': 'התמונה עודכנה',
        'Notifications cleared': 'כל ההתראות נמחקו',
        'You can only remove your own added quantity': 'אפשר להסיר רק את הכמות שהוספת',
        'Unauthorized': 'נדרשת התחברות מחדש',
        'Username too long': 'שם המשתמש ארוך מדי',
        'Username updated': 'שם המשתמש עודכן',
        'group_id required': 'חסר מזהה קבוצה',
        'user_id required': 'חסר מזהה משתמש'
    };

    if (message && /[א-ת]/.test(message)) return message;
    if (translations[message]) return translations[message];

    const statusMessages = {
        0: 'לא ניתן להתחבר לשרת. בדקי את החיבור לאינטרנט ונסי שוב.',
        400: 'הבקשה אינה תקינה',
        401: 'שם המשתמש/האימייל או הסיסמה אינם נכונים, או שנדרשת התחברות מחדש',
        403: 'אין הרשאה לבצע את הפעולה',
        404: 'המידע המבוקש לא נמצא',
        405: 'הפעולה אינה נתמכת',
        409: 'המידע כבר קיים במערכת',
        410: 'המידע כבר לא זמין',
        422: 'חלק מהפרטים שהוזנו אינם תקינים',
        429: 'בוצעו יותר מדי ניסיונות. נסי שוב מאוחר יותר.',
        500: 'אירעה שגיאה בשרת. נסי שוב מאוחר יותר.',
        502: 'השרת אינו זמין כרגע. נסי שוב מאוחר יותר.',
        503: 'השירות אינו זמין כרגע. נסי שוב מאוחר יותר.'
    };

    return statusMessages[xhr.status] || 'אירעה שגיאה. נסי שוב.';
}

// Boot
$(function () {
    const params = new URLSearchParams(location.search);
    const inviteToken = params.get('t');

    if (inviteToken) {
        sessionStorage.setItem('pending_invite', inviteToken);
        history.replaceState(null, '', location.pathname);
    }

    applyMainLanguage();
    const authToken = getToken();
    if (authToken) {
        currentUserId = parseUserId(authToken);
        loadCurrentProfile().always(() => {
            if (!redeemPendingInvite()) {
                sessionStorage.removeItem('last_group');
                loadGroups();
            }
        });
    } else {
        showScreen('screenAuth');
    }
});

function redeemPendingInvite() {
    const token = sessionStorage.getItem('pending_invite');
    if (!token) return false;

    sessionStorage.removeItem('pending_invite');
    apiCall('GET', `/invite/join?t=${encodeURIComponent(token)}`)
        .done(group => showItems(group.id, group.name, !!group.can_rename))
        .fail(xhr => {
            alert(apiErr(xhr));
            loadGroups();
        });
    return true;
}
