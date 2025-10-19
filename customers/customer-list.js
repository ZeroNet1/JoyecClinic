// customer-list.js - مع وظيفة حذف العميل
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    getDocs,
    query,
    orderBy,
    doc,
    deleteDoc,
    where,
    writeBatch
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

let allCustomers = [];
let currentSearch = '';
let currentSort = 'newest';
let isAdmin = false;
let customerToDelete = null;

// التحقق من صلاحية المستخدم
checkUserRole().then(userData => {
    if (userData) {
        document.getElementById('userName').textContent = userData.name;
        isAdmin = userData.role === 'admin';
        loadCustomers();
        setupEventListeners();
    }
});

// إعداد مستمعي الأحداث
function setupEventListeners() {
    // البحث
    document.getElementById('searchInput').addEventListener('input', function(e) {
        currentSearch = e.target.value.toLowerCase();
        filterCustomers();
    });
    
    // مسح البحث
    document.getElementById('clearSearch').addEventListener('click', function() {
        document.getElementById('searchInput').value = '';
        currentSearch = '';
        filterCustomers();
    });
    
    // الترتيب
    document.getElementById('sortSelect').addEventListener('change', function(e) {
        currentSort = e.target.value;
        sortCustomers();
    });

    // إغلاق المودال
    document.getElementById('closeDeleteModal').addEventListener('click', hideDeleteModal);
    document.getElementById('cancelDeleteBtn').addEventListener('click', hideDeleteModal);
    document.getElementById('confirmDeleteBtn').addEventListener('click', confirmDelete);

    // إغلاق المودال عند النقر على الخلفية
    document.getElementById('deleteModal').addEventListener('click', function(e) {
        if (e.target.id === 'deleteModal') {
            hideDeleteModal();
        }
    });
}

// تحميل العملاء
async function loadCustomers() {
    const customersList = document.getElementById('customersList');
    customersList.innerHTML = '<div class="loading">⏳ جاري تحميل العملاء...</div>';
    
    try {
        const q = query(collection(db, "customers"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        
        allCustomers = [];
        querySnapshot.forEach((doc) => {
            allCustomers.push({ id: doc.id, ...doc.data() });
        });
        
        filterCustomers();
        
    } catch (error) {
        console.error("خطأ في تحميل العملاء:", error);
        customersList.innerHTML = '<div class="error">❌ حدث خطأ في تحميل العملاء</div>';
    }
}

// تصفية العملاء
function filterCustomers() {
    let filteredCustomers = allCustomers;
    
    // التصفية حسب البحث
    if (currentSearch) {
        filteredCustomers = filteredCustomers.filter(customer => {
            const searchLower = currentSearch;
            const nameMatch = customer.name.toLowerCase().includes(searchLower);
            const phoneMatch = customer.phone.includes(currentSearch);
            const idMatch = String(customer.id).includes(currentSearch);
            return nameMatch || phoneMatch || idMatch;
        });
    }
    
    // الترتيب
    sortCustomers(filteredCustomers);
}

// ترتيب العملاء
function sortCustomers(customers = allCustomers) {
    let sortedCustomers = [...customers];
    
    switch (currentSort) {
        case 'newest':
            sortedCustomers.sort((a, b) => {
                const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
                const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
                return dateB - dateA;
            });
            break;
        case 'oldest':
            sortedCustomers.sort((a, b) => {
                const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
                const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
                return dateA - dateB;
            });
            break;
        case 'name':
            sortedCustomers.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
            break;
        case 'balance':
            sortedCustomers.sort((a, b) => (b.balance || 0) - (a.balance || 0));
            break;
        case 'visits':
            sortedCustomers.sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0));
            break;
    }
    
    displayCustomers(sortedCustomers);
}

// عرض العملاء
function displayCustomers(customers) {
    const customersList = document.getElementById('customersList');
    const customersCount = document.getElementById('customersCount');
    
    // تحديث العداد
    customersCount.textContent = `${customers.length} عميل`;
    
    if (customers.length === 0) {
        customersList.innerHTML = `
            <div class="empty-state">
                <div class="icon">👥</div>
                <h3>لا توجد عملاء</h3>
                <p>${allCustomers.length === 0 ? 'ابدأ بإضافة عملاء جدد!' : 'لم يتم العثور على عملاء تطابق معايير البحث'}</p>
            </div>
        `;
        return;
    }
    
    customersList.innerHTML = '';
    
    customers.forEach(customer => {
        const customerItem = document.createElement('div');
        customerItem.className = 'customer-item';
        
        const balance = customer.balance || 0;
        let balanceClass = 'zero';
        if (balance > 0) balanceClass = 'positive';
        else if (balance < 0) balanceClass = 'negative';
        
        const visitCount = customer.visitCount || 0;
        const customerId = customer.id || '-';
        
        customerItem.innerHTML = `
            <div class="customer-info">
                <div class="customer-name">
                    ${customer.name}
                    <span class="customer-id-badge">#${customerId}</span>
                </div>
                <div class="customer-details">
                    <div class="customer-phone">📱 ${customer.phone}</div>
                    <div class="customer-balance ${balanceClass}">
                        💰 ${balance.toFixed(2)} جنيه
                    </div>
                    <div class="customer-visits">
                        🔄 ${visitCount} زيارة
                    </div>
                </div>
            </div>
            <div class="customer-actions">
                <button class="view-details-btn" onclick="viewCustomerDetails('${customer.id}')">
                    📋 عرض التفاصيل
                </button>
                ${isAdmin ? `
                    <button class="delete-btn" onclick="showDeleteModal('${customer.id}', '${customer.name}', '${customer.phone}', '${customerId}')">
                        🗑️ حذف
                    </button>
                ` : ''}
            </div>
        `;
        
        customersList.appendChild(customerItem);
    });
}

