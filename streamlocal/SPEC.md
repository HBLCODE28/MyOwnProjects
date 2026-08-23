# StreamLocal - Full Product and Technical Specification

Version: 1.0  
Target platform: Windows desktop  
Runtime model: Local web application running on localhost  
Primary language: English  
Primary user: Single local user  
Document purpose: Implementation specification for Codex or another coding agent

---

# 1. Product Summary

StreamLocal is a Windows-only local video library and playback application that runs in a desktop web browser through a local backend server.

The application should feel like a polished modern streaming service, but it must use an original visual identity rather than copying Netflix. It should provide a persistent local media library, automatic movie/TV identification, metadata fetching, watch-progress tracking, watched-state detection, subtitle support and automatic subtitle synchronization, season/episode organization, search, filtering, "Continue Watching", recently watched content, automatic next-episode playback, intro/recap skipping where available, timeline preview thumbnails, and a dedicated library-management interface.

The user should launch StreamLocal locally, browse to a localhost address such as:

http://localhost:4310

The application must work primarily from local files and a local database. Internet access may be used for metadata enrichment, but the core library and playback experience must continue to work offline after metadata has already been cached.

---

# 2. Core Product Principles

1. Local-first
   - Video files remain on the user's computer.
   - No cloud upload of the video library.
   - Metadata may be fetched from external APIs.
   - All persistent application state is stored locally.

2. Streaming-service UX
   - Fast visual browsing.
   - Horizontal rows of content.
   - Large hero area.
   - Continue Watching.
   - Recently Watched.
   - Movies and Series sections.
   - Season and episode browsing.
   - Full-featured custom player.
   - Original visual language, not a Netflix clone.

3. Reliable playback
   - MP4 playback must be efficient.
   - MKV playback must work even when the browser cannot decode the original container directly.
   - Multiple audio tracks must be supported.
   - External SRT subtitles must be supported.
   - Embedded subtitle tracks should be supported when practical.
   - Playback must support seeking without requiring the entire file to load.

4. Persistent user state
   - Watch progress.
   - Watched/unwatched state.
   - Favorites.
   - Watchlist.
   - Playback preferences.
   - Subtitle preferences.
   - Audio track preferences where appropriate.
   - Last played time.
   - History.

5. Automation
   - Automatically scan configured folders.
   - Automatically identify movies and episodes from filenames/folder structures.
   - Automatically fetch and cache metadata.
   - Automatically track playback completion.
   - Automatically mark content as watched.
   - Automatically select the next episode.
   - Automatically synchronize SRT subtitles when requested or configured.

---

# 3. Recommended Technology Stack

The implementation should use the following stack unless a specific technical blocker is discovered.

## 3.1 Frontend

- React
- TypeScript
- Vite
- React Router
- Zustand for client state
- TanStack Query for API data fetching and caching
- CSS Modules or Tailwind CSS
- HLS.js for HLS playback where native browser playback is unavailable
- A custom HTML5 video player UI built around the native `<video>` element

Reasoning:
- React and TypeScript are suitable for a large interactive single-page application.
- Vite provides a simple local development and build workflow.
- HLS.js allows the browser to play backend-generated HLS streams.
- A custom player allows StreamLocal to provide a streaming-service-like UI while still using standard browser media APIs.

## 3.2 Backend

Recommended:
- Python 3.12+
- FastAPI
- Uvicorn
- SQLAlchemy 2.x
- Alembic
- SQLite
- Pydantic
- watchdog for filesystem monitoring
- httpx for metadata API requests
- FFmpeg and FFprobe bundled or installed as an application dependency

Optional libraries:
- rapidfuzz for title matching
- guessit for movie/episode filename parsing
- Pillow for local image processing
- APScheduler for scheduled maintenance jobs
- ffsubsync or an equivalent subtitle synchronization implementation

Reasoning:
- Python provides strong filesystem, process, SQLite, FFmpeg orchestration, subtitle-processing, and metadata tooling.
- FastAPI produces a clear typed API that Codex can implement incrementally.
- SQLite is sufficient for a single-user local application.

## 3.3 Local Storage

Use:
- SQLite database for structured state.
- Filesystem cache directory for images, preview thumbnails, subtitle outputs, and temporary transcoding/remux outputs.

Recommended application data location:

%LOCALAPPDATA%\StreamLocal\

Example:

%LOCALAPPDATA%\StreamLocal\
    streamlocal.db
    config.json
    logs\
    cache\
        posters\
        backdrops\
        thumbnails\
        timeline\
        subtitles\
        streams\
    temp\

Do not store generated application data inside the user's media folders unless explicitly enabled.

---

# 4. Browser and Windows Scope

## 4.1 Supported OS

Initial release:
- Windows 10 64-bit
- Windows 11 64-bit

No requirement for:
- macOS
- Linux
- mobile devices
- tablets

## 4.2 Supported Browsers

Primary:
- Chromium-based browsers
- Microsoft Edge
- Google Chrome

Optional best effort:
- Firefox

Do not design around Safari.

## 4.3 Desktop-only Layout

Minimum target viewport:
- 1280x720

Recommended target:
- 1920x1080

The interface may remain usable at smaller desktop widths, but no mobile-specific interface is required.

---

# 5. Application Startup

The application should provide a Windows launcher.

Preferred behavior:

1. User launches StreamLocal.
2. Launcher checks whether the backend is already running.
3. If not running:
   - Start FastAPI/Uvicorn on a fixed or dynamically available local port.
4. Backend initializes database and migrations.
5. Backend verifies FFmpeg and FFprobe availability.
6. Backend starts filesystem watchers for configured media folders.
7. Browser opens automatically to StreamLocal.
8. Application loads the local library.

Recommended default URL:

http://127.0.0.1:4310

Bind to:
- 127.0.0.1 only by default.

Do not expose the backend to the LAN unless a future setting explicitly enables it.

---

# 6. Library Sources

The user must be able to configure one or more persistent media folders.

Examples:

D:\Movies
D:\TV
E:\Media

Each source should have:

- id
- path
- source type:
  - automatic
  - movies
  - tv
- enabled
- scan recursively
- created_at
- last_scan_at
- filesystem watcher enabled/disabled

The source type "automatic" should infer movie vs series from filenames and directory structure.

---

# 7. Media Scan Behavior

## 7.1 Initial Scan

On adding a library source:

1. Validate folder exists.
2. Recursively enumerate supported video files.
3. Supported extensions:
   - .mp4
   - .mkv
4. Run FFprobe on each file.
5. Parse filename and folder structure.
6. Determine likely content type.
7. Match against existing DB records using absolute file path and file identity.
8. Create or update media records.
9. Attempt metadata matching.
10. Extract technical metadata.
11. Detect external subtitle files.
12. Generate poster/backdrop cache as needed.
13. Generate timeline preview thumbnails in background.
14. Save scan status and errors.

## 7.2 Incremental Scanning

Use filesystem monitoring to detect:

