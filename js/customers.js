import {
  auth,
  db
} from "./firebase.js";


import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


import {
  collection,
  getDocs,
  query,
  where,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


/* ==================================================
   VARIABLES
================================================== */

let customers = [];

let retailers = [];

let editingCustomerId = null;


/* ==================================================
   ELEMENTS
================================================== */

const customerList =
  document.getElementById(
    "customerList"
  );


const searchInput =
  document.getElementById(
    "searchInput"
  );


const modal =
  document.getElementById(
    "customerModal"
  );


const customerForm =
  document.getElementById(
    "customerForm"
  );


const retailerSelect =
  document.getElementById(
    "retailerSelect"
  );


const duplicateWarning =
  document.getElementById(
    "duplicateWarning"
  );


const saveBtn =
  document.getElementById(
    "saveBtn"
  );


/* ==================================================
   ADMIN AUTH CHECK
================================================== */

onAuthStateChanged(
  auth,
  async (user) => {

    if (!user) {

      window.location.href =
        "../index.html";

      return;

    }


    try {

      const userQuery =
        query(
          collection(
            db,
            "users"
          ),
          where(
            "__name__",
            "==",
            user.uid
          )
        );


      const userSnapshot =
        await getDocs(
          userQuery
        );


      if (
        userSnapshot.empty
      ) {

        alert(
          "Admin profile not found."
        );

        window.location.href =
          "../index.html";

        return;

      }


      const profile =
        userSnapshot
          .docs[0]
          .data();


      if (
        profile.role !==
        "admin"
      ) {

        alert(
          "Admin access required."
        );

        window.location.href =
          "../index.html";

        return;

      }


      await loadRetailers();

      await loadCustomers();

    }

    catch (error) {

      console.error(
        "Admin verification error:",
        error
      );


      customerList.innerHTML = `
        <div class="message">
          Unable to verify admin account.
        </div>
      `;

    }

  }
);


/* ==================================================
   LOAD RETAILERS
================================================== */

async function loadRetailers() {

  try {

    const retailerQuery =
      query(
        collection(
          db,
          "users"
        ),
        where(
          "role",
          "==",
          "retailer"
        )
      );


    const snapshot =
      await getDocs(
        retailerQuery
      );


    retailers = [];


    snapshot.forEach(
      (item) => {

        retailers.push({
          id: item.id,
          ...item.data()
        });

      }
    );


    retailers.sort(
      (a, b) =>
        String(
          a.name || ""
        ).localeCompare(
          String(
            b.name || ""
          )
        )
    );


    renderRetailerOptions();

  }

  catch (error) {

    console.error(
      "Retailer loading error:",
      error
    );

  }

}


/* ==================================================
   RETAILER DROPDOWN
================================================== */

function renderRetailerOptions(
  selectedId = ""
) {

  retailerSelect.innerHTML = `
    <option value="">
      Select retailer
    </option>
  `;


  retailers.forEach(
    (retailer) => {

      const option =
        document.createElement(
          "option"
        );


      option.value =
        retailer.id;


      option.textContent =
        retailer.name ||
        retailer.email ||
        retailer.id;


      if (
        retailer.id ===
        selectedId
      ) {

        option.selected =
          true;

      }


      retailerSelect.appendChild(
        option
      );

    }
  );

}


/* ==================================================
   LOAD CUSTOMERS
================================================== */

async function loadCustomers() {

  customerList.innerHTML = `
    <div class="message">
      Loading customers...
    </div>
  `;


  try {

    const snapshot =
      await getDocs(
        collection(
          db,
          "customers"
        )
      );


    customers = [];


    snapshot.forEach(
      (item) => {

        customers.push({
          id: item.id,
          ...item.data()
        });

      }
    );


    customers.sort(
      (a, b) =>
        String(
          a.name || ""
        ).localeCompare(
          String(
            b.name || ""
          )
        )
    );


    updateSummary();

    renderCustomers();

  }

  catch (error) {

    console.error(
      "Customer loading error:",
      error
    );


    customerList.innerHTML = `
      <div class="message">
        Unable to load customers.
      </div>
    `;

  }

}


/* ==================================================
   SUMMARY
================================================== */

function updateSummary() {

  const total =
    customers.length;


  const protectedCount =
    customers.filter(
      customer =>
        customer.originalRetailerId
    ).length;


  const unassignedCount =
    total -
    protectedCount;


  document.getElementById(
    "totalCount"
  ).textContent =
    total;


  document.getElementById(
    "protectedCount"
  ).textContent =
    protectedCount;


  document.getElementById(
    "unassignedCount"
  ).textContent =
    unassignedCount;

}


/* ==================================================
   RENDER CUSTOMERS
================================================== */

function renderCustomers() {

  const search =
    searchInput.value
      .trim()
      .toLowerCase();


  const filtered =
    customers.filter(
      (customer) => {

        const name =
          String(
            customer.name || ""
          ).toLowerCase();


        const mobile =
          String(
            customer.mobile || ""
          ).toLowerCase();


        const brand =
          String(
            customer.deviceBrand || ""
          ).toLowerCase();


        const model =
          String(
            customer.deviceModel || ""
          ).toLowerCase();


        const serial =
          String(
            customer.deviceSerial || ""
          ).toLowerCase();


        const address =
          String(
            customer.address || ""
          ).toLowerCase();


        return (
          name.includes(search) ||
          mobile.includes(search) ||
          brand.includes(search) ||
          model.includes(search) ||
          serial.includes(search) ||
          address.includes(search)
        );

      }
    );


  if (
    filtered.length ===
    0
  ) {

    customerList.innerHTML = `
      <div class="message">
        No customers found.
      </div>
    `;

    return;

  }


  customerList.innerHTML =
    filtered.map(
      (customer) => {

        const retailer =
          retailers.find(
            item =>
              item.id ===
              customer.originalRetailerId
          );


        const retailerName =
          retailer
            ? retailer.name ||
              retailer.email
            : "Not assigned";


        const deviceText =
          [
            customer.deviceBrand,
            customer.deviceModel
          ]
          .filter(Boolean)
          .join(" • ");


        return `

          <div class="customer-card">

            <div class="customer-top">

              <div class="customer-main">

                <div class="customer-name">
                  ${escapeHtml(
                    customer.name ||
                    "Unnamed Customer"
                  )}
                </div>


                <div class="customer-detail">

                  📱 ${escapeHtml(
                    customer.mobile ||
                    "-"
                  )}

                  ${
                    deviceText
                      ? `
                        <br>
                        📺 ${escapeHtml(
                          deviceText
                        )}
                      `
                      : ""
                  }

                  ${
                    customer.screenSize
                      ? `
                        <br>
                        📐 ${escapeHtml(
                          customer.screenSize
                        )}"
                      `
                      : ""
                  }

                  ${
                    customer.deviceSerial
                      ? `
                        <br>
                        🔢 Serial:
                        ${escapeHtml(
                          customer.deviceSerial
                        )}
                      `
                      : ""
                  }

                </div>

              </div>


              ${
                customer.originalRetailerId
                  ? `
                    <div class="protection-badge">
                      🔒 PROTECTED
                    </div>
                  `
                  : ""
              }

            </div>


            <div class="customer-bottom">

              <div class="retailer-info">

                Original Retailer<br>

                <strong>
                  ${escapeHtml(
                    retailerName
                  )}
                </strong>

              </div>


              <button
                class="edit-btn"
                data-id="${escapeHtml(
                  customer.id
                )}"
                type="button"
              >
                Edit
              </button>

            </div>

          </div>

        `;

      }
    ).join("");


  /*
   * Attach edit events safely
   */

  document
    .querySelectorAll(
      ".edit-btn"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            editCustomer(
              button.dataset.id
            );

          }
        );

      }
    );

}


