const admin = require('firebase-admin');

async function main() {
  const uid = process.env.ADMIN_UID;
  if (!uid) throw new Error('Set ADMIN_UID to the Firebase Authentication user UID first.');
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: 'sayaart' });
  const user = await admin.auth().getUser(uid);
  await admin.auth().setCustomUserClaims(uid, { ...(user.customClaims || {}), admin: true });
  console.log('Admin claim enabled for UID:', uid);
  console.log('The user must sign out and sign in again (or refresh the ID token) before the claim appears.');
  await admin.app().delete();
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
