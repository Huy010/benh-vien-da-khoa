const con = require('../../config/connectDatabase');

// Tạo hàm query dùng Promise từ biến con
const query = async (sql, params = []) => {
    const [rows] = await con.promise().query(sql, params);
    return rows;
};

const demThongBaoBacSi = async (req, res, next) => {
    // Kiểm tra xem Bác sĩ đã đăng nhập chưa
    if (req.session.user && req.session.user.vaiTro === 'BacSi') {
        try {
            const bacSiId = req.session.user.id;
            const sql = `SELECT COUNT(*) as soLuong FROM ThongBao WHERE id_nguoiDung = ? AND trangThaiDoc = FALSE`;
            const [rows] = await con.promise().query(sql, [bacSiId]);
            
            // Lưu vào biến locals để hiển thị ngay khi render (không bị trễ)
            res.locals.soThongBaoChuaDoc = rows[0].soLuong; 
        } catch (error) {
            console.error("Lỗi đếm thông báo bác sĩ:", error);
            res.locals.soThongBaoChuaDoc = 0;
        }
    } else {
        res.locals.soThongBaoChuaDoc = 0;
    }
    next();
};

module.exports = demThongBaoBacSi;