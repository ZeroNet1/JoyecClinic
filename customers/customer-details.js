// customer-details.js - مع نظام الأرصدة المتعددة والتحويلات
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    updateDoc,
    collection,
    addDoc,
    getDocs,
    query,
    where,
    orderBy,
    Timestamp,
    runTransaction
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
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
const auth = getAuth(app);

let currentCustomerId = null;
let currentCustomerData = null;
let currentUserName = "نظام";
let allTransactions = []; // لحفظ جميع الحركات للفلترة
let currentTransactionFilter = 'all'; // الفلتر الحالي

function el(id) {
    return document.getElementById(id) || null;
}

checkUserRole().then(async (userData) => {
    if (userData) {
        if (el('userName')) el('userName').textContent = userData.name;
        currentUserName = userData.name || currentUserName;
        await initializePage();
    } else {
        console.warn('checkUserRole returned no userData.');
    }
}).catch(err => {
    console.error('خطأ في التحقق من الصلاحية:', err);
});

async function initializePage() {
    const urlParams = new URLSearchParams(window.location.search);
    currentCustomerId = urlParams.get('id');

    if (!currentCustomerId) {
        alert('❌ لم يتم تحديد عميل!');
        window.location.href = 'customer-list.html';
        return;
    }

    await loadCustomerData();
    setupEventListeners();
}

function setupEventListeners() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    if (tabBtns && tabBtns.length) {
        tabBtns.forEach(btn => {
            const tabName = btn.getAttribute('data-tab');
            if (!tabName) return;
            btn.addEventListener('click', () => switchTab(tabName));
        });
    }

    // الرصيد العادي
    const rechargeBtn = el('rechargeBtn');
    const cancelRecharge = el('cancelRecharge');
    const rechargeForm = el('rechargeBalanceForm');
    const transferNormalBtn = el('transferNormalBtn');
    const cancelNormalTransfer = el('cancelNormalTransfer');
    const transferNormalForm = el('transferNormalBalanceForm');

    if (rechargeBtn) rechargeBtn.addEventListener('click', showRechargeForm);
    if (cancelRecharge) cancelRecharge.addEventListener('click', hideRechargeForm);
    if (rechargeForm) rechargeForm.addEventListener('submit', rechargeBalance);
    if (transferNormalBtn) transferNormalBtn.addEventListener('click', () => showBalanceForm('normal', 'transfer'));
    if (cancelNormalTransfer) cancelNormalTransfer.addEventListener('click', () => hideBalanceForm('normal', 'transfer'));
    if (transferNormalForm) transferNormalForm.addEventListener('submit', (e) => transferBalance(e, 'normal'));

    // رصيد العروض
    const rechargeOffersBtn = el('rechargeOffersBtn');
    const cancelOffersRecharge = el('cancelOffersRecharge');
    const rechargeOffersForm = el('rechargeOffersBalanceForm');
    const transferOffersBtn = el('transferOffersBtn');
    const cancelOffersTransfer = el('cancelOffersTransfer');
    const transferOffersForm = el('transferOffersBalanceForm');

    if (rechargeOffersBtn) rechargeOffersBtn.addEventListener('click', () => showBalanceForm('offers', 'recharge'));
    if (cancelOffersRecharge) cancelOffersRecharge.addEventListener('click', () => hideBalanceForm('offers', 'recharge'));
    if (rechargeOffersForm) rechargeOffersForm.addEventListener('submit', (e) => rechargeSpecialBalance(e, 'offers'));
    if (transferOffersBtn) transferOffersBtn.addEventListener('click', () => showBalanceForm('offers', 'transfer'));
    if (cancelOffersTransfer) cancelOffersTransfer.addEventListener('click', () => hideBalanceForm('offers', 'transfer'));
    if (transferOffersForm) transferOffersForm.addEventListener('submit', (e) => transferBalance(e, 'offers'));

    // رصيد الليزر
    const rechargeLaserBtn = el('rechargeLaserBtn');
    const cancelLaserRecharge = el('cancelLaserRecharge');
    const rechargeLaserForm = el('rechargeLaserBalanceForm');
    const transferLaserBtn = el('transferLaserBtn');
    const cancelLaserTransfer = el('cancelLaserTransfer');
    const transferLaserForm = el('transferLaserBalanceForm');

    if (rechargeLaserBtn) rechargeLaserBtn.addEventListener('click', () => showBalanceForm('laser', 'recharge'));
    if (cancelLaserRecharge) cancelLaserRecharge.addEventListener('click', () => hideBalanceForm('laser', 'recharge'));
    if (rechargeLaserForm) rechargeLaserForm.addEventListener('submit', (e) => rechargeSpecialBalance(e, 'laser'));
    if (transferLaserBtn) transferLaserBtn.addEventListener('click', () => showBalanceForm('laser', 'transfer'));
    if (cancelLaserTransfer) cancelLaserTransfer.addEventListener('click', () => hideBalanceForm('laser', 'transfer'));
    if (transferLaserForm) transferLaserForm.addEventListener('submit', (e) => transferBalance(e, 'laser'));

    // رصيد الجلدية
    const rechargeDermaBtn = el('rechargeDermaBtn');
    const cancelDermaRecharge = el('cancelDermaRecharge');
    const rechargeDermaForm = el('rechargeDermaBalanceForm');
    const transferDermaBtn = el('transferDermaBtn');
    const cancelDermaTransfer = el('cancelDermaTransfer');
    const transferDermaForm = el('transferDermaBalanceForm');

    if (rechargeDermaBtn) rechargeDermaBtn.addEventListener('click', () => showBalanceForm('derma', 'recharge'));
    if (cancelDermaRecharge) cancelDermaRecharge.addEventListener('click', () => hideBalanceForm('derma', 'recharge'));
    if (rechargeDermaForm) rechargeDermaForm.addEventListener('submit', (e) => rechargeSpecialBalance(e, 'derma'));
    if (transferDermaBtn) transferDermaBtn.addEventListener('click', () => showBalanceForm('derma', 'transfer'));
    if (cancelDermaTransfer) cancelDermaTransfer.addEventListener('click', () => hideBalanceForm('derma', 'transfer'));
    if (transferDermaForm) transferDermaForm.addEventListener('submit', (e) => transferBalance(e, 'derma'));

    // الزيارات
    const addVisitBtn = el('addVisitBtn');
    const closeVisitModal = el('closeVisitModal');
    const cancelVisit = el('cancelVisit');
    const addVisitForm = el('addVisitForm');

    if (addVisitBtn) addVisitBtn.addEventListener('click', showAddVisitModal);
    if (closeVisitModal) closeVisitModal.addEventListener('click', hideAddVisitModal);
    if (cancelVisit) cancelVisit.addEventListener('click', hideAddVisitModal);
    if (addVisitForm) addVisitForm.addEventListener('submit', addVisit);

    const addVisitModal = el('addVisitModal');
    if (addVisitModal) {
        addVisitModal.addEventListener('click', (e) => {
            if (e.target.id === 'addVisitModal') hideAddVisitModal();
        });
    }

    // فلتر الحركات المالية
    const transactionDateFilter = el('transactionDateFilter');
    const customTransactionDate = el('customTransactionDate');
    const clearTransactionFilter = el('clearTransactionFilter');
    const customDateGroup = el('customDateGroup');

    if (transactionDateFilter) {
        transactionDateFilter.addEventListener('change', function() {
            currentTransactionFilter = this.value;
            if (this.value === 'custom') {
                if (customDateGroup) customDateGroup.classList.remove('hidden');
            } else {
                if (customDateGroup) customDateGroup.classList.add('hidden');
                filterTransactions();
            }
        });
    }

    if (customTransactionDate) {
        customTransactionDate.addEventListener('change', function() {
            if (this.value) {
                filterTransactions();
            }
        });
    }

    if (clearTransactionFilter) {
        clearTransactionFilter.addEventListener('click', function() {
            currentTransactionFilter = 'all';
            if (transactionDateFilter) transactionDateFilter.value = 'all';
            if (customTransactionDate) customTransactionDate.value = '';
            if (customDateGroup) customDateGroup.classList.add('hidden');
            filterTransactions();
        });
    }
}

