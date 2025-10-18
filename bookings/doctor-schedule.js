// doctor-schedule.js - النسخة المحسّنة مع نظام التنبيهات
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    updateDoc, 
    setDoc,
    collection,
    addDoc,
    getDocs,
    query,
    where,
    orderBy,
    Timestamp,
    runTransaction,
    onSnapshot,
    deleteDoc,
    increment
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
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

let currentDoctorId = null;
let currentDoctorName = null;
let currentDate = new Date().toISOString().split('T')[0];
let allCustomers = [];
let allServices = [];
let currentUser = null;
let selectedCustomer = null;
let selectedServices = [];
let unsubscribeBookings = null;
let unsubscribeAlerts = null;
let pendingAlerts = [];

checkUserRole().then(userData => {
    if (userData) {
        currentUser = userData;
        document.getElementById('userName').textContent = userData.name;
        initializePage();
    }
});

function initializePage() {
    const urlParams = new URLSearchParams(window.location.search);
    currentDoctorId = urlParams.get('doctorId');
    currentDoctorName = decodeURIComponent(urlParams.get('doctorName') || '');
    const dateParam = urlParams.get('date');
    if (dateParam) currentDate = dateParam;
    
    console.log('🔧 تهيئة الصفحة:');
    console.log('   - doctorId:', currentDoctorId);
    console.log('   - doctorName:', currentDoctorName);
    console.log('   - currentDate:', currentDate);
    
    if (!currentDoctorId) {
        alert('❌ لم يتم تحديد دكتور!');
        window.location.href = 'bookings.html';
        return;
    }
    
    document.getElementById('pageTitle').textContent = `جدول الدكتور - ${currentDoctorName}`;
    document.getElementById('doctorName').textContent = currentDoctorName;
    document.getElementById('scheduleDate').value = currentDate;
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('scheduleDate').min = today;
    
    setupEventListeners();
    loadInitialData();
    loadScheduleRealtime();
    setupRealtimeAlerts();
}

function setupEventListeners() {
    document.getElementById('scheduleDate').addEventListener('change', function(e) {
        currentDate = e.target.value;
        console.log('📅 تم تغيير التاريخ إلى:', currentDate);
        loadScheduleRealtime();
    });
    
    document.getElementById('addBookingBtn').addEventListener('click', showAddBookingModal);
    document.getElementById('closeBookingModal').addEventListener('click', hideAddBookingModal);
    document.getElementById('cancelBooking').addEventListener('click', hideAddBookingModal);
    document.getElementById('addBookingForm').addEventListener('submit', addNewBooking);
    document.getElementById('customerType').addEventListener('change', handleCustomerTypeChange);
    document.getElementById('customerSearch').addEventListener('input', debounce(searchCustomers, 300));
    document.getElementById('servicesCount').addEventListener('change', updateServicesInputs);
    document.getElementById('bookingTime').addEventListener('change', calculateEndTime);
    
    const rechargeBtn = document.getElementById('rechargeBalanceBtn');
    if (rechargeBtn) rechargeBtn.addEventListener('click', showRechargeModal);
}

async function loadInitialData() {
    console.log('📦 تحميل البيانات الأولية...');
    await loadCustomers();
    await loadServices();
    console.log('✅ تم تحميل البيانات الأولية');
}

async function loadCustomers() {
    try {
        const q = query(collection(db, "customers"), orderBy("name"));
        const snapshot = await getDocs(q);
        allCustomers = [];
        snapshot.forEach(docSnap => {
            const data = docSnap.data() || {};
            allCustomers.push({
                id: docSnap.id,
                displayId: String(data.id || docSnap.id),
                name: data.name || '',
                phone: data.phone || '',
                balance: Number(data.balance || 0)
            });
        });
        console.log('✅ تم تحميل', allCustomers.length, 'عميل');
    } catch (err) {
        console.error("خطأ في تحميل العملاء:", err);
    }
}

async function loadServices() {
    try {
        const querySnapshot = await getDocs(collection(db, "services"));
        allServices = [];
        querySnapshot.forEach(docSnap => {
            const data = docSnap.data();
            allServices.push({
                id: docSnap.id,
                name: data.name || '',
                duration: Number(data.duration || 0),
                price: Number(data.price || 0)
            });
        });
        console.log('✅ تم تحميل', allServices.length, 'خدمة');
    } catch (error) {
        console.error("خطأ في تحميل الخدمات:", error);
    }
}

// إعداد الاستماع للتنبيهات في الوقت الحقيقي
function setupRealtimeAlerts() {
    console.log('🔔 بدء الاستماع للتنبيهات...');
    
    const q = query(
        collection(db, "receptionAlerts"),
        where("doctorId", "==", currentDoctorId),
        where("status", "==", "pending"),
        orderBy("createdAt", "desc")
    );
    
    if (unsubscribeAlerts) {
        unsubscribeAlerts();
    }
    
    unsubscribeAlerts = onSnapshot(q, (querySnapshot) => {
        pendingAlerts = [];
        querySnapshot.forEach(doc => {
            pendingAlerts.push({ id: doc.id, ...doc.data() });
        });
        
        console.log('🔔 تم جلب', pendingAlerts.length, 'تنبيه');
        displayAlerts(pendingAlerts);
        
        // تشغيل صوت إذا كان هناك تنبيهات
        if (pendingAlerts.length > 0) {
            playAlertSound();
        }
    }, (error) => {
        console.error('❌ خطأ في الاستماع للتنبيهات:', error);
    });
}

// عرض التنبيهات
function displayAlerts(alerts) {
    const alertsBox = document.getElementById('alertsBox');
    const alertsBadge = document.getElementById('alertsBadge');
    
    if (!alertsBox) return;
    
    if (alerts.length === 0) {
        alertsBox.classList.add('hidden');
        if (alertsBadge) alertsBadge.classList.add('hidden');
        return;
    }
    
    alertsBox.classList.remove('hidden');
    if (alertsBadge) {
        alertsBadge.textContent = alerts.length;
        alertsBadge.classList.remove('hidden');
    }
    
    const alertsList = document.getElementById('alertsList');
    alertsList.innerHTML = '';
    
    alerts.forEach(alert => {
        const alertCard = createAlertCard(alert);
        alertsList.appendChild(alertCard);
    });
}

// إنشاء بطاقة تنبيه
function createAlertCard(alert) {
    const card = document.createElement('div');
    card.className = 'alert-card';
    
    let alertContent = '';
    
    if (alert.stage === 'first_notification') {
        // التنبيه الأول - الخدمة أُضيفت ولكن الرصيد غير كافٍ
        alertContent = `
            <div class="alert-icon">⚠️</div>
            <div class="alert-content">
                <div class="alert-title">خدمة إضافية - رصيد غير كافٍ</div>
                <div class="alert-message">${alert.message}</div>
                <div class="alert-details">
                    <div><strong>العميلة:</strong> ${alert.customerName}</div>
                    <div><strong>الهاتف:</strong> ${alert.customerPhone}</div>
                    <div><strong>الخدمة:</strong> ${alert.serviceName}</div>
                    <div><strong>السعر:</strong> ${alert.servicePrice.toFixed(2)} جنيه</div>
                    <div class="deficit-info">
                        <span>الرصيد الحالي:</span>
                        <span class="balance-negative">${alert.currentBalance.toFixed(2)} جنيه</span>
                    </div>
                    <div class="deficit-info">
                        <span>النقص المطلوب:</span>
                        <span class="deficit-amount">${alert.deficit.toFixed(2)} جنيه</span>
                    </div>
                </div>
            </div>
            <div class="alert-actions">
                <button class="alert-action-btn primary" onclick="showRechargeFromAlert('${alert.id}')">
                    ⚡ شحن الرصيد
                </button>
                <button class="alert-action-btn secondary" onclick="dismissAlert('${alert.id}')">
                    تجاهل
                </button>
            </div>
        `;
    } else if (alert.stage === 'final_payment') {
        // التنبيه النهائي - الجلسة انتهت والعميلة تحتاج الدفع
        const unpaidTotal = alert.totalUnpaidAmount || 0;
        const servicesCount = (alert.unpaidServices || []).length;
        
        alertContent = `
            <div class="alert-icon urgent">🔴</div>
            <div class="alert-content">
                <div class="alert-title urgent">جلسة منتهية - يلزم دفع</div>
                <div class="alert-message urgent">${alert.message}</div>
                <div class="alert-details">
                    <div><strong>العميلة:</strong> ${alert.customerName}</div>
                    <div><strong>الهاتف:</strong> ${alert.customerPhone}</div>
                    <div><strong>عدد الخدمات الإضافية:</strong> ${servicesCount}</div>
                    <div><strong>المبلغ الإجمالي:</strong> ${unpaidTotal.toFixed(2)} جنيه</div>
                    <div class="deficit-info">
                        <span>الرصيد الحالي:</span>
                        <span class="balance-negative">${alert.currentBalance.toFixed(2)} جنيه</span>
                    </div>
                    ${alert.amountNeeded > 0 ? `
                    <div class="deficit-info">
                        <span>المبلغ المطلوب تحصيله:</span>
                        <span class="deficit-amount">${alert.amountNeeded.toFixed(2)} جنيه</span>
                    </div>` : ''}
                </div>
            </div>
            <div class="alert-actions">
                <button class="alert-action-btn primary" onclick="showFinalPaymentModal('${alert.id}')">
                    💰 استلام الدفع
                </button>
                <button class="alert-action-btn secondary" onclick="dismissAlert('${alert.id}')">
                    تجاهل
                </button>
            </div>
        `;
    }
    
    card.innerHTML = alertContent;
    return card;
}

