import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
  auth,
  db
} from "./firebase.js";


/* =====================================================
   DOM
===================================================== */

const requestContainer =
  document.getElementById("requestContainer");

const searchInput =
  document.getElementById("searchInput");

const statusFilter =
  document.getElementById("statusFilter");

const totalCount =
  document.getElementById("totalCount");

const newCount =
  document.getElementById("newCount");

const jobCount =
  document.getElementById("jobCount");

const newRequestBtn =
  document.getElementById("newRequestBtn");

const logoutBtn =
  document.getElementById("logoutBtn");

const errorBox =
  document.getElementById("errorBox");

const successBox =
  document.getElementById("successBox");

const modalBg =
  document.getElementById("modalBg");

const closeModalBtn =
  document.getElementById("closeModal");

const cancelModalBtn =
  document.getElementById("cancelModal");

const requestForm =
  document.getElementById("requestForm");

const modalTitle =
  document.getElementById("modalTitle");

const saveBtn =
  document.getElementById("saveBtn");

const editRequestId =
  document.getElementById("editRequestId");

const customerName =
  document.getElementById("customerName");

const customerMobile =
  document.getElementById("customerMobile");

const customerAddress =
  document.getElementById("customerAddress");

const device =
  document.getElementById("device");

const deviceBrand =
  document.getElementById("deviceBrand");

const deviceModel =
  document.getElementById("deviceModel");

const serviceType =
  document.getElementById("serviceType");

const problem =
  document.getElementById("problem");

const moreNavBtn =
  document.getElementById("moreNavBtn");

const morePanel =
  document.getElementById("morePanel");

const moreOverlay =
  document.getElementById("moreOverlay");


/* =====================================================
   STATE
===================================================== */

let allRequests = [];

let adminUser = null;


/* =====================================================
   AUTH
===================================================== */

onAuthStateChanged(
  auth,
  async user => {

    if (!user) {

      window.location.href =
        "../index.html";

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


      if (!userSnapshot.exists()) {

        await signOut(auth);

        window.location.href =
          "../index.html";

        return;

      }


      const profile =
        userSnapshot.data();


      if (
        profile.role !== "admin" ||
        profile.active !== true
      ) {

        await signOut(auth);

        window.location.href =
          "../index.html";

        return;

      }


      adminUser =
        user;


      await loadRequests();

    }
    catch (error) {

      showLoadError(
        error
      );

    }

  }
);


/* =====================================================
   LOAD REQUESTS
===================================================== */

async function loadRequests() {

  showLoading();


  try {

    /*
      Firestore request.
      Admin has permission through the current
      Firestore rules.
    */

    const snapshot =
      await getDocs(
        collection(
          db,
          "service_requests"
        )
      );


    allRequests = [];


    snapshot.forEach(
      item => {

        allRequests.push({

          id:
            item.id,

          ...item.data()

        });

      }
    );


    sortRequests();


    updateSummary();

    renderRequests();

  }
  catch (error) {

    showLoadError(
      error
    );

  }

}


/* =====================================================
   SORT
===================================================== */

function sortRequests() {

  allRequests.sort(
    (a, b) => {

      const aTime =
        getTimestamp(
          a.createdAt
        );

      const bTime =
        getTimestamp(
          b.createdAt
        );

      return bTime - aTime;

    }
  );

}


/* =====================================================
   TIMESTAMP
===================================================== */

function getTimestamp(
  timestamp
) {

  if (!timestamp) {

    return 0;

  }


  if (
    typeof timestamp.toMillis ===
    "function"
  ) {

    return timestamp.toMillis();

  }


  if (
    typeof timestamp.seconds ===
    "number"
  ) {

    return (
      timestamp.seconds * 1000
    );

  }


  return 0;

}


/* =====================================================
   SUMMARY
===================================================== */

function updateSummary() {

  totalCount.textContent =
    allRequests.length;


  newCount.textContent =
    allRequests.filter(
      request =>
        normalizeStatus(
          request.status
        ) === "NEW"
    ).length;


  jobCount.textContent =
    allRequests.filter(
      request =>
        normalizeStatus(
          request.status
        ) === "CONVERTED TO JOB"
    ).length;

}


/* =====================================================
   STATUS
===================================================== */

function normalizeStatus(
  status
) {

  return String(
    status || "NEW"
  ).trim().toUpperCase();

}


/* =====================================================
   FILTER EVENTS
===================================================== */

searchInput.addEventListener(
  "input",
  renderRequests
);


statusFilter.addEventListener(
  "change",
  renderRequests
);


/* =====================================================
   RENDER
===================================================== */

