# Agent History

## 2026-10-30 - Move SharedCart configuration outside the web root

- Updated SharedCart PHP entry points, helpers, and API routes to load `secret/config.php` outside `htdocs`, using the correct path for each directory depth.
- Updated the internal security check to inspect that external configuration file rather than the removed public API configuration file.
- Backup: Git commit only, per project policy.

## 2026-10-28 - Keep SharedCart Hebrew-only

- Removed the language controls from the main app and administrator dashboard.
- Forced the interface and new-account language preference to Hebrew, and made the legacy language endpoint retain Hebrew.
- Backup: Git commit only, per project policy.

## 2026-10-28 - Complete SharedCart English interface coverage

- Extended the existing language switch to translate previously missed static copy, dialogs, accessibility labels, group-management controls, sharing controls, and the About content.
- Reloaded the active data screen after a language switch so dynamically rendered controls also use the selected language.
- Added English legal-page content that follows the saved app language preference.
- Backup: Git commit only, per project policy.

## 2026-10-28 - Make SharedCart mobile-ready and installable

- Removed the desktop-only admin restriction and added a responsive phone layout with touch-scrollable navigation and tables, compact cards, stacked forms, and safe-area-aware dialogs.
- Added a web app manifest and service worker so Chrome can install SharedCart as a standalone app and retain the app shell for offline launch; API and admin traffic are never cached.
- Backup: Git commit only, per project policy.

## 2026-10-27 - Use inclusive Hebrew wording in Israel News Multiview

- Updated direct user-facing wording to address women and men, while using gender-neutral wording where it is clearer.
- Backup: Git commit only, per project policy.

## 2026-10-27 - Remove unavailable global indices from Israel News Multiview ticker

- Removed the unavailable S&P 500 and NASDAQ index entries from the market ticker while retaining listed shares and Israeli indicators.
- Backup: Git commit only, per project policy.

## 2026-10-27 - Keep Israel News Multiview market ticker visible on TVs

- Kept the market ticker visible above the phone breakpoint, so TV and desktop viewers do not need to zoom out.
- Backup: Git commit only, per project policy.

## 2026-10-27 - Use a live market-feed ticker in Israel News Multiview

- Replaced the rate-limited direct quote fetcher with TradingView's market-data ticker, configured with Israeli and global indices and leading companies.
- Retained the compact desktop-only placement and continuous ticker behavior.
- Backup: Git commit only, per the project backup policy.

## 2026-10-27 - Animate Israel News Multiview market ticker

- Turned the desktop market strip into a continuous scrolling ticker that pauses on hover or keyboard focus.
- Backup: Git commit only, per the project backup policy.

## 2026-10-27 - Add desktop market ticker to Israel News Multiview

- Added a compact desktop-only ticker for leading Israeli/global indices and leading Israeli/global companies, refreshing every five minutes.
- Changed visible user-facing text to gender-inclusive Hebrew where it used gendered second-person wording.
- Backup: Git commit only, per the project backup policy.

## 2026-10-27 - Correct Israel News Multiview empty-state visibility

- Explicitly hide the empty-state panel whenever one or more valid channels are selected.
- Backup: Git commit only, per the project backup policy.

## 2026-10-27 - Give Israel News Multiview phone branding more room

- Changed the mobile menu close control to an icon-only button so it no longer crowds the site title.
- Backup: Git commit only, per the project backup policy.

## 2026-10-27 - Add compact phone menu to Israel News Multiview

- Collapsed the phone navigation into an accessible menu button that reveals the controls on demand.
- Backup: Git commit only, per the project backup policy.

## 2026-10-27 - Use all space in Israel News Multiview fullscreen

- Hide the navigation bar in browser fullscreen mode so only the broadcast screens remain visible.
- Backup: Git commit only, per the project backup policy.

## 2026-10-27 - Simplify Israel News Multiview controls

- Made channel selection apply immediately and close the picker five seconds after the last selection change.
- Removed the channel-picker action buttons, live-status strip, English utility labels, and the schedule dialog heading/copy.
- Reduced the navigation height to give broadcasts more screen space and condensed Help into friendly, everyday guidance.
- Backup: Git commit only, per the project backup policy.

