// customer-details.js - النسخة الكاملة مع نظام العروض
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
    Timestamp,
    runTransaction
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
let allTransactions = [];
let currentTransactionFilter = 'all';
let availableOffers = [];
let customerPurchasedOffers = [];

function el(id) {
    return document.getElementById(id) || null;
}

checkUserRole().then(async (userData) => {
    if (userData) {
        if (el('userName')) el('userName').textContent = userData.name;
        currentUserName = userData.name || currentUserName;
        await initializePage();
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

    setupBalanceEvents('normal');
    setupBalanceEvents('offers');
    setupBalanceEvents('laser');
    setupBalanceEvents('derma');

    const addVisitBtn = el('addVisitBtn');
    const closeVisitModal = el('closeVisitModal');
    const cancelVisit = el('cancelVisit');
    const addVisitForm = el('addVisitForm');

    if (addVisitBtn) addVisitBtn.addEventListener('click', showAddVisitModal);
    if (closeVisitModal) closeVisitModal.addEventListener('click', hideAddVisitModal);
    if (cancelVisit) cancelVisit.addEventListener('click', hideAddVisitModal);
    if (addVisitForm) addVisitForm.addEventListener('submit', addVisit);

    const addVisitModal = el('addVisitModal');
    if (addVisitModal) {
        addVisitModal.addEventListener('click', (e) => {
            if (e.target.id === 'addVisitModal') hideAddVisitModal();
        });
    }

    const transactionDateFilter = el('transactionDateFilter');
    const customTransactionDate = el('customTransactionDate');
    const clearTransactionFilter = el('clearTransactionFilter');
    const customDateGroup = el('customDateGroup');

    if (transactionDateFilter) {
        transactionDateFilter.addEventListener('change', function() {
            currentTransactionFilter = this.value;
            if (this.value === 'custom') {
                if (customDateGroup) customDateGroup.classList.remove('hidden');
            } else {
                if (customDateGroup) customDateGroup.classList.add('hidden');
                filterTransactions();
            }
        });
    }

    if (customTransactionDate) {
        customTransactionDate.addEventListener('change', function() {
            if (this.value) filterTransactions();
        });
    }

    if (clearTransactionFilter) {
        clearTransactionFilter.addEventListener('click', function() {
            currentTransactionFilter = 'all';
            if (transactionDateFilter) transactionDateFilter.value = 'all';
            if (customTransactionDate) customTransactionDate.value = '';
            if (customDateGroup) customDateGroup.classList.add('hidden');
            filterTransactions();
        });
    }
}

function setupBalanceEvents(type) {
    const typeCapitalized = type.charAt(0).toUpperCase() + type.slice(1);
    
    const rechargeBtn = type === 'normal' ? el('rechargeBtn') : el(`recharge${typeCapitalized}Btn`);
    const cancelRecharge = type === 'normal' ? el('cancelRecharge') : el(`cancel${typeCapitalized}Recharge`);
    const rechargeForm = type === 'normal' ? el('rechargeBalanceForm') : el(`recharge${typeCapitalized}BalanceForm`);
    
    if (rechargeBtn) rechargeBtn.addEventListener('click', () => showBalanceForm(type, 'recharge'));
    if (cancelRecharge) cancelRecharge.addEventListener('click', () => hideBalanceForm(type, 'recharge'));
    if (rechargeForm) {
        rechargeForm.addEventListener('submit', (e) => {
            if (type === 'normal') {
                rechargeBalance(e);
            } else {
                rechargeSpecialBalance(e, type);
            }
        });
    }
    
    const transferBtn = el(`transfer${typeCapitalized}Btn`);
    const cancelTransfer = el(`cancel${typeCapitalized}Transfer`);
    const transferForm = el(`transfer${typeCapitalized}BalanceForm`);
    
    if (transferBtn) {
        transferBtn.addEventListener('click', () => {
            if (type === 'normal') {
                showBalanceForm(type, 'transfer');
            } else {
                showBalanceForm(type, 'transfer');
            }
        });
    }
    if (cancelTransfer) {
        cancelTransfer.addEventListener('click', () => {
            if (type === 'normal') {
                hideBalanceForm(type, 'transfer');
            } else {
                hideBalanceForm(type, 'transfer');
            }
        });
    }
    if (transferForm) {
        transferForm.addEventListener('submit', (e) => {
            if (type === 'normal') {
                transferBalance(e, type);
            } else {
                convertToNormalBalance(e, type);
            }
        });
    }
    
    if (type === 'normal') {
        const convertBtn = el('convertNormalBtn');
        const cancelConvert = el('cancelNormalConvert');
        const convertForm = el('convertNormalBalanceForm');
        
        if (convertBtn) convertBtn.addEventListener('click', () => showBalanceForm('normal', 'convert'));
        if (cancelConvert) cancelConvert.addEventListener('click', () => hideBalanceForm('normal', 'convert'));
        if (convertForm) convertForm.addEventListener('submit', (e) => convertNormalBalance(e));
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

    if (el('offersBalance')) {
        el('offersBalance').textContent = `${(currentCustomerData.offersBalance || 0).toFixed(2)} جنيه`;
    }

    if (el('laserBalance')) {
        el('laserBalance').textContent = `${(currentCustomerData.laserBalance || 0).toFixed(2)} جنيه`;
    }

    if (el('dermaBalance')) {
        el('dermaBalance').textContent = `${(currentCustomerData.dermaBalance || 0).toFixed(2)} جنيه`;
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
    else if (tabName === 'offers') loadOffersTab();
}

// ✅ تحميل تبويب العروض
async function loadOffersTab() {
    const offersContainer = document.querySelector('#offers-tab .offers-container');
    if (!offersContainer) return;

    // إضافة قسم العروض المتاحة
    const availableOffersSection = document.createElement('div');
    availableOffersSection.id = 'availableOffersSection';
    availableOffersSection.style.marginTop = '25px';
    
    offersContainer.appendChild(availableOffersSection);

    await loadAvailableOffers();
    await loadCustomerOffers();
}

// ✅ تحميل العروض المتاحة
async function loadAvailableOffers() {
    const section = el('availableOffersSection');
    if (!section) return;

    section.innerHTML = '<div class="loading">جاري تحميل العروض المتاحة...</div>';

    try {
        const now = new Date();
        const q = query(
            collection(db, "offers"),
            where("isActive", "==", true),
            orderBy("createdAt", "desc")
        );

        const querySnapshot = await getDocs(q);
        availableOffers = [];

        querySnapshot.forEach(docSnap => {
            const offer = { id: docSnap.id, ...docSnap.data() };
            const endDate = offer.endDate ? offer.endDate.toDate() : null;
            
            // عرض العروض النشطة فقط
            if (endDate && endDate >= now) {
                availableOffers.push(offer);
            }
        });

        displayAvailableOffers();

    } catch (error) {
        console.error("خطأ في تحميل العروض:", error);
        section.innerHTML = '<div class="error">حدث خطأ في تحميل العروض</div>';
    }
}

// ✅ عرض العروض المتاحة
function displayAvailableOffers() {
    const section = el('availableOffersSection');
    if (!section) return;

    if (availableOffers.length === 0) {
        section.innerHTML = `
            <div style="background: white; padding: 40px; border-radius: 15px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
                <div style="font-size: 60px; margin-bottom: 15px;">🎁</div>
                <h3 style="color: #666; margin: 0;">لا توجد عروض متاحة حالياً</h3>
            </div>
        `;
        return;
    }

    let html = `
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 15px; margin-bottom: 20px; box-shadow: 0 5px 20px rgba(102, 126, 234, 0.3);">
            <h3 style="margin: 0 0 10px 0; font-size: 22px; display: flex; align-items: center; gap: 10px;">
                🎁 العروض المتاحة
            </h3>
            <p style="margin: 0; opacity: 0.9; font-size: 14px;">يمكنك شراء هذه العروض باستخدام رصيد العروض</p>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px;">
    `;

    availableOffers.forEach(offer => {
        const discount = ((offer.originalPrice - offer.offerPrice) / offer.originalPrice) * 100;
        const savings = offer.originalPrice - offer.offerPrice;
        const endDate = offer.endDate ? offer.endDate.toDate() : null;
        const daysLeft = endDate ? Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24)) : 0;

        html += `
            <div style="background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 5px 20px rgba(0,0,0,0.1); transition: all 0.3s; border: 2px solid transparent;">
                <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 15px; text-align: center;">
                    <div style="font-size: 28px; font-weight: 700;">🔥 عرض خاص</div>
                    <div style="font-size: 13px; opacity: 0.9; margin-top: 5px;">متبقي ${daysLeft} يوم</div>
                </div>
                
                <div style="padding: 20px;">
                    <h4 style="margin: 0 0 10px 0; font-size: 18px; color: #333; font-weight: 700;">
                        ${offer.serviceName}
                    </h4>
                    
                    <div style="background: #f8f9fa; padding: 12px; border-radius: 10px; margin-bottom: 15px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span style="color: #666; font-size: 14px;">القسم:</span>
                            <span style="color: #333; font-weight: 600; font-size: 14px;">${offer.categoryName}</span>
                        </div>
                        ${offer.offerType === 'package' ? `
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span style="color: #666; font-size: 14px;">عدد الجلسات:</span>
                            <span style="color: #667eea; font-weight: 700; font-size: 16px;">${offer.sessionsCount} جلسة</span>
                        </div>
                        ` : ''}
                    </div>
                    
                    <div style="background: linear-gradient(135deg, #e8f5e9, #c8e6c9); padding: 15px; border-radius: 10px; margin-bottom: 15px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <span style="color: #666; text-decoration: line-through; font-size: 14px;">${offer.originalPrice.toFixed(2)} جنيه</span>
                            <span style="background: #28a745; color: white; padding: 4px 12px; border-radius: 15px; font-size: 12px; font-weight: 700;">
                                وفر ${discount.toFixed(0)}%
                            </span>
                        </div>
                        <div style="font-size: 28px; font-weight: 700; color: #28a745;">
                            ${offer.offerPrice.toFixed(2)} جنيه
                        </div>
                        <div style="font-size: 12px; color: #666; margin-top: 5px;">
                            💰 توفير ${savings.toFixed(2)} جنيه
                        </div>
                    </div>
                    
                    ${offer.notes ? `
                    <div style="background: #fff3cd; padding: 10px; border-radius: 8px; margin-bottom: 15px; font-size: 13px; color: #856404;">
                        📝 ${offer.notes}
                    </div>
                    ` : ''}
                    
                    <button 
                        onclick="purchaseOffer('${offer.id}')"
                        style="width: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 14px; border-radius: 10px; font-size: 15px; font-weight: 700; cursor: pointer; transition: all 0.3s;">
                        🛒 شراء العرض الآن
                    </button>
                </div>
            </div>
        `;
    });

    html += '</div>';
    section.innerHTML = html;
}

// ✅ شراء عرض
window.purchaseOffer = async function(offerId) {
    const offer = availableOffers.find(o => o.id === offerId);
    if (!offer) {
        alert('❌ العرض غير موجود!');
        return;
    }

    const offersBalance = currentCustomerData.offersBalance || 0;

    if (offersBalance < offer.offerPrice) {
        alert(`❌ رصيد العروض غير كافٍ!\n\nالمطلوب: ${offer.offerPrice.toFixed(2)} جنيه\nالرصيد الحالي: ${offersBalance.toFixed(2)} جنيه\nالنقص: ${(offer.offerPrice - offersBalance).toFixed(2)} جنيه`);
        return;
    }

    if (!confirm(`هل تريد شراء هذا العرض؟\n\n📦 ${offer.serviceName}\n${offer.offerType === 'package' ? `🎫 ${offer.sessionsCount} جلسة\n` : ''}💰 السعر: ${offer.offerPrice.toFixed(2)} جنيه\n\nسيتم الخصم من رصيد العروض`)) {
        return;
    }

    try {
        await runTransaction(db, async (transaction) => {
            // ✅ خطوة 1: جميع عمليات القراءة أولاً
            const customerRef = doc(db, "customers", currentCustomerId);
            const customerDoc = await transaction.get(customerRef);

            const offerRef = doc(db, "offers", offerId);
            const offerDoc = await transaction.get(offerRef);

            // ✅ خطوة 2: التحقق من البيانات
            if (!customerDoc.exists()) {
                throw new Error("العميل غير موجود!");
            }

            const currentOffersBalance = customerDoc.data().offersBalance || 0;

            if (currentOffersBalance < offer.offerPrice) {
                throw new Error("رصيد العروض غير كافٍ!");
            }

            const newOffersBalance = currentOffersBalance - offer.offerPrice;

            // ✅ خطوة 3: جميع عمليات الكتابة
            // تحديث رصيد العروض
            transaction.update(customerRef, {
                offersBalance: newOffersBalance,
                updatedAt: Timestamp.now()
            });

            // إنشاء سجل العرض المشترى
            const customerOfferRef = doc(collection(db, "customerOffers"));
            transaction.set(customerOfferRef, {
                customerId: currentCustomerId,
                customerName: currentCustomerData.name,
                offerId: offer.id,
                offerName: offer.serviceName,
                categoryName: offer.categoryName,
                offerType: offer.offerType,
                totalSessions: offer.sessionsCount || 1,
                remainingSessions: offer.sessionsCount || 1,
                purchasePrice: offer.offerPrice,
                originalPrice: offer.originalPrice,
                purchaseDate: Timestamp.now(),
                expiryDate: offer.endDate,
                status: 'active',
                createdBy: currentUserName,
                createdAt: Timestamp.now()
            });

            // إنشاء معاملة مالية
            const transactionRef = doc(collection(db, "transactions"));
            transaction.set(transactionRef, {
                customerId: currentCustomerId,
                customerName: currentCustomerData.name,
                type: 'withdrawal',
                balanceType: 'offers',
                amount: offer.offerPrice,
                previousBalance: currentOffersBalance,
                newBalance: newOffersBalance,
                paymentMethod: 'رصيد العروض',
                notes: `شراء عرض: ${offer.serviceName}${offer.offerType === 'package' ? ` (${offer.sessionsCount} جلسة)` : ''}`,
                createdAt: Timestamp.now(),
                createdBy: currentUserName
            });

            // تحديث عداد العملاء في العرض
            if (offerDoc.exists()) {
                const currentCount = offerDoc.data().customersCount || 0;
                transaction.update(offerRef, {
                    customersCount: currentCount + 1
                });
            }
        });

        currentCustomerData.offersBalance = (currentCustomerData.offersBalance || 0) - offer.offerPrice;
        displayCustomerInfo();

        alert(`✅ تم شراء العرض بنجاح!\n\n${offer.serviceName}\nالمبلغ المدفوع: ${offer.offerPrice.toFixed(2)} جنيه\nالرصيد المتبقي: ${currentCustomerData.offersBalance.toFixed(2)} جنيه`);

        await loadCustomerOffers();
        await loadTransactions();

    } catch (error) {
        console.error("خطأ في شراء العرض:", error);
        alert('❌ حدث خطأ أثناء شراء العرض: ' + error.message);
    }
};

// ✅ تحميل عروض العميل المشتراة
async function loadCustomerOffers() {
    try {
        const q = query(
            collection(db, "customerOffers"),
            where("customerId", "==", currentCustomerId),
            orderBy("purchaseDate", "desc")
        );

        const querySnapshot = await getDocs(q);
        customerPurchasedOffers = [];

        querySnapshot.forEach(docSnap => {
            customerPurchasedOffers.push({ id: docSnap.id, ...docSnap.data() });
        });

        displayCustomerOffers();

    } catch (error) {
        console.error("خطأ في تحميل عروض العميل:", error);
    }
}

// ✅ عرض عروض العميل المشتراة
function displayCustomerOffers() {
    const section = el('availableOffersSection');
    if (!section) return;

    if (customerPurchasedOffers.length === 0) return;

    const purchasedHTML = `
        <div style="margin-top: 40px;">
            <div style="background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 20px; border-radius: 15px; margin-bottom: 20px; box-shadow: 0 5px 20px rgba(40, 167, 69, 0.3);">
                <h3 style="margin: 0 0 10px 0; font-size: 22px; display: flex; align-items: center; gap: 10px;">
                    ✅ عروضي المشتراة
                </h3>
                <p style="margin: 0; opacity: 0.9; font-size: 14px;">العروض التي قمت بشرائها</p>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px;">
                ${customerPurchasedOffers.map(offer => {
                    const purchaseDate = offer.purchaseDate ? offer.purchaseDate.toDate().toLocaleDateString('ar-EG') : '-';
                    const progress = ((offer.totalSessions - offer.remainingSessions) / offer.totalSessions) * 100;
                    
                    return `
                        <div style="background: white; border-radius: 15px; padding: 20px; box-shadow: 0 5px 20px rgba(0,0,0,0.1); border-right: 4px solid ${offer.status === 'active' ? '#28a745' : '#6c757d'};">
                            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                                <h4 style="margin: 0; font-size: 17px; color: #333; font-weight: 700;">
                                    ${offer.offerName}
                                </h4>
                                <span style="background: ${offer.status === 'active' ? '#28a745' : '#6c757d'}; color: white; padding: 4px 12px; border-radius: 15px; font-size: 11px; font-weight: 700;">
                                    ${offer.status === 'active' ? '✅ نشط' : '⏸️ منتهي'}
                                </span>
                            </div>
                            
                            <div style="background: #f8f9fa; padding: 12px; border-radius: 10px; margin-bottom: 15px; font-size: 14px;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                    <span style="color: #666;">القسم:</span>
                                    <span style="color: #333; font-weight: 600;">${offer.categoryName}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                    <span style="color: #666;">تاريخ الشراء:</span>
                                    <span style="color: #333; font-weight: 600;">${purchaseDate}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between;">
                                    <span style="color: #666;">المبلغ المدفوع:</span>
                                    <span style="color: #28a745; font-weight: 700;">${offer.purchasePrice.toFixed(2)} جنيه</span>
                                </div>
                            </div>
                            
                            ${offer.offerType === 'package' ? `
                            <div style="background: linear-gradient(135deg, #e3f2fd, #bbdefb); padding: 15px; border-radius: 10px;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                                    <span style="font-size: 13px; color: #666;">الجلسات المتبقية</span>
                                    <span style="font-size: 18px; font-weight: 700; color: #1976d2;">
                                        ${offer.remainingSessions} / ${offer.totalSessions}
                                    </span>
                                </div>
                                <div style="background: white; height: 8px; border-radius: 10px; overflow: hidden;">
                                    <div style="background: linear-gradient(90deg, #1976d2, #42a5f5); height: 100%; width: ${progress}%; transition: width 0.3s;"></div>
                                </div>
                                <div style="text-align: center; margin-top: 8px; font-size: 12px; color: #666;">
                                    ${offer.totalSessions - offer.remainingSessions} جلسة مستخدمة
                                </div>
                            </div>
                            ` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    section.insertAdjacentHTML('beforeend', purchasedHTML);
}

function showBalanceForm(type, action) {
    let formId;
    if (type === 'normal') {
        formId = `${type}${action.charAt(0).toUpperCase() + action.slice(1)}Form`;
    } else {
        if (action === 'recharge') {
            formId = `${type}RechargeForm`;
        } else {
            formId = `${type}TransferForm`;
        }
    }
    
    const formEl = el(formId);
    if (!formEl) {
        console.error(`❌ النموذج ${formId} غير موجود!`);
        return;
    }
    
    hideBalanceForm(type, 'recharge');
    hideBalanceForm(type, 'transfer');
    hideBalanceForm(type, 'convert');
    
    formEl.classList.remove('hidden');
    
    let amountInputId;
    if (action === 'recharge') {
        amountInputId = type === 'normal' ? 'rechargeAmount' : `${type}RechargeAmount`;
    } else if (action === 'transfer' || action === 'convert') {
        amountInputId = `${type}TransferAmount`;
    }
    
    const amountInput = el(amountInputId);
    if (amountInput) {
        setTimeout(() => amountInput.focus(), 100);
    }
}

function hideBalanceForm(type, action) {
    let formId;
    if (type === 'normal') {
        formId = `${type}${action.charAt(0).toUpperCase() + action.slice(1)}Form`;
    } else {
        if (action === 'recharge') {
            formId = `${type}RechargeForm`;
        } else {
            formId = `${type}TransferForm`;
        }
    }
    
    const formEl = el(formId);
    if (formEl) {
        formEl.classList.add('hidden');
        
        let formElementId;
        if (action === 'recharge') {
            formElementId = type === 'normal' ? 'rechargeBalanceForm' : `recharge${type.charAt(0).toUpperCase() + type.slice(1)}BalanceForm`;
        } else {
            formElementId = `transfer${type.charAt(0).toUpperCase() + type.slice(1)}BalanceForm`;
        }
        
        const formElement = el(formElementId);
        if (formElement) formElement.reset();
    }
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
            balanceType: 'normal',
            amount: amount,
            previousBalance: currentBalance,
            newBalance: newBalance,
            paymentMethod: paymentMethod,
            notes: notes || `شحن رصيد عادي - ${paymentMethod}`,
            createdAt: Timestamp.now(),
            createdBy: currentUserName
        });

        try {
            const shiftModule = await import('../shift-management/shift-management.js');
            if (shiftModule && shiftModule.addShiftAction) {
                await shiftModule.addShiftAction(
                    'شحن رصيد',
                    `شحن رصيد ${currentCustomerData.name} - ${amount.toFixed(2)} جنيه`,
                    currentCustomerData.name,
                    amount,
                    paymentMethod,
                    {
                        actionCategory: 'deposit',
                        customerId: currentCustomerId,
                        balanceType: 'normal'
                    }
                );
            }
        } catch (shiftError) {
            console.log('⚠️ لا يمكن تسجيل إجراء الشيفت');
        }

        currentCustomerData.balance = newBalance;
        displayCustomerInfo();

        alert(`✅ تم شحن ${amount.toFixed(2)} جنيه بنجاح!\nالرصيد الجديد: ${newBalance.toFixed(2)} جنيه`);
        hideBalanceForm('normal', 'recharge');
        await loadTransactions();
    } catch (error) {
        console.error("خطأ في شحن الرصيد:", error);
        alert('❌ حدث خطأ أثناء شحن الرصيد');
    }
}