function renderRequests() {

  const search =
    searchInput.value
      .trim()
      .toLowerCase();


  const selectedStatus =
    statusFilter.value;


  const filtered =
    allRequests.filter(
      request => {

        const searchable = [

          request.id,

          request.requestId,

          request.customerName,

          request.customerMobile,

          request.mobile,

          request.retailerName,

          request.retailerId,

          request.device,

          request.deviceBrand,

          request.deviceModel,

          request.problem,

          request.serviceType

        ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();


        const matchesSearch =
          !search ||
          searchable.includes(
            search
          );


        const matchesStatus =
          !selectedStatus ||
          normalizeStatus(
            request.status
          ) ===
          selectedStatus;


        return (
          matchesSearch &&
          matchesStatus
        );

      }
    );


  if (
    filtered.length === 0
  ) {

    requestContainer.innerHTML = `

      <div class="empty">

        <div class="empty-icon">
          📋
        </div>

        <div class="empty-title">
          No Service Requests
        </div>

        <div class="empty-text">
          No service requests found.
        </div>

      </div>

    `;

    return;

  }


  requestContainer.innerHTML = `

    <div class="request-list">

      ${filtered
        .map(
          renderRequest
        )
        .join("")}

    </div>

  `;


  bindRequestButtons();

}


/* =====================================================
   REQUEST CARD
===================================================== */

function renderRequest(
  request
) {

  const status =
    normalizeStatus(
      request.status
    );


  const statusClass =
    getStatusClass(
      status
    );


  const requestNumber =
    request.requestId ||
    request.id;


  const customer =
    request.customerName ||
    "Customer";


  const mobile =
    request.customerMobile ||
    request.mobile ||
    "-";


  const deviceText =
    getDevice(
      request
    );


  const retailer =
    request.retailerName ||
    request.retailerId ||
    "-";


  const service =
    request.serviceType ||
    "Service";


  const problemText =
    request.problem ||
    "No problem description";


  const canCreateJob =
    status !== "CONVERTED TO JOB" &&
    status !== "CANCELLED";


  return `

    <div class="request-card">

      <div class="request-top">

        <div>

          <h3 class="request-id">
            ${escapeHtml(
              requestNumber
            )}
          </h3>

          <div class="customer">
            ${escapeHtml(
              customer
            )}
          </div>

        </div>


        <span
          class="status ${statusClass}"
        >
          ${escapeHtml(
            formatStatus(
              status
            )
          )}
        </span>

      </div>


      <div class="request-info">

        <div class="info-row">

          <span class="info-icon">
            📱
          </span>

          <span>
            ${escapeHtml(
              mobile
            )}
          </span>

        </div>


        <div class="info-row">

          <span class="info-icon">
            📺
          </span>

          <span>
            ${escapeHtml(
              deviceText
            )}
          </span>

        </div>


        <div class="info-row">

          <span class="info-icon">
            🔧
          </span>

          <span>
            ${escapeHtml(
              service
            )}
          </span>

        </div>


        <div class="info-row">

          <span class="info-icon">
            🏪
          </span>

          <span>
            ${escapeHtml(
              retailer
            )}
          </span>

        </div>


        <div class="info-row">

          <span class="info-icon">
            📝
          </span>

          <span>
            ${escapeHtml(
              problemText
            )}
          </span>

        </div>

      </div>


      <div class="divider"></div>


      <div class="actions">

        <button
          class="action view"
          type="button"
          data-view-request="${escapeAttribute(
            request.id
          )}"
        >
          View / Edit
        </button>


        ${
          canCreateJob
            ? `

              <button
                class="action job"
                type="button"
                data-create-job="${escapeAttribute(
                  request.id
                )}"
              >
                Create Job
              </button>

            `
            : ""
        }

      </div>

    </div>

  `;

}


/* =====================================================
   BUTTON BINDING
===================================================== */

function bindRequestButtons() {

  document
    .querySelectorAll(
      "[data-view-request]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            openEdit(
              button.dataset.viewRequest
            );

          }
        );

      }
    );


  document
    .querySelectorAll(
      "[data-create-job]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            convertToJob(
              button.dataset.createJob
            );

          }
        );

      }
    );

}


/* =====================================================
   DEVICE
===================================================== */

function getDevice(
  request
) {

  const parts = [

    request.device,

    request.deviceBrand,

    request.deviceModel

  ]
  .filter(
    value =>
      value !== null &&
      value !== undefined &&
      String(value).trim() !== ""
  );


  if (
    parts.length > 0
  ) {

    return parts.join(
      " • "
    );

  }


  return "Device not added";

}


/* =====================================================
   STATUS CLASS
===================================================== */

