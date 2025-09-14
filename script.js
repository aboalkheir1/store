// إعدادات Google Sheets API
const sheetId = "10m_9tTVdfT-03CbKhLErpL7dLaSbvqL6OvEa8Md8Y7I";
const apiKey = "AIzaSyA2sfEmgxR2pnjnMQEEMe9PpgsY1o4K50M";
const sheetName = "storage";

// متغيرات عامة
let currentFiles = [];
let isAuthenticated = false;
let isPremium = false;
let premiumExpiry = null;
let premiumStorageLimit = 250; 

// A secret key for AES encryption. This should be securely generated and managed.
const ENCRYPTION_SECRET_KEY = "YourSecretEncryptionKey123!"; // ⚠️ For production, use a more secure key management strategy.

// قيود التخزين
const STORAGE_LIMITS = {
    free: {
        total: 250, 
        pdf: 50
    },
    premium: {
        total: premiumStorageLimit,
        pdf: premiumStorageLimit
    }
};

// تحميل البيانات عند بدء التشغيل
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
});

function initializeApp() {
    const hasPassword = localStorage.getItem('mitiPassword');
    if (!hasPassword) {
        showSetPasswordModal();
        return;
    }

    checkPremiumStatus();
    updateUI();
}

function setupEventListeners() {
    const uploadArea = document.getElementById('uploadArea');
    
    uploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', function(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        handleFileUpload(files);
    });

    document.getElementById('fileInput').addEventListener('change', function(e) {
        handleFileUpload(e.target.files);
    });

    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('active');
        }
    });
}

// 🔐 وظائف المصادقة والتشفير 
function authenticateUser() {
    const password = document.getElementById('passwordInput').value;
    const storedPassword = localStorage.getItem('mitiPassword');
    
    if (password === storedPassword) {
        isAuthenticated = true;
        document.getElementById('authSection').classList.remove('active');
        document.getElementById('mainSection').classList.remove('hidden');
        loadFiles();
        updateUI();
        showNotification('تم تسجيل الدخول بنجاح', 'success');
    } else {
        showNotification('كلمة مرور خاطئة', 'error');
    }
}

function showSetPasswordModal() {
    document.getElementById('setPasswordModal').classList.add('active');
}

function setNewPassword() {
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (!newPassword || newPassword.length < 4) {
        showNotification('كلمة المرور يجب أن تكون 4 أحرف على الأقل', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showNotification('كلمات المرور غير متطابقة', 'error');
        return;
    }
    
    localStorage.setItem('mitiPassword', newPassword);
    closeModal('setPasswordModal');
    showNotification('تم تعيين كلمة المرور بنجاح', 'success');
    
    if (!isAuthenticated) {
        document.getElementById('authSection').classList.add('active');
    }
}

function showChangePasswordModal() {
    document.getElementById('changePasswordModal').classList.add('active');
}

function changePassword() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPasswordChange').value;
    const confirmPassword = document.getElementById('confirmPasswordChange').value;
    const storedPassword = localStorage.getItem('mitiPassword');
    
    if (!currentPassword) {
        showNotification('يرجى إدخال كلمة المرور الحالية', 'error');
        return;
    }
    
    if (currentPassword !== storedPassword) {
        showNotification('كلمة المرور الحالية خاطئة', 'error');
        return;
    }
    
    if (!newPassword || newPassword.length < 4) {
        showNotification('كلمة المرور الجديدة يجب أن تكون 4 أحرف على الأقل', 'error');
        return;
    }
    
    if (newPassword === currentPassword) {
        showNotification('كلمة المرور الجديدة يجب أن تكون مختلفة عن الحالية', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showNotification('كلمات المرور الجديدة غير متطابقة', 'error');
        return;
    }
    
    localStorage.setItem('mitiPassword', newPassword);
    
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPasswordChange').value = '';
    document.getElementById('confirmPasswordChange').value = '';
    
    closeModal('changePasswordModal');
    showNotification('تم تغيير كلمة المرور بنجاح', 'success');
}

function logout() {
    isAuthenticated = false;
    document.getElementById('authSection').classList.add('active');
    document.getElementById('mainSection').classList.add('hidden');
    document.getElementById('passwordInput').value = '';
}

// وظائف إدارة الملفات
function handleFileUpload(files) {
    if (!isAuthenticated) {
        showNotification('يجب تسجيل الدخول أولاً', 'error');
        return;
    }

    for (let file of files) {
        if (validateFile(file)) {
            uploadFile(file);
        }
    }
}

function validateFile(file) {
    if (!isPremium) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            showNotification('نوع الملف غير مدعوم. يُسمح بالصور وملفات PDF فقط للحسابات العادية', 'error');
            return false;
        }
    }

    const fileSizeMB = file.size / (1024 * 1024);
    const currentUsage = getCurrentUsage();
    const limits = isPremium ? STORAGE_LIMITS.premium : STORAGE_LIMITS.free;
    
    if (currentUsage.total + fileSizeMB > limits.total) {
        const limitText = isPremium ? `${limits.total} ميجابايت` : '250 ميجابايت';
        showNotification(`تجاوزت الحد الأقصى للمساحة المتاحة (${limitText})`, 'error');
        return false;
    }
    
    if (!isPremium && file.type === 'application/pdf') {
        if (currentUsage.pdf + fileSizeMB > limits.pdf) {
            showNotification('تجاوزت الحد الأقصى لملفات PDF (50 ميجابايت)', 'error');
            return false;
        }
    }
    return true;
}

function uploadFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const fileData = {
            id: Date.now() + Math.random(),
            name: file.name,
            type: file.type,
            size: file.size,
            data: e.target.result,
            uploadDate: new Date().toISOString()
        };
        
        currentFiles.push(fileData);
        saveFiles();
        updateUI();
        renderFiles();
        showNotification(`تم رفع ${file.name} بنجاح`, 'success');
    };
    reader.readAsDataURL(file);
}

function deleteFile(fileId) {
    if (confirm('هل أنت متأكد من حذف هذا الملف؟')) {
        currentFiles = currentFiles.filter(file => file.id !== fileId);
        saveFiles();
        updateUI();
        renderFiles();
        showNotification('تم حذف الملف بنجاح', 'success');
    }
}

function downloadFile(fileId) {
    const file = currentFiles.find(f => f.id === fileId);
    if (file) {
        const link = document.createElement('a');
        link.href = file.data;
        link.download = file.name;
        link.click();
    }
}

function previewFile(fileId) {
    const file = currentFiles.find(f => f.id === fileId);
    if (!file) return;
    
    const previewContent = document.getElementById('previewContent');
    
    if (file.type.startsWith('image/')) {
        previewContent.innerHTML = `
            <h3>${file.name}</h3>
            <img src="${file.data}" style="max-width: 100%; max-height: 70vh; object-fit: contain;">
        `;
    } else if (file.type === 'application/pdf') {
        previewContent.innerHTML = `
            <h3>${file.name}</h3>
            <embed src="${file.data}" type="application/pdf" width="100%" height="500px">
        `;
    }
    
    document.getElementById('previewModal').classList.add('active');
}

function clearAllFiles() {
    if (confirm('هل أنت متأكد من حذف جميع الملفات؟ هذا الإجراء لا يمكن التراجع عنه.')) {
        currentFiles = [];
        saveFiles();
        updateUI();
        renderFiles();
        showNotification('تم حذف جميع الملفات', 'success');
    }
}

// 🔐 وظائف التخزين المحلي المشفرة
function saveFiles() {
    const encryptedData = CryptoJS.AES.encrypt(JSON.stringify(currentFiles), ENCRYPTION_SECRET_KEY).toString();
    localStorage.setItem('mitiFiles', encryptedData);
}

function loadFiles() {
    const encryptedData = localStorage.getItem('mitiFiles');
    if (encryptedData) {
        try {
            const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_SECRET_KEY);
            const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
            currentFiles = JSON.parse(decryptedData);
            renderFiles();
        } catch (e) {
            console.error("Error decrypting files:", e);
            // In case of decryption error, clear invalid data
            localStorage.removeItem('mitiFiles');
            currentFiles = [];
            showNotification('حدث خطأ في قراءة البيانات، تم مسح الملفات التالفة.', 'error');
        }
    }
}

