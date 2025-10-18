import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    onAuthStateChanged,
    createUserWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc,
    setDoc,
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

// تكوين Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAZSMTIQ9o2Aqool263jkvVq-qzhEHEFfM",
    authDomain: "beautycenter-6e1cf.firebaseapp.com",
    projectId: "beautycenter-6e1cf",
    storageBucket: "beautycenter-6e1cf.firebasestorage.app",
    messagingSenderId: "706085429",
    appId: "1:706085429:web:1f0ce5d3eb27c35372277c",
    measurementId: "G-QL4LZG5KJZ"
};

// تهيئة Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// دالة للتحقق من وجود مستخدمين وإنشاء مدير إذا لم يوجد
async function initializeFirstAdmin() {
    try {
        const usersSnapshot = await getDocs(collection(db, "users"));
        
        // إذا لم يكن هناك مستخدمين، إنشاء المدير
        if (usersSnapshot.empty) {
            console.log("جاري إنشاء حساب المدير الأول...");
            
            const adminEmail = "admin@beautycenter.com";
            const adminPassword = "Admin123!";
            const adminName = "مدير النظام";
            
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
                const user = userCredential.user;
                
                // استخدم setDoc مع UID كمفتاح بدلاً من addDoc
                await setDoc(doc(db, "users", user.uid), {
                    name: adminName,
                    email: adminEmail,
                    role: "admin",
                    createdAt: new Date()
                });
                
                console.log("✅ تم إنشاء حساب المدير الأول تلقائياً");
                console.log("📧 البريد:", adminEmail);
                console.log("🔑 كلمة السر:", adminPassword);
                
            } catch (authError) {
                if (authError.code === 'auth/email-already-in-use') {
                    console.log("⚠️ الحساب موجود بالفعل في نظام المصادقة");
                    // حاول تسجيل الدخول وإنشاء السجل في Firestore
                    try {
                        const userCredential = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
                        const user = userCredential.user;
                        
                        await setDoc(doc(db, "users", user.uid), {
                            name: adminName,
                            email: adminEmail,
                            role: "admin",
                            createdAt: new Date()
                        });
                        
                        console.log("✅ تم إصلاح الحساب وإضافة السجل في Firestore");
                    } catch (signInError) {
                        console.error("❌ خطأ في تسجيل الدخول:", signInError);
                    }
                } else {
                    console.error("❌ خطأ في إنشاء المدير الأول:", authError);
                }
            }
        } else {
            console.log("✅ النظام جاهز، يوجد مستخدمين بالفعل");
        }
    } catch (error) {
        console.error("⚠️ خطأ في التحقق من المستخدمين:", error);
    }
}

// استدعاء الدالة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    initializeFirstAdmin();
});

// التحقق من حالة المصادقة
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // المستخدم مسجل الدخول، تحقق من دوره
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                // توجيه إلى الصفحة الرئيسية
                window.location.href = "main.html";
            }
        } catch (error) {
            console.error("خطأ في التحقق من بيانات المستخدم:", error);
        }
    }
});

// معالجة تسجيل الدخول
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const messageDiv = document.getElementById('message');
    
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // التحقق من وجود المستخدم في قاعدة البيانات
        const userDoc = await getDoc(doc(db, "users", user.uid));
        
        if (userDoc.exists()) {
            messageDiv.textContent = "تم تسجيل الدخول بنجاح!";
            messageDiv.className = "message success";
            
            // توجيه إلى الصفحة الرئيسية بعد ثانية
            setTimeout(() => {
                window.location.href = "main.html";
            }, 1000);
        } else {
            messageDiv.textContent = "ليس لديك صلاحية للدخول!";
            messageDiv.className = "message error";
            await auth.signOut();
        }
    } catch (error) {
        console.error("خطأ في تسجيل الدخول:", error);
        
        if (error.code === 'auth/invalid-credential') {
            messageDiv.textContent = "خطأ في البريد الإلكتروني أو كلمة المرور!";
        } else if (error.code === 'auth/too-many-requests') {
            messageDiv.textContent = "تم محاولة الدخول عدة مرات بشكل خاطئ، حاول مرة أخرى لاحقاً";
        } else {
            messageDiv.textContent = "حدث خطأ أثناء تسجيل الدخول!";
        }
        messageDiv.className = "message error";
    }
});