/* ==================================================
   SEARCH
================================================== */

searchInput.addEventListener(
  "input",
  renderCustomers
);


/* ==================================================
   ADD CUSTOMER
================================================== */

document
  .getElementById(
    "addCustomerBtn"
  )
  .addEventListener(
    "click",
    () => {

      editingCustomerId =
        null;


      customerForm.reset();


      document.getElementById(
        "modalTitle"
      ).textContent =
        "Add Customer";


      saveBtn.textContent =
        "Create Customer";


      duplicateWarning
        .classList.remove(
          "show"
        );


      duplicateWarning.textContent =
        "";


      renderRetailerOptions();


      modal.classList.add(
        "show"
      );


      document.getElementById(
        "customerName"
      ).focus();

    }
  );


/* ==================================================
   EDIT CUSTOMER
================================================== */

function editCustomer(id) {

  const customer =
    customers.find(
      item =>
        item.id === id
    );


  if (!customer) {
    return;
  }


  editingCustomerId =
    id;


  document.getElementById(
    "modalTitle"
  ).textContent =
    "Edit Customer";


  saveBtn.textContent =
    "Update Customer";


  document.getElementById(
    "customerName"
  ).value =
    customer.name || "";


  document.getElementById(
    "customerMobile"
  ).value =
    customer.mobile || "";


  document.getElementById(
    "customerAddress"
  ).value =
    customer.address || "";


  document.getElementById(
    "deviceBrand"
  ).value =
    customer.deviceBrand || "";


  document.getElementById(
    "deviceModel"
  ).value =
    customer.deviceModel || "";


  document.getElementById(
    "deviceSerial"
  ).value =
    customer.deviceSerial || "";


  document.getElementById(
    "screenSize"
  ).value =
    customer.screenSize || "";


  document.getElementById(
    "customerNotes"
  ).value =
    customer.notes || "";


  /*
   * Existing original retailer
   * is loaded.
   */

  renderRetailerOptions(
    customer.originalRetailerId ||
    ""
  );


  duplicateWarning
    .classList.remove(
      "show"
    );


  duplicateWarning.textContent =
    "";


  modal.classList.add(
    "show"
  );

}


