import { getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js';
import { getAuth, onAuthStateChanged, getIdTokenResult } from 'https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js';

const config = {
  apiKey: 'AIzaSyC6CxokC0KwAtP9EMilEQHMJQKWCgLWYJc',
  authDomain: 'sayaart.firebaseapp.com',
  projectId: 'sayaart',
  storageBucket: 'sayaart.firebasestorage.app',
  messagingSenderId: '805892692460',
  appId: '1:805892692460:web:417ef9926bbc01d9f288c9'
};
const app = getApps().length ? getApps()[0] : initializeApp(config);
const auth = getAuth(app);
const API = 'https://us-central1-sayaart.cloudfunctions.net/privateDesignApi';
const $ = id => document.getElementById(id);
let activeAdmin = null;
let lastCreatedLink = '';

function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function prettyDate(ms) {
  return ms ? new Date(ms).toLocaleString('en-IN', {dateStyle:'medium', timeStyle:'short'}) : '—';
}
function statusLabel(item) {
  if (item.status === 'revoked') return ['Revoked', 'revoked'];
  if (!item.expiresAt || item.expiresAt <= Date.now()) return ['Expired', 'expired'];
  return ['Active', 'active'];
}
function setMessage(message, kind = '') {
  const node = $('privateDesignAdminMessage');
  node.textContent = message;
  node.className = 'pdp-message ' + kind;
}
async function request(path, options = {}) {
  if (!activeAdmin) throw new Error('Sign in with an authorized admin account first.');
  const token = await activeAdmin.getIdToken();
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', 'Bearer ' + token);
  const response = await fetch(API + path, {...options, headers});
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed (' + response.status + ').');
  return data;
}
function currentExpiry() {
  const choice = $('pdpExpiryChoice').value;
  if (choice === 'custom') {
    const raw = $('pdpCustomExpiry').value;
    if (!raw) throw new Error('Choose a custom expiry date and time.');
    return new Date(raw).toISOString();
  }
  const hours = Number(choice);
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}
function showCreatedLink(data) {
  const link = new URL('private-preview.html', location.href);
  link.hash = data.token;
  lastCreatedLink = link.toString();
  $('pdpCreatedLink').value = lastCreatedLink;
  $('pdpCreatedExpiry').textContent = 'Expires: ' + prettyDate(data.expiresAt);
  $('pdpCreatedResult').hidden = false;
}
async function loadPreviews() {
  const target = $('privateDesignPreviewList');
  target.innerHTML = '<p class="help-text">Loading private previews…</p>';
  try {
    const data = await request('/admin/previews');
    if (!data.previews.length) {
      target.innerHTML = '<div class="pdp-empty">No private previews yet. Upload a design to create your first client link.</div>';
      return;
    }
    target.innerHTML = data.previews.map(item => {
      const [label, cls] = statusLabel(item);
      const linkBox = item.previewPath && cls === 'active'
        ? '<div class="pdp-existing-link"><input readonly value="' + esc(new URL('private-preview.html#' + item.previewToken, location.href).toString()) + '" aria-label="Private preview link"><button class="btn pdp-copy-existing" type="button" data-link="' + esc(new URL('private-preview.html#' + item.previewToken, location.href).toString()) + '">Copy link</button><a class="btn pdp-whatsapp-existing" href="https://wa.me/?text=' + encodeURIComponent('Here is your private HD design preview: ' + new URL('private-preview.html#' + item.previewToken, location.href).toString()) + '" target="_blank" rel="noopener noreferrer">WhatsApp</a></div>'
        : '<p class="help-text">The original token is not recoverable for this record. Create a new preview if the client needs another link.</p>';
      return '<article class="pdp-item"><div class="pdp-item-head"><div><h4>' + esc(item.originalName) + '</h4><p>' + (item.size / 1024 / 1024).toFixed(2) + ' MB</p></div><span class="pdp-status ' + cls + '">' + label + '</span></div><div class="pdp-meta"><span>Expires: <b>' + esc(prettyDate(item.expiresAt)) + '</b></span><span>Uploaded: ' + esc(prettyDate(item.createdAt)) + '</span></div>' + linkBox + '<div class="pdp-actions">' + (cls === 'active' ? '<button class="btn pdp-revoke" type="button" data-id="' + esc(item.id) + '">Revoke link</button>' : '') + '<button class="btn btn-danger pdp-delete" type="button" data-id="' + esc(item.id) + '">Delete design</button></div></article>';
    }).join('');
    target.querySelectorAll('.pdp-copy-existing').forEach(btn => btn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(btn.dataset.link); btn.textContent = 'Copied!'; }
      catch (_) { window.prompt('Copy this private link:', btn.dataset.link); }
    }));
    target.querySelectorAll('.pdp-revoke').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Revoke this link now? The client will lose access immediately.')) return;
      btn.disabled = true;
      try { await request('/admin/previews/' + encodeURIComponent(btn.dataset.id) + '/revoke', {method:'POST'}); await loadPreviews(); setMessage('Private preview link revoked.', 'success'); }
      catch (error) { setMessage(error.message, 'error'); btn.disabled = false; }
    }));
    target.querySelectorAll('.pdp-delete').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Permanently delete this design and its private file? This cannot be undone.')) return;
      btn.disabled = true;
      try { await request('/admin/previews/' + encodeURIComponent(btn.dataset.id), {method:'DELETE'}); await loadPreviews(); setMessage('Design and private file deleted.', 'success'); }
      catch (error) { setMessage(error.message, 'error'); btn.disabled = false; }
    }));
  } catch (error) {
    target.innerHTML = '<div class="pdp-empty">Could not load previews: ' + esc(error.message) + '</div>';
  }
}

