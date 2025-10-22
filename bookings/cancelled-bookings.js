// cancelled-bookings.js - نسخة محسّنة ومتجاوبة تماماً
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import {
    getFirestore,
    collection,
    getDocs,
    query,
    where,
    orderBy,
    Timestamp,
    doc,
    deleteDoc,
    updateDoc,
    addDoc,
    getDoc
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

let currentUser = null;
let selectedBooking = null;
let allCancelledBookings = [];
let isProcessing = false;

// ✅ تحسين الأداء - تخزين عناصر DOM
let domElements = {};

checkUserRole().then(userData => {
    if (userData) {
        currentUser = userData;
        document.getElementById('userName').textContent = userData.name;
        initializePage();
    }
});

function initializePage() {
    cacheDOMElements();
    setupEventListeners();
    setDefaultDates();
    loadCancelledBookings();
    setupResponsiveFeatures();
}

// ✅ تخزين عناصر DOM لتحسين الأداء
function cacheDOMElements() {
    domElements = {
        startDate: document.getElementById('startDate'),
        endDate: document.getElementById('endDate'),
        searchInput: document.getElementById('searchInput'),
        applyFilter: document.getElementById('applyFilter'),
        clearFilter: document.getElementById('clearFilter'),
        cancelledBookingsList: document.getElementById('cancelledBookingsList'),
        rescheduleModal: document.getElementById('rescheduleModal'),
        closeRescheduleModal: document.getElementById('closeRescheduleModal'),
        cancelReschedule: document.getElementById('cancelReschedule'),
        confirmReschedule: document.getElementById('confirmReschedule'),
        newBookingDate: document.getElementById('newBookingDate'),
        newBookingTime: document.getElementById('newBookingTime'),
        showAvailableSlots: document.getElementById('showAvailableSlots'),
        availableSlots: document.getElementById('availableSlots'),
        warningBox: document.getElementById('warningBox'),
        warningMessage: document.getElementById('warningMessage'),
        rescheduleCustomerName: document.getElementById('rescheduleCustomerName'),
        rescheduleDoctorName: document.getElementById('rescheduleDoctorName'),
        rescheduleServices: document.getElementById('rescheduleServices'),
        rescheduleCost: document.getElementById('rescheduleCost')
    };
}

function setupEventListeners() {
    domElements.applyFilter.addEventListener('click', loadCancelledBookings);
    domElements.clearFilter.addEventListener('click', clearFilters);
    domElements.closeRescheduleModal.addEventListener('click', hideRescheduleModal);
    domElements.cancelReschedule.addEventListener('click', hideRescheduleModal);
    domElements.confirmReschedule.addEventListener('click', confirmReschedule);
    
    domElements.newBookingDate.addEventListener('change', checkAvailableSlots);
    domElements.newBookingTime.addEventListener('change', validateNewTime);
    
    if (domElements.showAvailableSlots) {
        domElements.showAvailableSlots.addEventListener('click', checkAvailableSlots);
    }
    
    // ✅ إضافة مستمع للأزرار الديناميكية
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('reschedule-btn') || e.target.closest('.reschedule-btn')) {
            const bookingId = e.target.getAttribute('onclick')?.match(/'([^']+)'/)?.[1] || 
                             e.target.closest('.reschedule-btn').getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
            if (bookingId) showRescheduleModal(bookingId);
        }
        
        if (e.target.classList.contains('delete-btn') || e.target.closest('.delete-btn')) {
            const bookingId = e.target.getAttribute('onclick')?.match(/'([^']+)'/)?.[1] || 
                             e.target.closest('.delete-btn').getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
            if (bookingId) deleteBooking(bookingId);
        }
        
        if (e.target.classList.contains('suggested-slot') || e.target.closest('.suggested-slot')) {
            const time = e.target.getAttribute('data-time') || 
                        e.target.closest('.suggested-slot').getAttribute('data-time');
            if (time) selectSuggestedTime(time);
        }
    });
}