async function rechargeSpecialBalance(e, type) {
    e.preventDefault();
    
    const typeNames = { offers: 'العروض', laser: 'الليزر', derma: 'الجلدية' };
    const balanceFields = { offers: 'offersBalance', laser: 'laserBalance', derma: 'dermaBalance' };

    const amountInput = el(`${type}RechargeAmount`);
    const notesInput = el(`${type}RechargeNotes`);
    const paymentMethodSelect = el(`${type}PaymentMethod`);

    const amount = amountInput ? parseFloat(amountInput.value) : NaN;
    const notes = notesInput ? notesInput.value.trim() : '';
    const paymentMethod = paymentMethodSelect ? paymentMethodSelect.value : 'نقدي';

    if (!amount || amount <= 0) {
        alert('⚠️ يرجى إدخال مبلغ صحيح!');
        return;
    }

    try {
        const balanceField = balanceFields[type];
        const currentBalance = currentCustomerData[balanceField] || 0;
        const newBalance = currentBalance + amount;

        await updateDoc(doc(db, "customers", currentCustomerId), {
            [balanceField]: newBalance,
            updatedAt: Timestamp.now()
        });

        await addDoc(collection(db, "transactions"), {
            customerId: currentCustomerId,
            customerName: currentCustomerData.name,
            type: 'deposit',
            balanceType: type,
            amount: amount,
            previousBalance: currentBalance,
            newBalance: newBalance,
            paymentMethod: paymentMethod,
            notes: notes || `شحن رصيد ${typeNames[type]}`,
            createdAt: Timestamp.now(),
            createdBy: currentUserName
        });

        try {
            const shiftModule = await import('../shift-management/shift-management.js');
            if (shiftModule && shiftModule.addShiftAction) {
                await shiftModule.addShiftAction(
                    `شحن رصيد ${typeNames[type]}`,
                    `شحن رصيد ${typeNames[type]} لـ ${currentCustomerData.name} - ${amount.toFixed(2)} جنيه`,
                    currentCustomerData.name,
                    amount,
                    paymentMethod,
                    { actionCategory: 'deposit', customerId: currentCustomerId, balanceType: type }
                );
            }
        } catch (shiftError) {
            console.log('⚠️ لا يمكن تسجيل إجراء الشيفت');
        }

        currentCustomerData[balanceField] = newBalance;
        displayCustomerInfo();

        alert(`✅ تم شحن ${amount.toFixed(2)} جنيه لرصيد ${typeNames[type]} بنجاح!`);
        hideBalanceForm(type, 'recharge');
        await loadTransactions();

    } catch (error) {
        console.error(`خطأ في شحن رصيد ${typeNames[type]}:`, error);
        alert(`❌ حدث خطأ أثناء شحن الرصيد`);
    }
}

