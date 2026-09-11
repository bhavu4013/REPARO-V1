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


const productList =
  document.getElementById("productList");

const loading =
  document.getElementById("loading");

const searchInput =
  document.getElementById("searchInput");

const categoryFilter =
  document.getElementById("categoryFilter");

const addProductBtn =
  document.getElementById("addProductBtn");

const productModal =
  document.getElementById("productModal");

const modalTitle =
  document.getElementById("modalTitle");

const productForm =
  document.getElementById("productForm");

const closeModalBtn =
  document.getElementById("closeModalBtn");

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

const warranty =
  document.getElementById("warranty");

const currentStock =
  document.getElementById("currentStock");

const minStock =
  document.getElementById("minStock");

const supplier =
  document.getElementById("supplier");

const ownership =
  document.getElementById("ownership");

const active =
  document.getElementById("active");


let products = [];


// --------------------------------------------------
// AUTH
// --------------------------------------------------

onAuthStateChanged(auth, async (user) => {

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


    await loadProducts();


  } catch (error) {

    console.error(error);

    loading.textContent =
      "Unable to load Products.";

  }

});


// --------------------------------------------------
// LOAD PRODUCTS
// --------------------------------------------------

async function loadProducts() {

  loading.style.display = "block";

  try {

    const q =
      query(
        collection(db, "products"),
        orderBy("createdAt", "desc")
      );


    const snapshot =
      await getDocs(q);


    products =
      snapshot.docs.map(item => ({

        id: item.id,

        ...item.data()

      }));


  } catch (error) {

    console.warn(
      "Ordered product query failed.",
      error
    );


    const snapshot =
      await getDocs(
        collection(db, "products")
      );


    products =
      snapshot.docs.map(item => ({

        id: item.id,

        ...item.data()

      }));

  }


  loading.style.display = "none";

  updateSummary();

  renderProducts();

}


// --------------------------------------------------
// SUMMARY
// --------------------------------------------------

function updateSummary() {

  const activeItems =
    products.filter(
      item => item.active !== false
    );


  const lowStock =
    products.filter(item => {

      const stock =
        Number(item.currentStock || 0);

      const minimum =
        Number(item.minStock || 0);

      return (
        stock > 0 &&
        stock <= minimum
      );

    });


  const outStock =
    products.filter(
      item =>
        Number(item.currentStock || 0) <= 0
    );


  document.getElementById(
    "totalProducts"
  ).textContent =
    products.length;


  document.getElementById(
    "activeProducts"
  ).textContent =
    activeItems.length;


  document.getElementById(
    "lowStockProducts"
  ).textContent =
    lowStock.length;


  document.getElementById(
    "outStockProducts"
  ).textContent =
    outStock.length;

}


// --------------------------------------------------
// RENDER
// --------------------------------------------------

function renderProducts() {

  const search =
    searchInput.value
      .trim()
      .toLowerCase();


  const category =
    categoryFilter.value;


  const filtered =
    products.filter(product => {

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


      return (

        (!search ||
          searchable.includes(search))

        &&

        (!category ||
          product.category === category)

      );

    });


  if (!filtered.length) {

    productList.innerHTML =
      `
        <div class="empty-state">
          No products found.
        </div>
      `;

    return;

  }


  productList.innerHTML =
    filtered
      .map(renderProduct)
      .join("");


  document
    .querySelectorAll("[data-edit-product]")
    .forEach(button => {

      button.onclick = () =>
        openEditProduct(
          button.dataset.editProduct
        );

    });


  document
    .querySelectorAll("[data-toggle-product]")
    .forEach(button => {

      button.onclick = () =>
        toggleProduct(
          button.dataset.toggleProduct
        );

    });

}


// --------------------------------------------------
// PRODUCT CARD
// --------------------------------------------------

function renderProduct(product) {

  const stock =
    Number(
      product.currentStock || 0
    );


  const minimum =
    Number(
      product.minStock || 0
    );


  let stockText =
    `${stock} pcs`;


  let stockClass =
    "";


  if (stock <= 0) {

    stockText =
      "OUT OF STOCK";

  } else if (stock <= minimum) {

    stockText =
      `${stock} pcs • LOW STOCK`;

  }


  const margin =
    calculateMargin(product);


  return `

    <article class="card">

      <div class="card-header">

        <div>

          <strong>
            ${escapeHtml(
              product.name || "-"
            )}
          </strong>

          <h3>
            ${escapeHtml(
              product.brand || ""
            )}
            ${escapeHtml(
              product.model || ""
            )}
          </h3>

          <small>
            SKU:
            ${escapeHtml(
              product.sku || "-"
            )}
          </small>

        </div>


        <span class="status-badge">
          ${escapeHtml(
            product.category || "-"
          )}
        </span>

      </div>


      <div class="card-details">

        <div>

          <small>Purchase Cost</small>

          <strong>
            ₹${formatMoney(
              product.purchaseCost
            )}
          </strong>

        </div>


        <div>

          <small>Selling Price</small>

          <strong>
            ₹${formatMoney(
              product.sellingPrice
            )}
          </strong>

        </div>


        <div>

          <small>Margin</small>

          <strong>
            ₹${formatMoney(margin)}
          </strong>

        </div>


        <div>

          <small>Stock</small>

          <strong>
            ${escapeHtml(stockText)}
          </strong>

        </div>

      </div>


      <div class="card-actions">

        <button
          data-edit-product="${product.id}"
          class="primary-btn">
          Edit
        </button>


        <button
          data-toggle-product="${product.id}">

          ${
            product.active === false
              ? "Activate"
              : "Deactivate"
          }

        </button>

      </div>

    </article>

  `;

}


