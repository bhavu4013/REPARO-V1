import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
  auth,
  db
} from "./firebase.js";


/* =========================================================
   ELEMENTS
========================================================= */

const technicianName =
  document.getElementById("technicianName");

const totalJobs =
  document.getElementById("totalJobs");

const activeJobs =
  document.getElementById("activeJobs");

const completedJobs =
  document.getElementById("completedJobs");

const approvalJobs =
  document.getElementById("approvalJobs");

const jobsContainer =
  document.getElementById("jobsContainer");

const logoutBtn =
  document.getElementById("logoutBtn");

const homeNav =
  document.getElementById("homeNav");

const jobsNav =
  document.getElementById("jobsNav");

const earningsNav =
  document.getElementById("earningsNav");


/* =========================================================
   VARIABLES
========================================================= */

let currentUser = null;

let technicianProfile = null;

let jobs = [];


/* =========================================================
   AUTHENTICATION + TECHNICIAN SECURITY CHECK
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

      const profileSnapshot =
        await getDoc(
          doc(
            db,
            "users",
            user.uid
          )
        );


      if (!profileSnapshot.exists()) {

        await signOut(auth);

        window.location.href =
          "../index.html";

        return;
      }


      const profile =
        profileSnapshot.data();


      /*
       * Technician account must be:
       *
       * role = technician
       * active = true
       */

      if (
        profile.role !== "technician" ||
        profile.active !== true
      ) {

        await signOut(auth);

        alert(
          "Technician account is inactive or unauthorized."
        );

        window.location.href =
          "../index.html";

        return;
      }


      currentUser =
        user;

      technicianProfile =
        profile;


      technicianName.textContent =
        profile.name ||
        "Technician";


      await loadJobs();

    }

    catch (error) {

      console.error(
        "Technician dashboard error:",
        error
      );


      jobsContainer.innerHTML = `

        <div class="empty">
          Unable to load technician dashboard.
        </div>

      `;

    }

  }
);


/* =========================================================
   LOAD ONLY ASSIGNED TECHNICIAN JOBS
========================================================= */

async function loadJobs() {

  jobsContainer.innerHTML = `

    <div class="loading">
      Loading jobs...
    </div>

  `;


  const jobsQuery =
    query(
      collection(
        db,
        "jobs"
      ),
      where(
        "technicianId",
        "==",
        currentUser.uid
      )
    );


  const snapshot =
    await getDocs(
      jobsQuery
    );


  jobs = [];


  snapshot.forEach(
    item => {

      jobs.push({
        id: item.id,
        ...item.data()
      });

    }
  );


  jobs.sort(
    (a, b) =>
      getTime(
        b.updatedAt ||
        b.createdAt
      ) -
      getTime(
        a.updatedAt ||
        a.createdAt
      )
  );


  updateStats();

  renderJobs();

}


/* =========================================================
   DASHBOARD STATS
========================================================= */

function updateStats() {

  const completed =
    jobs.filter(
      job =>
        normalizeStatus(
          job.status
        ) === "COMPLETED"
    ).length;


  const approval =
    jobs.filter(
      job =>
        normalizeStatus(
          job.status
        ) === "CUSTOMER APPROVAL"
    ).length;


  const active =
    jobs.filter(
      job => {

        const status =
          normalizeStatus(
            job.status
          );


        return (
          status !== "COMPLETED" &&
          status !== "CANCELLED"
        );

      }
    ).length;


  totalJobs.textContent =
    jobs.length;

  activeJobs.textContent =
    active;

  completedJobs.textContent =
    completed;

  approvalJobs.textContent =
    approval;

}


/* =========================================================
   RECENT JOBS
========================================================= */

function renderJobs() {

  const recentJobs =
    jobs.slice(
      0,
      5
    );


  if (
    recentJobs.length === 0
  ) {

    jobsContainer.innerHTML = `

      <div class="empty">
        No jobs assigned yet.
      </div>

    `;

    return;
  }


  jobsContainer.innerHTML =
    recentJobs
      .map(
        job =>
          renderJob(job)
      )
      .join("");


  document
    .querySelectorAll("[data-job]")
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            const jobId =
              button.dataset.job;


            if (!jobId) {
              return;
            }


            window.location.href =
              `./job-detail.html?jobId=${encodeURIComponent(
                jobId
              )}`;

          }
        );

      }
    );

}


/* =========================================================
   JOB CARD
========================================================= */

function renderJob(job) {

  const status =
    normalizeStatus(
      job.status ||
      "ASSIGNED"
    );


  const jobId =
    job.jobId ||
    job.id;


  return `

    <div class="job">

      <div class="job-top">

        <div>

          <div class="job-id">
            ${escapeHtml(jobId)}
          </div>

          <div class="job-device">
            ${escapeHtml(
              getDeviceText(job)
            )}
          </div>

          <div class="job-service">
            ${escapeHtml(
              job.serviceType ||
              "Service"
            )}
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


      <button
        class="open-btn"
        type="button"
        data-job="${escapeAttribute(job.id)}"
      >
        Open Job
      </button>

    </div>

  `;

}


/* =========================================================
   DEVICE DISPLAY
========================================================= */

function getDeviceText(job) {

  const parts = [

    job.deviceBrand,

    job.deviceModel,

    job.screenSize
      ? `${job.screenSize}"`
      : null

  ].filter(Boolean);


  if (parts.length > 0) {

    return parts.join(" ");

  }


  return (
    job.device ||
    job.product ||
    "Electronics Device"
  );

}


/* =========================================================
   STATUS HELPERS
========================================================= */

function normalizeStatus(status) {

  return String(
    status ||
    "ASSIGNED"
  )
    .toUpperCase()
    .trim();

}


function formatStatus(status) {

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


function getStatusClass(status) {

  switch (
    normalizeStatus(status)
  ) {

    case "DIAGNOSIS":
      return "status-diagnosis";


    case "CUSTOMER APPROVAL":
      return "status-approval";


    case "REPAIR":
      return "status-repair";


    case "COMPLETED":
      return "status-completed";


    default:
      return "";

  }

}


/* =========================================================
   FIRESTORE TIMESTAMP
========================================================= */

function getTime(value) {

  if (!value) {
    return 0;
  }


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


  if (
    typeof value.seconds ===
    "number"
  ) {

    return value.seconds * 1000;

  }


  const date =
    new Date(value);


  return Number.isNaN(
    date.getTime()
  )
    ? 0
    : date.getTime();

}


/* =========================================================
   NAVIGATION
========================================================= */

homeNav.addEventListener(
  "click",
  () => {

    window.location.href =
      "./dashboard.html";

  }
);


jobsNav.addEventListener(
  "click",
  () => {

    window.location.href =
      "./jobs.html";

  }
);


earningsNav.addEventListener(
  "click",
  () => {

    window.location.href =
      "./earnings.html";

  }
);


/* =========================================================
   LOGOUT
========================================================= */

logoutBtn.addEventListener(
  "click",
  async () => {

    logoutBtn.disabled = true;

    logoutBtn.textContent =
      "Logging out...";


    try {

      await signOut(auth);

      window.location.href =
        "../index.html";

    }

    catch (error) {

      console.error(
        "Logout error:",
        error
      );

      logoutBtn.disabled = false;

      logoutBtn.textContent =
        "Logout";

    }

  }
);


/* =========================================================
   HTML ESCAPE
========================================================= */

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


function escapeAttribute(value) {

  return escapeHtml(value);

}