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
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


let currentUser = null;

let retailerProfile = {};

let requests = [];
let jobs = [];
let customers = [];
let commissions = [];


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

    const profileSnap =
      await getDoc(
        doc(
          db,
          "users",
          user.uid
        )
      );


    if (
      !profileSnap.exists() ||
      profileSnap.data().role !== "retailer"
    ) {

      location.href =
        "../index.html";

      return;

    }


    currentUser = user;

    retailerProfile =
      profileSnap.data();


    document.getElementById(
      "retailerName"
    ).textContent =
      retailerProfile.name ||
      retailerProfile.businessName ||
      "Retailer";


    await loadData();

    renderDashboard();

  } catch (error) {

    console.error(error);

    showError();

  }

});


// =====================================================
// LOAD DATA
// =====================================================

async function loadData() {

  await Promise.all([
    loadRequests(),
    loadJobs(),
    loadCustomers(),
    loadCommissions()
  ]);

}


// =====================================================
// REQUESTS
// =====================================================

async function loadRequests() {

  requests = [];

  try {

    const snap =
      await getDocs(
        query(
          collection(
            db,
            "service_requests"
          ),
          where(
            "retailerId",
            "==",
            currentUser.uid
          )
        )
      );


    snap.forEach(item => {

      requests.push({
        id: item.id,
        ...item.data()
      });

    });

  } catch (error) {

    console.error(
      "Service request load error:",
      error
    );

  }

}


// =====================================================
// JOBS
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
      "Jobs load error:",
      error
    );

  }

}


// =====================================================
// CUSTOMERS
// =====================================================

async function loadCustomers() {

  customers = [];

  try {

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

  } catch (error) {

    console.error(
      "Customers load error:",
      error
    );

  }

}


// =====================================================
// COMMISSIONS
// =====================================================

async function loadCommissions() {

  commissions = [];

  try {

    const snap =
      await getDocs(
        query(
          collection(
            db,
            "commissions"
          ),
          where(
            "retailerId",
            "==",
            currentUser.uid
          )
        )
      );


    snap.forEach(item => {

      commissions.push({
        id: item.id,
        ...item.data()
      });

    });

  } catch (error) {

    console.error(
      "Commission load error:",
      error
    );

  }

}


// =====================================================
// RENDER
// =====================================================

function renderDashboard() {

  renderStats();

  renderEarnings();

  renderRecentJobs();

  renderCustomers();

}


// =====================================================
// STATS
// =====================================================

function renderStats() {

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
      normalize(job.status)
      === "COMPLETED"
    ).length;


  document.getElementById(
    "requestCount"
  ).textContent =
    requests.length;


  document.getElementById(
    "activeJobs"
  ).textContent =
    active;


  document.getElementById(
    "completedJobs"
  ).textContent =
    completed;


  document.getElementById(
    "protectedCustomers"
  ).textContent =
    customers.length;

}


// =====================================================
// EARNINGS
// =====================================================

function renderEarnings() {

  let hold = 0;
  let released = 0;
  let paid = 0;


  commissions.forEach(item => {

    const amount =
      Number(
        item.amount ??
        item.commissionAmount ??
        0
      );


    const status =
      normalize(
        item.status ||
        item.commissionStatus
      );


    if (
      status === "WARRANTY HOLD"
    ) {

      hold += amount;

    }


    if (
      status === "RELEASED"
    ) {

      released += amount;

    }


    if (
      status === "PAID"
    ) {

      paid += amount;

    }

  });


  const available =
    released;


  document.getElementById(
    "holdAmount"
  ).textContent =
    money(hold);


  document.getElementById(
    "releasedAmount"
  ).textContent =
    money(released);


  document.getElementById(
    "paidAmount"
  ).textContent =
    money(paid);


  document.getElementById(
    "availableAmount"
  ).textContent =
    money(
      Math.max(
        0,
        available
      )
    );

}


// =====================================================
// RECENT JOBS
// =====================================================

function renderRecentJobs() {

  const box =
    document.getElementById(
      "recentJobs"
    );


  const recent =
    [...jobs]
      .sort(
        (a, b) =>
          timestampValue(
            b.createdAt
          ) -
          timestampValue(
            a.createdAt
          )
      )
      .slice(0, 5);


  if (!recent.length) {

    box.innerHTML =
      `<div class="empty">
        No jobs found yet.
      </div>`;

    return;

  }


  box.innerHTML =
    recent
      .map(job => {

        const status =
          normalize(
            job.status ||
            "NEW"
          );


        return `
          <div class="job-card">

            <div class="job-top">

              <div>

                <div class="job-title">
                  ${escapeHtml(
                    job.jobNumber ||
                    job.jobId ||
                    job.id
                  )}
                </div>

                <div class="job-info">
                  ${escapeHtml(
                    job.customerName ||
                    "Customer"
                  )}
                  •
                  ${escapeHtml(
                    job.serviceType ||
                    "Service"
                  )}
                </div>

              </div>

              <span class="job-status">
                ${escapeHtml(status)}
              </span>

            </div>

            <div class="job-info">
              ${escapeHtml(
                job.deviceBrand ||
                ""
              )}
              ${escapeHtml(
                job.deviceModel ||
                ""
              )}
            </div>

          </div>
        `;

      })
      .join("");

}


// =====================================================
// CUSTOMERS
// =====================================================

function renderCustomers() {

  const box =
    document.getElementById(
      "customerList"
    );


  const recent =
    [...customers]
      .sort(
        (a, b) =>
          timestampValue(
            b.createdAt
          ) -
          timestampValue(
            a.createdAt
          )
      )
      .slice(0, 5);


  if (!recent.length) {

    box.innerHTML =
      `<div class="empty">
        No protected customers yet.
      </div>`;

    return;

  }


  box.innerHTML =
    recent
      .map(customer => {

        return `
          <div class="customer-card">

            <div class="customer-top">

              <div>

                <div class="customer-name">
                  ${escapeHtml(
                    customer.name ||
                    customer.customerName ||
                    "Customer"
                  )}
                </div>

                <div class="customer-info">
                  ${escapeHtml(
                    customer.mobile ||
                    customer.phone ||
                    "-"
                  )}
                  <br>
                  ${escapeHtml(
                    customer.address ||
                    "-"
                  )}
                </div>

              </div>

              <span class="protected">
                PROTECTED
              </span>

            </div>

          </div>
        `;

      })
      .join("");

}


// =====================================================
// NAVIGATION
// =====================================================

window.newRequest =
  function() {

    location.href =
      "./new-service-request.html";

  };


window.openCustomers =
  function() {

    location.href =
      "./customers.html";

  };


window.openJobs =
  function() {

    location.href =
      "./jobs.html";

  };


window.openEarnings =
  function() {

    location.href =
      "./earnings.html";

  };


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


function money(value) {

  return (
    "₹" +
    Number(
      value || 0
    ).toLocaleString(
      "en-IN"
    )
  );

}


function timestampValue(value) {

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


function showError() {

  document.getElementById(
    "recentJobs"
  ).innerHTML =
    `<div class="empty">
      Unable to load dashboard data.
    </div>`;

}