async function loadCustomerData() {
    try {
        const customerDoc = await getDoc(doc(db, "customers", currentCustomerId));

        if (!customerDoc.exists()) {
            alert('❌ العميل غير موجود!');
            window.location.href = 'customer-list.html';
            return;
        }

        currentCustomerData = customerDoc.data();
        displayCustomerInfo();
        await loadVisits();
        await loadTransactions();
    } catch (error) {
        console.error("خطأ في تحميل بيانات العميل:", error);
        alert('❌ حدث خطأ في تحميل بيانات العميل');
    }
}

function displayCustomerInfo() {
    const idToShow = (currentCustomerData && currentCustomerData.id) ? currentCustomerData.id : (currentCustomerId || '-');

    if (el('pageTitle')) el('pageTitle').textContent = `تفاصيل العميل - ${currentCustomerData.name || ''} (${idToShow})`;
    if (el('customerNameDisplay')) el('customerNameDisplay').textContent = currentCustomerData.name || '-';
    if (el('customerPhoneDisplay')) el('customerPhoneDisplay').textContent = currentCustomerData.phone || '-';
    if (el('customerIdDisplay')) el('customerIdDisplay').textContent = idToShow;

    if (el('visitCount')) el('visitCount').textContent = currentCustomerData.visitCount || 0;
    if (el('totalSpent')) el('totalSpent').textContent = (currentCustomerData.totalSpent || 0).toFixed(2);

    // الرصيد العادي
    if (el('currentBalance')) {
        el('currentBalance').textContent = `${(currentCustomerData.balance || 0).toFixed(2)} جنيه`;
        const balanceElement = el('currentBalance');
        if ((currentCustomerData.balance || 0) > 0) {
            balanceElement.style.color = '#28a745';
        } else if ((currentCustomerData.balance || 0) < 0) {
            balanceElement.style.color = '#dc3545';
        } else {
            balanceElement.style.color = '#6c757d';
        }
    }

    // رصيد العروض
    if (el('offersBalance')) {
        const offersBalance = currentCustomerData.offersBalance || 0;
        el('offersBalance').textContent = `${offersBalance.toFixed(2)} جنيه`;
    }

    // رصيد الليزر
    if (el('laserBalance')) {
        const laserBalance = currentCustomerData.laserBalance || 0;
        el('laserBalance').textContent = `${laserBalance.toFixed(2)} جنيه`;
    }

    // رصيد الجلدية
    if (el('dermaBalance')) {
        const dermaBalance = currentCustomerData.dermaBalance || 0;
        el('dermaBalance').textContent = `${dermaBalance.toFixed(2)} جنيه`;
    }
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    const paneEl = el(`${tabName}-tab`);
    const btnEl = document.querySelector(`[data-tab="${tabName}"]`);
    if (paneEl) paneEl.classList.add('active');
    if (btnEl) btnEl.classList.add('active');

    if (tabName === 'visits') loadVisits();
    else if (tabName === 'transactions') loadTransactions();
}

