// Listes personnelles (non partagées) — stockées en localStorage, clé "mm:lists".
// Pas besoin de compte ni de table Supabase pour ça (voir PROMPT_CLAUDE_CODE_MOVIEMATCH.md).
const KEY = "mm:lists";

export function loadLists() {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function persist(lists) {
  try {
    localStorage.setItem(KEY, JSON.stringify(lists));
    return true;
  } catch {
    return false;
  }
}

export function upsertList(list) {
  const lists = loadLists();
  const i = lists.findIndex((l) => l.id === list.id);
  list.updatedAt = Date.now();
  if (i === -1) lists.unshift(list);
  else lists[i] = list;
  const ok = persist(lists);
  return { lists: lists.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)), ok };
}

export function deleteList(id) {
  const lists = loadLists().filter((l) => l.id !== id);
  persist(lists);
  return lists;
}
