import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
  auth,
  db
} from "./firebase.js";


const container =
  document.getElementById(
    "invoiceContainer"
  );

const backBtn =
  document.getElementById(
    "backBtn"
  );


const params =
  new URLSearchParams(
    window.location.search
  );

const jobId =
  params.get("jobId");


let customerProfile = null;
let job = null;
let invoice = null;
let warranty = null;


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


      if (!jobId) {

        showEmpty(
          "Invoice not available",
          "A valid service job was not provided."
        );

        return;
      }


      await loadInvoice();

    } catch (error) {

      showEmpty(
        "Unable to load invoice",
        error.message ||
          "Please try again."
      );

    }

  }
);


/* =========================================================
   LOAD
========================================================= */

async function loadInvoice() {

  const jobSnapshot =
    await getDoc(
      doc(
        db,
        "jobs",
        jobId
      )
    );


  if (
    !jobSnapshot.exists()
  ) {

    showEmpty(
      "Job not found",
      "This service job is not available."
    );

    return;
  }


  job = {
    id: jobSnapshot.id,
    ...jobSnapshot.data()
  };


  /*
    Security check in JavaScript is an additional
    protection. Firestore rules remain the real
    authorization layer.
  */

  if (
    job.customerId !==
    customerProfile.customerId
  ) {

    showEmpty(
      "Access denied",
      "This invoice does not belong to your account."
    );

    return;
  }


  /*
    Invoice is optional because some jobs may
    currently use the final job amount directly.
  */

  if (job.invoiceId) {

    const invoiceSnapshot =
      await getDoc(
        doc(
          db,
          "invoices",
          job.invoiceId
        )
      );


    if (
      invoiceSnapshot.exists()
    ) {

      invoice = {
        id: invoiceSnapshot.id,
        ...invoiceSnapshot.data()
      };

    }

  }


  /*
    Warranty is optional.
  */

  if (job.warrantyId) {

    const warrantySnapshot =
      await getDoc(
        doc(
          db,
          "warranty",
          job.warrantyId
        )
      );


    if (
      warrantySnapshot.exists()
    ) {

      const data =
        warrantySnapshot.data();


      if (
        data.customerId ===
        customerProfile.customerId
      ) {

        warranty = data;

      }

    }

  }


  renderInvoice();

}


/* =========================================================
   RENDER
========================================================= */

function renderInvoice() {

  const source =
    invoice || job;


  const serviceAmount =
    number(
      firstValue(
        source.serviceAmount,
        source.labourCharge,
        source.finalLabour,
        job.finalLabour
      )
    );


  const partsAmount =
    number(
      firstValue(
        source.partsAmount,
        source.finalParts,
        job.finalParts
      )
    );


  const visitAmount =
    number(
      firstValue(
        source.visitCharge,
        source.visitAmount
      )
    );


  const installationAmount =
    number(
      firstValue(
        source.installationCharge,
        source.installationAmount
      )
    );


  const productAmount =
    number(
      firstValue(
        source.productAmount,
        source.productTotal,
        source.productSales
      )
    );


  const discount =
    number(
      firstValue(
        source.discount,
        job.discount
      )
    );


  let total =
    firstValue(
      source.customerTotal,
      source.grandTotal,
      source.total,
      source.finalTotal,
      job.finalTotal
    );


  if (
    total === null ||
    total === undefined ||
    total === ""
  ) {

    total =
      serviceAmount +
      partsAmount +
      visitAmount +
      installationAmount +
      productAmount -
      discount;

  }


  total =
    number(total);


  const invoiceId =
    firstValue(
      invoice?.invoiceNumber,
      invoice?.invoiceId,
      invoice?.id,
      job.invoiceNumber
    ) ||
    `INV-${job.id.slice(0, 8).toUpperCase()}`;


  const paymentStatus =
    String(
      firstValue(
        invoice?.paymentStatus,
        job.paymentStatus,
        job.payment?.status
      ) ||
      "PENDING"
    ).toUpperCase();


  container.innerHTML = `

    <section class="card">

      <div class="invoice-head">

        <div>

          <div class="brand">
            REPARO
          </div>

          <div class="invoice-label">
            Electronics Service
          </div>

        </div>


        <div>

          <div class="invoice-id">
            ${escapeHtml(
              invoiceId
            )}
          </div>

          <div class="date">
            ${escapeHtml(
              formatDate(
                firstValue(
                  invoice?.invoiceDate,
                  invoice?.createdAt,
                  job.completedAt,
                  job.updatedAt
                )
              )
            )}
          </div>

        </div>

      </div>

    </section>


    <section class="card">

      <h2 class="section-title">
        Customer
      </h2>

      ${row(
        "Name",
        firstValue(
          invoice?.customerName,
          job.customerName,
          customerProfile.name
        ) || "-"
      )}

      ${row(
        "Mobile",
        firstValue(
          invoice?.customerMobile,
          job.customerMobile,
          customerProfile.mobile
        ) || "-"
      )}

      ${row(
        "Service Job",
        job.jobId || job.id
      )}

    </section>


    <section class="card">

      <h2 class="section-title">
        Device
      </h2>

      ${row(
        "Device",
        getDeviceText(job)
      )}

      ${row(
        "Service",
        job.serviceType || "Repair"
      )}

      ${
        job.serialNumber
          ? row(
              "Serial Number",
              job.serialNumber
            )
          : ""
      }

    </section>


    <section class="card">

      <h2 class="section-title">
        Charges
      </h2>

      ${
        serviceAmount > 0
          ? row(
              "Service / Labour",
              money(serviceAmount)
            )
          : ""
      }

      ${
        partsAmount > 0
          ? row(
              "Parts / Material",
              money(partsAmount)
            )
          : ""
      }

      ${
        visitAmount > 0
          ? row(
              "Visit Charge",
              money(visitAmount)
            )
          : ""
      }

      ${
        installationAmount > 0
          ? row(
              "Installation",
              money(installationAmount)
            )
          : ""
      }

      ${
        productAmount > 0
          ? row(
              "Products / Accessories",
              money(productAmount)
            )
          : ""
      }

      ${
        discount > 0
          ? row(
              "Discount",
              `- ${money(discount)}`
            )
          : ""
      }


      <div class="total">

        <span>
          Total
        </span>

        <span>
          ${money(total)}
        </span>

      </div>

    </section>


    <section class="card">

      <h2 class="section-title">
        Payment
      </h2>

      ${
        paymentStatus === "PAID"
          ? `
            <span class="paid">
              PAID
            </span>
          `
          : `
            <span class="pending">
              ${escapeHtml(
                formatPaymentStatus(
                  paymentStatus
                )
              )}
            </span>
          `
      }

      ${
        invoice?.paymentMethod ||
        job.paymentMethod
          ? row(
              "Payment Method",
              invoice?.paymentMethod ||
              job.paymentMethod
            )
          : ""
      }

    </section>


    ${
      warranty
        ? renderWarranty()
        : renderNoWarranty()
    }


    <button
      id="printBtn"
      class="print-btn"
      type="button"
    >
      Print Invoice
    </button>

  `;


  document
    .getElementById(
      "printBtn"
    )
    .addEventListener(
      "click",
      () => window.print()
    );

}


