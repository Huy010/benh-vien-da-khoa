// Khai báo hàm middleware
const kiemTraDangNhapBacSi = (req, res, next) => {
    // Kiểm tra xem đã có session và vai trò đúng là Bác sĩ chưa
    if (req.session.user && req.session.user.vaiTro === 'BacSi') {
        next(); // Nếu đúng chuẩn Bác sĩ -> Cho phép đi tiếp vào trang
    } else {
        // Nếu chưa đăng nhập hoặc là Khách hàng/Quản lý -> Đuổi về trang login Bác sĩ
        res.redirect('/bacsi/login'); 
    }
};

// Export nó ra dưới dạng object để bên router có thể dùng cú pháp const { ... } = require(...)
module.exports = { kiemTraDangNhapBacSi };