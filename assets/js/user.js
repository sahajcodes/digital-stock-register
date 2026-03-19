import { db } from "./firebase.js";
import { collection, onSnapshot } 
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const tableBody = document.querySelector("tbody");
const emptyRow = document.getElementById("emptyRow");

/* ==============================
   REALTIME DATA LOAD
============================== */

onSnapshot(collection(db, "stock"), (snapshot) => {

  tableBody.querySelectorAll("tr:not(#emptyRow)").forEach(row => row.remove());

  snapshot.forEach((doc) => {

    const data = doc.data();
    const row = document.createElement("tr");

    row.dataset.itemtype = data.itemType || "";

    row.innerHTML = `
      <td>${data.labName || "-"}</td>
      <td>${data.equipmentName || "-"}</td>
      <td>${data.quantity ?? "-"}</td>
      <td>
  ${Number(data.quantity) === 0 
    ? `<span class="status-not">Not Available</span>`
    : `<span class="status-available">Available</span>`
   }
   </td>
    `;

    tableBody.appendChild(row);
  });

  if (window.filterTable) {
    window.filterTable();
  }

});


/* ==============================
   DOM READY
============================== */

document.addEventListener("DOMContentLoaded", function () {

  const labFilter = document.getElementById("labFilter");
  const typeFilter = document.getElementById("userItemType");
  const itemTypeGroup = document.getElementById("userItemTypeGroup");
  const searchInput = document.getElementById("search-item");

  /* ==============================
     SHOW / HIDE ITEM TYPE
  ============================== */

  labFilter.addEventListener("change", () => {

    if (labFilter.value === "Chemistry Lab") {
      itemTypeGroup.style.display = "block";
    } else {
      itemTypeGroup.style.display = "none";
      typeFilter.value = "All";
    }

    window.filterTable();
  });

  /* 🔥 FIXED SEARCH LISTENER */
  searchInput.addEventListener("keyup", function () {
    window.filterTable();
  });
  typeFilter.addEventListener("change",function(){ window.filterTable(); });

  /* ==============================
     FILTER FUNCTION
  ============================== */

  window.filterTable = function () {

    const selectedLab = labFilter.value.trim();
    const selectedType = typeFilter.value.trim();
    const searchValue = searchInput.value.trim().toLowerCase();
    const rows = document.querySelectorAll("tbody tr");

    let visibleCount = 0;

    rows.forEach(row => {

      if (row.id === "emptyRow") return;

      const labName = row.children[0].textContent.trim();
      const equipmentName = row.children[1].textContent.trim().toLowerCase();
      const itemType = (row.dataset.itemtype || "").trim();

      const labMatch =
        selectedLab === "All" || labName === selectedLab;

      const typeMatch =
        selectedType === "All" || selectedType === "" || itemType === selectedType;

      const searchMatch =
        equipmentName.includes(searchValue);

      if (labMatch && typeMatch && searchMatch) {

        row.style.display = "";
        visibleCount++;

        if (searchValue !== "") {
          row.classList.add("highlight-row");
        } else {
          row.classList.remove("highlight-row");
        }

      } else {
        row.style.display = "none";
        row.classList.remove("highlight-row");
      }

    });

    if (visibleCount === 0) {
      emptyRow.style.display = "";
    } else {
      emptyRow.style.display = "none";
    }
    
  };


  /* ==============================
     LOGIN MODAL
  ============================== */

  const loginModal = document.getElementById("loginModal");
  const adminLoginBtn = document.querySelector(".admin-btn");
  const closeLogin = document.getElementById("closeLogin");
  const loginBtn = document.getElementById("loginBtn");

  adminLoginBtn.addEventListener("click", () => {
    loginModal.style.display = "flex";
  });

  closeLogin.addEventListener("click", () => {
    loginModal.style.display = "none";
  });

  loginBtn.addEventListener("click", () => {
    const email = document.getElementById("adminEmail").value;
    const password = document.getElementById("adminPassword").value;
    loginAdmin(email, password);
  });

});

const exportCsvBtn = document.getElementById("exportCsvBtn");

if (exportCsvBtn) {
  exportCsvBtn.addEventListener("click", () => {

    const table = document.querySelector(".modern-table");
    const rows = table.querySelectorAll("tr");

    let data = [];

    rows.forEach(row => {

      // Skip hidden rows (important for filters)
      if (row.style.display === "none") return;

      const cols = row.querySelectorAll("th, td");
      let rowData = [];

      cols.forEach(col => {
        rowData.push(col.innerText.trim());
      });

      data.push(rowData);
    });

    if (data.length === 0) {
      alert("No data available to export.");
      return;
    }

    // Create worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(data);

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Stock Records");

    // Download Excel file
    XLSX.writeFile(workbook, "stock_records.xlsx");
  });
}