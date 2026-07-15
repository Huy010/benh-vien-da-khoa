const con = require('../../config/connectDatabase');

// Tạo hàm query dùng Promise từ biến con
const query = async (sql, params = []) => {
    const [rows] = await con.promise().query(sql, params);
    return rows;
};

const lichSuKhamBenh = {
    getLichSuKhamBenh: async (req, res) => {
        try {
            const idBacSi = req.session.user.id;

            const limit = 10;
            let currentPage = parseInt(req.query.page) || 1;
            if (currentPage < 1) currentPage = 1;

            const offset = (currentPage - 1) * limit;

            // selectedDateDisplay: dùng để hiển thị lại trên giao diện theo dạng dd/mm/yyyy
            // selectedDateSql: dùng để query MySQL theo dạng yyyy-mm-dd
            const selectedDateDisplay = req.query.ngay || '';
            let selectedDateSql = '';

            if (selectedDateDisplay) {
                const parts = selectedDateDisplay.split('/');

                // Nếu ngày gửi lên là dạng dd/mm/yyyy
                if (parts.length === 3) {
                    const day = parts[0];
                    const month = parts[1];
                    const year = parts[2];

                    selectedDateSql = `${year}-${month}-${day}`;
                } else {
                    // Trường hợp dự phòng nếu ngày gửi lên đã là yyyy-mm-dd
                    selectedDateSql = selectedDateDisplay;
                }
            }

            let whereSql = `
                WHERE ck.id_bacSi = ?
                AND lh.trangThai = 'HoanThanh'
            `;

            const params = [idBacSi];

            if (selectedDateSql) {
                whereSql += ` AND ck.ngay = ?`;
                params.push(selectedDateSql);
            }

            const countSql = `
                SELECT COUNT(*) AS total
                FROM LichHen lh
                INNER JOIN CaKham ck ON lh.id_caKham = ck.id_caKham
                INNER JOIN KhachHang kh ON lh.id_khachHang = kh.id
                INNER JOIN NguoiDung nd ON kh.id = nd.id
                INNER JOIN ChuyenKhoa c ON lh.id_chuyenKhoa = c.id_chuyenKhoa
                ${whereSql}
            `;

            const [countRows] = await con.promise().query(countSql, params);
            const totalItems = countRows[0].total;
            const totalPages = Math.ceil(totalItems / limit);

            const sql = `
                SELECT 
                    lh.id_lichHen,
                    lh.gioHen,
                    TIME_FORMAT(lh.gioHen, '%H:%i') AS gioHenStr,
                    lh.loaiKham,
                    lh.donGia,
                    lh.trangThai,
                    lh.trangThaiThanhToan,
                    lh.ghiChu,

                    ck.id_caKham,
                    ck.ngay,
                    DATE_FORMAT(ck.ngay, '%d/%m/%Y') AS ngayKhamStr,

                    nd.hoTen AS tenKhachHang,
                    nd.soDienThoai,
                    nd.email,

                    kh.ngaySinh,
                    kh.gioiTinh,
                    kh.diaChi,
                    kh.tienSuBenhLy,
                    kh.nhomMau,

                    c.tenChuyenKhoa
                FROM LichHen lh
                INNER JOIN CaKham ck ON lh.id_caKham = ck.id_caKham
                INNER JOIN KhachHang kh ON lh.id_khachHang = kh.id
                INNER JOIN NguoiDung nd ON kh.id = nd.id
                INNER JOIN ChuyenKhoa c ON lh.id_chuyenKhoa = c.id_chuyenKhoa
                ${whereSql}
                ORDER BY ck.ngay DESC, lh.gioHen DESC
                LIMIT ? OFFSET ?
            `;

            const dataParams = [...params, Number(limit), Number(offset)];
            const [lichDaKham] = await con.promise().query(sql, dataParams);

            res.render('bacsi/lichSuKhamBenh', {
                page: 'lichSuKhamBenh',
                user: req.session.user,
                lichDaKham,
                selectedDate: selectedDateDisplay,
                currentPage,
                totalPages
            });

        } catch (error) {
            console.error("Lỗi tải lịch sử khám bệnh:", error);
            res.status(500).send("Lỗi tải lịch sử khám bệnh");
        }
    }
};

module.exports = lichSuKhamBenh;