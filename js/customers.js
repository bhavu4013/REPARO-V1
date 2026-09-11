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
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


let currentUser = null;
let customers = [];
let retailers = [];
let jobs = [];
let editingCustomerId = null;


// =====================================================
// ELEMENTS
// =====================================================

const loading =
  document.getElementById("loading");

const customerList =
  document.getElementById("customerList");

const modal =
  document.getElementById("customerModal");

const detailModal =
  document.getElementById("detailModal");


// =====================================================
// AUTH
// =====================================================

onAuthStateChanged(
  auth,
  async user => {

    if (!user) {

      location.href =
        "../index.html";

      return;

    }


    try {

      const profileSnap =
        await getDoc(
          doc(
            db,
            "users",
            user.uid
          )
        );


      if (
        !profileSnap.exists()
        ||
        profileSnap.data().role !== "admin"
      ) {

        showError(
          "Admin access required."
        );

        return;

      }


      currentUser = user;


      await loadData();

    } catch (error) {

      console.error(error);

      showError(
        "Unable to load customer data."
      );

    }

  }
);


// =====================================================
// LOAD DATA
// =====================================================

async function loadData() {

  const [
    customerSnap,
    retailerSnap,
    jobsSnap
  ] = await Promise.all([

    getDocs(
      collection(
        db,
        "customers"
      )
    ),

    getDocs(
      query(
        collection(
          db,
          "users"
        ),
        where(
          "role",
          "==",
          "retailer"
        )
      )
    ),

    getDocs(
      collection(
        db,
        "jobs"
      )
    )

  ]);


  customers = [];

  customerSnap.forEach(item => {

    customers.push({
      id: item.id,
      ...item.data()
    });

  });


  retailers = [];

  retailerSnap.forEach(item => {

    retailers.push({
      id: item.id,
      ...item.data()
    });

  });


  jobs = [];

  jobsSnap.forEach(item => {

    jobs.push({
      id: item.id,
      ...item.data()
    });

  });


  customers.sort(
    (a, b) =>
      String(a.name || "")
        .localeCompare(
          String(b.name || "")
        )
  );


  populateRetailerFilters();

  render();

}


// =====================================================
// RETAILER FILTERS
// =====================================================

function populateRetailerFilters() {

  const formSelect =
    document.getElementById(
      "retailerId"
    );

  const filter =
    document.getElementById(
      "retailerFilter"
    );


  const options =
    retailers
      .sort(
        (a,b) =>
          String(a.name || "")
            .localeCompare(
              String(b.name || "")
            )
      )
      .map(
        retailer => `
          <option value="${escapeHtml(retailer.id)}">
            ${escapeHtml(
              retailer.name ||
              retailer.businessName ||
              retailer.email ||
              retailer.id
            )}
          </option>
        `
      )
      .join("");


  formSelect.innerHTML =
    `
      <option value="">
        Select retailer
      </option>
      ${options}
    `;


  filter.innerHTML =
    `
      <option value="ALL">
        All Retailers
      </option>
      ${options}
    `;

}


// =====================================================
// RENDER
// =====================================================

function render() {

  const search =
    document.getElementById(
      "searchInput"
    )
      .value
      .trim()
      .toLowerCase();


  const status =
    document.getElementById(
      "statusFilter"
    ).value;


  const retailerId =
    document.getElementById(
      "retailerFilter"
    ).value;


  const filtered =
    customers.filter(
      customer => {

        const searchable = [
          customer.name,
          customer.mobile,
          customer.email,
          customer.city,
          customer.id
        ]
          .join(" ")
          .toLowerCase();


        const searchMatch =
          !search ||
          searchable.includes(search);


        const active =
          customer.active !== false;


        const statusMatch =
          status === "ALL"
          ||
          (
            status === "ACTIVE"
            && active
          )
          ||
          (
            status === "INACTIVE"
            && !active
          );


        const retailerMatch =
          retailerId === "ALL"
          ||
          customer.originalRetailerId ===
            retailerId;


        return (
          searchMatch
          &&
          statusMatch
          &&
          retailerMatch
        );

      }
    );


  updateSummary();


  if (!filtered.length) {

    customerList.style.display =
      "block";

    customerList.innerHTML =
      `
        <div class="empty">
          No customers found.
        </div>
      `;

    loading.style.display =
      "none";

    return;

  }


  customerList.innerHTML =
    filtered
      .map(
        customer =>
          customerCard(
            customer
          )
      )
      .join("");


  loading.style.display =
    "none";

  customerList.style.display =
    "block";


  document
    .querySelectorAll(
      "[data-customer-id]"
    )
    .forEach(
      element => {

        element.addEventListener(
          "click",
          () => {

            const id =
              element.dataset.customerId;

            showDetails(id);

          }
        );

      }
    );

}


