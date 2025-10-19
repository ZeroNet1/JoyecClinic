// shift-management.js - إصلاح مشاكل الضغط المتكرر وتسجيل البيانات
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
let currentUserData = null;
let isProcessing = false; // ✅ إضافة flag لمنع المعالجة المتكررة
let eventListenersSetup = false; // ✅ لضمان إعداد المستمعات مرة واحدة فقط

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
        console.error("خطأ في التحقق من الشيفت النشط:", error);
        return false;
    }
}

checkUserRole().then(userData => {
    try {
        if (userData) {
            currentUserData = userData;
            const unameEl = $id('userName');
            if (unameEl) unameEl.textContent = userData.name || '';
            checkActiveShift();
            // ✅ إعداد المستمعات مرة واحدة فقط
            if (!eventListenersSetup) {
                setupEventListenersSafely();
                eventListenersSetup = true;
            }
        } else {
            console.error('لا يوجد بيانات مستخدم');
            showStartShiftSafely();
        }
    } catch (err) {
        console.error('خطأ أثناء تهيئة الشيفت:', err);
        showStartShiftSafely();
    }
}).catch(error => {
    console.error('خطأ في التحقق من صلاحية المستخدم:', error);
    showStartShiftSafely();
});

function setupEventListenersSafely() {
    try {
        const options = document.querySelectorAll('.shift-option');
        if (options.length > 0) {
            options.forEach(option => {
                try {
                    // ✅ إزالة أي مستمعات قديمة قبل الإضافة
                    const newOption = option.cloneNode(true);
                    option.parentNode.replaceChild(newOption, option);
                    
                    newOption.addEventListener('click', function() {
                        document.querySelectorAll('.shift-option').forEach(opt => opt.classList.remove('selected'));
                        this.classList.add('selected');
                        const startBtn = $id('startShiftBtn');
                        if (startBtn) startBtn.classList.remove('hidden');
                    });
                } catch (e) { 
                    console.error('خطأ في إضافة مستمع للخيار:', e);
                }
            });
        }

        const startBtn = $id('startShiftBtn');
        if (startBtn) {
            // ✅ إزالة المستمعات القديمة
            const newStartBtn = startBtn.cloneNode(true);
            startBtn.parentNode.replaceChild(newStartBtn, startBtn);
            
            newStartBtn.addEventListener('click', async () => {
                // ✅ منع الضغطات المتكررة
                if (isProcessing) {
                    console.log('⳿ جاري معالجة الطلب السابق...');
                    return;
                }
                
                isProcessing = true;
                newStartBtn.disabled = true;
                newStartBtn.textContent = 'جاري بدء الشيفت...';
                
                try {
                    await startShift();
                } catch (err) {
                    console.error('خطأ في بدء الشيفت:', err);
                } finally {
                    isProcessing = false;
                    newStartBtn.disabled = false;
                    newStartBtn.textContent = 'بدء الشيفت';
                }
            });
        }

        const endBtn = $id('endShiftBtn');
        if (endBtn) {
            // ✅ إزالة المستمعات القديمة
            const newEndBtn = endBtn.cloneNode(true);
            endBtn.parentNode.replaceChild(newEndBtn, endBtn);
            
            newEndBtn.addEventListener('click', async () => {
                // ✅ منع الضغطات المتكررة
                if (isProcessing) {
                    console.log('⳿ جاري معالجة الطلب السابق...');
                    return;
                }
                
                isProcessing = true;
                newEndBtn.disabled = true;
                newEndBtn.textContent = 'جاري إنهاء الشيفت...';
                
                try {
                    await endShift();
                } catch (err) {
                    console.error('خطأ في إنهاء الشيفت:', err);
                } finally {
                    isProcessing = false;
                    newEndBtn.disabled = false;
                    newEndBtn.textContent = 'إنهاء الشيفت';
                }
            });
        }
    } catch (error) {
        console.warn('setupEventListenersSafely واجه مشكلة:', error);
    }
}

