import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

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
  const container = document.getElementById('productGrid') || document.getElementById('allProductsGrid');
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
        category: String(item.category || '').trim(),
        storefrontSection: String(item.storefrontSection || '').trim(),
        price: Number(item.price) || 0,
        imageUrl: item.imageUrl || (Array.isArray(item.galleryImages) ? item.galleryImages[0] : "") || "",
        galleryImages: Array.isArray(item.galleryImages) ? item.galleryImages.filter(Boolean).slice(0,5) : (item.imageUrl ? [item.imageUrl] : []),
        pType: item.pType || "customizable",
        hasBack: item.hasBack === true,
        backImageUrl: item.backImageUrl || "",
        hasPhoto: item.hasPhoto !== false,
        hasText: item.hasText !== false,
        sizes: item.sizes || [],
        qualities: item.qualities || [],
        stockStatus: item.stockStatus || "in_stock",
        stockQuantity: Number(item.stockQuantity ?? 0)
      });
    });
  } catch (err) {
    console.error("Error loading storefront products:", err);
  }

  allProductsList = dbProducts;
  renderProducts(allProductsList);
  renderProducts(allProductsList,'allProductsGrid');
  renderDynamicCategories();
  renderCustomProductSections();
  const params=new URLSearchParams(location.search),categoryFilter=params.get('category'),sectionFilter=params.get('section');
  if(categoryFilter||sectionFilter){const filtered=allProductsList.filter(p=>(!categoryFilter||p.category===categoryFilter)&&(!sectionFilter||p.storefrontSection===sectionFilter));renderProducts(filtered,'allProductsGrid');const heading=document.getElementById('allProductsHeading');if(heading)heading.textContent=categoryFilter||sectionFilter;}
  const searchInput=document.getElementById('storeSearchInput');if(searchInput?.value.trim())runStoreSearch(searchInput.value);
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
function escapeStoreText(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function dogNoResultsMarkup(){return `<div class="no-results" role="status"><svg viewBox="0 0 220 150" aria-label="Dog says no result found" role="img"><ellipse cx="110" cy="133" rx="55" ry="7" fill="#dbe4ea"/><path d="M72 63Q45 55 42 85Q44 108 71 103L83 88Z M148 63Q175 55 178 85Q176 108 149 103L137 88Z" fill="#b77945"/><path d="M70 55Q70 28 105 30Q140 28 150 55L155 101Q148 126 110 126Q72 126 65 101Z" fill="#f4d2a6" stroke="#8a5733" stroke-width="2"/><ellipse cx="91" cy="68" rx="5" ry="7" fill="#30251f"/><ellipse cx="129" cy="68" rx="5" ry="7" fill="#30251f"/><ellipse cx="110" cy="86" rx="11" ry="8" fill="#30251f"/><path d="M110 94Q101 103 94 96M110 94Q119 103 126 96" fill="none" stroke="#30251f" stroke-width="2" stroke-linecap="round"/><path d="M151 32Q168 19 177 31L171 48Z M69 32Q52 19 43 31L49 48Z" fill="#b77945"/><rect x="14" y="7" width="192" height="27" rx="13" fill="#fff" stroke="#dbe4ea"/><text x="110" y="25" text-anchor="middle" font-size="11" font-weight="800" fill="#475569">No Result Found 🐶</text></svg><h3>No Result Found</h3><p>Woof! We couldn't find a product matching your search.</p></div>`;}
function renderProducts(products,targetId='productGrid'){
 const container=document.getElementById(targetId);if(!container)return;
 if(!products.length){container.innerHTML=dogNoResultsMarkup();return;}
 container.innerHTML=products.map(p=>{
  const out=p.stockStatus==="out_of_stock"||Number(p.stockQuantity)===0;
  return `<article class="product" data-product-id="${escapeStoreText(p.id)}"><div class="product-image-wrap"><img loading="lazy" src="${escapeStoreText(productPreviewImage(p))}" alt="${escapeStoreText(p.name)}"></div><div class="product-details"><h3>${escapeStoreText(p.name)}</h3><p>${escapeStoreText(p.description)}</p><div class="product-price">Starting ₹${Number(p.price)||0}</div><p class="return-policy-note">7-day return policy after delivery</p><div class="product-delivery-date">Estimated delivery: <b>${getEstimatedDeliveryDate()}</b></div>${out?'<span class="out-of-stock-badge">Out of stock</span>':`<button class="primary-button full" type="button" onclick="openProductCustomizer('${String(p.id).replace(/'/g,"\\'")}')">${p.pType==='stock'?'Select & Buy →':'Customize & Design →'}</button>`}</div></article>`;
 }).join('');
}
function renderDynamicCategories(){const target=document.getElementById('dynamicCategories'),nav=document.getElementById('dynamicCategoryNav');const counts=new Map();allProductsList.forEach(p=>{if(p.category)counts.set(p.category,(counts.get(p.category)||0)+1);});const names=[...counts.keys()].filter(name=>counts.get(name)>0);if(target)target.innerHTML=names.map(category=>`<a class="category" href="all-products.html?category=${encodeURIComponent(category)}"><div class="category-visual cat-card">✦</div><b>${escapeStoreText(category)}</b><span>Explore products →</span></a>`).join('')||'<p class="help-text">Categories appear here when products are assigned.</p>';if(nav)nav.innerHTML=names.map(category=>`<a href="all-products.html?category=${encodeURIComponent(category)}">${escapeStoreText(category)}</a>`).join('');}
function renderCustomProductSections(){const target=document.getElementById('customProductSections');if(!target)return;const names=[...new Set(allProductsList.map(p=>p.storefrontSection).filter(Boolean))];target.innerHTML=names.map(name=>{const products=allProductsList.filter(p=>p.storefrontSection===name);if(!products.length)return '';return `<section class="custom-product-section"><div class="section-top"><div><p class="eyebrow">CURATED COLLECTION</p><h2>${escapeStoreText(name)}</h2></div><a class="text-button" href="all-products.html?section=${encodeURIComponent(name)}">View all →</a></div><div class="product-grid">${products.slice(0,4).map(p=>{const out=p.stockStatus==="out_of_stock"||Number(p.stockQuantity)===0;return `<article class="product"><div class="product-image-wrap"><img loading="lazy" src="${escapeStoreText(productPreviewImage(p))}" alt="${escapeStoreText(p.name)}"></div><div class="product-details"><h3>${escapeStoreText(p.name)}</h3><p>${escapeStoreText(p.description)}</p><div class="product-price">Starting ₹${Number(p.price)||0}</div><p class="return-policy-note">7-day return policy after delivery</p>${out?'<span class="out-of-stock-badge">Out of stock</span>':`<button class="primary-button full" type="button" onclick="openProductCustomizer('${String(p.id).replace(/'/g,"\\'")}')">View product →</button>`}</div></article>`}).join('')}</div></section>`}).join('');}
function runStoreSearch(raw){const query=String(raw||'').trim().toLowerCase();const filtered=!query?allProductsList:allProductsList.filter(p=>[p.name,p.description,p.pType,p.category,p.storefrontSection].some(v=>String(v||'').toLowerCase().includes(query)));if(document.getElementById('productGrid'))renderProducts(filtered);if(document.getElementById('allProductsGrid'))renderProducts(filtered,'allProductsGrid');const section=document.getElementById('products')||document.getElementById('all-products');if(query&&section&&document.getElementById('storeSearchInput'))section.scrollIntoView({behavior:'smooth',block:'start'});}

