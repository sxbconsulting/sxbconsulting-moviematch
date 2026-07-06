// Constructeur de liste — 5 sources : catalogue TMDB, IA (Edge Function Claude), photos, lien, notes.
import { el } from "../lib/dom.js";
import { state, setState } from "../state.js";
import { GENRES } from "../data/genre-style.js";
import { parsePastedLines } from "../lib/utils.js";
import { upsertList } from "../lib/local-lists.js";
import { browseCatalog, reconcileTitles, searchPersonCredits } from "../lib/tmdb.js";
import { tmdbSearch, TmdbResultRow } from "../components/tmdb-picker.js";
import { extractFilmsFromLink, extractFilmsFromImages, suggestFilms } from "../lib/claude-proxy.js";
import { readImagesAsBase64 } from "../lib/images.js";
import { FilmLoader } from "../components/film-loader.js";

const DECADES = [1980, 1990, 2000, 2010, 2020];

let ui = null;
function resetIfNeeded() {
  const initial = state.listEditing;
  if (ui && ui.initialId === (initial ? initial.id : null)) return;
  ui = {
    initialId: initial ? initial.id : null,
    lname: initial ? initial.name : "",
    films: initial ? [...initial.movies] : [],
    src: "catalog",
    q: "", gSel: [], decSel: [], results: [], busy: false, err: "",
    iaQuery: "", iaBusy: false, iaErr: "",
    linkUrl: "", linkBusy: false, linkErr: "",
    imgBusy: false, imgErr: "",
    msg: "",
  };
}

function addMany(items) {
  const seen = new Set(ui.films.map((m) => m.title.toLowerCase()));
  ui.films = [...ui.films, ...items.filter((m) => !seen.has(m.title.toLowerCase()))];
  setState({});
}

function stubMsg(txt) { ui.msg = txt; setState({}); }

async function runBrowse() {
  ui.busy = true; ui.err = ""; setState({});
  try {
    ui.results = await browseCatalog({ genreKeys: ui.gSel, decades: ui.decSel, mediaMode: "both" });
    ui.busy = false;
  } catch {
    ui.busy = false; ui.err = "TMDB est injoignable — vérifie ta connexion.";
    ui.results = [];
  }
  setState({});
}

export function renderListBuilder(container) {
  resetIfNeeded();
  const wrap = el("div", { style: { marginTop: "8px" } });

  wrap.appendChild(el("button", { class: "mm-btn mm-btn-ghost", style: { marginBottom: "14px" }, onClick: () => setState({ screen: "lists", listEditing: null }) }, ["← Mes listes"]));
  wrap.appendChild(el("div", { class: "mm-title" }, [ui.initialId ? "MODIFIER LA LISTE" : "NOUVELLE LISTE"]));

  wrap.appendChild(el("input", {
    class: "mm-input", style: { marginBottom: "14px" }, maxlength: 40,
    value: ui.lname, placeholder: "Nom de la liste (ex : Soirées Sci-Fi)",
    onInput: (e) => { ui.lname = e.target.value; },
  }));

  const tabs = [["catalog", "🔍 Catalogue"], ["ia", "🤖 IA"], ["photos", "📸 Photos"], ["link", "📎 Lien"], ["text", "📝 Notes"]];
  const tabWrap = el("div", { style: { display: "flex", gap: "6px", marginBottom: "12px", flexWrap: "wrap" } });
  tabs.forEach(([k, lab]) => {
    tabWrap.appendChild(el("button", { class: "mm-chip" + (ui.src === k ? " on" : ""), onClick: () => { ui.src = k; ui.msg = ""; setState({}); } }, [lab]));
  });
  wrap.appendChild(tabWrap);

  if (ui.src === "catalog") wrap.appendChild(renderCatalogTab());
  if (ui.src === "ia") wrap.appendChild(renderIaTab());
  if (ui.src === "photos") wrap.appendChild(renderPhotosTab());
  if (ui.src === "link") wrap.appendChild(renderLinkTab());
  if (ui.src === "text") wrap.appendChild(renderTextTab());

  if (ui.msg) wrap.appendChild(el("p", { class: "mm-error" }, [ui.msg]));

  wrap.appendChild(el("div", { style: { margin: "16px 0 6px", fontSize: "12px", color: "var(--dim)", letterSpacing: "1px", fontWeight: "700" } }, [
    `TA LISTE · ${ui.films.length} FILM${ui.films.length > 1 ? "S" : ""}`,
  ]));
  ui.films.forEach((m, i) => {
    wrap.appendChild(el("div", { style: { display: "flex", alignItems: "center", gap: "10px", padding: "7px 10px", background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "10px", marginBottom: "6px" } }, [
      el("span", { style: { flex: "1", fontSize: "14px" } }, [m.title + (m.year ? ` · ${m.year}` : "") + (m.media_type === "tv" ? " · 📺" : "")]),
      el("button", {
        style: { background: "transparent", border: "none", color: "var(--nope)", fontSize: "16px", cursor: "pointer" },
        onClick: () => { ui.films = ui.films.filter((_, j) => j !== i); setState({}); },
      }, ["✕"]),
    ]));
  });

  wrap.appendChild(el("button", {
    class: "mm-btn mm-btn-primary", style: { marginTop: "14px", opacity: ui.films.length < 2 ? "0.5" : "1" },
    disabled: ui.films.length < 2,
    onClick: () => {
      const list = { id: ui.initialId || "l" + Date.now(), name: ui.lname.trim() || "Ma liste", movies: ui.films };
      upsertList(list);
      setState({ screen: "lists", listEditing: null });
    },
  }, [ui.films.length < 2 ? "Ajoute au moins 2 films" : "💾 Enregistrer la liste"]));

  container.appendChild(wrap);
}