// ========== دوال الرصيد العادي ==========
function showRechargeForm() {
    const rechargeFormEl = el('rechargeForm');
    if (!rechargeFormEl) return;
    rechargeFormEl.classList.remove('hidden');

    const amountInput = el('rechargeAmount');
    if (amountInput) amountInput.focus();
}

function hideRechargeForm() {
    const rechargeFormEl = el('rechargeForm');
    if (rechargeFormEl) rechargeFormEl.classList.add('hidden');

    const rechargeBalanceForm = el('rechargeBalanceForm');
    if (rechargeBalanceForm) rechargeBalanceForm.reset();
}

async function rechargeBalance(e) {
    e.preventDefault();
    const amountInput = el('rechargeAmount');
    const notesInput = el('rechargeNotes');
    const paymentMethodSelect = el('paymentMethod');

    const amount = amountInput ? parseFloat(amountInput.value) : NaN;
    const notes = notesInput ? notesInput.value.trim() : '';
    const paymentMethod = paymentMethodSelect ? paymentMethodSelect.value : 'نقدي';

    if (!amount || amount <= 0) {
        alert('⚠️ يرجى إدخال مبلغ صحيح!');
        return;
    }
    if (amount > 100000) {
        alert('⚠️ المبلغ كبير جداً! يرجى إدخال مبلغ أقل من 100,000 جنيه');
        return;
    }

    try {
        const currentBalance = currentCustomerData.balance || 0;
        const newBalance = currentBalance + amount;

        await updateDoc(doc(db, "customers", currentCustomerId), {
            balance: newBalance,
            updatedAt: Timestamp.now()
        });

        await addDoc(collection(db, "transactions"), {
            customerId: currentCustomerId,
            customerName: currentCustomerData.name,
            type: 'deposit',
            balanceType: 'normal',
            amount: amount,
            previousBalance: currentBalance,
            newBalance: newBalance,
            paymentMethod: paymentMethod,
            notes: notes || `شحن رصيد عادي - ${paymentMethod}`,
            createdAt: Timestamp.now(),
            createdBy: currentUserName
        });

        // 🔥 تسجيل في الشيفت
        try {
            const shiftModule = await import('../shift-management/shift-management.js');
            if (shiftModule && shiftModule.addShiftAction) {
                await shiftModule.addShiftAction(
                    'شحن رصيد',
                    `شحن رصيد ${currentCustomerData.name} - ${amount.toFixed(2)} جنيه`,
                    currentCustomerData.name,
                    amount,
                    paymentMethod,
                    {
                        actionCategory: 'deposit',
                        customerId: currentCustomerId,
                        balanceType: 'normal',
                        previousBalance: currentBalance,
                        newBalance: newBalance
                    }
                );
            }
        } catch (shiftError) {
            console.log('لا يمكن تسجيل إجراء الشيفت:', shiftError);
        }

        currentCustomerData.balance = newBalance;
        displayCustomerInfo();

        alert(`✅ تم شحن ${amount.toFixed(2)} جنيه بنجاح!\nالرصيد الجديد: ${newBalance.toFixed(2)} جنيه`);
        hideRechargeForm();
        await loadTransactions();
    } catch (error) {
        console.error("خطأ في شحن الرصيد:", error);
        alert('❌ حدث خطأ أثناء شحن الرصيد: ' + (error.message || error));
    }
}

// ========== دوال الأرصدة الخاصة (عروض، ليزر، جلدية) ==========
function showBalanceForm(type, action) {
    const formId = `${type}${action === 'recharge' ? 'Recharge' : 'Transfer'}Form`;
    const formEl = el(formId);
    if (!formEl) return;
    
    // إخفاء النماذج الأخرى
    hideBalanceForm(type, action === 'recharge' ? 'transfer' : 'recharge');
    
    formEl.classList.remove('hidden');
    
    const amountInputId = `${type}${action === 'recharge' ? 'Recharge' : 'Transfer'}Amount`;
    const amountInput = el(amountInputId);
    if (amountInput) amountInput.focus();
}

function hideBalanceForm(type, action) {
    const formId = `${type}${action === 'recharge' ? 'Recharge' : 'Transfer'}Form`;
    const formEl = el(formId);
    if (formEl) formEl.classList.add('hidden');

    const formElementId = action === 'recharge' 
        ? `recharge${type.charAt(0).toUpperCase() + type.slice(1)}BalanceForm`
        : `transfer${type.charAt(0).toUpperCase() + type.slice(1)}BalanceForm`;
    const formElement = el(formElementId);
    if (formElement) formElement.reset();
}