// عرض مودال شحن الرصيد من التنبيه
window.showRechargeFromAlert = async function(alertId) {
    try {
        const alert = pendingAlerts.find(a => a.id === alertId);
        if (!alert) {
            alert('❌ لم يتم العثور على التنبيه');
            return;
        }
        
        const customerRef = doc(db, "customers", alert.customerId);
        const customerSnap = await getDoc(customerRef);
        const customerData = customerSnap.data();
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'rechargeAlertModal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>💰 شحن رصيد ${customerData.name}</h3>
                    <button class="close-btn" onclick="closeRechargeAlertModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="customer-info-section">
                        <h4>معلومات العميلة</h4>
                        <div class="info-grid">
                            <div><span>الاسم:</span><strong>${customerData.name}</strong></div>
                            <div><span>الهاتف:</span><strong>${customerData.phone}</strong></div>
                            <div><span>الرصيد الحالي:</span><strong class="balance-negative">${customerData.balance.toFixed(2)} جنيه</strong></div>
                        </div>
                    </div>
                    
                    <div class="service-info-section">
                        <h4>تفاصيل الخدمة الإضافية</h4>
                        <div class="info-grid">
                            <div><span>الخدمة:</span><strong>${alert.serviceName}</strong></div>
                            <div><span>السعر:</span><strong>${alert.servicePrice.toFixed(2)} جنيه</strong></div>
                            <div><span>النقص:</span><strong class="deficit-amount">${alert.deficit.toFixed(2)} جنيه</strong></div>
                        </div>
                    </div>
                    
                    <div class="input-group">
                        <label>مبلغ الشحن: <span style="color: red;">*</span></label>
                        <input type="number" id="rechargeAmount" step="0.01" min="0" value="${alert.deficit.toFixed(2)}" required>
                        <small>الحد الأدنى المطلوب: ${alert.deficit.toFixed(2)} جنيه</small>
                    </div>
                    
                    <div class="input-group">
                        <label>طريقة الدفع: <span style="color: red;">*</span></label>
                        <select id="rechargePaymentMethod" required>
                            <option value="">اختر طريقة الدفع</option>
                            <option value="نقدي">نقدي</option>
                            <option value="كاش">كاش</option>
                            <option value="فيزا">فيزا</option>
                        </select>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="save-btn" onclick="confirmRechargeFromAlert('${alertId}')">
                        تأكيد الشحن والدفع
                    </button>
                    <button class="cancel-btn" onclick="closeRechargeAlertModal()">إلغاء</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    } catch (error) {
        console.error('❌ خطأ في عرض مودال الشحن:', error);
        alert('❌ حدث خطأ في فتح نافذة الشحن');
    }
};

// إغلاق مودال الشحن
window.closeRechargeAlertModal = function() {
    const modal = document.getElementById('rechargeAlertModal');
    if (modal) modal.remove();
};

// تأكيد الشحن من التنبيه
window.confirmRechargeFromAlert = async function(alertId) {
    try {
        const amount = parseFloat(document.getElementById('rechargeAmount').value);
        const paymentMethod = document.getElementById('rechargePaymentMethod').value;
        
        if (!amount || amount <= 0) {
            alert('⚠️ يرجى إدخال مبلغ صحيح!');
            return;
        }
        
        if (!paymentMethod) {
            alert('⚠️ يرجى اختيار طريقة الدفع!');
            return;
        }
        
        const alert = pendingAlerts.find(a => a.id === alertId);
        if (!alert) {
            alert('❌ لم يتم العثور على التنبيه');
            return;
        }
        
        if (amount < alert.deficit) {
            if (!confirm(`⚠️ المبلغ المدخل (${amount.toFixed(2)} جنيه) أقل من النقص المطلوب (${alert.deficit.toFixed(2)} جنيه)\n\nهل تريد المتابعة؟`)) {
                return;
            }
        }
        
        // شحن الرصيد
        const customerRef = doc(db, "customers", alert.customerId);
        const customerSnap = await getDoc(customerRef);
        const currentBalance = customerSnap.data().balance || 0;
        const newBalance = currentBalance + amount;
        
        await updateDoc(customerRef, {
            balance: newBalance,
            updatedAt: Timestamp.now()
        });
        
        // إضافة معاملة الشحن
        await addDoc(collection(db, "transactions"), {
            customerId: alert.customerId,
            customerName: alert.customerName,
            type: 'deposit',
            amount: amount,
            previousBalance: currentBalance,
            newBalance: newBalance,
            paymentMethod: paymentMethod,
            notes: `شحن رصيد - ${paymentMethod} - لدفع خدمة إضافية: ${alert.serviceName}`,
            alertId: alertId,
            bookingId: alert.bookingId,
            createdAt: Timestamp.now(),
            createdBy: currentUser.name
        });
        
        // خصم ثمن الخدمة
        const servicePrice = alert.servicePrice;
        const balanceAfterDeduction = newBalance - servicePrice;
        
        await updateDoc(customerRef, {
            balance: balanceAfterDeduction,
            totalSpent: increment(servicePrice),
            updatedAt: Timestamp.now()
        });
        
        // إضافة معاملة الخصم
        await addDoc(collection(db, "transactions"), {
            customerId: alert.customerId,
            customerName: alert.customerName,
            type: 'withdrawal',
            amount: servicePrice,
            previousBalance: newBalance,
            newBalance: balanceAfterDeduction,
            paymentMethod: 'رصيد داخلي',
            notes: `دفع خدمة إضافية: ${alert.serviceName}`,
            serviceId: alert.serviceId,
            bookingId: alert.bookingId,
            createdAt: Timestamp.now(),
            createdBy: currentUser.name
        });
        
        // تحديث الحجز
        const bookingRef = doc(db, "bookings", alert.bookingId);
        const bookingSnap = await getDoc(bookingRef);
        const bookingData = bookingSnap.data();
        
        const additionalServices = bookingData.additionalServices || [];
        const updatedServices = additionalServices.map(s => {
            if (s.serviceId === alert.serviceId && !s.paid) {
                return { ...s, paid: true, paidAt: Timestamp.now() };
            }
            return s;
        });
        
        const remainingUnpaid = updatedServices.filter(s => !s.paid);
        
        await updateDoc(bookingRef, {
            additionalServices: updatedServices,
            status: remainingUnpaid.length > 0 ? 'pending_payment' : 'started',
            waitingForPayment: remainingUnpaid.length > 0,
            unpaidAmount: remainingUnpaid.reduce((sum, s) => sum + s.price, 0),
            updatedAt: Timestamp.now()
        });
        
        // تحديث التنبيه
        await updateDoc(doc(db, "receptionAlerts", alertId), {
            status: 'resolved',
            resolvedAt: Timestamp.now(),
            resolvedBy: currentUser.name,
            resolution: `تم شحن ${amount.toFixed(2)} جنيه وخصم ${servicePrice.toFixed(2)} جنيه`,
            paymentMethod: paymentMethod
        });
        
        alert(`✅ تم بنجاح!\n\n✔️ تم شحن ${amount.toFixed(2)} جنيه (${paymentMethod})\n✔️ تم خصم ${servicePrice.toFixed(2)} جنيه مقابل الخدمة\n✔️ الرصيد الجديد: ${balanceAfterDeduction.toFixed(2)} جنيه`);
        
        closeRechargeAlertModal();
    } catch (error) {
        console.error('❌ خطأ في تأكيد الشحن:', error);
        alert('❌ حدث خطأ أثناء تأكيد الشحن: ' + error.message);
    }
};

