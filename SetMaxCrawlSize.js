var fs = require("fs");
var config = require("../../resources/config.json");

config.settings.maxCrawlSize = process.argv[2];
jsonString = JSON.stringify(config, null, 4);

fs.writeFile("../../resources/config.json", jsonString, function(err) {
	if(err) console.log("Error!");
	else console.log("Saved!");
});