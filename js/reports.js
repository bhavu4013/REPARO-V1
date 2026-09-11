import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  collection,
  getDocs,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
  auth,
  db
} from "./firebase.js";


/* =========================
   DOM
========================= */

const fromDate =
  document.getElementById("fromDate");

const toDate =
  document.getElementById("toDate");

const applyReportBtn =
  document.getElementById("applyReportBtn");

const logoutBtn =
  document.getElementById("logoutBtn");

const errorBox =
  document.getElementById("errorBox");

const successBox =
  document.getElementById("successBox");

const reportLoading =
  document.getElementById("reportLoading");

const reportContent =
  document.getElementById("reportContent");


/* =========================
   STATE
========================= */

let adminUser = null;

let serviceRequests = [];
let jobs = [];
let commissions = [];
let payments = [];
let warranties = [];
let products = [];


/* =========================
   AUTH
========================= */

onAuthStateChanged(
  auth,
  async user => {

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


      setDefaultDates();

      await loadAllData();

      generateReport();


    } catch (error) {

      showError(
        error.message ||
        "Unable to load reports."
      );

      reportLoading.style.display =
        "none";

    }

  }
);


/* =========================
   DEFAULT DATE
========================= */

function setDefaultDates() {

  const now =
    new Date();


  const firstDay =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );


  fromDate.value =
    toInputDate(firstDay);

  toDate.value =
    toInputDate(now);

}


/* =========================
   LOAD ALL DATA
========================= */

async function loadAllData() {

  reportLoading.style.display =
    "block";

  reportContent.style.display =
    "none";


  const [
    requestSnapshot,
    jobSnapshot,
    commissionSnapshot,
    paymentSnapshot,
    warrantySnapshot,
    productSnapshot
  ] = await Promise.all([

    getDocs(
      collection(
        db,
        "service_requests"
      )
    ),

    getDocs(
      collection(
        db,
        "jobs"
      )
    ),

    getDocs(
      collection(
        db,
        "commissions"
      )
    ),

    getDocs(
      collection(
        db,
        "payments"
      )
    ),

    getDocs(
      collection(
        db,
        "warranty"
      )
    ),

    getDocs(
      collection(
        db,
        "products"
      )
    )

  ]);


  serviceRequests =
    snapshotToArray(
      requestSnapshot
    );

  jobs =
    snapshotToArray(
      jobSnapshot
    );

  commissions =
    snapshotToArray(
      commissionSnapshot
    );

  payments =
    snapshotToArray(
      paymentSnapshot
    );

  warranties =
    snapshotToArray(
      warrantySnapshot
    );

  products =
    snapshotToArray(
      productSnapshot
    );

}


/* =========================
   SNAPSHOT ARRAY
========================= */

function snapshotToArray(
  snapshot
) {

  const result = [];


  snapshot.forEach(
    item => {

      result.push({
        id: item.id,
        ...item.data()
      });

    }
  );


  return result;

}


/* =========================
   GENERATE REPORT
========================= */

function generateReport() {

  const start =
    parseStartDate(
      fromDate.value
    );

  const end =
    parseEndDate(
      toDate.value
    );


  if (
    !start ||
    !end
  ) {

    showError(
      "Please select both dates."
    );

    return;
  }


  if (
    start.getTime() >
    end.getTime()
  ) {

    showError(
      "From Date cannot be after To Date."
    );

    return;
  }


  const filteredRequests =
    filterRecords(
      serviceRequests,
      start,
      end
    );


  const filteredJobs =
    filterRecords(
      jobs,
      start,
      end
    );


  const filteredCommissions =
    filterRecords(
      commissions,
      start,
      end
    );


  const filteredPayments =
    filterRecords(
      payments,
      start,
      end
    );


  const filteredWarranties =
    filterRecords(
      warranties,
      start,
      end
    );


  const filteredProducts =
    filterRecords(
      products,
      start,
      end
    );


  const completedJobs =
    filteredJobs.filter(
      job =>
        normalize(
          job.status
        ) === "COMPLETED"
    );


  const cancelledJobs =
    filteredJobs.filter(
      job =>
        normalize(
          job.status
        ) === "CANCELLED"
    );


  const serviceRevenue =
    calculateServiceRevenue(
      completedJobs
    );


  const productRevenue =
    calculateProductRevenue(
      filteredProducts
    );


  const totalRevenue =
    serviceRevenue +
    productRevenue;


  const retailerCommission =
    calculateRetailerCommission(
      filteredCommissions
    );


  const technicianEarnings =
    calculateTechnicianEarnings(
      filteredPayments,
      filteredJobs
    );


  const warrantyHold =
    calculateWarrantyHold(
      filteredWarranties,
      filteredPayments
    );


  const paid =
    calculatePaymentStatus(
      filteredPayments,
      "PAID"
    );


  const pending =
    calculatePending(
      filteredPayments
    );


  const payable =
    calculatePaymentStatus(
      filteredPayments,
      "PAYABLE"
    );


  const estimatedProfit =
    totalRevenue -
    retailerCommission -
    technicianEarnings;


  renderReport({

    requests:
      filteredRequests.length,

    jobs:
      filteredJobs.length,

    completed:
      completedJobs.length,

    cancelled:
      cancelledJobs.length,

    serviceRevenue,

    productRevenue,

    totalRevenue,

    retailerCommission,

    technicianEarnings,

    warrantyHold,

    paid,

    pending,

    payable,

    estimatedProfit

  });


  reportLoading.style.display =
    "none";

  reportContent.style.display =
    "block";

}