async function checkActiveShift() {
    try {
        const user = auth.currentUser;
        if (!user) {
            const localUser = JSON.parse(localStorage.getItem('userData'));
            if (!localUser) {
                console.log('لا يوجد مستخدم مسجل');
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
        console.error("خطأ في التحقق من الشيفت النشط:", error);
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

        // ✅ التحقق من عدم وجود شيفت نشط بالفعل
        const hasActive = await hasActiveShift();
        if (hasActive) {
            alert('⚠️ يوجد شيفت نشط بالفعل! لا يمكن بدء شيفت جديد.');
            await checkActiveShift(); // إعادة تحميل الشيفت النشط
            return;
        }

        const shiftData = {
            userId: uid,
            userName: userName,
            shiftType: shiftType,
            startTime: Timestamp.now(),
            status: 'active',
            
            // إحصائيات مفصلة
            customersAdded: 0,
            bookingsMade: 0,
            bookingsCompleted: 0,
            totalRevenue: 0,
            
            // تفصيل طرق الدفع
            cashRevenue: 0,
            visaRevenue: 0,
            bankRevenue: 0,
            internalBalanceRevenue: 0,
            
            // تفصيل أنواع الإيرادات
            bookingPayments: 0,
            depositPayments: 0,
            sessionPayments: 0,
            
            createdAt: Timestamp.now()
        };
        
        const docRef = await addDoc(collection(db, "shifts"), shiftData);
        currentShift = { 
            id: docRef.id, 
            ...shiftData,
            startTime: shiftData.startTime
        };
        
        await addShiftAction(
            'بدء الشيفت', 
            `بدأ ${userName} شيفت ${shiftType}`,
            null,
            null,
            null,
            { actionCategory: 'system' }
        );
        
        showActiveShiftSafely();
        await loadShiftStats().catch(err => console.error(err));
        
        alert(`✅ تم بدء الشيفت ${shiftType} بنجاح!`);
        console.log('✅ تم إنشاء شيفت جديد:', currentShift.id);
        
    } catch (error) {
        console.error("خطأ في بدء الشيفت:", error);
        alert('❌ حدث خطأ أثناء بدء الشيفت! ' + (error.message || error));
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
        
        await addShiftAction(
            'إنهاء الشيفت', 
            `أنهى ${currentShift.userName} شيفت ${currentShift.shiftType}`,
            null,
            null,
            null,
            { actionCategory: 'system' }
        );
        
        await generateShiftReport().catch(err => console.error(err));
        
    } catch (error) {
        console.error("خطأ في إنهاء الشيفت:", error);
        alert('❌ حدث خطأ أثناء إنهاء الشيفت! ' + (error.message || error));
    }
}

async function updateShiftData(updates) {
    try {
        if (!currentShift || !currentShift.id) return;
        const shiftRef = doc(db, "shifts", currentShift.id);
        await updateDoc(shiftRef, updates);
        currentShift = { ...currentShift, ...updates };
    } catch (error) {
        console.error("خطأ في updateShiftData:", error);
    }
}

// ✅ دالة محسّنة لتسجيل إجراءات الشيفت بالتفصيل
export async function addShiftAction(actionType, description, customerName, amount, paymentMethod, additionalDetails = {}) {
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

        const userName = ($id('userName') && $id('userName').textContent) ? 
            $id('userName').textContent : 
            (currentShift.userName || 'مستخدم غير معروف');
        
        // تحديد فئة الإجراء
        let actionCategory = additionalDetails.actionCategory || 'other';
        if (actionType.includes('حجز')) actionCategory = 'booking';
        else if (actionType.includes('شحن') || actionType.includes('إيداع')) actionCategory = 'deposit';
        else if (actionType.includes('تحويل')) actionCategory = 'transfer';
        else if (actionType.includes('إنهاء') || actionType.includes('إكمال')) actionCategory = 'completion';
        else if (actionType.includes('حذف') || actionType.includes('إلغاء')) actionCategory = 'deletion';
        else if (actionType.includes('عميل')) actionCategory = 'customer';
        
        const actionData = {
            shiftId: currentShift.id,
            actionType: actionType,
            actionCategory: actionCategory,
            description: description,
            customerName: customerName || null,
            amount: parseFloat(amount) || 0,
            paymentMethod: paymentMethod || null,
            timestamp: Timestamp.now(),
            userName: userName,
            userId: uid,
            createdAt: Timestamp.now(),
            ...additionalDetails
        };
        
        await addDoc(collection(db, "shiftActions"), actionData);
        shiftActions.unshift(actionData);

        // تحديث إحصائيات الشيفت
        await updateShiftStatistics(actionType, amount, paymentMethod, additionalDetails);
        
        await loadShiftStats().catch(err => console.error(err));
        
        console.log('✅ تم تسجيل الإجراء:', actionType, amount ? `- ${amount} جنيه` : '');
        
    } catch (error) {
        console.error("خطأ في تسجيل الإجراء:", error);
    }
}

// ✅ تحديث إحصائيات الشيفت بناءً على نوع الإجراء
async function updateShiftStatistics(actionType, amount, paymentMethod, additionalDetails) {
    if (!currentShift || !currentShift.id) return;
    
    try {
        const updates = {};
        const amountValue = parseFloat(amount) || 0;
        
        // ✅ تحديث بناءً على نوع الإجراء
        if (actionType === 'إضافة عميل') {
            updates.customersAdded = (currentShift.customersAdded || 0) + 1;
            
            // ✅ إضافة المبالغ المدفوعة عند تسجيل العميل
            if (amountValue > 0 && paymentMethod && paymentMethod !== 'رصيد داخلي') {
                updates.totalRevenue = (currentShift.totalRevenue || 0) + amountValue;
                updates.depositPayments = (currentShift.depositPayments || 0) + amountValue;
                
                // تحديث حسب طريقة الدفع
                if (paymentMethod === 'نقدي' || paymentMethod === 'cash') {
                    updates.cashRevenue = (currentShift.cashRevenue || 0) + amountValue;
                } else if (paymentMethod === 'فيزا' || paymentMethod === 'visa') {
                    updates.visaRevenue = (currentShift.visaRevenue || 0) + amountValue;
                } else if (paymentMethod === 'كاش' || paymentMethod === 'bank') {
                    updates.bankRevenue = (currentShift.bankRevenue || 0) + amountValue;
                }
                
                console.log('✅ تم تحديث إيرادات تسجيل العميل:', amountValue, paymentMethod);
            }
        } 
        else if (actionType.includes('حجز') && actionType.includes('جديد')) {
            updates.bookingsMade = (currentShift.bookingsMade || 0) + 1;
            
            if (amountValue > 0 && paymentMethod && paymentMethod !== 'رصيد داخلي') {
                updates.totalRevenue = (currentShift.totalRevenue || 0) + amountValue;
                updates.bookingPayments = (currentShift.bookingPayments || 0) + amountValue;
                
                if (paymentMethod === 'نقدي' || paymentMethod === 'cash') {
                    updates.cashRevenue = (currentShift.cashRevenue || 0) + amountValue;
                } else if (paymentMethod === 'فيزا' || paymentMethod === 'visa') {
                    updates.visaRevenue = (currentShift.visaRevenue || 0) + amountValue;
                } else if (paymentMethod === 'كاش' || paymentMethod === 'bank') {
                    updates.bankRevenue = (currentShift.bankRevenue || 0) + amountValue;
                }
            } else if (paymentMethod === 'رصيد داخلي') {
                updates.internalBalanceRevenue = (currentShift.internalBalanceRevenue || 0) + amountValue;
            }
        }
        else if (actionType.includes('إكمال') || actionType.includes('حضور')) {
            updates.bookingsCompleted = (currentShift.bookingsCompleted || 0) + 1;
            
            if (amountValue > 0 && paymentMethod && paymentMethod !== 'رصيد داخلي' && !additionalDetails.isPrepaid) {
                updates.totalRevenue = (currentShift.totalRevenue || 0) + amountValue;
                updates.sessionPayments = (currentShift.sessionPayments || 0) + amountValue;
                
                if (paymentMethod === 'نقدي' || paymentMethod === 'cash') {
                    updates.cashRevenue = (currentShift.cashRevenue || 0) + amountValue;
                } else if (paymentMethod === 'فيزا' || paymentMethod === 'visa') {
                    updates.visaRevenue = (currentShift.visaRevenue || 0) + amountValue;
                } else if (paymentMethod === 'كاش' || paymentMethod === 'bank') {
                    updates.bankRevenue = (currentShift.bankRevenue || 0) + amountValue;
                }
            }
        }
        else if (actionType.includes('شحن') || actionType.includes('إيداع')) {
            if (amountValue > 0 && paymentMethod && paymentMethod !== 'رصيد داخلي') {
                updates.totalRevenue = (currentShift.totalRevenue || 0) + amountValue;
                updates.depositPayments = (currentShift.depositPayments || 0) + amountValue;
                
                if (paymentMethod === 'نقدي' || paymentMethod === 'cash') {
                    updates.cashRevenue = (currentShift.cashRevenue || 0) + amountValue;
                } else if (paymentMethod === 'فيزا' || paymentMethod === 'visa') {
                    updates.visaRevenue = (currentShift.visaRevenue || 0) + amountValue;
                } else if (paymentMethod === 'كاش' || paymentMethod === 'bank') {
                    updates.bankRevenue = (currentShift.bankRevenue || 0) + amountValue;
                }
            }
        }
        
        if (Object.keys(updates).length > 0) {
            await updateShiftData(updates);
            console.log('✅ تم تحديث إحصائيات الشيفت:', updates);
        }
        
    } catch (error) {
        console.error("خطأ في تحديث إحصائيات الشيفت:", error);
    }
}

// باقي الكود كما هو...
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
        console.error("خطأ في loadShiftStats:", error);
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
        console.error("خطأ في تحميل إجراءات الشيفت:", error);
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
                
                let amountInfo = '';
                if (action.amount && action.amount > 0) {
                    amountInfo = ` - ${action.amount.toFixed(2)} جنيه`;
                    if (action.paymentMethod) {
                        amountInfo += ` (${action.paymentMethod})`;
                    }
                }
                
                actionItem.innerHTML = `
                    <div class="action-time">${actionTime}</div>
                    <div class="action-details">${action.description}${amountInfo}</div>
                `;
                actionsList.appendChild(actionItem);
            });
        }
        
        const modal = $id('shiftActionsModal');
        if (modal) modal.classList.remove('hidden');
    } catch (error) {
        console.error('خطأ في showShiftActions:', error);
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
        
        const reportContentEl = $id('reportContent');
        if (!reportContentEl) {
            console.warn('⚠️ عنصر #reportContent غير موجود');
            return;
        }

        let startTimeFormatted = 'غير محدد';
        let endTimeFormatted = 'غير محدد';
        if (currentShift.startTime && currentShift.startTime.toDate) startTimeFormatted = formatTime(currentShift.startTime.toDate());
        if (currentShift.endTime && currentShift.endTime.toDate) endTimeFormatted = formatTime(currentShift.endTime.toDate());

        const groupedActions = groupActionsByCategory(shiftActions);

        reportContentEl.innerHTML = `
            <div class="report-info">
                <h3 style="color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 10px; margin-bottom: 15px;">
                    📋 معلومات الشيفت
                </h3>
                <div class="info-item"><strong>مسؤول الشيفت:</strong> ${currentShift.userName || ''}</div>
                <div class="info-item"><strong>نوع الشيفت:</strong> ${currentShift.shiftType || ''}</div>
                <div class="info-item"><strong>التاريخ:</strong> ${new Date().toLocaleDateString('ar-EG')}</div>
                <div class="info-item"><strong>وقت البدء:</strong> ${startTimeFormatted}</div>
                <div class="info-item"><strong>وقت الانتهاء:</strong> ${endTimeFormatted}</div>
            </div>

            <h3 style="color: #28a745; border-bottom: 2px solid #28a745; padding-bottom: 10px; margin: 25px 0 15px;">
                💰 ملخص الإيرادات
            </h3>
            <div class="report-summary">
                <div class="summary-item">
                    <span>إجمالي الإيرادات:</span>
                    <span style="color: #28a745; font-weight: bold;">${(currentShift.totalRevenue || 0).toFixed(2)} جنيه</span>
                </div>
                <div class="summary-item">
                    <span>💵 نقدي:</span>
                    <span>${(currentShift.cashRevenue || 0).toFixed(2)} جنيه</span>
                </div>
                <div class="summary-item">
                    <span>💳 فيزا:</span>
                    <span>${(currentShift.visaRevenue || 0).toFixed(2)} جنيه</span>
                </div>
                <div class="summary-item">
                    <span>🏦 كاش:</span>
                    <span>${(currentShift.bankRevenue || 0).toFixed(2)} جنيه</span>
                </div>
                <div class="summary-item">
                    <span>💰 حساب داخلي:</span>
                    <span>${(currentShift.internalBalanceRevenue || 0).toFixed(2)} جنيه</span>
                </div>
            </div>

            <h3 style="color: #17a2b8; border-bottom: 2px solid #17a2b8; padding-bottom: 10px; margin: 25px 0 15px;">
                📊 تفصيل أنواع الإيرادات
            </h3>
            <div class="report-summary">
                <div class="summary-item">
                    <span>حجوزات جديدة:</span>
                    <span>${(currentShift.bookingPayments || 0).toFixed(2)} جنيه</span>
                </div>
                <div class="summary-item">
                    <span>إيداعات شحن الرصيد:</span>
                    <span>${(currentShift.depositPayments || 0).toFixed(2)} جنيه</span>
                </div>
                <div class="summary-item">
                    <span>جلسات مكتملة:</span>
                    <span>${(currentShift.sessionPayments || 0).toFixed(2)} جنيه</span>
                </div>
            </div>

            <h3 style="color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 10px; margin: 25px 0 15px;">
                📊 الإحصائيات
            </h3>
            <div class="report-summary">
                <div class="summary-item">
                    <span>👥 عدد العملاء الجدد:</span>
                    <span>${currentShift.customersAdded || 0}</span>
                </div>
                <div class="summary-item">
                    <span>📅 عدد الحجوزات:</span>
                    <span>${currentShift.bookingsMade || 0}</span>
                </div>
                <div class="summary-item">
                    <span>✅ العمليات المكتملة:</span>
                    <span>${currentShift.bookingsCompleted || 0}</span>
                </div>
            </div>

            <h3 style="color: #dc3545; border-bottom: 2px solid #dc3545; padding-bottom: 10px; margin: 25px 0 15px;">
                📝 تفاصيل الإجراءات
            </h3>
            ${generateDetailedActionsReport(groupedActions)}

            <h3 style="color: #17a2b8; border-bottom: 2px solid #17a2b8; padding-bottom: 10px; margin: 25px 0 15px;">
                🕐 سجل الإجراءات الكامل
            </h3>
            <div class="actions-list">${generateActionsList()}</div>
        `;

        safeHide('activeShiftSection');
        safeRemoveClass('shiftReportSection', 'hidden');
        safeShow('shiftReportSection');
    } catch (error) {
        console.error("خطأ في توليد التقرير:", error);
        alert('❌ حدث خطأ أثناء توليد التقرير!');
    }
}

