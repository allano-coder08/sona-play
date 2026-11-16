/* ============================================================
   Sona Play — Spotify-style UI
   1) Put your YouTube Data API v3 key below.
   2) Everything (favourites, playlists, profile) is saved in the
      browser's localStorage, so no backend is needed.
   ============================================================ */
const YT_API_KEY = "AIzaSyAmA8taIf1zkXycMFwbGAXFjzbfiolrnkY";

/* ---------- helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const decode = s => { const t = document.createElement("textarea"); t.innerHTML = s; return t.value; };
const fmt = s => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
const store = {
  get(k, d) { try { const v = localStorage.getItem("sona:" + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("sona:" + k, JSON.stringify(v)); } catch { } }
};

/* ---------- icons ---------- */
const ICONS = {
  note: '<path d="M9 3v12.3A3.5 3.5 0 1 0 11 18.5V8h6V3z"/>',
  home: '<path d="M12 3 3 10.5V21h6.5v-6h5v6H21V10.5z"/>',
  search: '<circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="m16.5 16.5 4.5 4.5" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
  library: '<path d="M4 4h3v16H4zM9.5 4h3v16h-3zM15 5.5l2.9-.8 3.7 14.6-2.9.8z"/>',
  plus: '<path d="M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z"/>',
  heart: '<path d="M12 20.5s-8-4.9-8-10.7A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 8 2.8c0 5.8-8 10.7-8 10.7z"/>',
  play: '<path d="M7 4.5v15l13-7.5z"/>',
  pause: '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>',
  prev: '<path d="M6 5h2v14H6zM20 5v14L9 12z"/>',
  next: '<path d="M16 5h2v14h-2zM4 5v14l11-7z"/>',
  volume: '<path d="M3 9v6h4l5 4V5L7 9z"/><path d="M15.5 8.5a5 5 0 0 1 0 7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
  more: '<circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>',
  code: '<path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
};
const svg = n => `<svg class="ic" viewBox="0 0 24 24" fill="currentColor">${ICONS[n]}</svg>`;
function paintIcons(root = document) { $$("[data-icon]", root).forEach(el => { el.innerHTML = svg(el.dataset.icon); }); }

/* ---------- state ---------- */
let liked = store.get("liked", []);
let playlists = store.get("playlists", []);
let recent = store.get("recent", []);
let profile = store.get("profile", { name: "Guest" });
let queue = [], idx = -1, current = null;
let cur = { v: "home", arg: null };
let renderId = 0;
const lists = {};              // key -> array of tracks, used by cards/rows

const save = () => { store.set("liked", liked); store.set("playlists", playlists); store.set("recent", recent); store.set("profile", profile); };
const isLiked = id => liked.some(t => t.id === id);
const slim = t => ({ id: t.id, title: t.title, artist: t.artist, thumb: t.thumb });

function toast(msg) {
  const el = $("#toast"); el.textContent = msg; el.classList.add("show");
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), 1800);
}

/* ---------- YouTube search ---------- */
async function ytSearch(q, max = 12) {
  if (YT_API_KEY.startsWith("YOUR_")) throw new Error("NO_KEY");
  const ck = "cache:" + max + ":" + q;
  const c = store.get(ck, null);
  if (c && Date.now() - c.t < 6 * 3600e3) return c.v;
  const url = "https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&videoCategoryId=10" +
    `&maxResults=${max}&q=${encodeURIComponent(q)}&key=${YT_API_KEY}`;
  const r = await fetch(url);
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || "Search failed");
  const v = (j.items || []).map(it => ({
    id: it.id.videoId,
    title: decode(it.snippet.title),
    artist: decode(it.snippet.channelTitle).replace(/ - Topic$/, ""),
    thumb: it.snippet.thumbnails.high?.url || it.snippet.thumbnails.medium?.url || ""
  }));
  store.set(ck, { t: Date.now(), v });
  return v;
}
const errNotice = e => e.message === "NO_KEY"
  ? `<div class="notice"><b>Add your YouTube API key</b> to see songs. Open <code>script.js</code> and replace <code>YOUR_YOUTUBE_API_KEY</code> on the first line.</div>`
  : `<div class="notice"><b>Couldn't load music.</b> ${esc(e.message)}</div>`;

