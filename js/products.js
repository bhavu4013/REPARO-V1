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

const productContainer =
  document.getElementById("productContainer");

const searchInput =
  document.getElementById("searchInput");

const categoryFilter =
  document.getElementById("categoryFilter");

const logoutBtn =
  document.getElementById("logoutBtn");

const errorBox =
  document.getElementById("errorBox");

const successBox =
  document.getElementById("successBox");

const totalProducts =
  document.getElementById("totalProducts");

const activeProducts =
  document.getElementById("activeProducts");

const lowStock =
  document.getElementById("lowStock");

const outOfStock =
  document.getElementById("outOfStock");

const addProductBtn =
  document.getElementById("addProductBtn");

const modalBackdrop =
  document.getElementById("modalBackdrop");

const closeModalBtn =
  document.getElementById("closeModalBtn");

const cancelBtn =
  document.getElementById("cancelBtn");

const modalTitle =
  document.getElementById("modalTitle");

const productForm =
  document.getElementById("productForm");

const editProductId =
  document.getElementById("editProductId");

const saveBtn =
  document.getElementById("saveBtn");

const productName =
  document.getElementById("productName");

const productCategory =
  document.getElementById("productCategory");

const brand =
  document.getElementById("brand");

const model =
  document.getElementById("model");

const sku =
  document.getElementById("sku");

const purchaseCost =
  document.getElementById("purchaseCost");

const sellingPrice =
  document.getElementById("sellingPrice");

const marginType =
  document.getElementById("marginType");

const marginValue =
  document.getElementById("marginValue");

const retailerShare =
  document.getElementById("retailerShare");

const currentStock =
  document.getElementById("currentStock");

const minStock =
  document.getElementById("minStock");

const supplier =
  document.getElementById("supplier");

const warrantyDays =
  document.getElementById("warrantyDays");


/* =====================================================
   STATE
===================================================== */

let allProducts = [];

let selectedProductId = null;


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


      await loadProducts();

    }
    catch (error) {

      showError(
        getErrorMessage(error)
      );

    }

  }
);


/* =====================================================
   LOAD PRODUCTS
===================================================== */

