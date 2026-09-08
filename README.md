# Ink & Craft storefront demo

An original, self-contained storefront prototype for a custom-print studio. It is intentionally not a copy of Vistaprint branding, code, copy, or assets.

## Run it

Open `index.html` in a modern browser. No build step is required.

## Included working flows

- Responsive homepage, category filtering, product search, and product personalisation preview
- Optional artwork upload selection, quantity and text selection, bag, checkout form, and demo order creation
- Local Admin area: shop identity/contact/tax fields, editable session prices, gateway settings, and orders
- State is stored in the browser via localStorage so it persists across refreshes on that device.

## Before a real launch

This is a front-end prototype. For production, build a server-side system with secure admin authentication, database, order notifications/invoices, image/design asset storage, server-side payment order creation and webhook verification. Never store payment secrets in browser code or localStorage. Razorpay is a common option for India, but the final choice and merchant account need to be yours.

To personalize it now: select **Admin** in the header and update the Shop profile and Payments sections.
