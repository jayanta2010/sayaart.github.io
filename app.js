import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, query, where } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

// Firebase Configuration
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

// State Variables
let cart = JSON.parse(localStorage.getItem('saya_cart') || '[]');
let allProductsList = [];
let selectedProduct = null;
let autoDetectedLocation = "";

// Save Cart to LocalStorage
function saveCart() {
  localStorage.setItem('saya_cart', JSON.stringify(cart));
  updateCartUI();
}

// 1. Load Products ONLY from Firebase Database (No hardcoded items)
async function loadProducts() {
  const container = document.getElementById('productGrid');
  if (!container) return;

  let dbProducts = [];
  try {
    const snap = await getDocs(collection(db, "products"));
    if (!snap.empty) {
      snap.forEach(docSnap => {
        const item = docSnap.data();
        dbProducts.push({
          id: docSnap.id,
          name: item.name || "Custom Product",
          description: item.description || "High-quality print finish.",
          price: Number(item.price) || 0,
          imageUrl: item.imageUrl || "saya-art-advertising-logo.jpg"
        });
      });
    }
  } catch (err) {
    console.error("Error loading products from Firebase:", err);
  }

  allProductsList = dbProducts;
  renderProducts(allProductsList);
}

// 2. Render Products Grid
function renderProducts(products) {
  const container = document.getElementById('productGrid');
  if (!container) return;

  if (products.length === 0) {
    container.innerHTML = `<p style="grid-column: 1/-1; padding: 40px; text-align: center; color: #888;">No products available. Add products from the Admin Panel.</p>`;
    return;
  }

  container.innerHTML = products.map(p => `
    <div class="product" style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; background: #ffffff; display: flex; flex-direction: column; justify-content: space-between;">
      <div>
        <img src="${p.imageUrl}" alt="${p.name}" style="width: 100%; height: 160px; object-fit: cover; border-radius: 6px; margin-bottom: 12px;" onerror="this.src='saya-art-advertising-logo.jpg'">
        <h3 style="font-size: 16px; font-weight: 700; margin: 0 0 6px 0;">${p.name}</h3>
        <p style="font-size: 13px; color: #64748b; margin: 0 0 14px 0; line-height: 1.4;">${p.description}</p>
      </div>
      <div>
        <div style="font-size: 18px; font-weight: 800; color: #16a34a; margin-bottom: 10px;">₹${p.price}</div>
        <button class="primary-button full" onclick="openProductCustomizer('${p.id}')">Customise & Buy →</button>
      </div>
    </div>
  `).join('');
}

// 3. Search Functionality
const searchInput = document.getElementById('searchInput');
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    const resultsContainer = document.getElementById('searchResults');
    const filtered = allProductsList.filter(p => 
      p.name.toLowerCase().includes(term) || 
      p.description.toLowerCase().includes(term)
    );

    if (resultsContainer) {
      resultsContainer.innerHTML = filtered.length ? filtered.map(p => `
        <div style="padding:10px; border-bottom:1px solid #eee; cursor:pointer;" onclick="openProductCustomizer('${p.id}'); closeModal('searchModal');">
          <b>${p.name}</b> - ₹${p.price}
        </div>
      `).join('') : '<p style="color:#888;">No matching products found.</p>';
    }
  });
}

// 4. Customizer Modal
window.openProductCustomizer = function(productId) {
  selectedProduct = allProductsList.find(p => p.id === productId);
  if (!selectedProduct) return;

  const titleEl = document.getElementById('customTitle');
  const priceEl = document.getElementById('customPrice');
  if (titleEl) titleEl.innerText = selectedProduct.name;
  if (priceEl) priceEl.innerText = "₹" + selectedProduct.price;

  openModal('productModal');
};