// Open Product Customizer Modal
window.openProductCustomizer = function(productId) {
  selectedProduct = allProductsList.find(p => p.id === productId);
  if (!selectedProduct) return;
  if (selectedProduct.stockStatus === "out_of_stock" || Number(selectedProduct.stockQuantity) === 0) { alert("This product is out of stock and cannot be ordered."); return; }

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

    const sizeChoice=document.getElementById('sizeSelect'),qualityChoice=document.getElementById('qualitySelect');
    const chosenSize=selectedProduct.sizes?.length&&sizeChoice?.value!==''?selectedProduct.sizes[Number(sizeChoice.value)]?.name||'':'';
    const chosenQuality=selectedProduct.qualities?.length&&qualityChoice?.value!==''?selectedProduct.qualities[Number(qualityChoice.value)]?.name||'':'';
    cart.push({productId:selectedProduct.id,name:selectedProduct.name,imageUrl:selectedProduct.imageUrl||'',size:chosenSize,quality:chosenQuality,quantity:qty,totalPrice:currentCalculatedPrice,
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
let pinLookupTimer = null;
let currentSavedAddresses = [];
let editingAddressIndex = -1;
let appliedCoupon = null;
function couponDiscount(subtotal) { return appliedCoupon ? Math.min(subtotal, Math.floor(subtotal * Number(appliedCoupon.percent || 0) / 100)) : 0; }

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
  const addressSelect = document.getElementById('savedAddressSelect');
  const addressIndex = currentSavedAddresses.findIndex(x => x.pincode === a.pincode && x.area === a.area && x.locality === a.locality && x.house === a.house);
  if (addressSelect) addressSelect.value = addressIndex >= 0 ? String(addressIndex) : '';
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
  updateAddressOptions();
  document.getElementById('addressLimitNote').textContent = `Saved addresses: ${currentSavedAddresses.length}/4 for this mobile number.`;
}
function saveCurrentAddress(showMessage = true) {
  const a = addressFields();
  if (!/^\d{10}$/.test(a.phone)) { alert('Enter a valid 10-digit mobile number first.'); return false; }
  if (!/^\d{6}$/.test(a.pincode) || !a.state || !a.district || !a.area) { alert('Enter a valid PIN code and select the post office / area.'); return false; }
  const required = ['name','locality','landmark'];
  if (required.some(k => !a[k])) { alert('Please fill in name, locality and landmark.'); return false; }
  const book = getAddressBook(a.phone);
  const existing = editingAddressIndex >= 0 && book[editingAddressIndex] ? editingAddressIndex : book.findIndex(x => x.pincode===a.pincode && x.area===a.area && x.locality===a.locality && x.house===a.house);
  if (existing >= 0) { a.isDefault = !!book[existing].isDefault; book[existing] = a; }
  else if (book.length >= 4) { alert('Maximum 4 saved addresses per mobile number. Delete an address before adding another.'); return false; }
  else book.push(a);
  if (!book.some(x => x.isDefault)) book[book.length - 1].isDefault = true;
  localStorage.setItem('saya_last_customer_phone', a.phone);
  localStorage.setItem('saya_addresses_' + a.phone, JSON.stringify(book));
  const savedIndex = existing >= 0 ? existing : book.length - 1;
  editingAddressIndex = -1;
  const saveButton = document.getElementById('saveAddressBtn');
  if (saveButton) saveButton.textContent = 'Save address';
  refreshSavedAddresses(String(savedIndex));
  if (showMessage) alert('Address saved on this device for this mobile number.');
  return true;
}
function updateAddressOptions() {
  const select = document.getElementById('savedAddressSelect');
  const index = select && select.value !== '' ? Number(select.value) : -1;
  const address = currentSavedAddresses[index];
  const menu = document.getElementById('addressOptionsMenu');
  if (!address) menu?.setAttribute('hidden', '');
  for (const id of ['addressOptionsBtn','editSavedAddressBtn','deleteSavedAddressBtn','defaultSavedAddressBtn']) {
    const button = document.getElementById(id);
    if (button) button.disabled = !address;
  }
  const defaultButton = document.getElementById('defaultSavedAddressBtn');
  if (defaultButton && address) defaultButton.textContent = address.isDefault ? '✓ Default address' : '★ Set as default';
}
function storeAddressBookForCurrentPhone(book) {
  const phone = document.getElementById('custPhone')?.value || localStorage.getItem('saya_last_customer_phone') || '';
  const key = String(phone).replace(/\D/g, '').slice(-10);
  if (!/^\d{10}$/.test(key)) { alert('Enter the saved address mobile number first.'); return false; }
  localStorage.setItem('saya_addresses_' + key, JSON.stringify(book));
  return true;
}
document.getElementById('addressOptionsBtn')?.addEventListener('click', () => {
  const menu = document.getElementById('addressOptionsMenu');
  if (!currentSavedAddresses[Number(document.getElementById('savedAddressSelect').value)]) return;
  const willOpen = menu.hidden;
  menu.hidden = !willOpen;
  document.getElementById('addressOptionsBtn').setAttribute('aria-expanded', String(willOpen));
});
document.getElementById('editSavedAddressBtn')?.addEventListener('click', () => {
  const index = Number(document.getElementById('savedAddressSelect').value);
  const address = currentSavedAddresses[index];
  if (!address) return;
  editingAddressIndex = index;
  fillAddress(address);
  const saveButton = document.getElementById('saveAddressBtn');
  if (saveButton) saveButton.textContent = 'Update address';
  document.getElementById('addressOptionsMenu').hidden = true;
  document.getElementById('addressOptionsBtn').setAttribute('aria-expanded', 'false');
  document.getElementById('custName')?.focus();
});
document.getElementById('deleteSavedAddressBtn')?.addEventListener('click', () => {
  const index = Number(document.getElementById('savedAddressSelect').value);
  if (!currentSavedAddresses[index]) return;
  if (!confirm('Delete this saved address?')) return;
  const book = [...currentSavedAddresses];
  const wasDefault = !!book[index].isDefault;
  book.splice(index, 1);
  if (wasDefault && book.length) book[0].isDefault = true;
  else if (book.length && !book.some(item => item.isDefault)) book[0].isDefault = true;
  if (!storeAddressBookForCurrentPhone(book)) return;
  editingAddressIndex = -1;
  refreshSavedAddresses(book.length ? String(Math.max(0, index - (index === book.length ? 1 : 0))) : '');
  if (!book.length) {
    document.getElementById('savedAddressSelect').value = '';
    document.getElementById('checkoutForm').querySelectorAll('#custName,#custPhone,#custPincode,#custState,#custDistrict,#custLocality,#custHouse,#custLandmark').forEach(el => el.value = '');
    document.getElementById('custArea').innerHTML = '<option value="">Enter PIN code first</option>';
  }
  updateAddressOptions();
});
document.getElementById('defaultSavedAddressBtn')?.addEventListener('click', () => {
  const index = Number(document.getElementById('savedAddressSelect').value);
  if (!currentSavedAddresses[index]) return;
  const book = currentSavedAddresses.map((address, i) => ({...address, isDefault: i === index}));
  if (!storeAddressBookForCurrentPhone(book)) return;
  refreshSavedAddresses(String(index));
  updateAddressOptions();
  document.getElementById('addressOptionsMenu').hidden = true;
  document.getElementById('addressOptionsBtn').setAttribute('aria-expanded', 'false');
});
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
  const a=addressFields(),addressSummary=document.getElementById('checkoutAddressSummary');
  if(addressSummary)addressSummary.textContent=formatAddress(a);
  const box=document.getElementById('checkoutItemsSummary');
  if(box)box.innerHTML=cart.map(item=>{
    const product=allProductsList.find(p=>p.id===item.productId),image=item.imageUrl||product?.imageUrl||productPreviewImage(product||{name:item.name});
    const options=[item.size?'Size: '+item.size:'',item.quality?'Quality: '+item.quality:''].filter(Boolean).join(' · ');
    const name=String(item.name||'Product').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    return '<article class="checkout-item-row"><img src="'+image+'" alt=""><div class="checkout-item-info"><b>'+name+'</b><small>'+options+'</small><small>Qty: '+Number(item.quantity||1)+'</small></div><strong>₹'+Number(item.totalPrice||0)+'</strong></article>';
  }).join('')||'<p class="help-text">Your cart is empty.</p>';
  const subtotal=cart.reduce((s,x)=>s+Number(x.totalPrice||0),0),method=document.querySelector('input[name="paymentMethod"]:checked')?.value||'upi',charge=method==='cod'?1000:0,discount=couponDiscount(subtotal),total=Math.max(0,subtotal-discount)+charge;
  document.getElementById('checkoutPayTotal').textContent='₹'+total;
  const cs=document.getElementById('deliveryChargeSummary');if(cs)cs.innerHTML='Product subtotal: ₹'+subtotal+'<br>Coupon discount'+(appliedCoupon?' ('+appliedCoupon.code+' · '+appliedCoupon.percent+'%)':'')+': −₹'+discount+'<br>COD/delivery charge: ₹'+charge+'<br><b>Total payable: ₹'+total+'</b>';
  const rt=document.getElementById('orderReviewTotals');if(rt)rt.innerHTML='Product subtotal: ₹'+subtotal+'<br>Coupon discount'+(appliedCoupon?' ('+appliedCoupon.code+' · '+appliedCoupon.percent+'%)':'')+': −₹'+discount+'<br><b>Order total: ₹'+Math.max(0,subtotal-discount)+'</b>';
  const payButton=document.getElementById('placeOrderBtn');
  if(payButton)payButton.textContent=method==='card'?'Pay by card · ₹'+total+' →':method==='cod'?'Place COD order · ₹'+total+' →':'Pay with UPI · ₹'+total+' →';
}
if (checkoutButton) checkoutButton.addEventListener('click', () => {
  if (!cart.length) { alert('Your bag is empty.'); return; }
  setCheckoutStage(1);
  appliedCoupon=null;
  const couponInput=document.getElementById('couponCodeInput');if(couponInput)couponInput.value='';
  const couponStatus=document.getElementById('couponStatus');if(couponStatus){couponStatus.textContent='Enter an active coupon code for a percentage discount.';couponStatus.style.color='';}
  refreshSavedAddresses();
  updateCheckoutSummary();
  closeDrawer('cartDrawer');
  openModal('checkoutModal');
});
document.getElementById('newAddressBtn')?.addEventListener('click', () => {
  editingAddressIndex = -1;
  const saveButton = document.getElementById('saveAddressBtn'); if (saveButton) saveButton.textContent = 'Save address';
  document.getElementById('checkoutForm').querySelectorAll('input:not([type=radio])').forEach(el => { el.value=''; });
  document.getElementById('custArea').innerHTML='<option value="">Enter PIN code first</option>';
  document.getElementById('savedAddressSelect').value='';
  document.getElementById('placeOrderBtn').disabled=false;
});
document.getElementById('savedAddressSelect')?.addEventListener('change', e => {
  editingAddressIndex = -1;
  const saveButton = document.getElementById('saveAddressBtn');
  if (saveButton) saveButton.textContent = 'Save address';
  if (e.target.value !== '') {
    const a = currentSavedAddresses[Number(e.target.value)];
    if (a) fillAddress(a);
  }
  updateAddressOptions();
});
document.getElementById('custPhone')?.addEventListener('change', () => refreshSavedAddresses());
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
  if (!document.getElementById('custPincode').reportValidity()) return;
  if (!/^\d{6}$/.test(a.pincode) || !a.state || !a.district || !a.area || !/^\d{10}$/.test(a.phone) || !a.name || !a.locality) { alert('Please complete all required address details. PIN lookup must finish first.'); return; }
  saveCurrentAddress(false);
  updateCheckoutSummary();setCheckoutStage(3);
});
document.getElementById('reviewContinueBtn')?.addEventListener('click', () => { updateCheckoutSummary();setCheckoutStage(2); });
function syncPaymentChoiceUI(){
  document.querySelectorAll('.payment-choice').forEach(label=>{
    const radio=label.querySelector('input[name="paymentMethod"]');
    label.classList.toggle('is-selected',!!radio?.checked);
    label.setAttribute('aria-checked',String(!!radio?.checked));
    label.setAttribute('role','radio');
    label.tabIndex=0;
  });
  updateCheckoutSummary();
}
document.querySelectorAll('input[name="paymentMethod"]').forEach(input=>input.addEventListener('change',syncPaymentChoiceUI));
document.querySelectorAll('.payment-choice').forEach(label=>{
  label.addEventListener('click',event=>{
    if(event.target.closest('input'))return;
    const radio=label.querySelector('input[name="paymentMethod"]');
    if(radio){radio.checked=true;radio.dispatchEvent(new Event('change',{bubbles:true}));}
  });
  label.addEventListener('keydown',event=>{
    if(event.key==='Enter'||event.key===' '){event.preventDefault();const radio=label.querySelector('input[name="paymentMethod"]');if(radio){radio.checked=true;radio.dispatchEvent(new Event('change',{bubbles:true}));}}
  });
});
document.getElementById('applyCouponBtn')?.addEventListener('click', async () => {
  const input=document.getElementById('couponCodeInput'),status=document.getElementById('couponStatus');
  const code=String(input?.value||'').trim().toUpperCase();
  if(!code){appliedCoupon=null;status.textContent='Enter a coupon code first.';status.style.color='#b42318';updateCheckoutSummary();return;}
  const btn=document.getElementById('applyCouponBtn');btn.disabled=true;status.textContent='Checking coupon…';
  try{
    const snap=await getDocs(collection(db,'coupons'));
    const match=snap.docs.find(d=>String(d.data().code||'').trim().toUpperCase()===code && d.data().active===true);
    if(!match)throw new Error('This coupon is invalid or inactive.');
    const percent=Number(match.data().percent);
    if(!Number.isFinite(percent)||percent<=0||percent>100)throw new Error('This coupon has an invalid discount setting.');
    appliedCoupon={code,percent,docId:match.id};
    status.textContent='Coupon applied: '+percent+'% off eligible product subtotal.';status.style.color='#08776c';
    updateCheckoutSummary();
  }catch(err){appliedCoupon=null;status.textContent=err.message;status.style.color='#b42318';updateCheckoutSummary();}
  finally{btn.disabled=false;}
});
document.querySelectorAll('[data-back]').forEach(btn => btn.addEventListener('click',()=>setCheckoutStage(Number(btn.dataset.back))));