/* =========================
   DATE FILTER
========================= */

function filterRecords(
  records,
  start,
  end
) {

  return records.filter(
    record => {

      const date =
        getRecordDate(record);


      if (!date) {
        return false;
      }


      return (
        date.getTime() >=
          start.getTime() &&
        date.getTime() <=
          end.getTime()
      );

    }
  );

}


/* =========================
   RECORD DATE
========================= */

function getRecordDate(
  record
) {

  const possibleFields = [

    "createdAt",
    "completedAt",
    "updatedAt",
    "approvedAt",
    "paidAt",
    "releasedAt",
    "date",
    "paymentDate"

  ];


  for (
    const field of possibleFields
  ) {

    if (
      record[field]
    ) {

      const date =
        getDateValue(
          record[field]
        );


      if (date) {
        return date;
      }

    }

  }


  return null;

}


/* =========================
   SERVICE REVENUE
========================= */

function calculateServiceRevenue(
  completedJobs
) {

  let total = 0;


  completedJobs.forEach(
    job => {

      const finalTotal =
        Number(
          job.finalTotal ??
          job.total ??
          job.serviceAmount ??
          0
        );


      if (
        finalTotal > 0
      ) {

        total +=
          finalTotal;

        return;
      }


      const labour =
        Number(
          job.finalLabour ??
          job.labourCharge ??
          0
        );


      const parts =
        Number(
          job.finalParts ??
          job.partsAmount ??
          0
        );


      total +=
        labour +
        parts;

    }
  );


  return total;

}


/* =========================
   PRODUCT REVENUE
========================= */

function calculateProductRevenue(
  records
) {

  let total = 0;


  records.forEach(
    product => {

      const selling =
        Number(
          product.sellingPrice ||
          product.saleAmount ||
          product.total ||
          0
        );


      /*
        Product master records normally
        represent inventory, not sales.

        Therefore only explicit sale/revenue
        fields are counted.
      */


      if (
        product.saleAmount != null ||
        product.total != null ||
        product.soldAt != null
      ) {

        total +=
          selling;

      }

    }
  );


  return total;

}


/* =========================
   RETAILER COMMISSION
========================= */

function calculateRetailerCommission(
  records
) {

  let total = 0;


  records.forEach(
    record => {

      total +=
        Number(
          record.amount ??
          record.commissionAmount ??
          record.retailerCommission ??
          record.commission ??
          0
        );

    }
  );


  return total;

}


/* =========================
   TECHNICIAN EARNINGS
========================= */

function calculateTechnicianEarnings(
  paymentRecords,
  jobRecords
) {

  let total = 0;


  paymentRecords.forEach(
    payment => {

      if (
        normalize(
          payment.paymentType
        ) === "TECHNICIAN"
      ) {

        total +=
          Number(
            payment.amount || 0
          );

      }

    }
  );


  /*
    Fallback:
    If technician payment records do not
    exist yet, use explicit technician earning
    fields stored on jobs.
  */


  if (
    total === 0
  ) {

    jobRecords.forEach(
      job => {

        total +=
          Number(
            job.technicianEarning ??
            job.technicianAmount ??
            0
          );

      }
    );

  }


  return total;

}


/* =========================
   WARRANTY HOLD
========================= */

