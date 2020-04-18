import Phaser from 'phaser';
import SuperScene from './scaffolding/SuperScene';
import prop, {tileDefinitions} from './props';
import analytics from './scaffolding/lib/analytics';

const FAR_EDGE = 'FAR_EDGE';

export default class PlayScene extends SuperScene {
  constructor() {
    super({
      input: {
        gamepad: true,
      },
      physics: {
        arcade: {
          fps: 60,
        },
      },
    });

    this.performanceProps = [];
    this.mapsAreRectangular = true;
  }

  initialSaveState() {
    return {
      createdAt: Date.now(),
    };
  }

  saveStateVersion() {
    return 1;
  }

  migrateSaveStateVersion1(save) {
  }

  init(config) {
    super.init(config);
    this.config = config;
    this.xBorder = this.yBorder = 0;
  }

  preload() {
    super.preload();
  }

  create(config) {
    super.create(config);

    this.loadLevel(config.levelId || 'test');
  }

  loadLevel(id) {
    const level = this.level = super.loadLevel(id);

    this.createMap();

    this.level.player = this.createPlayer();
    this.level.followers = this.createFollowers();
    this.level.boundary = this.createBoundary();

    this.setupPhysics();

    return level;
  }

  createMap() {
    const {level} = this;
    const {tileWidth, tileHeight} = this.game.config;
    const halfHeight = tileHeight / 2;
    const halfWidth = tileWidth / 2;
    const radius = (halfHeight + halfWidth) / 2;

    const groups = level.groups = {};
    Object.values(tileDefinitions).forEach((spec) => {
      if (spec.group) {
        let group;
        if (spec.isStatic) {
          group = this.physics.add.staticGroup({key: spec.group});
        } else {
          group = this.physics.add.group({key: spec.group});
        }

        groups[spec.group] = {
          tiles: [],
          objects: [],
          ...spec,
          group,
        };
      }
    });

    level.map.forEach((row, y) => {
      row.forEach((tile, x) => {
        const [xCoord, yCoord] = this.positionToScreenCoordinate(tile.x, tile.y);

        let object;
        if (tile.group) {
          const group = groups[tile.group];
          object = group.group.create(xCoord + halfWidth, yCoord + halfHeight, tile.image);
          group.objects.push(object);

          if (tile.isCircle) {
            object.setCircle(radius);
          }
        } else {
          object = this.add.image(xCoord + halfWidth, yCoord + halfHeight, tile.image);
        }
        object.tile = tile;
        tile.object = object;
      });
    });
  }

  createBoundary() {
    const {level} = this;
    const {width: levelWidth, height: levelHeight} = level;
    const {tileWidth, tileHeight} = this.game.config;

    const boundary = this.physics.add.staticGroup({key: 'boundary'});

    const bw = tileWidth * 10;
    const bh = tileHeight * 10;

    const top = [-bw / 2, -bw, levelWidth + bw, bh];
    const bottom = [-bw / 2, levelHeight, levelWidth + bw, bh];
    const left = [-bw, -bh / 2, bw, levelHeight + bh];
    const right = [levelWidth, -bh / 2, bw, levelHeight + bh];
    [bottom, left, right, top].forEach(([x, y, w, h]) => {
      const border = this.add.rectangle(x + w * 0.5, y + h * 0.5, w, h);
      boundary.add(border);
    });

    return boundary;
  }