- new files
- deleted files
- renamed files
- moved files
- modified files
- new subtitle files

The application should debounce filesystem events.

Recommended debounce:
- 2 to 5 seconds

## 7.3 Periodic Verification

Even with filesystem watchers, perform a verification scan:
- at startup
- manually via "Rescan"
- optionally once every 24 hours while the app is running

---

# 8. File Identity

Do not rely only on filename.

Each file record should store:

- absolute_path
- normalized_path
- file_size
- modified_time
- created_time when available
- optional lightweight fingerprint

Recommended lightweight fingerprint:
- file size
- modified time
- hash of the first 1 MB
- hash of the last 1 MB

Do not hash entire multi-gigabyte video files by default.

Purpose:
- detect renames/moves more reliably
- preserve watch history when a file is moved
- avoid duplicate imports

---

# 9. Movie and Episode Filename Parsing

Use a parsing library such as guessit plus custom rules.

Recognize patterns such as:

Movies:
- Movie.Name.2025.1080p.mkv
- Movie Name (2025).mp4
- Movie.Name.2025.WEB-DL.mkv

TV:
- Show.Name.S01E03.1080p.mkv
- Show Name - S02E07.mkv
- Show.Name.1x03.mp4

Extract where possible:
- title
- year
- season number
- episode number
- release group
- resolution
- source tags

Ignore common technical tokens:
- 720p
- 1080p
- 2160p
- WEB-DL
- WEBRip
- BluRay
- x264
- x265
- HEVC
- HDR
- DV
- AAC
- DTS
- Atmos

---

# 10. Metadata Matching

## 10.1 Metadata Provider

Recommended initial provider:
- TMDb API

Do not require actor/cast retrieval.

Required metadata:
- title
- original title where available
- content type
- year / release date
- overview
- genres
- poster
- backdrop
- series name
- season number
- episode number
- episode title
- season poster if available
- episode still image if available
- runtime
- external provider ID

Not required:
- actor list
- critic score
- user score from external services

## 10.2 API Key

TMDb API credentials must not be hard-coded in public source code.

Provide one of:
- local configuration field
- environment variable
- setup screen

Example:
TMDB_API_KEY

## 10.3 Matching Logic

Movie matching:
1. Parse title.
2. Parse year if available.
3. Search provider.
4. Rank results by:
   - normalized title similarity
   - exact year match
   - close year match
   - content type
5. Auto-accept only when confidence exceeds threshold.
6. Otherwise mark as "Needs Match".

Series episode matching:
1. Parse series name.
2. Parse season and episode.
3. Resolve series.
4. Fetch season/episode metadata.
5. Link file to episode.

## 10.4 Manual Matching

Library management must allow:
- search metadata provider manually
- select correct movie/show
- change content type
- edit season/episode number
- remove provider match
- use local-only metadata

---

# 11. Offline Metadata Behavior

Metadata must be cached locally.

After metadata is fetched, StreamLocal should remain usable without internet.

Cache:
- titles
- overview
- genres
- release dates
- provider IDs
- posters
- backdrops
- season artwork
- episode stills

If internet is unavailable:
- use cached metadata
- do not block playback
- show a non-intrusive offline status only where relevant

Never require internet for:
- scanning
- local browsing
- playback
- progress tracking
- subtitle playback
- library management

---

# 12. Watched-State Detection

The primary watched-state system must be based on StreamLocal playback tracking, not filesystem "last accessed" timestamps.

Reason:
Windows file access timestamps are not a reliable signal of whether a user watched a video. They may be disabled, delayed, changed by antivirus software, indexing, backup software, media scanners, or other applications.

## 12.1 Primary Rule

Track playback position continuously.

Store:
- current_position_seconds
- duration_seconds
- percentage_complete
- last_played_at
- play_count
- completed_at
- watched boolean

Recommended watched threshold:

Mark as watched if:
- playback reaches at least 90% of total duration

OR:
- remaining duration is <= 5 minutes for a movie

For TV episodes:
- playback reaches at least 90%
OR
- remaining duration is <= 2 minutes

Use configurable thresholds in backend constants/settings.

## 12.2 Watched Indicator

Watched content should display a clear checkmark icon in the card UI.

Requirements:
- visible but not visually dominant
- shown on movies and episodes
- optional tooltip: "Watched"
- should survive app restarts

## 12.3 External Watching Detection

Optional enhancement:
The application may use Windows filesystem metadata to make an initial guess that a file may have been accessed externally.

However:
- never automatically mark a file watched solely based on last-access time
- instead label it internally as possible_external_access
- optionally expose a "Mark watched based on file access history" import tool

A better future system could integrate with a supported external media player, but this is not required for v1.

---

# 13. Progress Tracking

During playback, update progress:
- every 5 seconds
- on pause
- on seek
- on visibility change
- before navigation
- on player close
- on backend shutdown where possible

Do not send an API write on every timeupdate event.

Suggested payload:

{
  "media_file_id": 123,
  "position_seconds": 1842.4,
  "duration_seconds": 5420.0,
  "completed": false
}

On reopening content:
- resume at saved position
- if position < 30 seconds, start from 0
- if already marked watched and progress is near the end, default to start from 0 when user explicitly clicks "Play Again"

---

# 14. Continue Watching

Display a "Continue Watching" row on Home.

Include items that:
- were started
- are not completed
- have useful saved progress

Exclude:
- progress < 30 seconds
- completed content

Each card should show:
- artwork
- title
- episode context if relevant
- progress bar
- remaining time or progress percentage
- quick play/resume action

Sort:
- most recently played first

---

# 15. Recently Watched

Display a "Recently Watched" row.

Include:
- recently completed items
- recently played items

Sort by:
last_played_at descending

The UI should distinguish:
- watched
- partially watched

---

# 16. Favorites and Watchlist

Support:
- Favorite toggle
- Watchlist toggle

These should be separate states.

Favorites:
- personal preference

Watchlist:
- content the user intends to watch

Provide dedicated filters/pages:
- Favorites
- Watchlist

---

# 17. Home Screen

The Home screen should feel cinematic and premium.

## 17.1 Hero

Large hero section containing:
- backdrop
- title
- short overview
- metadata line:
  - year
  - genre
  - runtime
- Play/Resume button
- optional Add to Watchlist button

Hero selection:
- prioritize incomplete recent content
- otherwise select a highlighted recent library item
- rotate only on full page refresh or controlled interval
- avoid aggressive auto-sliding

## 17.2 Content Rows

Recommended default rows:

1. Continue Watching
2. Recently Added
3. Movies
4. TV Series
5. Recently Watched
6. Watchlist
7. Favorites
8. Genres

Rows should be hidden if empty.

Cards:
- poster-based
- hover state
- title
- optional year
- progress
- watched check
- quick play
- quick favorite/watchlist actions

No dedicated full details page is required.

Instead, clicking a card should open:
- an expanded modal
or
- a side panel / large overlay

