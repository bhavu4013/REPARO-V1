import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
  auth,
  db
} from "./firebase.js";


/* =========================================================
   DOM
========================================================= */

const earningContainer =
  document.getElementById("earningContainer");

const statusFilter =
  document.getElementById("statusFilter");

const logoutBtn =
  document.getElementById("logoutBtn");

const errorBox =
  document.getElementById("errorBox");

const successBox =
  document.getElementById("successBox");

const availableAmount =
  document.getElementById("availableAmount");

const serviceCommission =
  document.getElementById("serviceCommission");

const productMargin =
  document.getElementById("productMargin");

const schemeBonus =
  document.getElementById("schemeBonus");

const warrantyHold =
  document.getElementById("warrantyHold");

const releasedAmount =
  document.getElementById("releasedAmount");

const payableAmount =
  document.getElementById("payableAmount");

const paidAmount =
  document.getElementById("paidAmount");

const totalEarnings =
  document.getElementById("totalEarnings");


/* =========================================================
   STATE
========================================================= */

let retailerUser = null;

let retailerProfile = null;

let allEarnings = [];

let walletData = null;


/* =========================================================
   AUTH
========================================================= */

onAuthStateChanged(auth, async (user) => {

  if (!user) {

    window.location.href =
      "../index.html";

    return;
  }


  try {

    const userRef =
      doc(db, "users", user.uid);

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
      profile.role !== "retailer" ||
      profile.active !== true
    ) {

      await signOut(auth);

      window.location.href =
        "../index.html";

      return;
    }


    retailerUser = user;

    retailerProfile = profile;


    await loadEarnings();


  } catch (error) {

    showError(
      error.message ||
      "Authorization failed."
    );

  }

});


/* =========================================================
   LOAD EARNINGS
========================================================= */

async function loadEarnings() {

  earningContainer.innerHTML = `
    <div class="loading">
      Loading earnings...
    </div>
  `;


  try {

    await Promise.all([
      loadCommissions(),
      loadWallet()
    ]);


    /*
      Wallet is the settlement-level source.
      Commission records provide the detailed
      earning history.
    */

    updateSummary();

    renderEarnings();


  } catch (error) {

    earningContainer.innerHTML = `
      <div class="empty">

        <div class="empty-icon">
          ⚠️
        </div>

        <div class="empty-title">
          Earnings Load Error
        </div>

        <div>
          ${escapeHtml(
            error.message ||
            "Unable to load earnings."
          )}
        </div>

      </div>
    `;

    showError(
      error.message ||
      "Unable to load earnings."
    );

  }

}


/* =========================================================
   LOAD COMMISSIONS
========================================================= */

async function loadCommissions() {

  const earningsQuery =
    query(
      collection(db, "commissions"),
      where(
        "retailerId",
        "==",
        retailerUser.uid
      )
    );


  const snapshot =
    await getDocs(
      earningsQuery
    );


  allEarnings = [];


  snapshot.forEach(item => {

    allEarnings.push({
      id: item.id,
      ...item.data()
    });

  });


  allEarnings.sort(
    (a, b) => {

      const aTime =
        getTimestampSeconds(
          a.createdAt ||
          a.updatedAt
        );

      const bTime =
        getTimestampSeconds(
          b.createdAt ||
          b.updatedAt
        );

      return bTime - aTime;

    }
  );

}


/* =========================================================
   LOAD RETAILER WALLET
========================================================= */

async function loadWallet() {

  /*
    Current wallet rule:

    retailer can read only its own wallet
    where retailerId matches UID.

    Wallet may be stored using:
      retailerId document field
    or
      UID as document ID.
  */


  const walletQuery =
    query(
      collection(db, "retailer_wallet"),
      where(
        "retailerId",
        "==",
        retailerUser.uid
      )
    );


  const snapshot =
    await getDocs(
      walletQuery
    );


  walletData = null;


  snapshot.forEach(item => {

    if (!walletData) {

      walletData = {
        id: item.id,
        ...item.data()
      };

    }

  });


  /*
    If wallet is stored as:
      retailer_wallet/{retailerUID}

    try that document too.
  */

  if (!walletData) {

    const directRef =
      doc(
        db,
        "retailer_wallet",
        retailerUser.uid
      );


    const directSnapshot =
      await getDoc(directRef);


    if (
      directSnapshot.exists()
    ) {

      const data =
        directSnapshot.data();


      if (
        !data.retailerId ||
        data.retailerId ===
        retailerUser.uid
      ) {

        walletData = {
          id: directSnapshot.id,
          ...data
        };

      }

    }

  }

}


/* =========================================================
   UPDATE SUMMARY
========================================================= */

