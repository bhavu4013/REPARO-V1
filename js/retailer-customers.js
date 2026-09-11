import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
  auth,
  db
} from "./firebase.js";


/* =========================================================
   DOM
========================================================= */

const customerContainer =
  document.getElementById("customerContainer");

const searchInput =
  document.getElementById("searchInput");

const totalCustomers =
  document.getElementById("totalCustomers");

const serialCustomers =
  document.getElementById("serialCustomers");

const tvCustomers =
  document.getElementById("tvCustomers");

const logoutBtn =
  document.getElementById("logoutBtn");

const errorBox =
  document.getElementById("errorBox");

const successBox =
  document.getElementById("successBox");

const modalBackdrop =
  document.getElementById("modalBackdrop");

const closeModalBtn =
  document.getElementById("closeModalBtn");

const modalTitle =
  document.getElementById("modalTitle");

const detailList =
  document.getElementById("detailList");

const modalRequestBtn =
  document.getElementById("modalRequestBtn");


/* =========================================================
   STATE
========================================================= */

let currentUser = null;
let allCustomers = [];
let selectedCustomer = null;


/* =========================================================
   AUTH
========================================================= */

onAuthStateChanged(auth, async (user) => {

  if (!user) {

    window.location.href =
      "../index.html";

    return;

  }


  try {

    const userRef =
      doc(db, "users", user.uid);

    const snapshot =
      await getDoc(userRef);


    if (!snapshot.exists()) {

      await signOut(auth);

      window.location.href =
        "../index.html";

      return;

    }


    const profile =
      snapshot.data();


    if (
      profile.role !== "retailer" ||
      profile.active !== true
    ) {

      await signOut(auth);

      window.location.href =
        "../index.html";

      return;

    }


    currentUser =
      user;


    await loadCustomers();


  } catch (error) {

    showError(
      error.message ||
      "Authorization error."
    );

  }

});


/* =========================================================
   LOAD MY CUSTOMERS
========================================================= */

async function loadCustomers() {

  customerContainer.innerHTML = `
    <div class="loading">
      Loading your customers...
    </div>
  `;


  try {

    /*
      IMPORTANT:

      Query only customers protected by
      current retailer.

      This matches Firestore security rules:
      originalRetailerId == currentUser.uid
    */

    const customersQuery =
      query(
        collection(db, "customers"),
        where(
          "originalRetailerId",
          "==",
          currentUser.uid
        )
      );


    const snapshot =
      await getDocs(
        customersQuery
      );


    allCustomers = [];


    snapshot.forEach(item => {

      allCustomers.push({
        id: item.id,
        ...item.data()
      });

    });


    allCustomers.sort((a, b) => {

      const aTime =
        a.updatedAt?.seconds ||
        a.createdAt?.seconds ||
        0;

      const bTime =
        b.updatedAt?.seconds ||
        b.createdAt?.seconds ||
        0;

      return bTime - aTime;

    });


    updateSummary();

    renderCustomers();


  } catch (error) {

    customerContainer.innerHTML = `
      <div class="empty">

        <div class="empty-icon">⚠️</div>

        <div class="empty-title">
          Customers Load Error
        </div>

        <div class="empty-text">
          ${escapeHtml(
            error.message ||
            "Unable to load customers."
          )}
        </div>

      </div>
    `;

    showError(
      error.message ||
      "Unable to load customers."
    );

  }

}


/* =========================================================
   SUMMARY
========================================================= */

