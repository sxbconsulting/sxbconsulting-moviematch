// Écran de création de salle — 4 modes de deck (voir PROMPT_CLAUDE_CODE_MOVIEMATCH.md §2).
// Toggle Films/Séries/Les deux appliqué à la sélection et aux catégories (TMDB).
// "Depuis un lien" et l'import photo seront câblés à l'étape 5 (Edge Function Claude).
import { el } from "../lib/dom.js";
import { state, setState } from "../state.js";
import { GENRES, genreStyleOf } from "../data/genre-style.js";
import { parsePastedLines, DECK_SIZE, pickRandom } from "../lib/utils.js";
import { launchSession, goHome } from "../actions.js";
import { getPool, discoverByGenres, reconcileTitles } from "../lib/tmdb.js";
import { tmdbSearch, TmdbResultRow } from "../components/tmdb-picker.js";
import { extractFilmsFromLink, extractFilmsFromImages } from "../lib/claude-proxy.js";
import { readImagesAsBase64 } from "../lib/images.js";
import { FilmLoader } from "../components/film-loader.js";

let ui = {
  mode: null, mediaMode: "both",
  selGenres: [], genreBusy: false, genreErr: "",
  poolBusy: false, poolErr: "",
  custom: [], cTitle: "", cGenre: "Perso", searchResults: [], searchBusy: false, searchErr: "",
  linkUrl: "", linkMsg: "", linkBusy: false, pTxt: "", imgBusy: false, imgErr: "",
};

export function resetSetupState() {
  ui = {
    mode: null, mediaMode: "both",
    selGenres: [], genreBusy: false, genreErr: "",
    poolBusy: false, poolErr: "",
    custom: [], cTitle: "", cGenre: "Perso", searchResults: [], searchBusy: false, searchErr: "",
    linkUrl: "", linkMsg: "", linkBusy: false, pTxt: "", imgBusy: false, imgErr: "",
  };
}

function addToCustom(items) {
  const seen = new Set(ui.custom.map((m) => m.title.toLowerCase()));
  ui.custom = [...ui.custom, ...items.filter((m) => !seen.has(m.title.toLowerCase()))];
  ui.mode = "perso";
}

function refresh() { setState({}); }

function filterByMedia(items) {
  if (ui.mediaMode === "both") return items;
  return items.filter((m) => m.media_type === ui.mediaMode);
}

function renderMediaToggle(container) {
  const opts = [["movie", "🎬 Films"], ["tv", "📺 Séries"], ["both", "🍿 Les deux"]];
  const wrap = el("div", { style: { display: "flex", gap: "8px", marginBottom: "16px" } });
  opts.forEach(([k, label]) => {
    wrap.appendChild(el("button", {
      class: "mm-chip" + (ui.mediaMode === k ? " on" : ""), style: { flex: "1", textAlign: "center" },
      onClick: () => { ui.mediaMode = k; refresh(); },
    }, [label]));
  });
  container.appendChild(wrap);
}

function renderModeSelection(container) {
  container.appendChild(el("div", { class: "mm-opt-card" }, [
    el("div", { style: { fontWeight: 700, fontSize: "15px" } }, ["🍿 Sélection MovieMatch"]),
    el("p", { class: "mm-opt-desc" }, [`Tirage au sort de ${DECK_SIZE} titres parmi les mieux notés TMDB (1980–2026). Chaque salle est différente.`]),
    ui.poolErr ? el("p", { class: "mm-error", style: { fontSize: "13px", margin: "0 0 10px" } }, [ui.poolErr]) : null,
    el("button", {
      class: "mm-btn mm-btn-primary", style: { padding: "12px" },
      disabled: state.busy || ui.poolBusy,
      onClick: async () => {
        ui.poolBusy = true; ui.poolErr = ""; refresh();
        try {
          const pool = filterByMedia(await getPool());
          ui.poolBusy = false;
          if (pool.length < 2) { ui.poolErr = "Pas assez de résultats pour ce filtre — essaie \"Les deux\"."; refresh(); return; }
          launchSession(pickRandom(pool, Math.min(DECK_SIZE, pool.length)));
        } catch {
          ui.poolBusy = false;
          ui.poolErr = "TMDB est injoignable — vérifie ta connexion et réessaie.";
          refresh();
        }
      },
    }, [ui.poolBusy ? "Chargement…" : `🎲 Lancer avec ${DECK_SIZE} films au hasard`]),
  ].filter(Boolean)));
}

