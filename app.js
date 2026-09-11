import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, query, where } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
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

// Application Variables
let cart = JSON.parse(localStorage.getItem('saya_cart') || '[]');
let allProductsList = [];
let selectedProduct = null;
let currentCalculatedPrice = 0;
let autoDetectedLocation = "";
let fabricCanvas = null;

function saveCart() {
  localStorage.setItem('saya_cart', JSON.stringify(cart));
  updateCartUI();
}

// 1. Initialize Interactive Canvas
function initFabricCanvas() {
  if (!fabricCanvas && document.getElementById('designCanvas')) {
    fabricCanvas = new fabric.Canvas('designCanvas', {
      backgroundColor: '#ffffff'
    });
  }
}

// 2. Load Products from Firebase
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
          imageUrl: item.imageUrl || "saya-art-advertising-logo.jpg",
          hasPhoto: item.hasPhoto || false,
          hasText: item.hasText || false,
          sizes: item.sizes || [],
          qualities: item.qualities || []
        });
      });
    }
  } catch (err) {
    console.error("Error loading products:", err);
  }

  allProductsList = dbProducts;
  renderProducts(allProductsList);
}

function renderProducts(products) {
  const container = document.getElementById('productGrid');
  if (!container) return;

  if (products.length === 0) {
    container.innerHTML = `<p style="grid-column: 1/-1; padding: 40px; text-align: center; color: #888;">No products added yet.</p>`;
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
        <div style="font-size: 18px; font-weight: 800; color: #16a34a; margin-bottom: 10px;">Starting ₹${p.price}</div>
        <button class="primary-button full" onclick="openProductCustomizer('${p.id}')">Customize & Design →</button>
      </div>
    </div>
  `).join('');
}

// 3. Open Live Studio Modal
window.openProductCustomizer = function(productId) {
  selectedProduct = allProductsList.find(p => p.id === productId);
  if (!selectedProduct) return;

  document.getElementById('customTitle').innerText = selectedProduct.name;
  initFabricCanvas();
  fabricCanvas.clear();
  fabricCanvas.setBackgroundColor('#ffffff', fabricCanvas.renderAll.bind(fabricCanvas));

  // Load product base mockup onto canvas background
  if (selectedProduct.imageUrl) {
    fabric.Image.fromURL(selectedProduct.imageUrl, function(img) {
      img.scaleToWidth(350);
      img.scaleToHeight(380);
      fabricCanvas.setBackgroundImage(img, fabricCanvas.renderAll.bind(fabricCanvas), {
        opacity: 0.35,
        originX: 'left',
        originY: 'top'
      });
    }, { crossOrigin: 'anonymous' });
  }

  // Toggle tool options
  document.getElementById('photoSection').style.display = (selectedProduct.hasPhoto || true) ? 'block' : 'none';
  document.getElementById('textSection').style.display = (selectedProduct.hasText || true) ? 'block' : 'none';

  // Size Options
  const sizeSection = document.getElementById('sizeSection');
  const sizeSelect = document.getElementById('sizeSelect');
  if (selectedProduct.sizes && selectedProduct.sizes.length > 0) {
    sizeSection.style.display = 'block';
    sizeSelect.innerHTML = selectedProduct.sizes.map((s, idx) => `
      <option value="${idx}">${s.name} ${s.extra > 0 ? '(+₹' + s.extra + ')' : ''}</option>
    `).join('');
  } else {
    sizeSection.style.display = 'none';
  }

  // Quality Options
  const qualitySection = document.getElementById('qualitySection');
  const qualitySelect = document.getElementById('qualitySelect');
  if (selectedProduct.qualities && selectedProduct.qualities.length > 0) {
    qualitySection.style.display = 'block';
    qualitySelect.innerHTML = selectedProduct.qualities.map((q, idx) => `
      <option value="${idx}">${q.name} ${q.extra > 0 ? '(+₹' + q.extra + ')' : ''}</option>
    `).join('');
  } else {
    qualitySection.style.display = 'none';
  }

  recalculatePrice();
  sizeSelect.onchange = recalculatePrice;
  qualitySelect.onchange = recalculatePrice;
  document.getElementById('quantity').oninput = recalculatePrice;

  openModal('productModal');
};

// 4. Live Canvas Actions (Add Photo, Add Text, Delete Item)
const customPhotoInput = document.getElementById('customPhotoInput');
if (customPhotoInput) {
  customPhotoInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(f) {
      const data = f.target.result;
      fabric.Image.fromURL(data, function(img) {
        img.scaleToWidth(180);
        img.set({ left: 80, top: 90 });
        fabricCanvas.add(img);
        fabricCanvas.setActiveObject(img);
        fabricCanvas.renderAll();
      });
    };
    reader.readAsDataURL(file);
  });
}

const addTextBtn = document.getElementById('addTextBtn');
if (addTextBtn) {
  addTextBtn.onclick = () => {
    const txt = document.getElementById('customTextInput').value.trim();
    const font = document.getElementById('fontSelect').value;
    if (!txt) return alert("Enter some text first!");

    const textObj = new fabric.Text(txt, {
      left: 100,
      top: 150,
      fontFamily: font,
      fontSize: 24,
      fill: '#000000'
    });

    fabricCanvas.add(textObj);
    fabricCanvas.setActiveObject(textObj);
    fabricCanvas.renderAll();
  };
}

const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
if (deleteSelectedBtn) {
  deleteSelectedBtn.onclick = () => {
    const activeObj = fabricCanvas.getActiveObject();
    if (activeObj) {
      fabricCanvas.remove(activeObj);
      fabricCanvas.renderAll();
    }
  };
}

// Price Calculator
function recalculatePrice() {
  if (!selectedProduct) return;
  let unitPrice = selectedProduct.price;

  const sizeSelect = document.getElementById('sizeSelect');
  if (selectedProduct.sizes?.length && sizeSelect.value !== '') {
    const size = selectedProduct.sizes[Number(sizeSelect.value)];
    if (size) unitPrice += Number(size.extra || 0);
  }

  const qualitySelect = document.getElementById('qualitySelect');
  if (selectedProduct.qualities?.length && qualitySelect.value !== '') {
    const quality = selectedProduct.qualities[Number(qualitySelect.value)];
    if (quality) unitPrice += Number(quality.extra || 0);
  }

  const qty = Number(document.getElementById('quantity')?.value || 1);
  currentCalculatedPrice = unitPrice * (qty > 0 ? qty : 1);

  document.getElementById('customPriceDisplay').innerText = `₹${currentCalculatedPrice} (₹${unitPrice} / item)`;
}

// 5. Add Designed Item to Cart with Final Artwork Snapshot
const addCustomBtn = document.getElementById('addCustomProduct');
if (addCustomBtn) {
  addCustomBtn.onclick = () => {
    if (!selectedProduct) return;

    // Export Canvas Output as Data URL Artwork Preview
    const designSnapshot = fabricCanvas.toDataURL({ format: 'png', quality: 0.9 });
    const qty = Number(document.getElementById('quantity')?.value || 1);

    const sizeSelect = document.getElementById('sizeSelect');
    const qualitySelect = document.getElementById('qualitySelect');
    const selectedSizeName = selectedProduct.sizes?.length ? selectedProduct.sizes[Number(sizeSelect.value)]?.name : '';
    const selectedQualityName = selectedProduct.qualities?.length ? selectedProduct.qualities[Number(qualitySelect.value)]?.name : '';

    cart.push({
      name: selectedProduct.name,
      quantity: qty,
      totalPrice: currentCalculatedPrice,
      size: selectedSizeName || 'Default',
      quality: selectedQualityName || 'Default',
      artworkDataUrl: designSnapshot // Complete visual design created by user
    });

    saveCart();
    closeModal('productModal');
    openDrawer('cartDrawer');
    toast("Added designed product to bag!");
  };
}

// 6. Cart UI Updates
function updateCartUI() {
  const cartCount = document.getElementById('cartCount');
  const cartItemsContainer = document.getElementById('cartItems');
  const cartTotal = document.getElementById('cartTotal');

  if (cartCount) cartCount.innerText = cart.length;

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
        <div style="border-bottom: 1px solid #eee; padding: 12px 0; display: flex; gap: 10px; align-items: center;">
          <img src="${item.artworkDataUrl}" style="width: 50px; height: 50px; border: 1px solid #ddd; object-fit: contain; background: #fff;">
          <div style="flex:1;">
            <b style="font-size: 14px;">${item.name}</b><br>
            <small style="color: #64748b;">Qty: ${item.quantity} | ${item.size} | ${item.quality}</small>
            <div style="color: #16a34a; font-weight: 700; margin-top: 2px;">₹${item.totalPrice}</div>
          </div>
          <button onclick="removeFromCart(${index})" style="background: #fee2e2; border: none; color: #ef4444; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 12px;">Remove</button>
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

// 7. Pincode API
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
            pinStatus.innerText = `📍 Location: ${autoDetectedLocation}`;
            pinStatus.style.color = "#16a34a";
          }
        } else {
          autoDetectedLocation = "";
          if (pinStatus) { pinStatus.innerText = "Invalid Pincode"; pinStatus.style.color = "#ef4444"; }
        }
      } catch (err) {
        autoDetectedLocation = "";
        if (pinStatus) { pinStatus.innerText = "Error fetching pincode"; pinStatus.style.color = "#ef4444"; }
      }
    } else {
      autoDetectedLocation = "";
      if (pinStatus) pinStatus.innerText = "";
    }
  });
}

// 8. Order Submission
const checkoutBtn = document.getElementById('checkoutButton');
if (checkoutBtn) {
  checkoutBtn.onclick = () => {
    if (cart.length === 0) return toast("Your bag is empty!");
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
    const area = document.getElementById('custArea')?.value || '';
    const street = document.getElementById('custAddress')?.value || '';
    const payMethod = document.querySelector('input[name="payMethod"]:checked')?.value || 'COD';

    const fullAddress = `${street}, Area: ${area}, ${autoDetectedLocation} - PIN: ${pin}`;
    const totalAmount = cart.reduce((sum, item) => sum + item.totalPrice, 0);

    try {
      await addDoc(collection(db, "orders"), {
        orderId: "ORD-" + Math.floor(100000 + Math.random() * 900000),
        customerName: name,
        customerPhone: phone,
        deliveryAddress: fullAddress,
        items: cart, // Stores items along with artworkDataUrl
        amount: totalAmount,
        paymentMethod: payMethod,
        paymentStatus: payMethod === "COD" ? "PENDING (COD)" : "PAID",
        createdAt: new Date().toLocaleString()
      });

      alert("Order Placed Successfully! Your design has been saved for print.");
      cart = [];
      saveCart();
      closeModal('checkoutModal');

      if (auth.currentUser?.phoneNumber) {
        loadCustomerOrders(auth.currentUser.phoneNumber);
      }
    } catch (err) {
      alert("Error submitting order: " + err.message);
    }
  };
}

// 9. Auth & User Previous Orders
onAuthStateChanged(auth, (user) => {
  const loggedOutState = document.getElementById('loggedOutState');
  const loggedInState = document.getElementById('loggedInState');
  const userPhoneDisplay = document.getElementById('userPhoneDisplay');

  if (user) {
    if (loggedOutState) loggedOutState.style.display = 'none';
    if (loggedInState) loggedInState.style.display = 'block';
    if (userPhoneDisplay) userPhoneDisplay.innerText = user.phoneNumber;
    if (document.getElementById('custPhone')) document.getElementById('custPhone').value = user.phoneNumber;
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
    if (!phone.startsWith('+91') || phone.length < 13) return alert("Enter valid +91 phone number");
    initRecaptcha();
    signInWithPhoneNumber(auth, phone, window.recaptchaVerifier)
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
    const otp = document.getElementById('sideOtpInput').value.trim();
    window.confirmationResult.confirm(otp)
      .then(() => alert("Login Successful!"))
      .catch(() => alert("Invalid OTP!"));
  };
}

const logoutBtn = document.getElementById('logoutUserBtn');
if (logoutBtn) logoutBtn.onclick = () => signOut(auth).then(() => location.reload());

async function loadCustomerOrders(phone) {
  const container = document.getElementById('userOrdersList');
  if (!container) return;

  try {
    const q = query(collection(db, "orders"), where("customerPhone", "==", phone));
    const snap = await getDocs(q);
    if (snap.empty) {
      container.innerHTML = "<p style='color:#777;'>No previous orders.</p>";
      return;
    }

    container.innerHTML = "";
    snap.forEach(docSnap => {
      const o = docSnap.data();
      container.innerHTML += `
        <div style="border-bottom:1px solid #eee; padding:10px 0;">
          <b>Order #${o.orderId || docSnap.id}</b> - ₹${o.amount}<br>
          <small style="color:#777;">Date: ${o.createdAt}</small><br>
          <span style="color:${o.paymentStatus.includes('PAID') ? 'green' : 'orange'}; font-weight:bold; font-size:11px;">${o.paymentStatus}</span>
        </div>
      `;
    });
  } catch (err) {
    container.innerHTML = "<p style='color:red;'>Failed to load order history.</p>";
  }
}

// 10. Admin Operations (View Orders & Customer Artworks)
async function initAdminPanel() {
  const adminAddForm = document.getElementById('adminAddProductForm');
  const adminProductList = document.getElementById('adminProductList');
  const adminOrdersList = document.getElementById('adminOrdersList');

  if (!adminAddForm) return;

  adminAddForm.onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('pName').value;
    const price = Number(document.getElementById('pPrice').value);
    const description = document.getElementById('pDesc').value;
    const imageUrl = document.getElementById('pImg').value;
    const hasPhoto = document.getElementById('chkPhoto').checked;
    const hasText = document.getElementById('chkText').checked;

    const sizesStr = document.getElementById('pSizes').value.trim();
    const sizes = sizesStr ? sizesStr.split(',').map(s => {
      const [sName, sExtra] = s.split(':');
      return { name: sName.trim(), extra: Number(sExtra || 0) };
    }) : [];

    const qualityStr = document.getElementById('pQualities').value.trim();
    const qualities = qualityStr ? qualityStr.split(',').map(q => {
      const [qName, qExtra] = q.split(':');
      return { name: qName.trim(), extra: Number(qExtra || 0) };
    }) : [];

    try {
      await addDoc(collection(db, "products"), {
        name, price, description, imageUrl, hasPhoto, hasText, sizes, qualities
      });
      alert("Product added successfully!");
      adminAddForm.reset();
      loadAdminProducts();
    } catch (err) {
      alert("Error adding product: " + err.message);
    }
  };

  async function loadAdminProducts() {
    adminProductList.innerHTML = "Loading...";
    const snap = await getDocs(collection(db, "products"));
    if (snap.empty) {
      adminProductList.innerHTML = "<p>No products yet.</p>";
      return;
    }

    adminProductList.innerHTML = "";
    snap.forEach(docSnap => {
      const p = docSnap.data();
      adminProductList.innerHTML += `
        <div class="product-list-item">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <b>${p.name}</b> - ₹${p.price}<br>
              <small>${p.description || ''}</small>
            </div>
            <button class="btn btn-danger" onclick="deleteProduct('${docSnap.id}')">Delete</button>
          </div>
        </div>
      `;
    });
  }

  // Load Customer Orders & Live Artwork Design Files
  async function loadAdminOrders() {
    adminOrdersList.innerHTML = "Loading...";
    const snap = await getDocs(collection(db, "orders"));
    if (snap.empty) {
      adminOrdersList.innerHTML = "<p>No customer orders yet.</p>";
      return;
    }

    adminOrdersList.innerHTML = "";
    snap.forEach(docSnap => {
      const o = docSnap.data();

      let itemsHtml = (o.items || []).map(item => `
        <div style="border:1px solid #e2e8f0; padding:10px; margin-top:8px; border-radius:6px; background:#f8fafc; display:flex; gap:15px; align-items:center;">
          <div>
            <b>${item.name}</b> (Qty: ${item.quantity})<br>
            <small>Size: ${item.size} | Quality: ${item.quality}</small><br>
            ${item.artworkDataUrl ? `<a href="${item.artworkDataUrl}" download="customer-artwork-${o.orderId}.png" style="color:#2563eb; font-size:12px; font-weight:bold;">⬇ Download Full Print File</a>` : ''}
          </div>
          ${item.artworkDataUrl ? `<img src="${item.artworkDataUrl}" class="design-preview-box" title="Exact customer design view">` : ''}
        </div>
      `).join('');

      adminOrdersList.innerHTML += `
        <div class="order-list-item">
          <div>
            <div style="display:flex; justify-content:space-between;">
              <b>Order #${o.orderId || docSnap.id}</b>
              <span style="color:${o.paymentStatus.includes('PAID') ? 'green' : 'orange'}; font-weight:bold;">${o.paymentStatus}</span>
            </div>
            <div>Customer: <b>${o.customerName}</b> (${o.customerPhone})</div>
            <div>Delivery Address: <b>${o.deliveryAddress}</b></div>
            <div>Total Paid: <b>₹${o.amount}</b></div>
            <div style="margin-top: 10px;"><b>Ordered Artwork & Customizations:</b>${itemsHtml}</div>
          </div>
        </div>
      `;
    });
  }

  window.deleteProduct = async (id) => {
    if (confirm("Delete product?")) {
      await deleteDoc(doc(db, "products", id));
      loadAdminProducts();
    }
  };

  loadAdminProducts();
  loadAdminOrders();
}

// 11. Modal Controls
window.openModal = (id) => { const el = document.getElementById(id); if (el) el.classList.add('show'); };
window.closeModal = (id) => { const el = document.getElementById(id); if (el) el.classList.remove('show'); };
window.openDrawer = (id) => { const el = document.getElementById(id); if (el) el.classList.add('open'); };
window.closeDrawer = (id) => { const el = document.getElementById(id); if (el) el.classList.remove('open'); };

function toast(msg) {
  const t = document.getElementById('toast');
  if (t) { t.innerText = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2500); }
}

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

document.addEventListener('DOMContentLoaded', () => {
  loadProducts();
  updateCartUI();
  initAdminPanel();
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.innerText = new Date().getFullYear();
});
