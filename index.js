// ALLAN MUSIC BOT
// Public music search using iTunes Search API

const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

// Serve website files
app.use(express.static(path.join(__dirname, "public")));

// Search music
app.get("/api/search", async (req, res) => {
    const query = String(req.query.q || "").trim();

    if (!query) {
        return res.status(400).json({
            error: "Please enter a song or artist name."
        });
    }

    try {
        const url = new URL("https://itunes.apple.com/search");

        url.search = new URLSearchParams({
            term: query,
            entity: "song",
            limit: "25"
        }).toString();

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Music search service failed.");
        }

        const data = await response.json();

        const songs = data.results.map(song => ({
            id: song.trackId,
            title: song.trackName,
            artist: song.artistName,
            album: song.collectionName,
            artwork: song.artworkUrl100,
            preview: song.previewUrl || null,
            duration: song.trackTimeMillis,
            link: song.trackViewUrl
        }));

        res.json(songs);

    } catch (error) {
        console.error("Search error:", error);

        res.status(500).json({
            error: "Could not search music. Please try again."
        });
    }
});

// Start server
app.listen(PORT, "127.0.0.1", () => {
    console.log("==============================");
    console.log("🎵 ALLAN MUSIC BOT");
    console.log("Server running on port " + PORT);
    console.log("http://127.0.0.1:" + PORT);
    console.log("==============================");
});