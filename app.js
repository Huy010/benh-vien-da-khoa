// Đọc biến môi trường trước khi sử dụng
require('dotenv').config();

const express = require('express');
const path = require('path');
const multer = require('multer');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const crypto = require('crypto');

const app = express();

const isProduction =
    process.env.NODE_ENV === 'production';

/*
 * Kiểm tra biến môi trường quan trọng.
 */
if (!process.env.SESSION_SECRET) {
    throw new Error(
        'Thiếu biến môi trường SESSION_SECRET. ' +
        'Hãy thêm SESSION_SECRET vào file .env và Render.'
    );
}

/*
 * Render chạy phía sau reverse proxy.
 * Cần đặt trước express-session để Express nhận biết HTTPS.
 */
app.set('trust proxy', 1);

/*
 * Không để Express tiết lộ công nghệ đang sử dụng
 * qua header X-Powered-By.
 */
app.disable('x-powered-by');

/*
 * =====================================================
 * TẠO CSP NONCE CHO MỖI PHẢN HỒI
 * =====================================================
 *
 * Mỗi lần người dùng tải một trang, server tạo
 * một nonce ngẫu nhiên mới.
 *
 * Sử dụng trong EJS:
 *
 * <script nonce="<%= cspNonce %>">
 *     // JavaScript nội tuyến
 * </script>
 *
 * <style nonce="<%= cspNonce %>">
 *     // CSS nội tuyến
 * </style>
 */
app.use((req, res, next) => {
    res.locals.cspNonce = crypto
        .randomBytes(32)
        .toString('base64');

    next();
});

/*
 * =====================================================
 * CẤU HÌNH HTTP SECURITY HEADERS
 * =====================================================
 *
 * Các thư viện Bootstrap, Font Awesome, SweetAlert2,
 * MapLibre, Polyline, Chart.js, Flatpickr, html2canvas
 * và Axios được phục vụ từ chính website qua /vendor.
 */
app.use(
    helmet({
        contentSecurityPolicy: {
            useDefaults: true,

            directives: {
                /*
                 * Mặc định chỉ cho phép tài nguyên
                 * từ chính website.
                 */
                defaultSrc: [
                    "'self'"
                ],

                /*
                 * JavaScript chỉ được phép chạy khi:
                 *
                 * 1. File được tải từ chính website.
                 * 2. Thẻ <script> nội tuyến có nonce hợp lệ.
                 *
                 * Không còn 'unsafe-inline'.
                 */
                scriptSrc: [
                    "'self'",

                    (req, res) =>
                        `'nonce-${res.locals.cspNonce}'`
                ],

                /*
                 * Chặn JavaScript trong thuộc tính HTML:
                 *
                 * onclick=""
                 * onchange=""
                 * onsubmit=""
                 * onload=""
                 */
                scriptSrcAttr: [
                    "'none'"
                ],

                /*
                 * CSS chỉ được phép khi:
                 *
                 * 1. File CSS được tải từ chính website.
                 * 2. Thẻ <style> có nonce hợp lệ.
                 *
                 * Không còn 'unsafe-inline'.
                 */
                styleSrc: [
                    "'self'",

                    (req, res) =>
                        `'nonce-${res.locals.cspNonce}'`
                ],

                /*
                 * Áp dụng riêng cho:
                 *
                 * <style>...</style>
                 * <link rel="stylesheet">
                 */
                styleSrcElem: [
                    "'self'",

                    (req, res) =>
                        `'nonce-${res.locals.cspNonce}'`
                ],

                /*
                 * Chặn thuộc tính:
                 *
                 * style="..."
                 *
                 * Các thuộc tính style phải được
                 * chuyển thành class CSS.
                 */
                styleSrcAttr: [
                    "'none'"
                ],

                /*
                 * Cho phép font nội bộ và font data.
                 */
                fontSrc: [
                    "'self'",
                    'data:'
                ],

                /*
                 * Cho phép ảnh nội bộ, data, blob
                 * và ảnh bản đồ Goong.
                 */
                imgSrc: [
                    "'self'",
                    'data:',
                    'blob:',
                    'https://tiles.goong.io'
                ],

                /*
                 * Cho phép JavaScript kết nối tới:
                 *
                 * - Chính website.
                 * - Dữ liệu bản đồ Goong.
                 * - Goong REST API.
                 */
                connectSrc: [
                    "'self'",
                    'https://tiles.goong.io',
                    'https://rsapi.goong.io'
                ],

                /*
                 * MapLibre có thể tạo Web Worker
                 * bằng địa chỉ blob.
                 */
                workerSrc: [
                    "'self'",
                    'blob:'
                ],

                /*
                 * Không cho sử dụng object, embed,
                 * applet hoặc plugin cũ.
                 */
                objectSrc: [
                    "'none'"
                ],

                /*
                 * Thẻ <base> chỉ được phép trỏ
                 * về chính website.
                 */
                baseUri: [
                    "'self'"
                ],

                /*
                 * Form chỉ được gửi dữ liệu
                 * về chính website.
                 */
                formAction: [
                    "'self'"
                ],

                /*
                 * Không cho website khác nhúng
                 * trang bằng iframe.
                 */
                frameAncestors: [
                    "'none'"
                ],

                /*
                 * Production:
                 * tự nâng tài nguyên HTTP lên HTTPS.
                 *
                 * Localhost:
                 * tắt để không ảnh hưởng phát triển.
                 */
                upgradeInsecureRequests:
                    isProduction
                        ? []
                        : null
            }
        },

        /*
         * Chỉ bật HSTS trên Render production.
         */
        strictTransportSecurity:
            isProduction
                ? {
                      maxAge: 31536000,
                      includeSubDomains: true,
                      preload: false
                  }
                : false
    })
);

