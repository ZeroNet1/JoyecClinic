// customers.js - إصدار معرف رقمي متسلسل (1,2,3,...) مع قفل هاتف customers_by_phone
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  doc,
  runTransaction,
  Timestamp
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { checkUserRoleWithShift } from "../shared/auth-check.js";

// --- تكوين Firebase (نفس بياناتك) ---
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

// التحقق من صلاحية المستخدم مع الشيفت (كما عندك)
checkUserRoleWithShift().then(userData => {
  if (userData) {
    const userNameEl = document.getElementById('userName');
    if (userNameEl) userNameEl.textContent = userData.name || '';
    loadStats();
    setupCustomerForm();
  } else {
    console.warn('لم يتم جلب بيانات المستخدم من checkUserRoleWithShift.');
  }
}).catch(err => {
  console.error('خطأ في التحقق من صلاحية المستخدم:', err);
});

// ---------- إعداد نموذج إضافة العميل (رقمي) ----------
async function setupCustomerForm() {
  const form = document.getElementById('addCustomerForm');
  if (!form) {
    console.warn('#addCustomerForm غير موجود.');
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = (document.getElementById('customerName')?.value || '').trim();
    let phone = (document.getElementById('customerPhone')?.value || '').trim();
    const balance = parseFloat(document.getElementById('customerBalance')?.value) || 0;
    const paymentMethod = (document.getElementById('customerPaymentMethod')?.value || 'نقدي');

    // مفتاح الهاتف نبقيه بدون فراغات
    const phoneKey = phone.replace(/\s+/g, '');

    if (!name || !phone) {
      showMessage('⚠️ يرجى ملء جميع الحقول الإلزامية!', 'error');
      return;
    }
    if (!isValidPhone(phoneKey)) {
      showMessage('⚠️ رقم الهاتف غير صحيح! تأكد من شكل 010/011/012/015XXXXXXXX', 'error');
      return;
    }

    try {
      // تنفيذ المعاملة: 1) تأكد أن الهاتف غير موجود 2) اقرأ/حدّث العداد 3) أنشئ مستند العميل باستخدام doc id = رقم السِلسلة
      const generatedNumericId = await runTransaction(db, async (transaction) => {
        const counterRef = doc(db, "counters", "customersCounter");
        const phoneRef = doc(db, "customers_by_phone", phoneKey);

        // 1) تحقق من وجود رقم الهاتف كقفل
        const phoneSnap = await transaction.get(phoneRef);
        if (phoneSnap.exists()) {
          throw new Error('PHONE_EXISTS');
        }

        // 2) اقرأ أو أنشئ العداد
        const counterSnap = await transaction.get(counterRef);
        let nextSeq = 1;
        if (!counterSnap.exists()) {
          transaction.set(counterRef, { seq: 1, createdAt: Timestamp.now() });
          nextSeq = 1;
        } else {
          const cur = Number(counterSnap.data().seq || 0);
          nextSeq = cur + 1;
          transaction.update(counterRef, { seq: nextSeq });
        }

        // 3) استخدم الرقم كنص لمعرف الوثيقة (Firestore doc id يجب أن يكون string)
        const docIdString = String(nextSeq); // e.g. "1", "2"

        // 4) أنشئ مستند العميل داخل المعاملة
        const customerRef = doc(db, "customers", docIdString);
        transaction.set(customerRef, {
          id: nextSeq,                    // الحقل الرقمي (Number)
          docId: docIdString,             // نسخة نصية من الـ doc id (مفيدة إن احتجت)
          name,
          phone: phoneKey,
          balance,
          totalSpent: 0,
          visitCount: 0,
          defaultPaymentMethod: paymentMethod,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });

        // 5) أنشئ مستند قفل الهاتف
        transaction.set(phoneRef, {
          customerDocId: docIdString,
          createdAt: Timestamp.now()
        });

        return nextSeq; // نُعيد الرقم الحقيقي (Number)
      });

      // سجل الشيفت (إن وجد)
      try {
        const shiftModule = await import('../shift-management/shift-management.js');
        if (shiftModule && shiftModule.addShiftAction) {
          await shiftModule.addShiftAction(
            'إضافة عميل',
            `تم إضافة عميل جديد: ${name} - هاتف: ${phoneKey} - رصيد: ${balance.toFixed(2)} - طريقة دفع: ${paymentMethod} - ID: ${generatedNumericId}`
          );
        }
      } catch (shiftError) {
        console.log('لا يمكن تسجيل إجراء الشيفت:', shiftError);
      }

      showMessage(`✅ تم تسجيل العميل بنجاح! رقم العميل: ${generatedNumericId}`, 'success');
      form.reset();
      loadStats();

    } catch (error) {
      if (error && error.message === 'PHONE_EXISTS') {
        showMessage('⚠️ رقم الهاتف مسجل مسبقاً!', 'error');
      } else {
        console.error("خطأ في إضافة العميل:", error);
        showMessage('❌ حدث خطأ أثناء حفظ العميل!', 'error');
      }
    }
  });
}

// ---------- دوال مساعدة ----------
function isValidPhone(phone) {
  const phoneRegex = /^01[0125][0-9]{8}$/;
  return phoneRegex.test(phone);
}

async function isPhoneExists(phone) {
  try {
    const q = query(collection(db, "customers"), where("phone", "==", phone));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error("خطأ في التحقق من رقم الهاتف:", error);
    return false;
  }
}

// تحميل الإحصائيات كما عندك
async function loadStats() {
  try {
    const querySnapshot = await getDocs(collection(db, "customers"));
    let totalCustomers = 0;
    let totalBalance = 0;
    let newCustomers = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    querySnapshot.forEach((doc) => {
      const customer = doc.data() || {};
      totalCustomers++;
      totalBalance += Number(customer.balance || 0);

      if (customer.createdAt && typeof customer.createdAt.toDate === 'function') {
        const customerDate = customer.createdAt.toDate();
        customerDate.setHours(0, 0, 0, 0);
        if (customerDate.getTime() === today.getTime()) {
          newCustomers++;
        }
      }
    });

    const totalCustomersEl = document.getElementById('totalCustomers');
    const totalBalanceEl = document.getElementById('totalBalance');
    const newCustomersEl = document.getElementById('newCustomers');

    if (totalCustomersEl) totalCustomersEl.textContent = totalCustomers;
    if (totalBalanceEl) totalBalanceEl.textContent = totalBalance.toFixed(2);
    if (newCustomersEl) newCustomersEl.textContent = newCustomers;
  } catch (error) {
    console.error("خطأ في تحميل الإحصائيات:", error);
  }
}

function showMessage(text, type = 'info') {
  const messageDiv = document.getElementById('message');
  if (!messageDiv) {
    if (type === 'error') console.error(text);
    else console.log(text);
    return;
  }
  messageDiv.textContent = text;
  messageDiv.className = `message ${type}`;
  messageDiv.style.display = 'block';

  setTimeout(() => {
    messageDiv.style.display = 'none';
  }, 5000);
}
