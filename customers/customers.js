// customers.js - إصلاح ترتيب تسجيل الشيفت والبيانات
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  doc,
  runTransaction,
  Timestamp,
  addDoc
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { checkUserRoleWithShift } from "../shared/auth-check.js";

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
let currentUserName = "نظام";

checkUserRoleWithShift().then(userData => {
  if (userData) {
    const userNameEl = document.getElementById('userName');
    if (userNameEl) userNameEl.textContent = userData.name || '';
    currentUserName = userData.name || "نظام";
    loadStats();
    setupCustomerForm();
  }
}).catch(err => {
  console.error('خطأ في التحقق من صلاحية المستخدم:', err);
});

checkUserRoleWithShift().then(userData => {
    if (userData) {
        const userNameEl = document.getElementById('userName');
        if (userNameEl) userNameEl.textContent = userData.name || '';
        currentUserName = userData.name || "نظام";
        loadStats();
        setupCustomerForm();
        
        // ✅ تحميل الشيفت النشط تلقائياً
        loadActiveShift();
    }
}).catch(err => {
    console.error('خطأ في التحقق من صلاحية المستخدم:', err);
});

// دالة لتحميل الشيفت النشط
async function loadActiveShift() {
    try {
        const shiftModule = await import('../shift-management/shift-management.js');
        if (shiftModule && shiftModule.hasActiveShift) {
            const hasActive = await shiftModule.hasActiveShift();
            if (hasActive) {
                console.log('✅ تم تحميل الشيفت النشط في صفحة العملاء');
            } else {
                console.log('ℹ️ لا يوجد شيفت نشط في صفحة العملاء');
            }
        }
    } catch (error) {
        console.log('⚠️ لا يمكن تحميل معلومات الشيفت:', error.message);
    }
}