function renderCatalogTab() {
  const tab = el("div", {});
  const inList = (title) => ui.films.some((x) => x.title.toLowerCase() === title.toLowerCase());

  tab.appendChild(el("input", {
    class: "mm-input", style: { padding: "11px 14px", fontSize: "14px", marginBottom: "8px" },
    value: ui.q, placeholder: "Chercher un titre…",
    onInput: (e) => {
      ui.q = e.target.value;
      ui.busy = true; setState({});
      tmdbSearch("list-builder", ui.q, (results, err) => {
        ui.results = results; ui.err = err; ui.busy = false; setState({});
      });
    },
  }));

  const genreWrap = el("div", { style: { display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "6px" } });
  GENRES.forEach((g) => {
    genreWrap.appendChild(el("button", {
      class: "mm-chip" + (ui.gSel.includes(g) ? " on" : ""),
      onClick: () => {
        ui.gSel = ui.gSel.includes(g) ? ui.gSel.filter((x) => x !== g) : [...ui.gSel, g];
        if (!ui.q.trim()) runBrowse(); else setState({});
      },
    }, [g]));
  });
  tab.appendChild(genreWrap);

  const decWrap = el("div", { style: { display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" } });
  DECADES.forEach((d) => {
    decWrap.appendChild(el("button", {
      class: "mm-chip" + (ui.decSel.includes(d) ? " on" : ""),
      onClick: () => {
        ui.decSel = ui.decSel.includes(d) ? ui.decSel.filter((x) => x !== d) : [...ui.decSel, d];
        if (!ui.q.trim()) runBrowse(); else setState({});
      },
    }, [`${d}s`]));
  });
  tab.appendChild(decWrap);

  if (ui.busy) tab.appendChild(el("p", { class: "mm-dim", style: { fontSize: "13px" } }, ["Recherche…"]));
  if (ui.err) tab.appendChild(el("p", { class: "mm-error", style: { fontSize: "13px" } }, [ui.err]));

  const q = ui.q.trim().toLowerCase();
  let results = ui.results;
  if (q && (ui.gSel.length || ui.decSel.length)) {
    results = results.filter((m) =>
      (!ui.gSel.length || ui.gSel.includes(m.genre)) &&
      (!ui.decSel.length || ui.decSel.includes(Math.floor((m.year || 0) / 10) * 10))
    );
  }

  results.slice(0, 12).forEach((m) => {
    tab.appendChild(TmdbResultRow(m, inList(m.title), (item) => addMany([item])));
  });

  if (q.length > 1 && !ui.busy && !inList(ui.q.trim())) {
    tab.appendChild(el("button", {
      class: "mm-btn mm-btn-ghost", style: { width: "100%", padding: "11px", marginTop: "4px", border: "1px dashed #ffc53d66", color: "var(--marquee)", fontWeight: "700" },
      onClick: () => { addMany([{ id: "man" + Date.now(), title: ui.q.trim().slice(0, 60), genre: "Perso", year: "", dur: "", pitch: "Ajout manuel ✍️" }]); ui.q = ""; ui.results = []; setState({}); },
    }, [`+ Ajouter « ${ui.q.trim().slice(0, 40)} » (hors catalogue)`]));
  }

  if (!q && !ui.gSel.length && !ui.decSel.length) {
    tab.appendChild(el("p", { class: "mm-dim", style: { fontSize: "13px" } }, ["Tape un titre, ou choisis un genre/une décennie pour parcourir TMDB."]));
  } else if (!ui.busy && results.length === 0) {
    tab.appendChild(el("p", { class: "mm-dim", style: { fontSize: "13px" } }, ["Aucun résultat pour ces filtres."]));
  }

  return tab;
}

// Extrait un nom probable d'une phrase du type "films avec Marion Cotillard" avant de
// l'envoyer à TMDB search/person, qui a besoin du nom seul (pas de la phrase complète).
function extractPersonCandidate(query) {
  const stripped = query.replace(/^(des\s+)?(films?|séries?)\s+(avec|de|du réalisateur|réalisé(e)?s?\s+par|par)\s+/i, "").trim();
  return stripped || query;
}

async function runIA() {
  const query = ui.iaQuery.trim();
  if (!query) return;
  ui.iaBusy = true; ui.iaErr = ""; setState({});
  try {
    // "Films avec tel acteur" : TMDB nativement si la recherche correspond à une vraie personne,
    // sinon on passe par Claude (thèmes, ambiances, "films comme X"…).
    const person = await searchPersonCredits(extractPersonCandidate(query)).catch(() => null);
    const items = person && person.items.length
      ? person.items
      : await reconcileTitles(await suggestFilms(query), "Suggestion IA 🤖");
    if (!items.length) throw new Error("vide");
    addMany(items);
    ui.iaQuery = ""; ui.iaBusy = false;
    setState({});
  } catch {
    ui.iaBusy = false;
    ui.iaErr = 'Rien trouvé — reformule (ex : "thrillers années 90", "films avec Marion Cotillard").';
    setState({});
  }
}

function renderIaTab() {
  const tab = el("div", {});
  const row = el("div", { style: { display: "flex", gap: "8px" } }, [
    el("input", {
      class: "mm-input", style: { flex: "1", padding: "11px 14px", fontSize: "14px" },
      value: ui.iaQuery, placeholder: '"films avec DiCaprio", "séries comme Breaking Bad"…',
      onInput: (e) => { ui.iaQuery = e.target.value; },
      onKeydown: (e) => { if (e.key === "Enter" && !ui.iaBusy) runIA(); },
    }),
    el("button", { class: "mm-btn mm-btn-primary", style: { width: "auto", padding: "0 16px", fontSize: "14px" }, disabled: ui.iaBusy, onClick: runIA }, [ui.iaBusy ? "…" : "Suggérer"]),
  ]);
  tab.appendChild(row);
  if (ui.iaBusy) tab.appendChild(el("div", { style: { marginTop: "10px" } }, [FilmLoader({ inline: true, text: "Recherche de films…" })]));
  if (ui.iaErr) tab.appendChild(el("p", { class: "mm-error", style: { fontSize: "13px", marginTop: "8px" } }, [ui.iaErr]));
  return tab;
}

function renderLinkTab() {
  const tab = el("div", {});
  const row = el("div", { style: { display: "flex", gap: "8px" } }, [
    el("input", {
      class: "mm-input", style: { flex: "1", padding: "11px 14px", fontSize: "14px" },
      value: ui.linkUrl, placeholder: "https://…",
      onInput: (e) => { ui.linkUrl = e.target.value; },
      onKeydown: (e) => { if (e.key === "Enter" && !ui.linkBusy) runLink(); },
    }),
    el("button", { class: "mm-btn mm-btn-primary", style: { width: "auto", padding: "0 16px", fontSize: "14px" }, disabled: ui.linkBusy, onClick: runLink }, [ui.linkBusy ? "…" : "Extraire"]),
  ]);
  tab.appendChild(row);
  if (ui.linkBusy) tab.appendChild(el("div", { style: { marginTop: "10px" } }, [FilmLoader({ inline: true, text: "Claude lit la page…" })]));
  if (ui.linkErr) tab.appendChild(el("p", { class: "mm-error", style: { fontSize: "13px", marginTop: "8px" } }, [ui.linkErr]));
  return tab;

  async function runLink() {
    const url = ui.linkUrl.trim();
    if (!/^https?:\/\/.+\..+/.test(url)) { ui.linkErr = "Colle une URL complète (https://…)."; setState({}); return; }
    ui.linkBusy = true; ui.linkErr = ""; setState({});
    try {
      const titles = await extractFilmsFromLink(url);
      const items = await reconcileTitles(titles, "Importé du lien 📎");
      if (!items.length) throw new Error("vide");
      addMany(items);
      ui.linkUrl = ""; ui.linkBusy = false;
      setState({});
    } catch {
      ui.linkBusy = false;
      ui.linkErr = "Impossible d'extraire des films de cette page.";
      setState({});
    }
  }
}

function renderPhotosTab() {
  const tab = el("div", {});
  const fileInput = el("input", {
    type: "file", accept: "image/*", multiple: true, style: { display: "none" },
    onChange: async (e) => {
      const files = e.target.files;
      e.target.value = "";
      ui.imgBusy = true; ui.imgErr = ""; setState({});
      try {
        const images = await readImagesAsBase64(files);
        if (!images.length) { ui.imgBusy = false; setState({}); return; }
        const titles = await extractFilmsFromImages(images);
        const items = await reconcileTitles(titles, "Importé par capture 📸");
        if (!items.length) throw new Error("vide");
        addMany(items);
        ui.imgBusy = false;
        setState({});
      } catch {
        ui.imgBusy = false;
        ui.imgErr = "Aucun film détecté sur ces images.";
        setState({});
      }
    },
  });
  tab.appendChild(fileInput);
  tab.appendChild(el("button", {
    class: "mm-btn mm-btn-ghost", style: { width: "100%", padding: "12px", border: "1px dashed #ffc53d66", color: "var(--marquee)", fontWeight: "700" },
    disabled: ui.imgBusy,
    onClick: () => fileInput.click(),
  }, ["📸 Choisir des images (max 5)"]));
  if (ui.imgBusy) tab.appendChild(el("div", { style: { marginTop: "10px" } }, [FilmLoader({ inline: true, text: "Claude analyse tes captures…" })]));
  if (ui.imgErr) tab.appendChild(el("p", { class: "mm-error", style: { fontSize: "13px", marginTop: "8px" } }, [ui.imgErr]));
  return tab;
}

let textDraft = "";
function renderTextTab() {
  const tab = el("div", {});
  tab.appendChild(el("textarea", {
    class: "mm-textarea", rows: 5, value: textDraft,
    placeholder: "Colle tes notes — un film par ligne :\nOppenheimer\nLa Haine\nDune 2",
    onInput: (e) => { textDraft = e.target.value; },
  }));
  tab.appendChild(el("button", {
    class: "mm-btn mm-btn-primary", style: { padding: "11px", marginTop: "8px", fontSize: "14px" },
    onClick: () => {
      const lines = parsePastedLines(textDraft, 40);
      if (!lines.length) { stubMsg("Colle tes notes : un film par ligne."); return; }
      addMany(lines.map((t, i) => ({ id: "t" + Date.now() + i, title: t.slice(0, 60), genre: "Perso", year: "", dur: "", pitch: "De tes notes 📝" })));
      textDraft = "";
    },
  }, ["📝 Ajouter ces films"]));
  return tab;
}