## 2026-10-23 - Correct Machberet Ptucha home header and encoding safeguards

- Kept the home-page header on the paper background while retaining the distinct header colour elsewhere.
- Made the site icon explicitly white and reinforced the MySQL UTF-8 connection initialization.
- Backup: Git commit.

## 2026-10-23 - Refine Machberet Ptucha public site and management

- Added a shared visual language across public pages: the “✦ מחברת פתוחה” header, navigation, footer, site icon, green summaries page, and accessible focus states.
- Styled summary downloads as site buttons and added administrator-only, CSRF-protected summary deletion, including removal of the uploaded file.
- Explicitly configured UTF-8 HTTP/database handling and added a one-time SQL upgrade for existing tables so new Hebrew content is stored correctly.
- Backup: Git commit.

## 2026-10-22 - Reduce kitchen camera upload size

- Resized kitchen camera captures to a maximum dimension of 1280 pixels and encoded them at a smaller JPEG quality before upload.
- This prevents PHP/hosting upload-size limits from dropping the multipart image before the kitchen route can process it.
- Bumped the application script cache version.
- Backup: Git commit.

## 2026-10-22 - Make SharedCart authentication resilient to hosting header handling

- Accepted a valid secure session cookie when a stale or unavailable Bearer header cannot be authenticated.
- Kept valid Bearer authentication first, without allowing unauthenticated access.
- Stopped sending an empty Authorization header and bumped the script cache version.
- Backup: Git commit.

## 2026-10-22 - Handle expired SharedCart sessions safely

- Routed API 401 responses to the sign-in screen, cleared the stale access token, and stopped authenticated polling.
- Prevented a non-array notification response from crashing the frontend.
- Bumped the application script cache version so the browser loads the fix.
- Backup: Git commit.

## 2026-10-22 - Restore legacy SharedCart group-owner kitchen access

- Allowed an active group creator to use the kitchen-photo route even when a legacy group is missing the creator's `group_members` row.
- Kept access limited to the group creator, current members, or users with a separately approved join request.
- Backup: Git commit.

## 2026-10-22 - Align SharedCart kitchen upload identity with the active account

- Restored the active account's Bearer token on kitchen-image uploads; the API gives this token precedence over a possibly stale session cookie.
- This makes the upload identity match the identity used to load the shared group and its kitchen screen.
- Updated the application script cache version.
- Backup: Git commit.

## 2026-10-22 - Make SharedCart kitchen capture uploads compatible with mobile browsers

- Removed the `File` constructor from the camera-capture path; the captured image blob is now uploaded directly, which avoids a pre-network failure in browsers with incomplete `File` support.
- Added specific on-screen feedback when a photo, group, or kitchen area is unavailable, instead of silently skipping the upload; a failed canvas conversion now preserves the selected area for retry or gallery selection.
- Updated the application script cache version.
- Backup: Git commit.

## 2026-10-22 - Fix SharedCart kitchen uploads blocked by host authorization handling

- Sent kitchen image uploads with the same-origin secure session cookie instead of a Bearer header, avoiding shared-host 403 rules that reject authenticated multipart requests.
- Kept Bearer-token authentication for other API uploads and refreshed the application script cache version.
- Backup: Git commit.

## 2026-10-22 - Repair SharedCart approved-member kitchen access

- Restored a missing `group_members` record automatically when a user has an approved join request before accessing the kitchen-photo route.
- The repair requires a valid, active group and approved user record, so pending or rejected invitees are not granted access.
- Backup: Git commit pending user approval.

## 2026-10-21 - Fix SharedCart kitchen photo uploads for group members

- Sent the kitchen group and area identifiers in the upload URL instead of relying on multipart form fields, so approved shared-group members retain their existing member-only upload permission on PHP/CGI hosts.
- Updated the application script cache version so browsers receive the fix.
- Backup: Git commit pending user approval.

