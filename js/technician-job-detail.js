import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
  auth,
  db
} from "./firebase.js";


/* =========================================================
   DOM
========================================================= */

const pageContainer =
  document.getElementById("pageContainer");

const headerJobId =
  document.getElementById("headerJobId");

const errorBox =
  document.getElementById("errorBox");

const successBox =
  document.getElementById("successBox");

const backBtn =
  document.getElementById("backBtn");


/* =========================================================
   STATE
========================================================= */

let technicianUser = null;

let technicianProfile = null;

let currentJob = null;

let jobId = null;


/* =========================================================
   JOB ID
========================================================= */

const params =
  new URLSearchParams(
    window.location.search
  );

jobId =
  params.get("jobId");


/* =========================================================
   BACK
========================================================= */

backBtn.addEventListener(
  "click",
  () => {

    window.location.href =
      "./jobs.html";

  }
);


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

        window.location.href =
          "../index.html";

        return;
      }


      const profile =
        snapshot.data();


      if (
        profile.role !== "technician" ||
        profile.active !== true
      ) {

        window.location.href =
          "../index.html";

        return;
      }


      technicianUser =
        user;

      technicianProfile =
        profile;


      if (!jobId) {

        showError(
          "Job ID is missing."
        );

        return;
      }


      await loadJob();

    } catch (error) {

      showError(
        error.message ||
        "Unable to open job."
      );

    }

  }
);


/* =========================================================
   LOAD JOB
========================================================= */

async function loadJob() {

  pageContainer.innerHTML = `
    <div class="loading">
      Loading job...
    </div>
  `;


  const jobRef =
    doc(
      db,
      "jobs",
      jobId
    );


  const snapshot =
    await getDoc(jobRef);


  if (!snapshot.exists()) {

    pageContainer.innerHTML = `
      <div class="loading">
        Job not found.
      </div>
    `;

    return;
  }


  currentJob = {
    id: snapshot.id,
    ...snapshot.data()
  };


  /*
    Extra client-side protection.

    Firestore rules provide the real security.
    This check prevents accidental display if
    somebody manually changes the URL.
  */

  if (
    currentJob.technicianId !==
    technicianUser.uid
  ) {

    pageContainer.innerHTML = `
      <div class="loading">
        This job is not assigned to you.
      </div>
    `;

    return;
  }


  headerJobId.textContent =
    currentJob.jobId ||
    currentJob.id;


  renderJob();

}


/* =========================================================
   RENDER JOB
========================================================= */

function renderJob() {

  const status =
    normalizeStatus(
      currentJob.status ||
      "ASSIGNED"
    );


  const approval =
    currentJob.customerApproval;


  pageContainer.innerHTML = `

    ${renderStatusCard(status)}

    ${renderCustomerCard()}

    ${renderDeviceCard()}

    ${renderDiagnosisCard()}

    ${renderEstimateCard()}

    ${renderApprovalCard(approval)}

    ${renderActionArea(status, approval)}

  `;


  bindEvents();

}


/* =========================================================
   STATUS CARD
========================================================= */

