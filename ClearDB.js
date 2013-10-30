var DAO = require("./dao");
var clearDAO = new DAO();
var pool = clearDAO.pool;

pool.getConnection(function(err, connection) {
	if (err) console.log(err);
	else {
		connection.query("DELETE FROM Address", function(err, result) {
			if(err) console.log(err);
		});
		connection.query("DELETE FROM Keyword", function(err, result) {
			if(err) console.log(err);
		});
		connection.query("DELETE FROM Stopword", function(err, result) {
			if(err) console.log(err);
		});
		connection.query("DELETE FROM URL", function(err, result) {
			if(err) console.log(err);
		});
		connection.query("DELETE FROM Webpage", function(err, result) {
			if(err) console.log(err);
		});
		connection.query("DELETE FROM WebpageAddressJoin", function(err, result) {
			if(err) console.log(err);
		});
		connection.query("DELETE FROM WebpageKeywordJoin", function(err, result) {
			if(err) console.log(err);
			connection.release();
			clearDAO.close();
		});
	}
});
