// File: utils/security.js

// Danh sách các tên miền mà server của bạn được phép kết nối đến
// Ví dụ: API của Google, cổng thanh toán, hoặc API nội bộ an toàn
const ALLOWED_DOMAINS = [
    'api.stripe.com',
    'maps.googleapis.com',
    'api.gemini.google.com',
    'hooks.slack.com'
];

/**
 * Hàm kiểm tra URL xem có an toàn (nằm trong Whitelist) hay không
 * @param {string} userInputUrl - URL do người dùng cung cấp
 * @returns {boolean} - true nếu an toàn, false nếu không an toàn
 */
function isSafeUrl(userInputUrl) {
    try {
        // Sử dụng class URL có sẵn của Node.js để phân tích URL
        const parsedUrl = new URL(userInputUrl);

        // 1. Chỉ cho phép giao thức HTTP và HTTPS (ngăn chặn file://, gopher://, ftp://)
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            return false;
        }

        // 2. Kiểm tra tên miền (hostname) có nằm trong Whitelist không
        if (!ALLOWED_DOMAINS.includes(parsedUrl.hostname)) {
            return false;
        }

        return true;
    } catch (error) {
        // Bắt lỗi nếu URL sai định dạng (ví dụ người dùng nhập "not-a-url")
        return false;
    }
}

module.exports = { isSafeUrl };