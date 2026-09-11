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


/* =====================================================
   DOM
===================================================== */

const commissionContainer =
  document.getElementById("commissionContainer");

const searchInput =
  document.getElementById("searchInput");

const scopeFilter =
  document.getElementById("scopeFilter");

const logoutBtn =
  document.getElementById("logoutBtn");

const errorBox =
  document.getElementById("errorBox");

const successBox =
  document.getElementById("successBox");

const totalRules =
  document.getElementById("totalRules");

const activeRules =
  document.getElementById("activeRules");

const inactiveRules =
  document.getElementById("inactiveRules");

const overrideRules =
  document.getElementById("overrideRules");

const addCommissionBtn =
  document.getElementById("addCommissionBtn");

const modalBackdrop =
  document.getElementById("modalBackdrop");

const closeModalBtn =
  document.getElementById("closeModalBtn");

const cancelBtn =
  document.getElementById("cancelBtn");

const modalTitle =
  document.getElementById("modalTitle");

const commissionForm =
  document.getElementById("commissionForm");

const editCommissionId =
  document.getElementById("editCommissionId");

const saveBtn =
  document.getElementById("saveBtn");

const ruleName =
  document.getElementById("ruleName");

const scope =
  document.getElementById("scope");

const category =
  document.getElementById("category");

const productId =
  document.getElementById("productId");

const commissionType =
  document.getElementById("commissionType");

const commissionValue =
  document.getElementById("commissionValue");

const active =
  document.getElementById("active");

const moreNavBtn =
  document.getElementById("moreNavBtn");

const morePanel =
  document.getElementById("morePanel");


/* =====================================================
   STATE
===================================================== */

let allRules = [];

let selectedRuleId = null;


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

      const snapshot =
        await getDoc(
          doc(
            db,
            "users",
            user.uid
          )
        );


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


      await loadRules();

    }
    catch (error) {

      showError(
        getErrorMessage(error)
      );

    }

  }
);


/* =====================================================
   LOAD RULES
===================================================== */

async function loadRules() {

  commissionContainer.innerHTML = `

    <div class="loading">
      Loading commission rules...
    </div>

  `;


  try {

    const snapshot =
      await getDocs(
        collection(
          db,
          "commissions"
        )
      );


    allRules = [];


    snapshot.forEach(
      item => {

        allRules.push({

          id:
            item.id,

          ...item.data()

        });

      }
    );


    allRules.sort(
      (a, b) => {

        const scopeOrder = {

          PRODUCT: 1,
          CATEGORY: 2,
          DEFAULT: 3

        };


        const aOrder =
          scopeOrder[
            normalizeScope(
              a.scope
            )
          ] || 99;


        const bOrder =
          scopeOrder[
            normalizeScope(
              b.scope
            )
          ] || 99;


        if (
          aOrder !==
          bOrder
        ) {

          return aOrder -
            bOrder;

        }


        return (
          getTimestamp(
            b.createdAt
          ) -
          getTimestamp(
            a.createdAt
          )
        );

      }
    );


    updateSummary();

    renderRules();

  }
  catch (error) {

    commissionContainer.innerHTML = `

      <div class="empty">

        <div class="empty-icon">
          ⚠️
        </div>

        <div class="empty-title">
          Commission Load Error
        </div>

        <div class="empty-text">
          ${escapeHtml(
            getErrorMessage(error)
          )}
        </div>

      </div>

    `;

    throw error;

  }

}


/* =====================================================
   SUMMARY
===================================================== */

function updateSummary() {

  const total =
    allRules.length;


  const activeCount =
    allRules.filter(
      rule =>
        rule.active !== false
    ).length;


  const inactiveCount =
    allRules.filter(
      rule =>
        rule.active === false
    ).length;


  const overrides =
    allRules.filter(
      rule => {

        const current =
          normalizeScope(
            rule.scope
          );

        return (
          current ===
          "CATEGORY" ||
          current ===
          "PRODUCT"
        );

      }
    ).length;


  totalRules.textContent =
    total;

  activeRules.textContent =
    activeCount;

  inactiveRules.textContent =
    inactiveCount;

  overrideRules.textContent =
    overrides;

}


/* =====================================================
   FILTERS
===================================================== */

searchInput.addEventListener(
  "input",
  renderRules
);


scopeFilter.addEventListener(
  "change",
  renderRules
);


/* =====================================================
   RENDER
===================================================== */

