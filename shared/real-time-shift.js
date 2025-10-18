import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    onSnapshot,
    Timestamp,
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
const db = getFirestore(app);

let shiftListener = null;
let currentListeners = new Map();

// دالة للاستماع لتغيرات الشيفتات النشطة
export function startShiftListener(callback) {
    // إيقاف أي مستمع سابق
    if (shiftListener) {
        shiftListener();
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const q = query(
        collection(db, "shifts"),
        where("startTime", ">=", Timestamp.fromDate(today)),
        where("startTime", "<", Timestamp.fromDate(tomorrow)),
        where("status", "==", "active")
    );

    // بدء الاستماع في الوقت الحقيقي
    shiftListener = onSnapshot(q, (snapshot) => {
        const hasActiveShift = !snapshot.empty;
        console.log('📢 تحديث حالة الشيفت:', hasActiveShift ? 'نشط' : 'غير نشط');
        
        // إرجاع بيانات الشيفتات النشطة أيضاً
        const activeShifts = [];
        snapshot.forEach(doc => {
            activeShifts.push({ id: doc.id, ...doc.data() });
        });
        
        callback(hasActiveShift, activeShifts);
    }, (error) => {
        console.error('❌ خطأ في مستمع الشيفت:', error);
    });

    return shiftListener;
}

// دالة للاستماع لتغيرات شيفتات جميع المستخدمين
export function startGlobalShiftListener(callback) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const q = query(
        collection(db, "shifts"),
        where("startTime", ">=", Timestamp.fromDate(today)),
        where("startTime", "<", Timestamp.fromDate(tomorrow)),
        where("status", "==", "active")
    );

    const listener = onSnapshot(q, (snapshot) => {
        const activeShifts = [];
        snapshot.forEach(doc => {
            activeShifts.push({ id: doc.id, ...doc.data() });
        });
        
        console.log('🌍 تحديث شامل للشيفتات النشطة:', activeShifts.length);
        callback(activeShifts);
    }, (error) => {
        console.error('❌ خطأ في المستمع الشامل للشيفتات:', error);
    });

    currentListeners.set('global', listener);
    return listener;
}

// دالة لإيقاف الاستماع
export function stopShiftListener() {
    if (shiftListener) {
        shiftListener();
        shiftListener = null;
    }
}

// دالة لإيقاف جميع المستمعين
export function stopAllListeners() {
    if (shiftListener) {
        shiftListener();
        shiftListener = null;
    }
    
    currentListeners.forEach((listener, key) => {
        listener();
    });
    currentListeners.clear();
}

// دالة للتحقق الفوري من وجود شيفت نشط
export async function checkActiveShiftImmediate() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const q = query(
            collection(db, "shifts"),
            where("startTime", ">=", Timestamp.fromDate(today)),
            where("startTime", "<", Timestamp.fromDate(tomorrow)),
            where("status", "==", "active")
        );

        const querySnapshot = await getDocs(q);
        return !querySnapshot.empty;
    } catch (error) {
        console.error("❌ خطأ في التحقق الفوري من الشيفت:", error);
        return false;
    }
}

// دالة للتحقق من وجود شيفت نشط لمستخدم معين
export async function checkActiveShiftForUser(userId) {
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
        return !querySnapshot.empty;
    } catch (error) {
        console.error("❌ خطأ في التحقق من شيفت المستخدم:", error);
        return false;
    }
}

// دالة للحصول على جميع الشيفتات النشطة
export async function getAllActiveShifts() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const q = query(
            collection(db, "shifts"),
            where("startTime", ">=", Timestamp.fromDate(today)),
            where("startTime", "<", Timestamp.fromDate(tomorrow)),
            where("status", "==", "active")
        );

        const querySnapshot = await getDocs(q);
        const activeShifts = [];
        
        querySnapshot.forEach(doc => {
            activeShifts.push({ id: doc.id, ...doc.data() });
        });
        
        return activeShifts;
    } catch (error) {
        console.error("❌ خطأ في جلب الشيفتات النشطة:", error);
        return [];
    }
}

// دالة للاشتراك في تغييرات شيفت معين
export function subscribeToShift(shiftId, callback) {
    const shiftRef = doc(db, "shifts", shiftId);
    
    const unsubscribe = onSnapshot(shiftRef, (doc) => {
        if (doc.exists()) {
            callback({ id: doc.id, ...doc.data() });
        } else {
            callback(null);
        }
    }, (error) => {
        console.error(`❌ خطأ في الاشتراك في الشيفت ${shiftId}:`, error);
    });

    currentListeners.set(shiftId, unsubscribe);
    return unsubscribe;
}