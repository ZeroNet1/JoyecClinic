// enhanced-customer-history-v2.js - سجل الزيارات الكامل مع نظام التقارير
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    getDocs,
    doc,
    getDoc,
    addDoc,
    updateDoc,
    query,
    where,
    orderBy,
    Timestamp
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

let customerId = null;
let currentReportData = null;
let currentUser = null;

checkUserRole().then(async (userData) => {
    if (userData) {
        currentUser = userData;
        document.getElementById('userName').textContent = userData.name;
        
        const urlParams = new URLSearchParams(window.location.search);
        customerId = urlParams.get('customerId');
        
        if (!customerId) {
            alert('❌ لم يتم تحديد عميل!');
            window.history.back();
            return;
        }
        
        await loadCustomerInfo();
        await loadCustomerBookings();
    }
});

// تحميل معلومات العميل
async function loadCustomerInfo() {
    try {
        const customerDoc = await getDoc(doc(db, "customers", customerId));
        
        if (customerDoc.exists()) {
            const data = customerDoc.data();
            document.getElementById('customerName').textContent = data.name || '-';
            document.getElementById('customerPhone').textContent = data.phone || '-';
            document.getElementById('visitCount').textContent = data.visitCount || 0;
            document.getElementById('totalSpent').textContent = (data.totalSpent || 0).toFixed(2) + ' جنيه';
        }
    } catch (error) {
        console.error("خطأ في تحميل معلومات العميل:", error);
    }
}

// تحميل جميع الحجوزات المكتملة للعميل
async function loadCustomerBookings() {
    const visitsList = document.getElementById('visitsList');
    
    try {
        // جلب جميع الحجوزات المكتملة للعميل (من جميع الدكاترة)
        const q = query(
            collection(db, "bookings"),
            where("customerId", "==", customerId),
            where("status", "==", "completed"),
            orderBy("completedAt", "desc")
        );
        
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            visitsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📋</div>
                    <h3>لا توجد زيارات مسجلة</h3>
                    <p>لم يتم تسجيل أي زيارات لهذا العميل بعد</p>
                </div>
            `;
            return;
        }
        
        visitsList.innerHTML = '';
        
        for (const docSnap of querySnapshot.docs) {
            const booking = docSnap.data();
            const visitCard = await createVisitCard(booking, docSnap.id);
            visitsList.appendChild(visitCard);
        }
        
    } catch (error) {
        console.error("خطأ في تحميل الزيارات:", error);
        visitsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">❌</div>
                <h3>حدث خطأ</h3>
                <p>لم نتمكن من تحميل الزيارات</p>
            </div>
        `;
    }
}

// إنشاء بطاقة زيارة
async function createVisitCard(booking, bookingId) {
    const card = document.createElement('div');
    card.className = 'visit-card';
    
    const visitDate = booking.completedAt?.toDate() || new Date();
    const formattedDate = visitDate.toLocaleString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const services = booking.services || [];
    
    // بناء HTML للخدمات مع أزرار التقارير
    let servicesHTML = '';
    for (let i = 0; i < services.length; i++) {
        const service = services[i];
        
        // جلب التقرير الخاص بهذه الخدمة
        const reportQuery = query(
            collection(db, "serviceReports"),
            where("bookingId", "==", bookingId),
            where("serviceName", "==", service.name)
        );
        const reportSnapshot = await getDocs(reportQuery);
        
        const hasReport = !reportSnapshot.empty;
        const reportId = hasReport ? reportSnapshot.docs[0].id : null;
        
        servicesHTML += `
            <div class="service-item">
                <div class="service-info">
                    <span class="service-number">خدمة ${i + 1}:</span>
                    <span class="service-name">${service.name}</span>
                    <span class="service-details">(${service.duration || 0} دقيقة - ${(service.price || 0).toFixed(2)} جنيه)</span>
                </div>
                <button class="view-report-btn" onclick="handleServiceReport('${bookingId}', '${service.name}', '${reportId}', ${hasReport})">
                    ${hasReport ? '📋 عرض التقرير' : '➕ إضافة تقرير'}
                </button>
            </div>
        `;
    }
    
    card.innerHTML = `
        <div class="visit-header">
            <div class="visit-date">📅 ${formattedDate}</div>
            <div class="visit-doctor">👨‍⚕️ الدكتور: ${booking.doctorName || 'غير محدد'}</div>
        </div>
        
        <div class="services-section">
            <h4>عدد الخدمات: ${services.length}</h4>
            ${servicesHTML}
        </div>
        
        <div class="visit-meta">
            <div><strong>المبلغ الإجمالي:</strong> ${(booking.totalCost || 0).toFixed(2)} جنيه</div>
            <div><strong>المدة الكلية:</strong> ${booking.totalDuration || 0} دقيقة</div>
            <div><strong>وقت البدء:</strong> ${booking.startedAt ? new Date(booking.startedAt.toDate()).toLocaleTimeString('ar-EG') : '-'}</div>
        </div>
    `;
    
    return card;
}

// التعامل مع تقرير الخدمة
window.handleServiceReport = async function(bookingId, serviceName, reportId, hasReport) {
    if (hasReport && reportId && reportId !== 'null') {
        await viewReport(reportId);
    } else {
        await addReport(bookingId, serviceName);
    }
};