## 2026-10-21 - Adapt Machberet Ptucha for InfinityFree

- Added a deployable PHP/MySQL version under `machberet-ptucha/infinityfree/htdocs` with public summaries, anonymous requests, secure administrator login and protected file uploads.
- Added the MySQL schema, deployment instructions, configuration template and Apache protection rules.
- Backup: Git commit.

## 2026-10-21 - Create Machberet Ptucha

- Created the new Hebrew RTL “מחברת פתוחה” summaries site with search, school-subject and grade filtering, and an anonymous visitor request form.
- Added a separate, unlinked management interface for visitor requests and summary uploads.
- Configured managed database and file-storage bindings for the new hosted Site.
- Backup: Git commit pending user approval.

## 2026-10-20 12:04 - Center SharedCart logout button

- Moved the account logout button below the group-join area and centered it.
- Backup: `MyOwnProjects-add-logout-for-users-without-groups-20261020-120159.zip`

## 2026-10-20 12:01 - Add logout without groups

- Added an account logout button to the groups screen, including when the user has no groups.
- Backup: `MyOwnProjects-add-logout-for-users-without-groups-20261020-120159.zip`

## 2026-10-19 21:28 - Move pending users to admin dashboard

- Removed the pending-user summary from group management.
- Added a pending join-request list with user and group names to the site administration dashboard.
- Backup: `MyOwnProjects-move-pending-users-to-admin-dashboard-20261019-212800.zip`

## 2026-10-19 21:26 - Show pending users in group management

- Added a management-screen summary of users waiting for approval, with a direct button to the members approval screen.
- Backup: `show-pending-users-in-group-management-20261019-212649.zip`

## 2026-10-19 21:24 - Remove join-request email notifications

- Removed manager email delivery and its direct-link support for join requests.
- Kept in-app join requests and manager approval intact.
- Backup: `MyOwnProjects-remove-manager-join-email-notifications-20261019-212437.zip`

## 2026-10-19 21:20 - Add join-request email delivery fallback

- Added a safe PHP mail fallback when SMTP delivery for a join-request notification fails.
- Backup: `MyOwnProjects-add-join-email-delivery-fallback-now-20261019-212025.zip`

## 2026-10-19 21:16 - Hide empty join requests and retry mail

- Hide the join-requests block completely when no requests are pending.
- Track successful manager notification delivery, so an existing pending request without a sent email is retried on its next join attempt.
- Backup: `MyOwnProjects-hide-empty-requests-retry-manager-email-20261019-211633.zip`

## 2026-10-19 21:11 - Email manager on new join request

- Added an email notification for the group manager when a new join request is created.
- The email includes the applicant name, group name, and a secure direct link to the group members screen.
- Backup: `MyOwnProjects-email-manager-new-join-requests-now-20261019-211123.zip`

## 2026-10-19 21:05 - Fix SharedCart QR detection and gallery picker

- Removed the forced-camera attribute from the kitchen image picker so it opens the device gallery.
- Improved QR camera scanning with native BarcodeDetector when available and resilient jsQR fallback with inverted-code support.
- Backup: `MyOwnProjects-fix-qr-detection-and-gallery-picker-20261019-210559.zip`

## 2026-10-19 21:01 - Fix SharedCart camera capture and QR scanning

- Made the kitchen capture button retry camera startup before taking the photo.
- Added local `jsQR` decoding for camera QR scans, independent of browser BarcodeDetector support.
- Backup: `MyOwnProjects-fix-camera-capture-and-qr-scanner-20261019-210142.zip`

## 2026-10-19 21:00 - Enable SharedCart browser camera permission

- Changed the site Permissions Policy from blocking all camera access to allowing the site itself to request it.
- Added an explicit HTTPS message when a browser cannot legally show its camera permission prompt.
- Backup: `MyOwnProjects-enable-browser-camera-permission-now-20261019-210045.zip`

## 2026-10-19 20:53 - Move join requests and add QR join

