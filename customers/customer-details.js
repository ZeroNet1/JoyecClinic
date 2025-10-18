// customer-details.js - مع نظام العروض
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    updateDoc,
    collection,
    addDoc,
    getDocs,
    query,
    where,
    orderBy,
    Timestamp
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
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
const auth = getAuth(app);

let currentCustomerId = null;
let currentCustomerData = null;
let currentUserName = "نظام";
let allOffers = [];
let customerOffers = [];

function el(id) {
    return document.getElementById(id) || null;
}

checkUserRole().then(async (userData) => {
    if (userData) {
        if (el('userName')) el('userName').textContent = userData.name;
        currentUserName = userData.name || currentUserName;
        await initializePage();
    } else {
        console.warn('checkUserRole returned no userData.');
    }
}).catch(err => {
    console.error('خطأ في التحقق من الصلاحية:', err);
});

async function initializePage() {
    const urlParams = new URLSearchParams(window.location.search);
    currentCustomerId = urlParams.get('id');

    if (!currentCustomerId) {
        alert('❌ لم يتم تحديد عميل!');
        window.location.href = 'customer-list.html';
        return;
    }

    await loadCustomerData();
    setupEventListeners();
}

function setupEventListeners() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    if (tabBtns && tabBtns.length) {
        tabBtns.forEach(btn => {
            const tabName = btn.getAttribute('data-tab');
            if (!tabName) return;
            btn.addEventListener('click', () => switchTab(tabName));
        });
    }

    const rechargeBtn = el('rechargeBtn');
    const cancelRecharge = el('cancelRecharge');
    const rechargeForm = el('rechargeBalanceForm');

    if (rechargeBtn) rechargeBtn.addEventListener('click', showRechargeForm);
    if (cancelRecharge) cancelRecharge.addEventListener('click', hideRechargeForm);
    if (rechargeForm) rechargeForm.addEventListener('submit', rechargeBalance);

    const addVisitBtn = el('addVisitBtn');
    const closeVisitModal = el('closeVisitModal');
    const cancelVisit = el('cancelVisit');
    const addVisitForm = el('addVisitForm');

    if (addVisitBtn) addVisitBtn.addEventListener('click', showAddVisitModal);
    if (closeVisitModal) closeVisitModal.addEventListener('click', hideAddVisitModal);
    if (cancelVisit) cancelVisit.addEventListener('click', hideAddVisitModal);
    if (addVisitForm) addVisitForm.addEventListener('submit', addVisit);

    // أحداث العروض
    const rechargeOffersBtn = el('rechargeOffersBtn');
    const cancelOffersRecharge = el('cancelOffersRecharge');
    const rechargeOffersForm = el('rechargeOffersBalanceForm');
    const offerCategoryFilter = el('offerCategoryFilter');

    if (rechargeOffersBtn) rechargeOffersBtn.addEventListener('click', showOffersRechargeForm);
    if (cancelOffersRecharge) cancelOffersRecharge.addEventListener('click', hideOffersRechargeForm);
    if (rechargeOffersForm) rechargeOffersForm.addEventListener('submit', rechargeOffersBalance);
    if (offerCategoryFilter) offerCategoryFilter.addEventListener('change', filterOffersByCategory);

    const addVisitModal = el('addVisitModal');
    if (addVisitModal) {
        addVisitModal.addEventListener('click', (e) => {
            if (e.target.id === 'addVisitModal') hideAddVisitModal();
        });
    }

    const rechargeOverlay = el('rechargeForm');
    if (rechargeOverlay) {
        rechargeOverlay.addEventListener('click', (e) => {
            if (e.target.id === 'rechargeForm') hideRechargeForm();
        });
    }
}

async function loadCustomerData() {
    try {
        const customerDoc = await getDoc(doc(db, "customers", currentCustomerId));

        if (!customerDoc.exists()) {
            alert('❌ العميل غير موجود!');
            window.location.href = 'customer-list.html';
            return;
        }

        currentCustomerData = customerDoc.data();
        displayCustomerInfo();
        await loadVisits();
        await loadTransactions();
        await loadOffers();
        await loadCustomerOffers();
    } catch (error) {
        console.error("خطأ في تحميل بيانات العميل:", error);
        alert('❌ حدث خطأ في تحميل بيانات العميل');
    }
}

