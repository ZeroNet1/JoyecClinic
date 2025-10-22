// offers.js - نظام إدارة العروض الترويجية مع دعم خدمتين
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs,
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    Timestamp
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
let allCategories = [];
let allServices = [];
let allOffers = [];

// ========== التهيئة الأولية ==========
checkUserRole().then(userData => {
    if (userData) {
        if (userData.role !== 'admin') {
            alert('❌ هذه الصفحة مخصصة للإدمن فقط!');
            window.location.href = '../main.html';
            return;
        }
        
        currentUser = userData;
        document.getElementById('userName').textContent = userData.name;
        document.getElementById('userRole').textContent = 'مدير النظام';
        
        initializePage();
    }
});

async function initializePage() {
    await loadCategories();
    await loadServices();
    await loadOffers();
    setupEventListeners();
    setMinDates();
}

// ========== تحميل البيانات ==========
async function loadCategories() {
    try {
        const querySnapshot = await getDocs(query(collection(db, "categories"), orderBy("name")));
        allCategories = [];
        
        const categoryFilter = document.getElementById('categoryFilter');
        const offerCategory = document.getElementById('offerCategory');
        
        categoryFilter.innerHTML = '<option value="all">جميع الأقسام</option>';
        offerCategory.innerHTML = '<option value="">اختر القسم</option>';
        
        querySnapshot.forEach(docSnap => {
            const category = { id: docSnap.id, ...docSnap.data() };
            allCategories.push(category);
            
            const filterOption = document.createElement('option');
            filterOption.value = category.id;
            filterOption.textContent = category.name;
            categoryFilter.appendChild(filterOption.cloneNode(true));
            offerCategory.appendChild(filterOption);
        });
    } catch (error) {
        console.error("خطأ في تحميل الأقسام:", error);
        showMessage('❌ خطأ في تحميل الأقسام', 'error');
    }
}

async function loadServices() {
    try {
        const querySnapshot = await getDocs(collection(db, "services"));
        allServices = [];
        
        querySnapshot.forEach(docSnap => {
            const service = { id: docSnap.id, ...docSnap.data() };
            allServices.push(service);
        });
    } catch (error) {
        console.error("خطأ في تحميل الخدمات:", error);
        showMessage('❌ خطأ في تحميل الخدمات', 'error');
    }
}

async function loadOffers() {
    try {
        document.getElementById('loadingOffers').style.display = 'block';
        document.getElementById('emptyOffersState').style.display = 'none';
        
        const querySnapshot = await getDocs(query(collection(db, "offers"), orderBy("createdAt", "desc")));
        allOffers = [];
        
        querySnapshot.forEach(docSnap => {
            const offer = { id: docSnap.id, ...docSnap.data() };
            allOffers.push(offer);
        });
        
        updateStatistics();
        filterOffers();
    } catch (error) {
        console.error("خطأ في تحميل العروض:", error);
        showMessage('❌ خطأ في تحميل العروض', 'error');
    } finally {
        document.getElementById('loadingOffers').style.display = 'none';
    }
}

// ========== إعداد الأحداث ==========
function setupEventListeners() {
    // تغيير القسم
    document.getElementById('offerCategory').addEventListener('change', function() {
        const categoryId = this.value;
        updateServicesDropdown(categoryId, 'offerService1');
        updateServicesDropdown(categoryId, 'offerService2');
    });
    
    // تغيير نوع العرض
    document.getElementById('offerType').addEventListener('change', function() {
        const offerType = this.value;
        const sessionsGroup = document.getElementById('sessionsGroup');
        
        if (offerType === 'package') {
            sessionsGroup.classList.remove('hidden');
            document.getElementById('sessionsCount').required = true;
        } else {
            sessionsGroup.classList.add('hidden');
            document.getElementById('sessionsCount').required = false;
            document.getElementById('sessionsCount').value = '';
        }
        
        calculateOriginalPrice();
    });
    
    // تغيير الخدمات أو عدد الجلسات
    document.getElementById('offerService1').addEventListener('change', calculateOriginalPrice);
    document.getElementById('offerService2').addEventListener('change', calculateOriginalPrice);
    document.getElementById('sessionsCount').addEventListener('input', calculateOriginalPrice);
    
    // حساب نسبة التخفيض عند تغيير سعر العرض
    document.getElementById('offerPrice').addEventListener('input', calculateDiscount);
    
    // إضافة عرض جديد
    document.getElementById('addOfferForm').addEventListener('submit', addNewOffer);
    
    // تعديل عرض
    document.getElementById('editOfferForm').addEventListener('submit', saveOfferEdit);
    
    // فلاتر العروض
    document.getElementById('categoryFilter').addEventListener('change', filterOffers);
    document.getElementById('offerTypeFilter').addEventListener('change', filterOffers);
    document.getElementById('statusFilter').addEventListener('change', filterOffers);
}

