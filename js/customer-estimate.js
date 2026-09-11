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

const content =
  document.getElementById(
    "content"
  );

const headerJobId =
  document.getElementById(
    "headerJobId"
  );

const errorBox =
  document.getElementById(
    "errorBox"
  );

const successBox =
  document.getElementById(
    "successBox"
  );

const backBtn =
  document.getElementById(
    "backBtn"
  );


/* =========================================================
   STATE
========================================================= */

let customerUser = null;

let customerProfile = null;

let currentJob = null;

let jobId = null;


/* =========================================================
   URL
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
      "./status.html";

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
        "./login.html";

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

        window.location.href =
          "./login.html";

        return;
      }


      const profile =
        snapshot.data();


      if (
        profile.role !== "customer" ||
        profile.active !== true
      ) {

        window.location.href =
          "./login.html";

        return;
      }


      customerUser =
        user;

      customerProfile =
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
        "Unable to open estimate."
      );

    }

  }
);


/* =========================================================
   LOAD JOB
========================================================= */

async function loadJob() {

  content.innerHTML = `
    <div class="loading">
      Loading estimate...
    </div>
  `;


  const jobRef =
    doc(
      db,
      "jobs",
      jobId
    );


  const snapshot =
    await getDoc(
      jobRef
    );


  if (!snapshot.exists()) {

    content.innerHTML = `
      <div class="loading">
        Estimate / Job not found.
      </div>
    `;

    return;
  }


  currentJob = {
    id: snapshot.id,
    ...snapshot.data()
  };


  /*
    Firestore rules are the real security
    boundary.

    This client-side check prevents an
    accidental mismatch as well.
  */

  if (
    currentJob.customerId !==
    customerProfile.customerId
  ) {

    content.innerHTML = `
      <div class="loading">
        This estimate does not belong to your account.
      </div>
    `;

    return;
  }


  headerJobId.textContent =
    currentJob.jobId ||
    currentJob.id;


  renderEstimate();

}


/* =========================================================
   RENDER
========================================================= */

function renderEstimate() {

  const status =
    normalizeStatus(
      currentJob.status
    );


  const approval =
    currentJob.customerApproval;


  const labour =
    Number(
      currentJob.labourCharge ??
      currentJob.finalLabour ??
      0
    );


  const parts =
    Number(
      currentJob.partsAmount ??
      currentJob.finalParts ??
      0
    );


  let total =
    Number(
      currentJob.estimateTotal
    );


  if (
    !Number.isFinite(total)
  ) {

    total =
      labour + parts;

  }


  content.innerHTML = `

    ${renderJobCard(status)}

    ${renderDeviceCard()}

    ${renderEstimateCard(
      labour,
      parts,
      total
    )}

    ${renderApprovalCard(
      approval,
      status
    )}

    ${renderActions(
      approval,
      status
    )}

  `;


  bindActions();

}


/* =========================================================
   JOB CARD
========================================================= */

function renderJobCard(
  status
) {

  return `

    <section class="card">

      <div class="job-header">

        <div>

          <div class="job-id">
            ${escapeHtml(
              currentJob.jobId ||
              currentJob.id
            )}
          </div>

          <div
            style="
              margin-top:5px;
              color:#7b8494;
              font-size:12px;
            "
          >
            Repair Estimate
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

    </section>

  `;

}


/* =========================================================
   DEVICE
========================================================= */

function renderDeviceCard() {

  return `

    <section class="card">

      <h2 class="card-title">
        Service Details
      </h2>


      ${infoRow(
        "Customer",
        currentJob.customerName ||
        "-"
      )}


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
        "Repair"
      )}


      ${infoRow(
        "Problem",
        currentJob.problem ||
        "-"
      )}


      ${
        currentJob.diagnosis
          ? infoRow(
              "Diagnosis",
              currentJob.diagnosis
            )
          : ""
      }

    </section>

  `;

}


/* =========================================================
   ESTIMATE CARD
========================================================= */

function renderEstimateCard(
  labour,
  parts,
  total
) {

  return `

    <section class="card">

      <h2 class="card-title">
        Estimate Breakdown
      </h2>


      <div class="amount-row">

        <span class="amount-label">
          Labour / Service
        </span>

        <span class="amount-value">
          ₹${formatNumber(
            labour
          )}
        </span>

      </div>


      <div class="amount-row">

        <span class="amount-label">
          Parts / Material
        </span>

        <span class="amount-value">
          ₹${formatNumber(
            parts
          )}
        </span>

      </div>


      <div class="total-row">

        <span class="total-label">
          Total Estimate
        </span>

        <span class="total-value">
          ₹${formatNumber(
            total
          )}
        </span>

      </div>

    </section>

  `;

}


