import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


let currentUser = null;

let customers = [];
let jobs = [];


// =====================================================
// AUTH
// =====================================================

onAuthStateChanged(auth, async user => {

  if (!user) {

    location.href =
      "../index.html";

    return;

  }


  try {

    const profile =
      await getDoc(
        doc(
          db,
          "users",
          user.uid
        )
      );


    if (
      !profile.exists() ||
      profile.data().role !== "retailer"
    ) {

      location.href =
        "../index.html";

      return;

    }


    currentUser = user;


    await loadCustomers();

    await loadJobs();

    render();

  } catch (error) {

    console.error(error);

    document.getElementById(
      "customerList"
    ).innerHTML =
      `
      <div class="empty">
        Unable to load protected customers.
      </div>
      `;

  }

});


// =====================================================
// LOAD CUSTOMERS
// =====================================================

async function loadCustomers() {

  customers = [];


  const snap =
    await getDocs(
      query(
        collection(
          db,
          "customers"
        ),
        where(
          "originalRetailerId",
          "==",
          currentUser.uid
        )
      )
    );


  snap.forEach(item => {

    customers.push({
      id: item.id,
      ...item.data()
    });

  });

}


// =====================================================
// LOAD JOBS
// =====================================================

async function loadJobs() {

  jobs = [];


  try {

    const snap =
      await getDocs(
        query(
          collection(
            db,
            "jobs"
          ),
          where(
            "retailerId",
            "==",
            currentUser.uid
          )
        )
      );


    snap.forEach(item => {

      jobs.push({
        id: item.id,
        ...item.data()
      });

    });

  } catch (error) {

    console.error(
      "Job history error:",
      error
    );

  }

}


// =====================================================
// RENDER
// =====================================================

function render() {

  renderSummary();

  renderCustomers();

}


// =====================================================
// SUMMARY
// =====================================================

function renderSummary() {

  const customerIds =
    new Set(
      jobs
        .map(
          job =>
            job.customerId
        )
        .filter(Boolean)
    );


  const active =
    jobs.filter(job => {

      const status =
        normalize(
          job.status
        );

      return ![
        "COMPLETED",
        "CANCELLED"
      ].includes(status);

    }).length;


  const completed =
    jobs.filter(job =>
      normalize(
        job.status
      ) === "COMPLETED"
    ).length;


  document.getElementById(
    "totalCustomers"
  ).textContent =
    customers.length;


  document.getElementById(
    "serviceCustomers"
  ).textContent =
    customerIds.size;


  document.getElementById(
    "activeCustomerJobs"
  ).textContent =
    active;


  document.getElementById(
    "completedCustomerJobs"
  ).textContent =
    completed;

}


// =====================================================
// CUSTOMER LIST
// =====================================================

function renderCustomers() {

  const container =
    document.getElementById(
      "customerList"
    );


  const search =
    document.getElementById(
      "searchInput"
    ).value
      .trim()
      .toLowerCase();


  const filtered =
    customers.filter(customer => {

      const text =
        [
          customer.name,
          customer.customerName,
          customer.mobile,
          customer.phone,
          customer.address,
          customer.serialNumber,
          customer.deviceBrand,
          customer.deviceModel
        ]
          .join(" ")
          .toLowerCase();


      return (
        !search ||
        text.includes(search)
      );

    });


  if (!filtered.length) {

    container.innerHTML =
      `
      <div class="empty">
        ${
          search
            ? "No matching customer found."
            : "No protected customers yet."
        }
      </div>
      `;

    return;

  }


  container.innerHTML =
    filtered
      .map(
        customer =>
          customerCard(
            customer
          )
      )
      .join("");

}


// =====================================================
// CUSTOMER CARD
// =====================================================

function customerCard(customer) {

  const name =
    customer.name ||
    customer.customerName ||
    "Customer";


  const mobile =
    customer.mobile ||
    customer.phone ||
    "-";


  const address =
    customer.address ||
    "-";


  const brand =
    customer.deviceBrand ||
    customer.brand ||
    "-";


  const model =
    customer.deviceModel ||
    customer.model ||
    "-";


  const serial =
    customer.serialNumber ||
    customer.serial ||
    "-";


  const customerJobs =
    jobs.filter(job =>
      job.customerId ===
      customer.id
    );


  return `
    <div class="customer-card">

      <div class="customer-top">

        <div>

          <div class="customer-name">
            ${escapeHtml(name)}
          </div>

          <div class="customer-mobile">
            ${escapeHtml(mobile)}
          </div>

        </div>

        <span class="protected-label">
          PROTECTED
        </span>

      </div>


      <div class="customer-grid">

        <div class="info-box">
          <span>Device Brand</span>
          <strong>
            ${escapeHtml(brand)}
          </strong>
        </div>

        <div class="info-box">
          <span>Model</span>
          <strong>
            ${escapeHtml(model)}
          </strong>
        </div>

        <div class="info-box">
          <span>Serial Number</span>
          <strong>
            ${escapeHtml(serial)}
          </strong>
        </div>

        <div class="info-box">
          <span>Service Jobs</span>
          <strong>
            ${customerJobs.length}
          </strong>
        </div>

        <div class="info-box full">
          <span>Address</span>
          <strong>
            ${escapeHtml(address)}
          </strong>
        </div>

      </div>


      <div class="customer-actions">

        <button
          class="customer-btn btn-blue"
          onclick="viewCustomer('${customer.id}')">
          View Details
        </button>

        <button
          class="customer-btn btn-light"
          onclick="newCustomerService('${customer.id}')">
          New Service
        </button>

      </div>

    </div>
  `;

}


