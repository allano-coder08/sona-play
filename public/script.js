/* ==========================================
   ALLAN MUSIC BOT
   MUSIC SEARCH AND PLAYER
========================================== */

// 1. GET HTML ELEMENTS

const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const results = document.getElementById("results");

const loginBtn = document.getElementById("loginBtn");

const playBtn = document.getElementById("playBtn");
const previousBtn = document.getElementById("previousBtn");
const nextBtn = document.getElementById("nextBtn");

const songTitle = document.getElementById("songTitle");
const artistName = document.getElementById("artistName");

const volumeInput = document.querySelector(".volume input");


// 2. AUDIO SETTINGS

const audio = new Audio();

audio.volume = 0.5;

let songs = [];
let currentIndex = -1;
let isSearching = false;

let searchController = null;


// 3. HELPER FUNCTION

function showMessage(message) {
    results.replaceChildren();

    const paragraph = document.createElement("p");
    paragraph.textContent = message;

    results.appendChild(paragraph);
}


// 4. SEARCH MUSIC

if (searchBtn && searchInput) {

    searchBtn.addEventListener("click", searchMusic);

    searchInput.addEventListener("keydown", function(event) {

        if (event.key === "Enter") {
            event.preventDefault();
            searchMusic();
        }

    });

}


async function searchMusic() {

    const query = searchInput.value.trim();

    if (!query) {
        showMessage("Please enter a song name or artist.");
        searchInput.focus();
        return;
    }

    // Cancel an earlier search if still running

    if (searchController) {
        searchController.abort();
    }

    searchController = new AbortController();

    const currentController = searchController;

    isSearching = true;

    searchBtn.disabled = true;
    searchBtn.textContent = "Searching...";

    showMessage("Searching for your favourite music... 🎵");

    try {

        const response = await fetch(
            "/api/search?q=" + encodeURIComponent(query),
            {
                method: "GET",
                headers: {
                    "Accept": "application/json"
                },
                signal: currentController.signal
            }
        );

        // Check HTTP response

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

        // Read API response

        const data = await response.json();

        // Ensure response is an array

        if (!Array.isArray(data)) {
            throw new Error(
                "Unexpected response from music server. Please check the API."
            );
        }

        // Ignore outdated searches

        if (currentController !== searchController) return;

        songs = data;
        currentIndex = -1;

        renderSongs();

    }

    catch (error) {

        if (error.name === "AbortError") {
            return;
        }

        console.error("Music search error:", error);

        showMessage(
            "Unable to search music. " +
            error.message +
            " Please try again."
        );

    }

    finally {

        if (currentController === searchController) {

            isSearching = false;

            searchBtn.disabled = false;
            searchBtn.textContent = "Search";

        }

    }

}


// 5. DISPLAY SEARCH RESULTS

function renderSongs() {

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

        image.src = song.artwork || "https://placehold.co/300x300/171d19/8cff00?text=Music";

        image.alt = `${song.title || "Song"} artwork`;

        image.loading = "lazy";

        image.onerror = function() {
            this.src = "https://placehold.co/300x300/171d19/8cff00?text=Music";
        };


        // Song title

        const title = document.createElement("h3");

        title.textContent = song.title || "Unknown Song";


        // Artist name

        const artist = document.createElement("p");

        artist.textContent = song.artist || "Unknown Artist";


        // Play button

        const button = document.createElement("button");

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


// 6. PLAY A SONG

async function playSong(index) {

    const song = songs[index];

    if (!song || !song.preview) {
        return;
    }

    currentIndex = index;

    audio.src = song.preview;

    songTitle.textContent = song.title || "Unknown Song";

    artistName.textContent = song.artist || "Unknown Artist";

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


// 7. UPDATE PLAY BUTTON

function updatePlayButton() {

    if (!playBtn) return;

    playBtn.innerHTML = isPlaying
        ? '<i class="fas fa-pause"></i>'
        : '<i class="fas fa-play"></i>';

}


// 8. PLAY AND PAUSE

if (playBtn) {

    playBtn.addEventListener("click", async function() {

        if (!audio.src) {

            if (songs.length > 0) {
                await playSong(0);
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

            }

        }

        else {

            audio.pause();

            isPlaying = false;

        }

        updatePlayButton();

    });

}


// 9. NEXT SONG

if (nextBtn) {

    nextBtn.addEventListener("click", function() {

        if (!songs.length) return;

        let next = currentIndex + 1;

        if (next >= songs.length) {
            next = 0;
        }

        playSong(next);

    });

}


// 10. PREVIOUS SONG

if (previousBtn) {

    previousBtn.addEventListener("click", function() {

        if (!songs.length) return;

        let previous = currentIndex - 1;

        if (previous < 0) {
            previous = songs.length - 1;
        }

        playSong(previous);

    });

}


// 11. AUTOMATICALLY PLAY NEXT SONG

audio.addEventListener("ended", function() {

    if (!songs.length) return;

    let next = currentIndex + 1;

    if (next >= songs.length) {
        next = 0;
    }

    playSong(next);

});


// 12. HANDLE AUDIO EVENTS

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


// 13. VOLUME CONTROL

if (volumeInput) {

    volumeInput.addEventListener("input", function() {

        audio.volume = Number(volumeInput.value) / 100;

    });

}


// 14. SPOTIFY CONNECTION

if (loginBtn) {

    loginBtn.addEventListener("click", function() {

        alert("Spotify integration will be added separately.");

    });

}


// 15. INITIALIZE APPLICATION

console.log("🎵 Allan Music Bot initialized successfully!");