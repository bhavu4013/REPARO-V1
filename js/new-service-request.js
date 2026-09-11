import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
  auth,
  db
} from "./firebase.js";


/* =========================================================
   DOM
========================================================= */

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


/* =========================================================
   STATE
========================================================= */

let currentUser = null;
let retailerProfile = null;
let checkedCustomer = null;
let customerCheckCompleted = false;


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

    currentUser = user;

    await loadRetailerProfile();

    /*
      After authentication and retailer profile,
      check whether this page was opened from
      My Customers.
    */
    await loadCustomerFromUrl();

  } catch (error) {

    showError(
      error.message ||
      "Authorization error."
    );

  }

});


/* =========================================================
   RETAILER PROFILE
========================================================= */

async function loadRetailerProfile() {

  try {

    const retailerRef =
      doc(
        db,
        "retailers",
        currentUser.uid
      );

    const snapshot =
      await getDoc(retailerRef);

    if (snapshot.exists()) {

      retailerProfile =
        snapshot.data();

    } else {

      const userRef =
        doc(
          db,
          "users",
          currentUser.uid
        );

      const userSnapshot =
        await getDoc(userRef);

      retailerProfile =
        userSnapshot.exists()
          ? userSnapshot.data()
          : {};

    }

  } catch (error) {

    showError(
      error.message ||
      "Retailer profile could not be loaded."
    );

  }

}


/* =========================================================
   LOAD CUSTOMER FROM URL
========================================================= */

async function loadCustomerFromUrl() {

  const params =
    new URLSearchParams(
      window.location.search
    );

  const urlCustomerId =
    params.get("customerId");

  const urlMobile =
    normalizeMobile(
      params.get("mobile") || ""
    );


  /*
    Nothing passed in URL.
    Normal New Service Request flow.
  */

  if (!urlCustomerId && !urlMobile) {
    return;
  }


  try {

    /*
      Preferred method:
      customerId from My Customers.
    */

    if (urlCustomerId) {

      customerMobile.value =
        urlMobile;

      await loadExistingCustomerById(
        urlCustomerId
      );

      return;
    }


    /*
      Fallback:
      mobile was passed.
    */

    if (urlMobile.length === 10) {

      customerMobile.value =
        urlMobile;

      await checkCustomer();

    }

  } catch (error) {

    showError(
      error.message ||
      "Unable to load selected customer."
    );

  }

}


/* =========================================================
   LOAD EXISTING CUSTOMER BY ID
========================================================= */

