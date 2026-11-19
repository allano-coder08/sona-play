
/* =====================================================
   SONA PLAY
   COMPLETE MUSIC SEARCH AND PLAYER
   YouTube Data API v3 + Jamendo API
===================================================== */

/* =====================================================
   1. API CONFIGURATION
===================================================== */

const YOUTUBE_API_KEY = "AIzaSyAmA8taIf1zkXycMFwbGAXFjzbfiolrnkY";
const JAMENDO_CLIENT_ID = "0891ffca";

const YOUTUBE_API =
    "https://www.googleapis.com/youtube/v3/search";

const JAMENDO_API =
    "https://api.jamendo.com/v3.0/tracks/";

/* =====================================================
   2. ELEMENT SELECTORS
===================================================== */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const searchInput = $("#searchInput");
const searchBtn = $("#searchBtn");
const heroSearch = $("#heroSearch");
const view = $("#view");

const playBtn = $("#playBtn");
const prevBtn = $("#prevBtn");
const nextBtn = $("#nextBtn");

const pTitle = $("#pTitle");
const pArtist = $("#pArtist");
const pArt = $("#pArt");

const seek = $("#seek");
const tCur = $("#tCur");
const tDur = $("#tDur");
const vol = $("#vol");

const ytContainer = $("#yt-player");

/* =====================================================
   3. APPLICATION STATE
===================================================== */

let currentTrack = null;
let currentQueue = [];
let currentIndex = -1;

let youtubePlayer = null;
let youtubeReady = false;

let jamendoAudio = new Audio();
jamendoAudio.preload = "none";

let isPlaying = false;
let currentSource = null;

let likedTracks = JSON.parse(
    localStorage.getItem("sona_liked") || "[]"
);

let recentlyPlayed = JSON.parse(
    localStorage.getItem("sona_recent") || "[]"
);

let youtubeResults = [];
let jamendoResults = [];

/* =====================================================
   4. HELPER FUNCTIONS
===================================================== */

function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return "0:00";

    const minutes = Math.floor(seconds / 60);
    const remaining = Math.floor(seconds % 60);

    return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function saveData() {
    localStorage.setItem(
        "sona_liked",
        JSON.stringify(likedTracks)
    );

    localStorage.setItem(
        "sona_recent",
        JSON.stringify(recentlyPlayed)
    );
}

function showToast(message) {
    let toast = $("#toast");

    if (!toast) {
        toast = document.createElement("div");
        toast.id = "toast";
        toast.className = "toast";
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}

/* =====================================================
   5. YOUTUBE IFRAME PLAYER
===================================================== */

function loadYouTubeAPI() {
    if (window.YT && window.YT.Player) {
        createYouTubePlayer();
        return;
    }

    if (document.querySelector(
        'script[src="https://www.youtube.com/iframe_api"]'
    )) return;

    const script = document.createElement("script");

    script.src = "https://www.youtube.com/iframe_api";

    document.head.appendChild(script);
}

window.onYouTubeIframeAPIReady = function () {
    createYouTubePlayer();
};

function createYouTubePlayer() {
    if (youtubePlayer || !window.YT || !YT.Player) return;

    let container = ytContainer;

    if (!container) {
        container = document.createElement("div");
        container.id = "yt-player";
        document.body.appendChild(container);
    }

    container.innerHTML = `
        <div id="youtube-player-frame"></div>
    `;

    youtubePlayer = new YT.Player(
        "youtube-player-frame",
        {
            height: "1",
            width: "1",

            playerVars: {
                autoplay: 0,
                controls: 0,
                playsinline: 1,
                rel: 0
            },

            events: {
                onReady: function () {
                    youtubeReady = true;

                    if (vol) {
                        youtubePlayer.setVolume(
                            Number(vol.value || 70)
                        );
                    }
                },

                onStateChange: function (event) {
                    if (
                        event.data === YT.PlayerState.ENDED
                    ) {
                        playNext();
                    }

                    if (
                        event.data === YT.PlayerState.PLAYING
                    ) {
                        isPlaying = true;
                        updatePlayButton();
                    }

                    if (
                        event.data === YT.PlayerState.PAUSED
                    ) {
                        isPlaying = false;
                        updatePlayButton();
                    }
                }
            }
        }
    );
}

/* =====================================================
   6. YOUTUBE SEARCH
===================================================== */

async function searchYouTube(query) {
    if (!YOUTUBE_API_KEY ||
        YOUTUBE_API_KEY.includes("AIzaSyAmA8taIf1zkXycMFwbGAXFjzbfiolrnkY")) {
        throw new Error(
            "Add your YouTube API key at the top of script.js."
        );
    }

    const params = new URLSearchParams({
        part: "snippet",
        type: "video",
        videoCategoryId: "10",
        maxResults: "12",
        q: query,
        key:AIzaSyAmA8taIf1zkXycMFwbGAXFjzbfiolrnkY
    });

    const response = await fetch(
        `${AIzaSyAmA8taIf1zkXycMFwbGAXFjzbfiolrnkY}?${params.toString()}`
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.error?.message || "YouTube search failed."
        );
    }

    return (data.items || []).map(item => ({
        id: item.id.videoId,
        title: item.snippet.title,
        artist: item.snippet.channelTitle,
        image:
            item.snippet.thumbnails.high?.url ||
            item.snippet.thumbnails.medium?.url,
        source: "youtube",
        duration: 0
    }));
}