/* ==================================================
   DUPLICATE CUSTOMER CHECK
================================================== */

function checkDuplicateCustomer() {

  const mobile =
    document.getElementById(
      "customerMobile"
    ).value
      .trim();


  const name =
    document.getElementById(
      "customerName"
    ).value
      .trim()
      .toLowerCase();


  if (
    !mobile &&
    !name
  ) {

    duplicateWarning
      .classList.remove(
        "show"
      );

    return null;

  }


  const currentMobile =
    mobile.replace(
      /\D/g,
      ""
    );


  const duplicate =
    customers.find(
      customer => {

        if (
          editingCustomerId &&
          customer.id ===
          editingCustomerId
        ) {

          return false;

        }


        const existingMobile =
          String(
            customer.mobile || ""
          )
          .replace(
            /\D/g,
            ""
          );


        const existingName =
          String(
            customer.name || ""
          )
          .trim()
          .toLowerCase();


        const mobileMatch =
          currentMobile &&
          existingMobile &&
          currentMobile ===
          existingMobile;


        const nameMatch =
          name &&
          existingName ===
          name;


        return (
          mobileMatch ||
          nameMatch
        );

      }
    );


  if (!duplicate) {

    duplicateWarning
      .classList.remove(
        "show"
      );

    duplicateWarning.textContent =
      "";

    return null;

  }


  const retailer =
    retailers.find(
      item =>
        item.id ===
        duplicate.originalRetailerId
    );


  const retailerName =
    retailer
      ? retailer.name ||
        retailer.email
      : "another retailer";


  duplicateWarning.innerHTML = `
    ⚠️ Possible duplicate customer found.
    Existing protected retailer:
    <strong>
      ${escapeHtml(
        retailerName
      )}
    </strong>.
    Please verify before creating another record.
  `;


  duplicateWarning.classList.add(
    "show"
  );


  return duplicate;

}


