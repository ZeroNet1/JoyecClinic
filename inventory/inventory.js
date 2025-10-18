// inventory.js (مخصص لصفحة HTML التي أرسلتها)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc as firestoreDoc,
  getDoc,
  query,
  orderBy,
  Timestamp
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

// تأكد أن لديك هذا الملف ويُرجع Promise يحقق صلاحية المستخدم
import { checkUserRole } from "../shared/auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAZSMTIQ9o2Aqool263jkvVq-qzhEHEFfM",
  authDomain: "beautycenter-6e1cf.firebaseapp.com",
  projectId: "beautycenter-6e1cf",
  storageBucket: "beautycenter-6e1cf.firebasestorage.app",
  messagingSenderId: "706085429",
  appId: "1:706085429:web:1f0ce5d3eb27c35372277c",
  measurementId: "G-QL4LZG5KJZ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ---------- مساعدة للحصول على عناصر DOM بأمان ---------- */
function el(id) {
  return document.getElementById(id) || null;
}

/* ---------- تهيئة بعد التحقق من صلاحية المستخدم ---------- */
checkUserRole()
  .then(userData => {
    if (!userData) {
      console.warn('المستخدم غير مصادق - لن يتم تحميل المخزون. تأكد من تسجيل الدخول.');
      showMessage('يرجى تسجيل الدخول لعرض المخزون.', 'warning');
      return;
    }
    const userNameEl = el('userName');
    if (userNameEl) userNameEl.textContent = userData.name || '';

    setupEventListeners();
    loadInventory();
  })
  .catch(err => {
    console.error('خطأ في التحقق من الصلاحية:', err);
    showMessage('حدث خطأ في التحقق من الصلاحية. افتح الكنصل لمزيد من التفاصيل.', 'error');
  });

/* ---------- ربط مستمعي الأحداث ---------- */
function setupEventListeners() {
  const form = el('addProductForm');
  if (form) {
    if (!form.dataset.hasListener) {
      form.addEventListener('submit', handleAddProductFormSubmit);
      form.dataset.hasListener = '1';
    }
  } else {
    console.warn('#addProductForm غير موجود في الصفحة.');
  }
}

/* ---------- عرض رسائل للمستخدم في العنصر message (إذا موجود) ---------- */
function showMessage(text, type = 'info', timeout = 4000) {
  const msg = el('message');
  if (!msg) {
    // لا عنصر مخصص: نعرض في الكونسل فقط
    if (type === 'error') console.error(text);
    else if (type === 'warning') console.warn(text);
    else console.log(text);
    return;
  }
  msg.textContent = text;
  msg.className = 'message ' + type;
  if (timeout > 0) {
    setTimeout(() => {
      // لو مازال نفس النص، نمسحه
      if (msg.textContent === text) {
        msg.textContent = '';
        msg.className = 'message';
      }
    }, timeout);
  }
}

