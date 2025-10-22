// cache-manager.js
class CacheManager {
    constructor() {
        this.cache = {
            users: {},
            shifts: {},
            appointments: {},
            services: {},
            // أضف المزيد حسب احتياجاتك
        };
        
        this.expiryTime = 5 * 60 * 1000; // 5 دقائق
        this.lastCleanup = Date.now();
        this.cleanupInterval = 2 * 60 * 1000; // تنظيف كل دقيقتين
        this.startAutoCleanup();
    }

    // تنظيف تلقائي دوري
    startAutoCleanup() {
        setInterval(() => {
            this.cleanup();
        }, this.cleanupInterval);
    }

    // تنظيف الكاش القديم
    cleanup() {
        const now = Date.now();
        Object.keys(this.cache).forEach(collection => {
            Object.keys(this.cache[collection]).forEach(key => {
                if (now - this.cache[collection][key].timestamp > this.expiryTime) {
                    delete this.cache[collection][key];
                }
            });
        });
        this.lastCleanup = now;
    }

    // إضافة بيانات للكاش
    set(collection, key, data) {
        if (!this.cache[collection]) {
            this.cache[collection] = {};
        }
        
        this.cache[collection][key] = {
            data: JSON.parse(JSON.stringify(data)), // Deep copy
            timestamp: Date.now()
        };
        
        return true;
    }

    // جلب بيانات من الكاش
    get(collection, key) {
        if (!this.cache[collection] || !this.cache[collection][key]) {
            return null;
        }

        const item = this.cache[collection][key];
        if (Date.now() - item.timestamp > this.expiryTime) {
            delete this.cache[collection][key];
            return null;
        }

        return JSON.parse(JSON.stringify(item.data)); // Deep copy
    }

    // مسح عنصر من الكاش
    invalidate(collection, key = null) {
        if (!this.cache[collection]) return;

        if (key) {
            delete this.cache[collection][key];
        } else {
            this.cache[collection] = {};
        }
    }

    // مسح الكاش كله
    clearAll() {
        Object.keys(this.cache).forEach(collection => {
            this.cache[collection] = {};
        });
    }

    // الحصول على إحصائيات الكاش
    getStats() {
        const stats = {};
        Object.keys(this.cache).forEach(collection => {
            stats[collection] = Object.keys(this.cache[collection]).length;
        });
        return stats;
    }
}

// إنشاء نسخة وحيدة من الكاش (Singleton)
const cacheManager = new CacheManager();
export default cacheManager;