// =====================================================
// VIEW CUSTOMER
// =====================================================

window.viewCustomer =
  function(customerId) {

    const customer =
      customers.find(
        item =>
          item.id ===
          customerId
      );


    if (!customer)
      return;


    const name =
      customer.name ||
      customer.customerName ||
      "Customer";


    document.getElementById(
      "modalCustomerName"
    ).textContent =
      name;


    const customerJobs =
      jobs.filter(
        job =>
          job.customerId ===
          customerId
      );


    const details =
      document.getElementById(
        "modalCustomerDetails"
      );


    details.innerHTML = `

      <div class="customer-grid">

        <div class="info-box">
          <span>Mobile</span>
          <strong>
            ${escapeHtml(
              customer.mobile ||
              customer.phone ||
              "-"
            )}
          </strong>
        </div>

        <div class="info-box">
          <span>Customer ID</span>
          <strong>
            ${escapeHtml(
              customer.id
            )}
          </strong>
        </div>

        <div class="info-box">
          <span>Brand</span>
          <strong>
            ${escapeHtml(
              customer.deviceBrand ||
              customer.brand ||
              "-"
            )}
          </strong>
        </div>

        <div class="info-box">
          <span>Model</span>
          <strong>
            ${escapeHtml(
              customer.deviceModel ||
              customer.model ||
              "-"
            )}
          </strong>
        </div>

        <div class="info-box">
          <span>Screen Size</span>
          <strong>
            ${escapeHtml(
              customer.screenSize ||
              "-"
            )}
          </strong>
        </div>

        <div class="info-box">
          <span>Serial Number</span>
          <strong>
            ${escapeHtml(
              customer.serialNumber ||
              customer.serial ||
              "-"
            )}
          </strong>
        </div>

        <div class="info-box full">
          <span>Address</span>
          <strong>
            ${escapeHtml(
              customer.address ||
              "-"
            )}
          </strong>
        </div>

      </div>


      <h3 style="margin:20px 0 10px;">
        Service History
      </h3>

      ${
        customerJobs.length
          ? customerJobs
              .sort(
                (a,b) =>
                  dateValue(b.createdAt) -
                  dateValue(a.createdAt)
              )
              .map(job => `

                <div class="history-item">

                  <strong>
                    ${escapeHtml(
                      job.jobNumber ||
                      job.jobId ||
                      job.id
                    )}
                  </strong>

                  <span>
                    ${escapeHtml(
                      job.serviceType ||
                      "Service"
                    )}
                    •
                    ${escapeHtml(
                      job.status ||
                      "-"
                    )}
                  </span>

                  <span>
                    ${escapeHtml(
                      job.deviceBrand ||
                      ""
                    )}
                    ${escapeHtml(
                      job.deviceModel ||
                      ""
                    )}
                  </span>

                </div>

              `)
              .join("")
          : `
            <div class="empty">
              No service history found.
            </div>
          `
      }


      <div
        style="
          margin-top:15px;
          padding:12px;
          background:#FFF4CC;
          border-radius:13px;
          color:#705600;
          font-size:11px;
          line-height:1.5;
        "
      >
        <strong>
          Customer Protection
        </strong>
        <br>
        This customer is permanently linked
        to your retailer account.
        Transfer can only be performed
        by REPARO Admin.
      </div>

    `;


    document.getElementById(
      "customerModal"
    ).classList.add("show");

  };


// =====================================================
// CLOSE MODAL
// =====================================================

window.closeCustomer =
  function() {

    document.getElementById(
      "customerModal"
    ).classList.remove(
      "show"
    );

  };


// =====================================================
// NEW SERVICE
// =====================================================

window.newCustomerService =
  function(customerId) {

    location.href =
      `./new-service-request.html?customerId=${encodeURIComponent(customerId)}`;

  };


// =====================================================
// SEARCH
// =====================================================

document.getElementById(
  "searchInput"
).addEventListener(
  "input",
  renderCustomers
);


// =====================================================
// HELPERS
// =====================================================

function normalize(value) {

  return String(
    value || ""
  )
    .trim()
    .toUpperCase();

}


function dateValue(value) {

  if (!value)
    return 0;


  try {

    if (
      typeof value.toMillis ===
      "function"
    ) {

      return value.toMillis();

    }


    if (
      typeof value.toDate ===
      "function"
    ) {

      return value
        .toDate()
        .getTime();

    }


    return new Date(value)
      .getTime() || 0;

  } catch {

    return 0;

  }

}


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