// 5. Add to Cart / Bag
const addCustomBtn = document.getElementById('addCustomProduct');
if (addCustomBtn) {
  addCustomBtn.onclick = () => {
    if (!selectedProduct) return;

    const qtyInput = document.getElementById('quantity');
    const textInput = document.getElementById('customText');

    const qty = Number(qtyInput?.value || 1);
    const text = textInput?.value || '';
    const itemTotal = selectedProduct.price * qty;

    cart.push({
      name: selectedProduct.name,
      unitPrice: selectedProduct.price,
      quantity: qty,
      customText: text,
      totalPrice: itemTotal
    });

    saveCart();
    closeModal('productModal');
    openDrawer('cartDrawer');
    toast("Added to your bag!");
  };
}

// 6. Update Bag UI
function updateCartUI() {
  const cartCount = document.getElementById('cartCount');
  const cartItemsContainer = document.getElementById('cartItems');
  const cartTotal = document.getElementById('cartTotal');

  if (cartCount) {
    cartCount.innerText = cart.length;
  }

  if (cartItemsContainer) {
    if (cart.length === 0) {
      cartItemsContainer.innerHTML = "<p style='padding:20px; text-align:center; color:#777;'>Your bag is empty.</p>";
      if (cartTotal) cartTotal.innerText = "₹0";
      return;
    }

    let grandTotal = 0;
    cartItemsContainer.innerHTML = cart.map((item, index) => {
      grandTotal += item.totalPrice;
      return `
        <div style="border-bottom: 1px solid #eee; padding: 12px 0; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <b style="font-size: 14px; color: #1e293b;">${item.name}</b><br>
            <small style="color: #64748b;">Qty: ${item.quantity} ${item.customText ? '| Text: ' + item.customText : ''}</small>
            <div style="color: #16a34a; font-weight: 700; margin-top: 4px;">₹${item.totalPrice}</div>
          </div>
          <button onclick="removeFromCart(${index})" style="background: #fee2e2; border: none; color: #ef4444; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 12px; font-weight: bold;">Remove</button>
        </div>
      `;
    }).join('');

    if (cartTotal) cartTotal.innerText = "₹" + grandTotal;
  }
}

window.removeFromCart = function(index) {
  cart.splice(index, 1);
  saveCart();
};

// 7. Automatic Pincode API Detection (Pincode input event)
const pincodeInput = document.getElementById('custPincode');
const pinStatus = document.getElementById('pinStatus');

if (pincodeInput) {
  pincodeInput.addEventListener('input', async (e) => {
    const pin = e.target.value.trim();
    if (pin.length === 6 && /^\d+$/.test(pin)) {
      if (pinStatus) { pinStatus.innerText = "Fetching area details..."; pinStatus.style.color = "#2563eb"; }
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
        const data = await res.json();
        if (data[0].Status === "Success") {
          const po = data[0].PostOffice[0];
          autoDetectedLocation = `${po.District}, ${po.State}`;
          if (pinStatus) {
            pinStatus.innerText = `📍 ${autoDetectedLocation}`;
            pinStatus.style.color = "#16a34a";
          }
        } else {
          autoDetectedLocation = "";
          if (pinStatus) { pinStatus.innerText = "Invalid Pincode"; pinStatus.style.color = "#ef4444"; }
        }
      } catch (err) {
        autoDetectedLocation = "";
        if (pinStatus) { pinStatus.innerText = "Error fetching pincode location"; pinStatus.style.color = "#ef4444"; }
      }
    } else {
      autoDetectedLocation = "";
      if (pinStatus) pinStatus.innerText = "";
    }
  });
}

// 8. Checkout Submit Flow
const checkoutBtn = document.getElementById('checkoutButton');
if (checkoutBtn) {
  checkoutBtn.onclick = () => {
    if (cart.length === 0) {
      toast("Your bag is empty!");
      return;
    }
    closeDrawer('cartDrawer');
    openModal('checkoutModal');
  };
}

