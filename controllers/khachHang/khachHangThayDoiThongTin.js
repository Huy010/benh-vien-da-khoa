const con = require('../../config/connectDatabase');
const moment = require('moment');
const crypto = require('crypto');

const khachHangThayDoiThongTin = {
    // [GET] Render trang thay đổi thông tin
    getThayDoiThongTin: async (req, res) => {
        try {
            // Kiểm tra người dùng đã đăng nhập hay chưa
            if (!req.session.user) {
                return res.redirect('/login');
            }

            // Tạo CSRF token mới và lưu vào session
            req.session.csrfToken = crypto
                .randomBytes(32)
                .toString('hex');

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
                LEFT JOIN KhachHang kh
                    ON nd.id = kh.id
                WHERE nd.id = ?
                    AND nd.vaiTro = 'KhachHang'
            `;

            const [rows] = await con
                .promise()
                .query(sql, [userId]);

            if (rows.length === 0) {
                return res
                    .status(404)
                    .send('Không tìm thấy thông tin người dùng.');
            }

            const profile = rows[0];

            /*
             * Input type="date" yêu cầu value có dạng YYYY-MM-DD.
             * Ví dụ: 2003-08-15.
             */
            if (profile.ngaySinh) {
                profile.ngaySinh = moment(profile.ngaySinh).format(
                    'YYYY-MM-DD'
                );
            }

            return res.render(
                'khachHang/taiKhoan/thayDoiThongTin',
                {
                    page: 'thayDoiThongTin',

                    // profile dùng để hiển thị dữ liệu trong form
                    profile: profile,

                    status: req.query.status || '',
                    msg: req.query.msg || '',

                    csrfToken: req.session.csrfToken
                }
            );
        } catch (error) {
            console.error(
                'Lỗi khi lấy thông tin khách hàng:',
                error
            );

            return res
                .status(500)
                .send('Lỗi Server. Vui lòng thử lại sau.');
        }
    },

    // [POST] Xử lý khi người dùng nhấn "Lưu thay đổi"
    postCapNhatThongTin: async (req, res) => {
        try {
            // Kiểm tra đăng nhập
            if (!req.session.user) {
                return res.redirect('/login');
            }

            // Kiểm tra CSRF token
            if (
                !req.body._csrf ||
                req.body._csrf !== req.session.csrfToken
            ) {
                return res
                    .status(403)
                    .send('CSRF detected');
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
            if (
                !hoTen ||
                hoTen.trim() === '' ||
                !soDienThoai ||
                soDienThoai.trim() === ''
            ) {
                return res.redirect(
                    '/thayDoiThongTin?status=error&msg=' +
                    encodeURIComponent(
                        'Vui lòng nhập đầy đủ họ tên và số điện thoại.'
                    )
                );
            }

            const safeHoTen = hoTen.trim();
            const safeSoDienThoai = soDienThoai.trim();

            // Kiểm tra số điện thoại Việt Nam
            const phoneRegex = /^0[35789]\d{8}$/;

            if (!phoneRegex.test(safeSoDienThoai)) {
                return res.redirect(
                    '/thayDoiThongTin?status=error&msg=' +
                    encodeURIComponent(
                        'Số điện thoại không hợp lệ. Vui lòng nhập số điện thoại Việt Nam 10 số.'
                    )
                );
            }

            // Kiểm tra email nếu người dùng có nhập
            let safeEmail = null;

            if (email && email.trim() !== '') {
                const emailRegex =
                    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

                if (!emailRegex.test(email.trim())) {
                    return res.redirect(
                        '/thayDoiThongTin?status=error&msg=' +
                        encodeURIComponent(
                            'Email không đúng định dạng.'
                        )
                    );
                }

                safeEmail = email.trim();
            }

            /*
             * Input type="date" gửi ngày theo dạng YYYY-MM-DD.
             * Không còn nhận dạng DD/MM/YYYY như trước.
             */
            let safeNgaySinh = null;

            if (ngaySinh && ngaySinh.trim() !== '') {
                const parsedDate = moment(
                    ngaySinh.trim(),
                    'YYYY-MM-DD',
                    true
                );

                if (!parsedDate.isValid()) {
                    return res.redirect(
                        '/thayDoiThongTin?status=error&msg=' +
                        encodeURIComponent(
                            'Ngày sinh không hợp lệ.'
                        )
                    );
                }

                const today = moment().startOf('day');

                if (parsedDate.isSameOrAfter(today)) {
                    return res.redirect(
                        '/thayDoiThongTin?status=error&msg=' +
                        encodeURIComponent(
                            'Ngày sinh phải là một ngày trong quá khứ.'
                        )
                    );
                }

                safeNgaySinh = parsedDate.format('YYYY-MM-DD');
            }

            // Kiểm tra giá trị giới tính hợp lệ
            const danhSachGioiTinh = [
                'Nam',
                'Nu',
                'Khac'
            ];

            let safeGioiTinh = null;

            if (
                gioiTinh &&
                danhSachGioiTinh.includes(gioiTinh.trim())
            ) {
                safeGioiTinh = gioiTinh.trim();
            }

            // Kiểm tra giá trị nhóm máu hợp lệ
            const danhSachNhomMau = [
                'A',
                'B',
                'AB',
                'O'
            ];

            let safeNhomMau = null;

            if (
                nhomMau &&
                danhSachNhomMau.includes(nhomMau.trim())
            ) {
                safeNhomMau = nhomMau.trim();
            }

            const safeDiaChi =
                diaChi && diaChi.trim() !== ''
                    ? diaChi.trim()
                    : null;

            const safeTienSuBenhLy =
                tienSuBenhLy && tienSuBenhLy.trim() !== ''
                    ? tienSuBenhLy.trim()
                    : null;

            // Cập nhật bảng NguoiDung
            const sqlNguoiDung = `
                UPDATE NguoiDung
                SET
                    hoTen = ?,
                    soDienThoai = ?,
                    email = ?
                WHERE id = ?
                    AND vaiTro = 'KhachHang'
            `;

            const [nguoiDungResult] = await con
                .promise()
                .query(
                    sqlNguoiDung,
                    [
                        safeHoTen,
                        safeSoDienThoai,
                        safeEmail,
                        userId
                    ]
                );

            if (nguoiDungResult.affectedRows === 0) {
                return res.redirect(
                    '/thayDoiThongTin?status=error&msg=' +
                    encodeURIComponent(
                        'Không tìm thấy tài khoản khách hàng cần cập nhật.'
                    )
                );
            }

            // Cập nhật hoặc thêm mới thông tin bảng KhachHang
            const sqlKhachHang = `
                INSERT INTO KhachHang
                    (
                        id,
                        ngaySinh,
                        gioiTinh,
                        diaChi,
                        tienSuBenhLy,
                        nhomMau
                    )
                VALUES
                    (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    ngaySinh = VALUES(ngaySinh),
                    gioiTinh = VALUES(gioiTinh),
                    diaChi = VALUES(diaChi),
                    tienSuBenhLy = VALUES(tienSuBenhLy),
                    nhomMau = VALUES(nhomMau)
            `;

            await con
                .promise()
                .query(
                    sqlKhachHang,
                    [
                        userId,
                        safeNgaySinh,
                        safeGioiTinh,
                        safeDiaChi,
                        safeTienSuBenhLy,
                        safeNhomMau
                    ]
                );

            // Cập nhật lại session để header hiển thị tên mới
            req.session.user.hoTen = safeHoTen;
            req.session.user.name = safeHoTen;

            /*
             * Lưu session trước khi redirect để tránh trường hợp
             * tên mới chưa kịp cập nhật trên môi trường Render.
             */
            return req.session.save((sessionError) => {
                if (sessionError) {
                    console.error(
                        'Lỗi khi lưu session:',
                        sessionError
                    );

                    return res.redirect(
                        '/thayDoiThongTin?status=error&msg=' +
                        encodeURIComponent(
                            'Đã cập nhật thông tin nhưng không thể cập nhật phiên đăng nhập.'
                        )
                    );
                }

                return res.redirect(
                    '/thayDoiThongTin?status=success&msg=' +
                    encodeURIComponent(
                        'Cập nhật thông tin thành công!'
                    )
                );
            });
        } catch (error) {
            console.error(
                'Lỗi khi cập nhật thông tin:',
                error
            );

            if (error.code === 'ER_DUP_ENTRY') {
                return res.redirect(
                    '/thayDoiThongTin?status=error&msg=' +
                    encodeURIComponent(
                        'Số điện thoại hoặc Email này đã được sử dụng bởi người khác!'
                    )
                );
            }

            return res.redirect(
                '/thayDoiThongTin?status=error&msg=' +
                encodeURIComponent(
                    'Có lỗi xảy ra trong quá trình cập nhật.'
                )
            );
        }
    }
};

module.exports = khachHangThayDoiThongTin;