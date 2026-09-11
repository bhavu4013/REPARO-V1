import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  collection,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


const jobList = document.getElementById("jobList");
const loading = document.getElementById("loading");

const searchInput =
  document.getElementById("searchInput");

const statusFilter =
  document.getElementById("statusFilter");

const jobModal =
  document.getElementById("jobModal");

const jobForm =
  document.getElementById("jobForm");

const editJobId =
  document.getElementById("editJobId");

const jobStatus =
  document.getElementById("jobStatus");

const technicianSelect =
  document.getElementById("technicianSelect");

const adminNotes =
  document.getElementById("adminNotes");

const closeModalBtn =
  document.getElementById("closeModalBtn");


let jobs = [];
let technicians = [];


// --------------------------------------------------
// AUTH
// --------------------------------------------------

onAuthStateChanged(auth, async (user) => {

  if (!user) {
    window.location.href = "../index.html";
    return;
  }

  try {

    const snap = await getDoc(
      doc(db, "users", user.uid)
    );

    if (!snap.exists()) {
      window.location.href = "../index.html";
      return;
    }

    if (snap.data().role !== "admin") {
      window.location.href = "../index.html";
      return;
    }

    await Promise.all([
      loadJobs(),
      loadTechnicians()
    ]);

  } catch (error) {

    console.error(error);

    loading.textContent =
      "Unable to load Jobs.";

  }

});


// --------------------------------------------------
// LOAD JOBS
// --------------------------------------------------

async function loadJobs() {

  loading.style.display = "block";

  try {

    const q = query(
      collection(db, "jobs"),
      orderBy("createdAt", "desc")
    );

    const snap = await getDocs(q);

    jobs = snap.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));

  } catch (error) {

    console.warn(
      "Ordered query failed. Using fallback.",
      error
    );

    const snap = await getDocs(
      collection(db, "jobs")
    );

    jobs = snap.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));

    jobs.sort((a, b) =>
      (b.createdAt?.seconds || 0) -
      (a.createdAt?.seconds || 0)
    );

  }

  loading.style.display = "none";

  updateSummary();
  renderJobs();

}


// --------------------------------------------------
// LOAD TECHNICIANS
// --------------------------------------------------

async function loadTechnicians() {

  const snap = await getDocs(
    collection(db, "technicians")
  );

  technicians = snap.docs
    .map(item => ({
      id: item.id,
      ...item.data()
    }))
    .filter(item => item.active !== false);

}


// --------------------------------------------------
// SUMMARY
// --------------------------------------------------

function updateSummary() {

  document.getElementById(
    "totalJobs"
  ).textContent = jobs.length;


  document.getElementById(
    "newJobs"
  ).textContent =
    jobs.filter(
      job => job.status === "NEW"
    ).length;


  document.getElementById(
    "activeJobs"
  ).textContent =
    jobs.filter(job =>
      [
        "ASSIGNED",
        "IN PROGRESS",
        "DIAGNOSIS",
        "CUSTOMER APPROVAL",
        "REPAIR"
      ].includes(job.status)
    ).length;


  document.getElementById(
    "completedJobs"
  ).textContent =
    jobs.filter(
      job => job.status === "COMPLETED"
    ).length;

}


// --------------------------------------------------
// RENDER
// --------------------------------------------------

