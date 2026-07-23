// Đọc biến môi trường trước khi sử dụng
require('dotenv').config();

// Khởi tạo server
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
 * Render chạy phía sau reverse proxy.
 * Cần đặt trước express-session để Express nhận biết HTTPS.
 */
app.set('trust proxy', 1);

/*
 * Không để Express tiết lộ công nghệ đang sử dụng
 * thông qua header X-Powered-By.
 */
app.disable('x-powered-by');

/*
 * =====================================================
 * TẠO CSP NONCE CHO MỖI PHẢN HỒI
 * =====================================================
 *
 * Mỗi lần người dùng tải một trang, server sẽ tạo
 * một nonce ngẫu nhiên mới.
 *
 * Nonce được lưu vào res.locals nên tất cả file EJS
 * đều có thể sử dụng trực tiếp bằng:
 *
 * <script nonce="<%= cspNonce %>">
 *     // JavaScript nội tuyến
 * </script>
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
                 * Mặc định, tài nguyên chỉ được tải
                 * từ chính website.
                 */
                defaultSrc: [
                    "'self'"
                ],

                /*
                 * JavaScript chỉ được phép chạy khi:
                 *
                 * 1. File JavaScript được tải từ chính website.
                 * 2. Thẻ script nội tuyến có nonce hợp lệ.
                 *
                 * Đã loại bỏ 'unsafe-inline' để khắc phục:
                 * CSP: script-src unsafe-inline.
                 */
                scriptSrc: [
                    "'self'",

                    (req, res) =>
                        `'nonce-${res.locals.cspNonce}'`
                ],

                /*
                 * Chặn hoàn toàn JavaScript đặt trong
                 * thuộc tính HTML như:
                 *
                 * onclick=""
                 * onchange=""
                 * onsubmit=""
                 * onload=""
                 *
                 * Các thuộc tính này cần được chuyển thành
                 * addEventListener hoặc thẻ <a href="">.
                 */
                scriptSrcAttr: [
                    "'none'"
                ],

                /*
                 * Hiện tại vẫn giữ unsafe-inline cho CSS
                 * vì dự án còn nhiều:
                 *
                 * <style>...</style>
                 * style="..."
                 *
                 * Phần này sẽ được xử lý riêng sau.
                 */
                styleSrc: [
                    "'self'",
                    "'unsafe-inline'"
                ],

                /*
                 * Font Awesome và các font nội bộ.
                 */
                fontSrc: [
                    "'self'",
                    'data:'
                ],

                /*
                 * Cho phép ảnh nội bộ, ảnh dạng data/blob
                 * và dữ liệu hình ảnh bản đồ Goong.
                 */
                imgSrc: [
                    "'self'",
                    'data:',
                    'blob:',
                    'https://tiles.goong.io'
                ],

                /*
                 * Cho phép JavaScript kết nối đến chính website
                 * và các dịch vụ bản đồ Goong.
                 */
                connectSrc: [
                    "'self'",
                    'https://tiles.goong.io',
                    'https://rsapi.goong.io'
                ],

                /*
                 * MapLibre có thể tạo Web Worker
                 * từ địa chỉ blob.
                 */
                workerSrc: [
                    "'self'",
                    'blob:'
                ],

                /*
                 * Không cho phép nội dung dạng object,
                 * embed hoặc applet.
                 */
                objectSrc: [
                    "'none'"
                ],

                /*
                 * Thẻ <base> chỉ được phép trỏ về
                 * chính website.
                 */
                baseUri: [
                    "'self'"
                ],

                /*
                 * Các form chỉ được gửi dữ liệu
                 * về chính website.
                 */
                formAction: [
                    "'self'"
                ],

                /*
                 * Không cho website khác nhúng trang
                 * vào iframe.
                 */
                frameAncestors: [
                    "'none'"
                ],

                /*
                 * Trên Render production:
                 * tự động nâng tài nguyên HTTP thành HTTPS.
                 *
                 * Trên localhost:
                 * tắt để tránh ảnh hưởng quá trình phát triển.
                 */
                upgradeInsecureRequests:
                    isProduction
                        ? []
                        : null
            }
        },

        /*
         * Chỉ bật HSTS khi triển khai production bằng HTTPS.
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
 * Kiểm tra SESSION_SECRET.
 */
