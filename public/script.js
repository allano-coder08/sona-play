/* ==========================================
   ALLAN MUSIC BOT
   MUSIC SEARCH AND PLAYER
========================================== */

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


// 2. AUDIO SETTINGS

const audio = new Audio();
audio.volume = 0.5;

let songs = [];
let currentIndex = -1;
let searchController = null;


// 3. HELPER FUNCTIONS

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

    const playing = !audio.paused && !audio.ended;

    playBtn.innerHTML = playing
        ? '<i class="fas fa-pause" aria-hidden="true"></i>'
        : '<i class="fas fa-play" aria-hidden="true"></i>';

    playBtn.setAttribute("aria-label", playing ? "Pause" : "Play");
}

function highlightCurrentTrack() {
    document.querySelectorAll(".track-card").forEach(function (card, i) {
        card.classList.toggle("playing", i === currentIndex);
    });
}

// Finds the next song with a preview, moving forward (1) or backward (-1).
function findPlayable(start, step) {
    if (!songs.length) return -1;

    let index = start;

    for (let attempts = 0; attempts < songs.length; attempts++) {
        index = (index + step + songs.length) % songs.length;

        if (songs[index].preview) return index;
    }

    return -1;
}


// 4. SEARCH EVENTS
// NOTE: the click handler is wrapped so the click event is NOT passed in as
// the "query" argument (that was crashing with "query.trim is not a function").

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


// 5. FETCH SONGS
// Tries your own backend first (/api/search). If it is not available
// (for example on static hosting) it falls back to the public iTunes
// Search API, which needs no key and returns 30-second previews.

function normalizeSong(item) {
    return {
        title: item.title || item.trackName || "",
        artist: item.artist || item.artistName || "",
        artwork: item.artwork || item.artworkUrl100 || "",
        preview: item.preview || item.previewUrl || ""
    };
}

async function fetchFromBackend(query, signal) {
    const response = await fetch(
        "/api/search?q=" + encodeURIComponent(query),
        { headers: { Accept: "application/json" }, signal }
    );

    const type = response.headers.get("content-type") || "";

    if (!response.ok || !type.includes("application/json")) {
        throw new Error("Backend search unavailable (" + response.status + ").");
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
        throw new Error("Unexpected response from music server.");
    }

    return data.map(normalizeSong);
}

async function fetchFromItunes(query, signal) {
    const url =
        "https://itunes.apple.com/search?media=music&entity=song&limit=24&term=" +
        encodeURIComponent(query);

    const response = await fetch(url, { signal });

    if (!response.ok) {
        throw new Error("Search failed (" + response.status + ").");
    }

    const data = await response.json();

    return (data.results || []).map(function (item) {
        const song = normalizeSong(item);
        // Request a larger cover image
        song.artwork = song.artwork.replace("100x100", "300x300");
        return song;
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
        let found;

        try {
            found = await fetchFromBackend(searchQuery, currentController.signal);
        } catch (backendError) {
            if (backendError.name === "AbortError") throw backendError;

            console.warn("Backend search failed, using iTunes:", backendError.message);

            found = await fetchFromItunes(searchQuery, currentController.signal);
        }

        // Ignore outdated results
        if (currentController !== searchController) return;

        songs = found;
        currentIndex = -1;

        renderSongs();
    } catch (error) {
        if (error.name === "AbortError") return;

        console.error("Music search error:", error);

        showMessage("Unable to search music. " + error.message + " Please try again.");
    } finally {
        if (currentController === searchController && searchBtn) {
            searchBtn.disabled = false;
            searchBtn.textContent = "Search";
        }
    }
}


// 6. VIBE, FEATURED AND PLAYLIST BUTTONS
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


// 7. DISPLAY SEARCH RESULTS

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
        button.textContent = song.preview ? "▶ Play Preview" : "Preview unavailable";
        button.disabled = !song.preview;

        button.addEventListener("click", function () {
            playSong(index);
        });

        card.append(image, title, artist, button);
        results.appendChild(card);
    });
}


// 8. PLAY A SONG

async function playSong(index) {
    const song = songs[index];

    if (!song || !song.preview) return;

    currentIndex = index;

    audio.src = song.preview;

    if (songTitle) songTitle.textContent = song.title || "Unknown Song";
    if (artistName) artistName.textContent = song.artist || "Unknown Artist";

    highlightCurrentTrack();

    try {
        await audio.play();
    } catch (error) {
        // AbortError just means another song was selected quickly - not a real failure.
        if (error.name !== "AbortError") {
            console.error("Playback error:", error);
        }
    }

    updatePlayButton();
}


// 9. PLAY / PAUSE

if (playBtn) {
    playBtn.addEventListener("click", async function () {
        if (!audio.src) {
            const first = songs.findIndex(function (song) {
                return song.preview;
            });

            if (first !== -1) await playSong(first);

            return;
        }

        if (audio.paused) {
            try {
                await audio.play();
            } catch (error) {
                if (error.name !== "AbortError") {
                    console.error("Playback error:", error);
                }
            }
        } else {
            audio.pause();
        }

        updatePlayButton();
    });
}


// 10. NEXT / PREVIOUS / AUTO-ADVANCE

function playNext() {
    const next = findPlayable(currentIndex, 1);

    if (next !== -1) playSong(next);
}

function playPrevious() {
    // Start of a song? restart it. Otherwise go back one.
    if (audio.currentTime > 3) {
        audio.currentTime = 0;
        return;
    }

    const previous = findPlayable(currentIndex === -1 ? 0 : currentIndex, -1);

    if (previous !== -1) playSong(previous);
}

if (nextBtn) nextBtn.addEventListener("click", playNext);
if (previousBtn) previousBtn.addEventListener("click", playPrevious);

audio.addEventListener("ended", playNext);


// 11. AUDIO EVENTS (keep the button in sync with the real audio state)

audio.addEventListener("play", updatePlayButton);
audio.addEventListener("pause", updatePlayButton);

audio.addEventListener("error", function () {
    updatePlayButton();
    console.error("The audio preview could not be loaded.");

    if (songTitle) songTitle.textContent = "Preview could not be loaded";
});


// 12. VOLUME

if (volumeInput) {
    volumeInput.value = audio.volume * 100;

    volumeInput.addEventListener("input", function () {
        audio.volume = Number(this.value) / 100;
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