const con = require('../../config/connectDatabase');
const escapeHtml = require('escape-html');
const crypto = require('crypto');

// Tạo hàm query dùng Promise từ biến con
const query = async (sql, params = []) => {
    const [rows] = await con.promise().query(sql, params);
    return rows;
};

const getLogin = (req, res) => {
    // 1. Tạo token và lưu vào session
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");

    // 2. Render giao diện và truyền ĐẦY ĐỦ các biến sang EJS
    res.render('khachHang/taiKhoan/login', {
        page: 'login',
        msg: req.query.msg || "",
        type: req.query.msg ? "success" : "",
        csrfToken: req.session.csrfToken
    });
};

const postLogin = async (req, res) => {
    try {
        if (req.body._csrf !== req.session.csrfToken) {
            return res.status(403).send("CSRF detected");
        }
        const { username, password } = req.body;

        if (!username || !password) {
            return res.render('khachHang/taiKhoan/login', {
                page: 'login',
                msg: "Vui lòng nhập đầy đủ thông tin",
                type: "error"
            });
        }

        const rows = await query(
            `SELECT id, tenDangNhap, matKhau, hoTen, vaiTro
             FROM NguoiDung
             WHERE tenDangNhap = ?
             AND vaiTro = 'KhachHang'
             LIMIT 1`,
            [username]
        );

        if (rows.length === 0) {
            return res.render('khachHang/taiKhoan/login', {
                page: 'login',
                msg: "Sai tên đăng nhập hoặc mật khẩu",
                type: "error",
                csrfToken: req.session.csrfToken
            });
        }

        const user = rows[0];

        if (user.matKhau !== password) {
            return res.render('khachHang/taiKhoan/login', {
                page: 'login',
                msg: "Sai tên đăng nhập hoặc mật khẩu",
                type: "error",
                csrfToken: req.session.csrfToken
            });
        }

        req.session.user = {
            id: user.id,
            name: user.hoTen,
            username: user.tenDangNhap,
            vaiTro: user.vaiTro
        };

        const redirectUrl = req.session.returnTo || '/trangchu';
        delete req.session.returnTo;

        req.session.save((err) => {
            if (err) {
                console.error("Lỗi lưu session:", err);
            }
            res.redirect(redirectUrl);
        });

    } catch (err) {
        console.error(err);
        res.render('khachHang/taiKhoan/login', {
            page: 'login',
            msg: "Lỗi server",
            type: "error",
            csrfToken: req.session.csrfToken
        });
    }
};

const logout = (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.send("Lỗi logout");
        }

        res.clearCookie('connect.sid');
        res.redirect('/trangchu');
    });
};

const getTaoTaiKhoan = (req, res) => {
    // 1. Tạo token và lưu vào session
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
    res.render('khachHang/taiKhoan/taoTaiKhoan', { page: 'taoTaiKhoan' });
};


const postTaoTaiKhoan = async (req, res) => {
    if (req.body._csrf !== req.session.csrfToken) {
        return res.status(403).send("CSRF detected");
    }
    try {
        const {
            hoTen,
            username,
            password,
            soDienThoai,
            email,
            ngaySinh,
            gioiTinh,
            diaChi
        } = req.body;

        const safeUsername = escapeHtml(username);
        const safeHoTen = escapeHtml(hoTen);
        const safeDiaChi = escapeHtml(diaChi);


        const check = await query(
            "SELECT id FROM NguoiDung WHERE tenDangNhap = ?",
            [safeUsername]
        );

        if (check.length > 0) {
            return res.render('khachHang/taiKhoan/taoTaiKhoan', {
                msg: "Tên đăng nhập đã tồn tại!",
                type: "error",
                page: 'taoTaiKhoan'
            });
        }

        // Kiểm tra ngày sinh
        if (ngaySinh) {
            const inputDate = new Date(ngaySinh);
            const today = new Date();

            // Đặt mốc thời gian của ngày hôm nay về 00:00:00 để so sánh chính xác theo ngày
            today.setHours(0, 0, 0, 0);
            // 2. Kiểm tra ngày nhập vào có lớn hơn hoặc bằng ngày hôm nay không
            if (isNaN(inputDate.getTime()) || inputDate >= today) {
                return res.render('khachHang/taiKhoan/taoTaiKhoan', {
                    msg: "Ngày sinh không hợp lệ! Ngày sinh phải là một ngày trong quá khứ.",
                    page: 'taoTaiKhoan'
                });
            }
        }

        // Kiểm tra email có tồn tại chưa
        // Định nghĩa khuôn mẫu của email hợp lệ 
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(email)) {
            return res.render('khachHang/taiKhoan/taoTaiKhoan', {
                msg: "Email không đúng định dạng! Vui lòng kiểm tra lại.",
                page: 'taoTaiKhoan'
            });
        }

        // Kiểm tra số điện thoại hợp lệ (10 số của Việt Nam)
        const phoneRegex = /^0[35789]\d{8}$/;

        if (!phoneRegex.test(soDienThoai)) {
            return res.render('khachHang/taiKhoan/taoTaiKhoan', {
                msg: "Số điện thoại không đúng định dạng! Vui lòng nhập số điện thoại 10 số hợp lệ.",
                page: 'taoTaiKhoan'
            });
        }

        const checkEmail = await query(
            "SELECT id FROM NguoiDung WHERE email = ?",
            [email]
        );

        if (checkEmail.length > 0) {
            return res.render('khachHang/taiKhoan/taoTaiKhoan', {
                msg: "Email này đã được sử dụng. Vui lòng chọn email khác!",
                page: 'taoTaiKhoan'
            });
        }

        const result = await query(
            `INSERT INTO NguoiDung
            (tenDangNhap, matKhau, vaiTro, hoTen, soDienThoai, email)
            VALUES (?, ?, 'KhachHang', ?, ?, ?)`,
            [safeUsername, password, safeHoTen, soDienThoai, email]
        );

        const newId = result.insertId;

        await query(
            `INSERT INTO KhachHang
            (id, ngaySinh, gioiTinh, diaChi)
            VALUES (?, ?, ?, ?)`,
            [newId, ngaySinh || null, gioiTinh, safeDiaChi]
        );

        const thongBao = encodeURIComponent('Tạo tài khoản thành công');
        res.redirect(`/login?msg=${thongBao}`);

    } catch (err) {
        console.error(err);
        res.render('khachHang/taiKhoan/taoTaiKhoan', {
            msg: err.message,
            page: 'taoTaiKhoan'
        });
    }
};

module.exports = {
    getLogin,
    postLogin,
    logout,
    getTaoTaiKhoan,
    postTaoTaiKhoan
};