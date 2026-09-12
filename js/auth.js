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
| REPARO COMMON AUTHENTICATION
|--------------------------------------------------------------------------
|
| User Login:
|   Mobile Number + 6 Digit PIN
|
| Firebase internally:
|   Mobile-based internal email + PIN
|
| User never sees the internal Firebase email.
|
|--------------------------------------------------------------------------
*/


/*
|--------------------------------------------------------------------------
| Normalize Indian Mobile Number
|--------------------------------------------------------------------------
*/

export function normalizeMobile(mobile) {

    const value = String(mobile || "")
        .replace(/\D/g, "");

    // 10 digit Indian mobile
    if (value.length === 10) {
        return value;
    }

    // 91XXXXXXXXXX
    if (value.length === 12 && value.startsWith("91")) {
        return value.substring(2);
    }

    return null;
}


/*
|--------------------------------------------------------------------------
| Internal Firebase Auth Email
|--------------------------------------------------------------------------
*/

export function getInternalAuthEmail(mobile) {

    const normalizedMobile = normalizeMobile(mobile);

    if (!normalizedMobile) {
        throw new Error("INVALID_MOBILE");
    }

    return `${normalizedMobile}@login.reparo.local`;
}


/*
|--------------------------------------------------------------------------
| Login
|--------------------------------------------------------------------------
*/

export async function login(mobile, pin) {

    const normalizedMobile = normalizeMobile(mobile);

    if (!normalizedMobile) {
        throw new Error("INVALID_MOBILE");
    }

    // REPARO PIN = exactly 6 digits
    if (!/^\d{6}$/.test(String(pin))) {
        throw new Error("INVALID_PIN");
    }

    const internalEmail =
        getInternalAuthEmail(normalizedMobile);

    return await signInWithEmailAndPassword(
        auth,
        internalEmail,
        String(pin)
    );
}


/*
|--------------------------------------------------------------------------
| Get User Profile
|--------------------------------------------------------------------------
*/

export async function getUserProfile(uid) {

    if (!uid) {
        throw new Error("INVALID_UID");
    }

    const userRef = doc(db, "users", uid);

    const snapshot = await getDoc(userRef);

    if (!snapshot.exists()) {
        throw new Error("USER_PROFILE_NOT_FOUND");
    }

    return {
        uid,
        ...snapshot.data()
    };
}


/*
|--------------------------------------------------------------------------
| Watch Authentication
|--------------------------------------------------------------------------
*/

export function watchAuth(callback) {
    return onAuthStateChanged(auth, callback);
}


/*
|--------------------------------------------------------------------------
| Logout
|--------------------------------------------------------------------------
*/

export async function logout() {
    await signOut(auth);
}


/*
|--------------------------------------------------------------------------
| Role → Dashboard
|--------------------------------------------------------------------------
*/

export function getRolePage(role) {

    const normalizedRole =
        String(role || "")
            .trim()
            .toLowerCase();

    switch (normalizedRole) {

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
| Login Page Logic
|--------------------------------------------------------------------------
*/

const loginForm =
    document.getElementById("loginForm");

const loginBtn =
    document.getElementById("loginBtn");

const errorBox =
    document.getElementById("errorBox");


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


/*
|--------------------------------------------------------------------------
| Submit Login
|--------------------------------------------------------------------------
*/

if (loginForm) {

    loginForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        hideError();

        const mobileInput =
            document.getElementById("mobile");

        const pinInput =
            document.getElementById("pin");

        const mobile =
            mobileInput
                ? mobileInput.value.trim()
                : "";

        const pin =
            pinInput
                ? pinInput.value.trim()
                : "";


        /*
        |--------------------------------------------------------------------------
        | Mobile Validation
        |--------------------------------------------------------------------------
        */

        if (!normalizeMobile(mobile)) {

            showError(
                "Please enter a valid 10 digit mobile number."
            );

            return;
        }


        /*
        |--------------------------------------------------------------------------
        | PIN Validation
        |--------------------------------------------------------------------------
        */

        if (!/^\d{6}$/.test(pin)) {

            showError(
                "PIN must be exactly 6 digits."
            );

            return;
        }


        /*
        |--------------------------------------------------------------------------
        | Login Button
        |--------------------------------------------------------------------------
        */

        if (loginBtn) {

            loginBtn.disabled = true;
            loginBtn.textContent = "LOGGING IN...";
        }


        try {

            /*
            |--------------------------------------------------------------------------
            | Firebase Login
            |--------------------------------------------------------------------------
            */

            const credential =
                await login(mobile, pin);

            const uid =
                credential.user.uid;


            /*
            |--------------------------------------------------------------------------
            | Load REPARO User Profile
            |--------------------------------------------------------------------------
            */

            const profile =
                await getUserProfile(uid);


            /*
            |--------------------------------------------------------------------------
            | Account Active Check
            |--------------------------------------------------------------------------
            */

            if (profile.active !== true) {

                await logout();

                throw new Error("ACCOUNT_INACTIVE");
            }


            /*
            |--------------------------------------------------------------------------
            | Role Check
            |--------------------------------------------------------------------------
            */

            const role =
                String(profile.role || "")
                    .trim()
                    .toLowerCase();


            if (
                ![
                    "admin",
                    "retailer",
                    "technician",
                    "customer"
                ].includes(role)
            ) {

                await logout();

                throw new Error("INVALID_ROLE");
            }


            /*
            |--------------------------------------------------------------------------
            | Role Dashboard
            |--------------------------------------------------------------------------
            */

            const page =
                getRolePage(role);

            window.location.replace(page);

        }


        catch (error) {

            console.error(
                "REPARO Login Error:",
                error
            );


            let message =
                "Login failed. Please check your mobile number and PIN.";


            switch (error.message) {

                case "INVALID_MOBILE":

                    message =
                        "Please enter a valid 10 digit mobile number.";

                    break;


                case "INVALID_PIN":

                    message =
                        "PIN must be exactly 6 digits.";

                    break;


                case "USER_PROFILE_NOT_FOUND":

                    message =
                        "Your REPARO account profile is not configured. Please contact Admin.";

                    break;


                case "ACCOUNT_INACTIVE":

                    message =
                        "Your account is inactive. Please contact REPARO Admin.";

                    break;


                case "INVALID_ROLE":

                    message =
                        "Your account role is not configured correctly. Please contact Admin.";

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


                case "auth/invalid-api-key":

                    message =
                        "Firebase configuration error. Please contact Admin.";

                    break;
            }


            showError(message);

        }


        finally {

            if (loginBtn) {

                loginBtn.disabled = false;
                loginBtn.textContent = "LOGIN";
            }
        }

    });

}