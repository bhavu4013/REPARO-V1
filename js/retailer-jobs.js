import { auth, db } from "./firebase.js";

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

let jobs = [];

let technicians = {};


// =====================================================
// AUTH
// =====================================================

onAuthStateChanged(auth, async user => {

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
      profile.data().role !== "retailer"
    ) {

      location.href =
        "../index.html";

      return;

    }


    currentUser = user;


    await loadTechnicians();

    await loadJobs();

    render();

  } catch (error) {

    console.error(error);

    document.getElementById(
      "jobList"
    ).innerHTML =
      `
      <div class="empty">
        Unable to load jobs.
      </div>
      `;

  }

});


// =====================================================
// TECHNICIANS
// =====================================================

async function loadTechnicians() {

  technicians = {};


  try {

    const snap =
      await getDocs(
        collection(
          db,
          "users"
        )
      );


    snap.forEach(item => {

      const data =
        item.data();


      if (
        data.role ===
        "technician"
      ) {

        technicians[item.id] = {
          id: item.id,
          ...data
        };

      }

    });

  } catch (error) {

    console.error(
      "Technician loading error:",
      error
    );

  }

}


// =====================================================
// JOBS
// =====================================================

async function loadJobs() {

  jobs = [];


  const snap =
    await getDocs(
      query(
        collection(
          db,
          "jobs"
        ),
        where(
          "retailerId",
          "==",
          currentUser.uid
        )
      )
    );


  snap.forEach(item => {

    jobs.push({
      id: item.id,
      ...item.data()
    });

  });


  jobs.sort(
    (a, b) =>
      dateValue(b.createdAt) -
      dateValue(a.createdAt)
  );

}


// =====================================================
// RENDER
// =====================================================

function render() {

  renderSummary();

  renderJobs();

}


// =====================================================
// SUMMARY
// =====================================================

function renderSummary() {

  const active =
    jobs.filter(job => {

      const status =
        normalize(
          job.status
        );


      return ![
        "COMPLETED",
        "CANCELLED"
      ].includes(status);

    }).length;


  const approval =
    jobs.filter(job =>
      normalize(
        job.status
      ) ===
      "CUSTOMER APPROVAL"
    ).length;


  const completed =
    jobs.filter(job =>
      normalize(
        job.status
      ) ===
      "COMPLETED"
    ).length;


  document.getElementById(
    "totalJobs"
  ).textContent =
    jobs.length;


  document.getElementById(
    "activeJobs"
  ).textContent =
    active;


  document.getElementById(
    "approvalJobs"
  ).textContent =
    approval;


  document.getElementById(
    "completedJobs"
  ).textContent =
    completed;

}


// =====================================================
// JOB LIST
// =====================================================

function renderJobs() {

  const container =
    document.getElementById(
      "jobList"
    );


  const search =
    document.getElementById(
      "searchInput"
    ).value
      .trim()
      .toLowerCase();


  const filter =
    document.getElementById(
      "statusFilter"
    ).value;


  const filtered =
    jobs.filter(job => {

      const text =
        [
          job.jobId,
          job.jobNumber,
          job.customerName,
          job.customerMobile,
          job.deviceBrand,
          job.deviceModel,
          job.serialNumber,
          job.serviceType
        ]
          .join(" ")
          .toLowerCase();


      const matchesSearch =
        !search ||
        text.includes(search);


      const status =
        normalize(
          job.status
        );


      const matchesStatus =
        filter === "ALL" ||
        status === filter;


      return (
        matchesSearch &&
        matchesStatus
      );

    });


  if (!filtered.length) {

    container.innerHTML =
      `
      <div class="empty">
        ${
          search
            ? "No matching jobs found."
            : "No jobs found."
        }
      </div>
      `;

    return;

  }


  container.innerHTML =
    filtered
      .map(
        job =>
          createJobCard(job)
      )
      .join("");

}


// =====================================================
// JOB CARD
// =====================================================

