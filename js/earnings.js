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
  setDoc,
  serverTimestamp,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


let currentUser = null;

let technicians = {};
let retailers = {};

let technicianRecords = [];
let retailerRecords = [];

let selectedTechnicianPayment = null;


// =====================================================
// AUTH
// =====================================================

onAuthStateChanged(auth, async user => {

  if (!user) {
    location.href = "../index.html";
    return;
  }

  try {

    const profileSnap =
      await getDoc(
        doc(db, "users", user.uid)
      );

    if (
      !profileSnap.exists() ||
      profileSnap.data().role !== "admin"
    ) {
      location.href = "../index.html";
      return;
    }

    currentUser = user;

    await loadUsers();
    await loadTechnicianEarnings();
    await loadRetailerCommissions();

    renderAll();

  } catch (error) {

    console.error(error);

    document.getElementById(
      "technicianList"
    ).innerHTML =
      `<div class="empty-state">
        Unable to load earnings.
      </div>`;

  }

});


// =====================================================
// USERS
// =====================================================

async function loadUsers() {

  const snap =
    await getDocs(
      collection(db, "users")
    );

  snap.forEach(item => {

    const data = item.data();

    if (data.role === "technician") {
      technicians[item.id] = {
        id: item.id,
        ...data
      };
    }

    if (data.role === "retailer") {
      retailers[item.id] = {
        id: item.id,
        ...data
      };
    }

  });

}


// =====================================================
// TECHNICIAN EARNINGS
// =====================================================

async function loadTechnicianEarnings() {

  technicianRecords = [];

  let snap;

  try {

    snap =
      await getDocs(
        query(
          collection(
            db,
            "technician_earnings"
          ),
          orderBy(
            "createdAt",
            "desc"
          )
        )
      );

  } catch {

    snap =
      await getDocs(
        collection(
          db,
          "technician_earnings"
        )
      );

  }


  snap.forEach(item => {

    technicianRecords.push({
      id: item.id,
      ...item.data()
    });

  });

}


// =====================================================
// RETAILER COMMISSION
// =====================================================

async function loadRetailerCommissions() {

  retailerRecords = [];

  let snap;

  try {

    snap =
      await getDocs(
        query(
          collection(
            db,
            "commissions"
          ),
          orderBy(
            "createdAt",
            "desc"
          )
        )
      );

  } catch {

    snap =
      await getDocs(
        collection(
          db,
          "commissions"
        )
      );

  }


  snap.forEach(item => {

    retailerRecords.push({
      id: item.id,
      ...item.data()
    });

  });

}


// =====================================================
// RENDER
// =====================================================

function renderAll() {

  renderTechnicianRecords();
  renderRetailerRecords();
  updateSummary();

}


// =====================================================
// TECHNICIAN RENDER
// =====================================================

function renderTechnicianRecords() {

  const container =
    document.getElementById(
      "technicianList"
    );

  const search =
    document.getElementById(
      "searchInput"
    ).value
      .trim()
      .toLowerCase();

  const filter =
    document.getElementById(
      "statusFilter"
    ).value;


  let records =
    technicianRecords.filter(record => {

      const tech =
        technicians[
          record.technicianId
        ];

      const technicianName =
        tech?.name ||
        record.technicianName ||
        "";

      const text =
        [
          record.jobId,
          record.jobNumber,
          technicianName,
          record.customerName
        ]
          .join(" ")
          .toLowerCase();


      const matchesSearch =
        !search ||
        text.includes(search);


      const status =
        normalizeStatus(
          record.status
        );


      const matchesStatus =
        filter === "ALL" ||
        status === filter;


      return (
        matchesSearch &&
        matchesStatus
      );

    });


  document.getElementById(
    "technicianCount"
  ).textContent =
    records.length;


  if (!records.length) {

    container.innerHTML =
      `<div class="empty-state">
        No technician earnings found.
      </div>`;

    return;

  }


  container.innerHTML =
    records
      .map(
        renderTechnicianRecord
      )
      .join("");

}


