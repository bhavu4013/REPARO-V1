import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


// ==================================================
// HELPERS
// ==================================================

const $ = id =>
  document.getElementById(id);


let currentUser = null;
let currentJob = null;


// ==================================================
// GET JOB ID
// ==================================================

const params =
  new URLSearchParams(
    window.location.search
  );

const jobDocumentId =
  params.get("id");


// ==================================================
// AUTH
// ==================================================

onAuthStateChanged(
  auth,
  async user => {

    if (!user) {

      window.location.href =
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
        profile.data().role !==
          "technician"
      ) {

        window.location.href =
          "../index.html";

        return;

      }


      currentUser = user;


      if (!jobDocumentId) {

        showError(
          "Job ID is missing."
        );

        return;

      }


      await loadJob();


    } catch (error) {

      console.error(error);

      showError(
        "Unable to load Job."
      );

    }

  }
);


// ==================================================
// LOAD JOB
// ==================================================

async function loadJob() {

  const snap =
    await getDoc(
      doc(
        db,
        "jobs",
        jobDocumentId
      )
    );


  if (!snap.exists()) {

    showError(
      "Job not found."
    );

    return;

  }


  const job =
    snap.data();


  // Security check:
  // Technician can open only assigned job.

  if (
    job.technicianId !==
    currentUser.uid
  ) {

    showError(
      "This Job is not assigned to you."
    );

    return;

  }


  currentJob = {
    id: snap.id,
    ...job
  };


  renderJob();


  $("loading").style.display =
    "none";

  $("jobContent")
    .classList
    .remove("hidden");


  setupWorkflow();

}


// ==================================================
// RENDER JOB
// ==================================================

function renderJob() {

  $("jobId").textContent =
    currentJob.jobId ||
    currentJob.id;


  $("requestId").textContent =
    currentJob.requestId ||
    "-";


  $("serviceType").textContent =
    currentJob.serviceType ||
    "-";


  $("customerName").textContent =
    currentJob.customerName ||
    "-";


  $("customerMobile").textContent =
    currentJob.customerMobile ||
    "-";


  $("customerAddress").textContent =
    currentJob.customerAddress ||
    "-";


  $("deviceTitle").textContent =
    [
      currentJob.deviceBrand,
      currentJob.deviceModel
    ]
      .filter(Boolean)
      .join(" ") ||
    "-";


  $("serialNumber").textContent =
    currentJob.serialNumber ||
    "-";


  $("screenSize").textContent =
    currentJob.screenSize ||
    "-";


  $("problem").textContent =
    currentJob.problem ||
    "No problem description";


  $("jobStatusBadge").textContent =
    currentJob.status ||
    "NEW";


  if (
    currentJob.diagnosis
  ) {

    $("diagnosis").value =
      currentJob.diagnosis;

  }


  if (
    currentJob.labourCharge != null
  ) {

    $("labourCharge").value =
      currentJob.labourCharge;

  }


  if (
    currentJob.partsAmount != null
  ) {

    $("partsAmount").value =
      currentJob.partsAmount;

  }


  if (
    currentJob.repairNotes
  ) {

    $("repairNotes").value =
      currentJob.repairNotes;

  }


  if (
    currentJob.finalLabour != null
  ) {

    $("finalLabour").value =
      currentJob.finalLabour;

  }


  if (
    currentJob.finalParts != null
  ) {

    $("finalParts").value =
      currentJob.finalParts;

  }


  updateEstimate();

  updateFinalTotal();

}


// ==================================================
// WORKFLOW STATE
// ==================================================

