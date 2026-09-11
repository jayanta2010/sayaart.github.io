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

// Global State
let cart = [];
let allProductsList = [];
let selectedProduct = null;
let detectedLocation = "";

// 1. Fetch products ONLY from Firestore DB
async function loadProducts() {
  const container = document.getElementById('productGrid');
  if (!container) return;

  allProductsList = [];

  try {
    const snap = await getDocs(collection(db, "products"));
    if (!snap.empty) {
      snap.forEach(doc => {
        const item = doc.data();
        allProductsList.push({
          id: doc.id,
          name: item.name || "Custom Product",
          description: item.description || "High quality print finish.",
          price: Number(item.price) || 0,
          imageUrl: item.imageUrl || "saya-art-advertising-logo.jpg"
        });
      });
    }
  } catch (err) {
    console.error("Firestore Catalog Load Error:", err);
  }

  renderProducts(allProductsList);
}

// 2. Render Products Grid
function renderProducts(products) {
  const container = document.getElementById('productGrid');
  if (!container) return;

  if (products.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; padding: 40px; text-align: center; color: #64748b; background: white; border-radius: 8px;">No products available right now. Please add products from Admin panel.</div>`;
    return;
  }

  container.style.display = "grid";
  container.style.gridTemplateColumns = "repeat(auto-fill, minmax(240px, 1fr))";
  container.style.gap = "20px";

  container.innerHTML = products.map(p => `
    <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; background: #ffffff; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
      <div>
        <img src="${p.imageUrl}" alt="${p.name}" style="width: 100%; height: 160px; object-fit: cover; border-radius: 6px; margin-bottom: 12px;" onerror="this.src='saya-art-advertising-logo.jpg'">
        <h3 style="font-size: 16px; font-weight: 700; margin: 0 0 6px 0; color: #1e293b;">${p.name}</h3>
        <p style="font-size: 13px; color: #64748b; margin: 0 0 14px 0; line-height: 1.4;">${p.description}</p>
      </div>
      <div>
        <div style="font-size: 18px; font-weight: 800; color: #16a34a; margin-bottom: 10px;">₹${p.price}</div>
        <button class="btn-submit" onclick="openProductCustomizer('${p.name.replace(/'/g, "\\'")}', ${p.price})">Customise & Buy →</button>
      </div>
    </div>
  `).join('');
}

// 3. Search Functionality
const searchInput = document.getElementById('searchInput');
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    const filtered = allProductsList.filter(p => 
      p.name.toLowerCase().includes(term) || 
      p.description.toLowerCase().includes(term)
    );
    
    const resultsBox = document.getElementById('searchResults');
    if (resultsBox) {
      if(filtered.length === 0) {
        resultsBox.innerHTML = "<p style='color:#777; text-align:center; padding:10px;'>No matching products.</p>";
      } else {
        resultsBox.innerHTML = filtered.map(p => `
          <div style="padding: 10px; border-bottom: 1px solid #eee; display:flex; justify-size:space-between; align-items:center;">
            <div>
              <b>${p.name}</b> - ₹${p.price}
            </div>
            <button onclick="openProductCustomizer('${p.name.replace(/'/g, "\\'")}', ${p.price})" style="padding:4px 8px; background:#16a34a; color:white; border:none; border-radius:4px; cursor:pointer;">Select</button>
          </div>
        `).join('');
      }
    }
  });
}

// 4. Customizer Modal
window.openProductCustomizer = function(name, price) {
  selectedProduct = { name, price };
  closeModal('searchModal');
  const titleEl = document.getElementById('customTitle');
  const priceEl = document.getElementById('customPrice');
  if (titleEl) titleEl.innerText = name;
  if (priceEl) priceEl.innerText = "₹" + price;
  openModal('productModal');
};

// Add to Bag
const addCustomBtn = document.getElementById('addCustomProduct');
if (addCustomBtn) {
  addCustomBtn.onclick = () => {
    if (!selectedProduct) return;
    const qty = Number(document.getElementById('quantity')?.value || 1);
    const text = document.getElementById('customText')?.value || '';

    const itemTotal = selectedProduct.price * (qty > 0 ? qty : 1);
    cart.push({
      name: selectedProduct.name,
      unitPrice: selectedProduct.price,
      quantity: qty,
      customText: text,
      totalPrice: itemTotal
    });

    updateCartUI();
    closeModal('productModal');
    openDrawer('cartDrawer');
  };
}

// 5. Update Bag/Cart UI
function updateCartUI() {
  const cartCount = document.getElementById('cartCount');
  const cartItemsContainer = document.getElementById('cartItems');
  const cartTotal = document.getElementById('cartTotal');

  if (cartCount) {
    cartCount.innerText = cart.length;
    cartCount.style.display = cart.length > 0 ? 'inline-block' : 'none';
  }

  if (cartItemsContainer) {
    if (cart.length === 0) {
      cartItemsContainer.innerHTML = "<p style='padding:20px; text-align:center; color:#777;'>Your bag is empty.</p>";
      if (cartTotal) cartTotal.innerText = "₹0";
      return;
    }

    let total = 0;
    cartItemsContainer.innerHTML = cart.map((item, index) => {
      total += item.totalPrice;
      return `
        <div style="border-bottom: 1px solid #eee; padding: 12px 0; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <b style="font-size: 14px; color: #1e293b;">${item.name}</b><br>
            <small style="color: #64748b;">Qty: ${item.quantity} ${item.customText ? '| Note: ' + item.customText : ''}</small>
            <div style="color: #16a34a; font-weight: 700; margin-top: 4px;">₹${item.totalPrice}</div>
          </div>
          <button onclick="removeFromCart(${index})" style="background: #fee2e2; border: none; color: #ef4444; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 12px; font-weight: bold;">Remove</button>
        </div>
      `;
    }).join('');

    if (cartTotal) cartTotal.innerText = "₹" + total;
  }
}

