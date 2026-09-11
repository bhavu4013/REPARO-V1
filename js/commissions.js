import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  doc,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


const commissionList =
  document.getElementById("commissionList");

const loading =
  document.getElementById("loading");

const searchInput =
  document.getElementById("searchInput");

const ruleTypeFilter =
  document.getElementById("ruleTypeFilter");

const addCommissionBtn =
  document.getElementById("addCommissionBtn");

const commissionModal =
  document.getElementById("commissionModal");

const modalTitle =
  document.getElementById("modalTitle");

const commissionForm =
  document.getElementById("commissionForm");

const closeModalBtn =
  document.getElementById("closeModalBtn");

const editCommissionId =
  document.getElementById("editCommissionId");

const ruleName =
  document.getElementById("ruleName");

const ruleType =
  document.getElementById("ruleType");

const category =
  document.getElementById("category");

const productId =
  document.getElementById("productId");

const retailerId =
  document.getElementById("retailerId");

const commissionType =
  document.getElementById("commissionType");

const commissionValue =
  document.getElementById("commissionValue");

const warrantyHoldDays =
  document.getElementById("warrantyHoldDays");

const priority =
  document.getElementById("priority");

const active =
  document.getElementById("active");


let commissions = [];


// --------------------------------------------------
// AUTH
// --------------------------------------------------

onAuthStateChanged(auth, async user => {

  if (!user) {

    window.location.href =
      "../index.html";

    return;
  }


  try {

    const userSnap =
      await getDoc(
        doc(db, "users", user.uid)
      );


    if (
      !userSnap.exists() ||
      userSnap.data().role !== "admin"
    ) {

      window.location.href =
        "../index.html";

      return;
    }


    await loadCommissions();


  } catch (error) {

    console.error(error);

    loading.textContent =
      "Unable to load commission rules.";

  }

});


// --------------------------------------------------
// LOAD
// --------------------------------------------------

async function loadCommissions() {

  loading.style.display = "block";


  try {

    const q =
      query(
        collection(db, "commissions"),
        orderBy("priority", "desc")
      );


    const snapshot =
      await getDocs(q);


    commissions =
      snapshot.docs.map(item => ({

        id: item.id,

        ...item.data()

      }));


  } catch (error) {

    console.warn(
      "Priority query failed.",
      error
    );


    const snapshot =
      await getDocs(
        collection(db, "commissions")
      );


    commissions =
      snapshot.docs.map(item => ({

        id: item.id,

        ...item.data()

      }));


    commissions.sort(
      (a, b) =>
        Number(b.priority || 0) -
        Number(a.priority || 0)
    );

  }


  loading.style.display = "none";

  updateSummary();

  renderCommissions();

}


// --------------------------------------------------
// SUMMARY
// --------------------------------------------------

function updateSummary() {

  const activeItems =
    commissions.filter(
      item => item.active !== false
    );


  const percentage =
    commissions.filter(
      item =>
        item.commissionType ===
        "PERCENTAGE"
    );


  const fixed =
    commissions.filter(
      item =>
        item.commissionType ===
        "FIXED"
    );


  document.getElementById(
    "totalRules"
  ).textContent =
    commissions.length;


  document.getElementById(
    "activeRules"
  ).textContent =
    activeItems.length;


  document.getElementById(
    "percentageRules"
  ).textContent =
    percentage.length;


  document.getElementById(
    "fixedRules"
  ).textContent =
    fixed.length;

}


// --------------------------------------------------
// RENDER
// --------------------------------------------------