function setupWorkflow() {

  const status =
    currentJob.status ||
    "NEW";


  hideAllSections();


  // -----------------------------------------------
  // NEW
  // -----------------------------------------------

  if (status === "NEW") {

    $("startJobBtn")
      .classList
      .remove("hidden");

    return;

  }


  // -----------------------------------------------
  // ASSIGNED / IN PROGRESS
  // -----------------------------------------------

  if (
    status === "ASSIGNED" ||
    status === "IN PROGRESS"
  ) {

    $("diagnosisSection")
      .classList
      .remove("hidden");

    return;

  }


  // -----------------------------------------------
  // DIAGNOSIS
  // -----------------------------------------------

  if (
    status === "DIAGNOSIS"
  ) {

    $("diagnosisSection")
      .classList
      .remove("hidden");

    return;

  }


  // -----------------------------------------------
  // CUSTOMER APPROVAL
  // -----------------------------------------------

  if (
    status === "CUSTOMER APPROVAL"
  ) {

    $("approvalSection")
      .classList
      .remove("hidden");

    updateApprovalUI();

    return;

  }


  // -----------------------------------------------
  // REPAIR
  // -----------------------------------------------

  if (
    status === "REPAIR"
  ) {

    $("repairSection")
      .classList
      .remove("hidden");

    return;

  }


  // -----------------------------------------------
  // COMPLETED
  // -----------------------------------------------

  if (
    status === "COMPLETED"
  ) {

    $("completionSection")
      .classList
      .remove("hidden");

    $("completedTotal")
      .textContent =
      formatMoney(
        currentJob.finalTotal || 0
      );

  }

}


// ==================================================
// HIDE SECTIONS
// ==================================================

function hideAllSections() {

  [
    "diagnosisSection",
    "approvalSection",
    "repairSection",
    "completionSection"
  ]
  .forEach(id => {

    $(id)
      .classList
      .add("hidden");

  });


  $("startJobBtn")
    .classList
    .add("hidden");

}


// ==================================================
// START JOB
// ==================================================

$("startJobBtn")
  .addEventListener(
    "click",
    async () => {

      try {

        await updateDoc(
          doc(
            db,
            "jobs",
            currentJob.id
          ),
          {

            status:
              "IN PROGRESS",

            startedAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp()

          }
        );


        currentJob.status =
          "IN PROGRESS";


        $("jobStatusBadge")
          .textContent =
          "IN PROGRESS";


        setupWorkflow();


      } catch (error) {

        console.error(error);

        alert(
          "Unable to start Job."
        );

      }

    }
  );


// ==================================================
// ESTIMATE CALCULATION
// ==================================================

$("labourCharge")
  .addEventListener(
    "input",
    updateEstimate
  );


$("partsAmount")
  .addEventListener(
    "input",
    updateEstimate
  );


function updateEstimate() {

  const labour =
    Number(
      $("labourCharge").value
    ) || 0;


  const parts =
    Number(
      $("partsAmount").value
    ) || 0;


  const total =
    labour + parts;


  $("estimateTotal")
    .textContent =
    formatMoney(total);

}


// ==================================================
// SUBMIT DIAGNOSIS
// ==================================================

$("submitDiagnosisBtn")
  .addEventListener(
    "click",
    async () => {

      const diagnosis =
        $("diagnosis")
          .value
          .trim();


      const labour =
        Number(
          $("labourCharge").value
        ) || 0;


      const parts =
        Number(
          $("partsAmount").value
        ) || 0;


      if (!diagnosis) {

        alert(
          "Please enter diagnosis."
        );

        return;

      }


      const total =
        labour + parts;


      try {

        await updateDoc(
          doc(
            db,
            "jobs",
            currentJob.id
          ),
          {

            diagnosis,

            labourCharge:
              labour,

            partsAmount:
              parts,

            estimateTotal:
              total,

            status:
              "CUSTOMER APPROVAL",

            diagnosisAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp()

          }
        );


        currentJob.diagnosis =
          diagnosis;

        currentJob.labourCharge =
          labour;

        currentJob.partsAmount =
          parts;

        currentJob.estimateTotal =
          total;

        currentJob.status =
          "CUSTOMER APPROVAL";


        $("jobStatusBadge")
          .textContent =
          "CUSTOMER APPROVAL";


        setupWorkflow();


      } catch (error) {

        console.error(error);

        alert(
          "Unable to submit diagnosis."
        );

      }

    }
  );


// ==================================================
// APPROVAL RECEIVED
// ==================================================