async function convertNormalBalance(e) {
    e.preventDefault();
    
    const typeNames = { offers: 'العروض', laser: 'الليزر', derma: 'الجلدية' };
    const balanceFields = { offers: 'offersBalance', laser: 'laserBalance', derma: 'dermaBalance' };

    const amount = parseFloat(el('normalConvertAmount')?.value) || 0;
    const toType = el('normalConvertToType')?.value;
    const notes = el('normalConvertNotes')?.value.trim() || '';

    if (!amount || amount <= 0) {
        alert('⚠️ يرجى إدخال مبلغ صحيح!');
        return;
    }

    if (!toType) {
        alert('⚠️ يرجى اختيار الفئة!');
        return;
    }

    const currentBalance = currentCustomerData.balance || 0;

    if (amount > currentBalance) {
        alert(`⚠️ الرصيد الأساسي غير كافٍ!`);
        return;
    }

    if (!confirm(`هل تريد تحويل ${amount.toFixed(2)} جنيه من الرصيد الأساسي إلى رصيد ${typeNames[toType]}؟`)) {
        return;
    }

    try {
        const targetBalanceField = balanceFields[toType];
        const currentTargetBalance = currentCustomerData[targetBalanceField] || 0;
        
        const newNormalBalance = currentBalance - amount;
        const newTargetBalance = currentTargetBalance + amount;

        await updateDoc(doc(db, "customers", currentCustomerId), {
            balance: newNormalBalance,
            [targetBalanceField]: newTargetBalance,
            updatedAt: Timestamp.now()
        });

        await addDoc(collection(db, "transactions"), {
            customerId: currentCustomerId,
            customerName: currentCustomerData.name,
            type: 'deposit',
            balanceType: toType,
            amount: amount,
            previousBalance: currentTargetBalance,
            newBalance: newTargetBalance,
            paymentMethod: 'تحويل داخلي',
            notes: notes || `تحويل من الرصيد الأساسي (${currentBalance.toFixed(2)} → ${newNormalBalance.toFixed(2)} جنيه)`,
            convertedFrom: 'normal',
            internalTransfer: true,
            sourceBalanceBefore: currentBalance,
            sourceBalanceAfter: newNormalBalance,
            createdAt: Timestamp.now(),
            createdBy: currentUserName
        });

        currentCustomerData.balance = newNormalBalance;
        currentCustomerData[targetBalanceField] = newTargetBalance;
        displayCustomerInfo();

        alert(`✅ تم تحويل ${amount.toFixed(2)} جنيه بنجاح!`);
        hideBalanceForm('normal', 'convert');
        await loadTransactions();

    } catch (error) {
        console.error('خطأ في تحويل الرصيد:', error);
        alert('❌ حدث خطأ أثناء تحويل الرصيد');
    }
}

