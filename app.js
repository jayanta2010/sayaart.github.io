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
        imageUrl: item.imageUrl || "",
        pType: item.pType || "customizable",
        hasBack: item.hasBack === true,
        backImageUrl: item.backImageUrl || "",
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

function getEstimatedDeliveryDate() {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + 14);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function productPreviewImage(p) {
  if (p.imageUrl) return p.imageUrl;
  if (/t.?shirt|tee|hoodie|sweatshirt/i.test(String(p.name || ''))) {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="350" height="495" viewBox="0 0 350 495"><rect width="350" height="495" fill="#f8fafc"/><path d="M118 58 L151 42 Q175 65 199 42 L232 58 L290 101 L254 155 L224 138 L224 430 Q175 449 126 430 L126 138 L96 155 L60 101 Z" fill="#fff" stroke="#cbd5e1" stroke-width="3" stroke-linejoin="round"/><path d="M151 42 Q175 94 199 42" fill="none" stroke="#cbd5e1" stroke-width="4"/><text x="175" y="250" text-anchor="middle" font-family="Arial" font-size="13" fill="#94a3b8">YOUR DESIGN HERE</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="350" height="495"><rect width="100%" height="100%" fill="#f8fafc"/><rect x="30" y="30" width="290" height="435" rx="8" fill="#fff" stroke="#cbd5e1"/><text x="175" y="240" font-family="Arial" font-size="16" fill="#64748b" text-anchor="middle">Product preview</text></svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
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
        <img src="${productPreviewImage(p)}" alt="${p.name}" style="width: 100%; height: 160px; object-fit: contain; background:#f8fafc; border-radius: 6px; margin-bottom: 12px;">
        <h3 style="font-size: 16px; font-weight: 700; margin: 0 0 6px 0;">${p.name}</h3>
        <p style="font-size: 13px; color: #64748b; margin: 0 0 14px 0;">${p.description}</p>
      </div>
      <div>
        <div style="font-size: 18px; font-weight: 800; color: #16a34a; margin-bottom: 6px;">Starting ₹${p.price}</div><div class="product-delivery-date">Estimated delivery: <b>${getEstimatedDeliveryDate()}</b></div>
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
  const formatHint = document.getElementById('canvasFormatHint');
  if (formatHint) formatHint.textContent = 'A4 Portrait · Product photo preview · add your text/photo';
  const deliveryHint = document.getElementById('customizerDeliveryDate');
  if (deliveryHint) deliveryHint.textContent = 'Estimated delivery: ' + getEstimatedDeliveryDate();
  const msgInput = document.getElementById('personalMessageInput');
  if (msgInput) msgInput.value = '';

  rawUploadedPhotoDataUrl = null;
  frontCanvasJSON = null;
  backCanvasJSON = null;
  activeSide = 'front';

  const isCustom = selectedProduct.pType === 'customizable';
  const canvasContainer = document.getElementById('canvasContainer');
  const canvasControls = document.getElementById('canvasControls');
  const btnViewBack = document.getElementById('btnViewBack');

  if (isCustom) {
    if (canvasContainer) canvasContainer.style.display = 'block';
    if (canvasControls) canvasControls.style.display = 'block';

    if (btnViewBack) {
      btnViewBack.style.display = selectedProduct.hasBack ? 'inline-block' : 'none';
    }

    initFabricCanvas();
    loadOutlineOnCanvas('');

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

function applyCanvasProductBackground(done = () => {}) {
  if (!fabricCanvas) { done(); return; }
  const src = (activeSide === 'back' && selectedProduct?.backImageUrl) || productPreviewImage(selectedProduct || {});
  fabricCanvas.setBackgroundImage(null, () => {
    fabricCanvas.setBackgroundColor('#ffffff', () => {
      if (!src) { fabricCanvas.renderAll(); done(); return; }
      fabric.Image.fromURL(src, img => {
        if (!img) { fabricCanvas.renderAll(); done(); return; }
        const cw = fabricCanvas.getWidth(), ch = fabricCanvas.getHeight();
        const scale = Math.min(cw / img.width, ch / img.height);
        img.set({ originX: 'center', originY: 'center', left: cw / 2, top: ch / 2, scaleX: scale, scaleY: scale });
        fabricCanvas.setBackgroundImage(img, () => { fabricCanvas.renderAll(); done(); });
      }, { crossOrigin: 'anonymous' });
    });
  });
}
function loadOutlineOnCanvas() {
  if (!fabricCanvas) return;
  fabricCanvas.clear();
  fabricCanvas.setBackgroundColor('#ffffff');
  applyCanvasProductBackground();
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

  const targetJSON = targetSide === 'front' ? frontCanvasJSON : backCanvasJSON;
  if (targetJSON) fabricCanvas.loadFromJSON(targetJSON, () => applyCanvasProductBackground());
  else { fabricCanvas.clear(); fabricCanvas.setBackgroundColor('#ffffff'); applyCanvasProductBackground(); }
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
  addCustomBtn.onclick = async () => {
    if (!selectedProduct) return;

    let frontSnapshot = null;
    let backSnapshot = null;
    if (selectedProduct.pType === 'customizable' && selectedProduct.hasBack && activeSide === 'front' && fabricCanvas) frontCanvasJSON = fabricCanvas.toJSON();
    if (selectedProduct.pType === 'customizable' && selectedProduct.hasBack && activeSide === 'back' && fabricCanvas) backCanvasJSON = fabricCanvas.toJSON();
    if (selectedProduct.pType === 'customizable' && fabricCanvas) {
      if (activeSide === 'front' && frontCanvasJSON) fabricCanvas.loadFromJSON(frontCanvasJSON, () => fabricCanvas.renderAll());
      else if (activeSide === 'back' && backCanvasJSON) fabricCanvas.loadFromJSON(backCanvasJSON, () => fabricCanvas.renderAll());
    }

    if (selectedProduct.pType === 'customizable' && fabricCanvas) {
      const capture = side => new Promise(resolve => {
        const json = side === 'front' ? frontCanvasJSON : backCanvasJSON;
        const previousSide = activeSide;
        activeSide = side;
        const finish = () => { const data = fabricCanvas.toDataURL({ format: 'png', multiplier: 3 }); activeSide = previousSide; resolve(data); };
        if (json) fabricCanvas.loadFromJSON(json, finish);
        else if (side === activeSide) finish();
        else { fabricCanvas.clear(); fabricCanvas.setBackgroundColor('#ffffff', () => { fabricCanvas.renderAll(); finish(); }); }
      });
      frontSnapshot = await capture('front');
      if (selectedProduct.hasBack) backSnapshot = await capture('back');
      loadOutlineOnCanvas(''); activeSide = 'front'; frontCanvasJSON = null; backCanvasJSON = null;
      if (btnFront) { btnFront.style.background='#0f172a'; btnFront.style.color='#fff'; } if (btnBack) { btnBack.style.background='#e2e8f0'; btnBack.style.color='#0f172a'; }
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
      backArtwork: selectedProduct.hasBack ? backSnapshot : null,
      hasBack: !!selectedProduct.hasBack,
      rawUploadedPhoto: rawUploadedPhotoDataUrl
    });

    saveCart();
    closeModal('productModal');
    openDrawer('cartDrawer');
  };
}

// Multi-step checkout: address -> confirmation -> prepaid payment.
const checkoutForm = document.getElementById('checkoutForm');
const checkoutButton = document.getElementById('checkoutButton');
let verifiedCheckoutPhone = '';
let pinLookupTimer = null;
let currentSavedAddresses = [];

function getAddressBook(phone) {
  const key = String(phone || '').replace(/\D/g, '').slice(-10);
  if (!key) return [];
  try { return JSON.parse(localStorage.getItem('saya_addresses_' + key) || '[]').slice(0, 4); }
  catch { return []; }
}
function addressFields() {
  return {
    pincode: document.getElementById('custPincode').value.trim(),
    state: document.getElementById('custState').value.trim(),
    district: document.getElementById('custDistrict').value.trim(),
    area: document.getElementById('custArea').value.trim(),
    name: document.getElementById('custName').value.trim(),
    phone: document.getElementById('custPhone').value.replace(/\D/g, '').slice(-10),
    locality: document.getElementById('custLocality').value.trim(),
    house: document.getElementById('custHouse').value.trim(),
    landmark: document.getElementById('custLandmark').value.trim()
  };
}
function fillAddress(a) {
  for (const [field,id] of Object.entries({pincode:'custPincode',state:'custState',district:'custDistrict',name:'custName',phone:'custPhone',locality:'custLocality',house:'custHouse',landmark:'custLandmark'})) {
    document.getElementById(id).value = a[field] || '';
  }
  const area = document.getElementById('custArea');
  area.innerHTML = '';
  const opt = document.createElement('option'); opt.value = a.area || ''; opt.textContent = a.area || 'Choose post office / area'; area.appendChild(opt);
  area.value = a.area || '';
  document.getElementById('savedAddressSelect').value = a._key || '';
}
function refreshSavedAddresses(selectedKey = '') {
  const phoneField = document.getElementById('custPhone');
  const phone = phoneField?.value || localStorage.getItem('saya_last_customer_phone') || '';
  if (phoneField && !phoneField.value && phone) phoneField.value = phone;
  currentSavedAddresses = getAddressBook(phone);
  const select = document.getElementById('savedAddressSelect');
  if (!select) return;
  select.innerHTML = '<option value="">Add a new address</option>';
  currentSavedAddresses.forEach((a,i) => {
    const opt = document.createElement('option'); opt.value = String(i);
    opt.textContent = `${a.isDefault ? '★ Default · ' : ''}${a.name} — ${a.pincode}, ${a.area}`;
    select.appendChild(opt);
  });
  const defaultIndex = currentSavedAddresses.findIndex(a => a.isDefault);
  if (selectedKey !== '' && currentSavedAddresses[Number(selectedKey)]) select.value = selectedKey;
  else if (defaultIndex >= 0) { select.value = String(defaultIndex); fillAddress(currentSavedAddresses[defaultIndex]); }
  document.getElementById('addressLimitNote').textContent = `Saved addresses: ${currentSavedAddresses.length}/4 for this mobile number.`;
}
function saveCurrentAddress(showMessage = true) {
  const a = addressFields();
  if (!/^\d{10}$/.test(a.phone)) { alert('Enter a valid 10-digit mobile number first.'); return false; }
  if (!/^\d{6}$/.test(a.pincode) || !a.state || !a.district || !a.area) { alert('Enter a valid PIN code and select the post office / area.'); return false; }
  const required = ['name','locality','landmark'];
  if (required.some(k => !a[k])) { alert('Please fill in name, locality and landmark.'); return false; }
  const book = getAddressBook(a.phone);
  const existing = book.findIndex(x => x.pincode===a.pincode && x.area===a.area && x.locality===a.locality && x.house===a.house);
  if (existing >= 0) book[existing] = a;
  else if (book.length >= 4) { alert('Maximum 4 saved addresses per mobile number. Delete/replace one by selecting an existing address and saving changes.'); return false; }
  else book.push(a);
  if (!book.some(x => x.isDefault)) book[book.length - 1].isDefault = true;
  localStorage.setItem('saya_last_customer_phone', a.phone);
  localStorage.setItem('saya_addresses_' + a.phone, JSON.stringify(book));
  refreshSavedAddresses(existing >= 0 ? String(existing) : String(book.length - 1));
  if (showMessage) alert('Address saved on this device for this mobile number.');
  return true;
}
function setCheckoutStage(n) {
  document.querySelectorAll('.checkout-stage').forEach(el => { el.hidden = Number(el.dataset.stage) !== n; });
  document.querySelectorAll('[data-step-label]').forEach(el => {
    const step = Number(el.dataset.stepLabel);
    el.classList.toggle('active', step === n);
    el.classList.toggle('done', step < n);
  });
}
function formatAddress(a) {
  return [a.name, a.phone, a.house, a.locality, a.area, a.district, a.state, a.pincode, 'Landmark: ' + a.landmark].filter(Boolean).join(', ');
}
function updateCheckoutSummary() {
  const a = addressFields();
  document.getElementById('checkoutAddressSummary').textContent = formatAddress(a);
  const items = cart.map(x => `${x.name} × ${x.quantity} — ₹${x.totalPrice}`).join('\n');
  const box = document.getElementById('checkoutItemsSummary');
  box.style.whiteSpace = 'pre-line';
  box.textContent = items + '\n\nTotal: ₹' + cart.reduce((s,x)=>s+Number(x.totalPrice||0),0);
  const subtotal = cart.reduce((s,x)=>s+Number(x.totalPrice||0),0);
  const method = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'upi';
  const charge = method === 'cod' ? 1000 : 0;
  document.getElementById('checkoutPayTotal').textContent = '₹' + (subtotal + charge);
  const chargeSummary = document.getElementById('deliveryChargeSummary');
  if (chargeSummary) chargeSummary.innerHTML = 'Product subtotal: ₹' + subtotal + '<br>COD/delivery charge: ₹' + charge + '<br><b>Total payable: ₹' + (subtotal + charge) + '</b>';
}
if (checkoutButton) checkoutButton.addEventListener('click', () => {
  if (!cart.length) { alert('Your bag is empty.'); return; }
  setCheckoutStage(1);
  refreshSavedAddresses();
  closeDrawer('cartDrawer');
  openModal('checkoutModal');
});
document.getElementById('newAddressBtn')?.addEventListener('click', () => {
  document.getElementById('checkoutForm').querySelectorAll('input:not([type=radio])').forEach(el => { if (!['otpInput'].includes(el.id)) el.value=''; });
  document.getElementById('custArea').innerHTML='<option value="">Enter PIN code first</option>';
  document.getElementById('savedAddressSelect').value='';
  document.getElementById('otpSection').style.display='none';
  verifiedCheckoutPhone=''; confirmationResult=null;
  document.getElementById('placeOrderBtn').disabled=false;
});
document.getElementById('savedAddressSelect')?.addEventListener('change', e => {
  if (e.target.value === '') return;
  const a = currentSavedAddresses[Number(e.target.value)];
  if (a) { fillAddress(a); verifiedCheckoutPhone=''; document.getElementById('otpSection').style.display='none'; }
});
document.getElementById('custPhone')?.addEventListener('change', () => { refreshSavedAddresses(); if (verifiedCheckoutPhone !== document.getElementById('custPhone').value.replace(/\D/g,'').slice(-10)) { verifiedCheckoutPhone=''; confirmationResult=null; document.getElementById('otpSection').style.display='none'; } });
document.getElementById('custPincode')?.addEventListener('input', () => {
  clearTimeout(pinLookupTimer);
  const pin = document.getElementById('custPincode').value.replace(/\D/g,'').slice(0,6);
  document.getElementById('custPincode').value = pin;
  if (pin.length !== 6) { document.getElementById('custState').value=''; document.getElementById('custDistrict').value=''; document.getElementById('custArea').innerHTML='<option value="">Enter 6-digit PIN code</option>'; return; }
  pinLookupTimer=setTimeout(async () => {
    const area = document.getElementById('custArea');
    area.innerHTML='<option value="">Looking up PIN code…</option>';
    try {
      const response=await fetch('https://api.postalpincode.in/pincode/'+pin);
      const result=await response.json();
      if (result?.[0]?.Status !== 'Success' || !result[0].PostOffice?.length) throw new Error('PIN code not found');
      const offices=result[0].PostOffice;
      document.getElementById('custState').value=offices[0].State || '';
      document.getElementById('custDistrict').value=offices[0].District || '';
      area.innerHTML='';
      offices.forEach(po=>{const opt=document.createElement('option');opt.value=po.Name;opt.textContent=po.Name+' — '+po.Block;area.appendChild(opt);});
    } catch(err) { area.innerHTML='<option value="">Could not find PIN — check the code</option>'; document.getElementById('custState').value='';document.getElementById('custDistrict').value=''; }
  },300);
});
document.getElementById('saveAddressBtn')?.addEventListener('click', () => saveCurrentAddress(true));
document.getElementById('addressNextBtn')?.addEventListener('click', () => {
  const a=addressFields();
  if (!checkoutForm.querySelector('[data-stage="1"]').querySelector('#custPincode').reportValidity()) return;
  if (!/^\d{6}$/.test(a.pincode) || !a.state || !a.district || !a.area || !/^\d{10}$/.test(a.phone) || !a.name || !a.locality || !a.landmark) { alert('Please complete all required address details. PIN lookup must finish first.'); return; }
  if (verifiedCheckoutPhone !== a.phone) {
    document.getElementById('otpSection').style.display='block';
    alert('Verify this mobile number by SMS OTP before continuing.');
    return;
  }
  saveCurrentAddress(false);
  updateCheckoutSummary();setCheckoutStage(2);
});
document.getElementById('confirmDetailsBtn')?.addEventListener('click', () => { updateCheckoutSummary();setCheckoutStage(3); });
document.querySelectorAll('input[name="paymentMethod"]').forEach(input => input.addEventListener('change', updateCheckoutSummary));
document.querySelectorAll('[data-back]').forEach(btn => btn.addEventListener('click',()=>setCheckoutStage(Number(btn.dataset.back))));

function initRecaptcha() {
  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size:'invisible', callback:()=>{} });
  }
}
const sendOtpBtn = document.getElementById('sendOtpBtn');
if (sendOtpBtn) sendOtpBtn.onclick = async () => {
  const raw = document.getElementById('custPhone').value.replace(/\D/g,'').slice(-10);
  if (!/^\d{10}$/.test(raw)) return alert('Enter a valid 10-digit mobile number.');
  try {
    sendOtpBtn.disabled=true;sendOtpBtn.textContent='Sending OTP…';initRecaptcha();
    confirmationResult=await signInWithPhoneNumber(auth,'+91'+raw,window.recaptchaVerifier);
    document.getElementById('otpSection').style.display='block';
    alert('SMS OTP sent.');
  } catch(error) { alert('Could not send OTP: '+error.message); if(window.recaptchaVerifier){try{await window.recaptchaVerifier.clear();}catch{}window.recaptchaVerifier=null;} }
  finally {sendOtpBtn.disabled=false;sendOtpBtn.textContent='Send OTP';}
};
const verifyOtpBtn=document.getElementById('verifyOtpBtn');
if(verifyOtpBtn) verifyOtpBtn.onclick=async()=>{
  const code=document.getElementById('otpInput').value.trim();
  if(!code||!confirmationResult)return alert('Enter the SMS OTP first.');
  try {
    verifyOtpBtn.disabled=true;verifyOtpBtn.textContent='Verifying…';
    await confirmationResult.confirm(code);
    verifiedCheckoutPhone=document.getElementById('custPhone').value.replace(/\D/g,'').slice(-10);
    verifyOtpBtn.textContent='Verified ✓';
    alert('Mobile number verified.');
  } catch(error) { alert('OTP verification failed: '+error.message);verifyOtpBtn.textContent='Verify OTP'; }
  finally {verifyOtpBtn.disabled=false;}
};

