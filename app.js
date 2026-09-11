import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

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

let cart = JSON.parse(localStorage.getItem('saya_cart') || '[]');
let allProductsList = [];
let selectedProduct = null;
let currentCalculatedPrice = 0;
let fabricCanvas = null;

// Front/Back View Canvas States & Raw Image Data
let activeSide = 'front'; 
let frontCanvasJSON = null;
let backCanvasJSON = null;
let rawUploadedPhotoDataUrl = null; // Store High-Res Original Photo

function saveCart() {
  localStorage.setItem('saya_cart', JSON.stringify(cart));
  updateCartUI();
}

function initFabricCanvas() {
  if (!fabricCanvas && document.getElementById('designCanvas')) {
    fabricCanvas = new fabric.Canvas('designCanvas', { backgroundColor: '#ffffff' });
  }
}

// Admin Form Field Toggle (Stock vs Customizable)
const pTypeSelect = document.getElementById('pType');
const customOnlyFields = document.getElementById('customOnlyFields');
if (pTypeSelect && customOnlyFields) {
  pTypeSelect.addEventListener('change', (e) => {
    if (e.target.value === 'stock') {
      customOnlyFields.style.display = 'none';
      document.getElementById('pFrontOutline').removeAttribute('required');
      document.getElementById('pFinishedLink').removeAttribute('required');
    } else {
      customOnlyFields.style.display = 'block';
      document.getElementById('pFrontOutline').setAttribute('required', 'true');
      document.getElementById('pFinishedLink').setAttribute('required', 'true');
    }
  });
}

// Fetch Products from Firestore
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
        name: item.name || "Product",
        description: item.description || "",
        price: Number(item.price) || 0,
        imageUrl: item.imageUrl || "saya-art-advertising-logo.jpg",
        pType: item.pType || "customizable",
        frontOutline: item.frontOutline || "",
        backOutline: item.backOutline || "",
        finishedLink: item.finishedLink || "",
        hasPhoto: item.hasPhoto !== false,
        hasText: item.hasText !== false,
        sizes: item.sizes || [],
        qualities: item.qualities || []
      });
    });
  } catch (err) {
    console.error("Error loading products:", err);
  }

  allProductsList = dbProducts;
  renderProducts(allProductsList);
}

function renderProducts(products) {
  const container = document.getElementById('productGrid');
  if (!container) return;

  container.innerHTML = products.map(p => `
    <div class="product" style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; background: #ffffff; display: flex; flex-direction: column; justify-content: space-between;">
      <div>
        <img src="${p.imageUrl}" alt="${p.name}" style="width: 100%; height: 160px; object-fit: cover; border-radius: 6px; margin-bottom: 12px;">
        <h3 style="font-size: 16px; font-weight: 700; margin: 0 0 6px 0;">${p.name}</h3>
        <p style="font-size: 13px; color: #64748b; margin: 0 0 14px 0;">${p.description}</p>
      </div>
      <div>
        <div style="font-size: 18px; font-weight: 800; color: #16a34a; margin-bottom: 10px;">Starting ₹${p.price}</div>
        <button class="primary-button full" onclick="openProductCustomizer('${p.id}')">${p.pType === 'stock' ? 'Select & Buy →' : 'Customize & Design →'}</button>
      </div>
    </div>
  `).join('');
}

