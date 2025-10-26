// admin-page.js - الكود الكامل مع التعديلات لحساب إيرادات الموظفين من عمليات الشحن فقط
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { 
    getAuth,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    getDocs,
    doc,
    getDoc,
    updateDoc,
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
const auth = getAuth(app);
const db = getFirestore(app);

let allEmployees = [];
let selectedEmployee = null;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

// التحقق من صلاحية المستخدم
checkUserRole().then(userData => {
    if (userData && userData.role === 'admin') {
        document.getElementById('adminName').textContent = userData.name;
        initializePage();
    } else {
        alert('❌ هذه الصفحة مخصصة للإدمن فقط!');
        window.location.href = '../main.html';
    }
});

// تهيئة الصفحة
async function initializePage() {
    setupEventListeners();
    await loadEmployees();
    updateStats();
    await loadDoctorsReports();
}

// إعداد مستمعي الأحداث
function setupEventListeners() {
    // البحث في الموظفين
    const searchInput = document.getElementById('searchEmployees');
    const roleFilter = document.getElementById('roleFilter');
    const salaryForm = document.getElementById('salaryForm');
    
    if (searchInput) {
        searchInput.addEventListener('input', debounce(searchEmployees, 300));
    }
    
    if (roleFilter) {
        roleFilter.addEventListener('change', filterEmployees);
    }
    
    if (salaryForm) {
        salaryForm.addEventListener('submit', saveSalary);
    }
}

// تحميل جميع الموظفين
async function loadEmployees() {
    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        allEmployees = [];
        
        const employeesGrid = document.getElementById('employeesGrid');
        if (employeesGrid) {
            employeesGrid.innerHTML = '<div class="loading">جاري تحميل البيانات...</div>';
        }
        
        querySnapshot.forEach(doc => {
            const user = { id: doc.id, ...doc.data() };
            // استبعاد الحسابات المحذوفة أو غير النشطة
            if (user.isActive !== false) {
                allEmployees.push(user);
            }
        });
        
        displayEmployees(allEmployees);
        
    } catch (error) {
        console.error("❌ خطأ في تحميل الموظفين:", error);
        const employeesGrid = document.getElementById('employeesGrid');
        if (employeesGrid) {
            employeesGrid.innerHTML = '<div class="error">حدث خطأ في تحميل البيانات</div>';
        }
    }
}

// عرض الموظفين
function displayEmployees(employees) {
    const employeesGrid = document.getElementById('employeesGrid');
    if (!employeesGrid) return;
    
    if (employees.length === 0) {
        employeesGrid.innerHTML = `
            <div class="empty-state">
                <div class="icon">👥</div>
                <h3>لا يوجد موظفين</h3>
                <p>لم يتم إضافة أي موظفين بعد</p>
            </div>
        `;
        return;
    }
    
    employeesGrid.innerHTML = '';
    
    employees.forEach(employee => {
        const employeeCard = createEmployeeCard(employee);
        employeesGrid.appendChild(employeeCard);
    });
}

// إنشاء بطاقة موظف
function createEmployeeCard(employee) {
    const employeeCard = document.createElement('div');
    employeeCard.className = 'employee-card';
    
    const roleText = getRoleText(employee.role);
    const roleClass = getRoleClass(employee.role);
    
    employeeCard.innerHTML = `
        <div class="employee-header">
            <div class="employee-name">${employee.name}</div>
            <div class="employee-role ${roleClass}">${roleText}</div>
        </div>
        <div class="employee-details">
            <div class="employee-detail">
                <span class="detail-label">البريد الإلكتروني:</span>
                <span class="detail-value">${employee.email || 'غير متوفر'}</span>
            </div>
            <div class="employee-detail">
                <span class="detail-label">الهاتف:</span>
                <span class="detail-value">${employee.phone || 'غير متوفر'}</span>
            </div>
            <div class="employee-detail">
                <span class="detail-label">تاريخ التسجيل:</span>
                <span class="detail-value">${safeFormatDate(employee.createdAt)}</span>
            </div>
        </div>
        <div class="employee-salary">
            المرتب: ${employee.salary ? employee.salary.toFixed(2) + ' جنيه' : 'غير محدد'}
        </div>
    `;
    
    // النقر المزدوج لفتح التفاصيل
    employeeCard.addEventListener('dblclick', () => openEmployeeDetails(employee));
    
    return employeeCard;
}

// فتح تفاصيل الموظف
function openEmployeeDetails(employee) {
    selectedEmployee = employee;
    
    const modalTitle = document.getElementById('employeeModalTitle');
    const detailsContent = document.getElementById('employeeDetailsContent');
    const modal = document.getElementById('employeeModal');
    
    if (!modalTitle || !detailsContent || !modal) return;
    
    modalTitle.textContent = `تفاصيل ${employee.name}`;
    
    const roleText = getRoleText(employee.role);
    
    detailsContent.innerHTML = `
        <div class="employee-info-grid">
            <div class="info-item">
                <div class="info-label">الاسم الكامل</div>
                <div class="info-value">${employee.name}</div>
            </div>
            <div class="info-item">
                <div class="info-label">الدور</div>
                <div class="info-value">${roleText}</div>
            </div>
            <div class="info-item">
                <div class="info-label">البريد الإلكتروني</div>
                <div class="info-value">${employee.email || 'غير متوفر'}</div>
            </div>
            <div class="info-item">
                <div class="info-label">رقم الهاتف</div>
                <div class="info-value">${employee.phone || 'غير متوفر'}</div>
            </div>
            <div class="info-item">
                <div class="info-label">المرتب الحالي</div>
                <div class="info-value">${employee.salary ? employee.salary.toFixed(2) + ' جنيه' : 'غير محدد'}</div>
            </div>
            <div class="info-item">
                <div class="info-label">تاريخ التسجيل</div>
                <div class="info-value">${safeFormatDate(employee.createdAt)}</div>
            </div>
        </div>
        
        <div class="action-buttons">
            <button class="btn btn-primary" onclick="openSalaryModal()">تحديد المرتب</button>
            <button class="btn btn-success" onclick="openProfitCalculation()">حساب الأرباح</button>
        </div>
    `;
    
    modal.classList.remove('hidden');
}

// فتح مودال تحديد المرتب
window.openSalaryModal = function() {
    if (!selectedEmployee) return;
    
    const employeeName = document.getElementById('employeeName');
    const employeeRole = document.getElementById('employeeRole');
    const monthlySalary = document.getElementById('monthlySalary');
    const salaryModal = document.getElementById('salaryModal');
    
    if (!employeeName || !employeeRole || !monthlySalary || !salaryModal) return;
    
    employeeName.value = selectedEmployee.name;
    employeeRole.value = getRoleText(selectedEmployee.role);
    monthlySalary.value = selectedEmployee.salary || '';
    
    salaryModal.classList.remove('hidden');
};

// حفظ المرتب
async function saveSalary(e) {
    e.preventDefault();
    
    if (!selectedEmployee) return;
    
    const salaryInput = document.getElementById('monthlySalary');
    if (!salaryInput) return;
    
    const salary = parseFloat(salaryInput.value);
    
    if (!salary || salary < 0) {
        alert('⚠️ يرجى إدخال مرتب صحيح!');
        return;
    }
    
    try {
        await updateDoc(doc(db, "users", selectedEmployee.id), {
            salary: salary,
            salaryUpdatedAt: Timestamp.now()
        });
        
        alert('✅ تم تحديث المرتب بنجاح!');
        closeSalaryModal();
        closeEmployeeModal();
        loadEmployees();
        updateStats();
        
    } catch (error) {
        console.error("❌ خطأ في تحديث المرتب:", error);
        alert('❌ حدث خطأ أثناء تحديث المرتب!');
    }
}

// فتح حساب الأرباح
window.openProfitCalculation = async function() {
    if (!selectedEmployee) return;
    
    const profitModalTitle = document.getElementById('profitModalTitle');
    const profitCalculationContent = document.getElementById('profitCalculationContent');
    const profitModal = document.getElementById('profitModal');
    
    if (!profitModalTitle || !profitCalculationContent || !profitModal) return;
    
    profitModalTitle.textContent = `حساب أرباح ${selectedEmployee.name}`;
    
    // ✅ إضافة خيارات اختيار الشهر والسنة
    profitCalculationContent.innerHTML = `
        <div class="profit-section">
            <h4>🔍 اختيار الفترة الزمنية</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                <div class="form-group">
                    <label for="profitMonth">الشهر:</label>
                    <select id="profitMonth" class="form-input">
                        <option value="0">يناير</option>
                        <option value="1">فبراير</option>
                        <option value="2">مارس</option>
                        <option value="3">أبريل</option>
                        <option value="4">مايو</option>
                        <option value="5">يونيو</option>
                        <option value="6">يوليو</option>
                        <option value="7">أغسطس</option>
                        <option value="8">سبتمبر</option>
                        <option value="9">أكتوبر</option>
                        <option value="10">نوفمبر</option>
                        <option value="11">ديسمبر</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="profitYear">السنة:</label>
                    <select id="profitYear" class="form-input">
                        ${generateYearOptionsForProfit()}
                    </select>
                </div>
            </div>
            <button onclick="loadEmployeeProfitWithDate()" class="btn btn-primary" style="width: 100%;">
                📊 تحميل بيانات الفترة المحددة
            </button>
        </div>
        
        <div id="profitResultsSection" style="display: none;">
            <!-- سيتم ملؤها بالنتائج -->
        </div>
    `;
    
    // تعيين الشهر والسنة الحالية كقيم افتراضية
    const currentDate = new Date();
    document.getElementById('profitMonth').value = currentDate.getMonth();
    document.getElementById('profitYear').value = currentDate.getFullYear();
    
    profitModal.classList.remove('hidden');
};

// ✅ دالة تحميل بيانات الأرباح حسب التاريخ المحدد - النسخة المصححة
window.loadEmployeeProfitWithDate = async function() {
    const monthSelect = document.getElementById('profitMonth');
    const yearSelect = document.getElementById('profitYear');
    const profitResultsSection = document.getElementById('profitResultsSection');
    
    if (!monthSelect || !yearSelect || !profitResultsSection) return;
    
    const selectedMonth = parseInt(monthSelect.value);
    const selectedYear = parseInt(yearSelect.value);
    
    if (isNaN(selectedMonth) || isNaN(selectedYear)) {
        alert('⚠️ يرجى اختيار شهر وسنة صحيحين!');
        return;
    }
    
    // عرض تحميل
    profitResultsSection.innerHTML = `
        <div class="loading-section">
            <div class="loading-spinner"></div>
            <div>جاري تحميل بيانات ${getMonthNameArabic(selectedMonth + 1)} ${selectedYear}...</div>
        </div>
    `;
    profitResultsSection.style.display = 'block';
    
    try {
        // ✅ استخدام دوال منفصلة بدلاً من نداء الذات
        if (selectedEmployee.role === 'doctor' || selectedEmployee.role === 'skin_doctor') {
            await loadDoctorProfitByDate(selectedMonth, selectedYear);
        } else {
            await loadEmployeeProfitByDate(selectedMonth, selectedYear);
        }
    } catch (error) {
        console.error("❌ خطأ في تحميل بيانات الأرباح:", error);
        profitResultsSection.innerHTML = `
            <div class="error">
                <h4>❌ حدث خطأ في تحميل البيانات</h4>
                <p>تفاصيل الخطأ: ${error.message}</p>
                <button onclick="loadEmployeeProfitWithDate()" class="btn btn-primary">إعادة المحاولة</button>
            </div>
        `;
    }
};

