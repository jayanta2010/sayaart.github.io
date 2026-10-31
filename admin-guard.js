import { getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js';
import { getAuth, onAuthStateChanged, getIdTokenResult, signOut } from 'https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js';

const firebaseConfig = {
  apiKey: 'AIzaSyC6CxokC0KwAtP9EMilEQHMJQKWCgLWYJc',
  authDomain: 'sayaart.firebaseapp.com',
  projectId: 'sayaart',
  storageBucket: 'sayaart.firebasestorage.app',
  messagingSenderId: '805892692460',
  appId: '1:805892692460:web:417ef9926bbc01d9f288c9'
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
let handled = false;

function goToLogin(reason) {
  const query = new URLSearchParams({ next: 'admin.html' });
  if (reason) query.set('error', reason);
  location.replace('login.html?' + query.toString());
}

onAuthStateChanged(auth, async user => {
  if (handled) return;
  if (!user) {
    handled = true;
    goToLogin('');
    return;
  }
  try {
    const token = await getIdTokenResult(user, true);
    if (token.claims.admin !== true) {
      handled = true;
      await signOut(auth);
      goToLogin('unauthorized');
      return;
    }
    handled = true;
    document.body.classList.add('admin-auth-ready');
  } catch (error) {
    handled = true;
    try { await signOut(auth); } catch (_) {}
    goToLogin('verification');
  }
});
