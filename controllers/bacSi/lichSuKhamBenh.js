const con = require('../../config/connectDatabase');

// Tạo hàm query dùng Promise từ biến con
const query = async (sql, params = []) => {
    const [rows] = await con.promise().query(sql, params);
    return rows;
};

const lichSuKhamBenh = {
    getLichSuKhamBenh: async (req, res) => {
        try {
            // Kiểm tra phiên đăng nhập để tránh lỗi req.session.user.id
            if (!req.session || !req.session.user) {
                return res.redirect('/bacsi/login');
            }

            const idBacSi = req.session.user.id;

            const limit = 10;

            let currentPage = parseInt(req.query.page, 10) || 1;

            if (currentPage < 1) {
                currentPage = 1;
            }

            const offset = (currentPage - 1) * limit;

            /*
             * selectedDateDisplay:
             * Dùng để hiển thị trên giao diện theo dạng dd/mm/yyyy.
             *
             * selectedDateSql:
             * Dùng để truy vấn TiDB/MySQL theo dạng yyyy-mm-dd.
             */
            const selectedDateDisplay = req.query.ngay
                ? String(req.query.ngay).trim()
                : '';

            let selectedDateSql = '';

            if (selectedDateDisplay) {
                const parts = selectedDateDisplay.split('/');

                // Trường hợp ngày gửi lên có dạng dd/mm/yyyy
                if (parts.length === 3) {
                    const day = parts[0].padStart(2, '0');
                    const month = parts[1].padStart(2, '0');
                    const year = parts[2];

                    selectedDateSql = `${year}-${month}-${day}`;
                } else {
                    // Trường hợp dự phòng: ngày đã có dạng yyyy-mm-dd
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

            // Đếm tổng số lịch đã khám
            const countSql = `
                SELECT COUNT(*) AS total
                FROM LichHen lh
                INNER JOIN CaKham ck
                    ON lh.id_caKham = ck.id_caKham
                INNER JOIN KhachHang kh
                    ON lh.id_khachHang = kh.id
                INNER JOIN NguoiDung nd
                    ON kh.id = nd.id
                INNER JOIN ChuyenKhoa c
                    ON lh.id_chuyenKhoa = c.id_chuyenKhoa
                ${whereSql}
            `;

            const countRows = await query(countSql, params);

            const totalItems = Number(countRows[0]?.total || 0);
            const totalPages = Math.ceil(totalItems / limit);

            // Lấy danh sách lịch đã khám
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
                INNER JOIN CaKham ck
                    ON lh.id_caKham = ck.id_caKham
                INNER JOIN KhachHang kh
                    ON lh.id_khachHang = kh.id
                INNER JOIN NguoiDung nd
                    ON kh.id = nd.id
                INNER JOIN ChuyenKhoa c
                    ON lh.id_chuyenKhoa = c.id_chuyenKhoa
                ${whereSql}
                ORDER BY ck.ngay DESC, lh.gioHen DESC
                LIMIT ? OFFSET ?
            `;

            const dataParams = [
                ...params,
                Number(limit),
                Number(offset)
            ];

            const lichDaKham = await query(sql, dataParams);

            /*
             * QUAN TRỌNG:
             * Thư mục thật là views/bacSi nên phải ghi đúng "bacSi".
             * Render chạy Linux và phân biệt chữ hoa, chữ thường.
             */
            return res.render('bacSi/lichSuKhamBenh', {
                page: 'lichSuKhamBenh',
                user: req.session.user,
                lichDaKham,
                selectedDate: selectedDateDisplay,
                currentPage,
                totalPages
            });

        } catch (error) {
            console.error('Lỗi tải lịch sử khám bệnh:', error);

            return res.status(500).send('Lỗi tải lịch sử khám bệnh');
        }
    }
};

module.exports = lichSuKhamBenh;