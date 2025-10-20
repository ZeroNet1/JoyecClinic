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
        
        // ✅ تسجيل جميع أنواع الإجراءات المهمة - الشرط الجديد
        let shouldRecord = false;
        
        // 1. جميع عمليات الدفع (بما فيها الرصيد الداخلي)
        if (amount > 0) {
            shouldRecord = true;
        }
        
        // 2. عمليات إنشاء الحسابات الجديدة
        if (actionType.includes('إنشاء حساب') || actionType.includes('إضافة عميل')) {
            shouldRecord = true;
        }
        
        // 3. جميع أنواع الحجوزات
        if (actionType.includes('حجز') || description.includes('حجز')) {
            shouldRecord = true;
        }
        
        // 4. عمليات شحن الرصيد
        if (actionType.includes('شحن') || description.includes('شحن')) {
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
            ...additionalDetails
        };
        
        await addDoc(collection(db, "shiftActions"), actionData);
        shiftActions.unshift(actionData);
        
        console.log('✅ تم تسجيل الإجراء:', actionType, amount ? `- ${amount} جنيه` : '');
        
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

// ✅ التقرير المحدث حسب المطلوب - الإصدار المحسّن
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
        
        // تجميع البيانات المحسّنة
        const reportData = [];
        let totalAmount = 0;
        
        shiftActions.forEach(action => {
            // ✅ تضمين جميع أنواع الإجراءات المهمة
            if (action.customerName && (action.amount > 0 || action.actionType.includes('إنشاء حساب') || action.actionType.includes('إضافة عميل'))) {
                
                let serviceName = 'غير محدد';
                let displayAmount = action.amount;
                let paymentStatus = 'مدفوع';
                
                // تحديد نوع الخدمة من الوصف
                if (action.actionType.includes('إنشاء حساب') || action.description.includes('إنشاء حساب') || action.actionType.includes('إضافة عميل')) {
                    serviceName = 'إنشاء حساب';
                    // إذا كان إنشاء حساب بدون دفع
                    if (action.amount === 0) {
                        paymentStatus = 'بدون دفع';
                        displayAmount = 0;
                    }
                } else if (action.description) {
                    // استخراج اسم الخدمة من الوصف
                    const serviceMatch = action.description.match(/(?:حجز|تأكيد|إكمال|عملية).*?-\s*(.+?)(?:\s*-|$)/);
                    if (serviceMatch && serviceMatch[1]) {
                        serviceName = serviceMatch[1].trim();
                    } else if (action.services && Array.isArray(action.services)) {
                        serviceName = action.services.map(s => s.name).join(' + ');
                    } else if (action.description.includes('شحن')) {
                        serviceName = 'شحن رصيد';
                    }
                }
                
                // إذا كان هناك خدمات متعددة في الوصف
                if (action.description && action.description.includes('+')) {
                    const servicesPart = action.description.split('-')[1];
                    if (servicesPart) {
                        serviceName = servicesPart.trim();
                    }
                }
                
                reportData.push({
                    customerName: action.customerName,
                    serviceName: serviceName,
                    amount: displayAmount,
                    paymentMethod: action.paymentMethod,
                    paymentStatus: paymentStatus,
                    description: action.description
                });
                
                totalAmount += displayAmount;
            }
        });
        
        // بناء جدول التقرير المحسّن
        let tableHTML = '';
        
        if (reportData.length > 0) {
            tableHTML = `
                <table class="report-table" style="width: 100%; border-collapse: collapse; margin-top: 20px; font-family: Arial, sans-serif;">
                    <thead>
                        <tr style="background: linear-gradient(135deg, #667eea, #764ba2); color: white;">
                            <th style="padding: 15px; text-align: right; border-bottom: 2px solid #dee2e6; font-weight: bold; width: 25%;">اسم العميل</th>
                            <th style="padding: 15px; text-align: right; border-bottom: 2px solid #dee2e6; font-weight: bold; width: 45%;">نوع الخدمة</th>
                            <th style="padding: 15px; text-align: right; border-bottom: 2px solid #dee2e6; font-weight: bold; width: 30%;">السعر</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${reportData.map(item => `
                            <tr style="border-bottom: 1px solid #e9ecef; background: ${item.amount === 0 ? '#f8f9fa' : 'white'};">
                                <td style="padding: 12px; text-align: right; font-weight: 500;">${item.customerName}</td>
                                <td style="padding: 12px; text-align: right;">
                                    <div>${item.serviceName}</div>
                                    ${item.paymentStatus === 'بدون دفع' ? 
                                        '<small style="color: #6c757d;">(إنشاء حساب)</small>' : 
                                        ''}
                                </td>
                                <td style="padding: 12px; text-align: right; font-weight: bold; color: ${item.amount === 0 ? '#6c757d' : '#28a745'};">
                                    ${item.amount === 0 ? 'بدون دفع' : item.amount.toFixed(2) + ' جنيه'}
                                    ${item.paymentMethod ? `<br><small style="color: #666; font-weight: normal;">(${item.paymentMethod})</small>` : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else {
            tableHTML = `
                <div style="text-align: center; color: #999; padding: 60px 20px; background: #f8f9fa; border-radius: 10px; margin: 20px 0;">
                    <div style="font-size: 48px; margin-bottom: 20px;">📝</div>
                    <h3 style="margin: 0 0 10px 0; color: #6c757d;">لا توجد عمليات في هذا الشيفت</h3>
                    <p style="margin: 0; color: #999;">لم يتم تسجيل أي حجوزات أو عمليات دفع خلال هذا الشيفت</p>
                </div>
            `;
        }

        reportContentEl.innerHTML = `
            <div style="padding: 30px; background: white; border-radius: 15px; box-shadow: 0 2px 20px rgba(0,0,0,0.1);">
                <!-- اسم الموظف في الأعلى على اليمين -->
                <div style="text-align: right; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e9ecef;">
                    <h3 style="margin: 0; color: #667eea; font-size: 28px; font-weight: bold;">
                        👤 ${currentShift.userName || 'غير محدد'}
                    </h3>
                    <p style="margin: 8px 0 0 0; color: #666; font-size: 16px;">
                        🕐 شيفت ${currentShift.shiftType || ''} - ${new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                    <p style="margin: 5px 0 0 0; color: #888; font-size: 14px;">
                        وقت البدء: ${currentShift.startTime && currentShift.startTime.toDate ? formatTime(currentShift.startTime.toDate()) : 'غير محدد'}
                    </p>
                </div>
                
                <!-- جدول التقرير -->
                ${tableHTML}
                
                <!-- إجمالي المصاريف -->
                <div style="margin-top: 40px; padding: 25px; background: linear-gradient(135deg, #e8f5e9, #c8e6c9); border-radius: 12px; text-align: center; border: 2px solid #4caf50;">
                    <h3 style="margin: 0 0 15px 0; color: #2e7d32; font-size: 20px; font-weight: bold;">💰 إجمالي الإيرادات</h3>
                    <div style="font-size: 36px; font-weight: bold; color: #1b5e20;">
                        ${totalAmount.toFixed(2)} جنيه
                    </div>
                    <div style="margin-top: 12px; font-size: 15px; color: #2e7d32;">
                        عدد العمليات: ${reportData.length} عملية
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