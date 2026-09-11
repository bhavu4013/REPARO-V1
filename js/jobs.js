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


/* =====================================================
   DOM
===================================================== */

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

const newJobs =
  document.getElementById("newJobs");

const activeJobs =
  document.getElementById("activeJobs");

const completedJobs =
  document.getElementById("completedJobs");

const modalBackdrop =
  document.getElementById("modalBackdrop");

const closeModalBtn =
  document.getElementById("closeModalBtn");

const cancelModalBtn =
  document.getElementById("cancelModalBtn");

const modalTitle =
  document.getElementById("modalTitle");

const modalContent =
  document.getElementById("modalContent");

const saveJobBtn =
  document.getElementById("saveJobBtn");

const moreNavBtn =
  document.getElementById("moreNavBtn");

const morePanel =
  document.getElementById("morePanel");


/* =====================================================
   STATE
===================================================== */

let allJobs = [];

let technicians = [];

let selectedJobId = null;

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


      adminUser =
        user;


      await loadPage();

    }
    catch (error) {

      showError(
        getErrorMessage(error)
      );

    }

  }
);


/* =====================================================
   LOAD PAGE
===================================================== */

async function loadPage() {

  try {

    await Promise.all([
      loadTechnicians(),
      loadJobs()
    ]);

  }
  catch (error) {

    showError(
      getErrorMessage(error)
    );

  }

}


/* =====================================================
   LOAD TECHNICIANS
===================================================== */

async function loadTechnicians() {

  const snapshot =
    await getDocs(
      collection(
        db,
        "technicians"
      )
    );


  technicians = [];


  snapshot.forEach(
    item => {

      technicians.push({

        uid:
          item.id,

        ...item.data()

      });

    }
  );


  /*
    Fallback:
    If technicians collection is empty,
    read active technicians from users.
  */

  if (
    technicians.length === 0
  ) {

    const usersSnapshot =
      await getDocs(
        collection(
          db,
          "users"
        )
      );


    usersSnapshot.forEach(
      item => {

        const data =
          item.data();


        if (
          data.role === "technician" &&
          data.active === true
        ) {

          technicians.push({

            uid:
              item.id,

            ...data

          });

        }

      }
    );

  }

}


/* =====================================================
   LOAD JOBS
===================================================== */

async function loadJobs() {

  jobContainer.innerHTML = `

    <div class="loading">
      Loading jobs...
    </div>

  `;


  try {

    const snapshot =
      await getDocs(
        collection(
          db,
          "jobs"
        )
      );


    allJobs = [];


    snapshot.forEach(
      item => {

        allJobs.push({

          id:
            item.id,

          ...item.data()

        });

      }
    );


    allJobs.sort(
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

    renderJobs();

  }
  catch (error) {

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
            getErrorMessage(error)
          )}
        </div>

      </div>

    `;

    throw error;

  }

}


/* =====================================================
   TIMESTAMP
===================================================== */

function getTimestamp(timestamp) {

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
   SUMMARY
===================================================== */

function updateSummary() {

  const total =
    allJobs.length;


  const newCount =
    allJobs.filter(
      job =>
        normalizeStatus(
          job.status
        ) === "NEW"
    ).length;


  const activeCount =
    allJobs.filter(
      job =>
        isActiveStatus(
          job.status
        )
    ).length;


  const completedCount =
    allJobs.filter(
      job =>
        normalizeStatus(
          job.status
        ) === "COMPLETED"
    ).length;


  totalJobs.textContent =
    total;

  newJobs.textContent =
    newCount;

  activeJobs.textContent =
    activeCount;

  completedJobs.textContent =
    completedCount;

}


/* =====================================================
   STATUS HELPERS
===================================================== */

function normalizeStatus(status) {

  return String(
    status || ""
  )
    .trim()
    .toUpperCase();

}


function isActiveStatus(status) {

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


/* =====================================================
   FILTERS
===================================================== */

searchInput.addEventListener(
  "input",
  renderJobs
);


statusFilter.addEventListener(
  "change",
  renderJobs
);


/* =====================================================
   RENDER
===================================================== */

function renderJobs() {

  const search =
    searchInput.value
      .trim()
      .toLowerCase();


  const selectedStatus =
    normalizeStatus(
      statusFilter.value
    );


  const filtered =
    allJobs.filter(
      job => {

        const searchable = [

          job.id,
          job.jobId,
          job.requestId,
          job.customerId,
          job.customerName,
          job.customerMobile,
          job.mobile,
          job.retailerName,
          job.retailerId,
          job.device,
          job.deviceBrand,
          job.deviceModel,
          job.serialNumber,
          job.serviceType,
          job.problem,
          job.technicianName,
          job.technicianId

        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();


        const searchMatch =
          !search ||
          searchable.includes(search);


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

    <div class="job-list">

      ${filtered
        .map(renderJobCard)
        .join("")}

    </div>

  `;


  bindJobButtons();

}


