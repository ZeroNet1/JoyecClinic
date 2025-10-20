// doctor-schedule.js - النسخة الكاملة المدمجة مع فلتر البحث وتعديل السعر
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    updateDoc, 
    setDoc,
    collection,
    addDoc,
    getDocs,
    query,
    where,
    orderBy,
    Timestamp,
    runTransaction,
    onSnapshot,
    deleteDoc,
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

let currentDoctorId = null;
let currentDoctorName = null;
let currentDate = new Date().toISOString().split('T')[0];
let allCustomers = [];
let allServices = [];
let currentUser = null;
let selectedCustomer = null;
let selectedServices = [];
let customerOffers = [];
let unsubscribeBookings = null;
let unsubscribeAlerts = null;
let pendingAlerts = [];
let originalTotalCost = 0;
let currentDiscount = 0;

checkUserRole().then(userData => {
    if (userData) {
        currentUser = userData;
        document.getElementById('userName').textContent = userData.name;
        initializePage();
    }
});

function initializePage() {
    const urlParams = new URLSearchParams(window.location.search);
    currentDoctorId = urlParams.get('doctorId');
    currentDoctorName = decodeURIComponent(urlParams.get('doctorName') || '');
    const dateParam = urlParams.get('date');
    if (dateParam) currentDate = dateParam;
    
    if (!currentDoctorId) {
        alert('❌ لم يتم تحديد دكتور!');
        window.location.href = 'bookings.html';
        return;
    }
    
    document.getElementById('pageTitle').textContent = `جدول الدكتور - ${currentDoctorName}`;
    document.getElementById('doctorName').textContent = currentDoctorName;
    document.getElementById('scheduleDate').value = currentDate;
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('scheduleDate').min = today;
    
    setupEventListeners();
    loadInitialData();
    loadScheduleRealtime();
    setupRealtimeAlerts();
}

function setupEventListeners() {
    document.getElementById('scheduleDate').addEventListener('change', function(e) {
        currentDate = e.target.value;
        loadScheduleRealtime();
    });
    
    document.getElementById('addBookingBtn').addEventListener('click', showAddBookingModal);
    document.getElementById('closeBookingModal').addEventListener('click', hideAddBookingModal);
    document.getElementById('cancelBooking').addEventListener('click', hideAddBookingModal);
    document.getElementById('addBookingForm').addEventListener('submit', addNewBooking);
    document.getElementById('customerType').addEventListener('change', handleCustomerTypeChange);
    document.getElementById('customerSearch').addEventListener('input', debounce(searchCustomers, 300));
    document.getElementById('servicesCount').addEventListener('change', updateServicesInputs);
    document.getElementById('bookingTime').addEventListener('change', calculateEndTime);
    
    // فلتر البحث
    const searchFilter = document.getElementById('searchFilter');
    if (searchFilter) {
        searchFilter.addEventListener('change', function() {
            document.getElementById('customerSearch').value = '';
            document.getElementById('customerResults').classList.add('hidden');
            updateSearchPlaceholder();
        });
    }
    
    // زر تعديل السعر
    const editPriceBtn = document.getElementById('editPriceBtn');
    if (editPriceBtn) {
        editPriceBtn.addEventListener('click', showEditPriceModal);
    }
    
    // استماع لتغيير نوع الحجز
    const bookingTypeSelect = document.getElementById('bookingType');
    if (bookingTypeSelect) {
        bookingTypeSelect.addEventListener('change', handleBookingTypeChange);
    }
    
    const rechargeBtn = document.getElementById('rechargeBalanceBtn');
    if (rechargeBtn) rechargeBtn.addEventListener('click', showRechargeModal);
}

async function loadInitialData() {
    await loadCustomers();
    await loadServices();
}

async function loadCustomers() {
    try {
        const q = query(collection(db, "customers"), orderBy("name"));
        const snapshot = await getDocs(q);
        allCustomers = [];
        snapshot.forEach(docSnap => {
            const data = docSnap.data() || {};
            allCustomers.push({
                id: docSnap.id,
                displayId: String(data.id || docSnap.id),
                name: data.name || '',
                phone: data.phone || '',
                balance: Number(data.balance || 0),
                offersBalance: Number(data.offersBalance || 0),
                laserBalance: Number(data.laserBalance || 0),
                dermaBalance: Number(data.dermaBalance || 0)
            });
        });
        console.log('✅ تم تحميل', allCustomers.length, 'عميل');
    } catch (err) {
        console.error("خطأ في تحميل العملاء:", err);
    }
}

async function loadServices() {
    try {
        const querySnapshot = await getDocs(collection(db, "services"));
        allServices = [];
        querySnapshot.forEach(docSnap => {
            const data = docSnap.data();
            allServices.push({
                id: docSnap.id,
                name: data.name || '',
                duration: Number(data.duration || 0),
                price: Number(data.price || 0)
            });
        });
        console.log('✅ تم تحميل', allServices.length, 'خدمة');
    } catch (error) {
        console.error("خطأ في تحميل الخدمات:", error);
    }
}

// تحميل عروض العميل المتاحة
async function loadCustomerOffers(customerId) {
    try {
        const q = query(
            collection(db, "customerOffers"),
            where("customerId", "==", customerId),
            where("remainingSessions", ">", 0),
            orderBy("purchaseDate", "desc")
        );
        
        const snapshot = await getDocs(q);
        customerOffers = [];
        
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            customerOffers.push({
                id: docSnap.id,
                ...data
            });
        });
        
        console.log('✅ تم تحميل', customerOffers.length, 'عرض متاح');
        return customerOffers;
    } catch (error) {
        console.error("خطأ في تحميل عروض العميل:", error);
        return [];
    }
}

// معالجة تغيير نوع الحجز
async function handleBookingTypeChange() {
    const bookingType = document.getElementById('bookingType').value;
    const offersSection = document.getElementById('offersSection');
    const balanceInfo = document.getElementById('customerBalanceInfo');
    
    // إخفاء جميع الأقسام أولاً
    if (offersSection) offersSection.classList.add('hidden');
    
    if (!selectedCustomer) {
        alert('⚠️ يرجى اختيار عميل أولاً!');
        document.getElementById('bookingType').value = 'normal';
        return;
    }
    
    if (bookingType === 'offer') {
        // عرض قسم العروض
        await displayCustomerOffers();
        if (offersSection) offersSection.classList.remove('hidden');
    } else if (bookingType === 'laser') {
        // استخدام رصيد الليزر
        updateBalanceDisplay('laser');
    } else if (bookingType === 'derma') {
        // استخدام رصيد الجلدية
        updateBalanceDisplay('derma');
    } else {
        // رصيد عادي
        updateBalanceDisplay('normal');
    }
}

// عرض عروض العميل
async function displayCustomerOffers() {
    const offersContainer = document.getElementById('availableOffers');
    if (!offersContainer) return;
    
    offersContainer.innerHTML = '<div class="loading">جاري تحميل العروض...</div>';
    
    await loadCustomerOffers(selectedCustomer.id);
    
    if (customerOffers.length === 0) {
        offersContainer.innerHTML = '<div class="empty-state">⚠️ لا توجد عروض متاحة لهذا العميل</div>';
        return;
    }
    
    offersContainer.innerHTML = '';
    
    customerOffers.forEach(offer => {
        const offerCard = document.createElement('div');
        offerCard.className = 'offer-card';
        
        const purchaseDate = offer.purchaseDate ? offer.purchaseDate.toDate().toLocaleDateString('ar-EG') : '-';
        const progress = (offer.remainingSessions / offer.totalSessions) * 100;
        
        offerCard.innerHTML = `
            <div class="offer-header">
                <input type="radio" name="selectedOffer" value="${offer.id}" id="offer-${offer.id}">
                <label for="offer-${offer.id}">
                    <strong>${offer.offerName}</strong>
                </label>
            </div>
            <div class="offer-details">
                <div class="offer-sessions">
                    <span>الجلسات المتبقية:</span>
                    <strong class="sessions-count">${offer.remainingSessions} من ${offer.totalSessions}</strong>
                </div>
                <div class="offer-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                </div>
                <div class="offer-meta">
                    <span>تاريخ الشراء: ${purchaseDate}</span>
                </div>
            </div>
        `;
        
        offersContainer.appendChild(offerCard);
        
        // استماع لاختيار العرض
        const radio = offerCard.querySelector('input[type="radio"]');
        radio.addEventListener('change', function() {
            if (this.checked) {
                // تحديث التكلفة إلى صفر عند استخدام العرض
                document.getElementById('totalCost').textContent = '0.00';
                document.getElementById('bookingCostDisplay').textContent = '0.00';
                updateBalanceStatus(selectedCustomer.balance, 0);
            }
        });
    });
}

