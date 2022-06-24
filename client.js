console.log('Do not paste anything here unless you know what you are doing! You may be giving hackers access to your data!');

let Levels,
	prevPlayerCount = 0,
	player = {
		level: 0,
		name: 'Unknown',
		element: undefined,
		uid: -1,
		w: 2,
		h: 2,
		x: 0,
		y: 0
	},
	inputs = {
		left: 0,
		right: 0,
		up: 0,
		down: 0
	};

// get levels and start game
let xhttp = new XMLHttpRequest();
xhttp.open('GET', 'levels.json', true);
xhttp.setRequestHeader("Cache-Control", "no-cache, no-store, max-age=0");
xhttp.onreadystatechange = function() {
	if (xhttp.readyState == 4) {
		Levels = JSON.parse(xhttp.response).Levels;
		Levels.forEach(level => {
			level.walls.forEach(wall => {
				if (wall.type == 8) wall.prevPos = {x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2};
			});
		});
		console.log('Initialized levels, starting game...');
		Game();
	}
};
console.log('Requesting levels');
xhttp.send();

const ws = new WebSocket('ws://52.2.197.118:25565');

ws.onclose = function() {
	alert('WebSocket connection closed, this could be due to an error connecting to the server, or the server being down. Refresh the page to retry.');
};

ws.onmessage = function(message) {
	var data = message.data.split('|');
	switch (data[0]) {
// 0: player update, 1: wall update, 2: button state update
		case '0':
			player.level = data[1];
			player.uid = data[2];
			player.name = data[3];
			player.state = data[4];
			player.w = parseInt(data[5]);
			player.h = parseInt(data[6]);
			player.x = parseInt(data[7]);
			player.y = parseInt(data[8]);
			var players = [];
			for (var i=9;i<data.length;i+=7) {
				players.push({
					uid: data[i],
					name: data[i+1],
					element: undefined,
					state: parseInt(data[i+2]),
					w: parseInt(data[i+3]),
					h: parseInt(data[i+4]),
					x: parseInt(data[i+5]),
					y: parseInt(data[i+6])
				});
			}
			Levels[player.level].players = players;
			break;
		case '1':
			Levels[player.level].walls.forEach(wall=>{
				if (wall.uid == data[1]) wall[data[2]] = parseInt(data[3]);
			});
			break;
		case '2':
			Levels[player.level].walls.forEach(function(wall) {
				if (wall.id == data[1]) {
					wall.toggled = data[2];
				}
			});
	}
};

const buttonColors = ['#FF4040', '#FFFF40', '#4040FF', '#FF04FF'];

