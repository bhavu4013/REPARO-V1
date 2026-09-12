import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    collection,
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


// --------------------------------------------------
// ELEMENTS
// --------------------------------------------------

const technicianNameEl = document.getElementById("technicianName");

const totalEarningsEl = document.getElementById("totalEarnings");
const pendingAmountEl = document.getElementById("pendingAmount");
const payableAmountEl = document.getElementById("payableAmount");
const paidAmountEl = document.getElementById("paidAmount");
const completedJobsEl = document.getElementById("completedJobs");

const earningListEl = document.getElementById("earningList");
const loadingEl = document.getElementById("loading");
const errorBoxEl = document.getElementById("errorBox");

const logoutBtn = document.getElementById("logoutBtn");


// --------------------------------------------------
// STATE
// --------------------------------------------------

let currentTechnician = null;
let allEarnings = [];
let activeFilter = "ALL";


// --------------------------------------------------
// HELPERS
// --------------------------------------------------

function showError(message) {
    errorBoxEl.textContent = message;
    errorBoxEl.style.display = "block";
}

function hideError() {
    errorBoxEl.style.display = "none";
}

function money(value) {
    const number = Number(value || 0);

    return "₹" + number.toLocaleString("en-IN", {
        maximumFractionDigits: 2
    });
}

function normaliseStatus(value) {
    return String(value || "")
        .trim()
        .toUpperCase();
}

function getAmount(data) {

    const possibleFields = [
        "amount",
        "earningAmount",
        "technicianAmount",
        "technicianEarning",
        "technicianEarnings",
        "payoutAmount",
        "payableAmount",
        "total"
    ];

    for (const field of possibleFields) {
        const value = Number(data?.[field]);

        if (Number.isFinite(value) && value > 0) {
            return value;
        }
    }

    return 0;
}

function getJobId(data, documentId) {
    return (
        data?.jobId ||
        data?.jobID ||
        data?.job ||
        data?.referenceJobId ||
        documentId
    );
}

function getCustomerName(data) {
    return (
        data?.customerName ||
        data?.customer ||
        "Customer"
    );
}

function getServiceType(data) {
    return (
        data?.serviceType ||
        data?.service ||
        data?.jobType ||
        "Service Job"
    );
}

function formatDate(value) {

    if (!value) {
        return "-";
    }

    try {

        if (typeof value.toDate === "function") {
            return value.toDate().toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric"
            });
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "-";
        }

        return date.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });

    } catch (error) {
        return "-";
    }
}

function getDateValue(data) {

    return (
        data?.paidAt ||
        data?.payableAt ||
        data?.approvedAt ||
        data?.createdAt ||
        data?.updatedAt ||
        null
    );
}


// --------------------------------------------------
// STATUS
// --------------------------------------------------

function statusClass(status) {

    switch (status) {

        case "PAID":
            return "status status-paid";

        case "PAYABLE":
            return "status status-payable";

        case "PENDING":
            return "status status-pending";

        case "HOLD":
        case "WARRANTY HOLD":
            return "status status-hold";

        default:
            return "status status-pending";
    }
}

function statusText(status) {

    switch (status) {

        case "PAID":
            return "PAID";

        case "PAYABLE":
            return "PAYABLE";

        case "PENDING":
            return "PENDING";

        case "HOLD":
        case "WARRANTY HOLD":
            return "HOLD";

        default:
            return status || "PENDING";
    }
}


// --------------------------------------------------
// LOAD TECHNICIAN PROFILE
// --------------------------------------------------

async function loadTechnicianProfile(uid) {

    const { doc, getDoc } = await import(
        "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js"
    );

    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
        throw new Error("Technician profile not found.");
    }

    const userData = userSnap.data();

    if (
        userData.role !== "technician" ||
        userData.active !== true
    ) {
        throw new Error("Technician account is inactive or unauthorized.");
    }

    currentTechnician = {
        uid,
        ...userData
    };

    technicianNameEl.textContent =
        userData.name ||
        userData.mobile ||
        "Technician";
}


// --------------------------------------------------
// LOAD EARNINGS
// --------------------------------------------------

async function loadEarnings() {

    loadingEl.style.display = "block";
    earningListEl.innerHTML = "";

    try {

        const earningsQuery = query(
            collection(db, "technician_earnings"),
            where("technicianId", "==", currentTechnician.uid)
        );

        const snapshot = await getDocs(earningsQuery);

        allEarnings = [];

        snapshot.forEach((docSnap) => {

            const data = docSnap.data();

            allEarnings.push({
                id: docSnap.id,
                ...data,
                amount: getAmount(data),
                status: normaliseStatus(data.status)
            });

        });

        sortEarnings();

        calculateSummary();
        renderEarnings();

    } catch (error) {

        console.error("Technician earnings error:", error);

        showError(
            "Unable to load earnings. Please try again."
        );

    } finally {

        loadingEl.style.display = "none";
    }
}