function displayCustomerInfo() {
    const idToShow = (currentCustomerData && currentCustomerData.id) ? currentCustomerData.id : (currentCustomerId || '-');

    if (el('pageTitle')) el('pageTitle').textContent = `تفاصيل العميل - ${currentCustomerData.name || ''} (${idToShow})`;
    if (el('customerNameDisplay')) el('customerNameDisplay').textContent = currentCustomerData.name || '-';
    if (el('customerPhoneDisplay')) el('customerPhoneDisplay').textContent = currentCustomerData.phone || '-';
    if (el('customerIdDisplay')) el('customerIdDisplay').textContent = idToShow;

    if (el('visitCount')) el('visitCount').textContent = currentCustomerData.visitCount || 0;
    if (el('totalSpent')) el('totalSpent').textContent = (currentCustomerData.totalSpent || 0).toFixed(2);

    if (el('currentBalance')) {
        el('currentBalance').textContent = `${(currentCustomerData.balance || 0).toFixed(2)} جنيه`;
        const balanceElement = el('currentBalance');
        if ((currentCustomerData.balance || 0) > 0) {
            balanceElement.style.color = '#28a745';
        } else if ((currentCustomerData.balance || 0) < 0) {
            balanceElement.style.color = '#dc3545';
        } else {
            balanceElement.style.color = '#6c757d';
        }
    }

    // عرض رصيد العروض
    if (el('offersBalance')) {
        const offersBalance = currentCustomerData.offersBalance || 0;
        el('offersBalance').textContent = `${offersBalance.toFixed(2)} جنيه`;
    }
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    const paneEl = el(`${tabName}-tab`);
    const btnEl = document.querySelector(`[data-tab="${tabName}"]`);
    if (paneEl) paneEl.classList.add('active');
    if (btnEl) btnEl.classList.add('active');

    if (tabName === 'visits') loadVisits();
    else if (tabName === 'transactions') loadTransactions();
    else if (tabName === 'offers') {
        loadOffers();
        loadCustomerOffers();
    }
}

// ========== دوال الرصيد العادي ==========
function showRechargeForm() {
    const rechargeFormEl = el('rechargeForm');
    if (!rechargeFormEl) return;
    rechargeFormEl.classList.remove('hidden');

    const amountInput = el('rechargeAmount');
    if (amountInput) amountInput.focus();

    const paymentMethodSelect = el('paymentMethod');
    if (paymentMethodSelect) {
        paymentMethodSelect.innerHTML = `
            <option value="نقدي">نقدي</option>
            <option value="كاش">كاش</option>
            <option value="فيزا">فيزا</option>
            <option value="تحويل بنكي">تحويل بنكي</option>
            <option value="محفظة إلكترونية">محفظة إلكترونية</option>
        `;
    }
}

function hideRechargeForm() {
    const rechargeFormEl = el('rechargeForm');
    if (rechargeFormEl) rechargeFormEl.classList.add('hidden');

    const rechargeBalanceForm = el('rechargeBalanceForm');
    if (rechargeBalanceForm) rechargeBalanceForm.reset();
}

async function rechargeBalance(e) {
    e.preventDefault();
    const amountInput = el('rechargeAmount');
    const notesInput = el('rechargeNotes');
    const paymentMethodSelect = el('paymentMethod');

    const amount = amountInput ? parseFloat(amountInput.value) : NaN;
    const notes = notesInput ? notesInput.value.trim() : '';
    const paymentMethod = paymentMethodSelect ? paymentMethodSelect.value : 'نقدي';

    if (!amount || amount <= 0) {
        alert('⚠️ يرجى إدخال مبلغ صحيح!');
        return;
    }
    if (amount > 100000) {
        alert('⚠️ المبلغ كبير جداً! يرجى إدخال مبلغ أقل من 100,000 جنيه');
        return;
    }

    try {
        const currentBalance = currentCustomerData.balance || 0;
        const newBalance = currentBalance + amount;

        await updateDoc(doc(db, "customers", currentCustomerId), {
            balance: newBalance,
            updatedAt: Timestamp.now()
        });

        await addDoc(collection(db, "transactions"), {
            customerId: currentCustomerId,
            customerName: currentCustomerData.name,
            type: 'deposit',
            amount: amount,
            previousBalance: currentBalance,
            newBalance: newBalance,
            paymentMethod: paymentMethod,
            notes: notes || `شحن رصيد - ${paymentMethod}`,
            createdAt: Timestamp.now(),
            createdBy: currentUserName
        });

        try {
            const shiftModule = await import('../shift-management/shift-management.js');
            if (shiftModule && shiftModule.addShiftAction) {
                await shiftModule.addShiftAction(
                    'شحن رصيد',
                    `تم شحن رصيد لـ ${currentCustomerData.name} - المبلغ: ${amount.toFixed(2)} جنيه - طريقة الدفع: ${paymentMethod}`
                );
            }
        } catch (shiftError) {
            console.log('لا يمكن تسجيل إجراء الشيفت:', shiftError);
        }

        currentCustomerData.balance = newBalance;
        displayCustomerInfo();

        alert(`✅ تم شحن ${amount.toFixed(2)} جنيه بنجاح!\nالرصيد الجديد: ${newBalance.toFixed(2)} جنيه`);
        hideRechargeForm();
        await loadTransactions();
    } catch (error) {
        console.error("خطأ في شحن الرصيد:", error);
        alert('❌ حدث خطأ أثناء شحن الرصيد: ' + (error.message || error));
    }
}

