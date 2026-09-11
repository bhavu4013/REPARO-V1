import { auth, db } from "../js/firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  doc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


let currentUser = null;
let retailerProfile = null;

let customers = [];
let selectedCustomer = null;

let creatingNewCustomer = false;


// =====================================================
// ELEMENTS
// =====================================================

const loading =
  document.getElementById("loading");

const form =
  document.getElementById("requestForm");

const customerSearch =
  document.getElementById("customerSearch");

const customerResults =
  document.getElementById("customerResults");

const selectedCustomerBox =
  document.getElementById("selectedCustomer");

const protectionWarning =
  document.getElementById("protectionWarning");

const newCustomerBox =
  document.getElementById("newCustomerBox");


// =====================================================
// AUTH
// =====================================================

onAuthStateChanged(
  auth,
  async user => {

    if (!user) {

      location.href =
        "../index.html";

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


      if (
        !profileSnap.exists()
      ) {

        showError(
          "Retailer profile not found."
        );

        return;

      }


      retailerProfile =
        profileSnap.data();


      if (
        retailerProfile.role !==
        "retailer"
      ) {

        showError(
          "Retailer access required."
        );

        return;

      }


      currentUser =
        user;


      await loadCustomers();


      loading.style.display =
        "none";

      form.style.display =
        "block";


      // Customer ID passed from protected customer page
      const params =
        new URLSearchParams(
          location.search
        );

      const customerId =
        params.get(
          "customerId"
        );


      if (customerId) {

        const customer =
          customers.find(
            item =>
              item.id ===
              customerId
          );


        if (customer) {

          selectCustomer(
            customer
          );

        }

      }

    } catch (error) {

      console.error(error);

      showError(
        "Unable to load service request form."
      );

    }

  }
);


// =====================================================
// LOAD PROTECTED CUSTOMERS
// =====================================================

async function loadCustomers() {

  const snap =
    await getDocs(
      collection(
        db,
        "customers"
      )
    );


  customers = [];


  snap.forEach(item => {

    const data =
      item.data();


    /*
      IMPORTANT:

      Retailer only gets useful UI visibility
      for customers whose originalRetailerId
      matches current retailer.

      Firestore rules remain the real security layer.
    */

    if (
      data.originalRetailerId ===
      currentUser.uid
    ) {

      customers.push({

        id:
          item.id,

        ...data

      });

    }

  });


  customers.sort(
    (a,b) =>
      String(
        a.name || ""
      ).localeCompare(
        String(
          b.name || ""
        )
      )
  );


  renderCustomerResults(
    customers
  );

}


// =====================================================
// CUSTOMER SEARCH
// =====================================================

customerSearch.addEventListener(
  "input",
  () => {

    const text =
      customerSearch.value
        .trim()
        .toLowerCase();


    if (!text) {

      renderCustomerResults(
        customers
      );

      return;

    }


    const filtered =
      customers.filter(
        customer => {

          const value = [

            customer.name,
            customer.mobile,
            customer.email,
            customer.city,
            customer.id

          ]
            .join(" ")
            .toLowerCase();


          return value.includes(
            text
          );

        }
      );


    renderCustomerResults(
      filtered
    );

  }
);


// =====================================================
// RENDER CUSTOMERS
// =====================================================