/* ---------- html builders ---------- */
const card = (t, key, i) => `
  <div class="card" data-list="${key}" data-i="${i}">
    <div class="art"><img src="${esc(t.thumb)}" alt="" loading="lazy">
      <button class="more" aria-label="More">${svg("more")}</button>
      <button class="play-fab" aria-label="Play">${svg("play")}</button></div>
    <div class="ct">${esc(t.title)}</div><div class="cs">${esc(t.artist)}</div>
  </div>`;
const skeleton = n => Array.from({ length: n }, () => `<div class="card sk"><div class="art"></div><div class="ct">.</div><div class="cs">.</div></div>`).join("");
const row = (t, key, i) => `
  <div class="row${current?.id === t.id ? " playing" : ""}" data-list="${key}" data-i="${i}">
    <div class="idx">${i + 1}</div>
    <div class="info"><img src="${esc(t.thumb)}" alt="" loading="lazy"><div style="min-width:0"><div class="rt">${esc(t.title)}</div><div class="ra">${esc(t.artist)}</div></div></div>
    <button class="icon-btn heart${isLiked(t.id) ? " on" : ""}" data-like aria-label="Like">${svg("heart")}</button>
    <button class="icon-btn more" style="position:static;background:none;opacity:1" aria-label="More">${svg("more")}</button>
  </div>`;
const tile = (name, art, attrs, cls = "") => `
  <div class="tile" ${attrs}><div class="tile-art ${cls}">${art ? `<img src="${esc(art)}" alt="">` : ""}</div>
  <div class="tile-name">${esc(name)}</div><button class="play-fab" aria-label="Play">${svg("play")}</button></div>`;

function greeting() { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; }

/* ---------- views ---------- */
const view = $("#view"), main = $("#main");

const SHELVES = [
  ["Trending now", "top hits official music"],
  ["Chill vibes", "chill lofi relaxing music"],
  ["Hip hop & rap", "hip hop rap hits"],
  ["Pop favourites", "pop hits music"]
];

async function renderHome() {
  const my = ++renderId;
  lists.recent = recent;
  const tiles = [tile("Liked Songs", "", 'data-go="liked"', "liked-art")];
  playlists.slice(0, 4).forEach(p => tiles.push(tile(p.name, p.tracks[0]?.thumb, `data-go="pl:${p.id}"`)));
  recent.slice(0, 8 - tiles.length).forEach((t, i) => tiles.push(tile(t.title, t.thumb, `data-list="recent" data-i="${i}"`)));

  view.innerHTML = `<h1>${greeting()}</h1>
    <div class="tiles">${tiles.join("")}</div>
    <div id="notice"></div>
    ${SHELVES.map((s, k) => `<section class="shelf"><h2>${esc(s[0])}</h2><div class="cards" id="sh${k}">${skeleton(7)}</div></section>`).join("")}`;

  SHELVES.forEach(async ([, q], k) => {
    try {
      const res = await ytSearch(q, 10);
      if (my !== renderId) return;
      lists["sh" + k] = res;
      $("#sh" + k).innerHTML = res.map((t, i) => card(t, "sh" + k, i)).join("");
    } catch (e) {
      if (my !== renderId) return;
      $("#sh" + k).closest(".shelf").remove();
      $("#notice").innerHTML = errNotice(e);
    }
  });
}

