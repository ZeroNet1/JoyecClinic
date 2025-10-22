// services.js (مُصلح - استبدل الملف القديم بهذا)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    deleteDoc, 
    doc,
    query,
    orderBy,
    Timestamp,
    updateDoc
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

let allServices = [];
let allCategories = [];
let currentFilter = 'all';
let currentSearch = '';

// مساعدة لجلب عنصر DOM بأمان
function el(id) {
    return document.getElementById(id) || null;
}

// دالة تهيئة تُنفذ بعد جاهزية DOM
async function init() {
    // التحقق من صلاحية المستخدم ثم البدء
    try {
        const userData = await checkUserRole();
        if (userData) {
            if (el('userName')) el('userName').textContent = userData.name;
            if (el('userRole')) el('userRole').textContent = userData.role;

            // تحميل البيانات والربط بأمان (كل دالة تتعامل مع غياب العناصر داخلياً)
            await loadCategories();
            await loadServices();
            setupEventListeners();
        } else {
            console.warn('checkUserRole returned no userData.');
        }
    } catch (err) {
        console.error('خطأ في التحقق من صلاحية المستخدم:', err);
    }
}

// إذا لم يُحمّل DOM بعد، انتظر DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    // إذا كان جاهز بالفعل
    init();
}

/* ---------- إعداد مستمعي الأحداث مع حماية من null ---------- */
function setupEventListeners() {
    const categoryFilter = el('categoryFilter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', function(e) {
            currentFilter = e.target.value;
            filterServices();
        });
    } else {
        console.warn('عنصر #categoryFilter غير موجود في الصفحة.');
    }

    const searchInput = el('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            currentSearch = e.target.value.toLowerCase();
            filterServices();
        });
    } else {
        console.warn('عنصر #searchInput غير موجود في الصفحة.');
    }

    const clearSearchBtn = el('clearSearch');
    if (clearSearchBtn && el('searchInput')) {
        clearSearchBtn.addEventListener('click', function() {
            el('searchInput').value = '';
            currentSearch = '';
            filterServices();
        });
    } else {
        if (!clearSearchBtn) console.warn('عنصر #clearSearch غير موجود.');
    }

    // forms: تأكد من وجودهم قبل إضافة السامع
    const addCategoryForm = el('addCategoryForm');
    if (addCategoryForm) {
        addCategoryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nameEl = el('categoryName');
            const categoryName = nameEl ? nameEl.value.trim() : '';
            
            if (!categoryName) {
                showMessage('⚠️ يرجى إدخال اسم القسم', 'warning');
                return;
            }
            
            const existingCategory = allCategories.find(cat => cat.name.toLowerCase() === categoryName.toLowerCase());
            if (existingCategory) {
                showMessage('⚠️ اسم القسم مسجل مسبقاً!', 'warning');
                return;
            }
            
            try {
                await addDoc(collection(db, "categories"), {
                    name: categoryName,
                    createdAt: Timestamp.now()
                });
                showMessage('✅ تم إضافة القسم بنجاح!', 'success');
                addCategoryForm.reset();
                await loadCategories();
            } catch (error) {
                console.error("Error adding category: ", error);
                showMessage('❌ حدث خطأ أثناء إضافة القسم', 'error');
            }
        });
    } else {
        console.warn('#addCategoryForm غير موجود - لن يعمل إضافة قسم.');
    }

    const addServiceForm = el('addServiceForm');
    if (addServiceForm) {
        addServiceForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const categoryId = el('serviceCategory') ? el('serviceCategory').value : '';
            const serviceName = el('serviceName') ? el('serviceName').value.trim() : '';
            const serviceDuration = el('serviceDuration') ? parseInt(el('serviceDuration').value) || 0 : 0;
            const servicePrice = el('servicePrice') ? parseFloat(el('servicePrice').value) || 0 : 0;
            const serviceDescription = el('serviceDescription') ? el('serviceDescription').value.trim() : '';

            if (!categoryId) {
                showMessage('⚠️ يرجى اختيار قسم', 'warning');
                return;
            }
            if (!serviceName) {
                showMessage('⚠️ يرجى إدخال اسم الخدمة', 'warning');
                return;
            }
            if (serviceDuration <= 0) {
                showMessage('⚠️ يرجى إدخال مدة الخدمة بشكل صحيح', 'warning');
                return;
            }
            if (servicePrice <= 0) {
                showMessage('⚠️ يرجى إدخال سعر الخدمة بشكل صحيح', 'warning');
                return;
            }

            const existingService = allServices.find(service => 
                service.name.toLowerCase() === serviceName.toLowerCase() && 
                service.categoryId === categoryId
            );

            if (existingService) {
                showMessage('⚠️ اسم الخدمة مسجل مسبقاً في هذا القسم!', 'warning');
                return;
            }

            try {
                await addDoc(collection(db, "services"), {
                    categoryId: categoryId,
                    name: serviceName,
                    duration: serviceDuration,
                    price: servicePrice,
                    description: serviceDescription,
                    createdAt: Timestamp.now(),
                    isActive: true
                });
                
                showMessage('✅ تم إضافة الخدمة بنجاح!', 'success');
                addServiceForm.reset();
                await loadServices();
            } catch (error) {
                console.error("Error adding service: ", error);
                showMessage('❌ حدث خطأ أثناء إضافة الخدمة', 'error');
            }
        });
    } else {
        console.warn('#addServiceForm غير موجود - لن يعمل إضافة خدمة.');
    }
}

