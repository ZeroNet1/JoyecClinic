// bookings.js - النسخة المحدثة المتوافقة مع قواعد Firestore
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import {
    getFirestore,
    collection,
    getDocs,
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

let doctors = [];
let filterDate = new Date().toISOString().split('T')[0];

const doctorsGrid = document.getElementById('doctorsGrid');
const emptyState = document.getElementById('emptyState');
const doctorSearch = document.getElementById('doctorSearch');
const filterDateInput = document.getElementById('filterDate');
const clearSearchBtn = document.getElementById('clearSearch');

/* التحقق من صلاحية المستخدم */
checkUserRole().then(async (userData) => {
    if (!userData) {
        alert('❌ لم يتم التحقق من صلاحية المستخدم.');
        return;
    }
    document.getElementById('userName').textContent = userData.name;
    
    if (filterDateInput) filterDateInput.value = filterDate;
    setupListeners();
    await loadDoctors();
    await renderDoctors();
});

function setupListeners() {
    if (doctorSearch) {
        doctorSearch.addEventListener('input', debounce(renderDoctors, 250));
    }
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            if (doctorSearch) doctorSearch.value = '';
            renderDoctors();
        });
    }
    if (filterDateInput) {
        filterDateInput.addEventListener('change', () => {
            filterDate = filterDateInput.value;
            renderDoctors();
        });
    }
}

/* تحميل قائمة الدكاترة */
async function loadDoctors() {
    try {
        // هام: نضيف شرط deleted == false ليتوافق مع قواعد الأمان
        const q = query(
            collection(db, "users"),
            where("role", "in", ["doctor", "skin_doctor"]),
            where("deleted", "==", false), // مطابقة لقواعد Firestore التي تطلب deleted != true
            orderBy("name")
        );

        const snapshot = await getDocs(q);
        doctors = [];
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            doctors.push({ id: docSnap.id, ...data });
        });

        console.log(`[loadDoctors] fetched ${doctors.length} doctors.`);
    } catch (err) {
        console.error("خطأ في تحميل الدكاترة:", err);
        // رصد طلب الـ index إن وجدت الرسالة
        if (err.message && err.message.includes('requires an index')) {
            console.error('Firestore requires a composite index for this query. افتح الرابط في رسالة الخطأ لإنشاء الـ index.');
        }
        if (err.code === 'permission-denied' || (err.message && err.message.toLowerCase().includes('permission'))) {
            alert('❌ إذن مرفوض: لا يمكنك قراءة بيانات المستخدمين. تحقق من قواعد Firestore وصلاحية حسابك (role).');
        } else {
            alert('❌ حدث خطأ أثناء تحميل الدكاترة — راجع الكونسول.');
        }
        doctors = [];
    }
}

/* عرض الدكاترة في شكل بطاقات */
async function renderDoctors() {
    if (!doctorsGrid) return;
    doctorsGrid.innerHTML = '<div class="loading">جاري التحميل...</div>';

    const searchTerm = (doctorSearch?.value || '').trim().toLowerCase();
    const filtered = doctors.filter(d => {
        if (!searchTerm) return true;
        return (d.name || '').toLowerCase().includes(searchTerm) || 
               (d.role || '').toLowerCase().includes(searchTerm);
    });

    if (filtered.length === 0) {
        doctorsGrid.innerHTML = '';
        emptyState?.classList.remove('hidden');
        return;
    }
    emptyState?.classList.add('hidden');

    doctorsGrid.innerHTML = '';
    
    for (const doctor of filtered) {
        const card = document.createElement('div');
        card.className = 'doctor-card';

        // إحصائيات الحجوزات للدكتور في التاريخ المحدد
        const stats = await fetchDoctorBookingStats(doctor.id, filterDate);

        card.innerHTML = `
            <div class="doctor-top">
                <div class="doctor-avatar">${getDoctorAvatar(doctor.role)}</div>
                <div style="flex:1">
                    <div class="doctor-name">${doctor.name}</div>
                    <div class="doctor-specialty">${getSpecialtyText(doctor.role)}</div>
                </div>
            </div>
            
            <div class="doctor-stats">
                <div class="stat">
                    <span class="stat-value">${stats.totalBookings}</span>
                    <span class="stat-label">حجوزات اليوم</span>
                </div>
                <div class="stat">
                    <span class="stat-value">${stats.pendingBookings}</span>
                    <span class="stat-label">جاري</span>
                </div>
                <div class="stat">
                    <span class="stat-value">${stats.confirmedBookings}</span>
                    <span class="stat-label">مؤكد</span>
                </div>
            </div>
            
            <div class="doctor-actions">
                <button class="view-schedule-btn" onclick="viewDoctorSchedule('${doctor.id}', '${encodeURIComponent(doctor.name)}')">
                    عرض الجدول
                </button>
            </div>
        `;

        doctorsGrid.appendChild(card);
    }
}

/* جلب إحصائيات الحجوزات للدكتور في تاريخ معين */
async function fetchDoctorBookingStats(doctorId, dateStr) {
    try {
        const selectedDate = new Date(dateStr + 'T00:00:00');
        const nextDate = new Date(selectedDate);
        nextDate.setDate(selectedDate.getDate() + 1);

        const q = query(
            collection(db, "bookings"),
            where("doctorId", "==", doctorId),
            where("bookingDate", ">=", selectedDate),
            where("bookingDate", "<", nextDate)
        );

        const snapshot = await getDocs(q);
        let totalBookings = 0;
        let pendingBookings = 0;
        let confirmedBookings = 0;

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.status !== 'cancelled') {
                totalBookings++;
                if (data.status === 'pending') pendingBookings++;
                if (data.status === 'confirmed') confirmedBookings++;
            }
        });

        return { totalBookings, pendingBookings, confirmedBookings };
    } catch (err) {
        console.error("خطأ في جلب الإحصائيات:", err);
        return { totalBookings: 0, pendingBookings: 0, confirmedBookings: 0 };
    }
}

/* الانتقال إلى صفحة جدول الدكتور */
window.viewDoctorSchedule = function(doctorId, doctorName) {
    window.location.href = `doctor-schedule.html?doctorId=${doctorId}&doctorName=${doctorName}&date=${filterDate}`;
} ;

/* دوال مساعدة */
function getDoctorAvatar(role) {
    const avatars = { 'doctor': '👨‍⚕️', 'skin_doctor': '🧑‍⚕️' };
    return avatars[role] || '👨‍⚕️';
}

function getSpecialtyText(role) {
    const map = { 'doctor': 'دكتور تجميل', 'skin_doctor': 'دكتور جلد' };
    return map[role] || 'دكتور';
}

function debounce(fn, wait) {
    let t;
    return (...a) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...a), wait);
    };
}
