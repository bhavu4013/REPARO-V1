import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  addDoc,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
  auth,
  db
} from "./firebase.js";


// =========================================================
// DOM
// =========================================================

const requestForm =
  document.getElementById("requestForm");

const customerMobile =
  document.getElementById("customerMobile");

const customerName =
  document.getElementById("customerName");

const customerAddress =
  document.getElementById("customerAddress");

const customerId =
  document.getElementById("customerId");

const customerIdBox =
  document.getElementById("customerIdBox");

const customerStatus =
  document.getElementById("customerStatus");

const checkCustomerBtn =
  document.getElementById("checkCustomerBtn");

const deviceBrand =
  document.getElementById("deviceBrand");

const deviceModel =
  document.getElementById("deviceModel");

const screenSize =
  document.getElementById("screenSize");

const serialNumber =
  document.getElementById("serialNumber");

const serviceType =
  document.getElementById("serviceType");

const problem =
  document.getElementById("problem");

const submitBtn =
  document.getElementById("submitBtn");

const errorBox =
  document.getElementById("errorBox");

const successBox =
  document.getElementById("successBox");

const backBtn =
  document.getElementById("backBtn");


// =========================================================
// STATE
// =========================================================

let currentUser = null;

let retailerProfile = null;

let checkedCustomer = null;

let customerCheckCompleted = false;


// =========================================================
// AUTH
// =========================================================

onAuthStateChanged(
  auth,
  async (user) => {

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
        profile.role !== "retailer" ||
        profile.active !== true
      ) {

        await signOut(auth);

        window.location.href =
          "../index.html";

        return;
      }


      currentUser =
        user;

      retailerProfile =
        profile;


      await loadCustomerFromUrl();

    }
    catch (error) {

      console.error(
        "Retailer authorization error:",
        error
      );

      showError(
        error.message ||
        "Authorization error."
      );
    }

  }
);


// =========================================================
// LOAD CUSTOMER FROM URL
// =========================================================

async function loadCustomerFromUrl() {

  const params =
    new URLSearchParams(
      window.location.search
    );


  const urlCustomerId =
    params.get(
      "customerId"
    );


  const urlMobile =
    normalizeMobile(
      params.get("mobile") || ""
    );


  /*
   * Coming from My Customers:
   * customerId is the trusted primary reference.
   */

  if (urlCustomerId) {

    if (urlMobile) {

      customerMobile.value =
        urlMobile;

    }


    await loadExistingCustomerById(
      urlCustomerId
    );

    return;
  }


  /*
   * Mobile-only URL.
   */

  if (
    urlMobile.length === 10
  ) {

    customerMobile.value =
      urlMobile;

    await checkCustomer();
  }

}


// =========================================================
// LOAD EXISTING CUSTOMER BY ID
// =========================================================

async function loadExistingCustomerById(
  selectedCustomerId
) {

  clearMessages();


  const customerRef =
    doc(
      db,
      "customers",
      selectedCustomerId
    );


  const snapshot =
    await getDoc(
      customerRef
    );


  if (!snapshot.exists()) {

    showCustomerStatus(
      "error",
      "Customer record was not found."
    );

    customerCheckCompleted =
      false;

    return;
  }


  const customer =
    {
      id: snapshot.id,
      ...snapshot.data()
    };


  /*
   * IMPORTANT SECURITY CHECK
   *
   * Retailer can use only its own
   * protected customers.
   */

  if (
    customer.originalRetailerId
    !== currentUser.uid
  ) {

    customerCheckCompleted =
      false;

    checkedCustomer =
      null;

    showCustomerStatus(
      "protected",
      "⚠️ This customer is protected under another retailer account."
    );

    return;
  }


  const actualMobile =
    normalizeMobile(
      customer.mobile ||
      customer.customerMobile ||
      ""
    );


  /*
   * If URL supplied mobile, make sure
   * it matches Firestore customer.
   */

  if (
    customerMobile.value &&
    actualMobile &&
    customerMobile.value !== actualMobile
  ) {

    customerCheckCompleted =
      false;

    checkedCustomer =
      null;

    showError(
      "Customer mobile verification failed."
    );

    return;
  }


  customerMobile.value =
    actualMobile;


  checkedCustomer =
    customer;

  customerCheckCompleted =
    true;


  fillExistingCustomer(
    customer
  );


  showCustomerStatus(
    "existing",
    "✓ Protected customer selected. You can create a new service request."
  );
}