// تحديث عرض الرصيد حسب النوع
function updateBalanceDisplay(type) {
    const balanceInfo = document.getElementById('customerBalanceInfo');
    const currentBalanceEl = document.getElementById('currentCustomerBalance');
    const rechargeBtn = document.getElementById('rechargeBalanceBtn');
    
    if (!selectedCustomer || !balanceInfo || !currentBalanceEl) return;
    
    let balance = 0;
    let balanceTypeName = '';
    
    switch(type) {
        case 'laser':
            balance = selectedCustomer.laserBalance || 0;
            balanceTypeName = 'رصيد الليزر';
            break;
        case 'derma':
            balance = selectedCustomer.dermaBalance || 0;
            balanceTypeName = 'رصيد الجلدية';
            break;
        default:
            balance = selectedCustomer.balance || 0;
            balanceTypeName = 'الرصيد العادي';
    }
    
    currentBalanceEl.textContent = balance.toFixed(2);
    
    // تحديث عنوان القسم
    const balanceTitle = balanceInfo.querySelector('h4');
    if (balanceTitle) {
        balanceTitle.textContent = `💰 ${balanceTypeName}`;
    }
    
    const totalCost = parseFloat(document.getElementById('totalCost').textContent) || 0;
    updateBalanceStatus(balance, totalCost);
}

function setupRealtimeAlerts() {
    const q = query(
        collection(db, "receptionAlerts"),
        where("doctorId", "==", currentDoctorId),
        where("status", "==", "pending"),
        orderBy("createdAt", "desc")
    );
    
    if (unsubscribeAlerts) {
        unsubscribeAlerts();
    }
    
    unsubscribeAlerts = onSnapshot(q, (querySnapshot) => {
        pendingAlerts = [];
        querySnapshot.forEach(doc => {
            pendingAlerts.push({ id: doc.id, ...doc.data() });
        });
        
        if (pendingAlerts.length > 0) {
            playAlertSound();
        }
    }, (error) => {
        console.error('❌ خطأ في الاستماع للتنبيهات:', error);
    });
}

function playAlertSound() {
    try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHGS57OihUBELTKXh8bllHgU2jdXzxnkpBSh+zPLaizsIGGS56+mjUxEJS6Hd8bpmHwU0iM/zy3UsBS1+zPDaizsIGGO46+qiUhEJSp/c8bplHwU0h87zynUsBS1+y+/biz0IFWO36OiiURAJSZ7b8bhkHgQzhs3zyHQrBSt8ye7Zij4IF2K15+ihTxAJR5zZ77hjHQQyhczyw3MrBCp6x+zYiT4IF2G05+efTQ8JRprX7rZiHAQxg8ryvXIqBCl4xurWiD0HFl+y5eadTAkIP5jV7LVhGwMwgcjxu3AoBCh1xerUhzwHFVyv4uSbSggHPZbT6rNfGgIvf8bwuG4nAydyweHP');
        audio.play().catch(err => console.log('لا يمكن تشغيل الصوت:', err));
    } catch (e) {
        console.log('خطأ في تشغيل الصوت:', e);
    }
}

function loadScheduleRealtime() {
    const bookingsCards = document.getElementById('bookingsCards');
    bookingsCards.innerHTML = '<div class="loading">جاري تحميل الحجوزات...</div>';
    
    if (unsubscribeBookings) {
        unsubscribeBookings();
    }
    
    try {
        const selectedDate = new Date(currentDate + 'T00:00:00');
        const nextDate = new Date(selectedDate);
        nextDate.setDate(nextDate.getDate() + 1);
        
        const q = query(
            collection(db, "bookings"),
            where("doctorId", "==", currentDoctorId),
            where("bookingDate", ">=", Timestamp.fromDate(selectedDate)),
            where("bookingDate", "<", Timestamp.fromDate(nextDate)),
            orderBy("bookingDate"),
            orderBy("bookingTime")
        );
        
        unsubscribeBookings = onSnapshot(q, (querySnapshot) => {
            if (querySnapshot.empty) {
                bookingsCards.innerHTML = '<div class="empty-state">لا توجد حجوزات لهذا اليوم</div>';
                return;
            }
            
            const bookings = [];
            querySnapshot.forEach(docSnap => {
                const data = docSnap.data();
                bookings.push({ id: docSnap.id, ...data });
            });
            
            displayBookings(bookings);
        }, (error) => {
            console.error("❌ خطأ في الاستماع للحجوزات:", error);
            bookingsCards.innerHTML = '<div class="error">حدث خطأ في تحميل الحجوزات: ' + error.message + '</div>';
        });
        
    } catch (error) {
        console.error("❌ خطأ في إعداد الاستماع للحجوزات:", error);
        bookingsCards.innerHTML = '<div class="error">حدث خطأ في تحميل الحجوزات: ' + error.message + '</div>';
    }
}

function displayBookings(bookings) {
    const bookingsCards = document.getElementById('bookingsCards');
    bookingsCards.innerHTML = '';
    
    bookings.forEach(booking => {
        try {
            const card = createBookingCard(booking);
            bookingsCards.appendChild(card);
        } catch (error) {
            console.error('❌ خطأ في إنشاء بطاقة الحجز:', booking.id, error);
        }
    });
}

function createBookingCard(booking) {
    const card = document.createElement('div');
    card.className = `booking-card status-${booking.status || 'pending'}`;
    
    const services = booking.services || [];
    const servicesHTML = services.map(s => `
        <div class="service-item">📌 ${s.name || 'غير محدد'} (${s.duration || 0} دقيقة - ${(s.price || 0).toFixed(2)} جنيه)</div>
    `).join('');
    
    // إضافة معلومات نوع الحجز
    let bookingTypeInfo = '';
    if (booking.bookingType === 'offer' && booking.offerName) {
        bookingTypeInfo = `
            <div class="booking-type-badge offer">
                🎁 حجز بعرض: ${booking.offerName}
            </div>
        `;
    } else if (booking.bookingType === 'laser') {
        bookingTypeInfo = '<div class="booking-type-badge laser">✨ حجز برصيد الليزر</div>';
    } else if (booking.bookingType === 'derma') {
        bookingTypeInfo = '<div class="booking-type-badge derma">🧴 حجز برصيد الجلدية</div>';
    }
    
    const statusConfig = {
        'pending': { text: 'جاري', class: 'status-yellow' },
        'confirmed': { text: 'مؤكد', class: 'status-green' },
        'started': { text: 'بدأت', class: 'status-blue' },
        'pending_payment': { text: 'بدأت - يوجد خدمات غير مدفوعة', class: 'status-orange' },
        'completed': { text: 'انتهت', class: 'status-gray' },
        'cancelled': { text: 'ملغي', class: 'status-red' }
    };
    
    const statusInfo = statusConfig[booking.status] || { text: booking.status || 'غير محدد', class: 'status-default' };
    
    let actionButtons = '';
    
    if (booking.status === 'pending') {
        if (booking.isNewCustomer) {
            actionButtons = `
                <div class="new-customer-badge">⚠️ عميل جديد - يحتاج تأكيد وإنشاء حساب</div>
                <button class="confirm-btn" data-booking-id="${booking.id}" data-action="confirm">✓ تأكيد وإنشاء الحساب</button>
                <button class="cancel-btn" data-booking-id="${booking.id}" data-action="cancel">✕ إلغاء الحجز</button>
            `;
        } else {
            actionButtons = `
                <button class="confirm-btn" data-booking-id="${booking.id}" data-action="confirm">✓ تأكيد الحجز</button>
                <button class="cancel-btn" data-booking-id="${booking.id}" data-action="cancel">✕ إلغاء الحجز</button>
            `;
        }
    } else if (booking.status === 'confirmed') {
        actionButtons = `
            <button class="start-btn" data-booking-id="${booking.id}" data-action="start">▶️ بدء الجلسة</button>
            <button class="cancel-btn" data-booking-id="${booking.id}" data-action="cancel">✕ إلغاء الحجز</button>
        `;
    } else if (booking.status === 'started') {
        actionButtons = `
            <button class="complete-btn" data-booking-id="${booking.id}" data-action="complete">✔️ إنهاء الجلسة</button>
            <div class="started-badge">⏱️ الجلسة نشطة</div>
        `;
    } else if (booking.status === 'completed') {
        actionButtons = `<div class="completed-badge">✅ تم الانتهاء بنجاح</div>`;
    } else if (booking.status === 'cancelled') {
        actionButtons = `<div class="cancelled-badge">✕ تم الإلغاء</div>`;
    }
    
    card.innerHTML = `
        <div class="booking-header">
            <div class="booking-time">
                <span class="time-label">الموعد:</span>
                <span class="time-value">${booking.bookingTime || '--:--'} - ${booking.endTime || '--:--'}</span>
            </div>
            <div class="booking-status ${statusInfo.class}">${statusInfo.text}</div>
        </div>
        
        ${bookingTypeInfo}
        
        <div class="booking-body">
            <div class="customer-info">
                <h3>${booking.customerName || 'غير محدد'}</h3>
                <p>📱 ${booking.customerPhone || 'غير محدد'}</p>
            </div>
            
            <div class="services-list">
                <strong>الخدمات المحجوزة:</strong>
                ${servicesHTML || '<div>لا توجد خدمات</div>'}
            </div>
            
            <div class="booking-meta">
                <div>💰 التكلفة الإجمالية: <strong>${(booking.totalCost || 0).toFixed(2)} جنيه</strong></div>
                <div>⏱️ المدة الكلية: <strong>${booking.totalDuration || 0} دقيقة</strong></div>
                <div>👤 تم الحجز بواسطة: <strong>${booking.createdBy || 'غير محدد'}</strong></div>
            </div>
            
            ${booking.cancelReason ? `<div class="cancel-reason">❌ سبب الإلغاء: ${booking.cancelReason}</div>` : ''}
        </div>
        
        <div class="booking-actions">
            ${actionButtons}
        </div>
    `;
    
    // إضافة معالجات الأحداث
    const confirmBtn = card.querySelector('[data-action="confirm"]');
    const cancelBtn = card.querySelector('[data-action="cancel"]');
    const startBtn = card.querySelector('[data-action="start"]');
    const completeBtn = card.querySelector('[data-action="complete"]');
    
    if (confirmBtn) {
        confirmBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (!this.disabled) {
                this.disabled = true;
                confirmBooking(booking.id, booking.isNewCustomer, booking).finally(() => {
                    this.disabled = false;
                });
            }
        });
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (!this.disabled) {
                this.disabled = true;
                showCancelModal(booking.id, booking.isNewCustomer);
                setTimeout(() => { this.disabled = false; }, 500);
            }
        });
    }
    
    if (startBtn) {
        startBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (!this.disabled) {
                this.disabled = true;
                startSession(booking.id).finally(() => {
                    this.disabled = false;
                });
            }
        });
    }
    
    if (completeBtn) {
        completeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (!this.disabled) {
                this.disabled = true;
                completeSession(booking.id).finally(() => {
                    this.disabled = false;
                });
            }
        });
    }
    
    return card;
}