// =====================================================
// TECHNICIAN CARD
// =====================================================

function renderTechnicianRecord(record) {

  const tech =
    technicians[
      record.technicianId
    ];

  const name =
    tech?.name ||
    record.technicianName ||
    "Technician";


  const earning =
    Number(
      record.amount ??
      record.earning ??
      record.technicianAmount ??
      0
    );


  const status =
    normalizeStatus(
      record.status ||
      "PENDING"
    );


  const job =
    record.jobNumber ||
    record.jobId ||
    "-";


  const customer =
    record.customerName ||
    "-";


  let actions = "";


  if (status === "PENDING") {

    actions += `
      <button
        class="action-btn action-primary"
        onclick="approveTechnician('${record.id}')">
        Approve
      </button>
    `;

  }


  if (status === "APPROVED") {

    actions += `
      <button
        class="action-btn action-yellow"
        onclick="makeTechnicianPayable('${record.id}')">
        Make Payable
      </button>
    `;

  }


  if (status === "PAYABLE") {

    actions += `
      <button
        class="action-btn action-success"
        onclick="openPayment('${record.id}')">
        Mark Paid
      </button>
    `;

  }


  return `
    <div class="record">

      <div class="record-top">

        <div>

          <div class="record-title">
            ${escapeHtml(name)}
          </div>

          <div class="record-sub">
            Job: ${escapeHtml(job)}
            • Customer: ${escapeHtml(customer)}
          </div>

        </div>

        <span class="status status-${statusClass(status)}">
          ${escapeHtml(status)}
        </span>

      </div>


      <div class="record-grid">

        <div class="record-item">
          <span>Technician Earning</span>
          <strong>${money(earning)}</strong>
        </div>

        <div class="record-item">
          <span>Job</span>
          <strong>${escapeHtml(job)}</strong>
        </div>

        <div class="record-item">
          <span>Created</span>
          <strong>${formatDate(record.createdAt)}</strong>
        </div>

        <div class="record-item">
          <span>Payment</span>
          <strong>${escapeHtml(record.paymentMethod || "-")}</strong>
        </div>

      </div>


      ${
        actions
          ? `<div class="record-actions">
               ${actions}
             </div>`
          : ""
      }

    </div>
  `;

}


// =====================================================
// RETAILER RENDER
// =====================================================

function renderRetailerRecords() {

  const container =
    document.getElementById(
      "retailerList"
    );

  const search =
    document.getElementById(
      "searchInput"
    ).value
      .trim()
      .toLowerCase();

  const filter =
    document.getElementById(
      "statusFilter"
    ).value;


  let records =
    retailerRecords.filter(record => {

      const retailer =
        retailers[
          record.retailerId
        ];

      const retailerName =
        retailer?.name ||
        record.retailerName ||
        "";


      const text =
        [
          record.jobId,
          record.invoiceId,
          retailerName,
          record.customerName
        ]
          .join(" ")
          .toLowerCase();


      const matchesSearch =
        !search ||
        text.includes(search);


      const status =
        normalizeStatus(
          record.status ||
          record.commissionStatus ||
          "WARRANTY HOLD"
        );


      const matchesStatus =
        filter === "ALL" ||
        status === filter;


      return (
        matchesSearch &&
        matchesStatus
      );

    });


  document.getElementById(
    "retailerCount"
  ).textContent =
    records.length;


  if (!records.length) {

    container.innerHTML =
      `<div class="empty-state">
        No retailer commission found.
      </div>`;

    return;

  }


  container.innerHTML =
    records
      .map(
        renderRetailerRecord
      )
      .join("");

}


// =====================================================
// RETAILER CARD
// =====================================================

