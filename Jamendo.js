/* Sona Play: Jamendo "Free to download" section
 *
 * Setup:
 * 1. Register at https://devportal.jamendo.com and create an app to get a client ID.
 * 2. Paste it into JAMENDO_CLIENT_ID below.
 * 3. In index.html add:  <div id="jamendo-section"></div>
 *    and before </body>:  <script src="jamendo.js"></script>
 *
 * Non-commercial use only on the free API key. Keep the artist name and
 * license link visible on every track (this file does that).
 */

const JAMENDO_CLIENT_ID = "0891ffca";
const JAMENDO_API = "https://api.jamendo.com/v3.0/tracks/";

(function () {
  const root = document.getElementById("jamendo-section");
  if (!root) return;

  // ---- Markup + minimal styles (adjust colors to match Sona Play) ----
  root.innerHTML = `
    <style>
      .jm-wrap { padding: 16px; }
      .jm-head { display:flex; flex-wrap:wrap; gap:8px; align-items:center; justify-content:space-between; margin-bottom:12px; }
      .jm-head h2 { margin:0; font-size:1.25rem; }
      .jm-sub { opacity:.7; font-size:.85rem; margin:0 0 12px; }
      .jm-form { display:flex; gap:8px; }
      .jm-form input { padding:8px 12px; border-radius:20px; border:1px solid #444; background:transparent; color:inherit; min-width:180px; }
      .jm-form button { padding:8px 14px; border-radius:20px; border:0; cursor:pointer; background:#1db954; color:#000; font-weight:600; }
      .jm-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:14px; }
      .jm-card { background:rgba(255,255,255,.06); border-radius:10px; padding:10px; display:flex; flex-direction:column; gap:6px; }
      .jm-card img { width:100%; aspect-ratio:1; object-fit:cover; border-radius:8px; background:#222; }
      .jm-title { font-weight:600; font-size:.9rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .jm-artist { font-size:.8rem; opacity:.7; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .jm-actions { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
      .jm-actions button, .jm-actions a { font-size:.78rem; padding:5px 10px; border-radius:14px; border:0; cursor:pointer; text-decoration:none; background:#1db954; color:#000; font-weight:600; }
      .jm-actions a.jm-dl { background:#fff; color:#000; border:0; }
      .jm-lic { font-size:.7rem; opacity:.6; }
      .jm-lic a { color:inherit; }
      .jm-status { padding:12px 0; opacity:.8; }
      .jm-player { position:sticky; bottom:0; padding:8px 0; }
      .jm-player audio { width:100%; }
    </style>
    <div class="jm-wrap">
      <div class="jm-head">
        <h2>Free to download</h2>
        <form class="jm-form" id="jm-form">
          <input id="jm-q" type="search" placeholder="Search independent artists" />
          <button type="submit">Search</button>
        </form>
      </div>
      <p class="jm-sub">Independent artists on Jamendo. Free to stream and download under Creative Commons licenses.</p>
      <div class="jm-status" id="jm-status"></div>
      <div class="jm-grid" id="jm-grid"></div>
      <div class="jm-player"><audio id="jm-audio" controls preload="none"></audio></div>
    </div>`;

  const grid = root.querySelector("#jm-grid");
  const statusEl = root.querySelector("#jm-status");
  const audio = root.querySelector("#jm-audio");
  const form = root.querySelector("#jm-form");
  const input = root.querySelector("#jm-q");

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Small cache so repeated searches don't hit the API again
  const cache = new Map();

  async function fetchTracks(query) {
    const key = query || "__popular__";
    if (cache.has(key)) return cache.get(key);

    const params = new URLSearchParams({
      client_id: JAMENDO_CLIENT_ID,
      format: "json",
      limit: "24",
      imagesize: "300",
      audioformat: "mp32",
      audiodownload_allowed: "true",
    });
    if (query) params.set("search", query);
    else params.set("order", "popularity_week");

    const res = await fetch(`${JAMENDO_API}?${params}`);
    if (!res.ok) throw new Error("Jamendo request failed (" + res.status + ")");
    const data = await res.json();
    if (data.headers && data.headers.status === "failed") {
      throw new Error(data.headers.error_message || "Jamendo error");
    }
    cache.set(key, data.results || []);
    return cache.get(key);
  }

  function render(tracks) {
    if (!tracks.length) {
      grid.innerHTML = "";
      statusEl.textContent = "No free tracks found. Try another search.";
      return;
    }
    statusEl.textContent = "";
    grid.innerHTML = tracks
      .map(
        (t, i) => `
        <div class="jm-card">
          <img src="${esc(t.image || t.album_image)}" alt="" loading="lazy" />
          <div class="jm-title" title="${esc(t.name)}">${esc(t.name)}</div>
          <div class="jm-artist" title="${esc(t.artist_name)}">${esc(t.artist_name)}</div>
          <div class="jm-actions">
            <button data-i="${i}">Play</button>
            ${t.audiodownload_allowed && t.audiodownload ? `<a class="jm-dl" href="${esc(t.audiodownload)}" download="${esc(t.artist_name)} - ${esc(t.name)}.mp3" target="_blank" rel="noopener">&#8595; Download</a>` : ""}
          </div>
          <div class="jm-lic">${t.license_ccurl ? `<a href="${esc(t.license_ccurl)}" target="_blank" rel="noopener">License</a>` : ""}</div>
        </div>`
      )
      .join("");

    grid.querySelectorAll("button[data-i]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const t = tracks[Number(btn.dataset.i)];
        audio.src = t.audio;
        audio.play().catch(() => {});
      });
    });
  }

  async function load(query) {
    if (JAMENDO_CLIENT_ID === "YOUR_CLIENT_ID_HERE") {
      statusEl.textContent = "Add your Jamendo client ID in jamendo.js to enable this section.";
      return;
    }
    statusEl.textContent = "Loading...";
    try {
      render(await fetchTracks(query));
    } catch (err) {
      grid.innerHTML = "";
      statusEl.textContent = "Could not load tracks. " + err.message;
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    load(input.value.trim());
  });

  load(""); // show this week's popular tracks first
})();