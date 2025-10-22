// reception-alerts.js - النسخة الكاملة مع نظام التنبيهات
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    doc,
    getDoc,
    updateDoc,
    addDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    Timestamp,
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

let currentUserName = '';
let selectedAlert = null;
let alertsListener = null;

// صوت التنبيه
const alertSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHGS57OihUBELTKXh8bllHgU2jdXzxnkpBSh+zPLaizsIGGS56+mjUxEJS6Hd8bplHwU0iM/zy3UsBS1+zPDaizsIGGO46+qiUhEJSp/c8bplHwU0h87zynUsBS1+y+/biz0IFWO36OiiURAJSZ7b8bhkHgQzhs3zyHQrBSt8ye7Zij4IF2K15+ihTxAJR5zZ77hjHQQyhczyw3MrBCp6x+zYiT4IF2G05+efTQ8JRprX7rZiHAQxg8ryvXIqBCl4xurWiD0HFl+y5eadTAkIP5jV7LVhGwMwgcjxu3AoBCh1xerUhzwHFVyv4uSbSggHPZbT6rNfGgIvf8bwuG4nAydyweHP');

// التحقق من الصلاحية
checkUserRole().then(async (userData) => {
    if (userData && (userData.role === 'reception' || userData.role === 'admin')) {
        currentUserName = userData.name;
        document.getElementById('userName').textContent = userData.name;
        
        setupRealtimeAlerts();
    } else {
        alert('❌ ليس لديك صلاحية للوصول إلى هذه الصفحة!');
        window.location.href = '../main.html';
    }
});

// الاستماع للتنبيهات في الوقت الفعلي
function setupRealtimeAlerts() {
    const q = query(
        collection(db, "receptionAlerts"),
        where("status", "==", "pending"),
        orderBy("createdAt", "desc")
    );

    alertsListener = onSnapshot(q, (snapshot) => {
        const alerts = [];
        let hasNewAlert = false;

        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                hasNewAlert = true;
            }
        });

        snapshot.forEach(doc => {
            alerts.push({ id: doc.id, ...doc.data() });
        });

        displayAlerts(alerts);

        // تشغيل صوت عند وجود تنبيه جديد
        if (hasNewAlert && alerts.length > 0) {
            playAlertSound();
            showSoundIndicator();
        }
    });
}

// تشغيل صوت التنبيه
function playAlertSound() {
    alertSound.play().catch(err => console.log('لا يمكن تشغيل الصوت:', err));
}

// إظهار مؤشر الصوت
function showSoundIndicator() {
    const indicator = document.getElementById('soundIndicator');
    indicator.classList.add('active');
    
    setTimeout(() => {
        indicator.classList.remove('active');
    }, 3000);
}

