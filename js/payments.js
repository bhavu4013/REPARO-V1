import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
  auth,
  db
} from "./firebase.js";


/* =========================
   DOM
========================= */

const paymentContainer =
  document.getElementById("paymentContainer");

const searchInput =
  document.getElementById("searchInput");

const paymentTypeFilter =
  document.getElementById("paymentTypeFilter");

const statusFilter =
  document.getElementById("statusFilter");

const logoutBtn =
  document.getElementById("logoutBtn");

const errorBox =
  document.getElementById("errorBox");

const successBox =
  document.getElementById("successBox");

const pendingAmount =
  document.getElementById("pendingAmount");

const payableAmount =
  document.getElementById("payableAmount");

const holdAmount =
  document.getElementById("holdAmount");

const paidAmount =
  document.getElementById("paidAmount");

const modalBackdrop =
  document.getElementById("modalBackdrop");

const modalTitle =
  document.getElementById("modalTitle");

const modalContent =
  document.getElementById("modalContent");

const closeModalBtn =
  document.getElementById("closeModalBtn");

const cancelModalBtn =
  document.getElementById("cancelModalBtn");

const primaryModalBtn =
  document.getElementById("primaryModalBtn");

const paymentFormArea =
  document.getElementById("paymentFormArea");

const paymentMethod =
  document.getElementById("paymentMethod");

const transactionReference =
  document.getElementById("transactionReference");

const paymentNotes =
  document.getElementById("paymentNotes");


/* =========================
   STATE
========================= */

let allPayments = [];
let selectedPaymentId = null;
let selectedAction = null;
let adminUser = null;


/* =========================
   AUTH
========================= */

onAuthStateChanged(auth, async (user) => {

  if (!user) {

    window.location.href =
      "../index.html";

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
      await getDoc(userRef);


    if (!snapshot.exists()) {

      await signOut(auth);

      window.location.href =
        "../index.html";

      return;
    }


    const profile =
      snapshot.data();


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

    await loadPayments();

  } catch (error) {

    showError(
      error.message ||
      "Authorization error."
    );

  }

});


/* =========================
   LOAD PAYMENTS
========================= */

async function loadPayments() {

  paymentContainer.innerHTML =
    `<div class="loading">Loading payments...</div>`;


  try {

    const snapshot =
      await getDocs(
        collection(
          db,
          "payments"
        )
      );


    allPayments = [];


    snapshot.forEach(item => {

      allPayments.push({
        id: item.id,
        ...item.data()
      });

    });


    allPayments.sort(
      (a, b) => {

        const aTime =
          a.createdAt?.seconds || 0;

        const bTime =
          b.createdAt?.seconds || 0;

        return bTime - aTime;

      }
    );


    updateSummary();

    renderPayments();


  } catch (error) {

    paymentContainer.innerHTML = `
      <div class="empty">

        <div class="empty-icon">⚠️</div>

        <div class="empty-title">
          Payments Load Error
        </div>

        <div class="empty-text">
          ${escapeHtml(
            error.message ||
            "Unable to load payments."
          )}
        </div>

      </div>
    `;

    throw error;
  }

}


/* =========================
   SUMMARY
========================= */

function updateSummary() {

  let pending = 0;
  let payable = 0;
  let hold = 0;
  let paid = 0;


  allPayments.forEach(
    payment => {

      const amount =
        Number(
          payment.amount || 0
        );

      const status =
        normalizeStatus(
          payment.status
        );


      if (
        status === "PENDING" ||
        status === "APPROVED"
      ) {
        pending += amount;
      }


      if (
        status === "PAYABLE"
      ) {
        payable += amount;
      }


      if (
        status === "WARRANTY HOLD"
      ) {
        hold += amount;
      }


      if (
        status === "PAID"
      ) {
        paid += amount;
      }

    }
  );


  pendingAmount.textContent =
    formatMoney(pending);

  payableAmount.textContent =
    formatMoney(payable);

  holdAmount.textContent =
    formatMoney(hold);

  paidAmount.textContent =
    formatMoney(paid);

}


/* =========================
   FILTER
========================= */

searchInput.addEventListener(
  "input",
  renderPayments
);

paymentTypeFilter.addEventListener(
  "change",
  renderPayments
);

statusFilter.addEventListener(
  "change",
  renderPayments
);


/* =========================
   RENDER
========================= */

