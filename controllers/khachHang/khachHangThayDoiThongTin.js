const con = require('../../config/connectDatabase');
const moment = require('moment');

const khachHangThayDoiThongTin = {
    // [GET] Render trang thay đổi thông tin
    getThayDoiThongTin: async (req, res) => {
        try {
            if (!req.session.user) {
                return res.redirect('/login');
            }

            const userId = req.session.user.id;

            const sql = `
                SELECT 
                    nd.id, 
                    nd.hoTen, 
                    nd.soDienThoai, 
                    nd.email,
                    kh.ngaySinh, 
                    kh.gioiTinh, 
                    kh.diaChi, 
                    kh.tienSuBenhLy, 
                    kh.nhomMau
                FROM NguoiDung nd
                LEFT JOIN KhachHang kh ON nd.id = kh.id
                WHERE nd.id = ? AND nd.vaiTro = 'KhachHang'
            `;

            const [rows] = await con.promise().query(sql, [userId]);

            if (rows.length === 0) {
                return res.status(404).send("Không tìm thấy thông tin người dùng.");
            }

            const user = rows[0];

            // Format ngày sinh để hiển thị theo dạng ngày/tháng/năm
            if (user.ngaySinh) {
                user.ngaySinh = moment(user.ngaySinh).format('DD/MM/YYYY');
            }

            res.render('khachHang/taiKhoan/thayDoiThongTin', {
                page: 'thayDoiThongTin',
                user: user,
                status: req.query.status || '',
                msg: req.query.msg || ''
            });

        } catch (error) {
            console.error("Lỗi khi lấy thông tin khách hàng:", error);
            res.status(500).send("Lỗi Server. Vui lòng thử lại sau.");
        }
    },

    // [POST] Xử lý khi người dùng nhấn "Lưu thay đổi"
    postCapNhatThongTin: async (req, res) => {
        try {
            if (!req.session.user) {
                return res.redirect('/login');
            }

            const userId = req.session.user.id;

            const {
                hoTen,
                soDienThoai,
                email,
                ngaySinh,
                gioiTinh,
                nhomMau,
                diaChi,
                tienSuBenhLy
            } = req.body;

            // Kiểm tra dữ liệu bắt buộc
            if (!hoTen || !soDienThoai) {
                return res.redirect('/thayDoiThongTin?status=error&msg=' + encodeURIComponent('Vui lòng nhập đầy đủ họ tên và số điện thoại.'));
            }

            // Kiểm tra số điện thoại Việt Nam
            const phoneRegex = /^0[35789]\d{8}$/;
            if (!phoneRegex.test(soDienThoai)) {
                return res.redirect('/thayDoiThongTin?status=error&msg=' + encodeURIComponent('Số điện thoại không hợp lệ. Vui lòng nhập số điện thoại 10 số.'));
            }

            // Kiểm tra email nếu có nhập
            let safeEmail = null;
            if (email && email.trim() !== '') {
                const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

                if (!emailRegex.test(email)) {
                    return res.redirect('/thayDoiThongTin?status=error&msg=' + encodeURIComponent('Email không đúng định dạng.'));
                }

                safeEmail = email.trim();
            }

            // Chuyển ngày sinh từ DD/MM/YYYY sang YYYY-MM-DD để lưu database
            let safeNgaySinh = null;

            if (ngaySinh && ngaySinh.trim() !== '') {
                const parsedDate = moment(ngaySinh.trim(), 'DD/MM/YYYY', true);

                if (!parsedDate.isValid()) {
                    return res.redirect('/thayDoiThongTin?status=error&msg=' + encodeURIComponent('Ngày sinh không hợp lệ. Vui lòng nhập theo định dạng dd/mm/yyyy.'));
                }

                const today = moment().startOf('day');

                if (parsedDate.isSameOrAfter(today)) {
                    return res.redirect('/thayDoiThongTin?status=error&msg=' + encodeURIComponent('Ngày sinh phải là một ngày trong quá khứ.'));
                }

                safeNgaySinh = parsedDate.format('YYYY-MM-DD');
            }

            const safeGioiTinh = gioiTinh && gioiTinh.trim() !== '' ? gioiTinh : null;
            const safeNhomMau = nhomMau && nhomMau.trim() !== '' ? nhomMau : null;
            const safeDiaChi = diaChi && diaChi.trim() !== '' ? diaChi.trim() : null;
            const safeTienSuBenhLy = tienSuBenhLy && tienSuBenhLy.trim() !== '' ? tienSuBenhLy.trim() : null;

            // 1. Cập nhật bảng NguoiDung
            const sqlNguoiDung = `
                UPDATE NguoiDung 
                SET hoTen = ?, soDienThoai = ?, email = ?
                WHERE id = ? AND vaiTro = 'KhachHang'
            `;

            await con.promise().query(sqlNguoiDung, [
                hoTen.trim(),
                soDienThoai.trim(),
                safeEmail,
                userId
            ]);

            // 2. Cập nhật hoặc thêm mới bảng KhachHang
            const sqlKhachHang = `
                INSERT INTO KhachHang 
                    (id, ngaySinh, gioiTinh, diaChi, tienSuBenhLy, nhomMau)
                VALUES 
                    (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                    ngaySinh = VALUES(ngaySinh),
                    gioiTinh = VALUES(gioiTinh),
                    diaChi = VALUES(diaChi),
                    tienSuBenhLy = VALUES(tienSuBenhLy),
                    nhomMau = VALUES(nhomMau)
            `;

            await con.promise().query(sqlKhachHang, [
                userId,
                safeNgaySinh,
                safeGioiTinh,
                safeDiaChi,
                safeTienSuBenhLy,
                safeNhomMau
            ]);

            // Cập nhật lại session để header hiển thị tên mới
            if (req.session.user) {
                req.session.user.hoTen = hoTen.trim();
                req.session.user.name = hoTen.trim();
            }

            return res.redirect('/thayDoiThongTin?status=success&msg=' + encodeURIComponent('Cập nhật thông tin thành công!'));

        } catch (error) {
            console.error("Lỗi khi cập nhật thông tin:", error);

            if (error.code === 'ER_DUP_ENTRY') {
                return res.redirect('/thayDoiThongTin?status=error&msg=' + encodeURIComponent('Số điện thoại hoặc Email này đã được sử dụng bởi người khác!'));
            }

            return res.redirect('/thayDoiThongTin?status=error&msg=' + encodeURIComponent('Có lỗi xảy ra trong quá trình cập nhật.'));
        }
    }
};

module.exports = khachHangThayDoiThongTin;