The overlay may show:
- backdrop
- title
- overview
- year
- genres
- play button
- season/episode controls for series
- favorite/watchlist controls

This preserves the user's requirement to avoid a separate details page while still providing needed information.

---

# 18. Movies Section

Provide:
- poster grid
- search
- sorting
- filtering

Sort options:
- title
- date added
- release year
- recently played
- watched status

Filters:
- genre
- watched
- unwatched
- in progress
- favorites
- watchlist
- year

---

# 19. TV Series Section

Series cards should represent the show, not individual episodes.

Clicking a show opens an overlay with:
- backdrop
- show title
- overview
- season selector
- episode list

Episode row:
- episode number
- episode title
- episode still
- runtime
- watched check
- progress bar
- play/resume button

No full-page details route is necessary.

---

# 20. Automatic Next Episode

When an episode finishes:

1. Determine next episode in season.
2. If no next episode:
   - check next season.
3. Display countdown overlay:
   - "Next episode in 10 seconds"
4. Allow:
   - Play Now
   - Cancel
5. Autoplay unless user cancelled.

Do not autoplay after a movie.

---

# 21. Skip Intro and Skip Recap

The user requested Netflix-like functionality.

There are three implementation levels.

## 21.1 V1 Required Manual Segment Support

Database must support episode segments:

- intro_start
- intro_end
- recap_start
- recap_end
- credits_start

Player should display:
- "Skip Intro"
- "Skip Recap"

when current position is inside configured segments.

Library management UI should allow manual segment configuration.

## 21.2 Optional Automatic Intro Detection

Automatic intro detection may be implemented as a later or experimental feature using:

- audio fingerprints across episodes
- repeated sequence detection
- waveform similarity
- chroma/fingerprint matching

This is computationally expensive and should not block v1.

## 21.3 Credits Detection

Optional:
Allow manually setting credits_start.

If credits_start exists:
- show Next Episode prompt at credits_start

---

# 22. Video Playback Architecture

Browser support for MKV is inconsistent. The application must not assume the browser can directly play arbitrary MKV files.

Use two playback paths.

## 22.1 Direct Playback Path

Use direct byte-range streaming when the browser can play the file/codec combination.

Typical:
- MP4
- H.264 video
- AAC audio

Endpoint example:

GET /api/playback/direct/{media_file_id}

Requirements:
- support HTTP Range requests
- Content-Range
- Accept-Ranges: bytes
- correct Content-Type
- efficient seeking

## 22.2 HLS Conversion Path

For unsupported containers/codecs:
- use FFmpeg
- create an HLS-compatible output

Preferred:
- fMP4 HLS where practical

Pipeline should first attempt remuxing without video re-encoding.

Example conceptual mode:
- copy video stream when browser supports codec
- transcode incompatible audio if necessary
- preserve selectable audio tracks where practical

If video codec is browser-incompatible:
- transcode video to H.264 for compatibility

Avoid unnecessary transcoding.

## 22.3 Playback Capability Probe

Before playback:
- inspect streams using FFprobe
- determine:
  - container
  - video codec
  - audio codecs
  - subtitle tracks

Backend returns playback strategy.

Example:

{
  "mode": "direct",
  "url": "/api/playback/direct/123"
}

or:

{
  "mode": "hls",
  "url": "/api/playback/hls/123/master.m3u8"
}

---

# 23. Transcoding and Remuxing

FFmpeg worker requirements:

- one job per active playback session
- cancellation when playback ends
- cleanup stale output
- cache reusable generated stream data where safe
- limit CPU usage when possible
- expose error state to frontend

Priority:
1. direct stream
2. remux
3. audio-only transcode
4. full video transcode

Do not full-transcode if browser-compatible video can be copied.

Recommended H.264 fallback:
- libx264
- preset veryfast or faster
- CRF configurable, default around 20-23

Audio fallback:
- AAC

---

# 24. Multi-Audio Support

The player must support multiple audio tracks.

Backend should expose:

- stream index
- language
- title
- codec
- channels
- default flag

Example:

[
  {
    "id": "audio:1",
    "language": "eng",
    "title": "English",
    "codec": "aac"
  },
  {
    "id": "audio:2",
    "language": "heb",
    "title": "Hebrew",
    "codec": "ac3"
  }
]

The player must provide an Audio menu.

Preferences:
- remember globally selected preferred language
- optionally remember per-series selection

Because browser APIs do not consistently expose alternate audio tracks from arbitrary local files, the backend may need to generate an HLS master playlist with alternate audio renditions.

---

# 25. Subtitle Support

## 25.1 External SRT

Detect subtitle files near the video.

Common patterns:

Movie.mkv
Movie.srt
Movie.en.srt
Movie.eng.srt
Movie.he.srt

Episode.S01E02.mkv
Episode.S01E02.en.srt

Store:
- path
- language
- label
- source type
- synchronized version path if generated

## 25.2 SRT Conversion

Browsers work best with WebVTT.

Backend should:
- parse SRT
- convert to VTT on demand
- expose VTT endpoint

Do not alter original SRT.

## 25.3 Embedded Subtitles

Where possible:
- identify embedded text subtitle streams using FFprobe
- extract supported text streams through FFmpeg
- convert to WebVTT

Image-based subtitle formats such as PGS are optional for v1.

If unsupported:
- display track as unsupported or hide it
- do not crash playback

---

# 26. Automatic Subtitle Synchronization

The application must support automatic synchronization of external SRT subtitles.

## 26.1 User Experience

Subtitle menu should provide:
- Off
- subtitle track list
- "Auto Sync"
- manual offset controls

Manual controls:
- -0.5 sec
- +0.5 sec
- reset

Optional fine controls:
- -0.1 sec
- +0.1 sec

## 26.2 Auto-Sync Strategy

Recommended first implementation:
Use an audio-based synchronization engine such as ffsubsync or equivalent.

Workflow:
1. User selects an SRT track.
2. User clicks "Auto Sync".
3. Backend extracts audio reference if needed.
4. Synchronization engine estimates subtitle offset and/or timing correction.
5. Generate a synchronized copy in application cache.
6. Preserve original SRT unchanged.
7. Save synchronization result to DB.
8. Player reloads the corrected VTT.
9. Display result:
   - synchronized successfully
   - detected offset
   - confidence if available

## 26.3 Synchronization Data

Store:
- subtitle_track_id
- source checksum
- target video fingerprint
- offset_ms
- algorithm
- confidence
- synchronized_file_path
- created_at

If the source subtitle changes:
- invalidate synchronized cache

## 26.4 Failure Handling

If auto-sync fails:
- keep original subtitle available
- show manual offset controls
- log technical details

---

# 27. Player UI

The player must use a custom visual interface.

Required controls:
- Play/Pause
- seek timeline
- current time
- duration
- volume
- mute
- fullscreen
- playback speed
- subtitle selection
- subtitle sync controls
- audio track selection
- previous episode
- next episode
- skip intro
- skip recap
- back to library

