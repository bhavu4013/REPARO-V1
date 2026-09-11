import {
  onAuthStateChanged,
  signOut
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
   DOM
===================================================== */

const productContainer =
  document.getElementById("productContainer");

const searchInput =
  document.getElementById("searchInput");

const categoryFilter =
  document.getElementById("categoryFilter");

const addProductBtn =
  document.getElementById("addProductBtn");

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

const modalBackdrop =
  document.getElementById("modalBackdrop");

const modalTitle =
  document.getElementById("modalTitle");

const closeModalBtn =
  document.getElementById("closeModalBtn");

const cancelBtn =
  document.getElementById("cancelBtn");

const productForm =
  document.getElementById("productForm");

const saveBtn =
  document.getElementById("saveBtn");

const editProductId =
  document.getElementById("editProductId");

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

let adminUser = null;


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


      const snapshot =
        await getDoc(
          userRef
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


      adminUser =
        user;


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

        const nameA =
          String(
            a.name || ""
          ).toLowerCase();

        const nameB =
          String(
            b.name || ""
          ).toLowerCase();

        return nameA.localeCompare(
          nameB
        );

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


  const out =
    allProducts.filter(
      product =>
        Number(
          product.currentStock || 0
        ) <= 0
    ).length;


  const low =
    allProducts.filter(
      product => {

        const stock =
          Number(
            product.currentStock || 0
          );

        const minimum =
          Number(
            product.minStock ?? 2
          );

        return (
          stock > 0 &&
          stock <= minimum
        );

      }
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
    categoryFilter.value;


  const filtered =
    allProducts.filter(
      product => {

        const searchable = [

          product.name,

          product.brand,

          product.model,

          product.sku,

          product.category,

          product.supplier

        ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();


        const searchMatch =
          !search ||
          searchable.includes(
            search
          );


        const categoryMatch =
          !category ||
          String(
            product.category ||
            ""
          ).toUpperCase() ===
          category;


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
   PRODUCT CARD
===================================================== */

function renderProductCard(
  product
) {

  const active =
    product.active !== false;


  const stock =
    Number(
      product.currentStock || 0
    );


  const minimum =
    Number(
      product.minStock ?? 2
    );


  let stockClass =
    "stock-normal";


  let stockText =
    `${stock} units`;


  if (
    stock <= 0
  ) {

    stockClass =
      "stock-out";

    stockText =
      "Out of Stock";

  }
  else if (
    stock <= minimum
  ) {

    stockClass =
      "stock-low";

    stockText =
      `${stock} units • Low`;

  }


  const purchase =
    Number(
      product.purchaseCost || 0
    );


  const selling =
    Number(
      product.sellingPrice || 0
    );


  const margin =
    selling - purchase;


  return `

    <div class="product-card">

      <div class="product-top">

        <div>

          <h3 class="product-name">
            ${escapeHtml(
              product.name ||
              "Unnamed Product"
            )}
          </h3>

          <div class="product-meta">

            ${escapeHtml(
              product.brand ||
              "No Brand"
            )}

            ${
              product.model
                ? " • " +
                  escapeHtml(
                    product.model
                  )
                : ""
            }

            ${
              product.sku
                ? " • SKU: " +
                  escapeHtml(
                    product.sku
                  )
                : ""
            }

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
            📦
          </span>

          <span>
            ${escapeHtml(
              formatCategory(
                product.category
              )
            )}
          </span>

        </div>


        <div class="info-row">

          <span class="info-icon">
            📊
          </span>

          <span class="${stockClass}">
            ${escapeHtml(
              stockText
            )}
          </span>

        </div>


        <div class="info-row">

          <span class="info-icon">
            🏭
          </span>

          <span>
            ${escapeHtml(
              product.supplier ||
              "Supplier not added"
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
              purchase
            )}
          </div>

        </div>


        <div class="price-box">

          <div class="price-label">
            Selling
          </div>

          <div class="price-value">
            ₹${formatMoney(
              selling
            )}
          </div>

        </div>


        <div class="price-box">

          <div class="price-label">
            Margin
          </div>

          <div class="price-value">
            ₹${formatMoney(
              margin
            )}
          </div>

        </div>

      </div>


      <div class="divider"></div>


      <div class="actions">

        <button
          type="button"
          class="action edit-btn"
          data-edit-product="${product.id}"
        >
          Edit
        </button>


        <button
          type="button"
          class="action toggle-btn"
          data-toggle-product="${product.id}"
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
   ADD PRODUCT
===================================================== */

addProductBtn.addEventListener(
  "click",
  openAddModal
);


function openAddModal() {

  hideMessages();


  productForm.reset();


  editProductId.value =
    "";


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


  productName.focus();

}


/* =====================================================
   EDIT PRODUCT
===================================================== */

function openEditModal(
  productId
) {

  hideMessages();


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


  editProductId.value =
    product.id;


  productName.value =
    product.name || "";


  productCategory.value =
    product.category || "";


  brand.value =
    product.brand || "";


  model.value =
    product.model || "";


  sku.value =
    product.sku || "";


  purchaseCost.value =
    product.purchaseCost ?? 0;


  sellingPrice.value =
    product.sellingPrice ?? 0;


  marginType.value =
    product.marginType ||
    "PERCENTAGE";


  marginValue.value =
    product.marginValue ?? 0;


  retailerShare.value =
    product.retailerShare ?? 0;


  currentStock.value =
    product.currentStock ?? 0;


  minStock.value =
    product.minStock ?? 2;


  supplier.value =
    product.supplier || "";


  warrantyDays.value =
    product.warrantyDays ?? 0;


  modalTitle.textContent =
    "Edit Product";


  saveBtn.textContent =
    "Save Changes";


  modalBackdrop.classList.add(
    "show"
  );

}


/* =====================================================
   CLOSE MODAL
===================================================== */

function closeModal() {

  modalBackdrop.classList.remove(
    "show"
  );

  productForm.reset();

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
   SAVE PRODUCT
===================================================== */

productForm.addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    hideMessages();


    if (!adminUser) {

      showError(
        "Admin session મળી નથી."
      );

      return;

    }


    const productId =
      editProductId.value.trim();


    const data = {

      name:
        productName.value.trim(),

      category:
        productCategory.value,

      brand:
        brand.value.trim(),

      model:
        model.value.trim(),

      sku:
        sku.value.trim(),

      purchaseCost:
        Number(
          purchaseCost.value || 0
        ),

      sellingPrice:
        Number(
          sellingPrice.value || 0
        ),

      marginType:
        marginType.value,

      marginValue:
        Number(
          marginValue.value || 0
        ),

      retailerShare:
        Number(
          retailerShare.value || 0
        ),

      currentStock:
        Number(
          currentStock.value || 0
        ),

      minStock:
        Number(
          minStock.value || 0
        ),

      supplier:
        supplier.value.trim(),

      warrantyDays:
        Number(
          warrantyDays.value || 0
        )

    };


    if (!data.name) {

      showError(
        "Product name દાખલ કરો."
      );

      return;

    }


    if (!data.category) {

      showError(
        "Category select કરો."
      );

      return;

    }


    if (
      data.purchaseCost < 0 ||
      data.sellingPrice < 0
    ) {

      showError(
        "Price negative ન હોઈ શકે."
      );

      return;

    }


    saveBtn.disabled =
      true;


    saveBtn.textContent =
      productId
        ? "Saving..."
        : "Creating...";


    try {

      if (productId) {

        await updateProduct(
          productId,
          data
        );

      }
      else {

        await createProduct(
          data
        );

      }

    }
    catch (error) {

      showError(
        getErrorMessage(error)
      );

    }
    finally {

      saveBtn.disabled =
        false;

      saveBtn.textContent =
        productId
          ? "Save Changes"
          : "Create Product";

    }

  }
);


/* =====================================================
   CREATE PRODUCT
===================================================== */

async function createProduct(
  data
) {

  const productRef =
    doc(
      collection(
        db,
        "products"
      )
    );


  await setDoc(

    productRef,

    {

      ...data,

      active:
        true,

      createdAt:
        serverTimestamp(),

      createdBy:
        adminUser.uid

    }

  );


  closeModal();


  await loadProducts();


  showSuccess(
    "Product created successfully."
  );

}


/* =====================================================
   UPDATE PRODUCT
===================================================== */

async function updateProduct(
  productId,
  data
) {

  await updateDoc(

    doc(
      db,
      "products",
      productId
    ),

    {

      ...data,

      updatedAt:
        serverTimestamp(),

      updatedBy:
        adminUser.uid

    }

  );


  closeModal();


  await loadProducts();


  showSuccess(
    "Product updated successfully."
  );

}


/* =====================================================
   ACTIVATE / DEACTIVATE
===================================================== */

async function toggleProduct(
  productId
) {

  hideMessages();


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


  const newStatus =
    product.active === false;


  const action =
    newStatus
      ? "activate"
      : "deactivate";


  if (
    !confirm(
      `શું તમે આ productને ${action} કરવા માંગો છો?`
    )
  ) {

    return;

  }


  try {

    await updateDoc(

      doc(
        db,
        "products",
        productId
      ),

      {

        active:
          newStatus,

        updatedAt:
          serverTimestamp(),

        updatedBy:
          adminUser.uid

      }

    );


    await loadProducts();


    showSuccess(

      newStatus
        ? "Product activated successfully."
        : "Product deactivated successfully."

    );

  }
  catch (error) {

    showError(
      getErrorMessage(error)
    );

  }

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
        getErrorMessage(error)
      );

    }

  }
);


/* =====================================================
   HELPERS
===================================================== */

function formatCategory(
  category
) {

  const value =
    String(
      category || "OTHER"
    );


  const map = {

    TV:
      "TV",

    DTH:
      "DTH",

    ACCESSORIES:
      "Accessories",

    PARTS:
      "Repair Parts",

    INSTALLATION:
      "Installation",

    OTHER:
      "Other"

  };


  return (
    map[value] ||
    value
  );

}


function formatMoney(
  value
) {

  return Number(
    value || 0
  ).toLocaleString(
    "en-IN",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }
  );

}


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


function getErrorMessage(
  error
) {

  console.error(
    "REPARO ERROR:",
    error
  );


  switch (
    error?.code
  ) {

    case "permission-denied":

      return "Firestore permission denied. Admin rules check કરો.";

    case "unavailable":

      return "Firebase temporarily unavailable. Internet connection check કરો.";

    case "failed-precondition":

      return "Firestore operation failed due to a database condition.";

    default:

      return (
        error?.message ||
        "Operation failed."
      );

  }

}


function hideMessages() {

  errorBox.style.display =
    "none";

  successBox.style.display =
    "none";

  errorBox.textContent =
    "";

  successBox.textContent =
    "";

}


function showError(
  message
) {

  successBox.style.display =
    "none";

  errorBox.textContent =
    message;

  errorBox.style.display =
    "block";

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