const checkoutForm = document.getElementById('checkoutForm');
if (checkoutForm) {
  checkoutForm.onsubmit = async (e) => {
    e.preventDefault();

    const name = document.getElementById('custName')?.value || '';
    const phone = document.getElementById('custPhone')?.value || '';
    const pin = document.getElementById('custPincode')?.value || '';
    const street = document.getElementById('custAddress')?.value || '';
    const payMethod = document.querySelector('input[name="payMethod"]:checked')?.value || 'COD';

    const fullAddress = `${street}, ${autoDetectedLocation ? autoDetectedLocation : ''} - PIN: ${pin}`;
    const totalAmount = cart.reduce((sum, item) => sum + item.totalPrice, 0);
    const itemSummary = cart.map(i => `${i.name} (x${i.quantity})`).join(', ');

    try {
      await addDoc(collection(db, "orders"), {
        orderId: "ORD-" + Math.floor(100000 + Math.random() * 900000),
        customerName: name,
        customerPhone: phone,
        deliveryAddress: fullAddress,
        itemName: itemSummary,
        amount: totalAmount,
        paymentMethod: payMethod,
        paymentStatus: payMethod === "COD" ? "PENDING (COD)" : "PAID",
        createdAt: new Date().toLocaleString()
      });

      alert("Order Placed Successfully!");
      cart = [];
      saveCart();
      closeModal('checkoutModal');

      if (auth.currentUser && auth.currentUser.phoneNumber) {
        loadCustomerOrders(auth.currentUser.phoneNumber);
      }
    } catch (err) {
      alert("Error placing order: " + err.message);
    }
  };
}

// 9. Auth & OTP Logic
onAuthStateChanged(auth, (user) => {
  const loggedOutState = document.getElementById('loggedOutState');
  const loggedInState = document.getElementById('loggedInState');
  const userPhoneDisplay = document.getElementById('userPhoneDisplay');

  if (user) {
    if (loggedOutState) loggedOutState.style.display = 'none';
    if (loggedInState) loggedInState.style.display = 'block';
    if (userPhoneDisplay) userPhoneDisplay.innerText = user.phoneNumber;
    
    // Auto fill checkout mobile if available
    const custPhone = document.getElementById('custPhone');
    if (custPhone) custPhone.value = user.phoneNumber;

    loadCustomerOrders(user.phoneNumber);
  } else {
    if (loggedOutState) loggedOutState.style.display = 'block';
    if (loggedInState) loggedInState.style.display = 'none';
  }
});

function initRecaptcha() {
  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'side-recaptcha-container', { 'size': 'invisible' });
  }
}

const sendOtpBtn = document.getElementById('sendSideOtpBtn');
if (sendOtpBtn) {
  sendOtpBtn.onclick = () => {
    const phone = document.getElementById('sidePhoneInput').value.trim();
    if (!phone.startsWith('+91') || phone.length < 13) {
      alert("Enter full mobile number with +91 (e.g., +919876543210)");
      return;
    }
    initRecaptcha();
    signInWithPhoneNumber(auth, phone, window.recaptchaVerifier)
      .then((res) => {
        window.confirmationResult = res;
        document.getElementById('sidePhoneStep').style.display = 'none';
        document.getElementById('sideOtpStep').style.display = 'block';
        alert("OTP Sent to your mobile number!");
      })
      .catch((err) => alert("OTP Error: " + err.message));
  };
}