function renderRetailerRecord(record) {

  const retailer =
    retailers[
      record.retailerId
    ];


  const name =
    retailer?.name ||
    record.retailerName ||
    "Retailer";


  const amount =
    Number(
      record.amount ??
      record.commissionAmount ??
      0
    );


  const status =
    normalizeStatus(
      record.status ||
      record.commissionStatus ||
      "WARRANTY HOLD"
    );


  const job =
    record.jobId ||
    record.jobNumber ||
    "-";


  const warrantyEnd =
    record.warrantyEnd;


  let actions = "";


  if (
    status === "WARRANTY HOLD" &&
    warrantyExpired(warrantyEnd)
  ) {

    actions += `
      <button
        class="action-btn action-success"
        onclick="releaseCommission('${record.id}')">
        Release Commission
      </button>
    `;

  }


  if (
    status === "RELEASED"
  ) {

    actions += `
      <button
        class="action-btn action-light"
        onclick="markCommissionPaid('${record.id}')">
        Mark Paid
      </button>
    `;

  }


  return `
    <div class="record">

      <div class="record-top">

        <div>

          <div class="record-title">
            ${escapeHtml(name)}
          </div>

          <div class="record-sub">
            Job: ${escapeHtml(job)}
          </div>

        </div>

        <span class="status status-${statusClass(status)}">
          ${escapeHtml(status)}
        </span>

      </div>


      <div class="record-grid">

        <div class="record-item">
          <span>Retailer Commission</span>
          <strong>${money(amount)}</strong>
        </div>

        <div class="record-item">
          <span>Commission Type</span>
          <strong>
            ${escapeHtml(
              record.commissionType ||
              "-"
            )}
          </strong>
        </div>

        <div class="record-item">
          <span>Warranty End</span>
          <strong>
            ${formatDate(warrantyEnd)}
          </strong>
        </div>

        <div class="record-item">
          <span>Calculation</span>
          <strong>
            ${escapeHtml(
              record.calculation ||
              "-"
            )}
          </strong>
        </div>

      </div>


      ${
        actions
          ? `<div class="record-actions">
               ${actions}
             </div>`
          : ""
      }

    </div>
  `;

}


// =====================================================
// TECHNICIAN APPROVE
// =====================================================

window.approveTechnician =
  async function(id) {

    if (!confirm(
      "Approve this technician earning?"
    )) return;


    try {

      await updateDoc(
        doc(
          db,
          "technician_earnings",
          id
        ),
        {
          status: "APPROVED",
          approvedAt:
            serverTimestamp(),
          approvedBy:
            currentUser.uid,
          updatedAt:
            serverTimestamp()
        }
      );


      await reload();

    } catch (error) {

      console.error(error);

      alert(
        "Unable to approve earning."
      );

    }

  };


// =====================================================
// MAKE PAYABLE
// =====================================================

window.makeTechnicianPayable =
  async function(id) {

    if (!confirm(
      "Move this earning to PAYABLE?"
    )) return;


    try {

      await updateDoc(
        doc(
          db,
          "technician_earnings",
          id
        ),
        {
          status: "PAYABLE",
          payableAt:
            serverTimestamp(),
          updatedAt:
            serverTimestamp()
        }
      );


      await reload();

    } catch (error) {

      console.error(error);

      alert(
        "Unable to make payable."
      );

    }

  };


// =====================================================
// PAYMENT MODAL
// =====================================================

window.openPayment =
  function(id) {

    selectedTechnicianPayment =
      technicianRecords.find(
        record =>
          record.id === id
      );


    if (!selectedTechnicianPayment)
      return;


    const amount =
      Number(
        selectedTechnicianPayment.amount ??
        selectedTechnicianPayment.earning ??
        0
      );


    document.getElementById(
      "paymentDescription"
    ).textContent =
      `Pay ${money(amount)} to ${
        selectedTechnicianPayment.technicianName ||
        technicians[
          selectedTechnicianPayment.technicianId
        ]?.name ||
        "Technician"
      }`;


    document.getElementById(
      "transactionReference"
    ).value = "";


    document.getElementById(
      "paymentNotes"
    ).value = "";


    document.getElementById(
      "paymentModal"
    ).classList.add("show");

  };