function groupActionsByCategory(actions) {
    const grouped = {
        customers: [],
        bookings: [],
        deposits: [],
        completions: [],
        transfers: [],
        deletions: [],
        other: []
    };
    
    actions.forEach(action => {
        const category = action.actionCategory || 'other';
        if (category === 'customer') {
            grouped.customers.push(action);
        } else if (grouped[category]) {
            grouped[category].push(action);
        } else {
            grouped.other.push(action);
        }
    });
    
    return grouped;
}

function generateDetailedActionsReport(groupedActions) {
    let html = '<div style="display: grid; gap: 20px;">';
    
    // ✅ العملاء الجدد
    if (groupedActions.customers && groupedActions.customers.length > 0) {
        html += `
            <div class="report-section">
                <h4 style="color: #ff9800; margin-bottom: 10px;">👥 العملاء الجدد (${groupedActions.customers.length})</h4>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>اسم العميلة</th>
                            <th>الإجراء</th>
                            <th>المبلغ</th>
                            <th>طريقة الدفع</th>
                            <th>الوقت</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${groupedActions.customers.map(action => `
                            <tr>
                                <td>${action.customerName || '-'}</td>
                                <td>${action.description}</td>
                                <td style="color: #28a745; font-weight: bold;">${action.amount > 0 ? action.amount.toFixed(2) + ' جنيه' : '-'}</td>
                                <td>${action.paymentMethod || '-'}</td>
                                <td>${action.timestamp ? formatTime(action.timestamp.toDate()) : '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    // الحجوزات
    if (groupedActions.bookings.length > 0) {
        html += `
            <div class="report-section">
                <h4 style="color: #667eea; margin-bottom: 10px;">📅 الحجوزات (${groupedActions.bookings.length})</h4>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>اسم العميلة</th>
                            <th>الإجراء</th>
                            <th>المصروفات</th>
                            <th>طريقة الدفع</th>
                            <th>الوقت</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${groupedActions.bookings.map(action => {
                            let expenseText = '-';
                            if (action.amount > 0) {
                                if (action.paymentMethod === 'رصيد داخلي' || action.paymentMethod === 'internal') {
                                    expenseText = `${action.amount.toFixed(2)} جنيه (حساب داخلي)`;
                                } else {
                                    expenseText = `${action.amount.toFixed(2)} جنيه`;
                                }
                            }
                            
                            return `
                            <tr>
                                <td>${action.customerName || '-'}</td>
                                <td>${action.description}</td>
                                <td>${expenseText}</td>
                                <td>${action.paymentMethod || '-'}</td>
                                <td>${action.timestamp ? formatTime(action.timestamp.toDate()) : '-'}</td>
                            </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    // الإيداعات
    if (groupedActions.deposits.length > 0) {
        html += `
            <div class="report-section">
                <h4 style="color: #28a745; margin-bottom: 10px;">💰 الإيداعات (${groupedActions.deposits.length})</h4>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>اسم العميلة</th>
                            <th>الإجراء</th>
                            <th>المبلغ</th>
                            <th>طريقة الدفع</th>
                            <th>الوقت</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${groupedActions.deposits.map(action => `
                            <tr>
                                <td>${action.customerName || '-'}</td>
                                <td>${action.description}</td>
                                <td style="color: #28a745; font-weight: bold;">${action.amount ? action.amount.toFixed(2) + ' جنيه' : '-'}</td>
                                <td>${action.paymentMethod || '-'}</td>
                                <td>${action.timestamp ? formatTime(action.timestamp.toDate()) : '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    // العمليات المكتملة
    if (groupedActions.completions.length > 0) {
        html += `
            <div class="report-section">
                <h4 style="color: #17a2b8; margin-bottom: 10px;">✅ العمليات المكتملة (${groupedActions.completions.length})</h4>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>اسم العميلة</th>
                            <th>الإجراء</th>
                            <th>المصروفات</th>
                            <th>الوقت</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${groupedActions.completions.map(action => {
                            let expenseText = 'مدفوع مسبقاً';
                            if (action.isPrepaid === false && action.amount > 0) {
                                if (action.paymentMethod === 'رصيد داخلي' || action.paymentMethod === 'internal') {
                                    expenseText = `${action.amount.toFixed(2)} جنيه (حساب داخلي)`;
                                } else {
                                    expenseText = `${action.amount.toFixed(2)} جنيه - ${action.paymentMethod || ''}`;
                                }
                            }
                            
                            return `
                            <tr>
                                <td>${action.customerName || '-'}</td>
                                <td>${action.description}</td>
                                <td>${expenseText}</td>
                                <td>${action.timestamp ? formatTime(action.timestamp.toDate()) : '-'}</td>
                            </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    html += '</div>';
    return html;
}

function generateActionsList() {
    if (!shiftActions || shiftActions.length === 0) return '<div class="empty-state">لا توجد إجراءات مسجلة</div>';
    return shiftActions.map(action => {
        let actionTime = 'غير محدد';
        if (action.timestamp && action.timestamp.toDate) actionTime = formatTime(action.timestamp.toDate());
        
        let amountInfo = '';
        if (action.amount && action.amount > 0) {
            amountInfo = ` - ${action.amount.toFixed(2)} جنيه`;
            if (action.paymentMethod) {
                amountInfo += ` (${action.paymentMethod})`;
            }
        }
        
        return `<div class="action-item"><div class="action-time">${actionTime}</div><div class="action-details">${action.description}${amountInfo}</div></div>`;
    }).join('');
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
                cashRevenue: currentShift.cashRevenue || 0,
                visaRevenue: currentShift.visaRevenue || 0,
                bankRevenue: currentShift.bankRevenue || 0,
                internalBalanceRevenue: currentShift.internalBalanceRevenue || 0,
                bookingPayments: currentShift.bookingPayments || 0,
                depositPayments: currentShift.depositPayments || 0,
                sessionPayments: currentShift.sessionPayments || 0,
                customersAdded: currentShift.customersAdded || 0,
                bookingsMade: currentShift.bookingsMade || 0,
                bookingsCompleted: currentShift.bookingsCompleted || 0,
                shiftType: currentShift.shiftType,
                userName: currentShift.userName,
                startTime: currentShift.startTime,
                endTime: currentShift.endTime
            },
            createdAt: Timestamp.now()
        };
        await addDoc(collection(db, "shiftReports"), reportData);
        alert('✅ تم حفظ التقرير بنجاح!');
    } catch (error) {
        console.error("خطأ في حفظ التقرير:", error);
        alert('❌ حدث خطأ أثناء حفظ التقرير! ' + (error.message || error));
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
        console.error('خطأ في listenToActiveShifts:', error);
        return null;
    }
}

window.addShiftAction = addShiftAction;

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 صفحة إدارة الشيفتات محمّلة');
    if (!eventListenersSetup) {
        setupEventListenersSafely();
        eventListenersSetup = true;
    }
});