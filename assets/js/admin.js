import { db } from "./firebase.js";
let isLoggingOut = false;

import {
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  deleteDoc,
  doc,
  updateDoc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { getAuth, signOut, onAuthStateChanged }
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

/* ===============================
   SELECTORS
================================ */

const form = document.getElementById("addStockForm");
const tableBody = document.getElementById("stockTableBody");
const filterLab = document.getElementById("filterLab");
const filterItemTypeGroup = document.getElementById("filterItemTypeGroup");

const labSelect = document.getElementById("labName");
const itemTypeGroup = document.getElementById("itemTypeGroup");
const itemTypeSelect = document.getElementById("itemType");
const filterItemType = document.getElementById("filterItemType");
const searchInput = document.getElementById("searchInput");
const noResults = document.getElementById("noResults");

const totalItemsEl = document.getElementById("totalItems");
const availableItemsEl = document.getElementById("availableItems");
const notAvailableItemsEl = document.getElementById("notAvailableItems");

/* ===============================
   SHOW/HIDE ITEM TYPE (ADD STOCK)
================================ */

labSelect.addEventListener("change", function () {
  if (this.value === "Chemistry Lab") {
    itemTypeGroup.classList.add("show");
  } else {
    itemTypeGroup.classList.remove("show");
    itemTypeSelect.value = "";
  }
});

/* ===============================
   ADD NEW STOCK
================================ */

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const labName = labSelect.value;
  const equipmentName = document.getElementById("equipmentName").value;
  const quantityInput = document.getElementById("quantity").value;
  const billNumbe = document.getElementById("billNumber").value;
  const billNumber = document.getElementById("billNumber").value;
  const billDate = document.getElementById("billDate").value;
  const itemType = itemTypeSelect.value || "-";

  let quantity;
  let autoStatus;

  // FIX #1 — Quantity Data Type Logic (Add Stock)
  // Consumable → STRING | Non-Consumable / others → NUMBER
  if (itemType === "Consumable") {
    quantity = quantityInput; // keep as string e.g. "500 ml"
    autoStatus = quantityInput.trim() === "0" || quantityInput.trim() === "" ? "Not Available" : "Available";
  } else {
    quantity = Number(quantityInput); // convert to number
    autoStatus = quantity === 0 ? "Not Available" : "Available";
  }

  try {
    await addDoc(collection(db, "stock"), {
      labName,
      equipmentName,
      quantity,
      billNumber,
      billDate,
      itemType,
      status: autoStatus,
      remarks: autoStatus,
      lastUpdated: serverTimestamp()
    });

    form.reset();
    itemTypeGroup.classList.remove("show");

  } catch (error) {
    console.error("Error adding document:", error);
  }
});

/* ===============================
   REAL-TIME TABLE UPDATE
================================ */

let unsubscribe = null;

function loadStock(selectedLab = "All") {

  if (unsubscribe) unsubscribe();

  let q;

  // FIX #2 — Force Initial Load: always build a valid query for "all" or specific lab
  if (selectedLab === "All") {
    q = collection(db, "stock"); // loads everything immediately on first call
  } else {
    q = query(collection(db, "stock"), where("labName", "==", selectedLab));
  }

  unsubscribe = onSnapshot(q, (snapshot) => {

    tableBody.innerHTML = "";

    snapshot.forEach((docSnapshot) => {

      const stock = docSnapshot.data();
      const docId = docSnapshot.id;

      const row = document.createElement("tr");

      const formattedDate = stock.lastUpdated
        ? new Date(stock.lastUpdated.seconds * 1000).toLocaleString("en-IN")
        : "-";

      row.innerHTML = `
        <td>${stock.labName || "-"}</td>
        <td>${stock.equipmentName || "-"}</td>
        <td>${stock.quantity || "-"}</td>
        <td>${stock.billNumber || "-"}</td>
        <td>${stock.billDate || "-"}</td>
        <td>${formattedDate}</td>
        <td>${stock.status || "-"}</td>
        <td>
          <button class="edit-btn" data-id="${docId}">Edit</button>
          <button class="delete-btn" data-id="${docId}">Delete</button>
        </td>
      `;

      row.dataset.itemtype = stock.itemType || "";
      tableBody.appendChild(row);
    });

    applySearchFilter(); // stats + filter handled here
  });
}

// FIX #2 — Explicitly call loadStock on page load to guarantee initial render
loadStock();

/* ===============================
   FILTER LAB
================================ */

filterLab.addEventListener("change", (e) => {

  loadStock(e.target.value);

  if (e.target.value === "Chemistry Lab") {
    filterItemTypeGroup.classList.add("show");
  } else {
    filterItemTypeGroup.classList.remove("show");
    if (filterItemType) filterItemType.value = "All";
  }
});

