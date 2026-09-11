import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
  auth,
  db
} from "./firebase.js";


/* =========================================================
   DOM
========================================================= */

const statusContainer =
  document.getElementById(
    "statusContainer"
  );

const errorBox =
  document.getElementById(
    "errorBox"
  );

const successBox =
  document.getElementById(
    "successBox"
  );

const logoutBtn =
  document.getElementById(
    "logoutBtn"
  );


/* =========================================================
   STATE
========================================================= */

let customerUser = null;

let customerProfile = null;

let jobs = [];


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

        await signOut(auth);

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

        await signOut(auth);

        window.location.href =
          "./login.html";

        return;
      }


      customerUser =
        user;

      customerProfile =
        profile;


      await loadJobs();

    } catch (error) {

      showError(
        error.message ||
        "Unable to load service status."
      );

    }

  }
);


/* =========================================================
   LOAD CUSTOMER JOBS
========================================================= */

async function loadJobs() {

  statusContainer.innerHTML = `
    <div class="loading">
      Loading service status...
    </div>
  `;


  try {

    /*
      Customer security rule allows reading
      jobs belonging to currentUser.customerId.
    */

    const jobsQuery =
      query(
        collection(
          db,
          "jobs"
        ),
        where(
          "customerId",
          "==",
          customerProfile.customerId
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
      (a, b) => {

        const aTime =
          getTime(
            a.createdAt
          );

        const bTime =
          getTime(
            b.createdAt
          );

        return bTime - aTime;

      }
    );


    if (
      jobs.length === 0
    ) {

      renderEmpty();

      return;
    }


    renderJobs();


  } catch (error) {

    statusContainer.innerHTML = `
      <div class="empty">

        <div class="empty-icon">
          ⚠️
        </div>

        <div class="empty-title">
          Unable to Load
        </div>

        <div>
          ${escapeHtml(
            error.message ||
            "Service status could not be loaded."
          )}
        </div>

      </div>
    `;

  }

}


/* =========================================================
   RENDER JOBS
========================================================= */

function renderJobs() {

  statusContainer.innerHTML =
    jobs
      .map(
        renderJob
      )
      .join("");


  document
    .querySelectorAll(
      "[data-estimate]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            const id =
              button.dataset.estimate;


            window.location.href =
              `./estimate.html?jobId=${encodeURIComponent(
                id
              )}`;

          }
        );

      }
    );

}


/* =========================================================
   RENDER JOB
========================================================= */

function renderJob(
  job
) {

  const status =
    normalizeStatus(
      job.status ||
      "NEW"
    );


  const steps =
    getSteps();


  const currentIndex =
    getCurrentIndex(
      status
    );


  const approvalPending =
    status ===
    "CUSTOMER APPROVAL" &&
    job.customerApproval !== true &&
    job.customerApproval !== false;


  return `

    <section class="card">

      <div class="job-head">

        <div>

          <div class="job-id">
            ${escapeHtml(
              job.jobId ||
              job.id
            )}
          </div>

          <div class="job-date">
            ${escapeHtml(
              formatDate(
                job.createdAt
              )
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

    </section>


    <section class="card">

      <h2 class="section-title">
        Service Details
      </h2>


      ${infoRow(
        "Device",
        getDeviceText(job)
      )}


      ${infoRow(
        "Service",
        job.serviceType ||
        "Repair"
      )}


      ${infoRow(
        "Problem",
        job.problem ||
        "-"
      )}


      ${
        job.technicianName
          ? infoRow(
              "Technician",
              job.technicianName
            )
          : ""
      }

    </section>


    <section class="card">

      <h2 class="section-title">
        Service Progress
      </h2>


      <div class="timeline">

        ${steps
          .map(
            (
              step,
              index
            ) =>
              renderTimelineItem(
                step,
                index,
                currentIndex,
                status
              )
          )
          .join("")}

      </div>

    </section>


    ${
      approvalPending
        ? `

          <section class="approval-card">

            <h3>
              Estimate Ready for Approval
            </h3>

            <p>
              The technician has prepared an estimate.
              Please review it before repair starts.
            </p>

            <button
              class="estimate-btn"
              type="button"
              data-estimate="${escapeAttribute(
                job.id
              )}"
            >
              View Estimate & Approve
            </button>

          </section>

        `
        : ""
    }


    ${
      job.customerApproval === true
        ? `

          <section class="card">

            <div class="approval-card" style="margin:0;background:#e8f8ef;">

              <h3 style="color:#187a48;">
                Repair Approved
              </h3>

              <p style="color:#187a48;">
                Your approval has been recorded.
                The technician can proceed with the repair.
              </p>

              ${
                status === "REPAIR"
                  ? `
                    <button
                      class="estimate-btn secondary"
                      type="button"
                      data-estimate="${escapeAttribute(
                        job.id
                      )}"
                    >
                      View Estimate
                    </button>
                  `
                  : ""
              }

            </div>

          </section>

        `
        : ""
    }


    ${
      job.customerApproval === false
        ? `

          <section class="card">

            <div class="approval-card" style="margin:0;background:#fff0f1;">

              <h3 style="color:#c62845;">
                Estimate Rejected
              </h3>

              <p style="color:#c62845;">
                The estimate was not approved.
                Please contact REPARO for further assistance.
              </p>

            </div>

          </section>

        `
        : ""
    }


    ${
      status === "COMPLETED"
        ? `

          <section class="card">

            <h2 class="section-title">
              Service Completed
            </h2>

            <div
              style="
                background:#e8f8ef;
                color:#187a48;
                padding:13px;
                border-radius:13px;
                font-size:13px;
                line-height:1.5;
              "
            >
              Your service job has been completed successfully.
            </div>

            ${
              Number(
                job.finalTotal
              ) > 0
                ? `
                  <button
                    class="estimate-btn"
                    type="button"
                    data-estimate="${escapeAttribute(
                      job.id
                    )}"
                  >
                    View Final Amount
                  </button>
                `
                : ""
            }

          </section>

        `
        : ""
    }

  `;

}


