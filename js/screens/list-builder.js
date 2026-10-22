// Constructeur de liste — maquette "12 Constructeur". 5 sources : catalogue TMDB, IA, photos, lien, notes.
// Panneau fixe en bas : la liste en cours (tap sur une affiche = retirer) + Enregistrer.
import { el } from "../lib/dom.js";
import { state, setState } from "../state.js";
import { GENRES, posterBg } from "../data/genre-style.js";
import { parsePastedLines, uid, normTitle } from "../lib/utils.js";
import { upsertList } from "../lib/local-lists.js";
import { browseCatalog, reconcileTitles, searchPersonCredits } from "../lib/tmdb.js";
import { tmdbSearch, TmdbResultRow } from "../components/tmdb-picker.js";
import { extractFilmsFromLink, extractFilmsFromImages, suggestFilms } from "../lib/claude-proxy.js";
import { readImagesAsBase64 } from "../lib/images.js";
import { FilmLoader } from "../components/film-loader.js";
import { TopBar } from "../components/ui.js";
import { icon } from "../components/icons.js";

const DECADES = [1980, 1990, 2000, 2010, 2020];
let ui = null;
const refresh = () => setState({});

function resetIfNeeded() {
  const initial = state.listEditing;
  if (ui && ui.initialId === (initial ? initial.id : null) && ui.open) return;
  ui = {
    open: true, initial, initialId: initial ? initial.id : null,
    lname: initial ? initial.name : "", films: initial ? [...initial.movies] : [],
    src: "catalog", q: "", gSel: [], decSel: [], results: [], busy: false, err: "",
    iaQuery: "", linkUrl: "", txt: "", work: false, workText: "",
  };
}

const has = (m) => ui.films.some((x) => normTitle(x.title) === normTitle(m.title));
function addMany(items) {
  const seen = new Set(ui.films.map((m) => normTitle(m.title)));
  ui.films = [...ui.films, ...items.filter((m) => !seen.has(normTitle(m.title)))];
  refresh();
}
const removeOne = (m) => { ui.films = ui.films.filter((x) => normTitle(x.title) !== normTitle(m.title)); refresh(); };

async function runWork(text, fn, errMsg) {
  ui.work = true; ui.workText = text; ui.err = ""; refresh();
  try { await fn(); } catch { ui.err = errMsg; }
  ui.work = false; refresh();
}

async function runBrowse() {
  ui.busy = true; ui.err = ""; refresh();
  try { ui.results = await browseCatalog({ genreKeys: ui.gSel, decades: ui.decSel, mediaMode: "both" }); }
  catch { ui.err = "TMDB est injoignable — vérifie ta connexion."; ui.results = []; }
  ui.busy = false; refresh();
}

// "films avec Marion Cotillard" → "Marion Cotillard" pour TMDB search/person
const personOf = (q) => q.replace(/^(des\s+)?(films?|séries?)\s+(avec|de|du réalisateur|réalisé(e)?s?\s+par|par)\s+/i, "").trim() || q;

