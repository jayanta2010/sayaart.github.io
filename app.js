import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC6CxokC0KwAtP9EMilEQHMJQKWCgLWYJc",
  authDomain: "sayaart.firebaseapp.com",
  projectId: "sayaart",
  storageBucket: "sayaart.firebasestorage.app",
  messagingSenderId: "805892692460",
  appId: "1:805892692460:web:417ef9926bbc01d9f288c9",
  measurementId: "G-S3CKT4LP6T"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Default Static Products
let products = [
  { id: 1, name: 'Classic visiting cards', cat: 'Business', price: 299, mark: 'YOUR BRAND', color: '#d308d0', tag: 'BESTSELLER' },
  { id: 2, name: 'Rounded stickers', cat: 'Labels', price: 249, mark: 'PEEL & GO', color: '#f5cf87', tag: 'NEW' },
  { id: 3, name: 'Premium flyers', cat: 'Marketing', price: 499, mark: 'SAY HELLO', color: '#f1a880', tag: '' },
  { id: 4, name: 'Everyday photo mug', cat: 'Gifts', price: 349, mark: 'GOOD MORNING', color: '#b9cfed', tag: '' },
  { id: 5, name: 'A5 notebooks', cat: 'Stationery', price: 299, mark: 'BIG IDEAS', color: '#d8db0b', tag: 'POPULAR' }
];

// Website Products Render Function
function renderProducts() {
  const productsContainer = document.getElementById('products') || document.querySelector('.products-section');
  if (!productsContainer) return;

  const html = products.map(p => `
    <div class="product-card" style="border:1px solid #ddd; padding:15px; margin:10px; border-radius:8px; display:inline-block; width:220px; vertical-align:top;">
      <img src="${p.imageUrl || 'saya-art-advertising-logo.jpg'}" alt="${p.name}" style="width:100%; height:150px; object-fit:cover; border-radius:4px;">
      <h3 style="font-size:16px; margin:10px 0 5px 0;">${p.name}</h3>
      <p style="font-weight:bold; color:#27ae60; margin:0 0 10px 0;">₹${p.price}</p>
      <button onclick="placeOrderFromSite('${p.name}', ${p.price})" style="background:#27ae60; color:white; border:none; padding:8px 12px; border-radius:4px; cursor:pointer; width:100%;">Order Now</button>
    </div>
  `).join('');

  productsContainer.innerHTML = html;
}

// Fetch Firebase Products & Merge
async function loadFirebaseData() {
  try {
    const querySnapshot = await getDocs(collection(db, "products"));
    if (!querySnapshot.empty) {
      let fbProducts = [];
      querySnapshot.forEach((doc) => {
        const item = doc.data();
        fbProducts.push({
          id: doc.id,
          name: item.name,
          price: Number(item.price),
          imageUrl: item.imageUrl,
          cat: 'Uploaded',
          mark: 'SAYA ART',
          color: '#27ae60',
          tag: 'NEW'
        });
      });
      // New products ko list ke top par add karein
      products = [...fbProducts, ...products];
    }
  } catch (err) {
    console.error("Firestore Error:", err);
  } finally {
    renderProducts();
  }
}

// Global Function to Handle Customer Checkout -> Save Order to Firebase
window.placeOrderFromSite = async function(itemName, price) {
  const customerName = prompt("Enter your Name for Order:");
  if (!customerName) return;

  try {
    await addDoc(collection(db, "orders"), {
      customerName: customerName,
      itemName: itemName,
      amount: price,
      status: "Pending",
      createdAt: new Date()
    });
    alert("Order Placed Successfully! Admin panel par order update ho gaya hai.");
  } catch (err) {
    alert("Order Error: " + err.message);
  }
};

// Start Loading Process
document.addEventListener('DOMContentLoaded', loadFirebaseData);
