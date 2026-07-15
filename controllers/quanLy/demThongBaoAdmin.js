const con = require('../../config/connectDatabase');

// Tạo hàm query dùng Promise từ biến con
const query = async (sql, params = []) => {
    const [rows] = await con.promise().query(sql, params);
    return rows;
};

const demThongBaoAdmin = async (req, res, next) => {
    if (req.session.user && req.session.user.vaiTro === 'NguoiQuanLy') {
        try {
            const adminId = req.session.user.id;
            
            // ĐÃ SỬA: id_nguoiNhan -> id_nguoiDung | daDoc -> trangThaiDoc
            const sql = `SELECT COUNT(*) as soLuong FROM ThongBao WHERE id_nguoiDung = ? AND trangThaiDoc = FALSE`;
            const [rows] = await con.promise().query(sql, [adminId]);
            
            res.locals.soThongBaoChuaDoc = rows[0].soLuong; 
        } catch (error) {
            console.error("Lỗi đếm thông báo:", error);
            res.locals.soThongBaoChuaDoc = 0;
        }
    } else {
        res.locals.soThongBaoChuaDoc = 0;
    }
    next();
};

module.exports = demThongBaoAdmin;