function updateSummary() {

  let service = 0;

  let product = 0;

  let bonus = 0;

  let hold = 0;

  let released = 0;

  let payable = 0;

  let paid = 0;

  let total = 0;


  allEarnings.forEach(
    earning => {

      const amount =
        getEarningAmount(
          earning
        );


      const type =
        getEarningType(
          earning
        );


      const status =
        normalizeStatus(
          earning.status
        );


      /*
        Earnings category
      */

      if (
        type === "PRODUCT"
      ) {

        product += amount;

      } else if (
        type === "SCHEME" ||
        type === "BONUS"
      ) {

        bonus += amount;

      } else {

        service += amount;

      }


      /*
        Status buckets
      */

      if (
        status === "WARRANTY HOLD"
      ) {

        hold += amount;

      } else if (
        status === "RELEASED"
      ) {

        released += amount;

      } else if (
        status === "PAYABLE"
      ) {

        payable += amount;

      } else if (
        status === "PAID"
      ) {

        paid += amount;

      }


      /*
        Cancelled records are not
        counted as earnings.
      */

      if (
        status !== "CANCELLED"
      ) {

        total += amount;

      }

    }
  );


  /*
    Wallet can contain the official
    settlement values.

    Prefer wallet values where available.
  */

  const walletHold =
    getWalletNumber([
      "warrantyHold",
      "holdAmount",
      "onHold"
    ]);


  const walletReleased =
    getWalletNumber([
      "releasedAmount",
      "released"
    ]);


  const walletPayable =
    getWalletNumber([
      "payableAmount",
      "payable"
    ]);


  const walletPaid =
    getWalletNumber([
      "paidAmount",
      "paid"
    ]);


  const walletAvailable =
    getWalletNumber([
      "availableAmount",
      "available",
      "balance"
    ]);


  if (
    walletHold !== null
  ) {

    hold = walletHold;

  }


  if (
    walletReleased !== null
  ) {

    released = walletReleased;

  }


  if (
    walletPayable !== null
  ) {

    payable = walletPayable;

  }


  if (
    walletPaid !== null
  ) {

    paid = walletPaid;

  }


  let available;


  if (
    walletAvailable !== null
  ) {

    available =
      walletAvailable;

  } else {

    available =
      released + payable;

  }


  /*
    Total earnings from detailed
    commission records.
  */

  serviceCommission.textContent =
    formatCurrency(service);

  productMargin.textContent =
    formatCurrency(product);

  schemeBonus.textContent =
    formatCurrency(bonus);

  warrantyHold.textContent =
    formatCurrency(hold);

  releasedAmount.textContent =
    formatCurrency(released);

  payableAmount.textContent =
    formatCurrency(payable);

  paidAmount.textContent =
    formatCurrency(paid);

  totalEarnings.textContent =
    formatCurrency(total);

  availableAmount.textContent =
    formatCurrency(available);

}


/* =========================================================
   RENDER EARNINGS
========================================================= */

function renderEarnings() {

  const selectedStatus =
    statusFilter.value;


  const filtered =
    allEarnings.filter(
      earning => {

        if (!selectedStatus) {

          return true;

        }

        return (
          normalizeStatus(
            earning.status
          ) === selectedStatus
        );

      }
    );


  if (
    filtered.length === 0
  ) {

    earningContainer.innerHTML = `
      <div class="empty">

        <div class="empty-icon">
          ₹
        </div>

        <div class="empty-title">
          No Earnings Found
        </div>

        <div>
          No earning records match this filter.
        </div>

      </div>
    `;

    return;
  }


  earningContainer.innerHTML =
    filtered
      .map(
        renderEarningCard
      )
      .join("");

}


/* =========================================================
   EARNING CARD
========================================================= */

function renderEarningCard(
  earning
) {

  const amount =
    getEarningAmount(
      earning
    );


  const status =
    normalizeStatus(
      earning.status ||
      "PENDING"
    );


  const jobId =
    earning.jobId ||
    earning.job ||
    "-";


  const earningId =
    earning.commissionId ||
    earning.id;


  const type =
    getEarningType(
      earning
    );


  const description =
    earning.description ||
    earning.serviceType ||
    earning.category ||
    getTypeLabel(type);


  const date =
    formatDate(
      earning.createdAt ||
      earning.updatedAt ||
      earning.date
    );


  return `

    <div class="earning-card">

      <div class="earning-top">

        <div>

          <h3 class="earning-id">
            ${escapeHtml(
              earningId
            )}
          </h3>

          <div class="earning-date">
            ${escapeHtml(
              date
            )}
          </div>

        </div>


        <span
          class="earning-status ${getStatusClass(status)}"
        >
          ${escapeHtml(
            formatStatus(status)
          )}
        </span>

      </div>


      <div class="earning-rows">

        <div class="earning-row">

          <span class="earning-row-label">
            Job
          </span>

          <span class="earning-row-value">
            ${escapeHtml(
              jobId
            )}
          </span>

        </div>


        <div class="earning-row">

          <span class="earning-row-label">
            Type
          </span>

          <span class="earning-row-value">
            ${escapeHtml(
              getTypeLabel(type)
            )}
          </span>

        </div>


        <div class="earning-row">

          <span class="earning-row-label">
            Description
          </span>

          <span class="earning-row-value">
            ${escapeHtml(
              description
            )}
          </span>

        </div>


        <div class="earning-row">

          <span class="earning-row-label">
            Your Earning
          </span>

          <span class="earning-row-value earning-total">
            ${formatCurrency(
              amount
            )}
          </span>

        </div>

      </div>

    </div>

  `;

}


