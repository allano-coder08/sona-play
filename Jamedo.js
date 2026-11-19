/* Sona Play — Jamendo integration
 * Jamendo client IDs are public identifiers, not secret API keys.
 * Downloads are s when Jamendo reports audiodownload_allowed=true
 * and provides an audiohown onlydownload URL. Keep the attribution and license visible.
 */
(function () {
  "use strict";

  const CLIENT_ID = "0891ffca";
  const API = "https://api.jamendo.com/v3.0/tracks/";
  const root = document.getElementById("jamendo-section");
  if (!root) return;

  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));

  const cache = new Map();
  let visibleTracks = [];
  let requestNumber = 0;

  root.innerHTML = `
    <section class="jm-wrap" aria-labelledby="jm-heading">
      <div class="jm-head">
        <div>
          <p class="jm-eyebrow">Independent artists</p>
          <h2 id="jm-heading">Free music to discover</h2>
        </div>
        <form class="jm-form" id="jm-form" role="search">
          <input id="jm-q" type="search" placeholder="Search free music" aria-label="Search Jamendo music" autocomplete="off">
          <button type="submit">Search</button>
        </form>
      </div>
      <p class="jm-sub">Explore independent music. Download only tracks marked as available, and check each track's license.</p>
      <div class="jm-status" id="jm-status" role="status" aria-live="polite">Loading free music…</div>
      <div class="jm-grid" id="jm-grid"></div>
    </section>`;

  const grid = root.querySelector("#jm-grid");
  const status = root.querySelector("#jm-status");
  const form = root.querySelector("#jm-form");
  const input = root.querySelector("#jm-q");

  function normalize(track) {
    const downloadable = String(track.audiodownload_allowed).toLowerCase() === "true" && Boolean(track.audiodownload);
    return {
      id: `jamendo:${track.id}`,
      jamendoId: String(track.id),
      source: "jamendo",
      title: track.name || "Untitled track",
      artist: track.artist_name || "Independent artist",
      thumb: track.image || track.album_image || "",
      audio: track.audio || "",
      download: downloadable ? track.audiodownload : "",
      license: track.license_ccurl || ""
    };
  }

  async function search(query = "", limit = 20) {
    const q = String(query || "").trim();
    const key = `${q.toLowerCase()}|${limit}`;
    if (cache.has(key)) return cache.get(key);

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      format: "json",
      limit: String(Math.min(Math.max(limit, 1), 50)),
      imagesize: "300",
      audioformat: "mp32",
      audiodownload_allowed: "true",
      include: "musicinfo"
    });
    if (q) params.set("search", q);
    else params.set("order", "popularity_week");

    const response = await fetch(`${API}?${params.toString()}`);
    if (!response.ok) throw new Error(`Jamendo request failed (${response.status}).`);
    const payload = await response.json();
    if (payload.headers?.status === "failed") {
      throw new Error(payload.headers.error_message || "Jamendo could not complete the search.");
    }
    const tracks = (payload.results || []).map(normalize);
    cache.set(key, tracks);
    return tracks;
  }

  function card(track, index) {
    const image = track.thumb || "";
    return `<article class="jm-card">
      <div class="jm-art">${image ? `<img src="${esc(image)}" alt="Cover for ${esc(track.title)}" loading="lazy">` : `<span aria-hidden="true">♪</span>`}</div>
      <div class="jm-title" title="${esc(track.title)}">${esc(track.title)}</div>
      <div class="jm-artist" title="${esc(track.artist)}">${esc(track.artist)}</div>
      <div class="jm-actions">
        <button type="button" class="jm-play" data-jm-home-play="${index}">▶ Play</button>
        ${track.download ? `<a class="jm-dl" href="${esc(track.download)}" target="_blank" rel="noopener noreferrer" aria-label="Download ${esc(track.title)}">↓ Download</a>` : `<span class="jm-unavailable">Download unavailable</span>`}
      </div>
      <div class="jm-lic">${track.license ? `License: <a href="${esc(track.license)}" target="_blank" rel="noopener noreferrer">View terms</a>` : "Check the artist's license terms"}</div>
    </article>`;
  }

  function render(tracks) {
    visibleTracks = tracks;
    grid.innerHTML = tracks.map(card).join("");
    status.textContent = tracks.length ? `${tracks.length} tracks found on Jamendo.` : "No tracks found. Try a different search.";
  }

  async function load(query = "") {
    const request = ++requestNumber;
    status.textContent = "Searching Jamendo…";
    grid.innerHTML = "";
    try {
      const tracks = await search(query, 24);
      if (request !== requestNumber) return;
      render(tracks);
    } catch (error) {
      if (request !== requestNumber) return;
      status.textContent = `Could not load Jamendo music. ${error.message}`;
    }
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    load(input.value);
  });

  grid.addEventListener("click", event => {
    const button = event.target.closest("[data-jm-home-play]");
    if (!button) return;
    const index = Number(button.dataset.jmHomePlay);
    const track = visibleTracks[index];
    if (!track) return;
    if (window.SonaPlayer?.playJamendo) window.SonaPlayer.playJamendo(track, visibleTracks, index);
    else status.textContent = "The music player is still loading. Try again in a moment.";
  });

  // Public interface used by the combined YouTube + Jamendo search in script.js.
  window.SonaJamendo = { search };
  load("");
})();