// --------------------------------------------------
// SORT
// --------------------------------------------------

function sortEarnings() {

    allEarnings.sort((a, b) => {

        const aValue = getDateValue(a);
        const bValue = getDateValue(b);

        let aTime = 0;
        let bTime = 0;

        try {
            aTime =
                typeof aValue?.toDate === "function"
                    ? aValue.toDate().getTime()
                    : new Date(aValue || 0).getTime();

            bTime =
                typeof bValue?.toDate === "function"
                    ? bValue.toDate().getTime()
                    : new Date(bValue || 0).getTime();

        } catch (error) {
            // Keep default zero.
        }

        return bTime - aTime;
    });
}


// --------------------------------------------------
// SUMMARY
// --------------------------------------------------

function calculateSummary() {

    let total = 0;
    let pending = 0;
    let payable = 0;
    let paid = 0;

    const completedJobIds = new Set();

    allEarnings.forEach((earning) => {

        const amount = Number(earning.amount || 0);
        const status = normaliseStatus(earning.status);

        total += amount;

        if (status === "PENDING") {
            pending += amount;
        }

        if (status === "PAYABLE") {
            payable += amount;
        }

        if (status === "PAID") {
            paid += amount;
        }

        if (
            earning.jobId ||
            earning.jobID
        ) {
            completedJobIds.add(
                earning.jobId || earning.jobID
            );
        }
    });

    totalEarningsEl.textContent = money(total);
    pendingAmountEl.textContent = money(pending);
    payableAmountEl.textContent = money(payable);
    paidAmountEl.textContent = money(paid);

    completedJobsEl.textContent =
        completedJobIds.size;
}


// --------------------------------------------------
// RENDER
// --------------------------------------------------

function renderEarnings() {

    earningListEl.innerHTML = "";

    let filtered = allEarnings;

    if (activeFilter !== "ALL") {

        filtered = allEarnings.filter(
            earning =>
                normaliseStatus(earning.status) === activeFilter
        );
    }

    if (filtered.length === 0) {

        earningListEl.innerHTML = `
            <div class="empty">
                No earnings found for this status.
            </div>
        `;

        return;
    }

    filtered.forEach((earning) => {

        const jobId = getJobId(
            earning,
            earning.id
        );

        const customerName =
            getCustomerName(earning);

        const serviceType =
            getServiceType(earning);

        const date =
            formatDate(getDateValue(earning));

        const status =
            normaliseStatus(earning.status);

        const card = document.createElement("div");

        card.className = "earning-card";

        card.innerHTML = `
            <div class="earning-top">

                <div>
                    <div class="job-id">
                        Job #${escapeHtml(String(jobId))}
                    </div>

                    <div class="earning-date">
                        ${escapeHtml(date)}
                    </div>
                </div>

                <div class="amount">
                    ${money(earning.amount)}
                </div>

            </div>

            <div class="earning-info">

                <div>
                    <div class="info-label">
                        Customer
                    </div>

                    <div class="info-value">
                        ${escapeHtml(customerName)}
                    </div>
                </div>

                <div>
                    <div class="info-label">
                        Service
                    </div>

                    <div class="info-value">
                        ${escapeHtml(serviceType)}
                    </div>
                </div>

            </div>

            <div class="${statusClass(status)}">
                ${escapeHtml(statusText(status))}
            </div>
        `;

        earningListEl.appendChild(card);
    });
}


// --------------------------------------------------
// HTML ESCAPE
// --------------------------------------------------

function escapeHtml(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


// --------------------------------------------------
// FILTERS
// --------------------------------------------------

document.querySelectorAll(".filter-btn")
    .forEach((button) => {

        button.addEventListener("click", () => {

            document
                .querySelectorAll(".filter-btn")
                .forEach(btn =>
                    btn.classList.remove("active")
                );

            button.classList.add("active");

            activeFilter =
                button.dataset.filter || "ALL";

            renderEarnings();
        });
    });


// --------------------------------------------------
// LOGOUT
// --------------------------------------------------

logoutBtn.addEventListener("click", async () => {

    try {

        await signOut(auth);

        window.location.href = "../index.html";

    } catch (error) {

        console.error("Logout error:", error);

        showError(
            "Logout failed. Please try again."
        );
    }
});


// --------------------------------------------------
// AUTH
// --------------------------------------------------

onAuthStateChanged(auth, async (user) => {

    hideError();

    if (!user) {

        window.location.href = "../index.html";
        return;
    }

    try {

        await loadTechnicianProfile(user.uid);

        await loadEarnings();

    } catch (error) {

        console.error(error);

        showError(
            error.message ||
            "Unable to load technician account."
        );

        setTimeout(() => {
            window.location.href = "../index.html";
        }, 1800);
    }
});