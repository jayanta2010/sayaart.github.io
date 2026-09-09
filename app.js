// Firebase ES Module Imports
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

// Default Local Products Fallback
let products = [
  {id:1, name:'Classic visiting cards', cat:'Business', price:299, mark:'YOUR BRAND', color:'#d3o8do', tag:'BESTSELLER'},
  {id:2, name:'Rounded stickers', cat:'Labels', price:249, mark:'PEEL & GO', color:'#f5cf87', tag:'NEW'},
  {id:3, name:'Premium flyers', cat:'Marketing', price:499, mark:'SAY HELLO', color:'#f1a880', tag:''},
  {id:4, name:'Everyday photo mug', cat:'Gifts', price:349, mark:'GOOD MORNING', color:'#b9cfed', tag:''},
  {id:5, name:'A5 notebooks', cat:'Stationery', price:299, mark:'BIG IDEAS', color:'#d8db0b', tag:'POPULAR'}
];

// Firebase Firestore se Products load karne ka function
async function loadFirebaseProducts() {
  try {
    const querySnapshot = await getDocs(collection(db, "products"));
    if(!querySnapshot.empty) {
      let fbProducts = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        fbProducts.push({
          id: doc.id,
          name: data.name,
          price: data.price,
          cat: 'Uploaded',
          imageUrl: data.imageUrl,
          mark: 'SAYA ART',
          color: '#e74c3c'
        });
      });
      // Purane list ke sath new Firebase products merge karein
      products = [...fbProducts, ...products];
      if (typeof renderProducts === 'function') {
        renderProducts();
      }
    }
  } catch (err) {
    console.error("Firestore product load error:", err);
  }
}

// Checkout karte waqt Firestore mein Order bhejney ka function
window.saveOrderToFirebase = async function(customerDetails, cartItems, totalAmount) {
  try {
    await addDoc(collection(db, "orders"), {
      customerName: customerDetails.name || "Guest Customer",
      itemName: cartItems.map(item => item.name).join(", "),
      amount: totalAmount,
      status: "Pending",
      createdAt: new Date()
    });
    console.log("Order saved to Firebase successfully!");
  } catch(err) {
    console.error("Order save error:", err);
  }
};

// Site load hote hi Firebase products load hongi
document.addEventListener('DOMContentLoaded', loadFirebaseProducts);