// --------------------------------------------------
// ADD PRODUCT
// --------------------------------------------------

addProductBtn.onclick = () => {

  resetForm();

  modalTitle.textContent =
    "Add Product";

  productModal.classList.remove(
    "hidden"
  );

};


// --------------------------------------------------
// EDIT PRODUCT
// --------------------------------------------------

function openEditProduct(id) {

  const product =
    products.find(
      item => item.id === id
    );


  if (!product) return;


  editProductId.value =
    product.id;


  productName.value =
    product.name || "";


  productCategory.value =
    product.category ||
    "TV Repair Part";


  brand.value =
    product.brand || "";


  model.value =
    product.model || "";


  sku.value =
    product.sku || "";


  purchaseCost.value =
    product.purchaseCost || 0;


  sellingPrice.value =
    product.sellingPrice || 0;


  marginType.value =
    product.marginType ||
    "PERCENTAGE";


  marginValue.value =
    product.marginValue || 0;


  retailerShare.value =
    product.retailerShare || 0;


  warranty.value =
    product.warranty || "";


  currentStock.value =
    product.currentStock || 0;


  minStock.value =
    product.minStock || 0;


  supplier.value =
    product.supplier || "";


  ownership.value =
    product.ownership ||
    "REPARO";


  active.value =
    String(
      product.active !== false
    );


  modalTitle.textContent =
    "Edit Product";


  productModal.classList.remove(
    "hidden"
  );

}


// --------------------------------------------------
// SAVE
// --------------------------------------------------

productForm.addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    const id =
      editProductId.value;


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

      warranty:
        warranty.value.trim(),

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

      ownership:
        ownership.value,

      active:
        active.value === "true",

      updatedAt:
        serverTimestamp()

    };


    try {

      if (id) {

        await updateDoc(
          doc(
            db,
            "products",
            id
          ),
          data
        );


        alert(
          "Product updated successfully."
        );


      } else {

        await addDoc(
          collection(
            db,
            "products"
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
          "Product added successfully."
        );

      }


      closeModal();

      await loadProducts();


    } catch (error) {

      console.error(error);

      alert(
        "Unable to save Product.\n\n" +
        error.message
      );

    }

  }
);


// --------------------------------------------------
// TOGGLE ACTIVE
// --------------------------------------------------

async function toggleProduct(id) {

  const product =
    products.find(
      item => item.id === id
    );


  if (!product) return;


  const newState =
    product.active === false;


  try {

    await updateDoc(
      doc(
        db,
        "products",
        id
      ),
      {

        active:
          newState,

        updatedAt:
          serverTimestamp()

      }
    );


    await loadProducts();


  } catch (error) {

    console.error(error);

    alert(
      "Unable to change product status."
    );

  }

}


// --------------------------------------------------
// CLOSE MODAL
// --------------------------------------------------

closeModalBtn.onclick =
  closeModal;


productModal.addEventListener(
  "click",
  event => {

    if (
      event.target ===
      productModal
    ) {

      closeModal();

    }

  }
);


function closeModal() {

  productModal.classList.add(
    "hidden"
  );

}


// --------------------------------------------------
// RESET
// --------------------------------------------------

function resetForm() {

  productForm.reset();

  editProductId.value = "";

  marginType.value =
    "PERCENTAGE";

  marginValue.value =
    "0";

  retailerShare.value =
    "0";

  currentStock.value =
    "0";

  minStock.value =
    "1";

  ownership.value =
    "REPARO";

  active.value =
    "true";

}


// --------------------------------------------------
// FILTER
// --------------------------------------------------

searchInput.addEventListener(
  "input",
  renderProducts
);


categoryFilter.addEventListener(
  "change",
  renderProducts
);


// --------------------------------------------------
// MARGIN
// --------------------------------------------------

function calculateMargin(product) {

  const purchase =
    Number(
      product.purchaseCost || 0
    );


  const selling =
    Number(
      product.sellingPrice || 0
    );


  if (
    product.marginType ===
    "FIXED"
  ) {

    return Number(
      product.marginValue || 0
    );

  }


  if (
    product.marginType ===
    "PERCENTAGE"
  ) {

    return (
      selling *
      Number(
        product.marginValue || 0
      ) /
      100
    );

  }


  return selling - purchase;

}


// --------------------------------------------------
// MONEY
// --------------------------------------------------

function formatMoney(value) {

  return Number(
    value || 0
  ).toLocaleString(
    "en-IN",
    {
      minimumFractionDigits:2,
      maximumFractionDigits:2
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