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

// Global Cart State
let cart = [];
let selectedProduct = null;

// Default Catalog Products
const defaultProducts = [
  {
    id: "p1",
    name: "Classic Visiting Cards",
    description: "Premium 350 GSM matte & glossy finished business cards.",
    price: 299,
    imageUrl: "saya-art-advertising-logo.jpg"
  },
  {
    id: "p2",
    name: "Custom Vinyl Stickers",
    description: "Waterproof, durable die-cut vinyl stickers for product packaging.",
    price: 249,
    imageUrl: "saya-art-advertising-logo.jpg"
  },
  {
    id: "p3",
    name: "Promotional Flyers & Pamphlets",
    description: "Vibrant high-resolution paper flyers for promotions.",
    price: 499,
    imageUrl: "saya-art-advertising-logo.jpg"
  },
  {
    id: "p4",
    name: "Personalized Ceramic Mug",
    description: "Custom printed 325ml coffee mug with custom logo.",
    price: 349,
    imageUrl: "saya-art-advertising-logo.jpg"
  }
];

// 1. Load Products Catalog
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
    console.error("Firestore Catalog Load Error:", err);
  }

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

// 2. Open Customizer Modal
window.openProductCustomizer = function(name, price) {
  selectedProduct = { name, price };
  const modal = document.getElementById('productModal');
  if (modal) {
    document.getElementById('customTitle').innerText = name;
    document.getElementById('customPrice').innerText = "₹" + price;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
  }
};

// Add to Bag Button Event Listener
const addCustomBtn = document.getElementById('addCustomProduct');
if (addCustomBtn) {
  addCustomBtn.onclick = () => {
    if (!selectedProduct) return;
    
    const qty = Number(document.getElementById('quantity')?.value || 100);
    const text = document.getElementById('customText')?.value || '';
    
    const cartItem = {
      name: selectedProduct.name,
      price: selectedProduct.price,
      quantity: qty,
      customText: text,
      totalPrice: selectedProduct.price
    };

    cart.push(cartItem);
    updateCartUI();

    // Close Customizer Modal and Open Cart Drawer
    closeModal('productModal');
    openDrawer('cartDrawer');
  };
}

// Cart Drawer Management
function updateCartUI() {
  const cartCount = document.getElementById('cartCount');
  const cartItemsContainer = document.getElementById('cartItems');
  const cartTotal = document.getElementById('cartTotal');

  if (cartCount) cartCount.innerText = cart.length;

  if (cartItemsContainer) {
    if (cart.length === 0) {
      cartItemsContainer.innerHTML = "<p style='padding:15px; color:#777;'>Your bag is empty.</p>";
      if (cartTotal) cartTotal.innerText = "₹0";
      return;
    }

    let subtotal = 0;
    cartItemsContainer.innerHTML = cart.map((item, index) => {
      subtotal += item.totalPrice;
      return `
        <div style="border-bottom:1px solid #eee; padding:10px 0; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <b>${item.name}</b> (${item.quantity} pcs)<br>
            <small style="color:#666;">${item.customText ? 'Text: ' + item.customText : ''}</small>
            <div style="color:#27ae60; font-weight:bold; margin-top:4px;">₹${item.totalPrice}</div>
          </div>
          <button onclick="removeFromCart(${index})" style="background:none; border:none; color:red; cursor:pointer; font-size:18px;">×</button>
        </div>
      `;
    }).join('');

    if (cartTotal) cartTotal.innerText = "₹" + subtotal;
  }
}

window.removeFromCart = function(index) {
  cart.splice(index, 1);
  updateCartUI();
};

// 3. Checkout Button & Modal Flow
const checkoutBtn = document.getElementById('checkoutButton');
if (checkoutBtn) {
  checkoutBtn.onclick = () => {
    if (cart.length === 0) {
      alert("Your bag is empty. Please add a product first!");
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      alert("Please login via Mobile OTP in Profile section before placing order!");
      closeDrawer('cartDrawer');
      openDrawer('profileDrawer');
      return;
    }

    // Prefill user details if logged in
    const phoneInput = document.getElementById('custPhone');
    if (phoneInput && user.phoneNumber) phoneInput.value = user.phoneNumber;

    closeDrawer('cartDrawer');
    openModal('checkoutModal');
  };
}

// 4. Submit Order Form & Process Payment
const checkoutForm = document.getElementById('checkoutForm');
if (checkoutForm) {
  checkoutForm.onsubmit = async (e) => {
    e.preventDefault();
    const user = auth.currentUser;

    const name = document.getElementById('custName').value;
    const phone = document.getElementById('custPhone').value;
    const email = document.getElementById('custEmail').value;
    const address = document.getElementById('custAddress').value;

    const totalAmount = cart.reduce((sum, item) => sum + item.totalPrice, 0);
    const itemNames = cart.map(i => i.name).join(', ');

    // Trigger Razorpay Payment Gateway
    const options = {
      "key": "rzp_test_YOUR_KEY_HERE",
      "amount": totalAmount * 100,
      "currency": "INR",
      "name": "Saya Art & Advertising",
      "description": itemNames,
      "handler": async function (response) {
        try {
          await addDoc(collection(db, "orders"), {
            orderId: "ORD-" + Math.floor(100000 + Math.random() * 900000),
            paymentId: response.razorpay_payment_id,
            customerName: name,
            customerPhone: phone || user?.phoneNumber,
            customerEmail: email,
            deliveryAddress: address,
            itemName: itemNames,
            amount: totalAmount,
            paymentStatus: "PAID",
            createdAt: new Date().toLocaleString()
          });

          alert("Order Placed Successfully!");
          cart = [];
          updateCartUI();
          closeModal('checkoutModal');

          if (user?.phoneNumber) {
            loadCustomerOrders(user.phoneNumber);
          }
        } catch (err) {
          alert("Error saving order: " + err.message);
        }
      },
      "prefill": {
        "name": name,
        "email": email,
        "contact": phone
      },
      "theme": { "color": "#27ae60" }
    };

    const rzp = new Razorpay(options);
    rzp.open();
  };
}

// Helper Modal & Drawer Functions
function openModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.add('active'); m.setAttribute('aria-hidden', 'false'); }
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.remove('active'); m.setAttribute('aria-hidden', 'true'); }
}
function openDrawer(id) {
  const d = document.getElementById(id);
  if (d) { d.classList.add('active'); d.setAttribute('aria-hidden', 'false'); }
}
function closeDrawer(id) {
  const d = document.getElementById(id);
  if (d) { d.classList.remove('active'); d.setAttribute('aria-hidden', 'true'); }
}

// Header Navigation Buttons
const openProfileBtn = document.getElementById('openProfile');
if (openProfileBtn) openProfileBtn.onclick = () => openDrawer('profileDrawer');

const openCartBtn = document.getElementById('openCart');
if (openCartBtn) openCartBtn.onclick = () => openDrawer('cartDrawer');

document.querySelectorAll('[data-close]').forEach(btn => {
  btn.onclick = (e) => {
    const targetId = e.target.getAttribute('data-close');
    closeModal(targetId);
    closeDrawer(targetId);
  };
});

// 5. Auth State & Order History Tracking
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

// Initial Load Trigger
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadProducts);
} else {
  loadProducts();
}