function updateSummary() {

  const total =
    allCustomers.length;


  const serial =
    allCustomers.filter(customer =>
      String(
        customer.serialNumber || ""
      ).trim()
    ).length;


  const tv =
    allCustomers.filter(customer => {

      const text = [

        customer.deviceBrand,

        customer.deviceModel,

        customer.device,

        customer.product

      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();


      return (
        text.includes("tv") ||
        text.includes("television") ||
        text.includes("led") ||
        text.includes("lcd") ||
        text.includes("smart")
      );

    }).length;


  totalCustomers.textContent =
    total;

  serialCustomers.textContent =
    serial;

  tvCustomers.textContent =
    tv;

}


/* =========================================================
   SEARCH
========================================================= */

searchInput.addEventListener(
  "input",
  renderCustomers
);


/* =========================================================
   RENDER CUSTOMERS
========================================================= */

function renderCustomers() {

  const search =
    searchInput.value
      .trim()
      .toLowerCase();


  const filtered =
    allCustomers.filter(customer => {

      const searchable = [

        customer.id,

        customer.name,

        customer.customerName,

        customer.mobile,

        customer.customerMobile,

        customer.address,

        customer.deviceBrand,

        customer.deviceModel,

        customer.screenSize,

        customer.serialNumber

      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();


      return (
        !search ||
        searchable.includes(search)
      );

    });


  if (filtered.length === 0) {

    customerContainer.innerHTML = `
      <div class="empty">

        <div class="empty-icon">👥</div>

        <div class="empty-title">
          No Customers Found
        </div>

        <div class="empty-text">
          No protected customer matches your search.
        </div>

      </div>
    `;

    return;

  }


  customerContainer.innerHTML = `
    <div class="customer-list">
      ${
        filtered
          .map(renderCustomerCard)
          .join("")
      }
    </div>
  `;


  document
    .querySelectorAll(
      "[data-view-customer]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          openCustomer(
            button.dataset.viewCustomer
          );

        }
      );

    });


  document
    .querySelectorAll(
      "[data-request-customer]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          createRequestForCustomer(
            button.dataset.requestCustomer
          );

        }
      );

    });

}


/* =========================================================
   CUSTOMER CARD
========================================================= */

function renderCustomerCard(customer) {

  const name =
    customer.name ||
    customer.customerName ||
    "Customer";


  const mobile =
    customer.mobile ||
    customer.customerMobile ||
    "-";


  const device =
    getDeviceText(customer);


  return `
    <div class="customer-card">

      <div class="customer-head">

        <div>

          <div class="customer-name">
            ${escapeHtml(name)}
          </div>

          <div class="customer-mobile">
            📱 ${escapeHtml(mobile)}
          </div>

        </div>

        <span class="protected-badge">
          🛡️ PROTECTED
        </span>

      </div>


      <div class="customer-info">

        <div class="info-row">
          <span class="info-icon">📍</span>
          <span>
            ${escapeHtml(
              customer.address ||
              "-"
            )}
          </span>
        </div>


        <div class="info-row">
          <span class="info-icon">📺</span>
          <span>
            ${escapeHtml(device)}
          </span>
        </div>


        <div class="info-row">
          <span class="info-icon">🔢</span>
          <span>
            ${escapeHtml(
              customer.serialNumber ||
              "Serial not registered"
            )}
          </span>
        </div>

      </div>


      <div class="customer-actions">

        <button
          type="button"
          class="action-btn view-btn"
          data-view-customer="${escapeAttribute(customer.id)}"
        >
          View Customer
        </button>


        <button
          type="button"
          class="action-btn request-btn"
          data-request-customer="${escapeAttribute(customer.id)}"
        >
          New Service Request
        </button>

      </div>

    </div>
  `;

}


/* =========================================================
   OPEN CUSTOMER
========================================================= */

