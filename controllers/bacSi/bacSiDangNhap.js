const con = require("../../config/connectDatabase");
const crypto = require("crypto");

// ======================================================
// CẤU HÌNH CSRF RIÊNG CHO FORM ĐĂNG NHẬP BÁC SĨ
// ======================================================

const CSRF_TOKEN_NAME = "bacSiLogin";

const getBacSiCsrfToken = (req) => {
    if (!req.session.csrfTokens) {
        req.session.csrfTokens = {};
    }

    if (!req.session.csrfTokens[CSRF_TOKEN_NAME]) {
        req.session.csrfTokens[CSRF_TOKEN_NAME] = crypto.randomBytes(32).toString("hex");
    }

    return req.session.csrfTokens[CSRF_TOKEN_NAME];
};

/**
 * Kiểm tra CSRF token.
 */
const validateBacSiCsrfToken = (req) => {
    const tokenFromForm = String(req.body._csrf || "");

    const tokenFromSession =
        req.session.csrfTokens?.[CSRF_TOKEN_NAME];

    if (!tokenFromForm || !tokenFromSession) {
        return false;
    }

    const formBuffer = Buffer.from(tokenFromForm);
    const sessionBuffer = Buffer.from(tokenFromSession);

    if (formBuffer.length !== sessionBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(
        formBuffer,
        sessionBuffer
    );
};

/**
 * Render lại trang đăng nhập bác sĩ.
 *
 * Luôn truyền csrfToken để form không bị mất token
 * sau khi username hoặc password không chính xác.
 */
const renderBacSiLogin = (
    req,
    res,
    {
        statusCode = 200,
        message = "",
        tenDangNhap = ""
    } = {}
) => {
    const csrfToken = getBacSiCsrfToken(req);

    return res.status(statusCode).render("bacSi/login", {
        message,
        csrfToken,
        tenDangNhap
    });
};

const bacSiDangNhap = {
    // ==================================================
    // [GET] /bacsi/login
    // ==================================================
    getLogin: (req, res) => {
        if (
            req.session.user &&
            req.session.user.vaiTro === "BacSi"
        ) {
            return res.redirect("/bacsi/tongQuan");
        }

        /*
            * Không tạo token mới ở mỗi lần tải trang.
            * Chỉ tạo nếu token bác sĩ chưa tồn tại trong session.
            */
        return renderBacSiLogin(req, res);
    },

    // ==================================================
    // [POST] /bacsi/login
    // ==================================================
    postLogin: async (req, res) => {
        try {
            const tenDangNhap = String(
                req.body.tenDangNhap || ""
            ).trim();

            const matKhau = String(
                req.body.matKhau || ""
            );

            // ------------------------------------------
            // 1. Kiểm tra CSRF token
            // ------------------------------------------
            if (!validateBacSiCsrfToken(req)) {
                /*
                    * Xóa token cũ và tạo token mới để người dùng
                    * có thể gửi lại form.
                    */
                if (!req.session.csrfTokens) {
                    req.session.csrfTokens = {};
                }

                delete req.session.csrfTokens[
                    CSRF_TOKEN_NAME
                ];

                return renderBacSiLogin(req, res, {
                    statusCode: 403,

                    message:
                        "Phiên xác thực đã hết hạn hoặc không hợp lệ. " +
                        "Vui lòng thử đăng nhập lại.",

                    tenDangNhap
                });
            }

            // ------------------------------------------
            // 2. Kiểm tra dữ liệu đầu vào
            // ------------------------------------------
            if (!tenDangNhap || !matKhau) {
                return renderBacSiLogin(req, res, {
                    statusCode: 400,

                    message:
                        "Lỗi: Vui lòng nhập đầy đủ tên đăng nhập " +
                        "và mật khẩu.",

                    tenDangNhap
                });
            }

            // ------------------------------------------
            // 3. Truy vấn tài khoản bác sĩ
            // ------------------------------------------
            const sql = `
            SELECT
                nd.*,
                ck.tenChuyenKhoa
            FROM NguoiDung nd
            LEFT JOIN BacSi bs
                ON nd.id = bs.id
            LEFT JOIN ChuyenKhoa ck
                ON bs.id_chuyenKhoa = ck.id_chuyenKhoa
            WHERE
                nd.tenDangNhap = ?
                AND nd.vaiTro = 'BacSi'
            LIMIT 1
        `;

            const [rows] = await con
                .promise()
                .query(sql, [tenDangNhap]);

            // ------------------------------------------
            // 4. Tài khoản không tồn tại
            // ------------------------------------------
            if (rows.length === 0) {
                return renderBacSiLogin(req, res, {
                    statusCode: 401,

                    message:
                        "Lỗi: Tên đăng nhập hoặc mật khẩu " +
                        "không chính xác.",

                    tenDangNhap
                });
            }

            const user = rows[0];

            // ------------------------------------------
            // 5. Mật khẩu không chính xác
            // ------------------------------------------
            if (user.matKhau !== matKhau) {
                return renderBacSiLogin(req, res, {
                    statusCode: 401,

                    message:
                        "Lỗi: Tên đăng nhập hoặc mật khẩu " +
                        "không chính xác.",

                    tenDangNhap
                });
            }

            // ------------------------------------------
            // 6. Đăng nhập thành công
            // ------------------------------------------

            /*
                * Lưu dữ liệu tạm trước khi regenerate session.
                */
            const bacSiSession = {
                id: user.id,
                hoTen: user.hoTen,
                vaiTro: user.vaiTro,

                tenChuyenKhoa:
                    user.tenChuyenKhoa ||
                    "Chưa phân khoa"
            };

            /*
                * Tạo session ID mới để chống Session Fixation.
                *
                * Lưu ý: regenerate sẽ xóa session khách hàng
                * đang tồn tại trong cùng trình duyệt.
                */
            return req.session.regenerate(
                (regenerateError) => {
                    if (regenerateError) {
                        console.error(
                            "Lỗi tạo session bác sĩ:",
                            regenerateError
                        );

                        return renderBacSiLogin(req, res, {
                            statusCode: 500,

                            message:
                                "Lỗi: Không thể tạo phiên đăng nhập, " +
                                "vui lòng thử lại.",

                            tenDangNhap
                        });
                    }

                    req.session.user = bacSiSession;

                    return req.session.save(
                        (saveError) => {
                            if (saveError) {
                                console.error(
                                    "Lỗi lưu session bác sĩ:",
                                    saveError
                                );

                                return res
                                    .status(500)
                                    .send(
                                        "Không thể lưu phiên đăng nhập."
                                    );
                            }

                            return res.redirect(
                                "/bacsi/tongQuan"
                            );
                        }
                    );
                }
            );
        } catch (error) {
            console.error(
                "Lỗi đăng nhập bác sĩ:",
                error
            );

            return renderBacSiLogin(req, res, {
                statusCode: 500,

                message:
                    "Lỗi: Hệ thống đang gặp sự cố, " +
                    "vui lòng thử lại sau.",

                tenDangNhap: String(
                    req.body.tenDangNhap || ""
                ).trim()
            });
        }
    },

    // ==================================================
    // [GET hoặc POST] /bacsi/logout
    // ==================================================
    logout: (req, res) => {
        req.session.destroy((error) => {
            if (error) {
                console.error(
                    "Lỗi khi đăng xuất:",
                    error
                );

                return res
                    .status(500)
                    .send("Không thể đăng xuất.");
            }

            res.clearCookie("connect.sid");

            return res.redirect("/bacsi/login");
        });
    }
};

module.exports = bacSiDangNhap;