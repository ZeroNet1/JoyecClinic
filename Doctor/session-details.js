// session-details.js
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
    writeBatch,
    increment
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
let currentSession = null; // for session pages if needed

// التحقق من صلاحية المستخدم
checkUserRole().then(async (userData) => {
    if (userData) {
        const userNameEl = document.getElementById('userName');
        if (userNameEl) userNameEl.textContent = userData.name;
        currentUserName = userData.name;
        await initializePage();
    }
});

// تهيئة الصفحة
async function initializePage() {
    // الحصول على معرف العميل من URL
    const urlParams = new URLSearchParams(window.location.search);
    currentCustomerId = urlParams.get('id');
    
    if (!currentCustomerId) {
        alert('❌ لم يتم تحديد عميل!');
        if (window.location) window.location.href = 'customer-list.html';
        return;
    }
    
    await loadCustomerData();
    setupEventListeners();
}

// إعداد مستمعي الأحداث
function setupEventListeners() {
    // tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            switchTab(e.target.getAttribute('data-tab'));
        });
    });
    
    const rechargeBtn = document.getElementById('rechargeBtn');
    if (rechargeBtn) rechargeBtn.addEventListener('click', showRechargeForm);
    const cancelRechargeBtn = document.getElementById('cancelRecharge');
    if (cancelRechargeBtn) cancelRechargeBtn.addEventListener('click', hideRechargeForm);
    const rechargeBalanceForm = document.getElementById('rechargeBalanceForm');
    if (rechargeBalanceForm) rechargeBalanceForm.addEventListener('submit', rechargeBalance);
    
    const addVisitBtn = document.getElementById('addVisitBtn');
    if (addVisitBtn) addVisitBtn.addEventListener('click', showAddVisitModal);
    const closeVisitModal = document.getElementById('closeVisitModal');
    if (closeVisitModal) closeVisitModal.addEventListener('click', hideAddVisitModal);
    const cancelVisit = document.getElementById('cancelVisit');
    if (cancelVisit) cancelVisit.addEventListener('click', hideAddVisitModal);
    const addVisitForm = document.getElementById('addVisitForm');
    if (addVisitForm) addVisitForm.addEventListener('submit', addVisit);
    
    const addServiceBtn = document.getElementById('addServiceBtn');
    if (addServiceBtn) addServiceBtn.addEventListener('click', showAddServiceModal);
    const closeAddService = document.getElementById('closeAddServiceBtn');
    if (closeAddService) closeAddService.addEventListener('click', hideAddServiceModal);
    const addServiceFormBtn = document.getElementById('confirmAddServiceBtn');
    if (addServiceFormBtn) addServiceFormBtn.addEventListener('click', addAdditionalService);
    
    // close modals clicking outside (if present)
    const addVisitModal = document.getElementById('addVisitModal');
    if (addVisitModal) addVisitModal.addEventListener('click', (e) => {
        if (e.target.id === 'addVisitModal') hideAddVisitModal();
    });
    const rechargeForm = document.getElementById('rechargeForm');
    if (rechargeForm) rechargeForm.addEventListener('click', (e) => {
        if (e.target.id === 'rechargeForm') hideRechargeForm();
    });
}

// تحميل بيانات العميل
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
        loadVisits();
        loadTransactions();
        
    } catch (error) {
        console.error("خطأ في تحميل بيانات العميل:", error);
        alert('❌ حدث خطأ في تحميل بيانات العميل');
    }
}

// عرض معلومات العميل
function displayCustomerInfo() {
    const pageTitleEl = document.getElementById('pageTitle');
    if (pageTitleEl) pageTitleEl.textContent = `تفاصيل العميل - ${currentCustomerData.name}`;
    const nameEl = document.getElementById('customerNameDisplay');
    if (nameEl) nameEl.textContent = currentCustomerData.name;
    const phoneEl = document.getElementById('customerPhoneDisplay');
    if (phoneEl) phoneEl.textContent = currentCustomerData.phone;
    const visitCountEl = document.getElementById('visitCount');
    if (visitCountEl) visitCountEl.textContent = currentCustomerData.visitCount || 0;
    const totalSpentEl = document.getElementById('totalSpent');
    if (totalSpentEl) totalSpentEl.textContent = (currentCustomerData.totalSpent || 0).toFixed(2);
    const currentBalanceEl = document.getElementById('currentBalance');
    if (currentBalanceEl) currentBalanceEl.textContent = `${(currentCustomerData.balance || 0).toFixed(2)} جنيه`;
    
    // تحديث لون الرصيد
    const balanceElement = document.getElementById('currentBalance');
    if (balanceElement) {
        if ((currentCustomerData.balance || 0) > 0) {
            balanceElement.style.color = '#28a745';
        } else if ((currentCustomerData.balance || 0) < 0) {
            balanceElement.style.color = '#dc3545';
        } else {
            balanceElement.style.color = '#6c757d';
        }
    }
}

