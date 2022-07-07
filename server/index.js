/*

╔═╗──────────╔╗╔═╗╔╗──────
║═╣╔═╗─╔═╗╔╦╗╠╣║═╣╠╣╔═╗╔═╗
╠═║║╬╚╗║═╣║╔╝║║║╔╝║║║═╣║╩╣
╚═╝╚══╝╚═╝╚╝─╚╝╚╝─╚╝╚═╝╚═╝
			*/
/*					     *\
TODO: located at ../todo

Levels.json legend:
{type, x1, y1, x2, y2, id, toggled, timer, timerStart, timerOffset, uid, posList, posNum, frameNum}
0: wall
1: win
2: death
3: button (req: id)
4: controlled wall (req: id, toggled)
5: bounce pad
6: climbable platform
7: timed platform (req: timer, timerStart, timerOffset, uid, toggled)
8: moving platform (req: posList, posNum, frameNum, uid)
\*					     */

const WebSocket = require('ws');

var Game = {
	levels: require('../levels.json').Levels,
	players: [],
	Player: function(config) {
		this.name = config.name || 'Unknown';
		this.uid = config.uid || Game.genUID();
		this.ws = config.ws || undefined;
		this.lastSent = '';
		this.x = config.x || 50;
		this.y = config.y || 50;
		this.w = config.w || 20;
		this.h = config.h || 20;
		this.state = 'idle';
		this.xVel = 0;
		this.yVel = 0;
		this.maxSpeed = config.maxSpeed || 10;
		this.accelSpeed = config.accelSpeed || 2.5;
		this.friction = config.friction || 2.5;
		this.jumpHeight = config.jumpHeight || 10;
		this.canJump = false;
		this.isOnWall = false;
		this.buttons = []; // buttons the player is pressing
		this.level = config.level || 0;
		this.inputs = [0, 0, 0, 0];
		this.respawn = function() {
			this.x = Game.levels[this.level].startPos.x;
			this.y = Game.levels[this.level].startPos.y;
			this.xVel = 0;
			this.yVel = 0;
		};
		this.handleSimpleCol = function(wall, u, d, l, r) {
			// if player is above wall
			if (this.y + this.h <= wall.y1 && (u==undefined || u==1)) {
				this.y = wall.y1 - this.h;
				this.yVel = 0;
				this.canJump = true;
			}
			// if player is below wall
			if (this.y >= wall.y2 && (d==undefined || d==1)) {
				this.y = wall.y2;
				this.yVel = 0;
			}
			// if player is left of wall
			if (this.x + this.w <= wall.x1 && (l==undefined || l==1)) {
				this.x = wall.x1 - this.w;
				this.xVel = 0;
			}
			// if player is right of wall
			if (this.x >= wall.x2 && (r==undefined || r==1)) {
				this.x = wall.x2;
				this.xVel = 0;
			}
		};
		this.handleVelAndCol = function() {
			// accelerate velocity depending on inputs and gravity
			if (this.inputs[2] == 1 && this.xVel > this.maxSpeed*-1) { // left
				this.xVel -= this.accelSpeed;
				this.state = (this.xVel > 0)?'haltR':'runL';
			}
			if (this.inputs[3] == 1 && this.xVel < this.maxSpeed) { // right
				this.xVel += this.accelSpeed;
				this.state = (this.xVel < 0)?'haltL':'runR';
			}
			if (this.inputs[2] == 0 && this.inputs[3] == 0) { // friction
				if ((this.xVel < 2.5 && this.xVel > 0) || (this.xVel > -2.5 && this.xVel < 0)) this.xVel = 0;
				if (this.xVel > 0) {
					this.xVel -= this.friction;
					this.state = 'haltR';
				} else if (this.xVel < 0) {
					this.xVel += this.friction;
					this.state = 'haltL';
				} else {
					this.state = 'idle';
				}
			}
			if (this.inputs[0] == 1) { // up
				// detect and handle collisions with players. Put this code here because it was easy and theoretically improves server performance marginally.
				Game.players.forEach(function(player) {
					if (this == player || player.level != this.level) return 0;
					// if player is in another player on the next frame (nothing sexual)
					if (this.x + this.xVel + this.w > player.x && this.x + this.xVel < player.x + player.w && this.y + this.yVel + this.h > player.y && this.y + this.yVel < player.y + player.h) {
						// if other player is trying to throw you, and you arent trying to throw another player
						if (this.inputs[0] == 1 && player.inputs[1] == 1 && this.canJump && this.inputs[1] == 0) {
							this.yVel -= 15;
							this.canJump = false;
							this.state = 'jump';
						}
					}
				}, this);
				if (this.canJump) {
					this.yVel -= this.jumpHeight;
					this.canJump = false;
					this.state = 'jump';
				}
			}
			if (this.inputs[1] == 1 && this.inputs[0] == 0) { // down
				this.state = (this.xVel == 0)?'throwIdle':((this.xVel > 0)?'throwR':'throwL');
			}
			if (this.yVel < 20) { // gravity
				this.yVel += 1;
				if (this.yVel > 0) this.state = 'fall';
			}
			this.isOnWall = false;
			// detect and handle collisions with walls (all level objects)
			Game.levels[this.level].walls.forEach(function(wall) {
				// allow jumping if player is on a wall
				if (this.x + this.w >= wall.x1 && this.x <= wall.x2 && this.y + this.h == wall.y1) {
					this.isOnWall = true;
					// handle player stepping on a button
					if (wall.type == 3 && !this.buttons.includes(wall.id)) {
						this.buttons.push(wall.id);
						Game.players.forEach(function(player) {
							if (player.level == this.level) player.ws.send('2|' + wall.id + '|1');
						}, this);
						Game.levels[this.level].walls.forEach(function(wll) {
							if (wll.id == wall.id && wll.type == 4) wll.toggled = 1;
						});
					}
				// handle when player steps off a button
				} else if (this.buttons.includes(wall.id) && wall.type == 3) {
					this.buttons.splice(this.buttons.indexOf(wall.id), 1);
					Game.players.forEach(function(player) {
						if (player.level == this.level) player.ws.send('2|' + wall.id + '|0');
					}, this);
					Game.levels[this.level].walls.forEach(function(wll) {
						if (wll.id == wall.id && wll.type == 4) wll.toggled = 0;
					});
				}
				// if player is in a wall on the next frame
				if (this.x + this.xVel < wall.x2 && this.x + this.xVel + this.w > wall.x1 && this.y + this.yVel + this.h > wall.y1 && this.y + this.yVel < wall.y2) {
					switch (wall.type) {
						case 0: 
							this.handleSimpleCol(wall);
							break;
						case 1:
							this.level++;
							this.respawn();
							break;
						case 2:
							this.respawn();
							break;
						case 3:
							this.handleSimpleCol(wall);
							break;
						case 4:
							if (wall.toggled) break;
							this.handleSimpleCol(wall);
							break;
						case 5:
							this.handleSimpleCol(wall, 0);
							// if player is above
							if (this.y + this.h <= wall.y1) {
								this.y = wall.y1 - this.h;
								this.yVel *= -0.8;
								if (Math.abs(this.yVel) < 5) {
									this.canJump = true;
									this.isOnWall = true;
								}
							}
							break;
						case 6:
							this.handleSimpleCol(wall, 1, 1, 0, 0);
							// if player is left or right of wall
							if (this.x + this.w <= wall.x1) {
								this.x = wall.x1 - this.w;
								this.xVel = 0;
								if (Math.abs(this.yVel) < this.jumpHeight) this.canJump = true;
								this.isOnWall = true;
							}
							if (this.x >= wall.x2) {
								this.x = wall.x2;
								this.xVel = 0;
								if (Math.abs(this.yVel) < this.jumpHeight) this.canJump = true;
								this.isOnWall = true;
							}
							break;
						case 7:
							if (wall.toggled) break;
							this.handleSimpleCol(wall);
							break;
						case 8:
							this.handleSimpleCol(wall);
							break;
					}
				}
			}, this);
			if (!this.isOnWall) this.canJump = false;
			// move player relative to velocity
			this.x+=this.xVel;
			this.y+=this.yVel;
		};
	},
	// game loops at 24 fps
	gameLoop: setInterval(function() {
		// if player is in a level, update walls that need to be updated
		Game.levels.forEach((level, index) => {
			let playerInLevel = false;
			for (let i = 0;i < Game.players.length;i++) {
				if (Game.players[i].level == index) playerInLevel = true;
			}
			if (!playerInLevel) return;
			level.walls.forEach(wall => {
				switch (wall.type) {
					case 7:
						if (wall.timer <= 0) {
							wall.toggled = wall.toggled?0:1;
							wall.timer = wall.timerStart;
							Game.players.forEach(player => {
								if (player.level == index) player.ws.send('1|' + wall.uid + '|toggled|' + wall.toggled);
							});
						} else if (wall.timerOffset > 0) {
							wall.timerOffset--;
						} else {
							wall.timer--;
						}
						break;
					case 8:
						let currPos = {x1: wall.x1, y1: wall.y1},
							nextPos = (wall.posList[wall.posNum+1]==undefined)?wall.posList[0]:wall.posList[wall.posNum+1],
							posOffset,
							playersOnWall = [];
						Game.players.forEach(player => {
							if (player.level == index && player.x + player.w >= wall.x1 && player.x <= wall.x2 && player.y + player.h == wall.y1) {
								playersOnWall.push(player.uid);
							}
						});
						if (wall.frameNum < 24) {
							wall.x1 = wall.posList[wall.posNum].x1 + ((nextPos.x1 - wall.posList[wall.posNum].x1)/24*wall.frameNum);
							wall.y1 = wall.posList[wall.posNum].y1 + ((nextPos.y1 - wall.posList[wall.posNum].y1)/24*wall.frameNum);
							wall.x2 = wall.posList[wall.posNum].x2 + ((nextPos.x2 - wall.posList[wall.posNum].x2)/24*wall.frameNum);
							wall.y2 = wall.posList[wall.posNum].y2 + ((nextPos.y2 - wall.posList[wall.posNum].y2)/24*wall.frameNum);
							wall.frameNum++;
						} else {
							wall.frameNum = 0;
							wall.posNum = (nextPos==wall.posList[0])?0:wall.posNum+1;
						}
						posOffset = {x1: wall.x1 - currPos.x1, y1: wall.y1 - currPos.y1};
						playersOnWall.forEach(uid => {
							Game.players.forEach(player => {
								if (Game.players.find(player => {return player.uid == uid})) {
									player.x += posOffset.x1;
									player.y += posOffset.y1;
								}
							});
						});
						Game.players.forEach(player => {
							if (player.level == index) {
								player.ws.send('1|' + wall.uid + '|x1|' + wall.x1);
								player.ws.send('1|' + wall.uid + '|y1|' + wall.y1);
								player.ws.send('1|' + wall.uid + '|x2|' + wall.x2);
								player.ws.send('1|' + wall.uid + '|y2|' + wall.y2);
							}
						});
						break;
				}
			});
		});
		Game.players.forEach(function(player) {
			// handle collisions and movement (velocity)
			player.handleVelAndCol();
	
			// send data about player position and current level
			var data = '0|' + player.level + '|' + player.uid + '|' + player.name + '|' + player.state + '|' + player.w + '|' + player.h + '|' + player.x + '|' + player.y;
			Game.players.forEach(function(plr) {
				if (plr.level == player.level && plr != player) {
					data+='|' + plr.uid + '|' + plr.name + '|' + plr.state + '|' + plr.w + '|' + plr.h + '|' + plr.x + '|' + plr.y;
				}
			});
			if (player.lastSent != data) {
				player.ws.send(data);
				player.lastSent = data;
			}
		});
	}, (1000/24)),
	// returns smallest availible UID
	genUID: function() {
		var uid = 0;
		while (Game.players.find(function(plr) {return plr.uid == uid})) {
			uid++;
		}
		return uid;
	},
	fling: function(plr, xVel, yVel) {
		Game.players[plr].xVel += (xVel==undefined)?Math.floor(Math.random()*100)-50:xVel;
		Game.players[plr].yVel += (yVel==undefined)?Math.floor(Math.random()*-50):yVel;
		console.log(Game.players[plr].xVel + ' ' + Game.players[plr].yVel);
	},
	kick: function(uid, message) {
		let player = Game.players.find(function(plr) {return plr.uid == uid});
		if (player.ws != undefined) {
			player.ws.close();
			console.log(message);
		} else {
			console.log('Attempted to kick player ' + uid + ', but player doesnt exist');
		}
	}	
};

