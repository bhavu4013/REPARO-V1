import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    doc,
    getDoc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


// --------------------------------------------------
// ELEMENTS
// --------------------------------------------------

const avatarEl = document.getElementById("avatar");
const profileNameEl = document.getElementById("profileName");
const statusBadgeEl = document.getElementById("statusBadge");

const nameInput = document.getElementById("name");
const mobileInput = document.getElementById("mobile");

const accountStatusEl = document.getElementById("accountStatus");
const createdAtEl = document.getElementById("createdAt");

const saveBtn = document.getElementById("saveBtn");
const logoutBtn = document.getElementById("logoutBtn");

const messageBox = document.getElementById("messageBox");


// --------------------------------------------------
// STATE
// --------------------------------------------------

let currentUser = null;
let currentProfile = null;


// --------------------------------------------------
// MESSAGE
// --------------------------------------------------

function showMessage(message, type = "success") {

    messageBox.textContent = message;

    messageBox.className =
        "message " +
        (type === "error" ? "error" : "success");

    messageBox.style.display = "block";

    setTimeout(() => {
        messageBox.style.display = "none";
    }, 3500);
}


// --------------------------------------------------
// HELPERS
// --------------------------------------------------

function formatDate(value) {

    if (!value) {
        return "-";
    }

    try {

        if (typeof value.toDate === "function") {

            return value.toDate().toLocaleDateString(
                "en-IN",
                {
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                }
            );
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
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

    } catch (error) {

        return "-";
    }
}


function firstLetter(name) {

    const value = String(name || "T").trim();

    if (!value) {
        return "T";
    }

    return value.charAt(0).toUpperCase();
}


function renderProfile(data) {

    const name =
        data.name ||
        "Technician";

    const mobile =
        data.mobile ||
        "";

    nameInput.value = name;
    mobileInput.value = mobile;

    profileNameEl.textContent = name;

    avatarEl.textContent =
        firstLetter(name);

    accountStatusEl.textContent =
        data.active === true
            ? "Active"
            : "Inactive";

    statusBadgeEl.textContent =
        data.active === true
            ? "ACTIVE"
            : "INACTIVE";

    statusBadgeEl.style.background =
        data.active === true
            ? "#e8f8ef"
            : "#fff0f1";

    statusBadgeEl.style.color =
        data.active === true
            ? "#148344"
            : "#bd304b";

    createdAtEl.textContent =
        formatDate(data.createdAt);
}


// --------------------------------------------------
// LOAD PROFILE
// --------------------------------------------------

async function loadProfile(uid) {

    const userRef = doc(db, "users", uid);

    const snapshot = await getDoc(userRef);

    if (!snapshot.exists()) {
        throw new Error("Technician profile not found.");
    }

    const data = snapshot.data();

    // Security check
    if (
        data.role !== "technician" ||
        data.active !== true
    ) {
        throw new Error(
            "Technician account is inactive or unauthorized."
        );
    }

    currentUser = auth.currentUser;

    currentProfile = data;

    renderProfile(data);
}


// --------------------------------------------------
// SAVE PROFILE
// --------------------------------------------------

saveBtn.addEventListener("click", async () => {

    if (!currentUser || !currentProfile) {
        return;
    }

    const name =
        nameInput.value.trim();

    if (!name) {

        showMessage(
            "Please enter your name.",
            "error"
        );

        nameInput.focus();

        return;
    }

    if (name.length < 2) {

        showMessage(
            "Name must contain at least 2 characters.",
            "error"
        );

        nameInput.focus();

        return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {

        const userRef =
            doc(db, "users", currentUser.uid);

        await updateDoc(userRef, {

            name: name,

            updatedAt: serverTimestamp()
        });

        currentProfile.name = name;

        renderProfile(currentProfile);

        showMessage(
            "Profile updated successfully."
        );

    } catch (error) {

        console.error(
            "Profile update error:",
            error
        );

        showMessage(
            "Unable to update profile. Please try again.",
            "error"
        );

    } finally {

        saveBtn.disabled = false;
        saveBtn.textContent = "Save Changes";
    }
});


// --------------------------------------------------
// LOGOUT
// --------------------------------------------------

logoutBtn.addEventListener("click", async () => {

    try {

        await signOut(auth);

        window.location.href =
            "../index.html";

    } catch (error) {

        console.error(
            "Logout error:",
            error
        );

        showMessage(
            "Logout failed. Please try again.",
            "error"
        );
    }
});


// --------------------------------------------------
// AUTH
// --------------------------------------------------

onAuthStateChanged(auth, async (user) => {

    if (!user) {

        window.location.href =
            "../index.html";

        return;
    }

    try {

        await loadProfile(user.uid);

    } catch (error) {

        console.error(error);

        showMessage(
            error.message ||
            "Unable to load technician account.",
            "error"
        );

        setTimeout(() => {

            window.location.href =
                "../index.html";

        }, 1800);
    }
});