function openCustomer(customerId) {

  const customer =
    allCustomers.find(
      item => item.id === customerId
    );


  if (!customer) {

    showError(
      "Customer not found."
    );

    return;

  }


  selectedCustomer =
    customer;


  const name =
    customer.name ||
    customer.customerName ||
    "Customer";


  modalTitle.textContent =
    name;


  detailList.innerHTML = `

    ${detailRow(
      "Mobile",
      customer.mobile ||
      customer.customerMobile ||
      "-"
    )}

    ${detailRow(
      "Address",
      customer.address ||
      "-"
    )}

    ${detailRow(
      "Device Brand",
      customer.deviceBrand ||
      "-"
    )}

    ${detailRow(
      "Device Model",
      customer.deviceModel ||
      "-"
    )}

    ${detailRow(
      "Screen Size",
      customer.screenSize
        ? `${customer.screenSize}"`
        : "-"
    )}

    ${detailRow(
      "Serial Number",
      customer.serialNumber ||
      "Not registered"
    )}

    ${detailRow(
      "Protection",
      "Protected by your retailer account"
    )}

    ${detailRow(
      "Customer ID",
      customer.id
    )}

  `;


  modalBackdrop.classList.add(
    "show"
  );

}


/* =========================================================
   DETAIL ROW
========================================================= */

function detailRow(
  label,
  value
) {

  return `
    <div class="detail-row">

      <div class="detail-label">
        ${escapeHtml(label)}
      </div>

      <div class="detail-value">
        ${escapeHtml(value)}
      </div>

    </div>
  `;

}


/* =========================================================
   NEW REQUEST FOR CUSTOMER
========================================================= */

function createRequestForCustomer(
  customerId
) {

  const customer =
    allCustomers.find(
      item => item.id === customerId
    );


  if (!customer) {

    showError(
      "Customer not found."
    );

    return;

  }


  /*
    Pass customer ID + mobile to
    New Service Request page.

    The page will still perform its
    own Firestore protection validation.
  */

  const params =
    new URLSearchParams({

      customerId:
        customer.id,

      mobile:
        customer.mobile ||
        customer.customerMobile ||
        ""

    });


  window.location.href =
    `new-service-request.html?${params.toString()}`;

}


/* =========================================================
   MODAL REQUEST BUTTON
========================================================= */

modalRequestBtn.addEventListener(
  "click",
  () => {

    if (!selectedCustomer) {

      return;

    }


    createRequestForCustomer(
      selectedCustomer.id
    );

  }
);


/* =========================================================
   CLOSE MODAL
========================================================= */

closeModalBtn.addEventListener(
  "click",
  closeModal
);


modalBackdrop.addEventListener(
  "click",
  event => {

    if (
      event.target === modalBackdrop
    ) {

      closeModal();

    }

  }
);


function closeModal() {

  modalBackdrop.classList.remove(
    "show"
  );

  selectedCustomer =
    null;

}


/* =========================================================
   LOGOUT
========================================================= */

logoutBtn.addEventListener(
  "click",
  async () => {

    try {

      await signOut(auth);

      window.location.href =
        "../index.html";

    } catch (error) {

      showError(
        error.message ||
        "Logout failed."
      );

    }

  }
);


/* =========================================================
   NAVIGATION
========================================================= */

document
  .querySelectorAll(
    ".bottom-nav [data-page]"
  )
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        const page =
          button.dataset.page;

        if (page) {

          window.location.href =
            page;

        }

      }
    );

  });


/* =========================================================
   DEVICE TEXT
========================================================= */

function getDeviceText(customer) {

  const parts = [

    customer.deviceBrand,

    customer.deviceModel,

    customer.screenSize
      ? `${customer.screenSize}"`
      : null

  ].filter(Boolean);


  if (parts.length) {

    return parts.join(" ");

  }


  return (
    customer.device ||
    customer.product ||
    "Device not registered"
  );

}


/* =========================================================
   MESSAGES
========================================================= */

function showError(message) {

  successBox.style.display =
    "none";

  errorBox.textContent =
    message;

  errorBox.style.display =
    "block";


  setTimeout(() => {

    errorBox.style.display =
      "none";

  }, 5000);

}


function showSuccess(message) {

  errorBox.style.display =
    "none";

  successBox.textContent =
    message;

  successBox.style.display =
    "block";


  setTimeout(() => {

    successBox.style.display =
      "none";

  }, 4000);

}


/* =========================================================
   ESCAPE
========================================================= */

function escapeHtml(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


function escapeAttribute(value) {

  return escapeHtml(value);

}