/*
 * =====================================================
 * ĐỌC DỮ LIỆU REQUEST
 * =====================================================
 */

/*
 * Đọc dữ liệu JSON.
 * Giới hạn tối đa 1 MB.
 */
app.use(
    express.json({
        limit: '1mb'
    })
);

/*
 * Đọc dữ liệu form POST.
 * Giới hạn tối đa 1 MB.
 */
app.use(
    express.urlencoded({
        extended: true,
        limit: '1mb'
    })
);

/*
 * =====================================================
 * CẤU HÌNH SESSION
 * =====================================================
 */
app.use(
    session({
        /*
         * Tên cookie chứa session ID.
         */
        name: 'connect.sid',

        secret: process.env.SESSION_SECRET,

        /*
         * Tin tưởng thông tin HTTPS từ
         * Render hoặc Cloudflare.
         */
        proxy: true,

        resave: false,
        saveUninitialized: false,

        cookie: {
            /*
             * JavaScript phía trình duyệt
             * không được đọc cookie.
             */
            httpOnly: true,

            /*
             * Production dùng HTTPS.
             * Localhost dùng HTTP.
             */
            secure: isProduction,

            /*
             * Hạn chế gửi cookie trong
             * một số yêu cầu cross-site.
             */
            sameSite: 'lax',

            path: '/',

            /*
             * Session tồn tại tối đa 7 ngày.
             */
            maxAge:
                1000 *
                60 *
                60 *
                24 *
                7
        }
    })
);

/*
 * =====================================================
 * KHÔNG CACHE CÁC TRANG NHẠY CẢM
 * =====================================================
 */
const noCachePaths = new Set([
    '/login',
    '/logout',
    '/admin/login',
    '/bacSi/login',
    '/bacsi/login',
    '/khachHangTaoTaiKhoan',
    '/thayDoiThongTin',
    '/capNhatThongTin'
]);

app.use((req, res, next) => {
    if (noCachePaths.has(req.path)) {
        res.setHeader(
            'Cache-Control',
            'no-store, no-cache, must-revalidate, private'
        );

        res.setHeader(
            'Pragma',
            'no-cache'
        );

        res.setHeader(
            'Expires',
            '0'
        );

        res.setHeader(
            'Surrogate-Control',
            'no-store'
        );
    }

    next();
});

/*
 * =====================================================
 * CHỐNG CLICKJACKING
 * =====================================================
 *
 * CSP đã có frame-ancestors 'none'.
 * Header này được giữ để hỗ trợ trình duyệt cũ.
 */
app.use((req, res, next) => {
    res.setHeader(
        'X-Frame-Options',
        'DENY'
    );

    next();
});

/*
 * =====================================================
 * GIỚI HẠN SỐ LƯỢNG REQUEST
 * =====================================================
 */
const limiter = rateLimit({
    /*
     * Khoảng thời gian 15 phút.
     */
    windowMs:
        15 *
        60 *
        1000,

    /*
     * Tối đa 10.000 request
     * trong 15 phút.
     */
    max: 10000,

    message:
        'Bạn gửi quá nhiều yêu cầu, ' +
        'vui lòng thử lại sau.',

    standardHeaders: true,
    legacyHeaders: false
});

app.use(limiter);

/*
 * =====================================================
 * CẤU HÌNH MULTER
 * =====================================================
 */

/*
 * Lưu file tải lên trong bộ nhớ.
 */
const storage =
    multer.memoryStorage();

/*
 * Giới hạn kích thước file là 5 MB.
 */
const upload = multer({
    storage,

    limits: {
        fileSize:
            5 *
            1024 *
            1024
    }
});

/*
 * Cho phép controller hoặc route khác
 * truy cập cấu hình Multer qua:
 *
 * req.app.locals.upload
 */
app.locals.upload = upload;

/*
 * =====================================================
 * BIẾN DÙNG CHUNG CHO EJS
 * =====================================================
 */
app.use((req, res, next) => {
    res.locals.user =
        req.session.user ||
        null;

    res.locals.page = '';

    /*
     * cspNonce đã được tạo ở middleware
     * phía trên và nằm trong res.locals.
     */

    next();
});

/*
 * =====================================================
 * CẤU HÌNH VIEW ENGINE
 * =====================================================
 */