const wss = new WebSocket.Server({
	port: 25565
}, function() {
	console.log('Running websocket server');
});

wss.on('connection', function(ws) {
	if (Game.players.length >= 10) ws.close();
	var player = new Game.Player({
		ws: ws,
		w: 20,
		h: 20,
		x: Game.levels[0].startPos.x,
		y: Game.levels[0].startPos.y,
		maxSpeed: 10,
		accelSpeed: 2,
		friction: 2.5,
		jumpHeight: 10
	});
	Game.players.push(player);
	ws.id = player.uid;
	console.log('Player ' + player.uid + ' joined');
	ws.on('message', function(message) {
		// detect irregular (potentially dangerous) requests and close client if any are found
		if (message.length != 4) Game.kick(player.uid, 'Player ' + player.uid + ' kicked for suspicious activity: ' + message.slice(0, 100));
		let data = message.split('');
		data.forEach(function(num) {
			if (num != 0 && num != 1) Game.kick(player.uid, 'Player ' + player.uid + ' kicked for suspicious activity: ' + message.slice(0, 100));
		});
		for (i=0;i<player.inputs.length;i++) {
			if (data[i] == 0 || data[i] == 1) {
				player.inputs[i] = data[i];
			}
		}
	});
	ws.on('close', function() {
		console.log('Player ' + player.uid + ' left');
		Game.players.splice(Game.players.findIndex(function(plr) {return plr.uid == player.uid}), 1);
	});
});

var stdin = process.openStdin();
stdin.addListener("data", function(d) {
	try {
		console.log(eval(d.toString().trim()));
	} catch (err) {
		console.log(err);
	}
});