// ========== تحديث قائمة الخدمات ==========
function updateServicesDropdown(categoryId, selectId) {
    const serviceSelect = document.getElementById(selectId);
    serviceSelect.innerHTML = '<option value="">اختر الخدمة</option>';
    
    if (!categoryId) {
        serviceSelect.disabled = true;
        return;
    }
    
    const categoryServices = allServices.filter(s => s.categoryId === categoryId);
    
    if (categoryServices.length === 0) {
        serviceSelect.disabled = true;
        return;
    }
    
    serviceSelect.disabled = false;
    categoryServices.forEach(service => {
        const option = document.createElement('option');
        option.value = service.id;
        option.textContent = `${service.name} - ${service.duration} دقيقة - ${service.price.toFixed(2)} جنيه`;
        option.dataset.price = service.price;
        option.dataset.duration = service.duration;
        serviceSelect.appendChild(option);
    });
}

// ========== حساب السعر الأصلي ==========
function calculateOriginalPrice() {
    const serviceSelect1 = document.getElementById('offerService1');
    const serviceSelect2 = document.getElementById('offerService2');
    const offerType = document.getElementById('offerType').value;
    const sessionsCount = parseInt(document.getElementById('sessionsCount').value) || 1;
    
    if (!serviceSelect1.value) {
        updatePriceDisplay(0);
        return;
    }
    
    const selectedOption1 = serviceSelect1.options[serviceSelect1.selectedIndex];
    const servicePrice1 = parseFloat(selectedOption1.dataset.price);
    
    let originalPrice = servicePrice1;
    
    // إضافة سعر الخدمة الثانية إذا تم اختيارها
    if (serviceSelect2.value) {
        const selectedOption2 = serviceSelect2.options[serviceSelect2.selectedIndex];
        const servicePrice2 = parseFloat(selectedOption2.dataset.price);
        originalPrice += servicePrice2;
    }
    
    if (offerType === 'package' && sessionsCount > 0) {
        originalPrice = originalPrice * sessionsCount;
    }
    
    updatePriceDisplay(originalPrice);
    calculateDiscount();
}

function updatePriceDisplay(price) {
    const priceValue = document.querySelector('.price-value');
    priceValue.textContent = price.toFixed(2);
}

// ========== حساب نسبة التخفيض ==========
function calculateDiscount() {
    const originalPrice = parseFloat(document.querySelector('.price-value').textContent);
    const offerPrice = parseFloat(document.getElementById('offerPrice').value) || 0;
    
    if (originalPrice === 0 || offerPrice === 0) {
        document.getElementById('discountPercentage').style.display = 'none';
        return;
    }
    
    const discount = ((originalPrice - offerPrice) / originalPrice) * 100;
    
    if (discount > 0) {
        document.getElementById('discountPercentage').style.display = 'flex';
        document.querySelector('.discount-value').textContent = discount.toFixed(1) + '%';
    } else {
        document.getElementById('discountPercentage').style.display = 'none';
    }
}