// ========== دوال العروض ==========
async function loadOffers() {
    const offersList = el('offersList');
    if (!offersList) return;
    
    offersList.innerHTML = '<div class="loading">جاري تحميل العروض...</div>';

    try {
        const now = new Date();
        const q = query(
            collection(db, "offers"),
            where("endDate", ">=", Timestamp.fromDate(now)),
            orderBy("endDate", "asc")
        );

        const querySnapshot = await getDocs(q);
        allOffers = [];

        querySnapshot.forEach(docSnap => {
            const offer = { id: docSnap.id, ...docSnap.data() };
            
            // التحقق من أن العرض نشط ولم ينته
            const startDate = offer.startDate.toDate();
            const endDate = offer.endDate.toDate();
            
            if (now >= startDate && now <= endDate) {
                allOffers.push(offer);
            }
        });

        displayOffers();
    } catch (error) {
        console.error("خطأ في تحميل العروض:", error);
        offersList.innerHTML = '<div class="error">حدث خطأ في تحميل العروض</div>';
    }
}

function displayOffers() {
    const offersList = el('offersList');
    const offerCategoryFilter = el('offerCategoryFilter');
    
    if (!offersList) return;

    // استخراج الأقسام الفريدة
    const categories = {};
    allOffers.forEach(offer => {
        if (!categories[offer.categoryId]) {
            categories[offer.categoryId] = offer.categoryName;
        }
    });

    // تحديث قائمة الأقسام
    if (offerCategoryFilter) {
        offerCategoryFilter.innerHTML = '<option value="all">جميع الأقسام</option>';
        Object.entries(categories).forEach(([id, name]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = name;
            offerCategoryFilter.appendChild(option);
        });
    }

    filterOffersByCategory();
}

function filterOffersByCategory() {
    const offersList = el('offersList');
    const offerCategoryFilter = el('offerCategoryFilter');
    
    if (!offersList) return;

    const selectedCategory = offerCategoryFilter ? offerCategoryFilter.value : 'all';
    
    const filteredOffers = selectedCategory === 'all' 
        ? allOffers 
        : allOffers.filter(o => o.categoryId === selectedCategory);

    if (filteredOffers.length === 0) {
        offersList.innerHTML = '<div class="empty-state"><p>لا توجد عروض نشطة حالياً</p></div>';
        return;
    }

    offersList.innerHTML = '';

    filteredOffers.forEach(offer => {
        const offerCard = createOfferCard(offer);
        offersList.appendChild(offerCard);
    });
}

function createOfferCard(offer) {
    const card = document.createElement('div');
    card.className = 'offer-card';

    const discount = ((offer.originalPrice - offer.offerPrice) / offer.originalPrice) * 100;
    const endDate = offer.endDate.toDate();
    const formattedEndDate = endDate.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    card.innerHTML = `
        <div class="offer-badge ${offer.offerType}">
            ${offer.offerType === 'package' ? '📦 باكدج' : '🏷️ تخفيض'}
        </div>
        
        <div class="offer-content">
            <h4 class="offer-service-name">${offer.serviceName}</h4>
            <p class="offer-category-name">${offer.categoryName}</p>
            
            <div class="offer-pricing">
                <div class="price-row">
                    <span>السعر الأصلي:</span>
                    <span class="original-price">${offer.originalPrice.toFixed(2)} جنيه</span>
                </div>
                <div class="price-row highlight">
                    <span>سعر العرض:</span>
                    <span class="offer-price">${offer.offerPrice.toFixed(2)} جنيه</span>
                </div>
                <div class="discount-badge">خصم ${discount.toFixed(0)}%</div>
            </div>
            
            ${offer.offerType === 'package' ? `
                <div class="offer-sessions">
                    🎫 عدد الجلسات: ${offer.sessionsCount}
                </div>
            ` : ''}
            
            <div class="offer-validity">
                🕐 ينتهي في: ${formattedEndDate}
            </div>
            
            ${offer.notes ? `
                <div class="offer-notes-text">
                    ℹ️ ${offer.notes}
                </div>
            ` : ''}
            
            <button class="buy-offer-btn" onclick="buyOffer('${offer.id}')">
                شراء العرض
            </button>
        </div>
    `;

    return card;
}