const GENRES = [["Pop", "#8d67ab"], ["Hip Hop", "#ba5d07"], ["Rock", "#e13300"], ["Chill", "#477d95"], ["R&B", "#503750"],
["Dance", "#148a08"], ["Gospel", "#dc148c"], ["Jazz", "#8c1932"], ["Reggae", "#1e3264"], ["Workout", "#777777"], ["Focus", "#0d73ec"], ["Party", "#af2896"]];

async function renderSearch(q) {
  const my = ++renderId;
  if (!q) {
    view.innerHTML = `<h1>Browse all</h1><div class="genres">${GENRES.map(g => `<button class="genre" data-q="${esc(g[0])} music" style="background:${g[1]}">${esc(g[0])}</button>`).join("")}</div>`;
    return;
  }
  view.innerHTML = `<h1>Results for “${esc(q)}”</h1><div id="results"><div class="empty">Searching…</div></div>`;
  try {
    const res = await ytSearch(q, 20);
    if (my !== renderId) return;
    lists.results = res;
    $("#results").innerHTML = res.length ? res.map((t, i) => row(t, "results", i)).join("") : `<div class="empty">No results found.</div>`;
  } catch (e) { if (my === renderId) $("#results").innerHTML = errNotice(e); }
}

function renderLibrary() {
  ++renderId;
  const items = [tile("Liked Songs", "", 'data-go="liked"', "liked-art"), ...playlists.map(p => tile(p.name, p.tracks[0]?.thumb, `data-go="pl:${p.id}"`))];
  view.innerHTML = `<h1>Your Library</h1><div class="tiles">${items.join("")}</div>
    <button class="genre" id="mkPl" style="background:var(--panel-2);height:auto;padding:12px 18px;font-size:15px">+ Create playlist</button>`;
}

function trackList(title, kind, tracks, key, art, cls) {
  lists[key] = tracks;
  view.innerHTML = `
    <div class="hero"><div class="hero-art ${cls || ""}">${art ? `<img src="${esc(art)}" alt="">` : svg("heart")}</div>
      <div><div class="kind">${kind}</div><h1>${esc(title)}</h1><div class="count">${esc(profile.name)} · ${tracks.length} song${tracks.length === 1 ? "" : "s"}</div></div></div>
    <div class="actions"><button class="big-play" id="playAll" aria-label="Play all">${svg("play")}</button></div>
    ${tracks.length ? tracks.map((t, i) => row(t, key, i)).join("") : `<div class="empty">Nothing here yet. Tap the ♥ or “⋯” on any song to add it.</div>`}`;
}
function renderLiked() { ++renderId; trackList("Liked Songs", "Playlist", liked, "liked", "", "liked-art"); }
function renderPlaylist(id) {
  ++renderId;
  const p = playlists.find(x => x.id === id);
  if (!p) return go("home");
  trackList(p.name, "Playlist", p.tracks, "pl", p.tracks[0]?.thumb);
}

function go(v, arg) {
  cur = { v, arg };
  const nav = ["liked", "playlist"].includes(v) ? "library" : v;
  $$("[data-view]").forEach(b => b.classList.toggle("active", b.dataset.view === nav));
  main.scrollTop = 0;
  ({ home: renderHome, search: renderSearch, library: renderLibrary, liked: renderLiked, playlist: renderPlaylist })[v](arg);
  renderSidebar();
}
const refresh = () => { const y = main.scrollTop; go(cur.v, cur.arg); main.scrollTop = y; };

/* ---------- sidebar library ---------- */
function renderSidebar() {
  const act = (cur.v === "liked") ? "liked" : (cur.v === "playlist" ? cur.arg : "");
  $("#libraryList").innerHTML =
    `<li class="lib-item${act === "liked" ? " active" : ""}" data-go="liked"><div class="lib-art liked-art">${svg("heart")}</div><div><div class="lib-name">Liked Songs</div><div class="lib-sub">Playlist · ${liked.length} songs</div></div></li>` +
    playlists.map(p => `<li class="lib-item${act === p.id ? " active" : ""}" data-go="pl:${p.id}"><div class="lib-art">${p.tracks[0] ? `<img src="${esc(p.tracks[0].thumb)}" alt="">` : svg("note")}</div><div style="min-width:0"><div class="lib-name">${esc(p.name)}</div><div class="lib-sub">Playlist · ${p.tracks.length} songs</div></div><button class="lib-del" data-del="${p.id}" title="Delete playlist">✕</button></li>`).join("");
}