// ✅ إعداد الميزات المتجاوبة
function setupResponsiveFeatures() {
    // إعادة تحميل عند تغيير حجم الشاشة
    window.addEventListener('resize', debounce(() => {
        displayCancelledBookings();
    }, 250));
    
    // إضافة زر القائمة للموبايل
    if (window.innerWidth <= 768) {
        addMobileMenuButton();
    }
}

// ✅ منع التكرار في الأحداث
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function addMobileMenuButton() {
    const header = document.querySelector('.header');
    if (!header || document.getElementById('mobileMenuBtn')) return;
    
    const menuBtn = document.createElement('button');
    menuBtn.id = 'mobileMenuBtn';
    menuBtn.className = 'mobile-menu-btn';
    menuBtn.innerHTML = '☰';
    
    menuBtn.addEventListener('click', toggleMobileMenu);
    header.insertBefore(menuBtn, header.firstChild);
}

function toggleMobileMenu() {
    const controls = document.querySelector('.controls');
    if (controls) {
        controls.classList.toggle('mobile-open');
    }
}

function setDefaultDates() {
    const today = new Date();
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    
    domElements.startDate.value = lastMonth.toISOString().split('T')[0];
    domElements.endDate.value = today.toISOString().split('T')[0];
}

function clearFilters() {
    setDefaultDates();
    domElements.searchInput.value = '';
    loadCancelledBookings();
}

async function loadCancelledBookings() {
    const list = domElements.cancelledBookingsList;
    list.innerHTML = '<div class="loading">جاري تحميل الحجوزات الملغية...</div>';
    
    try {
        const startDate = new Date(domElements.startDate.value);
        const endDate = new Date(domElements.endDate.value);
        endDate.setHours(23, 59, 59, 999);
        
        const searchTerm = domElements.searchInput.value.toLowerCase();
        
        const q = query(
            collection(db, "bookings"),
            where("status", "==", "cancelled"),
            where("bookingDate", ">=", Timestamp.fromDate(startDate)),
            where("bookingDate", "<=", Timestamp.fromDate(endDate)),
            orderBy("bookingDate", "desc"),
            orderBy("bookingTime", "desc")
        );
        
        const querySnapshot = await getDocs(q);
        allCancelledBookings = [];
        
        querySnapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (!searchTerm || 
                data.customerName.toLowerCase().includes(searchTerm) ||
                data.doctorName.toLowerCase().includes(searchTerm)) {
                allCancelledBookings.push({ id: docSnap.id, ...data });
            }
        });
        
        displayCancelledBookings();
        
    } catch (error) {
        console.error("خطأ في تحميل الحجوزات:", error);
        list.innerHTML = '<div class="error">حدث خطأ في تحميل الحجوزات الملغية</div>';
    }
}