Picture-in-Picture is not required.

## 27.1 Control Visibility

- controls visible on mouse movement
- auto-hide after about 2.5 to 3 seconds while playing
- remain visible while paused
- remain visible while menus are open

## 27.2 Double Click

Double-click:
- toggle fullscreen

## 27.3 Click Behavior

Single click on video:
- Play/Pause

Optional:
Double click left/right regions:
- seek backward/forward

---

# 28. Keyboard Shortcuts

Required:

- Space: Play/Pause
- K: Play/Pause
- Left Arrow: seek backward 10 seconds
- Right Arrow: seek forward 10 seconds
- J: seek backward 10 seconds
- L: seek forward 10 seconds
- Up Arrow: volume +5%
- Down Arrow: volume -5%
- M: mute/unmute
- F: fullscreen
- Esc: exit fullscreen / close overlay where appropriate
- C: toggle subtitles
- N: next episode when applicable

Optional:
- Shift+Left: -30 seconds
- Shift+Right: +30 seconds
- < and >: playback speed down/up

Do not trigger shortcuts while the user is typing in a text field.

---

# 29. Playback Speed

Provide:
- 0.5x
- 0.75x
- 1.0x
- 1.25x
- 1.5x
- 1.75x
- 2.0x

Remember last selected speed globally.

---

# 30. Timeline Preview Thumbnails

Implement if technically feasible, and treat it as a required target feature unless performance makes it impractical.

## 30.1 Generation

Use FFmpeg to create preview thumbnails at intervals.

Recommended:
- one frame every 10 seconds for short content
- every 20 seconds for long movies

Generate:
- individual WebP/JPEG thumbnails
or
- sprite sheets plus metadata

Preferred:
sprite sheets for fewer HTTP requests.

Store under:
cache\timeline\{media_file_id}\

## 30.2 Player Behavior

When hovering over timeline:
- show thumbnail
- show timestamp
- clamp preview box to viewport
- update efficiently

Do not generate thumbnails synchronously when user starts playback if avoidable.

Generate in scan/background processing.

---

# 31. Search

Global search field in top navigation.

Search:
- movie titles
- series titles
- episode titles
- genres
- years

Behavior:
- debounce 150-250 ms
- search local DB
- no internet required

Provide keyboard shortcut:
- Ctrl+K or /

Search results should show:
- poster
- title
- content type
- year
- episode context
- watched state

---

# 32. Filters

Provide filters for:
- Movies
- Series
- Genre
- Year
- Watched
- Unwatched
- In Progress
- Favorites
- Watchlist
- Recently Added

Sorting:
- Title A-Z
- Title Z-A
- Recently Added
- Recently Played
- Release Date
- Watched Status

---

# 33. Library Management Screen

A dedicated management screen is required.

Sections:

## 33.1 Sources

- Add folder
- Remove folder from library
- Enable/disable source
- Rescan
- display scan status
- last scan time
- number of files

Removing a source should not delete user video files.

Ask whether to:
- keep cached DB records
- remove records from library

## 33.2 Media Items

Table/grid with:
- title
- type
- file path
- metadata status
- watched status
- subtitle count
- duration
- resolution
- codec
- actions

Actions:
- Edit
- Rematch Metadata
- Change Poster
- Change Backdrop
- Edit Overview
- Change Title
- Change Year
- Set Movie/Series
- Set Season/Episode
- Mark Watched
- Mark Unwatched
- Regenerate Timeline Preview
- Re-scan Technical Metadata
- Open Folder in Explorer
- Remove from Library

Never delete source video files unless a future explicitly separated "Delete File" feature is added.

## 33.3 Metadata Editor

Editable fields:
- display title
- original title
- year
- overview
- genres
- poster
- backdrop
- provider match
- series
- season
- episode
- episode title

---

# 34. Poster and Artwork Management

Allow:
- provider artwork
- local uploaded image
- generated fallback artwork

Cache artwork locally.

Recommended poster ratio:
- 2:3

Backdrop ratio:
- approximately 16:9

If no poster exists:
- generate a visually consistent placeholder using title text
- do not use broken image placeholders

---

# 35. Visual Design

Product name:
StreamLocal

The design must be original but should communicate a premium local streaming product.

## 35.1 Style

Recommended visual direction:
- dark graphite background
- slightly warmer/lighter content panels
- restrained accent color
- large cinematic imagery
- strong typography
- rounded but not excessively soft cards
- subtle gradients
- subtle depth/shadow
- minimal borders
- smooth hover scaling
- no imitation of Netflix logos, typography, colors, or exact layout

## 35.2 Navigation

Top navigation:
- StreamLocal logo/wordmark
- Home
- Movies
- Series
- Watchlist
- Library
- Search

Right side:
- search button/field
- settings

No profile selector is needed.

## 35.3 Motion

Use subtle transitions:
- 150-250 ms
- card hover
- overlay open/close
- controls
- progress indicators

Avoid:
- excessive parallax
- autoplaying decorative video backgrounds by default
- flashy animations

---

# 36. No Dedicated Details Page

A dedicated route such as `/movie/123` or `/series/456` should not be required for the visible UX.

Instead use:
- modal
- drawer
- large overlay

However, internal routes may still represent selected media for deep linking if useful.

Example:
`/?media=123`

The user should experience the selection as an overlay, not a separate details page.

---

# 37. Database Schema

The exact schema may evolve, but the following entities are required.

## 37.1 library_sources

Fields:
- id
- path
- normalized_path
- source_type
- enabled
- recursive
- created_at
- updated_at
- last_scan_at

## 37.2 media_items

Represents movie, series, season, or episode logical metadata.

Fields:
- id
- media_type
  - movie
  - series
  - season
  - episode
- parent_id nullable
- title
- original_title nullable
- sort_title nullable
- year nullable
- overview nullable
- runtime_seconds nullable
- season_number nullable
- episode_number nullable
- provider
- provider_id nullable
- poster_path nullable
- backdrop_path nullable
- still_path nullable
- date_added
- metadata_updated_at
- metadata_locked boolean

## 37.3 genres

- id
- name

## 37.4 media_genres

- media_item_id
- genre_id

## 37.5 media_files

Fields:
- id
- media_item_id
- library_source_id
- absolute_path
- normalized_path
- file_size
- modified_at_fs
- created_at_fs
- fingerprint
- container
- duration_seconds
- width
- height
- video_codec
- frame_rate
- bitrate
- ffprobe_json optional
- online boolean
- last_seen_at

## 37.6 audio_tracks

- id
- media_file_id
- stream_index
- language
- title
- codec
- channels
- is_default

## 37.7 subtitle_tracks

- id
- media_file_id
- stream_index nullable
- external_path nullable
- source_type
  - external
  - embedded
- language
- title
- format
- is_default
- checksum
- cached_vtt_path nullable

## 37.8 subtitle_sync

