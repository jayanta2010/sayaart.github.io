import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

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
let confirmationResult = null; // Store Phone OTP Session

function saveCart() {
  localStorage.setItem('saya_cart', JSON.stringify(cart));
  updateCartUI();
}

function initFabricCanvas() {
  if (!fabricCanvas && document.getElementById('designCanvas')) {
    fabricCanvas = new fabric.Canvas('designCanvas', { backgroundColor: '#ffffff', preserveObjectStacking: true });
    fabricCanvas.on('selection:created', e => updateSelectedObjectSettings(e.selected?.[0]));
    fabricCanvas.on('selection:updated', e => updateSelectedObjectSettings(e.selected?.[0]));
    fabricCanvas.on('selection:cleared', () => updateSelectedObjectSettings(null));
  }
}

// Storefront - Load Products
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
    console.error("Error loading storefront products:", err);
  }

  allProductsList = dbProducts;
  renderProducts(allProductsList);
}

function renderProducts(products) {
  const container = document.getElementById('productGrid');
  if (!container) return;

  if (products.length === 0) {
    container.innerHTML = "<p style='color:#64748b;'>No products available yet.</p>";
    return;
  }

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
  const msgInput = document.getElementById('personalMessageInput');
  if (msgInput) msgInput.value = '';

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
    if (canvasContainer) canvasContainer.style.display = 'block';
    if (canvasControls) canvasControls.style.display = 'block';

    if (finishedMockupLink) {
      if (selectedProduct.finishedLink) {
        finishedMockupLink.href = selectedProduct.finishedLink;
        finishedMockupLink.style.display = 'inline-block';
      } else {
        finishedMockupLink.style.display = 'none';
      }
    }

    if (btnViewBack) {
      btnViewBack.style.display = selectedProduct.backOutline ? 'inline-block' : 'none';
    }

    initFabricCanvas();
    loadOutlineOnCanvas(selectedProduct.frontOutline);

    const photoSec = document.getElementById('photoSection');
    const textSec = document.getElementById('textSection');
    if (photoSec) photoSec.style.display = selectedProduct.hasPhoto ? 'block' : 'none';
    if (textSec) textSec.style.display = selectedProduct.hasText ? 'block' : 'none';
  } else {
    if (canvasContainer) canvasContainer.style.display = 'none';
    if (canvasControls) canvasControls.style.display = 'none';
    const photoSec = document.getElementById('photoSection');
    const textSec = document.getElementById('textSection');
    if (photoSec) photoSec.style.display = 'none';
    if (textSec) textSec.style.display = 'none';
  }

  populateDropdown('sizeSection', 'sizeSelect', selectedProduct.sizes);
  populateDropdown('qualitySection', 'qualitySelect', selectedProduct.qualities);

  recalculatePrice();
  openModal('productModal');
};

function populateDropdown(sectionId, selectId, options) {
  const section = document.getElementById(sectionId);
  const select = document.getElementById(selectId);
  if (!section || !select) return;

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
  if (!fabricCanvas) return;
  fabricCanvas.clear();
  fabricCanvas.setBackgroundColor('#ffffff', fabricCanvas.renderAll.bind(fabricCanvas));
  if (outlineUrl) {
    fabric.Image.fromURL(outlineUrl, function(img) {
      img.scaleToWidth(350);
      img.scaleToHeight(495);
      fabricCanvas.setBackgroundImage(img, fabricCanvas.renderAll.bind(fabricCanvas), {
        originX: 'left',
        originY: 'top'
      });
    }, { crossOrigin: 'anonymous' });
  }
}

// Front / Back View Switcher
const btnFront = document.getElementById('btnViewFront');
const btnBack = document.getElementById('btnViewBack');

if (btnFront) btnFront.onclick = () => switchCanvasView('front');
if (btnBack) btnBack.onclick = () => switchCanvasView('back');

