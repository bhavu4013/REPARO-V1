import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import { auth, db } from "./firebase.js";


export async function login(email, password) {

  return await signInWithEmailAndPassword(
    auth,
    email,
    password
  );

}


export async function getUserProfile(uid) {

  const userRef = doc(
    db,
    "users",
    uid
  );

  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    throw new Error("USER_PROFILE_NOT_FOUND");
  }

  return snapshot.data();

}


export function watchAuth(callback) {

  return onAuthStateChanged(
    auth,
    callback
  );

}


export async function logout() {

  await signOut(auth);

}


export function getRolePage(role) {

  switch (role) {

    case "admin":
      return "./admin/dashboard.html";

    case "retailer":
      return "./retailer/dashboard.html";

    case "technician":
      return "./technician/dashboard.html";

    default:
      return "./index.html";
  }

}