async function convertToNormalBalance(e, fromType) {
    e.preventDefault();
    
    const typeNames = { offers: 'العروض', laser: 'الليزر', derma: 'الجلدية' };
    const balanceFields = { offers: 'offersBalance', laser: 'laserBalance', derma: 'dermaBalance' };

    const amount = parseFloat(el(`${fromType}TransferAmount`)?.value) || 0;
    const notes = el(`${fromType}TransferNotes`)?.value.trim() || '';

    if (!amount || amount <= 0) {
        alert('⚠️ يرجى إدخال مبلغ صحيح!');
        return;
    }

    const fromBalanceField = balanceFields[fromType];
    const currentFromBalance = currentCustomerData[fromBalanceField] || 0;

    if (amount > currentFromBalance) {
        alert(`⚠️ رصيد ${typeNames[fromType]} غير كافٍ!`);
        return;
    }

    if (!confirm(`هل تريد تحويل ${amount.toFixed(2)} جنيه من رصيد ${typeNames[fromType]} إلى الرصيد الأساسي؟`)) {
        return;
    }

    try {
        const currentNormalBalance = currentCustomerData.balance || 0;
        
        const newFromBalance = currentFromBalance - amount;
        const newNormalBalance = currentNormalBalance + amount;

        await updateDoc(doc(db, "customers", currentCustomerId), {
            [fromBalanceField]: newFromBalance,
            balance: newNormalBalance,
            updatedAt: Timestamp.now()
        });

        await addDoc(collection(db, "transactions"), {
            customerId: currentCustomerId,
            customerName: currentCustomerData.name,
            type: 'deposit',
            balanceType: 'normal',
            amount: amount,
            previousBalance: currentNormalBalance,
            newBalance: newNormalBalance,
            paymentMethod: 'تحويل داخلي',
            notes: notes || `تحويل من رصيد ${typeNames[fromType]} (${currentFromBalance.toFixed(2)} → ${newFromBalance.toFixed(2)} جنيه)`,
            convertedFrom: fromType,
            internalTransfer: true,
            sourceBalanceBefore: currentFromBalance,
            sourceBalanceAfter: newFromBalance,
            createdAt: Timestamp.now(),
            createdBy: currentUserName
        });

        currentCustomerData[fromBalanceField] = newFromBalance;
        currentCustomerData.balance = newNormalBalance;
        displayCustomerInfo();

        alert(`✅ تم تحويل ${amount.toFixed(2)} جنيه بنجاح!`);
        hideBalanceForm(fromType, 'transfer');
        await loadTransactions();

    } catch (error) {
        console.error(`خطأ في تحويل الرصيد:`, error);
        alert(`❌ حدث خطأ أثناء تحويل الرصيد`);
    }
}

