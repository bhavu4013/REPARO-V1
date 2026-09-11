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

const closeModal =
  document.getElementById("closeModal");

const cancelModal =
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


let allRequests = [];

let adminUser = null;


onAuthStateChanged(
  auth,
  async user => {

    if (!user) {

      window.location.href =
        "../index.html";

      return;

    }


    try {

      const userSnap =
        await getDoc(
          doc(
            db,
            "users",
            user.uid
          )
        );


      if (!userSnap.exists()) {

        await signOut(auth);

        window.location.href =
          "../index.html";

        return;

      }


      const profile =
        userSnap.data();


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

      showError(
        error.message ||
        "Authorization failed."
      );

    }

  }
);


async function loadRequests() {

  requestContainer.innerHTML = `

    <div class="loading">
      Loading service requests...
    </div>

  `;


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

          id:
            item.id,

          ...item.data()

        });

      }
    );


    allRequests.sort(
      (a, b) => {

        const aTime =
          a.createdAt?.seconds || 0;

        const bTime =
          b.createdAt?.seconds || 0;

        return bTime - aTime;

      }
    );


    updateSummary();

    renderRequests();

  }
  catch (error) {

    requestContainer.innerHTML = `

      <div class="empty">

        <div class="empty-icon">
          ⚠️
        </div>

        <div class="empty-title">
          Unable to Load
        </div>

        <div class="empty-text">
          ${escapeHtml(
            error.message ||
            "Service requests could not be loaded."
          )}
        </div>

      </div>

    `;

  }

}


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


function normalizeStatus(
  status
) {

  return String(
    status || "NEW"
  ).toUpperCase();

}


searchInput.addEventListener(
  "input",
  renderRequests
);


statusFilter.addEventListener(
  "change",
  renderRequests
);


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

        const text = [

          request.id,

          request.requestId,

          request.customerName,

          request.customerMobile,

          request.mobile,

          request.retailerName,

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
          text.includes(search);


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
        .map(renderRequest)
        .join("")}

    </div>

  `;


  document
    .querySelectorAll("[data-view]")
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            openEdit(
              button.dataset.view
            );

          }
        );

      }
    );


  document
    .querySelectorAll("[data-job]")
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            convertToJob(
              button.dataset.job
            );

          }
        );

      }
    );

}


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


  return `

    <div class="request-card">

      <div class="request-top">

        <div>

          <h3 class="request-id">

            ${escapeHtml(
              request.requestId ||
              request.id
            )}

          </h3>

          <div class="customer">

            ${escapeHtml(
              request.customerName ||
              "Customer"
            )}

          </div>

        </div>


        <span
          class="status ${statusClass}"
        >

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
            ${escapeHtml(
              request.customerMobile ||
              request.mobile ||
              "-"
            )}
          </span>

        </div>


        <div class="info-row">

          <span class="info-icon">
            📺
          </span>

          <span>
            ${escapeHtml(
              getDevice(request)
            )}
          </span>

        </div>


        <div class="info-row">

          <span class="info-icon">
            🔧
          </span>

          <span>
            ${escapeHtml(
              request.serviceType ||
              "Service"
            )}
          </span>

        </div>


        <div class="info-row">

          <span class="info-icon">
            🏪
          </span>

          <span>
            ${escapeHtml(
              request.retailerName ||
              request.retailerId ||
              "-"
            )}
          </span>

        </div>


        <div class="info-row">

          <span class="info-icon">
            📝
          </span>

          <span>
            ${escapeHtml(
              request.problem ||
              "No problem description"
            )}
          </span>

        </div>

      </div>


      <div class="divider"></div>


      <div class="actions">

        <button
          class="action view"
          type="button"
          data-view="${request.id}"
        >
          View / Edit
        </button>


        ${
          status !== "CONVERTED TO JOB" &&
          status !== "CANCELLED"
            ? `

              <button
                class="action job"
                type="button"
                data-job="${request.id}"
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


function getDevice(
  request
) {

  const parts = [

    request.device,

    request.deviceBrand,

    request.deviceModel

  ]
  .filter(Boolean);


  return parts.length
    ? parts.join(" • ")
    : "Device not added";

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

  editRequestId.value = "";

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
    request.customerName || "";


  customerMobile.value =
    request.customerMobile ||
    request.mobile ||
    "";


  customerAddress.value =
    request.customerAddress ||
    request.address ||
    "";


  device.value =
    request.device || "";


  deviceBrand.value =
    request.deviceBrand || "";


  deviceModel.value =
    request.deviceModel || "";


  serviceType.value =
    request.serviceType ||
    "REPAIR";


  problem.value =
    request.problem || "";


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

      if (editId) {

        await updateDoc(

          doc(
            db,
            "service_requests",
            editId
          ),

          {

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
              problem.value.trim(),

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

        await createRequest({

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

        });

      }

    }
    catch (error) {

      showError(
        error.message ||
        "Request operation failed."
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


  if (
    !confirm(
      "Create a service job from this request?"
    )
  ) {

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
            "",

          customerAddress:
            request.customerAddress ||
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
      error.message ||
      "Unable to create job."
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


closeModal.addEventListener(
  "click",
  closeRequestModal
);


cancelModal.addEventListener(
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
   LOGOUT
===================================================== */

logoutBtn.addEventListener(
  "click",
  async () => {

    try {

      await signOut(auth);

      window.location.href =
        "../index.html";

    }
    catch (error) {

      showError(
        error.message ||
        "Logout failed."
      );

    }

  }
);


/* =====================================================
   HELPERS
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


function hideMessages() {

  errorBox.style.display =
    "none";

  successBox.style.display =
    "none";

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