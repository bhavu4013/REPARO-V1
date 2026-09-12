import { initializeApp, deleteApp } from
  "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signOut
} from
  "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  collection,
  getDocs,
  query,
  where,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp
} from
  "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import { auth, db } from "./firebase.js";


/* --------------------------------------------------
   FIREBASE CONFIG
-------------------------------------------------- */

const firebaseConfig = {
  apiKey: "AIzaSyBZehAJk3lMWsOAwrG4-qT24_abBIfGJHs",
  authDomain: "reparo-v1.firebaseapp.com",
  projectId: "reparo-v1",
  storageBucket: "reparo-v1.firebasestorage.app",
  messagingSenderId: "830095721173",
  appId: "1:830095721173:web:c5e670fbc94e7cc42b185c"
};


/* --------------------------------------------------
   VARIABLES
-------------------------------------------------- */

let technicians = [];

let editingTechnicianId = null;

let secondaryApp = null;

let secondaryAuth = null;

let adminUid = null;


/* --------------------------------------------------
   ELEMENTS
-------------------------------------------------- */

const technicianList =
  document.getElementById("technicianList");

const searchInput =
  document.getElementById("searchInput");

const modal =
  document.getElementById("technicianModal");

const modalTitle =
  document.getElementById("modalTitle");

const technicianForm =
  document.getElementById("technicianForm");

const saveBtn =
  document.getElementById("saveBtn");

const technicianMobile =
  document.getElementById("technicianMobile");

const technicianPin =
  document.getElementById("technicianPin");


/* --------------------------------------------------
   MOBILE NORMALIZATION
-------------------------------------------------- */

function normalizeMobile(value) {

  let mobile =
    String(value || "")
      .replace(/\D/g, "");

  if (mobile.startsWith("91") && mobile.length === 12) {
    mobile = mobile.substring(2);
  }

  return mobile;
}


/* --------------------------------------------------
   INTERNAL LOGIN EMAIL
--------------------------------------------------

   Technician never sees this email.

   Example:
   Mobile = 9876543210

   Internal email:
   9876543210@login.reparo.local

-------------------------------------------------- */

function getLoginEmail(mobile) {

  return `${mobile}@login.reparo.local`;

}


/* --------------------------------------------------
   AUTH CHECK
-------------------------------------------------- */

onAuthStateChanged(auth, async (user) => {

  if (!user) {

    window.location.href = "../index.html";

    return;

  }


  adminUid = user.uid;


  try {

    const userSnap =
      await getDocs(
        query(
          collection(db, "users"),
          where("__name__", "==", user.uid)
        )
      );


    if (userSnap.empty) {

      alert("Admin profile not found.");

      window.location.href = "../index.html";

      return;

    }


    const profile =
      userSnap.docs[0].data();


    if (
      profile.role !== "admin" ||
      profile.active !== true
    ) {

      alert("Admin access required.");

      window.location.href = "../index.html";

      return;

    }


    await loadTechnicians();

  }

  catch (error) {

    console.error(
      "Admin verification error:",
      error
    );

    technicianList.innerHTML = `
      <div class="message">
        Unable to verify admin account.
      </div>
    `;

  }

});


/* --------------------------------------------------
   LOAD TECHNICIANS
-------------------------------------------------- */

async function loadTechnicians() {

  technicianList.innerHTML = `
    <div class="message">
      Loading technicians...
    </div>
  `;


  try {

    const technicianQuery =
      query(
        collection(db, "users"),
        where("role", "==", "technician")
      );


    const snapshot =
      await getDocs(technicianQuery);


    technicians = [];


    snapshot.forEach((item) => {

      technicians.push({
        id: item.id,
        ...item.data()
      });

    });


    updateSummary();

    renderTechnicians();

  }

  catch (error) {

    console.error(
      "Load technicians error:",
      error
    );

    technicianList.innerHTML = `
      <div class="message">
        Unable to load technicians.
      </div>
    `;

  }

}


