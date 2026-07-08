// Khoi tao server
const express = require('express');

const app = express();
app.set('trust proxy', 1);

const path = require('path');
require('dotenv').config();
// Khai báo multer
const multer = require('multer');
// Cấu hình nơi lưu trữ file (storage). 
const storage = multer.memoryStorage();

// Session
const session = require('express-session');

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 7 // 7 ngay
    }
}));

// Chống Clickjacking
app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    next();
});

// Giới hạn số lần gửi request
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 10000, // 1000 request
    message: 'Bạn gửi quá nhiều yêu cầu, vui lòng thử lại sau.'
});
app.use(limiter);

// Giới hạn kích thước ảnh upload
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5mb
    }
});
// Giới hạn kích thước dữ liệu JSON
app.use(express.json({
    limit: '1mb'
}));
// Giới hạn kích thước dữ liệu Form
app.use(express.urlencoded({
    extended: true,
    limit: '1mb'
}));

app.use((req, res, next) => {
    res.locals.user = req.session.user;
    res.locals.page = ''; // default
    next();
});

// Cấu hình View Engine để Express hiểu file.ejs
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); // Chỉ định thư mục chứa các file giao diện

// Cho phép Express đọc dữ liệu từ Form POST(urlencoded)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Cấu hình Public để load hình, css, js 
app.use(express.static(path.join(__dirname, 'Public')));

// Khai báo Route admin
const adminRoute = require('./routes/admin');
app.use('/admin', adminRoute);

// Khai báo Route chatbot Gemini
const chatbotRoute = require('./routes/chatbot');
app.use('/chatbot', chatbotRoute);

// Khai báo Route khách hàng
const homeRoute = require('./routes/khachHang');
app.use('/', homeRoute);

// Khai báo Route bác sĩ
const bacSiRoute = require('./routes/bacSi');
app.use('/bacSi', bacSiRoute);

// Chay Server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}/trangchu`);
});