window.buyOffer = async function(offerId) {
    const offer = allOffers.find(o => o.id === offerId);
    if (!offer) {
        alert('❌ العرض غير موجود!');
        return;
    }

    const offersBalance = currentCustomerData.offersBalance || 0;

    if (offersBalance < offer.offerPrice) {
        const shortage = offer.offerPrice - offersBalance;
        alert(`⚠️ رصيد العروض غير كافٍ!\n\nالرصيد الحالي: ${offersBalance.toFixed(2)} جنيه\nالمبلغ المطلوب: ${offer.offerPrice.toFixed(2)} جنيه\nالنقص: ${shortage.toFixed(2)} جنيه\n\nيرجى شحن رصيد العروض أولاً.`);
        return;
    }

    if (!confirm(`هل تريد شراء هذا العرض؟\n\n${offer.serviceName}\n${offer.offerType === 'package' ? `عدد الجلسات: ${offer.sessionsCount}\n` : ''}السعر: ${offer.offerPrice.toFixed(2)} جنيه`)) {
        return;
    }

    try {
        const newOffersBalance = offersBalance - offer.offerPrice;

        // تحديث رصيد العروض
        await updateDoc(doc(db, "customers", currentCustomerId), {
            offersBalance: newOffersBalance,
            updatedAt: Timestamp.now()
        });

        // إضافة العرض للعميل
        await addDoc(collection(db, "customerOffers"), {
            customerId: currentCustomerId,
            customerName: currentCustomerData.name,
            offerId: offer.id,
            offerName: offer.serviceName,
            categoryName: offer.categoryName,
            offerType: offer.offerType,
            totalSessions: offer.offerType === 'package' ? offer.sessionsCount : 1,
            remainingSessions: offer.offerType === 'package' ? offer.sessionsCount : 1,
            purchasePrice: offer.offerPrice,
            purchaseDate: Timestamp.now(),
            status: 'active',
            createdBy: currentUserName
        });

        // تسجيل في الحركات المالية
        await addDoc(collection(db, "transactions"), {
            customerId: currentCustomerId,
            customerName: currentCustomerData.name,
            type: 'withdrawal',
            amount: offer.offerPrice,
            previousBalance: offersBalance,
            newBalance: newOffersBalance,
            paymentMethod: 'رصيد العروض',
            notes: `شراء عرض: ${offer.serviceName} - ${offer.categoryName}`,
            createdAt: Timestamp.now(),
            createdBy: currentUserName
        });

        // تحديث عدد المستفيدين من العرض
        const offerRef = doc(db, "offers", offer.id);
        const offerDoc = await getDoc(offerRef);
        if (offerDoc.exists()) {
            const currentCount = offerDoc.data().customersCount || 0;
            await updateDoc(offerRef, {
                customersCount: currentCount + 1
            });
        }

        try {
            const shiftModule = await import('../shift-management/shift-management.js');
            if (shiftModule && shiftModule.addShiftAction) {
                await shiftModule.addShiftAction(
                    'شراء عرض',
                    `قام ${currentCustomerData.name} بشراء عرض: ${offer.serviceName} - المبلغ: ${offer.offerPrice.toFixed(2)} جنيه`
                );
            }
        } catch (shiftError) {
            console.log('لا يمكن تسجيل إجراء الشيفت:', shiftError);
        }

        currentCustomerData.offersBalance = newOffersBalance;
        displayCustomerInfo();

        alert(`✅ تم شراء العرض بنجاح!\n\nتم خصم ${offer.offerPrice.toFixed(2)} جنيه من رصيد العروض\nالرصيد الجديد: ${newOffersBalance.toFixed(2)} جنيه`);

        await loadCustomerOffers();
        await loadTransactions();

    } catch (error) {
        console.error("خطأ في شراء العرض:", error);
        alert('❌ حدث خطأ أثناء شراء العرض: ' + (error.message || error));
    }
};

// شحن رصيد العروض
function showOffersRechargeForm() {
    const form = el('offersRechargeForm');
    if (!form) return;
    form.classList.remove('hidden');

    const amountInput = el('offersRechargeAmount');
    if (amountInput) amountInput.focus();

    const paymentMethodSelect = el('offersPaymentMethod');
    if (paymentMethodSelect) {
        paymentMethodSelect.innerHTML = `
            <option value="نقدي">نقدي</option>
            <option value="كاش">كاش</option>
            <option value="فيزا">فيزا</option>
            <option value="تحويل بنكي">تحويل بنكي</option>
            <option value="محفظة إلكترونية">محفظة إلكترونية</option>
        `;
    }
}

function hideOffersRechargeForm() {
    const form = el('offersRechargeForm');
    if (form) form.classList.add('hidden');

    const rechargeForm = el('rechargeOffersBalanceForm');
    if (rechargeForm) rechargeForm.reset();
}

async function rechargeOffersBalance(e) {
    e.preventDefault();

    const amountInput = el('offersRechargeAmount');
    const notesInput = el('offersRechargeNotes');
    const paymentMethodSelect = el('offersPaymentMethod');

    const amount = amountInput ? parseFloat(amountInput.value) : NaN;
    const notes = notesInput ? notesInput.value.trim() : '';
    const paymentMethod = paymentMethodSelect ? paymentMethodSelect.value : 'نقدي';

    if (!amount || amount <= 0) {
        alert('⚠️ يرجى إدخال مبلغ صحيح!');
        return;
    }
    if (amount > 100000) {
        alert('⚠️ المبلغ كبير جداً! يرجى إدخال مبلغ أقل من 100,000 جنيه');
        return;
    }

    try {
        const currentOffersBalance = currentCustomerData.offersBalance || 0;
        const newOffersBalance = currentOffersBalance + amount;

        await updateDoc(doc(db, "customers", currentCustomerId), {
            offersBalance: newOffersBalance,
            updatedAt: Timestamp.now()
        });

        await addDoc(collection(db, "transactions"), {
            customerId: currentCustomerId,
            customerName: currentCustomerData.name,
            type: 'deposit',
            amount: amount,
            previousBalance: currentOffersBalance,
            newBalance: newOffersBalance,
            paymentMethod: paymentMethod,
            notes: notes || `شحن رصيد عروض - ${paymentMethod}`,
            createdAt: Timestamp.now(),
            createdBy: currentUserName
        });

        try {
            const shiftModule = await import('../shift-management/shift-management.js');
            if (shiftModule && shiftModule.addShiftAction) {
                await shiftModule.addShiftAction(
                    'شحن رصيد عروض',
                    `تم شحن رصيد عروض لـ ${currentCustomerData.name} - المبلغ: ${amount.toFixed(2)} جنيه - طريقة الدفع: ${paymentMethod}`
                );
            }
        } catch (shiftError) {
            console.log('لا يمكن تسجيل إجراء الشيفت:', shiftError);
        }

        currentCustomerData.offersBalance = newOffersBalance;
        displayCustomerInfo();

        alert(`✅ تم شحن ${amount.toFixed(2)} جنيه لرصيد العروض بنجاح!\nالرصيد الجديد: ${newOffersBalance.toFixed(2)} جنيه`);
        hideOffersRechargeForm();
        await loadTransactions();

    } catch (error) {
        console.error("خطأ في شحن رصيد العروض:", error);
        alert('❌ حدث خطأ أثناء شحن رصيد العروض: ' + (error.message || error));
    }
}