// =====================================================
// CUSTOMER CARD
// =====================================================

function customerCard(customer) {

  const active =
    customer.active !== false;


  const retailer =
    findRetailer(
      customer.originalRetailerId
    );


  const customerJobs =
    jobs.filter(
      job =>
        job.customerId ===
        customer.id
    );


  return `
    <div
      class="customer-card"
      data-customer-id="${escapeHtml(customer.id)}">

      <div class="customer-top">

        <div>

          <div class="customer-name">
            ${escapeHtml(
              customer.name ||
              "Unnamed Customer"
            )}
          </div>

          <div class="customer-mobile">
            ${escapeHtml(
              customer.mobile ||
              "No mobile"
            )}
          </div>

        </div>


        <span class="status ${
          active
            ? "active"
            : "inactive"
        }">

          ${
            active
              ? "ACTIVE"
              : "INACTIVE"
          }

        </span>

      </div>


      <div class="customer-info">

        <div class="info">

          <span>
            PROTECTED RETAILER
          </span>

          <strong>
            ${escapeHtml(
              retailer?.name ||
              retailer?.businessName ||
              "Not linked"
            )}
          </strong>

        </div>


        <div class="info">

          <span>
            SERVICE JOBS
          </span>

          <strong>
            ${customerJobs.length}
          </strong>

        </div>


        <div class="info">

          <span>
            EMAIL
          </span>

          <strong>
            ${escapeHtml(
              customer.email ||
              "Not added"
            )}
          </strong>

        </div>


        <div class="info">

          <span>
            CUSTOMER ID
          </span>

          <strong>
            ${escapeHtml(
              customer.id
            )}
          </strong>

        </div>

      </div>

    </div>
  `;

}


// =====================================================
// SUMMARY
// =====================================================

function updateSummary() {

  const total =
    customers.length;


  const active =
    customers.filter(
      item =>
        item.active !== false
    ).length;


  const protectedCount =
    customers.filter(
      item =>
        !!item.originalRetailerId
    ).length;


  document.getElementById(
    "totalCount"
  ).textContent =
    total;


  document.getElementById(
    "activeCount"
  ).textContent =
    active;


  document.getElementById(
    "protectedCount"
  ).textContent =
    protectedCount;

}


// =====================================================
// ADD CUSTOMER
// =====================================================

document.getElementById(
  "addBtn"
).addEventListener(
  "click",
  () => {

    openAddModal();

  }
);


// =====================================================
// OPEN ADD
// =====================================================

function openAddModal() {

  editingCustomerId =
    null;


  document.getElementById(
    "modalTitle"
  ).textContent =
    "Add Customer";


  document.getElementById(
    "customerForm"
  ).reset();


  document.getElementById(
    "active"
  ).value =
    "true";


  document.getElementById(
    "authUserId"
  ).value =
    "";


  modal.classList.add(
    "show"
  );

}


// =====================================================
// CLOSE
// =====================================================

document.getElementById(
  "closeModal"
).addEventListener(
  "click",
  closeModal
);


modal.addEventListener(
  "click",
  event => {

    if (
      event.target === modal
    ) {

      closeModal();

    }

  }
);


function closeModal() {

  modal.classList.remove(
    "show"
  );

}


// =====================================================
// SAVE CUSTOMER
// =====================================================