/* ---------- إرسال نموذج إضافة المنتج ---------- */
async function handleAddProductFormSubmit(e) {
  e.preventDefault();
  const productName = (el('productName')?.value || '').trim();
  const quantity = parseInt(el('quantity')?.value || '0', 10) || 0;
  const unitPrice = parseFloat(el('unitPrice')?.value || '0') || 0;
  const totalPrice = quantity * unitPrice;

  if (!productName) {
    showMessage('⚠️ يرجى إدخال اسم المنتج.', 'warning');
    return;
  }
  if (quantity < 0) {
    showMessage('⚠️ الكمية لا يمكن أن تكون سالبة.', 'warning');
    return;
  }
  if (unitPrice < 0) {
    showMessage('⚠️ سعر الوحدة لا يمكن أن يكون سالبًا.', 'warning');
    return;
  }

  try {
    await addDoc(collection(db, "inventory"), {
      name: productName,
      quantity,
      unitPrice,
      totalPrice,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    showMessage('✅ تم إضافة المنتج بنجاح.', 'success');
    const form = el('addProductForm'); if (form) form.reset();
    loadInventory();
  } catch (err) {
    console.error('خطأ عند إضافة المنتج:', err);
    showMessage('❌ حدث خطأ أثناء إضافة المنتج. افتح الكنصل للمزيد.', 'error', 6000);
  }
}

/* ---------- تحميل وعرض منتجات المخزون ---------- */
async function loadInventory() {
  const tbody = document.querySelector('#inventoryTable tbody');
  if (!tbody) {
    console.error('#inventoryTable tbody غير موجود — تأكد من وجود <tbody> داخل الجدول.');
    return;
  }

  // مؤقت تحميل
  tbody.innerHTML = `<tr><td colspan="5" style="text-align:center">جاري التحميل...</td></tr>`;

  try {
    const q = query(collection(db, "inventory"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);

    if (snap.empty) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center">لا توجد منتجات محفوظة</td></tr>`;
      showMessage('لا توجد منتجات في المخزون.', 'info', 3500);
      return;
    }

    tbody.innerHTML = '';
    let totalProducts = 0;
    let totalValue = 0;

    snap.forEach(docSnap => {
      const p = docSnap.data() || {};
      const name = p.name || 'بدون اسم';
      const quantity = Number.isFinite(p.quantity) ? p.quantity : (p.quantity ? Number(p.quantity) : 0);
      const unitPrice = Number.isFinite(p.unitPrice) ? p.unitPrice : (p.unitPrice ? Number(p.unitPrice) : 0);
      const total = Number.isFinite(p.totalPrice) ? p.totalPrice : (quantity * unitPrice);

      totalProducts++;
      totalValue += Number(total) || 0;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(name)}</td>
        <td>${quantity}</td>
        <td>${formatNumber(unitPrice)} جنيه</td>
        <td>${formatNumber(total)} جنيه</td>
        <td>
          <button class="edit-btn" data-id="${docSnap.id}">تعديل</button>
          <button class="delete-btn" data-id="${docSnap.id}">حذف</button>
        </td>
      `;
      // ربط الأزرار
      tr.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => window.deleteProduct(btn.dataset.id));
      });
      tr.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => window.editProduct(btn.dataset.id));
      });

      tbody.appendChild(tr);
    });

    showMessage(`تم تحميل ${totalProducts} منتج — قيمة المخزون: ${formatNumber(totalValue)} جنيه`, 'success', 4000);

  } catch (err) {
    console.error('خطأ في تحميل المنتجات:', err);
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:red">حدث خطأ في تحميل المنتجات</td></tr>`;
    showMessage('❌ حدث خطأ أثناء تحميل المنتجات. افتح الكنصل للمزيد.', 'error', 6000);
  }
}

/* ---------- حذف منتج ---------- */
window.deleteProduct = async function(productId) {
  if (!productId) return;
  if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;
  try {
    await deleteDoc(firestoreDoc(db, "inventory", productId));
    showMessage('✅ تم حذف المنتج.', 'success');
    loadInventory();
  } catch (err) {
    console.error('خطأ عند حذف المنتج:', err);
    showMessage('❌ حدث خطأ أثناء الحذف.', 'error', 6000);
  }
};

/* ---------- تعديل منتج (مبسط باستخدام prompt) ---------- */
window.editProduct = async function(productId) {
  if (!productId) return;
  try {
    const docSnap = await getDoc(firestoreDoc(db, "inventory", productId));
    if (!docSnap.exists()) { showMessage('المنتج غير موجود.', 'warning'); return; }
    const p = docSnap.data() || {};

    const newName = prompt('اسم المنتج:', p.name || '');
    if (newName === null) return;

    const newQuantity = prompt('الكمية:', p.quantity || 0);
    if (newQuantity === null) return;

    const newUnitPrice = prompt('سعر الوحدة:', p.unitPrice || 0);
    if (newUnitPrice === null) return;

    const quantity = parseInt(newQuantity, 10);
    const unitPrice = parseFloat(newUnitPrice);
    if (isNaN(quantity) || quantity < 0) { showMessage('⚠️ الكمية غير صحيحة.', 'warning'); return; }
    if (isNaN(unitPrice) || unitPrice < 0) { showMessage('⚠️ سعر الوحدة غير صحيح.', 'warning'); return; }

    const totalPrice = quantity * unitPrice;
    await updateDoc(firestoreDoc(db, "inventory", productId), {
      name: newName.trim(),
      quantity,
      unitPrice,
      totalPrice,
      updatedAt: Timestamp.now()
    });

    showMessage('✅ تم تحديث المنتج.', 'success');
    loadInventory();
  } catch (err) {
    console.error('خطأ عند تعديل المنتج:', err);
    showMessage('❌ حدث خطأ أثناء التعديل.', 'error', 6000);
  }
};

/* ---------- مساعدة: هروب HTML و تنسيق الأرقام ---------- */
function escapeHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
function formatNumber(n) {
  const num = Number(n) || 0;
  return num.toFixed(2);
}