// عرض مودال الدفع النهائي
window.showFinalPaymentModal = async function(alertId) {
    try {
        const alert = pendingAlerts.find(a => a.id === alertId);
        if (!alert) {
            alert('❌ لم يتم العثور على التنبيه');
            return;
        }
        
        const customerRef = doc(db, "customers", alert.customerId);
        const customerSnap = await getDoc(customerRef);
        const customerData = customerSnap.data();
        
        const unpaidServices = alert.unpaidServices || [];
        const totalAmount = alert.totalUnpaidAmount || 0;
        const amountNeeded = alert.amountNeeded || 0;
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'finalPaymentModal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>💰 استلام دفع الخدمات الإضافية</h3>
                    <button class="close-btn" onclick="closeFinalPaymentModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="customer-info-section">
                        <h4>معلومات العميلة</h4>
                        <div class="info-grid">
                            <div><span>الاسم:</span><strong>${customerData.name}</strong></div>
                            <div><span>الهاتف:</span><strong>${customerData.phone}</strong></div>
                            <div><span>الرصيد الحالي:</span><strong class="balance-negative">${customerData.balance.toFixed(2)} جنيه</strong></div>
                        </div>
                    </div>
                    
                    <div class="services-list">
                        <h4>الخدمات الإضافية غير المدفوعة</h4>
                        ${unpaidServices.map(s => `
                            <div class="service-item">
                                <span>${s.serviceName}</span>
                                <span>${s.price.toFixed(2)} جنيه</span>
                            </div>
                        `).join('')}
                        <div class="total-row">
                            <strong>الإجمالي:</strong>
                            <strong>${totalAmount.toFixed(2)} جنيه</strong>
                        </div>
                    </div>
                    
                    ${amountNeeded > 0 ? `
                    <div class="input-group">
                        <label>مبلغ الشحن المطلوب: <span style="color: red;">*</span></label>
                        <input type="number" id="finalPaymentAmount" step="0.01" min="0" value="${amountNeeded.toFixed(2)}" required>
                        <small>المبلغ المطلوب لتغطية الخدمات: ${amountNeeded.toFixed(2)} جنيه</small>
                    </div>
                    ` : `
                    <div class="info-message success">
                        ✅ الرصيد كافٍ لتغطية جميع الخدمات
                    </div>
                    `}
                    
                    <div class="input-group">
                        <label>طريقة الدفع: <span style="color: red;">*</span></label>
                        <select id="finalPaymentMethod" required>
                            <option value="">اختر طريقة الدفع</option>
                            <option value="نقدي">نقدي</option>
                            <option value="كاش">كاش</option>
                            <option value="فيزا">فيزا</option>
                        </select>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="save-btn" onclick="confirmFinalPayment('${alertId}')">
                        تأكيد الدفع
                    </button>
                    <button class="cancel-btn" onclick="closeFinalPaymentModal()">إلغاء</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    } catch (error) {
        console.error('❌ خطأ في عرض مودال الدفع النهائي:', error);
        alert('❌ حدث خطأ في فتح نافذة الدفع');
    }
};

window.closeFinalPaymentModal = function() {
    const modal = document.getElementById('finalPaymentModal');
    if (modal) modal.remove();
};

// تأكيد الدفع النهائي
window.confirmFinalPayment = async function(alertId) {
    try {
        const paymentMethod = document.getElementById('finalPaymentMethod').value;
        
        if (!paymentMethod) {
            alert('⚠️ يرجى اختيار طريقة الدفع!');
            return;
        }
        
        const alert = pendingAlerts.find(a => a.id === alertId);
        if (!alert) {
            alert('❌ لم يتم العثور على التنبيه');
            return;
        }
        
        const customerRef = doc(db, "customers", alert.customerId);
        const customerSnap = await getDoc(customerRef);
        let currentBalance = customerSnap.data().balance || 0;
        
        const unpaidServices = alert.unpaidServices || [];
        const totalAmount = alert.totalUnpaidAmount || 0;
        const amountNeeded = alert.amountNeeded || 0;
        
        // إذا كان هناك مبلغ مطلوب، نشحن الرصيد أولاً
        if (amountNeeded > 0) {
            const rechargeAmount = parseFloat(document.getElementById('finalPaymentAmount').value);
            
            if (!rechargeAmount || rechargeAmount <= 0) {
                alert('⚠️ يرجى إدخال مبلغ الشحن!');
                return;
            }
            
            // شحن الرصيد
            currentBalance += rechargeAmount;
            await updateDoc(customerRef, {
                balance: currentBalance,
                updatedAt: Timestamp.now()
            });
            
            // إضافة معاملة الشحن
            await addDoc(collection(db, "transactions"), {
                customerId: alert.customerId,
                customerName: alert.customerName,
                type: 'deposit',
                amount: rechargeAmount,
                previousBalance: customerSnap.data().balance,
                newBalance: currentBalance,
                paymentMethod: paymentMethod,
                notes: `شحن رصيد - ${paymentMethod} - لدفع خدمات إضافية عند انتهاء الجلسة`,
                alertId: alertId,
                bookingId: alert.bookingId,
                createdAt: Timestamp.now(),
                createdBy: currentUser.name
            });
        }
        
        // خصم ثمن جميع الخدمات
        const balanceAfterDeduction = currentBalance - totalAmount;
        await updateDoc(customerRef, {
            balance: balanceAfterDeduction,
            totalSpent: increment(totalAmount),
            updatedAt: Timestamp.now()
        });
        
        // إضافة معاملة الخصم
        await addDoc(collection(db, "transactions"), {
            customerId: alert.customerId,
            customerName: alert.customerName,
            type: 'withdrawal',
            amount: totalAmount,
            previousBalance: currentBalance,
            newBalance: balanceAfterDeduction,
            paymentMethod: 'رصيد داخلي',
            notes: `دفع ${unpaidServices.length} خدمة إضافية: ${unpaidServices.map(s => s.serviceName).join(', ')}`,
            bookingId: alert.bookingId,
            createdAt: Timestamp.now(),
            createdBy: currentUser.name
        });
        
        // تحديث الحجز
        const bookingRef = doc(db, "bookings", alert.bookingId);
        const bookingSnap = await getDoc(bookingRef);
        const bookingData = bookingSnap.data();
        
        const additionalServices = bookingData.additionalServices || [];
        const updatedServices = additionalServices.map(s => {
            if (!s.paid) {
                return { ...s, paid: true, paidAt: Timestamp.now() };
            }
            return s;
        });
        
        await updateDoc(bookingRef, {
            additionalServices: updatedServices,
            status: 'completed',
            waitingForPayment: false,
            unpaidAmount: 0,
            updatedAt: Timestamp.now()
        });
        
        // تحديث التنبيه
        await updateDoc(doc(db, "receptionAlerts", alertId), {
            status: 'resolved',
            resolvedAt: Timestamp.now(),
            resolvedBy: currentUser.name,
            resolution: amountNeeded > 0 ? 
                `تم شحن ${amountNeeded.toFixed(2)} جنيه وخصم ${totalAmount.toFixed(2)} جنيه` :
                `تم خصم ${totalAmount.toFixed(2)} جنيه من الرصيد`,
            paymentMethod: paymentMethod
        });
        
        alert(`✅ تم بنجاح!\n\n${amountNeeded > 0 ? `✔️ تم شحن ${amountNeeded.toFixed(2)} جنيه (${paymentMethod})\n` : ''}✔️ تم خصم ${totalAmount.toFixed(2)} جنيه مقابل الخدمات\n✔️ الرصيد الجديد: ${balanceAfterDeduction.toFixed(2)} جنيه\n✔️ تم إنهاء الحجز بنجاح`);
        
        closeFinalPaymentModal();
    } catch (error) {
        console.error('❌ خطأ في تأكيد الدفع النهائي:', error);
        alert('❌ حدث خطأ أثناء تأكيد الدفع: ' + error.message);
    }
};

