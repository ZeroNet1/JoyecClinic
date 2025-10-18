// enhanced-customer-history-v2.js - سجل الزيارات المحدث
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    getDocs,
    doc,
    getDoc,
    query,
    where,
    orderBy
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
        const buttonClass = hasReport ? 'view-report-btn has-report' : 'view-report-btn';
        const buttonText = hasReport ? '📋 عرض التقرير' : 'لا يوجد تقرير';
        
        servicesHTML += `
            <div class="service-item">
                <div class="service-info">
                    <span class="service-number">خدمة ${i + 1}:</span>
                    <span class="service-name">${service.name}</span>
                    <span class="service-details">(${service.duration || 0} دقيقة - ${(service.price || 0).toFixed(2)} جنيه)</span>
                </div>
                ${hasReport ? `
                    <button class="${buttonClass}" onclick="viewReport('${reportId}')">
                        ${buttonText}
                    </button>
                ` : `
                    <span style="color: #999; font-size: 13px;">${buttonText}</span>
                `}
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

// عرض التقرير
window.viewReport = async function(reportId) {
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
                    <div class="report-item">
                        <div class="report-label">الدكتور</div>
                        <div class="report-value">${report.doctorName || '-'}</div>
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
};

// إغلاق مودال عرض التقرير
window.closeViewReportModal = function() {
    document.getElementById('viewReportModal').classList.add('hidden');
};

// طباعة التقرير
window.printReport = function() {
    window.print();
};