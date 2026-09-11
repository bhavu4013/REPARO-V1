import {
  initializeApp,
  deleteApp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
  auth,
  db
} from "./firebase.js";


/* =====================================================
   FIREBASE CONFIG
   ===================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyBZehAJk3lMWsOAwrG4-qT24_abBIfGJHs",
  authDomain: "reparo-v1.firebaseapp.com",
  projectId: "reparo-v1",
  storageBucket: "reparo-v1.firebasestorage.app",
  messagingSenderId: "830095721173",
  appId: "1:830095721173:web:c5e670fbc94e7cc42b185c"
};


/* =====================================================
   DOM
   ===================================================== */

const retailerContainer =
  document.getElementById("retailerContainer");

const searchInput =
  document.getElementById("searchInput");

const addRetailerBtn =
  document.getElementById("addRetailerBtn");

const logoutBtn =
  document.getElementById("logoutBtn");

const errorBox =
  document.getElementById("errorBox");

const modalBackdrop =
  document.getElementById("modalBackdrop");

const closeModalBtn =
  document.getElementById("closeModalBtn");

const cancelBtn =
  document.getElementById("cancelBtn");

const retailerForm =
  document.getElementById("retailerForm");

const modalTitle =
  document.getElementById("modalTitle");

const saveBtn =
  document.getElementById("saveBtn");

const editUid =
  document.getElementById("editUid");

const nameInput =
  document.getElementById("name");

const shopNameInput =
  document.getElementById("shopName");

const mobileInput =
  document.getElementById("mobile");

const emailInput =
  document.getElementById("email");

const passwordInput =
  document.getElementById("password");

const addressInput =
  document.getElementById("address");

const totalCount =
  document.getElementById("totalCount");

const activeCount =
  document.getElementById("activeCount");

const inactiveCount =
  document.getElementById("inactiveCount");


/* =====================================================
   STATE
   ===================================================== */

let allRetailers = [];
let adminUser = null;


/* =====================================================
   ERROR DISPLAY
   ===================================================== */

function showError(message) {

  errorBox.textContent = message;
  errorBox.style.display = "block";

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


function hideError() {
  errorBox.style.display = "none";
  errorBox.textContent = "";
}


/* =====================================================
   FIREBASE ERROR TRANSLATION
   ===================================================== */

function firebaseErrorMessage(error) {

  console.error(error);

  const code = error?.code || "";

  switch (code) {

    case "auth/email-already-in-use":
      return "આ emailથી retailer account પહેલેથી જ છે.";

    case "auth/invalid-email":
      return "Email address સાચો નથી.";

    case "auth/weak-password":
      return "Password ઓછામાં ઓછો 6 charactersનો રાખો.";

    case "auth/network-request-failed":
      return "Internet connection check કરો.";

    case "auth/operation-not-allowed":
      return "Firebase Authenticationમાં Email/Password login enable નથી.";

    case "permission-denied":
    case "firestore/permission-denied":
      return "Firebase Security Rulesએ આ operation deny કરી છે. Admin login અને Rules check કરો.";

    default:
      return error?.message ||
        "Retailer create કરતી વખતે અજ્ઞાત error આવ્યો.";
  }
}


/* =====================================================
   AUTH CHECK
   ===================================================== */

onAuthStateChanged(auth, async (user) => {

  if (!user) {
    window.location.href = "../index.html";
    return;
  }

  try {

    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      await signOut(auth);
      window.location.href = "../index.html";
      return;
    }

    const profile = snap.data();

    if (
      profile.role !== "admin" ||
      profile.active !== true
    ) {
      await signOut(auth);
      window.location.href = "../index.html";
      return;
    }

    adminUser = user;

    await loadRetailers();

  } catch (error) {

    showError(firebaseErrorMessage(error));

  }

});


/* =====================================================
   LOAD RETAILERS
   ===================================================== */

