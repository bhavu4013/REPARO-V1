import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


// =====================================================
// STATE
// =====================================================

let retailerUid = null;
let retailerProfile = null;


// =====================================================
// DOM
// =====================================================

const retailerNameEl =
  document.getElementById("retailerName");

const requestCountEl =
  document.getElementById("requestCount");

const activeJobsEl =
  document.getElementById("activeJobs");

const completedJobsEl =
  document.getElementById("completedJobs");

const protectedCustomersEl =
  document.getElementById("protectedCustomers");

const availableAmountEl =
  document.getElementById("availableAmount");

const holdAmountEl =
  document.getElementById("holdAmount");

const releasedAmountEl =
  document.getElementById("releasedAmount");

const paidAmountEl =
  document.getElementById("paidAmount");

const recentJobsEl =
  document.getElementById("recentJobs");

const customerListEl =
  document.getElementById("customerList");


// =====================================================
// HELPERS
// =====================================================

function money(value) {

  const amount =
    Number(value || 0);

  return "₹" + amount.toLocaleString("en-IN", {
    maximumFractionDigits: 2
  });
}


function escapeHtml(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function formatDate(value) {

  if (!value) {
    return "-";
  }

  try {

    if (
      typeof value.toDate === "function"
    ) {

      return value.toDate().toLocaleDateString(
        "en-IN",
        {
          day: "2-digit",
          month: "short",
          year: "numeric"
        }
      );
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "-";
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
  catch (error) {

    return "-";
  }
}


function timestampValue(value) {

  if (!value) {
    return 0;
  }

  try {

    if (
      typeof value.toDate === "function"
    ) {

      return value.toDate().getTime();
    }

    return new Date(value).getTime();

  }
  catch (error) {

    return 0;
  }
}


function getAmount(data) {

  const fields = [

    "amount",
    "earningAmount",
    "retailerAmount",
    "retailerCommission",
    "commissionAmount",
    "commission",
    "total"

  ];

  for (
    const field of fields
  ) {

    const value =
      Number(data?.[field]);

    if (
      Number.isFinite(value) &&
      value > 0
    ) {

      return value;
    }
  }

  return 0;
}


// =====================================================
// STATUS HELPERS
// =====================================================

function normalizeStatus(value) {

  return String(
    value || ""
  )
    .trim()
    .toUpperCase();
}


function isActiveJob(status) {

  const activeStatuses = [

    "ASSIGNED",
    "IN PROGRESS",
    "DIAGNOSIS",
    "CUSTOMER APPROVAL",
    "REPAIR",
    "PENDING",
    "OPEN"

  ];

  return activeStatuses.includes(
    normalizeStatus(status)
  );
}


// =====================================================
// NAVIGATION
// =====================================================

window.newRequest = function () {

  window.location.href =
    "./new-service-request.html";
};


window.openCustomers = function () {

  window.location.href =
    "./customers.html";
};


window.openJobs = function () {

  window.location.href =
    "./jobs.html";
};


window.openEarnings = function () {

  window.location.href =
    "./earnings.html";
};


// =====================================================
// AUTH
// =====================================================

onAuthStateChanged(
  auth,
  async (user) => {

    if (!user) {

      window.location.href =
        "../index.html";

      return;
    }

    try {

      retailerUid =
        user.uid;

      await loadRetailerProfile();

      await loadDashboard();

    }
    catch (error) {

      console.error(
        "Retailer dashboard error:",
        error
      );

      showDashboardError(
        "Dashboard load કરવામાં problem આવી. Please login ફરી કરો."
      );
    }

  }
);


// =====================================================
// RETAILER PROFILE
// =====================================================

async function loadRetailerProfile() {

  const userRef =
    doc(
      db,
      "users",
      retailerUid
    );

  const snapshot =
    await getDoc(
      userRef
    );


  if (
    !snapshot.exists()
  ) {

    throw new Error(
      "Retailer profile not found."
    );
  }


  const data =
    snapshot.data();


  // Security validation
  if (
    data.role !== "retailer" ||
    data.active !== true
  ) {

    await signOut(auth);

    window.location.href =
      "../index.html";

    throw new Error(
      "Unauthorized retailer."
    );
  }


  retailerProfile =
    data;


  retailerNameEl.textContent =
    data.shopName
      ? data.shopName
      : (
          data.name ||
          "Retailer"
        );
}


// =====================================================
// DASHBOARD
// =====================================================

async function loadDashboard() {

  await Promise.all([

    loadServiceRequests(),

    loadJobs(),

    loadProtectedCustomers(),

    loadEarnings()

  ]);
}


// =====================================================
// SERVICE REQUESTS
// =====================================================

async function loadServiceRequests() {

  try {

    const requestQuery =
      query(

        collection(
          db,
          "service_requests"
        ),

        where(
          "retailerId",
          "==",
          retailerUid
        )

      );


    const snapshot =
      await getDocs(
        requestQuery
      );


    requestCountEl.textContent =
      snapshot.size;

  }
  catch (error) {

    console.error(
      "Service request load error:",
      error
    );

    requestCountEl.textContent =
      "0";
  }
}


// =====================================================
// JOBS
// =====================================================

async function loadJobs() {

  try {

    const jobsQuery =
      query(

        collection(
          db,
          "jobs"
        ),

        where(
          "retailerId",
          "==",
          retailerUid
        )

      );


    const snapshot =
      await getDocs(
        jobsQuery
      );


    let activeCount = 0;
    let completedCount = 0;


    const jobs = [];


    snapshot.forEach(
      documentSnapshot => {

        const data =
          documentSnapshot.data();


        const job = {

          id:
            documentSnapshot.id,

          ...data

        };


        jobs.push(job);


        const status =
          normalizeStatus(
            data.status
          );


        if (
          status === "COMPLETED"
        ) {

          completedCount++;

        }
        else if (
          isActiveJob(status)
        ) {

          activeCount++;

        }

      }
    );


    activeJobsEl.textContent =
      activeCount;


    completedJobsEl.textContent =
      completedCount;


    renderRecentJobs(
      jobs
    );

  }
  catch (error) {

    console.error(
      "Jobs load error:",
      error
    );

    activeJobsEl.textContent =
      "0";

    completedJobsEl.textContent =
      "0";

    recentJobsEl.innerHTML = `

      <div class="empty">
        Jobs load થઈ શક્યા નથી.
      </div>

    `;
  }
}


// =====================================================
// RECENT JOBS
// =====================================================

function renderRecentJobs(
  jobs
) {

  jobs.sort(
    (a, b) => {

      const dateA =
        timestampValue(
          a.updatedAt ||
          a.createdAt ||
          a.completedAt
        );

      const dateB =
        timestampValue(
          b.updatedAt ||
          b.createdAt ||
          b.completedAt
        );

      return dateB - dateA;
    }
  );


  const recent =
    jobs.slice(
      0,
      5
    );


  if (
    recent.length === 0
  ) {

    recentJobsEl.innerHTML = `

      <div class="empty">
        હજુ કોઈ job નથી.
      </div>

    `;

    return;
  }


  recentJobsEl.innerHTML =
    recent
      .map(
        job => {

          const jobId =
            job.id;


          const customerName =
            job.customerName ||
            "Customer";


          const device =
            [
              job.deviceBrand,
              job.deviceModel
            ]
              .filter(Boolean)
              .join(" ") ||
            "Device";


          const service =
            job.serviceType ||
            job.service ||
            "Service";


          const status =
            normalizeStatus(
              job.status
            ) ||
            "PENDING";


          const date =
            formatDate(
              job.updatedAt ||
              job.createdAt
            );


          return `

            <div
              class="job-card"
              onclick="openJob('${escapeHtml(jobId)}')"
              style="cursor:pointer;"
            >

              <div class="job-top">

                <div>

                  <div class="job-title">
                    Job #${escapeHtml(jobId)}
                  </div>

                  <div class="job-info">

                    ${escapeHtml(customerName)}
                    •
                    ${escapeHtml(device)}
                    <br>

                    ${escapeHtml(service)}
                    •
                    ${escapeHtml(date)}

                  </div>

                </div>


                <span class="job-status">

                  ${escapeHtml(
                    status
                  )}

                </span>

              </div>

            </div>

          `;

        }
      )
      .join("");
}


// =====================================================
// OPEN JOB
// =====================================================

window.openJob = function (
  jobId
) {

  window.location.href =
    `./jobs.html?jobId=${encodeURIComponent(jobId)}`;
};


// =====================================================
// PROTECTED CUSTOMERS
// =====================================================

async function loadProtectedCustomers() {

  try {

    const customerQuery =
      query(

        collection(
          db,
          "customers"
        ),

        where(
          "originalRetailerId",
          "==",
          retailerUid
        )

      );


    const snapshot =
      await getDocs(
        customerQuery
      );


    protectedCustomersEl.textContent =
      snapshot.size;


    const customers = [];


    snapshot.forEach(
      documentSnapshot => {

        customers.push({

          id:
            documentSnapshot.id,

          ...documentSnapshot.data()

        });

      }
    );


    customers.sort(
      (a, b) => {

        const dateA =
          timestampValue(
            a.updatedAt ||
            a.createdAt
          );

        const dateB =
          timestampValue(
            b.updatedAt ||
            b.createdAt
          );

        return dateB - dateA;
      }
    );


    renderCustomers(
      customers.slice(
        0,
        5
      )
    );

  }
  catch (error) {

    console.error(
      "Customer load error:",
      error
    );

    protectedCustomersEl.textContent =
      "0";

    customerListEl.innerHTML = `

      <div class="empty">
        Customers load થઈ શક્યા નથી.
      </div>

    `;
  }
}


// =====================================================
// CUSTOMER LIST
// =====================================================

function renderCustomers(
  customers
) {

  if (
    customers.length === 0
  ) {

    customerListEl.innerHTML = `

      <div class="empty">
        હજુ કોઈ protected customer નથી.
      </div>

    `;

    return;
  }


  customerListEl.innerHTML =
    customers
      .map(
        customer => {

          const name =
            customer.name ||
            "Customer";


          const mobile =
            customer.mobile ||
            "-";


          const device =
            [
              customer.deviceBrand,
              customer.deviceModel
            ]
              .filter(Boolean)
              .join(" ") ||
            "";


          const serial =
            customer.serialNumber ||
            customer.serial ||
            "";


          return `

            <div
              class="customer-card"
              onclick="openCustomer('${escapeHtml(customer.id)}')"
              style="cursor:pointer;"
            >

              <div class="customer-top">

                <div>

                  <div class="customer-name">
                    ${escapeHtml(name)}
                  </div>

                  <div class="customer-info">

                    ${escapeHtml(mobile)}

                    ${
                      device
                        ? `<br>${escapeHtml(device)}`
                        : ""
                    }

                    ${
                      serial
                        ? `<br>Serial: ${escapeHtml(serial)}`
                        : ""
                    }

                  </div>

                </div>


                <span class="protected">
                  PROTECTED
                </span>

              </div>

            </div>

          `;

        }
      )
      .join("");
}


// =====================================================
// OPEN CUSTOMER
// =====================================================

window.openCustomer = function (
  customerId
) {

  window.location.href =
    `./customers.html?customerId=${encodeURIComponent(customerId)}`;
};


// =====================================================
// EARNINGS
// =====================================================

async function loadEarnings() {

  try {

    let available = 0;
    let hold = 0;
    let released = 0;
    let paid = 0;


    // -------------------------------------------------
    // COMMISSIONS
    // -------------------------------------------------

    const commissionQuery =
      query(

        collection(
          db,
          "commissions"
        ),

        where(
          "retailerId",
          "==",
          retailerUid
        )

      );


    const commissionSnapshot =
      await getDocs(
        commissionQuery
      );


    commissionSnapshot.forEach(
      documentSnapshot => {

        const data =
          documentSnapshot.data();


        const amount =
          getAmount(data);


        const status =
          normalizeStatus(
            data.status
          );


        /*
         * WARRANTY HOLD
         */

        if (
          status === "WARRANTY HOLD" ||
          status === "HOLD"
        ) {

          hold += amount;

          return;
        }


        /*
         * PAID
         */

        if (
          status === "PAID"
        ) {

          paid += amount;

          return;
        }


        /*
         * RELEASED
         */

        if (
          status === "RELEASED"
        ) {

          released += amount;

          available += amount;

          return;
        }


        /*
         * PAYABLE
         */

        if (
          status === "PAYABLE"
        ) {

          available += amount;

          return;
        }


        /*
         * PENDING
         *
         * Pending is not counted as
         * available.
         */

        if (
          status === "PENDING"
        ) {

          return;
        }

      }
    );


    // -------------------------------------------------
    // RETAILER WALLET
    // -------------------------------------------------

    /*
     * Wallet is treated as summary/fallback.
     * Commission records remain the primary
     * transaction source.
     */

    try {

      const walletRef =
        doc(
          db,
          "retailer_wallet",
          retailerUid
        );


      const walletSnapshot =
        await getDoc(
          walletRef
        );


      if (
        walletSnapshot.exists()
      ) {

        const wallet =
          walletSnapshot.data();


        /*
         * If wallet has explicit summary fields,
         * use them as fallback only when commission
         * collection has no corresponding values.
         */

        const walletAvailable =
          Number(
            wallet.availableAmount ??
            wallet.available ??
            0
          );


        const walletHold =
          Number(
            wallet.warrantyHold ??
            wallet.holdAmount ??
            wallet.hold ??
            0
          );


        const walletReleased =
          Number(
            wallet.releasedAmount ??
            wallet.released ??
            0
          );


        const walletPaid =
          Number(
            wallet.paidAmount ??
            wallet.paid ??
            0
          );


        /*
         * If no commission records exist,
         * wallet becomes useful fallback.
         */

        if (
          commissionSnapshot.empty
        ) {

          available =
            walletAvailable;

          hold =
            walletHold;

          released =
            walletReleased;

          paid =
            walletPaid;
        }

      }

    }
    catch (walletError) {

      console.warn(
        "Wallet fallback unavailable:",
        walletError
      );
    }


    availableAmountEl.textContent =
      money(available);


    holdAmountEl.textContent =
      money(hold);


    releasedAmountEl.textContent =
      money(released);


    paidAmountEl.textContent =
      money(paid);

  }
  catch (error) {

    console.error(
      "Earnings load error:",
      error
    );

    availableAmountEl.textContent =
      "₹0";

    holdAmountEl.textContent =
      "₹0";

    releasedAmountEl.textContent =
      "₹0";

    paidAmountEl.textContent =
      "₹0";
  }
}


// =====================================================
// DASHBOARD ERROR
// =====================================================

function showDashboardError(
  message
) {

  if (
    recentJobsEl
  ) {

    recentJobsEl.innerHTML = `

      <div class="empty">
        ${escapeHtml(message)}
      </div>

    `;
  }


  if (
    customerListEl
  ) {

    customerListEl.innerHTML = `

      <div class="empty">
        Dashboard data unavailable.
      </div>

    `;
  }
}