// ✅ دالة جديدة لحساب أرباح الموظفين حسب التاريخ - المحدثة لاستبعاد التحويل الداخلي
async function loadEmployeeProfitByDate(month, year) {
    if (!selectedEmployee) return;
    
    // حساب بداية ونهاية الشهر المحدد
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);
    
    let totalRevenue = 0;
    let totalBookings = 0;
    let totalOffers = 0;
    const revenueDetails = [];
    
    console.log(`🎯 حساب أرباح ${selectedEmployee.name} للشهر ${month + 1}-${year}`);
    
    try {
        // ✅ إضافة تصحيح البيانات للتحقق
        await debugShiftDataByDate(selectedEmployee.id, month, year);
        
        // إذا كان موظف استقبال، نحسب الإيرادات من الحجوزات والعروض أولاً
        if (selectedEmployee.role === 'reception') {
            console.log('🔍 البحث في الحجوزات والعروض...');
            
            // جلب جميع الحجوزات التي أنشأها الموظف خلال الشهر المحدد
            const bookingsQuery = query(
                collection(db, "bookings"),
                where("createdBy", "==", selectedEmployee.id),
                where("createdAt", ">=", Timestamp.fromDate(startOfMonth)),
                where("createdAt", "<=", Timestamp.fromDate(endOfMonth))
            );
            
            const bookingsSnapshot = await getDocs(bookingsQuery);
            
            console.log(`📅 عدد الحجوزات: ${bookingsSnapshot.size}`);
            
            bookingsSnapshot.forEach(bookingDoc => {
                const booking = bookingDoc.data();
                
                // فقط الحجوزات المدفوعة أو المؤكدة
                if (booking.status === 'confirmed' || booking.status === 'completed' || booking.paymentStatus === 'paid') {
                    const bookingAmount = booking.totalAmount || booking.servicePrice || 0;
                    if (bookingAmount > 0) {
                        totalRevenue += bookingAmount;
                        totalBookings++;
                        
                        revenueDetails.push({
                            type: 'booking',
                            customerName: booking.customerName || 'عميل',
                            serviceName: booking.serviceName || 'خدمة',
                            amount: bookingAmount,
                            date: booking.createdAt?.toDate() || new Date(),
                            status: booking.status,
                            source: 'حجز'
                        });
                        
                        console.log(`✅ إضافة حجز: ${bookingAmount} - ${booking.customerName}`);
                    }
                }
            });
            
            // جلب جميع العروض التي أنشأها الموظف خلال الشهر المحدد
            const offersQuery = query(
                collection(db, "offers"),
                where("createdBy", "==", selectedEmployee.id),
                where("createdAt", ">=", Timestamp.fromDate(startOfMonth)),
                where("createdAt", "<=", Timestamp.fromDate(endOfMonth))
            );
            
            const offersSnapshot = await getDocs(offersQuery);
            
            console.log(`🎁 عدد العروض: ${offersSnapshot.size}`);
            
            offersSnapshot.forEach(offerDoc => {
                const offer = offerDoc.data();
                const offerAmount = offer.totalAmount || offer.price || 0;
                
                if (offerAmount > 0) {
                    totalRevenue += offerAmount;
                    totalOffers++;
                    
                    revenueDetails.push({
                        type: 'offer',
                        customerName: offer.customerName || 'عميل',
                        serviceName: offer.offerName || 'عرض',
                        amount: offerAmount,
                        date: offer.createdAt?.toDate() || new Date(),
                        status: offer.status || 'active',
                        source: 'عرض'
                    });
                    
                    console.log(`✅ إضافة عرض: ${offerAmount} - ${offer.offerName}`);
                }
            });
            
            console.log(`💰 الإيراد من الحجوزات والعروض: ${totalRevenue}`);
            
            // إذا لم نجد بيانات في الحجوزات والعروض، نستخدم النظام المحسن للشيفتات
            if (totalBookings === 0 && totalOffers === 0) {
                console.log('🔄 الانتقال لحساب إيرادات الشيفتات...');
                await loadEmployeeProfitFromShiftsByDate(month, year, totalRevenue, revenueDetails);
            } else {
                console.log('📊 عرض إيرادات الحجوزات والعروض...');
                displayEmployeeProfitByDate(totalRevenue, totalBookings, totalOffers, revenueDetails, month, year);
            }
            
        } else {
            // للمحاسبين والموظفين الآخرين، نستخدم النظام المحسن للشيفتات
            console.log('🔄 حساب إيرادات الشيفتات للموظف...');
            await loadEmployeeProfitFromShiftsByDate(month, year, totalRevenue, revenueDetails);
        }
        
    } catch (error) {
        console.error("❌ خطأ في تحميل بيانات الأرباح:", error);
        throw error;
    }
}

// ✅ دالة جديدة لحساب أرباح الدكاترة حسب التاريخ
async function loadDoctorProfitByDate(month, year) {
    if (!selectedEmployee) return;
    
    // حساب بداية ونهاية الشهر المحدد
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);
    
    // جلب الحجوزات المكتملة للدكتور خلال الشهر المحدد
    const bookingsQuery = query(
        collection(db, "bookings"),
        where("doctorId", "==", selectedEmployee.id),
        where("status", "==", "completed"),
        where("completedAt", ">=", startOfMonth),
        where("completedAt", "<=", endOfMonth)
    );
    
    const querySnapshot = await getDocs(bookingsQuery);
    
    let totalOperations = 0;
    let totalAmount = 0;
    const operations = [];
    
    querySnapshot.forEach(doc => {
        const booking = doc.data();
        totalOperations++;
        totalAmount += booking.servicePrice || 0;
        
        operations.push({
            customerName: booking.customerName,
            serviceName: booking.serviceName,
            amount: booking.servicePrice || 0,
            date: booking.completedAt?.toDate() || new Date()
        });
    });
    
    displayDoctorProfitByDate(totalOperations, totalAmount, operations, month, year);
}

