const mysql = require('mysql2');

const con = mysql.createPool({
    host: process.env.HOST_TIDB,
    user: process.env.USERNAME_TIDB,
    password: process.env.PASS_TIDB,
    port: Number(process.env.PORT_TIDB),
    database: process.env.DBNAME_TIDB,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: {
        minVersion: 'TLSv1.2'
    }
});

// Kết nối database
con.getConnection((err, connection) => {
    if (err) {
        console.error("Lỗi kết nối database: ", err);
        return;
    }

    console.log("Kết nối TiDB database thành công");
    connection.release();
});

module.exports = con;