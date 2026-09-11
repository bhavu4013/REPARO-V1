import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
  auth,
  db
} from "./firebase.js";


/* =========================
   DOM
========================= */

const warrantyContainer =
  document.getElementById("warrantyContainer");

const searchInput =
  document.getElementById("searchInput");

const statusFilter =
  document.getElementById("statusFilter");

const logoutBtn =
  document.getElementById("logoutBtn");

const errorBox =
  document.getElementById("errorBox");

const successBox =
  document.getElementById("successBox");

const totalWarranty =
  document.getElementById("totalWarranty");

const activeWarranty =
  document.getElementById("activeWarranty");

const holdWarranty =
  document.getElementById("holdWarranty");

const releasedWarranty =
  document.getElementById("releasedWarranty");

const modalBackdrop =
  document.getElementById("modalBackdrop");

const closeModalBtn =
  document.getElementById("closeModalBtn");

const cancelModalBtn =
  document.getElementById("cancelModalBtn");

const modalTitle =
  document.getElementById("modalTitle");

const modalContent =
  document.getElementById("modalContent");

const confirmReleaseBtn =
  document.getElementById("confirmReleaseBtn");


/* =========================
   STATE
========================= */

let allWarranty = [];
let selectedWarrantyId = null;
let adminUser = null;


/* =========================
   AUTH
========================= */

onAuthStateChanged(auth, async (user) => {

  if (!user) {
    window.location.href = "../index.html";
    return;
  }

  try {

    const userRef = doc(db, "users", user.uid);
    const snapshot = await getDoc(userRef);

    if (!snapshot.exists()) {
      await signOut(auth);
      window.location.href = "../index.html";
      return;
    }

    const profile = snapshot.data();

    if (
      profile.role !== "admin" ||
      profile.active !== true
    ) {
      await signOut(auth);
      window.location.href = "../index.html";
      return;
    }

    adminUser = user;

    await loadWarranty();

  } catch (error) {

    showError(
      error.message ||
      "Authorization error."
    );

  }

});


/* =========================
   LOAD WARRANTY
========================= */

async function loadWarranty() {

  warrantyContainer.innerHTML =
    `<div class="loading">Loading warranty records...</div>`;

  try {

    const snapshot =
      await getDocs(
        collection(db, "warranty")
      );

    allWarranty = [];

    snapshot.forEach(item => {

      allWarranty.push({
        id: item.id,
        ...item.data()
      });

    });

    allWarranty.sort((a, b) => {

      const aTime =
        a.createdAt?.seconds || 0;

      const bTime =
        b.createdAt?.seconds || 0;

      return bTime - aTime;

    });

    updateSummary();
    renderWarranty();

  } catch (error) {

    warrantyContainer.innerHTML = `
      <div class="empty">
        <div class="empty-icon">⚠️</div>
        <div class="empty-title">
          Warranty Load Error
        </div>
        <div class="empty-text">
          ${escapeHtml(
            error.message ||
            "Unable to load warranty records."
          )}
        </div>
      </div>
    `;

    throw error;
  }

}


/* =========================
   SUMMARY
========================= */

function updateSummary() {

  const total =
    allWarranty.length;

  const active =
    allWarranty.filter(item =>
      isActiveWarranty(item)
    ).length;

  const hold =
    allWarranty.filter(item =>
      normalizeStatus(item.status)
      === "WARRANTY HOLD"
    ).length;

  const released =
    allWarranty.filter(item =>
      normalizeStatus(item.status)
      === "RELEASED"
    ).length;

  totalWarranty.textContent =
    total;

  activeWarranty.textContent =
    active;

  holdWarranty.textContent =
    hold;

  releasedWarranty.textContent =
    released;
}


/* =========================
   ACTIVE WARRANTY
========================= */

function isActiveWarranty(item) {

  const status =
    normalizeStatus(item.status);

  if (
    status === "CANCELLED" ||
    status === "RELEASED" ||
    status === "PAID" ||
    status === "ADJUSTED"
  ) {
    return false;
  }

  const end =
    getDateValue(item.warrantyEnd);

  if (!end) {
    return status === "WARRANTY HOLD";
  }

  return end.getTime() >= Date.now();

}


