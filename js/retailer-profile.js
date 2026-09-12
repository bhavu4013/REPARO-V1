import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


// =====================================================
// DOM
// =====================================================

const avatarEl =
  document.getElementById("avatar");

const profileNameEl =
  document.getElementById("profileName");

const profileShopNameEl =
  document.getElementById("profileShopName");

const statusBadgeEl =
  document.getElementById("statusBadge");

const nameInput =
  document.getElementById("name");

const mobileInput =
  document.getElementById("mobile");

const shopNameInput =
  document.getElementById("shopName");

const addressInput =
  document.getElementById("address");

const accountStatusEl =
  document.getElementById("accountStatus");

const createdAtEl =
  document.getElementById("createdAt");

const saveBtn =
  document.getElementById("saveBtn");

const messageBox =
  document.getElementById("messageBox");


// =====================================================
// STATE
// =====================================================

let currentUser = null;
let currentProfile = null;


// =====================================================
// MESSAGE
// =====================================================

function showMessage(
  message,
  type = "success"
) {

  messageBox.textContent =
    message;

  messageBox.className =
    `message ${type}`;

  messageBox.style.display =
    "block";


  setTimeout(() => {

    messageBox.style.display =
      "none";

  }, 3500);
}


// =====================================================
// DATE
// =====================================================

function formatDate(value) {

  if (!value) {
    return "-";
  }

  try {

    if (
      typeof value.toDate === "function"
    ) {

      return value
        .toDate()
        .toLocaleDateString(
          "en-IN",
          {
            day: "2-digit",
            month: "short",
            year: "numeric"
          }
        );
    }


    const date =
      new Date(value);


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {

      return "-";
    }


    return date.toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric"
      }
    );

  }
  catch (error) {

    return "-";
  }
}


// =====================================================
// AVATAR
// =====================================================

function getInitial(
  name
) {

  const value =
    String(
      name || "R"
    ).trim();

  return value
    ? value.charAt(0).toUpperCase()
    : "R";
}


// =====================================================
// RENDER
// =====================================================

function renderProfile(
  data
) {

  const name =
    data.name ||
    "Retailer";

  const shopName =
    data.shopName ||
    "-";

  const mobile =
    data.mobile ||
    "-";

  const address =
    data.address ||
    "-";


  nameInput.value =
    name;

  mobileInput.value =
    mobile;

  shopNameInput.value =
    shopName;

  addressInput.value =
    address;


  profileNameEl.textContent =
    name;

  profileShopNameEl.textContent =
    shopName;

  avatarEl.textContent =
    getInitial(name);


  const active =
    data.active === true;


  statusBadgeEl.textContent =
    active
      ? "ACTIVE"
      : "INACTIVE";


  statusBadgeEl.style.background =
    active
      ? "#E8F8F0"
      : "#FFF0F1";


  statusBadgeEl.style.color =
    active
      ? "#16734B"
      : "#BD304B";


  accountStatusEl.textContent =
    active
      ? "Active"
      : "Inactive";


  createdAtEl.textContent =
    formatDate(
      data.createdAt
    );
}


// =====================================================
// LOAD PROFILE
// =====================================================

async function loadProfile(
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
      "Retailer profile not found."
    );
  }


  const data =
    snapshot.data();


  /*
   * Security validation
   */

  if (
    data.role !== "retailer" ||
    data.active !== true
  ) {

    await signOut(auth);

    window.location.href =
      "../index.html";

    throw new Error(
      "Unauthorized retailer account."
    );
  }


  currentUser =
    auth.currentUser;

  currentProfile =
    data;


  renderProfile(
    data
  );
}


// =====================================================
// SAVE NAME
// =====================================================

saveBtn.addEventListener(
  "click",
  async () => {

    if (
      !currentUser ||
      !currentProfile
    ) {

      return;
    }


    const name =
      nameInput.value.trim();


    if (!name) {

      showMessage(
        "Please enter your name.",
        "error"
      );

      nameInput.focus();

      return;
    }


    if (
      name.length < 2
    ) {

      showMessage(
        "Name must contain at least 2 characters.",
        "error"
      );

      nameInput.focus();

      return;
    }


    saveBtn.disabled =
      true;

    saveBtn.textContent =
      "Saving...";


    try {

      const userRef =
        doc(
          db,
          "users",
          currentUser.uid
        );


      /*
       * Current Firestore rules allow
       * retailer to update only:
       *
       * name
       * mobile
       * email
       * photoURL
       * updatedAt
       *
       * Here we intentionally update
       * only name + updatedAt.
       */

      await updateDoc(
        userRef,
        {

          name,

          updatedAt:
            serverTimestamp()

        }
      );


      currentProfile.name =
        name;


      renderProfile(
        currentProfile
      );


      showMessage(
        "Profile updated successfully."
      );

    }
    catch (error) {

      console.error(
        "Retailer profile update error:",
        error
      );


      let message =
        "Unable to update profile. Please try again.";


      if (
        error?.code ===
        "permission-denied"
      ) {

        message =
          "Profile update permission denied.";
      }


      showMessage(
        message,
        "error"
      );

    }
    finally {

      saveBtn.disabled =
        false;

      saveBtn.textContent =
        "Save Changes";
    }

  }
);


// =====================================================
// LOGOUT
// =====================================================

window.logoutRetailer =
  async function () {

    try {

      await signOut(
        auth
      );

      window.location.href =
        "../index.html";

    }
    catch (error) {

      console.error(
        "Logout error:",
        error
      );


      showMessage(
        "Logout failed. Please try again.",
        "error"
      );
    }

  };


// =====================================================
// AUTH
// =====================================================

onAuthStateChanged(
  auth,
  async (user) => {

    if (!user) {

      window.location.href =
        "../index.html";

      return;
    }


    try {

      await loadProfile(
        user.uid
      );

    }
    catch (error) {

      console.error(
        "Retailer profile error:",
        error
      );


      showMessage(
        error.message ||
        "Unable to load retailer profile.",
        "error"
      );


      setTimeout(
        () => {

          window.location.href =
            "../index.html";

        },
        1800
      );
    }

  }
);