/* ==================================================
   DUPLICATE INPUT EVENTS
================================================== */

document
  .getElementById(
    "customerMobile"
  )
  .addEventListener(
    "blur",
    checkDuplicateCustomer
  );


document
  .getElementById(
    "customerName"
  )
  .addEventListener(
    "blur",
    checkDuplicateCustomer
  );


/* ==================================================
   SAVE CUSTOMER
================================================== */

customerForm.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();


    const name =
      document.getElementById(
        "customerName"
      ).value.trim();


    const mobile =
      document.getElementById(
        "customerMobile"
      ).value.trim();


    const address =
      document.getElementById(
        "customerAddress"
      ).value.trim();


    const deviceBrand =
      document.getElementById(
        "deviceBrand"
      ).value.trim();


    const deviceModel =
      document.getElementById(
        "deviceModel"
      ).value.trim();


    const deviceSerial =
      document.getElementById(
        "deviceSerial"
      ).value.trim();


    const screenSize =
      document.getElementById(
        "screenSize"
      ).value;


    const selectedRetailerId =
      retailerSelect.value;


    const notes =
      document.getElementById(
        "customerNotes"
      ).value.trim();


    if (
      !name ||
      !mobile ||
      !selectedRetailerId
    ) {

      alert(
        "Customer Name, Mobile and Original Retailer are required."
      );

      return;

    }


    const duplicate =
      checkDuplicateCustomer();


    if (duplicate) {

      const continueSave =
        confirm(
          "A possible duplicate customer was found. Do you still want to continue?"
        );


      if (!continueSave) {
        return;
      }

    }


    saveBtn.disabled =
      true;


    try {

      /* ==========================================
         UPDATE EXISTING CUSTOMER
      ========================================== */

      if (
        editingCustomerId
      ) {

        const existing =
          customers.find(
            item =>
              item.id ===
              editingCustomerId
          );


        /*
         * IMPORTANT:
         *
         * Once originalRetailerId exists,
         * normal editing does NOT change it.
         *
         * This protects the retailer relationship.
         */

        const originalRetailerId =
          existing &&
          existing.originalRetailerId
            ? existing.originalRetailerId
            : selectedRetailerId;


        await updateDoc(
          doc(
            db,
            "customers",
            editingCustomerId
          ),
          {

            name,

            mobile,

            address,

            deviceBrand,

            deviceModel,

            deviceSerial,

            screenSize,

            originalRetailerId,

            protectionStatus:
              "PROTECTED",

            notes,

            updatedAt:
              serverTimestamp()

          }
        );


        alert(
          "Customer updated successfully."
        );

      }


      /* ==========================================
         CREATE NEW CUSTOMER
      ========================================== */

      else {

        const customerRef =
          doc(
            collection(
              db,
              "customers"
            )
          );


        await setDoc(
          customerRef,
          {

            customerId:
              customerRef.id,

            name,

            mobile,

            address,

            deviceBrand,

            deviceModel,

            deviceSerial,

            screenSize,

            /*
             * FIRST RETAILER BECOMES OWNER
             */

            originalRetailerId:
              selectedRetailerId,

            protectionStatus:
              "PROTECTED",

            status:
              "active",

            notes,

            createdAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp()

          }
        );


        alert(
          "Customer created successfully."
        );

      }


      closeModal();

      await loadCustomers();

    }

    catch (error) {

      console.error(
        "Customer save error:",
        error
      );


      if (
        error.code ===
        "permission-denied"
      ) {

        alert(
          "Permission denied. Please check Firestore Rules."
        );

      }

      else {

        alert(
          "Unable to save customer."
        );

      }

    }

    finally {

      saveBtn.disabled =
        false;

    }

  }
);


/* ==================================================
   CLOSE MODAL
================================================== */

function closeModal() {

  modal.classList.remove(
    "show"
  );


  editingCustomerId