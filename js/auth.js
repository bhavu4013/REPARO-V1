import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
  auth,
  db
} from "./firebase.js";


/* =========================================================
   LOGIN
========================================================= */

export async function login(
  email,
  password
) {
  return await signInWithEmailAndPassword(
    auth,
    email.trim(),
    password
  );
}


/* =========================================================
   USER PROFILE
========================================================= */

export async function getUserProfile(
  uid
) {

  const userRef =
    doc(
      db,
      "users",
      uid
    );


  const snapshot =
    await getDoc(
      userRef
    );


  if (
    !snapshot.exists()
  ) {

    throw new Error(
      "USER_PROFILE_NOT_FOUND"
    );

  }


  return snapshot.data();
}


/* =========================================================
   AUTH WATCHER
========================================================= */

export function watchAuth(
  callback
) {
  return onAuthStateChanged(
    auth,
    callback
  );
}


/* =========================================================
   LOGOUT
========================================================= */

export async function logout() {
  await signOut(auth);
}


/* =========================================================
   ROLE PAGE
   IMPORTANT:
   Using auth.js location makes this work from
   root login AND customer/login.html.
========================================================= */

export function getRolePage(
  role
) {

  const pages = {

    admin:
      "../admin/dashboard.html",

    retailer:
      "../retailer/dashboard.html",

    technician:
      "../technician/dashboard.html",

    customer:
      "../customer/status.html"

  };


  const relativePath =
    pages[role];


  if (!relativePath) {

    return null;

  }


  /*
    auth.js is inside /js/
    Therefore ../technician/... correctly points
    to /technician/... regardless of which page
    imported this file.
  */

  return new URL(
    relativePath,
    import.meta.url
  ).href;

}