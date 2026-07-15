const con = require('../../config/connectDatabase');

// Tạo hàm query dùng Promise từ biến con
const query = async (sql, params = []) => {
    const [rows] = await con.promise().query(sql, params);
    return rows;
};
const moment = require('moment'); // Dùng để format ngày sinh

const khachHangThayDoiThongTin = {
    // [GET] Render trang thay đổi thông tin
    getThayDoiThongTin: async (req, res) => {
        try {
            const userId = req.session.user.id; 

            const sql = `
                SELECT 
                    nd.id, nd.hoTen, nd.soDienThoai, nd.email,
                    kh.ngaySinh, kh.gioiTinh, kh.diaChi, kh.tienSuBenhLy, kh.nhomMau
                FROM NguoiDung nd
                LEFT JOIN KhachHang kh ON nd.id = kh.id
                WHERE nd.id = ? AND nd.vaiTro = 'KhachHang'
            `;

            const [rows] = await con.promise().query(sql, [userId]);

            if (rows.length === 0) {
                return res.status(404).send("Không tìm thấy thông tin người dùng.");
            }

            let user = rows[0];
            user.name = user.hoTen;

            if (user.ngaySinh) {
                user.ngaySinh = moment(user.ngaySinh).format('YYYY-MM-DD');
            }

            const success_msg = req.flash ? req.flash('success_msg') : '';
            const error_msg = req.flash ? req.flash('error_msg') : '';

            res.render('khachHang/taiKhoan/thayDoiThongTin', { 
                user: user,
                success_msg: success_msg,
                error_msg: error_msg
            });

        } catch (error) {
            console.error("Lỗi khi lấy thông tin khách hàng:", error);
            res.status(500).send("Lỗi Server. Vui lòng thử lại sau.");
        }
    },

    // [POST] Xử lý khi người dùng nhấn "Lưu thay đổi"
    postCapNhatThongTin: async (req, res) => {
        try {
            const userId = req.session.user.id;
            
            // Lấy dữ liệu từ form gửi lên
            const { hoTen, soDienThoai, email, ngaySinh, gioiTinh, nhomMau, diaChi, tienSuBenhLy } = req.body;

            // Xử lý các giá trị rỗng (tránh lỗi khi insert vào DB)
            const safeEmail = email ? email : null;
            const safeNgaySinh = ngaySinh ? ngaySinh : null;
            const safeGioiTinh = gioiTinh ? gioiTinh : null;
            const safeNhomMau = nhomMau ? nhomMau : null;

            // 1. Cập nhật bảng NguoiDung
            const sqlNguoiDung = `
                UPDATE NguoiDung 
                SET hoTen = ?, soDienThoai = ?, email = ?
                WHERE id = ? AND vaiTro = 'KhachHang'
            `;
            await con.promise().query(sqlNguoiDung, [hoTen, soDienThoai, safeEmail, userId]);

            // 2. Cập nhật (hoặc Thêm mới) bảng KhachHang
            const sqlKhachHang = `
                INSERT INTO KhachHang (id, ngaySinh, gioiTinh, diaChi, tienSuBenhLy, nhomMau)
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                    ngaySinh = VALUES(ngaySinh),
                    gioiTinh = VALUES(gioiTinh),
                    diaChi = VALUES(diaChi),
                    tienSuBenhLy = VALUES(tienSuBenhLy),
                    nhomMau = VALUES(nhomMau)
            `;
            await con.promise().query(sqlKhachHang, [userId, safeNgaySinh, safeGioiTinh, diaChi, tienSuBenhLy, safeNhomMau]);

            // Cập nhật lại session (để Header hiển thị đúng tên mới ngay lập tức)
            if (req.session.user) {
                req.session.user.hoTen = hoTen;
            }

            // Gửi thông báo thành công
            if (req.flash) {
                req.flash('success_msg', 'Cập nhật thông tin thành công!');
            }

            // Trở về trang GET thông tin (bạn đang dùng /thayDoiThongTin làm URL trang thông tin)
            return res.redirect('/thayDoiThongTin');

        } catch (error) {
            console.error("Lỗi khi cập nhật thông tin:", error);

            // Xử lý riêng lỗi trùng Số điện thoại hoặc Email (ER_DUP_ENTRY)
            if (error.code === 'ER_DUP_ENTRY') {
                if (req.flash) {
                    req.flash('error_msg', 'Số điện thoại hoặc Email này đã được sử dụng bởi người khác!');
                    return res.redirect('/thayDoiThongTin');
                }
            }

            if (req.flash) {
                req.flash('error_msg', 'Có lỗi xảy ra trong quá trình cập nhật.');
                return res.redirect('/thayDoiThongTin');
            }

            res.status(500).send("Lỗi Server. Vui lòng thử lại sau.");
        }
    }
};

module.exports = khachHangThayDoiThongTin;