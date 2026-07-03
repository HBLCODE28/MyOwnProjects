from __future__ import annotations

import html
import logging
import re
from urllib.parse import quote, urlparse

import requests
import wikipediaapi

from music_downloader_app.config import MUSICBRAINZ_BASE, SEARCH_RESULT_LIMIT, USER_AGENT

LOGGER = logging.getLogger(__name__)


class MusicMetadataService:
    """Fetch MusicBrainz and Wikipedia metadata."""

    def __init__(self) -> None:
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT})
        self.wiki = wikipediaapi.Wikipedia(language="en", user_agent=USER_AGENT)

    def _mb_get(self, endpoint: str, params: dict | None = None) -> dict:
        params = dict(params or {})
        params["fmt"] = "json"
        response = self.session.get(
            f"{MUSICBRAINZ_BASE}/{endpoint}",
            params=params,
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def search_artist(self, name: str, limit: int = SEARCH_RESULT_LIMIT) -> list[dict]:
        """Search MusicBrainz artists by name."""
        data = self._mb_get(
            "artist",
            {
                "query": f'artist:"{name}"',
                "limit": limit,
            },
        )
        return data.get("artists", [])

    def search_album(
        self,
        album: str,
        artist: str,
        limit: int = SEARCH_RESULT_LIMIT,
    ) -> list[dict]:
        """Search album release groups by album and artist."""
        data = self._mb_get(
            "release-group",
            {
                "query": f'release:"{album}" AND artist:"{artist}"',
                "type": "album",
                "limit": limit,
            },
        )
        return data.get("release-groups", [])

    def search_recording(
        self,
        song: str,
        artist: str,
        limit: int = SEARCH_RESULT_LIMIT,
    ) -> list[dict]:
        """Search recordings by song and artist."""
        data = self._mb_get(
            "recording",
            {
                "query": f'recording:"{song}" AND artist:"{artist}"',
                "inc": "releases+artist-credits",
                "limit": limit,
            },
        )
        return data.get("recordings", [])

    def get_release_groups_for_artist(self, artist_id: str, release_type: str) -> list[dict]:
        """Return all release groups for an artist."""
        results: list[dict] = []
        offset = 0

        while True:
            data = self._mb_get(
                "release-group",
                {
                    "artist": artist_id,
                    "type": release_type,
                    "limit": 100,
                    "offset": offset,
                },
            )
            batch = data.get("release-groups", [])
            results.extend(batch)
            if len(batch) < 100:
                break
            offset += 100

        return sorted(results, key=lambda item: item.get("first-release-date", ""))

    def get_tracks_from_release_group(self, release_group_id: str) -> list[dict]:
        """Load track information for the first release in a release group.

        The returned rows include enough release/recording metadata for MP3 ID3
        tagging: track number, total track count, release date, MusicBrainz
        recording ID, release ID, country, label and barcode when MusicBrainz
        provides them. Missing fields are left empty instead of blocking the
        download.
        """
        releases_data = self._mb_get(
            "release",
            {
                "release-group": release_group_id,
                "inc": "media+recordings+labels+artist-credits+release-groups+isrcs",
                "limit": 1,
            },
        )
        releases = releases_data.get("releases", [])
        if not releases:
            return []

        release_id = releases[0]["id"]
        release_data = self._mb_get(
            f"release/{release_id}",
            {"inc": "media+recordings+labels+artist-credits+release-groups+isrcs"},
        )

        label_names: list[str] = []
        catalog_numbers: list[str] = []
        for label_info in release_data.get("label-info", []) or []:
            label = label_info.get("label") or {}
            name = label.get("name")
            if name and name not in label_names:
                label_names.append(name)
            catalog_number = label_info.get("catalog-number")
            if catalog_number and catalog_number not in catalog_numbers:
                catalog_numbers.append(catalog_number)

        def credit_names(credits: list[dict] | None) -> str | None:
            names: list[str] = []
            for credit in credits or []:
                artist = credit.get("artist") or {}
                name = artist.get("name")
                if name:
                    names.append(name)
            return ", ".join(names) if names else None

        def credit_sort_names(credits: list[dict] | None) -> str | None:
            names: list[str] = []
            for credit in credits or []:
                artist = credit.get("artist") or {}
                name = artist.get("sort-name") or artist.get("name")
                if name:
                    names.append(name)
            return ", ".join(names) if names else None

        def first_artist_id(credits: list[dict] | None) -> str | None:
            for credit in credits or []:
                artist = credit.get("artist") or {}
                if artist.get("id"):
                    return artist.get("id")
            return None

        release_artist_credit = release_data.get("artist-credit") or []
        release_group = release_data.get("release-group") or {}
        text_representation = release_data.get("text-representation") or {}
        media = release_data.get("media", []) or []

        total_tracks = 0
        for medium in media:
            total_tracks += len(medium.get("tracks", []) or [])

        tracks: list[dict] = []

        for medium in release_data.get("media", []) or []:
            medium_position = medium.get("position")
            medium_title = medium.get("title")
            for track in medium.get("tracks", []) or []:
                recording = track.get("recording", {}) or {}
                length_ms = recording.get("length") or track.get("length")
                try:
                    position = int(track.get("position", len(tracks) + 1))
                except Exception:
                    position = len(tracks) + 1
                recording_credit = recording.get("artist-credit") or track.get("artist-credit") or release_artist_credit
                tracks.append(
                    {
                        "position": position,
                        "number": track.get("number") or str(position),
                        "title": track.get("title", recording.get("title", "Unknown")),
                        "length_ms": length_ms,
                        "recording_id": recording.get("id"),
                        "recording_disambiguation": recording.get("disambiguation"),
                        "isrc": (recording.get("isrcs") or [None])[0],
                        "track_artist": credit_names(recording_credit),
                        "track_artist_sort": credit_sort_names(recording_credit),
                        "track_artist_id": first_artist_id(recording_credit),
                        "release_id": release_id,
                        "release_group_id": release_group_id,
                        "release_title": release_data.get("title"),
                        "release_date": release_data.get("date"),
                        "release_country": release_data.get("country"),
                        "release_status": release_data.get("status"),
                        "release_packaging": release_data.get("packaging"),
                        "release_quality": release_data.get("quality"),
                        "album_artist": credit_names(release_artist_credit),
                        "album_artist_sort": credit_sort_names(release_artist_credit),
                        "album_artist_id": first_artist_id(release_artist_credit),
                        "release_group_type": release_group.get("primary-type"),
                        "release_group_secondary_types": release_group.get("secondary-types") or [],
                        "barcode": release_data.get("barcode"),
                        "asin": release_data.get("asin"),
                        "language": text_representation.get("language"),
                        "script": text_representation.get("script"),
                        "labels": label_names,
                        "catalog_numbers": catalog_numbers,
                        "medium_position": medium_position,
                        "medium_total": len(media) or None,
                        "medium_title": medium_title,
                        "medium_format": medium.get("format"),
                        "total_tracks": total_tracks or None,
                    }
                )
        return tracks

    def get_cover_url(self, release_group_id: str) -> str | None:
        """Return a front-cover image URL for a release group.

        Cover Art Archive does not always expose artwork through the simple
        /release-group/<id>/front redirect. This method checks several stable
        endpoints: direct release-group image redirects, release-group JSON, and
        then the individual releases inside the group.
        """
        direct = self._cover_art_direct_url(f"release-group/{release_group_id}")
        if direct:
            return direct

        json_cover = self._cover_art_json_url(f"release-group/{release_group_id}")
        if json_cover:
            return json_cover

        try:
            releases_data = self._mb_get(
                "release",
                {
                    "release-group": release_group_id,
                    "limit": 12,
                },
            )
            releases = releases_data.get("releases", []) or []
            # Prefer official releases first, because bootlegs and promos often
            # have missing or misleading artwork.
            releases.sort(key=lambda item: 0 if item.get("status") == "Official" else 1)
            for release in releases[:12]:
                release_id = release.get("id")
                if not release_id:
                    continue
                release_cover = self.get_cover_url_for_release(release_id)
                if release_cover:
                    return release_cover
        except Exception as exc:
            LOGGER.debug("Release cover fallback failed for %s: %s", release_group_id, exc)
        return None

    def get_cover_url_for_release(self, release_id: str) -> str | None:
        """Return a front-cover image URL for a specific release."""
        return (
            self._cover_art_direct_url(f"release/{release_id}")
            or self._cover_art_json_url(f"release/{release_id}")
        )

    def _cover_art_direct_url(self, endpoint: str) -> str | None:
        for suffix in ("front-1200", "front-500", "front"):
            try:
                response = self.session.get(
                    f"https://coverartarchive.org/{endpoint}/{suffix}",
                    allow_redirects=True,
                    timeout=30,
                )
                content_type = response.headers.get("Content-Type", "").lower()
                if response.status_code == 200 and ("image" in content_type or response.url):
                    return response.url
            except Exception as exc:
                LOGGER.debug("Cover art direct lookup failed for %s/%s: %s", endpoint, suffix, exc)
        return None

    def _cover_art_json_url(self, endpoint: str) -> str | None:
        try:
            response = self.session.get(
                f"https://coverartarchive.org/{endpoint}",
                timeout=30,
            )
            if response.status_code != 200:
                return None
            payload = response.json()
            images = payload.get("images", []) or []
            if not images:
                return None

            def _image_score(image: dict) -> int:
                score = 0
                if image.get("front"):
                    score += 100
                if image.get("approved"):
                    score += 20
                if "Front" in (image.get("types") or []):
                    score += 20
                return score

            for image in sorted(images, key=_image_score, reverse=True):
                url = self._best_cover_url_from_image(image)
                if url:
                    return url
        except Exception as exc:
            LOGGER.debug("Cover art JSON lookup failed for %s: %s", endpoint, exc)
        return None

    def _best_cover_url_from_image(self, image: dict) -> str | None:
        thumbnails = image.get("thumbnails") or {}
        if isinstance(thumbnails, dict):
            for key in ("1200", "large", "500", "250", "small"):
                url = thumbnails.get(key)
                if url:
                    return url
        url = image.get("image")
        return url if isinstance(url, str) and url else None

    def get_album_cover_url(
        self,
        album_title: str,
        artist_name: str,
        release_group_id: str | None = None,
    ) -> str | None:
        """Return the best available album cover URL from reliable direct-image sources.

        The previous Google Images HTML scraping path often returned unusable or
        wrong artwork. This method uses sources that return direct artwork URLs
        with structured album and artist metadata: Cover Art Archive, Apple/iTunes
        Search API, and Deezer.
        """
        album = album_title.strip()
        artist = artist_name.strip()
        if not album:
            return None

        lookups = []
        if release_group_id:
            lookups.append(("coverartarchive", lambda: self.get_cover_url(release_group_id)))
        lookups.extend([
            ("itunes", lambda: self.get_itunes_album_cover_url(album, artist)),
            ("deezer", lambda: self.get_deezer_album_cover_url(album, artist)),
        ])

        for source_name, lookup in lookups:
            try:
                url = lookup()
                if url:
                    LOGGER.info("Album cover found via %s for %s - %s", source_name, artist, album)
                    return url
            except Exception as exc:
                LOGGER.debug("Album cover lookup via %s failed for %s - %s: %s", source_name, artist, album, exc)
        LOGGER.info("No album cover found for %s - %s", artist, album)
        return None

    def get_itunes_album_cover_url(self, album_title: str, artist_name: str) -> str | None:
        """Find album artwork through Apple's public iTunes Search API."""
        album = album_title.strip()
        artist = artist_name.strip()
        if not album:
            return None

        candidates: list[tuple[int, str]] = []
        terms = [f"{artist} {album}".strip(), album]
        countries = ("US", "GB", "IL", "CA", "AU")
        for term in terms:
            for country in countries:
                try:
                    response = self.session.get(
                        "https://itunes.apple.com/search",
                        params={
                            "term": term,
                            "media": "music",
                            "entity": "album",
                            "limit": 25,
                            "country": country,
                        },
                        timeout=20,
                    )
                    response.raise_for_status()
                    payload = response.json()
                    for result in payload.get("results", []) or []:
                        url = result.get("artworkUrl100")
                        if not isinstance(url, str) or not url:
                            continue
                        score = self._score_album_match(
                            result.get("collectionName", ""),
                            result.get("artistName", ""),
                            album,
                            artist,
                        )
                        if score <= 0:
                            continue
                        high_res = self._itunes_high_res_artwork_url(url)
                        candidates.append((score, high_res))
                except Exception as exc:
                    LOGGER.debug("iTunes cover lookup failed for %s - %s in %s: %s", artist, album, country, exc)

        for _score, url in sorted(candidates, key=lambda item: item[0], reverse=True):
            if self._validate_cover_image_url(url):
                return url
        return None

    def get_deezer_album_cover_url(self, album_title: str, artist_name: str) -> str | None:
        """Find album artwork through Deezer's public album search endpoint."""
        album = album_title.strip()
        artist = artist_name.strip()
        if not album:
            return None

        queries = [
            f'artist:"{artist}" album:"{album}"'.strip(),
            f"{artist} {album}".strip(),
            album,
        ]
        candidates: list[tuple[int, str]] = []
        for query in queries:
            try:
                response = self.session.get(
                    "https://api.deezer.com/search/album",
                    params={"q": query, "limit": 25},
                    timeout=20,
                )
                response.raise_for_status()
                payload = response.json()
                for result in payload.get("data", []) or []:
                    url = result.get("cover_xl") or result.get("cover_big") or result.get("cover_medium")
                    if not isinstance(url, str) or not url:
                        continue
                    result_artist = (result.get("artist") or {}).get("name", "")
                    score = self._score_album_match(
                        result.get("title", ""),
                        result_artist,
                        album,
                        artist,
                    )
                    if score <= 0:
                        continue
                    candidates.append((score, url))
            except Exception as exc:
                LOGGER.debug("Deezer cover lookup failed for %s - %s: %s", artist, album, exc)

        for _score, url in sorted(candidates, key=lambda item: item[0], reverse=True):
            if self._validate_cover_image_url(url):
                return url
        return None

    def _itunes_high_res_artwork_url(self, url: str) -> str:
        """Convert the 100x100 iTunes artwork URL to a larger cover URL."""
        return re.sub(r"/\d+x\d+bb\.(jpg|jpeg|png)$", r"/1200x1200bb.\1", url, flags=re.IGNORECASE)

    def _score_album_match(
        self,
        result_album: str,
        result_artist: str,
        target_album: str,
        target_artist: str,
    ) -> int:
        """Score an external artwork search result.

        The result is intentionally strict. Earlier versions accepted an exact
        album title even when the artist did not match. That can select another
        artist's album with the same name, for example a result named "Are You
        Alright?" that is not by Lovejoy. For iTunes and Deezer, if the source
        provides an artist name and the user supplied an artist, the artist must
        match before any artwork can be accepted.
        """
        album_norm = self._normalize_cover_text(target_album)
        artist_norm = self._normalize_cover_text(target_artist.split(",")[0])
        result_album_norm = self._normalize_cover_text(str(result_album))
        result_artist_norm = self._normalize_cover_text(str(result_artist))
        if not album_norm or not result_album_norm:
            return 0

        album_score = 0
        if result_album_norm == album_norm:
            album_score = 120
        elif album_norm in result_album_norm or result_album_norm in album_norm:
            # Accept suffixes like "Are You Alright? - EP", but do not accept
            # weak word-overlap matches for short/common album titles. A weak
            # match is how wrong covers can be accepted for albums with generic
            # names.
            album_score = 85
        else:
            return 0

        if album_score < 85:
            return 0

        artist_score = 0
        if artist_norm:
            if not result_artist_norm:
                return 0
            if result_artist_norm == artist_norm:
                artist_score = 100
            elif artist_norm in result_artist_norm or result_artist_norm in artist_norm:
                artist_score = 75
            else:
                artist_words = {word for word in artist_norm.split() if len(word) > 1}
                result_artist_words = {word for word in result_artist_norm.split() if len(word) > 1}
                overlap = len(artist_words & result_artist_words)
                if artist_words and overlap / max(len(artist_words), 1) >= 0.75:
                    artist_score = 55
            if artist_score < 75:
                return 0

        bad_words = ("karaoke", "tribute", "cover", "remix", "instrumental", "soundtrack")
        if any(word in result_album_norm for word in bad_words) and not any(word in album_norm for word in bad_words):
            return 0
        return album_score + artist_score

    def _normalize_cover_text(self, value: str) -> str:
        value = html.unescape(str(value or "")).lower()
        value = re.sub(r"\b(deluxe|expanded|remastered|anniversary|edition|explicit|clean|bonus tracks?)\b", " ", value)
        value = re.sub(r"[^a-z0-9]+", " ", value)
        return re.sub(r"\s+", " ", value).strip()


    def get_google_album_cover_url(self, album_title: str, artist_name: str) -> str | None:
        """Find a likely album cover through Google Images.

        This is used only for album-level artwork. It deliberately avoids YouTube
        thumbnails so one track thumbnail cannot become the cover for the whole
        album. Google does not provide a stable free unauthenticated Images API,
        so this method uses the public image-search page on a best-effort basis.
        If Google blocks or changes the page, the caller falls back to the normal
        MusicBrainz/Cover Art Archive flow.
        """
        album = album_title.strip()
        artist = artist_name.strip()
        if not album:
            return None

        query = f'{artist} {album} album cover'.strip()
        try:
            response = self.session.get(
                "https://www.google.com/search",
                params={"tbm": "isch", "q": query, "safe": "active", "hl": "en"},
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/124.0 Safari/537.36"
                    ),
                    "Accept-Language": "en-US,en;q=0.9",
                },
                timeout=20,
            )
            if response.status_code != 200:
                LOGGER.debug("Google cover lookup returned HTTP %s for %s", response.status_code, query)
                return None

            for candidate in self._extract_google_image_candidates(response.text):
                if not self._looks_like_album_cover_candidate(candidate):
                    continue
                if self._validate_cover_image_url(candidate):
                    return candidate
        except Exception as exc:
            LOGGER.debug("Google cover lookup failed for %s: %s", query, exc)
        return None

    def _extract_google_image_candidates(self, page_text: str) -> list[str]:
        """Extract external image URLs from a Google Images result page."""
        text = html.unescape(page_text)
        text = (
            text.replace("\\u003d", "=")
            .replace("\\u0026", "&")
            .replace("\\/", "/")
        )

        patterns = [
            r'\["(https?://[^"\\]+?)",\d{2,5},\d{2,5}\]',
            r'"ou":"(https?://[^"\\]+?)"',
            r'(https?://[^"\\<> ]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"\\<> ]*)?)',
        ]

        urls: list[str] = []
        seen: set[str] = set()
        for pattern in patterns:
            for match in re.finditer(pattern, text, flags=re.IGNORECASE):
                url = match.group(1)
                url = url.replace("\\u003d", "=").replace("\\u0026", "&").replace("&amp;", "&")
                if url not in seen:
                    seen.add(url)
                    urls.append(url)
        return urls

    def _looks_like_album_cover_candidate(self, url: str) -> bool:
        """Reject Google thumbnails, icons, logos, and non-image-looking URLs."""
        try:
            parsed = urlparse(url)
            host = parsed.netloc.lower()
            path = parsed.path.lower()
        except Exception:
            return False

        blocked_hosts = (
            "google.",
            "gstatic.com",
            "googleusercontent.com",
            "youtube.com",
            "ytimg.com",
            "ggpht.com",
        )
        if any(blocked in host for blocked in blocked_hosts):
            return False
        if any(token in path for token in ("logo", "sprite", "icon", "avatar", "profile")):
            return False
        if path.endswith(".svg") or ".svg" in path:
            return False
        return url.startswith("http://") or url.startswith("https://")

    def _validate_cover_image_url(self, url: str) -> bool:
        """Check that a URL downloads as a square-ish usable image."""
        try:
            response = self.session.get(
                url,
                timeout=20,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/124.0 Safari/537.36"
                    ),
                    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
                    "Referer": "https://www.google.com/",
                },
            )
            response.raise_for_status()
            content = response.content
            if len(content) < 4_000:
                return False

            from io import BytesIO
            from PIL import Image

            with Image.open(BytesIO(content)) as image:
                width, height = image.size
                if width < 250 or height < 250:
                    return False
                ratio = width / height if height else 99
                return 0.75 <= ratio <= 1.35
        except Exception as exc:
            LOGGER.debug("Google cover candidate rejected %s: %s", url, exc)
            return False

    def get_wikipedia_image_url(self, title: str) -> str | None:
        """Return a public Wikipedia/Wikimedia thumbnail for an artist or band.

        The app uses this for music search cards so song results show an artist/band
        image instead of a random YouTube video frame. Pinterest is not used here
        because it has no stable unauthenticated public image API for this purpose.
        """
        clean_title = title.strip()
        if not clean_title:
            return None

        candidates = [
            clean_title,
            f"{clean_title} (band)",
            f"{clean_title} (musician)",
            f"{clean_title} (singer)",
        ]
        seen: set[str] = set()

        for candidate in candidates:
            if candidate.lower() in seen:
                continue
            seen.add(candidate.lower())
            page_name = quote(candidate.replace(" ", "_"), safe="")
            try:
                response = self.session.get(
                    f"https://en.wikipedia.org/api/rest_v1/page/summary/{page_name}",
                    timeout=15,
                )
                if response.status_code != 200:
                    continue
                data = response.json()
                for key in ("thumbnail", "originalimage"):
                    image = data.get(key) or {}
                    source = image.get("source")
                    if source:
                        return source
            except Exception as exc:
                LOGGER.debug("Wikipedia image lookup failed for %s: %s", candidate, exc)
        return None

    def get_wikipedia_summary(self, title: str) -> str:
        """Return a short Wikipedia summary for the requested title."""
        try:
            page = self.wiki.page(title)
            if not page.exists():
                return "No description available."
            summary = page.summary.strip()
            return summary[:320] + ("..." if len(summary) > 320 else "")
        except Exception as exc:
            LOGGER.debug("Wikipedia lookup failed for %s: %s", title, exc)
            return "No description available."