/* --------------------------------------------------
   SUMMARY
-------------------------------------------------- */

function updateSummary() {

  const total =
    technicians.length;


  const active =
    technicians.filter(
      tech => tech.active === true
    ).length;


  const inactive =
    total - active;


  document.getElementById("totalCount")
    .textContent = total;


  document.getElementById("activeCount")
    .textContent = active;


  document.getElementById("inactiveCount")
    .textContent = inactive;

}


/* --------------------------------------------------
   RENDER TECHNICIANS
-------------------------------------------------- */

function renderTechnicians() {

  const search =
    searchInput.value
      .trim()
      .toLowerCase();


  const filtered =
    technicians.filter((tech) => {

      const name =
        String(tech.name || "")
          .toLowerCase();

      const mobile =
        String(tech.mobile || "")
          .toLowerCase();

      const area =
        String(tech.area || "")
          .toLowerCase();


      return (
        name.includes(search) ||
        mobile.includes(search) ||
        area.includes(search)
      );

    });


  if (filtered.length === 0) {

    technicianList.innerHTML = `
      <div class="message">
        No technicians found.
      </div>
    `;

    return;

  }


  technicianList.innerHTML =
    filtered.map((tech) => {

      const active =
        tech.active === true;


      const safeName =
        escapeHtml(
          tech.name || "Unnamed Technician"
        );


      const safeMobile =
        escapeHtml(
          tech.mobile || "-"
        );


      const safeArea =
        escapeHtml(
          tech.area || "Area not set"
        );


      return `

        <div class="technician-card">

          <div class="technician-top">

            <div class="technician-main">

              <div class="technician-name">
                ${safeName}
              </div>

              <div class="technician-detail">

                📱 ${safeMobile}<br>

                📍 ${safeArea}

              </div>

            </div>


            <div class="status ${active ? "active" : "inactive"}">

              ${active ? "ACTIVE" : "INACTIVE"}

            </div>

          </div>


          <div class="technician-bottom">

            <div class="job-count">

              Jobs:
              <strong>
                ${Number(tech.completedJobs || 0)}
              </strong>

            </div>


            <div class="actions">

              <button
                class="action-btn edit-btn"
                onclick="editTechnician('${tech.id}')"
              >
                Edit
              </button>


              <button
                class="action-btn toggle-btn"
                onclick="toggleTechnician('${tech.id}', ${active})"
              >
                ${active ? "Deactivate" : "Activate"}
              </button>

            </div>

          </div>

        </div>

      `;

    }).join("");

}


/* --------------------------------------------------
   SEARCH
-------------------------------------------------- */

searchInput.addEventListener(
  "input",
  renderTechnicians
);


/* --------------------------------------------------
   OPEN ADD TECHNICIAN
-------------------------------------------------- */

document
  .getElementById("addTechnicianBtn")
  .addEventListener("click", () => {

    editingTechnicianId = null;

    technicianForm.reset();

    modalTitle.textContent =
      "Add Technician";

    saveBtn.textContent =
      "Create Technician";


    technicianMobile.disabled = false;

    technicianPin.disabled = false;

    technicianPin.required = true;


    modal.classList.add("show");


    document
      .getElementById("technicianName")
      .focus();

  });


/* --------------------------------------------------
   CLOSE MODAL
-------------------------------------------------- */

function closeModal() {

  modal.classList.remove("show");

  editingTechnicianId = null;

  technicianForm.reset();

  technicianMobile.disabled = false;

  technicianPin.disabled = false;

  technicianPin.required = true;

}


document
  .getElementById("closeModalBtn")
  .addEventListener(
    "click",
    closeModal
  );


document
  .getElementById("cancelBtn")
  .addEventListener(
    "click",
    closeModal
  );


modal.addEventListener(
  "click",
  (event) => {

    if (event.target === modal) {

      closeModal();

    }

  }
);


