var mysql = require("mysql");

// Constructor
function DAO() {
	this.pool = mysql.createPool({
		host: "host",
		database: "database",
		user: "username",
		password: "password"
	});
}

/********* Open Pool ************/
DAO.prototype.pool = function() {
	return this.pool;
}

/********* Close pool ***********/
DAO.prototype.close = function() {
	this.pool.end();
}

module.exports = DAO;