let Game = function() {
	let memo = document.getElementById('memo'),
		gameContainer = document.getElementById('game-container'),
		levelContainer = document.getElementById('level-container');

	// send inputs to server
	document.onkeydown = function(e) {
		if([32, 37, 38, 39, 40].indexOf(e.keyCode) > -1) {
			e.preventDefault();
		}
		switch (e.key) {
			case ' ':
			case 'w':
			case 'ArrowUp':
				inputs.up=1;
				break;
			case 's':
			case 'ArrowDown':
				inputs.down=1;
				break;
			case 'a':
			case 'ArrowLeft':
				inputs.left=1;
				break;
			case 'd':
			case 'ArrowRight':
				inputs.right=1;
				break;
		}
		ws.send('' + inputs.up + inputs.down + inputs.left + inputs.right);
	};
	document.onkeyup = function(e) {
		switch (e.key) {
			case ' ':
			case 'w':
			case 'ArrowUp':
				inputs.up=0;
				break;
			case 's':
			case 'ArrowDown':
				inputs.down=0;
				break;
			case 'a':
			case 'ArrowLeft':
				inputs.left=0;
				break;
			case 'd':
			case 'ArrowRight':
				inputs.right=0;
				break;
		}
		ws.send('' + inputs.up + inputs.down + inputs.left + inputs.right);
	};

	let currLevel = -1;
	// creates div for given wall 
	function createWall(wall, color, index) {
		levelContainer.insertAdjacentHTML('beforeend', `<div id=wall` + index + ` style='position:absolute;background-color: ` + color + `;width: ` + (wall.x2-wall.x1) + `px;height: ` + (wall.y2-wall.y1) + `px;left: ` + wall.x1 + `px;top:` + wall.y1 + `px;'></div>`);
	}
	function createPlayer(plr) {
		levelContainer.insertAdjacentHTML('beforeend', `<div id=player` + plr.uid + ` style='position:absolute;background-color: #00FF00;border: 1px solid #000000;width: ` + (plr.w-1) + `px;height: ` + (plr.h-1) + `px;left: ` + plr.x + `px;top:` + plr.y + `px;'></div>`);
	}
	setInterval(function() {
		// if level change detected, clear level and create new one
		if (player.level != currLevel) {
			currLevel = player.level;
			gameContainer.removeChild(levelContainer);
			gameContainer.insertAdjacentHTML('beforeend', `<div id='level-container'></div>`);
			levelContainer = document.getElementById('level-container');
			// draw players
			Levels[player.level].players.forEach(function(plr) {
				createPlayer(plr);
			});
			levelContainer.insertAdjacentHTML('beforeend', `<div id=player` + player.uid + ` style='position:absolute;background-color: #00FF00;border: 1px solid #000000;width: ` + (player.w-1) + `px;height: ` + (player.h-1) + `px;left: ` + player.x + `px;top:` + player.y + `px;'></div>`);
			player.element = document.getElementById('player' + player.uid);
			// draw memo
			memo.firstChild.nodeValue = Levels[player.level].memo;
			// draw walls
			Levels[player.level].walls.forEach(function(wall, i) {
				switch (wall.type) {
					case 0:
						createWall(wall, '#000000', i);
						break;
					case 1:
						createWall(wall, '#40FF40', i);
						document.getElementById('wall' + i).style.opacity = 0.75;
						break;
					case 2:
						createWall(wall, '#FF0000', i);
						document.getElementById('wall' + i).style.opacity = 0.75;
						break;
					case 3:
						createWall(wall, buttonColors[wall.id], i)
						break;
					case 4:
						createWall(wall, buttonColors[wall.id], i);
						document.getElementById('wall' + i).style.opacity = wall.toggled==1?0.2:0.75;
						break;
					case 5:
						createWall(wall, '#FF9000', i);
						break;
					case 6:
						createWall(wall, '#303030', i);
						break;
					case 7:
						createWall(wall, '#000000', i);
						break;
					case 8:
						createWall(wall, '#000000', i);
						break;
				}
			});
		}
		// update walls
		Levels[player.level].walls.forEach(function(wall, i) {
			// update doors
			switch (wall.type) {
				case 4:
					document.getElementById('wall'+i).style.opacity = wall.toggled==1?0.2:0.75;
					break;
				case 7:
					document.getElementById('wall'+i).style.opacity = wall.toggled==1?0.2:1;
					break;
				case 8:
					if (wall.prevPos.x1 != wall.x1 || wall.prevPos.y1 != wall.y1 || wall.prevPos.x2 != wall.x2 || wall.prevPos.y2 != wall.y2) {
						document.getElementById('wall'+i).style.left = wall.x1 + 'px';
						document.getElementById('wall'+i).style.top = wall.y1 + 'px';
						document.getElementById('wall'+i).style.width = (wall.x2 - wall.x1) + 'px';
						document.getElementById('wall'+i).style.height = (wall.y2 - wall.y1) + 'px';
					}
					break;
			}
		});
		// detect if player left, if so, loop through first 50 player elements and delete ones without player objects
		if (Levels[player.level].players.length < prevPlayerCount) {
			for (let i = 0; i < 50; i++) {
				if (document.getElementById('player'+i) != undefined && !Levels[player.level].players.find(function(plr) {return plr.uid==i})) {
					levelContainer.removeChild(document.getElementById('player'+i));
				}
			}
		}
		prevPlayerCount = Levels[player.level].players.length;
		// update players
		Levels[player.level].players.forEach(function(plr) {
			if (document.getElementById('player'+plr.uid) == undefined) createPlayer(plr);
			document.getElementById('player'+plr.uid).style.left = plr.x + 'px';
			document.getElementById('player'+plr.uid).style.top = plr.y + 'px';
			document.getElementById('player'+plr.uid).style.width = (plr.w-1) + 'px';
			document.getElementById('player'+plr.uid).style.height = (plr.h-1) + 'px';
		});
		if (document.getElementById('player'+player.uid) == undefined) {
			levelContainer.insertAdjacentHTML('beforeend', `<div id=player` + player.uid + ` style='position:absolute;background-color: #00FF00;border: 1px solid #000000;width: ` + (player.w-1) + `px;height: ` + (player.h-1) + `px;left: ` + player.x + `px;top:` + player.y + `px;'></div>`);
			player.element = document.getElementById('player' + player.uid);
		}
		player.element.id = 'player' + player.uid;
		player.element.style.left = player.x + 'px';
		player.element.style.top = player.y + 'px';
		player.element.style.width = (player.w-1) + 'px';
		player.element.style.height = (player.h-1) + 'px';
	}, 1000/24);
};
