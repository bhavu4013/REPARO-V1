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


const $ = id =>
  document.getElementById(id);


let jobs = [];
let technicians = [];


// ==================================================
// AUTH
// ==================================================

onAuthStateChanged(auth, async user => {

  if (!user) {
    location.href = "../index.html";
    return;
  }

  try {

    const profile =
      await getDoc(
        doc(db, "users", user.uid)
      );

    if (
      !profile.exists() ||
      profile.data().role !== "admin"
    ) {
      location.href = "../index.html";
      return;
    }

    await Promise.all([
      loadJobs(),
      loadTechnicians()
    ]);

  } catch (error) {

    console.error(error);

    $("loading").textContent =
      "Unable to load Jobs.";

  }

});


// ==================================================
// LOAD JOBS
// ==================================================

async function loadJobs() {

  $("loading").style.display = "block";

  try {

    const q = query(
      collection(db, "jobs"),
      orderBy("createdAt", "desc")
    );

    const snap =
      await getDocs(q);

    jobs =
      snap.docs.map(item => ({
        id: item.id,
        ...item.data()
      }));

  } catch (error) {

    console.warn(
      "Using fallback job query.",
      error
    );

    const snap =
      await getDocs(
        collection(db, "jobs")
      );

    jobs =
      snap.docs.map(item => ({
        id: item.id,
        ...item.data()
      }));

  }

  $("loading").style.display = "none";

  updateStats();
  renderJobs();

}


// ==================================================
// LOAD TECHNICIANS
// ==================================================

async function loadTechnicians() {

  const snap =
    await getDocs(
      collection(db, "technicians")
    );

  technicians =
    snap.docs
      .map(item => ({
        id: item.id,
        ...item.data()
      }))
      .filter(item =>
        item.active !== false
      );

}


// ==================================================
// STATS
// ==================================================

function updateStats() {

  $("totalJobs").textContent =
    jobs.length;


  $("newJobs").textContent =
    jobs.filter(
      j => j.status === "NEW"
    ).length;


  $("activeJobs").textContent =
    jobs.filter(j =>
      [
        "ASSIGNED",
        "IN PROGRESS",
        "DIAGNOSIS",
        "CUSTOMER APPROVAL",
        "REPAIR"
      ].includes(j.status)
    ).length;


  $("completedJobs").textContent =
    jobs.filter(
      j => j.status === "COMPLETED"
    ).length;

}


// ==================================================
// RENDER
// ==================================================

