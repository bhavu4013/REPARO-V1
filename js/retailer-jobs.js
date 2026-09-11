import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
  auth,
  db
} from "./firebase.js";


/* =========================================================
   DOM
========================================================= */

const jobContainer = document.getElementById("jobContainer");

const searchInput = document.getElementById("searchInput");

const statusFilter = document.getElementById("statusFilter");

const logoutBtn = document.getElementById("logoutBtn");

const errorBox = document.getElementById("errorBox");

const successBox = document.getElementById("successBox");

const totalJobs = document.getElementById("totalJobs");

const activeJobs = document.getElementById("activeJobs");

const completedJobs = document.getElementById("completedJobs");

const modalBackdrop = document.getElementById("modalBackdrop");

const closeModalBtn = document.getElementById("closeModalBtn");

const modalTitle = document.getElementById("modalTitle");

const modalContent = document.getElementById("modalContent");


/* =========================================================
   STATE
========================================================= */

let allJobs = [];

let retailerUser = null;

let retailerProfile = null;


/* =========================================================
   AUTH
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
      profile.role !== "retailer" ||
      profile.active !== true
    ) {

      await signOut(auth);

      window.location.href = "../index.html";

      return;
    }


    retailerUser = user;

    retailerProfile = profile;


    await loadJobs();

  } catch (error) {

    showError(
      error.message ||
      "Authorization failed."
    );

  }

});


/* =========================================================
   LOAD JOBS
========================================================= */

async function loadJobs() {

  jobContainer.innerHTML = `
    <div class="loading">
      Loading jobs...
    </div>
  `;


  try {

    /*
      IMPORTANT:

      Retailer can only read jobs where
      retailerId == logged-in retailer UID.

      This matches Firestore security rules.
    */

    const jobsQuery = query(
      collection(db, "jobs"),
      where(
        "retailerId",
        "==",
        retailerUser.uid
      )
    );


    const snapshot = await getDocs(jobsQuery);


    allJobs = [];


    snapshot.forEach((item) => {

      allJobs.push({
        id: item.id,
        ...item.data()
      });

    });


    allJobs.sort((a, b) => {

      const aTime =
        a.createdAt?.seconds ||
        0;

      const bTime =
        b.createdAt?.seconds ||
        0;

      return bTime - aTime;

    });


    updateSummary();

    renderJobs();


  } catch (error) {

    jobContainer.innerHTML = `
      <div class="empty">

        <div class="empty-icon">
          ⚠️
        </div>

        <div class="empty-title">
          Jobs Load Error
        </div>

        <div class="empty-text">
          ${escapeHtml(
            error.message ||
            "Unable to load jobs."
          )}
        </div>

      </div>
    `;

    showError(
      error.message ||
      "Unable to load jobs."
    );

  }

}


/* =========================================================
   SUMMARY
========================================================= */

function updateSummary() {

  const total =
    allJobs.length;


  const active =
    allJobs.filter(
      job => isActiveStatus(job.status)
    ).length;


  const completed =
    allJobs.filter(
      job =>
        String(job.status || "")
          .toUpperCase() === "COMPLETED"
    ).length;


  totalJobs.textContent = total;

  activeJobs.textContent = active;

  completedJobs.textContent = completed;

}


/* =========================================================
   FILTER EVENTS
========================================================= */

searchInput.addEventListener(
  "input",
  renderJobs
);


statusFilter.addEventListener(
  "change",
  renderJobs
);


/* =========================================================
   RENDER JOBS
========================================================= */

function renderJobs() {

  const search =
    searchInput.value
      .trim()
      .toLowerCase();


  const selectedStatus =
    statusFilter.value;


  const filtered =
    allJobs.filter(job => {

      const searchable = [

        job.id,

        job.jobId,

        job.requestId,

        job.customerName,

        job.customerMobile,

        job.mobile,

        job.deviceBrand,

        job.deviceModel,

        job.serialNumber,

        job.serviceType,

        job.problem

      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();


      const searchMatch =
        !search ||
        searchable.includes(search);


      const statusMatch =
        !selectedStatus ||
        String(job.status || "")
          .toUpperCase() === selectedStatus;


      return (
        searchMatch &&
        statusMatch
      );

    });


  if (filtered.length === 0) {

    jobContainer.innerHTML = `
      <div class="empty">

        <div class="empty-icon">
          🔧
        </div>

        <div class="empty-title">
          No Jobs Found
        </div>

        <div class="empty-text">
          No service jobs match your search.
        </div>

      </div>
    `;

    return;
  }


  jobContainer.innerHTML = `
    <div>
      ${filtered
        .map(renderJobCard)
        .join("")}
    </div>
  `;


  document
    .querySelectorAll("[data-view-job]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          openJobModal(
            button.dataset.viewJob
          );

        }
      );

    });

}


