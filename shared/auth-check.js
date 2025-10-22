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
        getDocs
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

    // دالة للتحقق من وجود شيفت نشط
    export async function checkActiveShift() {
        return new Promise((resolve) => {
            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    try {
                        const userDoc = await getDoc(doc(db, "users", user.uid));
                        if (userDoc.exists()) {
                            const userData = userDoc.data();
                            
                            // إذا كان المستخدم من نوع استقبال، تحقق من وجود شيفت نشط
                            if (userData.role === 'reception') {
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                
                                const q = query(
                                    collection(db, "shifts"),
                                    where("userId", "==", user.uid),
                                    where("startTime", ">=", today),
                                    where("status", "==", "active")
                                );
                                
                                const querySnapshot = await getDocs(q);
                                
                                if (querySnapshot.empty) {
                                    // لا يوجد شيفت نشط، توجيه إلى صفحة الشيفتات
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
                            
                            // إذا كان المستخدم من نوع استقبال، تحقق من وجود شيفت نشط
                            if (userData.role === 'reception') {
                                const hasActiveShift = await checkActiveShift();
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

    // تصدير auth و db للاستخدام في ملفات أخرى
    export { auth, db };