- id
- subtitle_track_id
- media_file_id
- offset_ms
- confidence nullable
- algorithm
- synchronized_path
- source_checksum
- created_at

## 37.9 playback_state

Single-user state.

- media_item_id
- media_file_id
- position_seconds
- duration_seconds
- percent_complete
- watched
- play_count
- first_played_at
- last_played_at
- completed_at nullable

## 37.10 user_flags

- media_item_id
- favorite
- watchlist
- updated_at

## 37.11 playback_preferences

Global:
- volume
- muted
- playback_rate
- preferred_audio_language
- preferred_subtitle_language
- subtitles_enabled

## 37.12 media_segments

- id
- media_item_id
- segment_type
  - intro
  - recap
  - credits
- start_seconds
- end_seconds nullable
- source
  - manual
  - detected
- confidence nullable

## 37.13 scan_jobs

- id
- source_id nullable
- started_at
- finished_at nullable
- status
- files_scanned
- files_added
- files_updated
- errors_count
- error_message nullable

---

# 38. API Design

Use versioned local API.

Base:
`/api/v1`

## 38.1 Health

GET /api/v1/health

Returns backend, DB and FFmpeg status.

## 38.2 Library Sources

GET /api/v1/library/sources  
POST /api/v1/library/sources  
PATCH /api/v1/library/sources/{id}  
DELETE /api/v1/library/sources/{id}  
POST /api/v1/library/sources/{id}/scan

## 38.3 Media

GET /api/v1/media  
GET /api/v1/media/{id}  
PATCH /api/v1/media/{id}  
DELETE /api/v1/media/{id}/library-record

Query parameters:
- type
- genre
- year
- watched
- favorite
- watchlist
- search
- sort
- page
- page_size

## 38.4 Home

GET /api/v1/home

Return pre-composed sections:
- hero
- continue_watching
- recently_added
- movies
- series
- recently_watched
- favorites
- watchlist

## 38.5 Series

GET /api/v1/series/{id}/seasons  
GET /api/v1/series/{id}/episodes  
GET /api/v1/series/{id}/next-episode

## 38.6 Playback

GET /api/v1/playback/{media_file_id}/info  
GET /api/v1/playback/{media_file_id}/direct  
POST /api/v1/playback/{media_file_id}/session  
DELETE /api/v1/playback/sessions/{session_id}

HLS:
GET /api/v1/playback/sessions/{session_id}/master.m3u8
GET /api/v1/playback/sessions/{session_id}/...

## 38.7 Progress

GET /api/v1/progress/{media_item_id}  
PUT /api/v1/progress/{media_item_id}  
POST /api/v1/progress/{media_item_id}/mark-watched  
POST /api/v1/progress/{media_item_id}/mark-unwatched

## 38.8 Favorites/Watchlist

PUT /api/v1/media/{id}/favorite  
PUT /api/v1/media/{id}/watchlist

## 38.9 Subtitles

GET /api/v1/media-files/{id}/subtitles  
GET /api/v1/subtitles/{id}/vtt  
POST /api/v1/subtitles/{id}/sync  
PATCH /api/v1/subtitles/{id}/offset

## 38.10 Metadata

POST /api/v1/media/{id}/metadata/search  
POST /api/v1/media/{id}/metadata/match  
POST /api/v1/media/{id}/metadata/refresh

## 38.11 Timeline Preview

GET /api/v1/media-files/{id}/timeline
POST /api/v1/media-files/{id}/timeline/generate

---

# 39. Streaming Security

Although this is a local application:

- bind server to 127.0.0.1 by default
- reject arbitrary file paths from browser requests
- all playback endpoints must accept database IDs, not raw filesystem paths
- validate source folders
- prevent `../` traversal
- never execute metadata strings as commands
- pass FFmpeg arguments as an argument array, never shell-concatenated strings
- sanitize filenames used for generated cache files
- restrict CORS to the application origin

---

# 40. FFmpeg Process Safety

When spawning FFmpeg:

- use subprocess argument lists
- no shell=True
- capture stderr
- apply timeouts where appropriate
- terminate child process when playback session ends
- kill orphan processes on backend shutdown
- clean stale stream output periodically

Store FFmpeg errors in logs.

---

# 41. Logging

Use rotating log files.

Directory:
`%LOCALAPPDATA%\StreamLocal\logs`

Log categories:
- startup
- scanning
- metadata
- playback
- ffmpeg
- subtitles
- database
- errors

Never log:
- API secrets
- full external API authorization tokens

Local paths may be logged because the app is local, but error UI should avoid unnecessarily exposing long paths unless requested.

---

# 42. Settings

Required settings screen.

Sections:

## Library
- configured folders
- rescan

## Playback
- default subtitle language
- default audio language
- autoplay next episode
- watched threshold
- seek interval
- default playback speed

## Subtitles
- auto-enable subtitles
- auto-sync behavior:
  - manual only
  - ask
  - automatic on first use
- default language
- offset reset

## Metadata
- TMDb API key/status
- refresh metadata
- image quality

## Storage
- cache size
- clear timeline cache
- clear stream cache
- clear artwork cache
- show database location

## Advanced
- backend port
- FFmpeg path
- open logs
- developer mode

---

# 43. Background Jobs

Background jobs should include:

- library scanning
- metadata fetching
- artwork downloading
- timeline thumbnail generation
- subtitle synchronization
- cleanup of stale transcode sessions

Use an internal worker queue.

For v1, this may be:
- asyncio task queue
or
- ThreadPoolExecutor / ProcessPoolExecutor for CPU/process tasks

Do not require Redis or an external queue.

---

# 44. Scan Performance

Do not run FFprobe on unchanged files during every scan.

If:
- path/fingerprint unchanged
- file size unchanged
- modification timestamp unchanged

then skip full technical scan.

Metadata refresh should be separate from filesystem scanning.

---

# 45. UI Loading States

Required:
- skeleton cards for initial loading
- scan progress indicator
- metadata match status
- timeline generation status
- subtitle sync status
- playback preparing state for MKV/transcoding

Do not show blank pages while backend is preparing playback.

For example:
"Preparing video..."
with a non-blocking progress state.

---

# 46. Error Handling

Player errors should be actionable.

Examples:

Unsupported codec:
"StreamLocal could not prepare this video for playback."

Missing file:
"This file is no longer available at its saved location."

FFmpeg unavailable:
"FFmpeg is required to play this media format."

Subtitle sync failed:
"Automatic subtitle synchronization failed. The original subtitle is still available."

Metadata failure:
"Metadata could not be refreshed. Cached information will continue to be used."

Provide a "Technical details" expansion for developer diagnostics.

---

# 47. Missing and Moved Files

If a scanned file disappears:

Do not immediately delete history.

Set:
- online = false

UI:
- show "File unavailable"

If a matching fingerprint appears in another configured folder:
- update path
- preserve media item
- preserve playback state

Allow manual:
- Locate File

---

# 48. Duplicate Files