function showAddBookingModal() {
    const modal = document.getElementById('addBookingModal');
    if (modal) {
        modal.classList.remove('hidden');
    }
    document.getElementById('bookingTime').value = '';
    document.getElementById('servicesCount').value = '1';
    document.getElementById('bookingType').value = 'normal';
    updateServicesInputs();
    updateSearchPlaceholder();
    
    // إخفاء قسم العروض عند فتح المودال
    const offersSection = document.getElementById('offersSection');
    if (offersSection) offersSection.classList.add('hidden');
}

function hideAddBookingModal() {
    const modal = document.getElementById('addBookingModal');
    if (modal) {
        modal.classList.add('hidden');
    }
    document.getElementById('addBookingForm').reset();
    selectedServices = [];
    selectedCustomer = null;
    customerOffers = [];
    originalTotalCost = 0;
    currentDiscount = 0;
    
    // إخفاء صف التخفيض
    const discountRow = document.getElementById('discountRow');
    if (discountRow) discountRow.style.display = 'none';
    
    const balanceInfo = document.getElementById('customerBalanceInfo');
    if (balanceInfo) {
        balanceInfo.classList.add('hidden');
    }
    
    const offersSection = document.getElementById('offersSection');
    if (offersSection) offersSection.classList.add('hidden');
}

function handleCustomerTypeChange() {
    const type = document.getElementById('customerType').value;
    
    const newSection = document.getElementById('newCustomerSection');
    const existingSection = document.getElementById('existingCustomerSection');
    const balanceInfo = document.getElementById('customerBalanceInfo');
    const bookingTypeSection = document.getElementById('bookingTypeSection');
    const offersSection = document.getElementById('offersSection');
    
    if (newSection) {
        newSection.classList.toggle('hidden', type !== 'new');
    }
    if (existingSection) {
        existingSection.classList.toggle('hidden', type !== 'existing');
    }
    if (balanceInfo) {
        balanceInfo.classList.add('hidden');
    }
    if (bookingTypeSection) {
        bookingTypeSection.classList.toggle('hidden', type !== 'existing');
    }
    if (offersSection) {
        offersSection.classList.add('hidden');
    }
    
    // إعادة تعيين نوع الحجز
    if (document.getElementById('bookingType')) {
        document.getElementById('bookingType').value = 'normal';
    }
}

// تحديث النص التوضيحي لخانة البحث
function updateSearchPlaceholder() {
    const searchFilter = document.getElementById('searchFilter');
    const searchInput = document.getElementById('customerSearch');
    
    if (!searchFilter || !searchInput) return;
    
    const placeholders = {
        'all': 'ابحث بأي معلومة (اسم، هاتف، رقم تعريفي)...',
        'id': 'ابحث بالرقم التعريفي فقط (مثال: 10)...',
        'phone': 'ابحث برقم الهاتف فقط...',
        'name': 'ابحث بالاسم فقط...'
    };
    
    searchInput.placeholder = placeholders[searchFilter.value] || placeholders['all'];
}

function searchCustomers() {
    const searchTerm = document.getElementById('customerSearch').value.toLowerCase();
    const searchFilter = document.getElementById('searchFilter').value;
    const resultsContainer = document.getElementById('customerResults');
    
    if (!resultsContainer) return;
    
    if (searchTerm.length < 1) {
        resultsContainer.classList.add('hidden');
        return;
    }
    
    let filtered = [];
    
    switch(searchFilter) {
        case 'id':
            // بحث بالرقم التعريفي فقط - مطابقة دقيقة
            filtered = allCustomers.filter(c => 
                c.displayId.toLowerCase() === searchTerm.toLowerCase()
            );
            break;
            
        case 'phone':
            // بحث برقم الهاتف فقط
            filtered = allCustomers.filter(c => 
                c.phone.includes(searchTerm)
            );
            break;
            
        case 'name':
            // بحث بالاسم فقط
            filtered = allCustomers.filter(c => 
                c.name.toLowerCase().includes(searchTerm)
            );
            break;
            
        default: // 'all'
            // بحث شامل
            filtered = allCustomers.filter(c => 
                c.name.toLowerCase().includes(searchTerm) ||
                c.phone.includes(searchTerm) ||
                c.displayId.includes(searchTerm)
            );
    }
    
    resultsContainer.innerHTML = '';
    
    if (filtered.length === 0) {
        const noResults = document.createElement('div');
        noResults.className = 'customer-result-item';
        noResults.style.textAlign = 'center';
        noResults.style.color = '#999';
        noResults.innerHTML = '<strong>لا توجد نتائج</strong>';
        resultsContainer.appendChild(noResults);
    } else {
        filtered.forEach(customer => {
            const item = document.createElement('div');
            item.className = 'customer-result-item';
            const balanceClass = customer.balance > 0 ? 'positive' : 'zero';
            item.innerHTML = `
                <div><strong>${customer.name}</strong></div>
                <div>
                    📱 ${customer.phone} | 
                    🔢 ${customer.displayId} | 
                    💰 <span class="${balanceClass}">${customer.balance.toFixed(2)} جنيه</span>
                </div>
            `;
            item.addEventListener('click', () => selectCustomer(customer));
            resultsContainer.appendChild(item);
        });
    }
    
    resultsContainer.classList.remove('hidden');
}

async function selectCustomer(customer) {
    selectedCustomer = customer;
    
    const selectedInfo = document.getElementById('selectedCustomerInfo');
    const selectedName = document.getElementById('selectedCustomerName');
    const selectedBalance = document.getElementById('selectedCustomerBalance');
    const customerResults = document.getElementById('customerResults');
    const customerSearch = document.getElementById('customerSearch');
    const balanceInfo = document.getElementById('customerBalanceInfo');
    const currentBalance = document.getElementById('currentCustomerBalance');
    const bookingTypeSection = document.getElementById('bookingTypeSection');
    
    if (selectedInfo) selectedInfo.classList.remove('hidden');
    if (selectedName) selectedName.textContent = customer.name;
    if (selectedBalance) selectedBalance.textContent = customer.balance.toFixed(2);
    if (customerResults) customerResults.classList.add('hidden');
    if (customerSearch) customerSearch.value = customer.name;
    
    if (balanceInfo) balanceInfo.classList.remove('hidden');
    if (currentBalance) currentBalance.textContent = customer.balance.toFixed(2);
    if (bookingTypeSection) bookingTypeSection.classList.remove('hidden');
    
    // تحميل عروض العميل
    await loadCustomerOffers(customer.id);
    
    const totalCost = parseFloat(document.getElementById('totalCost').textContent) || 0;
    const bookingCostDisplay = document.getElementById('bookingCostDisplay');
    if (bookingCostDisplay) {
        bookingCostDisplay.textContent = totalCost.toFixed(2);
    }
    
    updateBalanceStatus(customer.balance, totalCost);
}

