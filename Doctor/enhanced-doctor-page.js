// enhanced-doctor-page.js - النسخة المحسّنة مع نظام التقارير التفصيلية
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    getDocs,
    doc,
    getDoc,
    updateDoc,
    addDoc,
    query,
    where,
    orderBy,
    Timestamp,
    onSnapshot,
    increment
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
// ✅ تم إزالة الاستيراد - هنستخدم دالة محلية
import { checkUserRole } from '../shared/auth.js';

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
const auth = getAuth(app);
const db = getFirestore(app);

let currentDoctorId = null;
let currentDoctorName = null;
let bookingsListener = null;
let allServices = [];
let allInventory = [];
let currentBookingForService = null;
let selectedServiceForAdd = null;
let currentReportData = null;

console.log('🚀 بدء تحميل صفحة الدكتور...');

// ✅ دالة محسّنة للتحقق من الشيفت النشط
async function checkDoctorActiveShift() {
    try {
        console.log('🔍 بدء التحقق من الشيفت النشط...');
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        console.log('📅 البحث عن شيفتات بين:', today, 'و', tomorrow);

        const q = query(
            collection(db, "shifts"),
            where("startTime", ">=", Timestamp.fromDate(today)),
            where("startTime", "<", Timestamp.fromDate(tomorrow)),
            where("status", "==", "active")
        );

        const querySnapshot = await getDocs(q);
        
        console.log('📊 عدد الشيفتات النشطة:', querySnapshot.size);
        
        if (querySnapshot.empty) {
            console.log('❌ لا يوجد أي شيفت نشط اليوم');
            return false;
        }

        // ✅ طباعة تفاصيل الشيفتات الموجودة
        querySnapshot.forEach(doc => {
            const shift = doc.data();
            console.log('✅ تم العثور على شيفت نشط:', {
                id: doc.id,
                userName: shift.userName,
                userId: shift.userId,
                shiftType: shift.shiftType,
                status: shift.status,
                startTime: shift.startTime?.toDate()
            });
        });

        console.log('✅ يوجد شيفت نشط - السماح بالدخول');
        return true;
    } catch (error) {
        console.error("❌ خطأ في التحقق من الشيفت:", error);
        console.error("تفاصيل الخطأ:", error.message);
        console.error("Stack:", error.stack);
        return false;
    }
}

// التحقق من صلاحية الدكتور
checkUserRole().then(async userData => {
    if (userData && (userData.role === 'doctor' || userData.role === 'skin_doctor' || userData.role === 'admin')) {
        document.getElementById('userName').textContent = userData.name;
        currentDoctorId = userData.uid;
        currentDoctorName = userData.name;
        
        console.log('✅ تم تسجيل الدخول:', currentDoctorName);
        
        // ✅ التحقق من الشيفت النشط (ماعدا الأدمن)
        if (userData.role !== 'admin') {
            const hasActiveShift = await checkDoctorActiveShift();
            
            if (!hasActiveShift) {
                alert('❌ لا يمكن الوصول إلى هذه الصفحة إلا أثناء شيفت نشط!\n\nيرجى بدء الشيفت من صفحة إدارة الشيفتات.');
                window.location.href = '../shift-management/shift-management.html';
                return;
            }
        }
        
        await loadServices();
        await loadInventory();
        await initializeShiftAndBookings();
    } else {
        alert('❌ ليس لديك صلاحية للوصول إلى هذه الصفحة!');
        window.location.href = '../main.html';
    }
});

// تحميل الخدمات
async function loadServices() {
    try {
        const snapshot = await getDocs(collection(db, "services"));
        allServices = [];
        snapshot.forEach(doc => {
            allServices.push({ id: doc.id, ...doc.data() });
        });
        console.log('✅ تم تحميل', allServices.length, 'خدمة');
    } catch (error) {
        console.error("❌ خطأ في تحميل الخدمات:", error);
    }
}

// تحميل المخزون
async function loadInventory() {
    try {
        const snapshot = await getDocs(collection(db, "inventory"));
        allInventory = [];
        snapshot.forEach(doc => {
            allInventory.push({ id: doc.id, ...doc.data() });
        });
        console.log('✅ تم تحميل', allInventory.length, 'منتج من المخزون');
    } catch (error) {
        console.error("❌ خطأ في تحميل المخزون:", error);
    }
}

// تهيئة الشيفت والحجوزات
async function initializeShiftAndBookings() {
    console.log('🔧 تهيئة الشيفت والحجوزات...');
    
    // ✅ استخدام دالة التحقق المحلية
    const hasActiveShift = await checkDoctorActiveShift();
    updateUI(hasActiveShift);
    
    if (hasActiveShift) {
        await setupRealtimeBookings();
    }
    
    // ✅ الاستماع للتغييرات في الوقت الفعلي
    listenToShiftChanges();
}

