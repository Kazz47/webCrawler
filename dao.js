var mysql = require("mysql");
var config = require("../../resources/config.json");

// Constructor
function DAO() {
	this.pool = mysql.createPool({
		host: config.db.und.host,
		database: config.db.und.database,
		user: config.db.und.username,
		password: config.db.und.password
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