if(checkoutForm) checkoutForm.onsubmit=async e=>{
  e.preventDefault();
  if(!cart.length)return alert('Your bag is empty.');
  const a=addressFields();
  const paymentMethod=checkoutForm.querySelector('input[name="paymentMethod"]:checked')?.value;
  if(!['upi','card','cod'].includes(paymentMethod))return alert('Choose UPI, card or Cash on Delivery.');
  const status=document.getElementById('paymentStatus'),button=document.getElementById('placeOrderBtn');
  button.disabled=true;
  button.textContent=paymentMethod==='cod'?'Placing COD order…':'Connecting securely…';
  status.textContent=paymentMethod==='cod'?'Placing Cash on Delivery order…':'Preparing secure payment…';
  try {
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
    const discount = couponDiscount(subtotal);
    const orderAmount = Math.max(0, subtotal - discount) + deliveryCharge;
    const orderData = {
      orderId, customerName:a.name, customerPhone:'+91'+a.phone,
      deliveryAddress:formatAddress(a), address:a, items:cart, subtotal, discount,
      couponCode:appliedCoupon?.code||'', couponPercent:appliedCoupon?.percent||0,
      deliveryCharge, amount:orderAmount, paymentMethod,
      paymentStatus:paymentMethod==='cod'?'cash on delivery':'pending',
      orderStatus:"Order Placed", statusHistory:[{status:"Order Placed",at:new Date().toISOString()}],
      createdAt:new Date().toISOString(), createdAtMs:Date.now(), trackingUrl:"", deliveredAt:null, returnEligibleUntil:null
    };
    const savedOrder = await addDoc(collection(db,'orders'), orderData);
    if (paymentMethod === 'cod') {
      status.textContent='COD order placed. Order ID: '+orderId+'. Total including ₹1,000 COD/delivery charge: ₹'+orderAmount;
      cart = [];
      saveCart();
      closeModal('checkoutModal');
      alert('Cash on Delivery order placed. Order ID: '+orderId+' | Total: ₹'+orderAmount);
      return;
    }
    const apiBase = 'https://sayaart-payment-api.vercel.app';
    const orderResponse = await fetch(apiBase+'/api/create-order', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({amount:Math.round(orderAmount*100),currency:'INR',receipt:orderId})
    });
    const orderResult = await orderResponse.json().catch(()=>({}));
    if(!orderResponse.ok) throw new Error(orderResult.error || 'Could not create Razorpay order (HTTP '+orderResponse.status+').');
    if(!orderResult.id || !orderResult.key_id) throw new Error('Payment service did not return a Razorpay order and public Key ID.');
    if(typeof window.Razorpay !== 'function') {
      await new Promise((resolve,reject)=>{
        const script=document.createElement('script');
        script.src='https://checkout.razorpay.com/v1/checkout.js';
        script.onload=resolve;
        script.onerror=()=>reject(new Error('Could not load Razorpay Checkout. Check your internet connection and try again.'));
        document.head.appendChild(script);
      });
    }
    if(typeof window.Razorpay !== 'function') throw new Error('Razorpay Checkout could not be initialized.');
    status.textContent='Order ID: '+orderId+'. Opening secure Razorpay Checkout…';
    const checkout = new window.Razorpay({
      key:orderResult.key_id, amount:orderResult.amount, currency:orderResult.currency || 'INR',
      name:'Saya Art & Advertising', description:'Order '+orderId, order_id:orderResult.id,
      prefill:{name:a.name,contact:'+91'+a.phone}, notes:{store_order_id:orderId},
      theme:{color:'#147d70'},
      handler:async function(paymentResponse) {
        status.textContent='Verifying payment securely…';
        button.disabled=true; button.textContent='Verifying payment…';
        try {
          const verifyResponse=await fetch(apiBase+'/api/verify-payment',{
            method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(paymentResponse)
          });
          const verification=await verifyResponse.json().catch(()=>({}));
          if(!verifyResponse.ok || verification.verified!==true) {
            throw new Error(verification.error || 'Payment verification failed. Contact the store with your payment ID before trying again.');
          }
          await updateDoc(savedOrder,{
            paymentStatus:verification.payment_status==='captured'?'paid':'authorized',
            paymentOrderStatus:verification.payment_status==='captured'?'Payment received':'Payment authorized - capture pending',
            razorpayOrderId:verification.order_id, razorpayPaymentId:verification.payment_id,
            paidAt:new Date().toISOString()
          });
          cart=[]; saveCart(); updateCartUI(); closeModal('checkoutModal');
          alert('Payment verified successfully! Order ID: '+orderId+' | Payment ID: '+verification.payment_id);
        } catch(verifyError) {
          console.error('Payment verification error:',verifyError);
          status.textContent=verifyError.message; alert(verifyError.message);
        } finally {
          button.disabled=false; button.textContent='Pay securely →'; updateCheckoutSummary();
        }
      },
      modal:{ondismiss:function(){
        status.textContent='Payment window closed. Your order is still pending; you can try again.';
        button.disabled=false; button.textContent='Pay securely →'; updateCheckoutSummary();
      }}
    });
    checkout.on('payment.failed',function(response){
      const reason=response.error?.description || 'Payment failed. Please try again.';
      status.textContent=reason; alert(reason);
    });
    checkout.open();
  } catch(err) {
    console.error('Checkout payment error:',err);
    status.textContent=err.message; alert(err.message);
  } finally {
    button.disabled=false;
    if(!button.textContent.includes('Pay securely')) button.textContent='Pay securely →';
    updateCheckoutSummary();
  }
};

