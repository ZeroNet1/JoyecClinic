// shift-management.js - تقرير الشيفت المحدث
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
let isProcessing = false;
let eventListenersSetup = false;

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
            const newStartBtn = startBtn.cloneNode(true);
            startBtn.parentNode.replaceChild(newStartBtn, startBtn);
            
            newStartBtn.addEventListener('click', async () => {
                if (isProcessing) {
                    console.log('⏳ جاري معالجة الطلب السابق...');
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
            const newEndBtn = endBtn.cloneNode(true);
            endBtn.parentNode.replaceChild(newEndBtn, endBtn);
            
            newEndBtn.addEventListener('click', async () => {
                if (isProcessing) {
                    console.log('⏳ جاري معالجة الطلب السابق...');
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

        const hasActive = await hasActiveShift();
        if (hasActive) {
            alert('⚠️ يوجد شيفت نشط بالفعل! لا يمكن بدء شيفت جديد.');
            await checkActiveShift();
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
            bookingsCompleted: 0,
            totalRevenue: 0,
            
            cashRevenue: 0,
            visaRevenue: 0,
            bankRevenue: 0,
            internalBalanceRevenue: 0,
            
            bookingPayments: 0,
            depositPayments: 0,
            sessionPayments: 0,
            
            createdAt: Timestamp.now(),
            // ✅ إضافة هذا الحقل الهام
            createdBy: uid
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

// دالة جديدة لتحديث إحصائيات الشيفت بناءً على الإجراءات
async function updateShiftStatistics() {
    try {
        if (!currentShift) return;
        
        await loadShiftActions();
        
        let totalRevenue = 0;
        let customersAdded = 0;
        let bookingsMade = 0;
        
        shiftActions.forEach(action => {
            if (action.amount > 0) {
                totalRevenue += action.amount;
            }
            
            if (action.actionType.includes('إضافة عميل') || action.actionType.includes('إنشاء حساب')) {
                customersAdded++;
            }
            
            if (action.actionType.includes('حجز') || action.description.includes('حجز')) {
                bookingsMade++;
            }
        });
        
        // تحديث بيانات الشيفت
        await updateShiftData({
            totalRevenue: totalRevenue,
            customersAdded: customersAdded,
            bookingsMade: bookingsMade,
            updatedAt: Timestamp.now()
        });
        
        // تحديث العرض
        await loadShiftStats();
        
    } catch (error) {
        console.error("خطأ في تحديث إحصائيات الشيفت:", error);
    }
}

// استدعاء هذه الدالة بعد كل إجراء مهم
async function addShiftActionWithStats(actionType, description, customerName, amount, paymentMethod, additionalDetails = {}) {
    await addShiftAction(actionType, description, customerName, amount, paymentMethod, additionalDetails);
    await updateShiftStatistics();
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

        // ✅ التحقق من البيانات أولاً
        await loadShiftActions();
        debugShiftActions();
        
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
        
        await generateEnhancedShiftReport().catch(err => console.error(err));
        
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
        
        // ✅ التحقق من أنواع الإجراءات التي يجب تسجيلها
        let shouldRecord = false;
        
        // 1. جميع عمليات الدفع المباشرة (نقدي، كاش، فيزا)
        if (amount > 0) {
            // ✅ استثناء التحويلات الداخلية وشحن الرصيد من الإيرادات
            const isInternalTransfer = paymentMethod && (
                paymentMethod.includes('رصيد') || 
                paymentMethod.includes('داخلي') || 
                paymentMethod.includes('internal') ||
                paymentMethod.toLowerCase().includes('balance')
            );
            
            const isRecharge = actionType.includes('شحن رصيد');
            const isTransfer = actionType.includes('تحويل داخلي');
            
            if (!isInternalTransfer && !isRecharge && !isTransfer) {
                shouldRecord = true;
            } else {
                console.log('⭕ تم تخطي تسجيل التحويل الداخلي/شحن الرصيد في الإيرادات');
            }
        }
        
        // 2. عمليات إنشاء الحسابات الجديدة
        if (actionType.includes('إنشاء حساب') || actionType.includes('إضافة عميل')) {
            shouldRecord = true;
        }
        
        // 3. جميع أنواع الحجوزات
        if (actionType.includes('حجز') || description.includes('حجز')) {
            shouldRecord = true;
        }

        // 4. عمليات شحن الرصيد (تسجيل بدون مبلغ في الإيرادات)
        if (actionType.includes('شحن') || description.includes('شحن')) {
            shouldRecord = true;
            // ✅ إضافة خاصية لتحديد أن هذا شحن رصيد وليس إيراد
            additionalDetails.isRecharge = true;
        }
        
        // ✅ تسجيل جميع عمليات تأكيد الحجز حتى لو كانت بمبلغ 0
        if (actionType.includes('تأكيد حجز')) {
            shouldRecord = true;
        }
        
        if (!shouldRecord) {
            console.log('⭕ تم تخطي تسجيل الإجراء (لا يحتوي على بيانات مهمة)');
            return;
        }
        
        const actionData = {
            shiftId: currentShift.id,
            actionType: actionType,
            description: description,
            customerName: customerName || null,
            amount: parseFloat(amount) || 0,
            paymentMethod: paymentMethod || null,
            timestamp: Timestamp.now(),
            userName: userName,
            userId: uid,
            createdAt: Timestamp.now(),
            createdBy: uid,
            ...additionalDetails
        };
        
        await addDoc(collection(db, "shiftActions"), actionData);
        shiftActions.unshift(actionData);
        
        console.log('✅ تم تسجيل الإجراء:', actionType, amount ? `- ${amount} جنيه` : '', paymentMethod ? `- ${paymentMethod}` : '');
        
    } catch (error) {
        console.error("خطأ في تسجيل الإجراء:", error);
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
                } else if (action.paymentMethod) {
                    // ✅ عرض نوع الدفع حتى لو كان المبلغ صفر
                    amountInfo = ` - ${action.paymentMethod}`;
                }
                
                actionItem.innerHTML = `
                    <div class="action-time">${actionTime}</div>
                    <div class="action-details">
                        <strong>${action.actionType}</strong><br>
                        ${action.description}${amountInfo}
                        ${action.customerName ? `<br><small>العميل: ${action.customerName}</small>` : ''}
                    </div>
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
// ✅ دالة مساعدة لتصحيح بيانات التقرير
function debugShiftActions() {
    console.log('=== تصحيح بيانات إجراءات الشيفت ===');
    console.log(`إجمالي الإجراءات: ${shiftActions.length}`);
    
    shiftActions.forEach((action, index) => {
        console.log(`\n--- إجراء ${index + 1} ---`);
        console.log(`النوع: ${action.actionType}`);
        console.log(`الوصف: ${action.description}`);
        console.log(`العميل: ${action.customerName}`);
        console.log(`المبلغ: ${action.amount}`);        
        console.log(`طريقة الدفع: ${action.paymentMethod}`);
        console.log(`عميل جديد: ${action.isNewCustomer}`);
        console.log(`الخدمات: ${JSON.stringify(action.services)}`);
    });
    
    console.log('=== نهاية التصحيح ===');
}

// استدع هذه الدالة قبل generateEnhancedShiftReport للتحقق من البيانات

// ✅ الإصلاح الكامل لدالة generateEnhancedShiftReport مع تقسيم أنواع الدفع الصحيح
// ✅ الإصلاح الكامل لدالة generateEnhancedShiftReport مع تقسيم أنواع الدفع الصحيح
// ✅ الإصلاح الكامل لدالة generateEnhancedShiftReport مع تقسيم أنواع الدفع الصحيح
async function generateEnhancedShiftReport() {
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

        // جلب كل إجراءات الشيفت
        await loadShiftActions();
        
        // تجميع البيانات المحسّنة حسب نوع الدفع
        const cashPayments = [];       // نقدي - فلوس في ايد الموظف
        const mobilePayments = [];     // كاش - فودافون كاش/انستاباي
        const visaPayments = [];       // فيزا - بطاقات فيزا
        const internalPayments = [];   // التحويلات الداخلية
        
        let totalCashRevenue = 0;      // الإيراد النقدي فقط
        let totalMobileRevenue = 0;
        let totalVisaRevenue = 0;
        let totalInternalRevenue = 0;
        
        let totalCustomers = 0;
        let totalBookings = 0;
        let totalOperations = 0;

        // ✅ مجموعة لتتبع العملاء لمنع التكرار
        const uniqueCustomers = new Set();

        // ✅ تحليل إجراءات الشيفت وتصنيفها حسب نوع الدفع
        shiftActions.forEach(action => {
            if (!action.customerName) return;

            // ✅ حساب العملاء الفريديين
            if (action.customerName && !uniqueCustomers.has(action.customerName)) {
                uniqueCustomers.add(action.customerName);
                totalCustomers++;
            }

// ✅ حساب الحجوزات - فقط إضافة أو تأكيد الحجز (وليس إكمال الحجز)
if (action.actionType.includes('إضافة حجز') || 
    action.actionType.includes('تأكيد حجز') ||
    action.actionType === 'حجز جديد') {
    totalBookings++;
}

            // ✅ معالجة العمليات بناءً على المبلغ أو المبلغ الأصلي
            const actualAmount = action.amount > 0 ? action.amount : (action.originalAmount || 0);
            
            if (actualAmount > 0 || action.paymentMethod) {
                const paymentData = {
                    customerName: action.customerName,
                    serviceName: getServiceNameFromAction(action),
                    amount: actualAmount,
                    paymentMethod: action.paymentMethod,
                    isNewCustomer: isNewCustomerAction(action),
                    timestamp: action.timestamp,
                    actionType: action.actionType,
                    description: action.description,
                    originalAmount: action.originalAmount || actualAmount
                };

                // ✅ التصنيف الدقيق حسب نوع الدفع - الترتيب مهم!
                const paymentMethod = action.paymentMethod || '';
                
                // 1. ✅ كاش - فودافون كاش أو انستاباي (يجب أن يأتي أولاً)
                if (paymentMethod.includes('فودافون') || 
                    paymentMethod.includes('انستاباي') || 
                    paymentMethod.includes('موبايل') || 
                    paymentMethod === 'كاش' ||
                    paymentMethod.toLowerCase().includes('vodafone') ||
                    paymentMethod.toLowerCase().includes('instapay')) {
                    mobilePayments.push(paymentData);
                    totalMobileRevenue += actualAmount;
                    totalOperations++;
                    console.log(`📱 تم تصنيف كعملية كاش: ${paymentMethod} - ${actualAmount}`);
                }
                // 2. ✅ نقدي - فلوس في ايد الموظف
                else if (paymentMethod.includes('نقدي') || 
                         paymentMethod === 'cash' ||
                         paymentMethod.toLowerCase().includes('cash')) {
                    cashPayments.push(paymentData);
                    totalCashRevenue += actualAmount;
                    totalOperations++;
                    console.log(`💵 تم تصنيف كعملية نقدي: ${paymentMethod} - ${actualAmount}`);
                }
                // 3. ✅ فيزا - بطاقات فيزا
                else if (paymentMethod.includes('فيزا') || 
                         paymentMethod.includes('Visa') || 
                         paymentMethod.includes('بطاقة') ||
                         paymentMethod.toLowerCase().includes('visa') ||
                         paymentMethod.toLowerCase().includes('card')) {
                    visaPayments.push(paymentData);
                    totalVisaRevenue += actualAmount;
                    totalOperations++;
                    console.log(`💳 تم تصنيف كعملية فيزا: ${paymentMethod} - ${actualAmount}`);
                }
                // 4. ✅ تحويل داخلي - رصيد داخلي
                else if (paymentMethod.includes('رصيد') || 
                         paymentMethod.includes('داخلي') || 
                         paymentMethod.includes('internal') ||
                         paymentMethod.toLowerCase().includes('balance') ||
                         paymentMethod.includes('تحويل داخلي')) {
                    internalPayments.push(paymentData);
                    totalInternalRevenue += actualAmount;
                    totalOperations++;
                    console.log(`🔄 تم تصنيف كعملية داخلية: ${paymentMethod} - ${actualAmount}`);
                }
                else if (actualAmount > 0) {
                    // إذا لم يكن محدد، نعتبره نقدي (الافتراضي)
                    cashPayments.push(paymentData);
                    totalCashRevenue += actualAmount;
                    totalOperations++;
                    console.log(`⚡ تم تصنيف كنقدي (افتراضي): ${paymentMethod} - ${actualAmount}`);
                }
            }
        });

        // ✅ دالة مساعدة لاستخراج اسم الخدمة
        function getServiceNameFromAction(action) {
            if (action.actionType.includes('إنشاء حساب') || action.description.includes('إنشاء حساب')) {
                return 'إنشاء حساب جديد';
            }
            if (action.actionType.includes('شحن رصيد')) {
                return 'شحن رصيد';
            }
            if (action.services && action.services.length > 0) {
                return action.services.map(s => typeof s === 'string' ? s : s.name).join(' + ');
            }
            if (action.description) {
                const serviceMatch = action.description.match(/(?:حجز|تأكيد|إكمال).*?-\s*(.+?)(?:\s*-|$)/);
                if (serviceMatch && serviceMatch[1]) {
                    return serviceMatch[1].trim();
                }
            }
            return action.actionType || 'خدمة';
        }

        // ✅ دالة مساعدة للتحقق من عميل جديد
        function isNewCustomerAction(action) {
            return action.actionType.includes('إنشاء حساب') || 
                   action.actionType.includes('عميل جديد') ||
                   action.description.includes('عميل جديد');
        }

        // ✅ دالة لإنشاء جدول لكل نوع دفع
        function createPaymentTable(payments, title, paymentType, totalAmount) {
            if (payments.length === 0) {
                return `
                    <div style="margin: 20px 0; padding: 30px; background: #f8f9fa; border-radius: 10px; text-align: center;">
                        <div style="color: #999; font-size: 16px; margin-bottom: 10px;">🔭</div>
                        <div style="color: #999; font-size: 16px;">لا توجد عمليات ${title}</div>
                    </div>
                `;
            }

            return `
                <div style="margin: 25px 0;">
                    <div style="background: ${getPaymentTypeColor(paymentType)}; color: white; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
                        <h3 style="margin: 0; font-size: 18px; display: flex; justify-content: space-between; align-items: center;">
                            <span>${title}</span>
                            <span>${totalAmount.toFixed(2)} جنيه</span>
                        </h3>
                        <div style="font-size: 14px; opacity: 0.9; margin-top: 5px;">
                            ${payments.length} عملية
                        </div>
                    </div>
                    
                    <div style="background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        <table style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif;">
                            <thead>
                                <tr style="background: #f8f9fa;">
                                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #dee2e6; width: 30%;">اسم العميل</th>
                                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #dee2e6; width: 45%;">الخدمة</th>
                                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #dee2e6; width: 25%;">المبلغ</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${payments.map(payment => `
                                    <tr style="border-bottom: 1px solid #e9ecef;">
                                        <td style="padding: 12px; text-align: right; vertical-align: top;">
                                            <div style="font-weight: 500;">${payment.customerName}</div>
                                            ${payment.isNewCustomer ? 
                                                '<div style="font-size: 11px; color: #28a745; margin-top: 4px;">🆕 عميل جديد</div>' : 
                                                ''
                                            }
                                        </td>
                                        <td style="padding: 12px; text-align: right; vertical-align: top;">
                                            <div style="font-size: 14px; color: #333;">${payment.serviceName}</div>
                                            ${payment.description ? 
                                                `<div style="font-size: 12px; color: #666; margin-top: 4px;">${payment.description}</div>` : 
                                                ''
                                            }
                                            <div style="font-size: 11px; color: #999; margin-top: 4px;">
                                                ${payment.paymentMethod}
                                            </div>
                                        </td>
                                        <td style="padding: 12px; text-align: right; vertical-align: top;">
                                            <div style="font-weight: bold; color: #28a745; font-size: 16px;">
                                                ${payment.amount.toFixed(2)} جنيه
                                            </div>
                                            <div style="font-size: 11px; color: #666; margin-top: 4px;">
                                                ${payment.actionType}
                                            </div>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }

        // ✅ دالة مساعدة لألوان أنواع الدفع
        function getPaymentTypeColor(type) {
            const colors = {
                'cash': 'linear-gradient(135deg, #28a745, #20c997)',      // أخضر للنقدي
                'mobile': 'linear-gradient(135deg, #17a2b8, #138496)',    // أزرق فاتح للكاش
                'visa': 'linear-gradient(135deg, #6f42c1, #5a2d9c)',      // بنفسجي للفيزا
                'internal': 'linear-gradient(135deg, #6c757d, #495057)'   // رمادي للداخلي
            };
            return colors[type] || '#333';
        }

        // ✅ تسجيل الإحصائيات في الكونسول للتصحيح
        console.log('=== إحصائيات التقرير ===');
        console.log(`💵 نقدي: ${cashPayments.length} عملية - ${totalCashRevenue.toFixed(2)} جنيه`);
        console.log(`📱 كاش: ${mobilePayments.length} عملية - ${totalMobileRevenue.toFixed(2)} جنيه`);
        console.log(`💳 فيزا: ${visaPayments.length} عملية - ${totalVisaRevenue.toFixed(2)} جنيه`);
        console.log(`🔄 داخلي: ${internalPayments.length} عملية - ${totalInternalRevenue.toFixed(2)} جنيه`);

        // ✅ بناء التقرير مع الأقسام المنفصلة
        const reportSections = `
            ${createPaymentTable(cashPayments, '💵 المدفوعات النقدية (فلوس في الإيد)', 'cash', totalCashRevenue)}
            ${createPaymentTable(mobilePayments, '📱 المدفوعات بكاش (فودافون كاش/انستاباي)', 'mobile', totalMobileRevenue)}
            ${createPaymentTable(visaPayments, '💳 المدفوعات بفيزا', 'visa', totalVisaRevenue)}
            ${createPaymentTable(internalPayments, '🔄 التحويلات الداخلية (رصيد)', 'internal', totalInternalRevenue)}
        `;

        // ✅ الإيراد النقدي فقط (النقدي + الكاش + الفيزا)
        const totalReceivedRevenue = totalCashRevenue + totalMobileRevenue + totalVisaRevenue;

        reportContentEl.innerHTML = `
            <div style="padding: 30px; background: white; border-radius: 15px; box-shadow: 0 2px 20px rgba(0,0,0,0.1);">
                <!-- رأس التقرير -->
                <div style="text-align: right; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e9ecef;">
                    <h3 style="margin: 0; color: #667eea; font-size: 28px; font-weight: bold;">
                        👤 ${currentShift.userName || 'غير محدد'}
                    </h3>
                    <p style="margin: 8px 0 0 0; color: #666; font-size: 16px;">
                        🕐 شيفت ${currentShift.shiftType || ''} - ${new Date().toLocaleDateString('ar-EG')}
                    </p>
                </div>
                
                <!-- إحصائيات سريعة -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 25px;">
                    <div style="background: linear-gradient(135deg, #e3f2fd, #bbdefb); padding: 20px; border-radius: 10px; text-align: center;">
                        <div style="font-size: 24px; font-weight: bold; color: #1976d2; margin-bottom: 8px;">${totalCustomers}</div>
                        <div style="color: #1565c0; font-size: 14px;">عملاء</div>
                    </div>
                    <div style="background: linear-gradient(135deg, #e8f5e9, #c8e6c9); padding: 20px; border-radius: 10px; text-align: center;">
                        <div style="font-size: 24px; font-weight: bold; color: #2e7d32; margin-bottom: 8px;">${totalBookings}</div>
                        <div style="color: #1b5e20; font-size: 14px;">حجوزات</div>
                    </div>
                    <div style="background: linear-gradient(135deg, #fff3e0, #ffcc80); padding: 20px; border-radius: 10px; text-align: center;">
                        <div style="font-size: 24px; font-weight: bold; color: #f57c00; margin-bottom: 8px;">${totalOperations}</div>
                        <div style="color: #e65100; font-size: 14px;">عمليات</div>
                    </div>
                </div>

                <!-- تفصيل الإيرادات حسب النوع -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin-bottom: 30px;">
                    <div style="background: linear-gradient(135deg, #e8f5e9, #c8e6c9); padding: 15px; border-radius: 10px; text-align: center; border: 2px solid #28a745;">
                        <div style="font-size: 18px; font-weight: bold; color: #155724; margin-bottom: 5px;">💵 نقدي</div>
                        <div style="font-size: 22px; font-weight: bold; color: #155724;">${totalCashRevenue.toFixed(2)} ج.م</div>
                        <small style="color: #666;">${cashPayments.length} عملية</small>
                    </div>
                    <div style="background: linear-gradient(135deg, #d1ecf1, #bee5eb); padding: 15px; border-radius: 10px; text-align: center; border: 2px solid #17a2b8;">
                        <div style="font-size: 18px; font-weight: bold; color: #0c5460; margin-bottom: 5px;">📱 كاش</div>
                        <div style="font-size: 22px; font-weight: bold; color: #0c5460;">${totalMobileRevenue.toFixed(2)} ج.م</div>
                        <small style="color: #666;">${mobilePayments.length} عملية</small>
                    </div>
                    <div style="background: linear-gradient(135deg, #e2e3ff, #cbcbfd); padding: 15px; border-radius: 10px; text-align: center; border: 2px solid #6f42c1;">
                        <div style="font-size: 18px; font-weight: bold; color: #382e5c; margin-bottom: 5px;">💳 فيزا</div>
                        <div style="font-size: 22px; font-weight: bold; color: #382e5c;">${totalVisaRevenue.toFixed(2)} ج.م</div>
                        <small style="color: #666;">${visaPayments.length} عملية</small>
                    </div>
                </div>

                <!-- الأقسام المفصلة -->
                ${reportSections}

                <!-- إجمالي الإيرادات المستلمة (النقدي + الكاش + الفيزا) -->
                <div style="margin-top: 40px; padding: 25px; background: linear-gradient(135deg, #e8f5e9, #c8e6c9); border-radius: 12px; text-align: center; border: 2px solid #28a745;">
                    <h3 style="margin: 0 0 15px 0; color: #155724; font-size: 20px; font-weight: bold;">💰 إجمالي الإيرادات المستلمة</h3>
                    <div style="font-size: 36px; font-weight: bold; color: #155724;">
                        ${totalReceivedRevenue.toFixed(2)} جنيه
                    </div>
                    <div style="margin-top: 12px; font-size: 15px; color: #155724;">
                        (نقدي: ${totalCashRevenue.toFixed(2)} ج.م + كاش: ${totalMobileRevenue.toFixed(2)} ج.م + فيزا: ${totalVisaRevenue.toFixed(2)} ج.م)
                    </div>
                    <div style="margin-top: 8px; font-size: 14px; color: #666;">
                        العملاء: ${totalCustomers} | الحجوزات: ${totalBookings} | العمليات: ${totalOperations}
                    </div>
                </div>

                <!-- ملاحظة هامة -->
                <div style="margin-top: 20px; padding: 15px; background: #fff3cd; border-radius: 8px; border-right: 4px solid #ffc107;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 18px;">💡</span>
                        <div>
                            <strong>ملاحظة:</strong> الإيراد يشمل جميع المدفوعات المستلمة (نقدي + كاش + فيزا). التحويلات الداخلية لا تدخل في الإيراد.
                        </div>
                    </div>
                </div>
            </div>
        `;

        safeHide('activeShiftSection');
        safeRemoveClass('shiftReportSection', 'hidden');
        safeShow('shiftReportSection');
        
    } catch (error) {
        console.error("خطأ في توليد التقرير:", error);
        alert('❌ حدث خطأ أثناء توليد التقرير! ' + (error.message || error));
    }
}



window.printShiftReport = function() {
    try {
        const reportContent = document.getElementById('reportContent');
        if (!reportContent) return;
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>تقرير الشيفت - ${currentShift.userName}</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        direction: rtl;
                        padding: 20px;
                        color: #333;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 20px 0;
                    }
                    th, td {
                        padding: 12px;
                        text-align: right;
                        border-bottom: 1px solid #ddd;
                    }
                    th {
                        background: #f8f9fa;
                        font-weight: bold;
                    }
                    .total-section {
                        margin-top: 30px;
                        padding: 20px;
                        background: #e8f5e9;
                        border-radius: 10px;
                        text-align: center;
                    }
                    @media print {
                        body { padding: 10px; }
                    }
                </style>
            </head>
            <body>
                ${reportContent.innerHTML}
                <script>
                    window.onload = function() {
                        window.print();
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    } catch (e) {
        console.error('خطأ في الطباعة:', e);
    }
};

window.saveShiftReport = async function() {
    try {
        if (!currentShift) { 
            alert('❌ لا يوجد شيفت محفوظ'); 
            return; 
        }
        
        await loadShiftActions();
        
        const reportData = [];
        let totalAmount = 0;
        
        shiftActions.forEach(action => {
            if (action.amount > 0 && action.customerName) {
                let serviceName = 'غير محدد';
                
                if (action.actionType === 'إضافة عميل' || action.description.includes('إنشاء حساب')) {
                    serviceName = 'إنشاء حساب';
                } else if (action.description) {
                    const serviceMatch = action.description.match(/(?:حجز|تأكيد|إكمال).*?-\s*(.+?)(?:\s*-|$)/);
                    if (serviceMatch && serviceMatch[1]) {
                        serviceName = serviceMatch[1].trim();
                    } else if (action.services && Array.isArray(action.services)) {
                        serviceName = action.services.map(s => s.name).join(' + ');
                    }
                }
                
                reportData.push({
                    customerName: action.customerName,
                    serviceName: serviceName,
                    amount: action.amount,
                    paymentMethod: action.paymentMethod
                });
                
                totalAmount += action.amount;
            }
        });
        
        const reportDocument = {
            shiftId: currentShift.id,
            reportDate: Timestamp.now(),
            userName: currentShift.userName,
            shiftType: currentShift.shiftType,
            startTime: currentShift.startTime,
            endTime: currentShift.endTime,
            reportData: reportData,
            totalAmount: totalAmount,
            operationsCount: reportData.length,
            createdAt: Timestamp.now()
        };
        
        await addDoc(collection(db, "shiftReports"), reportDocument);
        alert('✅ تم حفظ التقرير بنجاح!');
    } catch (error) {
        console.error("خطأ في حفظ التقرير:", error);
        alert('❌ حدث خطأ أثناء حفظ التقرير! ' + (error.message || error));
    }
};

window.saveAndPrintReport = async function() {
    try {
        await saveShiftReport();
        setTimeout(() => {
            printShiftReport();
        }, 500);
    } catch (error) {
        console.error('خطأ في حفظ وطباعة التقرير:', error);
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
async function refreshShiftActions() {
    try {
        await loadShiftActions();
        console.log(`🔄 تم تحديث إجراءات الشيفت: ${shiftActions.length} إجراء`);
    } catch (error) {
        console.error('خطأ في تحديث الإجراءات:', error);
    }
}

// في نهاية الملف، أضف هذه التصديرات
export {
    updateShiftStatistics,
    addShiftActionWithStats
};

// استدع هذه الدالة بعد أي عملية حجز أو دفع
window.refreshShiftActions = refreshShiftActions;

window.addShiftAction = addShiftAction;

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 صفحة إدارة الشيفتات محمّلة');
    if (!eventListenersSetup) {
        setupEventListenersSafely();
        eventListenersSetup = true;
    }
});