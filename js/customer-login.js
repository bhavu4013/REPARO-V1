import { auth, db } from "../js/firebase.js";

import {
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


const form =
  document.getElementById("loginForm");

const emailInput =
  document.getElementById("email");

const passwordInput =
  document.getElementById("password");

const loginBtn =
  document.getElementById("loginBtn");

const message =
  document.getElementById("message");


// =====================================================
// IF ALREADY LOGGED IN
// =====================================================

onAuthStateChanged(
  auth,
  async user => {

    if (!user) {
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


      if (!profileSnap.exists()) {
        return;
      }


      const profile =
        profileSnap.data();


      if (
        profile.role === "customer"
        && profile.active !== false
      ) {

        location.href =
          "./status.html";

      }

    } catch (error) {

      console.error(error);

    }

  }
);


// =====================================================
// LOGIN
// =====================================================

form.addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    const email =
      emailInput.value.trim();

    const password =
      passwordInput.value;


    if (!email || !password) {

      showMessage(
        "Please enter email and password.",
        "error"
      );

      return;

    }


    setLoading(true);


    try {

      const credential =
        await signInWithEmailAndPassword(
          auth,
          email,
          password
        );


      const user =
        credential.user;


      const profileSnap =
        await getDoc(
          doc(
            db,
            "users",
            user.uid
          )
        );


      if (!profileSnap.exists()) {

        await auth.signOut();

        throw new Error(
          "CUSTOMER_PROFILE_NOT_FOUND"
        );

      }


      const profile =
        profileSnap.data();


      if (
        profile.role !== "customer"
      ) {

        await auth.signOut();

        throw new Error(
          "NOT_CUSTOMER_ACCOUNT"
        );

      }


      if (
        profile.active === false
      ) {

        await auth.signOut();

        throw new Error(
          "ACCOUNT_DISABLED"
        );

      }


      showMessage(
        "Login successful. Opening your service...",
        "success"
      );


      setTimeout(
        () => {

          location.href =
            "./status.html";

        },
        500
      );


    } catch (error) {

      console.error(error);

      showMessage(
        getErrorMessage(error),
        "error"
      );

      setLoading(false);

    }

  }
);


// =====================================================
// UI
// =====================================================

function setLoading(isLoading) {

  loginBtn.disabled =
    isLoading;

  loginBtn.textContent =
    isLoading
      ? "Logging in..."
      : "Login";

}


function showMessage(
  text,
  type
) {

  message.textContent =
    text;

  message.className =
    `message ${type}`;

}


function getErrorMessage(error) {

  switch (error?.code) {

    case "auth/invalid-credential":
      return "Invalid email or password.";

    case "auth/user-not-found":
      return "Customer account not found.";

    case "auth/wrong-password":
      return "Invalid email or password.";

    case "auth/invalid-email":
      return "Please enter a valid email.";

    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";

    case "CUSTOMER_PROFILE_NOT_FOUND":
      return "Customer account is not properly linked.";

    case "NOT_CUSTOMER_ACCOUNT":
      return "This account is not a customer account.";

    case "ACCOUNT_DISABLED":
      return "Your customer account is currently disabled.";

    default:
      return "Unable to login. Please try again.";

  }

}