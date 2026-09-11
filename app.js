import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

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

// Application State
let cart = JSON.parse(localStorage.getItem('saya_cart_pro') || '[]');
let allProductsList = [];
let selectedProduct = null;
let currentCalculatedPrice = 0;
let fabricCanvas = null;

// Dual Side Design State
let currentSide = 'front';
let canvasStates = { front: null, back: null };
let rawUploadedImages = [];

function saveCart() {
  localStorage.setItem('saya_cart_pro', JSON.stringify(cart));
  updateCartUI();
}

// 1. Initialize Fabric Canvas Engine
function initFabricCanvas() {
  if (!fabricCanvas && document.getElementById('designCanvas')) {
    fabricCanvas = new fabric.Canvas('designCanvas', {
      backgroundColor: '#ffffff',
      enableRetinaScaling: true
    });
  }
}

// 2. Load Products Catalog
async function loadProducts() {
  const container = document.getElementById('productGrid');
  if (!container) return;

  let dbProducts = [];
  try {
    const snap = await getDocs(collection(db, "products"));
    snap.forEach(docSnap => {
      const item = docSnap.data();
      dbProducts.push({
        id: docSnap.id,
        name: item.name || "Custom Product",
        description: item.description || "High quality print finish.",
        price: Number(item.price) || 0,
        frontImg: item.frontImg || "saya-art-advertising-logo.jpg",
        backImg: item.backImg || "",
        sizes: item.sizes || [],
        qualities: item.qualities || []
      });
    });
  } catch (err) {
    console.error("Error fetching products:", err);
  }

  allProductsList = dbProducts;
  renderProducts(allProductsList);
}

function renderProducts(products) {
  const container = document.getElementById('productGrid');
  if (!container) return;

  if (products.length === 0) {
    container.innerHTML = `<p style="grid-column: 1/-1; padding:40px; text-align:center;">No products available right now.</p>`;
    return;
  }

  container.innerHTML = products.map(p => `
    <div style="border:1px solid #cbd5e1; border-radius:8px; padding:16px; background:#fff; display:flex; flex-direction:column; justify-content:space-between;">
      <div>
        <img src="${p.frontImg}" alt="${p.name}" style="width:100%; height:180px; object-fit:contain; border-radius:6px; margin-bottom:10px;">
        <h3 style="margin:0 0 6px 0;">${p.name}</h3>
        <p style="font-size:13px; color:#64748b;">${p.description}</p>
      </div>
      <div style="margin-top:15px;">
        <div style="font-size:18px; font-weight:800; color:#16a34a; margin-bottom:10px;">Starts ₹${p.price}</div>
        <button class="primary-button full" onclick="openStudio('${p.id}')">Customize Front & Back →</button>
      </div>
    </div>
  `).join('');
}

// 3. Open Studio & Setup Side Outlines
window.openStudio = function(productId) {
  selectedProduct = allProductsList.find(p => p.id === productId);
  if (!selectedProduct) return;

  document.getElementById('customTitle').innerText = selectedProduct.name;
  initFabricCanvas();

  canvasStates = { front: null, back: null };
  rawUploadedImages = [];
  currentSide = 'front';
  updateSideButtonsUI();

  loadSideDesign('front');

  // Populate Dropdowns
  const sizeSelect = document.getElementById('sizeSelect');
  if (selectedProduct.sizes?.length) {
    document.getElementById('sizeSection').style.display = 'block';
    sizeSelect.innerHTML = selectedProduct.sizes.map((s, idx) => `<option value="${idx}">${s.name} ${s.extra ? '(+₹' + s.extra + ')' : ''}</option>`).join('');
  } else document.getElementById('sizeSection').style.display = 'none';

  const qualitySelect = document.getElementById('qualitySelect');
  if (selectedProduct.qualities?.length) {
    document.getElementById('qualitySection').style.display = 'block';
    qualitySelect.innerHTML = selectedProduct.qualities.map((q, idx) => `<option value="${idx}">${q.name} ${q.extra ? '(+₹' + q.extra + ')' : ''}</option>`).join('');
  } else document.getElementById('qualitySection').style.display = 'none';

  const btnViewBack = document.getElementById('btnViewBack');
  if (btnViewBack) {
    btnViewBack.style.display = selectedProduct.backImg ? 'inline-block' : 'none';
  }

  recalculatePrice();
  sizeSelect.onchange = recalculatePrice;
  qualitySelect.onchange = recalculatePrice;
  document.getElementById('quantity').oninput = recalculatePrice;

  openModal('productModal');
};