/* =========================================================
   JOB CARD
========================================================= */

function renderJobCard(job) {

  const status =
    String(
      job.status || "NEW"
    ).toUpperCase();


  const technicianName =
    job.technicianName ||
    "Not Assigned";


  const deviceText =
    getDeviceText(job);


  return `

    <div class="job-card">

      <div class="job-top">

        <div>

          <h3 class="job-id">
            ${escapeHtml(
              job.jobId ||
              job.id
            )}
          </h3>

          <div class="customer-name">
            ${escapeHtml(
              job.customerName ||
              "Customer"
            )}
          </div>

        </div>


        <span
          class="status ${getStatusClass(status)}"
        >
          ${escapeHtml(
            formatStatus(status)
          )}
        </span>

      </div>


      <div class="job-info">

        <div class="info-row">

          <span class="info-icon">
            📱
          </span>

          <span>
            ${escapeHtml(
              job.customerMobile ||
              job.mobile ||
              "-"
            )}
          </span>

        </div>


        <div class="info-row">

          <span class="info-icon">
            📺
          </span>

          <span>
            ${escapeHtml(
              deviceText
            )}
          </span>

        </div>


        <div class="info-row">

          <span class="info-icon">
            🔧
          </span>

          <span>
            ${escapeHtml(
              job.serviceType ||
              "Service"
            )}
          </span>

        </div>


        <div class="info-row">

          <span class="info-icon">
            👨‍🔧
          </span>

          <span>
            ${escapeHtml(
              technicianName
            )}
          </span>

        </div>


        ${
          job.problem
            ? `
              <div class="info-row">

                <span class="info-icon">
                  ⚠️
                </span>

                <span>
                  ${escapeHtml(
                    job.problem
                  )}
                </span>

              </div>
            `
            : ""
        }

      </div>


      <div class="job-divider"></div>


      <div class="job-actions">

        <button
          type="button"
          class="view-btn"
          data-view-job="${escapeAttribute(
            job.id
          )}"
        >
          View Details
        </button>

      </div>

    </div>

  `;

}


/* =========================================================
   JOB DETAILS MODAL
========================================================= */

async function openJobModal(jobId) {

  const job =
    allJobs.find(
      item => item.id === jobId
    );


  if (!job) {

    showError(
      "Job not found."
    );

    return;
  }


  modalTitle.textContent =
    "Job Details";


  /*
    IMPORTANT:

    This modal intentionally does NOT show:

    - REPARO purchase cost
    - internal profit
    - technician payout
    - internal margin
    - internal commission calculation

    Retailer sees only service-facing information.
  */


  modalContent.innerHTML = `

    <div class="detail-section">

      <div class="detail-title">
        Job Information
      </div>


      ${detailRow(
        "Job ID",
        job.jobId || job.id
      )}


      ${detailRow(
        "Request ID",
        job.requestId ||
        job.serviceRequestId ||
        "-"
      )}


      ${detailRow(
        "Status",
        formatStatus(
          job.status || "NEW"
        )
      )}


      ${detailRow(
        "Service Type",
        job.serviceType ||
        "Service"
      )}

    </div>


    <div class="detail-section">

      <div class="detail-title">
        Customer
      </div>


      ${detailRow(
        "Name",
        job.customerName ||
        "-"
      )}


      ${detailRow(
        "Mobile",
        job.customerMobile ||
        job.mobile ||
        "-"
      )}


      ${detailRow(
        "Address",
        job.customerAddress ||
        job.address ||
        "-"
      )}

    </div>


    <div class="detail-section">

      <div class="detail-title">
        Device
      </div>


      ${detailRow(
        "Device",
        getDeviceText(job)
      )}


      ${detailRow(
        "Serial Number",
        job.serialNumber ||
        "-"
      )}


      ${detailRow(
        "Problem",
        job.problem ||
        "-"
      )}

    </div>


    <div class="detail-section">

      <div class="detail-title">
        Technician
      </div>


      ${detailRow(
        "Technician",
        job.technicianName ||
        "Not Assigned"
      )}


      ${detailRow(
        "Progress",
        getProgressText(
          job.status
        )
      )}

    </div>


    ${
      getCustomerVisibleAmount(job) !== null
        ? `

          <div class="detail-section">

            <div class="detail-title">
              Service Amount
            </div>

            ${detailRow(
              "Estimated / Service Amount",
              formatCurrency(
                getCustomerVisibleAmount(job)
              )
            )}

          </div>

        `
        : ""
    }


    ${
      job.diagnosis
        ? `

          <div class="detail-section">

            <div class="detail-title">
              Diagnosis
            </div>

            ${detailRow(
              "Diagnosis",
              job.diagnosis
            )}

          </div>

        `
        : ""
    }


    ${
      job.repairNotes
        ? `

          <div class="detail-section">

            <div class="detail-title">
              Repair Update
            </div>

            ${detailRow(
              "Notes",
              job.repairNotes
            )}

          </div>

        `
        : ""
    }

  `;


  modalBackdrop.classList.add(
    "show"
  );

}