function renderCustomerResults(list) {

  if (!list.length) {

    customerResults.innerHTML =
      `
        <div style="
          padding:12px;
          color:#6b7280;
          font-size:10px;
        ">
          No protected customer found.
        </div>
      `;

    return;

  }


  customerResults.innerHTML =
    list
      .map(
        customer => {

          const selected =
            selectedCustomer?.id ===
            customer.id;


          return `
            <div
              class="
                customer-option
                ${selected ? "selected" : ""}
              "
              data-id="${escapeHtml(
                customer.id
              )}">

              <strong>
                ${escapeHtml(
                  customer.name ||
                  "Unnamed Customer"
                )}
              </strong>

              <span>
                ${escapeHtml(
                  customer.mobile ||
                  "No mobile"
                )}
                ${
                  customer.city
                    ? " • " +
                      escapeHtml(
                        customer.city
                      )
                    : ""
                }
              </span>

            </div>
          `;

        }
      )
      .join("");


  document
    .querySelectorAll(
      ".customer-option"
    )
    .forEach(
      element => {

        element.addEventListener(
          "click",
          () => {

            const customer =
              customers.find(
                item =>
                  item.id ===
                  element.dataset.id
              );


            if (customer) {

              selectCustomer(
                customer
              );

            }

          }
        );

      }
    );

}


// =====================================================
// SELECT CUSTOMER
// =====================================================

function selectCustomer(
  customer
) {

  selectedCustomer =
    customer;

  creatingNewCustomer =
    false;


  newCustomerBox.classList.remove(
    "show"
  );


  protectionWarning.classList.remove(
    "show"
  );


  selectedCustomerBox.classList.add(
    "show"
  );


  document.getElementById(
    "selectedCustomerName"
  ).textContent =
    customer.name ||
    "Customer";


  document.getElementById(
    "selectedCustomerInfo"
  ).textContent =
    [
      customer.mobile,
      customer.city
    ]
      .filter(Boolean)
      .join(" • ") ||
    "Protected customer";


  customerSearch.value =
    customer.name ||
    customer.mobile ||
    "";


  renderCustomerResults(
    [customer]
  );

}


// =====================================================
// NEW CUSTOMER TOGGLE
// =====================================================

document.getElementById(
  "newCustomerBtn"
).addEventListener(
  "click",
  () => {

    creatingNewCustomer =
      !creatingNewCustomer;


    if (
      creatingNewCustomer
    ) {

      selectedCustomer =
        null;


      selectedCustomerBox.classList.remove(
        "show"
      );


      protectionWarning.classList.remove(
        "show"
      );


      customerResults.innerHTML =
        "";


      newCustomerBox.classList.add(
        "show"
      );


      document.getElementById(
        "newCustomerBtn"
      ).textContent =
        "− Use Protected Customer";

    } else {

      newCustomerBox.classList.remove(
        "show"
      );


      renderCustomerResults(
        customers
      );


      document.getElementById(
        "newCustomerBtn"
      ).textContent =
        "+ Create New Customer";

    }

  }
);


// =====================================================
// CREATE REQUEST
// =====================================================

