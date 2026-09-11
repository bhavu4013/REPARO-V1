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

const totalRequests =
  document.getElementById("totalRequests");

const newRequests =
  document.getElementById("newRequests");

const activeRequests =
  document.getElementById("activeRequests");

const convertedRequests =
  document.getElementById("convertedRequests");

const addRequestBtn =
  document.getElementById("addRequestBtn");

const logoutBtn =
  document.getElementById("logoutBtn");

const errorBox =
  document.getElementById("errorBox");

const successBox =
  document.getElementById("successBox");

const modalBackdrop =
  document.getElementById("modalBackdrop");

const closeModalBtn =
  document.getElementById("closeModalBtn");

const cancelBtn =
  document.getElementById("cancelBtn");

const requestForm =
  document.getElementById("requestForm");

const modalTitle =
  document.getElementById("modalTitle");

const saveBtn =
  document.getElementById("saveBtn");

const editRequestId =
  document.getElementById("editRequestId");

const customerId =
  document.getElementById("customerId");

const customerName =
  document.getElementById("customerName");

const customerMobile =
  document.getElementById("customerMobile");

const deviceBrand =
  document.getElementById("deviceBrand");

const deviceModel =
  document.getElementById("deviceModel");

const serialNumber =
  document.getElementById("serialNumber");

const serviceType =
  document.getElementById("serviceType");

const problem =
  document.getElementById("problem");

const retailerId =
  document.getElementById("retailerId");

const moreNavBtn =
  document.getElementById("moreNavBtn");

const morePanel =
  document.getElementById("morePanel");


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


      adminUser = user;

      await loadRequests();

    }
    catch (error) {

      console.error(
        "Admin authentication error:",
        error
      );

      showLoadError(error);

    }

  }
);


/* =====================================================
   LOAD REQUESTS
===================================================== */

async function loadRequests() {

  showLoading();

  try {

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

          id: item.id,

          ...item.data()

        });

      }
    );


    sortRequests();

    updateSummary();

    renderRequests();

  }
  catch (error) {

    console.error(
      "Load service requests error:",
      error
    );

    showLoadError(error);

  }

}


/* =====================================================
   SORT REQUESTS
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

function getTimestamp(timestamp) {

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

    return timestamp.seconds * 1000;

  }


  return 0;

}


/* =====================================================
   SUMMARY
===================================================== */

function updateSummary() {

  if (totalRequests) {

    totalRequests.textContent =
      allRequests.length;

  }


  const newTotal =
    allRequests.filter(
      request =>
        normalizeStatus(
          request.status
        ) === "NEW"
    ).length;


  const convertedTotal =
    allRequests.filter(
      request =>
        normalizeStatus(
          request.status
        ) === "CONVERTED TO JOB"
    ).length;


  const activeTotal =
    allRequests.filter(
      request => {

        const status =
          normalizeStatus(
            request.status
          );

        return (
          status !== "NEW" &&
          status !== "CONVERTED TO JOB" &&
          status !== "CANCELLED"
        );

      }
    ).length;


  if (newRequests) {

    newRequests.textContent =
      newTotal;

  }


  if (activeRequests) {

    activeRequests.textContent =
      activeTotal;

  }


  if (convertedRequests) {

    convertedRequests.textContent =
      convertedTotal;

  }

}


/* =====================================================
   STATUS
===================================================== */

function normalizeStatus(status) {

  return String(
    status || "NEW"
  )
    .trim()
    .toUpperCase();

}


/* =====================================================
   FILTER EVENTS
===================================================== */

if (searchInput) {

  searchInput.addEventListener(
    "input",
    renderRequests
  );

}


if (statusFilter) {

  statusFilter.addEventListener(
    "change",
    renderRequests
  );

}


/* =====================================================
   RENDER REQUESTS
===================================================== */