- Moved group join approvals from group settings to the group-members screen.
- Added a mobile camera QR scanner for joining existing groups, with a paste-link fallback.
- Added pending join-request totals to the desktop admin dashboard overview.
- Backup: `MyOwnProjects-move-requests-add-qr-join-20261019-205316.zip`

## 2026-10-19 20:41 - Complete SharedCart secure sharing controls

- Added explicit kitchen-camera permission and capture flow, with a device-image fallback.
- Added mobile staple-item placement, staple help in the item menu, and creator-only staple deletion.
- Added a link-or-QR sharing dialog with a group-name invitation message and local QR renderer.
- Replaced short invite codes with 256-bit opaque, hashed, 24-hour links and added manager-approved join requests plus a waiting screen.
- Backup: `MyOwnProjects-add-qr-camera-staple-controls-20261019-204152.zip`

## 2026-10-19 20:04 - Add SharedCart fridge icon sprite symbol

- Added the missing Tabler fridge symbol to the local icon sprite and cache-versioned both kitchen icon references.
- Backup: `MyOwnProjects-add-fridge-symbol-tabler-sprite-20261019-200447.zip`

## 2026-10-19 20:01 - Add SharedCart kitchen fridge heading icon

- Added the existing Tabler fridge icon next to the kitchen-status heading and refreshed the stylesheet cache version.
- Backup: `MyOwnProjects-add-kitchen-fridge-heading-icon-now-20261019-200121.zip`

## 2026-10-19 19:58 - Remove SharedCart kitchen summary interface

- Removed the kitchen summary button, modal, JavaScript handlers, and related styling until an AI service is connected.
- Backup: `MyOwnProjects-remove-kitchen-summary-interface-now-20261019-195808.zip`

## 2026-10-19 19:49 - SharedCart kitchen status and staple items

- Added mobile-only kitchen-status areas with camera uploads, full-screen image viewing, 24-hour previous-image recovery, and area freshness states.
- Added staple items to the shared list with a pale-red highlight and automatic completion reset after 24 hours.
- Added a non-AI summary dialog that clearly states the smart summary requires an API connection.
- Backup: `MyOwnProjects-add-kitchen-status-and-staples-20261019-194951.zip`

## 2026-09-01 20:10 - Update shared project root instructions

- Updated `/home/n/AGENTS.md` to treat `/mnt/VMSHARE/projects/MyOwnProjects` as the fixed project root.
- Changed backup and history paths to use `/mnt/VMSHARE/projects/MyOwnProjects/_CODEX/`.
- Kept child-project selection only for tasks that do not already identify a child folder.
- Backup: `MyOwnProjects-update-project-root-in-docs-20260901-200236.zip`

## 2026-09-01 20:16 - StreamLocal deployed QA blocked by live access

- Project key: `p-9b67f541403bbb68`
- Target child project: `streamlocal`
- Run ID: `codex-streamlocal-qa-20260901T171653Z-240c0ec8`
- Tasks checked: 284, 283, 282, 281, 356, 355, 354, 353, 352, 351, 350, 349, 334, 333, 332, 331, 330, 329, 328, 327
- Outcome: all selected tasks were left `ready_for_qa` with blocked QA notes because both deployed task URLs refused connection from this environment.
- Evidence: `curl` probes to `http://127.0.0.1:17836/` and `http://10.219.146.2:17836/` failed with connection refused; the documented Supertasks preflight helper was not present at `/mnt/VMSHARE/projects/supertasks/_CODEX/scripts/supertasks_agent_preflight.php`.

## 2026-09-01 20:26 - StreamLocal deployed QA rerun blocked by live access

- Project key: `p-9b67f541403bbb68`
- Target child project: `streamlocal`
- Run ID: `codex-streamlocal-qa-20260901T172558Z-ec9889c8`
- Tasks checked: 284, 283, 282, 281, 356, 355, 354, 353, 352, 351, 350, 349, 334, 333, 332, 331, 330, 329, 328, 327
- Trace guard: `t3-hi-tv` matched task technical context and local `frontend/dist/index.html`.
- Outcome: all selected tasks were left `ready_for_qa` with fresh blocked QA notes because both deployed task URLs refused connection from this environment.
- Evidence: `curl` probes to `http://127.0.0.1:17836/` and `http://10.219.146.2:17836/` failed with connection refused; Playwright browser verification could not start because the `playwright` Node module was unavailable in the configured `NODE_PATH`.

