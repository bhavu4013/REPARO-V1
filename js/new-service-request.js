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

      This collection contains only:
      mobile
      customerId
      protected

      It does NOT expose originalRetailerId.
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


      /*
        If index exists, load customer.

        The Firestore rules will only allow the retailer
        to read it if it belongs to this retailer.
      */

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
              customer can be reused.
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
                "✓ Existing protected customer found. You can create a new service request for this customer."
              );

              return;

            }

          }

        } catch (readError) {

          /*
            If customer document cannot be read,
            it is most likely protected by another retailer.
          */

        }

      }


      /*
        Existing index but customer is not readable
        by this retailer = protected elsewhere.
      */

      checkedCustomer =
        null;

      customerCheckCompleted =
        false;

      customerId.value =
        "";

      showCustomerStatus(
        "protected",
        "⚠️ This customer is already registered in REPARO. The customer relationship is protected. Please contact Admin for verification or transfer."
      );

      return;

    }


    /*
      No index found.
      Check customers collection for legacy records
      where mobile may already exist.

      This is useful while migrating older data.
    */

    const customersQuery =
      query(
        collection(db, "customers"),
        where("mobile", "==", mobile)
      );

    const customersSnapshot =
      await getDocs(customersQuery);


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
   SUBMIT REQUEST
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
          Final security check before creating request.
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
          Re-check index immediately before creation.
          This prevents creating a duplicate if another
          record was created after the first check.
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
            "This mobile number has just been registered. Please check the customer again."
          );

        }


        /*
          Create customer ID first.
        */

        const newCustomerRef =
          doc(
            collection(db, "customers")
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

          customerName: name,

          mobile,

          customerMobile: mobile,

          address,

          deviceBrand: brand,

          deviceModel: model,

          screenSize: size,

          serialNumber: serial,

          originalRetailerId:
            currentUser.uid,

          originalRetailerName:
            retailerName,

          protected: true,

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
          Create duplicate index.

          IMPORTANT:
          No originalRetailerId is stored here.
        */

        await setDoc(
          indexRef,
          {

            mobile,

            customerId:
              finalCustomerId,

            protected: true,

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


      /*
        Reset form after successful creation.
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
        Give user time to see success message,
        then return to Service Requests.
      */

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