function switchCanvasView(targetSide) {
  if (activeSide === targetSide || !fabricCanvas) return;

  if (activeSide === 'front') {
    frontCanvasJSON = fabricCanvas.toJSON();
  } else {
    backCanvasJSON = fabricCanvas.toJSON();
  }

  activeSide = targetSide;

  if (btnFront) {
    btnFront.style.background = targetSide === 'front' ? '#0f172a' : '#e2e8f0';
    btnFront.style.color = targetSide === 'front' ? '#fff' : '#0f172a';
  }
  if (btnBack) {
    btnBack.style.background = targetSide === 'back' ? '#0f172a' : '#e2e8f0';
    btnBack.style.color = targetSide === 'back' ? '#fff' : '#0f172a';
  }

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

// Upload High-Res Original Photo
const customPhotoInput = document.getElementById('customPhotoInput');
if (customPhotoInput) {
  customPhotoInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(f) {
      rawUploadedPhotoDataUrl = f.target.result;

      if (fabricCanvas) {
        fabric.Image.fromURL(rawUploadedPhotoDataUrl, function(img) {
          img.scaleToWidth(150);
          img.set({ left: 100, top: 100, cornerStyle: 'circle', transparentCorners: false });
          fabricCanvas.add(img);
          fabricCanvas.setActiveObject(img);
          updateSelectedObjectSettings(img);
          fabricCanvas.renderAll();
        });
      }
    };
    reader.readAsDataURL(file);
  });
}

// Add Text to Canvas
const addTextBtn = document.getElementById('addTextBtn');
if (addTextBtn) {
  addTextBtn.onclick = () => {
    const txtInput = document.getElementById('customTextInput');
    const txt = txtInput ? txtInput.value.trim() : '';
    const font = document.getElementById('fontSelect')?.value || 'Manrope';
    if (!txt) return alert("Please enter text!");

    if (fabricCanvas) {
      const textObj = new fabric.Text(txt, {
        left: 100, top: 150, fontFamily: font, fontSize: 24, fill: '#000000'
      });
      fabricCanvas.add(textObj);
      fabricCanvas.setActiveObject(textObj);
      updateSelectedObjectSettings(textObj);
      fabricCanvas.renderAll();
    }
  };
}

// Selected photo/text editing controls
function updateSelectedObjectSettings(obj) {
  const scale = document.getElementById('objectScale'), rotate = document.getElementById('objectRotate'), color = document.getElementById('objectColor'), hint = document.getElementById('selectionHint');
  if (!obj) { if (hint) hint.textContent = 'Select a photo or text on the canvas to edit its settings.'; return; }
  if (scale) scale.value = String(Math.max(10, Math.min(250, Math.round((obj.scaleX || 1) * 100))));
  if (rotate) rotate.value = String(Math.round(obj.angle || 0));
  if (color) color.value = /^#[0-9a-f]{6}$/i.test(obj.fill || '') ? obj.fill : '#111111';
  if (hint) hint.textContent = obj.type === 'image' ? 'Photo selected · resize, rotate or drag it. Original upload is kept for print.' : 'Text selected · resize, rotate, change colour or drag it.';
}
function getActiveDesignObject() { return fabricCanvas && fabricCanvas.getActiveObject(); }
const objectScaleControl = document.getElementById('objectScale'), objectRotateControl = document.getElementById('objectRotate'), objectColorControl = document.getElementById('objectColor');
if (objectScaleControl) objectScaleControl.addEventListener('input', () => { const o = getActiveDesignObject(); if (o) { const v = Number(objectScaleControl.value) / 100; o.scale(v); o.setCoords(); fabricCanvas.requestRenderAll(); } });
if (objectRotateControl) objectRotateControl.addEventListener('input', () => { const o = getActiveDesignObject(); if (o) { o.rotate(Number(objectRotateControl.value)); o.setCoords(); fabricCanvas.requestRenderAll(); } });
if (objectColorControl) objectColorControl.addEventListener('input', () => { const o = getActiveDesignObject(); if (o && (o.type === 'text' || o.type === 'i-text')) { o.set('fill', objectColorControl.value); fabricCanvas.requestRenderAll(); } });