/* =========================
   FILTER EVENTS
========================= */

searchInput.addEventListener(
  "input",
  renderWarranty
);

statusFilter.addEventListener(
  "change",
  renderWarranty
);


/* =========================
   RENDER
========================= */

function renderWarranty() {

  const search =
    searchInput.value
      .trim()
      .toLowerCase();

  const selectedStatus =
    statusFilter.value;

  const filtered =
    allWarranty.filter(item => {

      const searchable = [

        item.id,
        item.warrantyId,
        item.jobId,
        item.customerName,
        item.customerMobile,
        item.mobile,
        item.retailerName,
        item.retailerId,
        item.technicianName,
        item.technicianId,
        item.deviceBrand,
        item.deviceModel,
        item.serialNumber

      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const searchMatch =
        !search ||
        searchable.includes(search);

      const statusMatch =
        !selectedStatus ||
        normalizeStatus(item.status)
        === selectedStatus;

      return searchMatch && statusMatch;

    });


  if (filtered.length === 0) {

    warrantyContainer.innerHTML = `
      <div class="empty">

        <div class="empty-icon">🛡️</div>

        <div class="empty-title">
          No Warranty Records
        </div>

        <div class="empty-text">
          No warranty records match your search.
        </div>

      </div>
    `;

    return;
  }


  warrantyContainer.innerHTML = `
    <div>
      ${filtered
        .map(renderWarrantyCard)
        .join("")}
    </div>
  `;


  document
    .querySelectorAll("[data-view-warranty]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => openWarrantyModal(
          button.dataset.viewWarranty
        )
      );

    });


  document
    .querySelectorAll("[data-release-warranty]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => openWarrantyModal(
          button.dataset.releaseWarranty,
          true
        )
      );

    });

}


/* =========================
   WARRANTY CARD
========================= */

function renderWarrantyCard(item) {

  const status =
    normalizeStatus(
      item.status || "WARRANTY HOLD"
    );

  const customer =
    item.customerName ||
    "Customer";

  const device =
    getDeviceText(item);

  const jobId =
    item.jobId ||
    item.id ||
    "-";

  const commission =
    formatMoney(
      item.commissionAmount ??
      item.retailerCommission ??
      0
    );

  const start =
    formatDate(item.warrantyStart);

  const end =
    formatDate(item.warrantyEnd);


  const canRelease =
    status === "WARRANTY HOLD" &&
    isWarrantyExpired(item);


  return `

    <div class="warranty-card">

      <div class="card-top">

        <div>

          <div class="warranty-id">
            ${escapeHtml(
              item.warrantyId ||
              item.id
            )}
          </div>

          <div class="customer">
            ${escapeHtml(customer)}
          </div>

          <div class="device">
            ${escapeHtml(device)}
          </div>

        </div>

        <span class="status ${getStatusClass(status)}">
          ${escapeHtml(
            formatStatus(status)
          )}
        </span>

      </div>


      <div class="info-grid">

        <div class="info-box">

          <div class="info-label">
            Job ID
          </div>

          <div class="info-value">
            ${escapeHtml(jobId)}
          </div>

        </div>


        <div class="info-box">

          <div class="info-label">
            Commission Hold
          </div>

          <div class="info-value">
            ${escapeHtml(commission)}
          </div>

        </div>


        <div class="info-box">

          <div class="info-label">
            Warranty Start
          </div>

          <div class="info-value">
            ${escapeHtml(start)}
          </div>

        </div>


        <div class="info-box">

          <div class="info-label">
            Warranty End
          </div>

          <div class="info-value">
            ${escapeHtml(end)}
          </div>

        </div>

      </div>


      <div class="warranty-divider"></div>


      <div class="action-row">

        <button
          type="button"
          class="action-btn view-btn"
          data-view-warranty="${escapeAttribute(item.id)}"
        >
          View Details
        </button>


        <button
          type="button"
          class="action-btn release-btn"
          data-release-warranty="${escapeAttribute(item.id)}"
          ${canRelease ? "" : "disabled"}
        >
          ${canRelease
            ? "Release Commission"
            : "Warranty Active"}
        </button>

      </div>

    </div>

  `;

}