function renderPayments() {

  const search =
    searchInput.value
      .trim()
      .toLowerCase();

  const selectedType =
    normalizeStatus(
      paymentTypeFilter.value
    );

  const selectedStatus =
    normalizeStatus(
      statusFilter.value
    );


  const filtered =
    allPayments.filter(
      payment => {

        const searchable = [

          payment.id,
          payment.paymentId,
          payment.jobId,
          payment.technicianName,
          payment.technicianId,
          payment.retailerName,
          payment.retailerId,
          payment.transactionReference

        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();


        const searchMatch =
          !search ||
          searchable.includes(search);


        const typeMatch =
          !selectedType ||
          normalizeStatus(
            payment.paymentType
          ) === selectedType;


        const statusMatch =
          !selectedStatus ||
          normalizeStatus(
            payment.status
          ) === selectedStatus;


        return (
          searchMatch &&
          typeMatch &&
          statusMatch
        );

      }
    );


  if (
    filtered.length === 0
  ) {

    paymentContainer.innerHTML = `
      <div class="empty">

        <div class="empty-icon">💳</div>

        <div class="empty-title">
          No Payments Found
        </div>

        <div class="empty-text">
          No payment records match your filters.
        </div>

      </div>
    `;

    return;
  }


  paymentContainer.innerHTML = `
    <div>
      ${filtered
        .map(renderPaymentCard)
        .join("")}
    </div>
  `;


  document
    .querySelectorAll(
      "[data-view-payment]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => openPaymentModal(
          button.dataset.viewPayment,
          "VIEW"
        )
      );

    });


  document
    .querySelectorAll(
      "[data-approve-payment]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => openPaymentModal(
          button.dataset.approvePayment,
          "APPROVE"
        )
      );

    });


  document
    .querySelectorAll(
      "[data-pay-payment]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => openPaymentModal(
          button.dataset.payPayment,
          "PAY"
        )
      );

    });

}


/* =========================
   PAYMENT CARD
========================= */

function renderPaymentCard(
  payment
) {

  const status =
    normalizeStatus(
      payment.status ||
      "PENDING"
    );


  const type =
    normalizeStatus(
      payment.paymentType ||
      "TECHNICIAN"
    );


  const recipient =
    payment.technicianName ||
    payment.retailerName ||
    payment.recipientName ||
    payment.technicianId ||
    payment.retailerId ||
    "Recipient";


  const amount =
    Number(
      payment.amount || 0
    );


  const canApprove =
    (
      type === "TECHNICIAN" &&
      status === "PENDING"
    );


  const canPay =
    status === "PAYABLE";


  return `

    <div class="payment-card">

      <div class="card-top">

        <div>

          <div class="payment-id">
            ${escapeHtml(
              payment.paymentId ||
              payment.id
            )}
          </div>

          <div class="recipient">
            ${escapeHtml(
              recipient
            )}
          </div>

          <div class="payment-type">
            ${escapeHtml(
              formatType(type)
            )}
          </div>

        </div>


        <span class="status ${
          getStatusClass(status)
        }">

          ${escapeHtml(
            formatStatus(status)
          )}

        </span>

      </div>


      <div class="amount-box">

        <div class="amount-label">
          Payment Amount
        </div>

        <div class="amount-value">
          ${escapeHtml(
            formatMoney(amount)
          )}
        </div>

      </div>


      <div class="info-grid">

        <div class="info-box">

          <div class="info-label">
            Job ID
          </div>

          <div class="info-value">
            ${escapeHtml(
              payment.jobId || "-"
            )}
          </div>

        </div>


        <div class="info-box">

          <div class="info-label">
            Method
          </div>

          <div class="info-value">
            ${escapeHtml(
              payment.paymentMethod ||
              "-"
            )}
          </div>

        </div>


        <div class="info-box">

          <div class="info-label">
            Created
          </div>

          <div class="info-value">
            ${escapeHtml(
              formatDate(
                payment.createdAt
              )
            )}
          </div>

        </div>


        <div class="info-box">

          <div class="info-label">
            Paid Date
          </div>

          <div class="info-value">
            ${escapeHtml(
              formatDate(
                payment.paidAt
              )
            )}
          </div>

        </div>

      </div>


      <div class="divider"></div>


      <div class="action-row">

        <button
          type="button"
          class="action-btn view-btn"
          data-view-payment="${escapeAttribute(payment.id)}"
        >
          View
        </button>


        <button
          type="button"
          class="action-btn approve-btn"
          data-approve-payment="${escapeAttribute(payment.id)}"
          ${canApprove ? "" : "disabled"}
        >
          Approve
        </button>


        <button
          type="button"
          class="action-btn pay-btn"
          data-pay-payment="${escapeAttribute(payment.id)}"
          ${canPay ? "" : "disabled"}
        >
          Mark Paid
        </button>

      </div>

    </div>

  `;

}


/* =========================
   OPEN MODAL
========================= */