function renderGenreMode(container) {
  const isOpen = ui.mode === "genres";
  const card = el("div", { class: "mm-opt-card" + (isOpen ? " active" : "") });
  card.appendChild(el("div", { style: { cursor: "pointer" }, onClick: () => { ui.mode = isOpen ? null : "genres"; refresh(); } }, [
    el("div", { style: { fontWeight: 700, fontSize: "15px" } }, ["🎯 Par catégorie"]),
    el("p", { class: "mm-opt-desc" }, ["Choisis un ou plusieurs genres, on ne swipe que ça."]),
  ]));

  if (isOpen) {
    const chipsWrap = el("div", { style: { display: "flex", flexWrap: "wrap", gap: "8px", margin: "10px 0 14px" } });
    GENRES.forEach((g) => {
      const on = ui.selGenres.includes(g);
      chipsWrap.appendChild(el("button", {
        class: "mm-chip" + (on ? " on" : ""),
        onClick: () => { ui.selGenres = on ? ui.selGenres.filter((x) => x !== g) : [...ui.selGenres, g]; refresh(); },
      }, [g]));
    });
    card.appendChild(chipsWrap);

    if (ui.genreErr) card.appendChild(el("p", { class: "mm-error", style: { fontSize: "13px", margin: "0 0 10px" } }, [ui.genreErr]));

    card.appendChild(el("button", {
      class: "mm-btn mm-btn-primary", style: { padding: "12px", opacity: ui.selGenres.length < 1 ? "0.5" : "1" },
      disabled: state.busy || ui.genreBusy || ui.selGenres.length < 1,
      onClick: async () => {
        ui.genreBusy = true; ui.genreErr = ""; refresh();
        try {
          const items = filterByMedia(await discoverByGenres(ui.selGenres, ui.mediaMode));
          ui.genreBusy = false;
          if (items.length < 2) { ui.genreErr = "Pas assez de résultats pour ces genres — élargis ta sélection."; refresh(); return; }
          launchSession(pickRandom(items, Math.min(DECK_SIZE, items.length)));
        } catch {
          ui.genreBusy = false;
          ui.genreErr = "TMDB est injoignable — vérifie ta connexion et réessaie.";
          refresh();
        }
      },
    }, [ui.genreBusy ? "Chargement…" : ui.selGenres.length < 1 ? "Choisis au moins un genre" : `🎯 Lancer avec ces genres (${DECK_SIZE} max)`]));
  }

  container.appendChild(card);
}

function renderLinkMode(container) {
  const card = el("div", { class: "mm-opt-card" }, [
    el("div", { style: { fontWeight: 700, fontSize: "15px" } }, ["📎 Depuis un lien"]),
    el("p", { class: "mm-opt-desc" }, ["Colle un top Allociné, une liste SensCritique, un article \"meilleurs films\"… Claude extrait les films."]),
  ]);
  const row = el("div", { style: { display: "flex", gap: "8px" } }, [
    el("input", {
      class: "mm-input", style: { flex: "1", padding: "11px 14px", fontSize: "14px" },
      value: ui.linkUrl, placeholder: "https://…",
      onInput: (e) => { ui.linkUrl = e.target.value; },
    }),
    el("button", {
      class: "mm-btn mm-btn-primary", style: { width: "auto", padding: "0 18px" },
      disabled: ui.linkBusy,
      onClick: async () => {
        const url = ui.linkUrl.trim();
        if (!/^https?:\/\/.+\..+/.test(url)) { ui.linkMsg = "Colle une URL complète (https://…)."; refresh(); return; }
        ui.linkBusy = true; ui.linkMsg = ""; refresh();
        try {
          const titles = await extractFilmsFromLink(url);
          const items = await reconcileTitles(titles, "Importé du lien 📎");
          if (!items.length) throw new Error("vide");
          addToCustom(items);
          ui.linkUrl = ""; ui.linkBusy = false;
          refresh();
        } catch {
          ui.linkBusy = false;
          ui.linkMsg = "Impossible d'extraire des films de cette page — vérifie le lien ou essaie une capture d'écran 📸.";
          refresh();
        }
      },
    }, [ui.linkBusy ? "…" : "Extraire"]),
  ]);
  card.appendChild(row);
  if (ui.linkBusy) card.appendChild(el("div", { style: { marginTop: "10px" } }, [FilmLoader({ inline: true, text: "Claude lit la page…" })]));
  if (ui.linkMsg) card.appendChild(el("p", { class: "mm-error", style: { fontSize: "13px", margin: "8px 0 0" } }, [ui.linkMsg]));
  container.appendChild(card);
}