function updateBalanceStatus(balance, totalCost) {
    if (!totalCost) {
        totalCost = parseFloat(document.getElementById('totalCost').textContent) || 0;
    }
    
    const remainingBalance = balance - totalCost;
    const remainingEl = document.getElementById('remainingBalanceAfter');
    const rechargeBtn = document.getElementById('rechargeBalanceBtn');
    
    if (remainingEl) {
        remainingEl.textContent = remainingBalance.toFixed(2);
        
        if (remainingBalance < 0) {
            remainingEl.style.color = '#dc3545';
            remainingEl.parentElement.style.background = 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)';
            if (rechargeBtn) rechargeBtn.classList.remove('hidden');
        } else if (remainingBalance === 0) {
            remainingEl.style.color = '#ff9800';
            remainingEl.parentElement.style.background = 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)';
            if (rechargeBtn) rechargeBtn.classList.add('hidden');
        } else {
            remainingEl.style.color = '#28a745';
            remainingEl.parentElement.style.background = 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)';
            if (rechargeBtn) rechargeBtn.classList.add('hidden');
        }
    }
}

function updateServicesInputs() {
    const count = parseInt(document.getElementById('servicesCount').value) || 1;
    const container = document.getElementById('servicesInputs');
    container.innerHTML = '';
    
    for (let i = 1; i <= count; i++) {
        const div = document.createElement('div');
        div.className = 'service-input-group';
        div.innerHTML = `
            <label>الخدمة ${i}:</label>
            <select class="service-select" data-index="${i-1}" required>
                <option value="">اختر الخدمة</option>
                ${allServices.map(s => `
                    <option value="${s.id}" data-duration="${s.duration}" data-price="${s.price}">
                        ${s.name} - ${s.duration} دقيقة - ${s.price.toFixed(2)} جنيه
                    </option>
                `).join('')}
            </select>
        `;
        container.appendChild(div);
    }
    
    document.querySelectorAll('.service-select').forEach(select => {
        select.addEventListener('change', calculateTotalCostAndDuration);
    });
}

function calculateTotalCostAndDuration() {
    selectedServices = [];
    let totalCost = 0;
    let totalDuration = 0;
    
    document.querySelectorAll('.service-select').forEach(select => {
        if (select.value) {
            const service = allServices.find(s => s.id === select.value);
            if (service) {
                selectedServices.push(service);
                totalCost += service.price;
                totalDuration += service.duration;
            }
        }
    });
    
    // حفظ التكلفة الأصلية
    originalTotalCost = totalCost;
    
    // تطبيق التخفيض إذا كان موجوداً
    const finalCost = totalCost - currentDiscount;
    
    // إذا كان نوع الحجز بالعرض، التكلفة تكون صفر
    const bookingType = document.getElementById('bookingType')?.value;
    if (bookingType === 'offer') {
        document.getElementById('totalCost').textContent = '0.00';
        document.getElementById('originalCost').textContent = totalCost.toFixed(2);
    } else {
        document.getElementById('totalCost').textContent = finalCost.toFixed(2);
        document.getElementById('originalCost').textContent = totalCost.toFixed(2);
    }
    
    // عرض صف التخفيض إذا كان هناك تخفيض
    const discountRow = document.getElementById('discountRow');
    if (currentDiscount > 0 && bookingType !== 'offer') {
        const discountPercent = ((currentDiscount / originalTotalCost) * 100).toFixed(0);
        document.getElementById('discountAmount').textContent = currentDiscount.toFixed(2);
        document.getElementById('discountPercent').textContent = discountPercent;
        if (discountRow) discountRow.style.display = 'flex';
    } else {
        if (discountRow) discountRow.style.display = 'none';
    }
    
    document.getElementById('totalDuration').textContent = totalDuration;
    
    const bookingCostDisplay = document.getElementById('bookingCostDisplay');
    if (bookingCostDisplay) {
        bookingCostDisplay.textContent = (bookingType === 'offer' ? 0 : finalCost).toFixed(2);
    }
    
    if (selectedCustomer) {
        const currentBookingType = document.getElementById('bookingType')?.value || 'normal';
        let balance = selectedCustomer.balance;
        
        if (currentBookingType === 'laser') {
            balance = selectedCustomer.laserBalance || 0;
        } else if (currentBookingType === 'derma') {
            balance = selectedCustomer.dermaBalance || 0;
        }
        
        updateBalanceStatus(balance, bookingType === 'offer' ? 0 : finalCost);
    }
    
    calculateEndTime();
}

function calculateEndTime() {
    const startTime = document.getElementById('bookingTime').value;
    if (!startTime) return;
    
    const totalDuration = parseInt(document.getElementById('totalDuration').textContent) || 0;
    if (totalDuration === 0) return;
    
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + totalDuration;
    const endHours = Math.floor(totalMinutes / 60);
    const endMinutes = totalMinutes % 60;
    
    const endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
    document.getElementById('endTime').textContent = endTime;
}

// عرض نافذة تعديل السعر
function showEditPriceModal() {
    if (originalTotalCost === 0) {
        alert('⚠️ يجب اختيار الخدمات أولاً!');
        return;
    }
    
    const bookingType = document.getElementById('bookingType')?.value;
    if (bookingType === 'offer') {
        alert('⚠️ لا يمكن تعديل السعر عند الحجز بعرض!');
        return;
    }
    
    const minAllowedPrice = originalTotalCost * 0.5; // 50% كحد أدنى
    const currentFinalCost = parseFloat(document.getElementById('totalCost').textContent);
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'editPriceModal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>✏️ تعديل السعر</h3>
                <button class="close-btn" onclick="closeEditPriceModal()">✕</button>
            </div>
            <div class="modal-body">
                <div class="price-info-section" style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                    <div class="info-row" style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <span>السعر الأصلي:</span>
                        <strong>${originalTotalCost.toFixed(2)} جنيه</strong>
                    </div>
                    <div class="info-row" style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <span>السعر الحالي:</span>
                        <strong>${currentFinalCost.toFixed(2)} جنيه</strong>
                    </div>
                    <div class="info-row warning" style="display: flex; justify-content: space-between; background: #fff3cd; padding: 10px; border-radius: 8px;">
                        <span>⚠️ الحد الأدنى المسموح:</span>
                        <strong>${minAllowedPrice.toFixed(2)} جنيه (50%)</strong>
                    </div>
                </div>
                
                <div class="input-group">
                    <label>السعر الجديد:</label>
                    <input type="number" id="newPriceInput" step="0.01" min="${minAllowedPrice}" max="${originalTotalCost}" value="${currentFinalCost}" required>
                    <small style="color: #666;">يجب أن يكون السعر بين ${minAllowedPrice.toFixed(2)} و ${originalTotalCost.toFixed(2)} جنيه</small>
                </div>
                
                <div class="input-group">
                    <label>نسبة التخفيض:</label>
                    <input type="range" id="discountSlider" min="0" max="50" value="${(currentDiscount / originalTotalCost * 100).toFixed(0)}" step="1" style="width: 100%;">
                    <div style="text-align: center; font-size: 18px; font-weight: bold; color: #667eea; margin-top: 10px;">
                        <span id="discountPercentDisplay">${(currentDiscount / originalTotalCost * 100).toFixed(0)}</span>%
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="save-btn" onclick="applyPriceEdit()">✅ تطبيق</button>
                <button class="cancel-btn" onclick="closeEditPriceModal()">إلغاء</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // ربط السلايدر مع الإدخال
    const slider = document.getElementById('discountSlider');
    const priceInput = document.getElementById('newPriceInput');
    const percentDisplay = document.getElementById('discountPercentDisplay');
    
    slider.addEventListener('input', function() {
        const discountPercent = parseFloat(this.value);
        const discountAmount = originalTotalCost * (discountPercent / 100);
        const newPrice = originalTotalCost - discountAmount;
        priceInput.value = newPrice.toFixed(2);
        percentDisplay.textContent = discountPercent;
    });
    
    priceInput.addEventListener('input', function() {
        const newPrice = parseFloat(this.value);
        if (newPrice >= minAllowedPrice && newPrice <= originalTotalCost) {
            const discountAmount = originalTotalCost - newPrice;
            const discountPercent = (discountAmount / originalTotalCost * 100).toFixed(0);
            slider.value = discountPercent;
            percentDisplay.textContent = discountPercent;
        }
    });
}

window.closeEditPriceModal = function() {
    const modal = document.getElementById('editPriceModal');
    if (modal) modal.remove();
};