// =====================================================
// CLOSE PAYMENT
// =====================================================

document.getElementById(
  "closePaymentBtn"
).addEventListener(
  "click",
  closePayment
);


function closePayment() {

  document.getElementById(
    "paymentModal"
  ).classList.remove("show");

  selectedTechnicianPayment =
    null;

}


// =====================================================
// CONFIRM PAYMENT
// =====================================================

document.getElementById(
  "confirmPaymentBtn"
).addEventListener(
  "click",
  async () => {

    if (!selectedTechnicianPayment)
      return;


    const record =
      selectedTechnicianPayment;


    const amount =
      Number(
        record.amount ??
        record.earning ??
        0
      );


    try {

      await updateDoc(
        doc(
          db,
          "technician_earnings",
          record.id
        ),
        {

          status: "PAID",

          paidAt:
            serverTimestamp(),

          paidBy:
            currentUser.uid,

          paymentMethod:
            document.getElementById(
              "paymentMethod"
            ).value,

          transactionReference:
            document.getElementById(
              "transactionReference"
            ).value
              .trim(),

          paymentNotes:
            document.getElementById(
              "paymentNotes"
            ).value
              .trim(),

          paidAmount:
            amount,

          updatedAt:
            serverTimestamp()

        }
      );


      const paymentId =
        `PAY-${Date.now()}`;


      await setDoc(
        doc(
          db,
          "payments",
          paymentId
        ),
        {

          paymentId,

          paymentType:
            "TECHNICIAN",

          technicianId:
            record.technicianId ||
            null,

          jobId:
            record.jobId ||
            null,

          earningId:
            record.id,

          amount,

          method:
            document.getElementById(
              "paymentMethod"
            ).value,

          transactionReference:
            document.getElementById(
              "transactionReference"
            ).value
              .trim(),

          notes:
            document.getElementById(
              "paymentNotes"
            ).value
              .trim(),

          paidAt:
            serverTimestamp(),

          paidBy:
            currentUser.uid

        }
      );


      closePayment();

      await reload();


    } catch (error) {

      console.error(error);

      alert(
        "Unable to complete payment."
      );

    }

  }
);


// =====================================================
// RELEASE RETAILER COMMISSION
// =====================================================

window.releaseCommission =
  async function(id) {

    const record =
      retailerRecords.find(
        item =>
          item.id === id
      );


    if (!record)
      return;


    if (
      !warrantyExpired(
        record.warrantyEnd
      )
    ) {

      alert(
        "Warranty period is still active."
      );

      return;

    }


    if (!confirm(
      "Release this retailer commission?"
    )) return;


    try {

      await updateDoc(
        doc(
          db,
          "commissions",
          id
        ),
        {

          status: "RELEASED",

          commissionStatus:
            "RELEASED",

          releasedAt:
            serverTimestamp(),

          releasedBy:
            currentUser.uid,

          updatedAt:
            serverTimestamp()

        }
      );


      await reload();


    } catch (error) {

      console.error(error);

      alert(
        "Unable to release commission."
      );

    }

  };


// =====================================================
// MARK RETAILER PAID
// =====================================================

