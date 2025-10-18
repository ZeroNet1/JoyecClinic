import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    setDoc, 
    doc,
    getDocs,
    deleteDoc  // تأكد من استيراد deleteDoc
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { checkUserRole } from "../shared/auth.js";

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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// التحقق من صلاحية المستخدم
checkUserRole('admin').then(userData => {
    if (userData) {
        document.getElementById('userName').textContent = userData.name;
        loadUsers();
    } else {
        console.log("ليس لديك صلاحية للوصول إلى هذه الصفحة");
    }
}).catch(error => {
    console.error("خطأ في التحقق من الصلاحية:", error);
});

// إنشاء حساب جديد
document.getElementById('createUserForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value;
    const messageDiv = document.getElementById('message');
    
    // التحقق من البيانات
    if (!name || !email || !password || !role) {
        messageDiv.textContent = "⚠️ يرجى ملء جميع الحقول!";
        messageDiv.className = "message error";
        return;
    }
    
    try {
        messageDiv.textContent = "جاري إنشاء الحساب...";
        messageDiv.className = "message";
        
        // إنشاء المستخدم في Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        console.log("تم إنشاء المستخدم في Authentication:", user.uid);
        
        // استخدام setDoc مع UID كمفتاح
        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            name: name,
            email: email,
            role: role,
            createdAt: new Date()
        });
        
        console.log("تم إنشاء السجل في Firestore");
        
        messageDiv.textContent = "✅ تم إنشاء الحساب بنجاح!";
        messageDiv.className = "message success";
        
        // إعادة تعيين النموذج
        document.getElementById('createUserForm').reset();
        
        // إعادة تحميل قائمة المستخدمين
        loadUsers();
        
    } catch (error) {
        console.error("خطأ في إنشاء الحساب:", error);
        
        if (error.code === 'auth/email-already-in-use') {
            messageDiv.textContent = "⚠️ هذا البريد الإلكتروني مستخدم بالفعل!";
        } else if (error.code === 'auth/weak-password') {
            messageDiv.textContent = "⚠️ كلمة السر ضعيفة، يجب أن تكون 6 أحرف على الأقل!";
        } else if (error.code === 'auth/invalid-email') {
            messageDiv.textContent = "⚠️ البريد الإلكتروني غير صحيح!";
        } else if (error.code === 'permission-denied') {
            messageDiv.textContent = "❌ ليس لديك صلاحية لإنشاء حسابات!";
        } else {
            messageDiv.textContent = "❌ حدث خطأ أثناء إنشاء الحساب: " + error.message;
        }
        messageDiv.className = "message error";
    }
});

// تحميل قائمة المستخدمين
async function loadUsers() {
    const usersList = document.getElementById('usersList');
    usersList.innerHTML = '<p>جاري التحميل...</p>';
    
    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        usersList.innerHTML = '';
        
        if (querySnapshot.empty) {
            usersList.innerHTML = '<p>لا توجد حسابات بعد</p>';
            return;
        }
        
        querySnapshot.forEach((doc) => {
            const user = doc.data();
            const userItem = document.createElement('div');
            userItem.className = 'user-item';
            userItem.innerHTML = `
                <div class="user-name">${user.name}</div>
                <div class="user-details">
                    <span class="user-email">${user.email}</span>
                    <span class="user-role">${user.role}</span>
                </div>
                <button class="delete-btn" onclick="deleteUser('${doc.id}')">حذف</button>
            `;
            usersList.appendChild(userItem);
        });
        
    } catch (error) {
        console.error("خطأ في تحميل المستخدمين:", error);
        usersList.innerHTML = '<p class="error">حدث خطأ في تحميل المستخدمين</p>';
    }
}

// حذف حساب
window.deleteUser = async function(userId) {
    if (confirm('هل أنت متأكد من حذف هذا الحساب؟')) {
        try {
            await deleteDoc(doc(db, "users", userId));
            loadUsers();
        } catch (error) {
            console.error("خطأ في حذف الحساب:", error);
            alert('❌ حدث خطأ أثناء حذف الحساب: ' + error.message);
        }
    }
};