If multiple files match one logical movie/episode:

Store all files.

Optional UI:
- choose version
- show resolution
- show codec

Default selection ranking:
1. available
2. preferred resolution
3. compatible direct-play version
4. highest quality

Do not collapse duplicate physical files into one database row.

---

# 49. Watched Checkmark Rules

Movie card:
- display check when watched=true

Series card:
Recommended status:
- full check only when all known episodes are watched
- partial indicator when some episodes are watched
- no indicator when none are watched

Season:
- watched if all available episodes watched

Episode:
- watched when episode playback_state.watched=true

---

# 50. Progress Reset Rules

If user marks content unwatched:
- set watched=false
- optionally preserve progress only if user explicitly chooses

Default:
- mark unwatched
- reset progress to 0

If user manually seeks to end:
- threshold logic may mark watched

If user skips credits via next episode:
- if position passed credits_start, mark episode watched

---

# 51. Metadata Refresh Rules

Automatically refresh cached metadata:
- manually
- when first matched
- optional after 30 days

Do not overwrite manually edited fields if metadata_locked=true.

Allow per-field locks later if needed.

---

# 52. Artwork Cache

Artwork should be downloaded once and served locally.

Use filenames based on:
- provider
- provider ID
- image version/path hash

Do not repeatedly hotlink remote artwork.

---

# 53. Local Network and Privacy

Default:
- localhost only

The application must not:
- upload video files
- upload subtitle files except if a future explicitly enabled synchronization service requires it
- expose media file paths to external metadata providers

Metadata queries may include:
- parsed movie/show title
- year
- season/episode

---

# 54. Setup Experience

First launch should open a short setup workflow.

Step 1:
Welcome to StreamLocal

Step 2:
Select Media Folders

Step 3:
Metadata
- enter TMDb API key
- allow skip

Step 4:
Scan Library

Step 5:
Open Home

No account creation.
No email.
No username.
No password.
No profile screen.

---

# 55. Main Routes

Recommended:

- `/` Home
- `/movies`
- `/series`
- `/watchlist`
- `/favorites`
- `/library`
- `/settings`
- `/player/:mediaItemId`

Player may use a separate route because fullscreen playback is functionally separate from a details page.

Media details remain overlays.

---

# 56. Frontend Component Structure

Suggested:

src/
  app/
  routes/
  components/
    layout/
    navigation/
    cards/
    rows/
    hero/
    overlays/
    player/
    subtitles/
    library/
    search/
    settings/
  features/
    home/
    media/
    playback/
    progress/
    metadata/
    library/
    subtitles/
  hooks/
  stores/
  api/
  types/
  utils/
  styles/

Important player components:
- VideoPlayer
- PlayerControls
- Timeline
- TimelinePreview
- VolumeControl
- SubtitleMenu
- AudioMenu
- PlaybackSpeedMenu
- SkipSegmentButton
- NextEpisodeOverlay
- PlayerErrorOverlay

---

# 57. Backend Structure

Suggested:

backend/
  app/
    main.py
    config.py
    database.py
    models/
    schemas/
    api/
      v1/
    services/
      library_scanner.py
      filename_parser.py
      metadata_service.py
      artwork_service.py
      ffprobe_service.py
      playback_service.py
      hls_service.py
      subtitle_service.py
      subtitle_sync_service.py
      timeline_service.py
      progress_service.py
      fingerprint_service.py
    workers/
    utils/
    logging/
  migrations/
  tests/

Keep FFmpeg logic out of API route handlers.

---

# 58. Configuration

Recommended config file:

`%LOCALAPPDATA%\StreamLocal\config.json`

Example conceptual structure:

{
  "server": {
    "host": "127.0.0.1",
    "port": 4310
  },
  "ffmpeg": {
    "path": "..."
  },
  "metadata": {
    "tmdb_api_key": "..."
  },
  "playback": {
    "autoplay_next_episode": true,
    "movie_watched_percent": 0.90,
    "episode_watched_percent": 0.90,
    "seek_seconds": 10
  },
  "subtitles": {
    "default_language": "eng",
    "auto_sync_mode": "ask"
  }
}

Secrets should preferably be stored using Windows Credential Manager or environment configuration if practical.

---

# 59. Metadata Without API Key

If no metadata API is configured:

StreamLocal must still work.

Use:
- parsed filename title
- folder-derived series name
- technical metadata
- generated placeholder artwork

Metadata features should degrade gracefully.

---

# 60. Playback Session Model

When player opens:

1. GET playback info.
2. Backend determines direct/HLS mode.
3. If HLS required:
   - create playback session.
4. Frontend initializes HLS.js.
5. Playback begins when manifest ready.
6. Frontend posts progress.
7. On close:
   - finalize progress.
   - close session.
8. Backend terminates unused FFmpeg process.

Session fields:
- session_id
- media_file_id
- created_at
- last_access_at
- status
- process_id
- output_path

---

# 61. HLS Session Cleanup

Cleanup sessions:
- inactive > 10 minutes
- backend restart
- explicit DELETE session

Never delete active generated segments.

Use an in-memory registry plus filesystem verification.

---

# 62. Direct MP4 Streaming

Implement robust HTTP range support.

Required behavior:
- `Range: bytes=start-end`
- respond 206 Partial Content
- correct Content-Length
- correct Content-Range
- correct MIME type
- efficient file seek

Do not load the entire file into memory.

Stream chunks from disk.

---

# 63. Subtitle Rendering

Preferred:
- browser native text tracks for basic VTT
or
- custom overlay rendering if more styling/control is required

For v1, browser VTT track support is sufficient if:
- subtitle language switching works
- font size can be controlled
- background opacity can be controlled
- subtitle offset is supported by corrected VTT generation or custom timing

If implementing custom subtitles:
- parse VTT cues
- render active cues synchronized to video.currentTime

---

# 64. Subtitle Style Settings

Recommended optional settings:
- font size
- text color
- background opacity
- vertical position

Keep default readable and high contrast.

---

# 65. Automatic Subtitle Selection

When opening media:

1. Look for remembered selection for the media/series.
2. Else preferred subtitle language.
3. Else default subtitle track.
4. Else subtitles off.

If subtitles were manually disabled for the previous episode in a series:
- preserve preference if reasonable.

---

# 66. Audio Selection

Selection order:
1. remembered per-series language
2. global preferred audio language
3. default audio track
4. first track

---

# 67. Series Organization

Logical hierarchy:

Series
  Season
    Episode
      Media File(s)

Do not rely solely on physical directory structure after import.

A file can be logically reassigned in Library Management.

---

# 68. Recent Additions

`date_added` should represent when StreamLocal first imported the file, not filesystem modified date.

Recently Added row:
- newest imported logical items first

For episodes:
- avoid flooding the row with every episode from a newly imported season
- optionally group by series

V1 acceptable:
- show recent episodes individually or show series updated state

Preferred:
- series card with "New episodes added" badge.

---