async function transferBalance(e, type) {
    e.preventDefault();
    
    const typeNames = { normal: 'الأساسي', offers: 'العروض', laser: 'الليزر', derma: 'الجلدية' };
    const balanceFields = { normal: 'balance', offers: 'offersBalance', laser: 'laserBalance', derma: 'dermaBalance' };

    const amount = parseFloat(el(`${type}TransferAmount`)?.value) || 0;
    let targetPhone = el(`${type}TransferTo`)?.value.trim().replace(/\s+/g, '') || '';
    const notes = el(`${type}TransferNotes`)?.value.trim() || '';

    if (!amount || amount <= 0) {
        alert('⚠️ يرجى إدخال مبلغ صحيح!');
        return;
    }

    if (!targetPhone) {
        alert('⚠️ يرجى إدخال رقم هاتف العميل المستقبل!');
        return;
    }

    const balanceField = balanceFields[type];
    const currentBalance = currentCustomerData[balanceField] || 0;

    if (amount > currentBalance) {
        alert(`⚠️ رصيد ${typeNames[type]} غير كافٍ!`);
        return;
    }

    try {
        const q = query(collection(db, "customers"), where("phone", "==", targetPhone));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            alert('❌ لم يتم العثور على عميل بهذا الرقم!');
            return;
        }

        const targetCustomerDoc = querySnapshot.docs[0];
        const targetCustomerId = targetCustomerDoc.id;
        const targetCustomerData = targetCustomerDoc.data();

        if (targetCustomerId === currentCustomerId) {
            alert('⚠️ لا يمكن التحويل لنفس العميل!');
            return;
        }

        if (!confirm(`هل تريد تحويل ${amount.toFixed(2)} جنيه من رصيد ${typeNames[type]}\n\nمن: ${currentCustomerData.name}\nإلى: ${targetCustomerData.name}`)) {
            return;
        }

        await runTransaction(db, async (transaction) => {
            const senderRef = doc(db, "customers", currentCustomerId);
            const receiverRef = doc(db, "customers", targetCustomerId);

            const senderDoc = await transaction.get(senderRef);
            const receiverDoc = await transaction.get(receiverRef);

            if (!senderDoc.exists() || !receiverDoc.exists()) {
                throw new Error("أحد العملاء غير موجود!");
            }

            const senderBalance = senderDoc.data()[balanceField] || 0;
            const receiverBalance = receiverDoc.data()['balance'] || 0;

            if (senderBalance < amount) {
                throw new Error("الرصيد غير كافٍ!");
            }

            const newSenderBalance = senderBalance - amount;
            const newReceiverBalance = receiverBalance + amount;

            transaction.update(senderRef, {
                [balanceField]: newSenderBalance,
                updatedAt: Timestamp.now()
            });

            transaction.update(receiverRef, {
                balance: newReceiverBalance,
                updatedAt: Timestamp.now()
            });

            const senderTransactionRef = doc(collection(db, "transactions"));
            transaction.set(senderTransactionRef, {
                customerId: currentCustomerId,
                customerName: currentCustomerData.name,
                type: 'withdrawal',
                balanceType: type,
                amount: amount,
                previousBalance: senderBalance,
                newBalance: newSenderBalance,
                paymentMethod: 'تحويل',
                notes: notes || `تحويل رصيد إلى ${targetCustomerData.name}`,
                transferTo: targetCustomerId,
                transferToName: targetCustomerData.name,
                createdAt: Timestamp.now(),
                createdBy: currentUserName
            });

            const receiverTransactionRef = doc(collection(db, "transactions"));
            transaction.set(receiverTransactionRef, {
                customerId: targetCustomerId,
                customerName: targetCustomerData.name,
                type: 'deposit',
                balanceType: 'normal',
                amount: amount,
                previousBalance: receiverBalance,
                newBalance: newReceiverBalance,
                paymentMethod: 'تحويل',
                notes: notes || `تحويل رصيد من ${currentCustomerData.name}`,
                transferFrom: currentCustomerId,
                transferFromName: currentCustomerData.name,
                createdAt: Timestamp.now(),
                createdBy: currentUserName
            });
        });

        currentCustomerData[balanceField] = (currentCustomerData[balanceField] || 0) - amount;
        displayCustomerInfo();

        alert(`✅ تم تحويل ${amount.toFixed(2)} جنيه بنجاح!`);
        hideBalanceForm(type, 'transfer');
        await loadTransactions();

    } catch (error) {
        console.error(`خطأ في تحويل الرصيد:`, error);
        alert(`❌ حدث خطأ أثناء تحويل الرصيد`);
    }
}

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
            if (!confirm(`⚠️ رصيد العميل غير كافٍ!\nهل تريد المتابعة؟`)) {
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
            balanceType: 'normal',
            amount,
            previousBalance: currentBalance,
            newBalance,
            notes: `زيارة - ${serviceName} - الدكتور: ${doctorName}`,
            createdAt: Timestamp.now(),
            createdBy: currentUserName
        });

        currentCustomerData.balance = newBalance;
        currentCustomerData.visitCount = (currentCustomerData.visitCount || 0) + 1;
        currentCustomerData.totalSpent = (currentCustomerData.totalSpent || 0) + amount;

        displayCustomerInfo();
        alert(`✅ تم إضافة الزيارة بنجاح!`);
        hideAddVisitModal();
        await loadVisits();
        await loadTransactions();
    } catch (error) {
        console.error("خطأ في إضافة الزيارة:", error);
        alert('❌ حدث خطأ أثناء إضافة الزيارة');
    }
}

