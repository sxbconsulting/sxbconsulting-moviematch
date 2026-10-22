// Mes listes façon SensCritique — maquette "11 Mes listes". Stockées en local (js/lib/local-lists.js).
// Partage par code 5 lettres via mm_shared_lists (Supabase), sans compte.
import { el } from "../lib/dom.js";
import { state, setState, notify } from "../state.js";
import { loadLists, deleteList, upsertList } from "../lib/local-lists.js";
import { cleanName, pickRandom, randCode, cleanCode, isValidCode, CODE_LEN, uid, shareText } from "../lib/utils.js";
import { launchSession, goHome, setName } from "../actions.js";
import { shareList, getSharedList } from "../lib/backend.js";
import { TopBar, Poster, Empty } from "../components/ui.js";
import { icon } from "../components/icons.js";

let ui = { msg: "", importCode: "", importBusy: false, shareBusy: {}, confirmDel: null };
const refresh = () => setState({});
const openBuilder = (list) => setState({ screen: "listBuilder", listEditing: list || null });

async function share(l) {
  ui.shareBusy[l.id] = true; ui.msg = ""; refresh();
  let code = l.code, ok = true;
  if (!code) {
    code = randCode();
    ok = await shareList(code, l.name, l.movies);
    if (ok) upsertList({ ...l, code });
  }
  ui.shareBusy[l.id] = false;
  if (!ok) { ui.msg = "Partage impossible — vérifie ta connexion."; refresh(); return; }
  refresh();
  const r = await shareText(`Ma liste MovieMatch « ${l.name} » — importe-la dans l'app avec le code ${code}`);
  if (r !== "ok") notify(`Code de partage : ${code}`);
}

async function importList() {
  const code = cleanCode(ui.importCode);
  if (!isValidCode(code)) { ui.msg = `Le code fait ${CODE_LEN} lettres.`; refresh(); return; }
  ui.importBusy = true; ui.msg = ""; refresh();
  const shared = await getSharedList(code);
  ui.importBusy = false;
  if (!shared || !Array.isArray(shared.movies) || !shared.movies.length) { ui.msg = `Aucune liste "${code}" trouvée.`; refresh(); return; }
  upsertList({ id: uid("l"), name: (shared.name || "Liste") + " (importée)", movies: shared.movies });
  ui.importCode = "";
  notify("Liste importée");
}

function act(kind, l) {
  if (kind === "room" && !cleanName(state.name)) { ui.msg = "Mets ton prénom juste au-dessus pour lancer une salle."; refresh(); return; }
  if (kind !== "room" && l.movies.length < 2) { ui.msg = "Il faut au moins 2 titres."; refresh(); return; }
  ui.msg = "";
  if (kind === "room") { setName(state.name); launchSession(l.movies); }
  if (kind === "vs") setState({ vsPool: pickRandom(l.movies, Math.min(8, l.movies.length)), winner: null, vsBack: "lists", screen: "versus" });
  if (kind === "quick") setState({ rouletteSeed: l.movies, screen: "roulette" });
}