/* =====================================================
   JOB CARD
===================================================== */

function renderJobCard(job) {

  const status =
    normalizeStatus(
      job.status || "NEW"
    );


  const technician =
    getTechnician(
      job.technicianId
    );


  const technicianName =
    job.technicianName ||
    technician?.name ||
    "Not Assigned";


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


        <span class="status ${getStatusClass(status)}">

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
              getDeviceText(job)
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


        <div class="info-row">

          <span class="info-icon">
            🏪
          </span>

          <span>
            ${escapeHtml(
              job.retailerName ||
              job.retailerId ||
              "-"
            )}
          </span>

        </div>

      </div>


      <div class="job-divider"></div>


      <div class="job-actions">

        <button
          type="button"
          class="job-action view-btn"
          data-view-job="${escapeAttribute(job.id)}"
        >
          View / Edit
        </button>


        <button
          type="button"
          class="job-action assign-btn"
          data-assign-job="${escapeAttribute(job.id)}"
        >
          Assign Technician
        </button>

      </div>

    </div>

  `;

}


/* =====================================================
   BUTTONS
===================================================== */

function bindJobButtons() {

  document
    .querySelectorAll(
      "[data-view-job]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            openJobModal(
              button.dataset.viewJob
            );

          }
        );

      }
    );


  document
    .querySelectorAll(
      "[data-assign-job]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            openJobModal(
              button.dataset.assignJob
            );

          }
        );

      }
    );

}


/* =====================================================
   JOB MODAL
===================================================== */

function openJobModal(jobId) {

  const job =
    allJobs.find(
      item =>
        item.id === jobId
    );


  if (!job) {

    showError(
      "Job not found."
    );

    return;

  }


  selectedJobId =
    jobId;


  modalTitle.textContent =
    "Job Management";


  const currentTechnician =
    job.technicianId || "";


  modalContent.innerHTML = `

    <div class="form-field">

      <label>
        Job ID
      </label>

      <input
        type="text"
        value="${escapeAttribute(
          job.jobId ||
          job.id
        )}"
        readonly
      >

    </div>


    <div class="form-field">

      <label>
        Customer
      </label>

      <input
        type="text"
        value="${escapeAttribute(
          job.customerName ||
          "-"
        )}"
        readonly
      >

    </div>


    <div class="form-field">

      <label>
        Device
      </label>

      <input
        type="text"
        value="${escapeAttribute(
          getDeviceText(job)
        )}"
        readonly
      >

    </div>


    <div class="form-field">

      <label>
        Problem
      </label>

      <textarea id="editProblem">${escapeHtml(
        job.problem || ""
      )}</textarea>

    </div>


    <div class="form-field">

      <label>
        Technician
      </label>

      <select id="editTechnician">

        <option value="">
          -- Not Assigned --
        </option>

        ${
          technicians
            .map(
              technician => `

                <option
                  value="${escapeAttribute(
                    technician.uid
                  )}"
                  ${
                    technician.uid ===
                    currentTechnician
                      ? "selected"
                      : ""
                  }
                >
                  ${escapeHtml(
                    technician.name ||
                    technician.mobile ||
                    technician.uid
                  )}
                </option>

              `
            )
            .join("")
        }

      </select>

    </div>


    <div class="form-field">

      <label>
        Job Status
      </label>

      <select id="editStatus">

        ${statusOptions(
          job.status ||
          "NEW"
        )}

      </select>

    </div>

  `;


  modalBackdrop.classList.add(
    "show"
  );

}


/* =====================================================
   STATUS OPTIONS
===================================================== */

function statusOptions(current) {

  const statuses = [

    "NEW",
    "ASSIGNED",
    "IN PROGRESS",
    "DIAGNOSIS",
    "CUSTOMER APPROVAL",
    "REPAIR",
    "COMPLETED",
    "CANCELLED"

  ];


  return statuses
    .map(
      status => `

        <option
          value="${escapeAttribute(status)}"
          ${
            normalizeStatus(current) ===
            status
              ? "selected"
              : ""
          }
        >
          ${escapeHtml(
            formatStatus(status)
          )}
        </option>

      `
    )
    .join("");

}


/* =====================================================
   SAVE JOB
===================================================== */

saveJobBtn.addEventListener(
  "click",
  saveJob
);


async function saveJob() {

  if (!selectedJobId) {

    return;

  }


  const job =
    allJobs.find(
      item =>
        item.id ===
        selectedJobId
    );


  if (!job) {

    showError(
      "Job not found."
    );

    return;

  }


  const problem =
    document.getElementById(
      "editProblem"
    )?.value.trim() || "";


  const technicianId =
    document.getElementById(
      "editTechnician"
    )?.value || "";


  const status =
    document.getElementById(
      "editStatus"
    )?.value || "NEW";


  saveJobBtn.disabled =
    true;

  saveJobBtn.textContent =
    "Saving...";


  try {

    const technician =
      getTechnician(
        technicianId
      );


    const updateData = {

      problem,

      technicianId,

      technicianName:
        technician?.name ||
        "",

      status,

      updatedAt:
        serverTimestamp()

    };


    await updateDoc(

      doc(
        db,
        "jobs",
        selectedJobId
      ),

      updateData

    );


    /*
      Keep Service Request synchronized
      with technician assignment.
    */

    const requestId =
      job.requestId ||
      job.serviceRequestId;


    if (requestId) {

      const requestRef =
        doc(
          db,
          "service_requests",
          requestId
        );


      const requestSnapshot =
        await getDoc(
          requestRef
        );


      if (
        requestSnapshot.exists()
      ) {

        const requestUpdate = {

          updatedAt:
            serverTimestamp()

        };


        if (technicianId) {

          requestUpdate.status =
            "ASSIGNED";

        }


        await updateDoc(
          requestRef,
          requestUpdate
        );

      }

    }


    closeModal();

    await loadJobs();

    showSuccess(
      "Job updated successfully."
    );

  }
  catch (error) {

    console.error(
      "Job update error:",
      error
    );


    showError(
      getErrorMessage(error)
    );

  }
  finally {

    saveJobBtn.disabled =
      false;

    saveJobBtn.textContent =
      "Save Changes";

  }

}


/* =====================================================
   CLOSE MODAL
===================================================== */

function closeModal() {

  modalBackdrop.classList.remove(
    "show"
  );


  selectedJobId =
    null;


  modalContent.innerHTML =
    "";

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
      event.target ===
      modalBackdrop
    ) {

      closeModal();

    }

  }
);


/* =====================================================
   MORE MENU
===================================================== */

moreNavBtn.addEventListener(
  "click",
  event => {

    event.stopPropagation();

    morePanel.classList.toggle(
      "show"
    );

  }
);


document.addEventListener(
  "click",
  event => {

    if (
      morePanel.classList.contains(
        "show"
      ) &&
      !morePanel.contains(
        event.target
      ) &&
      event.target !== moreNavBtn
    ) {

      morePanel.classList.remove(
        "show"
      );

    }

  }
);


/* =====================================================
   TECHNICIAN
===================================================== */

function getTechnician(uid) {

  if (!uid) {

    return null;

  }


  return technicians.find(
    technician =>
      technician.uid === uid
  ) || null;

}


/* =====================================================
   DEVICE
===================================================== */

function getDeviceText(job) {

  const parts = [

    job.device,
    job.deviceBrand,
    job.deviceModel,
    job.screenSize
      ? `${job.screenSize}"`
      : null

  ]
    .filter(
      value =>
        value !== null &&
        value !== undefined &&
        String(value).trim() !== ""
    );


  if (
    parts.length > 0
  ) {

    return parts.join(" ");

  }


  return "Device not added";

}


/* =====================================================
   STATUS CLASS
===================================================== */

function getStatusClass(status) {

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
      return "status-new";

  }

}


/* =====================================================
   FORMAT STATUS
===================================================== */

function formatStatus(status) {

  return String(
    status || ""
  )
    .toLowerCase()
    .replace(
      /\b\w/g,
      letter =>
        letter.toUpperCase()
    );

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
   ERROR
===================================================== */

function getErrorMessage(error) {

  if (
    error?.code ===
    "permission-denied"
  ) {

    return "Firestore permission denied. Firebase Rules માં Admin access check કરો.";

  }


  if (
    error?.code ===
    "unauthenticated"
  ) {

    return "Your login session has expired. Please login again.";

  }


  if (
    error?.code ===
    "unavailable"
  ) {

    return "Firebase temporarily unavailable. Internet connection check કરો.";

  }


  if (
    error?.code ===
    "failed-precondition"
  ) {

    return "Firestore operation failed. Database configuration check કરો.";

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
    top:0,
    behavior:"smooth"
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
   ESCAPE HTML
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


/* =====================================================
   ESCAPE ATTRIBUTE
===================================================== */

function escapeAttribute(value) {

  return escapeHtml(
    value
  );

}
