var stemmer = require("porter-stemmer").stemmer;

function WordAdder() {
	this.DAO = require("./dao");
	this.addDAO = new this.DAO();
	this.pool = this.addDAO.pool;
}

WordAdder.prototype.removeSpecialCharacters = function(string) {
	var cleanString = string.replace(/[^a-zA-Z0-9 ']/g, "");
	return cleanString;
}

WordAdder.prototype.wordSplitter = function(string) {
	var words = this.removeSpecialCharacters(string).split(" ");
	for (var i=0; i<words.length; i++) {
		words[i] = stemmer(words[i].replace(/^[']|[']$/, "").toLowerCase());
        if (words[i].trim().localeCompare("") == 0) {
            words = words.splice(i, 1);
            i--;
        }
	}
	return words
}

WordAdder.prototype.addWords = function(string, webpageId) {
	if (!string) return;
	var self = this;

	var words = this.wordSplitter(string.toLowerCase());

	var running = 0;
	var limit = 2;
    var index = 0;

	function wordAddLauncher() {
		while (running < limit && words.length > 0) {
            var word = words.shift();
            index++;
            self.addWord(word, index, webpageId, function() {
                running--;
                if (words.length > 0) {
                    wordAddLauncher();
                } else if (running === 0) {
                    console.log("Done adding URLs.");
                    self.addDAO.close();
                }
            });
            running++;
		}
	}

	wordAddLauncher();
}

// Add new word.
WordAdder.prototype.addWord = function(word, index, webpageId, callback) {
	var self = this;
	this.pool.getConnection(function(err, connection) {
		if (err) {
			console.log("Add word (Connection): " + err);
			callback();
		} else {
            connection.query("SELECT Id FROM Stopword WHERE Word = ?", [word], function(err, result) {
                if (err) {
                    console.log("Check stopword: " + err.code);
                    connection.release();
                    callback();
                } else if (result[0]) {
                    connection.release();
                    callback();
                } else {
                    connection.query("SELECT Id FROM Keyword WHERE Word = ?", [word], function(err, result) {
                        if (err) {
                            console.log("Check word existance: " + err.code);
                            connection.release();
                            callback();
                        } else if (result[0]) {
                            connection.release();
                            var wordId = result[0].Id;
                            self.addWordToPage(wordId, index, webpageId, function() {
                                callback();
                            });
                        } else {
                            var wordObj = {Word: word};
                            connection.query("INSERT INTO Keyword SET ?", wordObj, function(err, result) {
                                connection.release();
                                if (err) {
                                    console.log("Add word: " + err.code);
                                    callback();
                                } else {
                                    connection.release();
                                    var wordId = result.insertId;
                                    self.addWordToPage(wordId, index, webpageId, function() {
                                        callback();
                                    });
                                }
                            });
                        }
                    });
                }
            });
		}
	});
}

WordAdder.prototype.addWordToPage = function(wordId, index, webpageId, callback) {
    var self = this;
	this.pool.getConnection(function(err, connection) {
		if (err) {
			console.log("Add word (Connection): " + err);
			callback();
		} else {
			var wkjObj = {WebpageId: webpageId, KeywordId: wordId};
			connection.query("INSERT INTO WebpageKeywordJoin SET ? ON DUPLICATE KEY UPDATE Num=Num+1", wkjObj, function(err, result) {
				if (err) {
					console.log("Add wkj: " + err.code);
					connection.release();
					callback();
				} else {
                    var wpObj = {WebpageId: webpageId, KeywordId: wordId, Position: index};
                    connection.query("INSERT INTO WebpagePosition SET ?", wpObj, function(err, result) {
                        if (err) {
                            console.log("Add wp: " + err.code);
                            connection.release();
                            callback();
                        } else {
                            connection.release();
                            self.updateKeywordDF(wordId, callback);
                        }
                    });
				}
			});
		}
	});
}

WordAdder.prototype.updateKeywordDF = function(wordId, callback) {
	this.pool.getConnection(function(err, connection) {
		if (err) {
			console.log("Increment DF (Connection): " + err);
			callback();
		} else {
            connection.query("UPDATE Keyword SET DF = DF + 1 WHERE Id = ?", [wordId], function(err, result) {
				if (err) {
					console.log("Increment DF: " + err.code);
					connection.release();
					callback();
				} else {
					connection.release();
					callback();
				}
            });
		}
	});
}

//var adder = new WordAdder();
//adder.addWords("'Oh, you can't help that,' said the Cat: 'we're all mad here. I'm mad. You're mad.'", 1);

module.exports = WordAdder;