// 4. Side Design Canvas Loader with Outline Boundary Box
function loadSideDesign(side) {
  fabricCanvas.clear();

  const bgImgUrl = (side === 'front') ? selectedProduct.frontImg : (selectedProduct.backImg || selectedProduct.frontImg);

  if (bgImgUrl) {
    fabric.Image.fromURL(bgImgUrl, function(img) {
      img.scaleToWidth(380);
      img.scaleToHeight(420);
      fabricCanvas.setBackgroundImage(img, fabricCanvas.renderAll.bind(fabricCanvas), {
        originX: 'left',
        originY: 'top'
      });
    }, { crossOrigin: 'anonymous' });
  }

  // Safe Print Zone Boundary
  const printBoundary = new fabric.Rect({
    left: 70,
    top: 80,
    width: 240,
    height: 270,
    fill: 'transparent',
    stroke: '#ef4444',
    strokeDashArray: [5, 5],
    strokeWidth: 1.5,
    selectable: false,
    evented: false,
    isOutlineBoundary: true
  });
  fabricCanvas.add(printBoundary);

  if (canvasStates[side]) {
    fabricCanvas.loadFromJSON(canvasStates[side], () => {
      fabricCanvas.renderAll();
    });
  }
}

document.getElementById('btnViewFront')?.addEventListener('click', () => switchSide('front'));
document.getElementById('btnViewBack')?.addEventListener('click', () => switchSide('back'));

function switchSide(targetSide) {
  if (currentSide === targetSide) return;

  canvasStates[currentSide] = fabricCanvas.toJSON();
  currentSide = targetSide;
  updateSideButtonsUI();
  loadSideDesign(currentSide);
}

function updateSideButtonsUI() {
  const frontBtn = document.getElementById('btnViewFront');
  const backBtn = document.getElementById('btnViewBack');
  if (currentSide === 'front') {
    if (frontBtn) { frontBtn.style.background = '#0f172a'; frontBtn.style.color = '#fff'; }
    if (backBtn) { backBtn.style.background = '#f8fafc'; backBtn.style.color = '#0f172a'; }
  } else {
    if (backBtn) { backBtn.style.background = '#0f172a'; backBtn.style.color = '#fff'; }
    if (frontBtn) { frontBtn.style.background = '#f8fafc'; frontBtn.style.color = '#0f172a'; }
  }
}

// 5. High-Resolution Original Photo Preserver
document.getElementById('customPhotoInput')?.addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(f) {
    const rawDataUrl = f.target.result;

    rawUploadedImages.push({
      fileName: file.name,
      side: currentSide,
      originalDataUrl: rawDataUrl
    });

    fabric.Image.fromURL(rawDataUrl, function(img) {
      img.scaleToWidth(150);
      img.set({ left: 110, top: 110 });
      fabricCanvas.add(img);
      fabricCanvas.setActiveObject(img);
      fabricCanvas.renderAll();
    });
  };
  reader.readAsDataURL(file);
});

// 6. Text Controls & Font Customization
document.getElementById('addTextBtn')?.addEventListener('click', () => {
  const txt = document.getElementById('customTextInput').value.trim();
  const font = document.getElementById('fontSelect').value;
  const color = document.getElementById('textColorPicker').value;

  if (!txt) return alert("Please type your text first!");

  const textObj = new fabric.Text(txt, {
    left: 110,
    top: 140,
    fontFamily: font,
    fontSize: 24,
    fill: color
  });

  fabricCanvas.add(textObj);
  fabricCanvas.setActiveObject(textObj);
  fabricCanvas.renderAll();
});