// ========== إضافة عرض جديد ==========
async function addNewOffer(e) {
    e.preventDefault();
    
    const categoryId = document.getElementById('offerCategory').value;
    const serviceId1 = document.getElementById('offerService1').value;
    const serviceId2 = document.getElementById('offerService2').value;
    const offerType = document.getElementById('offerType').value;
    const sessionsCount = parseInt(document.getElementById('sessionsCount').value) || 1;
    const originalPrice = parseFloat(document.querySelector('.price-value').textContent);
    const offerPrice = parseFloat(document.getElementById('offerPrice').value);
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const notes = document.getElementById('offerNotes').value.trim();
    
    // التحقق من البيانات
    if (offerPrice >= originalPrice) {
        showMessage('⚠️ سعر العرض يجب أن يكون أقل من السعر الأصلي!', 'warning');
        return;
    }
    
    if (new Date(endDate) <= new Date(startDate)) {
        showMessage('⚠️ تاريخ النهاية يجب أن يكون بعد تاريخ البداية!', 'warning');
        return;
    }
    
    try {
        const category = allCategories.find(c => c.id === categoryId);
        const service1 = allServices.find(s => s.id === serviceId1);
        const service2 = serviceId2 ? allServices.find(s => s.id === serviceId2) : null;
        
        // إنشاء قائمة الخدمات
        const services = [
            {
                id: service1.id,
                name: service1.name,
                price: service1.price,
                duration: service1.duration
            }
        ];
        
        if (service2) {
            services.push({
                id: service2.id,
                name: service2.name,
                price: service2.price,
                duration: service2.duration
            });
        }
        
        const serviceName = services.map(s => s.name).join(' + ');
        
        const offerData = {
            categoryId,
            categoryName: category.name,
            services: services, // ✅ قائمة الخدمات
            serviceName: serviceName, // ✅ اسم مجمع للعرض
            offerType,
            originalPrice,
            offerPrice,
            sessionsCount: offerType === 'package' ? sessionsCount : 1,
            startDate: Timestamp.fromDate(new Date(startDate)),
            endDate: Timestamp.fromDate(new Date(endDate)),
            notes,
            isActive: true,
            customersCount: 0,
            createdAt: Timestamp.now(),
            createdBy: currentUser.uid,
            createdByName: currentUser.name
        };
        
        await addDoc(collection(db, "offers"), offerData);
        
        showMessage('✅ تم إضافة العرض بنجاح!', 'success');
        document.getElementById('addOfferForm').reset();
        document.getElementById('discountPercentage').style.display = 'none';
        updatePriceDisplay(0);
        
        await loadOffers();
        
    } catch (error) {
        console.error("خطأ في إضافة العرض:", error);
        showMessage('❌ حدث خطأ أثناء إضافة العرض', 'error');
    }
}