document.getElementById(
  "customerForm"
).addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    const saveBtn =
      document.getElementById(
        "saveBtn"
      );


    const name =
      document.getElementById(
        "name"
      ).value.trim();


    const mobile =
      document.getElementById(
        "mobile"
      ).value.trim();


    const email =
      document.getElementById(
        "email"
      ).value.trim();


    const retailerId =
      document.getElementById(
        "retailerId"
      ).value;


    const active =
      document.getElementById(
        "active"
      ).value === "true";


    const address =
      document.getElementById(
        "address"
      ).value.trim();


    const city =
      document.getElementById(
        "city"
      ).value.trim();


    const pincode =
      document.getElementById(
        "pincode"
      ).value.trim();


    const authUserId =
      document.getElementById(
        "authUserId"
      ).value.trim();


    if (!name || !mobile) {

      alert(
        "Name and mobile are required."
      );

      return;

    }


    if (!retailerId) {

      alert(
        "Please select the original retailer."
      );

      return;

    }


    if (
      !/^\d{10}$/.test(
        mobile.replace(/\D/g,"")
      )
    ) {

      alert(
        "Please enter a valid 10 digit mobile number."
      );

      return;

    }


    const cleanMobile =
      mobile.replace(
        /\D/g,
        ""
      );


    saveBtn.disabled =
      true;

    saveBtn.textContent =
      "Saving...";


    try {

      const data = {

        name,

        mobile:
          cleanMobile,

        email,

        originalRetailerId:
          retailerId,

        address,

        city,

        pincode,

        active,

        updatedAt:
          serverTimestamp()

      };


      if (authUserId) {

        data.authUserId =
          authUserId;

      }


      if (
        editingCustomerId
      ) {

        await updateDoc(
          doc(
            db,
            "customers",
            editingCustomerId
          ),
          data
        );


        alert(
          "Customer updated successfully."
        );

      } else {

        data.createdAt =
          serverTimestamp();


        await addDoc(
          collection(
            db,
            "customers"
          ),
          data
        );


        alert(
          "Customer created successfully."
        );

      }


      closeModal();

      await loadData();

    } catch (error) {

      console.error(error);

      alert(
        "Unable to save customer.\n\n" +
        error.message
      );

    } finally {

      saveBtn.disabled =
        false;

      saveBtn.textContent =
        "Save Customer";

    }

  }
);


// =====================================================
// CUSTOMER DETAILS
// =====================================================

