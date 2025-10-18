// customer-list.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    getDocs,
    query,
    orderBy
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

// التحقق من صلاحية المستخدم
checkUserRole().then(userData => {
    if (userData) {
        document.getElementById('userName').textContent = userData.name;
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
}

// تحميل العملاء
async function loadCustomers() {
    const customersList = document.getElementById('customersList');
    customersList.innerHTML = '<div class="loading">جاري تحميل العملاء...</div>';
    
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
        customersList.innerHTML = '<div class="error">حدث خطأ في تحميل العملاء</div>';
    }
}

// تصفية العملاء
function filterCustomers() {
    let filteredCustomers = allCustomers;
    
    // التصفية حسب البحث
    if (currentSearch) {
        filteredCustomers = filteredCustomers.filter(customer => 
            customer.name.toLowerCase().includes(currentSearch) ||
            customer.phone.includes(currentSearch)
        );
    }
    
    // الترتيب
    sortCustomers(filteredCustomers);
}

// ترتيب العملاء
function sortCustomers(customers = allCustomers) {
    let sortedCustomers = [...customers];
    
    switch (currentSort) {
        case 'newest':
            sortedCustomers.sort((a, b) => b.createdAt - a.createdAt);
            break;
        case 'oldest':
            sortedCustomers.sort((a, b) => a.createdAt - b.createdAt);
            break;
        case 'name':
            sortedCustomers.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
            break;
        case 'balance':
            sortedCustomers.sort((a, b) => b.balance - a.balance);
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
        customerItem.innerHTML = `
            <div class="customer-info">
                <div class="customer-name">${customer.name}</div>
                <div class="customer-details">
                    <div class="customer-phone">📱 ${customer.phone}</div>
                    <div class="customer-balance ${customer.balance > 0 ? 'positive' : 'zero'}">
                        💰 ${customer.balance.toFixed(2)} جنيه
                    </div>
                </div>
            </div>
            <div class="customer-actions">
                <button class="view-details-btn" onclick="viewCustomerDetails('${customer.id}')">
                    عرض التفاصيل
                </button>
            </div>
        `;
        
        customersList.appendChild(customerItem);
    });
}

// عرض تفاصيل العميل
window.viewCustomerDetails = function(customerId) {
    window.location.href = `customer-details.html?id=${customerId}`;
};