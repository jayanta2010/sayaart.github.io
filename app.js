// Admin Panel Logic with Error Handling
async function initAdminPanel() {
  const adminAddForm = document.getElementById('adminAddProductForm');
  const adminProductList = document.getElementById('adminProductList');
  const adminOrdersList = document.getElementById('adminOrdersList');

  if (!adminAddForm) return; // Agar admin page par nahi hain toh ruk jayein

  // 1. Add Product Form Submission
  adminAddForm.onsubmit = async (e) => {
    e.preventDefault();

    const pType = document.getElementById('pType').value;
    const name = document.getElementById('pName').value;
    const price = Number(document.getElementById('pPrice').value);
    const description = document.getElementById('pDesc').value;
    const imageUrl = document.getElementById('pImg').value;

    const frontOutline = document.getElementById('pFrontOutline')?.value || '';
    const backOutline = document.getElementById('pBackOutline')?.value || '';
    const finishedLink = document.getElementById('pFinishedLink')?.value || '';

    const hasPhoto = document.getElementById('chkPhoto')?.checked ?? true;
    const hasText = document.getElementById('chkText')?.checked ?? true;

    const parseOptions = (str) => str ? str.split(',').map(s => {
      const [n, ex] = s.split(':');
      return { name: n.trim(), extra: Number(ex || 0) };
    }) : [];

    try {
      await addDoc(collection(db, "products"), {
        pType, name, price, description, imageUrl,
        frontOutline, backOutline, finishedLink,
        hasPhoto, hasText,
        sizes: parseOptions(document.getElementById('pSizes').value),
        qualities: parseOptions(document.getElementById('pQualities').value)
      });
      alert("Product added successfully!");
      adminAddForm.reset();
      loadAdminProducts();
    } catch (err) {
      alert("Error adding product: " + err.message);
    }
  };

  // 2. Load Products to Admin
  async function loadAdminProducts() {
    if (!adminProductList) return;
    adminProductList.innerHTML = "<p style='color:#2563eb;'>Loading catalogue...</p>";
    
    try {
      const snap = await getDocs(collection(db, "products"));
      if (snap.empty) {
        adminProductList.innerHTML = "<p style='color:#64748b;'>No products added yet.</p>";
        return;
      }

      adminProductList.innerHTML = "";
      snap.forEach(docSnap => {
        const p = docSnap.data();
        adminProductList.innerHTML += `
          <div class="product-list-item" style="display:flex; justify-content:space-between; align-items:center; border: 1px solid #cbd5e1; padding: 12px; margin-bottom: 10px; border-radius: 6px;">
            <div>
              <b>${p.name}</b> (${p.pType === 'stock' ? 'Stock Item' : 'Customizable'}) - ₹${p.price}<br>
              <small style="color:#64748b;">${p.description || ''}</small>
            </div>
            <button class="btn btn-danger" onclick="deleteProduct('${docSnap.id}')">Delete</button>
          </div>
        `;
      });
    } catch (err) {
      console.error("Firestore Product Fetch Error:", err);
      adminProductList.innerHTML = `<p style='color:#ef4444;'><b>Error loading catalogue:</b> ${err.message}</p>`;
    }
  }

  // 3. Load Orders to Admin
  async function loadAdminOrders() {
    if (!adminOrdersList) return;
    adminOrdersList.innerHTML = "<p style='color:#2563eb;'>Loading orders...</p>";

    try {
      const snap = await getDocs(collection(db, "orders"));
      if (snap.empty) {
        adminOrdersList.innerHTML = "<p style='color:#64748b;'>No orders placed yet.</p>";
        return;
      }

      adminOrdersList.innerHTML = "";
      snap.forEach(docSnap => {
        const o = docSnap.data();
        let itemsHtml = (o.items || []).map(item => `
          <div style="border:1px solid #e2e8f0; padding:10px; margin-top:8px; border-radius:6px; background:#f8fafc;">
            <b>${item.name}</b> (Qty: ${item.quantity}) - ₹${item.totalPrice}<br>
            ${item.personalMessage ? `<div style="color:#b45309; font-size:12px; margin-top:4px;"><b>Personal Message:</b> "${item.personalMessage}"</div>` : ''}
            ${item.rawUploadedPhoto ? `<div style="margin-top:5px;"><a href="${item.rawUploadedPhoto}" download="original-customer-photo.png" style="color:#16a34a; font-weight:bold; font-size:12px; text-decoration:underline;">⬇ Download High-Res Original Customer Photo</a></div>` : ''}
            <div style="display:flex; gap:10px; margin-top:8px;">
              ${item.frontArtwork ? `<div><small>Front View Design:</small><br><img src="${item.frontArtwork}" class="design-preview-box"></div>` : ''}
              ${item.backArtwork ? `<div><small>Back View Design:</small><br><img src="${item.backArtwork}" class="design-preview-box"></div>` : ''}
            </div>
          </div>
        `).join('');

        adminOrdersList.innerHTML += `
          <div class="order-list-item" style="border:1px solid #cbd5e1; padding:15px; border-radius:8px; margin-bottom:15px; background:#fff;">
            <b>Order #${o.orderId || docSnap.id}</b> - <span style="color:#16a34a; font-weight:bold;">₹${o.amount}</span><br>
            Customer: <b>${o.customerName || 'N/A'}</b> (${o.customerPhone || 'N/A'})<br>
            Address: <b>${o.deliveryAddress || 'N/A'}</b>
            <div style="margin-top: 10px;">${itemsHtml}</div>
          </div>
        `;
      });
    } catch (err) {
      console.error("Firestore Orders Fetch Error:", err);
      adminOrdersList.innerHTML = `<p style='color:#ef4444;'><b>Error loading orders:</b> ${err.message}</p>`;
    }
  }

  window.deleteProduct = async (id) => {
    if (confirm("Delete product?")) {
      try {
        await deleteDoc(doc(db, "products", id));
        loadAdminProducts();
      } catch (err) {
        alert("Failed to delete product: " + err.message);
      }
    }
  };

  loadAdminProducts();
  loadAdminOrders();
}
