import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


// --------------------------------------------------
// ELEMENTS
// --------------------------------------------------

const requestList = document.getElementById("requestList");
const loading = document.getElementById("loading");

const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");

const addRequestBtn = document.getElementById("addRequestBtn");

const modalBackdrop = document.getElementById("modalBackdrop");
const modalTitle = document.getElementById("modalTitle");

const requestForm = document.getElementById("requestForm");
const cancelModalBtn = document.getElementById("cancelModalBtn");

const editRequestId = document.getElementById("editRequestId");

const customerName = document.getElementById("customerName");
const customerMobile = document.getElementById("customerMobile");
const customerAddress = document.getElementById("customerAddress");

const deviceBrand = document.getElementById("deviceBrand");
const deviceModel = document.getElementById("deviceModel");
const serialNumber = document.getElementById("serialNumber");
const screenSize = document.getElementById("screenSize");

const serviceType = document.getElementById("serviceType");
const retailerId = document.getElementById("retailerId");
const requestStatus = document.getElementById("requestStatus");
const problem = document.getElementById("problem");

const totalCount = document.getElementById("totalCount");
const newCount = document.getElementById("newCount");
const jobCount = document.getElementById("jobCount");


// --------------------------------------------------
// STATE
// --------------------------------------------------

let currentUser = null;
let requests = [];


// --------------------------------------------------
// AUTH
// --------------------------------------------------

onAuthStateChanged(auth, async (user) => {

  if (!user) {
    window.location.href = "../index.html";
    return;
  }

  try {

    const userSnap = await getDoc(
      doc(db, "users", user.uid)
    );

    if (!userSnap.exists()) {
      alert("User profile not found.");
      await auth.signOut();
      return;
    }

    const profile = userSnap.data();

    if (profile.role !== "admin") {
      alert("Admin access required.");
      window.location.href = "../index.html";
      return;
    }

    currentUser = user;

    await loadRequests();

  } catch (error) {

    console.error(error);

    loading.innerHTML =
      "Unable to load service requests.";

  }

});


// --------------------------------------------------
// LOAD REQUESTS
// --------------------------------------------------

async function loadRequests() {

  loading.style.display = "block";
  requestList.innerHTML = "";

  try {

    const q = query(
      collection(db, "service_requests"),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);

    requests = [];

    snapshot.forEach((item) => {

      requests.push({
        id: item.id,
        ...item.data()
      });

    });

  } catch (error) {

    console.error(error);

    // Fallback without orderBy
    try {

      const snapshot = await getDocs(
        collection(db, "service_requests")
      );

      requests = [];

      snapshot.forEach((item) => {

        requests.push({
          id: item.id,
          ...item.data()
        });

      });

      requests.sort((a, b) => {

        const ad = a.createdAt?.seconds || 0;
        const bd = b.createdAt?.seconds || 0;

        return bd - ad;

      });

    } catch (secondError) {

      console.error(secondError);

      loading.innerHTML =
        "Error loading service requests.";

      return;
    }

  }

  loading.style.display = "none";

  updateSummary();
  renderRequests();

}


// --------------------------------------------------
// SUMMARY
// --------------------------------------------------

function updateSummary() {

  totalCount.textContent = requests.length;

  newCount.textContent =
    requests.filter(
      item => item.status === "NEW"
    ).length;

  jobCount.textContent =
    requests.filter(
      item =>
        item.status === "CONVERTED TO JOB" ||
        item.jobId
    ).length;

}


// --------------------------------------------------
// RENDER
// --------------------------------------------------

