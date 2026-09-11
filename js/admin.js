import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  collection,
  getDocs,
  getDoc,
  doc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
  auth,
  db
} from "./firebase.js";


/* =====================================================
   DOM
===================================================== */

const logoutBtn =
  document.getElementById("logoutBtn");

const welcomeText =
  document.getElementById("welcomeText");

const retailerCount =
  document.getElementById("retailerCount");

const technicianCount =
  document.getElementById("technicianCount");

const customerCount =
  document.getElementById("customerCount");

const activeJobCount =
  document.getElementById("activeJobCount");

const errorBox =
  document.getElementById("errorBox");

const moreNavBtn =
  document.getElementById("moreNavBtn");

const morePanel =
  document.getElementById("morePanel");

const moreOverlay =
  document.getElementById("moreOverlay");


/* =====================================================
   AUTH
===================================================== */

onAuthStateChanged(
  auth,
  async user => {

    if (!user) {

      window.location.href =
        "../index.html";

      return;

    }


    try {

      const userRef =
        doc(
          db,
          "users",
          user.uid
        );


      const userSnapshot =
        await getDoc(
          userRef
        );


      if (!userSnapshot.exists()) {

        await signOut(auth);

        window.location.href =
          "../index.html";

        return;

      }


      const profile =
        userSnapshot.data();


      if (
        profile.role !== "admin" ||
        profile.active !== true
      ) {

        await signOut(auth);

        window.location.href =
          "../index.html";

        return;

      }


      const name =
        profile.name ||
        "Admin";


      welcomeText.textContent =
        `Hello, ${name}`;


      await loadDashboard();

    }
    catch (error) {

      showError(
        error.message ||
        "Dashboard loading failed."
      );

    }

  }
);


/* =====================================================
   DASHBOARD DATA
===================================================== */

async function loadDashboard() {

  try {

    await Promise.all([
      loadRetailers(),
      loadTechnicians(),
      loadCustomers(),
      loadActiveJobs()
    ]);

  }
  catch (error) {

    showError(
      error.message ||
      "Unable to load dashboard data."
    );

  }

}


/* =====================================================
   RETAILERS
===================================================== */

async function loadRetailers() {

  const snapshot =
    await getDocs(
      collection(
        db,
        "retailers"
      )
    );


  let count = 0;


  snapshot.forEach(
    item => {

      const data =
        item.data();


      if (
        data.active !== false
      ) {

        count++;

      }

    }
  );


  /*
    If retailers master collection is empty,
    fallback to users collection.
  */

  if (
    snapshot.empty
  ) {

    const usersSnapshot =
      await getDocs(
        collection(
          db,
          "users"
        )
      );


    count = 0;


    usersSnapshot.forEach(
      item => {

        const data =
          item.data();


        if (
          data.role === "retailer" &&
          data.active !== false
        ) {

          count++;

        }

      }
    );

  }


  retailerCount.textContent =
    count;

}


/* =====================================================
   TECHNICIANS
===================================================== */

async function loadTechnicians() {

  const snapshot =
    await getDocs(
      collection(
        db,
        "technicians"
      )
    );


  let count = 0;


  snapshot.forEach(
    item => {

      const data =
        item.data();


      if (
        data.active !== false
      ) {

        count++;

      }

    }
  );


  if (
    snapshot.empty
  ) {

    const usersSnapshot =
      await getDocs(
        collection(
          db,
          "users"
        )
      );


    count = 0;


    usersSnapshot.forEach(
      item => {

        const data =
          item.data();


        if (
          data.role === "technician" &&
          data.active !== false
        ) {

          count++;

        }

      }
    );

  }


  technicianCount.textContent =
    count;

}


/* =====================================================
   CUSTOMERS
===================================================== */

async function loadCustomers() {

  const snapshot =
    await getDocs(
      collection(
        db,
        "customers"
      )
    );


  customerCount.textContent =
    snapshot.size;

}


/* =====================================================
   ACTIVE JOBS
===================================================== */

async function loadActiveJobs() {

  const snapshot =
    await getDocs(
      collection(
        db,
        "jobs"
      )
    );


  let count = 0;


  snapshot.forEach(
    item => {

      const data =
        item.data();


      const status =
        String(
          data.status ||
          ""
        ).toUpperCase();


      if (
        [
          "NEW",
          "ASSIGNED",
          "IN PROGRESS",
          "DIAGNOSIS",
          "CUSTOMER APPROVAL",
          "REPAIR"
        ].includes(status)
      ) {

        count++;

      }

    }
  );


  activeJobCount.textContent =
    count;

}


/* =====================================================
   MORE MENU
===================================================== */

moreNavBtn.addEventListener(
  "click",
  event => {

    event.stopPropagation();

    toggleMore();

  }
);


moreOverlay.addEventListener(
  "click",
  closeMore
);


function toggleMore() {

  const open =
    morePanel.classList.contains(
      "show"
    );


  if (open) {

    closeMore();

  }
  else {

    morePanel.classList.add(
      "show"
    );

    moreOverlay.classList.add(
      "show"
    );

  }

}


function closeMore() {

  morePanel.classList.remove(
    "show"
  );

  moreOverlay.classList.remove(
    "show"
  );

}


/* =====================================================
   LOGOUT
===================================================== */

logoutBtn.addEventListener(
  "click",
  async () => {

    try {

      await signOut(
        auth
      );


      window.location.href =
        "../index.html";

    }
    catch (error) {

      showError(
        error.message ||
        "Logout failed."
      );

    }

  }
);


/* =====================================================
   ERROR
===================================================== */

function showError(
  message
) {

  errorBox.textContent =
    message;

  errorBox.style.display =
    "block";

}


/* =====================================================
   GLOBAL ERROR LOG
===================================================== */

window.addEventListener(
  "error",
  event => {

    console.error(
      "REPARO Dashboard Error:",
      event.error
    );

  }
);