const path = require("path");
const express = require("express");

// Loads YOUTUBE_API_KEY from your local .env file.
// On Vercel the key comes from Settings > Environment Variables instead.
try {
    require("dotenv").config();
} catch (error) {
    // dotenv is not installed; that is fine on Vercel.
}

const app = express();

app.use(express.json());

// Serve style.css, script.js and images from the public folder
app.use(express.static(path.join(__dirname, "public")));

// Homepage
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Turns things like "&amp;" and "&#39;" from YouTube into normal text
function decodeEntities(text) {
    return String(text || "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

// Music search API (YouTube: full songs)
app.get("/api/search", async (req, res) => {
    const query = String(req.query.q || "").trim().slice(0, 100);

    if (!query) {
        return res.status(400).json({
            error: "Please enter a song or artist name."
        });
    }

    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
        console.error("YOUTUBE_API_KEY is missing.");

        return res.status(500).json({
            error: "Music search is not set up yet (missing API key)."
        });
    }

    try {
        const url = new URL("https://www.googleapis.com/youtube/v3/search");

        url.search = new URLSearchParams({
            part: "snippet",
            type: "video",
            videoCategoryId: "10",       // Music
            videoEmbeddable: "true",
            videoSyndicated: "true",
            safeSearch: "moderate",
            maxResults: "20",
            q: query,
            key: apiKey
        }).toString();

        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            const reason =
                data.error && data.error.errors && data.error.errors[0]
                    ? data.error.errors[0].reason
                    : "";

            console.error("YouTube API error:", data.error);

            if (reason === "quotaExceeded" || reason === "rateLimitExceeded") {
                return res.status(429).json({
                    error: "Daily search limit reached. Please try again tomorrow."
                });
            }

            throw new Error("Music search failed.");
        }

        const songs = (data.items || [])
            .filter(item => item.id && item.id.videoId)
            .map(item => ({
                id: item.id.videoId,
                title: decodeEntities(item.snippet.title),
                artist: decodeEntities(item.snippet.channelTitle)
                    .replace(/ - Topic$/, ""),
                artwork:
                    "https://i.ytimg.com/vi/" + item.id.videoId + "/mqdefault.jpg"
            }));

        // Cache identical searches for an hour to save your daily quota
        res.set("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");

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