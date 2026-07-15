const con = require('../../config/connectDatabase');

// Tạo hàm query dùng Promise từ biến con
const query = async (sql, params = []) => {
    const [rows] = await con.promise().query(sql, params);
    return rows;
};

const chanDoan = {
    getChanDoan: async (req, res) => {
        try {
            const idLichHen = req.params.id;

            const sqlLichHen = `
                SELECT 
                    lh.*, 
                    nd.hoTen, 
                    nd.soDienThoai,
                    kh.diaChi, 
                    kh.gioiTinh, 
                    kh.ngaySinh, 
                    kh.id AS id_khachHang,
                    ck.tenChuyenKhoa, 
                    ca.ngay AS ngayKham
                FROM LichHen lh
                JOIN KhachHang kh ON lh.id_khachHang = kh.id
                JOIN NguoiDung nd ON kh.id = nd.id
                LEFT JOIN ChuyenKhoa ck ON lh.id_chuyenKhoa = ck.id_chuyenKhoa
                LEFT JOIN CaKham ca ON lh.id_caKham = ca.id_caKham
                WHERE lh.id_lichHen = ?
            `;

            const [lichHenRows] = await con.promise().query(sqlLichHen, [idLichHen]);

            if (lichHenRows.length === 0) {
                return res.status(404).send("Không tìm thấy lịch hẹn hoặc đã bị xóa.");
            }

            const patientInfo = lichHenRows[0];

            if (patientInfo.ngaySinh) {
                const birthDate = new Date(patientInfo.ngaySinh);
                const today = new Date();

                let age = today.getFullYear() - birthDate.getFullYear();
                const monthDiff = today.getMonth() - birthDate.getMonth();

                if (
                    monthDiff < 0 ||
                    (monthDiff === 0 && today.getDate() < birthDate.getDate())
                ) {
                    age--;
                }

                patientInfo.tuoi = age;
            } else {
                patientInfo.tuoi = 'Chưa rõ';
            }

            const sqlLichSu = `
                SELECT 
                    lh.id_lichHen,
                    lh.ghiChu,
                    lh.trangThai,
                    lh.gioHen,
                    ck.tenChuyenKhoa,
                    ca.ngay AS ngayKham
                FROM LichHen lh
                JOIN CaKham ca ON lh.id_caKham = ca.id_caKham
                LEFT JOIN ChuyenKhoa ck ON lh.id_chuyenKhoa = ck.id_chuyenKhoa
                WHERE lh.id_khachHang = ?
                  AND lh.trangThai = 'HoanThanh'
                  AND lh.id_lichHen != ?
                ORDER BY ca.ngay DESC, lh.gioHen DESC
            `;

            const [lichSuKham] = await con.promise().query(sqlLichSu, [
                patientInfo.id_khachHang,
                idLichHen
            ]);

            res.render('bacSi/chanDoan', {
                user: req.session.user,
                page: 'khamBenh',
                patient: patientInfo,
                lichSu: lichSuKham
            });

        } catch (error) {
            console.error("Lỗi trang chẩn đoán:", error);
            res.status(500).send("Lỗi server khi lấy thông tin khám bệnh.");
        }
    },

    postHoanThanhKham: async (req, res) => {
        try {
            const idLichHen = req.params.id;
            const { ghiChuBacSi } = req.body;

            const sqlUpdate = `
                UPDATE LichHen 
                SET ghiChu = ?, trangThai = 'HoanThanh' 
                WHERE id_lichHen = ?
            `;

            await con.promise().query(sqlUpdate, [ghiChuBacSi, idLichHen]);

            res.redirect('/bacsi/khamBenh');

        } catch (error) {
            console.error("Lỗi khi hoàn thành khám bệnh:", error);
            res.status(500).send("Lỗi server khi lưu kết quả khám.");
        }
    }
};

module.exports = chanDoan;