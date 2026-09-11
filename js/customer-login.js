import {
  signInWithEmailAndPassword,
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


const loginForm =
  document.getElementById(
    "loginForm"
  );

const emailInput =
  document.getElementById(
    "email"
  );

const passwordInput =
  document.getElementById(
    "password"
  );

const loginBtn =
  document.getElementById(
    "loginBtn"
  );

const backBtn =
  document.getElementById(
    "backBtn"
  );

const errorBox =
  document.getElementById(
    "errorBox"
  );

const successBox =
  document.getElementById(
    "successBox"
  );


/* =========================================================
   CHECK EXISTING LOGIN
========================================================= */

onAuthStateChanged(
  auth,
  async (user) => {

    if (!user) {
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

        return;
      }


      const profile =
        userSnapshot.data();


      if (
        profile.role === "customer" &&
        profile.active === true
      ) {

        window.location.href =
          "./status.html";

      }

    } catch (error) {

      console.error(
        "Existing session check failed:",
        error
      );

    }

  }
);


/* =========================================================
   LOGIN
========================================================= */

loginForm.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();


    hideMessages();


    const email =
      emailInput.value
        .trim()
        .toLowerCase();


    const password =
      passwordInput.value;


    if (!email) {

      showError(
        "Please enter your email."
      );

      return;
    }


    if (!password) {

      showError(
        "Please enter your password."
      );

      return;
    }


    loginBtn.disabled =
      true;

    loginBtn.textContent =
      "Signing in...";


    try {

      const credential =
        await signInWithEmailAndPassword(
          auth,
          email,
          password
        );


      const user =
        credential.user;


      /*
        Read the user's REPARO profile.
      */

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

        await auth.signOut();

        throw new Error(
          "Customer profile not found. Please contact REPARO."
        );

      }


      const profile =
        userSnapshot.data();


      /*
        Customer login page accepts only
        active customer accounts.
      */

      if (
        profile.role !==
        "customer"
      ) {

        await auth.signOut();

        throw new Error(
          "This account is not registered as a customer account."
        );

      }


      if (
        profile.active !==
        true
      ) {

        await auth.signOut();

        throw new Error(
          "Your customer account is currently inactive."
        );

      }


      /*
        customerId is required because customer
        Firestore access is linked to this ID.
      */

      if (
        !profile.customerId
      ) {

        await auth.signOut();

        throw new Error(
          "Customer ID is missing from your profile. Please contact REPARO."
        );

      }


      showSuccess(
        "Login successful. Opening your service status..."
      );


      setTimeout(
        () => {

          window.location.href =
            "./status.html";

        },
        400
      );


    } catch (error) {

      console.error(
        "Customer login error:",
        error
      );


      showError(
        getFriendlyError(
          error
        )
      );


      loginBtn.disabled =
        false;

      loginBtn.textContent =
        "Login";

    }

  }
);


/* =========================================================
   BACK
========================================================= */

backBtn.addEventListener(
  "click",
  () => {

    window.location.href =
      "../index.html";

  }
);


/* =========================================================
   ERROR MESSAGE
========================================================= */

function getFriendlyError(
  error
) {

  const code =
    error?.code ||
    "";


  switch (code) {

    case "auth/invalid-credential":
      return "Invalid email or password.";

    case "auth/user-not-found":
      return "No account was found with this email.";

    case "auth/wrong-password":
      return "Invalid email or password.";

    case "auth/invalid-email":
      return "Please enter a valid email address.";

    case "auth/too-many-requests":
      return "Too many login attempts. Please try again later.";

    case "auth/user-disabled":
      return "This Firebase account has been disabled.";

    default:
      return (
        error?.message ||
        "Unable to login. Please try again."
      );

  }

}


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


function hideMessages() {

  errorBox.style.display =
    "none";

  successBox.style.display =
    "none";

}