// =========================================================
// CHECK CUSTOMER
// =========================================================

checkCustomerBtn.addEventListener(
  "click",
  checkCustomer
);


customerMobile.addEventListener(
  "input",
  () => {

    customerCheckCompleted =
      false;

    checkedCustomer =
      null;

    customerId.value =
      "";

    customerIdBox.style.display =
      "none";

    customerStatus.style.display =
      "none";

  }
);


async function checkCustomer() {

  clearMessages();


  const mobile =
    normalizeMobile(
      customerMobile.value
    );


  if (
    mobile.length !== 10
  ) {

    showError(
      "Please enter a valid 10 digit mobile number."
    );

    return;
  }


  checkCustomerBtn.disabled =
    true;

  checkCustomerBtn.textContent =
    "Checking...";


  try {

    /*
     * PRIMARY CUSTOMER LOOKUP
     *
     * customer_index/{mobile}
     */

    const indexRef =
      doc(
        db,
        "customer_index",
        mobile
      );


    const indexSnapshot =
      await getDoc(
        indexRef
      );


    /*
     * ==================================================
     * EXISTING INDEX
     * ==================================================
     */

    if (
      indexSnapshot.exists()
    ) {

      const indexData =
        indexSnapshot.data();


      const existingCustomerId =
        indexData.customerId;


      if (!existingCustomerId) {

        throw new Error(
          "Customer index is incomplete. Please contact Admin."
        );
      }


      /*
       * Read actual customer document.
       *
       * If this retailer owns it, Firestore rules
       * allow the read.
       */

      try {

        await loadExistingCustomerById(
          existingCustomerId
        );

      }
      catch (readError) {

        /*
         * Do NOT expose another retailer's identity.
         */

        checkedCustomer =
          null;

        customerCheckCompleted =
          false;

        customerId.value =
          "";

        showCustomerStatus(
          "protected",
          "⚠️ This mobile number is already registered and protected. Please contact REPARO Admin if ownership needs to be reviewed."
        );
      }


      return;
    }


    /*
     * ==================================================
     * NEW CUSTOMER
     * ==================================================
     */

    checkedCustomer =
      null;

    customerCheckCompleted =
      true;

    customerId.value =
      "";

    customerIdBox.style.display =
      "none";


    showCustomerStatus(
      "new",
      "✓ New customer. This customer will be protected under your retailer account when the request is created."
    );

  }
  catch (error) {

    console.error(
      "Customer check error:",
      error
    );


    showError(
      error.message ||
      "Customer check failed."
    );

  }
  finally {

    checkCustomerBtn.disabled =
      false;

    checkCustomerBtn.textContent =
      "Check";

  }
}


// =========================================================
// FILL EXISTING CUSTOMER
// =========================================================

function fillExistingCustomer(
  customer
) {

  customerId.value =
    customer.id;


  customerIdBox.textContent =
    `Customer ID: ${customer.id}`;


  customerIdBox.style.display =
    "block";


  customerName.value =
    customer.name ||
    customer.customerName ||
    "";


  customerAddress.value =
    customer.address ||
    "";


  /*
   * Device details are prefilled when
   * available from customer protection record.
   */

  deviceBrand.value =
    customer.deviceBrand ||
    "";

  deviceModel.value =
    customer.deviceModel ||
    "";

  screenSize.value =
    customer.screenSize ||
    "";

  serialNumber.value =
    customer.serialNumber ||
    "";
}


// =========================================================
// CUSTOMER STATUS
// =========================================================