async function rechargeSpecialBalance(e, type) {
    e.preventDefault();
    
    const typeNames = {
        offers: 'العروض',
        laser: 'الليزر',
        derma: 'الجلدية'
    };

    const balanceFields = {
        offers: 'offersBalance',
        laser: 'laserBalance',
        derma: 'dermaBalance'
    };

    const amountInput = el(`${type}RechargeAmount`);
    const notesInput = el(`${type}RechargeNotes`);
    const paymentMethodSelect = el(`${type}PaymentMethod`);

    const amount = amountInput ? parseFloat(amountInput.value) : NaN;
    const notes = notesInput ? notesInput.value.trim() : '';
    const paymentMethod = paymentMethodSelect ? paymentMethodSelect.value : 'نقدي';

    if (!amount || amount <= 0) {
        alert('⚠️ يرجى إدخال مبلغ صحيح!');
        return;
    }
    if (amount > 100000) {
        alert('⚠️ المبلغ كبير جداً! يرجى إدخال مبلغ أقل من 100,000 جنيه');
        return;
    }

    try {
        const balanceField = balanceFields[type];
        const currentBalance = currentCustomerData[balanceField] || 0;
        const newBalance = currentBalance + amount;

        await updateDoc(doc(db, "customers", currentCustomerId), {
            [balanceField]: newBalance,
            updatedAt: Timestamp.now()
        });

        await addDoc(collection(db, "transactions"), {
            customerId: currentCustomerId,
            customerName: currentCustomerData.name,
            type: 'deposit',
            balanceType: type,
            amount: amount,
            previousBalance: currentBalance,
            newBalance: newBalance,
            paymentMethod: paymentMethod,
            notes: notes || `شحن رصيد ${typeNames[type]} - ${paymentMethod}`,
            createdAt: Timestamp.now(),
            createdBy: currentUserName
        });

        // 🔥 تسجيل في الشيفت
        try {
            const shiftModule = await import('../shift-management/shift-management.js');
            if (shiftModule && shiftModule.addShiftAction) {
                await shiftModule.addShiftAction(
                    `شحن رصيد ${typeNames[type]}`,
                    `شحن رصيد ${typeNames[type]} لـ ${currentCustomerData.name} - ${amount.toFixed(2)} جنيه`,
                    currentCustomerData.name,
                    amount,
                    paymentMethod,
                    {
                        actionCategory: 'deposit',
                        customerId: currentCustomerId,
                        balanceType: type,
                        previousBalance: currentBalance,
                        newBalance: newBalance
                    }
                );
            }
        } catch (shiftError) {
            console.log('لا يمكن تسجيل إجراء الشيفت:', shiftError);
        }

        currentCustomerData[balanceField] = newBalance;
        displayCustomerInfo();

        alert(`✅ تم شحن ${amount.toFixed(2)} جنيه لرصيد ${typeNames[type]} بنجاح!\nالرصيد الجديد: ${newBalance.toFixed(2)} جنيه`);
        hideBalanceForm(type, 'recharge');
        await loadTransactions();

    } catch (error) {
        console.error(`خطأ في شحن رصيد ${typeNames[type]}:`, error);
        alert(`❌ حدث خطأ أثناء شحن رصيد ${typeNames[type]}: ` + (error.message || error));
    }
}

