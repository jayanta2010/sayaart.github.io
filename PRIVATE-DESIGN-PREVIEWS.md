# Private HD Design Preview

## What this feature adds

- A Private Design Previews tab in the existing admin page.
- Original JPG/JPEG/PNG/WebP upload (30 MB maximum; no client-side resize or recompression).
- Simple upload-to-link workflow with configurable expiry, copy link, and WhatsApp sharing. No password or order ID.
- Private Storage objects, unpredictable 256-bit random tokens, SHA-256 token hashes, and AES-256-GCM-encrypted token recovery for authorized admins.
- Backend validation on every metadata, image, and response request. Expiry and revocation are checked again before image streaming.
- Admin-only list, revoke, and permanent delete operations protected by a verified Firebase ID token and the server-side admin: true custom claim.
- Canva-style client preview with zoom, pan, fit/reset, expiry notice, and optional WhatsApp contact. No approval or feedback workflow.
- No download button or permanent Firebase download URL. The browser receives the image as a no-store streamed response and displays a temporary browser Blob URL.

## Important boundaries

GitHub Pages serves the static HTML only. The private API is a Firebase Cloud Function in us-central1; original files are stored under private-design-previews/ in the existing sayaart.firebasestorage.app bucket.

A private link is a bearer secret: anyone who receives or forwards it can view the design until it expires or is revoked. Screenshots, screen recordings, browser developer tools, and another camera cannot be reliably prevented. This interface discourages casual copying but does not promise screenshot prevention.

The current repository did not contain Firebase rules or a server-side admin system for the older admin tools. The new private-preview endpoints enforce server-side admin claims. Do not assume this also secures older product/order actions in app.js. The rule snippets are deliberately separate and must be merged into the current Firebase Console rules after reviewing them; replacing unknown live rules blindly could break existing storefront features.

## Prerequisites

1. Node.js 20 or newer.
2. Firebase CLI (npm install -g firebase-tools) and permission to deploy Functions to project sayaart.
3. Firebase project on the Blaze (pay-as-you-go) plan for Cloud Functions and required Google Cloud services.
4. Firebase Authentication phone sign-in enabled, and an admin account that already exists in Authentication.
5. The existing Cloud Storage bucket sayaart.firebasestorage.app available in the project.

## Configure and deploy the backend

Run from a local clone of this feature branch:

    cd functions
    npm install
    cd ..

    firebase login
    firebase use sayaart

Create a 32-byte encryption key locally. This prints a value; do not commit it:

    node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

Set it as a Firebase secret. Paste the generated base64 value when prompted:

    firebase functions:secrets:set PREVIEW_TOKEN_ENCRYPTION_KEY --project sayaart

This key lets the backend recover active links for authorized admins while the database stores both a SHA-256 token hash and an authenticated encrypted token. Losing/changing the key means links already encrypted with the old key cannot be recovered from the admin list; their token hashes still validate links clients already have. Do not rotate this key without a planned migration.

Optional origin and client WhatsApp configuration:

    copy functions\.env.example functions\.env.sayaart

Edit functions/.env.sayaart locally. Set ALLOWED_ORIGINS to the exact origin(s) where the site is hosted, comma-separated. The defaults are https://jayanta2010.github.io and https://sayaart.github.io. If using a custom domain, add it. Set WHATSAPP_CONTACT_NUMBER to digits only including country code, e.g. 91XXXXXXXXXX. This environment file is git-ignored and must not be committed.

Deploy only the backend (this does not publish or change GitHub Pages):

    firebase deploy --only functions:privateDesignApi --project sayaart

The API base URL used by the two frontend files is:

    https://us-central1-sayaart.cloudfunctions.net/privateDesignApi

Verify the backend after deployment by opening:

    https://us-central1-sayaart.cloudfunctions.net/privateDesignApi/health

It should return JSON with ok: true. This health endpoint does not prove Storage rules or the complete flow are configured.

