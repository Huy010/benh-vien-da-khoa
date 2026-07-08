const { con, query } = require('../../config/connectDatabase');

const khamBenh = {
    getKhamBenh: async (req, res) => {
        try {
            const bacSiId = req.session.user.id;
            const today = new Date();
            const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            const displayDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
            const caKhamHienTai = "Tất cả các ca trong ngày (07:00 - 17:00)";

            const sqlCaKham = `SELECT id_caKham FROM CaKham WHERE id_bacSi = ? AND ngay = ?`;
            const [caKhamRows] = await con.promise().query(sqlCaKham, [bacSiId, dateStr]);

            let danhSachCho = [];

            if (caKhamRows.length > 0) {
                const idCaKham = caKhamRows[0].id_caKham;
                
                const sqlLichHen = `
                    SELECT 
                        lh.id_lichHen, lh.gioHen,
                        nd.hoTen, kh.gioiTinh, kh.ngaySinh
                    FROM LichHen lh
                    JOIN KhachHang kh ON lh.id_khachHang = kh.id
                    JOIN NguoiDung nd ON kh.id = nd.id
                    WHERE lh.id_caKham = ? 
                    AND lh.trangThai = 'ChoDuyet' 
                    AND lh.trangThaiThanhToan = 'DaThanhToan'
                    ORDER BY lh.gioHen ASC, lh.id_lichHen ASC
                `;
                const [lichHenRows] = await con.promise().query(sqlLichHen, [idCaKham]);
                
                danhSachCho = lichHenRows.map((row, index) => {
                    const birthYear = new Date(row.ngaySinh).getFullYear();
                    return {
                        id_lichHen: row.id_lichHen,
                        stt: index + 1,
                        hoTen: row.hoTen,
                        gioHen: row.gioHen.substring(0, 5),
                        gioiTinh: row.gioiTinh,
                        tuoi: today.getFullYear() - birthYear
                    };
                });
            }

            res.render('bacSi/khamBenh', {
                user: req.session.user,
                page: 'khamBenh',
                todayStr: displayDate,
                caKhamHienTai: caKhamHienTai,
                danhSachCho: danhSachCho 
            });

        } catch (error) {
            console.error("Lỗi trang khám bệnh:", error);
            res.status(500).send("Đã xảy ra lỗi khi tải danh sách khám.");
        }
    },

    getDanhSachChoAPI: async (req, res) => {
        try {
            const bacSiId = req.session.user.id;
            const today = new Date();
            const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

            const sqlCaKham = `SELECT id_caKham FROM CaKham WHERE id_bacSi = ? AND ngay = ?`;
            const [caKhamRows] = await con.promise().query(sqlCaKham, [bacSiId, dateStr]);

            let danhSachCho = [];

            if (caKhamRows.length > 0) {
                const idCaKham = caKhamRows[0].id_caKham;
                
                const sqlLichHen = `
                    SELECT 
                        lh.id_lichHen, lh.gioHen,
                        nd.hoTen, kh.gioiTinh, kh.ngaySinh
                    FROM LichHen lh
                    JOIN KhachHang kh ON lh.id_khachHang = kh.id
                    JOIN NguoiDung nd ON kh.id = nd.id
                    WHERE lh.id_caKham = ? 
                    AND lh.trangThai = 'ChoDuyet' 
                    AND lh.trangThaiThanhToan = 'DaThanhToan'
                    ORDER BY lh.gioHen ASC, lh.id_lichHen ASC
                `;
                const [lichHenRows] = await con.promise().query(sqlLichHen, [idCaKham]);
                
                danhSachCho = lichHenRows.map((row, index) => {
                    const birthYear = new Date(row.ngaySinh).getFullYear();
                    return {
                        id_lichHen: row.id_lichHen,
                        stt: index + 1,
                        hoTen: row.hoTen,
                        gioHen: row.gioHen.substring(0, 5),
                        gioiTinh: row.gioiTinh,
                        tuoi: today.getFullYear() - birthYear
                    };
                });
            }
            res.json({ success: true, data: danhSachCho });
        } catch (error) {
            res.json({ success: false, msg: "Lỗi server" });
        }
    },

    tuDongHuy: async (req, res) => {
        try {
            const { ids } = req.body;
            if (!ids || ids.length === 0) return res.json({ success: true });

            const placeholders = ids.map(() => '?').join(',');
            const sql = `UPDATE LichHen SET trangThai = 'DenTre' WHERE id_lichHen IN (${placeholders})`;
            
            await con.promise().query(sql, ids);
            res.json({ success: true, msg: 'Đã cập nhật đến trễ' });
        } catch (error) {
            console.error("Lỗi tự động cập nhật đến trễ:", error);
            res.json({ success: false, msg: 'Lỗi server' });
        }
    }
};

// ============================================================================
// JOB CHẠY NGẦM TRÊN SERVER: QUÉT VÀ CẬP NHẬT LỊCH ĐẾN TRỄ
// Tính năng: Quét các lịch đã quá hạn (qua 17h30 của ngày khám, hoặc của các ngày trước đó)
// ============================================================================
setInterval(async () => {
    try {
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;

        // Quét tất cả các lịch chưa khám:
        // 1. Ngày khám nhỏ hơn ngày hôm nay (hôm qua, hôm kia...) -> auto trễ
        // 2. Ngày khám bằng ngày hôm nay VÀ giờ hiện tại >= 17:30 -> auto trễ
        const sqlUpdate = `
            UPDATE LichHen lh
            JOIN CaKham ck ON lh.id_caKham = ck.id_caKham
            SET lh.trangThai = 'DenTre'
            WHERE lh.trangThai = 'ChoDuyet'
            AND (
                ck.ngay < ? 
                OR (ck.ngay = ? AND ? >= '17:30:00')
            )
        `;
        
        const [result] = await con.promise().query(sqlUpdate, [todayStr, todayStr, timeStr]);
        
        if (result.affectedRows > 0) {
             console.log(`Đã tự động dọn dẹp ${result.affectedRows} lịch hẹn đã qua 17h30 thành "Đến trễ".`);
        }

    } catch (error) {
        console.error("Lỗi Cronjob tự động cập nhật đến trễ:", error);
    }
}, 60000); // Quét mỗi phút 1 lần

module.exports = khamBenh;