/* =========================================================
   TIMELINE
========================================================= */

function getSteps() {

  return [

    {
      key: "ASSIGNED",
      title: "Technician Assigned",
      text: "A technician has been assigned to your service."
    },

    {
      key: "DIAGNOSIS",
      title: "Diagnosis",
      text: "The technician is checking the device."
    },

    {
      key: "CUSTOMER APPROVAL",
      title: "Estimate & Approval",
      text: "Review the estimate before repair."
    },

    {
      key: "REPAIR",
      title: "Repair",
      text: "Repair work is in progress."
    },

    {
      key: "COMPLETED",
      title: "Completed",
      text: "Your service has been completed."
    }

  ];

}


function renderTimelineItem(
  step,
  index,
  currentIndex,
  status
) {

  const done =
    index < currentIndex ||
    status === "COMPLETED";


  const current =
    index === currentIndex &&
    status !== "COMPLETED" &&
    status !== "CANCELLED";


  return `

    <div
      class="timeline-item ${
        done
          ? "done"
          : ""
      } ${
        current
          ? "current"
          : ""
      }"
    >

      <div class="timeline-dot"></div>

      <div class="timeline-content">

        <div class="timeline-title">
          ${escapeHtml(
            step.title
          )}
        </div>

        <div class="timeline-text">
          ${escapeHtml(
            step.text
          )}
        </div>

      </div>

    </div>

  `;

}


/* =========================================================
   CURRENT INDEX
========================================================= */

function getCurrentIndex(
  status
) {

  const value =
    normalizeStatus(
      status
    );


  switch (value) {

    case "NEW":
      return 0;

    case "ASSIGNED":
      return 0;

    case "IN PROGRESS":
      return 0;

    case "DIAGNOSIS":
      return 1;

    case "CUSTOMER APPROVAL":
      return 2;

    case "REPAIR":
      return 3;

    case "COMPLETED":
      return 4;

    case "CANCELLED":
      return -1;

    default:
      return 0;

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

  switch (
    normalizeStatus(
      status
    )
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
   DATE
========================================================= */

function formatDate(
  value
) {

  if (!value) {

    return "-";

  }


  try {

    let date;


    if (
      typeof value.toDate ===
      "function"
    ) {

      date =
        value.toDate();

    } else if (
      value.seconds
    ) {

      date =
        new Date(
          value.seconds * 1000
        );

    } else {

      date =
        new Date(value);

    }


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {

      return "-";

    }


    return date.toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric"
      }
    );

  } catch {

    return "-";

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
   EMPTY
========================================================= */

function renderEmpty() {

  statusContainer.innerHTML = `

    <div class="empty">

      <div class="empty-icon">
        🔧
      </div>

      <div class="empty-title">
        No Active Service
      </div>

      <div>
        You currently have no service jobs available.
      </div>

    </div>

  `;

}


/* =========================================================
   LOGOUT
========================================================= */

logoutBtn.addEventListener(
  "click",
  async () => {

    try {

      await signOut(auth);

      window.location.href =
        "./login.html";

    } catch (error) {

      showError(
        error.message ||
        "Logout failed."
      );

    }

  }
);


/* =========================================================
   MESSAGE
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

  return escapeHtml(
    value
  );

}