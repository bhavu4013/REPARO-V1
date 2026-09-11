import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


const $ = id =>
  document.getElementById(id);


let currentUser = null;
let currentJob = null;
let currentInvoice = null;


// ==================================================
// JOB ID
// ==================================================

const params =
  new URLSearchParams(
    window.location.search
  );

const jobId =
  params.get("jobId") ||
  params.get("id");


// ==================================================
// AUTH
// ==================================================

onAuthStateChanged(
  auth,
  async user => {

    if (!user) {
      location.href = "../index.html";
      return;
    }


    try {

      const profile =
        await getDoc(
          doc(
            db,
            "users",
            user.uid
          )
        );


      if (
        !profile.exists() ||
        profile.data().role !== "admin"
      ) {

        location.href =
          "../index.html";

        return;

      }


      currentUser = user;


      if (!jobId) {

        showError(
          "Job ID is missing."
        );

        return;

      }


      await loadInvoiceData();


    } catch (error) {

      console.error(error);

      showError(
        "Unable to load invoice."
      );

    }

  }
);


// ==================================================
// LOAD
// ==================================================

async function loadInvoiceData() {

  const jobSnap =
    await getDoc(
      doc(
        db,
        "jobs",
        jobId
      )
    );


  if (!jobSnap.exists()) {

    showError(
      "Job not found."
    );

    return;

  }


  currentJob = {
    id: jobSnap.id,
    ...jobSnap.data()
  };


  if (
    currentJob.status !==
    "COMPLETED"
  ) {

    showError(
      "Invoice can be generated only after Job is completed."
    );

    return;

  }


  const invoiceId =
    currentJob.invoiceId;


  if (invoiceId) {

    const invoiceSnap =
      await getDoc(
        doc(
          db,
          "invoices",
          invoiceId
        )
      );


    if (invoiceSnap.exists()) {

      currentInvoice = {
        id: invoiceSnap.id,
        ...invoiceSnap.data()
      };

    }

  }


  renderInvoice();


  $("loading").style.display =
    "none";

  $("invoiceContent")
    .classList
    .remove("hidden");

}


// ==================================================
// RENDER
// ==================================================

function renderInvoice() {

  const invoice =
    currentInvoice || {};


  $("invoiceId").textContent =
    invoice.invoiceId ||
    "Not Generated";


  $("invoiceStatus").textContent =
    invoice.status ||
    "DRAFT";


  $("customerName").textContent =
    currentJob.customerName ||
    "-";


  $("customerMobile").textContent =
    currentJob.customerMobile ||
    "-";


  $("customerAddress").textContent =
    currentJob.customerAddress ||
    "-";


  $("jobId").textContent =
    currentJob.jobId ||
    currentJob.id;


  $("serviceType").textContent =
    currentJob.serviceType ||
    "-";


  $("device").textContent =
    [
      currentJob.deviceBrand,
      currentJob.deviceModel
    ]
      .filter(Boolean)
      .join(" ") ||
    "-";


  $("serialNumber").textContent =
    currentJob.serialNumber ||
    "-";


  $("retailerId").textContent =
    currentJob.retailerId ||
    "-";


  const labour =
    invoice.labourAmount ??
    currentJob.finalLabour ??
    currentJob.labourCharge ??
    0;


  const parts =
    invoice.partsAmount ??
    currentJob.finalParts ??
    currentJob.partsAmount ??
    0;


  const visit =
    invoice.visitAmount ??
    0;


  const discount =
    invoice.discountAmount ??
    0;


  const total =
    invoice.totalAmount ??
    Math.max(
      0,
      Number(labour) +
      Number(parts) +
      Number(visit) -
      Number(discount)
    );


  $("labourAmount").textContent =
    money(labour);


  $("partsAmount").textContent =
    money(parts);


  $("visitAmount").textContent =
    money(visit);


  $("discountAmount").textContent =
    money(discount);


  $("totalAmount").textContent =
    money(total);


  $("paymentStatus").value =
    invoice.paymentStatus ||
    "PENDING";


  $("paymentMethod").value =
    invoice.paymentMethod ||
    "";


  if (invoice.warrantyDays != null) {

    $("warrantyDays").value =
      String(
        invoice.warrantyDays
      );

  }


  updateWarrantyPreview();

}


// ==================================================
// SAVE INVOICE
// ==================================================

$("saveInvoiceBtn")
  .addEventListener(
    "click",
    saveInvoice
  );