function renderCommissions() {

  const search =
    searchInput.value
      .trim()
      .toLowerCase();


  const selectedType =
    ruleTypeFilter.value;


  const filtered =
    commissions.filter(item => {

      const text = [

        item.ruleName,
        item.ruleType,
        item.category,
        item.productId,
        item.retailerId,
        item.commissionType

      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();


      return (

        (!search ||
          text.includes(search))

        &&

        (!selectedType ||
          item.ruleType === selectedType)

      );

    });


  if (!filtered.length) {

    commissionList.innerHTML =
      `
        <div class="empty-state">
          No commission rules found.
        </div>
      `;

    return;

  }


  commissionList.innerHTML =
    filtered
      .map(renderCommission)
      .join("");


  document
    .querySelectorAll("[data-edit-commission]")
    .forEach(button => {

      button.onclick = () =>
        openEdit(
          button.dataset.editCommission
        );

    });


  document
    .querySelectorAll("[data-toggle-commission]")
    .forEach(button => {

      button.onclick = () =>
        toggleRule(
          button.dataset.toggleCommission
        );

    });

}


// --------------------------------------------------
// CARD
// --------------------------------------------------

function renderCommission(item) {

  const value =
    item.commissionType ===
    "PERCENTAGE"

      ? `${formatMoney(item.commissionValue)}%`

      : `₹${formatMoney(item.commissionValue)}`;


  let target = "All Services";


  if (
    item.ruleType ===
    "CATEGORY"
  ) {

    target =
      `Category: ${item.category || "-"}`;

  }


  if (
    item.ruleType ===
    "PRODUCT"
  ) {

    target =
      `Product: ${item.productId || "-"}`;

  }


  if (
    item.ruleType ===
    "RETAILER"
  ) {

    target =
      `Retailer: ${item.retailerId || "-"}`;

  }


  return `

    <article class="card">

      <div class="card-header">

        <div>

          <strong>
            ${escapeHtml(
              item.ruleName || "-"
            )}
          </strong>

          <h3>
            ${escapeHtml(target)}
          </h3>

          <small>
            Rule Type:
            ${escapeHtml(
              item.ruleType || "-"
            )}
          </small>

        </div>


        <span class="status-badge">

          ${escapeHtml(value)}

        </span>

      </div>


      <div class="card-details">

        <div>

          <small>Commission</small>

          <strong>
            ${escapeHtml(value)}
          </strong>

        </div>


        <div>

          <small>Warranty Hold</small>

          <strong>
            ${Number(
              item.warrantyHoldDays || 0
            )} Days
          </strong>

        </div>


        <div>

          <small>Priority</small>

          <strong>
            ${Number(
              item.priority || 0
            )}
          </strong>

        </div>


        <div>

          <small>Status</small>

          <strong>
            ${
              item.active === false
                ? "Inactive"
                : "Active"
            }
          </strong>

        </div>

      </div>


      <div class="card-actions">

        <button
          data-edit-commission="${item.id}"
          class="primary-btn">
          Edit
        </button>


        <button
          data-toggle-commission="${item.id}">

          ${
            item.active === false
              ? "Activate"
              : "Deactivate"
          }

        </button>

      </div>

    </article>

  `;

}


// --------------------------------------------------
// ADD
// --------------------------------------------------

addCommissionBtn.onclick = () => {

  resetForm();

  modalTitle.textContent =
    "Add Commission Rule";

  commissionModal.classList.remove(
    "hidden"
  );

};


// --------------------------------------------------
// EDIT
// --------------------------------------------------

function openEdit(id) {

  const item =
    commissions.find(
      commission =>
        commission.id === id
    );


  if (!item) return;


  editCommissionId.value =
    item.id;


  ruleName.value =
    item.ruleName || "";


  ruleType.value =
    item.ruleType ||
    "DEFAULT";


  category.value =
    item.category || "";


  productId.value =
    item.productId || "";


  retailerId.value =
    item.retailerId || "";


  commissionType.value =
    item.commissionType ||
    "PERCENTAGE";


  commissionValue.value =
    item.commissionValue || 0;


  warrantyHoldDays.value =
    item.warrantyHoldDays || 0;


  priority.value =
    item.priority || 0;


  active.value =
    String(
      item.active !== false
    );


  modalTitle.textContent =
    "Edit Commission Rule";


  commissionModal.classList.remove(
    "hidden"
  );

}


// --------------------------------------------------
// SAVE
// --------------------------------------------------

commissionForm.addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    const id =
      editCommissionId.value;


    const data = {

      ruleName:
        ruleName.value.trim(),

      ruleType:
        ruleType.value,

      category:
        category.value,

      productId:
        productId.value.trim(),

      retailerId:
        retailerId.value.trim(),

      commissionType:
        commissionType.value,

      commissionValue:
        Number(
          commissionValue.value || 0
        ),

      warrantyHoldDays:
        Number(
          warrantyHoldDays.value || 0
        ),

      priority:
        Number(
          priority.value || 0
        ),

      active:
        active.value === "true",

      updatedAt:
        serverTimestamp()

    };


    // Basic validation

    if (
      data.ruleType ===
      "CATEGORY" &&
      !data.category
    ) {

      alert(
        "Please select a Category."
      );

      return;

    }


    if (
      data.ruleType ===
      "PRODUCT" &&
      !data.productId
    ) {

      alert(
        "Please enter Product ID."
      );

      return;

    }


    if (
      data.ruleType ===
      "RETAILER" &&
      !data.retailerId
    ) {

      alert(
        "Please enter Retailer ID."
      );

      return;

    }


    try {

      if (id) {

        await updateDoc(
          doc(
            db,
            "commissions",
            id
          ),
          data
        );


        alert(
          "Commission rule updated."
        );


      } else {

        await addDoc(
          collection(
            db,
            "commissions"
          ),
          {

            ...data,

            createdAt:
              serverTimestamp(),

            createdBy:
              auth.currentUser.uid

          }
        );


        alert(
          "Commission rule created."
        );

      }


      closeModal();

      await loadCommissions();


    } catch (error) {

      console.error(error);

      alert(
        "Unable to save commission rule.\n\n" +
        error.message
      );

    }

  }
);


// --------------------------------------------------
// TOGGLE
// --------------------------------------------------

async function toggleRule(id) {

  const item =
    commissions.find(
      commission =>
        commission.id === id
    );


  if (!item) return;


  try {

    await updateDoc(
      doc(
        db,
        "commissions",
        id
      ),
      {

        active:
          item.active === false,

        updatedAt:
          serverTimestamp()

      }
    );


    await loadCommissions();


  } catch (error) {

    console.error(error);

    alert(
      "Unable to change rule status."
    );

  }

}


// --------------------------------------------------
// CLOSE
// --------------------------------------------------

closeModalBtn.onclick =
  closeModal;


commissionModal.addEventListener(
  "click",
  event => {

    if (
      event.target ===
      commissionModal
    ) {

      closeModal();

    }

  }
);


function closeModal() {

  commissionModal.classList.add(
    "hidden"
  );

}


// --------------------------------------------------
// RESET
// --------------------------------------------------

function resetForm() {

  commissionForm.reset();

  editCommissionId.value = "";

  ruleType.value =
    "DEFAULT";

  commissionType.value =
    "PERCENTAGE";

  commissionValue.value =
    "0";

  warrantyHoldDays.value =
    "0";

  priority.value =
    "0";

  active.value =
    "true";

}


// --------------------------------------------------
// FILTER
// --------------------------------------------------

searchInput.addEventListener(
  "input",
  renderCommissions
);


ruleTypeFilter.addEventListener(
  "change",
  renderCommissions
);


// --------------------------------------------------
// MONEY
// --------------------------------------------------

function formatMoney(value) {

  return Number(
    value || 0
  ).toLocaleString(
    "en-IN",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  );

}


// --------------------------------------------------
// ESCAPE
// --------------------------------------------------

function escapeHtml(value) {

  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );

}