## 2026-10-20 - Update SharedCart profile and list loading

- Replaced the profile navigation arrow with a Tabler chevron and added cache versions for the changed assets.
- Prevented stale item-list responses from replacing newer results with an empty list.
- Backup: `MyOwnProjects-change-profile-arrow-icon-now-20261020-120532.zip`

## 2026-10-20 - Fix SharedCart account state and profile icons

- Prevented profile responses from a previous account session from overriding the newly signed-in account.
- Cleared account identity details on logout, removed the profile icon background, and added a Tabler QR icon to sharing.
- Backup: `MyOwnProjects-fix-account-state-after-logout-now-20261020-123138.zip`

## 2026-10-20 - Simplify SharedCart home profile access

- Hid the header profile button on the home/groups screen so only the larger profile button remains.
- Removed the background from the home profile icon and updated cache versions.
- Backup: `MyOwnProjects-hide-header-profile-on-home-now-20261020-124015.zip`

## 2026-10-20 - Add SharedCart about dialog and server error logging

- Added the mobile-friendly "מי אנחנו" dialog on the sign-in screen.
- Added central logging for unexpected server responses and surfaced them in the admin system-error views.
- Backup: Git commit only, per the project backup policy.

## 2026-10-24 - Set Machberet Ptucha navigation header to white

- Set the shared navigation header background to white on every page.
- Set the shared page background to the home page green.
- Backup: Git commit only, per the project backup policy.

## 2026-10-24 - Improve Machberet Ptucha summary cards and filters

- Removed the purple file-type panel and organized each card around its title, subject, grade, and optional description.
- Added keyboard-accessible subject and grade filter links that show matching summaries.
- Backup: Git commit only, per the project backup policy.

## 2026-10-20 - Create MovieMeet

- Created a PHP + MySQL application for coordinating cinema meetups through secure event links.
- Added optional accounts, availability windows, genre preferences, cinema candidates, ranking, voting, TMDb lookup, and Google Maps travel-time support with a fallback estimate.
- Backup: Git commit only, per the project backup policy.

## 2026-10-20 - Refine MovieMeet design and session handling

- Matched the MovieMeet interface to SharedCart with the Heebo font, pastel blue palette, rounded cards, and consistent buttons.
- Added a secure `X-Auth-Token` fallback for PHP hosts that do not pass the standard Authorization header, preventing logged-in users from appearing logged out.
- Backup: Git commit only, per the project backup policy.

## 2026-10-20 - Polish MovieMeet wording and sign-in form

- Replaced all user-facing occurrences of "סוגות" with "סגנונות".
- Added clear spacing between the sign-in and registration buttons.
- Backup: Git commit only, per the project backup policy.

## 2026-10-20 - Add MovieMeet database setup script

- Added a phpMyAdmin-ready SQL setup file for the MovieMeet database, tables, and cinema seed data.
- Backup: Git commit only, per the project backup policy.

## 2026-10-20 - Add MovieMeet database error diagnostics

- Added safe, actionable API error codes for database configuration, connection, access, and missing-table failures.
- Backup: Git commit only, per the project backup policy.

## 2026-10-20 - Surface MovieMeet diagnostic codes

- Updated the client to show safe API diagnostic codes below registration and sign-in errors.
- Backup: Git commit only, per the project backup policy.

## 2026-10-20 - Support InfinityFree database configuration

- Replaced environment-variable configuration with a returned PHP configuration array because InfinityFree disables putenv().
- Backup: Git commit only, per the project backup policy.

## 2026-10-20 - Avoid MovieMeet browser request blocking

- Renamed API meeting actions to avoid browser content blockers and added a MovieMeet favicon.
- Backup: Git commit only, per the project backup policy.