window.applyPriceEdit = function() {
    const newPrice = parseFloat(document.getElementById('newPriceInput').value);
    const minAllowedPrice = originalTotalCost * 0.5;
    
    if (!newPrice || isNaN(newPrice)) {
        alert('⚠️ يرجى إدخال سعر صحيح!');
        return;
    }
    
    if (newPrice < minAllowedPrice) {
        alert(`⚠️ السعر أقل من الحد الأدنى المسموح (${minAllowedPrice.toFixed(2)} جنيه)!`);
        return;
    }
    
    if (newPrice > originalTotalCost) {
        alert('⚠️ لا يمكن زيادة السعر عن السعر الأصلي!');
        return;
    }
    
    // حساب التخفيض
    currentDiscount = originalTotalCost - newPrice;
    const discountPercent = ((currentDiscount / originalTotalCost) * 100).toFixed(0);
    
    // تحديث العرض
    document.getElementById('totalCost').textContent = newPrice.toFixed(2);
    document.getElementById('discountAmount').textContent = currentDiscount.toFixed(2);
    document.getElementById('discountPercent').textContent = discountPercent;
    
    const discountRow = document.getElementById('discountRow');
    if (currentDiscount > 0) {
        if (discountRow) discountRow.style.display = 'flex';
    } else {
        if (discountRow) discountRow.style.display = 'none';
    }
    
    // تحديث معلومات الرصيد
    if (selectedCustomer) {
        const bookingType = document.getElementById('bookingType')?.value || 'normal';
        let balance = selectedCustomer.balance;
        
        if (bookingType === 'laser') {
            balance = selectedCustomer.laserBalance || 0;
        } else if (bookingType === 'derma') {
            balance = selectedCustomer.dermaBalance || 0;
        }
        
        const bookingCostDisplay = document.getElementById('bookingCostDisplay');
        if (bookingCostDisplay) {
            bookingCostDisplay.textContent = newPrice.toFixed(2);
        }
        
        updateBalanceStatus(balance, newPrice);
    }
    
    alert(`✅ تم تطبيق التخفيض بنجاح!\nالسعر الجديد: ${newPrice.toFixed(2)} جنيه\nالتخفيض: ${currentDiscount.toFixed(2)} جنيه (${discountPercent}%)`);
    closeEditPriceModal();
};

async function validateBookingTime(bookingDate, bookingTime, totalDuration) {
    const now = new Date();
    const bookingDateTime = new Date(bookingDate + 'T' + bookingTime);
    
    if (bookingDateTime <= now) {
        return {
            valid: false,
            message: '⚠️ لا يمكن الحجز في وقت مضى! يرجى اختيار وقت مستقبلي.'
        };
    }
    
    const [hours, minutes] = bookingTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + totalDuration;
    const endHours = Math.floor(totalMinutes / 60);
    const endMinutes = totalMinutes % 60;
    const endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
    
    try {
        const selectedDate = new Date(bookingDate + 'T00:00:00');
        const nextDate = new Date(selectedDate);
        nextDate.setDate(selectedDate.getDate() + 1);
        
        const q = query(
            collection(db, "bookings"),
            where("doctorId", "==", currentDoctorId),
            where("bookingDate", ">=", Timestamp.fromDate(selectedDate)),
            where("bookingDate", "<", Timestamp.fromDate(nextDate)),
            where("status", "in", ["pending", "confirmed", "started"])
        );
        
        const querySnapshot = await getDocs(q);
        
        for (const docSnap of querySnapshot.docs) {
            const booking = docSnap.data();
            
            const existingStart = timeToMinutes(booking.bookingTime);
            const existingEnd = timeToMinutes(booking.endTime);
            const newStart = timeToMinutes(bookingTime);
            const newEnd = timeToMinutes(endTime);
            
            if ((newStart >= existingStart && newStart < existingEnd) ||
                (newEnd > existingStart && newEnd <= existingEnd) ||
                (newStart <= existingStart && newEnd >= existingEnd)) {
                return {
                    valid: false,
                    message: `⚠️ يوجد تداخل مع حجز آخر!\nالحجز الموجود: ${booking.bookingTime} - ${booking.endTime} (${booking.customerName})\nيرجى اختيار وقت بعد ${booking.endTime}`
                };
            }
        }
        
        return { valid: true, endTime };
        
    } catch (error) {
        console.error("خطأ في التحقق:", error);
        return {
            valid: false,
            message: '❌ حدث خطأ في التحقق من الأوقات'
        };
    }
}

function timeToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}

async function addNewBooking(e) {
    e.preventDefault();
    
    const customerType = document.getElementById('customerType').value;
    const bookingTime = document.getElementById('bookingTime').value;
    const totalCost = parseFloat(document.getElementById('totalCost').textContent);
    const totalDuration = parseInt(document.getElementById('totalDuration').textContent);
    const bookingType = document.getElementById('bookingType')?.value || 'normal';
    
    if (selectedServices.length === 0) {
        alert('⚠️ يرجى اختيار الخدمات!');
        return;
    }
    
    if (!bookingTime) {
        alert('⚠️ يرجى تحديد وقت الحجز!');
        return;
    }
    
    const validation = await validateBookingTime(currentDate, bookingTime, totalDuration);
    if (!validation.valid) {
        alert(validation.message);
        return;
    }
    
    const endTime = validation.endTime;
    
    // التحقق من العرض المختار إذا كان نوع الحجز بالعرض
    let selectedOfferId = null;
    let selectedOfferName = null;
    
    if (bookingType === 'offer') {
        const selectedOfferRadio = document.querySelector('input[name="selectedOffer"]:checked');
        if (!selectedOfferRadio) {
            alert('⚠️ يرجى اختيار عرض من القائمة!');
            return;
        }
        selectedOfferId = selectedOfferRadio.value;
        const selectedOffer = customerOffers.find(o => o.id === selectedOfferId);
        if (!selectedOffer) {
            alert('❌ خطأ في اختيار العرض!');
            return;
        }
        if (selectedOffer.remainingSessions <= 0) {
            alert('⚠️ لا توجد جلسات متبقية في هذا العرض!');
            return;
        }
        selectedOfferName = selectedOffer.offerName;
    }
    
    try {
        let customerId, customerName, customerPhone, isNewCustomer = false;
        
        if (customerType === 'new') {
            customerName = document.getElementById('newCustomerName').value.trim();
            customerPhone = document.getElementById('newCustomerPhone').value.trim();
            
            if (!customerName || !customerPhone) {
                alert('⚠️ يرجى إدخال اسم ورقم هاتف العميل!');
                return;
            }
            
            customerId = null;
            isNewCustomer = true;
            
        } else {
            if (!selectedCustomer) {
                alert('⚠️ يرجى اختيار عميل!');
                return;
            }
            
            customerId = selectedCustomer.id;
            customerName = selectedCustomer.name;
            customerPhone = selectedCustomer.phone;
        }
        
        const bookingData = {
            customerId,
            customerName,
            customerPhone,
            doctorId: currentDoctorId,
            doctorName: currentDoctorName,
            bookingDate: Timestamp.fromDate(new Date(currentDate + 'T00:00:00')),
            bookingTime,
            endTime,
            services: selectedServices.map(s => ({
                id: s.id,
                name: s.name,
                duration: s.duration,
                price: s.price
            })),
            totalCost,
            originalCost: originalTotalCost,
            discount: currentDiscount,
            totalDuration,
            status: 'pending',
            isNewCustomer,
            bookingType: bookingType,
            createdAt: Timestamp.now(),
            createdBy: currentUser.name
        };
        
        // إضافة معلومات العرض إذا كان الحجز بالعرض
        if (bookingType === 'offer' && selectedOfferId) {
            bookingData.offerId = selectedOfferId;
            bookingData.offerName = selectedOfferName;
        }
        
        await addDoc(collection(db, "bookings"), bookingData);
        
try {
    const shiftModule = await import('../shift-management/shift-management.js');
    if (shiftModule && shiftModule.addShiftAction) {
        let bookingNote = `تم إضافة حجز لـ ${customerName} - ${selectedServices.length} خدمة`;
        let shiftAmount = 0;
        let shiftPaymentMethod = null;

        if (bookingType === 'offer') {
            bookingNote += ` - حجز بعرض: ${selectedOfferName}`;
            shiftAmount = 0; // الحجز بالعرض بدون دفع
            shiftPaymentMethod = 'عرض';
        } else if (bookingType === 'laser') {
            bookingNote += ` - حجز برصيد الليزر`;
            shiftAmount = totalCost;
            shiftPaymentMethod = 'رصيد ليزر';
        } else if (bookingType === 'derma') {
            bookingNote += ` - حجز برصيد الجلدية`;
            shiftAmount = totalCost;
            shiftPaymentMethod = 'رصيد جلدية';
        } else {
            bookingNote += ` - ${totalCost.toFixed(2)} جنيه`;
            if (currentDiscount > 0) {
                bookingNote += ` (تخفيض ${currentDiscount.toFixed(2)} جنيه)`;
            }
            shiftAmount = totalCost;
            shiftPaymentMethod = 'حجز مسبق';
        }
        
        // ✅ الإصلاح: تمرير جميع البارامترات
        await shiftModule.addShiftAction(
            'إضافة حجز', 
            bookingNote,
            customerName,
            shiftAmount,
            shiftPaymentMethod,
            {
                actionCategory: 'booking',
                services: selectedServices.map(s => s.name),
                bookingType: bookingType,
                discount: currentDiscount
            }
        );
    }
} catch (err) {
    console.log('لا يمكن تسجيل في الشيفت:', err);
}
        
        alert('✅ تم إضافة الحجز بنجاح!');
        hideAddBookingModal();
        
    } catch (error) {
        console.error("خطأ في إضافة الحجز:", error);
        alert('❌ حدث خطأ: ' + error.message);
    }
}

