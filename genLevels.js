var fs = require('fs'),
	levels = require('/var/www/html/games/sacrifice/levels.json').Levels,
	newLevels = [];

levels.forEach(level=>{
	var newWalls = [];
	level.walls.forEach(wall=>{
		var newWall = {type:wall[0],x1:wall[1],y1:wall[2],x2:wall[3],y2:wall[4]};
		if (wall[0] == 3 || wall[0] == 4) {
			newWall.id = wall[5]
		}
		if (wall[0] == 4) newWall.toggled = 0;
		newWalls.push(newWall);
	});
	level.walls = newWalls;
});

fs.writeFile("newLevels.json", JSON.stringify(levels), (err)=>{console.log(err)})
