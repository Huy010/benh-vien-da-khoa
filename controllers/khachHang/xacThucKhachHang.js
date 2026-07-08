function kiemTraDangNhap(req, res, next) {
    // 1. Kiểm tra xem đã đăng nhập chưa
    if (!req.session || !req.session.user) {
        // Lưu lại trang user đang muốn vào để sau khi login xong trả về lại đúng trang đó
        req.session.returnTo = req.originalUrl;
        
        // Dùng req.session.save() để đảm bảo session được ghi xong xuôi rồi mới chuyển hướng
        return req.session.save(() => {
            res.redirect('/login');
        });
    }

    // 2. Tùy chọn nâng cao: Đảm bảo chỉ có role Khách Hàng mới được dùng các chức năng này
    if (req.session.user.vaiTro !== 'KhachHang') {
        // Nếu là Bác sĩ/Admin đang dùng chung trình duyệt, có thể cho văng ra login luôn
        return res.redirect('/login'); 
    }

    // Nếu qua được các bước trên thì cho phép đi tiếp
    next();
}

module.exports = { kiemTraDangNhap };
