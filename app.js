import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

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

// Recaptcha Initialize
function initRecaptcha() {
  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      'size': 'invisible'
    });
  }
}

// 1. Send OTP Function
window.sendCustomerOTP = function() {
  const phone = document.getElementById('custPhone').value;
  if (!phone.startsWith('+91') || phone.length < 13) {
    alert("Please enter valid mobile number with +91");
    return;
  }

  initRecaptcha();
  const appVerifier = window.recaptchaVerifier;

  signInWithPhoneNumber(auth, phone, appVerifier)
    .then((confirmationResult) => {
      window.confirmationResult = confirmationResult;
      document.getElementById('phone-step').style.display = 'none';
      document.getElementById('otp-step').style.display = 'block';
      alert("OTP sent to " + phone);
    })
    .catch((error) => {
      alert("OTP Error: " + error.message);
    });
};

// 2. Verify OTP & Open Razorpay
window.verifyOTPAndPay = function() {
  const otp = document.getElementById('otpInput').value;
  if (!otp || otp.length !== 6) {
    alert("Enter 6-digit OTP");
    return;
  }

  window.confirmationResult.confirm(otp)
    .then((result) => {
      // Login Success - Trigger Razorpay Payment
      openRazorpayPayment(result.user);
    })
    .catch((error) => {
      alert("Invalid OTP! Try again.");
    });
};

// 3. Razorpay Checkout
function openRazorpayPayment(user) {
  const name = document.getElementById('custName').value;
  const address = document.getElementById('custAddress').value;
  const phone = document.getElementById('custPhone').value;

  const options = {
    "key": "rzp_test_YOUR_KEY_HERE", // Razorpay Key ID
    "amount": window.selectedPrice * 100,
    "currency": "INR",
    "name": "Saya Art & Advertising",
    "description": window.selectedItemName,
    "handler": async function (response) {
      await addDoc(collection(db, "orders"), {
        orderId: "ORD-" + Math.floor(100000 + Math.random() * 900000),
        paymentId: response.razorpay_payment_id,
        customerName: name,
        customerPhone: phone,
        deliveryAddress: address,
        itemName: window.selectedItemName,
        amount: window.selectedPrice,
        paymentStatus: "PAID",
        uid: user.uid,
        createdAt: new Date()
      });
      alert("Order Placed Successfully!");
      location.reload();
    },
    "prefill": { "name": name, "contact": phone },
    "theme": { "color": "#27ae60" }
  };

  const rzp = new Razorpay(options);
  rzp.open();
}