// تحديث دالة التحويل
async function transferBalance(e, type) {
    e.preventDefault();
    
    const typeNames = {
        normal: 'العادي',
        offers: 'العروض',
        laser: 'الليزر',
        derma: 'الجلدية'
    };

    const balanceFields = {
        normal: 'balance',
        offers: 'offersBalance',
        laser: 'laserBalance',
        derma: 'dermaBalance'
    };

    const amountInput = el(`${type}TransferAmount`);
    const phoneInput = el(`${type}TransferTo`);
    const notesInput = el(`${type}TransferNotes`);

    const amount = amountInput ? parseFloat(amountInput.value) : NaN;
    let targetPhone = phoneInput ? phoneInput.value.trim().replace(/\s+/g, '') : '';
    const notes = notesInput ? notesInput.value.trim() : '';

    if (!amount || amount <= 0) {
        alert('⚠️ يرجى إدخال مبلغ صحيح!');
        return;
    }

    if (!targetPhone) {
        alert('⚠️ يرجى إدخال رقم هاتف العميل المستقبل!');
        return;
    }

    const balanceField = balanceFields[type];
    const currentBalance = currentCustomerData[balanceField] || 0;

    if (amount > currentBalance) {
        alert(`⚠️ رصيد ${typeNames[type]} غير كافٍ!\n\nالرصيد الحالي: ${currentBalance.toFixed(2)} جنيه\nالمبلغ المطلوب: ${amount.toFixed(2)} جنيه\nالنقص: ${(amount - currentBalance).toFixed(2)} جنيه`);
        return;
    }

    try {
        // البحث عن العميل المستقبل بالهاتف
        const q = query(collection(db, "customers"), where("phone", "==", targetPhone));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            alert('❌ لم يتم العثور على عميل بهذا الرقم!');
            return;
        }

        const targetCustomerDoc = querySnapshot.docs[0];
        const targetCustomerId = targetCustomerDoc.id;
        const targetCustomerData = targetCustomerDoc.data();

        if (targetCustomerId === currentCustomerId) {
            alert('⚠️ لا يمكن التحويل لنفس العميل!');
            return;
        }

        if (!confirm(`هل تريد تحويل ${amount.toFixed(2)} جنيه من رصيد ${typeNames[type]}\n\nمن: ${currentCustomerData.name}\nإلى: ${targetCustomerData.name}\n\nالرصيد بعد التحويل: ${(currentBalance - amount).toFixed(2)} جنيه`)) {
            return;
        }

        // تنفيذ التحويل بـ transaction لضمان التزامن
        await runTransaction(db, async (transaction) => {
            const senderRef = doc(db, "customers", currentCustomerId);
            const receiverRef = doc(db, "customers", targetCustomerId);

            const senderDoc = await transaction.get(senderRef);
            const receiverDoc = await transaction.get(receiverRef);

            if (!senderDoc.exists() || !receiverDoc.exists()) {
                throw new Error("أحد العملاء غير موجود!");
            }

            const senderBalance = senderDoc.data()[balanceField] || 0;
            const receiverBalance = receiverDoc.data()[balanceField] || 0;

            if (senderBalance < amount) {
                throw new Error("الرصيد غير كافٍ!");
            }

            const newSenderBalance = senderBalance - amount;
            const newReceiverBalance = receiverBalance + amount;

            // تحديث رصيد المرسل
            transaction.update(senderRef, {
                [balanceField]: newSenderBalance,
                updatedAt: Timestamp.now()
            });

            // تحديث رصيد المستقبل
            transaction.update(receiverRef, {
                [balanceField]: newReceiverBalance,
                updatedAt: Timestamp.now()
            });

            // تسجيل معاملة السحب للمرسل
            const senderTransactionRef = doc(collection(db, "transactions"));
            transaction.set(senderTransactionRef, {
                customerId: currentCustomerId,
                customerName: currentCustomerData.name,
                type: 'withdrawal',
                balanceType: type,
                amount: amount,
                previousBalance: senderBalance,
                newBalance: newSenderBalance,
                paymentMethod: 'تحويل',
                notes: notes || `تحويل رصيد ${typeNames[type]} إلى ${targetCustomerData.name}`,
                transferTo: targetCustomerId,
                transferToName: targetCustomerData.name,
                createdAt: Timestamp.now(),
                createdBy: currentUserName
            });

            // تسجيل معاملة الإيداع للمستقبل
            const receiverTransactionRef = doc(collection(db, "transactions"));
            transaction.set(receiverTransactionRef, {
                customerId: targetCustomerId,
                customerName: targetCustomerData.name,
                type: 'deposit',
                balanceType: type,
                amount: amount,
                previousBalance: receiverBalance,
                newBalance: newReceiverBalance,
                paymentMethod: 'تحويل',
                notes: notes || `تحويل رصيد ${typeNames[type]} من ${currentCustomerData.name}`,
                transferFrom: currentCustomerId,
                transferFromName: currentCustomerData.name,
                createdAt: Timestamp.now(),
                createdBy: currentUserName
            });
        });

        // 🔥 تسجيل في الشيفت
        try {
            const shiftModule = await import('../shift-management/shift-management.js');
            if (shiftModule && shiftModule.addShiftAction) {
                await shiftModule.addShiftAction(
                    `تحويل رصيد ${typeNames[type]}`,
                    `تحويل ${amount.toFixed(2)} جنيه من رصيد ${typeNames[type]} من ${currentCustomerData.name} إلى ${targetCustomerData.name}`,
                    currentCustomerData.name,
                    amount,
                    'تحويل',
                    {
                        actionCategory: 'transfer',
                        customerId: currentCustomerId,
                        balanceType: type,
                        transferTo: targetCustomerId,
                        transferToName: targetCustomerData.name
                    }
                );
            }
        } catch (shiftError) {
            console.log('لا يمكن تسجيل إجراء الشيفت:', shiftError);
        }

        currentCustomerData[balanceField] = (currentCustomerData[balanceField] || 0) - amount;
        displayCustomerInfo();

        alert(`✅ تم تحويل ${amount.toFixed(2)} جنيه من رصيد ${typeNames[type]} بنجاح!\n\nمن: ${currentCustomerData.name}\nإلى: ${targetCustomerData.name}\n\nرصيدك الجديد: ${currentCustomerData[balanceField].toFixed(2)} جنيه`);
        hideBalanceForm(type, 'transfer');
        await loadTransactions();

    } catch (error) {
        console.error(`خطأ في تحويل رصيد ${typeNames[type]}:`, error);
        alert(`❌ حدث خطأ أثناء تحويل رصيد ${typeNames[type]}: ` + (error.message || error));
    }
}

// ========== دوال الزيارات ==========
function showAddVisitModal() {
    const modal = el('addVisitModal');
    if (!modal) return;
    modal.classList.remove('hidden');

    const visitDateInput = el('visitDate');
    if (visitDateInput) visitDateInput.value = new Date().toISOString().slice(0, 16);

    loadDoctorsAndServices();
}

function hideAddVisitModal() {
    const modal = el('addVisitModal');
    if (modal) modal.classList.add('hidden');
    const form = el('addVisitForm');
    if (form) form.reset();
}