async function loadVisits() {
    const visitsList = el('visitsList');
    if (!visitsList) return;
    visitsList.innerHTML = '<div class="loading">جاري تحميل الزيارات...</div>';

    try {
        const bookingsQuery = query(
            collection(db, "bookings"),
            where("customerId", "==", currentCustomerId),
            where("status", "==", "completed"),
            orderBy("completedAt", "desc")
        );
        
        const bookingsSnapshot = await getDocs(bookingsQuery);
        
        const visitsQuery = query(
            collection(db, "visits"),
            where("customerId", "==", currentCustomerId),
            orderBy("visitDate", "desc")
        );
        
        const visitsSnapshot = await getDocs(visitsQuery);
        
        visitsList.innerHTML = '';
        
        if (bookingsSnapshot.empty && visitsSnapshot.empty) {
            visitsList.innerHTML = '<div class="empty-state">لا توجد زيارات مسجلة</div>';
            return;
        }

        for (const bookingDoc of bookingsSnapshot.docs) {
            const booking = bookingDoc.data();
            const bookingId = bookingDoc.id;
            
            const visitCard = document.createElement('div');
            visitCard.className = 'session-report-item';
            
            const completedDate = booking.completedAt ? booking.completedAt.toDate() : new Date();
            const formattedDate = completedDate.toLocaleString('ar-EG', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            const reportsQuery = query(
                collection(db, "serviceReports"),
                where("bookingId", "==", bookingId)
            );
            const reportsSnapshot = await getDocs(reportsQuery);
            
            let servicesHTML = '';
            const services = booking.services || [];
            
            for (const service of services) {
                let serviceReport = null;
                reportsSnapshot.forEach(reportDoc => {
                    const report = reportDoc.data();
                    if (report.serviceName === service.name) {
                        serviceReport = { id: reportDoc.id, ...report };
                    }
                });
                
                const hasReport = serviceReport !== null;
                const buttonClass = hasReport ? 'view-report-details-btn' : 'view-report-details-btn no-report';
                const buttonText = hasReport ? '📋 عرض التقرير' : 'لا يوجد تقرير';
                
                servicesHTML += `
                    <div class="report-service-item ${hasReport ? '' : 'no-report'}">
                        <span class="service-name">${service.name} (${service.duration} دقيقة - ${service.price.toFixed(2)} جنيه)</span>
                        ${hasReport ? `
                            <button class="${buttonClass}" onclick="viewServiceReport('${serviceReport.id}')">
                                ${buttonText}
                            </button>
                        ` : `
                            <span style="color: #999; font-size: 13px;">${buttonText}</span>
                        `}
                    </div>
                `;
            }
            
            visitCard.innerHTML = `
                <div class="report-header">
                    <div class="report-date">📅 ${formattedDate}</div>
                    <div style="background: #667eea; color: white; padding: 5px 15px; border-radius: 20px; font-size: 14px;">
                        👨‍⚕️ د. ${booking.doctorName || 'غير محدد'}
                    </div>
                </div>
                
                <div class="report-services-list">
                    <h4>الخدمات (${services.length}):</h4>
                    ${servicesHTML}
                </div>
                
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e9ecef; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; font-size: 14px; color: #666;">
                    <div><strong>💰 التكلفة الإجمالية:</strong> ${(booking.totalCost || 0).toFixed(2)} جنيه</div>
                    <div><strong>⏱️ المدة الكلية:</strong> ${booking.totalDuration || 0} دقيقة</div>
                    <div><strong>👤 تم الحجز بواسطة:</strong> ${booking.createdBy || 'غير محدد'}</div>
                </div>
            `;
            
            visitsList.appendChild(visitCard);
        }
        
        visitsSnapshot.forEach(visitDoc => {
            const visit = visitDoc.data();
            const visitItem = document.createElement('div');
            visitItem.className = 'visit-item';

            const visitDate = visit.visitDate ? visit.visitDate.toDate() : new Date();
            const formattedDate = visitDate.toLocaleString('ar-EG', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit' 
            });

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

    } catch (error) {
        console.error("خطأ في تحميل الزيارات:", error);
        visitsList.innerHTML = '<div class="error">حدث خطأ في تحميل الزيارات</div>';
    }
}

window.viewServiceReport = async function(reportId) {
    try {
        const reportDoc = await getDoc(doc(db, "serviceReports", reportId));
        
        if (!reportDoc.exists()) {
            alert('❌ التقرير غير موجود!');
            return;
        }
        
        const report = reportDoc.data();
        
        const modalHTML = `
            <div id="serviceReportViewModal" class="modal" style="display: flex;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>📋 تقرير الخدمة</h3>
                        <button class="close-btn" onclick="closeServiceReportModal()">✕</button>
                    </div>
                    
                    <div class="report-modal-body">
                        <div class="report-section">
                            <h4>معلومات أساسية</h4>
                            <div class="report-grid">
                                <div class="report-field">
                                    <span class="report-label">اسم العميلة</span>
                                    <span class="report-value">${report.customerName || '-'}</span>
                                </div>
                                <div class="report-field">
                                    <span class="report-label">رقم التليفون</span>
                                    <span class="report-value">${report.customerPhone || '-'}</span>
                                </div>
                                <div class="report-field">
                                    <span class="report-label">التاريخ</span>
                                    <span class="report-value">${report.sessionDate || '-'}</span>
                                </div>
                                <div class="report-field">
                                    <span class="report-label">الوقت</span>
                                    <span class="report-value">${report.sessionTime || '-'}</span>
                                </div>
                                <div class="report-field">
                                    <span class="report-label">رقم الجلسة</span>
                                    <span class="report-value">${report.sessionNumber || '-'}</span>
                                </div>
                                <div class="report-field">
                                    <span class="report-label">نوع الجلسة</span>
                                    <span class="report-value">${report.sessionType || '-'}</span>
                                </div>
                                <div class="report-field">
                                    <span class="report-label">الدكتور</span>
                                    <span class="report-value">${report.doctorName || '-'}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="report-section">
                            <h4>التفاصيل الفنية</h4>
                            <div class="report-grid">
                                <div class="report-field">
                                    <span class="report-label">عدد النبضات</span>
                                    <span class="report-value">${report.pulseCount || '-'}</span>
                                </div>
                                <div class="report-field">
                                    <span class="report-label">Power</span>
                                    <span class="report-value">${report.power || '-'}</span>
                                </div>
                                <div class="report-field">
                                    <span class="report-label">Pulse Duration</span>
                                    <span class="report-value">${report.pulseDuration || '-'}</span>
                                </div>
                                <div class="report-field">
                                    <span class="report-label">Spot Size</span>
                                    <span class="report-value">${report.spotSize || '-'}</span>
                                </div>
                                <div class="report-field">
                                    <span class="report-label">Skin Type</span>
                                    <span class="report-value">${report.skinType || '-'}</span>
                                </div>
                            </div>
                        </div>
                        
                        ${report.notes ? `
                        <div class="report-section">
                            <h4>ملاحظات</h4>
                            <div class="report-notes">
                                <p style="margin: 0; padding: 15px; background: white; border-radius: 8px;">${report.notes}</p>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                    
                    <div style="padding: 20px; border-top: 2px solid #e9ecef; display: flex; gap: 15px;">
                        <button onclick="printServiceReport('${reportId}')" style="flex: 1; padding: 12px; background: linear-gradient(135deg, #28a745, #20c997); color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 15px;">
                            🖨️ طباعة
                        </button>
                        <button onclick="closeServiceReportModal()" style="flex: 1; padding: 12px; background: #6c757d; color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 15px;">
                            إغلاق
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        const existingModal = document.getElementById('serviceReportViewModal');
        if (existingModal) existingModal.remove();
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
    } catch (error) {
        console.error("خطأ في تحميل التقرير:", error);
        alert('❌ حدث خطأ في تحميل التقرير');
    }
};

window.closeServiceReportModal = function() {
    const modal = document.getElementById('serviceReportViewModal');
    if (modal) modal.remove();
};

window.printServiceReport = async function(reportId) {
    try {
        const reportDoc = await getDoc(doc(db, "serviceReports", reportId));
        if (!reportDoc.exists()) {
            alert('❌ التقرير غير موجود!');
            return;
        }
        
        const report = reportDoc.data();
        
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>تقرير الجلسة - ${report.customerName}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; direction: rtl; }
                    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; }
                    .section { margin: 20px 0; }
                    .section h3 { background: #f0f0f0; padding: 10px; border-radius: 5px; }
                    .field { margin: 10px 0; padding: 8px; background: #f9f9f9; border-radius: 5px; }
                    .field strong { color: #666; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Joyec Clinic</h1>
                    <h2>تقرير جلسة ${report.sessionType}</h2>
                </div>
                
                <div class="section">
                    <h3>معلومات العميلة</h3>
                    <div class="field"><strong>الاسم:</strong> ${report.customerName}</div>
                    <div class="field"><strong>رقم التليفون:</strong> ${report.customerPhone}</div>
                </div>
                
                <div class="section">
                    <h3>معلومات الجلسة</h3>
                    <div class="field"><strong>التاريخ:</strong> ${report.sessionDate}</div>
                    <div class="field"><strong>الوقت:</strong> ${report.sessionTime}</div>
                    <div class="field"><strong>رقم الجلسة:</strong> ${report.sessionNumber}</div>
                    <div class="field"><strong>نوع الجلسة:</strong> ${report.sessionType}</div>
                    <div class="field"><strong>الدكتور:</strong> ${report.doctorName}</div>
                </div>
                
                <div class="section">
                    <h3>التفاصيل الفنية</h3>
                    <div class="field"><strong>عدد النبضات:</strong> ${report.pulseCount || '-'}</div>
                    <div class="field"><strong>Power:</strong> ${report.power || '-'}</div>
                    <div class="field"><strong>Pulse Duration:</strong> ${report.pulseDuration || '-'}</div>
                    <div class="field"><strong>Spot Size:</strong> ${report.spotSize || '-'}</div>
                    <div class="field"><strong>Skin Type:</strong> ${report.skinType || '-'}</div>
                </div>
                
                ${report.notes ? `
                <div class="section">
                    <h3>ملاحظات</h3>
                    <div class="field">${report.notes}</div>
                </div>
                ` : ''}
                
                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(() => window.close(), 500);
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
        
    } catch (error) {
        console.error("خطأ في طباعة التقرير:", error);
        alert('❌ حدث خطأ في طباعة التقرير');
    }
};

async function loadTransactions() {
    const transactionsList = el('transactionsList');
    if (!transactionsList) return;
    transactionsList.innerHTML = '<div class="loading">جاري تحميل الحركات...</div>';

    try {
        const q = query(collection(db, "transactions"), where("customerId", "==", currentCustomerId), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        allTransactions = [];
        querySnapshot.forEach(docSnap => {
            allTransactions.push({ id: docSnap.id, ...docSnap.data() });
        });

        filterTransactions();

    } catch (error) {
        console.error("خطأ في تحميل الحركات:", error);
        transactionsList.innerHTML = '<div class="error">حدث خطأ في تحميل الحركات المالية</div>';
    }
}

function filterTransactions() {
    const transactionsList = el('transactionsList');
    if (!transactionsList) return;

    let filteredTransactions = [...allTransactions];

    if (currentTransactionFilter !== 'all') {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        filteredTransactions = filteredTransactions.filter(transaction => {
            if (!transaction.createdAt) return false;
            const transactionDate = transaction.createdAt.toDate();
            const transactionDay = new Date(transactionDate.getFullYear(), transactionDate.getMonth(), transactionDate.getDate());

            switch (currentTransactionFilter) {
                case 'today':
                    return transactionDay.getTime() === today.getTime();
                case 'yesterday':
                    const yesterday = new Date(today);
                    yesterday.setDate(yesterday.getDate() - 1);
                    return transactionDay.getTime() === yesterday.getTime();
                case 'this_week':
                    const weekStart = new Date(today);
                    weekStart.setDate(today.getDate() - today.getDay());
                    return transactionDay >= weekStart;
                case 'this_month':
                    return transactionDate.getMonth() === now.getMonth() && 
                           transactionDate.getFullYear() === now.getFullYear();
                case 'last_month':
                    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    return transactionDate.getMonth() === lastMonth.getMonth() && 
                           transactionDate.getFullYear() === lastMonth.getFullYear();
                case 'custom':
                    const customDateInput = el('customTransactionDate');
                    if (!customDateInput || !customDateInput.value) return true;
                    const selectedDate = new Date(customDateInput.value);
                    const selectedDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
                    return transactionDay.getTime() === selectedDay.getTime();
                default:
                    return true;
            }
        });
    }

    displayTransactions(filteredTransactions);
}

function displayTransactions(transactions) {
    const transactionsList = el('transactionsList');
    if (!transactionsList) return;

    let totalDeposits = 0;
    let totalWithdrawals = 0;

    if (transactions.length === 0) {
        transactionsList.innerHTML = '<div class="empty-state">لا توجد حركات مالية في الفترة المحددة</div>';
        if (el('totalDeposits')) el('totalDeposits').textContent = '0.00 جنيه';
        if (el('totalWithdrawals')) el('totalWithdrawals').textContent = '0.00 جنيه';
        return;
    }

    transactionsList.innerHTML = '';

    transactions.forEach(transaction => {
        const transactionItem = document.createElement('div');
        transactionItem.className = 'transaction-item';

        const transactionDate = transaction.createdAt ? transaction.createdAt.toDate() : new Date();
        const formattedDate = transactionDate.toLocaleString('ar-EG', { 
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
        });

        const amountClass = transaction.type === 'deposit' ? 'positive' : 'negative';
        const amountSign = transaction.type === 'deposit' ? '+' : '-';
        let typeText = transaction.type === 'deposit' ? 'إيداع' : 'سحب';
        
        const balanceTypeNames = { normal: 'أساسي', offers: 'عروض', laser: 'ليزر', derma: 'جلدية' };
        const balanceType = transaction.balanceType ? ` - ${balanceTypeNames[transaction.balanceType] || ''}` : '';

        if (transaction.type === 'deposit') totalDeposits += transaction.amount || 0;
        else if (transaction.type === 'withdrawal') totalWithdrawals += transaction.amount || 0;

        transactionItem.innerHTML = `
            <div class="transaction-header">
                <div class="transaction-type-badge ${amountClass}">${typeText}${balanceType}</div>
                <div class="transaction-date">${formattedDate}</div>
                <div class="transaction-amount ${amountClass}">${amountSign} ${((transaction.amount || 0)).toFixed(2)} جنيه</div>
            </div>
            <div class="transaction-details">
                <div><strong>بواسطة:</strong> ${transaction.createdBy || 'نظام'}</div>
                <div><strong>طريقة الدفع:</strong> ${transaction.paymentMethod || 'غير محدد'}</div>
                <div><strong>الرصيد السابق:</strong> ${(transaction.previousBalance || 0).toFixed(2)} جنيه</div>
                <div><strong>الرصيد الجديد:</strong> ${(transaction.newBalance || 0).toFixed(2)} جنيه</div>
                ${transaction.transferTo ? `<div><strong>محول إلى:</strong> ${transaction.transferToName || '-'}</div>` : ''}
                ${transaction.transferFrom ? `<div><strong>محول من:</strong> ${transaction.transferFromName || '-'}</div>` : ''}
            </div>
            ${transaction.notes ? `<div class="transaction-notes"><strong>ملاحظات:</strong> ${transaction.notes}</div>` : ''}
            <div class="transaction-actions">
                <button class="print-receipt-btn" onclick="printReceipt('${transaction.id}')">🖨️ طباعة الإيصال</button>
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
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
        });

        const amountText = (transaction.amount || 0).toFixed(2) + ' جنيه';
        let typeText = transaction.type === 'deposit' ? 'إيداع' : 'سحب';

        const balanceTypeNames = { normal: 'أساسي', offers: 'عروض', laser: 'ليزر', derma: 'جلدية' };
        const balanceType = transaction.balanceType ? ` (${balanceTypeNames[transaction.balanceType] || ''})` : '';

        const receiptHTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>إيصال - Joyec Clinic</title>
<style>
  body { font-family: Arial, sans-serif; direction: rtl; max-width:420px; margin:20px auto; color:#111; }
  .wrap { border:1px solid #333; padding:16px; }
  .header { text-align:center; border-bottom:1px solid #ddd; padding-bottom:10px; margin-bottom:12px; }
  .header h1 { margin:0; font-size:20px; }
  .meta { font-size:13px; line-height:1.6; }
  .amount { font-weight:700; font-size:18px; color:#28a745; margin-top:10px; }
  .footer { margin-top:18px; text-align:center; border-top:1px solid #ddd; padding-top:10px; font-size:12px; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>Joyec Clinic</h1>
      <div>إيصال دفع</div>
    </div>
    <div class="meta">
      <div><strong>التاريخ:</strong> ${formattedDate}</div>
      <div><strong>العميل:</strong> ${transaction.customerName || '-'}</div>
      <div><strong>بواسطة:</strong> ${transaction.createdBy || 'نظام'}</div>
      <div><strong>طريقة الدفع:</strong> ${transaction.paymentMethod || '-'}</div>
      <div><strong>نوع المعاملة:</strong> ${typeText}${balanceType}</div>
    </div>
    <div class="amount">
      <div>المبلغ: ${amountText}</div>
    </div>
    <div>
      <strong>ملاحظات:</strong>
      <div>${transaction.notes || '-'}</div>
    </div>
    <div class="footer">
      شكراً لاستخدامك Joyec Clinic
    </div>
  </div>
  <script>
    setTimeout(() => {
      window.print();
      try { window.close(); } catch (e) {}
    }, 300);
  </script>
</body>
</html>`;

        const w = window.open('', '_blank', 'width=450,height=700');
        if (!w) {
            alert('تعذر فتح نافذة الطباعة');
            return;
        }
        w.document.open();
        w.document.write(receiptHTML);
        w.document.close();

    } catch (error) {
        console.error("خطأ في طباعة الإيصال:", error);
        alert('❌ حدث خطأ أثناء طباعة الإيصال');
    }
};

console.log('✅ تم تحميل customer-details.js بنجاح');