async function loadRetailers() {

  hideError();

  retailerContainer.innerHTML = `
    <div class="loading">
      Loading retailers...
    </div>
  `;

  try {

    const snapshot =
      await getDocs(collection(db, "users"));

    allRetailers = [];

    snapshot.forEach((item) => {

      const data = item.data();

      if (data.role === "retailer") {

        allRetailers.push({
          uid: item.id,
          ...data
        });

      }

    });

    allRetailers.sort((a, b) => {

      const aName =
        String(a.name || "").toLowerCase();

      const bName =
        String(b.name || "").toLowerCase();

      return aName.localeCompare(bName);

    });

    renderStats();
    renderRetailers();

  } catch (error) {

    retailerContainer.innerHTML = `
      <div class="empty">
        Retailers load થઈ શક્યા નથી.
      </div>
    `;

    showError(firebaseErrorMessage(error));

  }

}


/* =====================================================
   STATS
   ===================================================== */

function renderStats() {

  const total = allRetailers.length;

  const active =
    allRetailers.filter(r => r.active === true).length;

  const inactive = total - active;

  totalCount.textContent = total;
  activeCount.textContent = active;
  inactiveCount.textContent = inactive;
}


/* =====================================================
   SEARCH
   ===================================================== */

searchInput.addEventListener("input", () => {
  renderRetailers();
});


/* =====================================================
   RENDER RETAILERS
   ===================================================== */