// Open Product Customizer Modal
window.openProductCustomizer = function(productId) {
  selectedProduct = allProductsList.find(p => p.id === productId);
  if (!selectedProduct) return;

  document.getElementById('customTitle').innerText = selectedProduct.name;
  document.getElementById('personalMessageInput').value = '';
  rawUploadedPhotoDataUrl = null;
  frontCanvasJSON = null;
  backCanvasJSON = null;
  activeSide = 'front';

  const isCustom = selectedProduct.pType === 'customizable';
  const canvasContainer = document.getElementById('canvasContainer');
  const canvasControls = document.getElementById('canvasControls');
  const finishedMockupLink = document.getElementById('finishedMockupLink');
  const btnViewBack = document.getElementById('btnViewBack');

  if (isCustom) {
    canvasContainer.style.display = 'block';
    canvasControls.style.display = 'block';

    if (selectedProduct.finishedLink) {
      finishedMockupLink.href = selectedProduct.finishedLink;
      finishedMockupLink.style.display = 'inline-block';
    } else {
      finishedMockupLink.style.display = 'none';
    }

    if (selectedProduct.backOutline) {
      btnViewBack.style.display = 'inline-block';
    } else {
      btnViewBack.style.display = 'none';
    }

    initFabricCanvas();
    loadOutlineOnCanvas(selectedProduct.frontOutline);

    document.getElementById('photoSection').style.display = selectedProduct.hasPhoto ? 'block' : 'none';
    document.getElementById('textSection').style.display = selectedProduct.hasText ? 'block' : 'none';
  } else {
    canvasContainer.style.display = 'none';
    canvasControls.style.display = 'none';
    document.getElementById('photoSection').style.display = 'none';
    document.getElementById('textSection').style.display = 'none';
  }

  // Populate Sizes & Qualities
  populateDropdown('sizeSection', 'sizeSelect', selectedProduct.sizes);
  populateDropdown('qualitySection', 'qualitySelect', selectedProduct.qualities);

  recalculatePrice();
  openModal('productModal');
};

function populateDropdown(sectionId, selectId, options) {
  const section = document.getElementById(sectionId);
  const select = document.getElementById(selectId);
  if (options && options.length > 0) {
    section.style.display = 'block';
    select.innerHTML = options.map((opt, idx) => `
      <option value="${idx}">${opt.name} ${opt.extra > 0 ? '(+₹' + opt.extra + ')' : ''}</option>
    `).join('');
  } else {
    section.style.display = 'none';
  }
}

function loadOutlineOnCanvas(outlineUrl) {
  fabricCanvas.clear();
  fabricCanvas.setBackgroundColor('#ffffff', fabricCanvas.renderAll.bind(fabricCanvas));
  if (outlineUrl) {
    fabric.Image.fromURL(outlineUrl, function(img) {
      img.scaleToWidth(350);
      img.scaleToHeight(380);
      fabricCanvas.setBackgroundImage(img, fabricCanvas.renderAll.bind(fabricCanvas), {
        originX: 'left',
        originY: 'top'
      });
    }, { crossOrigin: 'anonymous' });
  }
}

// Front / Back View Switcher
document.getElementById('btnViewFront').onclick = () => switchCanvasView('front');
document.getElementById('btnViewBack').onclick = () => switchCanvasView('back');

function switchCanvasView(targetSide) {
  if (activeSide === targetSide) return;

  // Save active canvas state
  if (activeSide === 'front') {
    frontCanvasJSON = fabricCanvas.toJSON();
  } else {
    backCanvasJSON = fabricCanvas.toJSON();
  }

  activeSide = targetSide;

  // Update UI Button Styles
  document.getElementById('btnViewFront').style.background = targetSide === 'front' ? '#0f172a' : '#e2e8f0';
  document.getElementById('btnViewFront').style.color = targetSide === 'front' ? '#fff' : '#0f172a';
  document.getElementById('btnViewBack').style.background = targetSide === 'back' ? '#0f172a' : '#e2e8f0';
  document.getElementById('btnViewBack').style.color = targetSide === 'back' ? '#fff' : '#0f172a';

  const targetOutline = targetSide === 'front' ? selectedProduct.frontOutline : selectedProduct.backOutline;
  const targetJSON = targetSide === 'front' ? frontCanvasJSON : backCanvasJSON;

  if (targetJSON) {
    fabricCanvas.loadFromJSON(targetJSON, () => {
      loadOutlineOnCanvas(targetOutline);
    });
  } else {
    loadOutlineOnCanvas(targetOutline);
  }
}