async function loadDoctorsAndServices() {
    const doctorsSelect = el('visitDoctor');
    if (doctorsSelect) doctorsSelect.innerHTML = '<option value="">اختر الدكتور</option>';
    try {
        const doctorsSnapshot = await getDocs(collection(db, "users"));
        doctorsSnapshot.forEach(docSnap => {
            const user = docSnap.data();
            if (user.role === 'doctor' || user.role === 'skin_doctor') {
                const option = document.createElement('option');
                option.value = docSnap.id;
                option.textContent = user.name + (user.role === 'skin_doctor' ? ' (جلدية)' : ' (تجميل)');
                if (doctorsSelect) doctorsSelect.appendChild(option);
            }
        });
    } catch (error) {
        console.error("خطأ في تحميل الأطباء:", error);
    }

    const servicesSelect = el('visitService');
    if (servicesSelect) servicesSelect.innerHTML = '<option value="">اختر الخدمة</option>';
    try {
        const servicesSnapshot = await getDocs(collection(db, "services"));
        servicesSnapshot.forEach(docSnap => {
            const service = docSnap.data();
            const option = document.createElement('option');
            option.value = docSnap.id;
            option.textContent = `${service.name} - ${service.duration} دقيقة - ${service.price.toFixed(2)} جنيه`;
            option.setAttribute('data-price', service.price);
            if (servicesSelect) servicesSelect.appendChild(option);
        });
        if (servicesSelect) {
            servicesSelect.addEventListener('change', function() {
                const selectedOption = this.options[this.selectedIndex];
                const price = selectedOption ? selectedOption.getAttribute('data-price') : null;
                if (price && el('visitAmount')) el('visitAmount').value = price;
            });
        }
    } catch (error) {
        console.error("خطأ في تحميل الخدمات:", error);
    }
}

async function addVisit(e) {
    e.preventDefault();
    const visitDate = el('visitDate')?.value;
    const doctorId = el('visitDoctor')?.value;
    const serviceId = el('visitService')?.value;
    const amount = parseFloat(el('visitAmount')?.value || '0');
    const notes = el('visitNotes')?.value.trim() || '';

    if (!visitDate || !doctorId || !serviceId || !amount) {
        alert('⚠️ يرجى ملء جميع الحقول الإلزامية!');
        return;
    }
    if (amount <= 0) {
        alert('⚠️ يرجى إدخال مبلغ صحيح!');
        return;
    }

    try {
        const doctorDoc = await getDoc(doc(db, "users", doctorId));
        const serviceDoc = await getDoc(doc(db, "services", serviceId));
        if (!doctorDoc.exists() || !serviceDoc.exists()) {
            alert('❌ بيانات غير صحيحة!');
            return;
        }
        const doctorName = doctorDoc.data().name;
        const serviceName = serviceDoc.data().name;
        const currentBalance = currentCustomerData.balance || 0;
        const newBalance = currentBalance - amount;

        if (newBalance < 0) {
            if (!confirm(`⚠️ رصيد العميل غير كافٍ!\nالرصيد الحالي: ${currentBalance.toFixed(2)} جنيه\nالمبلغ المطلوب: ${amount.toFixed(2)} جنيه\nالنقص: ${Math.abs(newBalance).toFixed(2)} جنيه\nهل تريد المتابعة؟`)) {
                return;
            }
        }

        await updateDoc(doc(db, "customers", currentCustomerId), {
            balance: newBalance,
            visitCount: (currentCustomerData.visitCount || 0) + 1,
            totalSpent: (currentCustomerData.totalSpent || 0) + amount,
            updatedAt: Timestamp.now()
        });

        await addDoc(collection(db, "visits"), {
            customerId: currentCustomerId,
            customerName: currentCustomerData.name,
            visitDate: Timestamp.fromDate(new Date(visitDate)),
            doctorId,
            doctorName,
            serviceId,
            serviceName,
            amount,
            notes,
            createdAt: Timestamp.now(),
            createdBy: currentUserName
        });

        await addDoc(collection(db, "transactions"), {
            customerId: currentCustomerId,
            customerName: currentCustomerData.name,
            type: 'withdrawal',
            balanceType: 'normal',
            amount,
            previousBalance: currentBalance,
            newBalance,
            notes: `زيارة - ${serviceName} - الدكتور: ${doctorName}`,
            createdAt: Timestamp.now(),
            createdBy: currentUserName
        });

        try {
            const shiftModule = await import('../shift-management/shift-management.js');
            if (shiftModule && shiftModule.addShiftAction) {
                await shiftModule.addShiftAction('زيارة عميل', `تمت زيارة لـ ${currentCustomerData.name} - الخدمة: ${serviceName} - الدكتور: ${doctorName} - المبلغ: ${amount.toFixed(2)} جنيه`);
            }
        } catch (shiftError) {
            console.log('لا يمكن تسجيل إجراء الشيفت:', shiftError);
        }

        currentCustomerData.balance = newBalance;
        currentCustomerData.visitCount = (currentCustomerData.visitCount || 0) + 1;
        currentCustomerData.totalSpent = (currentCustomerData.totalSpent || 0) + amount;

        displayCustomerInfo();
        alert(`✅ تم إضافة الزيارة بنجاح!\nتم خصم ${amount.toFixed(2)} جنيه\nالرصيد الجديد: ${newBalance.toFixed(2)} جنيه`);
        hideAddVisitModal();
        await loadVisits();
        await loadTransactions();
    } catch (error) {
        console.error("خطأ في إضافة الزيارة:", error);
        alert('❌ حدث خطأ أثناء إضافة الزيارة: ' + (error.message || error));
    }
}

