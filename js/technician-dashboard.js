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


const technicianName =
  document.getElementById(
    "technicianName"
  );

const totalJobs =
  document.getElementById(
    "totalJobs"
  );

const activeJobs =
  document.getElementById(
    "activeJobs"
  );

const completedJobs =
  document.getElementById(
    "completedJobs"
  );

const approvalJobs =
  document.getElementById(
    "approvalJobs"
  );

const jobsContainer =
  document.getElementById(
    "jobsContainer"
  );

const logoutBtn =
  document.getElementById(
    "logoutBtn"
  );

const homeNav =
  document.getElementById(
    "homeNav"
  );

const jobsNav =
  document.getElementById(
    "jobsNav"
  );

const earningsNav =
  document.getElementById(
    "earningsNav"
  );


let currentUser = null;
let technicianProfile = null;
let jobs = [];


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

      const profileSnapshot =
        await getDoc(
          doc(
            db,
            "users",
            user.uid
          )
        );


      if (
        !profileSnapshot.exists()
      ) {

        await signOut(auth);

        window.location.href =
          "../index.html";

        return;
      }


      const profile =
        profileSnapshot.data();


      if (
        profile.role !==
          "technician" ||
        profile.active !==
          true
      ) {

        await signOut(auth);

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

    } catch (error) {

      jobsContainer.innerHTML = `

        <div class="empty">
          Unable to load technician dashboard.
        </div>

      `;

      console.error(
        error
      );

    }

  }
);


/* =========================================================
   LOAD JOBS
========================================================= */

async function loadJobs() {

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
   STATS
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
          status !==
            "COMPLETED" &&
          status !==
            "CANCELLED"
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
   RENDER
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
          renderJob(
            job
          )
      )
      .join("");


  document
    .querySelectorAll(
      "[data-job]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            const id =
              button.dataset.job;


            window.location.href =
              `./job-detail.html?jobId=${encodeURIComponent(
                id
              )}`;

          }
        );

      }
    );

}


/* =========================================================
   JOB CARD
========================================================= */

function renderJob(
  job
) {

  const status =
    normalizeStatus(
      job.status ||
      "ASSIGNED"
    );


  return `

    <div class="job">

      <div class="job-top">

        <div>

          <div class="job-id">
            ${escapeHtml(
              job.jobId ||
              job.id
            )}
          </div>

          <div class="job-device">
            ${escapeHtml(
              getDeviceText(
                job
              )
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
          class="status ${getStatusClass(
            status
          )}"
        >
          ${escapeHtml(
            formatStatus(
              status
            )
          )}
        </span>

      </div>


      <button
        class="open-btn"
        type="button"
        data-job="${escapeAttribute(
          job.id
        )}"
      >
        Open Job
      </button>

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

    return parts.join(
      " "
    );

  }


  return (
    job.device ||
    job.product ||
    "Electronics Device"
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
    "ASSIGNED"
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
    normalizeStatus(
      status
    )
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
   TIME
========================================================= */

function getTime(
  value
) {

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

    return value.toDate().getTime();

  }


  if (
    value.seconds
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

    try {

      await signOut(
        auth
      );

      window.location.href =
        "../index.html";

    } catch (error) {

      console.error(
        error
      );

    }

  }
);


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

  return escapeHtml(
    value
  );

}