function renderCustomRow(m, i) {
  const gs = genreStyleOf(m.genre);
  return el("div", {
    style: { display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "10px", marginBottom: "6px" },
  }, [
    el("div", { style: { width: "8px", height: "28px", borderRadius: "4px", background: gs.chip } }),
    el("span", { style: { flex: "1", fontSize: "14px" } }, [m.title, el("span", { class: "mm-dim", style: { fontSize: "12px" } }, [` · ${m.year || m.genre}${m.media_type === "tv" ? " · 📺" : ""}`])]),
    el("button", {
      style: { background: "transparent", border: "none", color: "var(--nope)", fontSize: "16px", cursor: "pointer" },
      onClick: () => { ui.custom = ui.custom.filter((_, j) => j !== i); refresh(); },
    }, ["✕"]),
  ]);
}

function renderPersoMode(container) {
  const isOpen = ui.mode === "perso";
  const card = el("div", { class: "mm-opt-card" + (isOpen ? " active" : "") });
  card.appendChild(el("div", { style: { cursor: "pointer" }, onClick: () => { ui.mode = isOpen ? null : "perso"; refresh(); } }, [
    el("div", { style: { fontWeight: 700, fontSize: "15px" } }, ["✍️ Liste perso"]),
    el("p", { class: "mm-opt-desc" }, ["Cherche un titre (TMDB), ajoute vos films à la main, ou importe des captures d'écran."]),
  ]));

  if (isOpen) {
    const fileInput = el("input", {
      type: "file", accept: "image/*", multiple: true, style: { display: "none" },
      onChange: async (e) => {
        const files = e.target.files;
        e.target.value = "";
        ui.imgBusy = true; ui.imgErr = ""; refresh();
        try {
          const images = await readImagesAsBase64(files);
          if (!images.length) { ui.imgBusy = false; refresh(); return; }
          const titles = await extractFilmsFromImages(images);
          const items = await reconcileTitles(titles, "Importé par capture 📸");
          if (!items.length) throw new Error("vide");
          addToCustom(items);
          ui.imgBusy = false;
          refresh();
        } catch {
          ui.imgBusy = false;
          ui.imgErr = "Aucun film détecté — réessaie avec des captures plus nettes (liste Netflix, affiches, top d'articles…).";
          refresh();
        }
      },
    });
    card.appendChild(fileInput);
    card.appendChild(el("button", {
      class: "mm-btn mm-btn-ghost", style: { width: "100%", padding: "12px", margin: "10px 0 4px", border: "1px dashed #ffc53d66", color: "var(--marquee)", fontWeight: "700" },
      disabled: ui.imgBusy,
      onClick: () => fileInput.click(),
    }, ["📸 Importer par captures (max 5 images)"]));
    if (ui.imgBusy) card.appendChild(el("div", { style: { margin: "10px 0" } }, [FilmLoader({ inline: true, text: "Claude analyse tes captures…" })]));
    if (ui.imgErr) card.appendChild(el("p", { class: "mm-error", style: { fontSize: "13px", margin: "6px 0" } }, [ui.imgErr]));

    const inList = (title) => ui.custom.some((x) => x.title.toLowerCase() === title.toLowerCase());

    card.appendChild(el("input", {
      class: "mm-input", style: { margin: "10px 0 6px", padding: "11px 14px", fontSize: "15px" },
      value: ui.cTitle, placeholder: "Chercher un film ou une série…",
      onInput: (e) => {
        ui.cTitle = e.target.value;
        ui.searchBusy = true; refresh();
        tmdbSearch("setup-perso", ui.cTitle, (results, err) => {
          ui.searchResults = results; ui.searchErr = err; ui.searchBusy = false; setState({});
        });
      },
    }));
    if (ui.searchBusy) card.appendChild(el("p", { class: "mm-dim", style: { fontSize: "13px" } }, ["Recherche…"]));
    if (ui.searchErr) card.appendChild(el("p", { class: "mm-error", style: { fontSize: "13px" } }, [ui.searchErr]));
    ui.searchResults.forEach((m) => {
      card.appendChild(TmdbResultRow(m, inList(m.title), (item) => {
        ui.custom = [...ui.custom, item]; refresh();
      }));
    });
    if (ui.cTitle.trim().length > 1 && !ui.searchBusy && !inList(ui.cTitle.trim())) {
      card.appendChild(el("button", {
        class: "mm-btn mm-btn-ghost", style: { width: "100%", padding: "10px", margin: "4px 0 10px", border: "1px dashed #ffc53d66", color: "var(--marquee)", fontWeight: "700" },
        onClick: () => {
          ui.custom = [...ui.custom, { id: "p" + Date.now(), title: ui.cTitle.trim().slice(0, 60), genre: ui.cGenre, year: "", dur: "", pitch: "Ajout manuel ✍️" }];
          ui.cTitle = ""; ui.searchResults = [];
          refresh();
        },
      }, [`+ Ajouter « ${ui.cTitle.trim().slice(0, 40)} » (hors catalogue)`]));
    }

    const genreChips = el("div", { style: { display: "flex", flexWrap: "wrap", gap: "8px", margin: "4px 0 12px" } });
    GENRES.concat("Perso").forEach((g) => {
      genreChips.appendChild(el("button", { class: "mm-chip" + (ui.cGenre === g ? " on" : ""), onClick: () => { ui.cGenre = g; refresh(); } }, [g]));
    });
    card.appendChild(genreChips);

    card.appendChild(el("textarea", {
      class: "mm-textarea", rows: 3, value: ui.pTxt,
      placeholder: "Ou colle ta liste — un film par ligne :\nOppenheimer\nLa Haine",
      style: { margin: "8px 0 6px" },
      onInput: (e) => { ui.pTxt = e.target.value; },
    }));
    if (ui.pTxt.trim()) {
      card.appendChild(el("button", {
        class: "mm-btn mm-btn-ghost", style: { width: "100%", padding: "10px", marginBottom: "8px", color: "var(--marquee)" },
        onClick: () => {
          const lines = parsePastedLines(ui.pTxt, 40);
          const seen = new Set(ui.custom.map((m) => m.title.toLowerCase()));
          const items = lines.map((t, i) => ({ id: "p" + Date.now() + i, title: t.slice(0, 60), genre: "Perso", year: "", dur: "", pitch: "De tes notes 📝" }))
            .filter((m) => !seen.has(m.title.toLowerCase()));
          ui.custom = [...ui.custom, ...items];
          ui.pTxt = "";
          refresh();
        },
      }, ["📝 Ajouter ces films à la liste"]));
    }

    ui.custom.forEach((m, i) => card.appendChild(renderCustomRow(m, i)));

    card.appendChild(el("button", {
      class: "mm-btn mm-btn-primary", style: { padding: "12px", marginTop: "8px", opacity: ui.custom.length < 2 ? "0.5" : "1" },
      disabled: state.busy || ui.custom.length < 2,
      onClick: () => launchSession(ui.custom),
    }, [ui.custom.length < 2 ? "Ajoute au moins 2 films" : `Lancer avec ${ui.custom.length} films`]));
  }

  container.appendChild(card);
}

export function renderSetup(container) {
  const wrap = el("div", { style: { marginTop: "8px" } });
  wrap.appendChild(el("button", { class: "mm-btn mm-btn-ghost", style: { marginBottom: "16px" }, onClick: () => goHome() }, ["← Retour"]));
  wrap.appendChild(el("div", { class: "mm-title" }, ["QUELS FILMS DANS LA SALLE ?"]));

  renderMediaToggle(wrap);
  renderModeSelection(wrap);
  renderGenreMode(wrap);
  renderLinkMode(wrap);
  renderPersoMode(wrap);

  if (state.err) wrap.appendChild(el("p", { class: "mm-error" }, [state.err]));

  container.appendChild(wrap);
}
