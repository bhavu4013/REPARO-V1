import {
  onAuthStateChanged
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


const historyContainer =
  document.getElementById(
    "historyContainer"
  );

const totalCount =
  document.getElementById(
    "totalCount"
  );

const completedCount =
  document.getElementById(
    "completedCount"
  );

const backBtn =
  document.getElementById(
    "backBtn"
  );


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

      const userSnapshot =
        await getDoc(
          doc(
            db,
            "users",
            user.uid
          )
        );


      if (
        !userSnapshot.exists()
      ) {

        window.location.href =
          "./login.html";

        return;
      }


      customerProfile =
        userSnapshot.data();


      if (
        customerProfile.role !==
          "customer" ||
        customerProfile.active !==
          true
      ) {

        window.location.href =
          "./login.html";

        return;
      }


      await loadHistory();

    } catch (error) {

      showError(
        error.message ||
        "Unable to load service history."
      );

    }

  }
);


/* =========================================================
   LOAD HISTORY
========================================================= */

async function loadHistory() {

  historyContainer.innerHTML = `
    <div class="loading">
      Loading service history...
    </div>
  `;


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
    (a, b) =>
      getTime(
        b.completedAt ||
        b.createdAt ||
        b.updatedAt
      ) -
      getTime(
        a.completedAt ||
        a.createdAt ||
        a.updatedAt
      )
  );


  const completed =
    jobs.filter(
      job =>
        normalizeStatus(
          job.status
        ) === "COMPLETED"
    ).length;


  totalCount.textContent =
    jobs.length;


  completedCount.textContent =
    completed;


  if (
    jobs.length === 0
  ) {

    renderEmpty();

    return;
  }


  renderHistory();

}


/* =========================================================
   RENDER
========================================================= */

function renderHistory() {

  historyContainer.innerHTML =
    jobs
      .map(
        renderJob
      )
      .join("");


  document
    .querySelectorAll(
      "[data-status]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            const id =
              button.dataset.status;


            window.location.href =
              `./status.html?jobId=${encodeURIComponent(
                id
              )}`;

          }
        );

      }
    );


  document
    .querySelectorAll(
      "[data-invoice]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            const id =
              button.dataset.invoice;


            window.location.href =
              `./invoice.html?jobId=${encodeURIComponent(
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
      "NEW"
    );


  const finalTotal =
    getFinalAmount(
      job
    );


  const isCompleted =
    status ===
    "COMPLETED";


  return `

    <article class="card">

      <div class="job-top">

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
                job.completedAt ||
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


      <div class="device">
        ${escapeHtml(
          getDeviceText(job)
        )}
      </div>


      <div class="service">
        ${escapeHtml(
          job.serviceType ||
          "Electronics Service"
        )}
      </div>


      ${
        finalTotal > 0
          ? `

            <div class="amount">

              <span class="amount-label">
                Final Amount
              </span>

              <span class="amount-value">
                ${money(
                  finalTotal
                )}
              </span>

            </div>

          `
          : ""
      }


      <div class="actions">

        <button
          class="action-btn"
          type="button"
          data-status="${escapeAttribute(
            job.id
          )}"
        >
          View Status
        </button>


        ${
          isCompleted
            ? `
              <button
                class="action-btn primary"
                type="button"
                data-invoice="${escapeAttribute(
                  job.id
                )}"
              >
                View Invoice
              </button>
            `
            : `
              <button
                class="action-btn"
                type="button"
                data-status="${escapeAttribute(
                  job.id
                )}"
              >
                Track Service
              </button>
            `
        }

      </div>

    </article>

  `;

}


/* =========================================================
   FINAL AMOUNT
========================================================= */

function getFinalAmount(
  job
) {

  const values = [

    job.finalTotal,

    job.customerTotal,

    job.grandTotal,

    job.total

  ];


  for (
    const value of values
  ) {

    if (
      value !== undefined &&
      value !== null &&
      value !== "" &&
      Number.isFinite(
        Number(value)
      )
    ) {

      return Number(value);

    }

  }


  return 0;

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

    case "COMPLETED":
      return "completed";

    case "CANCELLED":
      return "cancelled";

    default:
      return "other";

  }

}


/* =========================================================
   DATE
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


function formatDate(
  value
) {

  const time =
    getTime(value);


  if (!time) {
    return "-";
  }


  return new Date(
    time
  ).toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }
  );

}


/* =========================================================
   MONEY
========================================================= */

function money(
  value
) {

  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2
    }
  ).format(
    Number(value) || 0
  );

}


/* =========================================================
   EMPTY
========================================================= */

function renderEmpty() {

  historyContainer.innerHTML = `

    <div class="empty">

      <div class="empty-icon">
        🧾
      </div>

      <div class="empty-title">
        No Service History
      </div>

      <div>
        Your completed and previous services
        will appear here.
      </div>

    </div>

  `;

}


/* =========================================================
   ERROR
========================================================= */

function showError(
  message
) {

  historyContainer.innerHTML = `

    <div class="empty">

      <div class="empty-icon">
        ⚠️
      </div>

      <div class="empty-title">
        Unable to Load
      </div>

      <div>
        ${escapeHtml(
          message
        )}
      </div>

    </div>

  `;

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


/* =========================================================
   BACK
========================================================= */

backBtn.addEventListener(
  "click",
  () => {

    window.location.href =
      "./status.html";

  }
);