/* ===============================
   SEARCH + TYPE FILTER + STATS
================================ */

function applySearchFilter() {

  const value = searchInput ? searchInput.value.toLowerCase().trim() : "";

  // FIX #3 — Read filterItemType value safely; treat empty string as "All"
  const selectedType = (filterItemType && filterItemType.value) ? filterItemType.value : "All";

  const rows = tableBody.querySelectorAll("tr");

  let total = 0;
  let available = 0;
  let notAvailable = 0;
  let matchFound = false;

  rows.forEach(row => {

    row.classList.remove("highlight-row");

    const text = row.innerText.toLowerCase();
    const itemType = row.dataset.itemtype || "";

    const searchMatch = value === "" || text.includes(value);

    // FIX #3 — Correct type matching: "All" or "" shows all, otherwise exact match
    const typeMatch =
      selectedType === "All" ||
      selectedType === "" ||
      itemType === selectedType;

    if (searchMatch && typeMatch) {

      row.style.display = "";
      if (value !== "") row.classList.add("highlight-row");

      matchFound = true;

      total++;

      const statusText = row.children[6].innerText.trim();

      if (statusText === "Available") {
        available++;
      } else {
        notAvailable++;
      }

    } else {
      row.style.display = "none";
    }

  });

  totalItemsEl.innerText = total;
  availableItemsEl.innerText = available;
  notAvailableItemsEl.innerText = notAvailable;

  if (noResults) {
    noResults.style.display = (!matchFound && value !== "") ? "block" : "none";
  }
}

if (searchInput) {
  searchInput.addEventListener("input", applySearchFilter);
}

if (filterItemType) {
  // FIX #3 — Ensure filter change always triggers applySearchFilter
  filterItemType.addEventListener("change", applySearchFilter);
}

/* ===============================
   DELETE
================================ */

tableBody.addEventListener("click", async (e) => {

  if (e.target.classList.contains("delete-btn")) {

    const deleteId = e.target.getAttribute("data-id");
    const row = e.target.closest("tr");

    row.style.opacity = "0";
    row.style.transform = "translateX(40px)";
    row.style.transition = "0.4s";

    setTimeout(async () => {
      await deleteDoc(doc(db, "stock", deleteId));
    }, 400);
  }

});

/* ===============================
   EDIT
================================ */

tableBody.addEventListener("click", (e) => {

  if (e.target.classList.contains("edit-btn")) {

    const currentEditId = e.target.getAttribute("data-id");
    const qty = prompt("Enter new quantity:");

    if (!qty) return;

    const row = e.target.closest("tr");
    const itemType = row.dataset.itemtype;

    let updatedQty;
    let autoStatus;

    // FIX #1 — Quantity Data Type Logic (Edit)
    // Consumable → STRING | Non-Consumable / others → NUMBER
    if (itemType === "Consumable") {
      updatedQty = qty; // keep as string e.g. "500 ml"
      autoStatus = qty.trim() === "0" || qty.trim() === "" ? "Not Available" : "Available";
    } else {
      updatedQty = Number(qty); // convert to number
      autoStatus = updatedQty === 0 ? "Not Available" : "Available";
    }

    updateDoc(doc(db, "stock", currentEditId), {
      quantity: updatedQty,
      status: autoStatus,
      remarks: autoStatus,
      lastUpdated: serverTimestamp()
    });
  }
});

/* ===============================
   AUTH
================================ */

const auth = getAuth();
const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      isLoggingOut = true;
      await signOut(auth);
      window.location.href = "../user/index.html";
    } catch (error) {
      console.error("Logout Error:", error);
    }
  });
}

onAuthStateChanged(auth, (user) => {
  if (!user && !isLoggingOut) {
    window.location.href = "../user/index.html";
  }
});
const scrollBtn = document.getElementById("scrollToAddBtn");

if (scrollBtn) {
  scrollBtn.addEventListener("click", () => {
    const addSection = document.getElementById("addStockForm");
    
    if (addSection) {
      addSection.scrollIntoView({
        behavior: "smooth"
      });
    }
  });
}
/* ===============================
   EXCEL EXPORT
================================ */

// Make sure SheetJS CDN is added in HTML before admin.js:
// <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>

const exportBtn = document.getElementById("exportExcelAdmin");

if (exportBtn) {
  exportBtn.addEventListener("click", exportTableToExcel);
}

function exportTableToExcel() {
  const table = document.getElementById("stockTable");
  const workbook = XLSX.utils.table_to_book(table, { sheet: "Stock Records" });
  XLSX.writeFile(workbook, "Stock_Records.xlsx");
}