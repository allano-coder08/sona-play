/* ==========================================
   ALLAN MUSIC BOT
   MUSIC SEARCH AND PLAYER (full songs via YouTube)
========================================== */

// 0. YOUTUBE API KEY
// Paste your YouTube Data API v3 key here, and restrict it to your
// Vercel domain in Google Cloud (Credentials > your key > Website restrictions).
const YOUTUBE_API_KEY = "AIzaSyAmA8taIf1zkXycMFwbGAXFjzbfiolrnkY";

// Set to true to move the YouTube video off-screen (audio only).
// Note: YouTube's developer policies expect the player to stay visible,
// so false (visible mini-player) is the safest choice.
const HIDE_PLAYER = false;


// 1. GET HTML ELEMENTS

const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const results = document.getElementById("results");
const resultsSection = document.getElementById("search-results-section");
const loginBtn = document.getElementById("loginBtn");

const playBtn = document.getElementById("playBtn");
const previousBtn = document.getElementById("previousBtn");
const nextBtn = document.getElementById("nextBtn");

const songTitle = document.getElementById("songTitle");
const artistName = document.getElementById("artistName");

const volumeInput = document.getElementById("volumeControl");
const mainContent = document.getElementById("mainContent");

const FALLBACK_ART = "https://placehold.co/300x300/20243a/ffffff?text=Music";


// 2. PLAYER STATE

let songs = [];
let currentIndex = -1;
let searchController = null;

let ytPlayer = null;
let ytReady = false;
let pendingIndex = -1;   // song clicked before the player finished loading
let isPlaying = false;
let currentVolume = 50;


// 3. YOUTUBE IFRAME PLAYER
// Uses <div id="player"> if you add one to index.html. Otherwise a small
// player is created in the bottom-right corner of the page.

function ensurePlayerHolder() {
    let holder = document.getElementById("player");

    if (!holder) {
        holder = document.createElement("div");
        holder.id = "player";
        holder.style.cssText =
            "position:fixed;right:12px;bottom:12px;width:240px;height:135px;" +
            "z-index:9999;border-radius:8px;overflow:hidden;" +
            "box-shadow:0 4px 16px rgba(0,0,0,0.4);";
        document.body.appendChild(holder);
    }

    return holder;
}

function loadYouTubeApi() {
    ensurePlayerHolder();

    if (window.YT && window.YT.Player) {
        onYouTubeIframeAPIReady();
        return;
    }

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
}

// YouTube calls this function by name once its script has loaded.
window.onYouTubeIframeAPIReady = function () {
    ytPlayer = new YT.Player("player", {
        width: "240",
        height: "135",
        playerVars: { playsinline: 1, rel: 0, controls: 1 },
        events: {
            onReady: onPlayerReady,
            onStateChange: onPlayerStateChange,
            onError: onPlayerError
        }
    });
};

function onPlayerReady() {
    ytReady = true;
    ytPlayer.setVolume(currentVolume);

    if (pendingIndex !== -1) {
        const index = pendingIndex;
        pendingIndex = -1;
        playSong(index);
    }
}

function onPlayerStateChange(event) {
    const state = event.data;

    isPlaying =
        state === YT.PlayerState.PLAYING ||
        state === YT.PlayerState.BUFFERING;

    updatePlayButton();

    if (state === YT.PlayerState.ENDED) {
        playNext();
    }
}

function onPlayerError() {
    // Some videos block embedding. Skip to the next one automatically.
    console.warn("This video cannot be played here. Skipping.");

    if (songTitle) songTitle.textContent = "Can't play this one, skipping...";

    playNext();
}


// 4. HELPER FUNCTIONS

function showMessage(message) {
    if (!results) return;

    results.replaceChildren();

    const paragraph = document.createElement("p");
    paragraph.className = "search-message";
    paragraph.textContent = message;

    results.appendChild(paragraph);
}

function showSearchSection() {
    const target = resultsSection || results;

    if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
}

function updatePlayButton() {
    if (!playBtn) return;

    playBtn.innerHTML = isPlaying
        ? '<i class="fas fa-pause" aria-hidden="true"></i>'
        : '<i class="fas fa-play" aria-hidden="true"></i>';

    playBtn.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
}

function highlightCurrentTrack() {
    document.querySelectorAll(".track-card").forEach(function (card, i) {
        card.classList.toggle("playing", i === currentIndex);
    });
}

// YouTube titles come back with HTML entities such as &amp; and &#39;
function decodeHtml(text) {
    const box = document.createElement("textarea");
    box.innerHTML = text || "";
    return box.value;
}