/* ---------- تحميل الأقسام (آمن للغياب العناصر) ---------- */
async function loadCategories() {
    const categorySelect = el('serviceCategory');
    const categoryFilter = el('categoryFilter');
    
    try {
        const querySnapshot = await getDocs(query(collection(db, "categories"), orderBy("name")));
        
        // إن لم توجد عناصر النموذج، سنبني allCategories فقط ونستمر
        if (categorySelect) categorySelect.innerHTML = '<option value="">اختر القسم</option>';
        if (categoryFilter) categoryFilter.innerHTML = '<option value="all">جميع الأقسام</option>';
        
        allCategories = [];
        querySnapshot.forEach((docSnap) => {
            const category = { id: docSnap.id, ...docSnap.data() };
            allCategories.push(category);
            
            if (categoryFilter) {
                const filterOption = document.createElement('option');
                filterOption.value = docSnap.id;
                filterOption.textContent = category.name;
                categoryFilter.appendChild(filterOption);
            }
            
            if (categorySelect) {
                const formOption = document.createElement('option');
                formOption.value = docSnap.id;
                formOption.textContent = category.name;
                categorySelect.appendChild(formOption);
            }
        });
        
        // تحديث الإحصائيات (دالة آمنة)
        updateCategoryStats();
        
    } catch (error) {
        console.error("Error loading categories: ", error);
        showMessage('❌ حدث خطأ في تحميل الأقسام', 'error');
    }
}

/* ---------- تحديث إحصائيات الأقسام (آمن) ---------- */
function updateCategoryStats() {
    const totalCategoriesEl = el('totalCategories');
    if (totalCategoriesEl) totalCategoriesEl.textContent = allCategories.length;

    const categoryStats = {};
    allServices.forEach(service => {
        const categoryId = service.categoryId;
        categoryStats[categoryId] = (categoryStats[categoryId] || 0) + 1;
    });

    const statsElement = el('categoryStats');
    if (statsElement) {
        let statsHTML = '';
        allCategories.forEach(category => {
            const serviceCount = categoryStats[category.id] || 0;
            statsHTML += `
                <div class="category-stat">
                    <span class="category-name">${category.name}</span>
                    <span class="service-count">${serviceCount} خدمة</span>
                </div>
            `;
        });
        statsElement.innerHTML = statsHTML;
    } else {
        // إذا لم يكن عنصر الإحصائيات موجود فلا نعرض شيء، لكن نُسجل للتحقق
        console.debug('عنصر #categoryStats غير موجود — تم تحديث العدّاد فقط.');
    }
}