/* ---------- favourites & playlists ---------- */
function toggleLike(t) {
  if (isLiked(t.id)) { liked = liked.filter(x => x.id !== t.id); toast("Removed from Liked Songs"); }
  else { liked.unshift(slim(t)); toast("Added to Liked Songs"); }
  save(); syncHearts(); renderSidebar();
  if (cur.v === "liked") refresh();
}
function syncHearts() {
  $("#pHeart").classList.toggle("on", !!current && isLiked(current.id));
  $$(".row").forEach(r => { const t = lists[r.dataset.list]?.[r.dataset.i]; if (t) $(".heart", r)?.classList.toggle("on", isLiked(t.id)); });
}
function newPlaylist(firstTrack) {
  const name = prompt("Playlist name", "My playlist #" + (playlists.length + 1));
  if (!name || !name.trim()) return null;
  const p = { id: "p" + Date.now(), name: name.trim().slice(0, 40), tracks: firstTrack ? [slim(firstTrack)] : [] };
  playlists.push(p); save(); renderSidebar();
  if (firstTrack) toast("Added to " + p.name);
  if (cur.v === "library" || cur.v === "home") refresh();
  return p;
}
function addToPlaylist(p, t) {
  if (p.tracks.some(x => x.id === t.id)) return toast("Already in " + p.name);
  p.tracks.push(slim(t)); save(); renderSidebar(); toast("Added to " + p.name);
}

/* ---------- context menu ---------- */
const menu = $("#menu");
function openMenu(x, y, items) {
  menu.innerHTML = "";
  items.forEach(it => {
    if (it === "-") return menu.appendChild(document.createElement("hr"));
    if (it.label && !it.fn) { const d = document.createElement("div"); d.className = "ctx-label"; d.textContent = it.label; return menu.appendChild(d); }
    const b = document.createElement("button"); b.textContent = it.label;
    b.onclick = () => { closeMenu(); it.fn(); }; menu.appendChild(b);
  });
  menu.classList.remove("hidden");
  const w = menu.offsetWidth, h = menu.offsetHeight;
  menu.style.left = Math.max(8, Math.min(x, innerWidth - w - 8)) + "px";
  menu.style.top = Math.max(8, Math.min(y, innerHeight - h - 8)) + "px";
}
const closeMenu = () => menu.classList.add("hidden");
document.addEventListener("click", e => { if (!e.target.closest("#menu, .more, #profileBtn")) closeMenu(); });
addEventListener("scroll", closeMenu, true);

function trackMenu(e, t) {
  const r = e.target.getBoundingClientRect();
  const items = [{ label: isLiked(t.id) ? "Remove from Liked Songs" : "Add to Liked Songs", fn: () => toggleLike(t) }, "-", { label: "Add to playlist" }];
  playlists.forEach(p => items.push({ label: p.name, fn: () => addToPlaylist(p, t) }));
  items.push({ label: "+ New playlist", fn: () => newPlaylist(t) });
  if (cur.v === "playlist") {
    items.push("-", { label: "Remove from this playlist", fn: () => { const p = playlists.find(x => x.id === cur.arg); p.tracks = p.tracks.filter(x => x.id !== t.id); save(); refresh(); } });
  }
  openMenu(r.left - 180, r.bottom + 4, items);
}