// ✅ دالة جديدة لعرض أرباح الدكاترة حسب التاريخ
function displayDoctorProfitByDate(totalOperations, totalAmount, operations, month, year) {
    const profitResultsSection = document.getElementById('profitResultsSection');
    if (!profitResultsSection) return;
    
    const monthName = getMonthNameArabic(month + 1);
    
    profitResultsSection.innerHTML = `
        <div class="profit-section">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h4>إحصائيات ${monthName} ${year}</h4>
                <div>
                    <button onclick="changeDateRange()" class="btn btn-secondary" style="margin-right: 10px;">
                        تغيير الفترة
                    </button>
                    <button onclick="printProfitReport(${month}, ${year})" class="btn btn-primary">
                        🖨️ طباعة التقرير
                    </button>
                </div>
            </div>
            
            <div class="profit-stats">
                <div class="profit-stat">
                    <div class="profit-stat-value">${totalOperations}</div>
                    <div class="profit-stat-label">عدد العمليات</div>
                </div>
                <div class="profit-stat">
                    <div class="profit-stat-value">${totalAmount.toFixed(2)}</div>
                    <div class="profit-stat-label">إجمالي المبلغ (جنيه)</div>
                </div>
            </div>
        </div>
        
        <div class="profit-section">
            <h4>حساب النسبة المئوية</h4>
            <div class="form-group">
                <label for="profitPercentage">النسبة المئوية (%):</label>
                <input type="number" id="profitPercentage" min="0" max="100" step="0.1" 
                       class="form-input percentage-input" placeholder="أدخل النسبة المئوية" value="10">
            </div>
            
            <div class="net-profit" id="netProfitSection">
                <div class="profit-stat-label">صافي الأرباح</div>
                <div class="net-profit-value" id="netProfitValue">${(totalAmount * 0.1).toFixed(2)} جنيه</div>
            </div>
            
            <button class="btn btn-success" onclick="calculateDoctorProfitByDate()">حساب الأرباح</button>
        </div>
        
        ${operations.length > 0 ? `
        <div class="profit-section">
            <h4>تفاصيل العمليات</h4>
            <div style="max-height: 300px; overflow-y: auto;">
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>العميلة</th>
                            <th>الخدمة</th>
                            <th>المبلغ</th>
                            <th>التاريخ</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${operations.map(op => `
                            <tr>
                                <td>${op.customerName}</td>
                                <td>${op.serviceName}</td>
                                <td>${op.amount.toFixed(2)} جنيه</td>
                                <td>${safeFormatDate(op.date)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        ` : `
        <div class="profit-section">
            <div class="empty-state">
                <div class="icon">📊</div>
                <h3>لا توجد بيانات</h3>
                <p>لم يتم تسجيل أي عمليات للدكتور في ${monthName} ${year}</p>
            </div>
        </div>
        `}
    `;
}

// ✅ دالة جديدة لعرض أرباح الموظفين حسب التاريخ
function displayEmployeeProfitByDate(totalRevenue, totalBookings, totalOffers, revenueDetails, month, year, fromShifts = false) {
    const profitResultsSection = document.getElementById('profitResultsSection');
    if (!profitResultsSection) return;
    
    const monthName = getMonthNameArabic(month + 1);
    
    console.log(`📈 عرض النتائج: إيراد ${totalRevenue}, ${revenueDetails.length} عملية`);
    
    let statsHTML = '';
    
    if (fromShifts) {
        statsHTML = `
            <div class="profit-stat">
                <div class="profit-stat-value">${revenueDetails.length}</div>
                <div class="profit-stat-label">عدد الشيفتات</div>
            </div>
            <div class="profit-stat">
                <div class="profit-stat-value">${totalRevenue.toFixed(2)}</div>
                <div class="profit-stat-label">إجمالي الإيرادات (جنيه)</div>
            </div>
        `;
    } else {
        statsHTML = `
            <div class="profit-stat">
                <div class="profit-stat-value">${totalBookings}</div>
                <div class="profit-stat-label">عدد الحجوزات</div>
            </div>
            <div class="profit-stat">
                <div class="profit-stat-value">${totalOffers}</div>
                <div class="profit-stat-label">عدد العروض</div>
            </div>
            <div class="profit-stat">
                <div class="profit-stat-value" id="totalRevenueValue">${totalRevenue.toFixed(2)}</div>
                <div class="profit-stat-label">إجمالي الإيرادات (جنيه)</div>
            </div>
        `;
    }
    
    profitResultsSection.innerHTML = `
        <div class="profit-section">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h4>إحصائيات ${monthName} ${year}</h4>
                <div>
                    <button onclick="changeDateRange()" class="btn btn-secondary" style="margin-right: 10px;">
                        تغيير الفترة
                    </button>
                    <button onclick="printProfitReport(${month}, ${year})" class="btn btn-primary">
                        🖨️ طباعة التقرير
                    </button>
                </div>
            </div>
            
            <div class="profit-stats">
                ${statsHTML}
            </div>
            <div style="margin-top: 15px; padding: 12px; background: #e8f4fd; border-radius: 8px; font-size: 13px; color: #1976d2;">
                <strong>ملاحظة:</strong> يتم حساب الإيرادات من عمليات الشحن فقط (تم استبعاد التحويل الداخلي والعروض)
            </div>
        </div>
        
        <div class="profit-section">
            <h4>حساب النسبة المئوية</h4>
            <div class="form-group">
                <label for="profitPercentage">النسبة المئوية (%):</label>
                <input type="number" id="profitPercentage" min="0" max="100" step="0.1" 
                       class="form-input percentage-input" placeholder="أدخل النسبة المئوية" value="10">
            </div>
            
            <div class="net-profit" id="netProfitSection">
                <div class="profit-stat-label">صافي الأرباح</div>
                <div class="net-profit-value" id="netProfitValue">${(totalRevenue * 0.1).toFixed(2)} جنيه</div>
            </div>
            
            <button class="btn btn-success" onclick="calculateEmployeeProfitByDate()" style="margin-top: 15px;">
                🔄 إعادة حساب الأرباح
            </button>
        </div>
        
        ${revenueDetails.length > 0 ? `
        <div class="profit-section">
            <h4>تفاصيل ${fromShifts ? 'الشيفتات' : 'الإيرادات'}</h4>
            <div style="max-height: 300px; overflow-y: auto; border: 1px solid #e0e0e0; border-radius: 8px;">
                <table class="report-table" style="width: 100%;">
                    <thead>
                        <tr style="background: #f8f9fa;">
                            ${fromShifts ? `
                                <th style="padding: 12px; text-align: right; border-bottom: 1px solid #dee2e6;">نوع الشيفت</th>
                                <th style="padding: 12px; text-align: right; border-bottom: 1px solid #dee2e6;">وقت البدء</th>
                                <th style="padding: 12px; text-align: right; border-bottom: 1px solid #dee2e6;">تفاصيل</th>
                            ` : `
                                <th style="padding: 12px; text-align: right; border-bottom: 1px solid #dee2e6;">النوع</th>
                                <th style="padding: 12px; text-align: right; border-bottom: 1px solid #dee2e6;">العميل</th>
                                <th style="padding: 12px; text-align: right; border-bottom: 1px solid #dee2e6;">الخدمة/العرض</th>
                            `}
                            <th style="padding: 12px; text-align: right; border-bottom: 1px solid #dee2e6;">المبلغ</th>
                            <th style="padding: 12px; text-align: right; border-bottom: 1px solid #dee2e6;">التاريخ</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${revenueDetails.map(item => `
                            <tr style="border-bottom: 1px solid #e9ecef;">
                                ${fromShifts ? `
                                    <td style="padding: 12px;">
                                        <span class="badge badge-primary">${item.shiftType}</span>
                                    </td>
                                    <td style="padding: 12px;">${safeFormatTime(item.startTime)}</td>
                                    <td style="padding: 12px;">${item.details || 'شيفت عادي'}</td>
                                ` : `
                                    <td style="padding: 12px;">
                                        <span class="badge ${item.type === 'booking' ? 'badge-primary' : 'badge-success'}">
                                            ${item.type === 'booking' ? 'حجز' : 'عرض'}
                                        </span>
                                    </td>
                                    <td style="padding: 12px;">${item.customerName}</td>
                                    <td style="padding: 12px;">${item.serviceName}</td>
                                `}
                                <td style="padding: 12px; font-weight: bold; color: #28a745;">${item.amount.toFixed(2)} جنيه</td>
                                <td style="padding: 12px;">${safeFormatDate(item.date)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        ` : `
        <div class="profit-section">
            <div class="empty-state">
                <div class="icon">📊</div>
                <h3>لا توجد بيانات</h3>
                <p>لم يتم تسجيل أي إيرادات لهذا الموظف خلال ${monthName} ${year}</p>
            </div>
        </div>
        `}
    `;
}

// ✅ تحديث دالة loadEmployeeProfitFromShiftsByDate لمنع حساب المبالغ المكررة
async function loadEmployeeProfitFromShiftsByDate(month, year, totalRevenue, revenueDetails) {
    if (!selectedEmployee) return;

    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

    console.log(`🔍 جلب شيفتات ${selectedEmployee.name} من ${startOfMonth.toLocaleDateString('ar-EG')} إلى ${endOfMonth.toLocaleDateString('ar-EG')}`);

    try {
        const shiftsQuery = query(
            collection(db, "shifts"),
            where("userId", "==", selectedEmployee.id),
            where("startTime", ">=", Timestamp.fromDate(startOfMonth)),
            where("startTime", "<=", Timestamp.fromDate(endOfMonth))
        );

        const shiftsSnapshot = await getDocs(shiftsQuery);
        console.log(`📊 عدد الشيفتات الموجودة: ${shiftsSnapshot.size}`);

        let totalShiftsRevenue = 0;

        for (const shiftDoc of shiftsSnapshot.docs) {
            const shift = shiftDoc.data();
            const shiftId = shiftDoc.id;

            console.log(`🔄 معالجة الشيفت: ${shiftId}`, {
                نوع_الشيفت: shift.shiftType,
                وقت_البدء: shift.startTime?.toDate().toLocaleString('ar-EG'),
                إيراد_مسجل: shift.totalRevenue || 0
            });

            let shiftRevenue = 0;
            const processedTransactions = new Set(); // ✅ لتجنب المعاملات المكررة

            // ✅ الطريقة 2: حساب الإيراد من إجراءات الشيفت (shiftActions) مع تجنب المبالغ المكررة
            try {
                const shiftActionsQuery = query(
                    collection(db, "shiftActions"),
                    where("shiftId", "==", shiftId),
                    where("amount", ">", 0)
                );

                const shiftActionsSnapshot = await getDocs(shiftActionsQuery);
                console.log(`📝 عدد إجراءات الشيفت: ${shiftActionsSnapshot.size}`);

                // ✅ تجميع الإجراءات حسب المبلغ والعميل للكشف عن التكرار
                const actionsByAmountAndCustomer = new Map();

                shiftActionsSnapshot.forEach(actionDoc => {
                    const action = actionDoc.data();
                    const key = `${action.amount}-${action.customerName}`;
                    
                    if (!actionsByAmountAndCustomer.has(key)) {
                        actionsByAmountAndCustomer.set(key, []);
                    }
                    actionsByAmountAndCustomer.get(key).push(action);
                });

                // ✅ معالجة الإجراءات وتجنب التكرار
                actionsByAmountAndCustomer.forEach((actions, key) => {
                    const [amount, customerName] = key.split('-');
                    
                    // ✅ إذا كان هناك أكثر من إجراء بنفس المبلغ والعميل
                    if (actions.length > 1) {
                        console.log(`🔍 اكتشاف ${actions.length} إجراء مكرر للمبلغ ${amount} والعميل ${customerName}:`, 
                            actions.map(a => `${a.paymentMethod} - ${a.actionCategory}`));
                        
                        // ✅ نفضل إجراءات الشحن (deposit) على إجراءات الحجز (booking)
                        const depositAction = actions.find(a => 
                            a.actionCategory === 'deposit' || 
                            a.paymentMethod?.includes('نقدي') ||
                            a.paymentMethod?.includes('كاش')
                        );
                        
                        if (depositAction) {
                            // ✅ نستخدم إجراء الشحن فقط
                            processSingleAction(depositAction);
                            console.log(`✅ استخدام إجراء الشحن فقط: ${depositAction.amount} - ${depositAction.paymentMethod}`);
                        } else {
                            // ✅ إذا لم يكن هناك شحن، نستخدم أول إجراء غير محجوز
                            const nonBookingAction = actions.find(a => 
                                !a.actionCategory?.includes('booking') && 
                                !a.paymentMethod?.includes('حجز')
                            );
                            if (nonBookingAction) {
                                processSingleAction(nonBookingAction);
                            }
                        }
                    } else {
                        // ✅ إجراء واحد فقط - معالجته بشكل طبيعي
                        processSingleAction(actions[0]);
                    }
                });

                // ✅ دالة معالجة الإجراء الواحد
                function processSingleAction(action) {
                    // ✅ استبعاد جميع أنواع التحويل الداخلي والعروض
                    const isExcludedPayment = 
                        action.paymentMethod?.includes('تحويل') ||
                        action.paymentMethod?.includes('رصيد') ||
                        action.paymentMethod?.includes('عرض') ||
                        action.paymentMethod === 'رصيد العروض' ||
                        action.paymentMethod === 'رصيد داخلي' ||
                        action.paymentMethod === 'تحويل داخلي' ||
                        action.paymentMethod === 'عرض' ||
                        // ✅ استبعاد عمليات الحجز (booking) عندما يكون هناك شحن بنفس المبلغ
                        (action.paymentMethod === 'حجز مسبق' && actionsByAmountAndCustomer.has(`${action.amount}-${action.customerName}`)) ||
                        // ✅ استبعاد عمليات الحجز للعملاء الجدد
                        (action.paymentMethod === 'تحويل داخلي' && action.isNewCustomer === true) ||
                        // ✅ استبعاد تأكيد الحجز للعملاء الحاليين
                        (action.paymentMethod === 'تحويل داخلي' && action.actionCategory === 'booking');

                    // ✅ فقط عمليات الشحن المسموح بها
                    const isAllowedPayment = 
                        action.paymentMethod?.includes('نقدي') ||
                        action.paymentMethod?.includes('كاش') ||
                        action.paymentMethod?.includes('فيزا') ||
                        action.paymentMethod?.includes('ماستر') ||
                        action.paymentMethod?.includes('شيك') ||
                        action.paymentMethod?.includes('بطاقة') ||
                        (action.paymentMethod && 
                         !action.paymentMethod.includes('رصيد') && 
                         !action.paymentMethod.includes('تحويل') && 
                         !action.paymentMethod.includes('عرض'));

                    // ✅ استبعاد عمليات تأكيد الحجز التي تستخدم الرصيد الداخلي
                    const isInternalBookingPayment = action.paymentMethod === 'تحويل داخلي' && 
                                                   (action.actionCategory === 'booking' || 
                                                    action.notes?.includes('تأكيد حجز'));

                    if (action.amount > 0 && !isExcludedPayment && isAllowedPayment && !isInternalBookingPayment) {
                        shiftRevenue += action.amount;
                        console.log(`➕ إضافة مبلغ من إجراء: ${action.amount} - ${action.paymentMethod} - ${action.customerName} - ${action.actionCategory}`);
                    } else {
                        console.log(`⏭️ تخطي إجراء: ${action.amount} - ${action.paymentMethod} - ${action.customerName} - ${action.actionCategory}`);
                    }
                }

            } catch (actionsError) {
                console.error('❌ خطأ في جلب إجراءات الشيفت:', actionsError);
            }

            // ✅ الطريقة 3: جلب المعاملات المالية مع استبعاد عمليات السحب الداخلية
            if (shiftRevenue === 0) {
                try {
                    const transactionsQuery = query(
                        collection(db, "transactions"),
                        where("shiftId", "==", shiftId)
                    );

                    const transactionsSnapshot = await getDocs(transactionsQuery);
                    console.log(`💳 عدد المعاملات المالية: ${transactionsSnapshot.size}`);

                    transactionsSnapshot.forEach(transactionDoc => {
                        const transaction = transactionDoc.data();
                        const transactionKey = `${transaction.amount}-${transaction.customerName}-${transaction.type}`;
                        
                        // ✅ تجنب المعاملات المكررة
                        if (processedTransactions.has(transactionKey)) {
                            console.log(`⏭️ تخطي معاملة مكررة: ${transaction.amount} - ${transaction.customerName} - ${transaction.type}`);
                            return;
                        }
                        processedTransactions.add(transactionKey);
                        
                        // ✅ استبعاد السحوبات الداخلية والعروض والتحويلات
                        const isExcludedTransaction = 
                            transaction.paymentMethod?.includes('تحويل') ||
                            transaction.paymentMethod?.includes('رصيد') ||
                            transaction.paymentMethod?.includes('عرض') ||
                            transaction.internalTransfer === true ||
                            transaction.balanceType !== 'normal' ||
                            // ✅ استبعاد عمليات السحب المصاحبة لحجز عميل جديد
                            (transaction.type === 'withdrawal' && transaction.isNewCustomer === true) ||
                            // ✅ استبعاد عمليات السحب الداخلية للحجوزات
                            (transaction.type === 'withdrawal' && transaction.paymentMethod === 'رصيد داخلي');

                        // ✅ فقط عمليات الإيداع المسموح بها (الشحن الحقيقي)
                        const isAllowedTransaction = 
                            transaction.type === 'deposit' && (
                            transaction.paymentMethod?.includes('نقدي') ||
                            transaction.paymentMethod?.includes('كاش') ||
                            transaction.paymentMethod?.includes('فيزا') ||
                            transaction.paymentMethod?.includes('ماستر') ||
                            transaction.paymentMethod?.includes('شيك') ||
                            transaction.paymentMethod?.includes('بطاقة') ||
                            (transaction.paymentMethod && 
                             !transaction.paymentMethod.includes('رصيد') && 
                             !transaction.paymentMethod.includes('تحويل') && 
                             !transaction.paymentMethod.includes('عرض'))
                            );

                        if (transaction.amount > 0 && 
                            !isExcludedTransaction && 
                            isAllowedTransaction &&
                            transaction.balanceType === 'normal') {
                            
                            shiftRevenue += transaction.amount;
                            console.log(`💵 إضافة مبلغ من معاملة: ${transaction.amount} - ${transaction.paymentMethod} - ${transaction.type} - ${transaction.balanceType}`);
                        } else {
                            console.log(`⏭️ تخطي معاملة: ${transaction.amount} - ${transaction.paymentMethod} - ${transaction.type} - ${transaction.balanceType}`);
                        }
                    });

                } catch (transactionsError) {
                    console.error('❌ خطأ في جلب المعاملات:', transactionsError);
                }
            }

            console.log(`🎯 الإيراد النهائي للشيفت (عمليات الشحن فقط): ${shiftRevenue}`);

            if (shiftRevenue > 0) {
                totalShiftsRevenue += shiftRevenue;

                revenueDetails.push({
                    type: 'shift',
                    startTime: shift.startTime?.toDate() || new Date(),
                    endTime: shift.endTime?.toDate(),
                    amount: shiftRevenue,
                    date: shift.startTime?.toDate() || new Date(),
                    shiftId: shiftId,
                    shiftType: shift.shiftType || 'عام',
                    source: 'شيفت',
                    details: `شيفت ${shift.shiftType} - عمليات الشحن فقط - ${shiftRevenue.toFixed(2)} جنيه`
                });

                console.log(`✅ تم إضافة شيفت بإيراد من الشحن فقط: ${shiftRevenue}`);
            } else {
                console.log(`⭕ شيفت بدون إيرادات من الشحن: ${shiftId}`);
            }
        }

        console.log(`💰 إجمالي الإيرادات من الشيفتات (عمليات الشحن فقط): ${totalShiftsRevenue}`);
        totalRevenue += totalShiftsRevenue;
        displayEmployeeProfitByDate(totalRevenue, 0, 0, revenueDetails, month, year, true);

    } catch (error) {
        console.error("❌ خطأ كبير في تحميل أرباح الشيفتات:", error);
        displayEmployeeProfitByDate(totalRevenue, 0, 0, revenueDetails, month, year, true);
    }
}

// ✅ دالة مساعدة لفحص هيكل بيانات الشيفتات
async function debugShiftDataByDate(employeeId, month, year) {
    console.log('=== بدء فحص بيانات الشيفتات ===');
    
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);
    
    try {
        // 1. فحص الشيفتات
        const shiftsQuery = query(
            collection(db, "shifts"),
            where("userId", "==", employeeId),
            where("startTime", ">=", Timestamp.fromDate(startOfMonth)),
            where("startTime", "<=", Timestamp.fromDate(endOfMonth))
        );
        
        const shiftsSnapshot = await getDocs(shiftsQuery);
        
        console.log(`📊 عدد الشيفتات: ${shiftsSnapshot.size}`);
        
        if (shiftsSnapshot.size === 0) {
            console.log('⚠️ لا توجد شيفتات لهذا الموظف في الشهر المحدد');
            return;
        }
        
        shiftsSnapshot.forEach(doc => {
            const shift = doc.data();
            console.log('🔍 بيانات الشيفت:', {
                id: doc.id,
                نوع_الشيفت: shift.shiftType,
                إيراد_إجمالي: shift.totalRevenue,
                إيراد_نقدي: shift.cashRevenue,
                عملاء_جدد: shift.customersAdded,
                حجوزات: shift.bookingsMade,
                وقت_البدء: shift.startTime?.toDate().toLocaleString('ar-EG'),
                وقت_الانتهاء: shift.endTime?.toDate()?.toLocaleString('ar-EG'),
                الحالة: shift.status
            });
        });
        
    } catch (error) {
        console.error('❌ خطأ في فحص البيانات:', error);
    }
    
    console.log('=== انتهاء فحص البيانات ===');
}

// ✅ دوال الحساب الجديدة
window.calculateDoctorProfitByDate = function() {
    const percentageInput = document.getElementById('profitPercentage');
    if (!percentageInput) return;
    
    const percentage = parseFloat(percentageInput.value);
    
    if (!percentage || percentage < 0 || percentage > 100) {
        alert('⚠️ يرجى إدخال نسبة مئوية صحيحة بين 0 و 100!');
        return;
    }
    
    // البحث عن إجمالي المبلغ في الصفحة
    const totalAmountElements = document.querySelectorAll('.profit-stat-value');
    let totalAmount = 0;
    
    if (totalAmountElements.length > 1) {
        totalAmount = parseFloat(totalAmountElements[1].textContent) || 0;
    }
    
    const netProfit = (totalAmount * percentage) / 100;
    
    const netProfitValue = document.getElementById('netProfitValue');
    const netProfitSection = document.getElementById('netProfitSection');
    
    if (netProfitValue && netProfitSection) {
        netProfitValue.textContent = netProfit.toFixed(2) + ' جنيه';
        netProfitSection.classList.remove('hidden');
    }
};

window.calculateEmployeeProfitByDate = function() {
    const percentageInput = document.getElementById('profitPercentage');
    if (!percentageInput) return;
    
    const percentage = parseFloat(percentageInput.value);
    
    if (!percentage || percentage < 0 || percentage > 100) {
        alert('⚠️ يرجى إدخال نسبة مئوية صحيحة بين 0 و 100!');
        return;
    }
    
    // البحث عن إجمالي الإيرادات في الصفحة
    const totalRevenueElement = document.getElementById('totalRevenueValue');
    let totalRevenue = 0;
    
    if (totalRevenueElement) {
        totalRevenue = parseFloat(totalRevenueElement.textContent) || 0;
    } else {
        // إذا لم نجد العنصر، نبحث في العناصر الأخرى
        const totalRevenueElements = document.querySelectorAll('.profit-stat-value');
        if (totalRevenueElements.length > 0) {
            const lastElement = totalRevenueElements[totalRevenueElements.length - 1];
            totalRevenue = parseFloat(lastElement.textContent) || 0;
        }
    }
    
    const netProfit = (totalRevenue * percentage) / 100;
    
    const netProfitValue = document.getElementById('netProfitValue');
    const netProfitSection = document.getElementById('netProfitSection');
    
    if (netProfitValue && netProfitSection) {
        netProfitValue.textContent = netProfit.toFixed(2) + ' جنيه';
        netProfitSection.classList.remove('hidden');
    }
};

// ========== الدوال الأصلية (بدون تعديل) ==========

// حساب أرباح الدكتور
async function loadDoctorProfit() {
    if (!selectedEmployee) return;
    
    // حساب بداية ونهاية الشهر الحالي
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
    
    // جلب الحجوزات المكتملة للدكتور خلال الشهر
    const bookingsQuery = query(
        collection(db, "bookings"),
        where("doctorId", "==", selectedEmployee.id),
        where("status", "==", "completed"),
        where("completedAt", ">=", startOfMonth),
        where("completedAt", "<=", endOfMonth)
    );
    
    const querySnapshot = await getDocs(bookingsQuery);
    
    let totalOperations = 0;
    let totalAmount = 0;
    const operations = [];
    
    querySnapshot.forEach(doc => {
        const booking = doc.data();
        totalOperations++;
        totalAmount += booking.servicePrice || 0;
        
        operations.push({
            customerName: booking.customerName,
            serviceName: booking.serviceName,
            amount: booking.servicePrice || 0,
            date: booking.completedAt?.toDate() || new Date()
        });
    });
    
    displayDoctorProfit(totalOperations, totalAmount, operations);
}

// عرض أرباح الدكتور
function displayDoctorProfit(totalOperations, totalAmount, operations) {
    const profitCalculationContent = document.getElementById('profitCalculationContent');
    if (!profitCalculationContent) return;
    
    profitCalculationContent.innerHTML = `
        <div class="profit-section">
            <h4>إحصائيات الشهر الحالي</h4>
            <div class="profit-stats">
                <div class="profit-stat">
                    <div class="profit-stat-value">${totalOperations}</div>
                    <div class="profit-stat-label">عدد العمليات</div>
                </div>
                <div class="profit-stat">
                    <div class="profit-stat-value">${totalAmount.toFixed(2)}</div>
                    <div class="profit-stat-label">إجمالي المبلغ (جنيه)</div>
                </div>
            </div>
        </div>
        
        <div class="profit-section">
            <h4>حساب النسبة المئوية</h4>
            <div class="form-group">
                <label for="profitPercentage">النسبة المئوية (%):</label>
                <input type="number" id="profitPercentage" min="0" max="100" step="0.1" 
                       class="form-input percentage-input" placeholder="أدخل النسبة المئوية">
            </div>
            
            <div class="net-profit hidden" id="netProfitSection">
                <div class="profit-stat-label">صافي الأرباح</div>
                <div class="net-profit-value" id="netProfitValue">0.00 جنيه</div>
            </div>
            
            <button class="btn btn-success" onclick="calculateDoctorProfit()">حساب الأرباح</button>
        </div>
        
        ${operations.length > 0 ? `
        <div class="profit-section">
            <h4>تفاصيل العمليات</h4>
            <div style="max-height: 300px; overflow-y: auto;">
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>العميلة</th>
                            <th>الخدمة</th>
                            <th>المبلغ</th>
                            <th>التاريخ</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${operations.map(op => `
                            <tr>
                                <td>${op.customerName}</td>
                                <td>${op.serviceName}</td>
                                <td>${op.amount.toFixed(2)} جنيه</td>
                                <td>${safeFormatDate(op.date)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        ` : ''}
    `;
}

// ✅ حساب أرباح الموظفين (استقبال، محاسب) - النسخة المحسنة النهائية
async function loadEmployeeProfit() {
    if (!selectedEmployee) return;
    
    // حساب بداية ونهاية الشهر الحالي
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
    
    let totalRevenue = 0;
    let totalBookings = 0;
    let totalOffers = 0;
    const revenueDetails = [];
    
    console.log(`🎯 حساب أرباح ${selectedEmployee.name} للشهر ${currentMonth + 1}-${currentYear}`);
    
    try {
        // ✅ إضافة تصحيح البيانات للتحقق
        await debugShiftData(selectedEmployee.id);
        
        // إذا كان موظف استقبال، نحسب الإيرادات من الحجوزات والعروض أولاً
        if (selectedEmployee.role === 'reception') {
            console.log('🔍 البحث في الحجوزات والعروض...');
            
            // جلب جميع الحجوزات التي أنشأها الموظف خلال الشهر
            const bookingsQuery = query(
                collection(db, "bookings"),
                where("createdBy", "==", selectedEmployee.id),
                where("createdAt", ">=", Timestamp.fromDate(startOfMonth)),
                where("createdAt", "<=", Timestamp.fromDate(endOfMonth))
            );
            
            const bookingsSnapshot = await getDocs(bookingsQuery);
            
            console.log(`📅 عدد الحجوزات: ${bookingsSnapshot.size}`);
            
            bookingsSnapshot.forEach(bookingDoc => {
                const booking = bookingDoc.data();
                
                // فقط الحجوزات المدفوعة أو المؤكدة
                if (booking.status === 'confirmed' || booking.status === 'completed' || booking.paymentStatus === 'paid') {
                    const bookingAmount = booking.totalAmount || booking.servicePrice || 0;
                    if (bookingAmount > 0) {
                        totalRevenue += bookingAmount;
                        totalBookings++;
                        
                        revenueDetails.push({
                            type: 'booking',
                            customerName: booking.customerName || 'عميل',
                            serviceName: booking.serviceName || 'خدمة',
                            amount: bookingAmount,
                            date: booking.createdAt?.toDate() || new Date(),
                            status: booking.status,
                            source: 'حجز'
                        });
                        
                        console.log(`✅ إضافة حجز: ${bookingAmount} - ${booking.customerName}`);
                    }
                }
            });
            
            // جلب جميع العروض التي أنشأها الموظف خلال الشهر
            const offersQuery = query(
                collection(db, "offers"),
                where("createdBy", "==", selectedEmployee.id),
                where("createdAt", ">=", Timestamp.fromDate(startOfMonth)),
                where("createdAt", "<=", Timestamp.fromDate(endOfMonth))
            );
            
            const offersSnapshot = await getDocs(offersQuery);
            
            console.log(`🎁 عدد العروض: ${offersSnapshot.size}`);
            
            offersSnapshot.forEach(offerDoc => {
                const offer = offerDoc.data();
                const offerAmount = offer.totalAmount || offer.price || 0;
                
                if (offerAmount > 0) {
                    totalRevenue += offerAmount;
                    totalOffers++;
                    
                    revenueDetails.push({
                        type: 'offer',
                        customerName: offer.customerName || 'عميل',
                        serviceName: offer.offerName || 'عرض',
                        amount: offerAmount,
                        date: offer.createdAt?.toDate() || new Date(),
                        status: offer.status || 'active',
                        source: 'عرض'
                    });
                    
                    console.log(`✅ إضافة عرض: ${offerAmount} - ${offer.offerName}`);
                }
            });
            
            console.log(`💰 الإيراد من الحجوزات والعروض: ${totalRevenue}`);
            
            // إذا لم نجد بيانات في الحجوزات والعروض، نستخدم النظام المحسن للشيفتات
            if (totalBookings === 0 && totalOffers === 0) {
                console.log('🔄 الانتقال لحساب إيرادات الشيفتات...');
                await loadEmployeeProfitFromShifts(totalRevenue, revenueDetails);
            } else {
                console.log('📊 عرض إيرادات الحجوزات والعروض...');
                displayEmployeeProfit(totalRevenue, totalBookings, totalOffers, revenueDetails);
            }
            
        } else {
            // للمحاسبين والموظفين الآخرين، نستخدم النظام المحسن للشيفتات
            console.log('🔄 حساب إيرادات الشيفتات للموظف...');
            await loadEmployeeProfitFromShifts(totalRevenue, revenueDetails);
        }
        
    } catch (error) {
        console.error("❌ خطأ في تحميل بيانات الأرباح:", error);
        const profitCalculationContent = document.getElementById('profitCalculationContent');
        if (profitCalculationContent) {
            profitCalculationContent.innerHTML = `
                <div class="error">
                    <h4>❌ حدث خطأ في تحميل البيانات</h4>
                    <p>تفاصيل الخطأ: ${error.message}</p>
                    <button onclick="retryLoadEmployeeProfit()" class="btn btn-primary">إعادة المحاولة</button>
                </div>
            `;
        }
    }
}

// ✅ دالة إعادة المحاولة
window.retryLoadEmployeeProfit = function() {
    if (selectedEmployee) {
        openProfitCalculation();
    }
};

// ✅ حساب الإيرادات من الشيفتات - النسخة المحسنة والمصححة مع استبعاد التحويل الداخلي والعروض
async function loadEmployeeProfitFromShifts(totalRevenue, revenueDetails) {
    if (!selectedEmployee) return;

    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);

    console.log(`🔍 جلب شيفتات ${selectedEmployee.name} من ${startOfMonth.toLocaleDateString('ar-EG')} إلى ${endOfMonth.toLocaleDateString('ar-EG')}`);

    try {
        // جلب الشيفتات التي فتحها الموظف خلال الشهر
        const shiftsQuery = query(
            collection(db, "shifts"),
            where("userId", "==", selectedEmployee.id),
            where("startTime", ">=", Timestamp.fromDate(startOfMonth)),
            where("startTime", "<=", Timestamp.fromDate(endOfMonth))
        );

        const shiftsSnapshot = await getDocs(shiftsQuery);

        console.log(`📊 عدد الشيفتات الموجودة: ${shiftsSnapshot.size}`);

        let totalShiftsRevenue = 0;

        for (const shiftDoc of shiftsSnapshot.docs) {
            const shift = shiftDoc.data();
            const shiftId = shiftDoc.id;

            console.log(`🔄 معالجة الشيفت: ${shiftId}`, {
                نوع_الشيفت: shift.shiftType,
                وقت_البدء: shift.startTime?.toDate().toLocaleString('ar-EG'),
                إيراد_مسجل: shift.totalRevenue || 0
            });

            let shiftRevenue = 0;

            // ✅ الطريقة 1: استخدام totalRevenue المباشر من الشيفت إذا كان موجوداً
            if (shift.totalRevenue && shift.totalRevenue > 0) {
                // ❌ لا نستخدم الإيراد المباشر لأنه قد يحتوي على تحويلات داخلية
                console.log(`⚠️ تخطي الإيراد المباشر لأنه قد يحتوي على تحويلات داخلية: ${shift.totalRevenue}`);
            } 
            
            // ✅ الطريقة 2: حساب الإيراد من إجراءات الشيفت (shiftActions) مع استبعاد التحويل الداخلي والعروض
            else {
                try {
                    const shiftActionsQuery = query(
                        collection(db, "shiftActions"),
                        where("shiftId", "==", shiftId),
                        where("amount", ">", 0) // فقط الإجراءات التي تحتوي على مبالغ موجبة
                    );

                    const shiftActionsSnapshot = await getDocs(shiftActionsQuery);
                    console.log(`📝 عدد إجراءات الشيفت: ${shiftActionsSnapshot.size}`);

                    shiftActionsSnapshot.forEach(actionDoc => {
                        const action = actionDoc.data();
                        
                        // ✅ استبعاد جميع أنواع التحويل الداخلي والعروض - النسخة المحسنة
                        const isExcludedPayment = 
                            action.paymentMethod?.includes('تحويل') ||
                            action.paymentMethod?.includes('رصيد') ||
                            action.paymentMethod?.includes('عرض') ||
                            action.paymentMethod === 'رصيد العروض' ||
                            action.paymentMethod === 'رصيد داخلي' ||
                            action.paymentMethod === 'تحويل داخلي' ||
                            action.paymentMethod === 'عرض';
                        
                        // ✅ فقط عمليات الشحن المسموح بها
                        const isAllowedPayment = 
                            action.paymentMethod?.includes('نقدي') ||
                            action.paymentMethod?.includes('كاش') ||
                            action.paymentMethod?.includes('فيزا') ||
                            action.paymentMethod?.includes('ماستر') ||
                            action.paymentMethod?.includes('شيك') ||
                            action.paymentMethod?.includes('بطاقة') ||
                            (action.paymentMethod && 
                             !action.paymentMethod.includes('رصيد') && 
                             !action.paymentMethod.includes('تحويل') && 
                             !action.paymentMethod.includes('عرض'));

                        if (action.amount > 0 && !isExcludedPayment && isAllowedPayment) {
                            shiftRevenue += action.amount;
                            console.log(`➕ إضافة مبلغ من إجراء: ${action.amount} - ${action.paymentMethod} - ${action.customerName}`);
                        } else {
                            console.log(`⏭️ تخطي إجراء (تحويل داخلي/عرض): ${action.amount} - ${action.paymentMethod} - ${action.customerName}`);
                        }
                    });

                } catch (actionsError) {
                    console.error('❌ خطأ في جلب إجراءات الشيفت:', actionsError);
                }
            }

            // ✅ الطريقة 3: إذا لم نجد إيرادات، نحاول جلبها من transactions المرتبطة بالشيفت مع استبعاد التحويل الداخلي والعروض
            if (shiftRevenue === 0) {
                try {
                    const transactionsQuery = query(
                        collection(db, "transactions"),
                        where("shiftId", "==", shiftId),
                        where("type", "==", "deposit") // فقط عمليات الإيداع
                    );

                    const transactionsSnapshot = await getDocs(transactionsQuery);
                    console.log(`💳 عدد المعاملات المالية: ${transactionsSnapshot.size}`);

                    transactionsSnapshot.forEach(transactionDoc => {
                        const transaction = transactionDoc.data();
                        
                        // ✅ استبعاد السحوبات الداخلية والعروض والتحويلات - النسخة المحسنة
                        const isExcludedTransaction = 
                            transaction.paymentMethod?.includes('تحويل') ||
                            transaction.paymentMethod?.includes('رصيد') ||
                            transaction.paymentMethod?.includes('عرض') ||
                            transaction.internalTransfer === true ||
                            transaction.balanceType !== 'normal'; // فقط الرصيد العادي

                        // ✅ فقط عمليات الشحن المسموح بها
                        const isAllowedTransaction = 
                            transaction.paymentMethod?.includes('نقدي') ||
                            transaction.paymentMethod?.includes('كاش') ||
                            transaction.paymentMethod?.includes('فيزا') ||
                            transaction.paymentMethod?.includes('ماستر') ||
                            transaction.paymentMethod?.includes('شيك') ||
                            transaction.paymentMethod?.includes('بطاقة') ||
                            (transaction.paymentMethod && 
                             !transaction.paymentMethod.includes('رصيد') && 
                             !transaction.paymentMethod.includes('تحويل') && 
                             !transaction.paymentMethod.includes('عرض'));

                        if (transaction.amount > 0 && 
                            !isExcludedTransaction && 
                            isAllowedTransaction &&
                            transaction.balanceType === 'normal') { // ✅ فقط الرصيد العادي
                            
                            shiftRevenue += transaction.amount;
                            console.log(`💵 إضافة مبلغ من معاملة: ${transaction.amount} - ${transaction.paymentMethod} - ${transaction.balanceType}`);
                        } else {
                            console.log(`⏭️ تخطي معاملة (تحويل داخلي/عرض): ${transaction.amount} - ${transaction.paymentMethod} - ${transaction.balanceType}`);
                        }
                    });

                } catch (transactionsError) {
                    console.error('❌ خطأ في جلب المعاملات:', transactionsError);
                }
            }

            console.log(`🎯 الإيراد النهائي للشيفت (عمليات الشحن فقط): ${shiftRevenue}`);

            if (shiftRevenue > 0) {
                totalShiftsRevenue += shiftRevenue;

                revenueDetails.push({
                    type: 'shift',
                    startTime: shift.startTime?.toDate() || new Date(),
                    endTime: shift.endTime?.toDate(),
                    amount: shiftRevenue,
                    date: shift.startTime?.toDate() || new Date(),
                    shiftId: shiftId,
                    shiftType: shift.shiftType || 'عام',
                    source: 'شيفت',
                    details: `شيفت ${shift.shiftType} - عمليات الشحن فقط - ${shiftRevenue.toFixed(2)} جنيه`
                });

                console.log(`✅ تم إضافة شيفت بإيراد من الشحن فقط: ${shiftRevenue}`);
            } else {
                console.log(`⭕ شيفت بدون إيرادات من الشحن: ${shiftId}`);
            }
        }

        console.log(`💰 إجمالي الإيرادات من الشيفتات (عمليات الشحن فقط): ${totalShiftsRevenue}`);

        // ✅ تحديث الإجمالي
        totalRevenue += totalShiftsRevenue;

        displayEmployeeProfit(totalRevenue, 0, 0, revenueDetails, true);

    } catch (error) {
        console.error("❌ خطأ كبير في تحميل أرباح الشيفتات:", error);
        // عرض رسالة خطأ مع البيانات المتاحة
        displayEmployeeProfit(totalRevenue, 0, 0, revenueDetails, true);
    }
}

// ✅ دالة مساعدة لفحص هيكل بيانات الشيفتات
async function debugShiftData(employeeId) {
    console.log('=== بدء فحص بيانات الشيفتات ===');
    
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
    
    try {
        // 1. فحص الشيفتات
        const shiftsQuery = query(
            collection(db, "shifts"),
            where("userId", "==", employeeId),
            where("startTime", ">=", Timestamp.fromDate(startOfMonth)),
            where("startTime", "<=", Timestamp.fromDate(endOfMonth))
        );
        
        const shiftsSnapshot = await getDocs(shiftsQuery);
        
        console.log(`📊 عدد الشيفتات: ${shiftsSnapshot.size}`);
        
        if (shiftsSnapshot.size === 0) {
            console.log('⚠️ لا توجد شيفتات لهذا الموظف في الشهر الحالي');
            return;
        }
        
        shiftsSnapshot.forEach(doc => {
            const shift = doc.data();
            console.log('🔍 بيانات الشيفت:', {
                id: doc.id,
                نوع_الشيفت: shift.shiftType,
                إيراد_إجمالي: shift.totalRevenue,
                إيراد_نقدي: shift.cashRevenue,
                عملاء_جدد: shift.customersAdded,
                حجوزات: shift.bookingsMade,
                وقت_البدء: shift.startTime?.toDate().toLocaleString('ar-EG'),
                وقت_الانتهاء: shift.endTime?.toDate()?.toLocaleString('ar-EG'),
                الحالة: shift.status
            });
        });
        
        // 2. فحص إجراءات الشيفت
        for (const shiftDoc of shiftsSnapshot.docs) {
            const shiftId = shiftDoc.id;
            console.log(`\n📝 فحص إجراءات الشيفت: ${shiftId}`);
            
            const shiftActionsQuery = query(
                collection(db, "shiftActions"),
                where("shiftId", "==", shiftId)
            );
            
            const shiftActionsSnapshot = await getDocs(shiftActionsQuery);
            
            console.log(`   عدد الإجراءات: ${shiftActionsSnapshot.size}`);
            
            if (shiftActionsSnapshot.size === 0) {
                console.log('   ⚠️ لا توجد إجراءات مسجلة في هذا الشيفت');
                continue;
            }
            
            shiftActionsSnapshot.forEach(actionDoc => {
                const action = actionDoc.data();
                console.log('   إجراء:', {
                    نوع: action.actionType,
                    مبلغ: action.amount,
                    عميل: action.customerName,
                    طريقة_دفع: action.paymentMethod,
                    وصف: action.description,
                    وقت: action.timestamp?.toDate().toLocaleString('ar-EG')
                });
            });
        }
        
        // 3. فحص المعاملات المالية المرتبطة
        console.log(`\n💳 فحص المعاملات المالية:`);
        for (const shiftDoc of shiftsSnapshot.docs) {
            const shiftId = shiftDoc.id;
            
            const transactionsQuery = query(
                collection(db, "transactions"),
                where("shiftId", "==", shiftId)
            );
            
            const transactionsSnapshot = await getDocs(transactionsQuery);
            
            console.log(`   معاملات الشيفت ${shiftId}: ${transactionsSnapshot.size}`);
            
            transactionsSnapshot.forEach(transactionDoc => {
                const transaction = transactionDoc.data();
                console.log('   معاملة:', {
                    نوع: transaction.type,
                    مبلغ: transaction.amount,
                    طريقة_دفع: transaction.paymentMethod,
                    ملاحظات: transaction.notes,
                    وقت: transaction.createdAt?.toDate().toLocaleString('ar-EG')
                });
            });
        }
        
    } catch (error) {
        console.error('❌ خطأ في فحص البيانات:', error);
    }
    
    console.log('=== انتهاء فحص البيانات ===');
}

// ✅ عرض أرباح الموظفين - النسخة المحسنة النهائية
function displayEmployeeProfit(totalRevenue, totalBookings, totalOffers, revenueDetails, fromShifts = false) {
    const profitCalculationContent = document.getElementById('profitCalculationContent');
    if (!profitCalculationContent) return;
    
    console.log(`📈 عرض النتائج: إيراد ${totalRevenue}, ${revenueDetails.length} عملية`);
    
    let statsHTML = '';
    
    if (fromShifts) {
        statsHTML = `
            <div class="profit-stat">
                <div class="profit-stat-value">${revenueDetails.length}</div>
                <div class="profit-stat-label">عدد الشيفتات</div>
            </div>
            <div class="profit-stat">
                <div class="profit-stat-value">${totalRevenue.toFixed(2)}</div>
                <div class="profit-stat-label">إجمالي الإيرادات (جنيه)</div>
            </div>
        `;
    } else {
        statsHTML = `
            <div class="profit-stat">
                <div class="profit-stat-value">${totalBookings}</div>
                <div class="profit-stat-label">عدد الحجوزات</div>
            </div>
            <div class="profit-stat">
                <div class="profit-stat-value">${totalOffers}</div>
                <div class="profit-stat-label">عدد العروض</div>
            </div>
            <div class="profit-stat">
                <div class="profit-stat-value" id="totalRevenueValue">${totalRevenue.toFixed(2)}</div>
                <div class="profit-stat-label">إجمالي الإيرادات (جنيه)</div>
            </div>
        `;
    }
    
    profitCalculationContent.innerHTML = `
        <div class="profit-section">
            <h4>إحصائيات الشهر الحالي</h4>
            <div class="profit-stats">
                ${statsHTML}
            </div>
            <div style="margin-top: 15px; padding: 12px; background: #e8f4fd; border-radius: 8px; font-size: 13px; color: #1976d2;">
                <strong>ملاحظة:</strong> يتم حساب الإيرادات من عمليات الشحن فقط (تم استبعاد التحويل الداخلي والعروض)
            </div>
        </div>
        
        <div class="profit-section">
            <h4>حساب النسبة المئوية</h4>
            <div class="form-group">
                <label for="profitPercentage">النسبة المئوية (%):</label>
                <input type="number" id="profitPercentage" min="0" max="100" step="0.1" 
                       class="form-input percentage-input" placeholder="أدخل النسبة المئوية" value="10">
            </div>
            
            <div class="net-profit" id="netProfitSection">
                <div class="profit-stat-label">صافي الأرباح</div>
                <div class="net-profit-value" id="netProfitValue">${(totalRevenue * 0.1).toFixed(2)} جنيه</div>
            </div>
            
            <button class="btn btn-success" onclick="calculateEmployeeProfit()" style="margin-top: 15px;">
                🔄 إعادة حساب الأرباح
            </button>
        </div>
        
        ${revenueDetails.length > 0 ? `
        <div class="profit-section">
            <h4>تفاصيل ${fromShifts ? 'الشيفتات' : 'الإيرادات'}</h4>
            <div style="max-height: 300px; overflow-y: auto; border: 1px solid #e0e0e0; border-radius: 8px;">
                <table class="report-table" style="width: 100%;">
                    <thead>
                        <tr style="background: #f8f9fa;">
                            ${fromShifts ? `
                                <th style="padding: 12px; text-align: right; border-bottom: 1px solid #dee2e6;">نوع الشيفت</th>
                                <th style="padding: 12px; text-align: right; border-bottom: 1px solid #dee2e6;">وقت البدء</th>
                                <th style="padding: 12px; text-align: right; border-bottom: 1px solid #dee2e6;">تفاصيل</th>
                            ` : `
                                <th style="padding: 12px; text-align: right; border-bottom: 1px solid #dee2e6;">النوع</th>
                                <th style="padding: 12px; text-align: right; border-bottom: 1px solid #dee2e6;">العميل</th>
                                <th style="padding: 12px; text-align: right; border-bottom: 1px solid #dee2e6;">الخدمة/العرض</th>
                            `}
                            <th style="padding: 12px; text-align: right; border-bottom: 1px solid #dee2e6;">المبلغ</th>
                            <th style="padding: 12px; text-align: right; border-bottom: 1px solid #dee2e6;">التاريخ</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${revenueDetails.map(item => `
                            <tr style="border-bottom: 1px solid #e9ecef;">
                                ${fromShifts ? `
                                    <td style="padding: 12px;">
                                        <span class="badge badge-primary">${item.shiftType}</span>
                                    </td>
                                    <td style="padding: 12px;">${safeFormatTime(item.startTime)}</td>
                                    <td style="padding: 12px;">${item.details || 'شيفت عادي'}</td>
                                ` : `
                                    <td style="padding: 12px;">
                                        <span class="badge ${item.type === 'booking' ? 'badge-primary' : 'badge-success'}">
                                            ${item.type === 'booking' ? 'حجز' : 'عرض'}
                                        </span>
                                    </td>
                                    <td style="padding: 12px;">${item.customerName}</td>
                                    <td style="padding: 12px;">${item.serviceName}</td>
                                `}
                                <td style="padding: 12px; font-weight: bold; color: #28a745;">${item.amount.toFixed(2)} جنيه</td>
                                <td style="padding: 12px;">${safeFormatDate(item.date)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        ` : `
        <div class="profit-section">
            <div class="empty-state">
                <div class="icon">📊</div>
                <h3>لا توجد بيانات</h3>
                <p>لم يتم تسجيل أي إيرادات لهذا الموظف خلال الشهر الحالي</p>
                <button onclick="debugShiftData('${selectedEmployee.id}')" class="btn btn-secondary" style="margin-top: 10px;">
                    فحص البيانات
                </button>
            </div>
        </div>
        `}
    `;
}

// دوال مساعدة للحالة والنوع
function getStatusClass(status) {
    const classes = {
        'confirmed': 'status-confirmed',
        'completed': 'status-completed',
        'paid': 'status-paid',
        'active': 'status-active'
    };
    return classes[status] || 'status-pending';
}

function getStatusText(status) {
    const texts = {
        'confirmed': 'مؤكد',
        'completed': 'مكتمل',
        'paid': 'مدفوع',
        'active': 'نشط'
    };
    return texts[status] || status;
}

// حساب أرباح الدكتور
window.calculateDoctorProfit = function() {
    const percentageInput = document.getElementById('profitPercentage');
    if (!percentageInput) return;
    
    const percentage = parseFloat(percentageInput.value);
    
    if (!percentage || percentage < 0 || percentage > 100) {
        alert('⚠️ يرجى إدخال نسبة مئوية صحيحة بين 0 و 100!');
        return;
    }
    
    // في التطبيق الحقيقي، سنحسب من البيانات الفعلية
    // هنا سنفترض أن لدينا totalAmount من البيانات المحملة سابقاً
    const totalAmountElement = document.querySelector('.profit-stat-value:nth-child(2)');
    const totalAmount = parseFloat(totalAmountElement?.textContent) || 0;
    
    const netProfit = (totalAmount * percentage) / 100;
    
    const netProfitValue = document.getElementById('netProfitValue');
    const netProfitSection = document.getElementById('netProfitSection');
    
    if (netProfitValue && netProfitSection) {
        netProfitValue.textContent = netProfit.toFixed(2) + ' جنيه';
        netProfitSection.classList.remove('hidden');
    }
};

// حساب أرباح الموظف - النسخة المحسنة
window.calculateEmployeeProfit = function() {
    const percentageInput = document.getElementById('profitPercentage');
    if (!percentageInput) return;
    
    const percentage = parseFloat(percentageInput.value);
    
    if (!percentage || percentage < 0 || percentage > 100) {
        alert('⚠️ يرجى إدخال نسبة مئوية صحيحة بين 0 و 100!');
        return;
    }
    
    // البحث عن إجمالي الإيرادات في الصفحة
    const totalRevenueElement = document.getElementById('totalRevenueValue');
    let totalRevenue = 0;
    
    if (totalRevenueElement) {
        totalRevenue = parseFloat(totalRevenueElement.textContent) || 0;
    } else {
        // إذا لم نجد العنصر، نبحث في العناصر الأخرى
        const totalRevenueElements = document.querySelectorAll('.profit-stat-value');
        if (totalRevenueElements.length > 0) {
            const lastElement = totalRevenueElements[totalRevenueElements.length - 1];
            totalRevenue = parseFloat(lastElement.textContent) || 0;
        }
    }
    
    const netProfit = (totalRevenue * percentage) / 100;
    
    const netProfitValue = document.getElementById('netProfitValue');
    const netProfitSection = document.getElementById('netProfitSection');
    
    if (netProfitValue && netProfitSection) {
        netProfitValue.textContent = netProfit.toFixed(2) + ' جنيه';
        netProfitSection.classList.remove('hidden');
    }
};

// البحث في الموظفين
function searchEmployees() {
    const searchInput = document.getElementById('searchEmployees');
    if (!searchInput) return;
    
    const searchTerm = searchInput.value.toLowerCase();
    
    if (!searchTerm) {
        displayEmployees(allEmployees);
        return;
    }
    
    const filteredEmployees = allEmployees.filter(employee => 
        employee.name.toLowerCase().includes(searchTerm) ||
        (employee.email && employee.email.toLowerCase().includes(searchTerm)) ||
        (employee.phone && employee.phone.includes(searchTerm))
    );
    
    displayEmployees(filteredEmployees);
}

// فلترة الموظفين حسب الصلاحية
function filterEmployees() {
    const roleFilter = document.getElementById('roleFilter');
    if (!roleFilter) return;
    
    const roleFilterValue = roleFilter.value;
    
    if (roleFilterValue === 'all') {
        displayEmployees(allEmployees);
        return;
    }
    
    const filteredEmployees = allEmployees.filter(employee => 
        employee.role === roleFilterValue
    );
    
    displayEmployees(filteredEmployees);
}

// تحديث الإحصائيات
function updateStats() {
    const totalEmployees = allEmployees.length;
    const totalDoctors = allEmployees.filter(e => e.role === 'doctor' || e.role === 'skin_doctor').length;
    const totalSalaries = allEmployees.reduce((sum, employee) => sum + (employee.salary || 0), 0);
    
    const totalEmployeesEl = document.getElementById('totalEmployees');
    const totalDoctorsEl = document.getElementById('totalDoctors');
    const totalSalariesEl = document.getElementById('totalSalaries');
    
    if (totalEmployeesEl) totalEmployeesEl.textContent = totalEmployees;
    if (totalDoctorsEl) totalDoctorsEl.textContent = totalDoctors;
    if (totalSalariesEl) totalSalariesEl.textContent = totalSalaries.toFixed(2);
}

// إغلاق المودالات
window.closeEmployeeModal = function() {
    const modal = document.getElementById('employeeModal');
    if (modal) modal.classList.add('hidden');
};

window.closeProfitModal = function() {
    const modal = document.getElementById('profitModal');
    if (modal) modal.classList.add('hidden');
};

window.closeSalaryModal = function() {
    const modal = document.getElementById('salaryModal');
    if (modal) modal.classList.add('hidden');
};

// تسجيل الخروج
window.logout = function() {
    signOut(auth).then(() => {
        window.location.href = '../auth/login.html';
    }).catch(error => {
        console.error("❌ خطأ في تسجيل الخروج:", error);
    });
};

// ========== الدوال المساعدة المحسنة ==========

// الحصول على نص الصلاحية
function getRoleText(role) {
    const roles = {
        'admin': 'مدير النظام',
        'doctor': 'دكتور',
        'skin_doctor': 'دكتور جلدية',
        'reception': 'موظف استقبال',
        'accountant': 'محاسب'
    };
    return roles[role] || role;
}

// الحصول على كلاس CSS للصلاحية
function getRoleClass(role) {
    const classes = {
        'admin': 'role-admin',
        'doctor': 'role-doctor',
        'skin_doctor': 'role-skin_doctor',
        'reception': 'role-reception',
        'accountant': 'role-accountant'
    };
    return classes[role] || '';
}

// ✅ دالة آمنة لتنسيق التاريخ
function safeFormatDate(date) {
    if (!date) return 'غير محدد';
    
    try {
        let dateObj;
        
        // التعامل مع أنواع البيانات المختلفة
        if (date.toDate && typeof date.toDate === 'function') {
            // Firebase Timestamp
            dateObj = date.toDate();
        } else if (date instanceof Date) {
            // كائن Date عادي
            dateObj = date;
        } else if (typeof date === 'string' || typeof date === 'number') {
            // نص أو رقم
            dateObj = new Date(date);
        } else {
            return 'غير محدد';
        }
        
        // التحقق من صحة التاريخ
        if (isNaN(dateObj.getTime())) {
            return 'غير محدد';
        }
        
        return dateObj.toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch (error) {
        console.error('خطأ في تنسيق التاريخ:', error);
        return 'غير محدد';
    }
}

// ✅ دالة آمنة لتنسيق الوقت
function safeFormatTime(date) {
    if (!date) return 'غير محدد';
    
    try {
        let dateObj;
        
        if (date.toDate && typeof date.toDate === 'function') {
            dateObj = date.toDate();
        } else if (date instanceof Date) {
            dateObj = date;
        } else if (typeof date === 'string' || typeof date === 'number') {
            dateObj = new Date(date);
        } else {
            return 'غير محدد';
        }
        
        if (isNaN(dateObj.getTime())) {
            return 'غير محدد';
        }
        
        return dateObj.toLocaleTimeString('ar-EG', {
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        console.error('خطأ في تنسيق الوقت:', error);
        return 'غير محدد';
    }
}

// دالة مساعدة لتأخير التنفيذ
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

// ✅ دالة مساعدة لتوليد خيارات السنوات
function generateYearOptionsForProfit() {
    const currentYear = new Date().getFullYear();
    let options = '';
    for (let year = currentYear; year >= currentYear - 5; year--) {
        options += `<option value="${year}">${year}</option>`;
    }
    return options;
}

// ✅ دالة الحصول على اسم الشهر بالعربية
function getMonthNameArabic(monthNumber) {
    const months = {
        '1': 'يناير', '2': 'فبراير', '3': 'مارس', '4': 'أبريل',
        '5': 'مايو', '6': 'يونيو', '7': 'يوليو', '8': 'أغسطس',
        '9': 'سبتمبر', '10': 'أكتوبر', '11': 'نوفمبر', '12': 'ديسمبر'
    };
    return months[monthNumber] || monthNumber;
}

// ✅ دالة تغيير الفترة الزمنية
window.changeDateRange = function() {
    const profitResultsSection = document.getElementById('profitResultsSection');
    if (profitResultsSection) {
        profitResultsSection.style.display = 'none';
    }
};

// ✅ دالة طباعة التقرير
window.printProfitReport = function(month, year) {
    const monthName = getMonthNameArabic(parseInt(month) + 1);
    const printContent = document.getElementById('profitResultsSection').innerHTML;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
            <title>تقرير أرباح ${selectedEmployee.name} - ${monthName} ${year}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; direction: rtl; }
                .profit-section { margin: 20px 0; }
                .profit-stats { display: flex; gap: 20px; margin: 15px 0; }
                .profit-stat { text-align: center; flex: 1; }
                .profit-stat-value { font-size: 24px; font-weight: bold; color: #28a745; }
                .profit-stat-label { color: #666; font-size: 14px; }
                table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                th, td { padding: 10px; border: 1px solid #ddd; text-align: right; }
                th { background: #f8f9fa; }
            </style>
        </head>
        <body>
            <h1 style="text-align: center; color: #333;">تقرير أرباح ${selectedEmployee.name}</h1>
            <h2 style="text-align: center; color: #666;">${monthName} ${year}</h2>
            ${printContent}
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
};

// ========== تقارير الدكاترة ==========

// تحميل تقارير الدكاترة
async function loadDoctorsReports() {
    try {
        // جلب جميع الدكاترة
        const doctorsQuery = query(
            collection(db, "users"),
            where("role", "in", ["doctor", "skin_doctor"])
        );
        const doctorsSnapshot = await getDocs(doctorsQuery);
        
        const doctors = [];
        doctorsSnapshot.forEach(doc => {
            doctors.push({ id: doc.id, ...doc.data() });
        });
        
        // جلب تقارير الجلسات المكتملة
        const reportsQuery = query(
            collection(db, "doctorCompletedSessions"),
            orderBy("sessionDate", "desc")
        );
        const reportsSnapshot = await getDocs(reportsQuery);
        
        const reports = [];
        reportsSnapshot.forEach(doc => {
            reports.push({ id: doc.id, ...doc.data() });
        });
        
        displayDoctorsReports(doctors, reports);
        
    } catch (error) {
        console.error("خطأ في تحميل تقارير الدكاترة:", error);
    }
}

// عرض تقارير الدكاترة
function displayDoctorsReports(doctors, reports) {
    // إنشاء قسم التقارير إذا لم يكن موجوداً
    const existingSection = document.getElementById('doctorsReportsSection');
    if (existingSection) existingSection.remove();
    
    const container = document.querySelector('.admin-main');
    if (!container) return;
    
    const reportsSection = document.createElement('div');
    reportsSection.id = 'doctorsReportsSection';
    reportsSection.className = 'section';
    reportsSection.style.cssText = `
        background: white;
        border-radius: 15px;
        padding: 25px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        margin-top: 30px;
    `;
    
    reportsSection.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 2px solid #f0f0f0;">
            <h2 style="margin: 0; color: #333;">📊 تقارير الدكاترة الشهرية</h2>
            <div style="display: flex; gap: 10px; align-items: center;">
                <select id="reportMonth" style="padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px;">
                    <option value="all">جميع الأشهر</option>
                    <option value="1">يناير</option>
                    <option value="2">فبراير</option>
                    <option value="3">مارس</option>
                    <option value="4">أبريل</option>
                    <option value="5">مايو</option>
                    <option value="6">يونيو</option>
                    <option value="7">يوليو</option>
                    <option value="8">أغسطس</option>
                    <option value="9">سبتمبر</option>
                    <option value="10">أكتوبر</option>
                    <option value="11">نوفمبر</option>
                    <option value="12">ديسمبر</option>
                </select>
                <select id="reportYear" style="padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px;">
                    ${generateYearOptions()}
                </select>
                <button onclick="filterDoctorReports()" style="background: #667eea; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600;">
                    تطبيق
                </button>
            </div>
        </div>
        
        <div id="doctorsReportsGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 20px;">
            <!-- سيتم ملؤها بالبيانات -->
        </div>
    `;
    
    container.appendChild(reportsSection);
    
    // تعيين الشهر والسنة الحالية
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    document.getElementById('reportMonth').value = currentMonth;
    document.getElementById('reportYear').value = currentYear;
    
    // عرض التقارير
    displayFilteredReports(doctors, reports, currentMonth, currentYear);
}

// توليد خيارات السنوات
function generateYearOptions() {
    const currentYear = new Date().getFullYear();
    let options = '';
    for (let year = currentYear; year >= currentYear - 5; year--) {
        options += `<option value="${year}">${year}</option>`;
    }
    return options;
}

// الحصول على اسم الشهر
function getMonthName(month) {
    const months = {
        '1': 'يناير', '2': 'فبراير', '3': 'مارس', '4': 'أبريل',
        '5': 'مايو', '6': 'يونيو', '7': 'يوليو', '8': 'أغسطس',
        '9': 'سبتمبر', '10': 'أكتوبر', '11': 'نوفمبر', '12': 'ديسمبر'
    };
    return months[month] || month;
}

// عرض التقارير المفلترة
function displayFilteredReports(doctors, reports, month, year) {
    const grid = document.getElementById('doctorsReportsGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    doctors.forEach(doctor => {
        // فلترة التقارير حسب الدكتور والشهر والسنة
        let doctorReports = reports.filter(r => r.doctorId === doctor.id);
        
        if (month !== 'all') {
            doctorReports = doctorReports.filter(r => r.month === parseInt(month) && r.year === parseInt(year));
        } else {
            doctorReports = doctorReports.filter(r => r.year === parseInt(year));
        }
        
        // حساب الإحصائيات
        const totalSessions = doctorReports.length;
        const totalRevenue = doctorReports.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
        
        const doctorCard = document.createElement('div');
        doctorCard.style.cssText = `
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 25px;
            border-radius: 15px;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
            transition: all 0.3s;
            cursor: pointer;
        `;
        
        doctorCard.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
                <div>
                    <h3 style="margin: 0 0 8px 0; font-size: 20px;">👨‍⚕️ ${doctor.name}</h3>
                    <div style="background: rgba(255, 255, 255, 0.2); padding: 5px 12px; border-radius: 15px; display: inline-block; font-size: 13px;">
                        ${doctor.role === 'skin_doctor' ? 'دكتور جلدية' : 'دكتور تجميل'}
                    </div>
                </div>
                <div style="font-size: 14px; opacity: 0.9;">
                    ${month !== 'all' ? getMonthName(month) : 'جميع الأشهر'} ${year}
                </div>
            </div>
            
            <div style="background: rgba(255, 255, 255, 0.15); padding: 20px; border-radius: 12px; margin-bottom: 15px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div style="text-align: center;">
                        <div style="font-size: 32px; font-weight: bold; margin-bottom: 5px;">${totalSessions}</div>
                        <div style="font-size: 13px; opacity: 0.9;">عدد العمليات</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 32px; font-weight: bold; margin-bottom: 5px;">${totalRevenue.toFixed(0)}</div>
                        <div style="font-size: 13px; opacity: 0.9;">إجمالي الإيرادات (جنيه)</div>
                    </div>
                </div>
            </div>
            
            <button onclick="viewDoctorDetails('${doctor.id}', '${doctor.name}', ${month}, ${year})" style="width: 100%; background: rgba(255, 255, 255, 0.25); color: white; border: 2px solid rgba(255, 255, 255, 0.3); padding: 12px; border-radius: 10px; cursor: pointer; font-weight: 600; transition: all 0.3s; font-size: 14px;">
                📊 عرض التفاصيل حسب التاريخ
            </button>
        `;
        
        doctorCard.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px)';
            this.style.boxShadow = '0 8px 25px rgba(102, 126, 234, 0.4)';
        });
        
        doctorCard.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.3)';
        });
        
        grid.appendChild(doctorCard);
    });
    
    if (doctors.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: #f8f9fa; border-radius: 15px;">
                <div style="font-size: 60px; margin-bottom: 15px; opacity: 0.5;">👨‍⚕️</div>
                <h3 style="color: #666; margin-bottom: 10px;">لا يوجد دكاترة</h3>
                <p style="color: #999;">لم يتم تسجيل أي دكاترة في النظام</p>
            </div>
        `;
    }
}

// فلترة تقارير الدكاترة
window.filterDoctorReports = async function() {
    const month = document.getElementById('reportMonth').value;
    const year = parseInt(document.getElementById('reportYear').value);
    
    // إعادة تحميل البيانات
    try {
        const doctorsQuery = query(
            collection(db, "users"),
            where("role", "in", ["doctor", "skin_doctor"])
        );
        const doctorsSnapshot = await getDocs(doctorsQuery);
        
        const doctors = [];
        doctorsSnapshot.forEach(doc => {
            doctors.push({ id: doc.id, ...doc.data() });
        });
        
        const reportsQuery = query(
            collection(db, "doctorCompletedSessions"),
            orderBy("sessionDate", "desc")
        );
        const reportsSnapshot = await getDocs(reportsQuery);
        
        const reports = [];
        reportsSnapshot.forEach(doc => {
            reports.push({ id: doc.id, ...doc.data() });
        });
        
        displayFilteredReports(doctors, reports, month, year);
        
    } catch (error) {
        console.error("خطأ في فلترة التقارير:", error);
    }
};

// عرض تفاصيل دكتور محدد مع اختيار التاريخ
window.viewDoctorDetails = async function(doctorId, doctorName, month, year) {
    try {
        // إنشاء مودال لاختيار التاريخ
        showDateSelectionModal(doctorId, doctorName, month, year);
        
    } catch (error) {
        console.error("خطأ في عرض تفاصيل الدكتور:", error);
        alert('❌ حدث خطأ أثناء تحميل التفاصيل');
    }
};

// إظهار مودال اختيار التاريخ
function showDateSelectionModal(doctorId, doctorName, month, year) {
    // إزالة المودال القديم إن وجد
    const oldModal = document.getElementById('dateSelectionModal');
    if (oldModal) oldModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'dateSelectionModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        backdrop-filter: blur(5px);
    `;
    
    modal.innerHTML = `
        <div style="background: white; border-radius: 16px; width: 95%; max-width: 500px; padding: 25px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; text-align: center;">
                <h2 style="margin: 0 0 8px 0;">📅 اختيار التاريخ</h2>
                <p style="margin: 0; opacity: 0.9;">اختر تاريخ لعرض تفاصيل عمليات الدكتور: ${doctorName}</p>
            </div>
            
            <div style="margin-bottom: 25px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">اختر تاريخ:</label>
                <input type="date" id="selectedDate" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px;">
            </div>
            
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button onclick="loadDoctorSessionsByDate('${doctorId}', '${doctorName}', ${month}, ${year})" style="background: #28a745; color: white; border: none; padding: 12px 25px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.3s;">
                    📊 عرض التفاصيل
                </button>
                <button onclick="closeDateSelectionModal()" style="background: #6c757d; color: white; border: none; padding: 12px 25px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.3s;">
                    إغلاق
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // تعيين التاريخ الحالي كقيمة افتراضية
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('selectedDate').value = today;
}

// إغلاق مودال اختيار التاريخ
window.closeDateSelectionModal = function() {
    const modal = document.getElementById('dateSelectionModal');
    if (modal) modal.remove();
};

// تحميل جلسات الدكتور للتاريخ المحدد
window.loadDoctorSessionsByDate = async function(doctorId, doctorName, month, year) {
    const dateInput = document.getElementById('selectedDate');
    if (!dateInput || !dateInput.value) {
        alert('⚠️ يرجى اختيار تاريخ!');
        return;
    }
    
    const selectedDate = new Date(dateInput.value);
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    try {
        // إغلاق مودال اختيار التاريخ
        closeDateSelectionModal();
        
        // عرض تحميل
        showLoadingModal('جاري تحميل بيانات الجلسات...');
        
        // جلب الجلسات للتاريخ المحدد فقط
        const q = query(
            collection(db, "doctorCompletedSessions"),
            where("doctorId", "==", doctorId),
            where("sessionDate", ">=", startOfDay),
            where("sessionDate", "<=", endOfDay),
            orderBy("sessionDate", "desc")
        );
        
        const querySnapshot = await getDocs(q);
        const sessions = [];
        querySnapshot.forEach(doc => {
            sessions.push({ id: doc.id, ...doc.data() });
        });
        
        // إغلاق تحميل
        closeLoadingModal();
        
        // عرض التفاصيل
        showDoctorDetailsModal(doctorName, sessions, selectedDate);
        
    } catch (error) {
        console.error("خطأ في تحميل جلسات الدكتور:", error);
        closeLoadingModal();
        alert('❌ حدث خطأ أثناء تحميل التفاصيل');
    }
};

// عرض تحميل
function showLoadingModal(message = 'جاري التحميل...') {
    const oldModal = document.getElementById('loadingModal');
    if (oldModal) oldModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'loadingModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10001;
        backdrop-filter: blur(5px);
    `;
    
    modal.innerHTML = `
        <div style="background: white; border-radius: 12px; padding: 30px; text-align: center; min-width: 200px;">
            <div style="font-size: 40px; margin-bottom: 15px;">⏳</div>
            <div style="font-weight: 600; color: #333;">${message}</div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// إغلاق تحميل
function closeLoadingModal() {
    const modal = document.getElementById('loadingModal');
    if (modal) modal.remove();
}

// إظهار مودال تفاصيل الدكتور للتاريخ المحدد
function showDoctorDetailsModal(doctorName, sessions, selectedDate) {
    // إزالة المودال القديم إن وجد
    const oldModal = document.getElementById('doctorDetailsModal');
    if (oldModal) oldModal.remove();
    
    const totalSessions = sessions.length;
    const totalRevenue = sessions.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    
    const formattedDate = safeFormatDate(selectedDate);
    
    const modal = document.createElement('div');
    modal.id = 'doctorDetailsModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        backdrop-filter: blur(5px);
    `;
    
    modal.innerHTML = `
        <div style="background: white; border-radius: 16px; width: 95%; max-width: 900px; max-height: 90vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 16px 16px 0 0; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h2 style="margin: 0 0 8px 0;">📊 تفاصيل ${doctorName}</h2>
                    <div style="font-size: 14px; opacity: 0.9;">
                        تاريخ: ${formattedDate}
                    </div>
                </div>
                <button onclick="closeDoctorDetailsModal()" style="background: rgba(255, 255, 255, 0.2); border: none; color: white; width: 40px; height: 40px; border-radius: 50%; font-size: 20px; cursor: pointer; transition: all 0.3s;">
                    ✕
                </button>
            </div>
            
            <div style="padding: 25px;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px; text-align: center;">
                        <div style="font-size: 36px; font-weight: bold; margin-bottom: 8px;">${totalSessions}</div>
                        <div style="font-size: 14px; opacity: 0.9;">عدد العمليات</div>
                    </div>
                    <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 20px; border-radius: 12px; text-align: center;">
                        <div style="font-size: 36px; font-weight: bold; margin-bottom: 8px;">${totalRevenue.toFixed(0)}</div>
                        <div style="font-size: 14px; opacity: 0.9;">إجمالي الإيرادات (جنيه)</div>
                    </div>
                </div>
                
                <h3 style="margin-bottom: 15px; color: #333; padding-bottom: 10px; border-bottom: 2px solid #f0f0f0;">📋 سجل الجلسات - ${formattedDate}</h3>
                
                ${sessions.length > 0 ? `
                <div style="max-height: 400px; overflow-y: auto;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead style="background: #f8f9fa; position: sticky; top: 0;">
                            <tr>
                                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #dee2e6;">الوقت</th>
                                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #dee2e6;">اسم العميلة</th>
                                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #dee2e6;">الخدمات</th>
                                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #dee2e6;">المبلغ</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sessions.map(session => `
                                <tr style="border-bottom: 1px solid #e9ecef;">
                                    <td style="padding: 12px;">${safeFormatTime(session.sessionDate?.toDate())}</td>
                                    <td style="padding: 12px;">${session.customerName}</td>
                                    <td style="padding: 12px;">${(session.services || []).map(s => s.name).join(', ')}</td>
                                    <td style="padding: 12px; font-weight: bold; color: #28a745;">${(session.totalAmount || 0).toFixed(2)} جنيه</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                ` : `
                <div style="text-align: center; padding: 40px 20px; background: #f8f9fa; border-radius: 10px;">
                    <div style="font-size: 48px; margin-bottom: 15px; opacity: 0.5;">📭</div>
                    <h3 style="color: #666; margin-bottom: 10px;">لا توجد جلسات</h3>
                    <p style="color: #999;">لم يتم تسجيل أي جلسات في هذا التاريخ</p>
                </div>
                `}
                
                <div style="margin-top: 25px; display: flex; gap: 12px; justify-content: flex-end;">
                    <button onclick="printDoctorReport()" style="background: #28a745; color: white; border: none; padding: 12px 25px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.3s;">
                        🖨️ طباعة التقرير
                    </button>
                    <button onclick="closeDoctorDetailsModal()" style="background: #6c757d; color: white; border: none; padding: 12px 25px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.3s;">
                        إغلاق
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// إغلاق مودال التفاصيل
window.closeDoctorDetailsModal = function() {
    const modal = document.getElementById('doctorDetailsModal');
    if (modal) modal.remove();
};

// طباعة تقرير الدكتور
window.printDoctorReport = function() {
    window.print();
};

// ✅ إضافة CSS للتحميل
const additionalStyles = `
    .loading-section {
        text-align: center;
        padding: 40px 20px;
        background: #f8f9fa;
        border-radius: 10px;
        margin: 20px 0;
    }
    
    .loading-spinner {
        border: 4px solid #f3f3f3;
        border-top: 4px solid #667eea;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        animation: spin 1s linear infinite;
        margin: 0 auto 15px;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    .percentage-input {
        text-align: center;
        font-weight: bold;
        font-size: 16px;
    }
    
    .net-profit {
        background: linear-gradient(135deg, #e8f5e9, #c8e6c9);
        padding: 15px;
        border-radius: 10px;
        text-align: center;
        margin: 15px 0;
        border: 2px solid #4caf50;
    }
    
    .net-profit-value {
        font-size: 24px;
        font-weight: bold;
        color: #1b5e20;
        margin-top: 8px;
    }
`;

// إضافة الـ styles إلى الصفحة
const styleSheet = document.createElement("style");
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);

// جعل الدوال متاحة globally
window.openEmployeeDetails = openEmployeeDetails;
window.openSalaryModal = openSalaryModal;
window.openProfitCalculation = openProfitCalculation;
window.calculateDoctorProfit = calculateDoctorProfit;
window.calculateEmployeeProfit = calculateEmployeeProfit;
window.closeEmployeeModal = closeEmployeeModal;
window.closeProfitModal = closeProfitModal;
window.closeSalaryModal = closeSalaryModal;
window.logout = logout;