function renderJobs() {

  const search =
    $("searchInput")
      .value
      .trim()
      .toLowerCase();

  const status =
    $("statusFilter").value;


  const filtered =
    jobs.filter(job => {

      const searchable = [
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
        (!search ||
          searchable.includes(search)) &&
        (!status ||
          job.status === status)
      );

    });


  if (!filtered.length) {

    $("jobList").innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔧</div>
        <h3>No Jobs Found</h3>
        <p>
          No service jobs match your search.
        </p>
      </div>
    `;

    return;

  }


  $("jobList").innerHTML =
    filtered
      .map(jobCard)
      .join("");


  document
    .querySelectorAll("[data-view-job]")
    .forEach(button => {

      button.onclick = () =>
        viewJob(
          button.dataset.viewJob
        );

    });


  document
    .querySelectorAll("[data-edit-job]")
    .forEach(button => {

      button.onclick = () =>
        openEdit(
          button.dataset.editJob
        );

    });

}


// ==================================================
// JOB CARD
// ==================================================

function jobCard(job) {

  const technician =
    getTechnician(
      job.technicianId
    );


  const device =
    [
      job.deviceBrand,
      job.deviceModel
    ]
      .filter(Boolean)
      .join(" ") || "Device not specified";


  return `

    <article class="card job-card">

      <div class="card-header">

        <div>

          <div class="eyebrow">
            ${escapeHtml(
              job.jobId || job.id
            )}
          </div>

          <h3>
            ${escapeHtml(
              job.customerName ||
              "Unknown Customer"
            )}
          </h3>

          <p>
            ${escapeHtml(
              job.customerMobile || ""
            )}
          </p>

        </div>

        <span class="status-badge">
          ${escapeHtml(
            job.status || "NEW"
          )}
        </span>

      </div>


      <div class="card-info-grid">

        <div>
          <span>Service</span>
          <strong>
            ${escapeHtml(
              job.serviceType || "-"
            )}
          </strong>
        </div>


        <div>
          <span>Device</span>
          <strong>
            ${escapeHtml(device)}
          </strong>
        </div>


        <div>
          <span>Technician</span>
          <strong>
            ${escapeHtml(technician)}
          </strong>
        </div>


        <div>
          <span>Request ID</span>
          <strong>
            ${escapeHtml(
              job.requestId || "-"
            )}
          </strong>
        </div>

      </div>


      <div class="card-actions">

        <button
          data-view-job="${job.id}"
          class="secondary-btn">
          View
        </button>

        <button
          data-edit-job="${job.id}"
          class="primary-btn">
          Assign / Edit
        </button>

      </div>

    </article>

  `;

}


// ==================================================
// OPEN EDIT
// ==================================================

function openEdit(id) {

  const job =
    jobs.find(
      item => item.id === id
    );

  if (!job) return;


  $("editJobId").value =
    id;

  $("jobStatus").value =
    job.status || "NEW";

  $("adminNotes").value =
    job.adminNotes || "";


  const select =
    $("technicianSelect");


  select.innerHTML = `
    <option value="">
      Select Technician
    </option>
  `;


  technicians.forEach(technician => {

    const option =
      document.createElement("option");

    option.value =
      technician.id;

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

    select.appendChild(option);

  });


  $("jobModal")
    .classList
    .remove("hidden");

}


// ==================================================
// SAVE JOB
// ==================================================

$("jobForm")
  .addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      const id =
        $("editJobId").value;

      const technicianId =
        $("technicianSelect").value ||
        null;


      const technician =
        technicians.find(
          item =>
            item.id === technicianId
        );


      let status =
        $("jobStatus").value;


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
              $("adminNotes")
                .value
                .trim(),

            updatedAt:
              serverTimestamp()

          }
        );


        // ------------------------------------------
        // SERVICE REQUEST SYNC
        // ------------------------------------------

        const job =
          jobs.find(
            item => item.id === id
          );


        if (
          job?.requestId &&
          technicianId
        ) {

          try {

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

          } catch (error) {

            console.warn(
              "Service Request sync:",
              error
            );

          }

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


// ==================================================
// VIEW JOB
// ==================================================

function viewJob(id) {

  const job =
    jobs.find(
      item => item.id === id
    );

  if (!job) return;


  alert(

`JOB DETAILS

Job ID:
${job.jobId || job.id}

Request ID:
${job.requestId || "-"}

Customer:
${job.customerName || "-"}

Mobile:
${job.customerMobile || "-"}

Service:
${job.serviceType || "-"}

Device:
${job.deviceBrand || "-"} ${job.deviceModel || "-"}

Serial:
${job.serialNumber || "-"}

Retailer:
${job.retailerId || "-"}

Technician:
${getTechnician(job.technicianId)}

Status:
${job.status || "-"}

Problem:
${job.problem || "-"}

Admin Notes:
${job.adminNotes || "-"}`

  );

}


// ==================================================
// CLOSE MODAL
// ==================================================

$("closeModalBtn")
  .addEventListener(
    "click",
    closeModal
  );


$("cancelModalBtn")
  .addEventListener(
    "click",
    closeModal
  );


$("jobModal")
  .addEventListener(
    "click",
    event => {

      if (
        event.target ===
        $("jobModal")
      ) {
        closeModal();
      }

    }
  );


function closeModal() {

  $("jobModal")
    .classList
    .add("hidden");

}


// ==================================================
// FILTER
// ==================================================

$("searchInput")
  .addEventListener(
    "input",
    renderJobs
  );


$("statusFilter")
  .addEventListener(
    "change",
    renderJobs
  );


// ==================================================
// TECHNICIAN NAME
// ==================================================

function getTechnician(id) {

  if (!id) return "Not Assigned";


  const technician =
    technicians.find(
      item => item.id === id
    );


  if (!technician) {
    return id;
  }


  return (
    technician.name ||
    technician.fullName ||
    technician.mobile ||
    technician.id
  );

}


// ==================================================
// HTML ESCAPE
// ==================================================

function escapeHtml(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}