// عرض تفاصيل العميل
window.viewCustomerDetails = function(customerId) {
    window.location.href = `customer-details.html?id=${customerId}`;
}

// إظهار مودال الحذف
window.showDeleteModal = function(customerId, customerName, customerPhone, displayId) {
    customerToDelete = {
        id: customerId,
        name: customerName,
        phone: customerPhone,
        displayId: displayId
    };
    
    document.getElementById('deleteCustomerName').textContent = customerName;
    document.getElementById('deleteCustomerPhone').textContent = customerPhone;
    document.getElementById('deleteCustomerId').textContent = displayId;
    
    document.getElementById('deleteModal').classList.remove('hidden');
}

// إخفاء مودال الحذف
function hideDeleteModal() {
    document.getElementById('deleteModal').classList.add('hidden');
    customerToDelete = null;
}

// تأكيد الحذف
async function confirmDelete() {
    if (!customerToDelete || !isAdmin) {
        alert('❌ غير مصرح لك بحذف العملاء!');
        return;
    }

    const confirmBtn = document.getElementById('confirmDeleteBtn');
    const originalText = confirmBtn.textContent;
    confirmBtn.textContent = '⏳ جاري الحذف...';
    confirmBtn.disabled = true;

    try {
        // حذف العميل وجميع بياناته المرتبطة
        await deleteCustomerAndRelatedData(customerToDelete.id, customerToDelete.phone);

        // تسجيل الشيفت
        try {
            const shiftModule = await import('../shift-management/shift-management.js');
            if (shiftModule && shiftModule.addShiftAction) {
                await shiftModule.addShiftAction(
                    'حذف عميل',
                    `تم حذف العميل: ${customerToDelete.name} - هاتف: ${customerToDelete.phone} - ID: ${customerToDelete.displayId}`
                );
            }
        } catch (shiftError) {
            console.log('لا يمكن تسجيل إجراء الشيفت:', shiftError);
        }

        alert(`✅ تم حذف العميل "${customerToDelete.name}" بنجاح!`);
        hideDeleteModal();
        
        // إعادة تحميل القائمة
        await loadCustomers();

    } catch (error) {
        console.error("خطأ في حذف العميل:", error);
        alert('❌ حدث خطأ أثناء حذف العميل: ' + (error.message || error));
        confirmBtn.textContent = originalText;
        confirmBtn.disabled = false;
    }
}

// حذف العميل وجميع البيانات المرتبطة
async function deleteCustomerAndRelatedData(customerId, customerPhone) {
    const batch = writeBatch(db);

    // 1. حذف العميل
    const customerRef = doc(db, "customers", customerId);
    batch.delete(customerRef);

    // 2. حذف قفل الهاتف
    const phoneKey = customerPhone.replace(/\s+/g, '');
    const phoneRef = doc(db, "customers_by_phone", phoneKey);
    batch.delete(phoneRef);

    // 3. حذف الزيارات
    const visitsQuery = query(collection(db, "visits"), where("customerId", "==", customerId));
    const visitsSnapshot = await getDocs(visitsQuery);
    visitsSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
    });

    // 4. حذف المعاملات المالية
    const transactionsQuery = query(collection(db, "transactions"), where("customerId", "==", customerId));
    const transactionsSnapshot = await getDocs(transactionsQuery);
    transactionsSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
    });

    // 5. حذف الحجوزات
    const bookingsQuery = query(collection(db, "bookings"), where("customerId", "==", customerId));
    const bookingsSnapshot = await getDocs(bookingsQuery);
    bookingsSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
    });

    // 6. حذف عروض العميل (إن وجدت)
    try {
        const customerOffersQuery = query(collection(db, "customerOffers"), where("customerId", "==", customerId));
        const offersSnapshot = await getDocs(customerOffersQuery);
        offersSnapshot.forEach((doc) => {
            batch.delete(doc.ref);
        });
    } catch (error) {
        console.log('لا توجد عروض للعميل أو خطأ في الحذف:', error);
    }

    // 7. تنفيذ جميع عمليات الحذف
    await batch.commit();
}

// تصدير الدوال للاستخدام العام
window.viewCustomerDetails = viewCustomerDetails;
window.showDeleteModal = showDeleteModal;