// عرض التنبيهات
function displayAlerts(alerts) {
    const alertsGrid = document.getElementById('alertsGrid');
    const alertsCount = document.getElementById('alertsCount');

    alertsCount.textContent = `${alerts.length} تنبيه`;

    if (alerts.length === 0) {
        alertsGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">✅</div>
                <h3>لا توجد تنبيهات</h3>
                <p>جميع الطلبات تمت معالجتها</p>
            </div>
        `;
        return;
    }

    alertsGrid.innerHTML = '';

    alerts.forEach(alert => {
        const card = createAlertCard(alert);
        alertsGrid.appendChild(card);
    });
}

// إنشاء بطاقة تنبيه
function createAlertCard(alert) {
    const card = document.createElement('div');
    card.className = alert.priority === 'high' ? 'alert-card high-priority' : 'alert-card';

    const createdTime = alert.createdAt?.toDate() || new Date();
    const timeAgo = getTimeAgo(createdTime);

    let alertContent = '';

    // التنبيه الأول: تم إضافة خدمة أثناء الجلسة
    if (alert.type === 'service_added_needs_payment' && alert.stage === 'first_notification') {
        alertContent = `
            <div class="alert-header">
                <div class="alert-badge">
                    🔔 تنبيه: خدمة إضافية
                </div>
                <div class="alert-time">${timeAgo}</div>
            </div>

            <div class="alert-message-box">
                <div class="message-icon">⚠️</div>
                <div class="message-text">${alert.message}</div>
            </div>

            <div class="alert-customer">
                👤 ${alert.customerName}
            </div>

            <div class="alert-details">
                <div class="detail-row">
                    <span class="detail-label">الدكتور:</span>
                    <span class="detail-value">${alert.doctorName}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">الخدمة المطلوبة:</span>
                    <span class="detail-value">${alert.serviceName}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">سعر الخدمة:</span>
                    <span class="detail-value">${alert.servicePrice.toFixed(2)} جنيه</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">رصيد العميلة:</span>
                    <span class="detail-value">${alert.currentBalance.toFixed(2)} جنيه</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">النقص:</span>
                    <span class="detail-value" style="color: #dc3545;">${alert.deficit.toFixed(2)} جنيه</span>
                </div>
            </div>

            <div class="alert-actions">
                <button class="acknowledge-btn" onclick="acknowledgeAlert('${alert.id}')">
                    ✓ تم الاطلاع
                </button>
            </div>
        `;
    }
    // التنبيه الثاني: انتهت الجلسة وتحتاج دفع
    else if (alert.type === 'session_completed_needs_payment' && alert.stage === 'final_payment') {
        const servicesHTML = alert.unpaidServices.map(s => `
            <div class="service-item-alert">
                <span>${s.serviceName}</span>
                <span>${s.price.toFixed(2)} جنيه</span>
            </div>
        `).join('');

        alertContent = `
            <div class="alert-header">
                <div class="alert-badge urgent">
                    🚨 جلسة انتهت - يلزم الدفع الآن
                </div>
                <div class="alert-time">${timeAgo}</div>
            </div>

            <div class="payment-details-box">
                <h4>📋 تفاصيل الدفع المطلوب</h4>
                
                <div class="detail-row-large">
                    <span class="detail-label">اسم العميلة:</span>
                    <span class="detail-value">${alert.customerName}</span>
                </div>
                
                <div class="services-list">
                    <strong>الخدمات المضافة:</strong>
                    ${servicesHTML}
                </div>
                
                <div class="detail-row-large">
                    <span class="detail-label">إجمالي سعر الخدمات:</span>
                    <span class="detail-value highlight">${alert.totalUnpaidAmount.toFixed(2)} جنيه</span>
                </div>
                
                <div class="detail-row-large">
                    <span class="detail-label">رصيد العميلة الحالي:</span>
                    <span class="detail-value ${alert.currentBalance > 0 ? 'positive' : 'negative'}">
                        ${alert.currentBalance.toFixed(2)} جنيه
                    </span>
                </div>
                
                <div class="detail-row-large urgent-row">
                    <span class="detail-label">المبلغ المطلوب من العميلة:</span>
                    <span class="detail-value urgent-value">${alert.amountNeeded.toFixed(2)} جنيه</span>
                </div>
            </div>

            <div class="alert-actions">
                <button class="pay-btn" onclick="openFinalPayment('${alert.id}')">
                    💳 استلام الدفع الآن
                </button>
            </div>
        `;
    }

    card.innerHTML = alertContent;
    return card;
}

// الاطلاع على التنبيه الأول
window.acknowledgeAlert = async function(alertId) {
    try {
        await updateDoc(doc(db, "receptionAlerts", alertId), {
            status: 'acknowledged',
            acknowledgedAt: Timestamp.now(),
            acknowledgedBy: currentUserName
        });

        console.log('✅ تم الاطلاع على التنبيه');

    } catch (error) {
        console.error("خطأ في تحديث التنبيه:", error);
        alert('❌ حدث خطأ!');
    }
};

// فتح مودال الدفع النهائي
window.openFinalPayment = async function(alertId) {
    try {
        const alertDoc = await getDoc(doc(db, "receptionAlerts", alertId));
        if (!alertDoc.exists()) {
            alert('❌ التنبيه غير موجود!');
            return;
        }

        selectedAlert = { id: alertId, ...alertDoc.data() };

        // عرض تفاصيل الدفع في المودال
        const servicesDetails = selectedAlert.unpaidServices.map(s => 
            `<div style="padding: 5px 0; border-bottom: 1px solid #e0e0e0;">• ${s.serviceName}: ${s.price.toFixed(2)} جنيه</div>`
        ).join('');

        const infoBox = document.getElementById('paymentInfoBox');
        infoBox.innerHTML = `
            <div style="background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); padding: 20px; border-radius: 12px; border-right: 4px solid #2196f3;">
                <h4 style="margin: 0 0 15px 0; color: #1565c0;">📋 معلومات العميلة</h4>
                <p><strong>الاسم:</strong> ${selectedAlert.customerName}</p>
                <p><strong>الهاتف:</strong> ${selectedAlert.customerPhone}</p>
            </div>
            
            <div style="background: #fff3cd; padding: 15px; border-radius: 10px; margin: 15px 0; border-right: 4px solid #ffc107;">
                <h4 style="margin: 0 0 10px 0; color: #856404;">💰 تفاصيل الدفع</h4>
                <div style="background: white; padding: 12px; border-radius: 8px; margin-top: 10px;">
                    ${servicesDetails}
                </div>
                <div style="margin-top: 15px; padding: 12px; background: white; border-radius: 8px;">
                    <div style="display: flex; justify-content: space-between; margin: 8px 0;">
                        <span>إجمالي سعر الخدمات:</span>
                        <strong style="color: #dc3545; font-size: 18px;">${selectedAlert.totalUnpaidAmount.toFixed(2)} جنيه</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin: 8px 0;">
                        <span>رصيد العميلة:</span>
                        <strong style="color: ${selectedAlert.currentBalance > 0 ? '#28a745' : '#dc3545'};">${selectedAlert.currentBalance.toFixed(2)} جنيه</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin: 8px 0; padding-top: 8px; border-top: 2px solid #ffc107;">
                        <span style="font-weight: bold;">المطلوب من العميلة:</span>
                        <strong style="color: #dc3545; font-size: 20px;">${selectedAlert.amountNeeded.toFixed(2)} جنيه</strong>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('paymentAmount').value = selectedAlert.amountNeeded.toFixed(2);
        document.getElementById('paymentModal').classList.remove('hidden');

    } catch (error) {
        console.error("خطأ في فتح المودال:", error);
        alert('❌ حدث خطأ!');
    }
};