function getStatusClass(
  status
) {

  switch (status) {

    case "NEW":
      return "status-new";

    case "CONTACTED":
      return "status-contacted";

    case "ACCEPTED":
      return "status-accepted";

    case "ASSIGNED":
      return "status-assigned";

    case "CONVERTED TO JOB":
      return "status-job";

    case "CANCELLED":
      return "status-cancelled";

    default:
      return "status-new";

  }

}


/* =====================================================
   STATUS DISPLAY
===================================================== */

function formatStatus(
  status
) {

  return String(
    status || ""
  )
    .toLowerCase()
    .replace(
      /\b\w/g,
      letter =>
        letter.toUpperCase()
    );

}


/* =====================================================
   NEW REQUEST
===================================================== */

newRequestBtn.addEventListener(
  "click",
  openNew
);


function openNew() {

  hideMessages();


  requestForm.reset();


  editRequestId.value =
    "";


  modalTitle.textContent =
    "New Service Request";


  saveBtn.textContent =
    "Create Request";


  modalBg.classList.add(
    "show"
  );


  customerName.focus();

}


/* =====================================================
   EDIT REQUEST
===================================================== */

function openEdit(
  id
) {

  hideMessages();


  const request =
    allRequests.find(
      item =>
        item.id === id
    );


  if (!request) {

    showError(
      "Service request not found."
    );

    return;

  }


  editRequestId.value =
    request.id;


  customerName.value =
    request.customerName ||
    "";


  customerMobile.value =
    request.customerMobile ||
    request.mobile ||
    "";


  customerAddress.value =
    request.customerAddress ||
    request.address ||
    "";


  device.value =
    request.device ||
    "";


  deviceBrand.value =
    request.deviceBrand ||
    "";


  deviceModel.value =
    request.deviceModel ||
    "";


  serviceType.value =
    request.serviceType ||
    "REPAIR";


  problem.value =
    request.problem ||
    "";


  modalTitle.textContent =
    "Edit Service Request";


  saveBtn.textContent =
    "Save Changes";


  modalBg.classList.add(
    "show"
  );

}


/* =====================================================
   SAVE REQUEST
===================================================== */

requestForm.addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    hideMessages();


    if (!adminUser) {

      showError(
        "Admin session મળી નથી."
      );

      return;

    }


    const editId =
      editRequestId.value.trim();


    const name =
      customerName.value.trim();


    const mobile =
      customerMobile.value.trim();


    if (!name) {

      showError(
        "Customer name required."
      );

      return;

    }


    if (
      !/^[0-9]{10}$/.test(
        mobile
      )
    ) {

      showError(
        "Mobile number must contain 10 digits."
      );

      return;

    }


    saveBtn.disabled =
      true;


    saveBtn.textContent =
      editId
        ? "Saving..."
        : "Creating...";


    try {

      const data = {

        customerName:
          name,

        customerMobile:
          mobile,

        customerAddress:
          customerAddress.value.trim(),

        device:
          device.value.trim(),

        deviceBrand:
          deviceBrand.value.trim(),

        deviceModel:
          deviceModel.value.trim(),

        serviceType:
          serviceType.value,

        problem:
          problem.value.trim()

      };


      if (editId) {

        await updateDoc(

          doc(
            db,
            "service_requests",
            editId
          ),

          {

            ...data,

            updatedAt:
              serverTimestamp()

          }

        );


        closeRequestModal();


        await loadRequests();


        showSuccess(
          "Service request updated successfully."
        );

      }
      else {

        await createRequest(
          data
        );

      }

    }
    catch (error) {

      showError(
        getErrorMessage(
          error
        )
      );

    }
    finally {

      saveBtn.disabled =
        false;

      saveBtn.textContent =
        editId
          ? "Save Changes"
          : "Create Request";

    }

  }
);


/* =====================================================
   CREATE REQUEST
===================================================== */

async function createRequest(
  data
) {

  const requestRef =
    await addDoc(

      collection(
        db,
        "service_requests"
      ),

      {

        ...data,

        requestId:
          "",

        status:
          "NEW",

        jobId:
          null,

        createdAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp(),

        createdBy:
          adminUser.uid

      }

    );


  await updateDoc(

    requestRef,

    {

      requestId:
        requestRef.id

    }

  );


  closeRequestModal();


  await loadRequests();


  showSuccess(
    "Service request created successfully."
  );

}


/* =====================================================
   CREATE JOB
===================================================== */

