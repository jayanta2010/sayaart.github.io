import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

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

// Global products array
window.products = [
  {id:1, name:'Classic visiting cards', cat:'Business', price:299, mark:'YOUR BRAND', color:'#d308d0', tag:'BESTSELLER'},
  {id:2, name:'Rounded stickers', cat:'Labels', price:249, mark:'PEEL & GO', color:'#f5cf87', tag:'NEW'},
  {id:3, name:'Premium flyers', cat:'Marketing', price:499, mark:'SAY HELLO', color:'#f1a880', tag:''},
  {id:4, name:'Everyday photo mug', cat:'Gifts', price:349, mark:'GOOD MORNING', color:'#b9cfed', tag:''},
  {id:5, name:'A5 notebooks', cat:'Stationery', price:299, mark:'BIG IDEAS', color:'#d8db0b', tag:'POPULAR'}
];

// Firebase Products Fetching & Dynamic Rendering
async function loadProductsFromFirebase() {
  try {
    const querySnapshot = await getDocs(collection(db, "products"));
    if (!querySnapshot.empty) {
      const firebaseItems = [];
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
      // Merge products
      window.products = [...firebaseItems, ...window.products];
    }
  } catch (err) {
    console.error("Firestore Load Error:", err);
  } finally {
    // Render website products UI
    if (typeof renderProducts === 'function') {
      renderProducts();
    }
  }
}

// Window load hote hi run hoga
window.addEventListener('DOMContentLoaded', loadProductsFromFirebase);
