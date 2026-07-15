// Kết nối database
const con = require('../../config/connectDatabase');

// Tạo hàm query dùng Promise từ biến con
const query = async (sql, params = []) => {
    const [rows] = await con.promise().query(sql, params);
    return rows;
};

// 1. Hàm hiển thị form (GET)
const getLoginAdmin = (req, res) => {
    res.render('admin/login', { message: '' });
};

const postLoginAdmin = (req, res) => {
    const tenDangNhap = req.body.username;
    const matKhau = req.body.password;
    
    con.connect(function(err){
        if(err) throw err;
        const sql = "SELECT * FROM NguoiDung WHERE tenDangNhap = ? AND matKhau = ? AND vaiTro = 'NguoiQuanLy'";
        
        con.query(sql, [tenDangNhap, matKhau], function(err, result){
            if(err) throw err;
            
            if(result.length > 0){
                req.session.user = result[0];                 
                // Đăng nhập thành công -> Chuyển hướng
                res.redirect('/admin/trangchu');
            } else {
                // Trả về lỗi chung chung để bảo mật
                res.render('admin/login', {message: "Sai tên đăng nhập, mật khẩu hoặc bạn không có quyền truy cập!"});
            }
        });
    });
};;

// Hàm hiển thị trang Dashboard
const getDashboard = (req, res) => {
    // 1. Kiểm tra xem người dùng đã đăng nhập (có session) chưa
    if (!req.session.user) {
        // Nếu chưa đăng nhập mà cố tình vào URL dashboard -> Đuổi về trang login
        return res.redirect('/admin/login'); 
    }

    // 2. Lấy tên từ session
    const tenNguoiDung = req.session.user.hoTen; // Lấy cột tên đăng nhập

    // 3. Render trang và truyền biến tenAdmin sang EJS
    res.render('admin/dashboard', { 
        tenAdmin: tenNguoiDung 
    });
};

// 3. Hàm xử lý Đăng xuất
const getLogoutAdmin = (req, res) => {
    // Gọi hàm destroy() để xóa toàn bộ dữ liệu session của người dùng này
    req.session.destroy((err) => {
        if (err) {
            console.error("Lỗi khi hủy session đăng xuất:", err);
            return res.redirect('/admin/trangChu');
        }
        
        // (Tùy chọn) Xóa luôn cookie lưu ID của session trên trình duyệt cho chắc chắn
        res.clearCookie('connect.sid'); 
        
        // Xóa xong xuôi thì mới đẩy về trang Đăng nhập
        res.redirect('/admin/login');
    });
};

const kiemTraDangNhap = (req, res, next) => {
    // Nếu đã có thông tin user trong session -> Cho phép đi tiếp (next)
    if (req.session.user && req.session.user.vaiTro === 'NguoiQuanLy') {
        return next();
    }
    
    // Nếu chưa có session -> Đẩy về trang đăng nhập
    res.redirect('/admin/login');
};

// --- QUAN TRỌNG NHẤT: PHẢI CÓ DÒNG NÀY ---
module.exports = {
    getLoginAdmin,
    postLoginAdmin,
    getDashboard,   
    getLogoutAdmin,
    kiemTraDangNhap 
};