  createPlayer() {
    const {level} = this;
    const {tileHeight, tileWidth} = this.game.config;
    const halfWidth = tileWidth / 2;
    const halfHeight = tileHeight / 2;

    let x;
    let y;
    if (this.config.player) {
      [x, y] = [this.config.player.x, this.config.player.y];
    } else {
      const tile = level.mapLookups['@'][0];
      [x, y] = this.positionToScreenCoordinate(tile.x, tile.y);
      x += halfWidth;
      y += halfHeight;
    }

    if (x === 'FAR_EDGE') {
      x = level.width - tileWidth * 2;
    }
    if (y === 'FAR_EDGE') {
      y = level.height - tileHeight * 2;
    }

    const player = this.physics.add.sprite(x, y, 'spritePlayer');
    player.body.setMass(prop('player.mass'));
    player.setBounce(prop('player.bounce'));
    player.setDrag(prop('player.drag'));
    player.setMaxVelocity(prop('player.maxVelocity'));
    player.setDamping(true);
    player.setFriction(prop('player.friction'));
    player.setCircle((halfWidth + halfHeight) / 2);

    this.cameraFollow(player);

    return player;
  }

  createFollowers() {
    const {level} = this;
    const {tileHeight, tileWidth} = this.game.config;
    const halfWidth = tileWidth / 2;
    const halfHeight = tileHeight / 2;

    const followerGroup = this.physics.add.group({key: 'followers'});

    const mass = prop('follower.mass');
    const bounce = prop('follower.bounce');
    const drag = prop('follower.drag');
    const friction = prop('follower.friction');
    const maxVelocity = prop('follower.maxVelocity');
    const radius = (halfWidth + halfHeight) / 2;

    const tiles = level.mapLookups['+'] || [];
    const followers = tiles.map((tile) => {
      const [xCoord, yCoord] = this.positionToScreenCoordinate(tile.x, tile.y);

      const follower = followerGroup.create(xCoord + halfWidth, yCoord + halfHeight, 'spriteFollower');

      follower.body.setMass(mass);
      follower.setBounce(bounce);
      follower.setDrag(drag);
      follower.setDamping(true);
      follower.setFriction(friction);
      follower.setMaxVelocity(maxVelocity);
      follower.setCircle(radius);
      follower.isFollower = true;

      return follower;
    });

    level.followers = followers;
    level.followerGroup = followerGroup;

    return followers;
  }

  setupAnimations() {
  }

  setupPhysics() {
    const {level, physics} = this;
    const {
      player, groups, followerGroup, boundary,
    } = level;

    physics.add.overlap(player, groups.transition.group, this.enteredTransition, null, this);
    physics.add.collider(player, groups.rock.group);

    physics.add.collider(followerGroup, player);
    physics.add.collider(followerGroup, groups.rock.group);
    physics.add.collider(followerGroup, followerGroup);
    physics.add.collider(followerGroup, boundary);
    // not needed because world collide
    // physics.add.collider(followerGroup, groups.transition.group);
  }

  enteredTransition(player, transition) {
    if (this.transitioning) {
      return;
    }

    const {tileWidth, tileHeight} = this.game.config;
    const {x, y} = transition.tile;
    let direction = 'right';
    let animation = 'pushRight';
    const playerConfig = {};

    // TODO derive this scale
    let dx = 3.25 * tileWidth;
    let dy = 3.25 * tileHeight;

    if (x <= 0) {
      direction = 'left';
      animation = 'pushRight';
      playerConfig.y = player.y;
      playerConfig.x = FAR_EDGE;
      dy = 0;
      dx *= -1;
    } else if (y <= 0) {
      direction = 'up';
      animation = 'pushDown';
      playerConfig.x = player.x;
      playerConfig.y = FAR_EDGE;
      dx = 0;
      dy *= -1;
    } else if (x >= this.level.widthInTiles - 1) {
      direction = 'right';
      animation = 'pushLeft';
      playerConfig.y = player.y;
      playerConfig.x = 2 * tileWidth;
      dy = 0;
    } else if (y >= this.level.heightInTiles - 1) {
      direction = 'down';
      animation = 'pushUp';
      playerConfig.x = player.x;
      playerConfig.y = 2 * tileHeight;
      dx = 0;
    }

    this.transitioning = {
      direction,
    };

    const nextLevel = this.level[direction];
    if (!nextLevel) {
      console.error('missing next level for direction', direction);
    }

    let oldX;
    let oldY;
    let newX;
    let newY;

    this.replaceWithSelf(
      true,
      {
        levelId: nextLevel,
        player: playerConfig,
      },
      {
        name: 'effects.sceneTransition',
        animation,
        onUpdate: (progress, oldScene, newScene) => {
          if (oldX === undefined) {
            oldX = oldScene.level.player.x;
            oldY = oldScene.level.player.y;
            newX = newScene.level.player.x;
            newY = newScene.level.player.y;
          }
          oldScene.level.player.x = oldX + dx * progress;
          oldScene.level.player.y = oldY + dy * progress;
          newScene.level.player.x = newX + dx * (progress - 1);
          newScene.level.player.y = newY + dy * (progress - 1);
        },
      },
    );
  }