// Delete Selected Object
const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
if (deleteSelectedBtn) {
  deleteSelectedBtn.onclick = () => {
    if (!fabricCanvas) return;
    const activeObj = fabricCanvas.getActiveObject();
    if (activeObj) {
      fabricCanvas.remove(activeObj);
      fabricCanvas.renderAll();
    }
  };
}

// Recalculate Dynamic Price
function recalculatePrice() {
  if (!selectedProduct) return;
  let unitPrice = selectedProduct.price;

  const sizeSelect = document.getElementById('sizeSelect');
  if (selectedProduct.sizes?.length && sizeSelect && sizeSelect.value !== '') {
    unitPrice += Number(selectedProduct.sizes[Number(sizeSelect.value)]?.extra || 0);
  }

  const qualitySelect = document.getElementById('qualitySelect');
  if (selectedProduct.qualities?.length && qualitySelect && qualitySelect.value !== '') {
    unitPrice += Number(selectedProduct.qualities[Number(qualitySelect.value)]?.extra || 0);
  }

  const qtyInput = document.getElementById('quantity');
  const qty = Number(qtyInput?.value || 1);
  currentCalculatedPrice = unitPrice * (qty > 0 ? qty : 1);

  const priceDisp = document.getElementById('customPriceDisplay');
  if (priceDisp) {
    priceDisp.innerText = `₹${currentCalculatedPrice} (₹${unitPrice} / item)`;
  }
}

// Add Item to Bag
const addCustomBtn = document.getElementById('addCustomProduct');
if (addCustomBtn) {
  addCustomBtn.onclick = () => {
    if (!selectedProduct) return;

    let frontSnapshot = null;
    let backSnapshot = null;

    if (selectedProduct.pType === 'customizable' && fabricCanvas) {
      if (activeSide === 'front') {
        frontSnapshot = fabricCanvas.toDataURL({ format: 'png', quality: 1.0 });
      } else {
        backSnapshot = fabricCanvas.toDataURL({ format: 'png', quality: 1.0 });
      }
    }

    const qtyInput = document.getElementById('quantity');
    const qty = Number(qtyInput?.value || 1);
    const msgInput = document.getElementById('personalMessageInput');
    const personalMessage = msgInput ? msgInput.value.trim() : '';

    cart.push({
      productId: selectedProduct.id,
      name: selectedProduct.name,
      quantity: qty,
      totalPrice: currentCalculatedPrice,
      personalMessage: personalMessage,
      frontArtwork: frontSnapshot,
      backArtwork: backSnapshot,
      rawUploadedPhoto: rawUploadedPhotoDataUrl
    });

    saveCart();
    closeModal('productModal');
    openDrawer('cartDrawer');
  };
}

// Phone OTP Authentication Engine
function initRecaptcha() {
  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      'size': 'invisible',
      'callback': () => {}
    });
  }
}

const sendOtpBtn = document.getElementById('sendOtpBtn');
if (sendOtpBtn) {
  sendOtpBtn.onclick = async () => {
    let phoneNumber = document.getElementById('custPhone').value.trim();
    if (!phoneNumber) return alert("Please enter mobile number!");

    if (!phoneNumber.startsWith('+')) {
      phoneNumber = '+91' + phoneNumber;
    }

    initRecaptcha();
    const appVerifier = window.recaptchaVerifier;

    try {
      sendOtpBtn.innerText = "Sending...";
      sendOtpBtn.disabled = true;
      confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      alert("SMS OTP Sent!");
      document.getElementById('otpSection').style.display = 'block';
      sendOtpBtn.innerText = "Resend OTP";
      sendOtpBtn.disabled = false;
    } catch (error) {
      console.error("OTP Error:", error);
      alert("SMS Error: " + error.message);
      sendOtpBtn.innerText = "Send OTP";
      sendOtpBtn.disabled = false;
    }
  };
}

