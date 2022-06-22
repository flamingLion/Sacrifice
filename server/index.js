// this line is a test
/*

╔═╗──────────╔╗╔═╗╔╗──────
║═╣╔═╗─╔═╗╔╦╗╠╣║═╣╠╣╔═╗╔═╗
╠═║║╬╚╗║═╣║╔╝║║║╔╝║║║═╣║╩╣
╚═╝╚══╝╚═╝╚╝─╚╝╚╝─╚╝╚═╝╚═╝
			*/
/*					     *\
TODO: located at todo.list

Levels.json legend:
[type, x1, y1, x2, y2, individual id, toggled]
0: wall
1: win
2: death
3: button
4: controlled wall (door)
5: bounce pad
6: climbable platform
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
		this.handleSolidCol = function(wall, config) {
			var specialBehav = {};
			if (config != undefined) specialBehav = config; 
			// if player is above wall
			if (this.y + this.h <= wall[2]) {
				if (specialBehav.above != undefined) {
					specialBehav.above();
				} else {
					this.y = wall[2] - this.h;
					this.yVel = 0;
					this.canJump = true;
				}
			}
			// if player is below wall
			if (this.y >= wall[4]) {
				if (specialBehav.below != undefined) {
					specialBehav.below();
				} else {
					this.y = wall[4];
					this.yVel = 0;
				}
			}
			// if player is left of wall
			if (this.x + this.w <= wall[1]) {
				if (specialBehav.left != undefined) {
					specialBehav.left();
				} else {
					this.x = wall[1] - this.w;
					this.xVel = 0;
				}
			}
			// if player is right of wall
			if (this.x >= wall[3]) {
				if (specialBehav.right != undefined) {
					specialBehav.right();
				} else {
					this.x = wall[3];
					this.xVel = 0;
				}
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
				if (this.x + this.w >= wall[1] && this.x <= wall[3] && this.y + this.h == wall[2]) {
					this.isOnWall = true;
					// handle player stepping on a button
					if (wall[0] == 3 && !this.buttons.includes(wall[5])) {
						this.buttons.push(wall[5]);
						Game.players.forEach(function(player) {
							if (player.level == this.level) player.ws.send('2|' + wall[5] + '|1');
						}, this);
						Game.levels[this.level].walls.forEach(function(wll) {
							if (wll[5] == wall[5]) wll[6] = 1;
						});
					}
				// handle when player steps off a button
				} else if (this.buttons.includes(wall[5]) && wall[0] == 3) {
					this.buttons.splice(this.buttons.indexOf(wall[5]), 1);
					Game.players.forEach(function(player) {
						if (player.level == this.level) player.ws.send('2|' + wall[5] + '|0');
					}, this);
					Game.levels[this.level].walls.forEach(function(wll) {
						if (wll[5] == wall[5]) wll[6] = 0;
					});
				}
				// if player is in a wall on the next frame
				if (this.x + this.xVel < wall[3] && this.x + this.xVel + this.w > wall[1] && this.y + this.yVel + this.h > wall[2] && this.y + this.yVel < wall[4]) {
					switch (wall[0]) {
						case 0: 
							this.handleSolidCol(wall);
							break;
						case 1:
							this.level++;
							this.respawn();
							break;
						case 2:
							this.respawn();
							break;
						case 3:
							this.handleSolidCol(wall);
							break;
						case 4:
							if (wall[6]) break;
							this.handleSolidCol(wall);
							break;
						case 5:
							this.handleSolidCol(wall, {above: function() {
								this.y = wall[2] - this.h;
								this.yVel *= -0.8;
								if (Math.abs(this.yVel) < 5) {
									this.canJump = true;
									this.isOnWall = true;
								}
							}});
							break;
						case 6:
							this.handleSolidCol(wall, {left: function() {
								this.x = wall[1] - this.w;
								this.xVel = 0;
								if (Math.abs(this.yVel) < this.jumpHeight) this.canJump = true;
								this.isOnWall = true;
							}, right: function(){
								this.x = wall[3];
								this.xVel = 0;
								if (Math.abs(this.yVel) < this.jumpHeight) this.canJump = true;
								this.isOnWall = true;
							}});
							break;
					}
				}
			}, this);
			if (!this.isOnWall) this.canJump = false;
/*			this.buttons.forEach(function(buttonId) {
				Game.levels[this.level].walls.forEach(function(wall) {
					if (wall[5] == buttonId && wall[0] == 4) wall[6] == 1;
				});
			}, this);*/
			// move player relative to velocity
			this.x+=this.xVel;
			this.y+=this.yVel;
		};
	},
	// game loops at 24 fps
	gameLoop: setInterval(function() {
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
		var data = message.split('');
		// detect irregular (potentially dangerous) requests and close client if any are found
		var poisoned = false;
		if (message.length != 4) poisoned = true;
		data.forEach(function(num) {
			if (num != 0 && num != 1) poisoned = true;
		});
		if (poisoned) {
			console.log('Player ' + player.uid + ' kicked for suspicious activity: ' + message);
			ws.close();
		} else {
			for (i=0;i<player.inputs.length;i++) {
				if (data[i] == 0 || data[i] == 1) {
					player.inputs[i] = data[i];
				}
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
