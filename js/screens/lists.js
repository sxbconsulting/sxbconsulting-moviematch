// Mes listes façon SensCritique — stockées en local (js/lib/local-lists.js).
// Le partage par code passe par mm_shared_lists (Supabase) — un code à 4 lettres, pas de compte.
import { el } from "../lib/dom.js";
import { state, setState } from "../state.js";
import { loadLists, deleteList, upsertList } from "../lib/local-lists.js";
import { cleanName, pickRandom, randCode } from "../lib/utils.js";
import { launchSession, goHome } from "../actions.js";
import { shareList, getSharedList } from "../lib/backend.js";

let ui = { msg: "", shareCodes: {}, shareBusy: {}, importCode: "", importBusy: false };

function openBuilder(list) {
  setState({ screen: "listBuilder", listEditing: list || null });
}

function removeConfirm(l) {
  if (ui.msg === `Re-clique ✕ pour supprimer "${l.name}"`) {
    deleteList(l.id);
    ui.msg = "";
    setState({});
  } else {
    ui.msg = `Re-clique ✕ pour supprimer "${l.name}"`;
    setState({});
  }
}

export function renderLists(container) {
  const wrap = el("div", { style: { marginTop: "8px" } });

  wrap.appendChild(el("button", { class: "mm-btn mm-btn-ghost", style: { marginBottom: "14px" }, onClick: () => goHome() }, ["← Accueil"]));
  wrap.appendChild(el("div", { class: "mm-title", style: { marginBottom: "4px" } }, ["📚 MES LISTES"]));
  wrap.appendChild(el("p", { class: "mm-dim", style: { fontSize: "13px", margin: "0 0 14px", lineHeight: "1.4" } }, [
    "Compose tes listes, partage-les avec un code, lance une salle ou un VS dessus.",
  ]));

  if (!cleanName(state.name)) {
    wrap.appendChild(el("input", {
      class: "mm-input", style: { marginBottom: "12px" }, value: state.name, maxlength: 20,
      placeholder: "Ton prénom (pour lancer une salle)",
      onInput: (e) => { state.name = e.target.value; },
    }));
  }

  wrap.appendChild(el("button", { class: "mm-btn mm-btn-primary", style: { marginBottom: "14px" }, onClick: () => openBuilder(null) }, ["+ Créer une liste"]));

  const lists = loadLists();
  if (lists.length === 0) {
    wrap.appendChild(el("p", { class: "mm-dim", style: { fontSize: "14px" } }, ["Aucune liste pour l'instant — crée la première ! 🎬"]));
  }

  lists.forEach((l) => {
    const card = el("div", { class: "mm-panel", style: { marginBottom: "10px" } }, [
      el("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline" } }, [
        el("div", { style: { fontWeight: "700", fontSize: "15px" } }, [l.name]),
        el("span", { class: "mm-dim", style: { fontSize: "12px" } }, [`${l.movies.length} films`]),
      ]),
    ]);
    const actions = el("div", { style: { display: "flex", gap: "8px", marginTop: "10px", flexWrap: "wrap" } }, [
      el("button", {
        class: "mm-btn mm-btn-ghost", style: { color: "var(--marquee)", borderColor: "#ffc53d55" },
        onClick: () => {
          if (!cleanName(state.name)) { ui.msg = "Mets ton prénom d'abord (en haut) !"; setState({}); return; }
          launchSession(l.movies.length > 30 ? pickRandom(l.movies, 30) : l.movies);
        },
      }, ["🎬 Salle"]),
      el("button", {
        class: "mm-btn mm-btn-ghost",
        onClick: () => {
          if (l.movies.length < 2) { ui.msg = "Il faut au moins 2 films pour un VS."; setState({}); return; }
          setState({ vsPool: pickRandom(l.movies, Math.min(8, l.movies.length)), winner: null, vsBack: "lists", screen: "versus" });
        },
      }, ["⚔️ VS"]),
      el("button", {
        class: "mm-btn mm-btn-ghost",
        onClick: () => {
          if (l.movies.length < 2) { ui.msg = "Il faut au moins 2 films pour un tirage."; setState({}); return; }
          setState({ rouletteSeed: l.movies, screen: "roulette" });
        },
      }, ["🎲"]),
      el("button", {
        class: "mm-btn mm-btn-ghost",
        disabled: !!ui.shareBusy[l.id],
        onClick: async () => {
          ui.shareBusy[l.id] = true; setState({});
          const code = randCode();
          const ok = await shareList(code, l.name, l.movies);
          ui.shareBusy[l.id] = false;
          if (ok) { ui.shareCodes[l.id] = code; ui.msg = ""; }
          else { ui.msg = "⚠️ Partage impossible — vérifie ta connexion."; }
          setState({});
        },
      }, [ui.shareBusy[l.id] ? "…" : "🔗 Partager"]),
      el("button", { class: "mm-btn mm-btn-ghost", onClick: () => openBuilder(l) }, ["✏️"]),
      el("button", { class: "mm-btn mm-btn-ghost", style: { color: "var(--nope)" }, onClick: () => removeConfirm(l) }, ["✕"]),
    ]);
    card.appendChild(actions);
    if (ui.shareCodes[l.id]) {
      card.appendChild(el("div", { style: { marginTop: "10px", fontSize: "13px", color: "var(--marquee)" } }, [
        "Code de partage : ",
        el("b", { style: { fontFamily: "var(--font-display)", fontSize: "20px", letterSpacing: "3px" } }, [ui.shareCodes[l.id]]),
        " — tes potes l'importent en bas de leur écran \"Mes listes\".",
      ]));
    }
    wrap.appendChild(card);
  });

  const importRow = el("div", { style: { display: "flex", gap: "8px", marginTop: "16px" } }, [
    el("input", {
      class: "mm-input code", style: { width: "110px" }, placeholder: "CODE", maxlength: 4,
      value: ui.importCode,
      onInput: (e) => { ui.importCode = e.target.value.toUpperCase(); },
    }),
    el("button", {
      class: "mm-btn mm-btn-primary", style: { flex: "1", padding: "0 12px", fontSize: "14px" },
      disabled: ui.importBusy,
      onClick: async () => {
        const code = ui.importCode.trim().toUpperCase();
        if (code.length !== 4) { ui.msg = "Le code fait 4 lettres."; setState({}); return; }
        ui.importBusy = true; ui.msg = ""; setState({});
        const shared = await getSharedList(code);
        ui.importBusy = false;
        if (!shared || !Array.isArray(shared.movies) || !shared.movies.length) {
          ui.msg = `Aucune liste "${code}" trouvée.`; setState({}); return;
        }
        upsertList({ id: "l" + Date.now(), name: (shared.name || "Liste") + " 📥", movies: shared.movies });
        ui.importCode = ""; ui.msg = "Liste importée ✔"; setState({});
      },
    }, [ui.importBusy ? "…" : "📥 Importer une liste"]),
  ]);
  wrap.appendChild(importRow);

  if (ui.msg) {
    wrap.appendChild(el("p", { style: { color: ui.msg.includes("✔") ? "var(--match)" : "var(--nope)", fontSize: "13px", marginTop: "10px" } }, [ui.msg]));
  }

  container.appendChild(wrap);
}
