import {
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import { auth, db } from "./firebase.js";


/*
|--------------------------------------------------------------------------
| REPARO Mobile + PIN Authentication
|--------------------------------------------------------------------------
|
| User enters:
|   Mobile Number + PIN
|
| Firebase internally uses:
|   mobile-based internal email + PIN
|
| The internal email is NEVER shown to the user.
|
|--------------------------------------------------------------------------
*/


function normalizeMobile(mobile) {

    let value = String(mobile || "")
        .replace(/\D/g, "");

    // Indian 10 digit mobile
    if (value.length === 10) {
        return value;
    }

    // +91XXXXXXXXXX / 91XXXXXXXXXX
    if (value.length === 12 && value.startsWith("91")) {
        return value.substring(2);
    }

    return null;
}


function getInternalAuthEmail(mobile) {

    const normalized = normalizeMobile(mobile);

    if (!normalized) {
        throw new Error("INVALID_MOBILE");
    }

    /*
     * Technical Firebase login identifier.
     * Customer/Retailer/Technician/Admin never needs to see this.
     */
    return `${normalized}@login.reparo.local`;
}


export async function login(mobile, pin) {

    const normalizedMobile = normalizeMobile(mobile);

    if (!normalizedMobile) {
        throw new Error("INVALID_MOBILE");
    }

    if (!/^\d{4,6}$/.test(String(pin))) {
        throw new Error("INVALID_PIN");
    }

    const internalEmail = getInternalAuthEmail(normalizedMobile);

    return await signInWithEmailAndPassword(
        auth,
        internalEmail,
        String(pin)
    );
}


export async function getUserProfile(uid) {

    const userRef = doc(db, "users", uid);

    const snapshot = await getDoc(userRef);

    if (!snapshot.exists()) {
        throw new Error("USER_PROFILE_NOT_FOUND");
    }

    return snapshot.data();
}


export function watchAuth(callback) {
    return onAuthStateChanged(auth, callback);
}


export async function logout() {
    await signOut(auth);
}


export function getRolePage(role) {

    switch (role) {

        case "admin":
            return "./admin/dashboard.html";

        case "retailer":
            return "./retailer/dashboard.html";

        case "technician":
            return "./technician/dashboard.html";

        case "customer":
            return "./customer/status.html";

        default:
            return "./index.html";
    }
}


/*
|--------------------------------------------------------------------------
| Login Page
|--------------------------------------------------------------------------
*/

const loginForm = document.getElementById("loginForm");
const loginBtn = document.getElementById("loginBtn");
const errorBox = document.getElementById("errorBox");


function showError(message) {

    if (!errorBox) return;

    errorBox.textContent = message;
    errorBox.style.display = "block";
}


function hideError() {

    if (!errorBox) return;

    errorBox.textContent = "";
    errorBox.style.display = "none";
}


if (loginForm) {

    loginForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        hideError();

        const mobile =
            document.getElementById("mobile").value.trim();

        const pin =
            document.getElementById("pin").value.trim();

        if (!normalizeMobile(mobile)) {

            showError(
                "Please enter a valid 10 digit mobile number."
            );

            return;
        }

        if (!/^\d{4,6}$/.test(pin)) {

            showError(
                "PIN must contain 4 to 6 digits."
            );

            return;
        }

        loginBtn.disabled = true;
        loginBtn.textContent = "LOGINNING...";

        try {

            const credential =
                await login(mobile, pin);

            const uid = credential.user.uid;

            const profile =
                await getUserProfile(uid);

            if (!profile.active) {

                await logout();

                throw new Error("ACCOUNT_INACTIVE");
            }

            const role = String(profile.role || "")
                .toLowerCase();

            const page = getRolePage(role);

            window.location.href = page;

        } catch (error) {

            console.error("REPARO login error:", error);

            let message =
                "Login failed. Please check your mobile number and PIN.";

            switch (error.message) {

                case "INVALID_MOBILE":
                    message =
                        "Please enter a valid 10 digit mobile number.";
                    break;

                case "INVALID_PIN":
                    message =
                        "PIN must contain 4 to 6 digits.";
                    break;

                case "USER_PROFILE_NOT_FOUND":
                    message =
                        "Your account profile is not configured. Please contact REPARO Admin.";
                    break;

                case "ACCOUNT_INACTIVE":
                    message =
                        "Your account is inactive. Please contact REPARO Admin.";
                    break;

                case "auth/invalid-credential":
                case "auth/user-not-found":
                case "auth/wrong-password":
                    message =
                        "Invalid mobile number or PIN.";
                    break;

                case "auth/too-many-requests":
                    message =
                        "Too many login attempts. Please try again later.";
                    break;

                case "auth/network-request-failed":
                    message =
                        "Network problem. Please check your internet connection.";
                    break;
            }

            showError(message);

        } finally {

            loginBtn.disabled = false;
            loginBtn.textContent = "LOGIN";
        }
    });
}