window.confirmBooking = async function(bookingId, isNewCustomer, bookingData) {
    const bookingRef = doc(db, "bookings", bookingId);
    const bookingSnap = await getDoc(bookingRef);
    const booking = bookingSnap.data();
    
    if (isNewCustomer && !booking.customerId) {
        showPaymentModalForNewCustomer(bookingId, booking);
    } else {
        if (!confirm('هل تريد تأكيد هذا الحجز والدفع؟')) return;
        
        try {
            const bookingType = booking.bookingType || 'normal';
            
            // إذا كان الحجز بعرض، نخصم جلسة من العرض
            if (bookingType === 'offer' && booking.offerId) {
                await runTransaction(db, async (transaction) => {
                    const offerRef = doc(db, "customerOffers", booking.offerId);
                    const offerSnap = await transaction.get(offerRef);
                    
                    if (!offerSnap.exists()) {
                        throw new Error('العرض غير موجود!');
                    }
                    
                    const offerData = offerSnap.data();
                    if (offerData.remainingSessions <= 0) {
                        throw new Error('لا توجد جلسات متبقية في هذا العرض!');
                    }
                    
                    // خصم جلسة من العرض
                    transaction.update(offerRef, {
                        remainingSessions: offerData.remainingSessions - 1,
                        usedSessions: (offerData.usedSessions || 0) + 1,
                        updatedAt: Timestamp.now()
                    });
                    
                    // إضافة سجل استخدام العرض
                    const offerUsageRef = doc(collection(db, "offerUsage"));
                    transaction.set(offerUsageRef, {
                        offerId: booking.offerId,
                        customerId: booking.customerId,
                        customerName: booking.customerName,
                        bookingId: bookingId,
                        sessionUsed: 1,
                        remainingAfter: offerData.remainingSessions - 1,
                        services: booking.services,
                        usedAt: Timestamp.now(),
                        usedBy: currentUser.name
                    });
                    
                    // تأكيد الحجز
                    transaction.update(bookingRef, {
                        status: 'confirmed',
                        confirmedAt: Timestamp.now(),
                        confirmedBy: currentUser.name
                    });
                });
                
                alert('✅ تم تأكيد الحجز وخصم جلسة من العرض بنجاح!');
            } else {
                // الحجز بالرصيد العادي أو الليزر أو الجلدية
                const customerRef = doc(db, "customers", booking.customerId);
                const customerSnap = await getDoc(customerRef);
                const customerData = customerSnap.data();
                
                let currentBalance = 0;
                let balanceField = 'balance';
                let balanceTypeName = 'العادي';
                
                if (bookingType === 'laser') {
                    currentBalance = customerData.laserBalance || 0;
                    balanceField = 'laserBalance';
                    balanceTypeName = 'الليزر';
                } else if (bookingType === 'derma') {
                    currentBalance = customerData.dermaBalance || 0;
                    balanceField = 'dermaBalance';
                    balanceTypeName = 'الجلدية';
                } else {
                    currentBalance = customerData.balance || 0;
                }
                
                if (currentBalance < booking.totalCost) {
                    if (!confirm(`⚠️ رصيد ${balanceTypeName} غير كافٍ!\nالرصيد: ${currentBalance.toFixed(2)} جنيه\nالمطلوب: ${booking.totalCost.toFixed(2)} جنيه\nهل تريد المتابعة؟`)) {
                        return;
                    }
                }
                
                const newBalance = currentBalance - booking.totalCost;
                await updateDoc(customerRef, {
                    [balanceField]: newBalance,
                    totalSpent: increment(booking.totalCost),
                    updatedAt: Timestamp.now()
                });
                
                await addDoc(collection(db, "transactions"), {
                    customerId: booking.customerId,
                    customerName: booking.customerName,
                    type: 'withdrawal',
                    balanceType: bookingType === 'normal' ? 'normal' : bookingType,
                    amount: booking.totalCost,
                    previousBalance: currentBalance,
                    newBalance,
                    paymentMethod: 'رصيد داخلي',
                    services: booking.services,
                    bookingDate: booking.bookingDate,
                    notes: `حجز خدمات (رصيد ${balanceTypeName}) - ${booking.services.map(s => s.name).join(', ')} - يوم ${new Date(booking.bookingDate.toDate()).toLocaleDateString('ar-EG')}`,
                    createdAt: Timestamp.now(),
                    createdBy: currentUser.name
                });
                
                await updateDoc(bookingRef, {
                    status: 'confirmed',
                    confirmedAt: Timestamp.now(),
                    confirmedBy: currentUser.name
                });
                
                alert(`✅ تم تأكيد الحجز وخصم المبلغ من رصيد ${balanceTypeName} بنجاح!`);
            }
            
            // تسجيل في الشيفت - الإصدار المصحح بالكامل
            try {
                const shiftModule = await import('../shift-management/shift-management.js');
                if (shiftModule && shiftModule.addShiftAction) {
                    let actionNote = `تأكيد حجز ${booking.customerName} - ${booking.services.map(s => s.name).join(', ')}`;
                    let paymentMethod = 'رصيد داخلي';
                    let amountToRecord = 0; // ✅ الإصلاح: 0 لأن الدفع من الرصيد الداخلي
                    
                    if (bookingType === 'offer') {
                        actionNote += ` - بعرض: ${booking.offerName}`;
                        paymentMethod = 'عرض';
                        amountToRecord = 0; // الحجز بالعرض بدون دفع
                    } else if (bookingType === 'laser') {
                        paymentMethod = 'رصيد ليزر';
                        amountToRecord = 0; // ✅ لا تسجل الدفع عند استخدام الرصيد
                    } else if (bookingType === 'derma') {
                        paymentMethod = 'رصيد جلدية';
                        amountToRecord = 0; // ✅ لا تسجل الدفع عند استخدام الرصيد
                    }
                    
                    // ✅ التحقق من وجود شيفت نشط قبل التسجيل
                    const hasActiveShift = await shiftModule.hasActiveShift();
                    if (!hasActiveShift) {
                        console.log('⚠️ لا يوجد شيفت نشط - تم تخطي تسجيل الحجز في الشيفت');
                        return;
                    }
                    
                    // ✅ الإصلاح الكامل: تمرير جميع البارامترات المطلوبة
                    await shiftModule.addShiftAction(
                        'تأكيد حجز', 
                        actionNote,
                        booking.customerName,
                        amountToRecord,
                        paymentMethod,
                        { 
                            actionCategory: 'booking',
                            services: booking.services.map(s => s.name),
                            bookingType: bookingType,
                            customerId: booking.customerId,
                            bookingId: bookingId
                        }
                    );
                    
                    console.log('✅ تم تسجيل تأكيد الحجز في الشيفت بنجاح');
                }
            } catch (e) {
                console.log('لا يمكن تسجيل في الشيفت:', e);
            }
            
        } catch (error) {
            console.error("خطأ في تأكيد الحجز:", error);
            alert('❌ حدث خطأ: ' + (error.message || error));
        }
    }
};

window.startSession = async function(bookingId) {
    if (!confirm('هل تريد بدء الجلسة؟')) return;
    
    try {
        const bookingRef = doc(db, "bookings", bookingId);
        const bookingSnap = await getDoc(bookingRef);
        const booking = bookingSnap.data();
        
        await updateDoc(bookingRef, {
            status: 'started',
            startedAt: Timestamp.now(),
            startedBy: currentUser.name
        });
        
        const customerRef = doc(db, "customers", booking.customerId);
        const customerSnap = await getDoc(customerRef);
        const currentVisits = customerSnap.data().visitCount || 0;
        
        await updateDoc(customerRef, {
            visitCount: currentVisits + 1,
            updatedAt: Timestamp.now()
        });
        
        await addDoc(collection(db, "visits"), {
            customerId: booking.customerId,
            customerName: booking.customerName,
            visitDate: Timestamp.now(),
            doctorId: booking.doctorId,
            doctorName: booking.doctorName,
            services: booking.services,
            amount: booking.totalCost,
            bookingId,
            bookingType: booking.bookingType || 'normal',
            offerId: booking.offerId || null,
            offerName: booking.offerName || null,
            notes: booking.bookingType === 'offer' ? 
                `زيارة من خلال حجز بعرض: ${booking.offerName}` : 
                `زيارة من خلال حجز - ${booking.services.map(s => s.name).join(', ')}`,
            createdAt: Timestamp.now(),
            createdBy: currentUser.name
        });
        
try {
    const shiftModule = await import('../shift-management/shift-management.js');
    if (shiftModule && shiftModule.addShiftAction) {
        // ✅ الإصلاح: تمرير جميع البارامترات
        await shiftModule.addShiftAction(
            'بدء جلسة', 
            `بدأت جلسة ${booking.customerName} - ${booking.doctorName}`,
            booking.customerName,
            0, // بدون دفع إضافي
            null,
            { 
                actionCategory: 'session',
                services: booking.services.map(s => s.name)
            }
        );
    }
} catch (e) {
    console.log('لا يمكن تسجيل في الشيفت:', e);
}

alert('✅ تم بدء الجلسة وتسجيل الزيارة!');
} catch (error) {
console.error("خطأ في بدء الجلسة:", error);
alert('❌ حدث خطأ في بدء الجلسة');
}
};