async function loadVisits() {
    const visitsList = el('visitsList');
    if (!visitsList) return;
    visitsList.innerHTML = '<div class="loading">جاري تحميل الزيارات...</div>';

    try {
        const q = query(collection(db, "visits"), where("customerId", "==", currentCustomerId), orderBy("visitDate", "desc"));
        const querySnapshot = await getDocs(q);
        visitsList.innerHTML = '';

        if (querySnapshot.empty) {
            visitsList.innerHTML = '<div class="empty-state">لا توجد زيارات مسجلة</div>';
            return;
        }

        querySnapshot.forEach(docSnap => {
            const visit = docSnap.data();
            const visitItem = document.createElement('div');
            visitItem.className = 'visit-item';

            const visitDate = visit.visitDate ? visit.visitDate.toDate() : new Date();
            const formattedDate = visitDate.toLocaleString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

            visitItem.innerHTML = `
                <div class="visit-header">
                    <div class="visit-date">${formattedDate}</div>
                    <div class="visit-amount negative">- ${(visit.amount || 0).toFixed(2)} جنيه</div>
                </div>
                <div class="visit-details">
                    <div><strong>الدكتور:</strong> ${visit.doctorName || '-'}</div>
                    <div><strong>الخدمة:</strong> ${visit.serviceName || '-'}</div>
                    <div><strong>بواسطة:</strong> ${visit.createdBy || 'نظام'}</div>
                </div>
                ${visit.notes ? `<div class="visit-notes"><strong>ملاحظات:</strong> ${visit.notes}</div>` : ''}
            `;
            visitsList.appendChild(visitItem);
        });

    } catch (error) {
        console.error("خطأ في تحميل الزيارات:", error);
        visitsList.innerHTML = '<div class="error">حدث خطأ في تحميل الزيارات</div>';
    }
}

