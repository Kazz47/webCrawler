var mysql = require("mysql");

// Constructor
function DAO() {
	this.pool = mysql.createPool({
		host: "mysql.cs.und.edu",
		database: "kgoehner",
		user: "kgoehner",
		password: "mysql987"
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
