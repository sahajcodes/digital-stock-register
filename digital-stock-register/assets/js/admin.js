import { db } from "./firebase.js";

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

let isLoggingOut = false;

/* ================================================
   SELECTORS
================================================ */

const form               = document.getElementById("addStockForm");
const tableBody          = document.getElementById("stockTableBody");
const filterLab          = document.getElementById("filterLab");
const filterItemTypeGroup= document.getElementById("filterItemTypeGroup");
const filterItemType     = document.getElementById("filterItemType");
const labSelect          = document.getElementById("labName");
const itemTypeGroup      = document.getElementById("itemTypeGroup");
const itemTypeSelect     = document.getElementById("itemType");
const searchInput        = document.getElementById("searchInput");
const noResults          = document.getElementById("noResults");
const totalItemsEl       = document.getElementById("totalItems");
const availableItemsEl   = document.getElementById("availableItems");
const notAvailableItemsEl= document.getElementById("notAvailableItems");

/* ================================================
   CHEMISTRY LAB → SHOW / HIDE ITEM TYPE (ADD FORM)
================================================ */

labSelect.addEventListener("change", function () {
  if (this.value === "Chemistry Lab") {
    itemTypeGroup.classList.add("show");
  } else {
    itemTypeGroup.classList.remove("show");
    itemTypeSelect.value = "";
  }
});

/* ================================================
   HELPER — CALCULATE FINAL QUANTITY
   Returns: { finalQty, status }
================================================ */

function calcQuantity(originalQty, brokenConsumed) {
  const final = Math.max(0, originalQty - brokenConsumed);
  const status = final > 0 ? "Available" : "Not Available";
  return { finalQty: final, status };
}

/* ================================================
   ADD NEW STOCK
================================================ */

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const labName        = labSelect.value;
  const equipmentName  = document.getElementById("equipmentName").value.trim();
  const billNumber     = document.getElementById("billNumber").value.trim();
  const billDate       = document.getElementById("billDate").value;
  const itemType       = itemTypeSelect.value || "-";

  const originalQuantity = parseInt(document.getElementById("quantity").value) || 0;
  const brokenConsumed   = parseInt(document.getElementById("brokenConsumed").value) || 0;

  // Guard: brokenConsumed cannot exceed originalQuantity
  if (brokenConsumed > originalQuantity) {
    alert("Broken / Consumed cannot be greater than Quantity.");
    return;
  }

  const { finalQty, status } = calcQuantity(originalQuantity, brokenConsumed);

  try {
    await addDoc(collection(db, "stock"), {
      labName,
      equipmentName,
      originalQuantity,
      brokenConsumed,
      quantity: finalQty,
      billNumber,
      billDate,
      itemType,
      status,
      lastUpdated: serverTimestamp()
    });

    form.reset();
    itemTypeGroup.classList.remove("show");
    showPopup("addSuccessPopup");

  } catch (error) {
    console.error("Error adding document:", error);
  }
});

/* ================================================
   REAL-TIME TABLE RENDERING
   Column order:
   1 Lab Name | 2 Equipment Name | 3 Quantity |
   4 Broken/Consumed | 5 Bill No | 6 Bill Date |
   7 Status | 8 Last Updated | 9 Actions
================================================ */

let unsubscribe = null;

function loadStock(selectedLab = "All") {
  if (unsubscribe) unsubscribe();

  const q = selectedLab === "All" || selectedLab === "-"
    ? collection(db, "stock")
    : query(collection(db, "stock"), where("labName", "==", selectedLab));

  unsubscribe = onSnapshot(q, (snapshot) => {
    tableBody.innerHTML = "";

    snapshot.forEach((docSnapshot) => {
      const stock  = docSnapshot.data();
      const docId  = docSnapshot.id;

      const formattedDate = stock.lastUpdated
        ? new Date(stock.lastUpdated.seconds * 1000).toLocaleString("en-IN")
        : "-";

      const statusClass = stock.status === "Available"
        ? "status-available"
        : "status-unavailable";

      const row = document.createElement("tr");
      row.dataset.itemtype = stock.itemType || "";

      row.innerHTML = `
        <td>${stock.labName         || "-"}</td>
        <td>${stock.equipmentName   || "-"}</td>
        <td>${stock.quantity        ?? "-"}</td>
        <td>${stock.brokenConsumed  ?? "0"}</td>
        <td>${stock.billNumber      || "-"}</td>
        <td>${stock.billDate        || "-"}</td>
        <td><span class="${statusClass}">${stock.status || "-"}</span></td>
        <td>${formattedDate}</td>
        <td class="action-btns">
          <button class="edit-btn btn-edit"   data-id="${docId}">Edit</button>
          <button class="delete-btn btn-delete" data-id="${docId}">Delete</button>
        </td>
      `;

      tableBody.appendChild(row);
    });

    applySearchFilter();
  });
}