/* =====================================================
   7. JAMENDO SEARCH
===================================================== */

async function searchJamendo(query = "") {
    const params = new URLSearchParams({
        client_id: JAMENDO_CLIENT_ID,
        format: "json",
        limit: "12",
        imagesize: "300",
        audioformat: "mp32",
        audiodownload_allowed: "true",
        order: query ? "relevance" : "popularity_week"
    });

    if (query.trim()) {
        params.set("search", query);
    }

    const response = await fetch(
        `${JAMENDO_API}?${params.toString()}`
    );

    if (!response.ok) {
        throw new Error("Jamendo search failed.");
    }

    const data = await response.json();

    if (data.headers?.status === "failed") {
        throw new Error(
            data.headers.error_message || "Jamendo API error."
        );
    }

    return (data.results || []).map(item => ({
        id: String(item.id),
        title: item.name,
        artist: item.artist_name,
        image: item.album_image || item.image,
        audio: item.audio,
        download: item.audiodownload,
        license: item.license_ccurl,
        source: "jamendo"
    }));
}

/* =====================================================
   8. TRACK CARD DESIGN
===================================================== */

function musicCard(track, index) {
    const liked = likedTracks.some(
        item => item.id === track.id &&
                item.source === track.source
    );

    return `
        <article class="card music-card"
            data-track-index="${index}">

            <div class="art">
                <img
                    src="${escapeHTML(track.image || "")}"
                    alt="${escapeHTML(track.title)}"
                    loading="lazy"
                >

                <button
                    class="play-fab"
                    data-play-index="${index}"
                    aria-label="Play ${escapeHTML(track.title)}">
                    ▶
                </button>
            </div>

            <div class="card-info">
                <h3>${escapeHTML(track.title)}</h3>
                <p>${escapeHTML(track.artist)}</p>

                <button
                    class="like-track"
                    data-like-index="${index}">
                    ${liked ? "♥" : "♡"}
                </button>
            </div>
        </article>
    `;
}

/* =====================================================
   9. RENDER SEARCH RESULTS
===================================================== */

function renderSearchResults(ytTracks, jmTracks, query) {
    if (!view) return;

    const allTracks = [...ytTracks, ...jmTracks];

    currentQueue = allTracks;
    youtubeResults = ytTracks;
    jamendoResults = jmTracks;

    view.innerHTML = `
        <section class="shelf">

            <h2>Search results</h2>

            <p class="muted">
                Results for "${escapeHTML(query)}"
            </p>

            <h3>YouTube Music</h3>

            <div class="cards">
                ${
                    ytTracks.length
                    ? ytTracks.map((track, i) =>
                        musicCard(track, i)
                    ).join("")
                    : "<p>No YouTube results found.</p>"
                }
            </div>

            <h3>Free Music from Jamendo</h3>

            <div class="cards">
                ${
                    jmTracks.length
                    ? jmTracks.map((track, i) =>
                        musicCard(track, ytTracks.length + i)
                    ).join("")
                    : "<p>No Jamendo results found.</p>"
                }
            </div>

        </section>
    `;
}

/* =====================================================
   10. SEARCH BOTH MUSIC SOURCES
===================================================== */