## 2026-10-20 - Space MovieMeet account controls

- Added visual separation between the signed-in user name and logout button.
- Backup: Git commit only, per the project backup policy.

## 2026-10-20 - Move MovieMeet API actions to headers

- Removed API action names from request URLs to avoid browser content-blocker false positives.
- Backup: Git commit only, per the project backup policy.

## 2026-10-20 - Improve MovieMeet preference and cinema forms

- Added searchable city input, like/dislike genre buttons, 24-hour time selectors, and city-aware cinema suggestions.
- Removed the TMDb movie-search control and endpoint from the candidate flow.
- Backup: Git commit only, per the project backup policy.

## 2026-10-20 - Preserve MovieMeet windows and nearby cinema results

- Restored every saved availability window after a reload and added Bat Yam to cinema distance matching.
- Backup: Git commit only, per the project backup policy.

## 2026-10-20 - Allow MovieMeet organizers to delete screenings

- Added a confirmed delete action for screenings, limited and enforced server-side for the meeting organizer.
- Backup: Git commit only, per the project backup policy.

## 2026-10-20 - Redesign MovieMeet cinema flow

- Added personal meeting dashboard, mobile-friendly event tabs, cinema-search booking links, and plain-language recommendation explanations.
- Applied the Void/Night/Velvet cinema visual palette with a free Unsplash theater-seats background.
- Backup: Git commit only, per the project backup policy.

## 2026-10-20 - Convert MovieMeet to guest-first access

- Removed public registration, added private browser-held management and participant tokens, and promoted the first existing account to the sole administrator.
- Added an admin dashboard summary for meetings, participants, and screenings.
- Backup: Git commit only, per the project backup policy.

## 2026-10-20 - Refresh MovieMeet application cache

- Bumped the JavaScript asset version so browsers load the latest guest-first and dashboard interface after deployment.
- Backup: Git commit only, per the project backup policy.

## 2026-10-20 - Complete MovieMeet guest access and dashboard

- Removed remaining public account language and made the event flow explicitly guest-only.
- Restricted account login to the sole administrator and added a compact management dashboard with meeting, participant, and screening totals.
- Backup: Git commit only, per the project backup policy.

## 2026-10-20 - Clarify recommendations and protect participant responses

- Rewrote recommendation labels in plain language and removed the unnecessary guest-account message.
- Locked a participant name after the first response and added server-side unique-name protection per meeting.
- Backup: Git commit only, per the project backup policy.

## 2026-10-20 - Improve MovieMeet recommendation readability

- Replaced the crowded low-contrast recommendation tags with high-contrast labeled information cards that stack on phones.
- Backup: Git commit only, per the project backup policy.

## 2026-10-20 - Add MovieMeet poster lookup

- Removed light backgrounds from recommendation detail text and kept all detail content on the dark card surface.
- Added server-side TMDb movie-poster lookup and display for new and existing screening suggestions.
- Backup: Git commit only, per the project backup policy.

## 2026-10-20 - Remove MovieMeet API-key dependencies

- Removed the TMDb poster integration and its token requirement.
- Replaced Google Maps travel-time lookup with keyless OSRM road routing, retaining local distance estimation as an outage fallback.
- Backup: Git commit only, per the project backup policy.

## 2026-10-20 - Restore MovieMeet cinema selection responsiveness

- Kept cinema-list sorting local and immediate instead of making route requests before rendering the selector.
- Added a visible failure state when the cinema list cannot load.
- Backup: Git commit only, per the project backup policy.

## 2026-10-20 - Show available MovieMeet participants

- Added a compact avatar stack with participant initials and a clear available-friends count on each screening recommendation.
- Backup: Git commit only, per the project backup policy.

## 2026-10-21 - Prevent repeated MovieMeet preference entries

- Hide the preference form after a participant submits it and show a clear completion message instead.
- Persist the anonymous participant token in an HttpOnly cookie so clearing local browser storage does not create another entry on the same device.
- Backup: Git commit only, per the project backup policy.