function catalogTab(tab) {
  tab.appendChild(el("div", { class: "mm-search" }, [
    icon("search", 18, { color: "#9a97a8" }),
    el("label", { class: "sr-only", for: "mm-cat" }, ["Chercher dans le catalogue"]),
    el("input", {
      id: "mm-cat", "data-key": "lb-search", value: ui.q, placeholder: "Titre…",
      onInput: (e) => {
        ui.q = e.target.value; ui.busy = true; refresh();
        tmdbSearch("list-builder", ui.q, (results, err) => {
          if (!ui.q.trim()) { runBrowse(); return; }
          ui.results = results; ui.err = err; ui.busy = false; refresh();
        });
      },
    }),
  ]));
  const chips = (arr, sel, key, fmt, cls = "") => {
    const row = el("div", { class: "mm-chips scroll" });
    arr.forEach((v) => {
      const on = sel.includes(v);
      row.appendChild(el("button", {
        type: "button", class: "mm-chip sm " + cls + (on ? " on" : ""), "aria-pressed": String(on),
        onClick: () => { ui[key] = on ? sel.filter((x) => x !== v) : [...sel, v]; if (!ui.q.trim()) runBrowse(); else refresh(); },
      }, [fmt(v)]));
    });
    return row;
  };
  tab.appendChild(el("div", { class: "mm-field tight" }, [
    el("span", { class: "mm-note" }, ["Genre"]), chips(GENRES, ui.gSel, "gSel", (g) => g),
    el("span", { class: "mm-note" }, ["Décennie"]), chips(DECADES, ui.decSel, "decSel", (d) => `${d}s`, "bebas"),
  ]));

  let results = ui.results;
  const q = ui.q.trim();
  if (q && (ui.gSel.length || ui.decSel.length)) {
    results = results.filter((m) => (!ui.gSel.length || ui.gSel.includes(m.genre)) && (!ui.decSel.length || ui.decSel.includes(Math.floor((m.year || 0) / 10) * 10)));
  }
  const filters = [ui.gSel.join(", "), ui.decSel.map((d) => `${d}s`).join(", ")].filter(Boolean).join(" · ");
  if (ui.busy) tab.appendChild(el("p", { class: "mm-note" }, ["Recherche…"]));
  else if (q || ui.gSel.length || ui.decSel.length) tab.appendChild(el("span", { class: "mm-note" }, [`${Math.min(results.length, 12)} résultat${results.length > 1 ? "s" : ""}${filters ? " · " + filters : ""}`]));
  else tab.appendChild(el("p", { class: "mm-note" }, ["Tape un titre, ou choisis un genre ou une décennie pour parcourir TMDB."]));

  const list = el("div", { class: "mm-stack tight" });
  results.slice(0, 12).forEach((m) => list.appendChild(TmdbResultRow(m, has(m), (it) => addMany([it]), removeOne)));
  if (q.length > 1 && !ui.busy && !ui.films.some((x) => normTitle(x.title) === normTitle(q))) {
    list.appendChild(el("button", {
      type: "button", class: "mm-btn dashed gold-ink",
      onClick: () => { addMany([{ id: uid("man"), title: q.slice(0, 60), genre: "Perso", year: "", dur: "", pitch: "Ajout manuel" }]); ui.q = ""; ui.results = []; refresh(); },
    }, [icon("plus", 16, { stroke: 2.6 }), `Ajouter « ${q.slice(0, 30)} » hors catalogue`]));
  }
  tab.appendChild(list);
}

function inputRow(id, key, value, placeholder, onInput, onGo, label, btn, type = "text") {
  return el("div", { class: "mm-row" }, [
    el("label", { class: "sr-only", for: id }, [label]),
    el("input", { id, "data-key": key, type, class: "mm-input sm", value, placeholder, onInput, onKeydown: (e) => { if (e.key === "Enter" && !ui.work) onGo(); } }),
    el("button", { type: "button", class: "mm-btn soft fit", disabled: ui.work, onClick: onGo }, [btn]),
  ]);
}

function iaTab(tab) {
  const go = () => {
    const query = ui.iaQuery.trim();
    if (!query) return;
    runWork("Recherche de titres…", async () => {
      const person = await searchPersonCredits(personOf(query)).catch(() => null);
      const items = person && person.items.length ? person.items : await reconcileTitles(await suggestFilms(query), "Suggestion IA");
      if (!items.length) throw new Error("vide");
      addMany(items); ui.iaQuery = "";
    }, "Rien trouvé — reformule (ex : « thrillers années 90 », « films avec Marion Cotillard »).");
  };
  tab.appendChild(inputRow("mm-ia", "lb-ia", ui.iaQuery, "« films avec DiCaprio », « séries comme Dark »", (e) => { ui.iaQuery = e.target.value; }, go, "Demande à l'IA", "Suggérer"));
}

function linkTab(tab) {
  const go = () => {
    const url = ui.linkUrl.trim();
    if (!/^https?:\/\/.+\..+/.test(url)) { ui.err = "Colle une URL complète (https://…)."; refresh(); return; }
    runWork("Claude lit la page…", async () => {
      const items = await reconcileTitles(await extractFilmsFromLink(url), "Importé du lien");
      if (!items.length) throw new Error("vide");
      addMany(items); ui.linkUrl = "";
    }, "Impossible d'extraire des films de cette page.");
  };
  tab.appendChild(inputRow("mm-link", "lb-link", ui.linkUrl, "https://…", (e) => { ui.linkUrl = e.target.value; }, go, "Adresse de la page", "Extraire", "url"));
}

function photosTab(tab) {
  const fileInput = el("input", {
    type: "file", accept: "image/*", multiple: true, style: { display: "none" },
    onChange: (e) => {
      const files = e.target.files; e.target.value = "";
      runWork("Lecture des captures…", async () => {
        const images = await readImagesAsBase64(files);
        if (!images.length) return;
        const items = await reconcileTitles(await extractFilmsFromImages(images), "Importé par capture");
        if (!items.length) throw new Error("vide");
        addMany(items);
      }, "Aucun film détecté sur ces images.");
    },
  });
  tab.appendChild(fileInput);
  tab.appendChild(el("button", { type: "button", class: "mm-btn dashed gold-ink xtall", disabled: ui.work, onClick: () => fileInput.click() }, [icon("image", 24), "Choisir des images (max 5)"]));
}