function openPaymentModal(
  paymentId,
  action
) {

  const payment =
    allPayments.find(
      item =>
        item.id === paymentId
    );


  if (!payment) {

    showError(
      "Payment record not found."
    );

    return;
  }


  selectedPaymentId =
    paymentId;

  selectedAction =
    action;


  const status =
    normalizeStatus(
      payment.status
    );


  const type =
    normalizeStatus(
      payment.paymentType
    );


  const recipient =
    payment.technicianName ||
    payment.retailerName ||
    payment.recipientName ||
    payment.technicianId ||
    payment.retailerId ||
    "-";


  modalTitle.textContent =
    action === "APPROVE"
      ? "Approve Payment"
      : action === "PAY"
        ? "Complete Payment"
        : "Payment Details";


  modalContent.innerHTML = `

    <div class="form-field">

      <label>Payment ID</label>

      <input
        type="text"
        value="${escapeAttribute(
          payment.paymentId ||
          payment.id
        )}"
        readonly
      >

    </div>


    <div class="form-grid">

      <div class="form-field">

        <label>Payment Type</label>

        <input
          type="text"
          value="${escapeAttribute(
            formatType(type)
          )}"
          readonly
        >

      </div>


      <div class="form-field">

        <label>Status</label>

        <input
          type="text"
          value="${escapeAttribute(
            formatStatus(status)
          )}"
          readonly
        >

      </div>

    </div>


    <div class="form-field">

      <label>Recipient</label>

      <input
        type="text"
        value="${escapeAttribute(
          recipient
        )}"
        readonly
      >

    </div>


    <div class="form-grid">

      <div class="form-field">

        <label>Amount</label>

        <input
          type="text"
          value="${escapeAttribute(
            formatMoney(
              payment.amount
            )
          )}"
          readonly
        >

      </div>


      <div class="form-field">

        <label>Job ID</label>

        <input
          type="text"
          value="${escapeAttribute(
            payment.jobId ||
            "-"
          )}"
          readonly
        >

      </div>

    </div>


    <div class="form-field">

      <label>Transaction Reference</label>

      <input
        type="text"
        value="${escapeAttribute(
          payment.transactionReference ||
          "-"
        )}"
        readonly
      >

    </div>


    <div class="form-field">

      <label>Notes</label>

      <textarea readonly>${escapeHtml(
        payment.notes ||
        ""
      )}</textarea>

    </div>

  `;


  paymentFormArea.style.display =
    action === "PAY"
      ? "block"
      : "none";


  if (action === "APPROVE") {

    primaryModalBtn.textContent =
      "Approve Payment";

    primaryModalBtn.style.display =
      "block";

  } else if (action === "PAY") {

    primaryModalBtn.textContent =
      "Confirm Paid";

    primaryModalBtn.style.display =
      "block";

  } else {

    primaryModalBtn.style.display =
      "none";

  }


  modalBackdrop.classList.add(
    "show"
  );

}


/* =========================
   PRIMARY ACTION
========================= */

primaryModalBtn.addEventListener(
  "click",
  handlePrimaryAction
);


async function handlePrimaryAction() {

  if (!selectedPaymentId) {
    return;
  }


  if (
    selectedAction === "APPROVE"
  ) {

    await approvePayment();

    return;
  }


  if (
    selectedAction === "PAY"
  ) {

    await markPaymentPaid();

  }

}


/* =========================
   APPROVE
========================= */

async function approvePayment() {

  const payment =
    getSelectedPayment();


  if (!payment) {
    return;
  }


  const status =
    normalizeStatus(
      payment.status
    );


  const type =
    normalizeStatus(
      payment.paymentType
    );


  if (
    type !== "TECHNICIAN"
  ) {

    showError(
      "Only technician payments use the Pending → Approved flow."
    );

    return;
  }


  if (
    status !== "PENDING"
  ) {

    showError(
      "Only Pending payments can be approved."
    );

    return;
  }


  setActionLoading(
    "Approving..."
  );


  try {

    await updateDoc(
      doc(
        db,
        "payments",
        selectedPaymentId
      ),
      {
        status: "PAYABLE",

        approvedAt:
          serverTimestamp(),

        approvedBy:
          adminUser.uid,

        updatedAt:
          serverTimestamp()
      }
    );


    /*
      IMPORTANT:
      Approval changes the payment to PAYABLE.
      It does NOT mark it as PAID.
    */


    closeModal();

    await loadPayments();

    showSuccess(
      "Payment approved and moved to PAYABLE."
    );


  } catch (error) {

    showError(
      error.message ||
      "Payment approval failed."
    );

  } finally {

    resetActionButton();

  }

}


/* =========================
   MARK PAID
========================= */