window.completeSession = async function(bookingId) {
    if (!confirm('هل تريد إنهاء الجلسة؟')) return;
    
    try {
        const bookingRef = doc(db, "bookings", bookingId);
        const bookingSnap = await getDoc(bookingRef);
        const booking = bookingSnap.data();
        
        await updateDoc(bookingRef, {
            status: 'completed',
            completedAt: Timestamp.now(),
            completedBy: currentUser.name
        });
        
try {
    const shiftModule = await import('../shift-management/shift-management.js');
    if (shiftModule && shiftModule.addShiftAction) {
        // ✅ الإصلاح: تمرير جميع البارامترات
        await shiftModule.addShiftAction(
            'إكمال حجز', 
            `أنهيت جلسة ${booking.customerName} - ${booking.services?.map(s => s.name).join(', ') || 'خدمات'}`,
            booking.customerName,
            0, // بدون دفع إضافي
            null,
            { 
                actionCategory: 'session',
                services: booking.services?.map(s => s.name) || []
            }
        );
    }
} catch (e) {
    console.log('لا يمكن تسجيل في الشيفت:', e);
}

alert('✅ تم إنهاء الجلسة بنجاح!');
} catch (error) {
console.error("خطأ في إنهاء الجلسة:", error);
alert('❌ حدث خطأ في إنهاء الجلسة');
}
};

window.showCancelModal = function(bookingId, isNewCustomer) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>إلغاء الحجز</h3>
                <button class="close-btn" onclick="this.closest('.modal').remove()">✕</button>
            </div>
            <div class="modal-body">
                <p>اختر سبب الإلغاء:</p>
                <div class="cancel-reasons">
                    <label><input type="radio" name="cancelReason" value="العميل مردش"> العميل مردش</label>
                    <label><input type="radio" name="cancelReason" value="العميل مجاش"> العميل مجاش</label>
                    <label><input type="radio" name="cancelReason" value="other"> سبب آخر</label>
                </div>
                <textarea id="otherReason" class="hidden" placeholder="اكتب السبب..."></textarea>
            </div>
            <div class="modal-footer">
                <button class="save-btn" onclick="executeCancelBooking('${bookingId}', ${isNewCustomer})">تأكيد الإلغاء</button>
                <button class="cancel-btn" onclick="this.closest('.modal').remove()">إلغاء</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelectorAll('input[name="cancelReason"]').forEach(radio => {
        radio.addEventListener('change', function() {
            document.getElementById('otherReason').classList.toggle('hidden', this.value !== 'other');
        });
    });
};

window.executeCancelBooking = async function(bookingId, isNewCustomer) {
    const selectedReason = document.querySelector('input[name="cancelReason"]:checked');
    if (!selectedReason) {
        alert('⚠️ يرجى اختيار سبب الإلغاء');
        return;
    }
    
    let reason = selectedReason.value;
    if (reason === 'other') {
        reason = document.getElementById('otherReason').value.trim();
        if (!reason) {
            alert('⚠️ يرجى كتابة السبب');
            return;
        }
    }
    
    try {
        const bookingRef = doc(db, "bookings", bookingId);
        const bookingSnap = await getDoc(bookingRef);
        const booking = bookingSnap.data();
        
        // إرجاع المبلغ أو الجلسة إذا كان الحجز مؤكداً
        if (!isNewCustomer && booking.status === 'confirmed' && booking.customerId) {
            const bookingType = booking.bookingType || 'normal';
            
            if (bookingType === 'offer' && booking.offerId) {
                // إرجاع الجلسة للعرض
                const offerRef = doc(db, "customerOffers", booking.offerId);
                await updateDoc(offerRef, {
                    remainingSessions: increment(1),
                    usedSessions: increment(-1),
                    updatedAt: Timestamp.now()
                });
            } else {
                // إرجاع المبلغ للرصيد المناسب
                const customerRef = doc(db, "customers", booking.customerId);
                const customerSnap = await getDoc(customerRef);
                
                let balanceField = 'balance';
                let currentBalance = customerSnap.data().balance || 0;
                
                if (bookingType === 'laser') {
                    balanceField = 'laserBalance';
                    currentBalance = customerSnap.data().laserBalance || 0;
                } else if (bookingType === 'derma') {
                    balanceField = 'dermaBalance';
                    currentBalance = customerSnap.data().dermaBalance || 0;
                }
                
                const newBalance = currentBalance + booking.totalCost;
                
                await updateDoc(customerRef, {
                    [balanceField]: newBalance,
                    updatedAt: Timestamp.now()
                });
                
                await addDoc(collection(db, "transactions"), {
                    customerId: booking.customerId,
                    customerName: booking.customerName,
                    type: 'refund',
                    balanceType: bookingType === 'normal' ? 'normal' : bookingType,
                    amount: booking.totalCost,
                    previousBalance: currentBalance,
                    newBalance,
                    paymentMethod: 'إرجاع',
                    notes: `إرجاع مبلغ حجز ملغي - السبب: ${reason}`,
                    createdAt: Timestamp.now(),
                    createdBy: currentUser.name
                });
            }
        }
        
        await updateDoc(bookingRef, {
            status: 'cancelled',
            cancelReason: reason,
            cancelledAt: Timestamp.now(),
            cancelledBy: currentUser.name
        });
        
try {
    const shiftModule = await import('../shift-management/shift-management.js');
    if (shiftModule && shiftModule.addShiftAction) {
        // ✅ الإصلاح: تمرير جميع البارامترات
        await shiftModule.addShiftAction(
            'إلغاء حجز', 
            `تم إلغاء حجز ${booking.customerName} - السبب: ${reason}`,
            booking.customerName,
            0, // بدون دفع
            null,
            { 
                actionCategory: 'booking',
                cancelReason: reason
            }
        );
    }
} catch (e) {
    console.log('لا يمكن تسجيل في الشيفت:', e);
}

alert('✅ تم إلغاء الحجز' + (!isNewCustomer && booking.status === 'confirmed' ? ' وإرجاع المبلغ!' : '!'));
document.querySelector('.modal').remove();

} catch (error) {
console.error("خطأ في إلغاء الحجز:", error);
alert('❌ حدث خطأ في الإلغاء');
}
};

function showPaymentModalForNewCustomer(bookingId, booking) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'paymentModal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>💳 شحن رصيد العميل الجديد</h3>
                <button class="close-btn" onclick="document.getElementById('paymentModal').remove()">✕</button>
            </div>
            <div class="modal-body">
                <div class="customer-payment-info">
                    <p><strong>العميل:</strong> ${booking.customerName}</p>
                    <p><strong>الهاتف:</strong> ${booking.customerPhone}</p>
                    <p><strong>المبلغ المطلوب:</strong> ${booking.totalCost.toFixed(2)} جنيه</p>
                    <p><strong>الخدمات:</strong> ${booking.services.map(s => s.name).join(', ')}</p>
                </div>
                
                <div class="input-group">
                    <label>مبلغ الدفع:</label>
                    <input type="number" id="paymentAmount" step="0.01" min="0" value="${booking.totalCost.toFixed(2)}" required>
                </div>
                
                <div class="input-group">
                    <label>طريقة الدفع:</label>
                    <select id="paymentMethod" required>
                        <option value="نقدي">نقدي</option>
                        <option value="كاش">كاش</option>
                        <option value="فيزا">فيزا</option>
                    </select>
                </div>
            </div>
            <div class="modal-footer">
                <button class="save-btn" onclick="processNewCustomerPayment('${bookingId}')">تأكيد الدفع وإنشاء الحساب</button>
                <button class="cancel-btn" onclick="document.getElementById('paymentModal').remove()">إلغاء</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