// High-Res Upload Photo Handler
const customPhotoInput = document.getElementById('customPhotoInput');
if (customPhotoInput) {
  customPhotoInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(f) {
      rawUploadedPhotoDataUrl = f.target.result; // Saved in Full High-Resolution for Admin Download

      fabric.Image.fromURL(rawUploadedPhotoDataUrl, function(img) {
        img.scaleToWidth(150);
        img.set({ left: 100, top: 100 });
        fabricCanvas.add(img);
        fabricCanvas.setActiveObject(img);
        fabricCanvas.renderAll();
      });
    };
    reader.readAsDataURL(file);
  });
}

// Add Custom Text
const addTextBtn = document.getElementById('addTextBtn');
if (addTextBtn) {
  addTextBtn.onclick = () => {
    const txt = document.getElementById('customTextInput').value.trim();
    const font = document.getElementById('fontSelect').value;
    if (!txt) return alert("Enter text!");

    const textObj = new fabric.Text(txt, {
      left: 100, top: 150, fontFamily: font, fontSize: 24, fill: '#000000'
    });
    fabricCanvas.add(textObj);
    fabricCanvas.setActiveObject(textObj);
    fabricCanvas.renderAll();
  };
}

// Delete Selected Object
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

// Recalculate Total Price
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

// Add Item to Bag
const addCustomBtn = document.getElementById('addCustomProduct');
if (addCustomBtn) {
  addCustomBtn.onclick = () => {
    if (!selectedProduct) return;

    let frontSnapshot = null;
    let backSnapshot = null;

    if (selectedProduct.pType === 'customizable') {
      if (activeSide === 'front') {
        frontSnapshot = fabricCanvas.toDataURL({ format: 'png', quality: 1.0 });
      } else {
        backSnapshot = fabricCanvas.toDataURL({ format: 'png', quality: 1.0 });
      }
    }

    const qty = Number(document.getElementById('quantity')?.value || 1);
    const personalMessage = document.getElementById('personalMessageInput').value.trim();

    cart.push({
      productId: selectedProduct.id,
      name: selectedProduct.name,
      quantity: qty,
      totalPrice: currentCalculatedPrice,
      personalMessage: personalMessage,
      frontArtwork: frontSnapshot,
      backArtwork: backSnapshot,
      rawUploadedPhoto: rawUploadedPhotoDataUrl // Passed directly to admin order
    });

    saveCart();
    closeModal('productModal');
    openDrawer('cartDrawer');
  };
}

