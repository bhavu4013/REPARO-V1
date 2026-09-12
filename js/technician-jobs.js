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

      const userSnapshot =
        await getDoc(
          doc(
            db,
            "users",
            user.uid
          )
        );


      if (!userSnapshot.exists()) {

        window.location.href =
          "../index.html";

        return;
      }


      const profile =
        userSnapshot.data();


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

    }

    catch (error) {

      console.error(
        "Technician job authorization error:",
        error
      );


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


  try {

    const jobSnapshot =
      await getDoc(
        doc(
          db,
          "jobs",
          jobId
        )
      );


    if (!jobSnapshot.exists()) {

      pageContainer.innerHTML = `
        <div class="loading">
          Job not found.
        </div>
      `;

      headerJobId.textContent =
        "Job Not Found";

      return;
    }


    currentJob = {

      id:
        jobSnapshot.id,

      ...jobSnapshot.data()

    };


    /*
     * Client-side protection.
     *
     * Firestore Rules remain the actual
     * security layer.
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

      headerJobId.textContent =
        "Access Denied";

      return;
    }


    headerJobId.textContent =
      currentJob.jobId ||
      currentJob.id;


    renderJob();

  }

  catch (error) {

    console.error(
      "Load job error:",
      error
    );


    pageContainer.innerHTML = `
      <div class="loading">
        Unable to load job.
      </div>
    `;


    showError(
      error.message ||
      "Unable to load job."
    );

  }

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

    ${renderDiagnosisCard(status)}

    ${renderEstimateCard(status)}

    ${renderApprovalCard(approval)}

    ${renderActionArea(
      status,
      approval
    )}

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
              `
                <div
                  class="progress-step ${
                    index <= currentIndex
                      ? "done"
                      : ""
                  }"
                ></div>
              `
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

  const mobile =
    currentJob.customerMobile ||
    currentJob.mobile ||
    "-";


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
        mobile
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

function renderDiagnosisCard(
  status
) {

  const locked =
    status === "COMPLETED" ||
    status === "CANCELLED";


  return `

    <section class="card">

      <h2 class="section-title">
        Diagnosis
      </h2>


      ${
        locked
          ? `
            <div class="locked-box">
              Diagnosis and repair notes are locked
              because this job is ${formatStatus(status)}.
            </div>
          `
          : `
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
          `
      }

    </section>

  `;

}


/* =========================================================
   ESTIMATE
========================================================= */

function renderEstimateCard(
  status
) {

  const labour =
    getNumber(
      currentJob.labourCharge,
      currentJob.finalLabour
    );


  const parts =
    getNumber(
      currentJob.partsAmount,
      currentJob.finalParts
    );


  const total =
    getNumber(
      currentJob.estimateTotal,
      labour + parts
    );


  const locked =
    status === "COMPLETED" ||
    status === "CANCELLED" ||
    status === "REPAIR";


  return `

    <section class="card">

      <h2 class="section-title">
        Estimate
      </h2>


      ${
        locked
          ? `
            ${infoRow(
              "Labour Charge",
              "₹" + formatNumber(labour)
            )}

            ${infoRow(
              "Parts Amount",
              "₹" + formatNumber(parts)
            )}

            <div class="total-box">

              <span class="total-label">
                Estimate Total
              </span>

              <span class="total-value">
                ₹${formatNumber(total)}
              </span>

            </div>
          `
          : `
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
          `
      }

    </section>

  `;

}


/* =========================================================
   APPROVAL
========================================================= */

function renderApprovalCard(
  approval
) {

  let className = "";

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


      <div
        class="approval-box ${className}"
      >
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
    status === "COMPLETED" ||
    status === "CANCELLED"
  ) {

    return "";

  }


  let buttonText =
    "";

  let action =
    "";


  /* -----------------------------------------------
     ASSIGNED / IN PROGRESS
  ------------------------------------------------ */

  if (
    status === "ASSIGNED" ||
    status === "IN PROGRESS"
  ) {

    buttonText =
      "Start Diagnosis";

    action =
      "diagnosis";

  }


  /* -----------------------------------------------
     DIAGNOSIS
  ------------------------------------------------ */

  else if (
    status === "DIAGNOSIS"
  ) {

    buttonText =
      "Send Estimate for Approval";

    action =
      "approval";

  }


  /* -----------------------------------------------
     CUSTOMER APPROVAL
  ------------------------------------------------ */

  else if (
    status === "CUSTOMER APPROVAL"
  ) {

    if (
      approval === true
    ) {

      buttonText =
        "Start Repair";

      action =
        "repair";

    }

    else {

      buttonText =
        "Refresh Approval Status";

      action =
        "refresh";

    }

  }


  /* -----------------------------------------------
     REPAIR
  ------------------------------------------------ */

  else if (
    status === "REPAIR"
  ) {

    buttonText =
      "Complete Job";

    action =
      "complete";

  }


  if (!action) {

    return "";

  }


  return `

    <div class="action-area">

      ${
        action === "refresh"
          ? `
            <button
              id="saveBtn"
              class="secondary-btn"
              type="button"
              data-action="refresh"
            >
              ${buttonText}
            </button>
          `
          : `
            <button
              id="saveBtn"
              class="primary-btn"
              type="button"
              data-action="${action}"
            >
              ${buttonText}
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


        const totalElement =
          document.getElementById(
            "estimateTotal"
          );


        if (totalElement) {

          totalElement.textContent =
            "₹" +
            formatNumber(total);

        }

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


  /* -----------------------------------------------
     REFRESH
  ------------------------------------------------ */

  if (
    action === "refresh"
  ) {

    await loadJob();

    return;

  }


  const currentStatus =
    normalizeStatus(
      currentJob.status ||
      "ASSIGNED"
    );


  const approval =
    currentJob.customerApproval;


  /*
   * Re-check workflow on the current
   * Firestore-loaded state.
   *
   * This prevents accidental status jumps.
   */

  if (
    action === "repair" &&
    approval !== true
  ) {

    showError(
      "Customer approval is required before repair."
    );

    return;

  }


  if (
    action === "diagnosis" &&
    ![
      "ASSIGNED",
      "IN PROGRESS"
    ].includes(currentStatus)
  ) {

    showError(
      "Diagnosis cannot be started from the current status."
    );

    return;

  }


  if (
    action === "approval" &&
    currentStatus !== "DIAGNOSIS"
  ) {

    showError(
      "Estimate approval cannot be requested from the current status."
    );

    return;

  }


  if (
    action === "repair" &&
    currentStatus !== "CUSTOMER APPROVAL"
  ) {

    showError(
      "Repair cannot be started from the current status."
    );

    return;

  }


  if (
    action === "complete" &&
    currentStatus !== "REPAIR"
  ) {

    showError(
      "Job can be completed only after repair starts."
    );

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
    currentStatus;


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
     * IMPORTANT:
     *
     * Only fields permitted by the current
     * Firestore technician update rule
     * are written.
     */

    const updateData = {

      status:
        newStatus,

      updatedAt:
        serverTimestamp()

    };


    /*
     * Diagnosis / Estimate data
     * is written while technician is
     * working on diagnosis/approval.
     */

    if (
      action === "diagnosis" ||
      action === "approval"
    ) {

      updateData.diagnosis =
        diagnosis;

      updateData.labourCharge =
        labour;

      updateData.partsAmount =
        parts;

      updateData.estimateTotal =
        estimateTotal;

      updateData.repairNotes =
        repairNotes;

    }


    /*
     * Repair stage:
     *
     * Keep existing estimate data.
     * No customerApproval field is modified.
     */

    if (
      action === "repair"
    ) {

      updateData.diagnosis =
        currentJob.diagnosis ||
        diagnosis;

      updateData.labourCharge =
        getNumber(
          currentJob.labourCharge,
          labour
        );

      updateData.partsAmount =
        getNumber(
          currentJob.partsAmount,
          parts
        );

      updateData.estimateTotal =
        getNumber(
          currentJob.estimateTotal,
          labour + parts
        );

      updateData.repairNotes =
        currentJob.repairNotes ||
        repairNotes;

    }


    /*
     * Completion:
     *
     * Store final customer-facing repair
     * amounts using the permitted fields.
     */

    if (
      action === "complete"
    ) {

      const finalLabour =
        getNumber(
          currentJob.labourCharge,
          currentJob.finalLabour,
          labour
        );


      const finalParts =
        getNumber(
          currentJob.partsAmount,
          currentJob.finalParts,
          parts
        );


      const finalTotal =
        finalLabour +
        finalParts;


      updateData.diagnosis =
        currentJob.diagnosis ||
        diagnosis;

      updateData.repairNotes =
        currentJob.repairNotes ||
        repairNotes;

      updateData.labourCharge =
        finalLabour;

      updateData.partsAmount =
        finalParts;

      updateData.estimateTotal =
        finalTotal;

      updateData.finalLabour =
        finalLabour;

      updateData.finalParts =
        finalParts;

      updateData.finalTotal =
        finalTotal;

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

  }

  catch (error) {

    console.error(
      "Job update error:",
      error
    );


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
   PROGRESS
========================================================= */

function getProgressIndex(
  status
) {

  const normalized =
    normalizeStatus(status);


  const order = [

    "ASSIGNED",

    "DIAGNOSIS",

    "CUSTOMER APPROVAL",

    "REPAIR",

    "COMPLETED"

  ];


  if (
    normalized === "IN PROGRESS"
  ) {

    return 0;

  }


  const index =
    order.indexOf(
      normalized
    );


  if (index < 0) {

    return 0;

  }


  return index;

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
   NUMBER HELPERS
========================================================= */

function getNumber(
  ...values
) {

  for (
    const value of values
  ) {

    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {

      const number =
        Number(value);


      if (
        Number.isFinite(number)
      ) {

        return number;

      }

    }

  }


  return 0;

}


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