// تجاهل التنبيه
window.dismissAlert = async function(alertId) {
    if (!confirm('هل تريد تجاهل هذا التنبيه؟')) return;
    
    try {
        await updateDoc(doc(db, "receptionAlerts", alertId), {
            status: 'dismissed',
            dismissedAt: Timestamp.now(),
            dismissedBy: currentUser.name
        });
        
        alert('✅ تم تجاهل التنبيه');
    } catch (error) {
        console.error('❌ خطأ في تجاهل التنبيه:', error);
        alert('❌ حدث خطأ');
    }
};

// تشغيل صوت التنبيه
function playAlertSound() {
    try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHGS57OihUBELTKXh8bllHgU2jdXzxnkpBSh+zPLaizsIGGS56+mjUxEJS6Hd8bpmHwU0iM/zy3UsBS1+zPDaizsIGGO46+qiUhEJSp/c8bplHwU0h87zynUsBS1+y+/biz0IFWO36OiiURAJSZ7b8bhkHgQzhs3zyHQrBSt8ye7Zij4IF2K15+ihTxAJR5zZ77hjHQQyhczyw3MrBCp6x+zYiT4IF2G05+efTQ8JRprX7rZiHAQxg8ryvXIqBCl4xurWiD0HFl+y5eadTAkIP5jV7LVhGwMwgcjxu3AoBCh1xerUhzwHFVyv4uSbSggHPZbT6rNfGgIvf8bwuG4nAydyweHP');
        audio.play().catch(err => console.log('لا يمكن تشغيل الصوت:', err));
    } catch (e) {
        console.log('خطأ في تشغيل الصوت:', e);
    }
}

function loadScheduleRealtime() {
    console.log('📅 تحميل جدول الحجوزات للتاريخ:', currentDate);
    console.log('👨‍⚕️ الدكتور:', currentDoctorId, currentDoctorName);
    
    const bookingsCards = document.getElementById('bookingsCards');
    bookingsCards.innerHTML = '<div class="loading">جاري تحميل الحجوزات...</div>';
    
    if (unsubscribeBookings) {
        unsubscribeBookings();
    }
    
    try {
        const selectedDate = new Date(currentDate + 'T00:00:00');
        const nextDate = new Date(selectedDate);
        nextDate.setDate(nextDate.getDate() + 1);
        
        console.log('📊 نطاق البحث:');
        console.log('   من:', selectedDate);
        console.log('   إلى:', nextDate);
        
        const q = query(
            collection(db, "bookings"),
            where("doctorId", "==", currentDoctorId),
            where("bookingDate", ">=", Timestamp.fromDate(selectedDate)),
            where("bookingDate", "<", Timestamp.fromDate(nextDate)),
            orderBy("bookingDate"),
            orderBy("bookingTime")
        );
        
        unsubscribeBookings = onSnapshot(q, (querySnapshot) => {
            console.log('✅ تم جلب', querySnapshot.size, 'حجز');
            
            if (querySnapshot.empty) {
                bookingsCards.innerHTML = '<div class="empty-state">لا توجد حجوزات لهذا اليوم</div>';
                return;
            }
            
            const bookings = [];
            querySnapshot.forEach(docSnap => {
                const data = docSnap.data();
                console.log('📋 حجز:', docSnap.id, data);
                bookings.push({ id: docSnap.id, ...data });
            });
            
            displayBookings(bookings);
        }, (error) => {
            console.error("❌ خطأ في الاستماع للحجوزات:", error);
            bookingsCards.innerHTML = '<div class="error">حدث خطأ في تحميل الحجوزات: ' + error.message + '</div>';
        });
        
    } catch (error) {
        console.error("❌ خطأ في إعداد الاستماع للحجوزات:", error);
        bookingsCards.innerHTML = '<div class="error">حدث خطأ في تحميل الحجوزات: ' + error.message + '</div>';
    }
}

function displayBookings(bookings) {
    const bookingsCards = document.getElementById('bookingsCards');
    bookingsCards.innerHTML = '';
    
    console.log('🎨 عرض', bookings.length, 'حجز');
    
    bookings.forEach(booking => {
        try {
            const card = createBookingCard(booking);
            bookingsCards.appendChild(card);
        } catch (error) {
            console.error('❌ خطأ في إنشاء بطاقة الحجز:', booking.id, error);
        }
    });
}

function createBookingCard(booking) {
    const card = document.createElement('div');
    card.className = `booking-card status-${booking.status || 'pending'}`;
    
    const services = booking.services || [];
    const servicesHTML = services.map(s => `
        <div class="service-item">📌 ${s.name || 'غير محدد'} (${s.duration || 0} دقيقة - ${(s.price || 0).toFixed(2)} جنيه)</div>
    `).join('');
    
    const statusConfig = {
        'pending': { text: 'جاري', class: 'status-yellow' },
        'confirmed': { text: 'مؤكد', class: 'status-green' },
        'started': { text: 'بدأت', class: 'status-blue' },
        'pending_payment': { text: 'بدأت - يوجد خدمات غير مدفوعة', class: 'status-orange' },
        'completed': { text: 'انتهت', class: 'status-gray' },
        'cancelled': { text: 'ملغي', class: 'status-red' }
    };
    
    const statusInfo = statusConfig[booking.status] || { text: booking.status || 'غير محدد', class: 'status-default' };
    
    let actionButtons = '';
    
    if (booking.status === 'pending') {
        if (booking.isNewCustomer) {
            actionButtons = `
                <div class="new-customer-badge">⚠️ عميل جديد - يحتاج تأكيد وإنشاء حساب</div>
                <button class="confirm-btn" data-booking-id="${booking.id}" data-action="confirm">✓ تأكيد وإنشاء الحساب</button>
                <button class="cancel-btn" data-booking-id="${booking.id}" data-action="cancel">✕ إلغاء الحجز</button>
            `;
        } else {
            actionButtons = `
                <button class="confirm-btn" data-booking-id="${booking.id}" data-action="confirm">✓ تأكيد الحجز</button>
                <button class="cancel-btn" data-booking-id="${booking.id}" data-action="cancel">✕ إلغاء الحجز</button>
            `;
        }
    } else if (booking.status === 'confirmed') {
        actionButtons = `
            <button class="start-btn" data-booking-id="${booking.id}" data-action="start">▶️ بدء الجلسة</button>
            <button class="cancel-btn" data-booking-id="${booking.id}" data-action="cancel">✕ إلغاء الحجز</button>
        `;
    } else if (booking.status === 'started') {
        actionButtons = `
            <button class="complete-btn" data-booking-id="${booking.id}" data-action="complete">✔️ إنهاء الجلسة</button>
            <div class="started-badge">⏱️ الجلسة نشطة</div>
        `;
    } else if (booking.status === 'pending_payment') {
        actionButtons = `
            <div class="pending-payment-badge">⚠️ يوجد خدمات إضافية غير مدفوعة</div>
            <button class="complete-btn" data-booking-id="${booking.id}" data-action="complete">✔️ إنهاء الجلسة</button>
            <div class="started-badge">⏱️ الجلسة نشطة</div>
        `;
    } else if (booking.status === 'completed') {
        actionButtons = `<div class="completed-badge">✅ تم الانتهاء بنجاح</div>`;
    } else if (booking.status === 'cancelled') {
        actionButtons = `<div class="cancelled-badge">✕ تم الإلغاء</div>`;
    }
    
    card.innerHTML = `
        <div class="booking-header">
            <div class="booking-time">
                <span class="time-label">الموعد:</span>
                <span class="time-value">${booking.bookingTime || '--:--'} - ${booking.endTime || '--:--'}</span>
            </div>
            <div class="booking-status ${statusInfo.class}">${statusInfo.text}</div>
        </div>
        
        <div class="booking-body">
            <div class="customer-info">
                <h3>${booking.customerName || 'غير محدد'}</h3>
                <p>📱 ${booking.customerPhone || 'غير محدد'}</p>
            </div>
            
            <div class="services-list">
                <strong>الخدمات المحجوزة:</strong>
                ${servicesHTML || '<div>لا توجد خدمات</div>'}
            </div>
            
            <div class="booking-meta">
                <div>💰 التكلفة الإجمالية: <strong>${(booking.totalCost || 0).toFixed(2)} جنيه</strong></div>
                <div>⏱️ المدة الكلية: <strong>${booking.totalDuration || 0} دقيقة</strong></div>
                <div>👤 تم الحجز بواسطة: <strong>${booking.createdBy || 'غير محدد'}</strong></div>
            </div>
            
            ${booking.cancelReason ? `<div class="cancel-reason">❌ سبب الإلغاء: ${booking.cancelReason}</div>` : ''}
        </div>
        
        <div class="booking-actions">
            ${actionButtons}
        </div>
    `;
    
    const confirmBtn = card.querySelector('[data-action="confirm"]');
    const cancelBtn = card.querySelector('[data-action="cancel"]');
    const startBtn = card.querySelector('[data-action="start"]');
    const completeBtn = card.querySelector('[data-action="complete"]');
    
    if (confirmBtn) {
        confirmBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (!this.disabled) {
                this.disabled = true;
                confirmBooking(booking.id, booking.isNewCustomer, booking).finally(() => {
                    this.disabled = false;
                });
            }
        });
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (!this.disabled) {
                this.disabled = true;
                showCancelModal(booking.id, booking.isNewCustomer);
                setTimeout(() => { this.disabled = false; }, 500);
            }
        });
    }
    
    if (startBtn) {
        startBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (!this.disabled) {
                this.disabled = true;
                startSession(booking.id).finally(() => {
                    this.disabled = false;
                });
            }
        });
    }
    
    if (completeBtn) {
        completeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (!this.disabled) {
                this.disabled = true;
                completeSession(booking.id).finally(() => {
                    this.disabled = false;
                });
            }
        });
    }
    
    return card;
}