## 2026-10-21 - Improve MovieMeet date and availability selection

- Open the native calendar picker when selecting meeting, screening, or availability dates.
- Make added availability windows choose a random unused date/time combination within the meeting range.
- Backup: Git commit only, per the project backup policy.

## 2026-10-21 - Stabilize MovieMeet cinema selection

- Include the filtered cinema list in the existing meeting response, removing the separate request that could leave the cinema selector empty after adding a screening.
- Backup: Git commit only, per the project backup policy.

## 2026-10-21 - Complete MovieMeet review fixes

- Made screening time use the device time picker and loaded cinema choices with the meeting data.
- Replaced availability avatars with a pulsing green availability indicator and count.
- Added per-screening creator ownership, creator-only secure link renewal, expiring share links, and a palette-matched favicon.
- Backup: Git commit only, per the project backup policy.

## 2026-10-21 - Polish MovieMeet visual hierarchy

- Added a cinema-ticket-style brand mark, a compact meeting progress indicator, and a highlighted leading recommendation card.
- Backup: Git commit only, per the project backup policy.

## 2026-10-21 - Make MovieMeet progress navigation interactive

- Replaced duplicate event navigation buttons with the progress steps themselves.
- Added keyboard navigation with right/left arrows, Home, and End.
- Backup: Git commit only, per the project backup policy.

## 2026-10-21 - Use 24-hour MovieMeet screening times

- Replaced the browser-native screening time control with fixed 24-hour choices from `00:00` through `23:45`.
- Backup: Git commit only, per the project backup policy.

## 2026-10-24 - Refine StreamLocal desktop playback and identity

- Added the packaged StreamLocal icon to the desktop application header with a hover animation.
- Preserved every movie and episode playback position every five seconds, on pause, and when the player closes; resumed playback now states its saved position.
- Improved desktop browsing: clickable media cards, series-only search results, a series card grid, stacked episode rows, palette-matched scrollbars, toast notifications, and red keyboard-focus treatment.
- Rebuilt the Windows unpacked application after TypeScript, unit-test, and production-build verification.
- Backup: Git commit only, per the project backup policy.

## 2026-10-24 - Improve StreamLocal media delivery

- Forwarded HTTP byte-range requests through the protected local-media protocol so video seeking can work correctly.
- Added automatic TMDb poster/backdrop retrieval using the user's encrypted key, along with poster rendering in desktop cards.
- Added automatic preferred Hebrew and English subtitle selection, cached locally per title, while retaining a compact manual alternative picker.
- Moved the close-player control away from the Windows window buttons and reduced system-notification duration to eight seconds.
- Backup: Git commit only, per the project backup policy.

## 2026-10-24 - Complete StreamLocal desktop visual delivery

- Added real-time UI refresh and toast confirmation when automatic TMDb artwork sync finishes.
- Added a horizontal TMDb backdrop to the home hero while retaining portrait artwork on movie and series cards.
- Rebuilt and verified the final unpacked Windows application; the release `app.asar` checksum matches the completed build output.
- Removed obsolete temporary Electron build outputs under `/tmp` after the build disk filled; no project source or active release was removed.
- Backup: Git commit only, per the project backup policy.

## 2026-10-24 - Start existing media sync on launch

- Start artwork and preferred-subtitle synchronization at application launch when encrypted keys already exist, so users do not need to re-enter keys or rescan their library.
- Re-ran TypeScript, unit, production-build, and Windows packaging checks; verified the copied release archive matches the build archive by SHA-256.
- Backup: Git commit only, per the project backup policy.

## 2026-10-24 - Polish StreamLocal player controls and poster diagnostics

- Replaced the text close-player action with an accessible circular × control away from the playback title.
- Added a manual poster-sync control and actionable no-result message for TMDb configuration or matching issues.
- Rebuilt and verified the Windows release archive against the copied application archive.
- Backup: Git commit only, per the project backup policy.

## 2026-10-24 - Remove TMDb requirement for StreamLocal artwork

