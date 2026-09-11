import { auth, db } from "../js/firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


let currentUser = null;

const params =
  new URLSearchParams(
    location.search
  );

const invoiceId =
  params.get("invoiceId");


// =====================================================
// AUTH
// =====================================================

onAuthStateChanged(
  auth,
  async user => {

    if (!user) {

      location.href =
        "../index.html";

      return;

    }


    try {

      const profileSnap =
        await getDoc(
          doc(
            db,
            "users",
            user.uid
          )
        );


      if (
        !profileSnap.exists() ||
        profileSnap.data().role !==
          "customer"
      ) {

        showError(
          "Customer access required."
        );

        return;

      }


      currentUser = user;


      await loadInvoice(
        profileSnap.data()
      );

    } catch (error) {

      console.error(error);

      showError(
        "Unable to load invoice."
      );

    }

  }
);


// =====================================================
// LOAD
// =====================================================

async function loadInvoice(profile) {

  if (!invoiceId) {

    showError(
      "Invoice ID is missing."
    );

    return;

  }


  const snap =
    await getDoc(
      doc(
        db,
        "invoices",
        invoiceId
      )
    );


  if (!snap.exists()) {

    showError(
      "Invoice not found."
    );

    return;

  }


  const invoice =
    snap.data();


  if (
    invoice.customerId &&
    invoice.customerId !==
      profile.customerId
  ) {

    showError(
      "You do not have access to this invoice."
    );

    return;

  }


  if (
    invoice.customerId ===
    undefined &&
    invoice.customerMobile &&
    profile.mobile &&
    invoice.customerMobile !==
      profile.mobile
  ) {

    showError(
      "You do not have access to this invoice."
    );

    return;

  }


  render(invoice);

}


// =====================================================
// RENDER
// =====================================================

function render(invoice) {

  document.getElementById(
    "customerName"
  ).textContent =
    invoice.customerName ||
    "-";


  document.getElementById(
    "customerMobile"
  ).textContent =
    invoice.customerMobile ||
    "-";


  document.getElementById(
    "invoiceNumber"
  ).textContent =
    invoice.invoiceId ||
    invoice.id ||
    "-";


  document.getElementById(
    "invoiceDate"
  ).textContent =
    formatDate(
      invoice.createdAt
    );


  document.getElementById(
    "device"
  ).textContent =
    [
      invoice.deviceBrand,
      invoice.deviceModel
    ]
      .filter(Boolean)
      .join(" ") ||
    "-";


  document.getElementById(
    "serial"
  ).textContent =
    invoice.serialNumber ||
    "-";


  document.getElementById(
    "service"
  ).textContent =
    invoice.serviceType ||
    "-";


  document.getElementById(
    "labour"
  ).textContent =
    money(
      invoice.labourAmount
    );


  document.getElementById(
    "parts"
  ).textContent =
    money(
      invoice.partsAmount
    );


  document.getElementById(
    "visit"
  ).textContent =
    money(
      invoice.visitAmount
    );


  document.getElementById(
    "discount"
  ).textContent =
    money(
      invoice.discountAmount
    );


  document.getElementById(
    "total"
  ).textContent =
    money(
      invoice.totalAmount
    );


  const paymentStatus =
    String(
      invoice.paymentStatus ||
      "PENDING"
    ).toUpperCase();


  const paymentElement =
    document.getElementById(
      "paymentStatus"
    );


  paymentElement.textContent =
    paymentStatus;


  paymentElement.className =
    paymentStatus === "PAID"
      ? "paid"
      : "pending";


  document.getElementById(
    "paymentMethod"
  ).textContent =
    invoice.paymentMethod ||
    "-";


  const days =
    Number(
      invoice.warrantyDays ||
      0
    );


  document.getElementById(
    "warrantyTitle"
  ).textContent =
    days
      ? `${days} Days Service Warranty`
      : "No Warranty";


  document.getElementById(
    "warrantyStart"
  ).textContent =
    formatDate(
      invoice.warrantyStart
    );


  document.getElementById(
    "warrantyEnd"
  ).textContent =
    formatDate(
      invoice.warrantyEnd
    );


  document.getElementById(
    "loading"
  ).style.display =
    "none";


  document.getElementById(
    "content"
  ).style.display =
    "block";

}


// =====================================================
// HELPERS
// =====================================================

function money(value) {

  return (
    "₹" +
    Number(
      value || 0
    ).toLocaleString(
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
          "en-IN",
          {
            day: "2-digit",
            month: "short",
            year: "numeric"
          }
        );

    }


    const date =
      new Date(value);


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


function showError(message) {

  document.getElementById(
    "loading"
  ).textContent =
    message;

}