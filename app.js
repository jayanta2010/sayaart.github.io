import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, query, where } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyC6CxokC0KwAtP9EMilEQHMJQKWCgLWYJc",
  authDomain: "sayaart.firebaseapp.com",
  projectId: "sayaart",
  storageBucket: "sayaart.firebasestorage.app",
  messagingSenderId: "805892692460",
  appId: "1:805892692460:web:417ef9926bbc01d9f288c9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Drawer Open/Close Logic
const profileDrawer = document.getElementById('profileDrawer');
document.getElementById('openProfile').onclick = () => profileDrawer.classList.add('active');

document.querySelectorAll('[data-close]').forEach(btn => {
  btn.onclick = (e) => {
    const targetId = e.target.getAttribute('data-close');
    const target = document.getElementById(targetId);
    if (target) {
      target.classList.remove('active');
      target.setAttribute('aria-hidden', 'true');
    }
  };
});

// Auth State & Previous Orders
onAuthStateChanged(auth, (user) => {
  if (user) {
    document.getElementById('loggedOutState').style.display = 'none';
    document.getElementById('loggedInState').style.display = 'block';
    document.getElementById('userPhoneDisplay').innerText = user.phoneNumber;
    loadCustomerOrders(user.phoneNumber);
  } else {
    document.getElementById('loggedOutState').style.display = 'block';
    document.getElementById('loggedInState').style.display = 'none';
  }
});

// Phone OTP Login
function initRecaptcha() {
  if (!window.sideRecaptcha) {
    window.sideRecaptcha = new RecaptchaVerifier(auth, 'side-recaptcha-container', { 'size': 'invisible' });
  }
}

document.getElementById('sendSideOtpBtn').onclick = () => {
  const phone = document.getElementById('sidePhoneInput').value;
  if (!phone.startsWith('+91') || phone.length < 13) {
    alert("Please enter valid mobile number with +91");
    return;
  }
  initRecaptcha();
  signInWithPhoneNumber(auth, phone, window.sideRecaptcha)
    .then((res) => {
      window.confirmationResult = res;
      document.getElementById('sidePhoneStep').style.display = 'none';
      document.getElementById('sideOtpStep').style.display = 'block';
      alert("OTP Sent to " + phone);
    })
    .catch((err) => alert("OTP Error: " + err.message));
};

document.getElementById('verifySideOtpBtn').onclick = () => {
  const otp = document.getElementById('sideOtpInput').value;
  window.confirmationResult.confirm(otp)
    .then(() => alert("Login Successful!"))
    .catch(() => alert("Invalid OTP!"));
};

document.getElementById('logoutUserBtn').onclick = () => {
  signOut(auth).then(() => location.reload());
};

async function loadCustomerOrders(phone) {
  const container = document.getElementById('userOrdersList');
  try {
    const q = query(collection(db, "orders"), where("customerPhone", "==", phone));
    const snap = await getDocs(q);
    if (snap.empty) {
      container.innerHTML = "<p style='font-size:12px; color:#666;'>No orders found.</p>";
      return;
    }
    container.innerHTML = "";
    snap.forEach((doc) => {
      const o = doc.data();
      container.innerHTML += `
        <div style="border-bottom:1px solid #eee; padding:8px 0;">
          <b>${o.itemName || 'Printed Order'}</b> - ₹${o.amount}<br>
          <small style="color:#777;">Date: ${o.createdAt || 'N/A'}</small><br>
          <span style="color:${o.paymentStatus === 'PAID' ? 'green' : 'orange'}; font-weight:bold; font-size:11px;">${o.paymentStatus || 'PAID'}</span>
        </div>
      `;
    });
  } catch(e) {
    container.innerHTML = "<p style='font-size:12px; color:red;'>Failed to load orders.</p>";
  }
}