const verifyOtpBtn = document.getElementById('verifyOtpBtn');
if (verifyOtpBtn) {
  verifyOtpBtn.onclick = async () => {
    const code = document.getElementById('otpInput').value.trim();
    if (!code || !confirmationResult) return alert("Enter 6-digit OTP!");

    try {
      verifyOtpBtn.innerText = "Verifying...";
      await confirmationResult.confirm(code);
      alert("Phone Number Verified!");
      verifyOtpBtn.innerText = "Verified ✓";
      verifyOtpBtn.style.background = "#059669";
      
      const placeOrderBtn = document.getElementById('placeOrderBtn');
      if (placeOrderBtn) {
        placeOrderBtn.disabled = false;
        placeOrderBtn.style.opacity = '1';
        placeOrderBtn.style.cursor = 'pointer';
      }
    } catch (error) {
      alert("Invalid OTP! Try again.");
      verifyOtpBtn.innerText = "Verify OTP";
    }
  };
}

// Checkout Form Submission
const checkoutForm = document.getElementById('checkoutForm');
if (checkoutForm) {
  checkoutForm.onsubmit = async (e) => {
    e.preventDefault();
    if (cart.length === 0) return alert("Cart is empty!");

    const name = document.getElementById('custName').value;
    const phone = document.getElementById('custPhone').value;
    const address = document.getElementById('custAddress').value;
    const totalAmount = cart.reduce((sum, item) => sum + item.totalPrice, 0);

    try {
      await addDoc(collection(db, "orders"), {
        orderId: 'ORD-' + Date.now(),
        customerName: name,
        customerPhone: phone,
        deliveryAddress: address,
        items: cart,
        amount: totalAmount,
        createdAt: new Date().toISOString()
      });

      alert("Order Successful!");
      cart = [];
      saveCart();
      closeModal('checkoutModal');
      closeDrawer('cartDrawer');
    } catch (err) {
      alert("Order failed: " + err.message);
    }
  };
}