if (!process.env.SESSION_SECRET) {
    throw new Error(
        'Thiếu biến môi trường SESSION_SECRET. ' +
        'Hãy thêm SESSION_SECRET vào file .env và Render.'
    );
}

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
 * Đọc dữ liệu từ form POST.
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
 *
 * proxy: true giúp express-session tin tưởng
 * X-Forwarded-Proto từ Render hoặc Cloudflare.
 */
app.use(
    session({
        name: 'connect.sid',

        secret: process.env.SESSION_SECRET,

        proxy: true,

        resave: false,

        saveUninitialized: false,

        cookie: {
            /*
             * JavaScript phía trình duyệt không thể
             * đọc cookie session.
             */
            httpOnly: true,

            /*
             * Render production dùng HTTPS nên secure = true.
             * Localhost dùng HTTP nên secure = false.
             */
            secure: isProduction,

            /*
             * Hạn chế gửi cookie trong một số
             * yêu cầu cross-site.
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
 * KHÔNG LƯU CACHE CÁC TRANG NHẠY CẢM
 * =====================================================
 *
 * Không cho trình duyệt hoặc Cloudflare lưu cache
 * những trang có chứa CSRF token và dữ liệu đăng nhập.
 */
const noCachePaths = [
    '/login',
    '/logout',
    '/admin/login',
    '/bacSi/login',
    '/khachHangTaoTaiKhoan',
    '/thayDoiThongTin',
    '/capNhatThongTin'
];

app.use((req, res, next) => {
    if (noCachePaths.includes(req.path)) {
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

        /*
         * Hỗ trợ yêu cầu CDN không lưu cache.
         */
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
 * X-Frame-Options được giữ để hỗ trợ thêm
 * cho các trình duyệt cũ.
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
    windowMs:
        15 *
        60 *
        1000,

    /*
     * Tối đa 10.000 request trong 15 phút.
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
const storage = multer.memoryStorage();

/*
 * Giới hạn kích thước file tải lên là 5 MB.
 */
const upload = multer({
    storage: storage,

    limits: {
        fileSize:
            5 *
            1024 *
            1024
    }
});

/*
 * Lưu cấu hình upload vào app.locals để route khác
 * có thể sử dụng thông qua:
 *
 * req.app.locals.upload
 */
app.locals.upload = upload;

/*
 * =====================================================
 * BIẾN DÙNG CHUNG CHO EJS
 * =====================================================
 *
 * Middleware tạo cspNonce đã chạy trước Helmet.
 * Vì vậy cspNonce đã có sẵn trong res.locals.
 */
app.use((req, res, next) => {
    res.locals.user =
        req.session.user || null;

    res.locals.page = '';

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
 * PHỤC VỤ FILE TRONG THƯ MỤC PUBLIC
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
 * Chỉ công khai đúng thư mục của từng thư viện.
 *
 * Trình duyệt được phép cache thư viện trong 7 ngày
 * ở production.
 */
const vendorStaticOptions = {
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
 * Axios dành cho JavaScript chạy trong trình duyệt.
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

app.use(
    '/admin',
    adminRoute
);

/*
 * Route chatbot Gemini.
 */
const chatbotRoute =
    require('./routes/chatbot');

app.use(
    '/chatbot',
    chatbotRoute
);

/*
 * Route khách hàng.
 */
const homeRoute =
    require('./routes/khachHang');

app.use(
    '/',
    homeRoute
);

/*
 * Route bác sĩ.
 */
const bacSiRoute =
    require('./routes/bacSi');

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
 * MIDDLEWARE XỬ LÝ LỖI CHUNG
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
        'CSP nonce đã được bật.'
    );
});