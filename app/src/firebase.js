// Firestore access. Data layout (see firestore.rules):
//   gardens/{gardenCode}                     exists ⇔ the code is valid
//   gardens/{gardenCode}/waterings/{autoId}  {zone, by, day: "YYYY-MM-DD", at: server time}
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import {
  addDoc, collection, doc, getDoc, getFirestore, onSnapshot, query, serverTimestamp, where,
} from "firebase/firestore";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let signedIn;
/** Anonymous sign-in: no account for the user, but the rules can require request.auth. */
function ensureSignedIn() {
  signedIn ??= signInAnonymously(auth).catch((e) => {
    signedIn = null;
    throw e;
  });
  return signedIn;
}

export async function gardenExists(code) {
  await ensureSignedIn();
  return (await getDoc(doc(db, "gardens", code))).exists();
}

/** Live list of waterings since `sinceDay`; calls back with the full list on every change. */
export function watchWaterings(code, sinceDay, onChange, onError) {
  let unsubscribe = () => {};
  let stopped = false;
  ensureSignedIn().then(() => {
    if (stopped) return;
    const q = query(collection(db, "gardens", code, "waterings"), where("day", ">=", sinceDay));
    unsubscribe = onSnapshot(q, (snap) => {
      onChange(snap.docs.map((d) => ({
        zone: d.get("zone"),
        by: d.get("by"),
        day: d.get("day"),
        // pending local writes have no server time yet: use the local estimate
        at: d.get("at", { serverTimestamps: "estimate" })?.toDate() ?? null,
      })));
    }, onError);
  }, onError);
  return () => { stopped = true; unsubscribe(); };
}

export async function addWatering(code, { zone, by, day }) {
  await ensureSignedIn();
  await addDoc(collection(db, "gardens", code, "waterings"), { zone, by, day, at: serverTimestamp() });
}