async function searchMusic(query) {
    query = query.trim();

    if (!query) {
        showToast("Enter a song or artist name.");
        return;
    }

    if (view) {
        view.innerHTML = `
            <h2>Searching for "${escapeHTML(query)}"...</h2>
        `;
    }

    try {
        const [ytResult, jmResult] = await Promise.allSettled([
            searchYouTube(query),
            searchJamendo(query)
        ]);

        const ytTracks =
            ytResult.status === "fulfilled"
                ? ytResult.value
                : [];

        const jmTracks =
            jmResult.status === "fulfilled"
                ? jmResult.value
                : [];

        if (
            ytResult.status === "rejected" &&
            jmResult.status === "rejected"
        ) {
            throw new Error(
                "Both music services failed. Check your API settings."
            );
        }

        renderSearchResults(
            ytTracks,
            jmTracks,
            query
        );

        if (!ytTracks.length && !jmTracks.length) {
            showToast("No songs found.");
        }

    } catch (error) {
        console.error("Search error:", error);

        if (view) {
            view.innerHTML = `
                <h2>Search unavailable</h2>
                <p>${escapeHTML(error.message)}</p>
            `;
        }
    }
}

/* =====================================================
   11. PLAY YOUTUBE MUSIC
===================================================== */

function playYouTube(track) {
    currentSource = "youtube";
    currentTrack = track;

    jamendoAudio.pause();

    updatePlayer(track);
    rememberTrack(track);

    if (!youtubeReady || !youtubePlayer) {
        loadYouTubeAPI();

        showToast(
            "YouTube player is loading. Press play again shortly."
        );

        return;
    }

    youtubePlayer.loadVideoById(track.id);
    youtubePlayer.playVideo();

    isPlaying = true;
    updatePlayButton();
}

/* =====================================================
   12. PLAY JAMENDO MUSIC
===================================================== */

function playJamendo(track) {
    if (!track.audio) {
        showToast("Audio is unavailable for this track.");
        return;
    }

    currentSource = "jamendo";
    currentTrack = track;

    if (youtubePlayer && youtubeReady) {
        youtubePlayer.stopVideo();
    }

    jamendoAudio.pause();
    jamendoAudio.src = track.audio;
    jamendoAudio.volume = vol
        ? Number(vol.value) / 100
        : 0.7;

    jamendoAudio.play()
        .then(() => {
            isPlaying = true;
            updatePlayButton();
        })
        .catch(error => {
            console.error(error);
            showToast("Unable to play this track.");
        });

    updatePlayer(track);
    rememberTrack(track);
}

/* =====================================================
   13. UNIVERSAL PLAY FUNCTION
===================================================== */

function playTrack(index) {
    const track = currentQueue[index];

    if (!track) return;

    currentIndex = index;

    if (track.source === "youtube") {
        playYouTube(track);
    } else {
        playJamendo(track);
    }
}

/* =====================================================
   14. PLAYER INFORMATION
===================================================== */

function updatePlayer(track) {
    if (pTitle) {
        pTitle.textContent = track.title;
    }

    if (pArtist) {
        pArtist.textContent = track.artist;
    }

    if (pArt) {
        pArt.src = track.image || "";
    }

    if (seek) seek.value = 0;
    if (tCur) tCur.textContent = "0:00";
    if (tDur) tDur.textContent = "0:00";
}

function updatePlayButton() {
    if (!playBtn) return;

    playBtn.textContent = isPlaying ? "Ⅱ" : "▶";
}

/* =====================================================
   15. PLAY / PAUSE
===================================================== */

function togglePlayback() {
    if (!currentTrack) {
        if (currentQueue.length) {
            playTrack(0);
        } else {
            showToast("Search for a song first.");
        }

        return;
    }

    if (currentSource === "youtube") {
        if (!youtubePlayer || !youtubeReady) return;

        if (isPlaying) {
            youtubePlayer.pauseVideo();
        } else {
            youtubePlayer.playVideo();
        }

    } else {
        if (isPlaying) {
            jamendoAudio.pause();
        } else {
            jamendoAudio.play().catch(console.error);
        }
    }

    isPlaying = !isPlaying;
    updatePlayButton();
}

/* =====================================================
   16. NEXT AND PREVIOUS
===================================================== */

function playNext() {
    if (!currentQueue.length) return;

    const next = (currentIndex + 1) % currentQueue.length;

    playTrack(next);
}

function playPrevious() {
    if (!currentQueue.length) return;

    const previous =
        (currentIndex - 1 + currentQueue.length) %
        currentQueue.length;

    playTrack(previous);
}