window.markCommissionPaid =
  async function(id) {

    const record =
      retailerRecords.find(
        item =>
          item.id === id
      );


    if (!record)
      return;


    if (!confirm(
      "Mark this retailer commission as PAID?"
    )) return;


    const amount =
      Number(
        record.amount ??
        record.commissionAmount ??
        0
      );


    try {

      await updateDoc(
        doc(
          db,
          "commissions",
          id
        ),
        {

          status: "PAID",

          commissionStatus:
            "PAID",

          paidAt:
            serverTimestamp(),

          paidBy:
            currentUser.uid,

          paidAmount:
            amount,

          updatedAt:
            serverTimestamp()

        }
      );


      const paymentId =
        `PAY-${Date.now()}`;


      await setDoc(
        doc(
          db,
          "payments",
          paymentId
        ),
        {

          paymentId,

          paymentType:
            "RETAILER",

          retailerId:
            record.retailerId ||
            null,

          commissionId:
            record.id,

          jobId:
            record.jobId ||
            null,

          amount,

          method:
            "SETTLEMENT",

          paidAt:
            serverTimestamp(),

          paidBy:
            currentUser.uid

        }
      );


      await reload();


    } catch (error) {

      console.error(error);

      alert(
        "Unable to mark commission paid."
      );

    }

  };


// =====================================================
// SUMMARY
// =====================================================

function updateSummary() {

  let technicianPending = 0;
  let technicianPayable = 0;

  let retailerHold = 0;
  let retailerReleased = 0;


  technicianRecords.forEach(record => {

    const amount =
      Number(
        record.amount ??
        record.earning ??
        record.technicianAmount ??
        0
      );


    const status =
      normalizeStatus(
        record.status
      );


    if (
      status === "PENDING" ||
      status === "APPROVED"
    ) {

      technicianPending += amount;

    }


    if (
      status === "PAYABLE"
    ) {

      technicianPayable += amount;

    }

  });


  retailerRecords.forEach(record => {

    const amount =
      Number(
        record.amount ??
        record.commissionAmount ??
        0
      );


    const status =
      normalizeStatus(
        record.status ||
        record.commissionStatus
      );


    if (
      status === "WARRANTY HOLD"
    ) {

      retailerHold += amount;

    }


    if (
      status === "RELEASED"
    ) {

      retailerReleased += amount;

    }

  });


  document.getElementById(
    "technicianPending"
  ).textContent =
    money(technicianPending);


  document.getElementById(
    "technicianPayable"
  ).textContent =
    money(technicianPayable);


  document.getElementById(
    "retailerHold"
  ).textContent =
    money(retailerHold);


  document.getElementById(
    "retailerReleased"
  ).textContent =
    money(retailerReleased);

}


// =====================================================
// RELOAD
// =====================================================

async function reload() {

  await loadTechnicianEarnings();
  await loadRetailerCommissions();

  renderAll();

}


// =====================================================
// FILTER EVENTS
// =====================================================

document.getElementById(
  "searchInput"
).addEventListener(
  "input",
  renderAll
);


document.getElementById(
  "statusFilter"
).addEventListener(
  "change",
  renderAll
);


// =====================================================
// HELPERS
// =====================================================

function normalizeStatus(status) {

  return String(
    status ||
    "PENDING"
  )
    .trim()
    .toUpperCase();

}


function statusClass(status) {

  return normalizeStatus(status)
    .toLowerCase()
    .replace(/\s+/g, "-");

}


function money(value) {

  return (
    "₹" +
    Number(value || 0)
      .toLocaleString(
        "en-IN"
      )
  );

}


function formatDate(value) {

  if (!value)
    return "-";


  try {

    if (
      typeof value.toDate ===
      "function"
    ) {

      return value
        .toDate()
        .toLocaleDateString(
          "en-IN"
        );

    }


    const date =
      new Date(value);


    if (
      Number.isNaN(
        date.getTime()
      )
    ) return "-";


    return date.toLocaleDateString(
      "en-IN"
    );

  } catch {

    return "-";

  }

}


function warrantyExpired(value) {

  if (!value)
    return true;


  let date;


  try {

    if (
      typeof value.toDate ===
      "function"
    ) {

      date =
        value.toDate();

    } else {

      date =
        new Date(value);

    }

  } catch {

    return false;

  }


  return (
    date.getTime() <=
    Date.now()
  );

}


function escapeHtml(value) {

  return String(
    value ?? ""
  )
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}