function renderRetailers() {

  const term =
    searchInput.value.trim().toLowerCase();

  const filtered =
    allRetailers.filter((retailer) => {

      const text = [

        retailer.name,
        retailer.shopName,
        retailer.mobile,
        retailer.email,
        retailer.address

      ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

      return text.includes(term);

    });


  if (filtered.length === 0) {

    retailerContainer.innerHTML = `
      <div class="empty">
        No retailers found.
      </div>
    `;

    return;
  }


  retailerContainer.innerHTML = `

    <div class="retailer-list">

      ${filtered.map(renderRetailerCard).join("")}

    </div>

  `;


  document
    .querySelectorAll("[data-edit]")
    .forEach(button => {

      button.addEventListener("click", () => {

        const uid =
          button.dataset.edit;

        openEditModal(uid);

      });

    });


  document
    .querySelectorAll("[data-toggle]")
    .forEach(button => {

      button.addEventListener("click", () => {

        const uid =
          button.dataset.toggle;

        toggleRetailer(uid);

      });

    });

}


/* =====================================================
   RETAILER CARD
   ===================================================== */

function renderRetailerCard(retailer) {

  const active =
    retailer.active === true;

  return `

    <div class="retailer-card">

      <div class="retailer-head">

        <div>

          <h3 class="retailer-name">
            ${escapeHtml(retailer.name || "Unnamed Retailer")}
          </h3>

          <div class="shop">
            ${escapeHtml(retailer.shopName || "Shop name not added")}
          </div>

        </div>

        <span class="badge ${active ? "active" : "inactive"}">
          ${active ? "ACTIVE" : "INACTIVE"}
        </span>

      </div>


      <div class="details">

        <div class="detail">
          <span>📱</span>
          <span>${escapeHtml(retailer.mobile || "-")}</span>
        </div>

        <div class="detail">
          <span>✉️</span>
          <span>${escapeHtml(retailer.email || "-")}</span>
        </div>

        <div class="detail">
          <span>📍</span>
          <span>${escapeHtml(retailer.address || "-")}</span>
        </div>

      </div>


      <div class="divider"></div>


      <div class="card-actions">

        <button
          class="action edit"
          data-edit="${retailer.uid}"
        >
          Edit
        </button>

        <button
          class="action toggle"
          data-toggle="${retailer.uid}"
        >
          ${active ? "Deactivate" : "Activate"}
        </button>

      </div>

    </div>

  `;
}


/* =====================================================
   ADD MODAL
   ===================================================== */

addRetailerBtn.addEventListener("click", () => {

  openAddModal();

});


function openAddModal() {

  hideError();

  retailerForm.reset();

  editUid.value = "";

  modalTitle.textContent =
    "Add Retailer";

  saveBtn.textContent =
    "Create Retailer";

  passwordInput.required = true;

  modalBackdrop.classList.add("show");

  setTimeout(() => {
    nameInput.focus();
  }, 100);

}


/* =====================================================
   EDIT MODAL
   ===================================================== */

function openEditModal(uid) {

  hideError();

  const retailer =
    allRetailers.find(r => r.uid === uid);

  if (!retailer) {
    showError("Retailer મળી રહ્યો નથી.");
    return;
  }

  editUid.value = retailer.uid;

  nameInput.value =
    retailer.name || "";

  shopNameInput.value =
    retailer.shopName || "";

  mobileInput.value =
    retailer.mobile || "";

  emailInput.value =
    retailer.email || "";

  passwordInput.value = "";

  addressInput.value =
    retailer.address || "";

  modalTitle.textContent =
    "Edit Retailer";

  saveBtn.textContent =
    "Save Changes";

  passwordInput.required = false;

  modalBackdrop.classList.add("show");

}


/* =====================================================
   CLOSE MODAL
   ===================================================== */

function closeModal() {

  modalBackdrop.classList.remove("show");

  retailerForm.reset();

  editUid.value = "";

}


closeModalBtn.addEventListener("click", closeModal);
cancelBtn.addEventListener("click", closeModal);


modalBackdrop.addEventListener("click", (event) => {

  if (event.target === modalBackdrop) {
    closeModal();
  }

});


/* =====================================================
   FORM SUBMIT
   ===================================================== */

retailerForm.addEventListener("submit", async (event) => {

  event.preventDefault();

  hideError();

  if (!adminUser) {

    showError("Admin session મળી નથી. ફરી login કરો.");
    return;

  }


  const uid =
    editUid.value.trim();

  const name =
    nameInput.value.trim();

  const shopName =
    shopNameInput.value.trim();

  const mobile =
    mobileInput.value.trim();

  const email =
    emailInput.value.trim().toLowerCase();

  const password =
    passwordInput.value;

  const address =
    addressInput.value.trim();


  /* ---------------------------------------------
     VALIDATION
  --------------------------------------------- */

  if (!name) {
    showError("Retailer name દાખલ કરો.");
    return;
  }

  if (!shopName) {
    showError("Shop name દાખલ કરો.");
    return;
  }

  if (!/^[0-9]{10}$/.test(mobile)) {
    showError("Mobile number 10 digitsનો હોવો જોઈએ.");
    return;
  }

  if (!email || !email.includes("@")) {
    showError("Valid email દાખલ કરો.");
    return;
  }


  /* ---------------------------------------------
     EDIT EXISTING
  --------------------------------------------- */

  if (uid) {

    await updateRetailer(
      uid,
      {
        name,
        shopName,
        mobile,
        email,
        address
      }
    );

    return;
  }


  /* ---------------------------------------------
     CREATE NEW
  --------------------------------------------- */

  if (!password || password.length < 6) {

    showError(
      "New retailer માટે password ઓછામાં ઓછો 6 charactersનો હોવો જોઈએ."
    );

    return;
  }


  await createRetailer({

    name,
    shopName,
    mobile,
    email,
    password,
    address

  });

});


/* =====================================================
   CREATE RETAILER
   ===================================================== */

async function createRetailer(data) {

  saveBtn.disabled = true;
  saveBtn.textContent = "Creating...";

  let secondaryApp = null;
  let secondaryAuth = null;
  let createdUser = null;

  try {

    /*
      IMPORTANT:

      Adminનું current Firebase Auth session
      logout ન થાય તે માટે secondary Firebase app
      ઉપયોગ કરીએ છીએ.
    */

    secondaryApp =
      initializeApp(
        firebaseConfig,
        "REPARO_RETAILER_CREATION_" + Date.now()
      );

    secondaryAuth =
      getAuth(secondaryApp);


    /* ---------------------------------------------
       CREATE FIREBASE AUTH ACCOUNT
    --------------------------------------------- */

    const credential =
      await createUserWithEmailAndPassword(
        secondaryAuth,
        data.email,
        data.password
      );

    createdUser =
      credential.user;


    const retailerUid =
      createdUser.uid;


    /* ---------------------------------------------
       CREATE FIRESTORE USER PROFILE
    --------------------------------------------- */

    await setDoc(
      doc(db, "users", retailerUid),
      {

        name: data.name,

        shopName: data.shopName,

        mobile: data.mobile,

        email: data.email,

        address: data.address,

        role: "retailer",

        active: true,

        createdAt: serverTimestamp(),

        createdBy: adminUser.uid

      }
    );


    /*
      OPTIONAL RETAILER MASTER DOCUMENT

      This gives us a dedicated retailer collection
      for future retailer-specific settings.
    */

    await setDoc(
      doc(db, "retailers", retailerUid),
      {

        uid: retailerUid,

        name: data.name,

        shopName: data.shopName,

        mobile: data.mobile,

        email: data.email,

        address: data.address,

        active: true,

        createdAt: serverTimestamp(),

        createdBy: adminUser.uid

      }
    );


    /* ---------------------------------------------
       SUCCESS
    --------------------------------------------- */

    await signOut(secondaryAuth);

    closeModal();

    await loadRetailers();

    alert(
      "Retailer successfully created.\n\n" +
      "Login Email: " + data.email
    );


  } catch (error) {

    console.error(
      "CREATE RETAILER ERROR:",
      error
    );


    /*
      If Auth account was created but Firestore
      failed, try to remove the newly-created
      secondary Auth account.
    */

    if (createdUser) {

      try {

        await createdUser.delete();

      } catch (rollbackError) {

        console.error(
          "AUTH ROLLBACK ERROR:",
          rollbackError
        );

      }

    }


    showError(
      firebaseErrorMessage(error)
    );


  } finally {

    saveBtn.disabled = false;

    saveBtn.textContent =
      editUid.value
        ? "Save Changes"
        : "Create Retailer";


    if (secondaryAuth) {

      try {
        await signOut(secondaryAuth);
      } catch (_) {}

    }

    if (secondaryApp) {

      try {
        await deleteApp(secondaryApp);
      } catch (_) {}

    }

  }

}


/* =====================================================
   UPDATE RETAILER
   ===================================================== */

async function updateRetailer(uid, data) {

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";

  try {

    await updateDoc(
      doc(db, "users", uid),
      {

        name: data.name,

        shopName: data.shopName,

        mobile: data.mobile,

        email: data.email,

        address: data.address,

        updatedAt: serverTimestamp(),

        updatedBy: adminUser.uid

      }
    );


    /*
      Keep dedicated retailer master synchronized.
    */

    const retailerRef =
      doc(db, "retailers", uid);

    const retailerSnap =
      await getDoc(retailerRef);

    if (retailerSnap.exists()) {

      await updateDoc(
        retailerRef,
        {

          name: data.name,

          shopName: data.shopName,

          mobile: data.mobile,

          email: data.email,

          address: data.address,

          updatedAt: serverTimestamp(),

          updatedBy: adminUser.uid

        }
      );

    } else {

      await setDoc(
        retailerRef,
        {

          uid,

          name: data.name,

          shopName: data.shopName,

          mobile: data.mobile,

          email: data.email,

          address: data.address,

          active: true,

          updatedAt: serverTimestamp(),

          updatedBy: adminUser.uid

        }
      );

    }


    closeModal();

    await loadRetailers();

    alert("Retailer updated successfully.");


  } catch (error) {

    showError(
      firebaseErrorMessage(error)
    );

  } finally {

    saveBtn.disabled = false;
    saveBtn.textContent = "Save Changes";

  }

}


/* =====================================================
   ACTIVATE / DEACTIVATE
   ===================================================== */

async function toggleRetailer(uid) {

  hideError();

  const retailer =
    allRetailers.find(r => r.uid === uid);

  if (!retailer) {
    showError("Retailer મળી રહ્યો નથી.");
    return;
  }


  const newStatus =
    retailer.active !== true;


  const action =
    newStatus
      ? "activate"
      : "deactivate";


  const confirmed =
    confirm(
      `શું તમે આ retailerને ${action} કરવા માંગો છો?`
    );


  if (!confirmed) {
    return;
  }


  try {

    await updateDoc(
      doc(db, "users", uid),
      {

        active: newStatus,

        updatedAt: serverTimestamp(),

        updatedBy: adminUser.uid

      }
    );


    await updateDoc(
      doc(db, "retailers", uid),
      {

        active: newStatus,

        updatedAt: serverTimestamp(),

        updatedBy: adminUser.uid

      }
    );


    await loadRetailers();


  } catch (error) {

    showError(
      firebaseErrorMessage(error)
    );

  }

}


/* =====================================================
   LOGOUT
   ===================================================== */

logoutBtn.addEventListener("click", async () => {

  try {

    await signOut(auth);

    window.location.href =
      "../index.html";

  } catch (error) {

    showError(
      firebaseErrorMessage(error)
    );

  }

});


/* =====================================================
   HTML ESCAPE
   ===================================================== */

function escapeHtml(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}