$("approvalReceivedBtn")
  .addEventListener(
    "click",
    async () => {

      try {

        await updateDoc(
          doc(
            db,
            "jobs",
            currentJob.id
          ),
          {

            customerApproval:
              "APPROVED",

            customerApprovalAt:
              serverTimestamp(),

            status:
              "REPAIR",

            updatedAt:
              serverTimestamp()

          }
        );


        currentJob.customerApproval =
          "APPROVED";

        currentJob.status =
          "REPAIR";


        $("jobStatusBadge")
          .textContent =
          "REPAIR";


        setupWorkflow();


      } catch (error) {

        console.error(error);

        alert(
          "Unable to save approval."
        );

      }

    }
  );


// ==================================================
// APPROVAL REJECTED
// ==================================================

$("approvalRejectedBtn")
  .addEventListener(
    "click",
    async () => {

      try {

        await updateDoc(
          doc(
            db,
            "jobs",
            currentJob.id
          ),
          {

            customerApproval:
              "REJECTED",

            customerApprovalAt:
              serverTimestamp(),

            status:
              "CANCELLED",

            updatedAt:
              serverTimestamp()

          }
        );


        currentJob.status =
          "CANCELLED";


        $("jobStatusBadge")
          .textContent =
          "CANCELLED";


        hideAllSections();


        alert(
          "Customer rejected the repair."
        );


      } catch (error) {

        console.error(error);

        alert(
          "Unable to update approval."
        );

      }

    }
  );


// ==================================================
// REPAIR TOTAL
// ==================================================

$("finalLabour")
  .addEventListener(
    "input",
    updateFinalTotal
  );


$("finalParts")
  .addEventListener(
    "input",
    updateFinalTotal
  );


function updateFinalTotal() {

  const labour =
    Number(
      $("finalLabour").value
    ) || 0;


  const parts =
    Number(
      $("finalParts").value
    ) || 0;


  $("finalTotal")
    .textContent =
    formatMoney(
      labour + parts
    );

}


// ==================================================
// COMPLETE JOB
// ==================================================

$("completeJobBtn")
  .addEventListener(
    "click",
    async () => {

      const notes =
        $("repairNotes")
          .value
          .trim();


      const labour =
        Number(
          $("finalLabour").value
        ) || 0;


      const parts =
        Number(
          $("finalParts").value
        ) || 0;


      if (!notes) {

        alert(
          "Please enter final repair notes."
        );

        return;

      }


      const finalTotal =
        labour + parts;


      const confirmed =
        confirm(
          `Complete this Job?\n\nFinal Amount: ₹${finalTotal}`
        );


      if (!confirmed) {
        return;
      }


      try {

        await updateDoc(
          doc(
            db,
            "jobs",
            currentJob.id
          ),
          {

            repairNotes:
              notes,

            finalLabour:
              labour,

            finalParts:
              parts,

            finalTotal:
              finalTotal,

            status:
              "COMPLETED",

            completedAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp()

          }
        );


        currentJob.repairNotes =
          notes;

        currentJob.finalLabour =
          labour;

        currentJob.finalParts =
          parts;

        currentJob.finalTotal =
          finalTotal;

        currentJob.status =
          "COMPLETED";


        $("jobStatusBadge")
          .textContent =
          "COMPLETED";


        setupWorkflow();


        alert(
          "Job completed successfully."
        );


      } catch (error) {

        console.error(error);

        alert(
          "Unable to complete Job."
        );

      }

    }
  );


// ==================================================
// APPROVAL UI
// ==================================================

function updateApprovalUI() {

  const approval =
    currentJob.customerApproval;


  if (
    approval === "APPROVED"
  ) {

    $("approvalStatus")
      .textContent =
      "APPROVED";

  } else if (
    approval === "REJECTED"
  ) {

    $("approvalStatus")
      .textContent =
      "REJECTED";

  } else {

    $("approvalStatus")
      .textContent =
      "PENDING";

  }

}


// ==================================================
// MONEY
// ==================================================

function formatMoney(amount) {

  return (
    "₹" +
    Number(amount || 0)
      .toLocaleString("en-IN")
  );

}


// ==================================================
// ERROR
// ==================================================

function showError(message) {

  $("loading").textContent =
    message;

}