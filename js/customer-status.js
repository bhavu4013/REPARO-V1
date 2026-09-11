import { auth, db } from "../js/firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


let currentUser = null;
let currentJob = null;
let technician = null;


// =====================================================
// AUTH
// =====================================================

onAuthStateChanged(auth, async user => {

  if (!user) {

    location.href = "../index.html";

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


    if (!profileSnap.exists()) {

      showError(
        "Customer profile not found."
      );

      return;

    }


    const profile =
      profileSnap.data();


    if (profile.role !== "customer") {

      showError(
        "This page is only for customers."
      );

      return;

    }


    currentUser = user;


    await loadCustomerJob(
      profile
    );

  } catch (error) {

    console.error(error);

    showError(
      "Unable to load service."
    );

  }

});


// =====================================================
// FIND CUSTOMER JOB
// =====================================================

async function loadCustomerJob(profile) {

  const customerId =
    profile.customerId;


  if (!customerId) {

    showError(
      "Customer account is not linked."
    );

    return;

  }


  const jobSnap =
    await getDocs(
      query(
        collection(
          db,
          "jobs"
        ),
        where(
          "customerId",
          "==",
          customerId
        )
      )
    );


  if (jobSnap.empty) {

    showError(
      "No service job found."
    );

    return;

  }


  const list = [];


  jobSnap.forEach(item => {

    list.push({
      id: item.id,
      ...item.data()
    });

  });


  list.sort(
    (a,b) =>
      dateValue(b.createdAt) -
      dateValue(a.createdAt)
  );


  currentJob =
    list[0];


  await loadTechnician();

  render();

}


// =====================================================
// TECHNICIAN
// =====================================================

async function loadTechnician() {

  if (
    !currentJob.technicianId
  ) {

    return;

  }


  const snap =
    await getDoc(
      doc(
        db,
        "users",
        currentJob.technicianId
      )
    );


  if (snap.exists()) {

    technician =
      snap.data();

  }

}


// =====================================================
// RENDER
// =====================================================

function render() {

  const status =
    normalize(
      currentJob.status
    );


  document.getElementById(
    "jobNumber"
  ).textContent =
    currentJob.jobNumber ||
    currentJob.jobId ||
    currentJob.id;


  document.getElementById(
    "serviceType"
  ).textContent =
    currentJob.serviceType ||
    "Repair Service";


  document.getElementById(
    "statusBadge"
  ).textContent =
    status || "SERVICE";


  document.getElementById(
    "statusBadge"
  ).className =
    `status ${statusClass(status)}`;


  document.getElementById(
    "device"
  ).textContent =
    [
      currentJob.deviceBrand,
      currentJob.deviceModel
    ]
      .filter(Boolean)
      .join(" ") ||
    "Electronics Device";


  document.getElementById(
    "technicianName"
  ).textContent =
    technician?.name ||
    currentJob.technicianName ||
    "Not assigned";


  document.getElementById(
    "technicianService"
  ).textContent =
    currentJob.serviceType ||
    "Repair";


  document.getElementById(
    "diagnosis"
  ).textContent =
    currentJob.diagnosis ||
    "Diagnosis pending.";


  renderTimeline();


  document.getElementById(
    "estimateBtn"
  ).onclick =
    () => {

      location.href =
        `./estimate.html?jobId=${encodeURIComponent(currentJob.id)}`;

    };


  if (
    currentJob.invoiceId
  ) {

    const invoiceBtn =
      document.getElementById(
        "invoiceBtn"
      );


    invoiceBtn.style.display =
      "block";


    invoiceBtn.onclick =
      () => {

        location.href =
          `./invoice.html?invoiceId=${encodeURIComponent(currentJob.invoiceId)}`;

      };

  }


  document.getElementById(
    "loading"
  ).style.display =
    "none";


  document.getElementById(
    "content"
  ).style.display =
    "block";

}


// =====================================================
// TIMELINE
// =====================================================

function renderTimeline() {

  const status =
    normalize(
      currentJob.status
    );


  const steps = [

    {
      key: "ASSIGNED",
      label: "Technician Assigned",
      note: "Technician has been assigned."
    },

    {
      key: "DIAGNOSIS",
      label: "Diagnosis",
      note: "Device is being checked."
    },

    {
      key: "CUSTOMER APPROVAL",
      label: "Customer Approval",
      note: "Estimate requires your approval."
    },

    {
      key: "REPAIR",
      label: "Repair",
      note: "Repair work is in progress."
    },

    {
      key: "COMPLETED",
      label: "Completed",
      note: "Service has been completed."
    }

  ];


  let currentIndex =
    steps.findIndex(
      item =>
        item.key === status
    );


  if (
    status === "IN PROGRESS"
  ) {

    currentIndex = 1;

  }


  if (
    status === "NEW"
  ) {

    currentIndex = -1;

  }


  if (
    status === "CANCELLED"
  ) {

    currentIndex = -1;

  }


  document.getElementById(
    "timeline"
  ).innerHTML =
    steps
      .map(
        (step,index) => {

          const active =
            index <= currentIndex;


          const current =
            index === currentIndex;


          return `
            <div class="
              timeline-item
              ${active ? "active" : ""}
              ${current ? "current" : ""}
            ">

              <div class="timeline-dot"></div>

              <div>

                <div class="timeline-label">
                  ${escapeHtml(
                    step.label
                  )}
                </div>

                <div class="timeline-note">
                  ${escapeHtml(
                    step.note
                  )}
                </div>

              </div>

            </div>
          `;

        }
      )
      .join("");

}


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


function statusClass(status) {

  if (
    status === "COMPLETED"
  ) {

    return "status-done";

  }


  if (
    status === "CUSTOMER APPROVAL" ||
    status === "NEW"
  ) {

    return "status-wait";

  }


  if (
    status === "CANCELLED"
  ) {

    return "status-cancel";

  }


  return "status-active";

}


function dateValue(value) {

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
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");

}


function showError(message) {

  document.getElementById(
    "loading"
  ).textContent =
    message;

}