// تحميل عروض العميل المشتراة
async function loadCustomerOffers() {
    const customerOffersList = el('customerOffersList');
    if (!customerOffersList) return;

    customerOffersList.innerHTML = '<div class="loading">جاري تحميل عروضك...</div>';

    try {
        const q = query(
            collection(db, "customerOffers"),
            where("customerId", "==", currentCustomerId),
            orderBy("purchaseDate", "desc")
        );

        const querySnapshot = await getDocs(q);
        customerOffers = [];

        querySnapshot.forEach(docSnap => {
            customerOffers.push({ id: docSnap.id, ...docSnap.data() });
        });

        if (customerOffers.length === 0) {
            customerOffersList.innerHTML = '<div class="empty-state"><p>لم تشتري أي عروض بعد</p></div>';
            return;
        }

        customerOffersList.innerHTML = '';

        customerOffers.forEach(offer => {
            const offerItem = createCustomerOfferItem(offer);
            customerOffersList.appendChild(offerItem);
        });

    } catch (error) {
        console.error("خطأ في تحميل عروض العميل:", error);
        customerOffersList.innerHTML = '<div class="error">حدث خطأ في تحميل عروضك</div>';
    }
}

function createCustomerOfferItem(offer) {
    const item = document.createElement('div');
    item.className = 'customer-offer-item';

    const purchaseDate = offer.purchaseDate.toDate().toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const statusClass = offer.status === 'active' ? 'active' : 'completed';
    const statusText = offer.status === 'active' ? '🟢 نشط' : '✅ مكتمل';

    item.innerHTML = `
        <div class="customer-offer-header">
            <div>
                <h4>${offer.offerName}</h4>
                <p>${offer.categoryName}</p>
            </div>
            <span class="offer-status ${statusClass}">${statusText}</span>
        </div>
        
        <div class="customer-offer-details">
            <div class="detail-row">
                <span>تاريخ الشراء:</span>
                <span>${purchaseDate}</span>
            </div>
            <div class="detail-row">
                <span>المبلغ المدفوع:</span>
                <span class="price-highlight">${offer.purchasePrice.toFixed(2)} جنيه</span>
            </div>
            ${offer.offerType === 'package' ? `
                <div class="detail-row">
                    <span>الجلسات المتبقية:</span>
                    <span class="sessions-count">${offer.remainingSessions} من ${offer.totalSessions}</span>
                </div>
            ` : ''}
        </div>
    `;

    return item;
}

// ========== باقي الدوال الأصلية ==========
function showAddVisitModal() {
    const modal = el('addVisitModal');
    if (!modal) return;
    modal.classList.remove('hidden');

    const visitDateInput = el('visitDate');
    if (visitDateInput) visitDateInput.value = new Date().toISOString().slice(0, 16);

    loadDoctorsAndServices();
}

function hideAddVisitModal() {
    const modal = el('addVisitModal');
    if (modal) modal.classList.add('hidden');
    const form = el('addVisitForm');
    if (form) form.reset();
}

async function loadDoctorsAndServices() {
    const doctorsSelect = el('visitDoctor');
    if (doctorsSelect) doctorsSelect.innerHTML = '<option value="">اختر الدكتور</option>';
    try {
        const doctorsSnapshot = await getDocs(collection(db, "users"));
        doctorsSnapshot.forEach(docSnap => {
            const user = docSnap.data();
            if (user.role === 'doctor' || user.role === 'skin_doctor') {
                const option = document.createElement('option');
                option.value = docSnap.id;
                option.textContent = user.name + (user.role === 'skin_doctor' ? ' (جلدية)' : ' (تجميل)');
                if (doctorsSelect) doctorsSelect.appendChild(option);
            }
        });
    } catch (error) {
        console.error("خطأ في تحميل الأطباء:", error);
    }

    const servicesSelect = el('visitService');
    if (servicesSelect) servicesSelect.innerHTML = '<option value="">اختر الخدمة</option>';
    try {
        const servicesSnapshot = await getDocs(collection(db, "services"));
        servicesSnapshot.forEach(docSnap => {
            const service = docSnap.data();
            const option = document.createElement('option');
            option.value = docSnap.id;
            option.textContent = `${service.name} - ${service.duration} دقيقة - ${service.price.toFixed(2)} جنيه`;
            option.setAttribute('data-price', service.price);
            if (servicesSelect) servicesSelect.appendChild(option);
        });
        if (servicesSelect) {
            servicesSelect.addEventListener('change', function() {
                const selectedOption = this.options[this.selectedIndex];
                const price = selectedOption ? selectedOption.getAttribute('data-price') : null;
                if (price && el('visitAmount')) el('visitAmount').value = price;
            });
        }
    } catch (error) {
        console.error("خطأ في تحميل الخدمات:", error);
    }
}