/* =====================================================
   17. RECENTLY PLAYED
===================================================== */

function rememberTrack(track) {
    recentlyPlayed = [
        track,
        ...recentlyPlayed.filter(
            item => !(
                item.id === track.id &&
                item.source === track.source
            )
        )
    ].slice(0, 20);

    saveData();
}

/* =====================================================
   18. LIKES
===================================================== */

function toggleLike(track) {
    const exists = likedTracks.some(
        item =>
            item.id === track.id &&
            item.source === track.source
    );

    if (exists) {
        likedTracks = likedTracks.filter(
            item =>
                !(
                    item.id === track.id &&
                    item.source === track.source
                )
        );

        showToast("Removed from liked songs.");

    } else {
        likedTracks.push(track);
        showToast("Added to liked songs.");
    }

    saveData();
    refreshLikeButtons();
}

function refreshLikeButtons() {
    $$("[data-like-index]").forEach(button => {
        const index = Number(button.dataset.likeIndex);
        const track = currentQueue[index];

        if (!track) return;

        const liked = likedTracks.some(
            item =>
                item.id === track.id &&
                item.source === track.source
        );

        button.textContent = liked ? "♥" : "♡";
    });
}

/* =====================================================
   19. HOME PAGE
===================================================== */

async function showHome() {
    if (!view) return;

    view.innerHTML = `
        <section class="shelf">
            <h2>Good music. Good moments.</h2>
            <p>Discover your next favourite sound.</p>

            <div class="tiles">
                <button class="tile" data-category="Afrobeats">
                    Afrobeats
                </button>

                <button class="tile" data-category="Chill Hits">
                    Chill Hits
                </button>

                <button class="tile" data-category="Party Vibes">
                    Party Vibes
                </button>

                <button class="tile" data-category="Love Songs">
                    Love Songs
                </button>
            </div>

            <h2>Handpicked for you</h2>
            <div id="home-music" class="cards">
                <p>Loading music...</p>
            </div>

            <h2>Recently played</h2>
            <div id="recent-music" class="cards"></div>
        </section>
    `;

    try {
        const tracks = await searchJamendo("");

        currentQueue = tracks;

        const home = $("#home-music");

        if (home) {
            home.innerHTML = tracks.map((track, index) =>
                musicCard(track, index)
            ).join("");
        }

        renderRecent();

    } catch (error) {
        console.error(error);

        const home = $("#home-music");

        if (home) {
            home.innerHTML =
                "<p>Unable to load music. Check your connection.</p>";
        }

        renderRecent();
    }
}

/* =====================================================
   20. RECENT MUSIC DISPLAY
===================================================== */

function renderRecent() {
    const recent = $("#recent-music");

    if (!recent) return;

    recent.innerHTML = recentlyPlayed.length
        ? recentlyPlayed.map((track, index) =>
            musicCard(track, index)
        ).join("")
        : "<p>Your recently played songs will appear here.</p>";
}

/* =====================================================
   21. LIKED SONGS PAGE
===================================================== */

function showLikedSongs() {
    if (!view) return;

    currentQueue = likedTracks;

    view.innerHTML = `
        <section class="shelf">
            <h2>Liked Songs ♥</h2>

            <div class="cards">
                ${
                    likedTracks.length
                    ? likedTracks.map((track, index) =>
                        musicCard(track, index)
                    ).join("")
                    : "<p>You haven't liked any songs yet.</p>"
                }
            </div>
        </section>
    `;
}

/* =====================================================
   22. FREE MUSIC PAGE
===================================================== */

async function showFreeMusic() {
    if (!view) return;

    view.innerHTML = `
        <section class="shelf">
            <h2>Free Music</h2>
            <p>Discover music from Jamendo.</p>
            <div id="free-music-grid" class="cards">
                <p>Loading free music...</p>
            </div>
        </section>
    `;

    try {
        const tracks = await searchJamendo("");

        currentQueue = tracks;

        const grid = $("#free-music-grid");

        if (grid) {
            grid.innerHTML = tracks.map((track, index) =>
                musicCard(track, index)
            ).join("");
        }

    } catch (error) {
        console.error(error);

        const grid = $("#free-music-grid");

        if (grid) {
            grid.innerHTML =
                "<p>Unable to load free music.</p>";
        }
    }
}

/* =====================================================
   23. PLAYER PROGRESS
===================================================== */