function createJobCard(job) {

  const status =
    normalize(
      job.status ||
      "ASSIGNED"
    );


  const technician =
    technicians[
      job.technicianId
    ];


  const technicianName =
    technician?.name ||
    job.technicianName ||
    "Not assigned";


  const customer =
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


  const amount =
    getCustomerAmount(job);


  return `
    <div class="job-card">

      <div class="job-top">

        <div>

          <div class="job-number">
            ${escapeHtml(
              job.jobNumber ||
              job.jobId ||
              job.id
            )}
          </div>

          <div class="job-customer">
            ${escapeHtml(customer)}
            •
            ${escapeHtml(
              job.customerMobile ||
              "-"
            )}
          </div>

        </div>

        <span class="status status-${statusClass(status)}">
          ${escapeHtml(status)}
        </span>

      </div>


      <div class="job-grid">

        <div class="info-box">

          <span>Service</span>

          <strong>
            ${escapeHtml(
              job.serviceType ||
              "-"
            )}
          </strong>

        </div>


        <div class="info-box">

          <span>Device</span>

          <strong>
            ${escapeHtml(device)}
          </strong>

        </div>


        <div class="info-box">

          <span>Technician</span>

          <strong>
            ${escapeHtml(
              technicianName
            )}
          </strong>

        </div>


        <div class="info-box">

          <span>Invoice</span>

          <strong>
            ${escapeHtml(
              job.invoiceNumber ||
              (job.invoiceId
                ? "Generated"
                : "Pending")
            )}
          </strong>

        </div>

      </div>


      ${progressHTML(status)}


      <button
        class="job-action"
        onclick="viewJob('${job.id}')">

        View Job Details

      </button>

    </div>
  `;

}


// =====================================================
// PROGRESS
// =====================================================

function progressHTML(status) {

  const steps = [
    "ASSIGNED",
    "DIAGNOSIS",
    "CUSTOMER APPROVAL",
    "REPAIR",
    "COMPLETED"
  ];


  let index =
    steps.indexOf(
      status
    );


  if (index < 0) {

    if (
      status ===
      "IN PROGRESS"
    ) {

      index = 0;

    } else {

      index = 0;

    }

  }


  return `

    <div class="progress-wrap">

      <div class="progress-title">
        Service Progress
      </div>

      <div class="progress-line">

        ${steps.map(
          (_, i) => `
            <div class="progress-step ${
              i <= index
                ? "active"
                : ""
            }"></div>
          `
        ).join("")}

      </div>


      <div class="progress-labels">

        <span>Assigned</span>

        <span>Diagnosis</span>

        <span>Approval</span>

        <span>Repair</span>

        <span>Done</span>

      </div>

    </div>

  `;

}


// =====================================================
// VIEW JOB
// =====================================================