async function markPaymentPaid() {

  const payment =
    getSelectedPayment();


  if (!payment) {
    return;
  }


  const status =
    normalizeStatus(
      payment.status
    );


  if (
    status !== "PAYABLE"
  ) {

    showError(
      "Only PAYABLE payments can be marked as PAID."
    );

    return;
  }


  const method =
    paymentMethod.value;


  const reference =
    transactionReference.value.trim();


  if (!method) {

    showError(
      "Select a payment method."
    );

    return;
  }


  setActionLoading(
    "Processing..."
  );


  try {

    await updateDoc(
      doc(
        db,
        "payments",
        selectedPaymentId
      ),
      {
        status: "PAID",

        paymentMethod:
          method,

        transactionReference:
          reference,

        paymentNotes:
          paymentNotes.value.trim(),

        paidAt:
          serverTimestamp(),

        paidBy:
          adminUser.uid,

        updatedAt:
          serverTimestamp()
      }
    );


    /*
      PAID records are treated as immutable
      by the business workflow.

      Future correction should use an
      ADJUSTED transaction instead of
      editing the original paid record.
    */


    closeModal();

    await loadPayments();

    showSuccess(
      "Payment marked as PAID successfully."
    );


  } catch (error) {

    showError(
      error.message ||
      "Payment completion failed."
    );

  } finally {

    resetActionButton();

  }

}


/* =========================
   SELECTED PAYMENT
========================= */

function getSelectedPayment() {

  return allPayments.find(
    payment =>
      payment.id ===
      selectedPaymentId
  ) || null;

}


/* =========================
   ACTION LOADING
========================= */

function setActionLoading(
  text
) {

  primaryModalBtn.disabled =
    true;

  primaryModalBtn.textContent =
    text;

}


function resetActionButton() {

  primaryModalBtn.disabled =
    false;

  if (
    selectedAction ===
    "APPROVE"
  ) {

    primaryModalBtn.textContent =
      "Approve Payment";

  } else {

    primaryModalBtn.textContent =
      "Confirm Paid";

  }

}


/* =========================
   PAYMENT TYPE
========================= */

function formatType(type) {

  switch (
    normalizeStatus(type)
  ) {

    case "TECHNICIAN":
      return "Technician Payment";

    case "RETAILER":
      return "Retailer Payment";

    default:
      return type || "Payment";

  }

}


/* =========================
   STATUS
========================= */

function normalizeStatus(
  value
) {

  return String(
    value || ""
  )
    .trim()
    .toUpperCase();

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


function getStatusClass(
  status
) {

  switch (
    normalizeStatus(status)
  ) {

    case "PENDING":
      return "status-pending";

    case "APPROVED":
      return "status-approved";

    case "PAYABLE":
      return "status-payable";

    case "WARRANTY HOLD":
      return "status-hold";

    case "PAID":
      return "status-paid";

    case "CANCELLED":
      return "status-cancelled";

    case "ADJUSTED":
      return "status-adjusted";

    default:
      return "status-pending";

  }

}


/* =========================
   MONEY
========================= */

function formatMoney(
  value
) {

  return Number(
    value || 0
  ).toLocaleString(
    "en-IN",
    {
      style:"currency",
      currency:"INR",
      maximumFractionDigits:0
    }
  );

}


/* =========================
   DATE
========================= */

function formatDate(
  value
) {

  if (!value) {
    return "-";
  }


  let date = null;


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


  if (
    !date ||
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "-";

  }


  return date.toLocaleDateString(
    "en-IN",
    {
      day:"2-digit",
      month:"short",
      year:"numeric"
    }
  );

}


/* =========================
   CLOSE MODAL
========================= */

function closeModal() {

  modalBackdrop.classList.remove(
    "show"
  );

  selectedPaymentId =
    null;

  selectedAction =
    null;

  modalContent.innerHTML =
    "";

  paymentFormArea.style.display =
    "none";

  transactionReference.value =
    "";

  paymentNotes.value =
    "";

  primaryModalBtn.disabled =
    false;

}


closeModalBtn.addEventListener(
  "click",
  closeModal
);


cancelModalBtn.addEventListener(
  "click",
  closeModal
);


modalBackdrop.addEventListener(
  "click",
  event => {

    if (
      event.target ===
      modalBackdrop
    ) {

      closeModal();

    }

  }
);


/* =========================
   LOGOUT
========================= */

logoutBtn.addEventListener(
  "click",
  async () => {

    try {

      await signOut(auth);

      window.location.href =
        "../index.html";

    } catch (error) {

      showError(
        error.message ||
        "Logout failed."
      );

    }

  }
);


/* =========================
   MESSAGES
========================= */

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


/* =========================
   ESCAPE
========================= */

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

  return escapeHtml(value);

}