function renderRules() {

  const search =
    searchInput.value
      .trim()
      .toLowerCase();


  const selectedScope =
    normalizeScope(
      scopeFilter.value
    );


  const filtered =
    allRules.filter(
      rule => {

        const searchable = [

          rule.id,
          rule.name,
          rule.ruleName,
          rule.scope,
          rule.category,
          rule.productId,
          rule.commissionType

        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();


        const searchMatch =
          !search ||
          searchable.includes(
            search
          );


        const scopeMatch =
          !selectedScope ||
          normalizeScope(
            rule.scope
          ) === selectedScope;


        return (
          searchMatch &&
          scopeMatch
        );

      }
    );


  if (
    filtered.length === 0
  ) {

    commissionContainer.innerHTML = `

      <div class="empty">

        <div class="empty-icon">
          ₹
        </div>

        <div class="empty-title">
          No Commission Rules
        </div>

        <div class="empty-text">
          No commission rules match your search.
        </div>

      </div>

    `;

    return;

  }


  commissionContainer.innerHTML = `

    <div class="commission-list">

      ${filtered
        .map(
          renderRuleCard
        )
        .join("")}

    </div>

  `;


  bindButtons();

}


/* =====================================================
   CARD
===================================================== */

function renderRuleCard(rule) {

  const isActive =
    rule.active !== false;


  const ruleScope =
    normalizeScope(
      rule.scope ||
      "DEFAULT"
    );


  const name =
    rule.name ||
    rule.ruleName ||
    "Commission Rule";


  let target =
    "All Services";


  if (
    ruleScope ===
    "CATEGORY"
  ) {

    target =
      rule.category ||
      "Category not selected";

  }


  if (
    ruleScope ===
    "PRODUCT"
  ) {

    target =
      rule.productName ||
      rule.productId ||
      "Product not selected";

  }


  const type =
    normalizeType(
      rule.commissionType ||
      rule.type ||
      "PERCENTAGE"
    );


  const value =
    formatCommission(
      rule
    );


  return `

    <div class="commission-card">

      <div class="commission-top">

        <div>

          <h3 class="commission-name">
            ${escapeHtml(
              name
            )}
          </h3>

          <div class="commission-meta">

            ${escapeHtml(
              formatScope(
                ruleScope
              )
            )}

            •

            ${escapeHtml(
              target
            )}

          </div>

        </div>


        <span class="badge ${
          isActive
            ? "badge-active"
            : "badge-inactive"
        }">

          ${
            isActive
              ? "ACTIVE"
              : "INACTIVE"
          }

        </span>

      </div>


      <div class="commission-info">

        <div class="info-row">

          <span class="info-icon">
            💰
          </span>

          <span>
            Commission:
            <strong class="value-highlight">
              ${escapeHtml(
                value
              )}
            </strong>
          </span>

        </div>


        <div class="info-row">

          <span class="info-icon">
            🎯
          </span>

          <span>
            Rule Level:
            <strong class="value-highlight">
              ${escapeHtml(
                formatScope(
                  ruleScope
                )
              )}
            </strong>
          </span>

        </div>


        <div class="info-row">

          <span class="info-icon">
            ⚡
          </span>

          <span>
            Status:
            <strong class="value-highlight">
              ${
                isActive
                  ? "Active"
                  : "Inactive"
              }
            </strong>
          </span>

        </div>

      </div>


      <div class="divider"></div>


      <div class="actions">

        <button
          type="button"
          class="action edit-btn"
          data-edit-rule="${escapeAttribute(
            rule.id
          )}"
        >
          Edit
        </button>


        <button
          type="button"
          class="action toggle-btn"
          data-toggle-rule="${escapeAttribute(
            rule.id
          )}"
        >
          ${
            isActive
              ? "Deactivate"
              : "Activate"
          }
        </button>

      </div>

    </div>

  `;

}


/* =====================================================
   BUTTONS
===================================================== */

function bindButtons() {

  document
    .querySelectorAll(
      "[data-edit-rule]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            openEditModal(
              button.dataset.editRule
            );

          }
        );

      }
    );


  document
    .querySelectorAll(
      "[data-toggle-rule]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            toggleRule(
              button.dataset.toggleRule
            );

          }
        );

      }
    );

}


/* =====================================================
   ADD MODAL
===================================================== */

addCommissionBtn.addEventListener(
  "click",
  openAddModal
);


