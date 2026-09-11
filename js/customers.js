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


/* =========================================================
   DOM
========================================================= */

const customerContainer =
  document.getElementById("customerContainer");

const searchInput =
  document.getElementById("searchInput");

const protectionFilter =
  document.getElementById("protectionFilter");

const totalCustomers =
  document.getElementById("totalCustomers");

const protectedCustomers =
  document.getElementById("protectedCustomers");

const unprotectedCustomers =
  document.getElementById("unprotectedCustomers");

const serialCustomers =
  document.getElementById("serialCustomers");

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

const cancelModalBtn =
  document.getElementById("cancelModalBtn");

const modalTitle =
  document.getElementById("modalTitle");

const customerForm =
  document.getElementById("customerForm");

const saveCustomerBtn =
  document.getElementById("saveCustomerBtn");

const editCustomerId =
  document.getElementById("editCustomerId");

const customerName =
  document.getElementById("customerName");

const customerMobile =
  document.getElementById("customerMobile");

const customerAddress =
  document.getElementById("customerAddress");

const deviceBrand =
  document.getElementById("deviceBrand");

const deviceModel =
  document.getElementById("deviceModel");

const screenSize =
  document.getElementById("screenSize");

const serialNumber =
  document.getElementById("serialNumber");

const originalRetailerId =
  document.getElementById("originalRetailerId");

const protectedText =
  document.getElementById("protectedText");

const duplicateWarning =
  document.getElementById("duplicateWarning");

const moreNavBtn =
  document.getElementById("moreNavBtn");

const morePanel =
  document.getElementById("morePanel");


/* =========================================================
   STATE
========================================================= */

let allCustomers = [];
let allRetailers = [];
let selectedCustomerId = null;
let adminUser = null;


/* =========================================================
   AUTHORIZATION
========================================================= */

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

    await loadPage();

  } catch (error) {

    showError(
      error.message || "Authorization error."
    );

  }

});


/* =========================================================
   LOAD PAGE
========================================================= */

async function loadPage() {

  try {

    await Promise.all([
      loadRetailers(),
      loadCustomers()
    ]);

  } catch (error) {

    showError(
      error.message || "Unable to load customer module."
    );

  }

}


/* =========================================================
   LOAD RETAILERS
========================================================= */

async function loadRetailers() {

  const snapshot =
    await getDocs(collection(db, "retailers"));

  allRetailers = [];

  snapshot.forEach(item => {

    allRetailers.push({
      uid: item.id,
      ...item.data()
    });

  });

  /*
    Fallback:
    If retailers master collection is empty,
    read retailer users from users collection.
  */

  if (allRetailers.length === 0) {

    const usersSnapshot =
      await getDocs(collection(db, "users"));

    usersSnapshot.forEach(item => {

      const data = item.data();

      if (
        data.role === "retailer" &&
        data.active === true
      ) {

        allRetailers.push({
          uid: item.id,
          ...data
        });

      }

    });

  }

  renderRetailerOptions();

}


/* =========================================================
   RENDER RETAILER OPTIONS
========================================================= */

function renderRetailerOptions() {

  originalRetailerId.innerHTML = `
    <option value="">-- No Retailer --</option>
    ${
      allRetailers
        .map(retailer => {

          const name =
            retailer.businessName ||
            retailer.shopName ||
            retailer.name ||
            retailer.mobile ||
            retailer.uid;

          return `
            <option value="${escapeAttribute(retailer.uid)}">
              ${escapeHtml(name)}
            </option>
          `;

        })
        .join("")
    }
  `;

}


/* =========================================================
   LOAD CUSTOMERS
========================================================= */

