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

const jobContainer =
  document.getElementById("jobContainer");

const searchInput =
  document.getElementById("searchInput");

const statusFilter =
  document.getElementById("statusFilter");

const logoutBtn =
  document.getElementById("logoutBtn");

const errorBox =
  document.getElementById("errorBox");

const successBox =
  document.getElementById("successBox");

const totalJobs =
  document.getElementById("totalJobs");

const activeJobs =
  document.getElementById("activeJobs");

const completedJobs =
  document.getElementById("completedJobs");


/* =========================================================
   STATE
========================================================= */

let technicianUser = null;

let technicianProfile = null;

let allJobs = [];


/* =========================================================
   AUTH
========================================================= */

onAuthStateChanged(
  auth,
  async (user) => {

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
        await getDoc(userRef);


      if (!snapshot.exists()) {

        await signOut(auth);

        window.location.href =
          "../index.html";

        return;
      }


      const profile =
        snapshot.data();


      /*
       * Only active technicians
       * can access this page.
       */

      if (
        profile.role !== "technician" ||
        profile.active !== true
      ) {

        await signOut(auth);

        alert(
          "Technician access required."
        );

        window.location.href =
          "../index.html";

        return;
      }


      technicianUser =
        user;

      technicianProfile =
        profile;


      await loadJobs();

    }

    catch (error) {

      console.error(
        "Technician authorization error:",
        error
      );

      showError(
        error.message ||
        "Authorization failed."
      );

    }

  }
);


/* =========================================================
   LOAD JOBS
========================================================= */

async function loadJobs() {

  jobContainer.innerHTML = `
    <div class="loading">
      Loading assigned jobs...
    </div>
  `;


  try {

    /*
     * IMPORTANT SECURITY:
     *
     * Only jobs where technicianId matches
     * the currently logged-in Technician UID.
     */

    const jobsQuery =
      query(
        collection(
          db,
          "jobs"
        ),
        where(
          "technicianId",
          "==",
          technicianUser.uid
        )
      );


    const snapshot =
      await getDocs(
        jobsQuery
      );


    allJobs = [];


    snapshot.forEach(
      item => {

        allJobs.push({
          id: item.id,
          ...item.data()
        });

      }
    );


    /*
     * Newest / recently updated jobs first.
     */

    allJobs.sort(
      (a, b) => {

        const aTime =
          getTime(
            a.updatedAt ||
            a.createdAt
          );


        const bTime =
          getTime(
            b.updatedAt ||
            b.createdAt
          );


        return bTime - aTime;

      }
    );


    updateSummary();

    renderJobs();

  }

  catch (error) {

    console.error(
      "Jobs load error:",
      error
    );


    jobContainer.innerHTML = `
      <div class="empty">

        <div class="empty-icon">
          ⚠️
        </div>

        <div class="empty-title">
          Jobs Load Error
        </div>

        <div>
          ${escapeHtml(
            error.message ||
            "Unable to load assigned jobs."
          )}
        </div>

      </div>
    `;


    showError(
      error.message ||
      "Unable to load assigned jobs."
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
      job =>
        isActiveStatus(
          job.status
        )
    ).length;


  const completed =
    allJobs.filter(
      job =>
        normalizeStatus(
          job.status
        ) === "COMPLETED"
    ).length;


  totalJobs.textContent =
    total;

  activeJobs.textContent =
    active;

  completedJobs.textContent =
    completed;

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
    allJobs.filter(
      job => {

        const searchable = [

          job.id,

          job.jobId,

          job.requestId,

          job.serviceRequestId,

          job.customerName,

          job.customerMobile,

          job.mobile,

          job.customerAddress,

          job.address,

          job.deviceBrand,

          job.deviceModel,

          job.device,

          job.product,

          job.serialNumber,

          job.serial,

          job.serviceType,

          job.problem

        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();


        const searchMatch =
          !search ||
          searchable.includes(
            search
          );


        const statusMatch =
          !selectedStatus ||
          normalizeStatus(
            job.status
          ) === selectedStatus;


        return (
          searchMatch &&
          statusMatch
        );

      }
    );


  if (
    filtered.length === 0
  ) {

    jobContainer.innerHTML = `
      <div class="empty">

        <div class="empty-icon">
          🔧
        </div>

        <div class="empty-title">
          No Assigned Jobs
        </div>

        <div>
          No jobs match your search or filter.
        </div>

      </div>
    `;

    return;
  }


  jobContainer.innerHTML =
    filtered
      .map(
        renderJobCard
      )
      .join("");


  document
    .querySelectorAll(
      "[data-open-job]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            const jobId =
              button.dataset.openJob;


            if (!jobId) {
              return;
            }


            window.location.href =
              `./job-detail.html?jobId=${encodeURIComponent(
                jobId
              )}`;

          }
        );

      }
    );

}