function getCurrentUsage() {
    let totalSize = 0;
    let pdfSize = 0;
    
    currentFiles.forEach(file => {
        const fileSizeMB = file.size / (1024 * 1024);
        totalSize += fileSizeMB;
        if (file.type === 'application/pdf') {
            pdfSize += fileSizeMB;
        }
    });
    
    return { total: totalSize, pdf: pdfSize };
}

// وظائف الترقية
function showUpgradeModal() {
    document.getElementById('upgradeModal').classList.add('active');
}

function requestUpgradeCode() {
    const message = encodeURIComponent('مرحباً، أريد طلب كود ترقية لـ iStorage');
    const whatsappUrl = `https://wa.me/201153184661?text=${message}`;
    window.open(whatsappUrl, '_blank');
}

async function validateUpgradeCode() {
    const code = document.getElementById('upgradeCode').value.trim();
    
    if (!code) {
        showNotification('يرجى إدخال كود الترقية', 'error');
        return;
    }

    const usedCodes = JSON.parse(localStorage.getItem('mitiUsedCodes') || '[]');
    if (usedCodes.includes(code)) {
        showNotification('هذا الكود تم استخدامه من قبل', 'error');
        return;
    }

    try {
        showNotification('جاري التحقق من الكود...', 'warning');
        
        const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetName}?key=${apiKey}`);
        const data = await response.json();
        
        if (!data.values) {
            showNotification('خطأ في الاتصال بالخادم', 'error');
            return;
        }

        const codeRow = data.values.find(row => row[0] === code);
        
        if (!codeRow) {
            showNotification('كود غير صحيح', 'error');
            return;
        }

        const [codeValue, validity, days, storageLimit] = codeRow;
        
        if (validity !== '1') {
            showNotification('هذا الكود غير صالح', 'error');
            return;
        }

        const daysCount = parseInt(days) || 30;
        const storageLimitMB = parseInt(storageLimit) || 500;
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + daysCount);
        
        localStorage.setItem('mitiPremium', 'true');
        localStorage.setItem('mitiPremiumExpiry', expiryDate.toISOString());
        localStorage.setItem('mitiPremiumStorage', storageLimit.toString());
        
        usedCodes.push(code);
        localStorage.setItem('mitiUsedCodes', JSON.stringify(usedCodes));
        
        isPremium = true;
        premiumExpiry = expiryDate;
        premiumStorageLimit = storageLimitMB;
        
        STORAGE_LIMITS.premium.total = premiumStorageLimit;
        STORAGE_LIMITS.premium.pdf = premiumStorageLimit;
        
        closeModal('upgradeModal');
        updateUI();
        showNotification(`تم تفعيل الاشتراك المميز حتى ${expiryDate.toLocaleDateString('ar-EG')} بمساحة ${storageLimitMB} ميجابايت`, 'success');
        
    } catch (error) {
        console.error('Error validating code:', error);
        showNotification('خطأ في الاتصال بالخادم', 'error');
    }
}

function checkPremiumStatus() {
    const premiumStatus = localStorage.getItem('mitiPremium');
    const premiumExpiryStr = localStorage.getItem('mitiPremiumExpiry');
    const premiumStorageStr = localStorage.getItem('mitiPremiumStorage');
    
    if (premiumStatus === 'true' && premiumExpiryStr) {
        const expiryDate = new Date(premiumExpiryStr);
        const now = new Date();
        
        if (now < expiryDate) {
            isPremium = true;
            premiumExpiry = expiryDate;
            premiumStorageLimit = parseInt(premiumStorageStr) || 500;
            
            STORAGE_LIMITS.premium.total = premiumStorageLimit;
            STORAGE_LIMITS.premium.pdf = premiumStorageLimit;
        } else {
            localStorage.removeItem('mitiPremium');
            localStorage.removeItem('mitiPremiumExpiry');
            localStorage.removeItem('mitiPremiumStorage');
            isPremium = false;
            premiumExpiry = null;
            premiumStorageLimit = 250;
            showNotification('انتهت صلاحية اشتراكك المميز', 'warning');
        }
    }
}

// وظائف واجهة المستخدم
function updateUI() {
    const usage = getCurrentUsage();
    const limits = isPremium ? STORAGE_LIMITS.premium : STORAGE_LIMITS.free;
    
    document.getElementById('usedSpace').textContent = `${usage.total.toFixed(1)} MB`;
    document.getElementById('totalSpace').textContent = `${limits.total} MB`;
    document.getElementById('fileCount').textContent = currentFiles.length;
    
    const progressPercent = (usage.total / limits.total) * 100;
    document.getElementById('storageProgress').style.width = `${Math.min(progressPercent, 100)}%`;
    
    const subscriptionType = document.getElementById('subscriptionType');
    const subscriptionExpiry = document.getElementById('subscriptionExpiry');
    
    if (isPremium) {
        subscriptionType.textContent = 'مميز (iPro)';
        subscriptionExpiry.textContent = `حتى ${premiumExpiry.toLocaleDateString('ar-EG')}`;
        document.getElementById('premiumSection').classList.add('hidden');
    } else {
        subscriptionType.textContent = 'عادي';
        subscriptionExpiry.textContent = '';
        document.getElementById('premiumSection').classList.remove('hidden');
    }
    
    updateUploadInterface();
}

function updateUploadInterface() {
    const uploadDescription = document.getElementById('uploadDescription');
    const fileInput = document.getElementById('fileInput');
    
    if (isPremium) {
        uploadDescription.textContent = 'يدعم جميع أنواع الملفات';
        fileInput.removeAttribute('accept');
    } else {
        uploadDescription.textContent = 'يدعم الصور وملفات PDF';
        fileInput.setAttribute('accept', 'image/*,.pdf');
    }
}

function renderFiles() {
    const filesGrid = document.getElementById('filesGrid');
    filesGrid.innerHTML = '';
    
    currentFiles.forEach(file => {
        const fileCard = createFileCard(file);
        filesGrid.appendChild(fileCard);
    });
}

function createFileCard(file) {
    const card = document.createElement('div');
    card.className = 'file-card';
    
    const fileIcon = getFileIcon(file.type);
    const fileSize = (file.size / (1024 * 1024)).toFixed(2);
    
    card.innerHTML = `
        <div class="file-icon">${fileIcon}</div>
        <div class="file-name">${file.name}</div>
        <div class="file-size">${fileSize} ميجابايت</div>
        <div class="file-actions">
            <button class="btn btn-small btn-secondary" onclick="previewFile(${file.id})">
                <i class="fas fa-eye"></i>
            </button>
            <button class="btn btn-small btn-primary" onclick="downloadFile(${file.id})">
                <i class="fas fa-download"></i>
            </button>
            <button class="btn btn-small btn-secondary" onclick="deleteFile(${file.id})">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    
    return card;
}