document.querySelectorAll('[data-tab]').forEach(button => {
  if (button.dataset.tab !== 'privateDesignPreviewsTab') return;
  button.addEventListener('click', () => {
    if (!activeAdmin) {
      $('privateDesignPreviewList').innerHTML = '<div class="pdp-empty">This feature requires a signed-in Firebase account with the server-verified admin claim. Ask the project owner to authorize your account, then sign out and sign back in.</div>';
      return;
    }
    loadPreviews();
  });
});

$('pdpExpiryChoice').addEventListener('change', () => {
  $('pdpCustomExpiryWrap').hidden = $('pdpExpiryChoice').value !== 'custom';
});
$('privateDesignPreviewForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!activeAdmin) return setMessage('You are not authorized to upload private previews.', 'error');
  const file = $('pdpDesignFile').files[0];
  if (!file) return setMessage('Choose a JPG, PNG, or WebP design first.', 'error');
  if (file.size > 30 * 1024 * 1024) return setMessage('The maximum file size is 30 MB.', 'error');
  let expiry;
  try { expiry = currentExpiry(); } catch (error) { return setMessage(error.message, 'error'); }
  const form = new FormData();
  form.append('design', file, file.name);
  form.append('expiresAt', expiry);
  const button = $('pdpCreateBtn');
  button.disabled = true;
  setMessage('Uploading original artwork securely…');
  try {
    const data = await request('/admin/previews', {method:'POST', body:form});
    showCreatedLink(data);
    $('privateDesignPreviewForm').reset();
    $('pdpCustomExpiryWrap').hidden = true;
    setMessage('Private preview created. Copy or share the link below; the raw token is not stored in browser-readable database records.', 'success');
    await loadPreviews();
  } catch (error) {
    setMessage(error.message, 'error');
  } finally {
    button.disabled = false;
  }
});
$('pdpCopyLinkBtn').addEventListener('click', async () => {
  if (!lastCreatedLink) return;
  try { await navigator.clipboard.writeText(lastCreatedLink); $('pdpCopyLinkBtn').textContent = 'Copied!'; }
  catch (_) { window.prompt('Copy this private link:', lastCreatedLink); }
});
$('pdpWhatsappBtn').addEventListener('click', () => {
  if (!lastCreatedLink) return;
  const message = 'Here is your private HD design preview from Saya Art & Advertising: ' + lastCreatedLink;
  window.open('https://wa.me/?text=' + encodeURIComponent(message), '_blank', 'noopener,noreferrer');
});
$('pdpReloadBtn').addEventListener('click', loadPreviews);

onAuthStateChanged(auth, async user => {
  activeAdmin = null;
  $('privateDesignAuthState').textContent = 'Checking Firebase admin authorization…';
  if (!user) {
    $('privateDesignAuthState').textContent = 'Not signed in. Sign in with the Firebase account authorized for admin previews.';
    return;
  }
  try {
    const result = await getIdTokenResult(user, true);
    if (result.claims.admin !== true) {
      $('privateDesignAuthState').textContent = 'Signed in, but this account does not have the server-verified admin permission.';
      return;
    }
    activeAdmin = user;
    $('privateDesignAuthState').textContent = 'Authorized admin · ' + (user.phoneNumber || user.email || user.uid);
    $('privateDesignPreviewForm').querySelectorAll('input,textarea,select,button').forEach(el => el.disabled = false);
    await loadPreviews();
  } catch (_) {
    $('privateDesignAuthState').textContent = 'Could not verify admin authorization. Sign out, sign in again, and retry.';
  }
});