window.processNewCustomerPayment = async function(bookingId) {
    const amount = parseFloat(document.getElementById('paymentAmount').value);
    const paymentMethod = document.getElementById('paymentMethod').value;
    
    if (!amount || amount <= 0) {
        alert('⚠️ أدخل مبلغ صحيح!');
        return;
    }
    
    try {
        const bookingRef = doc(db, "bookings", bookingId);
        const bookingSnap = await getDoc(bookingRef);
        const booking = bookingSnap.data();
        
        const phoneKey = booking.customerPhone.replace(/\s+/g, '');
        
        const customerId = await runTransaction(db, async (transaction) => {
            const counterRef = doc(db, "counters", "customersCounter");
            const phoneRef = doc(db, "customers_by_phone", phoneKey);
            
            const phoneSnap = await transaction.get(phoneRef);
            if (phoneSnap.exists()) {
                throw new Error('رقم الهاتف مسجل مسبقاً!');
            }
            
            const counterSnap = await transaction.get(counterRef);
            let nextSeq = 1;
            
            if (!counterSnap.exists()) {
                transaction.set(counterRef, { seq: 1, createdAt: Timestamp.now() });
            } else {
                nextSeq = (counterSnap.data().seq || 0) + 1;
                transaction.update(counterRef, { seq: nextSeq });
            }
            
            const docIdString = String(nextSeq);
            const customerRef = doc(db, "customers", docIdString);
            
            transaction.set(customerRef, {
                id: nextSeq,
                docId: docIdString,
                name: booking.customerName,
                phone: phoneKey,
                balance: amount - booking.totalCost,
                offersBalance: 0,
                laserBalance: 0,
                dermaBalance: 0,
                totalSpent: booking.totalCost,
                visitCount: 0,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            });
            
            transaction.set(phoneRef, {
                customerDocId: docIdString,
                createdAt: Timestamp.now()
            });
            
            return docIdString;
        });
        
        await addDoc(collection(db, "transactions"), {
            customerId,
            customerName: booking.customerName,
            type: 'payment',
            balanceType: 'normal',
            amount: booking.totalCost,
            paidAmount: amount,
            previousBalance: 0,
            newBalance: amount - booking.totalCost,
            paymentMethod,
            services: booking.services,
            bookingDate: booking.bookingDate,
            isNewCustomer: true,
            notes: `دفع مقابل خدمات - ${booking.services.map(s => s.name).join(', ')} - يوم ${new Date(booking.bookingDate.toDate()).toLocaleDateString('ar-EG')}`,
            createdAt: Timestamp.now(),
            createdBy: currentUser.name
        });
        
        await updateDoc(bookingRef, {
            customerId,
            status: 'confirmed',
            isNewCustomer: false,
            paidAmount: amount,
            paymentMethod,
            confirmedAt: Timestamp.now(),
            confirmedBy: currentUser.name
        });
        
try {
    const shiftModule = await import('../shift-management/shift-management.js');
    if (shiftModule && shiftModule.addShiftAction) {
        // ✅ الإصلاح: تمرير جميع البارامترات
        await shiftModule.addShiftAction(
            'تأكيد حجز عميل جديد', 
            `تم إنشاء حساب لـ ${booking.customerName} ودفع ${amount.toFixed(2)} جنيه مقابل ${booking.services.length} خدمة`,
            booking.customerName,
            amount,
            paymentMethod,
            { 
                actionCategory: 'booking',
                services: booking.services.map(s => s.name),
                isNewCustomer: true
            }
        );
        
        await shiftModule.addShiftAction(
            'إضافة عميل', 
            `تم إضافة العميل ${booking.customerName} - رقم ${customerId}`,
            booking.customerName,
            amount,
            paymentMethod,
            { 
                actionCategory: 'customer',
                customerId: customerId
            }
        );
    }
} catch (e) {
    console.log('لا يمكن تسجيل في الشيفت:', e);
}
        
        alert(`✅ تم إنشاء الحساب بنجاح!\nرقم العميل: ${customerId}\nتم الدفع والتأكيد.`);
        document.getElementById('paymentModal').remove();
        
    } catch (error) {
        console.error("خطأ في المعالجة:", error);
        alert('❌ حدث خطأ: ' + (error.message || error));
    }
};

function showRechargeModal() {
    if (!selectedCustomer) return;
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'rechargeModal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>💰 شحن رصيد ${selectedCustomer.name}</h3>
                <button class="close-btn" onclick="closeRechargeModal()">✕</button>
            </div>
            <div class="modal-body">
                <div class="balance-info-box">
                    <div>الرصيد الحالي: <strong>${selectedCustomer.balance.toFixed(2)} جنيه</strong></div>
                    <div>التكلفة المطلوبة: <strong>${document.getElementById('totalCost').textContent} جنيه</strong></div>
                    <div class="deficit">النقص: <strong>${Math.abs(selectedCustomer.balance - parseFloat(document.getElementById('totalCost').textContent)).toFixed(2)} جنيه</strong></div>
                </div>
                
                <div class="input-group">
                    <label>مبلغ الشحن:</label>
                    <input type="number" id="rechargeAmount" step="0.01" min="0" value="${Math.abs(selectedCustomer.balance - parseFloat(document.getElementById('totalCost').textContent)).toFixed(2)}">
                </div>
                
                <div class="input-group">
                    <label>طريقة الدفع:</label>
                    <select id="rechargePaymentMethod">
                        <option value="نقدي">نقدي</option>
                        <option value="كاش">كاش</option>
                        <option value="فيزا">فيزا</option>
                    </select>
                </div>
            </div>
            <div class="modal-footer">
                <button class="save-btn" onclick="confirmRecharge()">تأكيد الشحن</button>
                <button class="cancel-btn" onclick="closeRechargeModal()">إلغاء</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

window.closeRechargeModal = function() {
    const modal = document.getElementById('rechargeModal');
    if (modal) modal.remove();
};

window.confirmRecharge = async function() {
    const amount = parseFloat(document.getElementById('rechargeAmount').value);
    const paymentMethod = document.getElementById('rechargePaymentMethod').value;
    
    if (!amount || amount <= 0) {
        alert('⚠️ أدخل مبلغ صحيح!');
        return;
    }
    
    try {
        const customerRef = doc(db, "customers", selectedCustomer.id);
        const customerSnap = await getDoc(customerRef);
        const currentBalance = customerSnap.data().balance || 0;
        const newBalance = currentBalance + amount;
        
        await updateDoc(customerRef, {
            balance: newBalance,
            updatedAt: Timestamp.now()
        });
        
        await addDoc(collection(db, "transactions"), {
            customerId: selectedCustomer.id,
            customerName: selectedCustomer.name,
            type: 'deposit',
            balanceType: 'normal',
            amount,
            previousBalance: currentBalance,
            newBalance,
            paymentMethod,
            notes: `شحن رصيد - ${paymentMethod}`,
            createdAt: Timestamp.now(),
            createdBy: currentUser.name
        });
        
try {
    const shiftModule = await import('../shift-management/shift-management.js');
    if (shiftModule && shiftModule.addShiftAction) {
        // ✅ الإصلاح: تمرير جميع البارامترات
        await shiftModule.addShiftAction(
            'شحن رصيد', 
            `شحن ${amount.toFixed(2)} جنيه لـ ${selectedCustomer.name} - ${paymentMethod}`,
            selectedCustomer.name,
            amount,
            paymentMethod,
            { 
                actionCategory: 'deposit',
                balanceType: 'normal'
            }
        );
    }
} catch (e) {
    console.log('لا يمكن تسجيل في الشيفت:', e);
}
        
        selectedCustomer.balance = newBalance;
        document.getElementById('selectedCustomerBalance').textContent = newBalance.toFixed(2);
        document.getElementById('currentCustomerBalance').textContent = newBalance.toFixed(2);
        
        const totalCost = parseFloat(document.getElementById('totalCost').textContent) || 0;
        updateBalanceStatus(newBalance, totalCost);
        
        alert('✅ تم شحن الرصيد بنجاح!');
        closeRechargeModal();
        
    } catch (error) {
        console.error("خطأ في شحن الرصيد:", error);
        alert('❌ حدث خطأ في شحن الرصيد');
    }
};
// دالة مساعدة لتحديث إجراءات الشيفت
async function refreshShiftActions() {
    try {
        const shiftModule = await import('../shift-management/shift-management.js');
        if (shiftModule && shiftModule.refreshShiftActions) {
            await shiftModule.refreshShiftActions();
            console.log('✅ تم تحديث إجراءات الشيفت');
        }
    } catch (error) {
        console.log('⚠️ لا يمكن تحديث إجراءات الشيفت:', error.message);
    }
}

// استدع هذه الدالة بعد كل عملية مهمة
window.refreshShiftActions = refreshShiftActions;

function debounce(fn, wait) {
    let t;
    return (...a) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...a), wait);
    };
}

window.addEventListener('beforeunload', () => {
    if (unsubscribeBookings) {
        unsubscribeBookings();
    }
    if (unsubscribeAlerts) {
        unsubscribeAlerts();
    }
});

console.log('✅ تم تحميل doctor-schedule.js المحدث مع فلتر البحث وتعديل السعر');