function renderJobs() {

  const search =
    searchInput.value
      .trim()
      .toLowerCase();

  const status =
    statusFilter.value;


  const filtered = jobs.filter(job => {

    const text = [
      job.jobId,
      job.requestId,
      job.customerName,
      job.customerMobile,
      job.deviceBrand,
      job.deviceModel,
      job.serialNumber,
      job.serviceType,
      job.retailerId
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();


    return (
      (!search || text.includes(search)) &&
      (!status || job.status === status)
    );

  });


  if (!filtered.length) {

    jobList.innerHTML =
      "<div class='empty-state'>No jobs found.</div>";

    return;

  }


  jobList.innerHTML =
    filtered.map(renderJob).join("");


  document
    .querySelectorAll("[data-edit]")
    .forEach(button => {

      button.onclick = () =>
        openEdit(button.dataset.edit);

    });


  document
    .querySelectorAll("[data-view]")
    .forEach(button => {

      button.onclick = () =>
        viewJob(button.dataset.view);

    });

}


// --------------------------------------------------
// JOB CARD
// --------------------------------------------------

function renderJob(job) {

  const technician =
    getTechnician(job.technicianId);


  return `

    <article class="card">

      <div class="card-header">

        <div>

          <strong>
            ${escapeHtml(
              job.jobId || job.id
            )}
          </strong>

          <h3>
            ${escapeHtml(
              job.customerName || "-"
            )}
          </h3>

          <small>
            ${escapeHtml(
              job.customerMobile || ""
            )}
          </small>

        </div>

        <span class="status-badge">
          ${escapeHtml(
            job.status || "NEW"
          )}
        </span>

      </div>


      <div class="card-details">

        <div>
          <small>Service</small>
          <strong>
            ${escapeHtml(
              job.serviceType || "-"
            )}
          </strong>
        </div>


        <div>
          <small>Device</small>
          <strong>
            ${escapeHtml(
              [
                job.deviceBrand,
                job.deviceModel
              ]
              .filter(Boolean)
              .join(" ") || "-"
            )}
          </strong>
        </div>


        <div>
          <small>Technician</small>
          <strong>
            ${escapeHtml(technician)}
          </strong>
        </div>


        <div>
          <small>Request ID</small>
          <strong>
            ${escapeHtml(
              job.requestId || "-"
            )}
          </strong>
        </div>

      </div>


      <div class="card-actions">

        <button
          data-view="${job.id}">
          View
        </button>

        <button
          data-edit="${job.id}"
          class="primary-btn">
          Assign / Edit
        </button>

      </div>

    </article>

  `;

}


// --------------------------------------------------
// EDIT
// --------------------------------------------------

function openEdit(id) {

  const job =
    jobs.find(item => item.id === id);

  if (!job) return;


  editJobId.value = id;

  jobStatus.value =
    job.status || "NEW";

  adminNotes.value =
    job.adminNotes || "";


  technicianSelect.innerHTML = `
    <option value="">
      -- Select Technician --
    </option>
  `;


  technicians.forEach(technician => {

    const option =
      document.createElement("option");

    option.value = technician.id;

    option.textContent =
      technician.name ||
      technician.fullName ||
      technician.mobile ||
      technician.id;

    if (
      technician.id ===
      job.technicianId
    ) {
      option.selected = true;
    }

    technicianSelect.appendChild(
      option
    );

  });


  jobModal.classList.remove("hidden");

}


// --------------------------------------------------
// SAVE
// --------------------------------------------------

jobForm.addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    const id =
      editJobId.value;

    const technicianId =
      technicianSelect.value || null;


    const technician =
      technicians.find(
        item =>
          item.id === technicianId
      );


    let status =
      jobStatus.value;


    if (
      technicianId &&
      status === "NEW"
    ) {
      status = "ASSIGNED";
    }


    try {

      await updateDoc(
        doc(db, "jobs", id),
        {

          status,

          technicianId,

          technicianName:
            technician
              ? (
                technician.name ||
                technician.fullName ||
                ""
              )
              : "",

          adminNotes:
            adminNotes.value.trim(),

          updatedAt:
            serverTimestamp()

        }
      );


      const job =
        jobs.find(item => item.id === id);


      // Synchronize Service Request

      if (
        job?.requestId &&
        technicianId
      ) {

        await updateDoc(
          doc(
            db,
            "service_requests",
            job.requestId
          ),
          {

            status: "ASSIGNED",

            updatedAt:
              serverTimestamp()

          }
        );

      }


      closeModal();

      await loadJobs();

      alert(
        "Job updated successfully."
      );


    } catch (error) {

      console.error(error);

      alert(
        "Unable to update Job.\n\n" +
        error.message
      );

    }

  }
);


// --------------------------------------------------
// VIEW
// --------------------------------------------------

function viewJob(id) {

  const job =
    jobs.find(item => item.id === id);

  if (!job) return;


  alert(

`JOB DETAILS

Job ID: ${job.jobId || job.id}

Request ID: ${job.requestId || "-"}

Customer: ${job.customerName || "-"}

Mobile: ${job.customerMobile || "-"}

Service: ${job.serviceType || "-"}

Device: ${job.deviceBrand || "-"} ${job.deviceModel || "-"}

Serial: ${job.serialNumber || "-"}

Retailer: ${job.retailerId || "-"}

Technician: ${getTechnician(job.technicianId)}

Status: ${job.status || "-"}

Problem:
${job.problem || "-"}

Admin Notes:
${job.adminNotes || "-"}`

  );

}


// --------------------------------------------------
// CLOSE
// --------------------------------------------------

closeModalBtn.onclick =
  closeModal;


jobModal.addEventListener(
  "click",
  event => {

    if (
      event.target === jobModal
    ) {
      closeModal();
    }

  }
);


function closeModal() {

  jobModal.classList.add("hidden");

}


// --------------------------------------------------
// FILTER
// --------------------------------------------------

searchInput.addEventListener(
  "input",
  renderJobs
);


statusFilter.addEventListener(
  "change",
  renderJobs
);


// --------------------------------------------------
// TECHNICIAN
// --------------------------------------------------

function getTechnician(id) {

  if (!id) return "-";

  const technician =
    technicians.find(
      item => item.id === id
    );

  if (!technician) return id;

  return (
    technician.name ||
    technician.fullName ||
    technician.mobile ||
    technician.id
  );

}


// --------------------------------------------------
// ESCAPE
// --------------------------------------------------

function escapeHtml(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}