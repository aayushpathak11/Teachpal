// Cloud backup of progress through the hosting artifact's database, so it follows
// the learner across devices. Without it (local dev, signed out) the app keeps
// working from browser storage alone.

let ref = null;
let timer = null;
let writing = false;
let again = false;
let getState = () => null;
let status = "local"; // "local" | "syncing" | "synced" | "offline"
const listeners = new Set();

const setStatus = (s) => {
  status = s;
  listeners.forEach((fn) => fn(s));
};
export const syncStatus = () => status;
export const onSyncStatus = (fn) => listeners.add(fn);

export async function connect(stateGetter, onRemote) {
  getState = stateGetter;
  const use = window.claude?.use;
  if (!use) return;
  try {
    const [db, user] = await Promise.all([use("db"), use("user")]);
    const uid = db && user ? await user.id() : null;
    if (!uid) return;
    ref = db.doc(`progress/${uid}`);
    setStatus("syncing");
    const snap = await ref.get();
    if (snap.exists) onRemote(snap.data());
    await push();
  } catch (e) {
    console.warn("cloud sync unavailable", e);
    ref = null;
    setStatus("local");
  }
}

export function schedule() {
  if (!ref) return;
  clearTimeout(timer);
  timer = setTimeout(push, 1500);
}

export function flush() {
  if (!ref || !timer) return;
  clearTimeout(timer);
  push();
}

async function push() {
  timer = null;
  if (!ref) return;
  if (writing) return void (again = true);
  writing = true;
  setStatus("syncing");
  try {
    await ref.set(JSON.parse(JSON.stringify(getState())));
    setStatus("synced");
  } catch (e) {
    setStatus("offline");
    if (e?.code === "unavailable") setTimeout(schedule, 3000 + Math.random() * 2000);
    if (e?.code === "invalid_argument" || e?.code === "revoked") ref = null; // can't write here: stay local
  } finally {
    writing = false;
    if (again) {
      again = false;
      push();
    }
  }
}