// باقي الدوال (showAddBookingModal, addNewBooking, confirmBooking, etc.) تبقى كما هي...
// [يمكنني إضافتها إذا أردت، لكن لتوفير المساحة سأكتفي بالجزء الجديد]

function showAddBookingModal() {
    const modal = document.getElementById('addBookingModal');
    if (modal) {
        modal.classList.remove('hidden');
    }
    document.getElementById('bookingTime').value = '';
    document.getElementById('servicesCount').value = '1';
    updateServicesInputs();
}

function hideAddBookingModal() {
    const modal = document.getElementById('addBookingModal');
    if (modal) {
        modal.classList.add('hidden');
    }
    document.getElementById('addBookingForm').reset();
    selectedServices = [];
    selectedCustomer = null;
    
    const balanceInfo = document.getElementById('customerBalanceInfo');
    if (balanceInfo) {
        balanceInfo.classList.add('hidden');
    }
}

function handleCustomerTypeChange() {
    const type = document.getElementById('customerType').value;
    
    const newSection = document.getElementById('newCustomerSection');
    const existingSection = document.getElementById('existingCustomerSection');
    const balanceInfo = document.getElementById('customerBalanceInfo');
    
    if (newSection) {
        newSection.classList.toggle('hidden', type !== 'new');
    }
    if (existingSection) {
        existingSection.classList.toggle('hidden', type !== 'existing');
    }
    if (balanceInfo) {
        balanceInfo.classList.add('hidden');
    }
}

function searchCustomers() {
    const searchTerm = document.getElementById('customerSearch').value.toLowerCase();
    const resultsContainer = document.getElementById('customerResults');
    
    if (!resultsContainer) return;
    
    if (searchTerm.length < 1) {
        resultsContainer.classList.add('hidden');
        return;
    }
    
    const filtered = allCustomers.filter(c => 
        c.name.toLowerCase().includes(searchTerm) ||
        c.phone.includes(searchTerm) ||
        c.displayId.includes(searchTerm)
    );
    
    resultsContainer.innerHTML = '';
    filtered.forEach(customer => {
        const item = document.createElement('div');
        item.className = 'customer-result-item';
        const balanceClass = customer.balance > 0 ? 'positive' : 'zero';
        item.innerHTML = `
            <div><strong>${customer.name}</strong></div>
            <div>
                📱 ${customer.phone} | 
                🔢 ${customer.displayId} | 
                💰 <span class="${balanceClass}">${customer.balance.toFixed(2)} جنيه</span>
            </div>
        `;
        item.addEventListener('click', () => selectCustomer(customer));
        resultsContainer.appendChild(item);
    });
    
    resultsContainer.classList.remove('hidden');
}

function selectCustomer(customer) {
    selectedCustomer = customer;
    
    const selectedInfo = document.getElementById('selectedCustomerInfo');
    const selectedName = document.getElementById('selectedCustomerName');
    const selectedBalance = document.getElementById('selectedCustomerBalance');
    const customerResults = document.getElementById('customerResults');
    const customerSearch = document.getElementById('customerSearch');
    const balanceInfo = document.getElementById('customerBalanceInfo');
    const currentBalance = document.getElementById('currentCustomerBalance');
    
    if (selectedInfo) selectedInfo.classList.remove('hidden');
    if (selectedName) selectedName.textContent = customer.name;
    if (selectedBalance) selectedBalance.textContent = customer.balance.toFixed(2);
    if (customerResults) customerResults.classList.add('hidden');
    if (customerSearch) customerSearch.value = customer.name;
    
    if (balanceInfo) balanceInfo.classList.remove('hidden');
    if (currentBalance) currentBalance.textContent = customer.balance.toFixed(2);
    
    const totalCost = parseFloat(document.getElementById('totalCost').textContent) || 0;
    const bookingCostDisplay = document.getElementById('bookingCostDisplay');
    if (bookingCostDisplay) {
        bookingCostDisplay.textContent = totalCost.toFixed(2);
    }
    
    updateBalanceStatus(customer.balance, totalCost);
}

function updateBalanceStatus(balance, totalCost) {
    if (!totalCost) {
        totalCost = parseFloat(document.getElementById('totalCost').textContent) || 0;
    }
    
    const remainingBalance = balance - totalCost;
    const remainingEl = document.getElementById('remainingBalanceAfter');
    const rechargeBtn = document.getElementById('rechargeBalanceBtn');
    
    if (remainingEl) {
        remainingEl.textContent = remainingBalance.toFixed(2);
        
        if (remainingBalance < 0) {
            remainingEl.style.color = '#dc3545';
            remainingEl.parentElement.style.background = 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)';
            if (rechargeBtn) rechargeBtn.classList.remove('hidden');
        } else if (remainingBalance === 0) {
            remainingEl.style.color = '#ff9800';
            remainingEl.parentElement.style.background = 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)';
            if (rechargeBtn) rechargeBtn.classList.add('hidden');
        } else {
            remainingEl.style.color = '#28a745';
            remainingEl.parentElement.style.background = 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)';
            if (rechargeBtn) rechargeBtn.classList.add('hidden');
        }
    }
}

function updateServicesInputs() {
    const count = parseInt(document.getElementById('servicesCount').value) || 1;
    const container = document.getElementById('servicesInputs');
    container.innerHTML = '';
    
    for (let i = 1; i <= count; i++) {
        const div = document.createElement('div');
        div.className = 'service-input-group';
        div.innerHTML = `
            <label>الخدمة ${i}:</label>
            <select class="service-select" data-index="${i-1}" required>
                <option value="">اختر الخدمة</option>
                ${allServices.map(s => `
                    <option value="${s.id}" data-duration="${s.duration}" data-price="${s.price}">
                        ${s.name} - ${s.duration} دقيقة - ${s.price.toFixed(2)} جنيه
                    </option>
                `).join('')}
            </select>
        `;
        container.appendChild(div);
    }
    
    document.querySelectorAll('.service-select').forEach(select => {
        select.addEventListener('change', calculateTotalCostAndDuration);
    });
}