async function loadProducts() {

  productContainer.innerHTML = `

    <div class="loading">
      Loading products...
    </div>

  `;


  try {

    const snapshot =
      await getDocs(
        collection(
          db,
          "products"
        )
      );


    allProducts = [];


    snapshot.forEach(
      item => {

        allProducts.push({

          id:
            item.id,

          ...item.data()

        });

      }
    );


    allProducts.sort(
      (a, b) => {

        const aTime =
          getTimestamp(
            a.createdAt
          );

        const bTime =
          getTimestamp(
            b.createdAt
          );

        return bTime - aTime;

      }
    );


    updateSummary();

    renderProducts();

  }
  catch (error) {

    productContainer.innerHTML = `

      <div class="empty">

        <div class="empty-icon">
          ⚠️
        </div>

        <div class="empty-title">
          Products Load Error
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
    allProducts.length;


  const active =
    allProducts.filter(
      product =>
        product.active !== false
    ).length;


  const low =
    allProducts.filter(
      product =>
        getStockStatus(product) ===
        "LOW"
    ).length;


  const out =
    allProducts.filter(
      product =>
        getStockStatus(product) ===
        "OUT"
    ).length;


  totalProducts.textContent =
    total;

  activeProducts.textContent =
    active;

  lowStock.textContent =
    low;

  outOfStock.textContent =
    out;

}


/* =====================================================
   FILTER EVENTS
===================================================== */

searchInput.addEventListener(
  "input",
  renderProducts
);


categoryFilter.addEventListener(
  "change",
  renderProducts
);


/* =====================================================
   RENDER PRODUCTS
===================================================== */

function renderProducts() {

  const search =
    searchInput.value
      .trim()
      .toLowerCase();


  const category =
    String(
      categoryFilter.value || ""
    )
      .trim()
      .toUpperCase();


  const filtered =
    allProducts.filter(
      product => {

        const searchable = [

          product.id,
          product.name,
          product.productName,
          product.category,
          product.brand,
          product.model,
          product.sku,
          product.supplier

        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();


        const searchMatch =
          !search ||
          searchable.includes(search);


        const categoryMatch =
          !category ||
          normalizeCategory(
            product.category
          ) === category;


        return (
          searchMatch &&
          categoryMatch
        );

      }
    );


  if (
    filtered.length === 0
  ) {

    productContainer.innerHTML = `

      <div class="empty">

        <div class="empty-icon">
          📦
        </div>

        <div class="empty-title">
          No Products Found
        </div>

        <div class="empty-text">
          No products match your search.
        </div>

      </div>

    `;

    return;

  }


  productContainer.innerHTML = `

    <div class="product-list">

      ${filtered
        .map(renderProductCard)
        .join("")}

    </div>

  `;


  bindProductButtons();

}


/* =====================================================
   PRODUCT CARD
===================================================== */

function renderProductCard(product) {

  const active =
    product.active !== false;


  const stockStatus =
    getStockStatus(product);


  const stockClass =
    stockStatus === "OUT"
      ? "stock-out"
      : stockStatus === "LOW"
        ? "stock-low"
        : "stock-normal";


  const stockText =
    stockStatus === "OUT"
      ? "Out of Stock"
      : stockStatus === "LOW"
        ? `${getNumber(
            product.currentStock
          )} Low`
        : getNumber(
            product.currentStock
          );


  const productTitle =
    product.name ||
    product.productName ||
    "Unnamed Product";


  const meta = [

    product.category,

    product.brand,

    product.model

  ]
    .filter(Boolean)
    .join(" • ");


  return `

    <div class="product-card">

      <div class="product-top">

        <div>

          <h3 class="product-name">
            ${escapeHtml(
              productTitle
            )}
          </h3>

          <div class="product-meta">
            ${escapeHtml(
              meta ||
              "Product"
            )}
          </div>

        </div>


        <span
          class="badge ${
            active
              ? "badge-active"
              : "badge-inactive"
          }"
        >
          ${
            active
              ? "ACTIVE"
              : "INACTIVE"
          }
        </span>

      </div>


      <div class="product-info">

        <div class="info-row">

          <span class="info-icon">
            🏷️
          </span>

          <span>
            SKU:
            ${escapeHtml(
              product.sku ||
              "-"
            )}
          </span>

        </div>


        <div class="info-row">

          <span class="info-icon">
            🚚
          </span>

          <span>
            Supplier:
            ${escapeHtml(
              product.supplier ||
              "-"
            )}
          </span>

        </div>


        <div class="info-row">

          <span class="info-icon">
            🛡️
          </span>

          <span>
            Warranty:
            ${escapeHtml(
              formatWarranty(
                product.warrantyDays
              )
            )}
          </span>

        </div>

      </div>


      <div class="price-row">

        <div class="price-box">

          <div class="price-label">
            Purchase
          </div>

          <div class="price-value">
            ₹${formatMoney(
              product.purchaseCost
            )}
          </div>

        </div>


        <div class="price-box">

          <div class="price-label">
            Selling
          </div>

          <div class="price-value">
            ₹${formatMoney(
              product.sellingPrice
            )}
          </div>

        </div>


        <div class="price-box">

          <div class="price-label">
            Stock
          </div>

          <div class="price-value ${stockClass}">
            ${escapeHtml(
              stockText
            )}
          </div>

        </div>

      </div>


      <div class="divider"></div>


      <div class="actions">

        <button
          type="button"
          class="action edit-btn"
          data-edit-product="${escapeAttribute(
            product.id
          )}"
        >
          Edit
        </button>


        <button
          type="button"
          class="action toggle-btn"
          data-toggle-product="${escapeAttribute(
            product.id
          )}"
        >
          ${
            active
              ? "Deactivate"
              : "Activate"
          }
        </button>

      </div>

    </div>

  `;

}


/* =====================================================
   BUTTON BINDING
===================================================== */

function bindProductButtons() {

  document
    .querySelectorAll(
      "[data-edit-product]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            openEditModal(
              button.dataset.editProduct
            );

          }
        );

      }
    );


  document
    .querySelectorAll(
      "[data-toggle-product]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            toggleProduct(
              button.dataset.toggleProduct
            );

          }
        );

      }
    );

}


/* =====================================================
   ADD PRODUCT
===================================================== */

addProductBtn.addEventListener(
  "click",
  openAddModal
);


function openAddModal() {

  selectedProductId =
    null;


  productForm.reset();


  editProductId.value =
    "";


  marginType.value =
    "PERCENTAGE";


  marginValue.value =
    "0";


  retailerShare.value =
    "0";


  currentStock.value =
    "0";


  minStock.value =
    "2";


  warrantyDays.value =
    "0";


  modalTitle.textContent =
    "Add Product";


  saveBtn.textContent =
    "Create Product";


  modalBackdrop.classList.add(
    "show"
  );

}


/* =====================================================
   EDIT PRODUCT
===================================================== */

function openEditModal(productId) {

  const product =
    allProducts.find(
      item =>
        item.id === productId
    );


  if (!product) {

    showError(
      "Product not found."
    );

    return;

  }


  selectedProductId =
    productId;


  editProductId.value =
    productId;


  productName.value =
    product.name ||
    product.productName ||
    "";


  productCategory.value =
    normalizeCategory(
      product.category
    );


  brand.value =
    product.brand ||
    "";


  model.value =
    product.model ||
    "";


  sku.value =
    product.sku ||
    "";


  purchaseCost.value =
    getNumber(
      product.purchaseCost
    );


  sellingPrice.value =
    getNumber(
      product.sellingPrice
    );


  marginType.value =
    product.marginType ||
    "PERCENTAGE";


  marginValue.value =
    getNumber(
      product.marginValue
    );


  retailerShare.value =
    getNumber(
      product.retailerShare
    );


  currentStock.value =
    getNumber(
      product.currentStock
    );


  minStock.value =
    getNumber(
      product.minStock
    );


  supplier.value =
    product.supplier ||
    "";


  warrantyDays.value =
    getNumber(
      product.warrantyDays
    );


  modalTitle.textContent =
    "Edit Product";


  saveBtn.textContent =
    "Save Changes";


  modalBackdrop.classList.add(
    "show"
  );

}


/* =====================================================
   SAVE PRODUCT
===================================================== */

productForm.addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    await saveProduct();

  }
);


async function saveProduct() {

  const name =
    productName.value.trim();


  const category =
    normalizeCategory(
      productCategory.value
    );


  const purchase =
    numberValue(
      purchaseCost.value
    );


  const selling =
    numberValue(
      sellingPrice.value
    );


  if (!name) {

    showError(
      "Product name is required."
    );

    return;

  }


  if (!category) {

    showError(
      "Please select a product category."
    );

    return;

  }


  if (
    purchase < 0 ||
    selling < 0
  ) {

    showError(
      "Price cannot be negative."
    );

    return;

  }


  const productData = {

    name,

    category,

    brand:
      brand.value.trim(),

    model:
      model.value.trim(),

    sku:
      sku.value.trim(),

    purchaseCost:
      purchase,

    sellingPrice:
      selling,

    marginType:
      marginType.value ||
      "PERCENTAGE",

    marginValue:
      numberValue(
        marginValue.value
      ),

    retailerShare:
      numberValue(
        retailerShare.value
      ),

    currentStock:
      Math.max(
        0,
        Math.floor(
          numberValue(
            currentStock.value
          )
        )
      ),

    minStock:
      Math.max(
        0,
        Math.floor(
          numberValue(
            minStock.value
          )
        )
      ),

    supplier:
      supplier.value.trim(),

    warrantyDays:
      Math.max(
        0,
        Math.floor(
          numberValue(
            warrantyDays.value
          )
        )
      )

  };


  saveBtn.disabled =
    true;


  saveBtn.textContent =
    selectedProductId
      ? "Saving..."
      : "Creating...";


  try {

    if (selectedProductId) {

      /*
        Do not overwrite the active field.
        It is controlled by Activate /
        Deactivate.
      */

      await updateDoc(

        doc(
          db,
          "products",
          selectedProductId
        ),

        {
          ...productData,

          updatedAt:
            serverTimestamp()
        }

      );


      closeModal();

      await loadProducts();

      showSuccess(
        "Product updated successfully."
      );

    }
    else {

      await addDoc(

        collection(
          db,
          "products"
        ),

        {
          ...productData,

          active:
            true,

          createdAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp()

        }

      );


      closeModal();

      await loadProducts();

      showSuccess(
        "Product created successfully."
      );

    }

  }
  catch (error) {

    console.error(
      "Product save error:",
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
      selectedProductId
        ? "Save Changes"
        : "Create Product";

  }

}


/* =====================================================
   TOGGLE PRODUCT
===================================================== */

async function toggleProduct(productId) {

  const product =
    allProducts.find(
      item =>
        item.id === productId
    );


  if (!product) {

    showError(
      "Product not found."
    );

    return;

  }


  const newState =
    product.active === false;


  try {

    await updateDoc(

      doc(
        db,
        "products",
        productId
      ),

      {
        active:
          newState,

        updatedAt:
          serverTimestamp()

      }

    );


    await loadProducts();


    showSuccess(
      newState
        ? "Product activated."
        : "Product deactivated."
    );

  }
  catch (error) {

    console.error(
      "Product status error:",
      error
    );


    showError(
      getErrorMessage(error)
    );

  }

}


/* =====================================================
   CLOSE MODAL
===================================================== */

function closeModal() {

  modalBackdrop.classList.remove(
    "show"
  );


  selectedProductId =
    null;


  editProductId.value =
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
   STOCK STATUS
===================================================== */

function getStockStatus(product) {

  const stock =
    getNumber(
      product.currentStock
    );


  const minimum =
    getNumber(
      product.minStock
    );


  if (stock <= 0) {

    return "OUT";

  }


  if (stock <= minimum) {

    return "LOW";

  }


  return "NORMAL";

}


/* =====================================================
   CATEGORY
===================================================== */

function normalizeCategory(
  category
) {

  return String(
    category || ""
  )
    .trim()
    .toUpperCase();

}


/* =====================================================
   WARRANTY
===================================================== */

function formatWarranty(days) {

  const value =
    getNumber(days);


  if (value <= 0) {

    return "No Warranty";

  }


  if (
    value % 365 === 0
  ) {

    const years =
      value / 365;

    return `${years} Year${
      years === 1
        ? ""
        : "s"
    }`;

  }


  if (
    value % 30 === 0
  ) {

    const months =
      value / 30;

    return `${months} Month${
      months === 1
        ? ""
        : "s"
    }`;

  }


  return `${value} Days`;

}


/* =====================================================
   MONEY
===================================================== */

function formatMoney(value) {

  const number =
    getNumber(value);


  return number.toLocaleString(
    "en-IN",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }
  );

}


/* =====================================================
   NUMBER
===================================================== */

function numberValue(value) {

  const number =
    Number(value);


  return Number.isFinite(
    number
  )
    ? number
    : 0;

}


function getNumber(value) {

  return numberValue(
    value
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

    return timestamp.seconds * 1000;

  }


  return 0;

}


/* =====================================================
   ERROR MESSAGE
===================================================== */

function getErrorMessage(error) {

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
   SHOW ERROR
===================================================== */

function showError(message) {

  successBox.style.display =
    "none";


  errorBox.textContent =
    message;


  errorBox.style.display =
    "block";


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

}


/* =====================================================
   SHOW SUCCESS
===================================================== */

function showSuccess(message) {

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

  return escapeHtml(
    value
  );

}