  musicName() {
  }

  firstUpdate(time, dt) {
    super.firstUpdate(time, dt);
  }

  processInput(time, dt) {
    const {command, level} = this;
    const {player} = level;

    let ax = 0;
    let ay = 0;

    if (command.up.held) {
      ay = -1;
    } else if (command.down.held) {
      ay = 1;
    }

    if (command.right.held) {
      ax = 1;
    } else if (command.left.held) {
      ax = -1;
    }

    if (ax || ay) {
      if (ax && ay) {
        ax *= Math.SQRT1_2;
        ay *= Math.SQRT1_2;
      }
      const accel = prop('player.acceleration');
      player.body.setAcceleration(ax * accel, ay * accel);
    } else {
      player.body.setAcceleration(0, 0);
    }
  }

  fixedUpdate(time, dt) {
    this.processInput();
    this.flockFollowers();
  }

  followersNearPoint(x, y, r) {
    // overlapCirc was added in a newer version of phaser
    return this.physics.overlapRect(x - r / 2, y - r / 2, r, r, true, false).map((body) => body.gameObject).filter((object) => object.isFollower);
  }

  enemiesNearPoint(x, y, r) {
    return this.physics.overlapRect(x - r / 2, y - r / 2, r, r, true, false).map((body) => body.gameObject).filter((object) => object.isEnemy);
  }

  obstaclesNearPoint(x, y, r) {
    return this.physics.overlapRect(x - r / 2, y - r / 2, r, r, false, true).map((body) => body.gameObject).filter((object) => object.tile && object.tile.isObstacle);
  }

  normalizeVector(dx, dy) {
    const d = Math.sqrt(dx ** 2 + dy ** 2); // fffs
    return [dx / d, dy / d];
  }

  avoidVector(objects, ox, oy, r) {
    let x = 0;
    let y = 0;
    let count = 0;

    objects.forEach((object) => {
      const dx = ox - object.x;
      const dy = oy - object.y;
      const d = Math.sqrt(dx ** 2 + dy ** 2);
      if (d > r) {
        return;
      }

      x += dx / (d ** 2);
      y += dy / (d ** 2);
      count += 1;
    });

    if (count === 0) {
      return null;
    }

    x /= count;
    x /= count;

    return this.normalizeVector(x, y);
  }