async function setupCustomerForm() {
  const form = document.getElementById('addCustomerForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = (document.getElementById('customerName')?.value || '').trim();
    let phone = (document.getElementById('customerPhone')?.value || '').trim();
    const paymentMethod = (document.getElementById('customerPaymentMethod')?.value || 'نقدي');

    const normalBalanceEnabled = document.getElementById('enableNormalBalance')?.checked;
    const offersBalanceEnabled = document.getElementById('enableOffersBalance')?.checked;
    const laserBalanceEnabled = document.getElementById('enableLaserBalance')?.checked;
    const dermaBalanceEnabled = document.getElementById('enableDermaBalance')?.checked;

    const primaryBalance = normalBalanceEnabled ? (parseFloat(document.getElementById('customerBalance')?.value) || 0) : 0;
    const offersBalance = offersBalanceEnabled ? (parseFloat(document.getElementById('offersBalance')?.value) || 0) : 0;
    const laserBalance = laserBalanceEnabled ? (parseFloat(document.getElementById('laserBalance')?.value) || 0) : 0;
    const dermaBalance = dermaBalanceEnabled ? (parseFloat(document.getElementById('dermaBalance')?.value) || 0) : 0;

    const phoneKey = phone.replace(/\s+/g, '');

    if (!name || !phone) {
      showMessage('⚠️ يرجى ملء جميع الحقول الإلزامية!', 'error');
      return;
    }
    if (!isValidPhone(phoneKey)) {
      showMessage('⚠️ رقم الهاتف غير صحيح! تأكد من شكل 010/011/012/015XXXXXXXX', 'error');
      return;
    }

    if (primaryBalance < 0 || offersBalance < 0 || laserBalance < 0 || dermaBalance < 0) {
      showMessage('⚠️ لا يمكن أن تكون قيم الأرصدة سالبة!', 'error');
      return;
    }

    if (primaryBalance > 100000 || offersBalance > 100000 || laserBalance > 100000 || dermaBalance > 100000) {
      showMessage('⚠️ قيمة الرصيد كبيرة جداً! يرجى إدخال مبلغ أقل من 100,000 جنيه', 'error');
      return;
    }

    try {
      // ✅ 1. إنشاء العميل أولاً
      const generatedNumericId = await runTransaction(db, async (transaction) => {
        const counterRef = doc(db, "counters", "customersCounter");
        const phoneRef = doc(db, "customers_by_phone", phoneKey);

        const phoneSnap = await transaction.get(phoneRef);
        if (phoneSnap.exists()) {
          throw new Error('PHONE_EXISTS');
        }

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

        const docIdString = String(nextSeq);

        const customerRef = doc(db, "customers", docIdString);
        transaction.set(customerRef, {
          id: nextSeq,
          docId: docIdString,
          name,
          phone: phoneKey,
          balance: primaryBalance,
          offersBalance: offersBalance,
          laserBalance: laserBalance,
          dermaBalance: dermaBalance,
          totalSpent: 0,
          visitCount: 0,
          defaultPaymentMethod: paymentMethod,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });

        transaction.set(phoneRef, {
          customerDocId: docIdString,
          createdAt: Timestamp.now()
        });

        return nextSeq;
      });

      console.log('✅ تم إنشاء العميل برقم:', generatedNumericId);

      // ✅ 2. حساب إجمالي المبلغ المدفوع
      const totalPaidAmount = primaryBalance + offersBalance + laserBalance + dermaBalance;

      // ✅ 3. تسجيل المعاملات المالية بالتفصيل
      const transactionsToCreate = [];

      if (primaryBalance > 0) {
        const primaryTransactionRef = await addDoc(collection(db, "transactions"), {
          customerId: String(generatedNumericId),
          customerName: name,
          type: 'deposit',
          balanceType: 'primary',
          amount: primaryBalance,
          previousBalance: 0,
          newBalance: primaryBalance,
          paymentMethod: paymentMethod,
          notes: `شحن الرصيد الأساسي عند تسجيل الحساب - ${paymentMethod}`,
          createdAt: Timestamp.now(),
          createdBy: currentUserName
        });
        console.log('✅ تم تسجيل معاملة الرصيد الأساسي:', primaryTransactionRef.id);
      }

      if (offersBalance > 0) {
        const offersTransactionRef = await addDoc(collection(db, "transactions"), {
          customerId: String(generatedNumericId),
          customerName: name,
          type: 'deposit',
          balanceType: 'offers',
          amount: offersBalance,
          previousBalance: 0,
          newBalance: offersBalance,
          paymentMethod: paymentMethod,
          notes: `شحن رصيد عروض عند تسجيل الحساب - ${paymentMethod}`,
          createdAt: Timestamp.now(),
          createdBy: currentUserName
        });
        console.log('✅ تم تسجيل معاملة رصيد العروض:', offersTransactionRef.id);
      }

      if (laserBalance > 0) {
        const laserTransactionRef = await addDoc(collection(db, "transactions"), {
          customerId: String(generatedNumericId),
          customerName: name,
          type: 'deposit',
          balanceType: 'laser',
          amount: laserBalance,
          previousBalance: 0,
          newBalance: laserBalance,
          paymentMethod: paymentMethod,
          notes: `شحن رصيد ليزر عند تسجيل الحساب - ${paymentMethod}`,
          createdAt: Timestamp.now(),
          createdBy: currentUserName
        });
        console.log('✅ تم تسجيل معاملة رصيد الليزر:', laserTransactionRef.id);
      }

      if (dermaBalance > 0) {
        const dermaTransactionRef = await addDoc(collection(db, "transactions"), {
          customerId: String(generatedNumericId),
          customerName: name,
          type: 'deposit',
          balanceType: 'derma',
          amount: dermaBalance,
          previousBalance: 0,
          newBalance: dermaBalance,
          paymentMethod: paymentMethod,
          notes: `شحن رصيد جلدية عند تسجيل الحساب - ${paymentMethod}`,
          createdAt: Timestamp.now(),
          createdBy: currentUserName
        });
        console.log('✅ تم تسجيل معاملة رصيد الجلدية:', dermaTransactionRef.id);
      }

// ✅ 4. تسجيل في الشيفت (آخر خطوة) - النسخة المصححة
try {
    const shiftModule = await import('../shift-management/shift-management.js');
    if (shiftModule && shiftModule.addShiftAction) {
        // التحقق من وجود شيفت نشط أولاً
        const hasActiveShift = await shiftModule.hasActiveShift();
        
        if (hasActiveShift && totalPaidAmount > 0) {
            // ✅ الإصلاح: تسجيل كل رصيد على حدة كإيراد نقدي
            if (primaryBalance > 0) {
                await shiftModule.addShiftAction(
                    'إنشاء حساب عميل جديد',
                    `تم تسجيل عميل جديد: ${name} - شحن رصيد أساسي: ${primaryBalance.toFixed(2)} جنيه - ${paymentMethod} - ID: ${generatedNumericId}`,
                    name,
                    primaryBalance, // ✅ المبلغ الفعلي المستلم
                    paymentMethod,
                    {
                        actionCategory: 'customer',
                        customerId: String(generatedNumericId),
                        isNewCustomer: true,
                        services: ['إنشاء حساب + شحن رصيد'],
                        originalAmount: primaryBalance
                    }
                );
            }
            
            if (offersBalance > 0) {
                await shiftModule.addShiftAction(
                    'إنشاء حساب عميل جديد', 
                    `تم تسجيل عميل جديد: ${name} - شحن رصيد عروض: ${offersBalance.toFixed(2)} جنيه - ${paymentMethod} - ID: ${generatedNumericId}`,
                    name,
                    offersBalance,
                    paymentMethod,
                    {
                        actionCategory: 'customer',
                        customerId: String(generatedNumericId),
                        isNewCustomer: true,
                        services: ['إنشاء حساب + شحن رصيد عروض'],
                        originalAmount: offersBalance
                    }
                );
            }
            
            if (laserBalance > 0) {
                await shiftModule.addShiftAction(
                    'إنشاء حساب عميل جديد',
                    `تم تسجيل عميل جديد: ${name} - شحن رصيد ليزر: ${laserBalance.toFixed(2)} جنيه - ${paymentMethod} - ID: ${generatedNumericId}`,
                    name,
                    laserBalance,
                    paymentMethod,
                    {
                        actionCategory: 'customer',
                        customerId: String(generatedNumericId),
                        isNewCustomer: true,
                        services: ['إنشاء حساب + شحن رصيد ليزر'],
                        originalAmount: laserBalance
                    }
                );
            }
            
            if (dermaBalance > 0) {
                await shiftModule.addShiftAction(
                    'إنشاء حساب عميل جديد',
                    `تم تسجيل عميل جديد: ${name} - شحن رصيد جلدية: ${dermaBalance.toFixed(2)} جنيه - ${paymentMethod} - ID: ${generatedNumericId}`,
                    name,
                    dermaBalance,
                    paymentMethod,
                    {
                        actionCategory: 'customer',
                        customerId: String(generatedNumericId),
                        isNewCustomer: true,
                        services: ['إنشاء حساب + شحن رصيد جلدية'],
                        originalAmount: dermaBalance
                    }
                );
            }
            
            console.log('✅ تم تسجيل العميل الجديد في الشيفت بنجاح');
        } else {
            console.log('⚠️ لا يوجد شيفت نشط أو لا توجد مدفوعات - تم تخطي تسجيل العميل في الشيفت');
        }
    }
} catch (shiftError) {
    console.log('⚠️ لا يمكن تسجيل إجراء الشيفت:', shiftError.message);
}

      // ✅ بناء رسالة النجاح مع تفاصيل الأرصدة
      let successMessage = `✅ تم تسجيل العميل بنجاح!\n\n`;
      successMessage += `📋 رقم العميل: ${generatedNumericId}\n`;
      successMessage += `👤 الاسم: ${name}\n`;
      successMessage += `📱 الهاتف: ${phoneKey}\n\n`;
      successMessage += `💰 الأرصدة:\n`;
      
      if (primaryBalance > 0) successMessage += `   • الرصيد الأساسي: ${primaryBalance.toFixed(2)} جنيه\n`;
      if (offersBalance > 0) successMessage += `   • رصيد العروض: ${offersBalance.toFixed(2)} جنيه\n`;
      if (laserBalance > 0) successMessage += `   • رصيد الليزر: ${laserBalance.toFixed(2)} جنيه\n`;
      if (dermaBalance > 0) successMessage += `   • رصيد الجلدية: ${dermaBalance.toFixed(2)} جنيه\n`;
      
      if (totalPaidAmount > 0) {
        successMessage += `\n💵 إجمالي الرصيد: ${totalPaidAmount.toFixed(2)} جنيه`;
      }

      showMessage(successMessage, 'success');
      
      form.reset();
      
      document.querySelectorAll('.balance-input-group').forEach(el => el.classList.add('hidden'));
      document.querySelectorAll('.balance-checkbox').forEach(el => el.checked = false);
      
      loadStats();

    } catch (error) {
      if (error && error.message === 'PHONE_EXISTS') {
        showMessage('⚠️ رقم الهاتف مسجل مسبقاً!', 'error');
      } else {
        console.error("خطأ في إضافة العميل:", error);
        showMessage('❌ حدث خطأ أثناء حفظ العميل: ' + (error.message || error), 'error');
      }
    }
  });
}

function isValidPhone(phone) {
  const phoneRegex = /^01[0125][0-9]{8}$/;
  return phoneRegex.test(phone);
}

async function loadStats() {
  try {
    const querySnapshot = await getDocs(collection(db, "customers"));
    let totalCustomers = 0;
    let newCustomers = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    querySnapshot.forEach((doc) => {
      const customer = doc.data() || {};
      totalCustomers++;

      if (customer.createdAt && typeof customer.createdAt.toDate === 'function') {
        const customerDate = customer.createdAt.toDate();
        customerDate.setHours(0, 0, 0, 0);
        if (customerDate.getTime() === today.getTime()) {
          newCustomers++;
        }
      }
    });

    updateElement('totalCustomers', totalCustomers);
    updateElement('newCustomers', newCustomers);

  } catch (error) {
    console.error("خطأ في تحميل الإحصائيات:", error);
  }
}

function updateElement(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
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
  }, 10000);
}

console.log('✅ تم تحميل customers.js مع إصلاح ترتيب تسجيل الشيفت');