function openAddModal() {

  selectedRuleId =
    null;


  commissionForm.reset();


  editCommissionId.value =
    "";


  scope.value =
    "DEFAULT";


  commissionType.value =
    "PERCENTAGE";


  commissionValue.value =
    "0";


  active.value =
    "true";


  modalTitle.textContent =
    "Add Commission Rule";


  saveBtn.textContent =
    "Create Rule";


  modalBackdrop.classList.add(
    "show"
  );

}


/* =====================================================
   EDIT MODAL
===================================================== */

function openEditModal(ruleId) {

  const rule =
    allRules.find(
      item =>
        item.id === ruleId
    );


  if (!rule) {

    showError(
      "Commission rule not found."
    );

    return;

  }


  selectedRuleId =
    ruleId;


  editCommissionId.value =
    ruleId;


  ruleName.value =
    rule.name ||
    rule.ruleName ||
    "";


  scope.value =
    normalizeScope(
      rule.scope ||
      "DEFAULT"
    );


  category.value =
    normalizeCategory(
      rule.category
    );


  productId.value =
    rule.productId ||
    "";


  commissionType.value =
    normalizeType(
      rule.commissionType ||
      rule.type ||
      "PERCENTAGE"
    );


  commissionValue.value =
    getNumber(
      rule.commissionValue ??
      rule.value
    );


  active.value =
    rule.active === false
      ? "false"
      : "true";


  modalTitle.textContent =
    "Edit Commission Rule";


  saveBtn.textContent =
    "Save Changes";


  modalBackdrop.classList.add(
    "show"
  );

}


/* =====================================================
   SAVE
===================================================== */

commissionForm.addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    await saveRule();

  }
);


async function saveRule() {

  const name =
    ruleName.value.trim();


  const selectedScope =
    normalizeScope(
      scope.value
    );


  const selectedCategory =
    normalizeCategory(
      category.value
    );


  const selectedProduct =
    productId.value.trim();


  const selectedType =
    normalizeType(
      commissionType.value
    );


  const value =
    numberValue(
      commissionValue.value
    );


  const isActive =
    active.value ===
    "true";


  if (!name) {

    showError(
      "Rule name is required."
    );

    return;

  }


  if (value < 0) {

    showError(
      "Commission value cannot be negative."
    );

    return;

  }


  if (
    selectedType ===
    "PERCENTAGE" &&
    value > 100
  ) {

    showError(
      "Percentage commission cannot exceed 100%."
    );

    return;

  }


  if (
    selectedScope ===
    "CATEGORY" &&
    !selectedCategory
  ) {

    showError(
      "Please select a category."
    );

    return;

  }


  if (
    selectedScope ===
    "PRODUCT" &&
    !selectedProduct
  ) {

    showError(
      "Please enter the Product ID."
    );

    return;

  }


  const data = {

    name,

    scope:
      selectedScope,

    category:
      selectedScope ===
      "CATEGORY"
        ? selectedCategory
        : "",

    productId:
      selectedScope ===
      "PRODUCT"
        ? selectedProduct
        : "",

    commissionType:
      selectedType,

    commissionValue:
      value,

    active:
      isActive

  };


  saveBtn.disabled =
    true;


  saveBtn.textContent =
    selectedRuleId
      ? "Saving..."
      : "Creating...";


  try {

    if (selectedRuleId) {

      await updateDoc(

        doc(
          db,
          "commissions",
          selectedRuleId
        ),

        {
          ...data,

          updatedAt:
            serverTimestamp()
        }

      );


      closeModal();

      await loadRules();

      showSuccess(
        "Commission rule updated successfully."
      );

    }
    else {

      await addDoc(

        collection(
          db,
          "commissions"
        ),

        {
          ...data,

          createdAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp()

        }

      );


      closeModal();

      await loadRules();

      showSuccess(
        "Commission rule created successfully."
      );

    }

  }
  catch (error) {

    console.error(
      "Commission save error:",
      error
    );


    showError(
      getErrorMessage(error)
    );

  }
  finally {

    saveBtn.disabled =
      false;


    saveBtn.textContent =
      selectedRuleId
        ? "Save Changes"
        : "Create Rule";

  }

}


/* =====================================================
   TOGGLE
===================================================== */

async function toggleRule(ruleId) {

  const rule =
    allRules.find(
      item =>
        item.id === ruleId
    );


  if (!rule) {

    showError(
      "Commission rule not found."
    );

    return;

  }


  const newState =
    rule.active === false;


  try {

    await updateDoc(

      doc(
        db,
        "commissions",
        ruleId
      ),

      {
        active:
          newState,

        updatedAt:
          serverTimestamp()

      }

    );


    await loadRules();


    showSuccess(
      newState
        ? "Commission rule activated."
        : "Commission rule deactivated."
    );

  }
  catch (error) {

    console.error(
      "Commission toggle error:",
      error
    );


    showError(
      getErrorMessage(error)
    );

  }

}


