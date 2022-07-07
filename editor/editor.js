function outputLevel() {
	document.getElementById('output').innerHTML = JSON.stringify(levelData);
}

function importLevelData() {
	levelData = JSON.parse(document.getElementById('input').value);
}

function touchMode() {
	
}

function setStartPos() {
	levelData.startPos.x = parseInt(document.getElementById('startPosX').value);
	levelData.startPos.y = parseInt(document.getElementById('startPosY').value);
}

function setMemo() {
	levelData.memo = document.getElementById('memo').value;
}

function setButtonColors() {
	levelData.buttonColors.forEach(function(color, index) {
		try {
			color[0] = parseInt(document.getElementById('rgb-r' + index).value) || 0;
			color[1] = parseInt(document.getElementById('rgb-g' + index).value) || 0;
			color[2] = parseInt(document.getElementById('rgb-b' + index).value) || 0;
			document.getElementById('rgb-sample' + index + '').style['background-color'] = 'rgba(' + color[0] + ', ' + color[1] + ', ' + color[2] + ', 0.5)';
		} catch (err) {console.log(err)}
	});
}

function addButtonColor() {
	document.body.insertAdjacentHTML('beforeend', `<div id='rgb${levelData.buttonColors.length}'><input placeholder='Red Value ${levelData.buttonColors.length}' id='rgb-r${levelData.buttonColors.length}' value='0'><input placeholder='Green Value ${levelData.buttonColors.length}' id='rgb-g${levelData.buttonColors.length}' value='0'><input placeholder='Blue Value ${levelData.buttonColors.length}' id='rgb-b${levelData.buttonColors.length}' value='0'><div id='rgb-sample${levelData.buttonColors.length}' style='width:20px;height:20px;background-color:rgba(0, 0, 0, 0.5);'></div></div>`);
	levelData.buttonColors.push([0, 0, 0, 150]);
}

function removeButtonColor() {
	const id = parseInt(document.getElementById('rm-color-id').value);
	levelData.buttonColors.splice(id, 1);
	document.body.removeChild(document.getElementById('rgb' + id));
}

