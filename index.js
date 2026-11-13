const express = require("express");

const app = express();

app.use(express.json());

// Homepage
app.get("/", (req, res) => {
    res.sendFile(
        require("path").join(__dirname, "public", "index.html")
    );
});

// Music search API
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
            throw new Error("Music search failed.");
        }

        const data = await response.json();

        const songs = (data.results || []).map(song => ({
            id: song.trackId,
            title: song.trackName,
            artist: song.artistName,
            album: song.collectionName,
            artwork: song.artworkUrl100,
            preview: song.previewUrl || null,
            link: song.trackViewUrl
        }));

        return res.status(200).json(songs);

    } catch (error) {
        console.error("Music search error:", error);

        return res.status(500).json({
            error: "Music search is temporarily unavailable."
        });
    }
});

// Export application
module.exports = app;