// Création de salle — maquette "02 Création salle" : Films/Séries/Les deux, plateformes, 4 modes de deck.
import { el } from "../lib/dom.js";
import { state, setState } from "../state.js";
import { GENRES } from "../data/genre-style.js";
import { parsePastedLines, DECK_SIZE, DECK_MAX, pickRandom, uid, normTitle } from "../lib/utils.js";
import { launchSession, goHome } from "../actions.js";
import { getPool, discoverByGenres, discoverOnPlatforms, tagPlatforms, reconcileTitles, PLATFORMS } from "../lib/tmdb.js";
import { tmdbSearch, TmdbResultRow } from "../components/tmdb-picker.js";
import { extractFilmsFromLink, extractFilmsFromImages } from "../lib/claude-proxy.js";
import { readImagesAsBase64 } from "../lib/images.js";
import { FilmLoader } from "../components/film-loader.js";
import { TopBar, Poster } from "../components/ui.js";
import { icon } from "../components/icons.js";
import { getPrefs, savePrefs } from "../lib/prefs.js";
import { notSeen, seenCount, resetSeen } from "../lib/seen.js";

const fresh = () => ({
  open: null, mediaMode: "both", selGenres: [], err: "", checking: false, checkText: "",
  custom: [], q: "", searchResults: [], searchBusy: false, searchErr: "",
  linkUrl: "", linkBusy: false, linkInfo: "", pTxt: "", imgBusy: false, imgCount: 0,
});
let ui = fresh();
export function resetSetupState() { ui = fresh(); }

const refresh = () => setState({});
const platforms = () => getPrefs().platforms || [];
const byMedia = (items) => (ui.mediaMode === "both" ? items : items.filter((m) => m.media_type === ui.mediaMode));

function addToCustom(items) {
  const seen = new Set(ui.custom.map((m) => normTitle(m.title)));
  ui.custom = [...ui.custom, ...items.filter((m) => !seen.has(normTitle(m.title)))];
}

// Tirage (sélection ou genres), filtré par plateformes si des plateformes sont cochées, sans les "déjà vu".
async function launchDraw(genreKeys) {
  const plats = platforms();
  ui.err = ""; ui.checking = true;
  ui.checkText = plats.length ? "On cherche ce qui est dispo sur vos plateformes" : "Tirage des titres";
  refresh();
  try {
    let pool;
    if (plats.length) pool = await discoverOnPlatforms(plats, { genreKeys, mediaMode: ui.mediaMode });
    else pool = genreKeys.length ? await discoverByGenres(genreKeys, ui.mediaMode) : await getPool();
    pool = notSeen(byMedia(pool));
    if (pool.length < 2) {
      ui.checking = false;
      ui.err = plats.length ? `Pas assez de titres dispo sur ${plats.join(", ")} pour ces critères. Coche d'autres plateformes ou élargis.` : "Pas assez de résultats pour ce filtre — essaie « Les deux » ou d'autres genres.";
      refresh(); return;
    }
    let deck = pickRandom(pool, Math.min(DECK_SIZE, pool.length));
    if (plats.length) deck = await tagPlatforms(deck);
    ui.checking = false;
    launchSession(deck);
  } catch {
    ui.checking = false;
    ui.err = "TMDB est injoignable — vérifie ta connexion et réessaie.";
    refresh();
  }
}

function modeHead({ ico, title, desc, right = null, onClick = null, open = false }) {
  const inner = [
    el("div", { class: "mm-mode-ico" }, [icon(ico, 22)]),
    el("div", { class: "mm-mode-txt" }, [el("span", { class: "mm-mode-title" }, [title]), el("span", { class: "mm-mode-desc" }, [desc])]),
    right,
  ];
  if (!onClick) return el("div", { class: "mm-mode-head" }, inner);
  return el("button", { type: "button", class: "mm-mode-head", "aria-expanded": String(open), onClick }, inner);
}

