// shared/auth.js - النسخة المحدثة مع فحص الشيفت الخاص بالمستخدم
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc,
    collection,
    query,
    where,
    getDocs,
    Timestamp
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

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

// ✅ دالة للتحقق من وجود شيفت نشط للمستخدم الحالي فقط
export async function checkActiveShift() {
    return new Promise((resolve) => {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const userDoc = await getDoc(doc(db, "users", user.uid));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        
                        // إذا كان المستخدم من نوع استقبال، تحقق من وجود شيفت نشط له فقط
                        if (userData.role === 'reception') {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const tomorrow = new Date(today);
                            tomorrow.setDate(tomorrow.getDate() + 1);
                            
                            const q = query(
                                collection(db, "shifts"),
                                where("userId", "==", user.uid), // ✅ فقط شيفتات المستخدم الحالي
                                where("startTime", ">=", Timestamp.fromDate(today)),
                                where("startTime", "<", Timestamp.fromDate(tomorrow)),
                                where("status", "==", "active")
                            );
                            
                            const querySnapshot = await getDocs(q);
                            
                            if (querySnapshot.empty) {
                                // لا يوجد شيفت نشط للمستخدم، توجيه إلى صفحة الشيفتات
                                if (!window.location.href.includes('shift-management.html')) {
                                    window.location.href = '../shift-management/shift-management.html';
                                }
                                resolve(false);
                                return;
                            }
                        }
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                } catch (error) {
                    console.error("خطأ في التحقق من الشيفت:", error);
                    resolve(false);
                }
            } else {
                resolve(false);
            }
        });
    });
}

// دالة للتحقق من الصلاحية مع الشيفت
export async function checkUserRoleWithShift(requiredRole = null) {
    return new Promise((resolve) => {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const userDoc = await getDoc(doc(db, "users", user.uid));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        
                        // التحقق من الصلاحية المطلوبة
                        if (requiredRole && userData.role !== requiredRole && userData.role !== 'admin') {
                            window.location.href = "../main.html";
                            resolve(false);
                            return;
                        }
                        
                        // ✅ إذا كان المستخدم من نوع استقبال، تحقق من وجود شيفت نشط له فقط
                        if (userData.role === 'reception') {
                            const hasActiveShift = await checkUserActiveShift(user.uid);
                            if (!hasActiveShift) {
                                resolve(false);
                                return;
                            }
                        }
                        
                        resolve(userData);
                    } else {
                        window.location.href = "../index.html";
                        resolve(false);
                    }
                } catch (error) {
                    console.error("خطأ في التحقق من الصلاحية:", error);
                    window.location.href = "../index.html";
                    resolve(false);
                }
            } else {
                window.location.href = "../index.html";
                resolve(false);
            }
        });
    });
}

// ✅ دالة مساعدة للتحقق من شيفت مستخدم معين
async function checkUserActiveShift(userId) {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const q = query(
            collection(db, "shifts"),
            where("userId", "==", userId),
            where("startTime", ">=", Timestamp.fromDate(today)),
            where("startTime", "<", Timestamp.fromDate(tomorrow)),
            where("status", "==", "active")
        );
        
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            // لا يوجد شيفت نشط، توجيه إلى صفحة الشيفتات
            if (!window.location.href.includes('shift-management.html')) {
                window.location.href = '../shift-management/shift-management.html';
            }
            return false;
        }
        
        return true;
    } catch (error) {
        console.error("خطأ في التحقق من الشيفت:", error);
        return false;
    }
}

// دالة للتحقق من صلاحية المستخدم - الإصدار الأساسي
export async function checkUserRole(requiredRole = null) {
    return new Promise((resolve, reject) => {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const userDoc = await getDoc(doc(db, "users", user.uid));
                    if (userDoc.exists()) {
                        const userData = { uid: user.uid, ...userDoc.data() };
                        
                        // حفظ بيانات المستخدم في localStorage
                        localStorage.setItem('userData', JSON.stringify(userData));
                        
                        // التحقق من الصلاحية المطلوبة
                        if (requiredRole) {
                            const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
                            
                            // الأدمن يمكنه الوصول لكل شيء
                            if (userData.role === 'admin' || allowedRoles.includes(userData.role)) {
                                resolve(userData);
                            } else {
                                console.log("❌ المستخدم لا يملك الصلاحية المطلوبة");
                                window.location.href = "../main.html";
                                resolve(false);
                            }
                        } else {
                            resolve(userData);
                        }
                    } else {
                        console.log("❌ المستخدم غير موجود في Firestore");
                        window.location.href = "../index.html";
                        resolve(false);
                    }
                } catch (error) {
                    console.error("❌ خطأ في التحقق من الصلاحية:", error);
                    window.location.href = "../index.html";
                    resolve(false);
                }
            } else {
                console.log("❌ لا يوجد مستخدم مسجل");
                window.location.href = "../index.html";
                resolve(false);
            }
        });
    });
}

// دالة للحصول على بيانات المستخدم الحالي
export function getCurrentUser() {
    try {
        const userData = localStorage.getItem('userData');
        return userData ? JSON.parse(userData) : null;
    } catch (error) {
        console.error("خطأ في الحصول على بيانات المستخدم:", error);
        return null;
    }
}

// دالة للتحقق من صلاحية الوصول
export function hasPermission(requiredRole) {
    const userData = getCurrentUser();
    if (!userData) return false;
    
    // الأدمن يملك كل الصلاحيات
    if (userData.role === 'admin') return true;
    
    // التحقق من الصلاحية المطلوبة
    if (Array.isArray(requiredRole)) {
        return requiredRole.includes(userData.role);
    }
    
    return userData.role === requiredRole;
}

// تصدير auth و db للاستخدام في ملفات أخرى
export { auth, db };