jamendoAudio.addEventListener("timeupdate", () => {
    if (currentSource !== "jamendo") return;

    const current = jamendoAudio.currentTime;
    const duration = jamendoAudio.duration || 0;

    if (tCur) tCur.textContent = formatTime(current);
    if (tDur) tDur.textContent = formatTime(duration);

    if (seek && duration) {
        seek.value = (current / duration) * 100;
    }
});

jamendoAudio.addEventListener("ended", playNext);

jamendoAudio.addEventListener("play", () => {
    isPlaying = true;
    updatePlayButton();
});

jamendoAudio.addEventListener("pause", () => {
    isPlaying = false;
    updatePlayButton();
});

if (seek) {
    seek.addEventListener("input", () => {
        if (
            currentSource === "jamendo" &&
            jamendoAudio.duration
        ) {
            jamendoAudio.currentTime =
                (Number(seek.value) / 100) *
                jamendoAudio.duration;
        }

        if (
            currentSource === "youtube" &&
            youtubeReady &&
            youtubePlayer
        ) {
            const duration = youtubePlayer.getDuration();

            if (duration) {
                youtubePlayer.seekTo(
                    (Number(seek.value) / 100) * duration,
                    true
                );
            }
        }
    });
}

/* =====================================================
   24. YOUTUBE PLAYER PROGRESS
===================================================== */

setInterval(() => {
    if (
        currentSource !== "youtube" ||
        !youtubeReady ||
        !youtubePlayer
    ) return;

    const current = youtubePlayer.getCurrentTime();
    const duration = youtubePlayer.getDuration();

    if (tCur) tCur.textContent = formatTime(current);
    if (tDur) tDur.textContent = formatTime(duration);

    if (seek && duration) {
        seek.value = (current / duration) * 100;
    }
}, 1000);

/* =====================================================
   25. VOLUME
===================================================== */

if (vol) {
    vol.addEventListener("input", () => {
        const value = Number(vol.value);

        jamendoAudio.volume = value / 100;

        if (youtubeReady && youtubePlayer) {
            youtubePlayer.setVolume(value);
        }
    });
}

/* =====================================================
   26. SEARCH EVENTS
===================================================== */

if (searchBtn) {
    searchBtn.addEventListener("click", () => {
        searchMusic(searchInput?.value || "");
    });
}

if (searchInput) {
    searchInput.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            searchMusic(searchInput.value);
        }
    });
}

if (heroSearch) {
    heroSearch.addEventListener("click", () => {
        searchMusic(searchInput?.value || "");
    });
}

/* =====================================================
   27. MUSIC CARD EVENTS
===================================================== */

document.addEventListener("click", event => {
    const playButton = event.target.closest(
        "[data-play-index]"
    );

    if (playButton) {
        const index = Number(playButton.dataset.playIndex);
        playTrack(index);
        return;
    }

    const likeButton = event.target.closest(
        "[data-like-index]"
    );

    if (likeButton) {
        const index = Number(likeButton.dataset.likeIndex);
        const track = currentQueue[index];

        if (track) toggleLike(track);
        return;
    }

    const categoryButton = event.target.closest(
        "[data-category]"
    );

    if (categoryButton) {
        const category = categoryButton.dataset.category;
        searchMusic(category);
    }
});

/* =====================================================
   28. PLAYER BUTTON EVENTS
===================================================== */

if (playBtn) {
    playBtn.addEventListener("click", togglePlayback);
}

if (nextBtn) {
    nextBtn.addEventListener("click", playNext);
}

if (prevBtn) {
    prevBtn.addEventListener("click", playPrevious);
}

/* =====================================================
   29. SIDEBAR NAVIGATION
===================================================== */

document.addEventListener("click", event => {
    const link = event.target.closest(
        "[data-page], .nav a, .bottomnav a"
    );

    if (!link) return;

    const page = (
        link.dataset.page ||
        link.textContent.trim()
    ).toLowerCase();

    if (page.includes("home")) {
        showHome();
    }

    if (page.includes("search")) {
        searchInput?.focus();
    }

    if (
        page.includes("free") ||
        page.includes("jamendo")
    ) {
        showFreeMusic();
    }

    if (
        page.includes("liked") ||
        page.includes("favorite")
    ) {
        showLikedSongs();
    }
});

/* =====================================================
   30. INITIALIZE APPLICATION
===================================================== */

loadYouTubeAPI();

showHome();

console.log("Sona Play initialized successfully.");