function cleanArtist(name) {
    return decodeHtml(name).replace(/\s*-\s*Topic$/i, "").replace(/VEVO$/i, "").trim();
}

// Finds the next song with a video, moving forward (1) or backward (-1).
function findPlayable(start, step) {
    if (!songs.length) return -1;

    let index = start;

    for (let attempts = 0; attempts < songs.length; attempts++) {
        index = (index + step + songs.length) % songs.length;

        if (songs[index].videoId) return index;
    }

    return -1;
}


// 5. SEARCH EVENTS
// The click handler is wrapped so the click event is NOT passed in as
// the "query" argument.

if (searchBtn) {
    searchBtn.addEventListener("click", function () {
        searchMusic();
    });
}

if (searchInput) {
    searchInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            searchMusic();
        }
    });
}


// 6. FETCH SONGS FROM YOUTUBE

async function fetchFromYouTube(query, signal) {
    if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === "YOUR_API_KEY_HERE") {
        throw new Error("Add your YouTube API key at the top of script.js.");
    }

    const url =
        "https://www.googleapis.com/youtube/v3/search" +
        "?part=snippet" +
        "&type=video" +
        "&videoCategoryId=10" +      // Music category
        "&videoEmbeddable=true" +    // only videos that can play in our player
        "&maxResults=24" +
        "&q=" + encodeURIComponent(query) +
        "&key=" + encodeURIComponent(YOUTUBE_API_KEY);

    const response = await fetch(url, { signal });

    if (!response.ok) {
        // Ask Google for the exact reason so the message is useful.
        let reason = "";
        let detail = "";

        try {
            const body = await response.json();
            const first = body.error && body.error.errors && body.error.errors[0];

            reason = (first && first.reason) || "";
            detail = (body.error && body.error.message) || "";
        } catch (parseError) {
            // ignore: body was not JSON
        }

        console.error("YouTube API error:", response.status, reason, detail);

        const fixes = {
            quotaExceeded: "Daily YouTube quota used up. It resets at midnight Pacific time.",
            accessNotConfigured: "YouTube Data API v3 is not enabled in the Google Cloud project that owns this key.",
            ipRefererBlocked: "This key's website restriction does not include this site's address. Add it under Credentials > Website restrictions.",
            keyInvalid: "The API key is invalid. Check it was copied correctly.",
            API_KEY_HTTP_REFERRER_BLOCKED: "This key's website restriction does not include this site's address. Add it under Credentials > Website restrictions.",
            API_KEY_SERVICE_BLOCKED: "This key is not allowed to use the YouTube Data API v3. Fix it under Credentials > API restrictions.",
            SERVICE_DISABLED: "YouTube Data API v3 is not enabled in the Google Cloud project that owns this key."
        };

        const friendly = fixes[reason] || detail || ("Search failed (" + response.status + ").");

        throw new Error(friendly);
    }

    const data = await response.json();

    return (data.items || [])
        .filter(function (item) {
            return item.id && item.id.videoId;
        })
        .map(function (item) {
            const thumbs = item.snippet.thumbnails || {};
            const best = thumbs.high || thumbs.medium || thumbs.default || {};

            return {
                title: decodeHtml(item.snippet.title),
                artist: cleanArtist(item.snippet.channelTitle),
                artwork: best.url || "",
                videoId: item.id.videoId
            };
        });
}

async function searchMusic(query) {
    if (!searchInput || !results) return;

    const raw = typeof query === "string" ? query : searchInput.value;
    const searchQuery = raw.trim();

    if (!searchQuery) {
        showMessage("Please enter a song name or artist.");
        searchInput.focus();
        return;
    }

    searchInput.value = searchQuery;

    if (searchController) searchController.abort();

    searchController = new AbortController();
    const currentController = searchController;

    if (searchBtn) {
        searchBtn.disabled = true;
        searchBtn.textContent = "Searching...";
    }

    showMessage("Searching for your favourite music... 🎵");
    showSearchSection();

    try {
        const found = await fetchFromYouTube(searchQuery, currentController.signal);

        // Ignore outdated results
        if (currentController !== searchController) return;

        songs = found;
        currentIndex = -1;

        renderSongs();
    } catch (error) {
        if (error.name === "AbortError") return;

        console.error("Music search error:", error);

        showMessage("Unable to search music. " + error.message);
    } finally {
        if (currentController === searchController && searchBtn) {
            searchBtn.disabled = false;
            searchBtn.textContent = "Search";
        }
    }
}


// 7. VIBE, FEATURED AND PLAYLIST BUTTONS
// Every element with data-search (or the old data-vibe) starts a search.