// ✅ دالة للاستماع لتغييرات الشيفت في الوقت الفعلي
function listenToShiftChanges() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const q = query(
        collection(db, "shifts"),
        where("startTime", ">=", Timestamp.fromDate(today)),
        where("startTime", "<", Timestamp.fromDate(tomorrow)),
        where("status", "==", "active")
    );

    onSnapshot(q, (snapshot) => {
        const hasShift = !snapshot.empty;
        console.log('🔄 تحديث حالة الشيفت:', hasShift);
        updateUI(hasShift);
        
        if (hasShift && !bookingsListener) {
            setupRealtimeBookings();
        } else if (!hasShift && bookingsListener) {
            bookingsListener();
            bookingsListener = null;
        }
    });
}

// إعداد الاستماع للحجوزات
async function setupRealtimeBookings() {
    console.log('👂 بدء الاستماع للحجوزات...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const q = query(
        collection(db, "bookings"),
        where("doctorId", "==", currentDoctorId),
        where("bookingDate", ">=", Timestamp.fromDate(today)),
        where("bookingDate", "<", Timestamp.fromDate(tomorrow)),
        where("status", "in", ["confirmed", "started", "pending_payment"]),
        orderBy("bookingDate"),
        orderBy("bookingTime")
    );

    if (bookingsListener) bookingsListener();

    bookingsListener = onSnapshot(q, (snapshot) => {
        const bookings = [];
        let hasNewStartedSession = false;
        
        snapshot.docChanges().forEach((change) => {
            if (change.type === "modified") {
                const data = change.doc.data();
                if (data.status === 'started') {
                    hasNewStartedSession = true;
                }
            }
        });

        snapshot.forEach(doc => {
            bookings.push({ id: doc.id, ...doc.data() });
        });

        console.log('📋 تم جلب', bookings.length, 'حجز');
        displayBookings(bookings);

        if (hasNewStartedSession) {
            playBeepSound();
        }
    }, (error) => {
        console.error('❌ خطأ في الاستماع للحجوزات:', error);
    });
}

