import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyC6CxokC0KwAtP9EMilEQHMJQKWCgLWYJc",
  authDomain: "sayaart.firebaseapp.com",
  projectId: "sayaart",
  storageBucket: "sayaart.firebasestorage.app",
  messagingSenderId: "805892692460",
  appId: "1:805892692460:web:417ef9926bbc01d9f288c9",
  measurementId: "G-S3CKT4LP6T"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// 1. Fetch & Display Products from Firebase
async function loadProducts() {
  const container = document.getElementById('productGrid');
  if (!container) return;
  container.innerHTML = "<p>Loading products...</p>";

  try {
    const querySnapshot = await getDocs(collection(db, "products"));
    if (querySnapshot.empty) {
      container.innerHTML = "<p>No products available right now.</p>";
      return;
    }

    let html = "";
    querySnapshot.forEach((doc) => {
      const p = doc.data();
      html += `
        <div style="border:1px solid #ddd; padding:15px; border-radius:8px; width:220px; background:white; text-align:center;">
          <img src="${p.imageUrl || 'saya-art-advertising-logo.jpg'}" style="width:100%; height:150px; object-fit:cover; border-radius:4px;">
          <h3 style="font-size:16px; margin:10px 0 5px;">${p.name}</h3>
          <p style="font-weight:bold; color:#27ae60; margin-bottom:10px;">₹${p.price}</p>
          <button onclick="startCheckout('${p.name}', ${p.price})" style="width:100%; padding:8px; background:#27ae60; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">Buy Now</button>
        </div>
      `;
    });
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = "<p>Error loading products.</p>";
    console.error(err);
  }
}

// 2. Profile Sidebar Logic
const sidebar = document.getElementById('profileSidebar');
const overlay = document.getElementById('sidebarOverlay');

document.getElementById('openProfileBtn').onclick = () => {
  sidebar.classList.add('active');
  overlay.classList.add('active');
};
document.getElementById('closeProfileBtn').onclick = closeSidebar;
overlay.onclick = closeSidebar;

function closeSidebar() {
  sidebar.classList.remove('active');
  overlay.classList.remove('active');
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    document.getElementById('profileName').innerText = "Verified Customer";
    document.getElementById('profilePhone').innerText = user.phoneNumber || "Logged In";
    document.getElementById('avatarText').innerText = "✓";
    document.getElementById('logoutUserBtn').style.display = 'block';
  } else {
    document.getElementById('profileName').innerText = "Guest User";
    document.getElementById('profilePhone').innerText = "Not Logged In";
    document.getElementById('avatarText').innerText = "👤";
    document.getElementById('logoutUserBtn').style.display = 'none';
  }
});

document.getElementById('logoutUserBtn').onclick = () => {
  signOut(auth).then(() => location.reload());
};

// 3. Checkout Modal & OTP Logic
window.startCheckout = function(itemName, price) {
  window.selectedItem = { name: itemName, price: price };
  document.getElementById('checkoutModal').style.display = 'flex';
  initRecaptcha();
};

document.querySelectorAll('.modal-close').forEach(btn => {
  btn.onclick = () => document.getElementById('checkoutModal').style.display = 'none';
});

function initRecaptcha() {
  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      'size': 'invisible'
    });
  }
}

document.getElementById('sendOtpBtn').onclick = () => {
  const phone = document.getElementById('custPhone').value;
  if (!phone.startsWith('+91') || phone.length < 13) {
    alert("Enter valid number starting with +91");
    return;
  }

  initRecaptcha();
  signInWithPhoneNumber(auth, phone, window.recaptchaVerifier)
    .then((result) => {
      window.confirmationResult = result;
      document.getElementById('phone-step').style.display = 'none';
      document.getElementById('otp-step').style.display = 'block';
      alert("OTP Sent to " + phone);
    })
    .catch((err) => alert("OTP Error: " + err.message));
};

document.getElementById('verifyPayBtn').onclick = () => {
  const otp = document.getElementById('otpInput').value;
  window.confirmationResult.confirm(otp)
    .then(() => {
      openRazorpay();
    })
    .catch(() => alert("Invalid OTP!"));
};

// 4. Razorpay Integration & Complete Order Details Storage
function openRazorpay() {
  const name = document.getElementById('custName').value;
  const address = document.getElementById('custAddress').value;
  const phone = document.getElementById('custPhone').value;

  const options = {
    "key": "rzp_test_YOUR_KEY_HERE", // Replace with your Razorpay Key
    "amount": window.selectedItem.price * 100,
    "currency": "INR",
    "name": "Saya Art & Advertising",
    "description": window.selectedItem.name,
    "handler": async function (response) {
      try {
        await addDoc(collection(db, "orders"), {
          orderId: "ORD-" + Math.floor(100000 + Math.random() * 900000),
          paymentId: response.razorpay_payment_id,
          customerName: name,
          customerPhone: phone,
          deliveryAddress: address,
          itemName: window.selectedItem.name,
          amount: window.selectedItem.price,
          paymentStatus: "PAID",
          createdAt: new Date().toLocaleString()
        });
        alert("Payment Successful! Order Placed.");
        location.reload();
      } catch (err) {
        alert("Order Save Error: " + err.message);
      }
    },
    "prefill": { "name": name, "contact": phone },
    "theme": { "color": "#27ae60" }
  };

  const rzp = new Razorpay(options);
  rzp.open();
}

document.addEventListener('DOMContentLoaded', loadProducts);