window.viewJob =
  function(jobId) {

    const job =
      jobs.find(
        item =>
          item.id ===
          jobId
      );


    if (!job)
      return;


    const status =
      normalize(
        job.status
      );


    const technician =
      technicians[
        job.technicianId
      ];


    const technicianName =
      technician?.name ||
      job.technicianName ||
      "Not assigned";


    const amount =
      getCustomerAmount(job);


    document.getElementById(
      "modalJobTitle"
    ).textContent =
      job.jobNumber ||
      job.jobId ||
      "Job Details";


    document.getElementById(
      "modalContent"
    ).innerHTML = `

      <!-- CUSTOMER -->

      <div class="detail-section">

        <h3>
          Customer
        </h3>

        <div class="job-grid">

          <div class="info-box">

            <span>Name</span>

            <strong>
              ${escapeHtml(
                job.customerName ||
                "-"
              )}
            </strong>

          </div>


          <div class="info-box">

            <span>Mobile</span>

            <strong>
              ${escapeHtml(
                job.customerMobile ||
                "-"
              )}
            </strong>

          </div>


          <div class="info-box full">

            <span>Address</span>

            <strong>
              ${escapeHtml(
                job.customerAddress ||
                "-"
              )}
            </strong>

          </div>

        </div>

      </div>


      <!-- DEVICE -->

      <div class="detail-section">

        <h3>
          Device
        </h3>

        <div class="job-grid">

          <div class="info-box">

            <span>Brand</span>

            <strong>
              ${escapeHtml(
                job.deviceBrand ||
                "-"
              )}
            </strong>

          </div>


          <div class="info-box">

            <span>Model</span>

            <strong>
              ${escapeHtml(
                job.deviceModel ||
                "-"
              )}
            </strong>

          </div>


          <div class="info-box">

            <span>Serial Number</span>

            <strong>
              ${escapeHtml(
                job.serialNumber ||
                "-"
              )}
            </strong>

          </div>


          <div class="info-box">

            <span>Service</span>

            <strong>
              ${escapeHtml(
                job.serviceType ||
                "-"
              )}
            </strong>

          </div>

        </div>

      </div>


      <!-- TECHNICIAN -->

      <div class="detail-section">

        <h3>
          Technician
        </h3>

        <div class="info-box">

          <span>Assigned Technician</span>

          <strong>
            ${escapeHtml(
              technicianName
            )}
          </strong>

        </div>

      </div>


      <!-- PROGRESS -->

      <div class="detail-section">

        <h3>
          Service Progress
        </h3>

        ${progressHTML(status)}

      </div>


      <!-- DIAGNOSIS -->

      <div class="detail-section">

        <h3>
          Diagnosis
        </h3>

        <div class="info-box">

          <strong>
            ${escapeHtml(
              job.diagnosis ||
              "Diagnosis not updated yet."
            )}
          </strong>

        </div>

      </div>


      <!-- CUSTOMER APPROVAL -->

      <div class="detail-section">

        <h3>
          Customer Approval
        </h3>

        <div class="info-box">

          <strong>
            ${
              job.customerApproval === true
                ? "APPROVED"
                : job.customerApproval === false
                  ? "REJECTED"
                  : "PENDING"
            }
          </strong>

        </div>

      </div>


      <!-- CUSTOMER AMOUNT -->

      <div class="detail-section">

        <h3>
          Customer Billing
        </h3>

        <div class="estimate-box">

          <span>
            Customer Amount
          </span>

          <strong>
            ${money(amount)}
          </strong>

        </div>

      </div>


      <!-- INVOICE -->

      <div class="detail-section">

        <h3>
          Invoice & Warranty
        </h3>

        <div class="job-grid">

          <div class="info-box">

            <span>Invoice</span>

            <strong>
              ${
                job.invoiceNumber ||
                (job.invoiceId
                  ? "Generated"
                  : "Pending")
              }
            </strong>

          </div>


          <div class="info-box">

            <span>Warranty</span>

            <strong>
              ${
                job.warrantyDays
                  ? job.warrantyDays + " Days"
                  : "Not set"
              }
            </strong>

          </div>

        </div>

      </div>


      <!-- PRIVACY -->

      <div class="privacy-note">

        <strong>
          Partner Privacy
        </strong>

        <br>

        You can view customer-facing
        service information, billing and
        warranty status.

        REPARO internal purchase cost,
        technician payout and actual
        profit are not included here.

      </div>

    `;


    document.getElementById(
      "jobModal"
    ).classList.add("show");

  };


// =====================================================
// CLOSE
// =====================================================

window.closeJob =
  function() {

    document.getElementById(
      "jobModal"
    ).classList.remove(
      "show"
    );

  };


// =====================================================
// SEARCH
// =====================================================

document.getElementById(
  "searchInput"
).addEventListener(
  "input",
  renderJobs
);


document.getElementById(
  "statusFilter"
).addEventListener(
  "change",
  renderJobs
);


// =====================================================
// CUSTOMER AMOUNT
// =====================================================

function getCustomerAmount(job) {

  if (
    job.finalTotal !==
    undefined &&
    job.finalTotal !==
    null
  ) {

    return Number(
      job.finalTotal
    );

  }


  if (
    job.totalAmount !==
    undefined &&
    job.totalAmount !==
    null
  ) {

    return Number(
      job.totalAmount
    );

  }


  const labour =
    Number(
      job.finalLabour ??
      job.labourCharge ??
      0
    );


  const parts =
    Number(
      job.finalParts ??
      job.partsAmount ??
      0
    );


  return labour + parts;

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

  return normalize(status)
    .toLowerCase()
    .replace(/\s+/g, "-");

}


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