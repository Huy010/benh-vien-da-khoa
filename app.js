// Đọc biến môi trường trước khi sử dụng
require('dotenv').config();

// Khởi tạo server
const express = require('express');
const path = require('path');
const multer = require('multer');
const session = require('express-session');
const rateLimit = require('express-rate-limit');

const app = express();

/*
 * Render chạy phía sau reverse proxy.
 * Cần đặt trước express-session để Express nhận biết HTTPS.
 */
app.set('trust proxy', 1);

// Kiểm tra SESSION_SECRET
if (!process.env.SESSION_SECRET) {
    throw new Error(
        'Thiếu biến môi trường SESSION_SECRET. Hãy thêm SESSION_SECRET vào file .env và Render.'
    );
}

const isProduction = process.env.NODE_ENV === 'production';

/*
 * Đọc dữ liệu JSON.
 * Chỉ khai báo một lần.
 */
app.use(express.json({
    limit: '1mb'
}));

/*
 * Đọc dữ liệu từ form POST.
 * Chỉ khai báo một lần.
 */
app.use(express.urlencoded({
    extended: true,
    limit: '1mb'
}));

/*
 * Cấu hình session.
 *
 * proxy: true giúp express-session tin tưởng
 * X-Forwarded-Proto từ Render/Cloudflare.
 */
app.use(session({
    name: 'connect.sid',

    secret: process.env.SESSION_SECRET,

    proxy: true,

    resave: false,

    saveUninitialized: false,

    cookie: {
        httpOnly: true,

        /*
         * Render production dùng HTTPS nên secure = true.
         * Localhost dùng HTTP nên secure = false.
         */
        secure: isProduction,

        sameSite: 'lax',

        path: '/',

        maxAge: 1000 * 60 * 60 * 24 * 7
    }
}));

/*
 * Không cho trình duyệt hoặc Cloudflare lưu cache
 * những trang có chứa CSRF token và dữ liệu đăng nhập.
 */
const noCachePaths = [
    '/login',
    '/logout',
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

// Chống Clickjacking
app.use((req, res, next) => {
    res.setHeader(
        'X-Frame-Options',
        'DENY'
    );

    next();
});

// Giới hạn số lần gửi request
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,

    // Tối đa 10.000 request trong 15 phút
    max: 10000,

    message:
        'Bạn gửi quá nhiều yêu cầu, vui lòng thử lại sau.',

    standardHeaders: true,

    legacyHeaders: false
});

app.use(limiter);

// Cấu hình Multer lưu file trong bộ nhớ
const storage = multer.memoryStorage();

// Giới hạn kích thước ảnh upload
const upload = multer({
    storage: storage,

    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

/*
 * Lưu cấu hình upload vào app.locals nếu route
 * khác cần truy cập thông qua req.app.locals.upload.
 */
app.locals.upload = upload;

/*
 * Đưa thông tin đăng nhập sang các file EJS.
 * Phải đặt sau express-session.
 */
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.page = '';

    next();
});

// Cấu hình View Engine
app.set('view engine', 'ejs');

app.set(
    'views',
    path.join(__dirname, 'views')
);

// Cấu hình thư mục Public
app.use(
    express.static(
        path.join(__dirname, 'Public')
    )
);

// Khai báo Route admin
const adminRoute = require('./routes/admin');

app.use(
    '/admin',
    adminRoute
);

// Khai báo Route chatbot Gemini
const chatbotRoute = require('./routes/chatbot');

app.use(
    '/chatbot',
    chatbotRoute
);

// Khai báo Route khách hàng
const homeRoute = require('./routes/khachHang');

app.use(
    '/',
    homeRoute
);

// Khai báo Route bác sĩ
const bacSiRoute = require('./routes/bacSi');

app.use(
    '/bacSi',
    bacSiRoute
);

// Middleware xử lý route không tồn tại
app.use((req, res) => {
    return res
        .status(404)
        .send('Không tìm thấy trang.');
});

// Middleware xử lý lỗi chung
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
        .send('Lỗi Server. Vui lòng thử lại sau.');
});

// Chạy Server
const PORT =
    process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(
        `Server đang chạy tại cổng ${PORT}`
    );

    console.log(
        `NODE_ENV: ${process.env.NODE_ENV || 'development'}`
    );

    console.log(
        `Secure cookie: ${isProduction}`
    );
});