async function addVisit(e) {
    e.preventDefault();
    const visitDate = el('visitDate')?.value;
    const doctorId = el('visitDoctor')?.value;
    const serviceId = el('visitService')?.value;
    const amount = parseFloat(el('visitAmount')?.value || '0');
    const notes = el('visitNotes')?.value.trim() || '';

    if (!visitDate || !doctorId || !serviceId || !amount) {
        alert('⚠️ يرجى ملء جميع الحقول الإلزامية!');
        return;
    }
    if (amount <= 0) {
        alert('⚠️ يرجى إدخال مبلغ صحيح!');
        return;
    }

    try {
        const doctorDoc = await getDoc(doc(db, "users", doctorId));
        const serviceDoc = await getDoc(doc(db, "services", serviceId));
        if (!doctorDoc.exists() || !serviceDoc.exists()) {
            alert('❌ بيانات غير صحيحة!');
            return;
        }
        const doctorName = doctorDoc.data().name;
        const serviceName = serviceDoc.data().name;
        const currentBalance = currentCustomerData.balance || 0;
        const newBalance = currentBalance - amount;

        if (newBalance < 0) {
            if (!confirm(`⚠️ رصيد العميل غير كافٍ!\nالرصيد الحالي: ${currentBalance.toFixed(2)} جنيه\nالمبلغ المطلوب: ${amount.toFixed(2)} جنيه\nالنقص: ${Math.abs(newBalance).toFixed(2)} جنيه\nهل تريد المتابعة؟`)) {
                return;
            }
        }

        await updateDoc(doc(db, "customers", currentCustomerId), {
            balance: newBalance,
            visitCount: (currentCustomerData.visitCount || 0) + 1,
            totalSpent: (currentCustomerData.totalSpent || 0) + amount,
            updatedAt: Timestamp.now()
        });

        await addDoc(collection(db, "visits"), {
            customerId: currentCustomerId,
            customerName: currentCustomerData.name,
            visitDate: Timestamp.fromDate(new Date(visitDate)),
            doctorId,
            doctorName,
            serviceId,
            serviceName,
            amount,
            notes,
            createdAt: Timestamp.now(),
            createdBy: currentUserName
        });

        await addDoc(collection(db, "transactions"), {
            customerId: currentCustomerId,
            customerName: currentCustomerData.name,
            type: 'withdrawal',
            amount,
            previousBalance: currentBalance,
            newBalance,
            notes: `زيارة - ${serviceName} - الدكتور: ${doctorName}`,
            createdAt: Timestamp.now(),
            createdBy: currentUserName
        });

        try {
            const shiftModule = await import('../shift-management/shift-management.js');
            if (shiftModule && shiftModule.addShiftAction) {
                await shiftModule.addShiftAction('زيارة عميل', `تمت زيارة لـ ${currentCustomerData.name} - الخدمة: ${serviceName} - الدكتور: ${doctorName} - المبلغ: ${amount.toFixed(2)} جنيه`);
            }
        } catch (shiftError) {
            console.log('لا يمكن تسجيل إجراء الشيفت:', shiftError);
        }

        currentCustomerData.balance = newBalance;
        currentCustomerData.visitCount = (currentCustomerData.visitCount || 0) + 1;
        currentCustomerData.totalSpent = (currentCustomerData.totalSpent || 0) + amount;

        displayCustomerInfo();
        alert(`✅ تم إضافة الزيارة بنجاح!\nتم خصم ${amount.toFixed(2)} جنيه\nالرصيد الجديد: ${newBalance.toFixed(2)} جنيه`);
        hideAddVisitModal();
        await loadVisits();
        await loadTransactions();
    } catch (error) {
        console.error("خطأ في إضافة الزيارة:", error);
        alert('❌ حدث خطأ أثناء إضافة الزيارة: ' + (error.message || error));
    }
}

