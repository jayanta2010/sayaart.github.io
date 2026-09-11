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

// Default Products List
const defaultProducts = [
  {
    id: "p1",
    name: "Classic Visiting Cards",
    description: "Premium 350 GSM matte & glossy finished business cards for a lasting impression.",
    price: 299,
    imageUrl: "saya-art-advertising-logo.jpg"
  },
  {
    id: "p2",
    name: "Custom Vinyl Stickers",
    description: "Waterproof, durable die-cut vinyl stickers for product packaging and personal branding.",
    price: 249,
    imageUrl: "saya-art-advertising-logo.jpg"
  },
  {
    id: "p3",
    name: "Promotional Flyers & Pamphlets",
    description: "Vibrant high-resolution paper flyers to promote your events, business, and special offers.",
    price: 499,
    imageUrl: "saya-art-advertising-logo.jpg"
  },
  {
    id: "p4",
    name: "Personalized Ceramic Mug",
    description: "Custom printed 325ml coffee mug with your custom logo, photos, or personalized text.",
    price: 349,
    imageUrl: "saya-art-advertising-logo.jpg"
  }
];

// Load and Render Products
async function loadProducts() {
  const container = document.getElementById('productGrid');
  if (!container) return;

  let allProducts = [];

  try {
    const snap = await getDocs(collection(db, "products"));
    if (!snap.empty) {
      snap.forEach(doc => {
        const item = doc.data();
        allProducts.push({
          id: doc.id,
          name: item.name || "Custom Product",
          description: item.description || "High-quality print finish.",
          price: Number(item.price) || 0,
          imageUrl: item.imageUrl || "saya-art-advertising-logo.jpg"
        });
      });
    }
  } catch (err) {
    console.error("Firestore Error:", err);
  }

  // Combine Firestore products with default catalog
  allProducts = [...allProducts, ...defaultProducts];

  container.style.display = "grid";
  container.style.gridTemplateColumns = "repeat(auto-fill, minmax(240px, 1fr))";
  container.style.gap = "20px";

  container.innerHTML = allProducts.map(p => `
    <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; background: #ffffff; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
      <div>
        <img src="${p.imageUrl}" alt="${p.name}" style="width: 100%; height: 160px; object-fit: cover; border-radius: 6px; margin-bottom: 12px;" onerror="this.src='saya-art-advertising-logo.jpg'">
        <h3 style="font-size: 16px; font-weight: 700; margin: 0 0 6px 0; color: #1e293b;">${p.name}</h3>
        <p style="font-size: 13px; color: #64748b; margin: 0 0 14px 0; line-height: 1.4;">${p.description}</p>
      </div>
      <div>
        <div style="font-size: 18px; font-weight: 800; color: #16a34a; margin-bottom: 10px;">₹${p.price}</div>
        <button class="primary-button full" onclick="openProductCustomizer('${p.name}', ${p.price})">Customise & Buy →</button>
      </div>
    </div>
  `).join('');
}

window.openProductCustomizer = function(name, price) {
  const modal = document.getElementById('productModal');
  if (modal) {
    document.getElementById('customTitle').innerText = name;
    document.getElementById('customPrice').innerText = "₹" + price;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
  }
};

// Profile Drawer Logic
const profileDrawer = document.getElementById('profileDrawer');
const openProfileBtn = document.getElementById('openProfile');
if (openProfileBtn && profileDrawer) {
  openProfileBtn.onclick = () => profileDrawer.classList.add('active');
}

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

// Auth Listener & Previous Orders
onAuthStateChanged(auth, (user) => {
  const loggedOutState = document.getElementById('loggedOutState');
  const loggedInState = document.getElementById('loggedInState');
  const userPhoneDisplay = document.getElementById('userPhoneDisplay');

  if (user) {
    if (loggedOutState) loggedOutState.style.display = 'none';
    if (loggedInState) loggedInState.style.display = 'block';
    if (userPhoneDisplay) userPhoneDisplay.innerText = user.phoneNumber;
    loadCustomerOrders(user.phoneNumber);
  } else {
    if (loggedOutState) loggedOutState.style.display = 'block';
    if (loggedInState) loggedInState.style.display = 'none';
  }
});

function initRecaptcha() {
  if (!window.sideRecaptcha) {
    window.sideRecaptcha = new RecaptchaVerifier(auth, 'side-recaptcha-container', { 'size': 'invisible' });
  }
}

const sendOtpBtn = document.getElementById('sendSideOtpBtn');
if (sendOtpBtn) {
  sendOtpBtn.onclick = () => {
    const phone = document.getElementById('sidePhoneInput').value;
    if (!phone.startsWith('+91') || phone.length < 13) {
      alert("Enter valid mobile number with +91");
      return;
    }
    initRecaptcha();
    signInWithPhoneNumber(auth, phone, window.sideRecaptcha)
      .then((res) => {
        window.confirmationResult = res;
        document.getElementById('sidePhoneStep').style.display = 'none';
        document.getElementById('sideOtpStep').style.display = 'block';
        alert("OTP Sent!");
      })
      .catch((err) => alert("OTP Error: " + err.message));
  };
}

const verifyOtpBtn = document.getElementById('verifySideOtpBtn');
if (verifyOtpBtn) {
  verifyOtpBtn.onclick = () => {
    const otp = document.getElementById('sideOtpInput').value;
    window.confirmationResult.confirm(otp)
      .then(() => alert("Login Successful!"))
      .catch(() => alert("Invalid OTP!"));
  };
}

const logoutBtn = document.getElementById('logoutUserBtn');
if (logoutBtn) {
  logoutBtn.onclick = () => {
    signOut(auth).then(() => location.reload());
  };
}

async function loadCustomerOrders(phone) {
  const container = document.getElementById('userOrdersList');
  if (!container) return;
  try {
    const q = query(collection(db, "orders"), where("customerPhone", "==", phone));
    const snap = await getDocs(q);
    if (snap.empty) {
      container.innerHTML = "<p style='font-size:12px; color:#666;'>No previous orders found.</p>";
      return;
    }
    container.innerHTML = "";
    snap.forEach((doc) => {
      const o = doc.data();
      container.innerHTML += `
        <div style="border-bottom:1px solid #eee; padding:8px 0;">
          <b>${o.itemName || 'Printed Item'}</b> - ₹${o.amount}<br>
          <small style="color:#777;">Order ID: ${o.orderId || doc.id}</small><br>
          <span style="color:${o.paymentStatus === 'PAID' ? 'green' : 'orange'}; font-weight:bold; font-size:11px;">${o.paymentStatus || 'PAID'}</span>
        </div>
      `;
    });
  } catch(e) {
    container.innerHTML = "<p style='font-size:12px; color:red;'>Failed to load orders.</p>";
  }
}

// Immediate execution trigger
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadProducts);
} else {
  loadProducts();
}