function renderPlatforms(wrap) {
  const plats = platforms();
  const row = el("div", { class: "mm-chips scroll" });
  PLATFORMS.forEach(({ label }) => {
    const on = plats.includes(label);
    row.appendChild(el("button", {
      type: "button", class: "mm-chip sm" + (on ? " on" : ""), "aria-pressed": String(on),
      onClick: () => { savePrefs({ platforms: on ? plats.filter((x) => x !== label) : [...plats, label] }); refresh(); },
    }, [on ? icon("check", 13, { stroke: 3 }) : null, label]));
  });
  const n = seenCount();
  wrap.appendChild(el("div", { class: "mm-field" }, [
    el("span", { class: "mm-label" }, ["Vos plateformes ", el("span", { class: "faint" }, ["· optionnel, filtre les tirages"])]),
    row,
    n ? el("span", { class: "mm-note" }, [
      `${n} titre${n > 1 ? "s" : ""} déjà vu${n > 1 ? "s" : ""} exclu${n > 1 ? "s" : ""} des tirages · `,
      el("button", { type: "button", class: "mm-inline-link", onClick: () => { resetSeen(); refresh(); } }, ["réinitialiser"]),
    ]) : null,
  ]));
}

function renderRandom(wrap) {
  wrap.appendChild(el("section", { class: "mm-mode" }, [
    modeHead({ ico: "dice", title: "Sélection au hasard", desc: `${DECK_SIZE} titres populaires tirés pour vous`, right: el("span", { class: "mm-big-num" }, [String(DECK_SIZE)]) }),
    el("button", { type: "button", class: "mm-btn gold flat md", disabled: state.busy || ui.checking, onClick: () => launchDraw([]) }, ["Lancer la salle"]),
  ]));
}

function renderGenres(wrap) {
  const open = ui.open === "genres";
  const n = ui.selGenres.length;
  const sec = el("section", { class: "mm-mode" + (open ? " active" : "") }, [
    modeHead({
      ico: "grid", title: "Par catégorie", desc: "Mélange les genres qui vous tentent", open,
      right: n ? el("span", { class: "mm-count-pill" }, [`${n} GENRE${n > 1 ? "S" : ""}`]) : null,
      onClick: () => { ui.open = open ? null : "genres"; refresh(); },
    }),
  ]);
  if (open) {
    const chips = el("div", { class: "mm-chips" });
    GENRES.forEach((g) => {
      const on = ui.selGenres.includes(g);
      chips.appendChild(el("button", {
        type: "button", class: "mm-chip" + (on ? " on" : ""), "aria-pressed": String(on),
        onClick: () => { ui.selGenres = on ? ui.selGenres.filter((x) => x !== g) : [...ui.selGenres, g]; refresh(); },
      }, [on ? icon("check", 14, { stroke: 3 }) : null, g]));
    });
    sec.appendChild(chips);
    sec.appendChild(el("button", {
      type: "button", class: "mm-btn gold flat md", disabled: state.busy || ui.checking || !n,
      onClick: () => launchDraw(ui.selGenres),
    }, [n ? `Lancer avec ${DECK_SIZE} titres` : "Choisis au moins un genre"]));
  }
  wrap.appendChild(sec);
}

async function importLink() {
  const url = ui.linkUrl.trim();
  if (!/^https?:\/\/.+\..+/.test(url)) { ui.err = "Colle une URL complète (https://…)."; refresh(); return; }
  ui.linkBusy = true; ui.err = ""; ui.linkInfo = ""; refresh();
  try {
    const items = await reconcileTitles(await extractFilmsFromLink(url), "Importé du lien");
    if (!items.length) throw new Error("vide");
    addToCustom(items);
    ui.linkUrl = ""; ui.linkInfo = `${items.length} titres extraits`;
  } catch {
    ui.err = "Impossible d'extraire des films de cette page — vérifie le lien ou essaie une capture d'écran.";
  }
  ui.linkBusy = false; refresh();
}