async function loadTransactions() {
    const transactionsList = el('transactionsList');
    if (!transactionsList) return;
    transactionsList.innerHTML = '<div class="loading">جاري تحميل الحركات...</div>';

    try {
        const q = query(collection(db, "transactions"), where("customerId", "==", currentCustomerId), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        allTransactions = [];
        querySnapshot.forEach(docSnap => {
            allTransactions.push({ id: docSnap.id, ...docSnap.data() });
        });

        filterTransactions();

    } catch (error) {
        console.error("خطأ في تحميل الحركات:", error);
        transactionsList.innerHTML = '<div class="error">حدث خطأ في تحميل الحركات المالية</div>';
    }
}

function filterTransactions() {
    const transactionsList = el('transactionsList');
    if (!transactionsList) return;

    let filteredTransactions = [...allTransactions];

    // تطبيق الفلتر حسب التاريخ
    if (currentTransactionFilter !== 'all') {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        filteredTransactions = filteredTransactions.filter(transaction => {
            if (!transaction.createdAt) return false;
            const transactionDate = transaction.createdAt.toDate();
            const transactionDay = new Date(transactionDate.getFullYear(), transactionDate.getMonth(), transactionDate.getDate());

            switch (currentTransactionFilter) {
                case 'today':
                    return transactionDay.getTime() === today.getTime();

                case 'yesterday':
                    const yesterday = new Date(today);
                    yesterday.setDate(yesterday.getDate() - 1);
                    return transactionDay.getTime() === yesterday.getTime();

                case 'this_week':
                    const weekStart = new Date(today);
                    weekStart.setDate(today.getDate() - today.getDay());
                    return transactionDay >= weekStart;

                case 'this_month':
                    return transactionDate.getMonth() === now.getMonth() && 
                           transactionDate.getFullYear() === now.getFullYear();

                case 'last_month':
                    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    return transactionDate.getMonth() === lastMonth.getMonth() && 
                           transactionDate.getFullYear() === lastMonth.getFullYear();

                case 'custom':
                    const customDateInput = el('customTransactionDate');
                    if (!customDateInput || !customDateInput.value) return true;
                    const selectedDate = new Date(customDateInput.value);
                    const selectedDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
                    return transactionDay.getTime() === selectedDay.getTime();

                default:
                    return true;
            }
        });
    }

    displayTransactions(filteredTransactions);
}

function displayTransactions(transactions) {
    const transactionsList = el('transactionsList');
    if (!transactionsList) return;

    let totalDeposits = 0;
    let totalWithdrawals = 0;

    if (transactions.length === 0) {
        transactionsList.innerHTML = '<div class="empty-state">لا توجد حركات مالية في الفترة المحددة</div>';
        if (el('totalDeposits')) el('totalDeposits').textContent = '0.00 جنيه';
        if (el('totalWithdrawals')) el('totalWithdrawals').textContent = '0.00 جنيه';
        return;
    }

    transactionsList.innerHTML = '';

    transactions.forEach(transaction => {
        const transactionItem = document.createElement('div');
        transactionItem.className = 'transaction-item';

        const transactionDate = transaction.createdAt ? transaction.createdAt.toDate() : new Date();
        const formattedDate = transactionDate.toLocaleString('ar-EG', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        const amountClass = transaction.type === 'deposit' ? 'positive' : 'negative';
        const amountSign = transaction.type === 'deposit' ? '+' : '-';
        let typeText = transaction.type === 'deposit' ? 'إيداع' : 'سحب';
        
        // إضافة نوع الرصيد
        const balanceTypeNames = {
            normal: 'عادي',
            offers: 'عروض',
            laser: 'ليزر',
            derma: 'جلدية'
        };
        const balanceType = transaction.balanceType ? ` - ${balanceTypeNames[transaction.balanceType] || ''}` : '';

        if (transaction.type === 'deposit') totalDeposits += transaction.amount || 0;
        else if (transaction.type === 'withdrawal') totalWithdrawals += transaction.amount || 0;

        transactionItem.innerHTML = `
            <div class="transaction-header">
                <div class="transaction-type-badge ${amountClass}">${typeText}${balanceType}</div>
                <div class="transaction-date">${formattedDate}</div>
                <div class="transaction-amount ${amountClass}">${amountSign} ${((transaction.amount || 0)).toFixed(2)} جنيه</div>
            </div>
            <div class="transaction-details">
                <div><strong>بواسطة:</strong> ${transaction.createdBy || 'نظام'}</div>
                <div><strong>طريقة الدفع:</strong> ${transaction.paymentMethod || 'غير محدد'}</div>
                <div><strong>الرصيد السابق:</strong> ${(transaction.previousBalance || 0).toFixed(2)} جنيه</div>
                <div><strong>الرصيد الجديد:</strong> ${(transaction.newBalance || 0).toFixed(2)} جنيه</div>
                ${transaction.transferTo ? `<div><strong>محول إلى:</strong> ${transaction.transferToName || '-'}</div>` : ''}
                ${transaction.transferFrom ? `<div><strong>محول من:</strong> ${transaction.transferFromName || '-'}</div>` : ''}
            </div>
            ${transaction.notes ? `<div class="transaction-notes"><strong>ملاحظات:</strong> ${transaction.notes}</div>` : ''}
            <div class="transaction-actions">
                <button class="print-receipt-btn" onclick="printReceipt('${transaction.id}')">🖨️ طباعة الإيصال</button>
            </div>
        `;

        transactionsList.appendChild(transactionItem);
    });

    if (el('totalDeposits')) {
        el('totalDeposits').textContent = totalDeposits.toFixed(2) + ' جنيه';
        el('totalDeposits').style.color = '#28a745';
    }
    if (el('totalWithdrawals')) {
        el('totalWithdrawals').textContent = totalWithdrawals.toFixed(2) + ' جنيه';
        el('totalWithdrawals').style.color = '#dc3545';
    }
}

window.printReceipt = async function(transactionId) {
    try {
        const transactionDoc = await getDoc(doc(db, "transactions", transactionId));
        if (!transactionDoc.exists()) {
            alert('❌ المعاملة غير موجودة!');
            return;
        }

        const transaction = transactionDoc.data();
        const transactionDate = transaction.createdAt ? transaction.createdAt.toDate() : new Date();
        const formattedDate = transactionDate.toLocaleString('ar-EG', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        const amountText = (transaction.amount || 0).toFixed(2) + ' جنيه';
        let typeText = 'إجراء';
        if (transaction.type === 'deposit') typeText = 'إيداع';
        else if (transaction.type === 'withdrawal') typeText = 'سحب';

        const balanceTypeNames = {
            normal: 'عادي',
            offers: 'عروض',
            laser: 'ليزر',
            derma: 'جلدية'
        };
        const balanceType = transaction.balanceType ? ` (${balanceTypeNames[transaction.balanceType] || ''})` : '';

        const notesText = transaction.notes ? transaction.notes : '-';
        const createdBy = transaction.createdBy || 'نظام';
        const paymentMethod = transaction.paymentMethod || '-';
        const customerName = transaction.customerName || '-';

        const receiptHTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>إيصال - Joyec Clinic</title>
<style>
  body { font-family: Arial, "Noto Naskh Arabic", sans-serif; direction: rtl; max-width:420px; margin:20px auto; color:#111; }
  .wrap { border:1px solid #333; padding:16px; }
  .header { text-align:center; border-bottom:1px solid #ddd; padding-bottom:10px; margin-bottom:12px; }
  .header h1 { margin:0; font-size:20px; }
  .meta { font-size:13px; line-height:1.6; }
  .amount { font-weight:700; font-size:18px; color:#28a745; margin-top:10px; }
  .section { margin-top:12px; }
  .small { font-size:12px; color:#555; }
  .footer { margin-top:18px; text-align:center; border-top:1px solid #ddd; padding-top:10px; font-size:12px; color:#444; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>Joyec Clinic</h1>
      <div class="small">إيصال دفع</div>
    </div>

    <div class="meta">
      <div><strong>التاريخ:</strong> ${formattedDate}</div>
      <div><strong>العميل:</strong> ${customerName}</div>
      <div><strong>بواسطة:</strong> ${createdBy}</div>
      <div><strong>طريقة الدفع:</strong> ${paymentMethod}</div>
      <div><strong>نوع المعاملة:</strong> ${typeText}${balanceType}</div>
    </div>

    <div class="section amount">
      <div>المبلغ: ${amountText}</div>
    </div>

    <div class="section">
      <strong>ملاحظات:</strong>
      <div class="small">${notesText}</div>
    </div>

    <div class="footer">
      شكراً لاستخدامك Joyec Clinic – تواصل معنا لأي استفسار.
    </div>
  </div>

  <script>
    setTimeout(() => {
      window.print();
      try { window.close(); } catch (e) { /* ignore */ }
    }, 300);
  </script>
</body>
</html>`;

        const w = window.open('', '_blank', 'width=450,height=700');
        if (!w) {
            alert('تعذر فتح نافذة الطباعة. يرجى السماح للنوافذ المنبثقة أو طباعة من الصفحة الحالية.');
            return;
        }
        w.document.open();
        w.document.write(receiptHTML);
        w.document.close();

    } catch (error) {
        console.error("خطأ في طباعة الإيصال:", error);
        alert('❌ حدث خطأ أثناء طباعة الإيصال: ' + (error.message || error));
    }
    
};