document.querySelectorAll("[data-search], [data-vibe]").forEach(function (element) {
    element.addEventListener("click", function (event) {
        event.preventDefault();

        const query = this.dataset.search || this.dataset.vibe;

        if (query) searchMusic(query);
    });
});

// "Search" and "Discover More" links: scroll up and focus the search box.
document.querySelectorAll("[data-focus-search]").forEach(function (link) {
    link.addEventListener("click", function (event) {
        event.preventDefault();
        showSearchSection();

        if (searchInput) searchInput.focus({ preventScroll: true });
    });
});


// 8. DISPLAY SEARCH RESULTS

function renderSongs() {
    if (!results) return;

    results.replaceChildren();

    if (!songs.length) {
        showMessage("No songs found. Try another search.");
        return;
    }

    songs.forEach(function (song, index) {
        const card = document.createElement("div");
        card.className = "track-card";

        const image = document.createElement("img");
        image.src = song.artwork || FALLBACK_ART;
        image.alt = (song.title || "Song") + " artwork";
        image.loading = "lazy";
        image.onerror = function () {
            this.onerror = null;
            this.src = FALLBACK_ART;
        };

        const title = document.createElement("h3");
        title.textContent = song.title || "Unknown Song";

        const artist = document.createElement("p");
        artist.textContent = song.artist || "Unknown Artist";

        const button = document.createElement("button");
        button.type = "button";
        button.className = "track-play-btn";
        button.textContent = "▶ Play Full Song";

        button.addEventListener("click", function () {
            playSong(index);
        });

        card.append(image, title, artist, button);
        results.appendChild(card);
    });
}


// 9. PLAY A SONG

function playSong(index) {
    const song = songs[index];

    if (!song || !song.videoId) return;

    currentIndex = index;

    if (songTitle) songTitle.textContent = song.title || "Unknown Song";
    if (artistName) artistName.textContent = song.artist || "Unknown Artist";

    highlightCurrentTrack();

    if (!ytReady) {
        // Player still loading: remember the click and play when ready.
        pendingIndex = index;
        return;
    }

    ytPlayer.loadVideoById(song.videoId);
}


// 10. PLAY / PAUSE

if (playBtn) {
    playBtn.addEventListener("click", function () {
        if (!ytReady) return;

        // Nothing loaded yet: start the first result
        if (currentIndex === -1) {
            const first = findPlayable(-1, 1);

            if (first !== -1) playSong(first);

            return;
        }

        if (isPlaying) {
            ytPlayer.pauseVideo();
        } else {
            ytPlayer.playVideo();
        }
    });
}


// 11. NEXT / PREVIOUS / AUTO-ADVANCE

function playNext() {
    const next = findPlayable(currentIndex, 1);

    if (next !== -1) playSong(next);
}

function playPrevious() {
    // More than 3 seconds in? restart the song. Otherwise go back one.
    if (ytReady && currentIndex !== -1 && ytPlayer.getCurrentTime() > 3) {
        ytPlayer.seekTo(0, true);
        return;
    }

    const previous = findPlayable(currentIndex === -1 ? 0 : currentIndex, -1);

    if (previous !== -1) playSong(previous);
}

if (nextBtn) nextBtn.addEventListener("click", playNext);
if (previousBtn) previousBtn.addEventListener("click", playPrevious);


// 12. VOLUME

if (volumeInput) {
    volumeInput.value = currentVolume;

    volumeInput.addEventListener("input", function () {
        currentVolume = Number(this.value);

        if (ytReady) ytPlayer.setVolume(currentVolume);
    });
}


// 13. SPOTIFY BUTTON (placeholder)

if (loginBtn) {
    loginBtn.addEventListener("click", function () {
        alert("Spotify integration will be added separately.");
    });
}


// 14. SIDEBAR / MOBILE NAV: highlight the section you are viewing

const navLinks = document.querySelectorAll(".nav-link[href^='#']");

function setActiveNav(id) {
    navLinks.forEach(function (link) {
        link.classList.toggle("active", link.getAttribute("href") === "#" + id);
    });
}

navLinks.forEach(function (link) {
    link.addEventListener("click", function () {
        const id = link.getAttribute("href").slice(1);

        if (id) setActiveNav(id);
    });
});

if (mainContent && "IntersectionObserver" in window) {
    const watched = ["home-section", "playlists-section", "featured-section",
                     "trending-section", "library-section"];

    const observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) setActiveNav(entry.target.id);
        });
    }, { root: mainContent, rootMargin: "-20% 0px -65% 0px" });

    watched.forEach(function (id) {
        const section = document.getElementById(id);

        if (section) observer.observe(section);
    });
}


// 15. INITIALIZE

updatePlayButton();
loadYouTubeApi();