/* =========================================================
   JOB CARD
========================================================= */

function renderJobCard(
  job
) {

  const status =
    normalizeStatus(
      job.status ||
      "ASSIGNED"
    );


  const device =
    getDeviceText(job);


  const customerMobile =
    job.customerMobile ||
    job.mobile ||
    "";


  const customerAddress =
    job.customerAddress ||
    job.address ||
    "";


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
          class="status ${getStatusClass(
            status
          )}"
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
              customerMobile ||
              "-"
            )}
          </span>

        </div>


        <div class="info-row">

          <span class="info-icon">
            📍
          </span>

          <span>
            ${escapeHtml(
              customerAddress ||
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
              device
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

        ${
          customerMobile
            ? `
              <a
                class="job-action call-btn"
                href="tel:${escapeAttribute(
                  customerMobile
                )}"
              >
                Call
              </a>
            `
            : ""
        }


        <button
          type="button"
          class="job-action open-btn"
          data-open-job="${escapeAttribute(
            job.id
          )}"
        >
          Open Job
        </button>

      </div>

    </div>

  `;

}


/* =========================================================
   ACTIVE STATUS
========================================================= */

function isActiveStatus(
  status
) {

  return [

    "ASSIGNED",

    "IN PROGRESS",

    "DIAGNOSIS",

    "CUSTOMER APPROVAL",

    "REPAIR"

  ].includes(
    normalizeStatus(status)
  );

}


/* =========================================================
   DEVICE
========================================================= */

function getDeviceText(
  job
) {

  const parts = [

    job.deviceBrand,

    job.deviceModel,

    job.screenSize
      ? `${job.screenSize}"`
      : null

  ].filter(Boolean);


  if (
    parts.length > 0
  ) {

    return parts.join(" ");

  }


  return (
    job.device ||
    job.product ||
    "Device"
  );

}


/* =========================================================
   STATUS
========================================================= */

function normalizeStatus(
  status
) {

  return String(
    status ||
    "NEW"
  )
    .toUpperCase()
    .trim();

}


function formatStatus(
  status
) {

  return String(
    status ||
    ""
  )
    .toLowerCase()
    .replace(
      /\b\w/g,
      letter =>
        letter.toUpperCase()
    );

}


function getStatusClass(
  status
) {

  switch (
    normalizeStatus(status)
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
   FIRESTORE TIME
========================================================= */

function getTime(
  value
) {

  if (!value) {
    return 0;
  }


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


  if (
    typeof value.seconds ===
    "number"
  ) {

    return value.seconds * 1000;

  }


  const date =
    new Date(value);


  return Number.isNaN(
    date.getTime()
  )
    ? 0
    : date.getTime();

}


/* =========================================================
   MESSAGES
========================================================= */

function showError(
  message
) {

  if (!errorBox) {
    return;
  }


  if (successBox) {
    successBox.style.display =
      "none";
  }


  errorBox.textContent =
    message;


  errorBox.style.display =
    "block";

}


function showSuccess(
  message
) {

  if (!successBox) {
    return;
  }


  if (errorBox) {
    errorBox.style.display =
      "none";
  }


  successBox.textContent =
    message;


  successBox.style.display =
    "block";

}


/* =========================================================
   LOGOUT
========================================================= */

logoutBtn.addEventListener(
  "click",
  async () => {

    logoutBtn.disabled =
      true;


    try {

      await signOut(
        auth
      );


      window.location.href =
        "../index.html";

    }

    catch (error) {

      console.error(
        "Logout error:",
        error
      );


      logoutBtn.disabled =
        false;


      showError(
        error.message ||
        "Logout failed."
      );

    }

  }
);


/* =========================================================
   HTML ESCAPE
========================================================= */

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


function escapeAttribute(
  value
) {

  return escapeHtml(
    value
  );

}