/* =========================================================
   WARRANTY
========================================================= */

function renderWarranty() {

  const start =
    getDate(
      firstValue(
        warranty.warrantyStart,
        warranty.startDate
      )
    );


  const end =
    getDate(
      firstValue(
        warranty.warrantyEnd,
        warranty.endDate
      )
    );


  const expired =
    end
      ? end.getTime() <
        Date.now()
      : false;


  return `

    <section class="card warranty">

      <h2 class="section-title">
        Warranty
      </h2>

      ${
        start
          ? row(
              "Warranty Start",
              formatDate(start)
            )
          : ""
      }

      ${
        end
          ? row(
              "Warranty End",
              formatDate(end)
            )
          : ""
      }


      <span
        class="warranty-status ${
          expired
            ? "expired"
            : ""
        }"
      >
        ${
          expired
            ? "WARRANTY EXPIRED"
            : "WARRANTY ACTIVE"
        }
      </span>

    </section>

  `;

}


function renderNoWarranty() {

  return `

    <section class="card">

      <h2 class="section-title">
        Warranty
      </h2>

      <div
        style="
          color:#7b8494;
          font-size:12px;
          line-height:1.5;
        "
      >
        No warranty information is currently available
        for this service.
      </div>

    </section>

  `;

}


/* =========================================================
   BACK
========================================================= */

backBtn.addEventListener(
  "click",
  () => {

    window.location.href =
      `./status.html?jobId=${encodeURIComponent(
        jobId || ""
      )}`;

  }
);


/* =========================================================
   HELPERS
========================================================= */

function row(
  label,
  value
) {

  return `

    <div class="row">

      <span class="label">
        ${escapeHtml(
          label
        )}
      </span>

      <span class="value">
        ${escapeHtml(
          value
        )}
      </span>

    </div>

  `;

}


function firstValue(
  ...values
) {

  for (
    const value of values
  ) {

    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {

      return value;

    }

  }

  return null;

}


function number(
  value
) {

  const result =
    Number(value);


  return Number.isFinite(
    result
  )
    ? result
    : 0;

}


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
    number(value)
  );

}


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


  return parts.length
    ? parts.join(" ")
    : (
        job.device ||
        job.product ||
        "Device"
      );

}


function formatPaymentStatus(
  status
) {

  return String(
    status || "PENDING"
  )
    .toLowerCase()
    .replace(
      /\b\w/g,
      char =>
        char.toUpperCase()
    );

}


function getDate(
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
    value.seconds
  ) {

    return new Date(
      value.seconds * 1000
    );

  }


  const date =
    new Date(value);


  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;

}


function formatDate(
  value
) {

  const date =
    getDate(value);


  if (!date) {
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

}


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


function showEmpty(
  title,
  message
) {

  container.innerHTML = `

    <div class="empty">

      <div style="font-size:32px;margin-bottom:10px;">
        🧾
      </div>

      <div class="empty-title">
        ${escapeHtml(title)}
      </div>

      <div>
        ${escapeHtml(message)}
      </div>

    </div>

  `;

}