form.addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    const submitBtn =
      document.getElementById(
        "submitBtn"
      );


    const deviceType =
      value("deviceType");

    const deviceBrand =
      value("deviceBrand");

    const deviceModel =
      value("deviceModel");

    const serialNumber =
      value("serialNumber");

    const screenSize =
      value("screenSize");

    const serviceType =
      value("serviceType");

    const problem =
      value("problem");

    const retailerNote =
      value("retailerNote");


    if (!deviceType) {

      alert(
        "Please select device type."
      );

      return;

    }


    if (!serviceType) {

      alert(
        "Please select service type."
      );

      return;

    }


    if (!problem) {

      alert(
        "Please enter customer complaint."
      );

      return;

    }


    submitBtn.disabled =
      true;

    submitBtn.textContent =
      "Creating Request...";


    try {

      let customer =
        selectedCustomer;


      // =================================================
      // NEW CUSTOMER
      // =================================================

      if (
        creatingNewCustomer
      ) {

        const name =
          document.getElementById(
            "newCustomerName"
          )
            .value
            .trim();


        const mobile =
          document.getElementById(
            "newCustomerMobile"
          )
            .value
            .replace(
              /\D/g,
              ""
            );


        const address =
          document.getElementById(
            "newCustomerAddress"
          )
            .value
            .trim();


        if (!name || !mobile) {

          throw new Error(
            "New customer name and mobile are required."
          );

        }


        if (
          mobile.length !== 10
        ) {

          throw new Error(
            "Please enter a valid 10 digit mobile number."
          );

        }


        /*
          Duplicate protection check.

          We search the customers collection that
          the current retailer can access.

          If mobile already belongs to a protected
          customer of another retailer, it must NOT
          be reassigned here.
        */

        const allCustomerSnap =
          await getDocs(
            collection(
              db,
              "customers"
            )
          );


        let duplicate =
          null;


        allCustomerSnap.forEach(
          item => {

            const data =
              item.data();


            if (
              String(
                data.mobile || ""
              ).replace(
                /\D/g,
                ""
              ) === mobile
            ) {

              duplicate = {
                id: item.id,
                ...data
              };

            }

          }
        );


        if (duplicate) {

          if (
            duplicate.originalRetailerId !==
            currentUser.uid
          ) {

            throw new Error(
              "This customer is already protected by another retailer. Admin transfer is required."
            );

          }


          customer =
            duplicate;

        } else {

          const customerData = {

            name,

            mobile,

            address,

            originalRetailerId:
              currentUser.uid,

            active:
              true,

            createdAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp()

          };


          const customerRef =
            await addDoc(
              collection(
                db,
                "customers"
              ),
              customerData
            );


          customer = {

            id:
              customerRef.id,

            ...customerData

          };

        }

      }


      // =================================================
      // PROTECTED CUSTOMER REQUIRED
      // =================================================

      if (!customer) {

        throw new Error(
          "Please select a protected customer or create a new customer."
        );

      }


      if (
        customer.originalRetailerId !==
        currentUser.uid
      ) {

        throw new Error(
          "This customer is protected by another retailer. Admin transfer is required."
        );

      }


      // =================================================
      // REQUEST ID
      // =================================================

      const requestId =
        await generateRequestId();


      // =================================================
      // SERVICE REQUEST
      // =================================================

      const requestData = {

        requestId,

        retailerId:
          currentUser.uid,

        retailerName:
          retailerProfile.name ||
          retailerProfile.businessName ||
          "",

        customerId:
          customer.id,

        customerName:
          customer.name ||
          "",

        customerMobile:
          customer.mobile ||
          "",

        customerAddress:
          customer.address ||
          "",

        deviceType,

        deviceBrand,

        deviceModel,

        serialNumber,

        screenSize,

        serviceType,

        problem,

        retailerNote,

        status:
          "NEW",

        source:
          "RETAILER",

        createdAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp()

      };


      const requestRef =
        await addDoc(
          collection(
            db,
            "service_requests"
          ),
          requestData
        );


      // =================================================
      // SUCCESS
      // =================================================

      alert(
        `Service Request created successfully.\n\nRequest ID: ${requestId}`
      );


      location.href =
        `./jobs.html?requestId=${encodeURIComponent(
          requestRef.id
        )}`;


    } catch (error) {

      console.error(error);

      alert(
        error.message ||
        "Unable to create service request."
      );


    } finally {

      submitBtn.disabled =
        false;

      submitBtn.textContent =
        "Create Service Request";

    }

  }
);


// =====================================================
// REQUEST ID
// =====================================================

async function generateRequestId() {

  const now =
    new Date();


  const date =
    now
      .toISOString()
      .slice(
        0,
        10
      )
      .replaceAll(
        "-",
        ""
      );


  const random =
    Math.floor(
      1000 +
      Math.random() *
      9000
    );


  return `REQ-${date}-${random}`;

}


// =====================================================
// VALUE HELPER
// =====================================================

function value(id) {

  return document.getElementById(
    id
  )
    .value
    .trim();

}


// =====================================================
// ESCAPE
// =====================================================

function escapeHtml(value) {

  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );

}


// =====================================================
// ERROR
// =====================================================

function showError(message) {

  loading.textContent =
    message;

  loading.style.display =
    "block";

  form.style.display =
    "none";

}