// إغلاق مودال الدفع
window.closePaymentModal = function() {
    document.getElementById('paymentModal').classList.add('hidden');
    selectedAlert = null;
};

// تأكيد الدفع النهائي
window.confirmPayment = async function() {
    if (!selectedAlert) return;

    const amount = parseFloat(document.getElementById('paymentAmount').value);
    const paymentMethod = document.getElementById('paymentMethod').value;
    const notes = document.getElementById('paymentNotes').value;

    if (!amount || amount <= 0) {
        alert('⚠️ يرجى إدخال مبلغ صحيح!');
        return;
    }

    try {
        const customerRef = doc(db, "customers", selectedAlert.customerId);
        const customerSnap = await getDoc(customerRef);
        const customerData = customerSnap.data();
        const currentBalance = customerData.balance || 0;

        // شحن الرصيد بالمبلغ المدفوع
        const newBalance = currentBalance + amount;
        await updateDoc(customerRef, {
            balance: newBalance,
            updatedAt: Timestamp.now()
        });

        // تسجيل معاملة الشحن
        await addDoc(collection(db, "transactions"), {
            customerId: selectedAlert.customerId,
            customerName: selectedAlert.customerName,
            type: 'deposit',
            amount: amount,
            previousBalance: currentBalance,
            newBalance: newBalance,
            paymentMethod: paymentMethod,
            notes: notes || `شحن رصيد - دفع ${selectedAlert.unpaidServices.length} خدمة إضافية من جلسة مع ${selectedAlert.doctorName}`,
            relatedAlertId: selectedAlert.id,
            bookingId: selectedAlert.bookingId,
            createdAt: Timestamp.now(),
            createdBy: currentUserName
        });

        // خصم مبلغ جميع الخدمات
        const totalUnpaid = selectedAlert.totalUnpaidAmount;
        const finalBalance = newBalance - totalUnpaid;
        await updateDoc(customerRef, {
            balance: finalBalance,
            totalSpent: increment(totalUnpaid),
            updatedAt: Timestamp.now()
        });

        // تسجيل معاملة السحب
        await addDoc(collection(db, "transactions"), {
            customerId: selectedAlert.customerId,
            customerName: selectedAlert.customerName,
            type: 'withdrawal',
            amount: totalUnpaid,
            previousBalance: newBalance,
            newBalance: finalBalance,
            notes: `دفع ${selectedAlert.unpaidServices.length} خدمة إضافية: ${selectedAlert.unpaidServices.map(s => s.serviceName).join(', ')}`,
            bookingId: selectedAlert.bookingId,
            servicesDetails: selectedAlert.unpaidServices,
            paymentMethod: paymentMethod,
            createdAt: Timestamp.now(),
            createdBy: currentUserName
        });

        // تحديث الحجز
        const bookingRef = doc(db, "bookings", selectedAlert.bookingId);
        const bookingSnap = await getDoc(bookingRef);
        const bookingData = bookingSnap.data();
        
        const additionalServices = bookingData.additionalServices || [];
        const updatedServices = additionalServices.map(s => {
            if (!s.paid) {
                return { ...s, paid: true, paidAt: Timestamp.now(), paidBy: currentUserName };
            }
            return s;
        });

        await updateDoc(bookingRef, {
            additionalServices: updatedServices,
            waitingForPayment: false,
            unpaidAmount: 0,
            paymentCompletedAt: Timestamp.now(),
            paymentCompletedBy: currentUserName,
            updatedAt: Timestamp.now()
        });

        // حفظ في تقارير الأدمن
        await addDoc(collection(db, "doctorCompletedSessions"), {
            bookingId: selectedAlert.bookingId,
            doctorId: selectedAlert.doctorId,
            doctorName: selectedAlert.doctorName,
            customerId: selectedAlert.customerId,
            customerName: selectedAlert.customerName,
            services: bookingData.services,
            additionalServices: updatedServices,
            totalAmount: bookingData.totalCost,
            sessionDate: bookingData.completedAt || Timestamp.now(),
            bookingDate: bookingData.bookingDate,
            bookingTime: bookingData.bookingTime,
            startedAt: bookingData.startedAt,
            completedAt: bookingData.completedAt,
            paymentCompletedAt: Timestamp.now(),
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear(),
            createdAt: Timestamp.now(),
            createdBy: currentUserName
        });

        // تحديث حالة التنبيه
        await updateDoc(doc(db, "receptionAlerts", selectedAlert.id), {
            status: 'resolved',
            resolvedAt: Timestamp.now(),
            resolvedBy: currentUserName,
            paymentAmount: amount,
            paymentMethod: paymentMethod,
            paymentNotes: notes
        });

        // تحديث التنبيه الأول أيضاً إن وجد
        const firstAlertQuery = query(
            collection(db, "receptionAlerts"),
            where("bookingId", "==", selectedAlert.bookingId),
            where("stage", "==", "first_notification"),
            where("status", "in", ["pending", "acknowledged"])
        );
        const firstAlerts = await getDocs(firstAlertQuery);
        for (const alertDoc of firstAlerts.docs) {
            await updateDoc(doc(db, "receptionAlerts", alertDoc.id), {
                status: 'resolved',
                resolvedAt: Timestamp.now()
            });
        }

        alert('✅ تم استلام الدفع وتسجيله بنجاح!\n\n✔️ تم شحن الرصيد\n✔️ تم خصم قيمة الخدمات\n✔️ تم تسجيل المعاملات في ملف العميل\n✔️ تم حفظ التقرير النهائي');
        closePaymentModal();

    } catch (error) {
        console.error("خطأ في الدفع:", error);
        alert('❌ حدث خطأ أثناء الدفع: ' + error.message);
    }
};

// حساب الوقت المنقضي
function getTimeAgo(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'الآن';
    if (minutes < 60) return `منذ ${minutes} دقيقة`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `منذ ${hours} ساعة`;
    
    const days = Math.floor(hours / 24);
    return `منذ ${days} يوم`;
}

// تنظيف عند المغادرة
window.addEventListener('beforeunload', () => {
    if (alertsListener) alertsListener();
});