/* =====================================================
   CLOSE
===================================================== */

function closeModal() {

  modalBackdrop.classList.remove(
    "show"
  );


  selectedRuleId =
    null;


  editCommissionId.value =
    "";

}


closeModalBtn.addEventListener(
  "click",
  closeModal
);


cancelBtn.addEventListener(
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


/* =====================================================
   MORE MENU
===================================================== */

moreNavBtn.addEventListener(
  "click",
  event => {

    event.stopPropagation();

    const isVisible =
      morePanel.style.display ===
      "block";


    morePanel.style.display =
      isVisible
        ? "none"
        : "block";

  }
);


document.addEventListener(
  "click",
  event => {

    if (
      morePanel.style.display ===
      "block" &&
      !morePanel.contains(
        event.target
      ) &&
      event.target !==
      moreNavBtn
    ) {

      morePanel.style.display =
        "none";

    }

  }
);


/* =====================================================
   SCOPE
===================================================== */

function normalizeScope(
  value
) {

  return String(
    value || "DEFAULT"
  )
    .trim()
    .toUpperCase();

}


function formatScope(
  scope
) {

  switch (
    normalizeScope(scope)
  ) {

    case "PRODUCT":
      return "Product Override";

    case "CATEGORY":
      return "Category Rule";

    default:
      return "Default Rule";

  }

}


/* =====================================================
   TYPE
===================================================== */

function normalizeType(
  value
) {

  return String(
    value || "PERCENTAGE"
  )
    .trim()
    .toUpperCase();

}


function formatCommission(
  rule
) {

  const type =
    normalizeType(
      rule.commissionType ||
      rule.type
    );


  const value =
    getNumber(
      rule.commissionValue ??
      rule.value
    );


  if (
    type ===
    "FIXED"
  ) {

    return `₹${formatMoney(
      value
    )}`;

  }


  return `${formatMoney(
    value
  )}%`;

}


/* =====================================================
   CATEGORY
===================================================== */

function normalizeCategory(
  value
) {

  return String(
    value || ""
  )
    .trim()
    .toUpperCase();

}


/* =====================================================
   NUMBER
===================================================== */

function numberValue(
  value
) {

  const number =
    Number(value);


  return Number.isFinite(
    number
  )
    ? number
    : 0;

}


function getNumber(
  value
) {

  return numberValue(
    value
  );

}


/* =====================================================
   MONEY
===================================================== */

function formatMoney(
  value
) {

  return getNumber(
    value
  ).toLocaleString(
    "en-IN",
    {
      minimumFractionDigits:0,
      maximumFractionDigits:2
    }
  );

}


/* =====================================================
   TIMESTAMP
===================================================== */

function getTimestamp(
  timestamp
) {

  if (!timestamp) {

    return 0;

  }


  if (
    typeof timestamp.toMillis ===
    "function"
  ) {

    return timestamp.toMillis();

  }


  if (
    typeof timestamp.seconds ===
    "number"
  ) {

    return timestamp.seconds *
      1000;

  }


  return 0;

}


/* =====================================================
   ERROR
===================================================== */

function getErrorMessage(
  error
) {

  if (
    error?.code ===
    "permission-denied"
  ) {

    return "Firestore permission denied. Admin Firebase Rules check કરો.";

  }


  if (
    error?.code ===
    "unauthenticated"
  ) {

    return "Login session expired. Please login again.";

  }


  if (
    error?.code ===
    "unavailable"
  ) {

    return "Firebase temporarily unavailable. Internet connection check કરો.";

  }


  return (
    error?.message ||
    "Unable to complete the operation."
  );

}


/* =====================================================
   MESSAGES
===================================================== */

function showError(
  message
) {

  successBox.style.display =
    "none";


  errorBox.textContent =
    message;


  errorBox.style.display =
    "block";


  window.scrollTo({
    top:0,
    behavior:"smooth"
  });

}


function showSuccess(
  message
) {

  errorBox.style.display =
    "none";


  successBox.textContent =
    message;


  successBox.style.display =
    "block";

}


/* =====================================================
   ESCAPE
===================================================== */

function escapeHtml(
  value
) {

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


function escapeAttribute(
  value
) {

  return escapeHtml(
    value
  );

}