# 69. Home Hero Selection Algorithm

Suggested ranking:
1. most recently played incomplete item
2. newest unwatched movie
3. series with newly added unwatched episodes
4. random recent library item

Avoid selecting:
- unavailable files
- unmatched broken items
- content with no playable file

---

# 70. Search Indexing

SQLite search can start with LIKE queries.

If library becomes large:
- use SQLite FTS5

Recommended:
Create FTS index for:
- title
- original title
- overview
- genre names
- series name
- episode title

---

# 71. Performance Goals

Target library size:
- at least 10,000 media files without severe UI degradation

UI:
- virtualize large grids where needed
- paginate backend results
- lazy-load images

Initial Home response target:
- under 500 ms from warm local DB

Search:
- under 200 ms for typical local library

Playback:
- direct MP4 should start quickly
- MKV HLS startup should minimize transcoding delay

---

# 72. Image Optimization

Serve cached images at multiple sizes if useful:
- card
- hero
- thumbnail

Use:
- WebP where supported

Lazy-load off-screen posters.

---

# 73. Accessibility

Minimum:
- keyboard navigation
- visible focus states
- proper buttons
- ARIA labels for icon-only controls
- adequate contrast
- fullscreen controls keyboard accessible
- no hover-only critical actions

---

# 74. Empty States

Examples:

No library:
"Add a media folder to start building your StreamLocal library."

No search results:
"No local titles match your search."

No Continue Watching:
"Start a movie or episode and it will appear here."

---

# 75. Database Backup

Provide:
- automatic lightweight DB backup before migrations
- manual "Backup StreamLocal Data"

Backup should include:
- database
- config without unsafe secret exposure
- user-managed custom metadata
- subtitle sync data

Artwork cache does not need to be included.

---

# 76. Migration Strategy

Use Alembic.

On startup:
1. detect schema version
2. backup DB if migration required
3. apply migrations
4. start app

If migration fails:
- do not continue with partial schema
- show recoverable error

---

# 77. Testing Strategy

## 77.1 Backend Unit Tests

Test:
- filename parsing
- watched threshold
- progress updates
- fingerprinting
- metadata matching score
- SRT conversion
- subtitle offset logic
- direct Range parsing
- series next-episode logic

## 77.2 API Tests

Test:
- media filters
- progress persistence
- watched/unwatched actions
- source scanning
- metadata matching
- subtitle endpoints
- playback session lifecycle

## 77.3 Frontend Tests

Test:
- Continue Watching
- watched check rendering
- card overlay
- keyboard shortcuts
- player controls
- search
- filters
- subtitle/audio menus

## 77.4 End-to-End Tests

Use Playwright.

Required flows:
1. Add library source.
2. Scan media.
3. Open movie.
4. Resume progress.
5. Complete movie and verify watched check.
6. Open series.
7. Play episode.
8. Autoplay next episode.
9. Select subtitle.
10. Auto-sync subtitle.
11. Search title.
12. Mark favorite/watchlist.

---

# 78. Sample Test Media Matrix

Test at minimum:

1. MP4 / H.264 / AAC
2. MP4 / H.265 where browser may not support it
3. MKV / H.264 / AAC
4. MKV / H.264 / AC3
5. MKV / H.265 / AC3
6. MKV with two audio tracks
7. MP4 with external SRT
8. MKV with external SRT
9. MKV with embedded text subtitles
10. movie > 2 hours
11. short TV episode
12. unicode filename
13. long Windows path
14. file renamed after import
15. file moved after import

---

# 79. Windows-Specific File Handling

Support:
- drive letters
- spaces
- non-ASCII paths
- long paths where possible
- network paths may be future/best effort

Normalize paths carefully.

Do not lowercase paths destructively for display.

Use Windows-safe cache filenames.

---

# 80. Manual Watched Controls

Card context menu:
- Mark as Watched
- Mark as Unwatched

Series overlay:
- Mark Season Watched
- Mark Season Unwatched
- optionally Mark Series Watched

These actions should update episode-level state.

---

# 81. Context Menus

Recommended card context menu:
- Play
- Resume
- Add/Remove Watchlist
- Add/Remove Favorite
- Mark Watched/Unwatched
- Open File Location
- Edit Metadata

---

# 82. Player Exit Behavior

When leaving player:
- save position
- stop HLS session
- return to previous browse position
- restore scroll position

If user returns to Home:
- Continue Watching row should update immediately.

---

# 83. Navigation State

Remember:
- scroll position per main section
- active filters during current session

Do not necessarily persist filters across full app restarts.

---

# 84. No External Authentication

There is exactly one local user.

Do not implement:
- login
- username
- email
- password
- sessions for user authentication
- profile avatars

Playback session IDs are technical session identifiers only.

---

# 85. Optional Local Rating

Personal rating is not required.

Database may leave room for:
- personal_rating nullable

Do not prioritize its UI in v1.

---

# 86. Feature Priority

## P0 - Required Core

- Windows localhost app
- persistent library
- MP4 support
- MKV support via playback conversion strategy
- Movies and Series
- automatic scanning
- local SQLite DB
- metadata matching
- cached posters/backdrops
- Home rows
- custom player
- playback progress
- watched state and checkmark
- Continue Watching
- Recently Watched
- search
- filters
- favorites
- watchlist
- seasons/episodes
- automatic next episode
- SRT support
- subtitle selection
- subtitle manual offset
- multi-audio
- keyboard shortcuts
- library management

## P1 - Strongly Required

- automatic subtitle synchronization
- timeline preview thumbnails
- external/embedded text subtitle extraction
- metadata editor
- manual intro/recap segments
- skip buttons
- offline metadata behavior
- moved-file detection
- direct-play/remux/transcode optimization

## P2 - Advanced

- automatic intro detection
- automatic recap detection
- sophisticated duplicate version selection
- advanced external-watch inference
- FTS search if basic search is insufficient

---

# 87. Implementation Milestones

## Milestone 1 - Foundation

- backend
- frontend
- SQLite
- migrations
- settings
- launcher
- health API

Acceptance:
App launches on Windows and loads browser UI from localhost.

## Milestone 2 - Library Scanner

- source management
- recursive MP4/MKV discovery
- FFprobe
- filename parsing
- database import
- filesystem watcher

Acceptance:
Adding a folder produces a persistent local library.

## Milestone 3 - Metadata

- TMDb integration
- poster/backdrop cache
- movie matching
- series/episode matching
- manual correction

Acceptance:
Recognized titles show cached metadata and artwork.

## Milestone 4 - Browse UI

- Home
- Movies
- Series
- hero
- horizontal rows
- cards
- overlays
- search
- filters

Acceptance:
Library is fully browsable without a details page.

## Milestone 5 - Basic Playback

- direct MP4
- range streaming
- custom player
- fullscreen
- volume
- speed
- keyboard shortcuts

Acceptance:
Compatible MP4 files play and seek reliably.

## Milestone 6 - MKV and Advanced Playback

