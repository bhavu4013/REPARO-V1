import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  collection,
  getDocs,
  doc,
  getDoc,
  addDoc,
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

const schemeContainer =
  document.getElementById("schemeContainer");

const searchInput =
  document.getElementById("searchInput");

const statusFilter =
  document.getElementById("statusFilter");

const typeFilter =
  document.getElementById("typeFilter");

const addSchemeBtn =
  document.getElementById("addSchemeBtn");

const logoutBtn =
  document.getElementById("logoutBtn");

const errorBox =
  document.getElementById("errorBox");

const successBox =
  document.getElementById("successBox");

const totalSchemes =
  document.getElementById("totalSchemes");

const activeSchemes =
  document.getElementById("activeSchemes");

const inactiveSchemes =
  document.getElementById("inactiveSchemes");

const slabSchemes =
  document.getElementById("slabSchemes");

const modalBackdrop =
  document.getElementById("modalBackdrop");

const modalTitle =
  document.getElementById("modalTitle");

const closeModalBtn =
  document.getElementById("closeModalBtn");

const cancelModalBtn =
  document.getElementById("cancelModalBtn");

const schemeForm =
  document.getElementById("schemeForm");

const saveSchemeBtn =
  document.getElementById("saveSchemeBtn");

const editSchemeId =
  document.getElementById("editSchemeId");

const schemeName =
  document.getElementById("schemeName");

const schemeType =
  document.getElementById("schemeType");

const rewardValue =
  document.getElementById("rewardValue");

const maxCap =
  document.getElementById("maxCap");

const startDate =
  document.getElementById("startDate");

const endDate =
  document.getElementById("endDate");

const retailerScope =
  document.getElementById("retailerScope");

const retailerIdsField =
  document.getElementById("retailerIdsField");

const retailerIds =
  document.getElementById("retailerIds");

const category =
  document.getElementById("category");

const serviceType =
  document.getElementById("serviceType");

const minRequests =
  document.getElementById("minRequests");

const minRevenue =
  document.getElementById("minRevenue");

const slabRules =
  document.getElementById("slabRules");

const conditions =
  document.getElementById("conditions");

const schemeStatus =
  document.getElementById("schemeStatus");


/* =========================
   STATE
========================= */

let allSchemes = [];
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
      profile.role !== "admin" ||
      profile.active !== true
    ) {

      await signOut(auth);

      window.location.href =
        "../index.html";

      return;
    }

    adminUser = user;

    await loadSchemes();

  } catch (error) {

    showError(
      error.message ||
      "Authorization error."
    );

  }

});


/* =========================
   LOAD SCHEMES
========================= */