function renderLink(wrap) {
  const sec = el("section", { class: "mm-mode" }, [
    modeHead({ ico: "link", title: "Depuis un lien", desc: "Liste SensCritique, top Allociné, article…" }),
    el("div", { class: "mm-row" }, [
      el("label", { class: "sr-only", for: "mm-url" }, ["Adresse de la page"]),
      el("input", {
        id: "mm-url", "data-key": "setup-url", type: "url", class: "mm-input sm", value: ui.linkUrl, placeholder: "https://…",
        onInput: (e) => { ui.linkUrl = e.target.value; },
        onKeydown: (e) => { if (e.key === "Enter" && !ui.linkBusy) importLink(); },
      }),
      el("button", { type: "button", class: "mm-btn soft fit", disabled: ui.linkBusy, onClick: importLink }, ["Extraire"]),
    ]),
  ]);
  if (ui.linkBusy) sec.appendChild(FilmLoader({ inline: true, text: "Extraction des titres…", hint: "On lit ta page, ça prend quelques secondes" }));
  // Correctif : les titres extraits se lancent directement d'ici (avant, il fallait aller dans "Liste perso")
  if (ui.linkInfo && ui.custom.length > 1) {
    sec.appendChild(el("button", { type: "button", class: "mm-btn gold flat md", disabled: state.busy, onClick: () => launchSession(ui.custom) }, [`${ui.linkInfo} · Lancer avec ${Math.min(ui.custom.length, DECK_MAX)} titres`]));
  }
  wrap.appendChild(sec);
}

function renderPerso(wrap) {
  const open = ui.open === "perso";
  const sec = el("section", { class: "mm-mode" + (open ? " active" : "") }, [
    modeHead({
      ico: "list", title: "Liste perso", desc: "Vos propres titres, de toutes les façons", open,
      right: ui.custom.length ? el("span", { class: "mm-big-num" }, [String(ui.custom.length)]) : null,
      onClick: () => { ui.open = open ? null : "perso"; refresh(); },
    }),
  ]);
  if (!open) { wrap.appendChild(sec); return; }

  const inList = (m) => ui.custom.some((x) => normTitle(x.title) === normTitle(m.title));
  const q = ui.q.trim();

  // Recherche TMDB
  sec.appendChild(el("div", { class: "mm-field" }, [
    el("label", { class: "mm-label", for: "mm-cherche" }, ["Chercher un film ou une série"]),
    el("div", { class: "mm-search" + (q ? " focus" : "") }, [
      icon("search", 18, { color: "#9a97a8" }),
      el("input", {
        id: "mm-cherche", "data-key": "setup-search", value: ui.q, placeholder: "Interstellar, Lupin…",
        onInput: (e) => {
          ui.q = e.target.value; ui.searchBusy = true; refresh();
          tmdbSearch("setup-perso", ui.q, (results, err) => { ui.searchResults = results; ui.searchErr = err; ui.searchBusy = false; refresh(); });
        },
      }),
    ]),
  ]));
  if (ui.searchErr) sec.appendChild(el("p", { class: "mm-error" }, [ui.searchErr]));
  if (q.length > 1 && (ui.searchResults.length || !ui.searchBusy)) {
    const box = el("div", { class: "mm-suggest", role: "listbox", "aria-label": "Suggestions" });
    ui.searchResults.slice(0, 5).forEach((m) => box.appendChild(TmdbResultRow(m, inList(m), (it) => { addToCustom([it]); refresh(); }, (it) => { ui.custom = ui.custom.filter((x) => normTitle(x.title) !== normTitle(it.title)); refresh(); })));
    if (!ui.searchBusy && !ui.custom.some((x) => normTitle(x.title) === normTitle(q))) {
      box.appendChild(el("button", {
        type: "button", class: "mm-suggest-add",
        onClick: () => { addToCustom([{ id: uid("man"), title: q.slice(0, 60), genre: "Perso", year: "", dur: "", pitch: "Ajout manuel" }]); ui.q = ""; ui.searchResults = []; refresh(); },
      }, [icon("plus", 16, { stroke: 2.6 }), `Ajouter « ${q.slice(0, 30)} » hors catalogue`]));
    }
    sec.appendChild(box);
  }

  // Captures
  const fileInput = el("input", {
    type: "file", accept: "image/*", multiple: true, style: { display: "none" },
    onChange: async (e) => {
      const files = e.target.files; e.target.value = "";
      ui.imgBusy = true; ui.err = ""; refresh();
      try {
        const images = await readImagesAsBase64(files);
        if (images.length) {
          const items = await reconcileTitles(await extractFilmsFromImages(images), "Importé par capture");
          if (!items.length) throw new Error("vide");
          addToCustom(items);
          ui.imgCount = Math.min(5, ui.imgCount + images.length);
        }
      } catch { ui.err = "Aucun film détecté — réessaie avec des captures plus nettes (liste Netflix, affiches…)."; }
      ui.imgBusy = false; refresh();
    },
  });
  sec.appendChild(el("div", { class: "mm-field" }, [
    el("span", { class: "mm-label" }, ["Captures d'écran ", el("span", { class: "faint" }, [`· ${ui.imgCount} / 5`])]),
    fileInput,
    el("button", { type: "button", class: "mm-btn dashed gold-ink tall", disabled: ui.imgBusy || ui.imgCount >= 5, onClick: () => fileInput.click() }, [icon("image", 20), "Importer des captures (liste Netflix, affiches…)"]),
    ui.imgBusy ? FilmLoader({ inline: true, text: "Lecture des captures…", hint: "Claude repère les titres sur tes images" }) : null,
  ]));

  // Coller une liste
  sec.appendChild(el("div", { class: "mm-field" }, [
    el("label", { class: "mm-label", for: "mm-lignes" }, ["Un titre par ligne"]),
    el("textarea", {
      id: "mm-lignes", "data-key": "setup-lines", class: "mm-textarea", rows: 3, value: ui.pTxt, placeholder: "Whiplash\nLe Voyage de Chihiro",
      onInput: (e) => { const had = !!ui.pTxt.trim(); ui.pTxt = e.target.value; if (had !== !!ui.pTxt.trim()) refresh(); },
    }),
    ui.pTxt.trim() ? el("button", {
      type: "button", class: "mm-btn dashed",
      onClick: () => {
        addToCustom(parsePastedLines(ui.pTxt, 40).map((t) => ({ id: uid("t"), title: t.slice(0, 60), genre: "Perso", year: "", dur: "", pitch: "De tes notes" })));
        ui.pTxt = ""; refresh();
      },
    }, [icon("plus", 16, { stroke: 2.4 }), "Ajouter ces titres"]) : null,
  ]));

  if (ui.custom.length) {
    const ul = el("ul", { class: "mm-hat" });
    ui.custom.forEach((m, i) => ul.appendChild(el("li", { class: "mm-hat-item" }, [
      Poster(m, { w: 24, h: 36, r: 5 }),
      el("span", { class: "mm-hat-title" }, [m.title]),
      el("button", { type: "button", class: "mm-icon-btn ghost", "aria-label": `Retirer ${m.title}`, onClick: () => { ui.custom = ui.custom.filter((_, j) => j !== i); refresh(); } }, [icon("x", 18)]),
    ])));
    sec.appendChild(ul);
  }

  sec.appendChild(el("button", {
    type: "button", class: "mm-btn gold flat", disabled: state.busy || ui.custom.length < 2,
    onClick: () => launchSession(ui.custom),
  }, [ui.custom.length < 2 ? "Ajoute au moins 2 titres" : `Lancer avec ${Math.min(ui.custom.length, DECK_MAX)} titres`]));
  wrap.appendChild(sec);
}