function showCustomerStatus(
  type,
  message
) {

  customerStatus.className =
    "customer-status";


  if (
    type === "new"
  ) {

    customerStatus.classList.add(
      "status-new"
    );
  }


  if (
    type === "existing"
  ) {

    customerStatus.classList.add(
      "status-existing"
    );
  }


  if (
    type === "protected"
  ) {

    customerStatus.classList.add(
      "status-protected"
    );
  }


  if (
    type === "error"
  ) {

    customerStatus.classList.add(
      "status-error"
    );
  }


  customerStatus.textContent =
    message;


  customerStatus.style.display =
    "block";
}


// =========================================================
// CREATE SERVICE REQUEST
// =========================================================

requestForm.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();

    clearMessages();


    const mobile =
      normalizeMobile(
        customerMobile.value
      );


    const name =
      customerName.value.trim();


    const address =
      customerAddress.value.trim();


    const brand =
      deviceBrand.value.trim();


    const model =
      deviceModel.value.trim();


    const size =
      screenSize.value.trim();


    const serial =
      serialNumber.value.trim();


    const type =
      serviceType.value;


    const issue =
      problem.value.trim();


    /*
     * BASIC VALIDATION
     */

    if (
      mobile.length !== 10
    ) {

      showError(
        "Please enter a valid 10 digit mobile number."
      );

      return;
    }


    if (
      !customerCheckCompleted
    ) {

      showError(
        "Please check the customer mobile number first."
      );

      return;
    }


    if (!name) {

      showError(
        "Customer name is required."
      );

      return;
    }


    if (!brand) {

      showError(
        "Device brand is required."
      );

      return;
    }


    if (!type) {

      showError(
        "Please select service type."
      );

      return;
    }


    if (!issue) {

      showError(
        "Please enter the problem or requirement."
      );

      return;
    }


    submitBtn.disabled =
      true;

    submitBtn.textContent =
      "Creating...";


    try {

      let finalCustomerId =
        customerId.value.trim();


      /*
       * =================================================
       * EXISTING PROTECTED CUSTOMER
       * =================================================
       */

      if (
        finalCustomerId
      ) {

        const customerRef =
          doc(
            db,
            "customers",
            finalCustomerId
          );


        const customerSnapshot =
          await getDoc(
            customerRef
          );


        if (
          !customerSnapshot.exists()
        ) {

          throw new Error(
            "Customer record could not be found."
          );
        }


        const existingData =
          customerSnapshot.data();


        /*
         * FINAL OWNERSHIP CHECK
         */

        if (
          existingData.originalRetailerId
          !== currentUser.uid
        ) {

          throw new Error(
            "This customer is protected and cannot be used by this retailer."
          );
        }


        /*
         * Final mobile consistency check.
         */

        const storedMobile =
          normalizeMobile(
            existingData.mobile ||
            existingData.customerMobile ||
            ""
          );


        if (
          storedMobile &&
          storedMobile !== mobile
        ) {

          throw new Error(
            "Customer mobile number does not match the protected customer record."
          );
        }

      }


      /*
       * =================================================
       * NEW CUSTOMER
       * =================================================
       *
       * Customer + customer_index are created
       * atomically.
       */

      else {

        const result =
          await createProtectedCustomer(
            {
              mobile,
              name,
              address,
              brand,
              model,
              size,
              serial
            }
          );


        finalCustomerId =
          result.customerId;

      }


      /*
       * =================================================
       * CREATE SERVICE REQUEST
       * =================================================
       */

      const requestRef =
        await addDoc(
          collection(
            db,
            "service_requests"
          ),
          {

            requestId:
              null,

            customerId:
              finalCustomerId,

            retailerId:
              currentUser.uid,

            customerName:
              name,

            customerMobile:
              mobile,

            address,

            deviceBrand:
              brand,

            deviceModel:
              model,

            screenSize:
              size,

            serialNumber:
              serial,

            serviceType:
              type,

            problem:
              issue,

            status:
              "NEW",

            createdBy:
              currentUser.uid,

            createdAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp()

          }
        );


      /*
       * We cannot know Firestore auto-ID
       * before addDoc.
       *
       * Store the actual Request ID in the
       * same document as a second small update
       * only if desired in future.
       *
       * Current document ID itself is the
       * authoritative Request ID.
       */


      showSuccess(
        `Service Request created successfully. Request ID: ${requestRef.id}`
      );


      /*
       * Reset form.
       */

      requestForm.reset();


      customerId.value =
        "";

      customerCheckCompleted =
        false;

      checkedCustomer =
        null;

      customerIdBox.style.display =
        "none";

      customerStatus.style.display =
        "none";


      /*
       * Return to dashboard after short delay.
       */

      setTimeout(
        () => {

          window.location.href =
            "dashboard.html";

        },
        1800
      );

    }
    catch (error) {

      console.error(
        "Service Request creation error:",
        error
      );


      let message =
        error.message ||
        "Service Request creation failed.";


      if (
        error?.code ===
        "permission-denied"
      ) {

        message =
          "Permission denied. Please check customer ownership or login again.";
      }


      showError(
        message
      );

    }
    finally {

      submitBtn.disabled =
        false;

      submitBtn.textContent =
        "Create Service Request";
    }

  }
);