- playback capability probe
- FFmpeg remux/transcode
- HLS sessions
- HLS.js
- alternate audio

Acceptance:
Test MKV matrix can be played with seeking.

## Milestone 7 - Progress

- resume
- watched thresholds
- watched checkmarks
- Continue Watching
- Recently Watched
- manual watched controls

Acceptance:
State survives restart and updates correctly.

## Milestone 8 - Series Behavior

- seasons
- episodes
- next episode
- countdown
- autoplay
- season watched status

Acceptance:
TV playback behaves like a streaming service.

## Milestone 9 - Subtitles

- external SRT detection
- VTT conversion
- embedded text tracks
- subtitle menu
- manual offset
- preferred language

Acceptance:
SRT subtitles work across MP4 and MKV playback.

## Milestone 10 - Auto Subtitle Sync

- synchronization worker
- ffsubsync/equivalent
- cached synchronized output
- UI progress/result

Acceptance:
A known offset subtitle sample is corrected automatically.

## Milestone 11 - Timeline Preview

- FFmpeg preview generation
- sprite metadata
- hover UI
- cache

Acceptance:
Timeline hover shows correct approximate frame and timestamp.

## Milestone 12 - Library Management

- edit metadata
- rematch
- artwork replacement
- technical rescan
- open folder
- file availability handling

Acceptance:
User can correct incorrectly identified media without editing DB manually.

## Milestone 13 - Polish

- loading states
- error states
- performance
- accessibility
- Windows launcher
- logs
- cleanup
- test suite

---

# 88. Acceptance Criteria

The initial release is complete only when all of the following are true.

1. StreamLocal launches on Windows and opens a localhost web UI.
2. The user can add persistent media folders.
3. MP4 and MKV files are discovered.
4. Movies and TV episodes are distinguished automatically in common filename formats.
5. Metadata is automatically matched when possible.
6. Artwork is cached locally.
7. The application works offline using previously cached metadata.
8. MP4 video can play with seeking.
9. MKV video can play through direct/remux/transcode strategy as required.
10. Multiple audio tracks can be selected in supported media.
11. External SRT subtitles can be selected.
12. SRT subtitles can be automatically synchronized using a local synchronization process.
13. Manual subtitle offset adjustment exists.
14. Watch progress is saved.
15. Reopening an unfinished title resumes playback.
16. Completed videos are marked watched.
17. Watched videos display a checkmark.
18. Continue Watching updates automatically.
19. Recently Watched exists.
20. Favorites and Watchlist persist.
21. Series display seasons and episodes.
22. Next episode can autoplay.
23. Skip Intro/Recap works for configured segments.
24. Search works offline.
25. Filters work.
26. Timeline thumbnails appear when available.
27. Library management allows incorrect metadata to be fixed.
28. Removing a library record never deletes the physical video file.
29. The application remains responsive with a large media library.
30. The design is original and looks like a professional streaming product.

---

# 89. Codex Implementation Rules

Codex should follow these rules during implementation.

1. Do not implement everything in one giant file.
2. Use typed frontend models.
3. Use Pydantic request/response models.
4. Keep database models separate from API schemas.
5. Keep FFmpeg orchestration in service classes/modules.
6. Never accept arbitrary file paths from frontend playback requests.
7. Never call shell commands using concatenated strings.
8. Preserve original video and subtitle files.
9. Generated/transcoded/synchronized files must be stored in app cache.
10. Every persistent DB schema change must use a migration.
11. Add tests for every non-trivial parser or progress rule.
12. Keep playback strategy extensible.
13. Use feature flags for experimental intro detection.
14. Do not silently delete DB data on scan errors.
15. Do not make internet availability a requirement.
16. Do not use external authentication.
17. Do not implement mobile layouts.
18. Do not implement a separate full details page.
19. Optimize for local responsiveness before animation polish.
20. Prefer direct play/remux over full video transcoding.

---

# 90. Suggested First Codex Prompt

Use this document as the source of truth.

Initial implementation request:

"Create the StreamLocal repository from the specification. Start with Milestone 1 only. Use a React + TypeScript + Vite frontend and a Python FastAPI backend with SQLite, SQLAlchemy and Alembic. Create the project structure, local configuration, health endpoint, database bootstrap, migration system, Windows-compatible run scripts, and a basic original dark streaming-style shell UI. Do not implement media scanning or playback yet. Add README instructions and automated tests for the backend health endpoint. Keep all decisions compatible with the later milestones in this specification."

After each milestone:
- run tests
- fix failures
- update README
- commit logical changes if Git is available
- do not start the next milestone until the current milestone acceptance criteria pass

---

# 91. Recommended Repository Layout

streamlocal/
  README.md
  SPEC.md
  .gitignore
  frontend/
    package.json
    vite.config.ts
    tsconfig.json
    src/
  backend/
    pyproject.toml
    app/
    migrations/
    tests/
  scripts/
    dev.ps1
    start.ps1
    build.ps1
  tools/
    ffmpeg/
  docs/
    architecture.md
    playback.md
    subtitles.md

---

# 92. Development Commands

Recommended developer workflow:

Backend:
- create virtual environment
- install backend dependencies
- run Alembic migrations
- start Uvicorn

Frontend:
- install npm dependencies
- run Vite dev server

Development may use separate ports:
- frontend: 5173
- backend: 4310

Production/local release:
- frontend static build served by FastAPI
- one localhost port

This simplifies deployment and browser launching.

---

# 93. Windows Packaging

Initial development release may use:
- PowerShell startup script

Later polished release may use:
- PyInstaller or equivalent backend bundling
- bundled frontend static assets
- bundled FFmpeg binaries subject to licensing/distribution requirements
- simple installer

The launcher should:
- avoid console window if packaged as GUI app
- start backend
- wait until health endpoint succeeds
- open default browser
- stop backend cleanly if application launcher exits, depending on chosen lifecycle

---

# 94. FFmpeg Licensing Note

Before distributing FFmpeg binaries:
- verify the selected build's license
- verify enabled codecs
- comply with LGPL/GPL requirements as applicable

During local development, allowing the user to configure an FFmpeg path is acceptable.

---

# 95. Data Ownership

The user's media files are source-of-truth content.

StreamLocal may modify only:
- its own SQLite DB
- its own cache
- its own logs
- its own config

Do not:
- rename video files automatically
- move video files automatically
- delete video files automatically
- overwrite SRT files automatically

All derived assets must live in StreamLocal's own application data directory.

---

# 96. Final Product Definition

StreamLocal is considered successful when it behaves like a local streaming platform rather than a basic file picker or browser video tag.

The user experience should center around:
- a persistent visual library
- automatic organization
- fast resume
- watched-state awareness
- movie and TV browsing
- reliable local playback
- subtitles and audio selection
- automatic subtitle synchronization
- premium player behavior
- minimal manual file management after initial library setup

The application should treat the physical files as a media source and the local database as the product experience layer.