function calculateTotalCostAndDuration() {
    selectedServices = [];
    let totalCost = 0;
    let totalDuration = 0;
    
    document.querySelectorAll('.service-select').forEach(select => {
        if (select.value) {
            const service = allServices.find(s => s.id === select.value);
            if (service) {
                selectedServices.push(service);
                totalCost += service.price;
                totalDuration += service.duration;
            }
        }
    });
    
    document.getElementById('totalCost').textContent = totalCost.toFixed(2);
    document.getElementById('totalDuration').textContent = totalDuration;
    
    const bookingCostDisplay = document.getElementById('bookingCostDisplay');
    if (bookingCostDisplay) {
        bookingCostDisplay.textContent = totalCost.toFixed(2);
    }
    
    if (selectedCustomer) {
        updateBalanceStatus(selectedCustomer.balance, totalCost);
    }
    
    calculateEndTime();
}

function calculateEndTime() {
    const startTime = document.getElementById('bookingTime').value;
    if (!startTime) return;
    
    const totalDuration = parseInt(document.getElementById('totalDuration').textContent) || 0;
    if (totalDuration === 0) return;
    
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + totalDuration;
    const endHours = Math.floor(totalMinutes / 60);
    const endMinutes = totalMinutes % 60;
    
    const endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
    document.getElementById('endTime').textContent = endTime;
}

function showRechargeModal() {
    if (!selectedCustomer) return;
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'rechargeModal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>💰 شحن رصيد ${selectedCustomer.name}</h3>
                <button class="close-btn" onclick="closeRechargeModal()">✕</button>
            </div>
            <div class="modal-body">
                <div class="balance-info-box">
                    <div>الرصيد الحالي: <strong>${selectedCustomer.balance.toFixed(2)} جنيه</strong></div>
                    <div>التكلفة المطلوبة: <strong>${document.getElementById('totalCost').textContent} جنيه</strong></div>
                    <div class="deficit">النقص: <strong>${Math.abs(selectedCustomer.balance - parseFloat(document.getElementById('totalCost').textContent)).toFixed(2)} جنيه</strong></div>
                </div>
                
                <div class="input-group">
                    <label>مبلغ الشحن:</label>
                    <input type="number" id="rechargeAmount" step="0.01" min="0" value="${Math.abs(selectedCustomer.balance - parseFloat(document.getElementById('totalCost').textContent)).toFixed(2)}">
                </div>
                
                <div class="input-group">
                    <label>طريقة الدفع:</label>
                    <select id="rechargePaymentMethod">
                        <option value="نقدي">نقدي</option>
                        <option value="كاش">كاش</option>
                        <option value="فيزا">فيزا</option>
                    </select>
                </div>
            </div>
            <div class="modal-footer">
                <button class="save-btn" onclick="confirmRecharge()">تأكيد الشحن</button>
                <button class="cancel-btn" onclick="closeRechargeModal()">إلغاء</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

window.closeRechargeModal = function() {
    const modal = document.getElementById('rechargeModal');
    if (modal) modal.remove();
};

window.confirmRecharge = async function() {
    const amount = parseFloat(document.getElementById('rechargeAmount').value);
    const paymentMethod = document.getElementById('rechargePaymentMethod').value;
    
    if (!amount || amount <= 0) {
        alert('⚠️ أدخل مبلغ صحيح!');
        return;
    }
    
    try {
        const customerRef = doc(db, "customers", selectedCustomer.id);
        const customerSnap = await getDoc(customerRef);
        const currentBalance = customerSnap.data().balance || 0;
        const newBalance = currentBalance + amount;
        
        await updateDoc(customerRef, {
            balance: newBalance,
            updatedAt: Timestamp.now()
        });
        
        await addDoc(collection(db, "transactions"), {
            customerId: selectedCustomer.id,
            customerName: selectedCustomer.name,
            type: 'deposit',
            amount,
            previousBalance: currentBalance,
            newBalance,
            paymentMethod,
            notes: `شحن رصيد - ${paymentMethod}`,
            createdAt: Timestamp.now(),
            createdBy: currentUser.name
        });
        
        try {
            const shiftModule = await import('../shift-management/shift-management.js');
            if (shiftModule && shiftModule.addShiftAction) {
                await shiftModule.addShiftAction('شحن رصيد', `شحن ${amount.toFixed(2)} جنيه لـ ${selectedCustomer.name} - ${paymentMethod}`);
            }
        } catch (e) {
            console.log('لا يمكن تسجيل في الشيفت:', e);
        }
        
        selectedCustomer.balance = newBalance;
        document.getElementById('selectedCustomerBalance').textContent = newBalance.toFixed(2);
        document.getElementById('currentCustomerBalance').textContent = newBalance.toFixed(2);
        
        const totalCost = parseFloat(document.getElementById('totalCost').textContent) || 0;
        updateBalanceStatus(newBalance, totalCost);
        
        alert('✅ تم شحن الرصيد بنجاح!');
        closeRechargeModal();
        
    } catch (error) {
        console.error("خطأ في شحن الرصيد:", error);
        alert('❌ حدث خطأ في شحن الرصيد');
    }
};

async function validateBookingTime(bookingDate, bookingTime, totalDuration) {
    const now = new Date();
    const bookingDateTime = new Date(bookingDate + 'T' + bookingTime);
    
    if (bookingDateTime <= now) {
        return {
            valid: false,
            message: '⚠️ لا يمكن الحجز في وقت مضى! يرجى اختيار وقت مستقبلي.'
        };
    }
    
    const [hours, minutes] = bookingTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + totalDuration;
    const endHours = Math.floor(totalMinutes / 60);
    const endMinutes = totalMinutes % 60;
    const endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
    
    try {
        const selectedDate = new Date(bookingDate + 'T00:00:00');
        const nextDate = new Date(selectedDate);
        nextDate.setDate(selectedDate.getDate() + 1);
        
        const q = query(
            collection(db, "bookings"),
            where("doctorId", "==", currentDoctorId),
            where("bookingDate", ">=", Timestamp.fromDate(selectedDate)),
            where("bookingDate", "<", Timestamp.fromDate(nextDate)),
            where("status", "in", ["pending", "confirmed", "started"])
        );
        
        const querySnapshot = await getDocs(q);
        
        for (const docSnap of querySnapshot.docs) {
            const booking = docSnap.data();
            
            const existingStart = timeToMinutes(booking.bookingTime);
            const existingEnd = timeToMinutes(booking.endTime);
            const newStart = timeToMinutes(bookingTime);
            const newEnd = timeToMinutes(endTime);
            
            if ((newStart >= existingStart && newStart < existingEnd) ||
                (newEnd > existingStart && newEnd <= existingEnd) ||
                (newStart <= existingStart && newEnd >= existingEnd)) {
                return {
                    valid: false,
                    message: `⚠️ يوجد تداخل مع حجز آخر!\nالحجز الموجود: ${booking.bookingTime} - ${booking.endTime} (${booking.customerName})\nيرجى اختيار وقت بعد ${booking.endTime}`
                };
            }
        }
        
        return { valid: true, endTime };
        
    } catch (error) {
        console.error("خطأ في التحقق:", error);
        return {
            valid: false,
            message: '❌ حدث خطأ في التحقق من الأوقات'
        };
    }
}

function timeToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}