function renderRequests() {

  if (!requestContainer) {

    return;

  }


  const search =
    searchInput
      ? searchInput.value
          .trim()
          .toLowerCase()
      : "";


  const selectedStatus =
    statusFilter
      ? normalizeStatus(
          statusFilter.value
        )
      : "";


  const filtered =
    allRequests.filter(
      request => {

        const searchable = [

          request.id,

          request.requestId,

          request.customerId,

          request.customerName,

          request.customerMobile,

          request.mobile,

          request.retailerName,

          request.retailerId,

          request.device,

          request.deviceBrand,

          request.deviceModel,

          request.serialNumber,

          request.problem,

          request.serviceType

        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();


        const matchesSearch =
          !search ||
          searchable.includes(search);


        const matchesStatus =
          !selectedStatus ||
          normalizeStatus(
            request.status
          ) === selectedStatus;


        return (
          matchesSearch &&
          matchesStatus
        );

      }
    );


  if (filtered.length === 0) {

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
        .map(renderRequest)
        .join("")}

    </div>

  `;


  bindRequestButtons();

}


/* =====================================================
   REQUEST CARD
===================================================== */

function renderRequest(request) {

  const status =
    normalizeStatus(
      request.status
    );


  const statusClass =
    getStatusClass(status);


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
    getDevice(request);


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
            ${escapeHtml(requestNumber)}
          </h3>

          <div class="customer-name">
            ${escapeHtml(customer)}
          </div>

        </div>


        <span class="badge ${statusClass}">

          ${escapeHtml(
            formatStatus(status)
          )}

        </span>

      </div>


      <div class="request-info">

        <div class="info-row">

          <span class="info-icon">
            📱
          </span>

          <span>
            ${escapeHtml(mobile)}
          </span>

        </div>


        <div class="info-row">

          <span class="info-icon">
            📺
          </span>

          <span>
            ${escapeHtml(deviceText)}
          </span>

        </div>


        <div class="info-row">

          <span class="info-icon">
            🔧
          </span>

          <span>
            ${escapeHtml(service)}
          </span>

        </div>


        <div class="info-row">

          <span class="info-icon">
            🏪
          </span>

          <span>
            ${escapeHtml(retailer)}
          </span>

        </div>


        <div class="info-row">

          <span class="info-icon">
            📝
          </span>

          <span>
            ${escapeHtml(problemText)}
          </span>

        </div>

      </div>


      <div class="divider"></div>


      <div class="actions">

        <button
          class="action view-btn"
          type="button"
          data-view-request="${escapeAttribute(request.id)}"
        >
          View / Edit
        </button>


        ${
          canCreateJob
            ? `

              <button
                class="action job-btn"
                type="button"
                data-create-job="${escapeAttribute(request.id)}"
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
   DEVICE DISPLAY
===================================================== */

function getDevice(request) {

  const parts = [

    request.device,

    request.deviceBrand,

    request.deviceModel,

    request.serialNumber

  ]
    .filter(
      value =>
        value !== null &&
        value !== undefined &&
        String(value).trim() !== ""
    );


  if (parts.length > 0) {

    return parts.join(" • ");

  }


  return "Device not added";

}


/* =====================================================
   STATUS CLASS
===================================================== */

function getStatusClass(status) {

  switch (status) {

    case "NEW":
      return "badge-new";

    case "CONTACTED":
      return "badge-contacted";

    case "ACCEPTED":
      return "badge-accepted";

    case "ASSIGNED":
      return "badge-assigned";

    case "CONVERTED TO JOB":
      return "badge-converted";

    case "CANCELLED":
      return "badge-cancelled";

    default:
      return "badge-new";

  }

}


/* =====================================================
   STATUS DISPLAY
===================================================== */

function formatStatus(status) {

  if (
    status === "CONVERTED TO JOB"
  ) {

    return "Converted to Job";

  }


  return String(status || "")
    .toLowerCase()
    .replace(
      /\b\w/g,
      letter =>
        letter.toUpperCase()
    );

}


/* =====================================================
   NEW REQUEST BUTTON
===================================================== */

if (addRequestBtn) {

  addRequestBtn.addEventListener(
    "click",
    openNew
  );

}


/* =====================================================
   OPEN NEW
===================================================== */

function openNew() {

  hideMessages();


  requestForm.reset();


  editRequestId.value =
    "";


  modalTitle.textContent =
    "New Service Request";


  saveBtn.textContent =
    "Create Request";


  modalBackdrop.classList.add(
    "show"
  );


  customerName.focus();

}


/* =====================================================
   EDIT REQUEST
===================================================== */

function openEdit(id) {

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


  customerId.value =
    request.customerId ||
    "";


  customerName.value =
    request.customerName ||
    "";


  customerMobile.value =
    request.customerMobile ||
    request.mobile ||
    "";


  deviceBrand.value =
    request.deviceBrand ||
    "";


  deviceModel.value =
    request.deviceModel ||
    "";


  serialNumber.value =
    request.serialNumber ||
    "";


  serviceType.value =
    request.serviceType ||
    "";


  problem.value =
    request.problem ||
    "";


  retailerId.value =
    request.retailerId ||
    "";


  modalTitle.textContent =
    "Edit Service Request";


  saveBtn.textContent =
    "Save Changes";


  modalBackdrop.classList.add(
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


    const customerIdValue =
      customerId.value.trim();


    const name =
      customerName.value.trim();


    const mobile =
      customerMobile.value.trim();


    const brand =
      deviceBrand.value.trim();


    const model =
      deviceModel.value.trim();


    const serial =
      serialNumber.value.trim();


    const service =
      serviceType.value.trim();


    const problemValue =
      problem.value.trim();


    const retailerIdValue =
      retailerId.value.trim();


    if (!customerIdValue) {

      showError(
        "Customer ID required."
      );

      return;

    }


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


    if (!service) {

      showError(
        "Please select service type."
      );

      return;

    }


    if (!problemValue) {

      showError(
        "Problem / Request required."
      );

      return;

    }


    if (!retailerIdValue) {

      showError(
        "Retailer ID required."
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

        customerId:
          customerIdValue,

        customerName:
          name,

        customerMobile:
          mobile,

        deviceBrand:
          brand,

        deviceModel:
          model,

        serialNumber:
          serial,

        serviceType:
          service,

        problem:
          problemValue,

        retailerId:
          retailerIdValue

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

      console.error(
        "Save service request error:",
        error
      );


      showError(
        getErrorMessage(error)
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

async function createRequest(data) {

  /*
    Admin creates the request.

    Customer protection is represented by customerId
    + retailerId. Future duplicate/protection validation
    can be added through customer_index/backend logic.
  */

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

async function convertToJob(requestId) {

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


  if (request.jobId) {

    showError(
      "Job already exists for this request."
    );

    return;

  }


  const status =
    normalizeStatus(
      request.status
    );


  if (
    status === "CANCELLED"
  ) {

    showError(
      "Cancelled request cannot be converted to a job."
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

    /*
      Create Job
    */

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

          serialNumber:
            request.serialNumber ||
            "",

          serviceType:
            request.serviceType ||
            "TV REPAIR",

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


    /*
      Update Service Request
    */

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

    console.error(
      "Create job error:",
      error
    );


    showError(
      getErrorMessage(error)
    );

  }

}


/* =====================================================
   MODAL CLOSE
===================================================== */

function closeRequestModal() {

  if (modalBackdrop) {

    modalBackdrop.classList.remove(
      "show"
    );

  }


  if (requestForm) {

    requestForm.reset();

  }


  if (editRequestId) {

    editRequestId.value =
      "";

  }

}


if (closeModalBtn) {

  closeModalBtn.addEventListener(
    "click",
    closeRequestModal
  );

}


if (cancelBtn) {

  cancelBtn.addEventListener(
    "click",
    closeRequestModal
  );

}


if (modalBackdrop) {

  modalBackdrop.addEventListener(
    "click",
    event => {

      if (
        event.target ===
        modalBackdrop
      ) {

        closeRequestModal();

      }

    }
  );

}


/* =====================================================
   MORE MENU
===================================================== */

if (moreNavBtn && morePanel) {

  moreNavBtn.addEventListener(
    "click",
    event => {

      event.stopPropagation();

      toggleMore();

    }
  );


  document.addEventListener(
    "click",
    event => {

      if (
        !morePanel.contains(
          event.target
        ) &&
        !moreNavBtn.contains(
          event.target
        )
      ) {

        closeMore();

      }

    }
  );

}


function toggleMore() {

  if (!morePanel) {

    return;

  }


  morePanel.classList.toggle(
    "show"
  );

}


function closeMore() {

  if (!morePanel) {

    return;

  }


  morePanel.classList.remove(
    "show"
  );

}


/* =====================================================
   LOGOUT
===================================================== */

if (logoutBtn) {

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
          getErrorMessage(error)
        );

      }

    }
  );

}


/* =====================================================
   LOADING
===================================================== */

function showLoading() {

  if (!requestContainer) {

    return;

  }


  requestContainer.innerHTML = `

    <div class="loading">
      Loading service requests...
    </div>

  `;

}


/* =====================================================
   LOAD ERROR
===================================================== */

function showLoadError(error) {

  console.error(
    "REPARO Service Requests Load Error:",
    error
  );


  if (!requestContainer) {

    return;

  }


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
          getErrorMessage(error)
        )}
      </div>

    </div>

  `;

}


/* =====================================================
   ERROR MESSAGE
===================================================== */

function getErrorMessage(error) {

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

  if (errorBox) {

    errorBox.style.display =
      "none";

    errorBox.textContent =
      "";

  }


  if (successBox) {

    successBox.style.display =
      "none";

    successBox.textContent =
      "";

  }

}


function showError(message) {

  if (!errorBox) {

    return;

  }


  if (successBox) {

    successBox.style.display =
      "none";

  }


  errorBox.textContent =
    message;


  errorBox.style.display =
    "block";

}


function showSuccess(message) {

  if (!successBox) {

    return;

  }


  if (errorBox) {

    errorBox.style.display =
      "none";

  }


  successBox.textContent =
    message;


  successBox.style.display =
    "block";

}


/* =====================================================
   ESCAPE HTML
===================================================== */

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


/* =====================================================
   ESCAPE ATTRIBUTE
===================================================== */

function escapeAttribute(value) {

  return escapeHtml(value);

}