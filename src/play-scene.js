import SuperScene from './scaffolding/SuperScene';
import prop, {tileDefinitions} from './props';
import analytics from './scaffolding/lib/analytics';
import {
  Distance, NormalizeVector, TowardCentroid, AvoidObjects,
  AvoidObject, AvoidClosestObject, SeekClosestObject,
} from './vector';

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
    this.level.enemies = this.createEnemies();
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

  createEnemies() {
    const {level} = this;
    const {tileHeight, tileWidth} = this.game.config;
    const halfWidth = tileWidth / 2;
    const halfHeight = tileHeight / 2;

    const enemyGroup = this.physics.add.group({key: 'enemies'});

    const mass = prop('enemy.mass');
    const bounce = prop('enemy.bounce');
    const drag = prop('enemy.drag');
    const friction = prop('enemy.friction');
    const maxVelocity = prop('enemy.maxVelocity');
    const radius = (halfWidth + halfHeight) / 2;

    const enemies = [];

    Object.entries(tileDefinitions).forEach(([glyph, spec]) => {
      if (!spec.enemy) {
        return;
      }
      const tiles = level.mapLookups[glyph] || [];
      const e = tiles.map((tile) => {
        const [xCoord, yCoord] = this.positionToScreenCoordinate(tile.x, tile.y);

        const enemy = enemyGroup.create(xCoord + halfWidth, yCoord + halfHeight, spec.enemy);

        enemy.body.setMass(mass);
        enemy.setBounce(bounce);
        enemy.setDrag(drag);
        enemy.setDamping(true);
        enemy.setFriction(friction);
        enemy.setMaxVelocity(maxVelocity);
        enemy.setCircle(radius);
        enemy.isEnemy = true;

        return enemy;
      });

      enemies.push(...e);
    });

    level.enemies = enemies;
    level.enemyGroup = enemyGroup;

    return enemies;
  }

  setupAnimations() {
  }

  setupPhysics() {
    const {level, physics} = this;
    const {
      player, groups, followerGroup, enemyGroup, boundary,
    } = level;

    physics.add.overlap(player, groups.transition.group, this.enteredTransition, null, this);
    physics.add.collider(player, groups.rock.group);
    physics.add.overlap(player, enemyGroup, this.playerKillEnemy, null, this);

    physics.add.collider(followerGroup, player);
    physics.add.collider(followerGroup, groups.rock.group);
    physics.add.collider(followerGroup, followerGroup);
    physics.add.collider(followerGroup, boundary);
    // not needed because world collide
    // physics.add.collider(followerGroup, groups.transition.group);

    physics.add.collider(enemyGroup, player);
    physics.add.collider(enemyGroup, groups.rock.group);
    physics.add.collider(enemyGroup, enemyGroup);
    physics.add.collider(enemyGroup, boundary);
    physics.add.overlap(enemyGroup, followerGroup, this.enemyKillFollower, null, this);
  }

  enemyKillFollower(enemy, follower) {
    const {level} = this;
    level.followers = level.followers.filter((f) => f !== follower);
    follower.destroy();
  }

  playerKillEnemy(player, enemy) {
    const {level} = this;
    level.enemies = level.enemies.filter((f) => f !== enemy);
    enemy.destroy();
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

    if (command.lstick.held) {
      [ax, ay] = command.lstick.held;
    } else if (command.rstick.held) {
      [ax, ay] = command.rstick.held;
    }

    if (ax || ay) {
      if (ax && ay) {
        [ax, ay] = NormalizeVector(ax, ay);
        // ax *= Math.SQRT1_2;
        // ay *= Math.SQRT1_2;
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
    this.flockEnemies();
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

  flockFollowers() {
    const {level} = this;
    const {followers, player} = level;

    const px = player.x;
    const py = player.y;

    const acceleration = prop('follower.flockAcceleration');
    const cohereRadius = prop('follower.cohereRadius');
    const cohereFactor = prop('follower.cohereFactor');
    const spreadRadius = prop('follower.spreadRadius');
    const spreadFactor = prop('follower.spreadFactor');
    const playerFactor = prop('follower.playerFactor');
    const playerRadius = prop('follower.playerRadius');
    const obstacleFactor = prop('follower.obstacleFactor');
    const obstacleRadius = prop('follower.obstacleRadius');
    const enemyFactor = prop('follower.enemyFactor');
    const enemyRadius = prop('follower.enemyRadius');
    const killerFactor = prop('follower.killerFactor');
    const killerRadius = prop('follower.killerRadius');

    followers.forEach((follower) => {
      const fx = follower.x;
      const fy = follower.y;

      let hasFocus = false;
      let targetX = 0;
      let targetY = 0;

      if (playerFactor > 0) {
        const dx = px - fx;
        const dy = py - fy;
        const d = Distance(dx, dy);
        if (d < playerRadius) {
          targetX += (dx / d) * playerFactor;
          targetY += (dy / d) * playerFactor;
          hasFocus = true;
        }
      }

      if (cohereFactor > 0) {
        const fs = this.followersNearPoint(fx, fy, cohereRadius);
        if (fs.length > 1) {
          const [x, y] = TowardCentroid(fs, fx, fy);
          targetX += x * cohereFactor;
          targetY += y * cohereFactor;
          hasFocus = true;
        }
      }

      if (spreadFactor > 0) {
        const fs = this.followersNearPoint(fx, fy, spreadRadius);
        const os = [player, ...fs.filter((f) => f !== follower)];
        const v = AvoidObjects(os, fx, fy, spreadRadius);
        if (v) {
          targetX += v[0] * spreadFactor;
          targetY += v[1] * spreadFactor;
          hasFocus = true;
        }
      }

      if (obstacleFactor > 0) {
        const os = this.obstaclesNearPoint(fx, fy, obstacleRadius);
        const v = AvoidObjects(os, fx, fy, obstacleRadius);
        if (v) {
          targetX += v[0] * obstacleFactor;
          targetY += v[1] * obstacleFactor;
          hasFocus = true;
        }
      }

      if (enemyFactor > 0) {
        const es = this.enemiesNearPoint(fx, fy, enemyRadius);
        const v = AvoidObjects(es, fx, fy, enemyRadius);
        if (v) {
          targetX += v[0] * enemyFactor;
          targetY += v[1] * enemyFactor;
          hasFocus = true;
        }
      }

      if (killerFactor > 0) {
        const es = this.enemiesNearPoint(fx, fy, killerRadius);
        if (es.length > 0) {
          const v = AvoidClosestObject(es, fx, fy);
          if (v) {
            targetX += v[0] * killerFactor;
            targetY += v[1] * killerFactor;
            hasFocus = true;
          }
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

  flockEnemies() {
    const {level} = this;
    const {followers, enemies, player} = level;

    const px = player.x;
    const py = player.y;

    const acceleration = prop('enemy.flockAcceleration');
    const cohereRadius = prop('enemy.cohereRadius');
    const cohereFactor = prop('enemy.cohereFactor');
    const spreadRadius = prop('enemy.spreadRadius');
    const spreadFactor = prop('enemy.spreadFactor');
    const avoidPlayerFactor = prop('enemy.avoidPlayerFactor');
    const avoidPlayerRadius = prop('enemy.avoidPlayerRadius');
    const seekPlayerFactor = prop('enemy.seekPlayerFactor');
    const seekPlayerRadius = prop('enemy.seekPlayerRadius');
    const obstacleFactor = prop('enemy.obstacleFactor');
    const obstacleRadius = prop('enemy.obstacleRadius');
    const followerFactor = prop('enemy.followerFactor');
    const followerRadius = prop('enemy.followerRadius');
    const victimFactor = prop('enemy.victimFactor');
    const victimRadius = prop('enemy.victimRadius');

    enemies.forEach((enemy) => {
      const fx = enemy.x;
      const fy = enemy.y;

      let hasFocus = false;
      let targetX = 0;
      let targetY = 0;

      if (avoidPlayerFactor > 0) {
        const v = AvoidObject(player, fx, fy, avoidPlayerRadius);
        if (v) {
          targetX += v[0] * avoidPlayerFactor;
          targetY += v[1] * avoidPlayerFactor;
          hasFocus = true;
        }
      }

      if (seekPlayerFactor > 0) {
        const dx = px - fx;
        const dy = py - fy;
        const d = Distance(dx, dy);
        if (d < seekPlayerRadius) {
          targetX += (dx / d) * seekPlayerFactor;
          targetY += (dy / d) * seekPlayerFactor;
          hasFocus = true;
        }
      }

      if (cohereFactor > 0) {
        const fs = this.enemiesNearPoint(fx, fy, cohereRadius);
        if (fs.length > 1) {
          const [x, y] = TowardCentroid(fs, fx, fy);
          targetX += x * cohereFactor;
          targetY += y * cohereFactor;
          hasFocus = true;
        }
      }

      if (spreadFactor > 0) {
        const es = this.enemiesNearPoint(fx, fy, spreadRadius).filter((e) => e !== enemy);
        if (es.length) {
          const v = AvoidObjects(es, fx, fy, spreadRadius);
          if (v) {
            targetX += v[0] * spreadFactor;
            targetY += v[1] * spreadFactor;
            hasFocus = true;
          }
        }
      }

      if (obstacleFactor > 0) {
        const os = this.obstaclesNearPoint(fx, fy, obstacleRadius);
        const v = AvoidObjects(os, fx, fy, obstacleRadius);
        if (v) {
          targetX += v[0] * obstacleFactor;
          targetY += v[1] * obstacleFactor;
          hasFocus = true;
        }
      }

      if (followerFactor > 0) {
        const fs = this.followersNearPoint(fx, fy, followerRadius);
        if (fs.length) {
          const v = TowardCentroid(fs, fx, fy, followerRadius);
          if (v) {
            targetX += v[0] * followerFactor;
            targetY += v[1] * followerFactor;
            hasFocus = true;
          }
        }
      }

      if (victimFactor > 0) {
        const fs = this.followersNearPoint(fx, fy, victimRadius);
        if (fs.length > 0) {
          const v = SeekClosestObject(fs, fx, fy);
          if (v) {
            targetX += v[0] * victimFactor;
            targetY += v[1] * victimFactor;
            hasFocus = true;
          }
        }
      }

      if (hasFocus) {
        const theta = Math.atan2(targetY, targetX);
        enemy.body.setAcceleration(acceleration * Math.cos(theta), acceleration * Math.sin(theta));
      } else {
        enemy.body.setAcceleration(0, 0);
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
