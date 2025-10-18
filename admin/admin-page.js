// admin-page.js - الكود الكامل مع إصلاح الأخطاء
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
    
    // عرض تحميل مؤقت
    profitCalculationContent.innerHTML = '<div class="loading">جاري حساب البيانات...</div>';
    
    profitModal.classList.remove('hidden');
    
    try {
        if (selectedEmployee.role === 'doctor' || selectedEmployee.role === 'skin_doctor') {
            await loadDoctorProfit();
        } else {
            await loadEmployeeProfit();
        }
    } catch (error) {
        console.error("❌ خطأ في تحميل بيانات الأرباح:", error);
        profitCalculationContent.innerHTML = '<div class="error">حدث خطأ في تحميل البيانات</div>';
    }
};

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

// حساب أرباح الموظفين (استقبال، محاسب)
async function loadEmployeeProfit() {
    if (!selectedEmployee) return;
    
    // حساب بداية ونهاية الشهر الحالي
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
    
    // جلب الشيفتات التي فتحها الموظف خلال الشهر
    const shiftsQuery = query(
        collection(db, "shifts"),
        where("userId", "==", selectedEmployee.id),
        where("startTime", ">=", startOfMonth),
        where("startTime", "<=", endOfMonth)
    );
    
    const shiftsSnapshot = await getDocs(shiftsQuery);
    
    let totalRevenue = 0;
    const shiftDetails = [];
    
    // حساب الإيرادات من كل شيفت
    for (const shiftDoc of shiftsSnapshot.docs) {
        const shift = shiftDoc.data();
        const shiftId = shiftDoc.id;
        
        // جلب الحركات المالية خلال هذا الشيفت
        const transactionsQuery = query(
            collection(db, "transactions"),
            where("shiftId", "==", shiftId),
            where("type", "in", ["deposit", "payment"])
        );
        
        const transactionsSnapshot = await getDocs(transactionsQuery);
        let shiftRevenue = 0;
        
        transactionsSnapshot.forEach(transactionDoc => {
            const transaction = transactionDoc.data();
            shiftRevenue += Math.abs(transaction.amount) || 0;
        });
        
        totalRevenue += shiftRevenue;
        
        shiftDetails.push({
            startTime: shift.startTime?.toDate() || new Date(),
            endTime: shift.endTime?.toDate(),
            revenue: shiftRevenue,
            shiftId: shiftId
        });
    }
    
    displayEmployeeProfit(totalRevenue, shiftDetails);
}

