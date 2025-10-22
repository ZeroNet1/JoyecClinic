// firebase-cache.js
import { 
    doc, 
    getDoc as firebaseGetDoc,
    setDoc as firebaseSetDoc,
    collection,
    getDocs as firebaseGetDocs,
    query,
    where,
    Timestamp
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

// نظام الكاش المركزي
const cache = {
    data: {},
    expiryTime: 5 * 60 * 1000, // 5 دقائق
    lastCleanup: Date.now(),
    
    cleanup: function() {
        const now = Date.now();
        if (now - this.lastCleanup > this.expiryTime) {
            Object.keys(this.data).forEach(key => {
                if (now - this.data[key].timestamp > this.expiryTime) {
                    delete this.data[key];
                }
            });
            this.lastCleanup = now;
            console.log("🧹 تم تنظيف الكاش");
        }
    },
    
    set: function(key, data) {
        this.data[key] = {
            data: data,
            timestamp: Date.now()
        };
        this.cleanup();
    },
    
    get: function(key) {
        this.cleanup();
        const item = this.data[key];
        if (item && (Date.now() - item.timestamp < this.expiryTime)) {
            console.log(`📖 جلب ${key} من الكاش`);
            return item.data;
        }
        return null;
    },
    
    invalidate: function(keyPattern = null) {
        if (keyPattern) {
            // مسح عناصر تطابق النمط
            Object.keys(this.data).forEach(key => {
                if (key.includes(keyPattern)) {
                    delete this.data[key];
                }
            });
            console.log(`🗑️ تم مسح الكاش للنمط: ${keyPattern}`);
        } else {
            // مسح الكاش كله
            this.data = {};
            console.log("🗑️ تم مسح الكاش بالكامل");
        }
    }
};

// دالة مساعدة لإنشاء مفتاح الكاش
function createCacheKey(collection, id, queryConditions = null) {
    let key = `${collection}/${id}`;
    if (queryConditions) {
        key += `?${JSON.stringify(queryConditions)}`;
    }
    return key;
}

// 🔁 الدوال المغلفة (Wrapped Functions) لـ Firebase

// للحصول على مستند واحد
export async function getDoc(documentRef, useCache = true) {
    const path = documentRef.path;
    
    if (useCache) {
        const cachedData = cache.get(path);
        if (cachedData) {
            return {
                exists: () => true,
                data: () => cachedData
            };
        }
    }
    
    const docSnapshot = await firebaseGetDoc(documentRef);
    
    if (docSnapshot.exists() && useCache) {
        cache.set(path, docSnapshot.data());
    }
    
    return docSnapshot;
}

// للحصول على مجموعة مستندات
export async function getDocs(queryRef, useCache = true) {
    let cacheKey = queryRef._query.path.segments.join('/');
    
    // إضافة شروط الاستعلام لمفتاح الكاش
    if (queryRef._query.filters) {
        cacheKey += `?filters=${JSON.stringify(queryRef._query.filters)}`;
    }
    
    if (useCache) {
        const cachedData = cache.get(cacheKey);
        if (cachedData) {
            return {
                empty: false,
                docs: cachedData.docs,
                forEach: (callback) => cachedData.docs.forEach(callback)
            };
        }
    }
    
    const querySnapshot = await firebaseGetDocs(queryRef);
    
    if (!querySnapshot.empty && useCache) {
        const docsData = [];
        querySnapshot.forEach(doc => {
            docsData.push({
                id: doc.id,
                data: () => doc.data(),
                exists: () => true
            });
        });
        cache.set(cacheKey, { docs: docsData });
    }
    
    return querySnapshot;
}

// لحفظ مستند (ومسح الكاش ذي الصلة)
export async function setDoc(documentRef, data, options = {}) {
    const result = await firebaseSetDoc(documentRef, data, options);
    
    // مسح الكاش للمستند المحدث
    cache.invalidate(documentRef.path);
    
    // إذا كان هناك استعلامات متعلقة، مسحها أيضًا
    const collectionPath = documentRef.path.split('/')[0];
    cache.invalidate(collectionPath);
    
    return result;
}

// دوال مساعدة لإدارة الكاش
export function clearCache(pattern = null) {
    cache.invalidate(pattern);
}

export function getCacheStats() {
    return {
        size: Object.keys(cache.data).length,
        keys: Object.keys(cache.data)
    };
}

// إعادة تصدير الدوال الأخرى من Firebase دون تغيير
export { 
    doc, 
    collection, 
    query, 
    where, 
    Timestamp 
};