```javascript
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

const volumeInput =
    document.getElementById("volumeControl") ||
    document.querySelector(".volume input");


// 2. AUDIO SETTINGS

const audio = new Audio();

audio.volume = 0.5;

let songs = [];
let currentIndex = -1;
let isPlaying = false;
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

    if (resultsSection) {

        resultsSection.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    } else if (results) {

        results.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    }
}


function updatePlayButton() {

    if (!playBtn) return;

    playBtn.innerHTML = isPlaying
        ? '<i class="fas fa-pause"></i>'
        : '<i class="fas fa-play"></i>';

}


// 4. SEARCH BUTTON EVENTS

if (searchBtn) {

    searchBtn.addEventListener("click", searchMusic);

}

if (searchInput) {

    searchInput.addEventListener("keydown", function(event) {

        if (event.key === "Enter") {

            event.preventDefault();

            searchMusic();

        }

    });

}


// 5. SEARCH MUSIC FUNCTION

async function searchMusic(query = null) {

    if (!searchInput || !results) return;

    const searchQuery = (
        query !== null ? query : searchInput.value
    ).trim();

    if (!searchQuery) {

        showMessage("Please enter a song name or artist.");

        searchInput.focus();

        return;

    }

    // Put the selected search term in the input

    searchInput.value = searchQuery;

    // Cancel previous search

    if (searchController) {

        searchController.abort();

    }

    searchController = new AbortController();

    const currentController = searchController;

    if (searchBtn) {

        searchBtn.disabled = true;
        searchBtn.textContent = "Searching...";

    }

    showMessage("Searching for your favourite music... 🎵");

    // Show results section near the top of the page

    showSearchSection();

    try {

        const response = await fetch(
            "/api/search?q=" + encodeURIComponent(searchQuery),
            {
                method: "GET",

                headers: {
                    "Accept": "application/json"
                },

                signal: currentController.signal
            }
        );

        if (!response.ok) {

            let errorMessage = `Search failed (${response.status}).`;

            try {

                const errorData = await response.json();

                if (errorData.error) {

                    errorMessage = errorData.error;

                }

            } catch (error) {

                console.warn("Could not read API error response.");

            }

            throw new Error(errorMessage);

        }

        const data = await response.json();

        if (!Array.isArray(data)) {

            throw new Error(
                "Unexpected response from music server. Please check the API."
            );

        }

        // Ignore outdated search results

        if (currentController !== searchController) return;

        songs = data;

        currentIndex = -1;

        renderSongs();

    }

    catch (error) {

        if (error.name === "AbortError") return;

        console.error("Music search error:", error);

        showMessage(
            "Unable to search music. " +
            error.message +
            " Please try again."
        );

    }

    finally {

        if (currentController === searchController) {

            if (searchBtn) {

                searchBtn.disabled = false;
                searchBtn.textContent = "Search";

            }

        }

    }

}


// 6. FIND YOUR VIBE BUTTONS

// Works with buttons containing:
// data-vibe="afrobeats"
// data-vibe="chill hits"
// data-vibe="party music"
// data-vibe="love songs"

document.querySelectorAll("[data-vibe]").forEach(button => {

    button.addEventListener("click", function() {

        const vibe = this.dataset.vibe;

        if (vibe) {

            searchMusic(vibe);

        }

    });

});


// 7. HANDPICKED AND PLAYLIST BUTTONS

// Works with:
// data-search="popular new songs"
// data-search="afrobeats"
// data-search="chill music"

document.querySelectorAll("[data-search]").forEach(button => {

    button.addEventListener("click", function() {

        const query = this.dataset.search;

        if (query) {

            searchMusic(query);

        }

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

    songs.forEach((song, index) => {

        const card = document.createElement("div");

        card.className = "track-card";


        // Album artwork

        const image = document.createElement("img");

        image.src = song.artwork ||
            "https://placehold.co/300x300/20243a/ffffff?text=Music";

        image.alt = `${song.title || "Song"} artwork`;

        image.loading = "lazy";

        image.onerror = function() {

            this.onerror = null;

            this.src =
                "https://placehold.co/300x300/20243a/ffffff?text=Music";

        };


        // Song title

        const title = document.createElement("h3");

        title.textContent = song.title || "Unknown Song";


        // Artist

        const artist = document.createElement("p");

        artist.textContent = song.artist || "Unknown Artist";


        // Play preview button

        const button = document.createElement("button");

        button.className = "track-play-btn";

        button.textContent = song.preview
            ? "▶ Play Preview"
            : "Preview unavailable";

        button.disabled = !song.preview;

        button.addEventListener("click", function() {

            playSong(index);

        });


        card.append(
            image,
            title,
            artist,
            button
        );

        results.appendChild(card);

    });

}


// 9. PLAY A SONG

async function playSong(index) {

    const song = songs[index];

    if (!song || !song.preview) return;

    currentIndex = index;

    audio.pause();

    audio.src = song.preview;

    audio.load();

    if (songTitle) {

        songTitle.textContent =
            song.title || "Unknown Song";

    }

    if (artistName) {

        artistName.textContent =
            song.artist || "Unknown Artist";

    }

    try {

        await audio.play();

        isPlaying = true;

        updatePlayButton();

    }

    catch (error) {

        console.error("Playback error:", error);

        isPlaying = false;

        updatePlayButton();

    }

}


// 10. PLAY AND PAUSE

if (playBtn) {

    playBtn.addEventListener("click", async function() {

        if (!audio.src) {

            if (songs.length > 0) {

                const firstPlayableSong = songs.findIndex(
                    song => song.preview
                );

                if (firstPlayableSong !== -1) {

                    await playSong(firstPlayableSong);

                }

            }

            return;

        }

        if (audio.paused) {

            try {

                await audio.play();

                isPlaying = true;

            }

            catch (error) {

                console.error("Playback error:", error);

                isPlaying = false;

            }

        } else {

            audio.pause();

            isPlaying = false;

        }

        updatePlayButton();

    });

}


// 11. NEXT SONG

if (nextBtn) {

    nextBtn.addEventListener("click", function() {

        if (!songs.length) return;

        let next = currentIndex + 1;

        if (next >= songs.length) {

            next = 0;

        }

        // Skip songs without previews

        let attempts = 0;

        while (!songs[next].preview && attempts < songs.length) {

            next = (next + 1) % songs.length;

            attempts++;

        }

        if (songs[next].preview) {

            playSong(next);

        }

    });

}


// 12. PREVIOUS SONG

if (previousBtn) {

    previousBtn.addEventListener("click", function() {

        if (!songs.length) return;

        let previous = currentIndex - 1;

        if (previous < 0) {

            previous = songs.length - 1;

        }

        // Skip songs without previews

        let attempts = 0;

        while (!songs[previous].preview && attempts < songs.length) {

            previous = (previous - 1 + songs.length) % songs.length;

            attempts++;

        }

        if (songs[previous].preview) {

            playSong(previous);

        }

    });

}


// 13. AUTOMATICALLY PLAY NEXT SONG

audio.addEventListener("ended", function() {

    if (!songs.length) return;

    let next = currentIndex + 1;

    if (next >= songs.length) {

        next = 0;

    }

    let attempts = 0;

    while (!songs[next].preview && attempts < songs.length) {

        next = (next + 1) % songs.length;

        attempts++;

    }

    if (songs[next].preview) {

        playSong(next);

    }

});


// 14. AUDIO EVENTS

audio.addEventListener("play", function() {

    isPlaying = true;

    updatePlayButton();

});


audio.addEventListener("pause", function() {

    isPlaying = false;

    updatePlayButton();

});


audio.addEventListener("error", function() {

    isPlaying = false;

    updatePlayButton();

    console.error("The audio preview could not be loaded.");

});


// 15. VOLUME CONTROL

if (volumeInput) {

    // Set the slider to match the initial audio volume

    volumeInput.value = audio.volume * 100;

    volumeInput.addEventListener("input", function() {

        audio.volume = Number(this.value) / 100;

    });

}


// 16. SPOTIFY CONNECTION

if (loginBtn) {

    loginBtn.addEventListener("click", function() {

        alert("Spotify integration will be added separately.");

    });

}


// 17. INITIALIZE APPLICATION

updatePlayButton();

console.log("🎵 Allan Music Bot initialized successfully!");
```