let buttonColorsHTML = [],
levelData = {
	walls: [],
	startPos: {x: 0, y: 0},
	players: [],
	memo: '',
	buttonColors: [[255, 0, 0, 150], [255, 255, 0, 150], [0, 0, 255, 150], [255, 0, 255, 150]]
},
undoneWalls = [],
wallCount = 0,
Game = function(p) {
	let currWall = {},
		temp = 0;
	p.setup = function() {
		p.createCanvas(800, 600);
	};
	p.mouseClicked = function() {
		if (!document.getElementById('wallDelete').checked) return;
		levelData.walls.forEach(function(wall) {
			if (p.mouseX > wall.x1 && p.mouseY > wall.y1 && p.mouseX < wall.x2 && p.mouseY < wall.y2) {
				undoneWalls.push(wall);
				levelData.walls.splice(levelData.walls.indexOf(wall), 1);
			}
		});
	};
	p.mousePressed = function() {
		if (p.mouseX < 0 || p.mouseY > p.width || p.mouseY < 0 || p.mouseY > p.height || document.getElementById('wallDelete').checked) return;
		if (document.getElementById('wallType').value == '') return alert('You need to specify a type. Ask the developer for a list  of valid types');
		if (!levelData.buttonColors[parseInt(document.getElementById('wallId').value)] && document.getElementById('wallType').value == 3 || document.getElementById('wallType').value == 4) return alert('Color for button ID not defined');
		currWall.type = parseInt(document.getElementById('wallType').value);
		currWall.x1 = document.getElementById('wallGrid').checked?Math.floor(p.mouseX/20)*20:Math.floor(p.mouseX);
		currWall.y1 = document.getElementById('wallGrid').checked?Math.floor(p.mouseY/20)*20:Math.floor(p.mouseY);
	};
	p.mouseReleased = function() {
		if (p.mouseX < 0 || p.mouseY > p.width || p.mouseY < 0 || p.mouseY > p.height || currWall == {} || document.getElementById('wallDelete').checked) return;
		currWall.x2 = document.getElementById('wallGrid').checked?Math.floor(p.mouseX/20)*20+20:Math.floor(p.mouseX);
		currWall.y2 = document.getElementById('wallGrid').checked?Math.floor(p.mouseY/20)*20+20:Math.floor(p.mouseY);
		// add specific wall properties
/*
7: timed platform (req: timer, timerStart, timerOffset, uid, toggled)
8: moving platform (req: posList, posNum, frameNum, uid
*/
		switch (currWall.type) {
			case 3:
				if (document.
			case 4:
				if (document.getElementById('wallId').value != '') {
					currWall.id = parseInt(document.getElementById('wallId').value);
					currWall.toggled = 0;
				}
				break;
			case 7:
				let uid = 0;
				levelData.walls.forEach(wall => {
					if (wall.uid == uid) return uid++;
				});
				currWall.uid = uid;
				break;
			case 8:
				let uid = 0;
				levelData.walls.forEach(wall => {
					if (wall.uid == uid) return uid++;
				});
				break;
		}
		// if second coordinate is lower than first coordinate, flip them (so the collisions dont break)
		if (currWall.y1 >= currWall.y2) {
			temp = currWall.y1;
			currWall.y1 = currWall.y2 - (document.getElementById('wallGrid').checked?20:0);
			currWall.y2 = temp + (document.getElementById('wallGrid').checked?20:0);
			temp = 0;
		}
		// same thing but making sure first coord is to the left of second coord
		if (currWall.x1 >= currWall.x2) {
			temp = currWall.x1;
			currWall.x1 = currWall.x2 - (document.getElementById('wallGrid').checked?20:0);
			currWall.x2 = temp + (document.getElementById('wallGrid').checked?20:0);
			temp = 0;
		}
		levelData.walls.push(currWall);
		currWall = {};
	};
	p.keyPressed = function() {
		if(p.keyCode == 90 && levelData.walls[levelData.walls.length-1]) {
			undoneWalls.push(levelData.walls.pop());
		} else if (p.keyCode == 89 && undoneWalls[undoneWalls.length-1]) {
			levelData.walls.push(undoneWalls.pop());
		}
	};
	p.draw = function() {
		// set wall counter
		if (wallCount != levelData.walls.length) {
			document.getElementById('wall-counter').firstChild.nodeValue = levelData.walls.length;
			wallCount = levelData.walls.length;
		}
		p.strokeWeight(1);
		p.stroke(0);
		p.background(220, 220, 255);
		// create grid
		if (document.getElementById('wallGrid').checked) {
			for (let i=0;i<40;i++) {
				p.line(i*20, 0, i*20, 600);
			}
			for (let i=0;i<30;i++) {
				p.line(0, i*20, 800, i*20);
			}
		}
		p.rectMode(p.CORNERS);
		// draw level
		levelData.walls.forEach(function(wall) {
			switch (wall.type) {
				case 0:
					p.fill(0);
					p.rect(wall.x1, wall.y1, wall.x2, wall.y2);
					break;
				case 1:
					p.fill(0, 255, 0, 150);
					p.rect(wall.x1, wall.y1, wall.x2, wall.y2);
					break;
				case 2:
					p.fill(255, 0, 0, 150);
					p.rect(wall.x1, wall.y1, wall.x2, wall.y2);
					break;
				case 3:	
					p.fill(levelData.buttonColors[wall.id][0], levelData.buttonColors[wall.id][1], levelData.buttonColors[wall.id][2], 255);
					p.rect(wall.x1, wall.y1, wall.x2, wall.y2);
					break;
				case 4:
					p.fill(levelData.buttonColors[wall.id][0], levelData.buttonColors[wall.id][1], levelData.buttonColors[wall.id][2], levelData.buttonColors[wall.id][3]);
					p.rect(wall.x1, wall.y1, wall.x2, wall.y2);
					break;
				case 5:
					p.fill(255, 165, 0, 255);
					p.rect(wall.x1, wall.y1, wall.x2, wall.y2);
					break;
				case 6:
					p.fill(50, 50, 50, 255);
					p.rect(wall.x1, wall.y1, wall.x2, wall.y2);
					break;
				default:
					break;
			}
		});
		p.stroke(255, 0, 0);
		p.strokeWeight(5);
		p.point(levelData.startPos.x, levelData.startPos.y);
	};
};

new p5(Game, 'game-container');