function displayCancelledBookings() {
    const list = domElements.cancelledBookingsList;
    
    if (allCancelledBookings.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="icon">📅</div>
                <h3>لا توجد حجوزات ملغية</h3>
                <p>لم يتم العثور على أي حجوزات ملغية في الفترة المحددة</p>
            </div>
        `;
        return;
    }
    
    list.innerHTML = '';
    
    // ✅ تحسين الأداء على الشاشات الصغيرة
    const isMobile = window.innerWidth <= 768;
    const cardTemplate = isMobile ? createMobileBookingCard : createDesktopBookingCard;
    
    allCancelledBookings.forEach(booking => {
        const card = cardTemplate(booking);
        list.appendChild(card);
    });
}

function createDesktopBookingCard(booking) {
    const card = document.createElement('div');
    card.className = 'cancelled-booking-card';
    
    const bookingDate = booking.bookingDate.toDate();
    const formattedDate = bookingDate.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    const services = booking.services || [];
    const servicesHTML = services.map(s => 
        `<div class="service-item">${s.name} (${s.duration} دقيقة - ${s.price.toFixed(2)} جنيه)</div>`
    ).join('');
    
    card.innerHTML = `
        <div class="cancelled-badge">ملغي</div>
        
        <div class="booking-header">
            <div class="customer-name">${booking.customerName}</div>
            <div class="doctor-name">الدكتور: ${booking.doctorName}</div>
        </div>
        
        <div class="booking-details">
            <div class="detail-row">
                <span class="detail-label">التاريخ:</span>
                <span class="detail-value">${formattedDate}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">الوقت:</span>
                <span class="detail-value">${booking.bookingTime} - ${booking.endTime}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">التكلفة:</span>
                <span class="detail-value">${booking.totalCost.toFixed(2)} جنيه</span>
            </div>
        </div>
        
        <div class="services-list">
            <strong>الخدمات:</strong>
            ${servicesHTML}
        </div>
        
        <div class="cancel-reason">
            <strong>سبب الإلغاء:</strong> ${booking.cancelReason || 'غير محدد'}
        </div>
        
        <div class="booking-actions">
            <button class="reschedule-btn" data-booking-id="${booking.id}">
                🔄 إعادة الحجز
            </button>
            <button class="delete-btn" data-booking-id="${booking.id}">
                🗑️ مسح
            </button>
        </div>
    `;
    
    return card;
}

function createMobileBookingCard(booking) {
    const card = document.createElement('div');
    card.className = 'cancelled-booking-card mobile-card';
    
    const bookingDate = booking.bookingDate.toDate();
    const formattedDate = bookingDate.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
    
    const services = booking.services || [];
    const servicesCount = services.length;
    const mainService = services[0]?.name || 'لا توجد خدمات';
    
    card.innerHTML = `
        <div class="mobile-card-header">
            <div class="cancelled-badge">ملغي</div>
            <div class="mobile-customer">${booking.customerName}</div>
        </div>
        
        <div class="mobile-card-body">
            <div class="mobile-detail">
                <span class="mobile-label">الدكتور:</span>
                <span class="mobile-value">${booking.doctorName}</span>
            </div>
            <div class="mobile-detail">
                <span class="mobile-label">التاريخ:</span>
                <span class="mobile-value">${formattedDate}</span>
            </div>
            <div class="mobile-detail">
                <span class="mobile-label">الوقت:</span>
                <span class="mobile-value">${booking.bookingTime}</span>
            </div>
            <div class="mobile-detail">
                <span class="mobile-label">الخدمات:</span>
                <span class="mobile-value">${mainService} ${servicesCount > 1 ? `+${servicesCount-1}` : ''}</span>
            </div>
            <div class="mobile-detail">
                <span class="mobile-label">التكلفة:</span>
                <span class="mobile-value">${booking.totalCost.toFixed(2)} ج.م</span>
            </div>
        </div>
        
        <div class="mobile-card-footer">
            <button class="reschedule-btn mobile-btn" data-booking-id="${booking.id}">
                🔄 إعادة جدولة
            </button>
            <button class="delete-btn mobile-btn" data-booking-id="${booking.id}">
                🗑️ حذف
            </button>
        </div>
        
        <div class="mobile-expand-btn" onclick="toggleMobileCardDetails(this)">
            ⋯ عرض التفاصيل
        </div>
        
        <div class="mobile-expanded-details">
            <div class="services-list">
                <strong>الخدمات المطلوبة:</strong>
                ${services.map(s => `<div class="service-item">${s.name} (${s.duration} دقيقة)</div>`).join('')}
            </div>
            <div class="cancel-reason">
                <strong>سبب الإلغاء:</strong> ${booking.cancelReason || 'غير محدد'}
            </div>
        </div>
    `;
    
    return card;
}

// ✅ دالة لتوسيع/طي التفاصيل في الشاشات الصغيرة
window.toggleMobileCardDetails = function(button) {
    const card = button.closest('.cancelled-booking-card');
    const details = card.querySelector('.mobile-expanded-details');
    const isExpanded = details.style.display === 'block';
    
    details.style.display = isExpanded ? 'none' : 'block';
    button.textContent = isExpanded ? '⋯ عرض التفاصيل' : '⋯ إخفاء التفاصيل';
};

window.showRescheduleModal = async function(bookingId) {
    const booking = allCancelledBookings.find(b => b.id === bookingId);
    if (!booking) return;
    
    selectedBooking = booking;
    
    domElements.rescheduleCustomerName.textContent = booking.customerName;
    domElements.rescheduleDoctorName.textContent = booking.doctorName;
    domElements.rescheduleServices.textContent = 
        booking.services.map(s => s.name).join(', ');
    domElements.rescheduleCost.textContent = booking.totalCost.toFixed(2);
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    domElements.newBookingDate.value = tomorrow.toISOString().split('T')[0];
    domElements.newBookingDate.min = new Date().toISOString().split('T')[0];
    
    domElements.newBookingTime.value = booking.bookingTime;
    
    domElements.rescheduleModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // منع التمرير خلف المودال
    
    await checkAvailableSlots();
};

function hideRescheduleModal() {
    domElements.rescheduleModal.classList.add('hidden');
    document.body.style.overflow = ''; // إعادة التمرير
    selectedBooking = null;
    isProcessing = false;
}

async function checkAvailableSlots() {
    if (!selectedBooking) return;
    
    const newDate = domElements.newBookingDate.value;
    if (!newDate) return;
    
    const availableSlotsDiv = domElements.availableSlots;
    availableSlotsDiv.innerHTML = '<div class="loading-slots">جاري التحقق من الأوقات المتاحة...</div>';
    
    try {
        const selectedDate = new Date(newDate + 'T00:00:00');
        const nextDate = new Date(selectedDate);
        nextDate.setDate(selectedDate.getDate() + 1);
        
        const q = query(
            collection(db, "bookings"),
            where("doctorId", "==", selectedBooking.doctorId),
            where("bookingDate", ">=", selectedDate),
            where("bookingDate", "<", nextDate),
            where("status", "in", ["pending", "confirmed", "started"])
        );
        
        const querySnapshot = await getDocs(q);
        const existingBookings = [];
        
        querySnapshot.forEach(docSnap => {
            existingBookings.push(docSnap.data());
        });
        
        if (existingBookings.length === 0) {
            availableSlotsDiv.innerHTML = `
                <div class="available-slots-header">✅ لا توجد حجوزات أخرى في هذا اليوم</div>
                <div class="time-suggestion">يمكنك الحجز في أي وقت من اليوم</div>
            `;
        } else {
            existingBookings.sort((a, b) => a.bookingTime.localeCompare(b.bookingTime));
            
            let slotsHTML = '<div class="available-slots-header"><strong>⏰ الحجوزات الموجودة:</strong></div>';
            existingBookings.forEach(b => {
                slotsHTML += `
                    <div class="slot-item occupied">
                        <span class="slot-time">${b.bookingTime} - ${b.endTime}</span>
                        <span class="slot-customer">${b.customerName}</span>
                    </div>
                `;
            });
            
            // اقتراح أوقات فارغة
            const suggestedSlots = getSuggestedSlots(existingBookings, selectedBooking.totalDuration);
            if (suggestedSlots.length > 0) {
                slotsHTML += '<div class="available-slots-header" style="margin-top:15px;"><strong>💡 أوقات متاحة مقترحة:</strong></div>';
                suggestedSlots.forEach(slot => {
                    slotsHTML += `
                        <div class="slot-item suggested suggested-slot" data-time="${slot.start}">
                            <span class="slot-time">${slot.start} - ${slot.end}</span>
                            <span class="slot-action">اختر هذا الوقت</span>
                        </div>
                    `;
                });
            }
            
            availableSlotsDiv.innerHTML = slotsHTML;
        }
        
    } catch (error) {
        console.error("خطأ في التحقق من الأوقات:", error);
        availableSlotsDiv.innerHTML = '<div class="error-slots">حدث خطأ في التحقق من الأوقات</div>';
    }
}

function getSuggestedSlots(existingBookings, duration) {
    const suggestions = [];
    const workStart = 8 * 60; // 8 صباحاً بالدقائق
    const workEnd = 22 * 60; // 10 مساءً بالدقائق
    
    if (existingBookings.length === 0) return suggestions;
    
    // قبل أول حجز
    const firstBookingStart = timeToMinutes(existingBookings[0].bookingTime);
    if (firstBookingStart - workStart >= duration) {
        const slotStart = minutesToTime(workStart);
        const slotEnd = minutesToTime(workStart + duration);
        suggestions.push({ start: slotStart, end: slotEnd });
    }
    
    // بين الحجوزات
    for (let i = 0; i < existingBookings.length - 1; i++) {
        const currentEnd = timeToMinutes(existingBookings[i].endTime);
        const nextStart = timeToMinutes(existingBookings[i + 1].bookingTime);
        const gap = nextStart - currentEnd;
        
        if (gap >= duration) {
            const slotStart = minutesToTime(currentEnd);
            const slotEnd = minutesToTime(currentEnd + duration);
            suggestions.push({ start: slotStart, end: slotEnd });
        }
    }
    
    // بعد آخر حجز
    const lastBookingEnd = timeToMinutes(existingBookings[existingBookings.length - 1].endTime);
    if (workEnd - lastBookingEnd >= duration) {
        const slotStart = minutesToTime(lastBookingEnd);
        const slotEnd = minutesToTime(lastBookingEnd + duration);
        suggestions.push({ start: slotStart, end: slotEnd });
    }
    
    return suggestions.slice(0, 3);
}

window.selectSuggestedTime = function(time) {
    domElements.newBookingTime.value = time;
    validateNewTime();
};

async function validateNewTime() {
    if (!selectedBooking) return;
    
    const newDate = domElements.newBookingDate.value;
    const newTime = domElements.newBookingTime.value;
    
    if (!newDate || !newTime) return;
    
    const warningBox = domElements.warningBox;
    const warningMessage = domElements.warningMessage;
    
    const now = new Date();
    const selectedDateTime = new Date(newDate + 'T' + newTime);
    
    if (selectedDateTime <= now) {
        warningBox.style.display = 'block';
        warningMessage.textContent = '⚠️ لا يمكن الحجز في وقت مضى! يرجى اختيار وقت مستقبلي.';
        return false;
    }
    
    try {
        const selectedDate = new Date(newDate + 'T00:00:00');
        const nextDate = new Date(selectedDate);
        nextDate.setDate(selectedDate.getDate() + 1);
        
        const q = query(
            collection(db, "bookings"),
            where("doctorId", "==", selectedBooking.doctorId),
            where("bookingDate", ">=", selectedDate),
            where("bookingDate", "<", nextDate),
            where("status", "in", ["pending", "confirmed", "started"])
        );
        
        const querySnapshot = await getDocs(q);
        let hasConflict = false;
        
        const [hours, minutes] = newTime.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes + selectedBooking.totalDuration;
        const newEndTime = minutesToTime(totalMinutes);
        
        querySnapshot.forEach(docSnap => {
            const booking = docSnap.data();
            
            const existingStart = timeToMinutes(booking.bookingTime);
            const existingEnd = timeToMinutes(booking.endTime);
            const newStart = timeToMinutes(newTime);
            const newEnd = timeToMinutes(newEndTime);
            
            if ((newStart >= existingStart && newStart < existingEnd) ||
                (newEnd > existingStart && newEnd <= existingEnd) ||
                (newStart <= existingStart && newEnd >= existingEnd)) {
                hasConflict = true;
            }
        });
        
        if (hasConflict) {
            warningBox.style.display = 'block';
            warningMessage.textContent = '⚠️ يوجد تداخل مع حجز آخر في هذا الوقت! يرجى اختيار وقت مختلف.';
            return false;
        } else {
            warningBox.style.display = 'none';
            return true;
        }
        
    } catch (error) {
        console.error("خطأ في التحقق:", error);
        return false;
    }
}

function timeToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}

function minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

async function confirmReschedule() {
    if (isProcessing) {
        console.log('المعالجة قيد التنفيذ بالفعل...');
        return;
    }
    
    if (!selectedBooking) return;
    
    const newDate = domElements.newBookingDate.value;
    const newTime = domElements.newBookingTime.value;
    
    if (!newDate || !newTime) {
        alert('⚠️ يرجى تحديد التاريخ والوقت الجديد!');
        return;
    }
    
    const isValid = await validateNewTime();
    if (!isValid) {
        return;
    }
    
    if (!confirm('هل تريد تأكيد إعادة جدولة هذا الحجز؟')) {
        return;
    }
    
    isProcessing = true;
    const confirmBtn = domElements.confirmReschedule;
    const originalText = confirmBtn.textContent;
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'جاري المعالجة...';
    
    try {
        const [hours, minutes] = newTime.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes + selectedBooking.totalDuration;
        const newEndTime = minutesToTime(totalMinutes);
        
        const selectedDate = new Date(newDate + 'T00:00:00');
        
        const newBookingData = {
            customerId: selectedBooking.customerId,
            customerName: selectedBooking.customerName,
            customerPhone: selectedBooking.customerPhone,
            doctorId: selectedBooking.doctorId,
            doctorName: selectedBooking.doctorName,
            bookingDate: Timestamp.fromDate(selectedDate),
            bookingTime: newTime,
            endTime: newEndTime,
            services: selectedBooking.services,
            totalCost: selectedBooking.totalCost,
            totalDuration: selectedBooking.totalDuration,
            status: 'pending',
            isNewCustomer: selectedBooking.isNewCustomer || false,
            createdAt: Timestamp.now(),
            createdBy: currentUser.name,
            rescheduledFrom: selectedBooking.id
        };
        
        await addDoc(collection(db, "bookings"), newBookingData);
        
        await deleteDoc(doc(db, "bookings", selectedBooking.id));
        
        if (!selectedBooking.isNewCustomer && selectedBooking.customerId) {
            const customerRef = doc(db, "customers", selectedBooking.customerId);
            const customerSnap = await getDoc(customerRef);
            
            if (customerSnap.exists()) {
                const currentBalance = customerSnap.data().balance || 0;
                const newBalance = currentBalance - selectedBooking.totalCost;
                
                await updateDoc(customerRef, {
                    balance: newBalance,
                    updatedAt: Timestamp.now()
                });
                
                await addDoc(collection(db, "transactions"), {
                    customerId: selectedBooking.customerId,
                    customerName: selectedBooking.customerName,
                    type: 'withdrawal',
                    amount: selectedBooking.totalCost,
                    previousBalance: currentBalance,
                    newBalance: newBalance,
                    paymentMethod: 'رصيد داخلي',
                    notes: `إعادة حجز - التاريخ الجديد: ${newDate} الساعة ${newTime}`,
                    createdAt: Timestamp.now(),
                    createdBy: currentUser.name
                });
            }
        }
        
        try {
            const shiftModule = await import('../shift-management/shift-management.js');
            if (shiftModule && shiftModule.addShiftAction) {
                await shiftModule.addShiftAction(
                    'إعادة حجز',
                    `تم إعادة جدولة حجز ${selectedBooking.customerName} إلى ${newDate} الساعة ${newTime}`
                );
            }
        } catch (e) {}
        
        alert('✅ تم إعادة جدولة الحجز بنجاح!');
        hideRescheduleModal();
        loadCancelledBookings();
        
    } catch (error) {
        console.error("خطأ في إعادة الجدولة:", error);
        alert('❌ حدث خطأ: ' + (error.message || error));
    } finally {
        isProcessing = false;
        confirmBtn.disabled = false;
        confirmBtn.textContent = originalText;
    }
}

window.deleteBooking = async function(bookingId) {
    if (isProcessing) {
        console.log('المعالجة قيد التنفيذ بالفعل...');
        return;
    }
    
    if (!confirm('⚠️ هل أنت متأكد من حذف هذا الحجز نهائياً؟\nلا يمكن التراجع عن هذا الإجراء!')) {
        return;
    }
    
    isProcessing = true;
    
    try {
        await deleteDoc(doc(db, "bookings", bookingId));
        
        try {
            const booking = allCancelledBookings.find(b => b.id === bookingId);
            const shiftModule = await import('../shift-management/shift-management.js');
            if (shiftModule && shiftModule.addShiftAction && booking) {
                await shiftModule.addShiftAction(
                    'حذف حجز ملغي',
                    `تم حذف الحجز الملغي لـ ${booking.customerName}`
                );
            }
        } catch (e) {}
        
        alert('✅ تم حذف الحجز بنجاح!');
        loadCancelledBookings();
        
    } catch (error) {
        console.error("خطأ في حذف الحجز:", error);
        alert('❌ حدث خطأ في الحذف!');
    } finally {
        isProcessing = false;
    }
};