function renderRequests() {

  const search = searchInput.value
    .trim()
    .toLowerCase();

  const status = statusFilter.value;

  const filtered = requests.filter((item) => {

    const searchable = [

      item.requestId,
      item.customerName,
      item.customerMobile,
      item.customerAddress,
      item.deviceBrand,
      item.deviceModel,
      item.serialNumber,
      item.serviceType,
      item.problem

    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchesSearch =
      !search || searchable.includes(search);

    const matchesStatus =
      !status || item.status === status;

    return matchesSearch && matchesStatus;

  });


  if (!filtered.length) {

    requestList.innerHTML = `
      <div class="empty">
        No service requests found.
      </div>
    `;

    return;
  }


  requestList.innerHTML = filtered
    .map(renderRequestCard)
    .join("");


  document
    .querySelectorAll("[data-edit]")
    .forEach(button => {

      button.addEventListener("click", () => {

        openEditModal(button.dataset.edit);

      });

    });


  document
    .querySelectorAll("[data-job]")
    .forEach(button => {

      button.addEventListener("click", () => {

        createJob(button.dataset.job);

      });

    });


  document
    .querySelectorAll("[data-view]")
    .forEach(button => {

      button.addEventListener("click", () => {

        viewRequest(button.dataset.view);

      });

    });

}


// --------------------------------------------------
// REQUEST CARD
// --------------------------------------------------

function renderRequestCard(item) {

  const statusClass = getStatusClass(item.status);

  const created =
    formatDate(item.createdAt);

  const requestNumber =
    item.requestId || item.id;

  const jobButton =
    item.jobId
      ? `<span class="status status-converted">
           Job Created
         </span>`
      : `
        <button
          class="btn-small btn-yellow"
          data-job="${item.id}">
          Create Job
        </button>
      `;


  return `
    <div class="request-card">

      <div class="request-top">

        <div>
          <div class="request-id">
            ${escapeHtml(requestNumber)}
          </div>

          <div class="customer-name">
            ${escapeHtml(item.customerName || "Unknown Customer")}
          </div>

          <div class="muted">
            ${escapeHtml(item.customerMobile || "")}
          </div>
        </div>

        <span class="status ${statusClass}">
          ${escapeHtml(item.status || "NEW")}
        </span>

      </div>


      <div class="request-info">

        <div class="info-box">
          <div class="info-label">
            SERVICE
          </div>

          <div class="info-value">
            ${escapeHtml(item.serviceType || "-")}
          </div>
        </div>


        <div class="info-box">
          <div class="info-label">
            DEVICE
          </div>

          <div class="info-value">
            ${escapeHtml(
              [item.deviceBrand, item.deviceModel]
                .filter(Boolean)
                .join(" ") || "-"
            )}
          </div>
        </div>


        <div class="info-box">
          <div class="info-label">
            RETAILER
          </div>

          <div class="info-value">
            ${escapeHtml(item.retailerId || "-")}
          </div>
        </div>


        <div class="info-box">
          <div class="info-label">
            CREATED
          </div>

          <div class="info-value">
            ${created}
          </div>
        </div>

      </div>


      ${
        item.problem
          ? `
            <div class="muted" style="margin-bottom:12px;">
              ${escapeHtml(item.problem)}
            </div>
          `
          : ""
      }


      <div class="actions">

        <button
          class="btn-small btn-primary"
          data-view="${item.id}">
          View
        </button>

        <button
          class="btn-small"
          data-edit="${item.id}">
          Edit
        </button>

        ${jobButton}

      </div>

    </div>
  `;

}


// --------------------------------------------------
// NEW REQUEST
// --------------------------------------------------

addRequestBtn.addEventListener("click", () => {

  resetForm();

  modalTitle.textContent =
    "New Service Request";

  modalBackdrop.classList.add("show");

});


// --------------------------------------------------
// CLOSE MODAL
// --------------------------------------------------

cancelModalBtn.addEventListener("click", closeModal);

modalBackdrop.addEventListener("click", (event) => {

  if (event.target === modalBackdrop) {
    closeModal();
  }

});


function closeModal() {

  modalBackdrop.classList.remove("show");

}


// --------------------------------------------------
// RESET FORM
// --------------------------------------------------

function resetForm() {

  requestForm.reset();

  editRequestId.value = "";

  requestStatus.value = "NEW";

}


// --------------------------------------------------
// EDIT MODAL
// --------------------------------------------------

function openEditModal(id) {

  const item =
    requests.find(request => request.id === id);

  if (!item) return;

  editRequestId.value = id;

  customerName.value =
    item.customerName || "";

  customerMobile.value =
    item.customerMobile || "";

  customerAddress.value =
    item.customerAddress || "";

  deviceBrand.value =
    item.deviceBrand || "";

  deviceModel.value =
    item.deviceModel || "";

  serialNumber.value =
    item.serialNumber || "";

  screenSize.value =
    item.screenSize || "";

  serviceType.value =
    item.serviceType || "TV Repair";

  retailerId.value =
    item.retailerId || "";

  requestStatus.value =
    item.status || "NEW";

  problem.value =
    item.problem || "";

  modalTitle.textContent =
    "Edit Service Request";

  modalBackdrop.classList.add("show");

}


// --------------------------------------------------
// SAVE REQUEST
// --------------------------------------------------

requestForm.addEventListener("submit", async (event) => {

  event.preventDefault();

  const id = editRequestId.value;

  const data = {

    customerName:
      customerName.value.trim(),

    customerMobile:
      customerMobile.value.trim(),

    customerAddress:
      customerAddress.value.trim(),

    deviceBrand:
      deviceBrand.value.trim(),

    deviceModel:
      deviceModel.value.trim(),

    serialNumber:
      serialNumber.value.trim(),

    screenSize:
      screenSize.value.trim(),

    serviceType:
      serviceType.value,

    retailerId:
      retailerId.value.trim(),

    status:
      requestStatus.value,

    problem:
      problem.value.trim(),

    updatedAt:
      serverTimestamp()

  };


  try {

    if (id) {

      await updateDoc(
        doc(db, "service_requests", id),
        data
      );

      alert("Service Request updated.");

    } else {

      const requestNumber =
        generateRequestId();

      await addDoc(
        collection(db, "service_requests"),
        {

          ...data,

          requestId:
            requestNumber,

          source:
            "ADMIN",

          createdBy:
            currentUser.uid,

          createdAt:
            serverTimestamp(),

          jobId:
            null

        }
      );

      alert("Service Request created.");

    }

    closeModal();

    await loadRequests();

  } catch (error) {

    console.error(error);

    alert(
      "Unable to save Service Request.\n\n" +
      error.message
    );

  }

});


// --------------------------------------------------
// CREATE JOB
// --------------------------------------------------

async function createJob(requestDocId) {

  const request =
    requests.find(item => item.id === requestDocId);

  if (!request) return;

  if (request.jobId) {

    alert(
      "Job already created for this request."
    );

    return;

  }


  const confirmCreate =
    confirm(
      `Create Job for ${request.customerName || "this customer"}?`
    );

  if (!confirmCreate) return;


  try {

    const jobNumber =
      generateJobId();


    const jobRef =
      await addDoc(
        collection(db, "jobs"),
        {

          jobId:
            jobNumber,

          requestId:
            requestDocId,

          serviceRequestId:
            requestDocId,

          retailerId:
            request.retailerId || null,

          customerName:
            request.customerName || "",

          customerMobile:
            request.customerMobile || "",

          customerAddress:
            request.customerAddress || "",

          deviceBrand:
            request.deviceBrand || "",

          deviceModel:
            request.deviceModel || "",

          serialNumber:
            request.serialNumber || "",

          screenSize:
            request.screenSize || "",

          serviceType:
            request.serviceType || "TV Repair",

          problem:
            request.problem || "",

          technicianId:
            null,

          status:
            "NEW",

          source:
            "SERVICE_REQUEST",

          createdAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp()

        }
      );


    await updateDoc(
      doc(db, "service_requests", requestDocId),
      {

        jobId:
          jobRef.id,

        status:
          "CONVERTED TO JOB",

        updatedAt:
          serverTimestamp()

      }
    );


    alert(
      `Job created successfully.\nJob ID: ${jobNumber}`
    );


    await loadRequests();


  } catch (error) {

    console.error(error);

    alert(
      "Unable to create Job.\n\n" +
      error.message
    );

  }

}


// --------------------------------------------------
// VIEW
// --------------------------------------------------

function viewRequest(id) {

  const item =
    requests.find(request => request.id === id);

  if (!item) return;


  const message = [

    `Request ID: ${item.requestId || item.id}`,

    `Customer: ${item.customerName || "-"}`,

    `Mobile: ${item.customerMobile || "-"}`,

    `Service: ${item.serviceType || "-"}`,

    `Brand: ${item.deviceBrand || "-"}`,

    `Model: ${item.deviceModel || "-"}`,

    `Serial: ${item.serialNumber || "-"}`,

    `Screen: ${item.screenSize || "-"}`,

    `Retailer: ${item.retailerId || "-"}`,

    `Status: ${item.status || "-"}`,

    `Job ID: ${item.jobId || "Not created"}`,

    `Problem: ${item.problem || "-"}`

  ].join("\n");


  alert(message);

}


// --------------------------------------------------
// FILTER EVENTS
// --------------------------------------------------

searchInput.addEventListener(
  "input",
  renderRequests
);

statusFilter.addEventListener(
  "change",
  renderRequests
);


// --------------------------------------------------
// HELPERS
// --------------------------------------------------

function generateRequestId() {

  const now = new Date();

  const date =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0");

  const time =
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0") +
    String(now.getSeconds()).padStart(2, "0");

  return `REQ-${date}-${time}`;

}


function generateJobId() {

  const now = new Date();

  const date =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0");

  const random =
    Math.floor(
      1000 + Math.random() * 9000
    );

  return `JOB-${date}-${random}`;

}


function getStatusClass(status) {

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
      return "status-converted";

    case "CANCELLED":
      return "status-cancelled";

    default:
      return "status-new";

  }

}


function formatDate(timestamp) {

  if (!timestamp) return "-";

  try {

    const date =
      timestamp.toDate
        ? timestamp.toDate()
        : new Date(timestamp);

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


function escapeHtml(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}