// عرض الحجوزات
async function displayBookings(bookings) {
    const grid = document.getElementById('bookingsGrid');
    if (!grid) return;

    if (bookings.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 64px; margin-bottom: 20px;">📅</div>
                <h3>لا توجد حجوزات لليوم</h3>
                <p>لا توجد حجوزات مؤكدة أو نشطة في الوقت الحالي</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = '';

    for (const booking of bookings) {
        const card = await createBookingCard(booking);
        grid.appendChild(card);
    }
}

// إنشاء بطاقة حجز
async function createBookingCard(booking) {
    const card = document.createElement('div');
    card.className = `booking-card status-${booking.status}`;

    const services = booking.services || [];
    const additionalServices = booking.additionalServices || [];
    
    // ✅ بناء HTML للخدمات الأصلية مع أزرار التقارير
    let servicesHTML = '';
    for (let i = 0; i < services.length; i++) {
        const service = services[i];
        servicesHTML += await createServiceItemHTML(service, booking, false);
    }
    
    // ✅ بناء HTML للخدمات الإضافية مع أزرار التقارير
    let additionalServicesHTML = '';
    if (additionalServices.length > 0) {
        const unpaidServices = additionalServices.filter(s => !s.paid);
        const paidServices = additionalServices.filter(s => s.paid);
        
        if (unpaidServices.length > 0) {
            additionalServicesHTML += `
                <div class="unpaid-services">
                    <strong>⚠️ خدمات إضافية غير مدفوعة (${unpaidServices.length}):</strong>
            `;
            for (const service of unpaidServices) {
                additionalServicesHTML += await createServiceItemHTML(service, booking, true);
            }
            additionalServicesHTML += `</div>`;
        }
        
        if (paidServices.length > 0) {
            additionalServicesHTML += `
                <div class="services-list" style="margin-top: 10px;">
                    <strong>✅ خدمات إضافية مدفوعة (${paidServices.length}):</strong>
            `;
            for (const service of paidServices) {
                additionalServicesHTML += await createServiceItemHTML(service, booking, true);
            }
            additionalServicesHTML += `</div>`;
        }
    }

    // ✅ دالة مساعدة لإنشاء عنصر الخدمة مع زر التفاصيل
    async function createServiceItemHTML(service, booking, isAdditional = false) {
        const serviceName = isAdditional ? service.serviceName : service.name;
        const serviceDuration = isAdditional ? service.duration : service.duration;
        const servicePrice = isAdditional ? service.price : service.price;
        
        // جلب التقرير الخاص بهذه الخدمة
        const reportQuery = query(
            collection(db, "serviceReports"),
            where("bookingId", "==", booking.id),
            where("serviceName", "==", serviceName)
        );
        const reportSnapshot = await getDocs(reportQuery);
        
        const hasReport = !reportSnapshot.empty;
        const buttonClass = hasReport ? 'add-details-btn has-report' : 'add-details-btn';
        const buttonText = hasReport ? '📋 عرض التفاصيل' : '➕ إضافة التفاصيل';
        
        const serviceTypeBadge = isAdditional ? '<span class="additional-service-badge">➕</span>' : '';
        
        return `
            <div class="service-item">
                <div class="service-item-content">
                    ${serviceTypeBadge} 📌 ${serviceName} (${serviceDuration} دقيقة - ${servicePrice.toFixed(2)} جنيه)
                </div>
                ${(booking.status === 'started' || booking.status === 'pending_payment') ? `
                    <button class="${buttonClass}" onclick="openServiceReport('${booking.id}', '${booking.customerId}', '${serviceName}', ${hasReport})">
                        ${buttonText}
                    </button>
                ` : ''}
            </div>
        `;
    }

    // ✅ تحديث قسم الأزرار
    let actionsHTML = '';

    if (booking.status === 'confirmed') {
        actionsHTML = `
            <button class="action-btn history" onclick="viewCustomerHistory('${booking.customerId}')">
                📋 سجل الزيارات
            </button>
            <button class="action-btn start" onclick="startSession('${booking.id}')">
                ▶️ بدء الجلسة
            </button>
        `;
    } else if (booking.status === 'started' || booking.status === 'pending_payment') {
        const sessionTime = booking.startedAt ? formatTimeSince(booking.startedAt.toDate()) : '00:00:00';
        
        let warningBadge = '';
        if (booking.status === 'pending_payment') {
            warningBadge = '<div class="pending-payment-badge">⚠️ يوجد خدمات إضافية غير مدفوعة - يمكن إنهاء الجلسة</div>';
        }
        
        actionsHTML = `
            <div class="session-timer">⏱️ ${sessionTime}</div>
            ${warningBadge}
            <button class="action-btn add-service" onclick="showAddServiceModal('${booking.id}', '${booking.customerId}')">
                ➕ إضافة خدمة
            </button>
            <button class="action-btn inventory" onclick="showInventoryModal('${booking.id}')">
                📦 المخزون
            </button>
            <button class="action-btn end" onclick="endSession('${booking.id}')">
                ⏹️ إنهاء الجلسة
            </button>
        `;
    }

    const statusLabels = {
        'confirmed': '⏳ مؤكد',
        'started': '🟢 نشط',
        'pending_payment': '⚠️ نشط - خدمات غير مدفوعة'
    };

    card.innerHTML = `
        <div class="booking-header">
            <div class="booking-time">⏰ ${booking.bookingTime}</div>
            <div class="booking-status ${booking.status}">
                ${statusLabels[booking.status] || booking.status}
            </div>
        </div>

        <div class="customer-info">
            <h3>👤 ${booking.customerName}</h3>
            <p>📱 ${booking.customerPhone || 'غير محدد'}</p>
        </div>

        <div class="services-list">
            <strong>الخدمات المحجوزة (${services.length}):</strong>
            ${servicesHTML}
        </div>

        ${additionalServicesHTML}

        <div class="booking-meta">
            <div>💰 التكلفة: <strong>${(booking.totalCost || 0).toFixed(2)} جنيه</strong></div>
            <div>⏱️ المدة: <strong>${booking.totalDuration || 0} دقيقة</strong></div>
            <div>👤 تم الحجز بواسطة: <strong>${booking.createdBy || 'غير محدد'}</strong></div>
        </div>

        <div class="booking-actions">
            ${actionsHTML}
        </div>
    `;

    // تحديث المؤقت للجلسات النشطة
    if ((booking.status === 'started' || booking.status === 'pending_payment') && booking.startedAt) {
        setInterval(() => {
            const timer = card.querySelector('.session-timer');
            if (timer) {
                timer.textContent = '⏱️ ' + formatTimeSince(booking.startedAt.toDate());
            }
        }, 1000);
    }

    return card;
}

// باقي الدوال تبقى كما هي بدون تغيير
// [نفس الكود السابق لبقية الدوال...]

// فتح نموذج التقرير
window.openServiceReport = async function(bookingId, customerId, serviceName, hasReport) {
    try {
        // جلب بيانات الحجز والعميل
        const bookingDoc = await getDoc(doc(db, "bookings", bookingId));
        const customerDoc = await getDoc(doc(db, "customers", customerId));
        
        if (!bookingDoc.exists() || !customerDoc.exists()) {
            alert('❌ بيانات غير صحيحة!');
            return;
        }
        
        const bookingData = bookingDoc.data();
        const customerData = customerDoc.data();
        
        if (hasReport) {
            // عرض التقرير الموجود
            const reportQuery = query(
                collection(db, "serviceReports"),
                where("bookingId", "==", bookingId),
                where("serviceName", "==", serviceName)
            );
            const reportSnapshot = await getDocs(reportQuery);
            
            if (!reportSnapshot.empty) {
                const report = reportSnapshot.docs[0].data();
                
                // ملء النموذج بالبيانات الموجودة
                document.getElementById('reportPatientName').value = report.customerName;
                document.getElementById('reportPatientPhone').value = report.customerPhone;
                document.getElementById('reportDate').value = report.sessionDate;
                document.getElementById('reportTime').value = report.sessionTime;
                document.getElementById('reportSessionNumber').value = report.sessionNumber;
                document.getElementById('reportSessionType').value = report.sessionType;
                document.getElementById('reportPulseCount').value = report.pulseCount || '';
                document.getElementById('reportPower').value = report.power || '';
                document.getElementById('reportPulseDuration').value = report.pulseDuration || '';
                document.getElementById('reportSpotSize').value = report.spotSize || '';
                document.getElementById('reportSkinType').value = report.skinType || '';
                document.getElementById('reportNotes').value = report.notes || '';
                
                // جعل الحقول للقراءة فقط
                document.querySelectorAll('#serviceReportForm input, #serviceReportForm select, #serviceReportForm textarea').forEach(el => {
                    el.setAttribute('readonly', true);
                    el.setAttribute('disabled', true);
                });
                
                currentReportData = {
                    isViewing: true,
                    reportId: reportSnapshot.docs[0].id
                };
            }
        } else {
            // إنشاء تقرير جديد
            const now = new Date();
            const sessionDate = bookingData.startedAt ? bookingData.startedAt.toDate() : now;
            
            document.getElementById('reportPatientName').value = customerData.name;
            document.getElementById('reportPatientPhone').value = customerData.phone || '';
            document.getElementById('reportDate').value = sessionDate.toISOString().split('T')[0];
            document.getElementById('reportTime').value = sessionDate.toTimeString().slice(0, 5);
            document.getElementById('reportSessionNumber').value = `SESS-${Date.now()}`;
            document.getElementById('reportSessionType').value = serviceName;
            document.getElementById('reportPulseCount').value = '';
            document.getElementById('reportPower').value = '';
            document.getElementById('reportPulseDuration').value = '';
            document.getElementById('reportSpotSize').value = '';
            document.getElementById('reportSkinType').value = '';
            document.getElementById('reportNotes').value = '';
            
            // إزالة readonly من الحقول
            document.querySelectorAll('#serviceReportForm input, #serviceReportForm select, #serviceReportForm textarea').forEach(el => {
                el.removeAttribute('readonly');
                el.removeAttribute('disabled');
            });
            
            // جعل الاسم والهاتف للقراءة فقط
            document.getElementById('reportPatientName').setAttribute('readonly', true);
            document.getElementById('reportSessionType').setAttribute('readonly', true);
            
            currentReportData = {
                isViewing: false,
                bookingId,
                customerId,
                customerName: customerData.name,
                customerPhone: customerData.phone,
                serviceName
            };
        }
        
        document.getElementById('serviceReportModal').classList.remove('hidden');
        
    } catch (error) {
        console.error("❌ خطأ في فتح نموذج التقرير:", error);
        alert('❌ حدث خطأ في تحميل البيانات');
    }
};

// حفظ التقرير
window.saveServiceReport = async function() {
    if (!currentReportData || currentReportData.isViewing) {
        alert('⚠️ لا يمكن تعديل التقرير الحالي');
        return;
    }
    
    try {
        const reportData = {
            bookingId: currentReportData.bookingId,
            customerId: currentReportData.customerId,
            customerName: currentReportData.customerName,
            customerPhone: document.getElementById('reportPatientPhone').value,
            serviceName: currentReportData.serviceName,
            sessionDate: document.getElementById('reportDate').value,
            sessionTime: document.getElementById('reportTime').value,
            sessionNumber: document.getElementById('reportSessionNumber').value,
            sessionType: document.getElementById('reportSessionType').value,
            pulseCount: parseInt(document.getElementById('reportPulseCount').value) || 0,
            power: document.getElementById('reportPower').value,
            pulseDuration: document.getElementById('reportPulseDuration').value,
            spotSize: document.getElementById('reportSpotSize').value,
            skinType: document.getElementById('reportSkinType').value,
            notes: document.getElementById('reportNotes').value,
            doctorId: currentDoctorId,
            doctorName: currentDoctorName,
            createdAt: Timestamp.now(),
            createdBy: currentDoctorName
        };
        
        // التحقق من الحقول المطلوبة
        if (!reportData.sessionDate || !reportData.sessionTime || !reportData.sessionNumber) {
            alert('⚠️ يرجى ملء جميع الحقول المطلوبة!');
            return;
        }
        
        await addDoc(collection(db, "serviceReports"), reportData);
        
        alert('✅ تم حفظ التقرير بنجاح!');
        closeServiceReportModal();
        
        // إعادة تحميل الحجوزات لتحديث الأزرار
        await setupRealtimeBookings();
        
    } catch (error) {
        console.error("❌ خطأ في حفظ التقرير:", error);
        alert('❌ حدث خطأ أثناء حفظ التقرير: ' + error.message);
    }
};

// إغلاق نموذج التقرير
window.closeServiceReportModal = function() {
    document.getElementById('serviceReportModal').classList.add('hidden');
    currentReportData = null;
    document.getElementById('serviceReportForm').reset();
};

// عرض مودال إضافة خدمة
window.showAddServiceModal = async function(bookingId, customerId) {
    currentBookingForService = { bookingId, customerId };
    
    try {
        const customerRef = doc(db, "customers", customerId);
        const customerSnap = await getDoc(customerRef);
        const customerData = customerSnap.data();
        
        const bookingRef = doc(db, "bookings", bookingId);
        const bookingSnap = await getDoc(bookingRef);
        const bookingData = bookingSnap.data();
        
        const customerInfoBox = document.getElementById('serviceCustomerInfo');
        customerInfoBox.innerHTML = `
            <h3>معلومات العميل</h3>
            <div class="customer-info-grid">
                <div>
                    <span>الاسم:</span>
                    <span>${customerData.name}</span>
                </div>
                <div>
                    <span>الهاتف:</span>
                    <span>${customerData.phone}</span>
                </div>
                <div>
                    <span>الرصيد الحالي:</span>
                    <span class="${customerData.balance > 0 ? 'balance-positive' : 'balance-negative'}">
                        ${customerData.balance.toFixed(2)} جنيه
                    </span>
                </div>
            </div>
        `;
        
        const servicesList = document.getElementById('servicesList');
        servicesList.innerHTML = '';
        
        allServices.forEach(service => {
            const serviceCard = document.createElement('div');
            serviceCard.className = 'item-card';
            serviceCard.onclick = () => selectService(service, customerData.balance);
            
            serviceCard.innerHTML = `
                <div class="item-card-header">
                    <div class="item-name">${service.name}</div>
                    <div class="item-price">${service.price.toFixed(2)} ج.م</div>
                </div>
                <div class="item-details">
                    المدة: ${service.duration} دقيقة
                </div>
            `;
            
            servicesList.appendChild(serviceCard);
        });
        
        document.getElementById('balanceWarning').classList.add('hidden');
        document.getElementById('addServiceModal').classList.remove('hidden');
        
    } catch (error) {
        console.error("❌ خطأ في فتح مودال الخدمة:", error);
        alert('❌ حدث خطأ في تحميل البيانات');
    }
};

// اختيار خدمة
function selectService(service, currentBalance) {
    selectedServiceForAdd = service;
    
    document.querySelectorAll('.item-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    event.currentTarget.classList.add('selected');
    
    const balanceWarning = document.getElementById('balanceWarning');
    
    if (currentBalance < service.price) {
        const deficit = service.price - currentBalance;
        balanceWarning.innerHTML = `
            <h4>⚠️ تحذير: الرصيد غير كافٍ</h4>
            <p>سيتم إرسال تنبيه لموظف الاستقبال لشحن رصيد العميل</p>
            <div class="warning-details">
                <div>
                    <span>المبلغ المطلوب:</span>
                    <strong>${service.price.toFixed(2)} جنيه</strong>
                </div>
                <div>
                    <span>الرصيد الحالي:</span>
                    <strong>${currentBalance.toFixed(2)} جنيه</strong>
                </div>
                <div>
                    <span>النقص:</span>
                    <strong>${deficit.toFixed(2)} جنيه</strong>
                </div>
            </div>
        `;
        balanceWarning.classList.remove('hidden');
    } else {
        balanceWarning.innerHTML = `
            <div class="balance-success">
                <h4>✅ الرصيد كافٍ</h4>
                <p>سيتم خصم المبلغ مباشرة من رصيد العميل</p>
            </div>
        `;
        balanceWarning.classList.remove('hidden');
    }
}

// تأكيد إضافة الخدمة
window.confirmAddService = async function() {
    if (!selectedServiceForAdd || !currentBookingForService) {
        alert('⚠️ يرجى اختيار خدمة أولاً!');
        return;
    }
    
    try {
        const { bookingId, customerId } = currentBookingForService;
        const service = selectedServiceForAdd;
        
        const customerRef = doc(db, "customers", customerId);
        const customerSnap = await getDoc(customerRef);
        const customerData = customerSnap.data();
        const currentBalance = customerData.balance || 0;
        
        const bookingRef = doc(db, "bookings", bookingId);
        const bookingSnap = await getDoc(bookingRef);
        const bookingData = bookingSnap.data();
        
        if (currentBalance >= service.price) {
            const newBalance = currentBalance - service.price;
            
            await updateDoc(customerRef, {
                balance: newBalance,
                totalSpent: increment(service.price),
                updatedAt: Timestamp.now()
            });
            
            await addDoc(collection(db, "transactions"), {
                customerId: customerId,
                customerName: customerData.name,
                type: 'withdrawal',
                amount: service.price,
                previousBalance: currentBalance,
                newBalance: newBalance,
                notes: `خدمة إضافية: ${service.name} - أثناء جلسة مع ${currentDoctorName}`,
                bookingId: bookingId,
                serviceId: service.id,
                createdAt: Timestamp.now(),
                createdBy: currentDoctorName
            });
            
            const additionalServices = bookingData.additionalServices || [];
            additionalServices.push({
                serviceId: service.id,
                serviceName: service.name,
                price: service.price,
                duration: service.duration,
                paid: true,
                paidAt: Timestamp.now(),
                addedBy: currentDoctorName,
                addedAt: Timestamp.now()
            });
            
            await updateDoc(bookingRef, {
                additionalServices: additionalServices,
                totalCost: increment(service.price),
                totalDuration: increment(service.duration),
                updatedAt: Timestamp.now()
            });
            
            alert('✅ تم إضافة الخدمة وخصم المبلغ من الرصيد بنجاح!');
        } else {
            const deficit = service.price - currentBalance;
            
            const additionalServices = bookingData.additionalServices || [];
            additionalServices.push({
                serviceId: service.id,
                serviceName: service.name,
                price: service.price,
                duration: service.duration,
                paid: false,
                addedBy: currentDoctorName,
                addedAt: Timestamp.now()
            });
            
            await updateDoc(bookingRef, {
                additionalServices: additionalServices,
                status: 'pending_payment',
                totalCost: increment(service.price),
                totalDuration: increment(service.duration),
                waitingForPayment: true,
                unpaidAmount: service.price,
                updatedAt: Timestamp.now()
            });
            
            const existingAlertQuery = query(
                collection(db, "receptionAlerts"),
                where("bookingId", "==", bookingId),
                where("serviceId", "==", service.id),
                where("status", "==", "pending")
            );
            const existingAlerts = await getDocs(existingAlertQuery);
            
            if (existingAlerts.empty) {
                await addDoc(collection(db, "receptionAlerts"), {
                    type: 'service_added_needs_payment',
                    stage: 'first_notification',
                    bookingId: bookingId,
                    customerId: customerId,
                    customerName: customerData.name,
                    customerPhone: customerData.phone,
                    doctorId: currentDoctorId,
                    doctorName: currentDoctorName,
                    serviceId: service.id,
                    serviceName: service.name,
                    servicePrice: service.price,
                    currentBalance: currentBalance,
                    deficit: deficit,
                    status: 'pending',
                    notifyUser: bookingData.createdBy || 'reception',
                    message: `جلسة العميلة ${customerData.name} طلبت خدمة ${service.name} سعر الخدمة ${service.price.toFixed(2)} جنيه وليس في رصيدها برجاء انتظار العميلة عند الانتهاء من الجلسة`,
                    createdAt: Timestamp.now(),
                    createdBy: currentDoctorName
                });
                
                alert(`⚠️ الرصيد غير كافٍ!\n\n✅ تم إضافة الخدمة وتغيير حالة الجلسة\n✅ تم إرسال تنبيه لموظف الاستقبال (${bookingData.createdBy})\n\nالمطلوب: ${service.price.toFixed(2)} جنيه\nالرصيد الحالي: ${currentBalance.toFixed(2)} جنيه\nالنقص: ${deficit.toFixed(2)} جنيه`);
            } else {
                alert(`⚠️ تم إضافة الخدمة\n\nتنبيه: يوجد تنبيه سابق لنفس الخدمة`);
            }
        }
        
        closeAddServiceModal();
        
    } catch (error) {
        console.error("❌ خطأ في إضافة الخدمة:", error);
        alert('❌ حدث خطأ أثناء إضافة الخدمة: ' + error.message);
    }
};

// إغلاق مودال إضافة الخدمة
window.closeAddServiceModal = function() {
    document.getElementById('addServiceModal').classList.add('hidden');
    selectedServiceForAdd = null;
    currentBookingForService = null;
};

// فتح المخزون
window.showInventoryModal = async function(bookingId) {
    const productName = prompt('اختر المنتج:\n\n' + 
        allInventory.map((p, i) => `${i+1}. ${p.name} - متوفر: ${p.quantity}`).join('\n') +
        '\n\nأدخل رقم المنتج:');
    
    if (!productName) return;
    
    const index = parseInt(productName) - 1;
    if (index < 0 || index >= allInventory.length) {
        alert('⚠️ رقم غير صحيح!');
        return;
    }
    
    const product = allInventory[index];
    const quantity = prompt(`كم تريد استخدام من ${product.name}؟\n\nالمتاح: ${product.quantity}`, '1');
    
    if (!quantity || parseInt(quantity) <= 0) return;
    
    const qty = parseInt(quantity);
    if (qty > product.quantity) {
        alert('⚠️ الكمية المطلوبة أكبر من المتاح!');
        return;
    }
    
    try {
        const bookingSnap = await getDoc(doc(db, "bookings", bookingId));
        const booking = bookingSnap.data();
        
        await updateDoc(doc(db, "inventory", product.id), {
            quantity: product.quantity - qty,
            updatedAt: Timestamp.now()
        });
        
        await addDoc(collection(db, "inventoryUsage"), {
            bookingId: bookingId,
            customerId: booking.customerId,
            customerName: booking.customerName,
            doctorId: currentDoctorId,
            doctorName: currentDoctorName,
            productId: product.id,
            productName: product.name,
            quantity: qty,
            usedAt: Timestamp.now(),
            createdBy: currentDoctorName
        });
        
        alert('✅ تم تسجيل استخدام المنتج!');
        product.quantity -= qty;
        
    } catch (error) {
        console.error("❌ خطأ في استخدام المنتج:", error);
        alert('❌ حدث خطأ أثناء استخدام المنتج');
    }
};

// تشغيل صوت التنبيه
function playBeepSound() {
    const audio = document.getElementById('beepSound');
    if (audio) {
        audio.play().catch(err => console.log('لا يمكن تشغيل الصوت:', err));
    }
}

// تنسيق الوقت المنقضي
function formatTimeSince(startDate) {
    const now = new Date();
    const diff = now - startDate;
    
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// بدء الجلسة
window.startSession = async function(bookingId) {
    if (!confirm('هل تريد بدء الجلسة؟')) return;
    
    try {
        const bookingRef = doc(db, "bookings", bookingId);
        const bookingSnap = await getDoc(bookingRef);
        const booking = bookingSnap.data();
        
        await updateDoc(bookingRef, {
            status: 'started',
            startedAt: Timestamp.now(),
            startedBy: currentDoctorName
        });
        
        await addDoc(collection(db, "visits"), {
            customerId: booking.customerId,
            customerName: booking.customerName,
            visitDate: Timestamp.now(),
            doctorId: currentDoctorId,
            doctorName: currentDoctorName,
            services: booking.services,
            amount: booking.totalCost,
            bookingId: bookingId,
            notes: `زيارة من خلال حجز`,
            createdAt: Timestamp.now(),
            createdBy: currentDoctorName
        });
        
        const customerRef = doc(db, "customers", booking.customerId);
        await updateDoc(customerRef, {
            visitCount: increment(1),
            updatedAt: Timestamp.now()
        });
        
        console.log('✅ تم بدء الجلسة بنجاح');
        
    } catch (error) {
        console.error("❌ خطأ في بدء الجلسة:", error);
        alert('❌ حدث خطأ في بدء الجلسة: ' + error.message);
    }
};

// إنهاء الجلسة (المصحح - إرسال تنبيه للاستقبال فقط)
window.endSession = async function(bookingId) {
    try {
        const bookingRef = doc(db, "bookings", bookingId);
        const bookingSnap = await getDoc(bookingRef);
        const booking = bookingSnap.data();
        
        const unpaidServices = (booking.additionalServices || []).filter(s => !s.paid);
        
        if (unpaidServices.length > 0) {
            // ✅ خدمات غير مدفوعة - تحويل الحالة إلى "في انتظار الدفع"
            if (!confirm(`⚠️ يوجد ${unpaidServices.length} خدمة غير مدفوعة!\n\nهل تريد إنهاء الجلسة وتحويل الحالة إلى "في انتظار الدفع"؟\n\nسيتم إرسال تنبيه لموظف الاستقبال لاستقبال الدفع من العميل.`)) {
                return;
            }
            
            await updateDoc(bookingRef, {
                status: 'pending_payment',
                waitingForPayment: true,
                unpaidAmount: unpaidServices.reduce((sum, s) => sum + s.price, 0),
                completedAt: Timestamp.now(),
                completedBy: currentDoctorName
            });
            
            // ✅ إرسال تنبيه للاستقبال
            await sendPaymentAlertToReception(bookingId, booking, unpaidServices);
            
            alert(`✅ تم إنهاء الجلسة وتحويل الحالة إلى "في انتظار الدفع"!\n\nيرجى توجيه العميل لموظف الاستقبال لاستكمال الدفع.\n\nالمبلغ المستحق: ${unpaidServices.reduce((sum, s) => sum + s.price, 0).toFixed(2)} جنيه`);
            
        } else {
            // ✅ لا توجد خدمات غير مدفوعة - إنهاء الجلسة بشكل طبيعي
            if (!confirm('هل تريد إنهاء الجلسة؟')) return;
            
            await updateDoc(bookingRef, {
                status: 'completed',
                completedAt: Timestamp.now(),
                completedBy: currentDoctorName,
                waitingForPayment: false,
                unpaidAmount: 0
            });
            
            // ✅ تسجيل الجلسة المكتملة
            await addDoc(collection(db, "doctorCompletedSessions"), {
                bookingId: bookingId,
                doctorId: currentDoctorId,
                doctorName: currentDoctorName,
                customerId: booking.customerId,
                customerName: booking.customerName,
                services: booking.services,
                additionalServices: booking.additionalServices || [],
                totalAmount: booking.totalCost,
                sessionDate: Timestamp.now(),
                bookingDate: booking.bookingDate,
                bookingTime: booking.bookingTime,
                startedAt: booking.startedAt,
                completedAt: Timestamp.now(),
                month: new Date().getMonth() + 1,
                year: new Date().getFullYear(),
                createdAt: Timestamp.now(),
                createdBy: currentDoctorName
            });
            
            alert('✅ تم إنهاء الجلسة بنجاح!');
        }
        
    } catch (error) {
        console.error("❌ خطأ في إنهاء الجلسة:", error);
        alert('❌ حدث خطأ في إنهاء الجلسة: ' + error.message);
    }
};

// ✅ دالة جديدة لإرسال تنبيه للاستقبال فقط (بدون دفع)
async function sendPaymentAlertToReception(bookingId, booking, unpaidServices) {
    try {
        const totalUnpaid = unpaidServices.reduce((sum, s) => sum + s.price, 0);
        
        // ✅ جلب بيانات العميل لمعرفة الرصيد الحالي
        const customerSnap = await getDoc(doc(db, "customers", booking.customerId));
        const customerData = customerSnap.data();
        const currentBalance = customerData.balance || 0;
        
        // ✅ التحقق من وجود تنبيه سابق
        const existingAlertQuery = query(
            collection(db, "receptionAlerts"),
            where("bookingId", "==", bookingId),
            where("type", "==", "session_completed_needs_payment"),
            where("status", "==", "pending")
        );
        const existingAlerts = await getDocs(existingAlertQuery);
        
        if (!existingAlerts.empty) {
            alert('⚠️ تم إرسال تنبيه سابق لموظف الاستقبال بالفعل!\n\nيرجى توجيه العميلة لموظف الاستقبال لاستكمال الدفع.');
            return;
        }
        
        // ✅ إنشاء تنبيه جديد
        await addDoc(collection(db, "receptionAlerts"), {
            type: 'session_completed_needs_payment',
            stage: 'final_payment',
            priority: 'high',
            bookingId: bookingId,
            customerId: booking.customerId,
            customerName: booking.customerName,
            customerPhone: booking.customerPhone,
            doctorId: currentDoctorId,
            doctorName: currentDoctorName,
            unpaidServices: unpaidServices,
            totalUnpaidAmount: totalUnpaid,
            currentBalance: currentBalance,
            amountNeeded: Math.max(0, totalUnpaid - currentBalance),
            status: 'pending',
            notifyUser: booking.createdBy || 'reception',
            message: `انتهت جلسة ${booking.customerName} وتحتاج لدفع ${unpaidServices.length} خدمة إضافية بمبلغ ${totalUnpaid.toFixed(2)} جنيه`,
            createdAt: Timestamp.now(),
            createdBy: currentDoctorName
        });
        
        // ✅ تحديث حالة الحجز إلى "بانتظار الدفع"
        await updateDoc(doc(db, "bookings", bookingId), {
            status: 'pending_payment',
            waitingForPayment: true,
            unpaidAmount: totalUnpaid,
            updatedAt: Timestamp.now()
        });
        
        alert(`✅ تم إرسال تنبيه لموظف الاستقبال (${booking.createdBy})!\n\nيرجى توجيه العميلة لموظف الاستقبال لاستكمال الدفع.\n\nالمبلغ المستحق: ${totalUnpaid.toFixed(2)} جنيه`);
        
    } catch (error) {
        console.error("❌ خطأ في إرسال التنبيه:", error);
        alert('❌ حدث خطأ في إرسال التنبيه: ' + error.message);
    }
}

// ✅ دالة لإنهاء الجلسة (بدون خدمات غير مدفوعة)
async function completeSession(bookingId, booking) {
    try {
        await updateDoc(doc(db, "bookings", bookingId), {
            status: 'completed',
            completedAt: Timestamp.now(),
            completedBy: currentDoctorName,
            waitingForPayment: false,
            unpaidAmount: 0
        });
        
        // ✅ تسجيل الجلسة المكتملة
        await addDoc(collection(db, "doctorCompletedSessions"), {
            bookingId: bookingId,
            doctorId: currentDoctorId,
            doctorName: currentDoctorName,
            customerId: booking.customerId,
            customerName: booking.customerName,
            services: booking.services,
            additionalServices: booking.additionalServices || [],
            totalAmount: booking.totalCost,
            sessionDate: Timestamp.now(),
            bookingDate: booking.bookingDate,
            bookingTime: booking.bookingTime,
            startedAt: booking.startedAt,
            completedAt: Timestamp.now(),
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear(),
            createdAt: Timestamp.now(),
            createdBy: currentDoctorName
        });
        
        alert('✅ تم إنهاء الجلسة بنجاح!\n\n✔️ تم حفظ التقرير في ملف الأدمن\n✔️ تم تحديث ملف العميل');
        
    } catch (error) {
        console.error("❌ خطأ في إنهاء الجلسة:", error);
        alert('❌ حدث خطأ في إنهاء الجلسة: ' + error.message);
    }
}

// عرض سجل الزيارات - النسخة المحسنة
window.viewCustomerHistory = function(customerId) {
    // فتح صفحة سجل الزيارات في نافذة جديدة أو تاب
    window.open(`../Doctor/customer-history-v2.html?customerId=${customerId}`, '_blank');
};

// تحديث واجهة المستخدم
function updateUI(hasActiveShift) {
    const doctorContent = document.getElementById('doctorContent');
    const waitingContent = document.getElementById('waitingContent');
    const shiftStatus = document.getElementById('shiftStatus');

    if (hasActiveShift) {
        if (doctorContent) doctorContent.classList.remove('hidden');
        if (waitingContent) waitingContent.classList.add('hidden');
        if (shiftStatus) {
            shiftStatus.className = 'shift-status active';
            shiftStatus.innerHTML = '✅ الشيفت نشط';
        }
    } else {
        if (doctorContent) doctorContent.classList.add('hidden');
        if (waitingContent) waitingContent.classList.remove('hidden');
        if (shiftStatus) {
            shiftStatus.className = 'shift-status waiting';
            shiftStatus.innerHTML = '⏳ في انتظار بدء الشيفت...';
        }
    }
}

// التحديث اليدوي
window.checkShiftStatus = async function() {
    console.log('🔄 تحديث يدوي لحالة الشيفت...');
    const hasActiveShift = await checkDoctorActiveShift(); // ✅ استخدام الدالة المحلية
    updateUI(hasActiveShift);
    
    if (!hasActiveShift) {
        alert('❌ لا يزال الشيفت غير نشط.');
    } else {
        await setupRealtimeBookings();
    }
};

// تنظيف عند المغادرة
window.addEventListener('beforeunload', () => {
    if (bookingsListener) bookingsListener();
});

console.log('✅ تم تحميل صفحة الدكتور بنجاح');