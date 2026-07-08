const mysql = require('mysql2');
const util = require('util');

// 2. Tạo kết nối
const con = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',  
    database: 'datlichonline'
});

// 3. Thử kết nối
con.connect(function(err) {
    if (err) {
        console.error('Lỗi kết nối databse: ' + err.stack);
        return;
    }
    console.log('--> Đã kết nối MySQL thành công với ID: ' + con.threadId);
});

// 4. BIẾN ĐỔI HÀM QUERY THÀNH PROMISE
// Giúp dùng được await query("SELECT...") mà không bị lỗi
const query = util.promisify(con.query).bind(con);

// 5. Xuất ra cả 'con' và 'query'
module.exports = {
    con: con,
    query: query
};