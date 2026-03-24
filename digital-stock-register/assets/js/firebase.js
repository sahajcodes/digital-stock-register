import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs  } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// 👇 Yahan apna config paste karo
const firebaseConfig = {
  apiKey: "AIzaSyBWmTBhmAas8LB6FBSRf2f4yGArygXbvL0",
  authDomain: "digital-lab-stock-regist-c053a.firebaseapp.com",
  projectId: "digital-lab-stock-regist-c053a",
  storageBucket: "digital-lab-stock-regist-c053a.firebasestorage.app",
  messagingSenderId: "647267239813",
  appId: "1:647267239813:web:c094448da45190dcb4a6ec"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);


export const auth = getAuth(app);

// Collection reference
const stockCollection = collection(db, "stock");

// Data add function
window.addItemToDB = async function(lab, item, quantity, status) {

    await addDoc(stockCollection, {
        lab,
        item,
        quantity,
        status,
    });

    const popup = document.getElementById("itemSuccessPopup");

    if (popup) {
        popup.style.display = "flex";

        setTimeout(() => {
            popup.style.display = "none";
        }, 2000);
    }
};



// Data load function
window.loadStock = async function() {

    const snapshot = await getDocs(stockCollection);
    const tableBody = document.querySelector("tbody");

    tableBody.innerHTML = "";

    snapshot.forEach(doc => {
        const data = doc.data();

        tableBody.innerHTML += `
            <tr>
                <td>${data.lab}</td>
                <td>${data.item}</td>
                <td>${data.quantity}</td>
                <td>${data.status}</td>
            </tr>
        `;
    });
    // After table rows are loaded
if (window.filterTable) {
    window.filterTable();
}

};


// Auto load on start
loadStock();
const loginBtn = document.getElementById("loginBtn");

if (loginBtn) {
  loginBtn.addEventListener("click", async () => {

    const email = document.getElementById("adminEmail").value;
    const password = document.getElementById("adminPassword").value;

    try {
      await signOut(auth); // clear old session
    } catch (e) {}

    signInWithEmailAndPassword(auth, email, password)
      .then(() => {

        const successPopup = document.getElementById("successPopup");
        if (successPopup) {
          successPopup.style.display = "flex";
        }

        setTimeout(() => {
          window.location.href = "../admin/admin.html";
        }, 1500);

      })
      .catch(() => {

        const errorPopup = document.getElementById("errorPopup");
        const loginModal = document.getElementById("loginModal");

        if (loginModal) loginModal.style.display = "none";

        if (errorPopup) {
          errorPopup.style.display = "flex";

          setTimeout(() => {
            errorPopup.style.display = "none";
            if (loginModal) loginModal.style.display = "flex";
          }, 2000);
        }

      });

  });
}