// Admin Panel Logic
async function initAdminPanel() {
  const adminAddForm = document.getElementById('adminAddProductForm');
  const adminProductList = document.getElementById('adminProductList');
  const adminOrdersList = document.getElementById('adminOrdersList');

  if (!adminAddForm) return;

  adminAddForm.onsubmit = async (e) => {
    e.preventDefault();

    const pType = document.getElementById('pType').value;
    const name = document.getElementById('pName').value;
    const price = Number(document.getElementById('pPrice').value);
    const description = document.getElementById('pDesc').value;
    const imageUrl = document.getElementById('pImg').value;

    const frontOutline = document.getElementById('pFrontOutline').value;
    const backOutline = document.getElementById('pBackOutline').value;
    const finishedLink = document.getElementById('pFinishedLink').value;

    const hasPhoto = document.getElementById('chkPhoto').checked;
    const hasText = document.getElementById('chkText').checked;

    const parseOptions = (str) => str ? str.split(',').map(s => {
      const [n, ex] = s.split(':');
      return { name: n.trim(), extra: Number(ex || 0) };
    }) : [];

    try {
      await addDoc(collection(db, "products"), {
        pType, name, price, description, imageUrl,
        frontOutline, backOutline, finishedLink,
        hasPhoto, hasText,
        sizes: parseOptions(document.getElementById('pSizes').value),
        qualities: parseOptions(document.getElementById('pQualities').value)
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
    adminProductList.innerHTML = "";
    snap.forEach(docSnap => {
      const p = docSnap.data();
      adminProductList.innerHTML += `
        <div class="product-list-item" style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <b>${p.name}</b> (${p.pType === 'stock' ? 'Stock Item' : 'Customizable'}) - ₹${p.price}<br>
            <small>${p.description || ''}</small>
          </div>
          <button class="btn btn-danger" onclick="deleteProduct('${docSnap.id}')">Delete</button>
        </div>
      `;
    });
  }

  async function loadAdminOrders() {
    adminOrdersList.innerHTML = "Loading...";
    const snap = await getDocs(collection(db, "orders"));
    adminOrdersList.innerHTML = "";
    snap.forEach(docSnap => {
      const o = docSnap.data();
      let itemsHtml = (o.items || []).map(item => `
        <div style="border:1px solid #e2e8f0; padding:10px; margin-top:8px; border-radius:6px; background:#f8fafc;">
          <b>${item.name}</b> (Qty: ${item.quantity}) - ₹${item.totalPrice}<br>
          ${item.personalMessage ? `<div style="color:#b45309; font-size:12px;"><b>Personal Message:</b> "${item.personalMessage}"</div>` : ''}
          ${item.rawUploadedPhoto ? `<div style="margin-top:5px;"><a href="${item.rawUploadedPhoto}" download="original-customer-photo.png" style="color:#16a34a; font-weight:bold; font-size:12px;">⬇ Download ORIGINAL High-Res Customer Uploaded Photo</a></div>` : ''}
          <div style="display:flex; gap:10px; margin-top:8px;">
            ${item.frontArtwork ? `<div><small>Front View Design:</small><img src="${item.frontArtwork}" class="design-preview-box"></div>` : ''}
            ${item.backArtwork ? `<div><small>Back View Design:</small><img src="${item.backArtwork}" class="design-preview-box"></div>` : ''}
          </div>
        </div>
      `).join('');

      adminOrdersList.innerHTML += `
        <div class="order-list-item">
          <b>Order #${o.orderId || docSnap.id}</b> - ₹${o.amount}<br>
          Customer: <b>${o.customerName}</b> (${o.customerPhone})<br>
          Address: <b>${o.deliveryAddress}</b>
          <div style="margin-top: 10px;">${itemsHtml}</div>
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

// UI Cart & Modal helpers
function updateCartUI() {
  const cartCount = document.getElementById('cartCount');
  const cartItemsContainer = document.getElementById('cartItems');
  const cartTotal = document.getElementById('cartTotal');

  if (cartCount) cartCount.innerText = cart.length;
  if (cartItemsContainer) {
    let grandTotal = 0;
    cartItemsContainer.innerHTML = cart.map((item, index) => {
      grandTotal += item.totalPrice;
      return `
        <div style="border-bottom: 1px solid #eee; padding: 10px 0; display:flex; justify-size:space-between; align-items:center;">
          <div>
            <b>${item.name}</b> (Qty: ${item.quantity})<br>
            <span style="color:#16a34a; font-weight:bold;">₹${item.totalPrice}</span>
          </div>
          <button onclick="removeFromCart(${index})" style="background:#fee2e2; border:none; color:#ef4444; border-radius:4px; padding:4px 8px; cursor:pointer; font-size:12px;">Remove</button>
        </div>
      `;
    }).join('');
    if (cartTotal) cartTotal.innerText = "₹" + grandTotal;
  }
}

window.removeFromCart = (index) => { cart.splice(index, 1); saveCart(); };
window.openModal = (id) => document.getElementById(id)?.classList.add('show');
window.closeModal = (id) => document.getElementById(id)?.classList.remove('show');
window.openDrawer = (id) => document.getElementById(id)?.classList.add('open');
window.closeDrawer = (id) => document.getElementById(id)?.classList.remove('open');

document.addEventListener('DOMContentLoaded', () => {
  loadProducts();
  updateCartUI();
  initAdminPanel();
});