function calculateWarrantyHold(
  warrantyRecords,
  paymentRecords
) {

  let total = 0;


  warrantyRecords.forEach(
    warranty => {

      if (
        normalize(
          warranty.status
        ) === "WARRANTY HOLD"
      ) {

        total +=
          Number(
            warranty.commissionAmount ??
            warranty.retailerCommission ??
            0
          );

      }

    }
  );


  /*
    If warranty records don't contain the
    amount, check payment records.
  */


  if (
    total === 0
  ) {

    paymentRecords.forEach(
      payment => {

        if (
          normalize(
            payment.status
          ) ===
          "WARRANTY HOLD"
        ) {

          total +=
            Number(
              payment.amount || 0
            );

        }

      }
    );

  }


  return total;

}


/* =========================
   PAYMENT STATUS
========================= */

function calculatePaymentStatus(
  records,
  requiredStatus
) {

  let total = 0;


  records.forEach(
    payment => {

      if (
        normalize(
          payment.status
        ) ===
        requiredStatus
      ) {

        total +=
          Number(
            payment.amount || 0
          );

      }

    }
  );


  return total;

}


/* =========================
   PENDING
========================= */

function calculatePending(
  records
) {

  let total = 0;


  records.forEach(
    payment => {

      const status =
        normalize(
          payment.status
        );


      if (
        status === "PENDING" ||
        status === "APPROVED"
      ) {

        total +=
          Number(
            payment.amount || 0
          );

      }

    }
  );


  return total;

}


/* =========================
   RENDER
========================= */

function renderReport(
  data
) {

  setText(
    "totalRequests",
    data.requests
  );

  setText(
    "totalJobs",
    data.jobs
  );

  setText(
    "completedJobs",
    data.completed
  );

  setText(
    "cancelledJobs",
    data.cancelled
  );


  setText(
    "serviceRevenue",
    formatMoney(
      data.serviceRevenue
    )
  );

  setText(
    "productRevenue",
    formatMoney(
      data.productRevenue
    )
  );

  setText(
    "totalRevenue",
    formatMoney(
      data.totalRevenue
    )
  );


  setText(
    "retailerCommission",
    formatMoney(
      data.retailerCommission
    )
  );

  setText(
    "technicianEarnings",
    formatMoney(
      data.technicianEarnings
    )
  );

  setText(
    "warrantyHold",
    formatMoney(
      data.warrantyHold
    )
  );

  setText(
    "paidPayments",
    formatMoney(
      data.paid
    )
  );


  setText(
    "businessRevenue",
    formatMoney(
      data.totalRevenue
    )
  );

  setText(
    "businessRetailerCost",
    formatMoney(
      data.retailerCommission
    )
  );

  setText(
    "businessTechnicianCost",
    formatMoney(
      data.technicianEarnings
    )
  );

  setText(
    "estimatedProfit",
    formatMoney(
      data.estimatedProfit
    )
  );


  setText(
    "reportPending",
    formatMoney(
      data.pending
    )
  );

  setText(
    "reportPayable",
    formatMoney(
      data.payable
    )
  );

  setText(
    "reportPaid",
    formatMoney(
      data.paid
    )
  );

  setText(
    "reportHold",
    formatMoney(
      data.warrantyHold
    )
  );

}


/* =========================
   APPLY
========================= */

applyReportBtn.addEventListener(
  "click",
  async () => {

    try {

      await loadAllData();

      generateReport();

      showSuccess(
        "Report generated successfully."
      );

    } catch (error) {

      showError(
        error.message ||
        "Report generation failed."
      );

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
   HELPERS
========================= */

function setText(
  id,
  value
) {

  const element =
    document.getElementById(id);


  if (element) {
    element.textContent =
      value;
  }

}


function normalize(
  value
) {

  return String(
    value || ""
  )
    .trim()
    .toUpperCase();

}


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


function getDateValue(
  value
) {

  if (!value) {
    return null;
  }


  if (
    typeof value.toDate ===
    "function"
  ) {

    return value.toDate();

  }


  if (
    value instanceof Date
  ) {

    return value;

  }


  if (
    typeof value === "number"
  ) {

    const date =
      new Date(value);

    return isNaN(
      date.getTime()
    )
      ? null
      : date;

  }


  if (
    typeof value === "string"
  ) {

    const date =
      new Date(value);

    return isNaN(
      date.getTime()
    )
      ? null
      : date;

  }


  return null;

}


function parseStartDate(
  value
) {

  if (!value) {
    return null;
  }


  return new Date(
    `${value}T00:00:00`
  );

}


function parseEndDate(
  value
) {

  if (!value) {
    return null;
  }


  return new Date(
    `${value}T23:59:59.999`
  );

}


function toInputDate(
  date
) {

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );


  return `${year}-${month}-${day}`;

}


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