async function addNewBooking(e) {
    e.preventDefault();
    
    const customerType = document.getElementById('customerType').value;
    const bookingTime = document.getElementById('bookingTime').value;
    const totalCost = parseFloat(document.getElementById('totalCost').textContent);
    const totalDuration = parseInt(document.getElementById('totalDuration').textContent);
    
    if (selectedServices.length === 0) {
        alert('⚠️ يرجى اختيار الخدمات!');
        return;
    }
    
    if (!bookingTime) {
        alert('⚠️ يرجى تحديد وقت الحجز!');
        return;
    }
    
    const validation = await validateBookingTime(currentDate, bookingTime, totalDuration);
    if (!validation.valid) {
        alert(validation.message);
        return;
    }
    
    const endTime = validation.endTime;
    
    try {
        let customerId, customerName, customerPhone, isNewCustomer = false;
        
        if (customerType === 'new') {
            customerName = document.getElementById('newCustomerName').value.trim();
            customerPhone = document.getElementById('newCustomerPhone').value.trim();
            
            if (!customerName || !customerPhone) {
                alert('⚠️ يرجى إدخال اسم ورقم هاتف العميل!');
                return;
            }
            
            customerId = null;
            isNewCustomer = true;
            
        } else {
            if (!selectedCustomer) {
                alert('⚠️ يرجى اختيار عميل!');
                return;
            }
            
            customerId = selectedCustomer.id;
            customerName = selectedCustomer.name;
            customerPhone = selectedCustomer.phone;
        }
        
        const bookingData = {
            customerId,
            customerName,
            customerPhone,
            doctorId: currentDoctorId,
            doctorName: currentDoctorName,
            bookingDate: Timestamp.fromDate(new Date(currentDate + 'T00:00:00')),
            bookingTime,
            endTime,
            services: selectedServices.map(s => ({
                id: s.id,
                name: s.name,
                duration: s.duration,
                price: s.price
            })),
            totalCost,
            totalDuration,
            status: 'pending',
            isNewCustomer,
            createdAt: Timestamp.now(),
            createdBy: currentUser.name
        };
        
        console.log('💾 حفظ حجز جديد:', bookingData);
        
        await addDoc(collection(db, "bookings"), bookingData);
        
        try {
            const shiftModule = await import('../shift-management/shift-management.js');
            if (shiftModule && shiftModule.addShiftAction) {
                await shiftModule.addShiftAction('إضافة حجز', `تم إضافة حجز لـ ${customerName} - ${selectedServices.length} خدمة - ${totalCost.toFixed(2)} جنيه`);
            }
        } catch (err) {
            console.log('لا يمكن تسجيل في الشيفت:', err);
        }
        
        alert('✅ تم إضافة الحجز بنجاح!');
        hideAddBookingModal();
        
    } catch (error) {
        console.error("خطأ في إضافة الحجز:", error);
        alert('❌ حدث خطأ: ' + error.message);
    }
}

window.confirmBooking = async function(bookingId, isNewCustomer, bookingData) {
    console.log('✅ تأكيد الحجز:', bookingId, 'عميل جديد:', isNewCustomer);
    
    const bookingRef = doc(db, "bookings", bookingId);
    const bookingSnap = await getDoc(bookingRef);
    const booking = bookingSnap.data();
    
    if (isNewCustomer && !booking.customerId) {
        showPaymentModalForNewCustomer(bookingId, booking);
    } else {
        if (!confirm('هل تريد تأكيد هذا الحجز والدفع؟')) return;
        
        try {
            const customerRef = doc(db, "customers", booking.customerId);
            const customerSnap = await getDoc(customerRef);
            const currentBalance = customerSnap.data().balance || 0;
            
            if (currentBalance < booking.totalCost) {
                if (!confirm(`⚠️ الرصيد غير كافٍ!\nالرصيد: ${currentBalance.toFixed(2)} جنيه\nالمطلوب: ${booking.totalCost.toFixed(2)} جنيه\nهل تريد المتابعة؟`)) {
                    return;
                }
            }
            
            const newBalance = currentBalance - booking.totalCost;
            await updateDoc(customerRef, {
                balance: newBalance,
                totalSpent: (customerSnap.data().totalSpent || 0) + booking.totalCost,
                updatedAt: Timestamp.now()
            });
            
            await addDoc(collection(db, "transactions"), {
                customerId: booking.customerId,
                customerName: booking.customerName,
                type: 'withdrawal',
                amount: booking.totalCost,
                previousBalance: currentBalance,
                newBalance,
                paymentMethod: 'رصيد داخلي',
                services: booking.services,
                bookingDate: booking.bookingDate,
                notes: `حجز خدمات - ${booking.services.map(s => s.name).join(', ')} - يوم ${new Date(booking.bookingDate.toDate()).toLocaleDateString('ar-EG')}`,
                createdAt: Timestamp.now(),
                createdBy: currentUser.name
            });
            
            await updateDoc(bookingRef, {
                status: 'confirmed',
                confirmedAt: Timestamp.now(),
                confirmedBy: currentUser.name
            });
            
            try {
                const shiftModule = await import('../shift-management/shift-management.js');
                if (shiftModule && shiftModule.addShiftAction) {
                    await shiftModule.addShiftAction('تأكيد حجز', `تأكيد حجز ${booking.customerName} - ${booking.totalCost.toFixed(2)} جنيه`);
                }
            } catch (e) {
                console.log('لا يمكن تسجيل في الشيفت:', e);
            }
            
            alert('✅ تم تأكيد الحجز وخصم المبلغ بنجاح!');
            
        } catch (error) {
            console.error("خطأ في تأكيد الحجز:", error);
            alert('❌ حدث خطأ: ' + (error.message || error));
        }
    }
};

function showPaymentModalForNewCustomer(bookingId, booking) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'paymentModal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>💳 شحن رصيد العميل الجديد</h3>
                <button class="close-btn" onclick="document.getElementById('paymentModal').remove()">✕</button>
            </div>
            <div class="modal-body">
                <div class="customer-payment-info">
                    <p><strong>العميل:</strong> ${booking.customerName}</p>
                    <p><strong>الهاتف:</strong> ${booking.customerPhone}</p>
                    <p><strong>المبلغ المطلوب:</strong> ${booking.totalCost.toFixed(2)} جنيه</p>
                    <p><strong>الخدمات:</strong> ${booking.services.map(s => s.name).join(', ')}</p>
                </div>
                
                <div class="input-group">
                    <label>مبلغ الدفع:</label>
                    <input type="number" id="paymentAmount" step="0.01" min="0" value="${booking.totalCost.toFixed(2)}" required>
                </div>
                
                <div class="input-group">
                    <label>طريقة الدفع:</label>
                    <select id="paymentMethod" required>
                        <option value="نقدي">نقدي</option>
                        <option value="كاش">كاش</option>
                        <option value="فيزا">فيزا</option>
                    </select>
                </div>
            </div>
            <div class="modal-footer">
                <button class="save-btn" onclick="processNewCustomerPayment('${bookingId}')">تأكيد الدفع وإنشاء الحساب</button>
                <button class="cancel-btn" onclick="document.getElementById('paymentModal').remove()">إلغاء</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

window.processNewCustomerPayment = async function(bookingId) {
    const amount = parseFloat(document.getElementById('paymentAmount').value);
    const paymentMethod = document.getElementById('paymentMethod').value;
    
    if (!amount || amount <= 0) {
        alert('⚠️ أدخل مبلغ صحيح!');
        return;
    }
    
    try {
        const bookingRef = doc(db, "bookings", bookingId);
        const bookingSnap = await getDoc(bookingRef);
        const booking = bookingSnap.data();
        
        const phoneKey = booking.customerPhone.replace(/\s+/g, '');
        
        const customerId = await runTransaction(db, async (transaction) => {
            const counterRef = doc(db, "counters", "customersCounter");
            const phoneRef = doc(db, "customers_by_phone", phoneKey);
            
            const phoneSnap = await transaction.get(phoneRef);
            if (phoneSnap.exists()) {
                throw new Error('رقم الهاتف مسجل مسبقاً!');
            }
            
            const counterSnap = await transaction.get(counterRef);
            let nextSeq = 1;
            
            if (!counterSnap.exists()) {
                transaction.set(counterRef, { seq: 1, createdAt: Timestamp.now() });
            } else {
                nextSeq = (counterSnap.data().seq || 0) + 1;
                transaction.update(counterRef, { seq: nextSeq });
            }
            
            const docIdString = String(nextSeq);
            const customerRef = doc(db, "customers", docIdString);
            
            transaction.set(customerRef, {
                id: nextSeq,
                docId: docIdString,
                name: booking.customerName,
                phone: phoneKey,
                balance: amount - booking.totalCost,
                totalSpent: booking.totalCost,
                visitCount: 0,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            });
            
            transaction.set(phoneRef, {
                customerDocId: docIdString,
                createdAt: Timestamp.now()
            });
            
            return docIdString;
        });
        
        await addDoc(collection(db, "transactions"), {
            customerId,
            customerName: booking.customerName,
            type: 'payment',
            amount: booking.totalCost,
            paidAmount: amount,
            previousBalance: 0,
            newBalance: amount - booking.totalCost,
            paymentMethod,
            services: booking.services,
            bookingDate: booking.bookingDate,
            isNewCustomer: true,
            notes: `دفع مقابل خدمات - ${booking.services.map(s => s.name).join(', ')} - يوم ${new Date(booking.bookingDate.toDate()).toLocaleDateString('ar-EG')}`,
            createdAt: Timestamp.now(),
            createdBy: currentUser.name
        });
        
        await updateDoc(bookingRef, {
            customerId,
            status: 'confirmed',
            isNewCustomer: false,
            paidAmount: amount,
            paymentMethod,
            confirmedAt: Timestamp.now(),
            confirmedBy: currentUser.name
        });
        
        try {
            const shiftModule = await import('../shift-management/shift-management.js');
            if (shiftModule && shiftModule.addShiftAction) {
                await shiftModule.addShiftAction('تأكيد حجز عميل جديد', `تم إنشاء حساب لـ ${booking.customerName} ودفع ${amount.toFixed(2)} جنيه مقابل ${booking.services.length} خدمة`);
                await shiftModule.addShiftAction('إضافة عميل', `تم إضافة العميل ${booking.customerName} - رقم ${customerId}`);
            }
        } catch (e) {
            console.log('لا يمكن تسجيل في الشيفت:', e);
        }
        
        alert(`✅ تم إنشاء الحساب بنجاح!\nرقم العميل: ${customerId}\nتم الدفع والتأكيد.`);
        document.getElementById('paymentModal').remove();
        
    } catch (error) {
        console.error("خطأ في المعالجة:", error);
        alert('❌ حدث خطأ: ' + (error.message || error));
    }
};