async function loadVisits() {
    const visitsList = el('visitsList');
    if (!visitsList) return;
    visitsList.innerHTML = '<div class="loading">جاري تحميل الزيارات...</div>';

    try {
        const q = query(collection(db, "visits"), where("customerId", "==", currentCustomerId), orderBy("visitDate", "desc"));
        const querySnapshot = await getDocs(q);
        visitsList.innerHTML = '';

        if (querySnapshot.empty) {
            visitsList.innerHTML = '<div class="empty-state">لا توجد زيارات مسجلة</div>';
            if (el('totalVisitsCount')) el('totalVisitsCount').textContent = '0';
            if (el('totalVisitAmount')) el('totalVisitAmount').textContent = '0.00 جنيه';
            return;
        }

        let totalVisits = 0;
        let totalVisitAmount = 0;

        querySnapshot.forEach(docSnap => {
            const visit = docSnap.data();
            const visitItem = document.createElement('div');
            visitItem.className = 'visit-item';

            const visitDate = visit.visitDate ? visit.visitDate.toDate() : new Date();
            const formattedDate = visitDate.toLocaleString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

            totalVisits++;
            totalVisitAmount += visit.amount || 0;

            visitItem.innerHTML = `
                <div class="visit-header">
                    <div class="visit-date">${formattedDate}</div>
                    <div class="visit-amount negative">- ${(visit.amount || 0).toFixed(2)} جنيه</div>
                </div>
                <div class="visit-details">
                    <div><strong>الدكتور:</strong> ${visit.doctorName || '-'}</div>
                    <div><strong>الخدمة:</strong> ${visit.serviceName || '-'}</div>
                    <div><strong>بواسطة:</strong> ${visit.createdBy || 'نظام'}</div>
                </div>
                ${visit.notes ? `<div class="visit-notes"><strong>ملاحظات:</strong> ${visit.notes}</div>` : ''}
            `;
            visitsList.appendChild(visitItem);
        });

        if (el('totalVisitsCount')) el('totalVisitsCount').textContent = totalVisits;
        if (el('totalVisitAmount')) el('totalVisitAmount').textContent = totalVisitAmount.toFixed(2) + ' جنيه';

    } catch (error) {
        console.error("خطأ في تحميل الزيارات:", error);
        visitsList.innerHTML = '<div class="error">حدث خطأ في تحميل الزيارات</div>';
    }
}