// ADMIN PANEL ENGINE WITH ROBUST ERROR HANDLING
async function initAdminPanel() {
  const adminAddForm = document.getElementById('adminAddProductForm');
  const adminProductList = document.getElementById('adminProductList');
  const adminOrdersList = document.getElementById('adminOrdersList');
  const adminReturnsList = document.getElementById('adminReturnsList');
  const adminCouponsList = document.getElementById('adminCouponsList');
  const couponAdminForm = document.getElementById('couponAdminForm');
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

  const frontImageFile = document.getElementById('pImgFile');
  const frontImageUrl = document.getElementById('pImg');
  const frontImagePreview = document.getElementById('pImgPreview');
  const backImageFields = document.getElementById('backImageFields');
  const hasBackCheckbox = document.getElementById('pHasBack');
  const updateFrontImagePreview = () => {
    if (!frontImagePreview) return;
    const file = frontImageFile?.files?.[0];
    if (file) { frontImagePreview.src = URL.createObjectURL(file); frontImagePreview.style.display = 'block'; }
    else if (frontImageUrl?.value.trim()) { frontImagePreview.src = frontImageUrl.value.trim(); frontImagePreview.style.display = 'block'; }
    else { frontImagePreview.src = ''; frontImagePreview.style.display = 'none'; }
  };
  frontImageFile?.addEventListener('change', updateFrontImagePreview);
  frontImageUrl?.addEventListener('input', updateFrontImagePreview);
  [2,3,4,5].forEach((n) => {
    const fileInput = document.getElementById('pGallery'+n+'File');
    const urlInput = document.getElementById('pGallery'+n);
    const preview = document.getElementById('pGallery'+n+'Preview');
    const updatePreview = () => {
      if (!preview) return;
      const file = fileInput?.files?.[0];
      const url = urlInput?.value.trim() || '';
      if (file) { preview.src = URL.createObjectURL(file); preview.style.display = 'block'; }
      else if (url) { preview.src = url; preview.style.display = 'block'; }
      else { preview.removeAttribute('src'); preview.style.display = 'none'; }
    };
    fileInput?.addEventListener('change', updatePreview);
    urlInput?.addEventListener('input', updatePreview);
  });
  const updateBackFieldsVisibility = () => { if (backImageFields) backImageFields.style.opacity = hasBackCheckbox?.checked ? '1' : '.65'; };
  hasBackCheckbox?.addEventListener('change', updateBackFieldsVisibility);
  updateBackFieldsVisibility();
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
      const category = document.getElementById('pCategory')?.value.trim() || '';
      const storefrontSection = document.getElementById('pStorefrontSection')?.value.trim() || '';
      const mainImageUrl = await getImageValue('pImgFile', 'pImg', previous.imageUrl);
      const extraGalleryImages = await Promise.all([2,3,4,5].map(async n => await getImageValue('pGallery'+n+'File', 'pGallery'+n, previous.galleryImages?.[n-1] || '')));
      const stockStatus = document.getElementById('pStockStatus')?.value || previous.stockStatus || "in_stock";
      const stockQuantity = Math.max(0, Number(document.getElementById('pStockQuantity')?.value ?? previous.stockQuantity ?? 1));
      const productData = {
        pType, name, price, description, category, storefrontSection, stockStatus, stockQuantity,
        imageUrl: mainImageUrl,
        galleryImages: [mainImageUrl, ...extraGalleryImages].filter(Boolean).slice(0,5),
        backImageUrl: await getImageValue('pBackImgFile', 'pBackImg', previous.backImageUrl),
        hasBack: document.getElementById('pHasBack')?.checked ?? (previous.hasBack ?? false),
        hasPhoto: document.getElementById('chkPhoto')?.checked ?? true,
        hasText: document.getElementById('chkText')?.checked ?? true,
        sizes: parseOptions(document.getElementById('pSizes').value),
        qualities: parseOptions(document.getElementById('pQualities').value),
        stockStatus: document.getElementById('pStockStatus')?.value || previous.stockStatus || "in_stock",
        stockQuantity: Math.max(0, Number(document.getElementById('pStockQuantity')?.value ?? previous.stockQuantity ?? 0))
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
      if(document.getElementById('pCategory'))document.getElementById('pCategory').value=p.category||'';
      if(document.getElementById('pStorefrontSection'))document.getElementById('pStorefrontSection').value=p.storefrontSection||'';
      document.getElementById('pImg').value = p.imageUrl && !p.imageUrl.startsWith('data:') ? p.imageUrl : '';
      const galleryImages = Array.isArray(p.galleryImages) ? p.galleryImages : [p.imageUrl || ''];
      [2,3,4,5].forEach((n) => {
        const imageUrl = galleryImages[n-1] || '';
        const urlField = document.getElementById('pGallery'+n);
        const preview = document.getElementById('pGallery'+n+'Preview');
        if (urlField) urlField.value = imageUrl && !imageUrl.startsWith('data:') ? imageUrl : '';
        if (preview) { preview.src = imageUrl || ''; preview.style.display = imageUrl ? 'block' : 'none'; }
      });
      const backImageUrlField = document.getElementById('pBackImg');
      if (backImageUrlField) backImageUrlField.value = p.backImageUrl && !p.backImageUrl.startsWith('data:') ? p.backImageUrl : '';
      const backPreview = document.getElementById('pBackImgPreview');
      if (backPreview && p.backImageUrl) { backPreview.src=p.backImageUrl; backPreview.style.display='block'; }
      else if (backPreview) { backPreview.src=''; backPreview.style.display='none'; }
      document.getElementById('pHasBack').checked = !!p.hasBack;
      document.getElementById('pSizes').value = formatOptions(p.sizes);
      document.getElementById('pQualities').value = formatOptions(p.qualities);
      if(document.getElementById('pStockStatus'))document.getElementById('pStockStatus').value=p.stockStatus||"in_stock";
      if(document.getElementById('pStockQuantity'))document.getElementById('pStockQuantity').value=p.stockQuantity??1;
      if(document.getElementById('pStockStatus'))document.getElementById('pStockStatus').value=p.stockStatus||"in_stock";
      if(document.getElementById('pStockQuantity'))document.getElementById('pStockQuantity').value=p.stockQuantity??0;
      document.getElementById('pHasBack').checked = !!p.hasBack;
      document.getElementById('chkPhoto').checked = p.hasPhoto !== false;
      document.getElementById('chkText').checked = p.hasText !== false;
      ['pImgFile','pGallery2File','pGallery3File','pGallery4File','pGallery5File','pBackImgFile','pFrontOutlineFile','pBackOutlineFile','pFinishedLinkFile'].forEach(id => { const input=document.getElementById(id); if(input) input.value=''; });
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
        const stock = document.createElement("div"); stock.className="help-text"; stock.textContent = (p.stockStatus==="out_of_stock"||Number(p.stockQuantity)===0) ? "OUT OF STOCK — ordering disabled" : "In stock · Quantity: "+Number(p.stockQuantity||0);
        textBox.append(title, desc, stock); details.appendChild(textBox);
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
      const activeOrderDocs = snap.docs.filter(d => !d.data().deletedAt);
      const deletedOrderDocs = snap.docs.filter(d => !!d.data().deletedAt);
      const bin = document.getElementById('adminOrdersBin');
      const binCount = document.getElementById('ordersBinCount');
      if (binCount) binCount.textContent = String(deletedOrderDocs.length);
      const nowMs = Date.now();
      for (const deletedDoc of deletedOrderDocs) {
        const deletedAt = Date.parse(deletedDoc.data().deletedAt || '');
        if (Number.isFinite(deletedAt) && nowMs - deletedAt >= 7*24*60*60*1000) {
          try { await deleteDoc(doc(db,'orders',deletedDoc.id)); } catch (purgeError) { console.error('Could not permanently purge expired order:',purgeError); }
        }
      }
      const remainingBinDocs = deletedOrderDocs.filter(d => {
        const t=Date.parse(d.data().deletedAt||''); return !Number.isFinite(t)||nowMs-t<7*24*60*60*1000;
      });
      if (bin) {
        bin.innerHTML = remainingBinDocs.length ? '' : '<p class="help-text">The bin is empty.</p>';
        remainingBinDocs.sort((a,b)=>String(b.data().deletedAt||'').localeCompare(String(a.data().deletedAt||''))).forEach(d=>{
          const o=d.data(), deletedAt=Date.parse(o.deletedAt||''), purgeAt=Number.isFinite(deletedAt)?new Date(deletedAt+7*24*60*60*1000):null;
          const card=document.createElement('article');card.className='order-list-item';
          const info=document.createElement('div');
          info.innerHTML='<b>Order #'+String(o.orderId||d.id)+'</b> · ₹'+Number(o.amount||0)+'<br>Deleted: '+(Number.isFinite(deletedAt)?new Date(deletedAt).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}):'Date unavailable')+'<br>Permanent deletion: '+(purgeAt?purgeAt.toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}):'After 7 days');
          const actions=document.createElement('div');actions.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin-top:10px';
          const restore=document.createElement('button');restore.className='btn';restore.type='button';restore.textContent='Restore order';
          restore.addEventListener('click',async()=>{try{await updateDoc(doc(db,'orders',d.id),{deletedAt:null,restoredAt:new Date().toISOString()});await loadAdminOrders();}catch(e){alert('Could not restore order: '+e.message);}});
          const del=document.createElement('button');del.className='btn btn-danger';del.type='button';del.textContent='Delete permanently';
          del.addEventListener('click',async()=>{if(!confirm('Permanently delete this order record? This cannot be undone.'))return;try{await deleteDoc(doc(db,'orders',d.id));await loadAdminOrders();}catch(e){alert('Could not delete order: '+e.message);}});
          actions.append(restore,del);card.append(info,actions);bin?.appendChild(card);
        });
      }
      if (!activeOrderDocs.length) adminOrdersList.innerHTML = '<p style="color:#64748b;">No active orders. Deleted orders are in the bin below.</p>';
      let currentDayKey = '';
      [...activeOrderDocs].sort((a,b)=>String(b.data().createdAt||'').localeCompare(String(a.data().createdAt||''))).forEach(docSnap => {
        const o = docSnap.data();
        const parsedDate = new Date(o.createdAt || 0);
        const dayKey = Number.isFinite(parsedDate.getTime()) ? parsedDate.toLocaleDateString('en-CA') : 'unknown';
        if (dayKey !== currentDayKey) {
          currentDayKey = dayKey;
          const dayHeading = document.createElement('h3');
          dayHeading.textContent = dayKey === 'unknown' ? 'Date unavailable' : parsedDate.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
          dayHeading.style.cssText = 'margin:22px 0 12px;padding:10px 12px;background:#eef7f4;border-radius:8px;';
          adminOrdersList.appendChild(dayHeading);
        }
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
            <b>Order #${String(o.orderId || docSnap.id)}</b> - <span style="color:#16a34a; font-weight:bold;">₹${Number(o.amount||0)}</span><br>
            Customer: <b>${String(o.customerName || 'N/A')}</b> (${String(o.customerPhone || 'N/A')})<br>
            Address: <b>${String(o.deliveryAddress || 'N/A')}</b><br>
            Order Date &amp; Time: <b>${o.createdAt ? new Date(o.createdAt).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"}) : "Date unavailable"}</b><br>
            Payment: <b>${String(o.paymentStatus || "Pending")}</b> · Order status: <b>${String(o.orderStatus || "Order Placed")}</b><br>
            <div class="form-grid" style="margin-top:12px"><div class="form-group"><label>Order status</label><select class="admin-order-status" data-id="${docSnap.id}">${["Order Placed","Order Processed","Order Shipped","Delivered","Cancelled"].map(s=>`<option value="${s}" ${String(o.orderStatus||"Order Placed")===s?"selected":""}>${s}</option>`).join("")}</select></div><div class="form-group"><label>Tracking link</label><input class="admin-tracking-url" data-id="${docSnap.id}" type="url" placeholder="https://courier-tracking-link..." value="${String(o.trackingUrl||"")}"></div></div>
            <button type="button" class="btn admin-save-order-status" data-id="${docSnap.id}">Save status &amp; tracking</button>
            ${o.cancellationStatus ? '<br>Cancellation: <b>'+String(o.cancellationStatus)+'</b>' : ''}
            ${o.refundStatus ? '<br>Refund: <b>'+String(o.refundStatus)+'</b>' : ''}
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
              ${o.cancellationStatus === 'Cancellation requested' ? '<button type="button" class="btn admin-cancel-approve" data-id="'+docSnap.id+'">Approve cancellation</button><button type="button" class="btn btn-danger admin-cancel-reject" data-id="'+docSnap.id+'">Reject cancellation</button>' : ''}
              ${o.cancellationStatus === 'Cancellation approved' && ['paid','captured','authorized'].includes(String(o.paymentStatus||'').toLowerCase()) ? '<button type="button" class="btn admin-refund-mark" data-id="'+docSnap.id+'">Mark refund initiated</button>' : ''}
              ${o.refundStatus === 'Refund initiated' ? '<button type="button" class="btn admin-refund-complete" data-id="'+docSnap.id+'">Mark refund completed</button>' : ''}
            </div>
            <div style="margin-top: 10px;">${itemsHtml}</div>
            <button type="button" class="btn btn-danger admin-soft-delete-order" data-id="${docSnap.id}" style="margin-top:12px">Delete order (move to bin)</button>
          </div>
        `;
      });

      adminOrdersList.querySelectorAll(".admin-soft-delete-order").forEach(btn=>btn.addEventListener("click",async()=>{if(!confirm('Move this order to the bin? It can be restored for 7 days.'))return;try{await updateDoc(doc(db,'orders',btn.dataset.id),{deletedAt:new Date().toISOString(),deletedBy:'admin'});await loadAdminOrders();}catch(err){alert('Could not move order to bin: '+err.message);}}));
      adminOrdersList.querySelectorAll(".admin-save-order-status").forEach(btn=>btn.addEventListener("click",async()=>{const id=btn.dataset.id;const status=adminOrdersList.querySelector(`.admin-order-status[data-id="${id}"]`)?.value||"Order Placed";const trackingUrl=adminOrdersList.querySelector(`.admin-tracking-url[data-id="${id}"]`)?.value.trim()||"";if(trackingUrl&&!/^https?:\/\//i.test(trackingUrl)){alert("Enter a valid tracking URL starting with https://");return;}const now=new Date().toISOString();try{const snapshot=await getDocs(collection(db,"orders"));const existing=snapshot.docs.find(d=>d.id===id)?.data()||{};const patch={orderStatus:status,trackingUrl,updatedAt:now,statusHistory:[...(existing.statusHistory||[]),{status,at:now}]};if(status==="Delivered"){const deliveredAt=existing.deliveredAt||now;patch.deliveredAt=deliveredAt;patch.returnEligibleUntil=new Date(new Date(deliveredAt).getTime()+7*24*60*60*1000).toISOString();}await updateDoc(doc(db,"orders",id),patch);await loadAdminOrders();}catch(err){alert("Could not update order status: "+err.message);}}));
      adminOrdersList.querySelectorAll('.admin-cancel-approve').forEach(btn=>btn.addEventListener('click',async()=>{if(!confirm('Approve cancellation? Process any required refund in Razorpay separately.'))return;try{await updateDoc(doc(db,'orders',btn.dataset.id),{cancellationStatus:'Cancellation approved',orderStatus:'Cancellation approved',cancellationReviewedAt:new Date().toISOString()});await loadAdminOrders();}catch(err){alert('Could not approve cancellation: '+err.message);}}));
      adminOrdersList.querySelectorAll('.admin-cancel-reject').forEach(btn=>btn.addEventListener('click',async()=>{if(!confirm('Reject this cancellation request?'))return;try{await updateDoc(doc(db,'orders',btn.dataset.id),{cancellationStatus:'Cancellation rejected',orderStatus:'Cancellation rejected',cancellationReviewedAt:new Date().toISOString()});await loadAdminOrders();}catch(err){alert('Could not reject cancellation: '+err.message);}}));
      adminOrdersList.querySelectorAll('.admin-refund-mark').forEach(btn=>btn.addEventListener('click',async()=>{if(!confirm('Only continue after initiating the refund in Razorpay. Have you done that?'))return;try{await updateDoc(doc(db,'orders',btn.dataset.id),{refundStatus:'Refund initiated',refundInitiatedAt:new Date().toISOString(),orderStatus:'Refund initiated'});await loadAdminOrders();}catch(err){alert('Could not update refund status: '+err.message);}}));
      adminOrdersList.querySelectorAll('.admin-refund-complete').forEach(btn=>btn.addEventListener('click',async()=>{if(!confirm('Only mark completed after Razorpay confirms the refund is completed. Has it confirmed?'))return;try{await updateDoc(doc(db,'orders',btn.dataset.id),{refundStatus:'Refund completed',refundCompletedAt:new Date().toISOString(),orderStatus:'Refund completed'});await loadAdminOrders();}catch(err){alert('Could not update refund status: '+err.message);}}));
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

  // Coupon management: create, edit, activate/deactivate, and delete.
  if (couponAdminForm) {
    let editingCouponId = null;
    const codeField=document.getElementById('couponAdminCode');
    const percentField=document.getElementById('couponAdminPercent');
    const activeField=document.getElementById('couponAdminActive');
    const resetCouponForm=()=>{editingCouponId=null;couponAdminForm.reset();activeField.checked=true;document.getElementById('saveCouponBtn').textContent='Save coupon';document.getElementById('cancelCouponEdit').style.display='none';};
    document.getElementById('cancelCouponEdit')?.addEventListener('click',resetCouponForm);
    couponAdminForm.addEventListener('submit',async e=>{
      e.preventDefault();
      const code=codeField.value.trim().toUpperCase().replace(/\s+/g,'');
      const percent=Number(percentField.value);
      if(!/^[A-Z0-9_-]{2,32}$/.test(code))return alert('Use 2–32 letters, numbers, hyphens or underscores for the coupon code.');
      if(!Number.isFinite(percent)||percent<1||percent>100)return alert('Discount must be between 1% and 100%.');
      const btn=document.getElementById('saveCouponBtn');btn.disabled=true;
      try{
        const snap=await getDocs(collection(db,'coupons'));
        const duplicate=snap.docs.find(d=>String(d.data().code||'').toUpperCase()===code&&d.id!==editingCouponId);
        if(duplicate)throw new Error('This coupon code already exists.');
        const data={code,percent,active:activeField.checked,updatedAt:new Date().toISOString()};
        if(editingCouponId)await updateDoc(doc(db,'coupons',editingCouponId),data);
        else await addDoc(collection(db,'coupons'),{...data,createdAt:new Date().toISOString()});
        resetCouponForm();await loadAdminCoupons();
      }catch(err){alert('Could not save coupon: '+err.message);}
      finally{btn.disabled=false;}
    });
    async function loadAdminCoupons(){
      adminCouponsList.innerHTML='<p class="help-text">Loading coupons…</p>';
      try{
        const snap=await getDocs(collection(db,'coupons'));
        if(snap.empty){adminCouponsList.innerHTML='<p class="help-text">No coupon codes created yet.</p>';return;}
        adminCouponsList.innerHTML='';
        snap.docs.sort((a,b)=>String(a.data().code||'').localeCompare(String(b.data().code||''))).forEach(couponDoc=>{
          const c=couponDoc.data(),card=document.createElement('article');card.className='product-list-item';card.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap';
          const info=document.createElement('div');const title=document.createElement('b');title.textContent=c.code+' · '+c.percent+'% off';
          const state=document.createElement('p');state.className='help-text';state.textContent=c.active?'Active at checkout':'Inactive — not accepted at checkout';info.append(title,state);
          const actions=document.createElement('div');actions.style.cssText='display:flex;gap:8px;flex-wrap:wrap';
          const edit=document.createElement('button');edit.type='button';edit.className='btn';edit.textContent='Edit';edit.addEventListener('click',()=>{editingCouponId=couponDoc.id;codeField.value=c.code||'';percentField.value=c.percent||'';activeField.checked=c.active===true;document.getElementById('saveCouponBtn').textContent='Save changes';document.getElementById('cancelCouponEdit').style.display='inline-block';couponAdminForm.scrollIntoView({behavior:'smooth',block:'start'});});
          const toggle=document.createElement('button');toggle.type='button';toggle.className='btn';toggle.textContent=c.active?'Deactivate':'Activate';toggle.addEventListener('click',async()=>{try{await updateDoc(doc(db,'coupons',couponDoc.id),{active:!c.active,updatedAt:new Date().toISOString()});await loadAdminCoupons();}catch(err){alert('Could not change coupon status: '+err.message);}});
          const del=document.createElement('button');del.type='button';del.className='btn btn-danger';del.textContent='Delete';del.addEventListener('click',async()=>{if(!confirm('Delete coupon '+c.code+'?'))return;try{await deleteDoc(doc(db,'coupons',couponDoc.id));await loadAdminCoupons();}catch(err){alert('Could not delete coupon: '+err.message);}});
          actions.append(edit,toggle,del);card.append(info,actions);adminCouponsList.appendChild(card);
        });
      }catch(err){adminCouponsList.textContent='Could not load coupons: '+err.message;}
    }
    loadAdminCoupons();
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
  // Bind the cart trigger explicitly so the header button always opens the drawer.
  const cartTrigger = document.getElementById('openCart');
  cartTrigger?.addEventListener('click', event => {
    event.preventDefault();
    window.updateCartUI();
    window.openDrawer('cartDrawer');
    document.getElementById('cartDrawer')?.setAttribute('aria-hidden', 'false');
  });
  const cartDrawer = document.getElementById('cartDrawer');
  cartDrawer?.querySelectorAll('[data-close="cartDrawer"]').forEach(button => {
    button.addEventListener('click', () => {
      window.closeDrawer('cartDrawer');
      cartDrawer.setAttribute('aria-hidden', 'true');
    });
  });
  loadProducts();
  window.updateCartUI();
  const storeSidebar=document.getElementById('storeSidebar'),expandSidebar=document.getElementById('sidebarExpandToggle');
  const setSidebarExpanded=expanded=>{storeSidebar?.classList.toggle('expanded',!!expanded);expandSidebar?.setAttribute('aria-expanded',String(!!expanded));};
  storeSidebar?.addEventListener('mouseenter',()=>setSidebarExpanded(true));
  storeSidebar?.addEventListener('mouseleave',()=>setSidebarExpanded(false));
  expandSidebar?.addEventListener('click',()=>setSidebarExpanded(!storeSidebar?.classList.contains('expanded')));
  storeSidebar?.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{if(window.matchMedia('(hover: none)').matches)setSidebarExpanded(false);}));
  import('https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js').then(({onAuthStateChanged,signOut})=>onAuthStateChanged(auth,user=>{
    const inLink=document.getElementById('sidebarSignIn'),outLink=document.getElementById('sidebarSignOut');
    if(inLink)inLink.style.display=user?'none':'flex';if(outLink)outLink.style.display=user?'flex':'none';
    if(outLink)outLink.onclick=async event=>{event.preventDefault();try{await signOut(auth);inLink.style.display='flex';outLink.style.display='none';}catch(err){alert('Could not sign out: '+err.message);}};
  })).catch(console.error);
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
    searchForm.addEventListener('submit',event=>{event.preventDefault();runStoreSearch(searchInput.value);});
    searchInput.addEventListener('input',()=>runStoreSearch(searchInput.value));
  }
  if (typeof initAdminPanel === 'function') {
    initAdminPanel();
  }
});