export function renderSetup(container) {
  const wrap = el("div", { class: "mm-screen" });
  if (ui.checking) wrap.appendChild(FilmLoader({ text: ui.checkText, hint: "Ça prend quelques secondes" }));
  wrap.appendChild(TopBar({ onBack: () => goHome() }));
  wrap.appendChild(el("div", {}, [
    el("h1", { class: "mm-h1" }, ["NOUVELLE SALLE"]),
    el("p", { class: "mm-sub" }, [`${state.name.trim() ? state.name.trim() + ", choisis" : "Choisis"} ce que la bande va swiper.`]),
  ]));

  const seg = el("div", { class: "mm-seg", role: "group", "aria-label": "Type de contenu" });
  [["movie", "Films"], ["tv", "Séries"], ["both", "Les deux"]].forEach(([k, label]) => {
    seg.appendChild(el("button", { type: "button", class: ui.mediaMode === k ? "on" : "", "aria-pressed": String(ui.mediaMode === k), onClick: () => { ui.mediaMode = k; refresh(); } }, [label]));
  });
  wrap.appendChild(seg);

  renderPlatforms(wrap);
  if (ui.err || state.err) wrap.appendChild(el("p", { class: "mm-error", role: "alert" }, [ui.err || state.err]));
  renderRandom(wrap);
  renderGenres(wrap);
  renderLink(wrap);
  renderPerso(wrap);
  container.appendChild(wrap);
}
