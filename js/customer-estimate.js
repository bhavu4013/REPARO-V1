import { auth, db } from "../js/firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


let currentJob = null;

const params =
  new URLSearchParams(
    location.search
  );

const jobId =
  params.get("jobId");


// =====================================================
// AUTH
// =====================================================

onAuthStateChanged(
  auth,
  async user => {

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
        profile.data().role !==
          "customer"
      ) {

        showError(
          "Customer access required."
        );

        return;

      }


      await loadJob(
        profile.data()
      );

    } catch (error) {

      console.error(error);

      showError(
        "Unable to load estimate."
      );

    }

  }
);


// =====================================================
// LOAD JOB
// =====================================================

async function loadJob(profile) {

  if (!jobId) {

    showError(
      "Job ID is missing."
    );

    return;

  }


  const snap =
    await getDoc(
      doc(
        db,
        "jobs",
        jobId
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


  if (
    job.customerId !==
    profile.customerId
  ) {

    showError(
      "You do not have access to this service."
    );

    return;

  }


  currentJob = {
    id: snap.id,
    ...job
  };


  render();

}


// =====================================================
// RENDER
// =====================================================

function render() {

  document.getElementById(
    "jobTitle"
  ).textContent =
    currentJob.jobNumber ||
    currentJob.jobId ||
    "Service Job";


  document.getElementById(
    "customer"
  ).textContent =
    currentJob.customerName ||
    "-";


  document.getElementById(
    "device"
  ).textContent =
    [
      currentJob.deviceBrand,
      currentJob.deviceModel
    ]
      .filter(Boolean)
      .join(" ") ||
    "-";


  document.getElementById(
    "problem"
  ).textContent =
    currentJob.problem ||
    currentJob.issue ||
    "-";


  document.getElementById(
    "diagnosis"
  ).textContent =
    currentJob.diagnosis ||
    "Diagnosis pending.";


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
      currentJob.estimateTotal ??
      labour + parts
    );


  document.getElementById(
    "labour"
  ).textContent =
    money(labour);


  document.getElementById(
    "parts"
  ).textContent =
    money(parts);


  document.getElementById(
    "total"
  ).textContent =
    money(total);


  renderApproval();

}


// =====================================================
// APPROVAL
// =====================================================

function renderApproval() {

  const approved =
    currentJob.customerApproval;


  const box =
    document.getElementById(
      "approvalStatus"
    );


  const actions =
    document.getElementById(
      "approvalActions"
    );


  if (approved === true) {

    box.className =
      "status approved";

    box.textContent =
      "REPAIR APPROVED";


    actions.innerHTML =
      `
      <div class="approval-box">
        You approved this repair.
        The technician can proceed with the repair.
      </div>
      `;


    return;

  }


  if (approved === false) {

    box.className =
      "status rejected";

    box.textContent =
      "ESTIMATE REJECTED";


    actions.innerHTML =
      `
      <div class="approval-box">
        This estimate was rejected.
        Please contact the service partner if
        you want to discuss the estimate.
      </div>
      `;


    return;

  }


  box.className =
    "status pending";

  box.textContent =
    "APPROVAL PENDING";

}


// =====================================================
// APPROVE
// =====================================================

document.getElementById(
  "approveBtn"
).addEventListener(
  "click",
  async () => {

    if (!currentJob)
      return;


    if (
      !confirm(
        "Approve this repair estimate?"
      )
    ) {

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

          customerApproval:
            true,

          customerApprovalAt:
            serverTimestamp(),

          status:
            "REPAIR",

          updatedAt:
            serverTimestamp()

        }
      );


      currentJob.customerApproval =
        true;


      currentJob.status =
        "REPAIR";


      renderApproval();


      alert(
        "Repair approved successfully."
      );


    } catch (error) {

      console.error(error);

      alert(
        "Unable to save approval."
      );

    }

  }
);


// =====================================================
// REJECT
// =====================================================

document.getElementById(
  "rejectBtn"
).addEventListener(
  "click",
  async () => {

    if (!currentJob)
      return;


    if (
      !confirm(
        "Reject this repair estimate?"
      )
    ) {

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

          customerApproval:
            false,

          customerApprovalAt:
            serverTimestamp(),

          status:
            "CUSTOMER APPROVAL",

          updatedAt:
            serverTimestamp()

        }
      );


      currentJob.customerApproval =
        false;


      currentJob.status =
        "CUSTOMER APPROVAL";


      renderApproval();


      alert(
        "Estimate rejected."
      );


    } catch (error) {

      console.error(error);

      alert(
        "Unable to save rejection."
      );

    }

  }
);


// =====================================================
// HELPERS
// =====================================================

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


function showError(message) {

  document.getElementById(
    "loading"
  ).textContent =
    message;

}