async function convertToJob(
  requestId
) {

  const request =
    allRequests.find(
      item =>
        item.id === requestId
    );


  if (!request) {

    showError(
      "Service request not found."
    );

    return;

  }


  if (
    request.jobId
  ) {

    showError(
      "Job already exists for this request."
    );

    return;

  }


  const confirmed =
    window.confirm(
      "Create a service job from this request?"
    );


  if (!confirmed) {

    return;

  }


  try {

    const jobRef =
      await addDoc(

        collection(
          db,
          "jobs"
        ),

        {

          requestId:
            request.id,

          serviceRequestId:
            request.id,

          customerId:
            request.customerId ||
            null,

          customerName:
            request.customerName ||
            "",

          customerMobile:
            request.customerMobile ||
            request.mobile ||
            "",

          customerAddress:
            request.customerAddress ||
            request.address ||
            "",

          retailerId:
            request.retailerId ||
            "",

          retailerName:
            request.retailerName ||
            "",

          device:
            request.device ||
            "",

          deviceBrand:
            request.deviceBrand ||
            "",

          deviceModel:
            request.deviceModel ||
            "",

          serviceType:
            request.serviceType ||
            "REPAIR",

          problem:
            request.problem ||
            "",

          status:
            "NEW",

          technicianId:
            "",

          technicianName:
            "",

          createdAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),

          createdBy:
            adminUser.uid

        }

      );


    await updateDoc(

      doc(
        db,
        "service_requests",
        requestId
      ),

      {

        jobId:
          jobRef.id,

        status:
          "CONVERTED TO JOB",

        updatedAt:
          serverTimestamp()

      }

    );


    await loadRequests();


    showSuccess(
      "Service job created successfully."
    );

  }
  catch (error) {

    showError(
      getErrorMessage(
        error
      )
    );

  }

}


/* =====================================================
   MODAL CLOSE
===================================================== */

function closeRequestModal() {

  modalBg.classList.remove(
    "show"
  );


  requestForm.reset();


  editRequestId.value =
    "";

}


closeModalBtn.addEventListener(
  "click",
  closeRequestModal
);


cancelModalBtn.addEventListener(
  "click",
  closeRequestModal
);


modalBg.addEventListener(
  "click",
  event => {

    if (
      event.target ===
      modalBg
    ) {

      closeRequestModal();

    }

  }
);


/* =====================================================
   MORE MENU
===================================================== */

moreNavBtn.addEventListener(
  "click",
  event => {

    event.stopPropagation();

    toggleMore();

  }
);


moreOverlay.addEventListener(
  "click",
  closeMore
);


function toggleMore() {

  const isOpen =
    morePanel.classList.contains(
      "show"
    );


  if (isOpen) {

    closeMore();

  }
  else {

    morePanel.classList.add(
      "show"
    );

    moreOverlay.classList.add(
      "show"
    );

  }

}


function closeMore() {

  morePanel.classList.remove(
    "show"
  );

  moreOverlay.classList.remove(
    "show"
  );

}


/* =====================================================
   LOGOUT
===================================================== */

logoutBtn.addEventListener(
  "click",
  async () => {

    try {

      await signOut(
        auth
      );


      window.location.href =
        "../index.html";

    }
    catch (error) {

      showError(
        getErrorMessage(
          error
        )
      );

    }

  }
);


/* =====================================================
   LOADING STATE
===================================================== */

function showLoading() {

  requestContainer.innerHTML = `

    <div class="loading">
      Loading service requests...
    </div>

  `;

}


/* =====================================================
   LOAD ERROR
===================================================== */

function showLoadError(
  error
) {

  console.error(
    "REPARO Service Requests Load Error:",
    error
  );


  requestContainer.innerHTML = `

    <div class="empty">

      <div class="empty-icon">
        ⚠️
      </div>

      <div class="empty-title">
        Unable to Load Requests
      </div>

      <div class="empty-text">
        ${escapeHtml(
          getErrorMessage(
            error
          )
        )}
      </div>

    </div>

  `;

}


/* =====================================================
   ERROR MESSAGE
===================================================== */

function getErrorMessage(
  error
) {

  if (
    error?.code ===
    "permission-denied"
  ) {

    return "Firestore permission denied. Firebase Rules માં Admin access check કરો.";

  }


  if (
    error?.code ===
    "unauthenticated"
  ) {

    return "Your login session has expired. Please login again.";

  }


  if (
    error?.code ===
    "unavailable"
  ) {

    return "Firebase temporarily unavailable. Internet connection check કરો.";

  }


  if (
    error?.code ===
    "failed-precondition"
  ) {

    return "Firestore operation failed. Database configuration check કરો.";

  }


  return (
    error?.message ||
    "Unable to complete the operation."
  );

}


/* =====================================================
   MESSAGES
===================================================== */

function hideMessages() {

  errorBox.style.display =
    "none";

  successBox.style.display =
    "none";

  errorBox.textContent =
    "";

  successBox.textContent =
    "";

}


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


/* =====================================================
   ESCAPE HTML
===================================================== */

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


/* =====================================================
   ESCAPE ATTRIBUTE
===================================================== */

function escapeAttribute(
  value
) {

  return escapeHtml(
    value
  );

}