// =========================================================
// ATOMIC CUSTOMER CREATION
// =========================================================

async function createProtectedCustomer(
  data
) {

  const mobile =
    normalizeMobile(
      data.mobile
    );


  if (
    mobile.length !== 10
  ) {

    throw new Error(
      "Invalid customer mobile number."
    );
  }


  const customerRef =
    doc(
      collection(
        db,
        "customers"
      )
    );


  const indexRef =
    doc(
      db,
      "customer_index",
      mobile
    );


  /*
   * Transaction guarantees:
   *
   * 1. Mobile index must not already exist.
   * 2. Customer document is created.
   * 3. Index is created.
   *
   * If any operation fails, Firestore rolls
   * the transaction back.
   */

  await runTransaction(
    db,
    async (transaction) => {

      const indexSnapshot =
        await transaction.get(
          indexRef
        );


      if (
        indexSnapshot.exists()
      ) {

        throw new Error(
          "This mobile number has already been registered. Please check the customer again."
        );
      }


      const retailerName =
        retailerProfile?.shopName ||
        retailerProfile?.businessName ||
        retailerProfile?.name ||
        "";


      const customerData = {

        name:
          data.name,

        customerName:
          data.name,

        mobile,

        customerMobile:
          mobile,

        address:
          data.address || "",

        deviceBrand:
          data.brand || "",

        deviceModel:
          data.model || "",

        screenSize:
          data.size || "",

        serialNumber:
          data.serial || "",

        originalRetailerId:
          currentUser.uid,

        originalRetailerName:
          retailerName,

        protected:
          true,

        createdBy:
          currentUser.uid,

        createdAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp()

      };


      transaction.set(
        customerRef,
        customerData
      );


      transaction.set(
        indexRef,
        {

          mobile,

          customerId:
            customerRef.id,

          protected:
            true,

          createdAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp()

        }
      );

    }
  );


  return {
    customerId:
      customerRef.id
  };
}


// =========================================================
// BACK BUTTON
// =========================================================

backBtn.addEventListener(
  "click",
  () => {

    window.history.back();

  }
);


// =========================================================
// BOTTOM NAVIGATION
// =========================================================

document
  .querySelectorAll(
    ".bottom-nav [data-page]"
  )
  .forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          const page =
            button.dataset.page;


          if (page) {

            window.location.href =
              page;

          }

        }
      );

    }
  );


// =========================================================
// MOBILE NORMALIZATION
// =========================================================

function normalizeMobile(
  value
) {

  return String(
    value || ""
  )
    .replace(
      /\D/g,
      ""
    )
    .slice(
      -10
    );
}


// =========================================================
// MESSAGES
// =========================================================

function clearMessages() {

  errorBox.style.display =
    "none";

  successBox.style.display =
    "none";

  errorBox.textContent =
    "";

  successBox.textContent =
    "";
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