  flockFollowers() {
    const {level} = this;
    const {followers, player} = level;

    const px = player.x;
    const py = player.y;

    const acceleration = prop('follower.flockAcceleration');
    const cohereRadius = prop('follower.cohereRadius');
    const spreadRadius = prop('follower.spreadRadius');
    const cohereFactor = prop('follower.cohereFactor');
    const spreadFactor = prop('follower.spreadFactor');
    const playerFactor = prop('follower.playerFactor');
    const playerRadius = prop('follower.playerRadius');
    const obstacleFactor = prop('follower.obstacleFactor');
    const obstacleRadius = prop('follower.obstacleRadius');
    const enemyFactor = prop('follower.enemyFactor');
    const enemyRadius = prop('follower.enemyRadius');

    followers.forEach((follower) => {
      const fx = follower.x;
      const fy = follower.y;
      const cohereFollowers = this.followersNearPoint(fx, fy, cohereRadius);

      let hasFocus = false;
      let targetX = 0;
      let targetY = 0;

      {
        const playerDX = px - fx;
        const playerDY = py - fy;
        const d = Math.sqrt(playerDX ** 2 + playerDY ** 2);
        const [playerX, playerY] = [playerDX / d, playerDY / d];
        if (d < playerRadius) {
          targetX += playerX * playerFactor;
          targetY += playerY * playerFactor;
          hasFocus = true;
        }
      }

      if (cohereFollowers.length > 1) {
        let cx = 0;
        let cy = 0;
        cohereFollowers.forEach((f) => {
          cx += f.x - fx;
          cy += f.y - fy;
        });
        cx /= cohereFollowers.length;
        cy /= cohereFollowers.length;

        const [cohereX, cohereY] = this.normalizeVector(cx, cy);
        targetX += cohereX * cohereFactor;
        targetY += cohereY * cohereFactor;
        hasFocus = true;
      }

      {
        const spreadFollowers = cohereRadius > spreadRadius ? cohereFollowers : this.followersNearPoint(fx, fy, spreadRadius);
        const spreadVector = this.avoidVector([player, ...spreadFollowers.filter((s) => s !== follower)], fx, fy, spreadRadius);
        if (spreadVector) {
          const [x, y] = this.normalizeVector(...spreadVector);
          targetX += x * spreadFactor;
          targetY += y * spreadFactor;
          hasFocus = true;
        }
      }

      {
        const obstacles = this.obstaclesNearPoint(fx, fy, obstacleRadius);
        const obstacleVector = this.avoidVector(obstacles, fx, fy, obstacleRadius);
        if (obstacleVector) {
          const [x, y] = this.normalizeVector(...obstacleVector);
          targetX += x * obstacleFactor;
          targetY += y * obstacleFactor;
          hasFocus = true;
        }
      }

      {
        const enemies = this.enemiesNearPoint(fx, fy, enemyRadius);
        const enemyVector = this.avoidVector(enemies, fx, fy, enemyRadius);
        if (enemyVector) {
          const [x, y] = this.normalizeVector(...enemyVector);
          targetX += x * enemyFactor;
          targetY += y * enemyFactor;
          hasFocus = true;
        }
      }

      if (hasFocus) {
        const theta = Math.atan2(targetY, targetX);
        follower.body.setAcceleration(acceleration * Math.cos(theta), acceleration * Math.sin(theta));
      } else {
        follower.body.setAcceleration(0, 0);
      }
    });
  }

  willTransitionTo(newScene, transition) {
    super.willTransitionTo(newScene, transition);
  }

  willTransitionFrom(oldScene, transition) {
    super.willTransitionFrom(oldScene, transition);

    if (oldScene && oldScene.transitioning) {
      this.transitioning = true;
    }
  }

  didTransitionTo(newScene, transition) {
    super.didTransitionTo(newScene, transition);
  }

  didTransitionFrom(oldScene, transition) {
    super.didTransitionFrom(oldScene, transition);
    this.transitioning = null;
  }

  launchTimeSight() {
    super.launchTimeSight();
  }

  renderTimeSightFrameInto(scene, phantomDt, time, dt, isLast) {
    const objects = [];

    return objects;
  }

  debugHandlePointerdown(event) {
    let {x, y} = event;
    const {level} = this;
    const {player} = level;

    x += this.camera.scrollX;
    y += this.camera.scrollY;

    player.body.setAcceleration(0, 0);
    player.body.setVelocity(0, 0);
    player.x = x;
    player.y = y;
  }

  _hotReloadCurrentLevel() {
    super._hotReloadCurrentLevel({
    }, {
      animation: 'crossFade',
      duration: 200,
      delayNewSceneShader: true,
      removeOldSceneShader: true,
    }).then((scene) => {
    });
  }

  _hot() {
    this._hotReloadCurrentLevel();
  }
}