/* ---------- profile (small avatar menu) ---------- */
function paintProfile() { $("#profileBtn").textContent = (profile.name || "G").trim().charAt(0).toUpperCase() || "G"; }
$("#profileBtn").addEventListener("click", e => {
  const r = e.currentTarget.getBoundingClientRect();
  openMenu(r.right - 220, r.bottom + 8, [
    { label: profile.name },
    "-",
    { label: "Edit name", fn: () => { const n = prompt("Your name", profile.name); if (n && n.trim()) { profile.name = n.trim().slice(0, 24); save(); paintProfile(); refresh(); } } },
    { label: "Liked Songs", fn: () => go("liked") },
    { label: "Your Library", fn: () => go("library") }
  ]);
});

/* ---------- click handling in the content area ---------- */
function openGo(g) { g === "liked" ? go("liked") : go("playlist", g.slice(3)); }
view.addEventListener("click", e => {
  const el = e.target.closest("[data-list]");
  if (e.target.closest("#playAll")) { const l = lists[cur.v === "liked" ? "liked" : "pl"]; if (l?.length) play(l, 0); return; }
  if (e.target.closest("#mkPl")) { newPlaylist(); return; }
  const g = e.target.closest("[data-go]"); if (g) return openGo(g.dataset.go);
  const q = e.target.closest("[data-q]"); if (q) { $("#searchInput").value = q.dataset.q; return go("search", q.dataset.q); }
  if (!el) return;
  const t = lists[el.dataset.list]?.[+el.dataset.i]; if (!t) return;
  if (e.target.closest("[data-like]")) return toggleLike(t);
  if (e.target.closest(".more")) { e.stopPropagation(); return trackMenu(e, t); }
  play(lists[el.dataset.list], +el.dataset.i);
});
$("#libraryList").addEventListener("click", e => {
  const d = e.target.closest("[data-del]");
  if (d) { e.stopPropagation(); const p = playlists.find(x => x.id === d.dataset.del); if (p && confirm(`Delete “${p.name}”?`)) { playlists = playlists.filter(x => x !== p); save(); if (cur.v === "playlist" && cur.arg === p.id) go("home"); else { renderSidebar(); } } return; }
  const g = e.target.closest("[data-go]"); if (g) openGo(g.dataset.go);
});
$$("[data-view]").forEach(b => b.addEventListener("click", () => {
  if (b.dataset.view === "search") { go("search", $("#searchInput").value.trim()); $("#searchInput").focus(); }
  else go(b.dataset.view);
}));
$("#newPlaylist").addEventListener("click", () => newPlaylist());

/* search box */
let st;
$("#searchInput").addEventListener("input", e => { clearTimeout(st); st = setTimeout(() => go("search", e.target.value.trim()), 500); });
$("#searchInput").addEventListener("keydown", e => { if (e.key === "Enter") { clearTimeout(st); go("search", e.target.value.trim()); } });
$("#searchInput").addEventListener("focus", () => { if (cur.v !== "search") go("search", $("#searchInput").value.trim()); });

/* ---------- player ---------- */
let yt = null, ytReady = false, pending = null, timer = null, seeking = false;

window.onYouTubeIframeAPIReady = () => {
  yt = new YT.Player("yt-player", {
    height: "113", width: "200",
    playerVars: { playsinline: 1, controls: 0, disablekb: 1, rel: 0 },
    events: {
      onReady: () => { ytReady = true; yt.setVolume(+$("#vol").value); if (pending) { yt.loadVideoById(pending); pending = null; } },
      onStateChange: e => {
        const S = YT.PlayerState;
        setPlayIcon(e.data === S.PLAYING || e.data === S.BUFFERING);
        if (e.data === S.ENDED) next();
        if ("mediaSession" in navigator) navigator.mediaSession.playbackState = e.data === S.PLAYING ? "playing" : "paused";
      },
      onError: () => { toast("Can't play this one, skipping…"); next(); }
    }
  });
  timer = setInterval(tick, 500);
};

function setPlayIcon(playing) { $("#playBtn").innerHTML = svg(playing ? "pause" : "play"); $("#playBtn").setAttribute("aria-label", playing ? "Pause" : "Play"); }
function fill(input) { input.style.setProperty("--fill", (input.value / input.max * 100) + "%"); }

