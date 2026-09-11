import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
  auth,
  db
} from "./firebase.js";


const backBtn =
  document.getElementById(
    "backBtn"
  );

const callBtn =
  document.getElementById(
    "callBtn"
  );

const whatsappBtn =
  document.getElementById(
    "whatsappBtn"
  );

const form =
  document.getElementById(
    "supportForm"
  );

const category =
  document.getElementById(
    "category"
  );

const jobIdInput =
  document.getElementById(
    "jobId"
  );

const messageInput =
  document.getElementById(
    "message"
  );

const submitBtn =
  document.getElementById(
    "submitBtn"
  );

const successBox =
  document.getElementById(
    "successBox"
  );

const errorBox =
  document.getElementById(
    "errorBox"
  );


let currentUser = null;


/*
  Keep support contact configurable.
  Replace these values with the official
  REPARO support number when finalized.
*/
const SUPPORT_PHONE =
  "REPLACE_WITH_SUPPORT_NUMBER";

const WHATSAPP_NUMBER =
  "REPLACE_WITH_WHATSAPP_NUMBER";


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


    currentUser =
      user;


    /*
      Automatically receive Job ID when the
      customer opens Support from a job page.
    */

    const params =
      new URLSearchParams(
        window.location.search
      );


    const jobId =
      params.get(
        "jobId"
      );


    if (jobId) {

      jobIdInput.value =
        jobId;

    }

  }
);


/* =========================================================
   BACK
========================================================= */

backBtn.addEventListener(
  "click",
  () => {

    const params =
      new URLSearchParams(
        window.location.search
      );


    const jobId =
      params.get(
        "jobId"
      );


    if (jobId) {

      window.location.href =
        `./status.html?jobId=${encodeURIComponent(
          jobId
        )}`;

    } else {

      window.location.href =
        "./status.html";

    }

  }
);


/* =========================================================
   CALL SUPPORT
========================================================= */

callBtn.addEventListener(
  "click",
  () => {

    if (
      SUPPORT_PHONE.includes(
        "REPLACE_"
      )
    ) {

      showError(
        "Support phone number is not configured yet."
      );

      return;
    }


    window.location.href =
      `tel:${SUPPORT_PHONE}`;

  }
);


/* =========================================================
   WHATSAPP
========================================================= */

whatsappBtn.addEventListener(
  "click",
  () => {

    if (
      WHATSAPP_NUMBER.includes(
        "REPLACE_"
      )
    ) {

      showError(
        "WhatsApp support number is not configured yet."
      );

      return;
    }


    const text =
      encodeURIComponent(
        "Hello REPARO Support, I need help with my service."
      );


    window.open(
      `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`,
      "_blank"
    );

  }
);


/* =========================================================
   SUBMIT
========================================================= */

form.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();


    hideMessages();


    if (!currentUser) {

      showError(
        "Please login again."
      );

      return;
    }


    const supportType =
      category.value.trim();


    const jobId =
      jobIdInput.value.trim();


    const message =
      messageInput.value.trim();


    if (!supportType) {

      showError(
        "Please select a support type."
      );

      return;
    }


    if (!message) {

      showError(
        "Please enter your message."
      );

      return;
    }


    submitBtn.disabled =
      true;

    submitBtn.textContent =
      "Sending...";


    try {

      /*
        Customer support request is stored separately
        from service_requests.

        Customer cannot modify it after submission
        under the current Firestore rules.
      */

      await addDoc(
        collection(
          db,
          "support_requests"
        ),
        {

          customerId:
            currentUser.uid,

          customerAuthUserId:
            currentUser.uid,

          supportType:
            supportType,

          jobId:
            jobId || null,

          message:
            message,

          status:
            "NEW",

          createdAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp()

        }
      );


      form.reset();


      /*
        Preserve Job ID if the page was opened
        from a specific service job.
      */

      if (jobId) {

        jobIdInput.value =
          jobId;

      }


      showSuccess(
        "Support request sent successfully. REPARO will review it."
      );


    } catch (error) {

      showError(
        error.message ||
        "Unable to send support request."
      );

    } finally {

      submitBtn.disabled =
        false;

      submitBtn.textContent =
        "Send Support Request";

    }

  }
);


/* =========================================================
   MESSAGES
========================================================= */

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


function hideMessages() {

  successBox.style.display =
    "none";

  errorBox.style.display =
    "none";

}