function renderStatusCard(
  status
) {

  const steps = [
    "ASSIGNED",
    "DIAGNOSIS",
    "CUSTOMER APPROVAL",
    "REPAIR",
    "COMPLETED"
  ];


  const currentIndex =
    getProgressIndex(
      status
    );


  return `

    <section class="card">

      <div class="status-wrap">

        <div>

          <h2 class="section-title">
            Job Status
          </h2>

          <div style="font-size:12px;color:#7b8494;">
            Keep the service status updated
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


      <div class="progress-line">

        ${steps
          .map(
            (_, index) =>
              `<div class="progress-step ${
                index <= currentIndex
                  ? "done"
                  : ""
              }"></div>`
          )
          .join("")}

      </div>

    </section>

  `;

}


/* =========================================================
   CUSTOMER
========================================================= */

function renderCustomerCard() {

  return `

    <section class="card">

      <h2 class="section-title">
        Customer
      </h2>


      ${infoRow(
        "Name",
        currentJob.customerName ||
        "-"
      )}


      ${infoRow(
        "Mobile",
        currentJob.customerMobile ||
        currentJob.mobile ||
        "-"
      )}


      ${infoRow(
        "Address",
        currentJob.customerAddress ||
        currentJob.address ||
        "-"
      )}

    </section>

  `;

}


/* =========================================================
   DEVICE
========================================================= */

function renderDeviceCard() {

  return `

    <section class="card">

      <h2 class="section-title">
        Device
      </h2>


      ${infoRow(
        "Device",
        getDeviceText(
          currentJob
        )
      )}


      ${infoRow(
        "Serial Number",
        currentJob.serialNumber ||
        "-"
      )}


      ${infoRow(
        "Service Type",
        currentJob.serviceType ||
        "Service"
      )}


      ${infoRow(
        "Problem",
        currentJob.problem ||
        "-"
      )}

    </section>

  `;

}


/* =========================================================
   DIAGNOSIS
========================================================= */

function renderDiagnosisCard() {

  return `

    <section class="card">

      <h2 class="section-title">
        Diagnosis
      </h2>


      <div class="form-field">

        <label>
          Diagnosis / Fault Found
        </label>

        <textarea
          id="diagnosisInput"
          placeholder="Enter diagnosis details..."
        >${escapeHtml(
          currentJob.diagnosis ||
          ""
        )}</textarea>

      </div>


      <div class="form-field">

        <label>
          Repair Notes
        </label>

        <textarea
          id="repairNotesInput"
          placeholder="Enter repair notes..."
        >${escapeHtml(
          currentJob.repairNotes ||
          ""
        )}</textarea>

      </div>

    </section>

  `;

}


/* =========================================================
   ESTIMATE
========================================================= */

function renderEstimateCard() {

  const labour =
    Number(
      currentJob.labourCharge ||
      currentJob.finalLabour ||
      0
    );


  const parts =
    Number(
      currentJob.partsAmount ||
      currentJob.finalParts ||
      0
    );


  const total =
    Number(
      currentJob.estimateTotal ||
      labour + parts
    );


  return `

    <section class="card">

      <h2 class="section-title">
        Estimate
      </h2>


      <div class="amount-grid">

        <div class="form-field">

          <label>
            Labour Charge (₹)
          </label>

          <input
            id="labourInput"
            type="number"
            min="0"
            step="1"
            value="${escapeAttribute(
              labour
            )}"
          >

        </div>


        <div class="form-field">

          <label>
            Parts Amount (₹)
          </label>

          <input
            id="partsInput"
            type="number"
            min="0"
            step="1"
            value="${escapeAttribute(
              parts
            )}"
          >

        </div>

      </div>


      <div class="total-box">

        <span class="total-label">
          Estimate Total
        </span>

        <span
          id="estimateTotal"
          class="total-value"
        >
          ₹${formatNumber(total)}
        </span>

      </div>

    </section>

  `;

}


/* =========================================================
   APPROVAL
========================================================= */

function renderApprovalCard(
  approval
) {

  let className =
    "";

  let text =
    "Customer approval is pending.";


  if (
    approval === true
  ) {

    className =
      "approved";

    text =
      "Customer has approved the repair.";

  }


  if (
    approval === false
  ) {

    className =
      "rejected";

    text =
      "Customer has not approved the repair.";

  }


  return `

    <section class="card">

      <h2 class="section-title">
        Customer Approval
      </h2>

      <div class="approval-box ${className}">
        ${escapeHtml(text)}
      </div>

    </section>

  `;

}


/* =========================================================
   ACTION AREA
========================================================= */

function renderActionArea(
  status,
  approval
) {

  if (
    status === "CANCELLED" ||
    status === "COMPLETED"
  ) {

    return "";

  }


  let buttonText =
    "Save Diagnosis & Estimate";

  let action =
    "save";


  if (
    status === "ASSIGNED" ||
    status === "IN PROGRESS"
  ) {

    buttonText =
      "Start Diagnosis";

    action =
      "diagnosis";

  }


  if (
    status === "DIAGNOSIS"
  ) {

    buttonText =
      "Send Estimate for Approval";

    action =
      "approval";

  }


  if (
    status === "CUSTOMER APPROVAL"
  ) {

    if (
      approval === true
    ) {

      buttonText =
        "Start Repair";

      action =
        "repair";

    } else {

      buttonText =
        "Refresh Approval Status";

      action =
        "refresh";

    }

  }


  if (
    status === "REPAIR"
  ) {

    buttonText =
      "Complete Job";

    action =
      "complete";

  }


  return `

    <div class="action-area">

      ${
        action !== "refresh"
          ? `
            <button
              id="saveBtn"
              class="primary-btn"
              type="button"
              data-action="${action}"
            >
              ${buttonText}
            </button>
          `
          : `
            <button
              id="saveBtn"
              class="secondary-btn"
              type="button"
              data-action="refresh"
            >
              Refresh Approval Status
            </button>
          `
      }

    </div>

  `;

}


/* =========================================================
   EVENTS
========================================================= */

function bindEvents() {

  const saveBtn =
    document.getElementById(
      "saveBtn"
    );


  if (saveBtn) {

    saveBtn.addEventListener(
      "click",
      handleAction
    );

  }


  const labourInput =
    document.getElementById(
      "labourInput"
    );

  const partsInput =
    document.getElementById(
      "partsInput"
    );


  if (
    labourInput &&
    partsInput
  ) {

    const updateTotal =
      () => {

        const labour =
          Number(
            labourInput.value
          ) || 0;

        const parts =
          Number(
            partsInput.value
          ) || 0;


        const total =
          labour + parts;


        document.getElementById(
          "estimateTotal"
        ).textContent =
          "₹" +
          formatNumber(total);

      };


    labourInput.addEventListener(
      "input",
      updateTotal
    );

    partsInput.addEventListener(
      "input",
      updateTotal
    );

  }

}


/* =========================================================
   HANDLE ACTION
========================================================= */

async function handleAction(
  event
) {

  const button =
    event.currentTarget;


  const action =
    button.dataset.action;


  if (
    action === "refresh"
  ) {

    await loadJob();

    return;

  }


  const diagnosis =
    document.getElementById(
      "diagnosisInput"
    )?.value.trim() ||
    "";


  const repairNotes =
    document.getElementById(
      "repairNotesInput"
    )?.value.trim() ||
    "";


  const labour =
    Number(
      document.getElementById(
        "labourInput"
      )?.value
    ) || 0;


  const parts =
    Number(
      document.getElementById(
        "partsInput"
      )?.value
    ) || 0;


  const estimateTotal =
    labour + parts;


  let newStatus =
    normalizeStatus(
      currentJob.status ||
      "ASSIGNED"
    );


  if (
    action === "diagnosis"
  ) {

    newStatus =
      "DIAGNOSIS";

  }


  if (
    action === "approval"
  ) {

    newStatus =
      "CUSTOMER APPROVAL";

  }


  if (
    action === "repair"
  ) {

    if (
      currentJob.customerApproval !==
      true
    ) {

      showError(
        "Customer approval is required before repair."
      );

      return;
    }


    newStatus =
      "REPAIR";

  }


  if (
    action === "complete"
  ) {

    newStatus =
      "COMPLETED";

  }


  button.disabled =
    true;

  button.textContent =
    "Saving...";


  try {

    /*
      IMPORTANT:

      Only fields allowed by the current
      Firestore technician update rule
      are written here.
    */

    const updateData = {

      diagnosis,

      labourCharge:
        labour,

      partsAmount:
        parts,

      estimateTotal:
        estimateTotal,

      repairNotes,

      status:
        newStatus,

      updatedAt:
        serverTimestamp()

    };


    if (
      action === "complete"
    ) {

      updateData.finalLabour =
        labour;

      updateData.finalParts =
        parts;

      updateData.finalTotal =
        estimateTotal;

      updateData.completedAt =
        serverTimestamp();

    }


    await updateDoc(
      doc(
        db,
        "jobs",
        jobId
      ),
      updateData
    );


    showSuccess(
      getSuccessMessage(
        action
      )
    );


    await loadJob();


  } catch (error) {

    showError(
      error.message ||
      "Unable to update job."
    );


    button.disabled =
      false;

    button.textContent =
      "Try Again";

  }

}


/* =========================================================
   SUCCESS MESSAGE
========================================================= */

function getSuccessMessage(
  action
) {

  switch (action) {

    case "diagnosis":
      return "Diagnosis started.";

    case "approval":
      return "Estimate sent for customer approval.";

    case "repair":
      return "Repair started.";

    case "complete":
      return "Job completed successfully.";

    default:
      return "Job updated successfully.";

  }

}


/* =========================================================
   INFO ROW
========================================================= */

function infoRow(
  label,
  value
) {

  return `

    <div class="info-row">

      <span class="info-label">
        ${escapeHtml(label)}
      </span>

      <span class="info-value">
        ${escapeHtml(value)}
      </span>

    </div>

  `;

}


/* =========================================================
   PROGRESS INDEX
========================================================= */

function getProgressIndex(
  status
) {

  const order = [

    "ASSIGNED",

    "IN PROGRESS",

    "DIAGNOSIS",

    "CUSTOMER APPROVAL",

    "REPAIR",

    "COMPLETED"

  ];


  const index =
    order.indexOf(
      normalizeStatus(status)
    );


  return index < 0
    ? 0
    : Math.min(
        4,
        index
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
    parts.length
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
   NUMBER
========================================================= */

function formatNumber(
  value
) {

  return Number(
    value || 0
  ).toLocaleString(
    "en-IN",
    {
      maximumFractionDigits: 2
    }
  );

}


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
   ESCAPE
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

  return escapeHtml(value);

}