/* =========================================================
   GET EARNING AMOUNT
========================================================= */

function getEarningAmount(
  earning
) {

  const fields = [

    "retailerCommission",

    "commissionAmount",

    "retailerAmount",

    "earningAmount",

    "amount",

    "total"

  ];


  for (
    const field of fields
  ) {

    const value =
      Number(
        earning[field]
      );


    if (
      Number.isFinite(value)
    ) {

      return value;

    }

  }


  return 0;

}


/* =========================================================
   GET EARNING TYPE
========================================================= */

function getEarningType(
  earning
) {

  const value =
    String(
      earning.type ||
      earning.earningType ||
      earning.commissionType ||
      ""
    )
      .toUpperCase()
      .trim();


  if (
    value.includes("PRODUCT")
  ) {

    return "PRODUCT";

  }


  if (
    value.includes("SCHEME")
  ) {

    return "SCHEME";

  }


  if (
    value.includes("BONUS")
  ) {

    return "BONUS";

  }


  return "SERVICE";

}


/* =========================================================
   TYPE LABEL
========================================================= */

function getTypeLabel(
  type
) {

  switch (type) {

    case "PRODUCT":
      return "Product Margin";

    case "SCHEME":
      return "Scheme Bonus";

    case "BONUS":
      return "Bonus";

    default:
      return "Service Commission";

  }

}


/* =========================================================
   WALLET NUMBER
========================================================= */

function getWalletNumber(
  fields
) {

  if (!walletData) {

    return null;

  }


  for (
    const field of fields
  ) {

    if (
      walletData[field] !==
      undefined &&
      walletData[field] !==
      null
    ) {

      const value =
        Number(
          walletData[field]
        );


      if (
        Number.isFinite(value)
      ) {

        return value;

      }

    }

  }


  return null;

}


/* =========================================================
   STATUS
========================================================= */

function normalizeStatus(
  status
) {

  return String(
    status || "PENDING"
  )
    .toUpperCase()
    .trim();

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

    case "WARRANTY HOLD":
      return "status-hold";

    case "RELEASED":
      return "status-released";

    case "PAYABLE":
      return "status-payable";

    case "PAID":
      return "status-paid";

    case "PENDING":
      return "status-pending";

    case "CANCELLED":
      return "status-cancelled";

    default:
      return "status-pending";

  }

}


/* =========================================================
   DATE
========================================================= */

function formatDate(
  value
) {

  if (!value) {

    return "-";

  }


  try {

    let date;


    if (
      typeof value.toDate ===
      "function"
    ) {

      date =
        value.toDate();

    } else if (
      value.seconds
    ) {

      date =
        new Date(
          value.seconds * 1000
        );

    } else {

      date =
        new Date(value);

    }


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


/* =========================================================
   TIMESTAMP
========================================================= */

function getTimestampSeconds(
  value
) {

  if (!value) {

    return 0;

  }


  if (
    typeof value.toMillis ===
    "function"
  ) {

    return value.toMillis();

  }


  if (
    value.seconds
  ) {

    return value.seconds;

  }


  const parsed =
    new Date(value);


  return Number.isNaN(
    parsed.getTime()
  )
    ? 0
    : parsed.getTime();

}


/* =========================================================
   CURRENCY
========================================================= */

function formatCurrency(
  amount
) {

  return "₹" +
    Number(
      amount || 0
    ).toLocaleString(
      "en-IN",
      {
        maximumFractionDigits: 2
      }
    );

}


/* =========================================================
   FILTER
========================================================= */

statusFilter.addEventListener(
  "change",
  renderEarnings
);


/* =========================================================
   LOGOUT
========================================================= */

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


/* =========================================================
   MESSAGES
========================================================= */

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


/* =========================================================
   ESCAPE
========================================================= */

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