function textTab(tab) {
  tab.appendChild(el("label", { class: "sr-only", for: "mm-notes" }, ["Tes notes"]));
  tab.appendChild(el("textarea", {
    id: "mm-notes", "data-key": "lb-notes", class: "mm-textarea", rows: 5, value: ui.txt,
    placeholder: "Colle tes notes — un titre par ligne :\nOppenheimer\nLa Haine",
    onInput: (e) => { ui.txt = e.target.value; },
  }));
  tab.appendChild(el("button", {
    type: "button", class: "mm-btn soft sm-h",
    onClick: () => {
      const lines = parsePastedLines(ui.txt, 40);
      if (!lines.length) { ui.err = "Colle tes notes : un titre par ligne."; refresh(); return; }
      ui.txt = "";
      addMany(lines.map((t) => ({ id: uid("t"), title: t.slice(0, 60), genre: "Perso", year: "", dur: "", pitch: "De tes notes" })));
    },
  }, [icon("plus", 16, { stroke: 2.4 }), "Ajouter ces titres"]));
}

export function renderListBuilder(container) {
  resetIfNeeded();
  const wrap = el("div", { class: "mm-screen pad-sheet" });
  wrap.appendChild(TopBar({ onBack: () => { ui.open = false; setState({ screen: "lists", listEditing: null }); }, backLabel: "Mes listes" }));
  wrap.appendChild(el("div", { class: "mm-field" }, [
    el("label", { class: "mm-label", for: "mm-nom-liste" }, ["Nom de la liste"]),
    el("input", { id: "mm-nom-liste", "data-key": "lb-name", class: "mm-input bebas", maxlength: 40, value: ui.lname, placeholder: "Soirée ciné du vendredi", onInput: (e) => { ui.lname = e.target.value; } }),
  ]));

  const tabs = el("div", { class: "mm-seg tabs", role: "tablist", "aria-label": "Sources" });
  [["catalog", "Catalogue"], ["ia", "IA"], ["photos", "Photos"], ["link", "Lien"], ["text", "Notes"]].forEach(([k, l]) => {
    tabs.appendChild(el("button", { type: "button", role: "tab", "aria-selected": String(ui.src === k), class: ui.src === k ? "on" : "", onClick: () => { ui.src = k; ui.err = ""; refresh(); } }, [l]));
  });
  wrap.appendChild(tabs);

  const tab = el("div", { class: "mm-stack" });
  ({ catalog: catalogTab, ia: iaTab, photos: photosTab, link: linkTab, text: textTab })[ui.src](tab);
  wrap.appendChild(tab);
  if (ui.work) wrap.appendChild(FilmLoader({ inline: true, text: ui.workText, hint: "Ça prend quelques secondes" }));
  if (ui.err) wrap.appendChild(el("p", { class: "mm-error", role: "alert" }, [ui.err]));

  // Panneau fixe : la liste en cours
  const thumbs = el("div", { class: "mm-chips scroll pad-top" });
  ui.films.forEach((m) => thumbs.appendChild(el("button", {
    type: "button", class: "mm-thumb", title: m.title, "aria-label": `Retirer ${m.title}`, style: { background: posterBg(m) }, onClick: () => removeOne(m),
  }, [el("span", { class: "mm-thumb-x" }, [icon("x", 11, { stroke: 3 })])])));
  wrap.appendChild(el("div", { class: "mm-dock" }, [
    el("div", { class: "mm-dock-in" }, [
      el("div", { class: "mm-row-between" }, [el("span", { class: "mm-h2 xs" }, ["LISTE EN COURS"]), el("span", { class: "mm-big-num sm" }, [String(ui.films.length)])]),
      ui.films.length ? thumbs : el("span", { class: "mm-note" }, ["Ajoute des titres depuis une des sources ci-dessus."]),
      el("button", {
        type: "button", class: "mm-btn gold flat", disabled: ui.films.length < 2,
        onClick: () => {
          upsertList({ ...(ui.initial || {}), id: ui.initialId || uid("l"), name: ui.lname.trim() || "Ma liste", movies: ui.films });
          ui.open = false;
          setState({ screen: "lists", listEditing: null });
        },
      }, [ui.films.length < 2 ? "Ajoute au moins 2 titres" : "Enregistrer"]),
    ]),
  ]));
  container.appendChild(wrap);
}