// ADMIN PANEL ENGINE WITH ROBUST ERROR HANDLING
async function initAdminPanel() {
  const adminAddForm = document.getElementById('adminAddProductForm');
  const adminProductList = document.getElementById('adminProductList');
  const adminOrdersList = document.getElementById('adminOrdersList');
  const pTypeSelect = document.getElementById('pType');
  const customOnlyFields = document.getElementById('customOnlyFields');

  if (pTypeSelect && customOnlyFields) {
    pTypeSelect.addEventListener('change', (e) => {
      if (e.target.value === 'stock') {
        customOnlyFields.style.display = 'none';
      } else {
        customOnlyFields.style.display = 'block';
      }
    });
  }

  if (!adminAddForm) return;

  let editingProductId = null;

  const parseOptions = (str) => str ? str.split(',').map(s => {
    const [n, ex] = s.split(':');
    return { name: n.trim(), extra: Number(ex || 0) };
  }).filter(option => option.name) : [];
  const formatOptions = (options) => (options || []).map(option => `${option.name}:${Number(option.extra || 0)}`).join(', ');

  // Resize local uploads before storing them in Firestore (document limit is 1 MiB).
  async function compressImageFile(file) {
    if (!file) return '';
    if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Could not read selected image.'));
      reader.readAsDataURL(file);
    });
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Could not open selected image.'));
      image.src = dataUrl;
    });
    const maxSide = 1000;
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.72);
  }

  async function getImageValue(fileId, urlId, previousValue = '') {
    const file = document.getElementById(fileId)?.files?.[0];
    const url = document.getElementById(urlId)?.value.trim() || '';
    if (file) return await compressImageFile(file);
    return url || previousValue || '';
  }

  function resetProductEditor() {
    editingProductId = null;
    adminAddForm.reset();
    document.getElementById('saveProductBtn').textContent = 'Add Product to Store';
    document.getElementById('cancelEditProductBtn').style.display = 'none';
    document.querySelector('#productsTab h3').textContent = 'Add a product';
    if (pTypeSelect && customOnlyFields) customOnlyFields.style.display = 'block';
  }

  document.getElementById('cancelEditProductBtn')?.addEventListener('click', resetProductEditor);

  // Add a new product or save edits to an existing catalogue item.
  adminAddForm.onsubmit = async (e) => {
    e.preventDefault();
    const saveButton = document.getElementById('saveProductBtn');
    saveButton.disabled = true;
    saveButton.textContent = editingProductId ? 'Saving changes…' : 'Adding product…';
    try {
      const previous = editingProductId ? (await getDocs(collection(db, "products"))).docs.find(d => d.id === editingProductId)?.data() || {} : {};
      const pType = document.getElementById('pType').value;
      const name = document.getElementById('pName').value.trim();
      const price = Number(document.getElementById('pPrice').value);
      const description = document.getElementById('pDesc').value.trim();
      const productData = {
        pType, name, price, description,
        imageUrl: await getImageValue('pImgFile', 'pImg', previous.imageUrl),
        frontOutline: await getImageValue('pFrontOutlineFile', 'pFrontOutline', previous.frontOutline),
        backOutline: await getImageValue('pBackOutlineFile', 'pBackOutline', previous.backOutline),
        finishedLink: await getImageValue('pFinishedLinkFile', 'pFinishedLink', previous.finishedLink),
        hasPhoto: document.getElementById('chkPhoto')?.checked ?? true,
        hasText: document.getElementById('chkText')?.checked ?? true,
        sizes: parseOptions(document.getElementById('pSizes').value),
        qualities: parseOptions(document.getElementById('pQualities').value)
      };
      if (editingProductId) {
        await updateDoc(doc(db, "products", editingProductId), productData);
        alert("Product updated successfully!");
      } else {
        await addDoc(collection(db, "products"), productData);
        alert("Product added successfully!");
      }
      resetProductEditor();
      await loadAdminProducts();
      await loadProducts();
    } catch (err) {
      alert("Could not save product: " + err.message);
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = editingProductId ? 'Save Product Changes' : 'Add Product to Store';
    }
  };

  window.editProduct = async (id) => {
    try {
      const snap = await getDocs(collection(db, "products"));
      const found = snap.docs.find(d => d.id === id);
      if (!found) throw new Error('Product not found.');
      const p = found.data();
      editingProductId = id;
      document.getElementById('pType').value = p.pType || 'customizable';
      document.getElementById('pName').value = p.name || '';
      document.getElementById('pPrice').value = p.price ?? '';
      document.getElementById('pDesc').value = p.description || '';
      document.getElementById('pImg').value = p.imageUrl && !p.imageUrl.startsWith('data:') ? p.imageUrl : '';
      document.getElementById('pFrontOutline').value = p.frontOutline && !p.frontOutline.startsWith('data:') ? p.frontOutline : '';
      document.getElementById('pBackOutline').value = p.backOutline && !p.backOutline.startsWith('data:') ? p.backOutline : '';
      document.getElementById('pFinishedLink').value = p.finishedLink && !p.finishedLink.startsWith('data:') ? p.finishedLink : '';
      document.getElementById('pSizes').value = formatOptions(p.sizes);
      document.getElementById('pQualities').value = formatOptions(p.qualities);
      document.getElementById('chkPhoto').checked = p.hasPhoto !== false;
      document.getElementById('chkText').checked = p.hasText !== false;
      ['pImgFile','pFrontOutlineFile','pBackOutlineFile','pFinishedLinkFile'].forEach(id => { const input=document.getElementById(id); if(input) input.value=''; });
      if (customOnlyFields) customOnlyFields.style.display = p.pType === 'stock' ? 'none' : 'block';
      document.getElementById('saveProductBtn').textContent = 'Save Product Changes';
      document.getElementById('cancelEditProductBtn').style.display = 'inline-block';
      document.querySelector('#productsTab h3').textContent = 'Edit product';
      adminAddForm.scrollIntoView({behavior:'smooth',block:'start'});
    } catch (err) {
      alert('Could not open product for editing: ' + err.message);
    }
  };

  // Load Catalogue
  async function loadAdminProducts() {
    if (!adminProductList) return;
    adminProductList.innerHTML = "<p style='color:#2563eb;'>Loading catalogue...</p>";

    try {
      const snap = await getDocs(collection(db, "products"));
      if (snap.empty) {
        adminProductList.innerHTML = "<p style='color:#64748b;'>No products added yet.</p>";
        return;
      }

      adminProductList.innerHTML = "";
      snap.forEach(docSnap => {
        const p = docSnap.data();
        const card = document.createElement('div');
        card.className = 'product-list-item';
        card.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;border:1px solid #cbd5e1;padding:12px;margin-bottom:10px;border-radius:10px;background:#fff;';
        const details = document.createElement('div');
        details.style.cssText = 'display:flex;align-items:center;gap:12px;min-width:0;flex:1;';
        if (p.imageUrl) {
          const img = document.createElement('img');
          img.src = p.imageUrl; img.alt = p.name || 'Product image';
          img.style.cssText = 'width:76px;height:76px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0;';
          details.appendChild(img);
        }
        const textBox = document.createElement('div');
        const title = document.createElement('b');
        title.textContent = (p.name || 'Product') + ' (' + (p.pType === 'stock' ? 'Stock Item' : 'Customizable') + ') — ₹' + (p.price ?? 0);
        const desc = document.createElement('div'); desc.textContent = p.description || '';
        desc.style.cssText = 'color:#64748b;font-size:12px;margin-top:5px;';
        textBox.append(title, desc); details.appendChild(textBox);
        const actions = document.createElement('div'); actions.style.cssText='display:flex;gap:8px;flex-wrap:wrap;';
        const edit = document.createElement('button'); edit.className='btn'; edit.type='button'; edit.textContent='✎ Edit';
        edit.addEventListener('click', () => window.editProduct(docSnap.id));
        const del = document.createElement('button'); del.className='btn btn-danger'; del.type='button'; del.textContent='Delete';
        del.addEventListener('click', () => window.deleteProduct(docSnap.id));
        actions.append(edit,del); card.append(details,actions); adminProductList.appendChild(card);
      });
    } catch (err) {
      console.error("Firestore Product Load Error:", err);
      adminProductList.innerHTML = `<p style='color:#ef4444;'><b>Error loading catalogue:</b> ${err.message}<br><small>Check Firebase Firestore Rules</small></p>`;
    }
  }

  // Load Orders & High-Res Artworks
  async function loadAdminOrders() {
    if (!adminOrdersList) return;
    adminOrdersList.innerHTML = "<p style='color:#2563eb;'>Loading orders...</p>";

    try {
      const snap = await getDocs(collection(db, "orders"));
      if (snap.empty) {
        adminOrdersList.innerHTML = "<p style='color:#64748b;'>No orders placed yet.</p>";
        return;
      }

      adminOrdersList.innerHTML = "";
      snap.forEach(docSnap => {
        const o = docSnap.data();
        let itemsHtml = (o.items || []).map(item => `
          <div style="border:1px solid #e2e8f0; padding:10px; margin-top:8px; border-radius:6px; background:#f8fafc;">
            <b>${item.name}</b> (Qty: ${item.quantity}) - ₹${item.totalPrice}<br>
            ${item.personalMessage ? `<div style="color:#b45309; font-size:12px; margin-top:4px;"><b>Personal Message:</b> "${item.personalMessage}"</div>` : ''}
            ${item.rawUploadedPhoto ? `<div style="margin-top:5px;"><a href="${item.rawUploadedPhoto}" download="original-customer-photo.png" style="color:#16a34a; font-weight:bold; font-size:12px; text-decoration:underline;">⬇ Download High-Res Original Customer Photo</a></div>` : ''}
            <div style="display:flex; gap:10px; margin-top:8px;">
              ${item.frontArtwork ? `<div><small>Front View Design:</small><br><img src="${item.frontArtwork}" class="design-preview-box"></div>` : ''}
              ${item.backArtwork ? `<div><small>Back View Design:</small><br><img src="${item.backArtwork}" class="design-preview-box"></div>` : ''}
            </div>
          </div>
        `).join('');

        adminOrdersList.innerHTML += `
          <div class="order-list-item" style="border:1px solid #cbd5e1; padding:15px; border-radius:8px; margin-bottom:15px; background:#fff;">
            <b>Order #${o.orderId || docSnap.id}</b> - <span style="color:#16a34a; font-weight:bold;">₹${o.amount}</span><br>
            Customer: <b>${o.customerName || 'N/A'}</b> (${o.customerPhone || 'N/A'})<br>
            Address: <b>${o.deliveryAddress || 'N/A'}</b>
            <div style="margin-top: 10px;">${itemsHtml}</div>
          </div>
        `;
      });
    } catch (err) {
      console.error("Firestore Orders Load Error:", err);
      adminOrdersList.innerHTML = `<p style='color:#ef4444;'><b>Error loading orders:</b> ${err.message}<br><small>Check Firebase Firestore Rules</small></p>`;
    }
  }

  window.deleteProduct = async (id) => {
    if (confirm("Delete product?")) {
      try {
        await deleteDoc(doc(db, "products", id));
        loadAdminProducts();
      } catch (err) {
        alert("Failed to delete product: " + err.message);
      }
    }
  };

  loadAdminProducts();
  loadAdminOrders();
}