// Initial load
loadStock();

/* ================================================
   FILTER — LAB DROPDOWN
================================================ */

filterLab.addEventListener("change", (e) => {
  const val = e.target.value;
  loadStock(val === "-" ? "All" : val);

  if (val === "Chemistry Lab") {
    filterItemTypeGroup.classList.add("show");
  } else {
    filterItemTypeGroup.classList.remove("show");
    if (filterItemType) filterItemType.value = "All";
  }
});

/* ================================================
   SEARCH + ITEM TYPE FILTER + STATS CARDS
   Status is in column index 6 (0-based)
================================================ */

function applySearchFilter() {
  const searchVal    = searchInput ? searchInput.value.toLowerCase().trim() : "";
  const selectedType = (filterItemType && filterItemType.value) ? filterItemType.value : "All";

  const rows = tableBody.querySelectorAll("tr");

  let total       = 0;
  let available   = 0;
  let notAvail    = 0;
  let matchFound  = false;

  rows.forEach((row) => {
    row.classList.remove("highlight-row");

    const text     = row.innerText.toLowerCase();
    const itemType = row.dataset.itemtype || "";

    const searchMatch = searchVal === "" || text.includes(searchVal);
    const typeMatch   = selectedType === "All" || selectedType === "" || itemType === selectedType;

    if (searchMatch && typeMatch) {
      row.style.display = "";

      if (searchVal !== "") row.classList.add("highlight-row");

      matchFound = true;
      total++;

      // Status is in the 7th <td> (index 6)
      const statusText = row.children[6]
        ? row.children[6].innerText.trim()
        : "";

      if (statusText === "Available") {
        available++;
      } else {
        notAvail++;
      }

    } else {
      row.style.display = "none";
    }
  });

  if (totalItemsEl)        totalItemsEl.innerText        = total;
  if (availableItemsEl)    availableItemsEl.innerText    = available;
  if (notAvailableItemsEl) notAvailableItemsEl.innerText = notAvail;

  if (noResults) {
    noResults.style.display = (!matchFound && searchVal !== "") ? "block" : "none";
  }
}

if (searchInput)    searchInput.addEventListener("input", applySearchFilter);
if (filterItemType) filterItemType.addEventListener("change", applySearchFilter);

/* ================================================
   DELETE — with slide-out animation
================================================ */

tableBody.addEventListener("click", async (e) => {
  if (!e.target.classList.contains("delete-btn")) return;

  const deleteId = e.target.getAttribute("data-id");
  const row      = e.target.closest("tr");

  const confirmPopup = document.getElementById("deleteConfirmPopup");
  if (confirmPopup) confirmPopup.style.display = "flex";

  const confirmBtn = document.getElementById("confirmDeleteBtn");
  const cancelBtn  = document.getElementById("cancelDeleteBtn");

  // One-time listeners to avoid stacking
  const handleConfirm = async () => {
    confirmPopup.style.display = "none";
    row.style.opacity    = "0";
    row.style.transform  = "translateX(40px)";
    row.style.transition = "0.4s";

    setTimeout(async () => {
      try {
        await deleteDoc(doc(db, "stock", deleteId));
        showPopup("deleteSuccessPopup");
      } catch (err) {
        console.error("Delete error:", err);
      }
    }, 400);

    confirmBtn.removeEventListener("click", handleConfirm);
    cancelBtn.removeEventListener("click", handleCancel);
  };

  const handleCancel = () => {
    confirmPopup.style.display = "none";
    confirmBtn.removeEventListener("click", handleConfirm);
    cancelBtn.removeEventListener("click", handleCancel);
  };

  if (confirmBtn) confirmBtn.addEventListener("click", handleConfirm);
  if (cancelBtn)  cancelBtn.addEventListener("click", handleCancel);
});

