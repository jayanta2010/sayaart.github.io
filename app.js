import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
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

let confirmationResult = null;

// Setup Recaptcha
function initRecaptcha() {
  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      'size': 'invisible',
      'callback': (response) => {}
    });
  }
}

// 1. Send OTP SMS
const sendOtpBtn = document.getElementById('sendOtpBtn');
if (sendOtpBtn) {
  sendOtpBtn.onclick = async () => {
    let phoneNumber = document.getElementById('custPhone').value.trim();
    if (!phoneNumber) return alert("Enter valid phone number!");

    // Ensure +91 prefix for India
    if (!phoneNumber.startsWith('+')) {
      phoneNumber = '+91' + phoneNumber;
    }

    initRecaptcha();
    const appVerifier = window.recaptchaVerifier;

    try {
      sendOtpBtn.innerText = "Sending...";
      confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      alert("OTP sent successfully via SMS!");
      document.getElementById('otpSection').style.display = 'block';
      sendOtpBtn.innerText = "Resend OTP";
    } catch (error) {
      console.error("OTP Error:", error);
      alert("Failed to send SMS OTP: " + error.message);
      sendOtpBtn.innerText = "Send OTP";
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.render().then(widgetId => grecaptcha.reset(widgetId));
      }
    }
  };
}

// 2. Verify OTP
const verifyOtpBtn = document.getElementById('verifyOtpBtn');
if (verifyOtpBtn) {
  verifyOtpBtn.onclick = async () => {
    const code = document.getElementById('otpInput').value.trim();
    if (!code || !confirmationResult) return alert("Enter 6-digit OTP!");

    try {
      const result = await confirmationResult.confirm(code);
      alert("Phone Number Verified Successfully!");
      
      // Enable Place Order Button after successful verification
      const placeOrderBtn = document.getElementById('placeOrderBtn');
      if (placeOrderBtn) {
        placeOrderBtn.disabled = false;
        placeOrderBtn.style.opacity = '1';
      }
    } catch (error) {
      alert("Invalid OTP! Please try again.");
    }
  };
}
