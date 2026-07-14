const mysql = require('mysql2');
const util = require('util');

// 2. Tạo kết nối
const con = mysql.createConnection({
    host:  process.env.HOST_TIDB,
    user:  process.env.USERNAME_TIDB,
    password:  process.env.PASS_TIDB,  
    port: Number(process.env.POST_TIDB),
    database:  process.env.DBNAME_TIDB
});

//Ket noi database
con.getConnection((err, connection) =>{
    if(err){
        console.error("Loi ket noi database: ", err);
        return;
    }

    console.log("Ket noi TiDB thanh cong")
    connection.release();
})


module.exports = {
    con: con
};