window.startSession = async function(bookingId) {
    console.log('▶️ بدء جلسة:', bookingId);
    
    if (!confirm('هل تريد بدء الجلسة؟')) return;
    
    try {
        const bookingRef = doc(db, "bookings", bookingId);
        const bookingSnap = await getDoc(bookingRef);
        const booking = bookingSnap.data();
        
        await updateDoc(bookingRef, {
            status: 'started',
            startedAt: Timestamp.now(),
            startedBy: currentUser.name
        });
        
        const customerRef = doc(db, "customers", booking.customerId);
        const customerSnap = await getDoc(customerRef);
        const currentVisits = customerSnap.data().visitCount || 0;
        
        await updateDoc(customerRef, {
            visitCount: currentVisits + 1,
            updatedAt: Timestamp.now()
        });
        
        await addDoc(collection(db, "visits"), {
            customerId: booking.customerId,
            customerName: booking.customerName,
            visitDate: Timestamp.now(),
            doctorId: booking.doctorId,
            doctorName: booking.doctorName,
            services: booking.services,
            amount: booking.totalCost,
            bookingId,
            notes: `زيارة من خلال حجز - ${booking.services.map(s => s.name).join(', ')}`,
            createdAt: Timestamp.now(),
            createdBy: currentUser.name
        });
        
        try {
            const shiftModule = await import('../shift-management/shift-management.js');
            if (shiftModule && shiftModule.addShiftAction) {
                await shiftModule.addShiftAction('بدء جلسة', `بدأت جلسة ${booking.customerName} - ${booking.doctorName}`);
            }
        } catch (e) {
            console.log('لا يمكن تسجيل في الشيفت:', e);
        }
        
        alert('✅ تم بدء الجلسة وتسجيل الزيارة!');
    } catch (error) {
        console.error("خطأ في بدء الجلسة:", error);
        alert('❌ حدث خطأ في بدء الجلسة');
    }
};

window.completeSession = async function(bookingId) {
    console.log('✔️ إنهاء جلسة:', bookingId);
    
    if (!confirm('هل تريد إنهاء الجلسة؟')) return;
    
    try {
        await updateDoc(doc(db, "bookings", bookingId), {
            status: 'completed',
            completedAt: Timestamp.now(),
            completedBy: currentUser.name
        });
        
        try {
            const shiftModule = await import('../shift-management/shift-management.js');
            if (shiftModule && shiftModule.addShiftAction) {
                const bookingSnap = await getDoc(doc(db, "bookings", bookingId));
                const booking = bookingSnap.data();
                await shiftModule.addShiftAction('إنهاء جلسة', `أنهيت جلسة ${booking.customerName}`);
            }
        } catch (e) {
            console.log('لا يمكن تسجيل في الشيفت:', e);
        }
        
        alert('✅ تم إنهاء الجلسة بنجاح!');
    } catch (error) {
        console.error("خطأ في إنهاء الجلسة:", error);
        alert('❌ حدث خطأ في إنهاء الجلسة');
    }
};

window.showCancelModal = function(bookingId, isNewCustomer) {
    console.log('❌ عرض مودال إلغاء:', bookingId);
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>إلغاء الحجز</h3>
                <button class="close-btn" onclick="this.closest('.modal').remove()">✕</button>
            </div>
            <div class="modal-body">
                <p>اختر سبب الإلغاء:</p>
                <div class="cancel-reasons">
                    <label><input type="radio" name="cancelReason" value="العميل مردش"> العميل مردش</label>
                    <label><input type="radio" name="cancelReason" value="العميل مجاش"> العميل مجاش</label>
                    <label><input type="radio" name="cancelReason" value="other"> سبب آخر</label>
                </div>
                <textarea id="otherReason" class="hidden" placeholder="اكتب السبب..."></textarea>
            </div>
            <div class="modal-footer">
                <button class="save-btn" onclick="executeCancelBooking('${bookingId}', ${isNewCustomer})">تأكيد الإلغاء</button>
                <button class="cancel-btn" onclick="this.closest('.modal').remove()">إلغاء</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelectorAll('input[name="cancelReason"]').forEach(radio => {
        radio.addEventListener('change', function() {
            document.getElementById('otherReason').classList.toggle('hidden', this.value !== 'other');
        });
    });
};

window.executeCancelBooking = async function(bookingId, isNewCustomer) {
    console.log('🗑️ تنفيذ إلغاء الحجز:', bookingId);
    
    const selectedReason = document.querySelector('input[name="cancelReason"]:checked');
    if (!selectedReason) {
        alert('⚠️ يرجى اختيار سبب الإلغاء');
        return;
    }
    
    let reason = selectedReason.value;
    if (reason === 'other') {
        reason = document.getElementById('otherReason').value.trim();
        if (!reason) {
            alert('⚠️ يرجى كتابة السبب');
            return;
        }
    }
    
    try {
        const bookingRef = doc(db, "bookings", bookingId);
        const bookingSnap = await getDoc(bookingRef);
        const booking = bookingSnap.data();
        
        if (!isNewCustomer && booking.status === 'confirmed' && booking.customerId) {
            const customerRef = doc(db, "customers", booking.customerId);
            const customerSnap = await getDoc(customerRef);
            const currentBalance = customerSnap.data().balance || 0;
            const newBalance = currentBalance + booking.totalCost;
            
            await updateDoc(customerRef, {
                balance: newBalance,
                updatedAt: Timestamp.now()
            });
            
            await addDoc(collection(db, "transactions"), {
                customerId: booking.customerId,
                customerName: booking.customerName,
                type: 'refund',
                amount: booking.totalCost,
                previousBalance: currentBalance,
                newBalance,
                paymentMethod: 'إرجاع',
                notes: `إرجاع مبلغ حجز ملغي - السبب: ${reason}`,
                createdAt: Timestamp.now(),
                createdBy: currentUser.name
            });
        }
        
        await updateDoc(bookingRef, {
            status: 'cancelled',
            cancelReason: reason,
            cancelledAt: Timestamp.now(),
            cancelledBy: currentUser.name
        });
        
        try {
            const shiftModule = await import('../shift-management/shift-management.js');
            if (shiftModule && shiftModule.addShiftAction) {
                await shiftModule.addShiftAction('إلغاء حجز', `تم إلغاء حجز ${booking.customerName} - السبب: ${reason}`);
            }
        } catch (e) {
            console.log('لا يمكن تسجيل في الشيفت:', e);
        }
        
        alert('✅ تم إلغاء الحجز' + (!isNewCustomer && booking.status === 'confirmed' ? ' وإرجاع المبلغ!' : '!'));
        document.querySelector('.modal').remove();
        
    } catch (error) {
        console.error("خطأ في إلغاء الحجز:", error);
        alert('❌ حدث خطأ في الإلغاء');
    }
};

function debounce(fn, wait) {
    let t;
    return (...a) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...a), wait);
    };
}

window.addEventListener('beforeunload', () => {
    if (unsubscribeBookings) {
        unsubscribeBookings();
    }
    if (unsubscribeAlerts) {
        unsubscribeAlerts();
    }
});

console.log('✅ تم تحميل doctor-schedule.js');