if(checkoutForm) checkoutForm.onsubmit=async e=>{
  e.preventDefault();
  if(!cart.length)return alert('Your bag is empty.');
  const a=addressFields();
  if(verifiedCheckoutPhone!==a.phone)return alert('Verify your mobile number first.');
  const paymentMethod=checkoutForm.querySelector('input[name="paymentMethod"]:checked')?.value;
  if(!['upi','card','cod'].includes(paymentMethod))return alert('Choose UPI, card or Cash on Delivery.');
  const status=document.getElementById('paymentStatus'),button=document.getElementById('placeOrderBtn');
  button.disabled=true;button.textContent=paymentMethod==='cod'?'Placing COD order…':'Connecting securely…';status.textContent=paymentMethod==='cod'?'Placing Cash on Delivery order…':'Preparing secure payment…';
  try {
    let payment = {};
    if (paymentMethod !== 'cod') {
      const settingsSnap=await getDocs(collection(db,'settings'));
      const paymentDoc=settingsSnap.docs.find(d=>d.id==='payment');
      payment=paymentDoc?.data()||{};
      if(!payment.checkoutEndpoint)throw new Error('Online payment is not configured yet. Admin must set the secure checkout API URL in Payment Settings before taking prepaid orders.');
    }
    const makeUniqueOrderId = async () => {
      const snap = await getDocs(collection(db, 'orders'));
      const existing = new Set(snap.docs.map(d => String(d.data().orderId || '')));
      for (let attempt=0; attempt<30; attempt++) {
        const candidate = String(Math.floor(1000000000 + Math.random()*9000000000));
        if (!existing.has(candidate)) return candidate;
      }
      throw new Error('Could not generate a unique order ID. Please try again.');
    };
    const orderId = await makeUniqueOrderId();
    const subtotal = cart.reduce((sum,item)=>sum+Number(item.totalPrice||0),0);
    const deliveryCharge = paymentMethod === 'cod' ? 1000 : 0;
    const orderAmount = subtotal + deliveryCharge;
    const orderData = {
      orderId, customerName:a.name, customerPhone:'+91'+a.phone,
      deliveryAddress:formatAddress(a), address:a, items:cart, subtotal, deliveryCharge, amount:orderAmount,
      paymentMethod, paymentStatus:paymentMethod==='cod'?'cash on delivery':'pending',
      orderStatus:paymentMethod==='cod'?'COD order placed':'Payment pending',
      createdAt:new Date().toISOString()
    };
    await addDoc(collection(db,'orders'), orderData);
    if (paymentMethod === 'cod') {
      status.textContent='COD order placed. Order ID: '+orderId+'. Total including ₹1,000 COD/delivery charge: ₹'+orderAmount;
      cart = [];
      saveCart();
      closeModal('checkoutModal');
      alert('Cash on Delivery order placed. Order ID: '+orderId+' | Total: ₹'+orderAmount);
      return;
    }
    const payload={
      orderId,
      amount:orderAmount,
      currency:'INR',paymentMethod,
      customer:{name:a.name,phone:'+91'+a.phone},
      address:a,items:cart,deliveryCharge,
      returnUrl:window.location.origin+window.location.pathname+'?payment=return'
    };
    const response=await fetch(payment.checkoutEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if(!response.ok)throw new Error('Payment service returned HTTP '+response.status);
    const result=await response.json();
    if(!result.checkoutUrl)throw new Error('Payment service did not return checkoutUrl. Configure the backend to create a UPI/card checkout session.');
    status.textContent='Order ID: '+orderId+'. Redirecting to secure payment…';
    window.location.href=result.checkoutUrl;
  } catch(err) { console.error('Checkout payment error:',err);status.textContent=err.message;alert(err.message); }
  finally {button.disabled=false;button.textContent=(document.querySelector('input[name="paymentMethod"]:checked')?.value==='cod')?'Place COD order →':'Pay securely →';}
};

// ADMIN PANEL ENGINE WITH ROBUST ERROR HANDLING
async function initAdminPanel() {
  const adminAddForm = document.getElementById('adminAddProductForm');
  const adminProductList = document.getElementById('adminProductList');
  const adminOrdersList = document.getElementById('adminOrdersList');
  const adminReturnsList = document.getElementById('adminReturnsList');
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

  const backImageFile = document.getElementById('pBackImgFile');
  const backImageUrl = document.getElementById('pBackImg');
  const backImagePreview = document.getElementById('pBackImgPreview');
  const updateBackImagePreview = () => {
    if (!backImagePreview) return;
    const file = backImageFile?.files?.[0];
    if (file) { backImagePreview.src = URL.createObjectURL(file); backImagePreview.style.display = 'block'; }
    else if (backImageUrl?.value.trim()) { backImagePreview.src = backImageUrl.value.trim(); backImagePreview.style.display = 'block'; }
    else { backImagePreview.src = ''; backImagePreview.style.display = 'none'; }
  };
  backImageFile?.addEventListener('change', updateBackImagePreview);
  backImageUrl?.addEventListener('input', updateBackImagePreview);

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
    const backChoice = document.getElementById('pHasBack'); if (backChoice) backChoice.checked = false;
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
        backImageUrl: await getImageValue('pBackImgFile', 'pBackImg', previous.backImageUrl),
        hasBack: document.getElementById('pHasBack')?.checked ?? (previous.hasBack ?? false),
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
      const backImageUrlField = document.getElementById('pBackImg');
      if (backImageUrlField) backImageUrlField.value = p.backImageUrl && !p.backImageUrl.startsWith('data:') ? p.backImageUrl : '';
      const backPreview = document.getElementById('pBackImgPreview');
      if (backPreview && p.backImageUrl) { backPreview.src=p.backImageUrl; backPreview.style.display='block'; }
      else if (backPreview) { backPreview.src=''; backPreview.style.display='none'; }
      document.getElementById('pHasBack').checked = !!p.hasBack;
      document.getElementById('pSizes').value = formatOptions(p.sizes);
      document.getElementById('pQualities').value = formatOptions(p.qualities);
      document.getElementById('pHasBack').checked = !!p.hasBack;
      document.getElementById('chkPhoto').checked = p.hasPhoto !== false;
      document.getElementById('chkText').checked = p.hasText !== false;
      ['pImgFile','pBackImgFile','pFrontOutlineFile','pBackOutlineFile','pFinishedLinkFile'].forEach(id => { const input=document.getElementById(id); if(input) input.value=''; });
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

  async function loadAdminReturns() {
    if (!adminReturnsList) return;
    adminReturnsList.innerHTML = '<p>Loading return requests…</p>';
    try {
      const snap = await getDocs(collection(db, 'returns'));
      if (snap.empty) { adminReturnsList.innerHTML = '<p>No return requests yet.</p>'; return; }
      adminReturnsList.innerHTML = '';
      snap.docs.sort((a,b)=>String(b.data().createdAt||'').localeCompare(String(a.data().createdAt||''))).forEach(returnDoc => {
        const r = returnDoc.data();
        const card = document.createElement('article');
        card.className = 'order-list-item';
        const heading = document.createElement('h4'); heading.textContent = 'Return for Order #' + (r.orderId || 'N/A') + ' · ' + (r.status || 'Pending approval');
        const details = document.createElement('p'); details.textContent = (r.customerName||'Customer') + ' · ' + (r.customerPhone||'') + ' · ' + (r.reason||'No reason supplied') + ' · Submitted: ' + (r.createdAt||'');
        card.append(heading,details);
        const photos = document.createElement('div'); photos.style.cssText='display:flex;gap:10px;flex-wrap:wrap;margin:10px 0';
        (r.photos||[]).forEach((src,i)=>{const link=document.createElement('a');link.href=src;link.target='_blank';link.rel='noopener';const img=document.createElement('img');img.src=src;img.alt='Return evidence '+(i+1);img.style.cssText='width:120px;height:120px;object-fit:cover;border-radius:8px;border:1px solid #dbe4ed';link.appendChild(img);photos.appendChild(link);});
        card.appendChild(photos);
        const actions=document.createElement('div');actions.style.cssText='display:flex;gap:8px;flex-wrap:wrap';
        ['Approved','Rejected','More information required'].forEach(status=>{
          const btn=document.createElement('button');btn.className='btn'+(status==='Rejected'?' btn-danger':'');btn.type='button';btn.textContent=status;
          btn.addEventListener('click',async()=>{try{await updateDoc(doc(db,'returns',returnDoc.id),{status,reviewedAt:new Date().toISOString()});loadAdminReturns();}catch(e){alert('Could not update return status: '+e.message);}});
          actions.appendChild(btn);
        });
        card.appendChild(actions);adminReturnsList.appendChild(card);
      });
    } catch(err) { adminReturnsList.textContent='Could not load return requests: '+err.message; }
  }

  loadAdminProducts();
  loadAdminOrders();
  loadAdminReturns();
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
    el.setAttribute('aria-hidden', 'false');
  }
};