- Replaced TMDb artwork lookup with public TVmaze series artwork and Wikipedia/Wikimedia movie poster lookup.
- Rebuilt, tested, packaged, and checksum-verified the updated Windows application.
- Backup: Git commit only, per the project backup policy.

## 2026-10-24 - Standardize Machberet Ptucha styling and Hebrew encoding

- Unified the page background and navigation-header color across the public site.
- Enforced the `utf8mb4` collation on the PHP/MySQL connection and clarified the one-time database encoding upgrade needed on existing installations.
- Backup: Git commit only, per the project backup policy.

## 2026-10-24 - Add summary viewing, downloads, and post-publication editing

- Split the public summary action into separate inline viewing and forced-download links.
- Added secure file-serving endpoints for published summaries and editable fields for already-published summaries in the admin panel, including optional file replacement.
- Backup: Git commit only, per the project backup policy.

## 2026-10-24 - Separate summary management and preview pages

- Moved published-summary management into a dedicated list and gave every summary its own edit page.
- Changed document viewing to a preview page, removed the redundant repository section from the home page, and retained a separate download action.
- Backup: Git commit only, per the project backup policy.

## 2026-10-26 - Separate new-request management

- Moved new summary requests from the main admin dashboard into a dedicated, authenticated management page.
- Backup: Git commit only, per the project backup policy.

## 2026-10-26 - Add presentation uploads

- Added PowerPoint `.ppt` and `.pptx` support for summary uploads, replacement uploads, downloads, and preview pages.
- Backup: Git commit only, per the project backup policy.

## 2026-10-26 - Repair embedded document previews

- Replaced the blocked Google embedded viewer with Microsoft Office embedding for Word documents and presentations.
- Added a dedicated inline file endpoint so PDF files and images preview directly in the site.
- Backup: Git commit only, per the project backup policy.

## 2026-10-26 - Add bulk summary deletion

- Added a confirmed admin action to delete every summary record and its uploaded file from the published-summary management page.
- Backup: Git commit only, per the project backup policy.

## 2026-10-27 - Start SharedCart public-release hardening

- Moved SharedCart authentication to the existing Secure, HttpOnly session cookie and removed login JWT delivery/storage in browser JavaScript.
- Added database groundwork for an optional group member limit and delegated group managers; invite joins now enforce the configured limit while preserving the simple share-link flow.
- The public onboarding, account/data controls, templates, and visible manager settings remain the next cohesive UI change.
- Backup: Git commit only, per the project backup policy.

## 2026-10-27 - Complete SharedCart public-release experience

- Added a concise public-facing welcome experience with an animated shared-list example, quick-start group templates, privacy policy, and terms of use.
- Added visible group-member limits and owner-managed delegated group managers while keeping invitation links one-step and familiar.
- Added self-service account deletion with an explicit warning, session invalidation, and protection against deleting the last administrator.
- Backup: Git commit only, per the project backup policy.

## 2026-10-28 - Make SharedCart quick starts create usable lists

- Replaced the compact onboarding example with a richer three-step shopping-list animation, including reduced-motion support.
- Changed each quick-start option to create its group and populate a matching ready-made list, with visible loading and error feedback on desktop and mobile.
- Updated asset cache versions so visitors receive the revised JavaScript and CSS.
- Backup: Git commit only, per the project backup policy.

## 2026-10-28 - Center SharedCart legal pages

- Centered the privacy-policy and terms-of-use content in a wider, readable card.
- Replaced the plain return link on both pages with a prominent, keyboard-accessible return button.
- Backup: Git commit only, per the project backup policy.

## 2026-10-28 - Add SharedCart privacy support contact

- Added the support email address to the privacy policy as a clickable mail link for account-deletion and privacy inquiries.
- Backup: Git commit only, per the project backup policy.

## 2026-10-30 - Add personal domain index page

- Added a responsive Hebrew RTL static landing page for h1la.com with a SharedCart project card and GitHub link.
- Added a resilient `logo.png` slot that shows a styled placeholder until the logo file is uploaded.
- Backup: Git commit only, per the project backup policy.