/* =========================
   OPEN MODAL
========================= */

function openWarrantyModal(
  warrantyId,
  releaseMode = false
) {

  const item =
    allWarranty.find(
      record => record.id === warrantyId
    );

  if (!item) {

    showError(
      "Warranty record not found."
    );

    return;
  }

  selectedWarrantyId =
    warrantyId;


  const status =
    normalizeStatus(
      item.status ||
      "WARRANTY HOLD"
    );


  modalTitle.textContent =
    "Warranty Details";


  modalContent.innerHTML = `

    <div class="detail-row">

      <span class="detail-label">
        Warranty ID
      </span>

      <span class="detail-value">
        ${escapeHtml(
          item.warrantyId ||
          item.id
        )}
      </span>

    </div>


    <div class="detail-row">

      <span class="detail-label">
        Job ID
      </span>

      <span class="detail-value">
        ${escapeHtml(
          item.jobId || "-"
        )}
      </span>

    </div>


    <div class="detail-row">

      <span class="detail-label">
        Customer
      </span>

      <span class="detail-value">
        ${escapeHtml(
          item.customerName ||
          "-"
        )}
      </span>

    </div>


    <div class="detail-row">

      <span class="detail-label">
        Mobile
      </span>

      <span class="detail-value">
        ${escapeHtml(
          item.customerMobile ||
          item.mobile ||
          "-"
        )}
      </span>

    </div>


    <div class="detail-row">

      <span class="detail-label">
        Device
      </span>

      <span class="detail-value">
        ${escapeHtml(
          getDeviceText(item)
        )}
      </span>

    </div>


    <div class="detail-row">

      <span class="detail-label">
        Technician
      </span>

      <span class="detail-value">
        ${escapeHtml(
          item.technicianName ||
          item.technicianId ||
          "-"
        )}
      </span>

    </div>


    <div class="detail-row">

      <span class="detail-label">
        Warranty Start
      </span>

      <span class="detail-value">
        ${escapeHtml(
          formatDate(item.warrantyStart)
        )}
      </span>

    </div>


    <div class="detail-row">

      <span class="detail-label">
        Warranty End
      </span>

      <span class="detail-value">
        ${escapeHtml(
          formatDate(item.warrantyEnd)
        )}
      </span>

    </div>


    <div class="detail-row">

      <span class="detail-label">
        Warranty Period
      </span>

      <span class="detail-value">
        ${escapeHtml(
          item.warrantyDays
            ? `${item.warrantyDays} Days`
            : "-"
        )}
      </span>

    </div>


    <div class="detail-row">

      <span class="detail-label">
        Commission
      </span>

      <span class="detail-value">
        ${escapeHtml(
          formatMoney(
            item.commissionAmount ??
            item.retailerCommission ??
            0
          )
        )}
      </span>

    </div>


    <div class="detail-row">

      <span class="detail-label">
        Status
      </span>

      <span class="detail-value">
        ${escapeHtml(
          formatStatus(status)
        )}
      </span>

    </div>

  `;


  const canRelease =
    status === "WARRANTY HOLD" &&
    isWarrantyExpired(item);


  confirmReleaseBtn.style.display =
    canRelease
      ? "block"
      : "none";


  if (releaseMode && canRelease) {
    confirmReleaseBtn.focus();
  }


  modalBackdrop.classList.add("show");

}


/* =========================
   RELEASE COMMISSION
========================= */

confirmReleaseBtn.addEventListener(
  "click",
  releaseCommission
);