async function loadCustomers() {

  customerContainer.innerHTML = `
    <div class="loading">
      Loading customers...
    </div>
  `;

  try {

    const snapshot =
      await getDocs(collection(db, "customers"));

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
          Customer Load Error
        </div>

        <div class="empty-text">
          ${escapeHtml(
            error.message ||
            "Unable to load customers."
          )}
        </div>

      </div>
    `;

    throw error;

  }

}


/* =========================================================
   SUMMARY
========================================================= */

function updateSummary() {

  const total =
    allCustomers.length;

  const protectedCount =
    allCustomers.filter(customer =>
      isProtectedCustomer(customer)
    ).length;

  const unprotectedCount =
    total - protectedCount;

  const serialCount =
    allCustomers.filter(customer =>
      String(customer.serialNumber || "").trim()
    ).length;

  totalCustomers.textContent =
    total;

  protectedCustomers.textContent =
    protectedCount;

  unprotectedCustomers.textContent =
    unprotectedCount;

  serialCustomers.textContent =
    serialCount;

}


/* =========================================================
   PROTECTED CUSTOMER
========================================================= */

function isProtectedCustomer(customer) {

  return Boolean(
    customer.originalRetailerId ||
    customer.protected === true
  );

}


/* =========================================================
   FILTER EVENTS
========================================================= */

searchInput.addEventListener(
  "input",
  renderCustomers
);

protectionFilter.addEventListener(
  "change",
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

  const protection =
    protectionFilter.value;

  const filtered =
    allCustomers.filter(customer => {

      const searchable = [

        customer.id,

        customer.customerId,

        customer.name,

        customer.customerName,

        customer.mobile,

        customer.customerMobile,

        customer.phone,

        customer.address,

        customer.deviceBrand,

        customer.deviceModel,

        customer.serialNumber,

        customer.screenSize

      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const searchMatch =
        !search ||
        searchable.includes(search);

      const protectedStatus =
        isProtectedCustomer(customer);

      const protectionMatch =
        !protection ||
        (
          protection === "PROTECTED" &&
          protectedStatus
        ) ||
        (
          protection === "UNPROTECTED" &&
          !protectedStatus
        );

      return (
        searchMatch &&
        protectionMatch
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
          No customer matches your search or filter.
        </div>

      </div>
    `;

    return;

  }


  customerContainer.innerHTML = `
    <div class="customer-list">
      ${filtered
        .map(renderCustomerCard)
        .join("")}
    </div>
  `;


  document
    .querySelectorAll("[data-view-customer]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => openCustomerModal(
          button.dataset.viewCustomer
        )
      );

    });


  document
    .querySelectorAll("[data-edit-customer]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => openCustomerModal(
          button.dataset.editCustomer
        )
      );

    });

}


/* =========================================================
   CUSTOMER CARD
========================================================= */

