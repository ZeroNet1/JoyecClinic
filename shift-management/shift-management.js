// shift-management.js - الإصدار المحسّن مع تتبع الحجوزات
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { 
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs,
    query,
    where,
    orderBy,
    Timestamp,
    doc,
    getDoc,
    updateDoc,
    onSnapshot
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
const auth = getAuth(app);
const db = getFirestore(app);

let currentShift = null;
let shiftActions = [];

function $id(id) {
    try { return document.getElementById(id); } catch (e) { return null; }
}

function safeSetText(id, text) {
    const el = $id(id);
    if (el) el.textContent = text;
}

function safeAddClass(id, className) {
    const el = $id(id);
    if (el && el.classList) el.classList.add(className);
}

function safeRemoveClass(id, className) {
    const el = $id(id);
    if (el && el.classList) el.classList.remove(className);
}

function safeShow(id) { safeRemoveClass(id, 'hidden'); }
function safeHide(id) { safeAddClass(id, 'hidden'); }

export async function hasActiveShift() {
    try {
        const userData = JSON.parse(localStorage.getItem('userData'));
        if (!userData) return false;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const q = query(
            collection(db, "shifts"),
            where("userId", "==", userData.uid),
            where("startTime", ">=", Timestamp.fromDate(today)),
            where("startTime", "<", Timestamp.fromDate(tomorrow)),
            where("status", "==", "active")
        );

        const querySnapshot = await getDocs(q);
        return !querySnapshot.empty;
    } catch (error) {
        console.error("❌ خطأ في التحقق من الشيفت النشط:", error);
        return false;
    }
}

checkUserRole().then(userData => {
    try {
        if (userData) {
            const unameEl = $id('userName');
            if (unameEl) unameEl.textContent = userData.name || '';
            checkActiveShift();
            setupEventListenersSafely();
        } else {
            console.error('❌ لا يوجد بيانات مستخدم من checkUserRole');
            showStartShiftSafely();
        }
    } catch (err) {
        console.error('❌ خطأ أثناء تهيئة الشيفت:', err);
        showStartShiftSafely();
    }
}).catch(error => {
    console.error('❌ خطأ في التحقق من صلاحية المستخدم:', error);
    showStartShiftSafely();
});

function setupEventListenersSafely() {
    try {
        const options = document.querySelectorAll('.shift-option');
        if (options.length > 0) {
            options.forEach(option => {
                try {
                    option.addEventListener('click', function() {
                        document.querySelectorAll('.shift-option').forEach(opt => opt.classList.remove('selected'));
                        this.classList.add('selected');
                        const startBtn = $id('startShiftBtn');
                        if (startBtn) startBtn.classList.remove('hidden');
                    });
                } catch (e) { }
            });
        }

        const startBtn = $id('startShiftBtn');
        if (startBtn) {
            startBtn.addEventListener('click', () => { startShift().catch(err => console.error(err)); });
        }

        const endBtn = $id('endShiftBtn');
        if (endBtn) {
            endBtn.addEventListener('click', () => { endShift().catch(err => console.error(err)); });
        }
    } catch (error) {
        console.warn('⚠️ setupEventListenersSafely encountered an issue:', error);
    }
}

async function checkActiveShift() {
    try {
        const user = auth.currentUser;
        if (!user) {
            const localUser = JSON.parse(localStorage.getItem('userData'));
            if (!localUser) {
                console.log('⚠️ لا يوجد مستخدم مسجل');
                showStartShiftSafely();
                return;
            }
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const uid = (auth.currentUser && auth.currentUser.uid) || (JSON.parse(localStorage.getItem('userData'))?.uid) || '';
        
        const q = query(
            collection(db, "shifts"),
            where("userId", "==", uid),
            where("startTime", ">=", Timestamp.fromDate(today)),
            where("startTime", "<", Timestamp.fromDate(tomorrow)),
            where("status", "==", "active")
        );
        
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            const shiftDoc = querySnapshot.docs[0];
            currentShift = { 
                id: shiftDoc.id, 
                ...shiftDoc.data(),
                startTime: shiftDoc.data().startTime,
                endTime: shiftDoc.data().endTime
            };
            showActiveShiftSafely();
            await loadShiftStats().catch(err => console.error(err));
            await loadShiftActions().catch(err => console.error(err));
            console.log('✅ تم تحميل الشيفت النشط:', currentShift);
        } else {
            console.log('ℹ️ لا يوجد شيفت نشط');
            showStartShiftSafely();
        }
    } catch (error) {
        console.error("❌ خطأ في التحقق من الشيفت النشط:", error);
        showStartShiftSafely();
    }
}

async function startShift() {
    try {
        const selectedShiftEl = document.querySelector('.shift-option.selected');
        if (!selectedShiftEl) {
            alert('⚠️ يرجى اختيار نوع الشيفت');
            return;
        }
        const shiftType = selectedShiftEl.getAttribute('data-shift') || 'عام';
        const userName = $id('userName') ? $id('userName').textContent : 'مستخدم';

        const user = auth.currentUser;
        if (!user) {
            const localUser = JSON.parse(localStorage.getItem('userData'));
            if (!localUser || !localUser.uid) {
                alert('❌ يجب تسجيل الدخول أولاً!');
                return;
            }
        }

        const uid = (auth.currentUser && auth.currentUser.uid) || (JSON.parse(localStorage.getItem('userData'))?.uid) || null;
        if (!uid) {
            alert('❌ لا يمكن الحصول على معرف المستخدم لبدء الشيفت');
            return;
        }

        const shiftData = {
            userId: uid,
            userName: userName,
            shiftType: shiftType,
            startTime: Timestamp.now(),
            status: 'active',
            customersAdded: 0,
            bookingsMade: 0,
            totalRevenue: 0,
            createdAt: Timestamp.now()
        };
        
        const docRef = await addDoc(collection(db, "shifts"), shiftData);
        currentShift = { 
            id: docRef.id, 
            ...shiftData,
            startTime: shiftData.startTime
        };
        
        await addShiftAction('بدأ الشيفت', `بدأ ${userName} شيفت ${shiftType}`).catch(err => console.error(err));
        
        showActiveShiftSafely();
        await loadShiftStats().catch(err => console.error(err));
        
        try { alert(`✅ تم بدء الشيفت ${shiftType} بنجاح!`); } catch(e){ }
    } catch (error) {
        console.error("❌ خطأ في بدء الشيفت:", error);
        try { alert('❌ حدث خطأ أثناء بدء الشيفت! ' + (error.message || error)); } catch(e){ }
    }
}

async function endShift() {
    try {
        if (!currentShift) {
            alert('❌ لا يوجد شيفت نشط!');
            return;
        }
        
        if (!confirm('هل تريد إنهاء الشيفت الحالي؟')) {
            return;
        }
        
        const endTime = Timestamp.now();
        await updateShiftData({
            status: 'completed',
            endTime: endTime,
            updatedAt: endTime
        });
        
        await addShiftAction('إنهاء الشيفت', `أنهى ${currentShift.userName} شيفت ${currentShift.shiftType}`).catch(err => console.error(err));
        
        await generateShiftReport().catch(err => console.error(err));
        
    } catch (error) {
        console.error("❌ خطأ في إنهاء الشيفت:", error);
        try { alert('❌ حدث خطأ أثناء إنهاء الشيفت! ' + (error.message || error)); } catch(e){ }
    }
}

async function updateShiftData(updates) {
    try {
        if (!currentShift || !currentShift.id) return;
        const shiftRef = doc(db, "shifts", currentShift.id);
        await updateDoc(shiftRef, updates);
        currentShift = { ...currentShift, ...updates };
    } catch (error) {
        console.error("❌ خطأ في updateShiftData:", error);
    }
}

export async function addShiftAction(actionType, description) {
    try {
        if (!currentShift || !currentShift.id) {
            console.log('ℹ️ لا يوجد شيفت نشط لتسجيل الإجراء');
            return;
        }

        const uid = (auth.currentUser && auth.currentUser.uid) || (JSON.parse(localStorage.getItem('userData'))?.uid) || null;
        if (!uid) {
            console.log('❌ لا يوجد مستخدم مسجل');
            return;
        }

        const userName = ($id('userName') && $id('userName').textContent) ? $id('userName').textContent : (currentShift.userName || 'مستخدم غير معروف');
        const actionData = {
            shiftId: currentShift.id,
            actionType: actionType,
            description: description,
            timestamp: Timestamp.now(),
            userName: userName,
            userId: uid,
            createdAt: Timestamp.now()
        };
        
        await addDoc(collection(db, "shiftActions"), actionData);
        shiftActions.unshift(actionData);

        // تحديث الإحصائيات بناءً على نوع الإجراء
        if (actionType === 'إضافة عميل') {
            await updateShiftData({
                customersAdded: (currentShift.customersAdded || 0) + 1
            });
        } else if (actionType === 'إضافة حجز') {
            await updateShiftData({
                bookingsMade: (currentShift.bookingsMade || 0) + 1
            });
        } else if (actionType === 'استلام دفعة' || actionType === 'شحن رصيد') {
            const amountMatch = description.match(/[\d.]+/);
            if (amountMatch) {
                const amount = parseFloat(amountMatch[0]);
                await updateShiftData({
                    totalRevenue: (currentShift.totalRevenue || 0) + amount
                });
            }
        }
        
        await loadShiftStats().catch(err => console.error(err));
    } catch (error) {
        console.error("❌ خطأ في تسجيل الإجراء:", error);
    }
}

async function loadShiftStats() {
    try {
        if (!currentShift) return;
        
        safeSetText('currentShiftType', `شيفت ${currentShift.shiftType || ''}`);
        
        if (currentShift.startTime && currentShift.startTime.toDate) {
            safeSetText('shiftStartTime', formatTime(currentShift.startTime.toDate()));
        } else {
            safeSetText('shiftStartTime', formatTime(new Date()));
        }
        
        safeSetText('customersAdded', String(currentShift.customersAdded || 0));
        safeSetText('bookingsMade', String(currentShift.bookingsMade || 0));
        safeSetText('totalRevenue', (currentShift.totalRevenue || 0).toFixed(2));
    } catch (error) {
        console.error("❌ خطأ في loadShiftStats:", error);
    }
}

async function loadShiftActions() {
    try {
        if (!currentShift) return;
        
        const q = query(
            collection(db, "shiftActions"),
            where("shiftId", "==", currentShift.id),
            orderBy("timestamp", "desc")
        );
        
        const querySnapshot = await getDocs(q);
        shiftActions = [];
        
        querySnapshot.forEach(docSnap => {
            const data = docSnap.data();
            shiftActions.push({ id: docSnap.id, ...data, timestamp: data.timestamp });
        });
        
        console.log(`✅ تم تحميل ${shiftActions.length} إجراء`);
    } catch (error) {
        console.error("❌ خطأ في تحميل إجراءات الشيفت:", error);
    }
}

window.showShiftActions = function() {
    try {
        const actionsList = $id('shiftActionsList');
        if (!actionsList) return;
        actionsList.innerHTML = '';
        
        if (shiftActions.length === 0) {
            actionsList.innerHTML = '<div class="empty-state">لا توجد إجراءات مسجلة</div>';
        } else {
            shiftActions.forEach(action => {
                const actionItem = document.createElement('div');
                actionItem.className = 'action-item';
                
                let actionTime = 'غير محدد';
                if (action.timestamp && action.timestamp.toDate) {
                    actionTime = formatTime(action.timestamp.toDate());
                }
                
                actionItem.innerHTML = `
                    <div class="action-time">${actionTime}</div>
                    <div class="action-details">${action.description}</div>
                `;
                actionsList.appendChild(actionItem);
            });
        }
        
        const modal = $id('shiftActionsModal');
        if (modal) modal.classList.remove('hidden');
    } catch (error) {
        console.error('❌ خطأ في showShiftActions:', error);
    }
};

window.closeShiftActionsModal = function() {
    const modal = $id('shiftActionsModal');
    if (modal) modal.classList.add('hidden');
};

async function generateShiftReport() {
    try {
        if (!currentShift) {
            alert('❌ لا يوجد بيانات شيفت!');
            return;
        }
        
        const newCustomers = await getNewCustomersDuringShift().catch(err => { console.error(err); return []; });
        const shiftBookings = await getBookingsDuringShift().catch(err => { console.error(err); return []; });
        const reportContentEl = $id('reportContent');
        if (!reportContentEl) {
            console.warn('⚠️ عنصر #reportContent غير موجود');
            return;
        }

        let startTimeFormatted = 'غير محدد';
        let endTimeFormatted = 'غير محدد';
        if (currentShift.startTime && currentShift.startTime.toDate) startTimeFormatted = formatTime(currentShift.startTime.toDate());
        if (currentShift.endTime && currentShift.endTime.toDate) endTimeFormatted = formatTime(currentShift.endTime.toDate());

        reportContentEl.innerHTML = `
            <div class="report-info">
                <div class="info-item"><strong>التاريخ:</strong> ${new Date().toLocaleDateString('ar-EG')}</div>
                <div class="info-item"><strong>صاحب الشيفت:</strong> ${currentShift.userName || ''}</div>
                <div class="info-item"><strong>نوع الشيفت:</strong> ${currentShift.shiftType || ''}</div>
                <div class="info-item"><strong>وقت البدء:</strong> ${startTimeFormatted}</div>
                <div class="info-item"><strong>وقت الانتهاء:</strong> ${endTimeFormatted}</div>
            </div>
            <h3>ملخص الإيرادات</h3>
            <div class="report-summary">
                <div class="summary-item"><span>إجمالي الإيرادات:</span><span>${(currentShift.totalRevenue || 0).toFixed(2)} جنيه</span></div>
                <div class="summary-item"><span>عدد العملاء الجدد:</span><span>${currentShift.customersAdded || 0}</span></div>
                <div class="summary-item"><span>عدد الحجوزات:</span><span>${currentShift.bookingsMade || 0}</span></div>
                <div class="summary-item total"><span>المجموع:</span><span>${(currentShift.totalRevenue || 0).toFixed(2)} جنيه</span></div>
            </div>
            <h3>تفاصيل الحجوزات (${shiftBookings.length})</h3>
            <table class="report-table"><thead><tr><th>اسم العميل</th><th>الخدمة</th><th>الدكتور</th><th>المبلغ</th><th>من قام بالحجز</th></tr></thead><tbody>
                ${generateBookingsTable(shiftBookings)}
            </tbody></table>
            <h3>العملاء الجدد (${newCustomers.length})</h3>
            <table class="report-table"><thead><tr><th>اسم العميل</th><th>رقم الهاتف</th><th>الرصيد المبدئي</th></tr></thead><tbody>
                ${generateCustomersTable(newCustomers)}
            </tbody></table>
            <h3>سجل الإجراءات</h3>
            <div class="actions-list">${generateActionsList()}</div>
        `;

        safeHide('activeShiftSection');
        safeRemoveClass('shiftReportSection', 'hidden');
        safeShow('shiftReportSection');
    } catch (error) {
        console.error("❌ خطأ في توليد التقرير:", error);
        try { alert('❌ حدث خطأ أثناء توليد التقرير!'); } catch(e){ }
    }
}

function generateBookingsTable(bookings) {
    if (!bookings || bookings.length === 0) {
        return '<tr><td colspan="5" style="text-align: center;">لا توجد حجوزات</td></tr>';
    }
    return bookings.map(b => `
        <tr>
            <td>${b.customerName || 'غير محدد'}</td>
            <td>${(b.services && b.services.length > 0) ? b.services.map(s => s.name).join(', ') : 'غير محدد'}</td>
            <td>${b.doctorName || 'غير محدد'}</td>
            <td>${(b.totalCost || 0).toFixed(2)}</td>
            <td><strong>${b.createdBy || 'غير محدد'}</strong></td>
        </tr>
    `).join('');
}

function generateCustomersTable(customers) {
    if (!customers || customers.length === 0) {
        return '<tr><td colspan="3" style="text-align: center;">لا توجد عملاء جدد</td></tr>';
    }
    return customers.map(c => `
        <tr>
            <td>${c.name || 'غير محدد'}</td>
            <td>${c.phone || 'غير محدد'}</td>
            <td>${(c.balance || 0).toFixed(2)}</td>
        </tr>
    `).join('');
}

function generateActionsList() {
    if (!shiftActions || shiftActions.length === 0) return '<div class="empty-state">لا توجد إجراءات مسجلة</div>';
    return shiftActions.map(action => {
        let actionTime = 'غير محدد';
        if (action.timestamp && action.timestamp.toDate) actionTime = formatTime(action.timestamp.toDate());
        return `<div class="action-item"><div class="action-time">${actionTime}</div><div class="action-details">${action.description}</div></div>`;
    }).join('');
}

async function getNewCustomersDuringShift() {
    try {
        if (!currentShift || !currentShift.startTime) return [];
        const q = query(
            collection(db, "customers"),
            where("createdAt", ">=", currentShift.startTime),
            where("createdAt", "<=", currentShift.endTime || Timestamp.now())
        );
        const snap = await getDocs(q);
        const arr = [];
        snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
        return arr;
    } catch (error) {
        console.error("❌ خطأ في جلب العملاء الجدد:", error);
        return [];
    }
}

async function getBookingsDuringShift() {
    try {
        if (!currentShift || !currentShift.startTime) return [];
        
        // جلب الحجوزات التي أنشأها صاحب الشيفت الحالي
        const q = query(
            collection(db, "bookings"),
            where("createdBy", "==", currentShift.userName),
            where("createdAt", ">=", currentShift.startTime),
            where("createdAt", "<=", currentShift.endTime || Timestamp.now())
        );
        
        const snap = await getDocs(q);
        const arr = [];
        snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
        console.log(`📊 تم جلب ${arr.length} حجز لـ ${currentShift.userName}`);
        return arr;
    } catch (error) {
        console.error("❌ خطأ في جلب الحجوزات:", error);
        return [];
    }
}

window.printShiftReport = function() {
    try { window.print(); } catch (e) { console.error(e); }
};

window.saveShiftReport = async function() {
    try {
        if (!currentShift) { alert('❌ لا يوجد شيفت محفوظ'); return; }
        const reportData = {
            shiftId: currentShift.id,
            reportDate: Timestamp.now(),
            content: ($id('reportContent') && $id('reportContent').innerHTML) ? $id('reportContent').innerHTML : '',
            summary: {
                totalRevenue: currentShift.totalRevenue || 0,
                customersAdded: currentShift.customersAdded || 0,
                bookingsMade: currentShift.bookingsMade || 0,
                shiftType: currentShift.shiftType,
                userName: currentShift.userName
            },
            createdAt: Timestamp.now()
        };
        await addDoc(collection(db, "shiftReports"), reportData);
        alert('✅ تم حفظ التقرير بنجاح!');
    } catch (error) {
        console.error("❌ خطأ في حفظ التقرير:", error);
        try { alert('❌ حدث خطأ أثناء حفظ التقرير! ' + (error.message || error)); } catch(e){ }
    }
};

window.startNewShift = function() {
    safeHide('shiftReportSection');
    showStartShiftSafely();
};

function showStartShiftSafely() {
    safeShow('startShiftSection');
    safeHide('activeShiftSection');
    safeHide('shiftReportSection');
    
    document.querySelectorAll('.shift-option').forEach(opt => opt.classList.remove('selected'));
    const sbtn = $id('startShiftBtn');
    if (sbtn) sbtn.classList.add('hidden');
}

function showActiveShiftSafely() {
    safeHide('startShiftSection');
    safeShow('activeShiftSection');
    safeHide('shiftReportSection');
}

function formatTime(date) {
    if (!(date instanceof Date)) return 'غير محدد';
    return date.toLocaleString('ar-EG', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

export function listenToActiveShifts(callback) {
    try {
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

        return onSnapshot(q, (snapshot) => {
            const activeShifts = [];
            snapshot.forEach((docSnap) => activeShifts.push({ id: docSnap.id, ...docSnap.data() }));
            console.log('🔄 تحديث الشيفتات النشطة:', activeShifts.length);
            try { callback(activeShifts); } catch (e) { console.error(e); }
        });
    } catch (error) {
        console.error('❌ خطأ في listenToActiveShifts:', error);
        return null;
    }
}

export async function broadcastShiftUpdate(shiftId, actionType) {
    try {
        console.log(`📢 بث تحديث الشيفت: ${actionType} للشيفت ${shiftId}`);
        await updateSystemStats().catch(err => console.error(err));
    } catch (error) {
        console.error('❌ خطأ في بث تحديث الشيفت:', error);
    }
}

async function updateSystemStats() {
    try {
        const today = new Date(); 
        today.setHours(0,0,0,0);
        const tomorrow = new Date(today); 
        tomorrow.setDate(tomorrow.getDate() + 1);

        const activeShiftsQuery = query(
            collection(db, "shifts"),
            where("startTime", ">=", Timestamp.fromDate(today)),
            where("startTime", "<", Timestamp.fromDate(tomorrow)),
            where("status", "==", "active")
        );

        const activeShiftsSnapshot = await getDocs(activeShiftsQuery);
        const activeShiftsCount = activeShiftsSnapshot.size;

        const stats = { activeShifts: activeShiftsCount, lastUpdate: new Date().toISOString() };
        localStorage.setItem('systemStats', JSON.stringify(stats));
        console.log('📊 تم تحديث إحصائيات النظام:', stats);
    } catch (error) {
        console.error('❌ خطأ في تحديث إحصائيات النظام:', error);
    }
}

window.addShiftAction = addShiftAction;

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 صفحة إدارة الشيفتات محمّلة');
    setupEventListenersSafely();
});