app.set(
    'view engine',
    'ejs'
);

app.set(
    'views',
    path.join(
        __dirname,
        'views'
    )
);

/*
 * =====================================================
 * PHỤC VỤ FILE TRONG PUBLIC
 * =====================================================
 */
app.use(
    express.static(
        path.join(
            __dirname,
            'Public'
        )
    )
);

/*
 * =====================================================
 * PHỤC VỤ THƯ VIỆN NỘI BỘ
 * =====================================================
 *
 * Không công khai toàn bộ node_modules.
 * Chỉ công khai đúng thư mục cần thiết.
 */
const vendorStaticOptions = {
    /*
     * Production lưu cache thư viện 7 ngày.
     * Development không lưu cache lâu.
     */
    maxAge:
        isProduction
            ? '7d'
            : 0
};

/*
 * Bootstrap.
 */
app.use(
    '/vendor/bootstrap',

    express.static(
        path.join(
            __dirname,
            'node_modules',
            'bootstrap',
            'dist'
        ),

        vendorStaticOptions
    )
);

/*
 * SweetAlert2.
 */
app.use(
    '/vendor/sweetalert2',

    express.static(
        path.join(
            __dirname,
            'node_modules',
            'sweetalert2',
            'dist'
        ),

        vendorStaticOptions
    )
);

/*
 * Font Awesome.
 */
app.use(
    '/vendor/fontawesome',

    express.static(
        path.join(
            __dirname,
            'node_modules',
            '@fortawesome',
            'fontawesome-free'
        ),

        vendorStaticOptions
    )
);

/*
 * MapLibre GL.
 */
app.use(
    '/vendor/maplibre',

    express.static(
        path.join(
            __dirname,
            'node_modules',
            'maplibre-gl',
            'dist'
        ),

        vendorStaticOptions
    )
);

/*
 * Mapbox Polyline.
 */
app.use(
    '/vendor/polyline',

    express.static(
        path.join(
            __dirname,
            'node_modules',
            '@mapbox',
            'polyline',
            'src'
        ),

        vendorStaticOptions
    )
);

/*
 * Flatpickr.
 */
app.use(
    '/vendor/flatpickr',

    express.static(
        path.join(
            __dirname,
            'node_modules',
            'flatpickr',
            'dist'
        ),

        vendorStaticOptions
    )
);

/*
 * Chart.js.
 */
app.use(
    '/vendor/chartjs',

    express.static(
        path.join(
            __dirname,
            'node_modules',
            'chart.js',
            'dist'
        ),

        vendorStaticOptions
    )
);

/*
 * html2canvas.
 */
app.use(
    '/vendor/html2canvas',

    express.static(
        path.join(
            __dirname,
            'node_modules',
            'html2canvas',
            'dist'
        ),

        vendorStaticOptions
    )
);

/*
 * Axios dành cho JavaScript
 * chạy trong trình duyệt.
 */
app.use(
    '/vendor/axios',

    express.static(
        path.join(
            __dirname,
            'node_modules',
            'axios',
            'dist'
        ),

        vendorStaticOptions
    )
);

/*
 * =====================================================
 * KHAI BÁO ROUTER
 * =====================================================
 */

/*
 * Route admin.
 */
const adminRoute =
    require('./routes/admin');

/*
 * Route chatbot Gemini.
 */
const chatbotRoute =
    require('./routes/chatbot');

/*
 * Route khách hàng.
 */
const homeRoute =
    require('./routes/khachHang');

/*
 * Route bác sĩ.
 */
const bacSiRoute =
    require('./routes/bacSi');

app.use(
    '/admin',
    adminRoute
);

app.use(
    '/chatbot',
    chatbotRoute
);

app.use(
    '/',
    homeRoute
);

app.use(
    '/bacSi',
    bacSiRoute
);

/*
 * =====================================================
 * XỬ LÝ ROUTE KHÔNG TỒN TẠI
 * =====================================================
 */
app.use((req, res) => {
    return res
        .status(404)
        .send(
            'Không tìm thấy trang.'
        );
});

/*
 * =====================================================
 * XỬ LÝ LỖI CHUNG
 * =====================================================
 */
app.use((error, req, res, next) => {
    console.error(
        'Lỗi ứng dụng:',
        error
    );

    if (res.headersSent) {
        return next(error);
    }

    return res
        .status(500)
        .send(
            'Lỗi Server. ' +
            'Vui lòng thử lại sau.'
        );
});

/*
 * =====================================================
 * KHỞI ĐỘNG SERVER
 * =====================================================
 */
const PORT =
    process.env.PORT ||
    3000;

app.listen(PORT, () => {
    console.log(
        `Server đang chạy tại cổng ${PORT}`
    );

    console.log(
        `NODE_ENV: ${
            process.env.NODE_ENV ||
            'development'
        }`
    );

    console.log(
        `Secure cookie: ${isProduction}`
    );

    console.log(
        'CSP nonce cho script và style đã được bật.'
    );
});