window.removeFromCart = function(index) {
  cart.splice(index, 1);
  updateCartUI();
};

// 6. Automatic Pincode Lookup API
const pincodeInput = document.getElementById('custPincode');
const pinDetails = document.getElementById('pinDetails');

if (pincodeInput) {
  pincodeInput.addEventListener('input', async (e) => {
    const pin = e.target.value.trim();
    if (pin.length === 6 && /^\d+$/.test(pin)) {
      if (pinDetails) { pinDetails.innerText = "Checking pincode..."; pinDetails.style.color = "#2563eb"; }
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
        const data = await res.json();
        if (data[0].Status === "Success") {
          const po = data[0].PostOffice[0];
          detectedLocation = `${po.District}, ${po.State}`;
          if (pinDetails) {
            pinDetails.innerText = `📍 ${detectedLocation}`;
            pinDetails.style.color = "#16a34a";
          }
        } else {
          detectedLocation = "";
          if (pinDetails) { pinDetails.innerText = "❌ Invalid Pincode"; pinDetails.style.color = "#ef4444"; }
        }
      } catch (err) {
        detectedLocation = "";
        if (pinDetails) { pinDetails.innerText = "Unable to fetch pincode info"; pinDetails.style.color = "#ef4444"; }
      }
    } else {
      detectedLocation = "";
      if (pinDetails) pinDetails.innerText = "";
    }
  });
}

// 7. Checkout Flow
const checkoutBtn = document.getElementById('checkoutButton');
if (checkoutBtn) {
  checkoutBtn.onclick = () => {
    if (cart.length === 0) {
      alert("Your bag is empty!");
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      alert("Please login with Mobile OTP in Profile before checkout!");
      closeDrawer('cartDrawer');
      openDrawer('profileDrawer');
      return;
    }

    const phoneInput = document.getElementById('custPhone');
    if (phoneInput && user.phoneNumber) phoneInput.value = user.phoneNumber;

    closeDrawer('cartDrawer');
    openModal('checkoutModal');
  };
}

// Checkout Form Submission
const checkoutForm = document.getElementById('checkoutForm');
if (checkoutForm) {
  checkoutForm.onsubmit = async (e) => {
    e.preventDefault();
    const user = auth.currentUser;

    const name = document.getElementById('custName')?.value || '';
    const phone = document.getElementById('custPhone')?.value || user?.phoneNumber || '';
    const pin = document.getElementById('custPincode')?.value || '';
    const street = document.getElementById('custAddress')?.value || '';
    
    const fullAddress = `${street}, ${detectedLocation} - ${pin}`;
    const totalAmount = cart.reduce((sum, item) => sum + item.totalPrice, 0);
    const itemNames = cart.map(i => `${i.name} (x${i.quantity})`).join(', ');

    try {
      await addDoc(collection(db, "orders"), {
        orderId: "ORD-" + Math.floor(100000 + Math.random() * 900000),
        customerName: name,
        customerPhone: phone,
        deliveryAddress: fullAddress,
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
      alert("Error placing order: " + err.message);
    }
  };
}

// Drawer & Modal Utilities
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

// Nav Click Bindings
const searchBtn = document.getElementById('searchButton');
if (searchBtn) searchBtn.onclick = () => openModal('searchModal');

const openProfileBtn = document.getElementById('openProfile');
if (openProfileBtn) openProfileBtn.onclick = () => openDrawer('profileDrawer');

const openCartBtn = document.getElementById('openCart');
if (openCartBtn) openCartBtn.onclick = () => openDrawer('cartDrawer');

document.querySelectorAll('[data-close]').forEach(btn => {
  btn.onclick = (e) => {
    const id = e.target.getAttribute('data-close');
    closeModal(id);
    closeDrawer(id);
  };
});

// 8. Authentication & Order History
onAuthStateChanged(auth, (user) => {
  const loggedOutState = document.getElementById('loggedOutState');
  const loggedInState = document.getElementById('loggedInState');
  const userPhoneDisplay = document.getElementById('userPhoneDisplay');

  if (user) {
    if (loggedOutState) loggedOutState.style.display = 'none';
    if (loggedInState) loggedInState.style.display = 'flex';
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
        <div style="border-bottom:1px solid #eee; padding:8px 0; font-size:13px;">
          <b>${o.itemName || 'Printed Item'}</b> - ₹${o.amount}<br>
          <small style="color:#777;">Address: ${o.deliveryAddress || 'N/A'}</small><br>
          <span style="color:green; font-weight:bold; font-size:11px;">Status: ${o.paymentStatus || 'PAID'}</span>
        </div>
      `;
    });
  } catch(e) {
    container.innerHTML = "<p style='font-size:12px; color:red;'>Failed to load orders.</p>";
  }
}

// Initial Catalog Load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadProducts);
} else {
  loadProducts();
}