async function loadSchemes() {

  schemeContainer.innerHTML =
    `<div class="loading">Loading schemes...</div>`;

  try {

    const snapshot =
      await getDocs(
        collection(db, "schemes")
      );

    allSchemes = [];

    snapshot.forEach(item => {

      allSchemes.push({
        id: item.id,
        ...item.data()
      });

    });

    allSchemes.sort((a, b) => {

      const aTime =
        a.createdAt?.seconds || 0;

      const bTime =
        b.createdAt?.seconds || 0;

      return bTime - aTime;

    });

    updateSummary();

    renderSchemes();

  } catch (error) {

    schemeContainer.innerHTML = `
      <div class="empty">

        <div class="empty-icon">⚠️</div>

        <div class="empty-title">
          Schemes Load Error
        </div>

        <div class="empty-text">
          ${escapeHtml(
            error.message ||
            "Unable to load schemes."
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
    allSchemes.length;

  const active =
    allSchemes.filter(
      item =>
        normalizeStatus(item.status)
        === "ACTIVE"
    ).length;

  const inactive =
    allSchemes.filter(
      item =>
        normalizeStatus(item.status)
        === "INACTIVE"
    ).length;

  const slabs =
    allSchemes.filter(item => {

      const type =
        normalizeStatus(item.type);

      return (
        type === "SLAB" ||
        type === "REVENUE_SLAB"
      );

    }).length;


  totalSchemes.textContent =
    total;

  activeSchemes.textContent =
    active;

  inactiveSchemes.textContent =
    inactive;

  slabSchemes.textContent =
    slabs;

}


/* =========================
   FILTER EVENTS
========================= */

searchInput.addEventListener(
  "input",
  renderSchemes
);

statusFilter.addEventListener(
  "change",
  renderSchemes
);

typeFilter.addEventListener(
  "change",
  renderSchemes
);


/* =========================
   RENDER
========================= */

function renderSchemes() {

  const search =
    searchInput.value
      .trim()
      .toLowerCase();

  const selectedStatus =
    statusFilter.value;

  const selectedType =
    typeFilter.value;


  const filtered =
    allSchemes.filter(item => {

      const searchable = [

        item.id,
        item.name,
        item.category,
        item.serviceType,
        item.conditions

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


      const typeMatch =
        !selectedType ||
        normalizeStatus(item.type)
        === selectedType;


      return (
        searchMatch &&
        statusMatch &&
        typeMatch
      );

    });


  if (filtered.length === 0) {

    schemeContainer.innerHTML = `
      <div class="empty">

        <div class="empty-icon">🎁</div>

        <div class="empty-title">
          No Schemes Found
        </div>

        <div class="empty-text">
          Create a scheme or change your filters.
        </div>

      </div>
    `;

    return;
  }


  schemeContainer.innerHTML = `
    <div>
      ${filtered
        .map(renderSchemeCard)
        .join("")}
    </div>
  `;


  document
    .querySelectorAll("[data-edit-scheme]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => openEditModal(
          button.dataset.editScheme
        )
      );

    });


  document
    .querySelectorAll("[data-toggle-scheme]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => toggleScheme(
          button.dataset.toggleScheme
        )
      );

    });

}


/* =========================
   SCHEME CARD
========================= */

function renderSchemeCard(item) {

  const status =
    normalizeStatus(
      item.status || "INACTIVE"
    );

  const type =
    normalizeStatus(
      item.type || "PERCENTAGE"
    );


  return `

    <div class="scheme-card">

      <div class="card-top">

        <div>

          <div class="scheme-name">
            ${escapeHtml(
              item.name ||
              "Unnamed Scheme"
            )}
          </div>

          <div class="scheme-type">
            ${escapeHtml(
              formatType(type)
            )}
          </div>

        </div>


        <span class="status ${
          status === "ACTIVE"
            ? "status-active"
            : "status-inactive"
        }">

          ${escapeHtml(status)}

        </span>

      </div>


      <div class="scheme-highlight">

        <div class="reward-label">
          Reward
        </div>

        <div class="reward-value">
          ${escapeHtml(
            formatReward(item)
          )}
        </div>

      </div>


      <div class="info-grid">

        <div class="info-box">

          <div class="info-label">
            Start Date
          </div>

          <div class="info-value">
            ${escapeHtml(
              formatDate(
                item.startDate
              )
            )}
          </div>

        </div>


        <div class="info-box">

          <div class="info-label">
            End Date
          </div>

          <div class="info-value">
            ${escapeHtml(
              formatDate(
                item.endDate
              )
            )}
          </div>

        </div>


        <div class="info-box">

          <div class="info-label">
            Retailer Scope
          </div>

          <div class="info-value">
            ${escapeHtml(
              item.retailerScope === "SELECTED"
                ? "Selected"
                : "All Retailers"
            )}
          </div>

        </div>


        <div class="info-box">

          <div class="info-label">
            Category
          </div>

          <div class="info-value">
            ${escapeHtml(
              item.category ||
              "All Categories"
            )}
          </div>

        </div>


        <div class="info-box">

          <div class="info-label">
            Min Requests
          </div>

          <div class="info-value">
            ${escapeHtml(
              String(
                item.minRequests || 0
              )
            )}
          </div>

        </div>


        <div class="info-box">

          <div class="info-label">
            Max Cap
          </div>

          <div class="info-value">
            ${escapeHtml(
              item.maxCap
                ? formatMoney(item.maxCap)
                : "No Cap"
            )}
          </div>

        </div>

      </div>


      <div class="card-divider"></div>


      <div class="action-row">

        <button
          type="button"
          class="action-btn edit-btn"
          data-edit-scheme="${escapeAttribute(item.id)}"
        >
          Edit
        </button>


        <button
          type="button"
          class="action-btn toggle-btn"
          data-toggle-scheme="${escapeAttribute(item.id)}"
        >
          ${
            status === "ACTIVE"
              ? "Deactivate"
              : "Activate"
          }
        </button>

      </div>

    </div>

  `;

}


/* =========================
   CREATE MODAL
========================= */

addSchemeBtn.addEventListener(
  "click",
  openCreateModal
);


function openCreateModal() {

  schemeForm.reset();

  editSchemeId.value = "";

  modalTitle.textContent =
    "Create Scheme";

  schemeStatus.value =
    "ACTIVE";

  retailerScope.value =
    "ALL";

  retailerIdsField.style.display =
    "none";

  modalBackdrop.classList.add(
    "show"
  );

}


/* =========================
   EDIT MODAL
========================= */

function openEditModal(id) {

  const item =
    allSchemes.find(
      scheme =>
        scheme.id === id
    );

  if (!item) {

    showError(
      "Scheme not found."
    );

    return;
  }


  editSchemeId.value =
    item.id;

  schemeName.value =
    item.name || "";

  schemeType.value =
    normalizeStatus(
      item.type ||
      "PERCENTAGE"
    );

  rewardValue.value =
    item.rewardValue ??
    "";

  maxCap.value =
    item.maxCap ??
    "";

  startDate.value =
    item.startDate || "";

  endDate.value =
    item.endDate || "";

  retailerScope.value =
    item.retailerScope ||
    "ALL";

  retailerIds.value =
    Array.isArray(item.retailerIds)
      ? item.retailerIds.join(", ")
      : "";

  category.value =
    item.category ||
    "";

  serviceType.value =
    item.serviceType ||
    "";

  minRequests.value =
    item.minRequests ??
    "";

  minRevenue.value =
    item.minRevenue ??
    "";

  slabRules.value =
    formatSlabRulesForInput(
      item.slabRules
    );

  conditions.value =
    item.conditions ||
    "";

  schemeStatus.value =
    normalizeStatus(
      item.status ||
      "ACTIVE"
    );


  retailerIdsField.style.display =
    retailerScope.value === "SELECTED"
      ? "block"
      : "none";


  modalTitle.textContent =
    "Edit Scheme";

  modalBackdrop.classList.add(
    "show"
  );

}


/* =========================
   RETAILER SCOPE
========================= */

retailerScope.addEventListener(
  "change",
  () => {

    retailerIdsField.style.display =
      retailerScope.value === "SELECTED"
        ? "block"
        : "none";

  }
);


/* =========================
   SAVE
========================= */

schemeForm.addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    await saveScheme();

  }
);


async function saveScheme() {

  const name =
    schemeName.value.trim();

  const type =
    normalizeStatus(
      schemeType.value
    );

  const reward =
    Number(
      rewardValue.value || 0
    );

  const cap =
    Number(
      maxCap.value || 0
    );

  const start =
    startDate.value;

  const end =
    endDate.value;


  if (!name) {

    showError(
      "Scheme name is required."
    );

    return;
  }


  if (!start || !end) {

    showError(
      "Start Date and End Date are required."
    );

    return;
  }


  if (end < start) {

    showError(
      "End Date cannot be before Start Date."
    );

    return;
  }


  if (
    (
      type === "PERCENTAGE" ||
      type === "FIXED" ||
      type === "PER_REQUEST"
    ) &&
    reward <= 0
  ) {

    showError(
      "Reward value must be greater than zero."
    );

    return;
  }


  if (
    type === "PERCENTAGE" &&
    reward > 100
  ) {

    showError(
      "Percentage reward cannot exceed 100%."
    );

    return;
  }


  const selectedRetailers =
    retailerIds.value
      .split(",")
      .map(id => id.trim())
      .filter(Boolean);


  if (
    retailerScope.value === "SELECTED" &&
    selectedRetailers.length === 0
  ) {

    showError(
      "Enter at least one retailer ID."
    );

    return;
  }


  const parsedSlabs =
    parseSlabRules(
      slabRules.value
    );


  if (
    (
      type === "SLAB" ||
      type === "REVENUE_SLAB"
    ) &&
    parsedSlabs.length === 0
  ) {

    showError(
      "Enter valid slab rules."
    );

    return;
  }


  const data = {

    name,

    type,

    rewardValue: reward,

    maxCap: cap,

    startDate: start,

    endDate: end,

    retailerScope:
      retailerScope.value,

    retailerIds:
      retailerScope.value === "SELECTED"
        ? selectedRetailers
        : [],

    category:
      category.value.trim(),

    serviceType:
      serviceType.value.trim(),

    minRequests:
      Number(
        minRequests.value || 0
      ),

    minRevenue:
      Number(
        minRevenue.value || 0
      ),

    slabRules:
      parsedSlabs,

    conditions:
      conditions.value.trim(),

    status:
      normalizeStatus(
        schemeStatus.value
      ),

    updatedAt:
      serverTimestamp()

  };


  saveSchemeBtn.disabled =
    true;

  saveSchemeBtn.textContent =
    "Saving...";


  try {

    const existingId =
      editSchemeId.value;


    if (existingId) {

      await updateDoc(
        doc(
          db,
          "schemes",
          existingId
        ),
        data
      );

      showSuccess(
        "Scheme updated successfully."
      );

    } else {

      await addDoc(
        collection(
          db,
          "schemes"
        ),
        {
          ...data,

          createdAt:
            serverTimestamp(),

          createdBy:
            adminUser.uid
        }
      );

      showSuccess(
        "Scheme created successfully."
      );

    }


    closeModal();

    await loadSchemes();

  } catch (error) {

    showError(
      error.message ||
      "Unable to save scheme."
    );

  } finally {

    saveSchemeBtn.disabled =
      false;

    saveSchemeBtn.textContent =
      "Save Scheme";

  }

}


/* =========================
   TOGGLE
========================= */

async function toggleScheme(id) {

  const item =
    allSchemes.find(
      scheme =>
        scheme.id === id
    );

  if (!item) {

    showError(
      "Scheme not found."
    );

    return;
  }


  const current =
    normalizeStatus(
      item.status
    );

  const newStatus =
    current === "ACTIVE"
      ? "INACTIVE"
      : "ACTIVE";


  try {

    await updateDoc(
      doc(
        db,
        "schemes",
        id
      ),
      {
        status: newStatus,
        updatedAt:
          serverTimestamp()
      }
    );


    await loadSchemes();

    showSuccess(
      `Scheme ${newStatus.toLowerCase()} successfully.`
    );

  } catch (error) {

    showError(
      error.message ||
      "Unable to change scheme status."
    );

  }

}


/* =========================
   SLAB PARSER
========================= */

function parseSlabRules(value) {

  if (!value) {
    return [];
  }


  const result = [];


  const entries =
    value.split(",");


  entries.forEach(entry => {

    const parts =
      entry.split("=");


    if (parts.length !== 2) {
      return;
    }


    const threshold =
      Number(
        parts[0].trim()
      );

    const bonus =
      Number(
        parts[1].trim()
      );


    if (
      Number.isFinite(threshold) &&
      Number.isFinite(bonus) &&
      threshold > 0 &&
      bonus >= 0
    ) {

      result.push({
        threshold,
        bonus
      });

    }

  });


  result.sort(
    (a, b) =>
      a.threshold -
      b.threshold
  );


  return result;

}


function formatSlabRulesForInput(
  rules
) {

  if (!Array.isArray(rules)) {
    return "";
  }


  return rules
    .map(
      rule =>
        `${rule.threshold}=${rule.bonus}`
    )
    .join(",");

}


/* =========================
   REWARD
========================= */

function formatReward(item) {

  const type =
    normalizeStatus(
      item.type
    );

  const reward =
    Number(
      item.rewardValue || 0
    );


  switch (type) {

    case "PERCENTAGE":
      return `${reward}% Extra`;

    case "FIXED":
      return `${formatMoney(reward)} Extra`;

    case "PER_REQUEST":
      return `${formatMoney(reward)} / Request`;

    case "SLAB":
      return formatSlabReward(
        item.slabRules
      );

    case "REVENUE_SLAB":
      return formatRevenueSlabReward(
        item.slabRules
      );

    default:
      return `${reward}`;

  }

}


function formatSlabReward(rules) {

  if (
    !Array.isArray(rules) ||
    rules.length === 0
  ) {
    return "Slab";
  }


  return rules
    .map(
      rule =>
        `${rule.threshold}→${formatMoney(rule.bonus)}`
    )
    .join(" | ");

}


function formatRevenueSlabReward(
  rules
) {

  if (
    !Array.isArray(rules) ||
    rules.length === 0
  ) {
    return "Revenue Slab";
  }


  return rules
    .map(
      rule =>
        `${formatMoney(rule.threshold)}→${formatMoney(rule.bonus)}`
    )
    .join(" | ");

}


/* =========================
   TYPE
========================= */

function formatType(type) {

  switch (
    normalizeStatus(type)
  ) {

    case "PERCENTAGE":
      return "Extra Percentage";

    case "FIXED":
      return "Fixed ₹";

    case "PER_REQUEST":
      return "Per Service Request";

    case "SLAB":
      return "Lead / Request Slab";

    case "REVENUE_SLAB":
      return "Revenue Slab";

    default:
      return type;

  }

}


/* =========================
   DATE
========================= */

function formatDate(value) {

  if (!value) {
    return "-";
  }


  const date =
    new Date(
      `${value}T00:00:00`
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
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

  return Number(
    value || 0
  ).toLocaleString(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }
  );

}


/* =========================
   STATUS
========================= */

function normalizeStatus(value) {

  return String(
    value || ""
  )
    .trim()
    .toUpperCase();

}


/* =========================
   MODAL CLOSE
========================= */

function closeModal() {

  modalBackdrop.classList.remove(
    "show"
  );

  schemeForm.reset();

  editSchemeId.value =
    "";

  retailerIdsField.style.display =
    "none";

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

  return String(
    value ?? ""
  )
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