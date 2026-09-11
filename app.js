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

// Default Static Products (Fallback)
let defaultProducts = [
  { id: 1, name: 'Classic visiting cards', cat: 'Business', price: 299, mark: 'YOUR BRAND', color: '#d308d0', tag: 'BESTSELLER' },
  { id: 2, name: 'Rounded stickers', cat: 'Labels', price: 249, mark: 'PEEL & GO', color: '#f5cf87', tag: 'NEW' },
  { id: 3, name: 'Premium flyers', cat: 'Marketing', price: 499, mark: 'SAY HELLO', color: '#f1a880', tag: '' },
  { id: 4, name: 'Everyday photo mug', cat: 'Gifts', price: 349, mark: 'GOOD MORNING', color: '#b9cfed', tag: '' },
  { id: 5, name: 'A5 notebooks', cat: 'Stationery', price: 299, mark: 'BIG IDEAS', color: '#d8db0b', tag: 'POPULAR' }
];

window.products = [...defaultProducts];

// 1. Fetch Products from Firestore Real-time
async function fetchFirebaseProducts() {
  try {
    const querySnapshot = await getDocs(collection(db, "products"));
    if (!querySnapshot.empty) {
      let firebaseItems = [];
      querySnapshot.forEach((doc) => {
        const item = doc.data();
        firebaseItems.push({
          id: doc.id,
          name: item.name,
          price: Number(item.price),
          cat: 'Custom Art',
          mark: 'SAYA ART',
          color: '#27ae60',
          tag: 'NEW',
          imageUrl: item.imageUrl
        });
      });
      // Combine Firebase products with default products
      window.products = [...firebaseItems, ...defaultProducts];
      
      // Trigger site UI update
      if (typeof renderProducts === 'function') {
        renderProducts();
      }
    }
  } catch (error) {
    console.error("Error fetching products from Firebase:", error);
  }
}

// 2. Customer Order Handler
window.placeOrderToFirebase = async function(customerDetails, cartItems, totalAmount) {
  try {
    await addDoc(collection(db, "orders"), {
      customerName: customerDetails.name || "Guest Customer",
      itemName: cartItems.map(i => i.name).join(", "),
      amount: totalAmount,
      status: "Pending",
      createdAt: new Date()
    });
    alert("Order Placed Successfully!");
  } catch (err) {
    alert("Order Error: " + err.message);
  }
};

document.addEventListener('DOMContentLoaded', fetchFirebaseProducts);