## Grant the admin custom claim

The feature will not allow an ordinary customer account to upload, list, revoke, or delete previews. Grant admin: true only to the intended admin Firebase Auth UID.

1. In Firebase Console → Authentication → Users, find the intended account and copy its UID.
2. From the functions directory, install dependencies if not already installed and authenticate locally with Google Application Default Credentials using an account authorized to administer Firebase Authentication:

       gcloud auth application-default login

3. In PowerShell, set the UID and run the helper:

       $env:ADMIN_UID="PASTE_FIREBASE_AUTH_UID"
       node set-admin-claim.js

   On macOS/Linux:

       ADMIN_UID="PASTE_FIREBASE_AUTH_UID" node set-admin-claim.js

The helper uses Application Default Credentials; it does not require downloading or committing a service-account JSON file. If you instead use a service-account file, keep it outside the repository and set GOOGLE_APPLICATION_CREDENTIALS only in your local shell.

The admin must sign out and sign in again (or refresh the ID token) after the claim is granted. The admin panel will display the authorization state.

## Merge the security rules

These files contain snippets, not a replacement for the unknown existing production rules:

- security-rules/firestore.private-design-previews.rules
- security-rules/storage.private-design-previews.rules

In Firebase Console → Firestore Database → Rules, merge the privateDesignPreviews match block inside the existing /databases/{database}/documents rules. In Firebase Console → Storage → Rules, merge the private-design-previews/{allPaths=**} block inside the existing bucket rules. Both deny direct client SDK access to private preview records/files; the Cloud Functions Admin SDK accesses them server-side and bypasses client rules.

Do not paste either snippet as the entire ruleset unless you intentionally want to deny access to unrelated data. Review the existing production rules first and test storefront reads, checkout/order flows, and admin workflows after any rules change. This repository snapshot did not include the currently deployed rules, so their existing behavior cannot be verified from source control.

## GitHub Pages

Merge the feature branch into the production branch only after review. GitHub Pages will then publish admin.html, private-design-admin.js, and private-preview.html as static files. The Cloud Function must be deployed separately. Do not put service-account keys, encryption keys, ID tokens, or .env.sayaart in GitHub.

## Admin usage

1. Sign in to the website with the Firebase Authentication account that has the admin custom claim.
2. Open admin.html → Private Design Previews.
3. Choose the original design file, enter client name, optional reference/message, and expiry.
4. Select Upload design & create private link.
5. Copy the new link or share it through WhatsApp. The link token is a bearer secret.
6. Use the generated previews list to copy an active link again, see expiry and access status, revoke access immediately, or permanently delete the file and record.

Links are created from the current site location so the relative GitHub Pages path is preserved. A revoked/expired/invalid link displays a distinct message. A new preview should be created if a client needs a replacement link.

## Test checklist before production

- [ ] GET /health returns ok: true.
- [ ] Non-admin and signed-out requests to GET /admin/previews return 401/403.
- [ ] Admin can upload valid JPG, PNG, and WebP files up to 30 MB; mismatched MIME/signature and over-limit uploads fail.
- [ ] Client can open a link and zoom/pan/fit the original image.
- [ ] The browser network panel shows no Firebase Storage download URL and no permanent public URL.
- [ ] An invalid token returns the invalid-link state.
- [ ] An expired token returns the expired-link state.
- [ ] Revoking an active link immediately blocks metadata and image requests.
- [ ] Deleting a design removes both its Storage object and Firestore record.
- [ ] Existing homepage, login, products, cart, checkout, orders, and existing admin tabs still work after merging frontend changes.
- [ ] Merge the rules snippets into current rules and test all existing collection permissions before publishing rule changes.

The API has per-instance rate limits. They are a useful baseline, not a distributed abuse-prevention system; for high-volume/public use, add a shared rate limiter or Cloud Armor/API gateway policy and monitoring.