function showDetails(id) {

  const customer =
    customers.find(
      item =>
        item.id === id
    );


  if (!customer)
    return;


  const retailer =
    findRetailer(
      customer.originalRetailerId
    );


  const customerJobs =
    jobs.filter(
      job =>
        job.customerId === id
    );


  const active =
    customer.active !== false;


  document.getElementById(
    "detailContent"
  ).innerHTML =
    `

      <div class="detail-section">

        <h3>
          Customer
        </h3>

        <div class="detail-row">
          <span>Name</span>
          <strong>
            ${escapeHtml(
              customer.name || "-"
            )}
          </strong>
        </div>

        <div class="detail-row">
          <span>Mobile</span>
          <strong>
            ${escapeHtml(
              customer.mobile || "-"
            )}
          </strong>
        </div>

        <div class="detail-row">
          <span>Email</span>
          <strong>
            ${escapeHtml(
              customer.email || "-"
            )}
          </strong>
        </div>

        <div class="detail-row">
          <span>Status</span>
          <strong>
            ${
              active
                ? "ACTIVE"
                : "INACTIVE"
            }
          </strong>
        </div>

        <div class="detail-row">
          <span>Customer ID</span>
          <strong>
            ${escapeHtml(id)}
          </strong>
        </div>

      </div>


      <div class="detail-section">

        <h3>
          Protected Relationship
        </h3>

        <div class="detail-row">
          <span>Original Retailer</span>
          <strong>
            ${escapeHtml(
              retailer?.name ||
              retailer?.businessName ||
              "Not linked"
            )}
          </strong>
        </div>

        <div class="detail-row">
          <span>Retailer ID</span>
          <strong>
            ${escapeHtml(
              customer.originalRetailerId ||
              "-"
            )}
          </strong>
        </div>

      </div>


      <div class="detail-section">

        <h3>
          Address
        </h3>

        <div class="detail-row">
          <span>Address</span>
          <strong>
            ${escapeHtml(
              customer.address || "-"
            )}
          </strong>
        </div>

        <div class="detail-row">
          <span>City</span>
          <strong>
            ${escapeHtml(
              customer.city || "-"
            )}
          </strong>
        </div>

        <div class="detail-row">
          <span>Pincode</span>
          <strong>
            ${escapeHtml(
              customer.pincode || "-"
            )}
          </strong>
        </div>

      </div>


      <div class="detail-section">

        <h3>
          Account Linking
        </h3>

        <div class="detail-row">
          <span>Firebase Auth UID</span>
          <strong>
            ${escapeHtml(
              customer.authUserId ||
              "Not linked"
            )}
          </strong>
        </div>

      </div>


      <div class="detail-section">

        <h3>
          Service History
        </h3>

        <div class="detail-row">
          <span>Total Jobs</span>
          <strong>
            ${customerJobs.length}
          </strong>
        </div>

        <div class="detail-row">
          <span>Completed</span>
          <strong>
            ${
              customerJobs.filter(
                job =>
                  String(
                    job.status || ""
                  ).toUpperCase()
                  === "COMPLETED"
              ).length
            }
          </strong>
        </div>

        <div class="detail-row">
          <span>Active</span>
          <strong>
            ${
              customerJobs.filter(
                job =>
                  String(
                    job.status || ""
                  ).toUpperCase()
                  !== "COMPLETED"
                  &&
                  String(
                    job.status || ""
                  ).toUpperCase()
                  !== "CANCELLED"
              ).length
            }
          </strong>
        </div>

      </div>


      <button
        id="editCustomerBtn"
        class="save-btn">

        Edit Customer

      </button>

    `;


  detailModal.classList.add(
    "show"
  );


  document.getElementById(
    "editCustomerBtn"
  ).onclick =
    () => {

      closeDetailModal();

      openEditModal(
        customer
      );

    };

}


// =====================================================
// EDIT CUSTOMER
// =====================================================

function openEditModal(customer) {

  editingCustomerId =
    customer.id;


  document.getElementById(
    "modalTitle"
  ).textContent =
    "Edit Customer";


  document.getElementById(
    "name"
  ).value =
    customer.name || "";


  document.getElementById(
    "mobile"
  ).value =
    customer.mobile || "";


  document.getElementById(
    "email"
  ).value =
    customer.email || "";


  document.getElementById(
    "retailerId"
  ).value =
    customer.originalRetailerId || "";


  document.getElementById(
    "active"
  ).value =
    customer.active === false
      ? "false"
      : "true";


  document.getElementById(
    "address"
  ).value =
    customer.address || "";


  document.getElementById(
    "city"
  ).value =
    customer.city || "";


  document.getElementById(
    "pincode"
  ).value =
    customer.pincode || "";


  document.getElementById(
    "authUserId"
  ).value =
    customer.authUserId || "";


  modal.classList.add(
    "show"
  );

}


// =====================================================
// DETAIL CLOSE
// =====================================================

document.getElementById(
  "closeDetail"
).addEventListener(
  "click",
  closeDetailModal
);


detailModal.addEventListener(
  "click",
  event => {

    if (
      event.target ===
      detailModal
    ) {

      closeDetailModal();

    }

  }
);


function closeDetailModal() {

  detailModal.classList.remove(
    "show"
  );

}


// =====================================================
// FILTER EVENTS
// =====================================================

document.getElementById(
  "searchInput"
).addEventListener(
  "input",
  render
);


document.getElementById(
  "statusFilter"
).addEventListener(
  "change",
  render
);


document.getElementById(
  "retailerFilter"
).addEventListener(
  "change",
  render
);


// =====================================================
// HELPERS
// =====================================================

function findRetailer(id) {

  if (!id)
    return null;


  return retailers.find(
    retailer =>
      retailer.id === id
  ) || null;

}


function escapeHtml(value) {

  return String(
    value ?? ""
  )
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");

}


function showError(message) {

  loading.textContent =
    message;

  loading.style.display =
    "block";

  customerList.style.display =
    "none";

}