async function saveInvoice() {

  if (!currentJob) return;


  const labour =
    Number(
      currentJob.finalLabour ||
      currentJob.labourCharge ||
      0
    );


  const parts =
    Number(
      currentJob.finalParts ||
      currentJob.partsAmount ||
      0
    );


  const visit =
    Number(
      currentInvoice?.visitAmount ||
      0
    );


  const discount =
    Number(
      currentInvoice?.discountAmount ||
      0
    );


  const total =
    Math.max(
      0,
      labour +
      parts +
      visit -
      discount
    );


  const invoiceDocumentId =
    currentInvoice?.id ||
    crypto.randomUUID();


  const invoiceNumber =
    currentInvoice?.invoiceId ||
    generateInvoiceId();


  const data = {

    invoiceId:
      invoiceNumber,

    jobId:
      currentJob.id,

    jobNumber:
      currentJob.jobId ||
      currentJob.id,

    requestId:
      currentJob.requestId ||
      null,

    retailerId:
      currentJob.retailerId ||
      null,

    customerName:
      currentJob.customerName ||
      "",

    customerMobile:
      currentJob.customerMobile ||
      "",

    customerAddress:
      currentJob.customerAddress ||
      "",

    deviceBrand:
      currentJob.deviceBrand ||
      "",

    deviceModel:
      currentJob.deviceModel ||
      "",

    serialNumber:
      currentJob.serialNumber ||
      "",

    serviceType:
      currentJob.serviceType ||
      "",

    labourAmount:
      labour,

    partsAmount:
      parts,

    visitAmount:
      visit,

    discountAmount:
      discount,

    totalAmount:
      total,

    paymentStatus:
      $("paymentStatus").value,

    paymentMethod:
      $("paymentMethod").value,

    status:
      "ISSUED",

    updatedAt:
      serverTimestamp()

  };


  try {

    if (!currentInvoice) {

      data.createdAt =
        serverTimestamp();

      data.createdBy =
        currentUser.uid;

    }


    await setDoc(
      doc(
        db,
        "invoices",
        invoiceDocumentId
      ),
      data,
      { merge: true }
    );


    await updateDoc(
      doc(
        db,
        "jobs",
        currentJob.id
      ),
      {

        invoiceId:
          invoiceDocumentId,

        invoiceNumber:
          invoiceNumber,

        updatedAt:
          serverTimestamp()

      }
    );


    currentInvoice = {
      id:
        invoiceDocumentId,
      ...data
    };


    renderInvoice();


    alert(
      "Invoice saved successfully."
    );


  } catch (error) {

    console.error(error);

    alert(
      "Unable to save Invoice.\n\n" +
      error.message
    );

  }

}


// ==================================================
// PAYMENT
// ==================================================

$("savePaymentBtn")
  .addEventListener(
    "click",
    async () => {

      if (!currentInvoice) {

        alert(
          "Generate the invoice first."
        );

        return;

      }


      try {

        await updateDoc(
          doc(
            db,
            "invoices",
            currentInvoice.id
          ),
          {

            paymentStatus:
              $("paymentStatus").value,

            paymentMethod:
              $("paymentMethod").value,

            paymentUpdatedAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp()

          }
        );


        currentInvoice.paymentStatus =
          $("paymentStatus").value;

        currentInvoice.paymentMethod =
          $("paymentMethod").value;


        alert(
          "Payment status updated."
        );


      } catch (error) {

        console.error(error);

        alert(
          "Unable to update payment."
        );

      }

    }
  );


// ==================================================
// WARRANTY
// ==================================================

$("warrantyDays")
  .addEventListener(
    "change",
    updateWarrantyPreview
  );


function updateWarrantyPreview() {

  const days =
    Number(
      $("warrantyDays").value
    ) || 0;


  if (!days) {

    $("warrantyStart").textContent =
      "No Warranty";

    $("warrantyEnd").textContent =
      "No Warranty";

    $("commissionStatus").textContent =
      "RELEASED";

    return;

  }


  const start =
    new Date();


  const end =
    new Date(start);


  end.setDate(
    end.getDate() + days
  );


  $("warrantyStart").textContent =
    formatDate(start);


  $("warrantyEnd").textContent =
    formatDate(end);


  $("commissionStatus").textContent =
    "WARRANTY HOLD";

}


// ==================================================
// SAVE WARRANTY
// ==================================================

$("saveWarrantyBtn")
  .addEventListener(
    "click",
    async () => {

      if (!currentInvoice) {

        alert(
          "Generate the invoice first."
        );

        return;

      }


      const days =
        Number(
          $("warrantyDays").value
        ) || 0;


      const start =
        new Date();


      const end =
        new Date(start);


      end.setDate(
        end.getDate() + days
      );


      try {

        const warrantyId =
          currentInvoice.id;


        await setDoc(
          doc(
            db,
            "warranty",
            warrantyId
          ),
          {

            warrantyId,

            invoiceId:
              currentInvoice.id,

            jobId:
              currentJob.id,

            retailerId:
              currentJob.retailerId ||
              null,

            customerName:
              currentJob.customerName ||
              "",

            customerMobile:
              currentJob.customerMobile ||
              "",

            deviceBrand:
              currentJob.deviceBrand ||
              "",

            deviceModel:
              currentJob.deviceModel ||
              "",

            serialNumber:
              currentJob.serialNumber ||
              "",

            warrantyDays:
              days,

            warrantyStart:
              start,

            warrantyEnd:
              end,

            status:
              days > 0
                ? "WARRANTY HOLD"
                : "RELEASED",

            commissionStatus:
              days > 0
                ? "WARRANTY HOLD"
                : "RELEASED",

            createdAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp()

          },
          { merge: true }
        );


        await updateDoc(
          doc(
            db,
            "invoices",
            currentInvoice.id
          ),
          {

            warrantyId,

            warrantyDays:
              days,

            warrantyStart:
              start,

            warrantyEnd:
              end,

            updatedAt:
              serverTimestamp()

          }
        );


        alert(
          days
            ? `Warranty saved for ${days} days.`
            : "Warranty disabled."
        );


        updateWarrantyPreview();


      } catch (error) {

        console.error(error);

        alert(
          "Unable to save warranty.\n\n" +
          error.message
        );

      }

    }
  );


// ==================================================
// HELPERS
// ==================================================

function generateInvoiceId() {

  const now =
    new Date();

  const date =
    now.getFullYear() +
    String(
      now.getMonth() + 1
    ).padStart(2, "0") +
    String(
      now.getDate()
    ).padStart(2, "0");


  const random =
    Math.floor(
      1000 +
      Math.random() * 9000
    );


  return `INV-${date}-${random}`;

}


function money(value) {

  return (
    "₹" +
    Number(value || 0)
      .toLocaleString("en-IN")
  );

}


function formatDate(date) {

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }
  );

}


function showError(message) {

  $("loading").textContent =
    message;

}