const verifyOtpBtn = document.getElementById('verifySideOtpBtn');
if (verifyOtpBtn) {
  verifyOtpBtn.onclick = () => {
    const otp = document.getElementById('sideOtpInput').value.trim();
    if (!otp) return alert("Please enter OTP!");

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

// 10. Load User Previous Orders
async function loadCustomerOrders(phone) {
  const container = document.getElementById('userOrdersList');
  if (!container) return;

  try {
    const q = query(collection(db, "orders"), where("customerPhone", "==", phone));
    const snap = await getDocs(q);

    if (snap.empty) {
      container.innerHTML = "<p style='color:#777;'>No previous orders found.</p>";
      return;
    }

    container.innerHTML = "";
    snap.forEach(docSnap => {
      const o = docSnap.data();
      container.innerHTML += `
        <div style="border-bottom:1px solid #eee; padding:10px 0;">
          <b>Order #${o.orderId || docSnap.id}</b> - ₹${o.amount}<br>
          <small style="color:#555;">Items: ${o.itemName}</small><br>
          <small style="color:#777;">Date: ${o.createdAt}</small><br>
          <span style="color:${o.paymentStatus.includes('PAID') ? 'green' : 'orange'}; font-weight:bold; font-size:11px;">${o.paymentStatus}</span>
        </div>
      `;
    });
  } catch (err) {
    container.innerHTML = "<p style='color:red;'>Unable to load order history.</p>";
  }
}

// 11. Admin Page Operations (Runs on admin.html)
async function initAdminPanel() {
  const adminAddForm = document.getElementById('adminAddProductForm');
  const adminProductList = document.getElementById('adminProductList');
  const adminOrdersList = document.getElementById('adminOrdersList');

  if (!adminAddForm) return; // Not on admin page

  // Add Product
  adminAddForm.onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('pName').value;
    const price = document.getElementById('pPrice').value;
    const description = document.getElementById('pDesc').value;
    const imageUrl = document.getElementById('pImg').value;

    try {
      await addDoc(collection(db, "products"), { name, price: Number(price), description, imageUrl });
      alert("Product added successfully!");
      adminAddForm.reset();
      loadAdminProducts();
    } catch (err) {
      alert("Error adding product: " + err.message);
    }
  };

  // Load Admin Products
  async function loadAdminProducts() {
    adminProductList.innerHTML = "Loading...";
    const snap = await getDocs(collection(db, "products"));
    if (snap.empty) {
      adminProductList.innerHTML = "<p>No products added yet.</p>";
      return;
    }

    adminProductList.innerHTML = "";
    snap.forEach(docSnap => {
      const p = docSnap.data();
      adminProductList.innerHTML += `
        <div class="product-list-item">
          <div>
            <b>${p.name}</b> - ₹${p.price}<br>
            <small>${p.description || ''}</small>
          </div>
          <button class="btn btn-danger" onclick="deleteProduct('${docSnap.id}')">Delete</button>
        </div>
      `;
    });
  }

  // Load Admin Orders
  async function loadAdminOrders() {
    adminOrdersList.innerHTML = "Loading...";
    const snap = await getDocs(collection(db, "orders"));
    if (snap.empty) {
      adminOrdersList.innerHTML = "<p>No orders placed yet.</p>";
      return;
    }

    adminOrdersList.innerHTML = "";
    snap.forEach(docSnap => {
      const o = docSnap.data();
      adminOrdersList.innerHTML += `
        <div class="order-list-item">
          <div>
            <b>${o.orderId || docSnap.id}</b> | Customer: <b>${o.customerName}</b> (${o.customerPhone})<br>
            Items: ${o.itemName}<br>
            Address: ${o.deliveryAddress}<br>
            Total: <b>₹${o.amount}</b> | Payment: <b>${o.paymentStatus}</b>
          </div>
        </div>
      `;
    });
  }

  window.deleteProduct = async (id) => {
    if (confirm("Are you sure you want to delete this product?")) {
      await deleteDoc(doc(db, "products", id));
      loadAdminProducts();
    }
  };

  loadAdminProducts();
  loadAdminOrders();
}

// 12. Helper Modal & Drawer Controls
window.openModal = function(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add('show'); el.setAttribute('aria-hidden', 'false'); }
};

window.closeModal = function(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.remove('show'); el.setAttribute('aria-hidden', 'true'); }
};

window.openDrawer = function(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add('open'); el.setAttribute('aria-hidden', 'false'); }
};

window.closeDrawer = function(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.remove('open'); el.setAttribute('aria-hidden', 'true'); }
};

function toast(msg) {
  const t = document.getElementById('toast');
  if (t) {
    t.innerText = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
  }
}

// Event Bindings
const searchBtn = document.getElementById('searchButton');
if (searchBtn) searchBtn.onclick = () => openModal('searchModal');

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

// Initial Setup
document.addEventListener('DOMContentLoaded', () => {
  loadProducts();
  updateCartUI();
  initAdminPanel();
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.innerText = new Date().getFullYear();
});