// تبديل التبويبات
function switchTab(tabName) {
    // إخفاء جميع التبويبات
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });
    
    // إلغاء تنشيط جميع الأزرار
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // إظهار التبويب المحدد
    const tabEl = document.getElementById(`${tabName}-tab`);
    const btnEl = document.querySelector(`[data-tab="${tabName}"]`);
    if (tabEl) tabEl.classList.add('active');
    if (btnEl) btnEl.classList.add('active');
    
    // تحميل البيانات حسب التبويب
    if (tabName === 'visits') {
        loadVisits();
    } else if (tabName === 'transactions') {
        loadTransactions();
    }
}

// عرض نموذج شحن الرصيد
function showRechargeForm() {
    const form = document.getElementById('rechargeForm');
    if (form) {
        form.classList.remove('hidden');
        const amountInput = document.getElementById('rechargeAmount');
        if (amountInput) amountInput.focus();
    }
    
    const paymentMethodSelect = document.getElementById('paymentMethod');
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

// إخفاء نموذج شحن الرصيد
function hideRechargeForm() {
    const form = document.getElementById('rechargeForm');
    if (form) form.classList.add('hidden');
    const rechargeBalanceForm = document.getElementById('rechargeBalanceForm');
    if (rechargeBalanceForm) rechargeBalanceForm.reset();
}

// شحن الرصيد مع طريقة الدفع
async function rechargeBalance(e) {
    if (e && e.preventDefault) e.preventDefault();
    
    const amountInput = document.getElementById('rechargeAmount');
    const notesInput = document.getElementById('rechargeNotes');
    const paymentMethodSelect = document.getElementById('paymentMethod');
    if (!amountInput) return;
    const amount = parseFloat(amountInput.value);
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
        
        // تحديث رصيد العميل
        await updateDoc(doc(db, "customers", currentCustomerId), {
            balance: newBalance,
            updatedAt: Timestamp.now()
        });
        
        // تسجيل الحركة المالية مع طريقة الدفع
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

        // تسجيل إجراء في الشيفت
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
        
        // تحديث البيانات المحلية
        currentCustomerData.balance = newBalance;
        displayCustomerInfo();
        
        alert(`✅ تم شحن ${amount.toFixed(2)} جنيه بنجاح!\nالرصيد الجديد: ${newBalance.toFixed(2)} جنيه`);
        hideRechargeForm();
        loadTransactions();
        
    } catch (error) {
        console.error("خطأ في شحن الرصيد:", error);
        alert('❌ حدث خطأ أثناء شحن الرصيد: ' + error.message);
    }
}

// عرض مودال إضافة زيارة
function showAddVisitModal() {
    const modal = document.getElementById('addVisitModal');
    if (modal) {
        modal.classList.remove('hidden');
        const visitDate = document.getElementById('visitDate');
        if (visitDate) visitDate.value = new Date().toISOString().slice(0, 16);
        loadDoctorsAndServices();
    }    
}

// إخفاء مودال إضافة زيارة
function hideAddVisitModal() {
    const modal = document.getElementById('addVisitModal');
    if (modal) modal.classList.add('hidden');
    const addVisitForm = document.getElementById('addVisitForm');
    if (addVisitForm) addVisitForm.reset();
}

// تحميل الأطباء والخدمات (للـ add visit modal)
async function loadDoctorsAndServices() {
    // تحميل الأطباء
    const doctorsSelect = document.getElementById('visitDoctor');
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
    
    // تحميل الخدمات
    const servicesSelect = document.getElementById('visitService');
    if (servicesSelect) servicesSelect.innerHTML = '<option value="">اختر الخدمة</option>';
    
    try {
        const servicesSnapshot = await getDocs(collection(db, "services"));
        servicesSnapshot.forEach(docSnap => {
            const service = docSnap.data();
            const option = document.createElement('option');
            option.value = docSnap.id;
            option.textContent = `${service.name} - ${service.duration} دقيقة - ${Number(service.price || 0).toFixed(2)} جنيه`;
            option.setAttribute('data-price', service.price);
            if (servicesSelect) servicesSelect.appendChild(option);
        });

        // تحديث السعر تلقائياً عند اختيار الخدمة
        if (servicesSelect) {
            servicesSelect.addEventListener('change', function() {
                const selectedOption = this.options[this.selectedIndex];
                const price = selectedOption ? selectedOption.getAttribute('data-price') : null;
                if (price) {
                    const amountInput = document.getElementById('visitAmount');
                    if (amountInput) amountInput.value = price;
                }
            });
        }
        
    } catch (error) {
        console.error("خطأ في تحميل الخدمات:", error);
    }
}