async function loadExistingCustomerById(
  selectedCustomerId
) {

  const customerRef =
    doc(
      db,
      "customers",
      selectedCustomerId
    );

  const snapshot =
    await getDoc(customerRef);


  if (!snapshot.exists()) {

    showCustomerStatus(
      "error",
      "Customer record was not found."
    );

    return;

  }


  const customer =
    {
      id: snapshot.id,
      ...snapshot.data()
    };


  /*
    Security check:
    Customer must belong to current retailer.
  */

  if (
    customer.originalRetailerId
    !== currentUser.uid
  ) {

    showCustomerStatus(
      "protected",
      "⚠️ This customer is not protected under your retailer account."
    );

    customerCheckCompleted =
      false;

    return;

  }


  /*
    Make sure URL mobile and actual
    Firestore mobile are consistent.
  */

  const actualMobile =
    normalizeMobile(
      customer.mobile ||
      customer.customerMobile ||
      ""
    );


  if (
    customerMobile.value &&
    actualMobile &&
    customerMobile.value !== actualMobile
  ) {

    showError(
      "Customer mobile verification failed."
    );

    customerCheckCompleted =
      false;

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


/* =========================================================
   CHECK CUSTOMER
========================================================= */

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

  if (mobile.length !== 10) {

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
      First check customer_index.
    */

    const indexRef =
      doc(
        db,
        "customer_index",
        mobile
      );

    const indexSnapshot =
      await getDoc(indexRef);


    if (indexSnapshot.exists()) {

      const indexData =
        indexSnapshot.data();

      const existingCustomerId =
        indexData.customerId;


      if (existingCustomerId) {

        try {

          const customerRef =
            doc(
              db,
              "customers",
              existingCustomerId
            );

          const customerSnapshot =
            await getDoc(customerRef);


          if (customerSnapshot.exists()) {

            const customer =
              {
                id: customerSnapshot.id,
                ...customerSnapshot.data()
              };


            /*
              Same retailer:
              reuse customer.
            */

            if (
              customer.originalRetailerId
              === currentUser.uid
            ) {

              checkedCustomer =
                customer;

              customerCheckCompleted =
                true;

              fillExistingCustomer(
                customer
              );

              showCustomerStatus(
                "existing",
                "✓ Existing protected customer found. You can create a new service request."
              );

              return;

            }

          }

        } catch (readError) {

          /*
            Customer belongs elsewhere or is
            not readable under current rules.
          */

        }

      }


      /*
        Existing protected customer,
        but not accessible to this retailer.
      */

      checkedCustomer =
        null;

      customerCheckCompleted =
        false;

      customerId.value =
        "";

      showCustomerStatus(
        "protected",
        "⚠️ This customer is already registered in REPARO and is protected. Please contact Admin for verification or transfer."
      );

      return;

    }


    /*
      Legacy customer check.
    */

    const customersQuery =
      query(
        collection(db, "customers"),
        where("mobile", "==", mobile)
      );

    const customersSnapshot =
      await getDocs(
        customersQuery
      );


    if (!customersSnapshot.empty) {

      const customerDoc =
        customersSnapshot.docs[0];

      const customer =
        {
          id: customerDoc.id,
          ...customerDoc.data()
        };


      if (
        customer.originalRetailerId
        === currentUser.uid
      ) {

        checkedCustomer =
          customer;

        customerCheckCompleted =
          true;

        fillExistingCustomer(
          customer
        );

        showCustomerStatus(
          "existing",
          "✓ Existing protected customer found."
        );

        return;

      }


      showCustomerStatus(
        "protected",
        "⚠️ This customer is already protected. Please contact Admin before creating another customer record."
      );

      return;

    }


    /*
      Completely new customer.
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
      "✓ New customer. After creation, this customer will be protected under your retailer account."
    );


  } catch (error) {

    showError(
      error.message ||
      "Customer check failed."
    );

  } finally {

    checkCustomerBtn.disabled =
      false;

    checkCustomerBtn.textContent =
      "Check";

  }

}


/* =========================================================
   FILL EXISTING CUSTOMER
========================================================= */

function fillExistingCustomer(customer) {

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


/* =========================================================
   CUSTOMER STATUS UI
========================================================= */

function showCustomerStatus(
  type,
  message
) {

  customerStatus.className =
    "customer-status";


  if (type === "new") {

    customerStatus.classList.add(
      "status-new"
    );

  }


  if (type === "existing") {

    customerStatus.classList.add(
      "status-existing"
    );

  }


  if (type === "protected") {

    customerStatus.classList.add(
      "status-protected"
    );

  }


  if (type === "error") {

    customerStatus.classList.add(
      "status-error"
    );

  }


  customerStatus.textContent =
    message;

  customerStatus.style.display =
    "block";

}


/* =========================================================
   SUBMIT SERVICE REQUEST
========================================================= */

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


    if (mobile.length !== 10) {

      showError(
        "Please enter a valid 10 digit mobile number."
      );

      return;

    }


    if (!customerCheckCompleted) {

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


      /* ===================================================
         EXISTING CUSTOMER
      =================================================== */

      if (finalCustomerId) {

        const existingCustomerRef =
          doc(
            db,
            "customers",
            finalCustomerId
          );

        const existingSnapshot =
          await getDoc(
            existingCustomerRef
          );


        if (!existingSnapshot.exists()) {

          throw new Error(
            "Existing customer record could not be found."
          );

        }


        const existingData =
          existingSnapshot.data();


        /*
          Final ownership validation.
        */

        if (
          existingData.originalRetailerId
          !== currentUser.uid
        ) {

          throw new Error(
            "This customer is protected and cannot be used by this retailer."
          );

        }

      }


      /* ===================================================
         NEW CUSTOMER
      =================================================== */

      else {

        /*
          Re-check duplicate index immediately
          before creating customer.
        */

        const indexRef =
          doc(
            db,
            "customer_index",
            mobile
          );

        const indexSnapshot =
          await getDoc(indexRef);


        if (indexSnapshot.exists()) {

          throw new Error(
            "This mobile number has already been registered. Please check the customer again."
          );

        }


        /*
          Create new customer document.
        */

        const newCustomerRef =
          doc(
            collection(
              db,
              "customers"
            )
          );

        finalCustomerId =
          newCustomerRef.id;


        const retailerName =
          retailerProfile?.businessName ||
          retailerProfile?.shopName ||
          retailerProfile?.name ||
          "";


        const customerData = {

          name,

          customerName:
            name,

          mobile,

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


        await setDoc(
          newCustomerRef,
          customerData
        );


        /*
          Create mobile index.

          Original retailer is NOT stored here.
        */

        await setDoc(
          indexRef,
          {

            mobile,

            customerId:
              finalCustomerId,

            protected:
              true,

            createdAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp()

          }
        );

      }


      /* ===================================================
         CREATE SERVICE REQUEST
      =================================================== */

      const requestRef =
        await addDoc(
          collection(
            db,
            "service_requests"
          ),
          {

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


      showSuccess(
        `Service Request created successfully. Request ID: ${requestRef.id}`
      );


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


      setTimeout(() => {

        window.location.href =
          "dashboard.html";

      }, 1800);


    } catch (error) {

      showError(
        error.message ||
        "Service Request creation failed."
      );

    } finally {

      submitBtn.disabled =
        false;

      submitBtn.textContent =
        "Create Service Request";

    }

  }
);


/* =========================================================
   BACK
========================================================= */

backBtn.addEventListener(
  "click",
  () => {

    window.history.back();

  }
);


/* =========================================================
   NAVIGATION
========================================================= */

document
  .querySelectorAll(
    ".bottom-nav [data-page]"
  )
  .forEach(button => {

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

  });


/* =========================================================
   MOBILE NORMALIZATION
========================================================= */

function normalizeMobile(value) {

  return String(value || "")
    .replace(/\D/g, "")
    .slice(-10);

}


/* =========================================================
   MESSAGES
========================================================= */

function clearMessages() {

  errorBox.style.display =
    "none";

  successBox.style.display =
    "none";

}


function showError(message) {

  successBox.style.display =
    "none";

  errorBox.textContent =
    message;

  errorBox.style.display =
    "block";

}


function showSuccess(message) {

  errorBox.style.display =
    "none";

  successBox.textContent =
    message;

  successBox.style.display =
    "block";

}