/* ================================================
   EDIT — Modal-based
   Edits: brokenConsumed
   Recalculates: quantity, status
================================================ */

let currentEditId       = null;
let currentOriginalQty  = 0;

const editModal          = document.getElementById("editModal");
const editQuantityInput  = document.getElementById("editQuantity");
const editBrokenInput    = document.getElementById("editBrokenConsumed");
const saveEditBtn        = document.getElementById("saveEdit");
const cancelEditBtn      = document.getElementById("cancelEdit");

tableBody.addEventListener("click", (e) => {
  if (!e.target.classList.contains("edit-btn")) return;

  currentEditId = e.target.getAttribute("data-id");
  const row     = e.target.closest("tr");

  // Read current values from the rendered row
  const currentQty     = parseInt(row.children[2].innerText) || 0;
  const currentBroken  = parseInt(row.children[3].innerText) || 0;

  // Reconstruct originalQuantity = quantity + brokenConsumed
  currentOriginalQty = currentQty + currentBroken;

  if (editQuantityInput) editQuantityInput.value = currentOriginalQty;
  if (editBrokenInput)   editBrokenInput.value   = currentBroken;

  if (editModal) editModal.style.display = "flex";
});

if (saveEditBtn) {
  saveEditBtn.addEventListener("click", async () => {
    const newOriginalQty   = parseInt(editQuantityInput ? editQuantityInput.value : 0) || 0;
    const newBrokenConsumed= parseInt(editBrokenInput   ? editBrokenInput.value   : 0) || 0;

    if (newBrokenConsumed > newOriginalQty) {
      alert("Broken / Consumed cannot be greater than Quantity.");
      return;
    }

    const { finalQty, status } = calcQuantity(newOriginalQty, newBrokenConsumed);

    try {
      await updateDoc(doc(db, "stock", currentEditId), {
        originalQuantity: newOriginalQty,
        brokenConsumed:   newBrokenConsumed,
        quantity:         finalQty,
        status,
        lastUpdated: serverTimestamp()
      });

      if (editModal) editModal.style.display = "none";

    } catch (err) {
      console.error("Edit error:", err);
    }
  });
}

if (cancelEditBtn) {
  cancelEditBtn.addEventListener("click", () => {
    if (editModal) editModal.style.display = "none";
  });
}

// Close modal on backdrop click
if (editModal) {
  editModal.addEventListener("click", (e) => {
    if (e.target === editModal) editModal.style.display = "none";
  });
}

/* ================================================
   POPUP UTILITY
================================================ */

function showPopup(id, duration = 2000) {
  const popup = document.getElementById(id);
  if (!popup) return;
  popup.style.display = "flex";
  setTimeout(() => { popup.style.display = "none"; }, duration);
}

/* ================================================
   AUTH — Logout + Guard
================================================ */

const auth     = getAuth();
const logoutBtn= document.getElementById("logoutBtn");

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      isLoggingOut = true;
      showPopup("logoutPopup", 1500);
      await signOut(auth);
      setTimeout(() => {
        window.location.href = "../user/index.html";
      }, 1500);
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

/* ================================================
   SCROLL TO ADD FORM (FAB)
================================================ */

const scrollBtn = document.getElementById("scrollToAddBtn");

if (scrollBtn) {
  scrollBtn.addEventListener("click", () => {
    const addSection = document.getElementById("addStockForm");
    if (addSection) {
      addSection.scrollIntoView({ behavior: "smooth" });
    }
  });
}

/* ================================================
   EXCEL EXPORT
   Requires SheetJS: xlsx.full.min.js in HTML
================================================ */

const exportBtn = document.getElementById("exportExcelAdmin");

if (exportBtn) {
  exportBtn.addEventListener("click", exportTableToExcel);
}

function exportTableToExcel() {
  const table    = document.getElementById("stockTable");
  const workbook = XLSX.utils.table_to_book(table, { sheet: "Stock Records" });
  XLSX.writeFile(workbook, "Stock_Records.xlsx");
}