function play(list, i) { queue = list.slice(); idx = i; load(); }
function load() {
  current = queue[idx]; if (!current) return;
  $("#pArt").src = current.thumb; $("#pTitle").textContent = current.title; $("#pArtist").textContent = current.artist;
  document.title = current.title + " · Sona Play";
  if (ytReady) yt.loadVideoById(current.id); else pending = current.id;
  recent = [slim(current), ...recent.filter(t => t.id !== current.id)].slice(0, 12); store.set("recent", recent);
  syncHearts(); $$(".row").forEach(r => { const t = lists[r.dataset.list]?.[r.dataset.i]; r.classList.toggle("playing", !!t && t.id === current.id); });
  setPlayIcon(true); setMediaSession();
}
function next() { if (!queue.length) return; idx = (idx + 1) % queue.length; load(); }
function prev() { if (!queue.length) return; if (ytReady && yt.getCurrentTime() > 3) return yt.seekTo(0); idx = (idx - 1 + queue.length) % queue.length; load(); }
function toggle() {
  if (!ytReady || !current) return;
  const s = yt.getPlayerState(); (s === YT.PlayerState.PLAYING) ? yt.pauseVideo() : yt.playVideo();
}
function tick() {
  if (!ytReady || !current || seeking) return;
  const d = yt.getDuration?.() || 0, c = yt.getCurrentTime?.() || 0;
  $("#tCur").textContent = fmt(c); $("#tDur").textContent = fmt(d);
  $("#seek").value = d ? c / d * 1000 : 0; fill($("#seek"));
}
$("#playBtn").onclick = toggle; $("#nextBtn").onclick = next; $("#prevBtn").onclick = prev;
$("#pHeart").onclick = () => current && toggleLike(current);
const seekEl = $("#seek");
seekEl.addEventListener("input", () => { seeking = true; fill(seekEl); if (ytReady) $("#tCur").textContent = fmt(seekEl.value / 1000 * yt.getDuration()); });
seekEl.addEventListener("change", () => { if (ytReady) yt.seekTo(seekEl.value / 1000 * yt.getDuration(), true); seeking = false; });
$("#vol").addEventListener("input", e => { fill(e.target); if (ytReady) yt.setVolume(+e.target.value); store.set("vol", +e.target.value); });
document.addEventListener("keydown", e => {
  if (e.code === "Space" && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); toggle(); }
});

/* Lock-screen / notification controls (helps when you leave the tab) */
function setMediaSession() {
  if (!("mediaSession" in navigator) || !current) return;
  navigator.mediaSession.metadata = new MediaMetadata({ title: current.title, artist: current.artist, artwork: [{ src: current.thumb, sizes: "480x360", type: "image/jpeg" }] });
  navigator.mediaSession.setActionHandler("play", () => yt.playVideo());
  navigator.mediaSession.setActionHandler("pause", () => yt.pauseVideo());
  navigator.mediaSession.setActionHandler("previoustrack", prev);
  navigator.mediaSession.setActionHandler("nexttrack", next);
}
/* ---------- footer marquee ---------- */
const MARQUEE_TEXT = "Develop Allan Kiplangat";
function buildMarquee() {
  const g = Array.from({ length: 12 }, () => `<span>${esc(MARQUEE_TEXT)}</span>`).join("");
  $(".marquee-track").innerHTML = `<div class="marquee-group">${g}</div><div class="marquee-group" aria-hidden="true">${g}</div>`;
}

/* ---------- init ---------- */
(function init() {
  paintIcons(); paintProfile();
    buildMarquee(); paintIcons(); paintProfile();
  const v = store.get("vol", 80); $("#vol").value = v; fill($("#vol")); fill($("#seek"));
  setPlayIcon(false);
  go("home");
})();