// عرض أرباح الموظفين
function displayEmployeeProfit(totalRevenue, shiftDetails) {
    const profitCalculationContent = document.getElementById('profitCalculationContent');
    if (!profitCalculationContent) return;
    
    profitCalculationContent.innerHTML = `
        <div class="profit-section">
            <h4>إحصائيات الشهر الحالي</h4>
            <div class="profit-stats">
                <div class="profit-stat">
                    <div class="profit-stat-value">${shiftDetails.length}</div>
                    <div class="profit-stat-label">عدد الشيفتات</div>
                </div>
                <div class="profit-stat">
                    <div class="profit-stat-value">${totalRevenue.toFixed(2)}</div>
                    <div class="profit-stat-label">إجمالي الإيرادات (جنيه)</div>
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
            
            <button class="btn btn-success" onclick="calculateEmployeeProfit()">حساب الأرباح</button>
        </div>
        
        ${shiftDetails.length > 0 ? `
        <div class="profit-section">
            <h4>تفاصيل الشيفتات</h4>
            <div style="max-height: 300px; overflow-y: auto;">
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>تاريخ الشيفت</th>
                            <th>وقت البدء</th>
                            <th>وقت الانتهاء</th>
                            <th>الإيرادات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${shiftDetails.map(shift => `
                            <tr>
                                <td>${safeFormatDate(shift.startTime)}</td>
                                <td>${safeFormatTime(shift.startTime)}</td>
                                <td>${shift.endTime ? safeFormatTime(shift.endTime) : 'مستمر'}</td>
                                <td>${shift.revenue.toFixed(2)} جنيه</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        ` : ''}
    `;
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

// حساب أرباح الموظف
window.calculateEmployeeProfit = function() {
    const percentageInput = document.getElementById('profitPercentage');
    if (!percentageInput) return;
    
    const percentage = parseFloat(percentageInput.value);
    
    if (!percentage || percentage < 0 || percentage > 100) {
        alert('⚠️ يرجى إدخال نسبة مئوية صحيحة بين 0 و 100!');
        return;
    }
    
    // في التطبيق الحقيقي، سنحسب من البيانات الفعلية
    const totalRevenueElement = document.querySelector('.profit-stat-value:nth-child(2)');
    const totalRevenue = parseFloat(totalRevenueElement?.textContent) || 0;
    
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
                📊 عرض التفاصيل الكاملة
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

// عرض تفاصيل دكتور محدد
window.viewDoctorDetails = async function(doctorId, doctorName, month, year) {
    try {
        // جلب جميع جلسات الدكتور للفترة المحددة
        let q;
        if (month !== 'all') {
            q = query(
                collection(db, "doctorCompletedSessions"),
                where("doctorId", "==", doctorId),
                where("month", "==", parseInt(month)),
                where("year", "==", parseInt(year)),
                orderBy("sessionDate", "desc")
            );
        } else {
            q = query(
                collection(db, "doctorCompletedSessions"),
                where("doctorId", "==", doctorId),
                where("year", "==", parseInt(year)),
                orderBy("sessionDate", "desc")
            );
        }
        
        const querySnapshot = await getDocs(q);
        const sessions = [];
        querySnapshot.forEach(doc => {
            sessions.push({ id: doc.id, ...doc.data() });
        });
        
        // إنشاء مودال لعرض التفاصيل
        showDoctorDetailsModal(doctorName, sessions, month, year);
        
    } catch (error) {
        console.error("خطأ في عرض تفاصيل الدكتور:", error);
        alert('❌ حدث خطأ أثناء تحميل التفاصيل');
    }
};

// إظهار مودال تفاصيل الدكتور
function showDoctorDetailsModal(doctorName, sessions, month, year) {
    // إزالة المودال القديم إن وجد
    const oldModal = document.getElementById('doctorDetailsModal');
    if (oldModal) oldModal.remove();
    
    const totalSessions = sessions.length;
    const totalRevenue = sessions.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    
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
                        ${month !== 'all' ? getMonthName(month) : 'جميع الأشهر'} ${year}
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
                        <div style="font-size: 14px; opacity: 0.9;">إجمالي العمليات</div>
                    </div>
                    <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 20px; border-radius: 12px; text-align: center;">
                        <div style="font-size: 36px; font-weight: bold; margin-bottom: 8px;">${totalRevenue.toFixed(0)}</div>
                        <div style="font-size: 14px; opacity: 0.9;">إجمالي الإيرادات (جنيه)</div>
                    </div>
                </div>
                
                <h3 style="margin-bottom: 15px; color: #333; padding-bottom: 10px; border-bottom: 2px solid #f0f0f0;">📋 سجل الجلسات</h3>
                
                <div style="max-height: 400px; overflow-y: auto;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead style="background: #f8f9fa; position: sticky; top: 0;">
                            <tr>
                                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #dee2e6;">التاريخ</th>
                                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #dee2e6;">اسم العميلة</th>
                                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #dee2e6;">الخدمات</th>
                                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #dee2e6;">المبلغ</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sessions.map(session => `
                                <tr style="border-bottom: 1px solid #e9ecef;">
                                    <td style="padding: 12px;">${safeFormatDate(session.sessionDate?.toDate())}</td>
                                    <td style="padding: 12px;">${session.customerName}</td>
                                    <td style="padding: 12px;">${(session.services || []).map(s => s.name).join(', ')}</td>
                                    <td style="padding: 12px; font-weight: bold; color: #28a745;">${(session.totalAmount || 0).toFixed(2)} جنيه</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                
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