window.closeModal = function(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('show');
    el.style.display = 'none';
    el.setAttribute('aria-hidden', 'true');
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
  const menuToggle = document.getElementById('storeMenuToggle');
  const storeSidebar = document.getElementById('storeSidebar');
  const sidebarScrim = document.getElementById('sidebarScrim');
  const closeStoreSidebar = () => { storeSidebar?.classList.remove('mobile-open'); sidebarScrim?.classList.remove('show'); menuToggle?.setAttribute('aria-expanded','false'); };
  menuToggle?.addEventListener('click', () => { const open = !storeSidebar?.classList.contains('mobile-open'); storeSidebar?.classList.toggle('mobile-open', open); sidebarScrim?.classList.toggle('show', open); menuToggle.setAttribute('aria-expanded', String(open)); });
  sidebarScrim?.addEventListener('click', closeStoreSidebar);
  storeSidebar?.querySelectorAll('a').forEach(link => link.addEventListener('click', closeStoreSidebar));
  document.addEventListener('click', event => {
    const closeButton = event.target.closest('[data-close]');
    if (closeButton) {
      const id = closeButton.getAttribute('data-close');
      if (id === 'cartDrawer') window.closeDrawer(id); else window.closeModal(id);
      return;
    }
    if (event.target.classList?.contains('modal')) window.closeModal(event.target.id);
  });
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