/* =========================================================
   APPROVAL CARD
========================================================= */

function renderApprovalCard(
  approval,
  status
) {

  if (
    approval === true
  ) {

    return `

      <section class="card">

        <h2 class="card-title">
          Customer Approval
        </h2>

        <div class="approval-box approved">
          You have approved this repair estimate.
          The technician can proceed with the repair.
        </div>

      </section>

    `;

  }


  if (
    approval === false
  ) {

    return `

      <section class="card">

        <h2 class="card-title">
          Customer Approval
        </h2>

        <div class="approval-box rejected">
          You have declined this repair estimate.
          Please contact REPARO if you want to discuss
          the estimate.
        </div>

      </section>

    `;

  }


  return `

    <section class="card">

      <h2 class="card-title">
        Customer Approval
      </h2>

      <div class="approval-box">
        Please review the estimate and choose
        Approve Repair or Reject Estimate.
      </div>

    </section>

  `;

}


/* =========================================================
   ACTIONS
========================================================= */

function renderActions(
  approval,
  status
) {

  /*
    Approval buttons should only appear
    while the job is waiting for approval.
  */

  if (
    status !== "CUSTOMER APPROVAL" ||
    approval !== undefined &&
    approval !== null
  ) {

    return "";

  }


  return `

    <section class="card action-area">

      <button
        id="approveBtn"
        class="btn approve-btn"
        type="button"
      >
        Approve Repair
      </button>


      <button
        id="rejectBtn"
        class="btn reject-btn"
        type="button"
      >
        Reject Estimate
      </button>

    </section>

  `;

}


/* =========================================================
   BIND ACTIONS
========================================================= */

function bindActions() {

  const approveBtn =
    document.getElementById(
      "approveBtn"
    );


  const rejectBtn =
    document.getElementById(
      "rejectBtn"
    );


  if (approveBtn) {

    approveBtn.addEventListener(
      "click",
      approveEstimate
    );

  }


  if (rejectBtn) {

    rejectBtn.addEventListener(
      "click",
      rejectEstimate
    );

  }

}


/* =========================================================
   APPROVE
========================================================= */

async function approveEstimate() {

  const confirmed =
    window.confirm(
      "Approve this repair estimate and allow the technician to proceed?"
    );


  if (!confirmed) {

    return;

  }


  const button =
    document.getElementById(
      "approveBtn"
    );


  if (button) {

    button.disabled = true;

    button.textContent =
      "Approving...";

  }


  try {

    /*
      Customer is allowed by Firestore rules
      to update only:

        customerApproval
        customerApprovalAt
        status
        updatedAt

      This keeps the customer from changing
      any financial or ownership fields.
    */

    await updateDoc(
      doc(
        db,
        "jobs",
        jobId
      ),
      {
        customerApproval: true,

        customerApprovalAt:
          serverTimestamp(),

        status: "REPAIR",

        updatedAt:
          serverTimestamp()
      }
    );


    showSuccess(
      "Repair approved successfully."
    );


    await loadJob();


  } catch (error) {

    showError(
      error.message ||
      "Approval failed."
    );


    if (button) {

      button.disabled = false;

      button.textContent =
        "Approve Repair";

    }

  }

}


/* =========================================================
   REJECT
========================================================= */

async function rejectEstimate() {

  const confirmed =
    window.confirm(
      "Reject this repair estimate?"
    );


  if (!confirmed) {

    return;

  }


  const button =
    document.getElementById(
      "rejectBtn"
    );


  if (button) {

    button.disabled = true;

    button.textContent =
      "Rejecting...";

  }


  try {

    await updateDoc(
      doc(
        db,
        "jobs",
        jobId
      ),
      {
        customerApproval: false,

        customerApprovalAt:
          serverTimestamp(),

        status:
          "CUSTOMER APPROVAL",

        updatedAt:
          serverTimestamp()
      }
    );


    showSuccess(
      "Estimate rejected."
    );


    await loadJob();


  } catch (error) {

    showError(
      error.message ||
      "Unable to reject estimate."
    );


    if (button) {

      button.disabled = false;

      button.textContent =
        "Reject Estimate";

    }

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
        ${escapeHtml(
          label
        )}
      </span>

      <span class="info-value">
        ${escapeHtml(
          value
        )}
      </span>

    </div>

  `;

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

  const value =
    normalizeStatus(
      status
    );


  if (
    value === "CUSTOMER APPROVAL"
  ) {

    return "status-approval";

  }


  if (
    value === "REPAIR"
  ) {

    return "status-approved";

  }


  if (
    value === "CANCELLED"
  ) {

    return "status-rejected";

  }


  return "status-approval";

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