async function loadTransactions() {
    const transactionsList = el('transactionsList');
    if (!transactionsList) return;
    transactionsList.innerHTML = '<div class="loading">جاري تحميل الحركات...</div>';

    try {
        const q = query(collection(db, "transactions"), where("customerId", "==", currentCustomerId), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        transactionsList.innerHTML = '';

        let totalDeposits = 0;
        let totalWithdrawals = 0;
        let transactionCount = 0;

        if (querySnapshot.empty) {
            transactionsList.innerHTML = '<div class="empty-state">لا توجد حركات مالية</div>';
            if (el('totalDeposits')) el('totalDeposits').textContent = '0.00 جنيه';
            if (el('totalWithdrawals')) el('totalWithdrawals').textContent = '0.00 جنيه';
            if (el('transactionCount')) el('transactionCount').textContent = '0';
            return;
        }

        querySnapshot.forEach(docSnap => {
            const transaction = docSnap.data();
            const transactionItem = document.createElement('div');
            transactionItem.className = 'transaction-item';

            const transactionDate = transaction.createdAt ? transaction.createdAt.toDate() : new Date();
            const formattedDate = transactionDate.toLocaleString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

            const amountClass = transaction.type === 'deposit' ? 'positive' : 'negative';
            const amountSign = transaction.type === 'deposit' ? '+' : '-';
            let typeText = transaction.type === 'deposit' ? 'إيداع' : 'سحب';
            if (transaction.type === 'payment') typeText = 'دفع مقابل خدمات';
            if (transaction.type === 'refund') typeText = 'إرجاع';

            if (transaction.type === 'deposit') totalDeposits += transaction.amount || 0;
            else if (transaction.type === 'withdrawal') totalWithdrawals += transaction.amount || 0;
            transactionCount++;

            transactionItem.innerHTML = `
                <div class="transaction-header">
                    <div class="transaction-type-badge ${amountClass}">${typeText}</div>
                    <div class="transaction-date">${formattedDate}</div>
                    <div class="transaction-amount ${amountClass}">${amountSign} ${((transaction.amount || 0)).toFixed(2)} جنيه</div>
                </div>
                <div class="transaction-details">
                    <div><strong>بواسطة:</strong> ${transaction.createdBy || 'نظام'}</div>
                    <div><strong>طريقة الدفع:</strong> ${transaction.paymentMethod || 'غير محدد'}</div>
                    <div><strong>الرصيد السابق:</strong> ${(transaction.previousBalance || 0).toFixed(2)} جنيه</div>
                    <div><strong>الرصيد الجديد:</strong> ${(transaction.newBalance || 0).toFixed(2)} جنيه</div>
                </div>
                ${transaction.notes ? `<div class="transaction-notes"><strong>ملاحظات:</strong> ${transaction.notes}</div>` : ''}
                <div class="transaction-actions">
                    <button class="print-receipt-btn" onclick="printReceipt('${docSnap.id}')">🖨️ طباعة الإيصال</button>
                </div>
            `;

            transactionsList.appendChild(transactionItem);
        });

        if (el('totalDeposits')) {
            el('totalDeposits').textContent = totalDeposits.toFixed(2) + ' جنيه';
            el('totalDeposits').style.color = '#28a745';
        }
        if (el('totalWithdrawals')) {
            el('totalWithdrawals').textContent = totalWithdrawals.toFixed(2) + ' جنيه';
            el('totalWithdrawals').style.color = '#dc3545';
        }
        if (el('transactionCount')) el('transactionCount').textContent = transactionCount;

    } catch (error) {
        console.error("خطأ في تحميل الحركات:", error);
        transactionsList.innerHTML = '<div class="error">حدث خطأ في تحميل الحركات المالية</div>';
    }
}

window.printReceipt = async function(transactionId) {
    try {
        const transactionDoc = await getDoc(doc(db, "transactions", transactionId));
        if (!transactionDoc.exists()) {
            alert('❌ المعاملة غير موجودة!');
            return;
        }

        const transaction = transactionDoc.data();
        const transactionDate = transaction.createdAt ? transaction.createdAt.toDate() : new Date();
        const formattedDate = transactionDate.toLocaleString('ar-EG', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        // تجهيز نص الخدمات إذا وُجدت (للحالات التي فيها services)
        let servicesText = '';
        if (transaction.services && Array.isArray(transaction.services) && transaction.services.length > 0) {
            servicesText = transaction.services.map(s => {
                if (typeof s === 'string') return s;
                const name = s.name || s.serviceName || 'خدمة';
                const qty = s.quantity ? ` x${s.quantity}` : '';
                return `${name}${qty}`;
            }).join(' — ');
        }

        const amountText = (transaction.amount || 0).toFixed(2) + ' جنيه';
        let typeText = 'إجراء';
        if (transaction.type === 'deposit') typeText = 'إيداع';
        else if (transaction.type === 'withdrawal') typeText = 'سحب';
        else if (transaction.type === 'payment') typeText = 'دفع';
        else if (transaction.type === 'refund') typeText = 'إرجاع';

        const notesText = transaction.notes ? transaction.notes : '-';
        const createdBy = transaction.createdBy || 'نظام';
        const paymentMethod = transaction.paymentMethod || '-';
        const customerName = transaction.customerName || '-';

        const receiptHTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>إيصال - Joyec Clinic</title>
<style>
  body { font-family: Arial, "Noto Naskh Arabic", sans-serif; direction: rtl; max-width:420px; margin:20px auto; color:#111; }
  .wrap { border:1px solid #333; padding:16px; }
  .header { text-align:center; border-bottom:1px solid #ddd; padding-bottom:10px; margin-bottom:12px; }
  .header h1 { margin:0; font-size:20px; }
  .meta { font-size:13px; line-height:1.6; }
  .amount { font-weight:700; font-size:18px; color:#28a745; margin-top:10px; }
  .section { margin-top:12px; }
  .small { font-size:12px; color:#555; }
  .footer { margin-top:18px; text-align:center; border-top:1px solid #ddd; padding-top:10px; font-size:12px; color:#444; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>Joyec Clinic</h1>
      <div class="small">إيصال دفع</div>
    </div>

    <div class="meta">
      <div><strong>التاريخ:</strong> ${formattedDate}</div>
      <div><strong>العميل:</strong> ${customerName}</div>
      <div><strong>بواسطة:</strong> ${createdBy}</div>
      <div><strong>طريقة الدفع:</strong> ${paymentMethod}</div>
      <div><strong>نوع المعاملة:</strong> ${typeText}</div>
    </div>

    <div class="section amount">
      <div>المبلغ: ${amountText}</div>
    </div>

    ${servicesText ? `<div class="section"><strong>الخدمات:</strong><div class="small">${servicesText}</div></div>` : ''}

    <div class="section">
      <strong>ملاحظات:</strong>
      <div class="small">${notesText}</div>
    </div>

    <div class="footer">
      شكرًا لاستخدامك Joyec Clinic — تواصل معنا لأي استفسار.
    </div>
  </div>

  <script>
    // ننتظر قليلًا ليُحمّل المحتوى ثم نطبع ونغلق نافذة الطباعة تلقائيًا
    setTimeout(() => {
      window.print();
      // لا تُغلق النافذة تلقائيًا إن رغبت بالاحتفاظ بالإيصال في بعض المتصفحات
      try { window.close(); } catch (e) { /* ignore */ }
    }, 300);
  </script>
</body>
</html>`;

        // فتح نافذة جديدة وكتابة الإيصال
        const w = window.open('', '_blank', 'width=450,height=700');
        if (!w) {
            // قد يمنع popup blocker — أرشد المستخدم
            alert('تعذر فتح نافذة الطباعة. يرجى السماح للنوافذ المنبثقة أو طباعة من الصفحة الحالية.');
            return;
        }
        w.document.open();
        w.document.write(receiptHTML);
        w.document.close();

    } catch (error) {
        console.error("خطأ في طباعة الإيصال:", error);
        alert('❌ حدث خطأ أثناء طباعة الإيصال: ' + (error.message || error));
    }
};