function renderCustomerCard(customer) {

  const protectedCustomer =
    isProtectedCustomer(customer);

  const name =
    customer.name ||
    customer.customerName ||
    "Customer";

  const mobile =
    customer.mobile ||
    customer.customerMobile ||
    customer.phone ||
    "-";

  const address =
    customer.address ||
    "-";

  const device =
    getDeviceText(customer);

  const retailer =
    getRetailer(customer.originalRetailerId);

  const retailerName =
    retailer
      ? (
          retailer.businessName ||
          retailer.shopName ||
          retailer.name ||
          retailer.mobile ||
          retailer.uid
        )
      : (
          customer.originalRetailerName ||
          customer.retailerName ||
          "No Retailer"
        );

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

        ${
          protectedCustomer
            ? `
              <span class="protected-badge">
                🛡️ PROTECTED
              </span>
            `
            : `
              <span class="normal-badge">
                UNPROTECTED
              </span>
            `
        }

      </div>


      <div class="customer-info">

        <div class="info-row">
          <span class="info-icon">📍</span>
          <span>${escapeHtml(address)}</span>
        </div>

        <div class="info-row">
          <span class="info-icon">📺</span>
          <span>${escapeHtml(device)}</span>
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


      <div class="retailer-box">

        <strong>Original Retailer:</strong>
        ${escapeHtml(retailerName)}

        ${
          protectedCustomer
            ? `
              <br>
              <span>
                Customer relationship protected.
              </span>
            `
            : ""
        }

      </div>


      <div class="customer-actions">

        <button
          type="button"
          class="action-btn view-btn"
          data-view-customer="${escapeAttribute(customer.id)}"
        >
          View
        </button>

        <button
          type="button"
          class="action-btn edit-btn"
          data-edit-customer="${escapeAttribute(customer.id)}"
        >
          Edit
        </button>

      </div>

    </div>
  `;

}


/* =========================================================
   OPEN CUSTOMER MODAL
========================================================= */

function openCustomerModal(customerId) {

  const customer =
    allCustomers.find(
      item => item.id === customerId
    );

  if (!customer) {

    showError("Customer not found.");

    return;

  }

  selectedCustomerId =
    customerId;

  modalTitle.textContent =
    "Customer Details";

  editCustomerId.value =
    customer.id;

  customerName.value =
    customer.name ||
    customer.customerName ||
    "";

  customerMobile.value =
    customer.mobile ||
    customer.customerMobile ||
    customer.phone ||
    "";

  customerAddress.value =
    customer.address ||
    "";

  deviceBrand.value =
    customer.deviceBrand ||
    "";

  deviceModel.value =
    customer.deviceModel ||
    "";

  screenSize.value =
    customer.screenSize ||
    "";

  serialNumber.value =
    customer.serialNumber ||
    "";

  originalRetailerId.value =
    customer.originalRetailerId ||
    "";

  updateProtectionPanel(customer);

  duplicateWarning.style.display =
    "none";

  modalBackdrop.classList.add("show");

}


/* =========================================================
   PROTECTION PANEL
========================================================= */

function updateProtectionPanel(customer) {

  const protectedCustomer =
    isProtectedCustomer(customer);

  if (protectedCustomer) {

    const retailer =
      getRetailer(
        customer.originalRetailerId
      );

    const retailerName =
      retailer
        ? (
            retailer.businessName ||
            retailer.shopName ||
            retailer.name ||
            retailer.mobile ||
            retailer.uid
          )
        : (
            customer.originalRetailerName ||
            customer.retailerName ||
            customer.originalRetailerId ||
            "Original Retailer"
          );

    protectedText.innerHTML = `
      This customer is protected by
      <strong>${escapeHtml(retailerName)}</strong>.
      The original retailer relationship should not normally be changed.
      Transfer is an Admin-only operation.
    `;

  } else {

    protectedText.textContent =
      "This customer is not currently protected by a retailer. Assigning an original retailer will protect the customer relationship.";

  }

}


/* =========================================================
   SAVE CUSTOMER
========================================================= */

saveCustomerBtn.addEventListener(
  "click",
  saveCustomer
);


async function saveCustomer() {

  if (!selectedCustomerId) {

    showError(
      "No customer selected."
    );

    return;

  }

  const customer =
    allCustomers.find(
      item => item.id === selectedCustomerId
    );

  if (!customer) {

    showError(
      "Customer not found."
    );

    return;

  }


  const name =
    customerName.value.trim();

  const mobile =
    normalizeMobile(
      customerMobile.value
    );

  const address =
    customerAddress.value.trim();

  const brand =
    deviceBrand.value.trim();

  const model =
    deviceModel.value.trim();

  const size =
    screenSize.value.trim();

  const serial =
    serialNumber.value.trim();

  const retailerId =
    originalRetailerId.value || "";


  if (!name) {

    showError(
      "Customer name is required."
    );

    return;

  }


  if (!mobile) {

    showError(
      "Customer mobile number is required."
    );

    return;

  }


  /*
    Duplicate check.
    The current customer itself is ignored.
  */

  const duplicate =
    findPossibleDuplicate(
      mobile,
      name,
      address,
      brand,
      model,
      serial,
      customer.id
    );


  if (duplicate) {

    duplicateWarning.style.display =
      "block";

    showError(
      `Possible duplicate customer found: ${
        duplicate.name ||
        duplicate.customerName ||
        duplicate.mobile ||
        duplicate.id
      }`
    );

    return;

  }


  /*
    Protection rule:
    Once originalRetailerId exists,
    normal customer editing must NOT change it.
    
    Since this is Admin UI, we allow an explicit
    Admin transfer only when the retailer value
    is deliberately changed.
  */

  const existingRetailerId =
    customer.originalRetailerId || "";

  const retailerChanged =
    existingRetailerId !== retailerId;


  if (
    existingRetailerId &&
    retailerChanged
  ) {

    const confirmed =
      window.confirm(
        "This customer is already protected by an original retailer.\n\n" +
        "Changing the retailer will transfer customer protection.\n\n" +
        "Continue?"
      );

    if (!confirmed) {

      originalRetailerId.value =
        existingRetailerId;

      return;

    }

  }


  saveCustomerBtn.disabled =
    true;

  saveCustomerBtn.textContent =
    "Saving...";


  try {

    const retailer =
      getRetailer(retailerId);


    const updateData = {

      name,

      customerName: name,

      mobile,

      customerMobile: mobile,

      address,

      deviceBrand: brand,

      deviceModel: model,

      screenSize: size,

      serialNumber: serial,

      updatedAt: serverTimestamp()

    };


    /*
      Protect customer when retailer is assigned.
    */

    if (retailerId) {

      updateData.originalRetailerId =
        retailerId;

      updateData.protected =
        true;

      updateData.originalRetailerName =
        retailer
          ? (
              retailer.businessName ||
              retailer.shopName ||
              retailer.name ||
              retailer.mobile ||
              retailer.uid
            )
          : "";

    } else {

      /*
        Only remove protection if Admin explicitly
        confirms the retailer change.
      */

      if (existingRetailerId) {

        const confirmed =
          window.confirm(
            "You are removing the original retailer protection from this customer.\n\nContinue?"
          );

        if (!confirmed) {

          originalRetailerId.value =
            existingRetailerId;

          saveCustomerBtn.disabled =
            false;

          saveCustomerBtn.textContent =
            "Save Customer";

          return;

        }

      }

      updateData.originalRetailerId =
        "";

      updateData.originalRetailerName =
        "";

      updateData.protected =
        false;

    }


    await updateDoc(
      doc(
        db,
        "customers",
        selectedCustomerId
      ),
      updateData
    );


    closeModal();

    await loadCustomers();

    showSuccess(
      "Customer updated successfully."
    );


  } catch (error) {

    showError(
      error.message ||
      "Customer update failed."
    );

  } finally {

    saveCustomerBtn.disabled =
      false;

    saveCustomerBtn.textContent =
      "Save Customer";

  }

}


/* =========================================================
   DUPLICATE DETECTION
========================================================= */

function findPossibleDuplicate(
  mobile,
  name,
  address,
  brand,
  model,
  serial,
  currentId
) {

  const normalizedName =
    normalizeText(name);

  const normalizedAddress =
    normalizeText(address);

  const normalizedBrand =
    normalizeText(brand);

  const normalizedModel =
    normalizeText(model);

  const normalizedSerial =
    normalizeText(serial);


  for (const customer of allCustomers) {

    if (customer.id === currentId) {
      continue;
    }


    const otherMobile =
      normalizeMobile(
        customer.mobile ||
        customer.customerMobile ||
        customer.phone ||
        ""
      );

    const otherName =
      normalizeText(
        customer.name ||
        customer.customerName ||
        ""
      );

    const otherAddress =
      normalizeText(
        customer.address ||
        ""
      );

    const otherBrand =
      normalizeText(
        customer.deviceBrand ||
        ""
      );

    const otherModel =
      normalizeText(
        customer.deviceModel ||
        ""
      );

    const otherSerial =
      normalizeText(
        customer.serialNumber ||
        ""
      );


    /*
      Strong duplicate:
      Same mobile.
    */

    if (
      mobile &&
      otherMobile &&
      mobile === otherMobile
    ) {

      return customer;

    }


    /*
      Strong duplicate:
      Same serial number.
    */

    if (
      normalizedSerial &&
      otherSerial &&
      normalizedSerial === otherSerial
    ) {

      return customer;

    }


    /*
      Medium duplicate:
      Same name + address + device.
    */

    const sameName =
      normalizedName &&
      otherName &&
      normalizedName === otherName;

    const sameAddress =
      normalizedAddress &&
      otherAddress &&
      normalizedAddress === otherAddress;

    const sameDevice =
      normalizedBrand &&
      normalizedModel &&
      normalizedBrand === otherBrand &&
      normalizedModel === otherModel;


    if (
      sameName &&
      sameAddress &&
      sameDevice
    ) {

      return customer;

    }

  }


  return null;

}


/* =========================================================
   RETAILER LOOKUP
========================================================= */

function getRetailer(uid) {

  if (!uid) {
    return null;
  }

  return (
    allRetailers.find(
      retailer => retailer.uid === uid
    ) || null
  );

}


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
   CLOSE MODAL
========================================================= */

function closeModal() {

  modalBackdrop.classList.remove(
    "show"
  );

  selectedCustomerId =
    null;

  customerForm.reset();

  duplicateWarning.style.display =
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
      event.target === modalBackdrop
    ) {

      closeModal();

    }

  }
);


/* =========================================================
   MORE MENU
========================================================= */

moreNavBtn.addEventListener(
  "click",
  event => {

    event.stopPropagation();

    morePanel.classList.toggle(
      "show"
    );

  }
);


morePanel
  .querySelectorAll("[data-page]")
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


document.addEventListener(
  "click",
  event => {

    if (
      morePanel.classList.contains("show") &&
      !morePanel.contains(event.target) &&
      event.target !== moreNavBtn
    ) {

      morePanel.classList.remove(
        "show"
      );

    }

  }
);


/* =========================================================
   BOTTOM NAVIGATION
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
   NORMALIZE MOBILE
========================================================= */

function normalizeMobile(value) {

  return String(value || "")
    .replace(/\D/g, "")
    .slice(-10);

}


/* =========================================================
   NORMALIZE TEXT
========================================================= */

function normalizeText(value) {

  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

}


/* =========================================================
   ERROR / SUCCESS
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
   ESCAPE HTML
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