document.getElementById('bringForwardBtn')?.addEventListener('click', () => {
  const activeObj = fabricCanvas.getActiveObject();
  if (activeObj) fabricCanvas.bringForward(activeObj);
});

document.getElementById('sendBackwardBtn')?.addEventListener('click', () => {
  const activeObj = fabricCanvas.getActiveObject();
  if (activeObj) fabricCanvas.sendBackwards(activeObj);
});

document.getElementById('deleteSelectedBtn')?.addEventListener('click', () => {
  const activeObj = fabricCanvas.getActiveObject();
  if (activeObj && !activeObj.isOutlineBoundary) {
    fabricCanvas.remove(activeObj);
    fabricCanvas.renderAll();
  }
});

function recalculatePrice() {
  if (!selectedProduct) return;
  let unitPrice = selectedProduct.price;

  const sizeSelect = document.getElementById('sizeSelect');
  if (selectedProduct.sizes?.length && sizeSelect.value !== '') {
    unitPrice += Number(selectedProduct.sizes[Number(sizeSelect.value)]?.extra || 0);
  }

  const qualitySelect = document.getElementById('qualitySelect');
  if (selectedProduct.qualities?.length && qualitySelect.value !== '') {
    unitPrice += Number(selectedProduct.qualities[Number(qualitySelect.value)]?.extra || 0);
  }

  const qty = Number(document.getElementById('quantity')?.value || 1);
  currentCalculatedPrice = unitPrice * (qty > 0 ? qty : 1);
  document.getElementById('customPriceDisplay').innerText = `₹${currentCalculatedPrice} (₹${unitPrice} / item)`;
}

// 7. Add to Cart with 3x DPI Render Snapshot & Raw Original Uploads
document.getElementById('addCustomProduct')?.addEventListener('click', () => {
  if (!selectedProduct) return;

  canvasStates[currentSide] = fabricCanvas.toJSON();

  // Hide outline box before creating print snapshot
  fabricCanvas.getObjects().forEach(obj => {
    if (obj.isOutlineBoundary) obj.set('visible', false);
  });
  fabricCanvas.renderAll();

  const frontSnapshot = currentSide === 'front' 
    ? fabricCanvas.toDataURL({ format: 'png', multiplier: 3 })
    : (canvasStates.front ? renderJsonToDataUrl('front') : '');

  const backSnapshot = currentSide === 'back'
    ? fabricCanvas.toDataURL({ format: 'png', multiplier: 3 })
    : (canvasStates.back ? renderJsonToDataUrl('back') : '');

  const qty = Number(document.getElementById('quantity')?.value || 1);
  const sizeSelect = document.getElementById('sizeSelect');
  const qualitySelect = document.getElementById('qualitySelect');

  cart.push({
    name: selectedProduct.name,
    quantity: qty,
    totalPrice: currentCalculatedPrice,
    size: selectedProduct.sizes?.length ? selectedProduct.sizes[Number(sizeSelect.value)]?.name : 'Standard',
    quality: selectedProduct.qualities?.length ? selectedProduct.qualities[Number(qualitySelect.value)]?.name : 'Standard',
    frontArtworkUrl: frontSnapshot || selectedProduct.frontImg,
    backArtworkUrl: backSnapshot || '',
    uploadedRawPhotos: rawUploadedImages
  });

  saveCart();
  closeModal('productModal');
  openDrawer('cartDrawer');
});

function renderJsonToDataUrl(side) {
  if (!canvasStates[side]) return '';
  const tempCanvas = new fabric.Canvas(null, { width: 380, height: 420 });
  tempCanvas.loadFromJSON(canvasStates[side], () => {
    tempCanvas.getObjects().forEach(o => { if (o.isOutlineBoundary) o.set('visible', false); });
    tempCanvas.renderAll();
  });
  return tempCanvas.toDataURL({ format: 'png', multiplier: 3 });
}