/* =========================================================
   DETAIL ROW
========================================================= */

function detailRow(
  label,
  value
) {

  return `

    <div class="detail-row">

      <span class="detail-label">
        ${escapeHtml(label)}
      </span>

      <span class="detail-value">
        ${escapeHtml(value)}
      </span>

    </div>

  `;

}


/* =========================================================
   CUSTOMER VISIBLE AMOUNT
========================================================= */

function getCustomerVisibleAmount(job) {

  const candidates = [

    job.finalTotal,

    job.estimateTotal,

    job.totalAmount,

    job.serviceAmount

  ];


  for (const value of candidates) {

    const number =
      Number(value);


    if (
      Number.isFinite(number) &&
      number > 0
    ) {

      return number;

    }

  }


  return null;

}


/* =========================================================
   CURRENCY
========================================================= */

function formatCurrency(
  amount
) {

  return "₹" +
    Number(amount)
      .toLocaleString("en-IN");

}


/* =========================================================
   PROGRESS
========================================================= */

function getProgressText(
  status
) {

  switch (
    String(status || "")
      .toUpperCase()
  ) {

    case "NEW":
      return "Service job created";

    case "ASSIGNED":
      return "Technician assigned";

    case "IN PROGRESS":
      return "Service in progress";

    case "DIAGNOSIS":
      return "Device diagnosis in progress";

    case "CUSTOMER APPROVAL":
      return "Waiting for customer approval";

    case "REPAIR":
      return "Repair in progress";

    case "COMPLETED":
      return "Service completed";

    case "CANCELLED":
      return "Service cancelled";

    default:
      return "Service update available";

  }

}


/* =========================================================
   DEVICE TEXT
========================================================= */

function getDeviceText(job) {

  const parts = [

    job.deviceBrand,

    job.deviceModel,

    job.screenSize
      ? `${job.screenSize}"`
      : null

  ].filter(Boolean);


  if (parts.length) {

    return parts.join(" ");

  }


  return (
    job.device ||
    job.product ||
    "Device"
  );

}


/* =========================================================
   ACTIVE STATUS
========================================================= */

function isActiveStatus(
  status
) {

  const value =
    String(status || "")
      .toUpperCase();


  return [

    "ASSIGNED",

    "IN PROGRESS",

    "DIAGNOSIS",

    "CUSTOMER APPROVAL",

    "REPAIR"

  ].includes(value);

}


/* =========================================================
   STATUS CLASS
========================================================= */

function getStatusClass(
  status
) {

  switch (
    String(status || "")
      .toUpperCase()
  ) {

    case "NEW":
      return "status-new";

    case "ASSIGNED":
      return "status-assigned";

    case "IN PROGRESS":
      return "status-progress";

    case "DIAGNOSIS":
      return "status-diagnosis";

    case "CUSTOMER APPROVAL":
      return "status-approval";

    case "REPAIR":
      return "status-repair";

    case "COMPLETED":
      return "status-completed";

    case "CANCELLED":
      return "status-cancelled";

    default:
      return "status-assigned";

  }

}


/* =========================================================
   FORMAT STATUS
========================================================= */

function formatStatus(
  status
) {

  return String(status || "")
    .toLowerCase()
    .replace(
      /\b\w/g,
      letter =>
        letter.toUpperCase()
    );

}


/* =========================================================
   CLOSE MODAL
========================================================= */

function closeModal() {

  modalBackdrop.classList.remove(
    "show"
  );

  modalContent.innerHTML = "";

}


closeModalBtn.addEventListener(
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
   MESSAGES
========================================================= */

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


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(
  value
) {

  return String(value ?? "")
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

  return escapeHtml(value);

}