async function releaseCommission() {

  if (!selectedWarrantyId) {
    return;
  }


  const item =
    allWarranty.find(
      record =>
        record.id === selectedWarrantyId
    );


  if (!item) {

    showError(
      "Warranty record not found."
    );

    return;
  }


  const status =
    normalizeStatus(
      item.status ||
      "WARRANTY HOLD"
    );


  if (status !== "WARRANTY HOLD") {

    showError(
      "This warranty is not on hold."
    );

    return;
  }


  if (!isWarrantyExpired(item)) {

    showError(
      "Warranty period is still active. Commission cannot be released yet."
    );

    return;
  }


  confirmReleaseBtn.disabled =
    true;

  confirmReleaseBtn.textContent =
    "Releasing...";


  try {

    const warrantyRef =
      doc(
        db,
        "warranty",
        selectedWarrantyId
      );


    await updateDoc(
      warrantyRef,
      {
        status: "RELEASED",
        releasedAt: serverTimestamp(),
        releasedBy: adminUser.uid,
        updatedAt: serverTimestamp()
      }
    );


    /*
      Important:
      Warranty release only changes warranty state.

      The commission record remains separately
      controlled by the Commission module.

      This prevents accidental direct payment.
    */


    closeModal();

    await loadWarranty();

    showSuccess(
      "Warranty expired. Commission marked as RELEASED."
    );

  } catch (error) {

    showError(
      error.message ||
      "Commission release failed."
    );

  } finally {

    confirmReleaseBtn.disabled =
      false;

    confirmReleaseBtn.textContent =
      "Release Commission";

  }

}


/* =========================
   WARRANTY EXPIRY
========================= */

function isWarrantyExpired(item) {

  const end =
    getDateValue(
      item.warrantyEnd
    );

  if (!end) {
    return false;
  }

  return end.getTime() < Date.now();

}


/* =========================
   DEVICE
========================= */

function getDeviceText(item) {

  const parts = [

    item.deviceBrand,
    item.deviceModel,

    item.screenSize
      ? `${item.screenSize}"`
      : null

  ].filter(Boolean);


  if (parts.length) {
    return parts.join(" ");
  }


  return (
    item.device ||
    item.product ||
    "Device"
  );

}


/* =========================
   STATUS
========================= */

function normalizeStatus(status) {

  return String(
    status || ""
  )
    .trim()
    .toUpperCase();

}


function formatStatus(status) {

  return String(
    status || ""
  )
    .toLowerCase()
    .replace(
      /\b\w/g,
      letter => letter.toUpperCase()
    );

}


function getStatusClass(status) {

  switch (
    normalizeStatus(status)
  ) {

    case "WARRANTY HOLD":
      return "status-hold";

    case "RELEASED":
      return "status-released";

    case "PAID":
      return "status-paid";

    case "CANCELLED":
      return "status-cancelled";

    case "ADJUSTED":
      return "status-adjusted";

    default:
      return "status-hold";

  }

}


/* =========================
   DATE
========================= */

function getDateValue(value) {

  if (!value) {
    return null;
  }


  if (
    typeof value.toDate === "function"
  ) {
    return value.toDate();
  }


  if (
    value instanceof Date
  ) {
    return value;
  }


  if (
    typeof value === "number"
  ) {
    return new Date(value);
  }


  if (
    typeof value === "string"
  ) {

    const date =
      new Date(value);

    return isNaN(date.getTime())
      ? null
      : date;

  }


  return null;

}


function formatDate(value) {

  const date =
    getDateValue(value);

  if (!date) {
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


/* =========================
   MONEY
========================= */

function formatMoney(value) {

  const amount =
    Number(value || 0);

  return amount.toLocaleString(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }
  );

}


/* =========================
   MODAL CLOSE
========================= */

function closeModal() {

  modalBackdrop.classList.remove(
    "show"
  );

  selectedWarrantyId =
    null;

  modalContent.innerHTML =
    "";

}


closeModalBtn.addEventListener(
  "click",
  closeModal
);


cancelModalBtn.addEventListener(
  "click",
  closeModal
);


modalBackdrop.addEventListener(
  "click",
  event => {

    if (
      event.target ===
      modalBackdrop
    ) {
      closeModal();
    }

  }
);


/* =========================
   LOGOUT
========================= */

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


/* =========================
   MESSAGES
========================= */

function showError(message) {

  successBox.style.display =
    "none";

  errorBox.textContent =
    message;

  errorBox.style.display =
    "block";

}


function showSuccess(message) {

  errorBox.style.display =
    "none";

  successBox.textContent =
    message;

  successBox.style.display =
    "block";

}


/* =========================
   ESCAPE
========================= */

function escapeHtml(value) {

  return String(value ?? "")
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );

}


function escapeAttribute(value) {

  return escapeHtml(value);

}