// 8. Bag & Checkout Management
function updateCartUI() {
  const cartCount = document.getElementById('cartCount');
  const cartItemsContainer = document.getElementById('cartItems');
  const cartTotal = document.getElementById('cartTotal');

  if (cartCount) cartCount.innerText = cart.length;

  if (cartItemsContainer) {
    if (cart.length === 0) {
      cartItemsContainer.innerHTML = "<p style='padding:20px; text-align:center;'>Your bag is empty.</p>";
      if (cartTotal) cartTotal.innerText = "₹0";
      return;
    }

    let grandTotal = 0;
    cartItemsContainer.innerHTML = cart.map((item, index) => {
      grandTotal += item.totalPrice;
      return `
        <div style="border-bottom:1px solid #eee; padding:12px 0; display:flex; gap:10px; align-items:center;">
          <img src="${item.frontArtworkUrl}" style="width:55px; height:55px; border:1px solid #ddd; object-fit:contain; background:#fff; border-radius:4px;">
          <div style="flex:1;">
            <b>${item.name}</b><br>
            <small style="color:#64748b;">Qty: ${item.quantity} | Size: ${item.size}</small>
            <div style="color:#16a34a; font-weight:700;">₹${item.totalPrice}</div>
          </div>
          <button onclick="removeFromCart(${index})" style="background:#fee2e2; border:none; color:#ef4444; border-radius:4px; padding:4px 8px; cursor:pointer;">Remove</button>
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

document.getElementById('openCart')?.addEventListener('click', () => openDrawer('cartDrawer'));

document.getElementById('checkoutButton')?.addEventListener('click', () => {
  if (cart.length === 0) return alert("Bag is empty!");
  closeDrawer('cartDrawer');
  openModal('checkoutModal');
});

document.getElementById('checkoutForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('custName').value;
  const phone = document.getElementById('custPhone').value;
  const pin = document.getElementById('custPincode').value;
  const address = document.getElementById('custAddress').value;
  const payMethod = document.querySelector('input[name="payMethod"]:checked')?.value || 'COD';

  const totalAmount = cart.reduce((sum, item) => sum + item.totalPrice, 0);

  try {
    await addDoc(collection(db, "orders"), {
      orderId: "ORD-" + Math.floor(100000 + Math.random() * 900000),
      customerName: name,
      customerPhone: phone,
      deliveryAddress: `${address} - PIN: ${pin}`,
      items: cart,
      amount: totalAmount,
      paymentMethod: payMethod,
      createdAt: new Date().toLocaleString()
    });

    alert("Order Placed Successfully!");
    cart = [];
    saveCart();
    closeModal('checkoutModal');
  } catch (err) {
    alert("Error placing order: " + err.message);
  }
});

// 9. Admin Control Dashboard Engine
async function initAdminPanel() {
  const adminAddForm = document.getElementById('adminAddProductForm');
  const adminProductList = document.getElementById('adminProductList');
  const adminOrdersList = document.getElementById('adminOrdersList');

  if (!adminAddForm) return;

  // Admin Tab Switcher
  const btnTabProducts = document.getElementById('btnTabProducts');
  const btnTabOrders = document.getElementById('btnTabOrders');
  const productsTab = document.getElementById('productsTab');
  const ordersTab = document.getElementById('ordersTab');

  btnTabProducts?.addEventListener('click', () => {
    btnTabProducts.classList.add('active');
    btnTabOrders.classList.remove('active');
    productsTab.classList.add('active');
    ordersTab.classList.remove('active');
  });

  btnTabOrders?.addEventListener('click', () => {
    btnTabOrders.classList.add('active');
    btnTabProducts.classList.remove('active');
    ordersTab.classList.add('active');
    productsTab.classList.remove('active');
  });

  adminAddForm.onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('pName').value;
    const price = Number(document.getElementById('pPrice').value);
    const description = document.getElementById('pDesc').value;
    const frontImg = document.getElementById('pFrontImg').value;
    const backImg = document.getElementById('pBackImg').value;

    const sizesStr = document.getElementById('pSizes').value.trim();
    const sizes = sizesStr ? sizesStr.split(',').map(s => {
      const [sName, sExtra] = s.split(':');
      return { name: sName.trim(), extra: Number(sExtra || 0) };
    }) : [];

    const qualitiesStr = document.getElementById('pQualities').value.trim();
    const qualities = qualitiesStr ? qualitiesStr.split(',').map(q => {
      const [qName, qExtra] = q.split(':');
      return { name: qName.trim(), extra: Number(qExtra || 0) };
    }) : [];

    try {
      await addDoc(collection(db, "products"), { name, price, description, frontImg, backImg, sizes, qualities });
      alert("Product saved successfully!");
      adminAddForm.reset();
      loadAdminProducts();
    } catch (err) {
      alert("Error adding product: " + err.message);
    }
  };

  async function loadAdminProducts() {
    const snap = await getDocs(collection(db, "products"));
    adminProductList.innerHTML = "";
    snap.forEach(docSnap => {
      const p = docSnap.data();
      adminProductList.innerHTML += `
        <div style="border:1px solid #cbd5e1; padding:12px; margin-bottom:10px; border-radius:6px; display:flex; justify-content:space-between; align-items:center; background:#fff;">
          <div><b>${p.name}</b> - ₹${p.price}</div>
          <button onclick="deleteProduct('${docSnap.id}')" style="background:#ef4444; color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-weight:bold;">Delete</button>
        </div>
      `;
    });
  }

  async function loadAdminOrders() {
    const snap = await getDocs(collection(db, "orders"));
    adminOrdersList.innerHTML = "";
    snap.forEach(docSnap => {
      const o = docSnap.data();

      let itemsHtml = (o.items || []).map(item => `
        <div style="border:1px solid #cbd5e1; padding:12px; margin-top:10px; border-radius:6px; background:#fff;">
          <b>${item.name}</b> (Qty: ${item.quantity}) | Size: ${item.size} | Quality: ${item.quality}
          
          <div class="artwork-grid">
            ${item.frontArtworkUrl ? `
              <div class="artwork-box">
                <small><b>Front Design (300 DPI)</b></small><br>
                <img src="${item.frontArtworkUrl}" class="artwork-preview"><br>
                <a href="${item.frontArtworkUrl}" download="front-artwork-${o.orderId}.png" style="color:#2563eb; font-size:12px; font-weight:bold;">⬇ Download Front HD Render</a>
              </div>
            ` : ''}

            ${item.backArtworkUrl ? `
              <div class="artwork-box">
                <small><b>Back Design (300 DPI)</b></small><br>
                <img src="${item.backArtworkUrl}" class="artwork-preview"><br>
                <a href="${item.backArtworkUrl}" download="back-artwork-${o.orderId}.png" style="color:#2563eb; font-size:12px; font-weight:bold;">⬇ Download Back HD Render</a>
              </div>
            ` : ''}
          </div>

          ${item.uploadedRawPhotos && item.uploadedRawPhotos.length > 0 ? `
            <div style="margin-top:10px; padding:10px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:4px;">
              <b style="color:#166534; font-size:13px;">📸 Customer Original High-Res Raw Files:</b><br>
              ${item.uploadedRawPhotos.map((raw, rIdx) => `
                <a href="${raw.originalDataUrl}" download="original-photo-${rIdx + 1}.png" style="color:#15803d; font-size:12px; font-weight:bold; display:inline-block; margin-right:15px; margin-top:5px;">
                  ⬇ Download Original Raw Upload (${raw.side.toUpperCase()} Side - ${raw.fileName})
                </a>
              `).join('<br>')}
            </div>
          ` : ''}
        </div>
      `).join('');

      adminOrdersList.innerHTML += `
        <div class="order-card">
          <b>Order #${o.orderId || docSnap.id}</b> | Total: <b>₹${o.amount}</b> (${o.paymentMethod})<br>
          Customer: <b>${o.customerName}</b> (${o.customerPhone})<br>
          Address: <b>${o.deliveryAddress}</b><br>
          ${itemsHtml}
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

// Global Modal & Drawer Controls
window.openModal = (id) => document.getElementById(id)?.classList.add('show');
window.closeModal = (id) => document.getElementById(id)?.classList.remove('show');
window.openDrawer = (id) => document.getElementById(id)?.classList.add('open');
window.closeDrawer = (id) => document.getElementById(id)?.classList.remove('open');

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
});