// إضافة زيارة
async function addVisit(e) {
    if (e && e.preventDefault) e.preventDefault();
    
    const visitDateInput = document.getElementById('visitDate');
    const doctorSelect = document.getElementById('visitDoctor');
    const serviceSelect = document.getElementById('visitService');
    const amountInput = document.getElementById('visitAmount');
    const notesInput = document.getElementById('visitNotes');
    if (!visitDateInput || !doctorSelect || !serviceSelect || !amountInput) {
        alert('⚠️ بعض الحقول غير موجودة في صفحة الواجهة.');
        return;
    }
    
    const visitDate = visitDateInput.value;
    const doctorId = doctorSelect.value;
    const serviceId = serviceSelect.value;
    const amount = parseFloat(amountInput.value);
    const notes = notesInput ? notesInput.value.trim() : '';
    
    if (!visitDate || !doctorId || !serviceId || !amount) {
        alert('⚠️ يرجى ملء جميع الحقول الإلزامية!');
        return;
    }
    
    if (amount <= 0) {
        alert('⚠️ يرجى إدخال مبلغ صحيح!');
        return;
    }
    
    try {
        // الحصول على بيانات الدكتور والخدمة
        const doctorDoc = await getDoc(doc(db, "users", doctorId));
        const serviceDoc = await getDoc(doc(db, "services", serviceId));
        
        if (!doctorDoc.exists() || !serviceDoc.exists()) {
            alert('❌ بيانات غير صحيحة!');
            return;
        }
        
        const doctorName = doctorDoc.data().name;
        const serviceName = serviceDoc.data().name;
        const currentBalance = currentCustomerData.balance || 0;
        
        // خصم المبلغ من رصيد العميل
        const newBalance = currentBalance - amount;
        
        if (newBalance < 0) {
            if (!confirm(`⚠️ رصيد العميل غير كافي!\nالرصيد الحالي: ${currentBalance.toFixed(2)} جنيه\nالمبلغ المطلوب: ${amount.toFixed(2)} جنيه\nالنقص: ${Math.abs(newBalance).toFixed(2)} جنيه\nهل تريد المتابعة؟`)) {
                return;
            }
        }
        
        // تحديث رصيد العميل وزيادة عدد الزيارات
        await updateDoc(doc(db, "customers", currentCustomerId), {
            balance: newBalance,
            visitCount: (currentCustomerData.visitCount || 0) + 1,
            totalSpent: (currentCustomerData.totalSpent || 0) + amount,
            updatedAt: Timestamp.now()
        });
        
        // تسجيل الزيارة
        await addDoc(collection(db, "visits"), {
            customerId: currentCustomerId,
            customerName: currentCustomerData.name,
            visitDate: Timestamp.fromDate(new Date(visitDate)),
            doctorId: doctorId,
            doctorName: doctorName,
            serviceId: serviceId,
            serviceName: serviceName,
            amount: amount,
            notes: notes,
            createdAt: Timestamp.now(),
            createdBy: currentUserName
        });
        
        // تسجيل الحركة المالية
        await addDoc(collection(db, "transactions"), {
            customerId: currentCustomerId,
            customerName: currentCustomerData.name,
            type: 'withdrawal',
            amount: amount,
            previousBalance: currentBalance,
            newBalance: newBalance,
            notes: `زيارة - ${serviceName} - الدكتور: ${doctorName}`,
            createdAt: Timestamp.now(),
            createdBy: currentUserName
        });

        // تسجيل إجراء في الشيفت
        try {
            const shiftModule = await import('../shift-management/shift-management.js');
            if (shiftModule && shiftModule.addShiftAction) {
                await shiftModule.addShiftAction(
                    'زيارة عميل', 
                    `تمت زيارة لـ ${currentCustomerData.name} - الخدمة: ${serviceName} - الدكتور: ${doctorName} - المبلغ: ${amount.toFixed(2)} جنيه`
                );
            }
        } catch (shiftError) {
            console.log('لا يمكن تسجيل إجراء الشيفت:', shiftError);
        }
        
        // تحديث البيانات المحلية
        currentCustomerData.balance = newBalance;
        currentCustomerData.visitCount = (currentCustomerData.visitCount || 0) + 1;
        currentCustomerData.totalSpent = (currentCustomerData.totalSpent || 0) + amount;
        
        displayCustomerInfo();
        alert(`✅ تم إضافة الزيارة بنجاح!\nتم خصم ${amount.toFixed(2)} جنيه\nالرصيد الجديد: ${newBalance.toFixed(2)} جنيه`);
        hideAddVisitModal();
        loadVisits();
        loadTransactions();
        
    } catch (error) {
        console.error("خطأ في إضافة الزيارة:", error);
        alert('❌ حدث خطأ أثناء إضافة الزيارة: ' + error.message);
    }
}

