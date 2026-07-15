const con = require('../../config/connectDatabase');

// Tạo hàm query dùng Promise từ biến con
const query = async (sql, params = []) => {
    const [rows] = await con.promise().query(sql, params);
    return rows;
};

const bacSiDangNhap = {
    // [GET] /bacsi/login
    getLogin: (req, res) => {
        if (req.session.user && req.session.user.vaiTro === 'BacSi') {
            return res.redirect('/bacsi/tongQuan'); 
        }
        res.render('bacSi/login', { message: '' });
    },

    // [POST] /bacsi/login
    postLogin: async (req, res) => {
        try {
            const { tenDangNhap, matKhau } = req.body;

            // SỬA CÂU SQL Ở ĐÂY: Kết nối 3 bảng để lấy Tên Chuyên Khoa
            const sql = `
                SELECT nd.*, ck.tenChuyenKhoa 
                FROM NguoiDung nd
                LEFT JOIN BacSi bs ON nd.id = bs.id
                LEFT JOIN ChuyenKhoa ck ON bs.id_chuyenKhoa = ck.id_chuyenKhoa
                WHERE nd.tenDangNhap = ? AND nd.vaiTro = 'BacSi'
            `;
            const [rows] = await con.promise().query(sql, [tenDangNhap]);

            if (rows.length === 0) {
                return res.render('bacSi/login', { message: 'Lỗi: Tài khoản không tồn tại hoặc bạn không có quyền truy cập cổng Bác sĩ!' });
            }

            const user = rows[0];

            if (user.matKhau !== matKhau) {
                return res.render('bacSi/login', { message: 'Lỗi: Mật khẩu không chính xác!' });
            }

            // Đăng nhập thành công - LƯU THÊM TÊN CHUYÊN KHOA VÀO SESSION
            req.session.user = {
                id: user.id,
                hoTen: user.hoTen,
                vaiTro: user.vaiTro,
                tenChuyenKhoa: user.tenChuyenKhoa || 'Chưa phân khoa'
            };

            return res.redirect('/bacsi/tongQuan'); 

        } catch (error) {
            console.error("Lỗi đăng nhập bác sĩ:", error);
            return res.render('bacSi/login', { message: 'Lỗi: Hệ thống đang gặp sự cố, vui lòng thử lại sau.' });
        }
    },
    
    logout: (req, res) => {
        req.session.destroy((err) => {
            if (err) console.error("Lỗi khi đăng xuất:", err);
            res.redirect('/bacsi/login');
        });
    }
};

module.exports = bacSiDangNhap;