/* ---------- تحميل الخدمات (آمن) ---------- */
async function loadServices() {
    const loadingElement = el('loadingServices');
    const emptyState = el('emptyServicesState');

    if (loadingElement) loadingElement.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';
    
    try {
        const q = query(collection(db, "services"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        allServices = [];
        
        querySnapshot.forEach(docSnap => {
            const serviceData = docSnap.data();
            const service = {
                id: docSnap.id,
                categoryId: serviceData.categoryId || '',
                name: serviceData.name || 'خدمة بدون اسم',
                duration: serviceData.duration || 0,
                price: serviceData.price || 0,
                description: serviceData.description || '',
                isActive: serviceData.isActive !== undefined ? serviceData.isActive : true,
                createdAt: serviceData.createdAt || Timestamp.now()
            };
            allServices.push(service);
        });
        
        filterServices();
        updateCategoryStats();
    } catch (error) {
        console.error("Error loading services: ", error);
        displayServices([]); // عرض فارغ بدل تحطيم الصفحة
        showMessage('❌ حدث خطأ في تحميل الخدمات', 'error');
    } finally {
        if (loadingElement) loadingElement.style.display = 'none';
    }
}

/* ---------- تصفية وعرض الخدمات (آمنة) ---------- */
function filterServices() {
    let filteredServices = allServices.slice();

    if (currentFilter && currentFilter !== 'all') {
        filteredServices = filteredServices.filter(s => s.categoryId === currentFilter);
    }

    if (currentSearch) {
        filteredServices = filteredServices.filter(s => s.name && s.name.toLowerCase().includes(currentSearch));
    }

    filteredServices = filteredServices.filter(s => s.isActive !== false);

    displayServices(filteredServices);
}

function displayServices(services) {
    const servicesGrid = el('servicesGrid');
    const servicesCount = el('servicesCount');
    const emptyState = el('emptyServicesState');

    if (servicesCount) servicesCount.textContent = `${services.length} خدمة`;

    if (!servicesGrid) {
        console.warn('#servicesGrid غير موجود - لا يمكن عرض الخدمات في الـ DOM.');
        return;
    }

    if (services.length === 0) {
        servicesGrid.innerHTML = '';
        if (emptyState) {
            emptyState.style.display = 'block';
            emptyState.innerHTML = `
                <div class="empty-state">
                    <div class="icon">💅</div>
                    <h3>لا توجد خدمات</h3>
                    <p>${allServices.length === 0 ? 'ابدأ بإضافة خدمات جديدة!' : 'لم يتم العثور على خدمات تطابق معايير البحث'}</p>
                </div>
            `;
        }
        return;
    }

    if (emptyState) emptyState.style.display = 'none';
    servicesGrid.innerHTML = '';

    services.forEach(service => {
        const category = allCategories.find(cat => cat.id === service.categoryId);
        const categoryName = category ? category.name : 'غير معروف';
        const categoryColor = getCategoryColor(service.categoryId);

        const serviceCard = document.createElement('div');
        serviceCard.className = 'service-card';
        serviceCard.innerHTML = `
            <div class="service-header">
                <div class="service-category" style="background-color: ${categoryColor}">${categoryName}</div>
                <div class="service-status ${service.isActive ? 'active' : 'inactive'}">
                    ${service.isActive ? 'نشط' : 'غير نشط'}
                </div>
            </div>
            <div class="service-name">${service.name}</div>
            ${service.description ? `<div class="service-description">${service.description}</div>` : ''}
            <div class="service-details">
                <div class="service-detail">
                    <span class="icon">⏱️</span>
                    <span>${service.duration} دقيقة</span>
                </div>
                <div class="service-detail">
                    <span class="icon">💰</span>
                    <span>${service.price.toFixed(2)} جنيه مصري</span>
                </div>
            </div>
            <div class="service-actions">
                <button class="edit-service-btn" onclick="editService('${service.id}')">✏️ تعديل</button>
                <button class="delete-service-btn" onclick="deleteService('${service.id}')">🗑️ حذف</button>
            </div>
        `;
        servicesGrid.appendChild(serviceCard);
    });
}

/* ---------- أدوات مساعدة ---------- */
function getCategoryColor(categoryId) {
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
        '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    const index = allCategories.findIndex(cat => cat.id === categoryId);
    return (colors[(index >= 0 ? index : 0) % colors.length] || colors[0]) + '20';
}

/* ---------- حذف، تعديل، حذف قسم (آمن) ---------- */
window.deleteService = async function(serviceId) {
    if (!confirm('هل أنت متأكد من حذف هذه الخدمة؟')) return;
    try {
        await deleteDoc(doc(db, "services", serviceId));
        showMessage('✅ تم حذف الخدمة بنجاح!', 'success');
        await loadServices();
    } catch (error) {
        console.error("Error deleting service: ", error);
        showMessage('❌ حدث خطأ أثناء حذف الخدمة', 'error');
    }
};

window.editService = async function(serviceId) {
    const service = allServices.find(s => s.id === serviceId);
    if (!service) return;
    
    const newName = prompt(`اسم الخدمة الحالي: ${service.name}\nأدخل الاسم الجديد:`, service.name);
    if (newName === null) return;
    
    const newDuration = prompt(`مدة الخدمة الحالية: ${service.duration} دقيقة\nأدخل المدة الجديدة:`, service.duration);
    if (newDuration === null) return;
    
    const newPrice = prompt(`سعر الخدمة الحالي: ${service.price.toFixed(2)} جنيه\nأدخل السعر الجديد:`, service.price);
    if (newPrice === null) return;
    
    try {
        const duration = parseInt(newDuration);
        const price = parseFloat(newPrice);
        
        if (isNaN(duration) || duration <= 0) {
            showMessage('⚠️ يرجى إدخال مدة صحيحة', 'warning');
            return;
        }
        if (isNaN(price) || price <= 0) {
            showMessage('⚠️ يرجى إدخال سعر صحيح', 'warning');
            return;
        }
        
        await updateDoc(doc(db, "services", serviceId), {
            name: newName.trim(),
            duration: duration,
            price: price,
            updatedAt: Timestamp.now()
        });
        
        showMessage('✅ تم تعديل الخدمة بنجاح!', 'success');
        await loadServices();
    } catch (error) {
        console.error("Error editing service: ", error);
        showMessage('❌ حدث خطأ أثناء تعديل الخدمة', 'error');
    }
};

window.deleteCategory = async function(categoryId) {
    if (!confirm('⚠️ سيتم حذف القسم وجميع الخدمات المرتبطة به. هل أنت متأكد؟')) return;
    try {
        const servicesInCategory = allServices.filter(s => s.categoryId === categoryId);
        if (servicesInCategory.length > 0) {
            if (!confirm(`⚠️ يوجد ${servicesInCategory.length} خدمة مرتبطة بهذا القسم. سيتم حذفها جميعاً. هل تريد المتابعة؟`)) {
                return;
            }
            const deletePromises = servicesInCategory.map(s => deleteDoc(doc(db, "services", s.id)));
            await Promise.all(deletePromises);
        }
        await deleteDoc(doc(db, "categories", categoryId));
        showMessage('✅ تم حذف القسم والخدمات المرتبطة به بنجاح!', 'success');
        await loadCategories();
        await loadServices();
    } catch (error) {
        console.error("Error deleting category: ", error);
        showMessage('❌ حدث خطأ أثناء حذف القسم', 'error');
    }
};

/* ---------- عرض الرسائل (آمن) ---------- */
function showMessage(text, type = 'info') {
    const messageDiv = el('message');
    if (!messageDiv) {
        // إن لم يوجد عنصر للرسائل، نعرض في الكونسل (لا نكسر التنفيذ)
        if (type === 'error') console.error(text);
        else if (type === 'warning') console.warn(text);
        else console.log(text);
        return;
    }
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    
    setTimeout(() => {
        if (messageDiv) messageDiv.style.display = 'none';
    }, 5000);
}

/* ---------- إضافات CSS عبر DOM (تبقى كما عندك) ---------- */
const additionalStyle = document.createElement('style');
additionalStyle.textContent = `
    .service-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
    .service-status { padding:2px 8px; border-radius:12px; font-size:11px; font-weight:bold; }
    .service-status.active { background-color:#d4edda; color:#155724; }
    .service-status.inactive { background-color:#f8d7da; color:#721c24; }
    .service-description { color:#666; font-size:14px; margin:8px 0; line-height:1.4; }
    .service-actions { display:flex; gap:8px; margin-top:15px; }
    .edit-service-btn, .delete-service-btn { padding:6px 12px; border:none; border-radius:4px; cursor:pointer; font-size:12px; flex:1; }
    .edit-service-btn { background-color:#ffc107; color:#212529; }
    .delete-service-btn { background-color:#dc3545; color:white; }
    .category-stat { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #eee; }
    .category-stat:last-child { border-bottom:none; }
    .category-name { font-weight:bold; }
    .service-count { color:#666; }
`;
document.head.appendChild(additionalStyle);