// تحميل الزيارات
async function loadVisits() {
    const visitsList = document.getElementById('visitsList');
    if (!visitsList) return;
    visitsList.innerHTML = '<div class="loading">جاري تحميل الزيارات...</div>';
    
    try {
        const q = query(
            collection(db, "visits"), 
            where("customerId", "==", currentCustomerId),
            orderBy("visitDate", "desc")
        );
        
        const querySnapshot = await getDocs(q);
        visitsList.innerHTML = '';
        
        if (querySnapshot.empty) {
            visitsList.innerHTML = '<div class="empty-state">لا توجد زيارات مسجلة</div>';
            return;
        }
        
        let totalVisits = 0;
        let totalVisitAmount = 0;
        
        querySnapshot.forEach((docSnap) => {
            const visit = docSnap.data();
            const visitItem = document.createElement('div');
            visitItem.className = 'visit-item';
            
            const visitDate = visit.visitDate ? visit.visitDate.toDate() : new Date();
            const formattedDate = visitDate.toLocaleString('ar-EG', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
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

        // تحديث إحصائيات الزيارات
        const totalVisitsCountEl = document.getElementById('totalVisitsCount');
        const totalVisitAmountEl = document.getElementById('totalVisitAmount');
        if (totalVisitsCountEl) totalVisitsCountEl.textContent = totalVisits;
        if (totalVisitAmountEl) totalVisitAmountEl.textContent = totalVisitAmount.toFixed(2) + ' جنيه';
        
    } catch (error) {
        console.error("خطأ في تحميل الزيارات:", error);
        visitsList.innerHTML = '<div class="error">حدث خطأ في تحميل الزيارات</div>';
    }
}

// تحميل الحركات المالية
async function loadTransactions() {
    const transactionsList = document.getElementById('transactionsList');
    if (!transactionsList) return;
    transactionsList.innerHTML = '<div class="loading">جاري تحميل الحركات...</div>';
    
    try {
        const q = query(
            collection(db, "transactions"), 
            where("customerId", "==", currentCustomerId),
            orderBy("createdAt", "desc")
        );
        
        const querySnapshot = await getDocs(q);
        transactionsList.innerHTML = '';
        
        let totalDeposits = 0;
        let totalWithdrawals = 0;
        let transactionCount = 0;
        
        if (querySnapshot.empty) {
            transactionsList.innerHTML = '<div class="empty-state">لا توجد حركات مالية</div>';
            const totalDepositsEl = document.getElementById('totalDeposits');
            const totalWithdrawalsEl = document.getElementById('totalWithdrawals');
            const transactionCountEl = document.getElementById('transactionCount');
            if (totalDepositsEl) totalDepositsEl.textContent = '0.00 جنيه';
            if (totalWithdrawalsEl) totalWithdrawalsEl.textContent = '0.00 جنيه';
            if (transactionCountEl) transactionCountEl.textContent = '0';
            return;
        }
        
        querySnapshot.forEach((docSnap) => {
            const transaction = docSnap.data();
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
            const typeText = transaction.type === 'deposit' ? 'إيداع' : 'سحب';
            
            if (transaction.type === 'deposit') {
                totalDeposits += transaction.amount || 0;
            } else if (transaction.type === 'withdrawal') {
                totalWithdrawals += transaction.amount || 0;
            }
            transactionCount++;
            
            transactionItem.innerHTML = `
                <div class="transaction-header">
                    <div class="transaction-type-badge ${amountClass}">${typeText}</div>
                    <div class="transaction-date">${formattedDate}</div>
                    <div class="transaction-amount ${amountClass}">${amountSign} ${(transaction.amount || 0).toFixed(2)} جنيه</div>
                </div>
                <div class="transaction-details">
                    <div><strong>بواسطة:</strong> ${transaction.createdBy || 'نظام'}</div>
                    <div><strong>طريقة الدفع:</strong> ${transaction.paymentMethod || 'غير محدد'}</div>
                    <div><strong>الرصيد السابق:</strong> ${(transaction.previousBalance || 0).toFixed(2)} جنيه</div>
                    <div><strong>الرصيد الجديد:</strong> ${(transaction.newBalance || 0).toFixed(2)} جنيه</div>
                </div>
                ${transaction.notes ? `<div class="transaction-notes"><strong>ملاحظات:</strong> ${transaction.notes}</div>` : ''}
            `;
            
            transactionsList.appendChild(transactionItem);
        });
        
        // تحديث الإحصائيات (مع حماية من null)
        const totalDepositsEl = document.getElementById('totalDeposits');
        const totalWithdrawalsEl = document.getElementById('totalWithdrawals');
        const transactionCountEl = document.getElementById('transactionCount');
        if (totalDepositsEl) {
            totalDepositsEl.textContent = totalDeposits.toFixed(2) + ' جنيه';
            totalDepositsEl.style.color = '#28a745';
        }
        if (totalWithdrawalsEl) {
            totalWithdrawalsEl.textContent = totalWithdrawals.toFixed(2) + ' جنيه';
            totalWithdrawalsEl.style.color = '#dc3545';
        }
        if (transactionCountEl) transactionCountEl.textContent = transactionCount;
        
    } catch (error) {
        console.error("خطأ في تحميل الحركات:", error);
        transactionsList.innerHTML = '<div class="error">حدث خطأ في تحميل الحركات المالية</div>';
    }
}

// دالة مساعدة لعرض رسائل التأكيد بشكل أفضل
function showConfirmation(message) {
    return new Promise((resolve) => {
        const result = confirm(message);
        resolve(result);
    });
}

// ========== إدارة الخدمات الإضافية ==========

let allServicesLocal = [];

// تحميل كل الخدمات (لصفحة الجلسة)
async function loadServicesForSession() {
    try {
        const q = query(collection(db, "services"));
        const querySnapshot = await getDocs(q);
        allServicesLocal = [];
        const serviceSelect = document.getElementById('additionalService');
        if (serviceSelect) serviceSelect.innerHTML = '<option value="">اختر الخدمة</option>';
        querySnapshot.forEach(docSnap => {
            const service = { id: docSnap.id, ...docSnap.data() };
            allServicesLocal.push(service);
            if (serviceSelect) {
                const option = document.createElement('option');
                option.value = docSnap.id;
                option.textContent = `${service.name} - ${service.duration} دقيقة - ${Number(service.price || 0).toFixed(2)} جنيه`;
                option.setAttribute('data-price', service.price);
                serviceSelect.appendChild(option);
            }
        });
    } catch (err) {
        console.error('خطأ في تحميل services:', err);
    }
}

// تحديث سعر الخدمة تلقائياً (غير قابل للتعديل)
function updateServicePriceForSession() {
    const serviceSelect = document.getElementById('additionalService');
    const priceInput = document.getElementById('additionalPrice');
    if (!serviceSelect || !priceInput) return;
    const selectedOption = serviceSelect.options[serviceSelect.selectedIndex];
    if (selectedOption && selectedOption.value) {
        const price = selectedOption.getAttribute('data-price');
        priceInput.value = price;
        priceInput.readOnly = true;
        priceInput.style.backgroundColor = '#f8f9fa';
        priceInput.style.cursor = 'not-allowed';
    } else {
        priceInput.value = '';
        priceInput.readOnly = false;
        priceInput.style.backgroundColor = '';
        priceInput.style.cursor = '';
    }
}

window.showAddServiceModal = function() {
    if (!currentCustomerData) {
        alert('❌ لم يتم تحميل بيانات العميل بعد!');
        return;
    }
    const modal = document.getElementById('addServiceModal');
    if (modal) {
        modal.classList.remove('hidden');
        // reset
        const sel = document.getElementById('additionalService');
        if (sel) sel.selectedIndex = 0;
        const priceInput = document.getElementById('additionalPrice');
        if (priceInput) { priceInput.value = ''; priceInput.readOnly = false; priceInput.style.backgroundColor = ''; priceInput.style.cursor = ''; }
        const notesInput = document.getElementById('additionalNotes');
        if (notesInput) notesInput.value = '';
        loadServicesForSession();
    }
};

window.hideAddServiceModal = function() {
    const modal = document.getElementById('addServiceModal');
    if (modal) modal.classList.add('hidden');
};

// إضافة خدمة إضافية - منطق: إذا رصيد العميل يكفي -> خصم فوري + تسجيل معاملة
// إذا الرصيد لا يكفي -> تسجيل الخدمة كـ pending في booking (bookings/<id>) و sessionServices
window.addAdditionalService = async function() {
    // العناصر
    const serviceSelect = document.getElementById('additionalService');
    const priceInput = document.getElementById('additionalPrice');
    const notesInput = document.getElementById('additionalNotes');

    if (!serviceSelect || !priceInput) {
        alert('⚠️ عناصر الواجهة غير مكتملة.');
        return;
    }

    const serviceId = serviceSelect.value;
    const price = parseFloat(priceInput.value);
    const notes = notesInput ? notesInput.value.trim() : '';

    if (!serviceId) {
        alert('⚠️ يرجى اختيار خدمة!');
        return;
    }

    try {
        const selectedService = allServicesLocal.find(s => s.id === serviceId);
        if (!selectedService) {
            alert('❌ الخدمة المحددة غير موجودة!');
            return;
        }

        const originalPrice = selectedService.price;
        // ضبط السعر على السعر الأصلي (حماية)
        if (isNaN(price) || price !== originalPrice) {
            if (priceInput) priceInput.value = originalPrice;
        }

        // currentSession: في حالة وجود جلسة نشطة سيتم استعماله (إذا صفحتك تعتمد على session)
        // هنا نستخدم currentSession.bookingId إذا متاح، وإلا سنسجل الخدمة في sessionServices مع sessionId = null أو رقم بديل.
        const sessionBookingId = currentSession?.bookingId || null;

        // جلب أحدث بيانات العميل
        const customerRef = doc(db, "customers", currentCustomerId);
        const customerSnap = await getDoc(customerRef);
        if (!customerSnap.exists()) {
            alert('❌ العميل غير موجود!');
            return;
        }
        const customerData = customerSnap.data();
        const currentBalance = Number(customerData.balance || 0);

        // اذا الرصيد يكفي -> خصم فوري
        if (currentBalance >= originalPrice) {
            // تسجيل الخدمة في sessionServices
            await addDoc(collection(db, "sessionServices"), {
                sessionId: sessionBookingId,
                serviceId: serviceId,
                serviceName: selectedService.name,
                price: originalPrice,
                notes: notes,
                createdAt: Timestamp.now(),
                createdBy: currentUserName
            });

            // تحديث رصيد العميل
            const newBalance = currentBalance - originalPrice;
            await updateDoc(customerRef, {
                balance: newBalance,
                updatedAt: Timestamp.now()
            });

            // تسجيل حركة سحب (withdrawal)
            await addDoc(collection(db, "transactions"), {
                customerId: currentCustomerId,
                customerName: currentCustomerData.name,
                type: 'withdrawal',
                amount: originalPrice,
                previousBalance: currentBalance,
                newBalance: newBalance,
                paymentMethod: 'رصيد داخلي',
                notes: `خدمة إضافية: ${selectedService.name} - خصم فوري بواسطة ${currentUserName}`,
                createdAt: Timestamp.now(),
                createdBy: currentUserName
            });

            // تسجيل شيفت
            try {
                const shiftModule = await import('../shift-management/shift-management.js');
                if (shiftModule && shiftModule.addShiftAction) {
                    await shiftModule.addShiftAction(
                        'خدمة إضافية (مدفوعة فورياً)',
                        `أضاف ${currentUserName} خدمة إضافية مدفوعة فورياً: ${selectedService.name} - ${originalPrice.toFixed(2)} جنيه - للعميل ${currentCustomerId}`
                    );
                }
            } catch (shiftError) {
                console.log('لا يمكن تسجيل إجراء الشيفت:', shiftError);
            }

            alert('✅ تمت إضافة الخدمة وخصم المبلغ من رصيد العميل بنجاح!');
            hideAddServiceModal();
            // تحديث واجهات
            if (typeof updateAdditionalServicesList === 'function') updateAdditionalServicesList();
            if (typeof loadTransactions === 'function') loadTransactions();
            displayCustomerInfo();
            return;
        }

        // أما لو الرصيد غير كافٍ -> نسجل الخدمة ونعلّق الدفع على الحجز (bookings)
        // 1) تسجيل الخدمة في sessionServices
        await addDoc(collection(db, "sessionServices"), {
            sessionId: sessionBookingId,
            serviceId: serviceId,
            serviceName: selectedService.name,
            price: originalPrice,
            notes: notes,
            createdAt: Timestamp.now(),
            createdBy: currentUserName
        });

        // 2) تحديث حقل pending في booking (إن وجد bookingId)
        if (sessionBookingId) {
            const bookingRef = doc(db, "bookings", sessionBookingId);
            const bookingSnap = await getDoc(bookingRef);
            const bookingData = bookingSnap.exists() ? bookingSnap.data() : {};

            const prevPendingAmount = Number(bookingData.pendingAmount || 0);
            const prevPendingServices = Array.isArray(bookingData.pendingServices) ? bookingData.pendingServices : [];

            const newPendingAmount = prevPendingAmount + originalPrice;
            const newPendingServices = prevPendingServices.concat([{
                serviceId,
                serviceName: selectedService.name,
                price: originalPrice,
                notes,
                createdAt: Timestamp.now(),
                addedBy: currentUserName
            }]);

            await updateDoc(bookingRef, {
                pendingAmount: newPendingAmount,
                pendingServices: newPendingServices,
                paymentPending: true,
                updatedAt: Timestamp.now()
            });
        }

        // تسجيل شيفت
        try {
            const shiftModule = await import('../shift-management/shift-management.js');
            if (shiftModule && shiftModule.addShiftAction) {
                await shiftModule.addShiftAction(
                    'خدمة إضافية (معلقة الدفع)',
                    `أضاف ${currentUserName} خدمة إضافية ومعلقة الدفع: ${selectedService.name} - ${originalPrice.toFixed(2)} جنيه - العميل: ${currentCustomerId}`
                );
            }
        } catch (shiftError) {
            console.log('لا يمكن تسجيل إجراء الشيفت:', shiftError);
        }

        alert('✅ تمت إضافة الخدمة وتم وضعها كـ (في انتظار دفع) على الحجز.');
        hideAddServiceModal();
        if (typeof updateAdditionalServicesList === 'function') updateAdditionalServicesList();
        // لو لديك واجهة للحجوزات، يمكنك إعادة تحميلها من هنا
    } catch (error) {
        console.error("❌ خطأ في إضافة الخدمة الإضافية:", error);
        alert('❌ حدث خطأ أثناء إضافة الخدمة: ' + (error.message || error));
    }
};

// تحديث قائمة الخدمات الإضافية في واجهة الجلسة
async function updateAdditionalServicesList() {
    if (!currentSession) return;
    
    try {
        const q = query(
            collection(db, "sessionServices"),
            where("sessionId", "==", currentSession.bookingId)
        );
        
        const querySnapshot = await getDocs(q);
        const servicesContent = document.getElementById('additionalServicesContent');
        if (!servicesContent) return;
        
        if (querySnapshot.empty) {
            servicesContent.innerHTML = '<div class="empty-state">لا توجد خدمات إضافية</div>';
            return;
        }
        
        let servicesHTML = '';
        let totalAdditional = 0;
        
        querySnapshot.forEach(docSnap => {
            const service = docSnap.data();
            totalAdditional += Number(service.price || 0);
            servicesHTML += `
                <div class="session-item">
                    <span class="session-label">${service.serviceName}</span>
                    <span class="session-value">${Number(service.price || 0).toFixed(2)} جنيه</span>
                </div>
            `;
        });
        
        if (totalAdditional > 0) {
            servicesHTML += `
                <div class="session-item" style="border-top: 1px solid #e9ecef; margin-top: 10px; padding-top: 10px; font-weight: bold;">
                    <span class="session-label">المجموع:</span>
                    <span class="session-value">${totalAdditional.toFixed(2)} جنيه</span>
                </div>
            `;
        }
        
        servicesContent.innerHTML = servicesHTML;
        
    } catch (error) {
        console.error("❌ خطأ في تحديث الخدمات الإضافية:", error);
    }
}

// ========== إدارة المخزون (موجود في ملفك الأصلي) ==========
// ... يمكنك إدراج هنا كامل كود المخزون الذي أرسلته سابقًا إذا أردت ملف واحد كامل ...
// لكن لأني أرسلت سابقًا كود المخزون في ملفك الكبير، فأتركه كما هو أو أخبرني إن تريد إرساله أيضاً كاملاً هنا.

// ========== تقارير الجلسة والطباعة ==========

function generateSessionNumber() {
    const timestamp = new Date().getTime();
    const random = Math.floor(Math.random() * 1000);
    const sessionNumber = `SESS-${timestamp}-${random}`;
    const sessionNumberEl = document.getElementById('sessionNumber');
    if (sessionNumberEl) sessionNumberEl.value = sessionNumber;
}

window.showSessionReportModal = function() {
    if (!currentSession) {
        alert('❌ لا توجد جلسة نشطة!');
        return;
    }
    const modal = document.getElementById('sessionReportModal');
    if (modal) modal.classList.remove('hidden');
};

window.hideSessionReportModal = function() {
    const modal = document.getElementById('sessionReportModal');
    if (modal) modal.classList.add('hidden');
};

window.saveSessionReport = async function() {
    // validation
    const requiredFields = ['sessionDate','sessionTime','sessionNumber','sessionType'];
    for (const id of requiredFields) {
        const el = document.getElementById(id);
        if (!el || !el.value.trim()) {
            alert(`⚠️ يرجى ملء حقل ${id}`);
            if (el) el.focus();
            return;
        }
    }

    try {
        const reportData = {
            sessionId: currentSession ? currentSession.bookingId : null,
            customerId: currentCustomerId,
            customerName: currentCustomerData.name,
            doctorId: auth.currentUser ? auth.currentUser.uid : null,
            doctorName: currentUserName,
            sessionDate: document.getElementById('sessionDate').value,
            sessionTime: document.getElementById('sessionTime').value,
            sessionNumber: document.getElementById('sessionNumber').value,
            sessionType: document.getElementById('sessionType').value,
            pulseCount: parseInt(document.getElementById('pulseCount').value) || 0,
            power: document.getElementById('power').value,
            pulseDuration: document.getElementById('pulseDuration').value,
            spotSize: document.getElementById('spotSize').value,
            skinType: document.getElementById('skinType').value,
            notes: document.getElementById('sessionNotes').value,
            createdAt: Timestamp.now()
        };
        
        await addDoc(collection(db, "sessionReports"), reportData);

        try {
            const shiftModule = await import('../shift-management/shift-management.js');
            if (shiftModule && shiftModule.addShiftAction) {
                await shiftModule.addShiftAction('تقرير جلسة', `أنشأ ${currentUserName} تقرير جلسة لـ ${currentCustomerData.name} - رقم الجلسة: ${reportData.sessionNumber}`);
            }
        } catch (shiftError) {
            console.log('لا يمكن تسجيل إجراء الشيفت:', shiftError);
        }
        
        alert('✅ تم حفظ التقرير بنجاح!');
        hideSessionReportModal();
        
    } catch (error) {
        console.error("❌ خطأ في حفظ التقرير:", error);
        alert('❌ حدث خطأ أثناء حفظ التقرير: ' + error.message);
    }
};

window.printSessionReport = function() {
    // نفترض أن validateSessionReport تمت، ونولد التقرير
    const printWindow = window.open('', '_blank');
    const reportContent = generatePrintableReport();
    printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl">
        <head><meta charset="utf-8"><title>تقرير الجلسة</title></head>
        <body>${reportContent}</body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
};

function generatePrintableReport() {
    return `
        <div style="font-family: Arial, sans-serif; direction: rtl;">
            <h2 style="text-align:center">تقرير الجلسة</h2>
            <div><strong>العميل:</strong> ${document.getElementById('patientName') ? document.getElementById('patientName').value : ''}</div>
            <div><strong>رقم الجلسة:</strong> ${document.getElementById('sessionNumber') ? document.getElementById('sessionNumber').value : ''}</div>
            <div><strong>النوع:</strong> ${document.getElementById('sessionType') ? document.getElementById('sessionType').value : ''}</div>
            <div style="margin-top:20px;">تم التوقيع: ____________________</div>
        </div>
    `;
}

// ---------- دوال مساعدة عامة ----------
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// نجعل بعض الدوال متاحة عالمياً
window.showAddServiceModal = showAddServiceModal;
window.hideAddServiceModal = hideAddServiceModal;
window.addAdditionalService = addAdditionalService;
window.loadTransactions = loadTransactions;
window.loadVisits = loadVisits;
window.updateAdditionalServicesList = updateAdditionalServicesList;
window.generateSessionNumber = generateSessionNumber;