function getFileIcon(fileType) {
    if (fileType.startsWith('image/')) {
        return '<i class="fas fa-image" style="color: #4facfe;"></i>';
    } else if (fileType === 'application/pdf') {
        return '<i class="fas fa-file-pdf" style="color: #ff3b30;"></i>';
    } else if (fileType.includes('word') || fileType.includes('document')) {
        return '<i class="fas fa-file-word" style="color: #007aff;"></i>';
    } else if (fileType.includes('excel') || fileType.includes('spreadsheet')) {
        return '<i class="fas fa-file-excel" style="color: #34c759;"></i>';
    } else if (fileType.includes('powerpoint') || fileType.includes('presentation')) {
        return '<i class="fas fa-file-powerpoint" style="color: #ff9500;"></i>';
    } else if (fileType.startsWith('video/')) {
        return '<i class="fas fa-file-video" style="color: #ff3b30;"></i>';
    } else if (fileType.startsWith('audio/')) {
        return '<i class="fas fa-file-audio" style="color: #5856d6;"></i>';
    } else if (fileType.includes('zip') || fileType.includes('rar') || fileType.includes('archive')) {
        return '<i class="fas fa-file-archive" style="color: #ff9500;"></i>';
    } else if (fileType.startsWith('text/') || fileType.includes('plain')) {
        return '<i class="fas fa-file-alt" style="color: #8e8e93;"></i>';
    }
    return '<i class="fas fa-file" style="color: #c0c0c6;"></i>';
}

// وظائف مساعدة
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification show ${type}`;
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}
