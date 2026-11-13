// ALLAN MUSIC BOT - MUSIC SEARCH AND PLAYER

const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const results = document.getElementById("results");

const loginBtn = document.getElementById("loginBtn");

const playBtn = document.getElementById("playBtn");
const previousBtn = document.getElementById("previousBtn");
const nextBtn = document.getElementById("nextBtn");

const songTitle = document.getElementById("songTitle");
const artistName = document.getElementById("artistName");

const audio = new Audio();
audio.volume = 0.5;

let songs = [];
let currentIndex = -1;
let isPlaying = false;

// SEARCH MUSIC
searchBtn.addEventListener("click", searchMusic);

searchInput.addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
        searchMusic();
    }
});

async function searchMusic() {
    const query = searchInput.value.trim();

    if (!query) {
        results.textContent = "Please enter a song name.";
        return;
    }

    results.textContent = "Searching for music... 🎵";

    try {
        const response = await fetch(
            "/api/search?q=" + encodeURIComponent(query)
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Search failed.");
        }

        songs = data;
        currentIndex = -1;

        renderSongs();

    } catch (error) {
        results.textContent = error.message;
    }
}

// DISPLAY SEARCH RESULTS
function renderSongs() {
    results.replaceChildren();

    if (songs.length === 0) {
        results.textContent = "No songs found.";
        return;
    }

    songs.forEach((song, index) => {

        const card = document.createElement("div");
        card.className = "track-card";

        const image = document.createElement("img");
        image.src = song.artwork || "";
        image.alt = "Album artwork";
        image.loading = "lazy";

        const title = document.createElement("h3");
        title.textContent = song.title;

        const artist = document.createElement("p");
        artist.textContent = song.artist;

        const button = document.createElement("button");
        button.textContent = song.preview ? "▶ Play Preview" : "Preview unavailable";
        button.disabled = !song.preview;

        button.addEventListener("click", () => {
            playSong(index);
        });

        card.append(image, title, artist, button);
        results.appendChild(card);
    });
}

// PLAY A SONG
async function playSong(index) {
    const song = songs[index];

    if (!song || !song.preview) return;

    currentIndex = index;

    audio.src = song.preview;

    songTitle.textContent = song.title;
    artistName.textContent = song.artist;

    try {
        await audio.play();
        isPlaying = true;
        playBtn.textContent = "⏸";
    } catch (error) {
        console.error("Playback error:", error);
        isPlaying = false;
        playBtn.textContent = "▶";
    }
}

// PLAY AND PAUSE
playBtn.addEventListener("click", async () => {

    if (!audio.src) {
        if (currentIndex >= 0) {
            await playSong(currentIndex);
        } else if (songs.length > 0) {
            await playSong(0);
        }
        return;
    }

    if (audio.paused) {
        try {
            await audio.play();
            isPlaying = true;
            playBtn.textContent = "⏸";
        } catch (error) {
            console.error(error);
        }
    } else {
        audio.pause();
        isPlaying = false;
        playBtn.textContent = "▶";
    }
});

// NEXT SONG
nextBtn.addEventListener("click", () => {
    if (songs.length === 0) return;

    let next = currentIndex + 1;

    if (next >= songs.length) next = 0;

    playSong(next);
});

// PREVIOUS SONG
previousBtn.addEventListener("click", () => {
    if (songs.length === 0) return;

    let previous = currentIndex - 1;

    if (previous < 0) previous = songs.length - 1;

    playSong(previous);
});

// AUTOMATICALLY MOVE TO NEXT SONG
audio.addEventListener("ended", () => {
    if (songs.length > 0) {
        let next = currentIndex + 1;

        if (next >= songs.length) next = 0;

        playSong(next);
    }
});

// VOLUME CONTROL
const volumeInput = document.querySelector(".volume input");

volumeInput.addEventListener("input", () => {
    audio.volume = Number(volumeInput.value) / 100;
});

// SPOTIFY CONNECTION NOTICE
loginBtn.addEventListener("click", () => {
    alert("Spotify integration will be added separately.");
});

console.log("🎵 Allan Music Bot is ready!");