// UI Helpers
window.updateCartUI = function() {
  const cartCount = document.getElementById('cartCount');
  const cartItemsContainer = document.getElementById('cartItems');
  const cartTotal = document.getElementById('cartTotal');

  if (cartCount) cartCount.innerText = cart.length;
  if (cartItemsContainer) {
    let grandTotal = 0;
    cartItemsContainer.innerHTML = cart.map((item, index) => {
      grandTotal += item.totalPrice;
      return `
        <div style="border-bottom: 1px solid #eee; padding: 10px 0; display:flex; justify-content:space-between; align-items:center;">
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
};

window.removeFromCart = (index) => { cart.splice(index, 1); saveCart(); };

window.openModal = function(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('show');
    el.style.display = 'flex';
  }
};

window.closeModal = function(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('show');
    el.style.display = 'none';
  }
};

window.openDrawer = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
};

window.closeDrawer = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
};

// Application Initialization
document.addEventListener('DOMContentLoaded', () => {
  loadProducts();
  window.updateCartUI();
  const searchForm = document.getElementById('storeSearchForm');
  const searchInput = document.getElementById('storeSearchInput');
  if (searchForm && searchInput) {
    const runSearch = () => {
      const query = searchInput.value.trim().toLowerCase();
      const filtered = !query ? allProductsList : allProductsList.filter(product =>
        [product.name, product.description, product.pType].some(value => String(value || '').toLowerCase().includes(query))
      );
      renderProducts(filtered);
      const productSection = document.getElementById('products');
      if (query && productSection) productSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    searchForm.addEventListener('submit', event => { event.preventDefault(); runSearch(); });
    searchInput.addEventListener('input', () => {
      if (!searchInput.value.trim()) renderProducts(allProductsList);
    });
  }
  if (typeof initAdminPanel === 'function') {
    initAdminPanel();
  }
});
