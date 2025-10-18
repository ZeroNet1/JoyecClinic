// customer-details.js - مع زر طباعة الإيصال
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
    Timestamp
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

    const rechargeBtn = el('rechargeBtn');
    const cancelRecharge = el('cancelRecharge');
    const rechargeForm = el('rechargeBalanceForm');

    if (rechargeBtn) rechargeBtn.addEventListener('click', showRechargeForm);
    if (cancelRecharge) cancelRecharge.addEventListener('click', hideRechargeForm);
    if (rechargeForm) rechargeForm.addEventListener('submit', rechargeBalance);

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

    const rechargeOverlay = el('rechargeForm');
    if (rechargeOverlay) {
        rechargeOverlay.addEventListener('click', (e) => {
            if (e.target.id === 'rechargeForm') hideRechargeForm();
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

function showRechargeForm() {
    const rechargeFormEl = el('rechargeForm');
    if (!rechargeFormEl) return;
    rechargeFormEl.classList.remove('hidden');

    const amountInput = el('rechargeAmount');
    if (amountInput) amountInput.focus();

    const paymentMethodSelect = el('paymentMethod');
    if (paymentMethodSelect) {
        paymentMethodSelect.innerHTML = `
            <option value="نقدي">نقدي</option>
            <option value="كاش">كاش</option>
            <option value="فيزا">فيزا</option>
            <option value="تحويل بنكي">تحويل بنكي</option>
            <option value="محفظة إلكترونية">محفظة إلكترونية</option>
        `;
    }
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
            amount: amount,
            previousBalance: currentBalance,
            newBalance: newBalance,
            paymentMethod: paymentMethod,
            notes: notes || `شحن رصيد - ${paymentMethod}`,
            createdAt: Timestamp.now(),
            createdBy: currentUserName
        });

        try {
            const shiftModule = await import('../shift-management/shift-management.js');
            if (shiftModule && shiftModule.addShiftAction) {
                await shiftModule.addShiftAction(
                    'شحن رصيد',
                    `تم شحن رصيد لـ ${currentCustomerData.name} - المبلغ: ${amount.toFixed(2)} جنيه - طريقة الدفع: ${paymentMethod}`
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
            if (el('totalVisitsCount')) el('totalVisitsCount').textContent = '0';
            if (el('totalVisitAmount')) el('totalVisitAmount').textContent = '0.00 جنيه';
            return;
        }

        let totalVisits = 0;
        let totalVisitAmount = 0;

        querySnapshot.forEach(docSnap => {
            const visit = docSnap.data();
            const visitItem = document.createElement('div');
            visitItem.className = 'visit-item';

            const visitDate = visit.visitDate ? visit.visitDate.toDate() : new Date();
            const formattedDate = visitDate.toLocaleString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

            totalVisits++;
            totalVisitAmount += visit.amount || 0;

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

        if (el('totalVisitsCount')) el('totalVisitsCount').textContent = totalVisits;
        if (el('totalVisitAmount')) el('totalVisitAmount').textContent = totalVisitAmount.toFixed(2) + ' جنيه';

    } catch (error) {
        console.error("خطأ في تحميل الزيارات:", error);
        visitsList.innerHTML = '<div class="error">حدث خطأ في تحميل الزيارات</div>';
    }
}

// ✅ تحميل الحركات المالية مع زر طباعة
async function loadTransactions() {
    const transactionsList = el('transactionsList');
    if (!transactionsList) return;
    transactionsList.innerHTML = '<div class="loading">جاري تحميل الحركات...</div>';

    try {
        const q = query(collection(db, "transactions"), where("customerId", "==", currentCustomerId), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        transactionsList.innerHTML = '';

        let totalDeposits = 0;
        let totalWithdrawals = 0;
        let transactionCount = 0;

        if (querySnapshot.empty) {
            transactionsList.innerHTML = '<div class="empty-state">لا توجد حركات مالية</div>';
            if (el('totalDeposits')) el('totalDeposits').textContent = '0.00 جنيه';
            if (el('totalWithdrawals')) el('totalWithdrawals').textContent = '0.00 جنيه';
            if (el('transactionCount')) el('transactionCount').textContent = '0';
            return;
        }

        querySnapshot.forEach(docSnap => {
            const transaction = docSnap.data();
            const transactionItem = document.createElement('div');
            transactionItem.className = 'transaction-item';

            const transactionDate = transaction.createdAt ? transaction.createdAt.toDate() : new Date();
            const formattedDate = transactionDate.toLocaleString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

            const amountClass = transaction.type === 'deposit' ? 'positive' : 'negative';
            const amountSign = transaction.type === 'deposit' ? '+' : '-';
            let typeText = transaction.type === 'deposit' ? 'إيداع' : 'سحب';
            if (transaction.type === 'payment') typeText = 'دفع مقابل خدمات';
            if (transaction.type === 'refund') typeText = 'إرجاع';

            if (transaction.type === 'deposit') totalDeposits += transaction.amount || 0;
            else if (transaction.type === 'withdrawal') totalWithdrawals += transaction.amount || 0;
            transactionCount++;

            transactionItem.innerHTML = `
                <div class="transaction-header">
                    <div class="transaction-type-badge ${amountClass}">${typeText}</div>
                    <div class="transaction-date">${formattedDate}</div>
                    <div class="transaction-amount ${amountClass}">${amountSign} ${((transaction.amount || 0)).toFixed(2)} جنيه</div>
                </div>
                <div class="transaction-details">
                    <div><strong>بواسطة:</strong> ${transaction.createdBy || 'نظام'}</div>
                    <div><strong>طريقة الدفع:</strong> ${transaction.paymentMethod || 'غير محدد'}</div>
                    <div><strong>الرصيد السابق:</strong> ${(transaction.previousBalance || 0).toFixed(2)} جنيه</div>
                    <div><strong>الرصيد الجديد:</strong> ${(transaction.newBalance || 0).toFixed(2)} جنيه</div>
                </div>
                ${transaction.notes ? `<div class="transaction-notes"><strong>ملاحظات:</strong> ${transaction.notes}</div>` : ''}
                <div class="transaction-actions">
                    <button class="print-receipt-btn" onclick="printReceipt('${docSnap.id}')">🖨️ طباعة الإيصال</button>
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
        if (el('transactionCount')) el('transactionCount').textContent = transactionCount;

    } catch (error) {
        console.error("خطأ في تحميل الحركات:", error);
        transactionsList.innerHTML = '<div class="error">حدث خطأ في تحميل الحركات المالية</div>';
    }
}

// ✅ طباعة الإيصال
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

        let receiptHTML = '';

        // إيصال عميل جديد (دفع مقابل خدمات)
        if (transaction.type === 'payment' && transaction.isNewCustomer) {
            const services = transaction.services || [];
            const servicesText = services.map(s => s.name).join(' - ');
            
            receiptHTML = `
                <!DOCTYPE html>
                <html lang="ar" dir="rtl">
                <head>
                    <meta charset="UTF-8">
                    <title>إيصال دفع - Joyec Clinic</title>
                    <style>
                        body {
                            font-family: 'Arial', sans-serif;
                            max-width: 400px;
                            margin: 20px auto;
                            padding: 20px;
                            border: 2px solid #333;
                        }
                        .header {
                            text-align: center;
                            border-bottom: 2px solid #333;
                            padding-bottom: 15px;
                            margin-bottom: 20px;
                        }
                        .header h1 {
                            margin: 0;
                            font-size: 24px;
                        }
                        .header p {
                            margin: 5px 0;
                            font-size: 12px;
                        }
                        .content {
                            line-height: 2;
                            font-size: 14px;
                        }
                        .content div {
                            margin-bottom: 10px;
                        }
                        .amount {
                            font-size: 18px;
                            font-weight: bold;
                            color: #28a745;
                        }
                        .footer {
                            margin-top: 30px;
                            text-align: center;
                            border-top: 2px solid #333;
                            padding-top: 15px;
                            font-size: 12px;
                        }
                        @media print {
                            body {
                                border: none;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>Joyec Clinic</h1>
                        <p>مركز التجميل والعناية</p>
                        <p>📞 01028725687 - 01099776794 - 01028992800  | 📍 شارع المستشفي امام الاسعاف</p>
                    </div>
                    
                    <div class="content">
                        <div><strong>الاسم:</strong> ${transaction.customerName}</div>
                        <div><strong>الرقم:</strong> ${currentCustomerData.id || currentCustomerId}</div>
                        <div><strong>التاريخ:</strong> ${formattedDate}</div>
                        <hr>
                        <div>في يوم ${formattedDate}</div>
                        <div>تم دفع مبلغ قدره <span class="amount">${transaction.paidAmount ? transaction.paidAmount.toFixed(2) : transaction.amount.toFixed(2)} جنيه</span></div>
                        <div><strong>طريقة الدفع:</strong> ${transaction.paymentMethod}</div>
                        <hr>
                        <div><strong>مقابل خدمة:</strong> ${servicesText}</div>
                        <div>وتم تسجيلها في حساب العميل في مركز Joyec Clinic</div>
                        <hr>
                        <div><strong>من قبل:</strong> ${transaction.createdBy}</div>
                    </div>
                    
                    <div class="footer">
                        <p>شكراً لزيارتكم Joyec Clinic</p>
                        <p>نتمنى لكم دوام الصحة والعافية</p>
                    </div>
                </body>
                </html>
            `;
        }
        // إيصال إيداع (شحن رصيد)
        else if (transaction.type === 'deposit') {
            receiptHTML = `
                <!DOCTYPE html>
                <html lang="ar" dir="rtl">
                <head>
                    <meta charset="UTF-8">
                    <title>إيصال إيداع - Joyec Clinic</title>
                    <style>
                        body {
                            font-family: 'Arial', sans-serif;
                            max-width: 400px;
                            margin: 20px auto;
                            padding: 20px;
                            border: 2px solid #333;
                        }
                        .header {
                            text-align: center;
                            border-bottom: 2px solid #333;
                            padding-bottom: 15px;
                            margin-bottom: 20px;
                        }
                        .header h1 {
                            margin: 0;
                            font-size: 24px;
                        }
                        .header p {
                            margin: 5px 0;
                            font-size: 12px;
                        }
                        .content {
                            line-height: 2;
                            font-size: 14px;
                        }
                        .content div {
                            margin-bottom: 10px;
                        }
                        .amount {
                            font-size: 18px;
                            font-weight: bold;
                            color: #28a745;
                        }
                        .footer {
                            margin-top: 30px;
                            text-align: center;
                            border-top: 2px solid #333;
                            padding-top: 15px;
                            font-size: 12px;
                        }
                        @media print {
                            body {
                                border: none;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>Joyec Clinic</h1>
                        <p>مركز التجميل والعناية</p>
                        <p>📞 01028725687 - 01099776794 - 01028992800  | 📍 شارع المستشفي امام الاسعاف</p>
                    </div>
                    
                    <div class="content">
                        <div><strong>الاسم:</strong> ${transaction.customerName}</div>
                        <div><strong>الرقم:</strong> ${currentCustomerData.id || currentCustomerId}</div>
                        <div><strong>التاريخ:</strong> ${formattedDate}</div>
                        <hr>
                        <div>تم إيداع مبلغ <span class="amount">${transaction.amount.toFixed(2)} جنيه</span> في حسابك</div>
                        <div><strong>طريقة الدفع:</strong> ${transaction.paymentMethod}</div>
                        <hr>
                        <div><strong>من قبل:</strong> ${transaction.createdBy}</div>
                    </div>
                    
                    <div class="footer">
                        <p>شكراً لزيارتكم Joyec Clinic</p>
                        <p>نتمنى لكم دوام الصحة والعافية</p>
                    </div>
                </body>
                </html>
            `;
        }
        // إيصال سحب (دفع مقابل خدمات - عميل قديم)
        else if (transaction.type === 'withdrawal') {
            const services = transaction.services || [];
            const servicesText = services.length > 0 ? services.map(s => s.name).join(' - ') : (transaction.notes || 'خدمات');
            
            receiptHTML = `
                <!DOCTYPE html>
                <html lang="ar" dir="rtl">
                <head>
                    <meta charset="UTF-8">
                    <title>إيصال دفع - Joyec Clinic</title>
                    <style>
                        body {
                            font-family: 'Arial', sans-serif;
                            max-width: 400px;
                            margin: 20px auto;
                            padding: 20px;
                            border: 2px solid #333;
                        }
                        .header {
                            text-align: center;
                            border-bottom: 2px solid #333;
                            padding-bottom: 15px;
                            margin-bottom: 20px;
                        }
                        .header h1 {
                            margin: 0;
                            font-size: 24px;
                        }
                        .header p {
                            margin: 5px 0;
                            font-size: 12px;
                        }
                        .content {
                            line-height: 2;
                            font-size: 14px;
                        }
                        .content div {
                            margin-bottom: 10px;
                        }
                        .amount {
                            font-size: 18px;
                            font-weight: bold;
                            color: #dc3545;
                        }
                        .footer {
                            margin-top: 30px;
                            text-align: center;
                            border-top: 2px solid #333;
                            padding-top: 15px;
                            font-size: 12px;
                        }
                        @media print {
                            body {
                                border: none;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>Joyec Clinic</h1>
                        <p>مركز التجميل والعناية</p>
                        <p>📞 01028725687 - 01099776794 - 01028992800  | 📍 شارع المستشفي امام الاسعاف</p>
                    </div>
                    
                    <div class="content">
                        <div><strong>الاسم:</strong> ${transaction.customerName}</div>
                        <div><strong>الرقم:</strong> ${currentCustomerData.id || currentCustomerId}</div>
                        <div><strong>التاريخ:</strong> ${formattedDate}</div>
                        <hr>
                        <div>تم دفع مبلغ قدره <span class="amount">${transaction.amount.toFixed(2)} جنيه</span></div>
                        <div><strong>طريقة الدفع:</strong> ${transaction.paymentMethod || 'رصيد داخلي'}</div>
                        <hr>
                        <div><strong>مقابل خدمة:</strong> ${servicesText}</div>
                        <div>وتم تسجيلها في حساب العميل في مركز Joyec Clinic</div>
                        <hr>
                        <div><strong>من قبل:</strong> ${transaction.createdBy}</div>
                    </div>
                    
                    <div class="footer">
                        <p>شكراً لزيارتكم Joyec Clinic</p>
                        <p>نتمنى لكم دوام الصحة والعافية</p>
                    </div>
                </body>
                </html>
            `;
        }
        // إيصال إرجاع
        else if (transaction.type === 'refund') {
            receiptHTML = `
                <!DOCTYPE html>
                <html lang="ar" dir="rtl">
                <head>
                    <meta charset="UTF-8">
                    <title>إيصال إرجاع - Joyec Clinic</title>
                    <style>
                        body {
                            font-family: 'Arial', sans-serif;
                            max-width: 400px;
                            margin: 20px auto;
                            padding: 20px;
                            border: 2px solid #333;
                        }
                        .header {
                            text-align: center;
                            border-bottom: 2px solid #333;
                            padding-bottom: 15px;
                            margin-bottom: 20px;
                        }
                        .header h1 {
                            margin: 0;
                            font-size: 24px;
                        }
                        .header p {
                            margin: 5px 0;
                            font-size: 12px;
                        }
                        .content {
                            line-height: 2;
                            font-size: 14px;
                        }
                        .content div {
                            margin-bottom: 10px;
                        }
                        .amount {
                            font-size: 18px;
                            font-weight: bold;
                            color: #28a745;
                        }
                        .footer {
                            margin-top: 30px;
                            text-align: center;
                            border-top: 2px solid #333;
                            padding-top: 15px;
                            font-size: 12px;
                        }
                        @media print {
                            body {
                                border: none;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>Joyec Clinic</h1>
                        <p>مركز التجميل والعناية</p>
                        <p>📞 01028725687 - 01099776794 - 01028992800 | 📍 شارع المستشفي امام الاسعاف</p>
                    </div>
                    
                    <div class="content">
                        <div><strong>الاسم:</strong> ${transaction.customerName}</div>
                        <div><strong>الرقم:</strong> ${currentCustomerData.id || currentCustomerId}</div>
                        <div><strong>التاريخ:</strong> ${formattedDate}</div>
                        <hr>
                        <div>تم إرجاع مبلغ <span class="amount">${transaction.amount.toFixed(2)} جنيه</span> إلى حسابك</div>
                        <div><strong>السبب:</strong> ${transaction.notes || 'إلغاء حجز'}</div>
                        <hr>
                        <div><strong>من قبل:</strong> ${transaction.createdBy}</div>
                    </div>
                    
                    <div class="footer">
                        <p>شكراً لزيارتكم Joyec Clinic</p>
                        <p>نتمنى لكم دوام الصحة والعافية</p>
                    </div>
                </body>
                </html>
            `;
        }

        // فتح نافذة طباعة
        const printWindow = window.open('', '_blank', 'width=600,height=800');
        printWindow.document.write(receiptHTML);
        printWindow.document.close();
        
        // انتظار تحميل المحتوى ثم الطباعة
        printWindow.onload = function() {
            printWindow.print();
        };

    } catch (error) {
        console.error("خطأ في طباعة الإيصال:", error);
        alert('❌ حدث خطأ في طباعة الإيصال');
    }
};

const style = document.createElement('style');
style.textContent = `
    .transaction-type-badge { padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: bold; }
    .positive { color: #28a745; }
    .negative { color: #dc3545; }
    .visit-item, .transaction-item { background: white; border-radius: 8px; padding: 15px; margin-bottom: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-right: 4px solid #007bff; }
    .visit-header, .transaction-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .visit-details, .transaction-details { color: #666; font-size: 14px; }
    .visit-details div, .transaction-details div { margin-bottom: 5px; }
    .visit-notes, .transaction-notes { background: #f8f9fa; padding: 8px; border-radius: 4px; margin-top: 10px; border-right: 2px solid #007bff; }
    .transaction-actions { margin-top: 15px; display: flex; gap: 10px; }
    .print-receipt-btn { 
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        transition: all 0.3s;
    }
    .print-receipt-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    }
`;
document.head.appendChild(style);