function listCard(l) {
  const [a, b, c] = [l.movies[2] || l.movies[0], l.movies[1] || l.movies[0], l.movies[0]];
  const nTv = l.movies.filter((m) => m.media_type === "tv").length;
  const count = nTv === l.movies.length ? `${l.movies.length} série${l.movies.length > 1 ? "s" : ""}` : `${l.movies.length} titre${l.movies.length > 1 ? "s" : ""}`;
  const card = el("article", { class: "mm-list-card" }, [
    el("div", { class: "mm-list-top" }, [
      el("div", { class: "mm-stack3", "aria-hidden": "true" }, [Poster(a, { w: 38, h: 57, r: 7, cls: "s1" }), Poster(b, { w: 38, h: 57, r: 7, cls: "s2" }), Poster(c, { w: 38, h: 57, r: 7, cls: "s3" })]),
      el("div", { class: "mm-list-txt" }, [el("h2", { class: "mm-list-name" }, [l.name]), el("span", { class: "mm-note" }, [count])]),
      l.code ? el("div", { class: "mm-code-badge" }, [el("span", {}, ["CODE"]), el("b", {}, [l.code])]) : null,
    ]),
  ]);
  if (ui.confirmDel === l.id) {
    card.appendChild(el("div", { class: "mm-row-center left" }, [
      el("span", { class: "grow" }, [`Supprimer « ${l.name} » ?`]),
      el("button", { type: "button", class: "mm-btn dark fit sm-h", onClick: () => { ui.confirmDel = null; refresh(); } }, ["Annuler"]),
      el("button", { type: "button", class: "mm-btn danger fit sm-h", onClick: () => { deleteList(l.id); ui.confirmDel = null; refresh(); } }, ["Supprimer"]),
    ]));
  } else {
    card.appendChild(el("div", { class: "mm-list-actions" }, [
      el("button", { type: "button", class: "mm-btn gold flat sm-h", onClick: () => act("room", l) }, ["Salle"]),
      el("button", { type: "button", class: "mm-btn soft sm-h bebas", onClick: () => act("vs", l) }, ["VS"]),
      el("button", { type: "button", class: "mm-icon-btn", "aria-label": `Tirer au sort dans ${l.name}`, onClick: () => act("quick", l) }, [icon("dice", 18)]),
      el("button", { type: "button", class: "mm-icon-btn", "aria-label": `Partager ${l.name}`, disabled: !!ui.shareBusy[l.id], onClick: () => share(l) }, [icon("share", 18)]),
      el("button", { type: "button", class: "mm-icon-btn", "aria-label": `Modifier ${l.name}`, onClick: () => openBuilder(l) }, [icon("edit", 18)]),
      el("button", { type: "button", class: "mm-icon-btn danger", "aria-label": `Supprimer ${l.name}`, onClick: () => { ui.confirmDel = l.id; refresh(); } }, [icon("trash", 18)]),
    ]));
  }
  return card;
}

export function renderLists(container) {
  const lists = loadLists().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const wrap = el("div", { class: "mm-screen" });
  wrap.appendChild(TopBar({ onBack: () => goHome() }));
  wrap.appendChild(el("div", { class: "mm-row-between end" }, [
    el("div", {}, [el("h1", { class: "mm-h1" }, ["MES LISTES"]), el("p", { class: "mm-sub" }, [`${lists.length} liste${lists.length > 1 ? "s" : ""} · stockées sur ce téléphone`])]),
    el("button", { type: "button", class: "mm-btn gold flat fit sm-h", onClick: () => openBuilder(null) }, [icon("plus", 16, { stroke: 2.6 }), "Nouvelle"]),
  ]));

  if (!cleanName(state.name)) {
    wrap.appendChild(el("div", { class: "mm-field" }, [
      el("label", { class: "mm-label", for: "mm-prenom-l" }, ["Ton prénom (pour lancer une salle depuis une liste)"]),
      el("input", { id: "mm-prenom-l", "data-key": "lists-name", class: "mm-input sm", value: state.name, maxlength: 20, placeholder: "Ex. Inès", onInput: (e) => { state.name = e.target.value; } }),
    ]));
  }

  wrap.appendChild(el("div", { class: "mm-import" }, [
    el("label", { class: "mm-label", for: "mm-import" }, ["Importer la liste d'un pote"]),
    el("div", { class: "mm-row" }, [
      el("input", {
        id: "mm-import", "data-key": "lists-import", class: "mm-input code sm", maxlength: CODE_LEN, placeholder: "CODE", value: ui.importCode,
        onInput: (e) => { const c = cleanCode(e.target.value); ui.importCode = c; if (e.target.value !== c) e.target.value = c; },
        onKeydown: (e) => { if (e.key === "Enter" && !ui.importBusy) importList(); },
      }),
      el("button", { type: "button", class: "mm-btn soft fit", disabled: ui.importBusy, onClick: importList }, [ui.importBusy ? "…" : "Importer"]),
    ]),
  ]));

  if (ui.msg) wrap.appendChild(el("p", { class: "mm-error", role: "alert" }, [ui.msg]));
  if (!lists.length) {
    wrap.appendChild(Empty("Aucune liste pour l'instant. Compose la première : catalogue, IA, captures, lien ou notes.",
      el("button", { type: "button", class: "mm-btn soft fit sm-h", onClick: () => openBuilder(null) }, [icon("plus", 16, { stroke: 2.6 }), "Créer une liste"])));
  }
  const stack = el("div", { class: "mm-stack" });
  lists.forEach((l) => stack.appendChild(listCard(l)));
  wrap.appendChild(stack);
  container.appendChild(wrap);
}