// ========== تصفية وعرض العروض ==========
function filterOffers() {
    const categoryFilter = document.getElementById('categoryFilter').value;
    const offerTypeFilter = document.getElementById('offerTypeFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    
    let filtered = [...allOffers];
    
    if (categoryFilter !== 'all') {
        filtered = filtered.filter(o => o.categoryId === categoryFilter);
    }
    
    if (offerTypeFilter !== 'all') {
        filtered = filtered.filter(o => o.offerType === offerTypeFilter);
    }
    
    const now = new Date();
    if (statusFilter === 'active') {
        filtered = filtered.filter(o => {
            const endDate = o.endDate.toDate();
            return endDate >= now;
        });
    } else if (statusFilter === 'expired') {
        filtered = filtered.filter(o => {
            const endDate = o.endDate.toDate();
            return endDate < now;
        });
    }
    
    displayOffers(filtered);
}

function displayOffers(offers) {
    const offersGrid = document.getElementById('offersGrid');
    const emptyState = document.getElementById('emptyOffersState');
    const offersCount = document.getElementById('offersCount');
    
    offersCount.textContent = `${offers.length} عرض`;
    
    if (offers.length === 0) {
        offersGrid.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    offersGrid.innerHTML = '';
    
    offers.forEach(offer => {
        const card = createOfferCard(offer);
        offersGrid.appendChild(card);
    });
}

function createOfferCard(offer) {
    const card = document.createElement('div');
    card.className = 'offer-card';
    
    const now = new Date();
    const startDate = offer.startDate.toDate();
    const endDate = offer.endDate.toDate();
    
    let status = 'upcoming';
    let statusText = 'قريباً';
    
    if (now >= startDate && now <= endDate) {
        status = 'active';
        statusText = '🔥 نشط الآن';
    } else if (now > endDate) {
        status = 'expired';
        statusText = 'منتهي';
    }
    
    const discount = ((offer.originalPrice - offer.offerPrice) / offer.originalPrice) * 100;
    
    // ✅ عرض الخدمات المتعددة
    const services = offer.services || [];
    let servicesHTML = '';
    if (services.length > 0) {
        servicesHTML = `
            <div class="offer-services-list">
                <strong>الخدمات المشمولة:</strong>
                ${services.map(s => `
                    <div class="service-item">
                        🔸 ${s.name} (${s.duration} دقيقة - ${s.price.toFixed(2)} جنيه)
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    card.innerHTML = `
        <div class="offer-status-bar ${status}">${statusText}</div>
        
        <div class="offer-content">
            <div class="offer-header">
                <div class="offer-title">
                    <div class="offer-service-name">${offer.serviceName}</div>
                    <div class="offer-category">${offer.categoryName}</div>
                </div>
                <div class="offer-type-badge ${offer.offerType}">
                    ${offer.offerType === 'package' ? '📦 باكدج' : '🏷️ تخفيض'}
                </div>
            </div>
            
            ${servicesHTML}
            
            <div class="offer-pricing">
                <div class="pricing-row">
                    <span class="pricing-label">السعر الأصلي:</span>
                    <span class="pricing-value original-price">${offer.originalPrice.toFixed(2)} جنيه</span>
                </div>
                <div class="pricing-row">
                    <span class="pricing-label">سعر العرض:</span>
                    <span class="pricing-value offer-price">${offer.offerPrice.toFixed(2)} جنيه</span>
                </div>
                <div class="pricing-row">
                    <span class="pricing-label">التوفير:</span>
                    <span class="discount-badge">خصم ${discount.toFixed(0)}%</span>
                </div>
            </div>
            
            <div class="offer-details">
                ${offer.offerType === 'package' ? `
                    <div class="detail-item">
                        <span class="detail-icon">🎫</span>
                        <span>عدد الجلسات: <span class="detail-value">${offer.sessionsCount} جلسة لكل خدمة</span></span>
                    </div>
                ` : ''}
                
                <div class="detail-item">
                    <span class="detail-icon">📅</span>
                    <span>من: <span class="detail-value">${formatDate(startDate)}</span></span>
                </div>
                
                <div class="detail-item">
                    <span class="detail-icon">🏁</span>
                    <span>إلى: <span class="detail-value">${formatDate(endDate)}</span></span>
                </div>
                
                <div class="detail-item">
                    <span class="detail-icon">👥</span>
                    <span>المستفيدين: <span class="detail-value">${offer.customersCount || 0}</span></span>
                </div>
            </div>
            
            ${offer.notes ? `
                <div class="offer-notes">
                    <strong>ملاحظات:</strong> ${offer.notes}
                </div>
            ` : ''}
            
            <div class="offer-actions">
                ${status !== 'expired' ? `
                    <button class="action-btn edit-btn" onclick="editOffer('${offer.id}')">
                        ✏️ تعديل
                    </button>
                ` : ''}
                <button class="action-btn delete-btn" onclick="deleteOffer('${offer.id}')">
                    🗑️ حذف
                </button>
                ${(offer.customersCount || 0) > 0 ? `
                    <button class="action-btn customers-btn" onclick="viewCustomers('${offer.id}')">
                        👥 عرض العملاء (${offer.customersCount})
                    </button>
                ` : ''}
            </div>
        </div>
    `;
    
    return card;
}

// ========== تعديل العرض ==========
window.editOffer = async function(offerId) {
    const offer = allOffers.find(o => o.id === offerId);
    if (!offer) return;
    
    document.getElementById('editOfferId').value = offerId;
    document.getElementById('editOfferPrice').value = offer.offerPrice;
    document.getElementById('editEndDate').value = formatDateForInput(offer.endDate.toDate());
    document.getElementById('editOfferNotes').value = offer.notes || '';
    
    document.getElementById('editOfferModal').classList.remove('hidden');
};

async function saveOfferEdit(e) {
    e.preventDefault();
    
    const offerId = document.getElementById('editOfferId').value;
    const newPrice = parseFloat(document.getElementById('editOfferPrice').value);
    const newEndDate = document.getElementById('editEndDate').value;
    const newNotes = document.getElementById('editOfferNotes').value.trim();
    
    try {
        await updateDoc(doc(db, "offers", offerId), {
            offerPrice: newPrice,
            endDate: Timestamp.fromDate(new Date(newEndDate)),
            notes: newNotes,
            updatedAt: Timestamp.now(),
            updatedBy: currentUser.uid
        });
        
        showMessage('✅ تم تحديث العرض بنجاح!', 'success');
        closeEditModal();
        await loadOffers();
        
    } catch (error) {
        console.error("خطأ في تحديث العرض:", error);
        showMessage('❌ حدث خطأ أثناء تحديث العرض', 'error');
    }
}

window.closeEditModal = function() {
    document.getElementById('editOfferModal').classList.add('hidden');
};

// ========== حذف العرض ==========
window.deleteOffer = async function(offerId) {
    if (!confirm('⚠️ هل أنت متأكد من حذف هذا العرض؟\nلن يتمكن العملاء من استخدامه بعد الحذف.')) {
        return;
    }
    
    try {
        await deleteDoc(doc(db, "offers", offerId));
        showMessage('✅ تم حذف العرض بنجاح!', 'success');
        await loadOffers();
    } catch (error) {
        console.error("خطأ في حذف العرض:", error);
        showMessage('❌ حدث خطأ أثناء حذف العرض', 'error');
    }
};

// ========== عرض العملاء المستفيدين ==========
window.viewCustomers = async function(offerId) {
    try {
        const q = query(collection(db, "customerOffers"), where("offerId", "==", offerId));
        const querySnapshot = await getDocs(q);
        
        const customersList = document.getElementById('customersList');
        customersList.innerHTML = '';
        
        if (querySnapshot.empty) {
            customersList.innerHTML = '<div class="empty-state"><p>لا يوجد عملاء استفادوا من هذا العرض بعد</p></div>';
        } else {
            querySnapshot.forEach(docSnap => {
                const data = docSnap.data();
                const item = document.createElement('div');
                item.className = 'customer-item';
                
                item.innerHTML = `
                    <div class="customer-name">${data.customerName}</div>
                    <div class="customer-details">
                        📅 تاريخ الشراء: ${formatDate(data.purchaseDate.toDate())} |
                        🎫 الجلسات المتبقية: ${data.remainingSessions}/${data.totalSessions} |
                        💰 المبلغ المدفوع: ${data.purchasePrice.toFixed(2)} جنيه
                    </div>
                `;
                
                customersList.appendChild(item);
            });
        }
        
        document.getElementById('customersModal').classList.remove('hidden');
        
    } catch (error) {
        console.error("خطأ في جلب العملاء:", error);
        showMessage('❌ حدث خطأ أثناء جلب بيانات العملاء', 'error');
    }
};

window.closeCustomersModal = function() {
    document.getElementById('customersModal').classList.add('hidden');
};

// ========== تحديث الإحصائيات ==========
function updateStatistics() {
    const now = new Date();
    
    const activeOffers = allOffers.filter(o => o.endDate.toDate() >= now).length;
    const expiredOffers = allOffers.filter(o => o.endDate.toDate() < now).length;
    
    document.getElementById('activeOffersCount').textContent = activeOffers;
    document.getElementById('expiredOffersCount').textContent = expiredOffers;
    document.getElementById('totalOffersCount').textContent = allOffers.length;
}

// ========== دوال مساعدة ==========
function setMinDates() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('startDate').min = today;
    document.getElementById('endDate').min = today;
}

function formatDate(date) {
    return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function showMessage(text, type = 'info') {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = text;
    messageDiv.className = `message-container ${type}`;
    messageDiv.style.display = 'block';
    
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 5000);
}

console.log('✅ تم تحميل نظام إدارة العروض بنجاح مع دعم خدمتين');