// عرض التقرير الموجود
async function viewReport(reportId) {
    try {
        const reportDoc = await getDoc(doc(db, "serviceReports", reportId));
        
        if (!reportDoc.exists()) {
            alert('❌ التقرير غير موجود!');
            return;
        }
        
        const report = reportDoc.data();
        
        const reportViewBody = document.getElementById('reportViewBody');
        reportViewBody.innerHTML = `
            <div class="report-section">
                <h4>معلومات أساسية</h4>
                <div class="report-grid">
                    <div class="report-item">
                        <div class="report-label">اسم العميلة</div>
                        <div class="report-value">${report.customerName || '-'}</div>
                    </div>
                    <div class="report-item">
                        <div class="report-label">رقم التليفون</div>
                        <div class="report-value">${report.customerPhone || '-'}</div>
                    </div>
                    <div class="report-item">
                        <div class="report-label">التاريخ</div>
                        <div class="report-value">${report.sessionDate || '-'}</div>
                    </div>
                    <div class="report-item">
                        <div class="report-label">الوقت</div>
                        <div class="report-value">${report.sessionTime || '-'}</div>
                    </div>
                    <div class="report-item">
                        <div class="report-label">رقم الجلسة</div>
                        <div class="report-value">${report.sessionNumber || '-'}</div>
                    </div>
                    <div class="report-item">
                        <div class="report-label">نوع الجلسة</div>
                        <div class="report-value">${report.sessionType || '-'}</div>
                    </div>
                </div>
            </div>
            
            <div class="report-section">
                <h4>التفاصيل الفنية</h4>
                <div class="report-grid">
                    <div class="report-item">
                        <div class="report-label">عدد النبضات</div>
                        <div class="report-value">${report.pulseCount || '-'}</div>
                    </div>
                    <div class="report-item">
                        <div class="report-label">Power</div>
                        <div class="report-value">${report.power || '-'}</div>
                    </div>
                    <div class="report-item">
                        <div class="report-label">Pulse Duration</div>
                        <div class="report-value">${report.pulseDuration || '-'}</div>
                    </div>
                    <div class="report-item">
                        <div class="report-label">Spot Size</div>
                        <div class="report-value">${report.spotSize || '-'}</div>
                    </div>
                    <div class="report-item">
                        <div class="report-label">Skin Type</div>
                        <div class="report-value">${report.skinType || '-'}</div>
                    </div>
                </div>
            </div>
            
            ${report.notes ? `
            <div class="report-section">
                <h4>ملاحظات</h4>
                <div class="report-item" style="width: 100%;">
                    <div class="report-value">${report.notes}</div>
                </div>
            </div>
            ` : ''}
        `;
        
        document.getElementById('viewReportModal').classList.remove('hidden');
        
    } catch (error) {
        console.error("خطأ في تحميل التقرير:", error);
        alert('❌ حدث خطأ في تحميل التقرير');
    }
}

// إضافة تقرير جديد
async function addReport(bookingId, serviceName) {
    try {
        // جلب بيانات الحجز
        const bookingDoc = await getDoc(doc(db, "bookings", bookingId));
        if (!bookingDoc.exists()) {
            alert('❌ الحجز غير موجود!');
            return;
        }
        
        const booking = bookingDoc.data();
        
        // ملء البيانات الأساسية
        document.getElementById('reportPatientName').value = booking.customerName;
        document.getElementById('reportPatientPhone').value = booking.customerPhone || '';
        
        // تعيين التاريخ والوقت من الحجز
        const completedDate = booking.completedAt?.toDate() || new Date();
        document.getElementById('reportDate').value = completedDate.toISOString().split('T')[0];
        document.getElementById('reportTime').value = completedDate.toTimeString().slice(0, 5);
        
        // رقم الجلسة (تلقائي)
        document.getElementById('reportSessionNumber').value = `SESS-${Date.now()}`;
        
        // نوع الجلسة (الخدمة)
        document.getElementById('reportSessionType').value = serviceName;
        
        // حفظ البيانات في المتغير العام
        currentReportData = {
            bookingId,
            customerId: booking.customerId,
            customerName: booking.customerName,
            customerPhone: booking.customerPhone,
            doctorId: booking.doctorId,
            doctorName: booking.doctorName,
            serviceName
        };
        
        // إظهار المودال
        document.getElementById('editReportModal').classList.remove('hidden');
        
    } catch (error) {
        console.error("خطأ في إعداد التقرير:", error);
        alert('❌ حدث خطأ في تحميل البيانات');
    }
}

// حفظ التقرير
window.saveReport = async function() {
    if (!currentReportData) return;
    
    // جمع البيانات من النموذج
    const reportData = {
        bookingId: currentReportData.bookingId,
        customerId: currentReportData.customerId,
        customerName: currentReportData.customerName,
        customerPhone: document.getElementById('reportPatientPhone').value,
        doctorId: currentReportData.doctorId,
        doctorName: currentReportData.doctorName,
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
        createdAt: Timestamp.now(),
        createdBy: currentUser.name
    };
    
    // التحقق من البيانات المطلوبة
    if (!reportData.sessionDate || !reportData.sessionTime || !reportData.sessionNumber) {
        alert('⚠️ يرجى ملء جميع الحقول المطلوبة!');
        return;
    }
    
    try {
        // حفظ التقرير في Firestore
        await addDoc(collection(db, "serviceReports"), reportData);
        
        alert('✅ تم حفظ التقرير بنجاح!');
        
        // إغلاق المودال
        closeEditReportModal();
        
        // إعادة تحميل الزيارات لعرض الزر الجديد
        await loadCustomerBookings();
        
    } catch (error) {
        console.error("خطأ في حفظ التقرير:", error);
        alert('❌ حدث خطأ أثناء حفظ التقرير: ' + error.message);
    }
};

// إغلاق مودال عرض التقرير
window.closeViewReportModal = function() {
    document.getElementById('viewReportModal').classList.add('hidden');
};

// إغلاق مودال تحرير التقرير
window.closeEditReportModal = function() {
    document.getElementById('editReportModal').classList.add('hidden');
    currentReportData = null;
    
    // إعادة تعيين النموذج
    document.getElementById('reportForm').reset();
};

// طباعة التقرير
window.printReport = function() {
    window.print();
};