/* --------------------------------------------------
   EDIT TECHNICIAN
-------------------------------------------------- */

window.editTechnician =
  function(id) {

    const tech =
      technicians.find(
        item => item.id === id
      );


    if (!tech) return;


    editingTechnicianId = id;


    modalTitle.textContent =
      "Edit Technician";


    saveBtn.textContent =
      "Update Technician";


    document.getElementById(
      "technicianName"
    ).value =
      tech.name || "";


    document.getElementById(
      "technicianMobile"
    ).value =
      tech.mobile || "";


    technicianMobile.disabled = true;


    technicianPin.value = "";

    technicianPin.disabled = true;

    technicianPin.required = false;


    document.getElementById(
      "technicianArea"
    ).value =
      tech.area || "";


    document.getElementById(
      "technicianNotes"
    ).value =
      tech.notes || "";


    modal.classList.add("show");

  };


/* --------------------------------------------------
   SAVE / UPDATE
-------------------------------------------------- */

technicianForm.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();


    const name =
      document.getElementById(
        "technicianName"
      ).value.trim();


    const mobile =
      normalizeMobile(
        technicianMobile.value
      );


    const pin =
      technicianPin.value.trim();


    const area =
      document.getElementById(
        "technicianArea"
      ).value.trim();


    const notes =
      document.getElementById(
        "technicianNotes"
      ).value.trim();


    /* ----------------------------------------------
       BASIC VALIDATION
    ---------------------------------------------- */

    if (!name) {

      alert(
        "Please enter technician name."
      );

      return;

    }


    if (!editingTechnicianId) {

      if (!/^\d{10}$/.test(mobile)) {

        alert(
          "Please enter a valid 10 digit mobile number."
        );

        return;

      }


      if (!/^\d{6}$/.test(pin)) {

        alert(
          "Login PIN must be exactly 6 digits."
        );

        return;

      }

    }


    saveBtn.disabled = true;


    try {

      /* --------------------------------------------
         UPDATE EXISTING TECHNICIAN
      -------------------------------------------- */

      if (editingTechnicianId) {

        await updateDoc(
          doc(
            db,
            "users",
            editingTechnicianId
          ),
          {

            name,

            area,

            notes,

            updatedAt:
              serverTimestamp()

          }
        );


        await setDoc(
          doc(
            db,
            "technicians",
            editingTechnicianId
          ),
          {

            technicianId:
              editingTechnicianId,

            name,

            area,

            notes,

            updatedAt:
              serverTimestamp()

          },
          {
            merge: true
          }
        );


        alert(
          "Technician updated successfully."
        );

      }


      /* --------------------------------------------
         CREATE NEW TECHNICIAN
      -------------------------------------------- */

      else {

        const loginEmail =
          getLoginEmail(mobile);


        /*
         * Check duplicate mobile before creating
         * Firebase Auth account.
         */

        const existingQuery =
          query(
            collection(db, "users"),
            where("mobile", "==", mobile)
          );


        const existingSnapshot =
          await getDocs(existingQuery);


        if (!existingSnapshot.empty) {

          alert(
            "This mobile number is already registered."
          );

          saveBtn.disabled = false;

          return;

        }


        /* ------------------------------------------
           SECONDARY FIREBASE APP

           Admin session remains logged in.
        ------------------------------------------ */

        const secondaryAppName =
          "REPARO-Technician-Creation";


        try {

          secondaryApp =
            initializeApp(
              firebaseConfig,
              secondaryAppName
            );

        }

        catch (error) {

          if (
            error.code ===
            "app/duplicate-app"
          ) {

            const {
              getApps
            } =
              await import(
                "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js"
              );


            secondaryApp =
              getApps().find(
                app =>
                  app.name ===
                  secondaryAppName
              );

          }

          else {

            throw error;

          }

        }


        secondaryAuth =
          getAuth(
            secondaryApp
          );


        /* ------------------------------------------
           CREATE FIREBASE AUTH ACCOUNT
        ------------------------------------------ */

        const credential =
          await createUserWithEmailAndPassword(
            secondaryAuth,
            loginEmail,
            pin
          );


        const technicianUid =
          credential.user.uid;


        try {

          /* ----------------------------------------
             USERS PROFILE
          ---------------------------------------- */

          await setDoc(
            doc(
              db,
              "users",
              technicianUid
            ),
            {

              name,

              mobile,

              role: "technician",

              active: true,

              area,

              notes,

              createdAt:
                serverTimestamp(),

              updatedAt:
                serverTimestamp(),

              createdBy:
                adminUid

            }
          );


          /* ----------------------------------------
             TECHNICIAN PROFILE
          ---------------------------------------- */

          await setDoc(
            doc(
              db,
              "technicians",
              technicianUid
            ),
            {

              technicianId:
                technicianUid,

              name,

              mobile,

              area,

              notes,

              active: true,

              completedJobs: 0,

              pendingJobs: 0,

              totalEarnings: 0,

              payableAmount: 0,

              paidAmount: 0,

              createdAt:
                serverTimestamp(),

              updatedAt:
                serverTimestamp(),

              createdBy:
                adminUid

            }
          );

        }

        catch (firestoreError) {

          /*
           * If Firestore profile creation fails,
           * remove the newly created Auth account.
           */

          try {

            await credential.user.delete();

          }

          catch (rollbackError) {

            console.error(
              "Technician Auth rollback failed:",
              rollbackError
            );

          }

          throw firestoreError;

        }


        /* ------------------------------------------
           SIGN OUT SECONDARY AUTH
        ------------------------------------------ */

        try {

          await signOut(
            secondaryAuth
          );

        }

        catch (signOutError) {

          console.warn(
            "Secondary sign out warning:",
            signOutError
          );

        }


        alert(
          "Technician account created successfully."
        );

      }


      closeModal();

      await loadTechnicians();

    }

    catch (error) {

      console.error(
        "Technician save error:",
        error
      );


      let message =
        "Unable to save technician.";


      switch (error.code) {

        case "auth/email-already-in-use":

          message =
            "This mobile number is already registered.";

          break;


        case "auth/invalid-email":

          message =
            "Unable to create the technician login.";

          break;


        case "auth/weak-password":

          message =
            "PIN must be exactly 6 digits.";

          break;


        case "permission-denied":

          message =
            "Permission denied. Please check Firestore Rules.";

          break;


        default:

          if (
            String(error.message || "")
              .toLowerCase()
              .includes("permission")
          ) {

            message =
              "Permission denied. Please check Firestore Rules.";

          }

      }


      alert(message);

    }

    finally {

      saveBtn.disabled = false;

    }

  }
);


/* --------------------------------------------------
   ACTIVATE / DEACTIVATE
-------------------------------------------------- */

window.toggleTechnician =
  async function(id, currentStatus) {

    const action =
      currentStatus
        ? "deactivate"
        : "activate";


    const confirmed =
      confirm(
        `Are you sure you want to ${action} this technician?`
      );


    if (!confirmed) return;


    try {

      const newStatus =
        !currentStatus;


      await updateDoc(
        doc(
          db,
          "users",
          id
        ),
        {

          active:
            newStatus,

          updatedAt:
            serverTimestamp()

        }
      );


      await setDoc(
        doc(
          db,
          "technicians",
          id
        ),
        {

          active:
            newStatus,

          updatedAt:
            serverTimestamp()

        },
        {
          merge: true
        }
      );


      await loadTechnicians();

    }

    catch (error) {

      console.error(
        "Technician status error:",
        error
      );

      alert(
        "Unable to change technician status."
      );

    }

  };


/* --------------------------------------------------
   HTML ESCAPE
-------------------------------------------------- */

function escapeHtml(value) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}