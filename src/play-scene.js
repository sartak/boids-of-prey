import SuperScene from './scaffolding/SuperScene';
import prop, {tileDefinitions} from './props';
import analytics from './scaffolding/lib/analytics';
import {
  Distance, NormalizeVector, TowardCentroid, AvoidObjects,
  AvoidObject, AvoidClosestObject, SeekClosestObject,
  ClosestObject,
} from './vector';

const FAR_EDGE = 'FAR_EDGE';
const tileHeight = 24;
const tileWidth = 24;
const halfWidth = tileWidth / 2;
const halfHeight = tileHeight / 2;

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
      levelId: 'intro',
      wonLevel: {
      },
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

    if (config.levelId === undefined) {
      config.levelId = this.save.levelId;
      if (this.save.levelPlayer) {
        config.player = this.save.levelPlayer;
      }
    }
  }

  preload() {
    super.preload();
  }

  create(config) {
    super.create(config);

    const levelId = config.levelId || 'intro';
    this.loadLevel(levelId);
    this.flock_amount = 0;

    this.save.levelId = levelId;
    this.save.levelPlayer = config.player;
    this.saveState();
  }

  getTreasure(name) {
    this.save[name] = true;
    this.saveState();
  }

  createTreasure(defer) {
    const {level} = this;
    const treasureGroup = level.treasureGroup || this.physics.add.staticGroup();
    level.treasureGroup = treasureGroup;

    if (defer) {
      return;
    }

    const [tile] = level.mapLookups.$ || [];
    if (!tile) {
      return;
    }

    const [xCoord, yCoord] = this.positionToScreenCoordinate(tile.x, tile.y);

    level.treasure = treasureGroup.create(xCoord + halfWidth, yCoord + halfHeight, 'tileTreasureClosed');
  }

  collectTreasure(player, treasure) {
    const {x, y} = treasure;
    if (treasure.collected) {
      return;
    }

    treasure.collected = true;
    treasure.setTexture('tileTreasureOpen');
    this.speak(x - tileWidth, y + tileHeight, this.level.treasureScript);
  }

  loadLevel(id) {
    const level = this.level = super.loadLevel(id);
    level.levelId = id;

    this.level.blockades = [];

    this.createUnderground(level.underground || 'imageBackground');

    this.createMap();

    if (!this.save.wonLevel[id]) {
      this.closeExits(false, true);
    }

    this.level.player = this.createPlayer();
    this.level.followers = this.createFollowers();
    this.level.enemies = this.createEnemies(true);
    this.level.boundary = this.createBoundary();
    this.level.treasure = this.createTreasure(true);

    this.setupPhysics();

    if (level.scripts) {
      level.scripts = JSON.parse(JSON.stringify(level.scripts));
      level.scripts.forEach((script) => {
        if (script[1] === null) {
          const glyph = script[2];
          const tile = level.mapLookups[glyph][0];
          script[1] = tile.xCoord + tileWidth;
          script[2] = tile.yCoord - tileHeight;
        }
      });
    }

    this.night_amount = this.old_night_amount || 0;
    this.flock_amount = this.old_flock_amount || 0;
    this.tweenNightAmount(level.initialNight || 0);
    this.tweenFlockAmount(0);
    if (this.oldScene) {
      this.oldScene.tweenNightAmount(level.initialNight || 0);
      this.oldScene.tweenFlockAmount(0);
    }

    return level;
  }

  createTileForGroup(groupName, x, y) {
    const {level} = this;
    const group = level.groups[groupName];

    if (group.above) {
      this.add.image(x, y, group.above);
    }

    let object;

    if (group.image) {
      object = group.group.create(x, y, group.image);
    } else {
      object = this.add.rectangle(x, y, tileWidth, tileHeight);
      group.group.add(object);
    }
    group.objects.push(object);

    if (group.isCircle) {
      const radius = (halfHeight + halfWidth) / 2;
      object.setCircle(radius);
    }

    return object;
  }

  cameraColor() {
    return 0x4D8C3A;
  }

  createUnderground(name) {
    const {level} = this;
    const template = this.add.image(0, 0, name);
    const {width, height} = template;
    template.setPosition(width * -0.5, height * -0.5);

    let x = -0.5;
    let y = -0.5;

    while ((x - 1) * width < level.width + tileWidth) {
      y = -0.5;

      while ((y - 1) * height < level.height + tileHeight) {
        if (!(x === -0.5 && y === -0.5)) {
          this.add.image(x * width, y * height, name);
        }
        y += 1;
      }

      x += 1;
    }
  }

  createMap() {
    const {level} = this;

    const groups = level.groups = {};
    Object.values(tileDefinitions).forEach((spec) => {
      if (!spec) {
        return;
      }

      if (spec.group) {
        let group;
        if (spec.isStatic) {
          group = this.physics.add.staticGroup();
        } else {
          group = this.physics.add.group();
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
        tile.xCoord = xCoord;
        tile.yCoord = yCoord;

        let object;
        if (tile.group) {
          object = this.createTileForGroup(tile.group, xCoord + halfWidth, yCoord + halfHeight);
        } else if (tile.image) {
          object = this.add.image(xCoord + halfWidth, yCoord + halfHeight, tile.image);
        }
        if (object) {
          object.tile = tile;
          tile.object = object;
        }
      });
    });
  }

  createBoundary() {
    const {level} = this;
    const {width: levelWidth, height: levelHeight} = level;

    const boundary = this.physics.add.staticGroup();

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

    if (this.config.player && this.config.player.transitionOffset) {
      x += (this.config.player.transitionOffset.x || 0) * tileWidth;
      y += (this.config.player.transitionOffset.y || 0) * tileHeight;
    }

    const player = this.physics.add.sprite(x, y, 'spritePlayer');
    player.body.setMass(prop('player.mass'));
    player.setBounce(prop('player.bounce'));
    player.setDrag(prop('player.drag'));
    player.setMaxVelocity(prop('player.maxVelocity'));
    player.setDamping(true);
    player.setFriction(prop('player.friction'));
    player.setCircle((halfWidth + halfHeight) / 2);

    player.dash = {
      active: false,
      cooldown: false,
      ax: 0,
      ay: 0,
    };

    player.stun = {
      active: false,
      cooldown: false,
    };

    player.children = [];

    this.cameraFollow(player);

    return player;
  }

  createFollowers() {
    const {level} = this;

    const followerGroup = this.physics.add.group();

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
      follower.targetMaxVelocity = maxVelocity;
      follower.setCircle(radius);
      follower.isFollower = true;

      return follower;
    });

    level.followers = followers;
    level.followerCount = followers.length;
    level.followerGroup = followerGroup;

    return followers;
  }

  createEnemies(defer) {
    const {level} = this;
    const enemyGroup = level.enemyGroup || this.physics.add.group();
    const enemies = level.enemies || [];

    if (!defer) {
      const mass = prop('enemy.mass');
      const bounce = prop('enemy.bounce');
      const drag = prop('enemy.drag');
      const friction = prop('enemy.friction');
      const maxVelocity = prop('enemy.maxVelocity');
      const radius = (halfWidth + halfHeight) / 2;

      Object.entries(tileDefinitions).forEach(([glyph, spec]) => {
        if (!spec || !spec.enemy) {
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
          enemy.targetMaxVelocity = maxVelocity;
          enemy.setCircle(radius);
          enemy.isEnemy = true;

          return enemy;
        });

        enemies.push(...e);
      });
    }

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
      treasureGroup,
    } = level;

    physics.add.overlap(player, groups.transition.group, this.enteredTransition, null, this);
    physics.add.collider(player, groups.rock.group);
    physics.add.collider(player, groups.coop.group, this.playerCollideCoop, null, this);
    physics.add.collider(player, followerGroup, this.playerCollideFollower, null, this);
    physics.add.overlap(player, enemyGroup, this.playerKillEnemy, null, this);
    physics.add.collider(player, treasureGroup, this.collectTreasure, null, this);

    physics.add.collider(followerGroup, groups.rock.group, this.justCoolItDown, null, this);
    physics.add.collider(followerGroup, groups.coop.group, this.justCoolItDown, null, this);
    physics.add.collider(followerGroup, followerGroup, this.justCoolItDown, null, this);
    physics.add.collider(followerGroup, boundary, this.justCoolItDown, null, this);
    physics.add.collider(followerGroup, treasureGroup, this.justCoolItDown, null, this);
    // not needed because world collide
    // physics.add.collider(followerGroup, groups.transition.group);

    physics.add.collider(enemyGroup, groups.rock.group, this.justCoolItDown, null, this);
    physics.add.collider(enemyGroup, groups.coop.group, this.enemyCollideCoop, null, this);
    physics.add.collider(enemyGroup, enemyGroup, this.justCoolItDown, null, this);
    physics.add.collider(enemyGroup, boundary, this.justCoolItDown, null, this);
    physics.add.collider(enemyGroup, treasureGroup, this.justCoolItDown, null, this);
    physics.add.overlap(enemyGroup, followerGroup, this.enemyKillFollower, null, this);
  }

  damageCoop(coop) {
    coop.tile.health -= 1;
    if (coop.tile.health < 0) {
      coop.destroy();
    }

    const reduction = 1 / this.level.groups.coop.health;
    let prevFactor = 0;
    this.tweenPercent(
      100,
      (factor) => {
        coop.alpha -= (factor - prevFactor) * reduction;
        prevFactor = factor;
      },
    );
  }

  enemyCollideCoop(enemy, coop) {
    this.damageCoop(coop);
    enemy.body.setAcceleration(0, 0);
    enemy.cooldown = true;
    this.timer(() => {
      enemy.cooldown = false;
    }, 1000);
  }

  playerCollideCoop(player, coop) {
    if (player.dash.active) {
      this.damageCoop(coop);
    }
  }

  playerCollideFollower(player, follower) {
    this.justCoolItDown(player, follower);

    if (player.dash.active) {
      this.stopDash();
      this.buttobasu(player, follower);
      this.killFollower(follower);
    }
  }

  sleep(duration) {
    this.pauseEverythingForTransition();
    this.timer(() => {
      this.unpauseEverythingForTransition();
    }, duration).ignoresScenePause = true;
  }

  impact(duration, scale = 0.1) {
    this.timeScale = scale;

    this.camera.zoomTo(
      1.05,
      duration / 2,
      'Cubic.easeIn',
      true,
    );

    this.timer(() => {
      this.timeScale = 1;
      this.camera.zoomTo(
        1,
        duration,
        'Cubic.easeIn',
        true,
      );
    }, duration);
  }

  impactUnlessLosing(...args) {
    if (this.level.zoomForLossCompleted || this.level.zoomedForLoss || this.level.unzoomForLoss) {
      return;
    }

    this.impact(...args);
  }

  buttobasu(player, entity) {
    entity.disableBody();

    const [ex, ey] = NormalizeVector(entity.x - player.x, entity.y - player.y);
    const [ax, ay] = NormalizeVector(player.dash.ax, player.dash.ay);
    let dx = (ax + ex) / 2;
    let dy = (ay + ey) / 2;
    if (isNaN(dx) || isNaN(dy)) {
      dx = ex;
      dy = ey;
    }

    const pause = 40;
    this.sleep(pause * this.timeScale);
    this.timer(() => {
      this.impactUnlessLosing(400, 0.2);
    }, pause).ignoresScenePause = true;

    this.camera.shake(100, 0.005);

    // this.timer(() => {

    this.tween(
      null,
      entity,
      {
        alpha: 0,
        delay: 40,
        duration: 500,
        dx: 300 * dx,
        dy: 300 * dy,
        scaleX: 3,
        scaleY: 3,
        rotation: dx < 0 ? -300 : 300,
        ease: 'Quad.easeOut',
        onComplete: () => {
          entity.destroy();
        },
      },
    );
    // });
  }

  butsu(killer, victim) {
    victim.disableBody();

    const [ex, ey] = NormalizeVector(victim.x - killer.x, victim.y - killer.y);

    this.tween(
      null,
      victim,
      {
        alpha: 0,
        duration: 500,
        dx: 100 * ex,
        dy: 100 * ey,
        ease: 'Quad.easeOut',
        onComplete: () => {
          victim.destroy();
        },
      },
    );
  }

  justCoolItDown(a, b) {
    if (a.body && a.body.setAcceleration) {
      a.cooldown = true;
      a.body.setAcceleration(0, 0);
    }

    if (b.body && b.body.setAcceleration) {
      b.body.setAcceleration(0, 0);
      b.cooldown = true;
    }

    this.timer(() => {
      a.cooldown = false;
      b.cooldown = false;
    }, 1000);
  }

  killFollower(follower) {
    const {level} = this;
    level.followers = level.followers.filter((f) => f !== follower);
    if (level.followers.length === 0) {
      level.lastFollower = follower;
    }

    const reduction = 1 / level.followerCount;
    let prevFactor = 0;
    this.tweenPercent(
      prop('effects.followerDie.duration'),
      (factor) => {
        this.flock_amount += (factor - prevFactor) * reduction;
        prevFactor = factor;
      },
    );
  }

  enemyKillFollower(enemy, follower) {
    this.butsu(enemy, follower);
    this.killFollower(follower);
  }

  playerKillEnemy(player, enemy) {
    const {level} = this;
    level.enemies = level.enemies.filter((f) => f !== enemy);

    if (player.dash.active) {
      this.stopDash();
      this.buttobasu(player, enemy);
    } else {
      this.butsu(player, enemy);
    }

    if (level.enemies.length === 0) {
      this.timer(() => {
        this.winLevel();
      }, 1000);
    }
  }

  closeExits(animated, forward, extraDelay = 0) {
    const {level} = this;

    const glyph = forward ? ';' : '^';

    const tiles = [...level.mapLookups[glyph] || []];
    tiles.sort((a, b) => a.x - b.x || a.y - b.y);

    this.level.blockades.push(tiles);

    const time = animated ? 500 : 0;

    if (time) {
      this.command.ignoreAll('blockade', true);
    }

    tiles.forEach((tile, i) => {
      this.timer(() => {
        const {xCoord, yCoord} = tile;
        if (tile.object.disableBody) {
          tile.object.disableBody();
        } else {
          tile.object.body.enable = false;
        }
        const object = this.createTileForGroup('rock', xCoord + halfWidth, yCoord + halfHeight);
        tile.block = object;

        if (animated) {
          this.camera.shake(50, 0.01);
        }
      }, time * (i + 2));
    });

    if (time) {
      this.timer(() => {
        this.command.ignoreAll('blockade', false);
      }, time * (tiles.length + 2) + extraDelay);
    }

    return time * (tiles.length + 2);
  }

  openExits() {
    const {level} = this;

    level.blockades.forEach((tiles) => {
      tiles.forEach((tile, i) => {
        this.timer(() => {
          if (tile.object.enableBody) {
            tile.object.enableBody();
          } else {
            tile.object.body.enable = true;
          }
          tile.block.destroy();
          this.camera.shake(50, 0.01);
        }, 1000 + 500 * i);
      });
    });
  }

  winLevel() {
    if (this.level.glowEmitter) {
      this.level.glowEmitter.stop();
    }
    this.tweenNightAmount(0);
    this.tweenFlockAmount(0);
    this.openExits();
    this.save.wonLevel[this.level.levelId] = true;
    this.saveState();
  }

  replaceLostLevel() {
    if (this.replacing) {
      return;
    }

    this.replacing = true;
    this.timeScale = 1;

    this.replaceWithSelf(true, null, {
      name: 'effects.loseTransition',
      onUpdate: (factor, oldScene, newScene) => {
        if (factor <= 0.5) {
          oldScene.flock_amount = 1 - (factor * 2);
        }
      },
    });
  }

  enteredTransition(player, transition) {
    if (this.transitioning) {
      return;
    }

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

    playerConfig.transitionOffset = this.level[`${direction}Offset`];

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

    player.disableBody();
    this.timeScale = 1;

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

  stopDash() {
    const {level} = this;
    const {player} = level;

    const normalVelocity = prop('player.maxVelocity');
    player.setMaxVelocity(normalVelocity);
    player.dash.active = false;
    if (player.dashEmitter) {
      player.dashEmitter.stop();
      player.dashEmitter = false;
    }

    player.dash.cooldown = true;

    this.timer(() => {
      player.dash.cooldown = false;
    }, prop('player.dash.cooldown_duration'));
  }

  dash(ax, ay) {
    const {level} = this;
    const {player} = level;

    if (level.onDash) {
      const script = level.onDash;
      delete level.onDash;
      this.speak(player.x, player.y, script);
    }

    player.dash.active = true;
    player.dash.ax = ax;
    player.dash.ay = ay;

    const [dx, dy] = NormalizeVector(ax, ay);

    const normalVelocity = prop('player.maxVelocity');
    const dashVelocity = prop('player.dash.velocity');

    let dashEmitter;
    let dashCallback;
    this.particleSystem(
      'effects.dashPuff',
      {
        scale: {start: 0.5, end: 0},
        alpha: {start: 1, end: 0},
        onAdd: (particles, emitter) => {
          dashEmitter = emitter;
          emitter.x.propertyValue = player.x + tileWidth * dy;
          emitter.y.propertyValue = player.y + tileHeight * dy;
          dashCallback = (x, y) => {
            emitter.x.propertyValue = x + tileWidth / 2 * -dx;
            emitter.y.propertyValue = y + tileHeight / 2 * -dy;
          };
          player.children.push(dashCallback);
        },
      },
    );

    player.dashEmitter = dashEmitter;

    this.tweenSustainExclusive(
      'dashTimer',
      prop('player.dash.in_duration'),
      prop('player.dash.sustain_duration'),
      prop('player.dash.out_duration'),
      (factor) => {
        const v = normalVelocity + factor * (dashVelocity - normalVelocity);
        player.setMaxVelocity(v);
      },
      null,
      () => {
        player.dash.ax = null;
        player.dash.ay = null;
        dashEmitter.stop();
        player.children = player.children.filter((c) => c !== dashCallback);
      },
      () => {
        this.stopDash();
      },
      prop('player.dash.in_ease'),
      prop('player.dash.out_ease'),
    );
  }

  stun(ax, ay) {
    const {level} = this;
    const {player} = level;

    if (level.onStun) {
      const script = level.onStun;
      delete level.onStun;
      this.speak(player.x, player.y, script);
    }

    player.stun.active = true;

    const px = player.x;
    const py = player.y;
    this.shockwave(px, py);

    [...this.level.enemies, ...this.level.followers].forEach((entity) => {
      const distance = Distance(entity.x - px, entity.y - py);
      const effect = 1 - distance / 300;
      if (effect < 0) {
        return;
      }

      if (entity.stunAlpha) {
        entity.stunAlpha.stop();
      }
      if (entity.stunRotate) {
        entity.stunRotate.stop();
      }
      if (entity.stunRecover) {
        entity.stunRecover.stop();
      }

      const delay = distance * 0.75;

      this.timer(() => {
        entity.cooldown = true;
        entity.body.setAcceleration(0, 0);

        entity.stunAlpha = this.tween(
          null,
          entity,
          {
            alpha: 0.5,
            duration: 200,
          },
        );

        entity.stunRotate = this.tween(
          null,
          entity,
          {
            delay: 200,
            rotation: 360,
            duration: 2000 * effect,
            onComplete: () => {
              entity.stunRecover = this.tween(
                null, entity,
                {
                  alpha: 1,
                  duration: 200,
                },
              );
              entity.cooldown = false;
            },
          },
        );
      }, delay);
    });

    this.timer(() => {
      player.stun.active = false;
      player.stun.cooldown = true;
      this.timer(() => {
        player.stun.cooldown = false;
      }, 5000);
    }, 1000);
  }

  processInput(time, dt) {
    const {command, level} = this;
    const {player} = level;

    let ax = 0;
    let ay = 0;
    let stickInput = false;

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
      stickInput = true;
    } else if (command.rstick.held) {
      [ax, ay] = command.rstick.held;
      stickInput = true;
    }

    if (stickInput) {
      if (Math.abs(ax) > 0.9) {
        ax = ax < 0 ? -1 : 1;
        ay = 0;
      } else if (Math.abs(ay) > 0.9) {
        ay = ay < 0 ? -1 : 1;
        ax = 0;
      }
    }

    if (player.dash.ax) {
      ax = 0.1 * ax + 0.9 * player.dash.ax;
      ay = 0.1 * ay + 0.9 * player.dash.ay;
    }

    if (ax || ay) {
      if (ax && ay) {
        [ax, ay] = NormalizeVector(ax, ay);
      }
      const accel = prop('player.acceleration');
      player.body.setAcceleration(ax * accel, ay * accel);
    } else {
      player.body.setAcceleration(0, 0);
    }

    if (command.dash.started && this.save.dash && !player.dash.active && !player.dash.cooldown) {
      // TODO facing direction
      if (!ax && !ay) {
        ax = 1;
        ay = 0;
      }
      this.dash(ax, ay);
    }

    if (command.stun.started && this.save.stun && !player.stun.active && !player.stun.cooldown) {
      this.stun();
    }
  }

  playDialog() {
    const {level} = this;
    const {scripts, player} = level;

    if (!scripts) {
      return;
    }

    scripts.forEach((script) => {
      if (script.played) {
        return;
      }

      const [radius, x, y] = script;

      if (Distance(player.x - x, player.y - y) < radius) {
        script.played = true;

        // shift off radius
        script.shift();
        this.speak(...script);
      }
    });
  }

  fixedUpdate(time, dt) {
    this.processInput();
    this.flockFollowers();
    this.flockEnemies();
    this.zoomOnLoss();
    this.updateVelocities(time, dt);
    this.moveChildren();
    this.playDialog();

    if (!this.spawningEnemies && this['night_amount'] > 0.99 && time > 1000) {
      this.spawningEnemies = true;

      this.particleSystem(
        'effects.glow',
        {
          x: {min: 0, max: this.level.width},
          y: {min: 0, max: this.level.height},
          alpha: {
            start: 0,
            end: 1,

            ease: (t) => (t > 0.5 ? 2 * (1 - t) : t * 2),
          },
          onAdd: (particles, emitter) => {
            this.level.glowEmitter = emitter;
          },
        },
      );

      let duration = this.closeExits(true, false, 500);
      if (this.save.wonLevel[this.level.levelId]) {
        duration = Math.max(this.closeExits(true, true, 500));
      }

      this.timer(() => {
        this.createEnemies();
        this.level.enemies.forEach((enemy) => {
          enemy.alpha = 0;
          enemy.cooldown = true;
          this.tween(
            null,
            enemy,
            {
              alpha: 1,
              duration: 500,
              onComplete: () => {
                enemy.cooldown = false;
              },
            },
          );
        });
      }, duration);
    }
  }

  moveChildren() {
    const {level} = this;
    const {player} = level;

    player.children.forEach((object) => {
      if (typeof object === 'function') {
        object(player.x, player.y);
      } else {
        object.x = player.x;
        object.y = player.y;
      }
    });
  }

  tweenNightAmount(amount) {
    const start = this.night_amount;
    return this.tweenPercent(
      1000,
      (factor) => {
        this.night_amount = start * (1 - factor) + factor * amount;
      },
    );
  }

  tweenFlockAmount(amount) {
    const start = this.flock_amount;
    return this.tweenPercent(
      1000,
      (factor) => {
        this.flock_amount = start * (1 - factor) + factor * amount;
      },
    );
  }

  speak(x, y, lines, defaults = {
    inTime: 200, outTime: 200, duration: 1000, extraDelay: 0, dy: -20,
  }) {
    let delay = 0;

    lines.forEach((line, i) => {
      const {
        duration, inTime, outTime, text, extraDelay,
        execute, goof, dy,
      } = {
        ...defaults,
        ...(typeof line === 'object' ? line : {text: line}),
      };

      this.timer(() => {
        if (execute) {
          const [method, ...args] = execute;
          this[method](...args);
        }

        const label = this.add.text(
          x,
          y + dy,
          text,
          {
            fontFamily: '"Avenir Next", "Avenir", "Helvetica Neue", "Helvetica", "Arial"',
            fontSize: '24px',
            fontWeight: 'bold',
            color: 'rgb(0, 0, 0)',
          },
        );

        label.alpha = 0;
        this.tweenPercent(
          inTime,
          (factor) => {
            label.alpha = factor;
            label.y = y - dy * (1.0 - factor);
          },
          null,
          0,
          'Cubic.easeOut',
        );

        this.timer(() => {
          if (!goof) {
            this.tweenPercent(
              outTime,
              (factor) => {
                label.alpha = 1.0 - factor;
                label.y = y - dy * factor;
              },
              () => {
                label.destroy();
              },
              0,
              'Cubic.easeOut',
            );
          } else {
            this.tweenPercent(
              Math.abs(outTime * goof / defaults.dy),
              (factor) => {
                label.y = y - goof * factor;
              },
              () => {
                label.destroy();
              },
            );
          }
        }, duration);
      }, extraDelay + delay);
      delay += extraDelay + duration + inTime + outTime;
    });
  }

  zoomOnLoss() {
    const {level} = this;
    const {enemies, followers, player} = level;

    if (followers.length > 1) {
      return;
    }

    // no followers were ever on the level
    if (followers.length === 0 && !level.lastFollower) {
      return;
    }

    if (this.level.zoomForLossCompleted && followers.length === 0) {
      this.timer(() => {
        this.replaceLostLevel();
      }, 2000 * this.timeScale).ignoresScenePause = true;
    }

    const minDistance = prop('effects.zoomOnLoss.distance');

    let isSafe = false;
    let min;

    if (enemies.length === 0) {
      isSafe = true;
    } else if (followers.length === 0) {
      min = [0, level.lastFollower, null];
    } else {
      for (let f = 0; f < followers.length; f += 1) {
        const follower = followers[f];
        const [enemy, distance] = ClosestObject(enemies, follower.x, follower.y);
        const effectiveDistance = Math.max(0.01, distance - tileWidth);
        if (this.losing) {
          if (effectiveDistance > 2 * minDistance) {
            isSafe = true;
            break;
          }
        } else if (effectiveDistance > minDistance) {
          isSafe = true;
          break;
        }

        if (!min || effectiveDistance < min[0]) {
          min = [effectiveDistance, follower, enemy];
        }
      }
    }

    if (!min || isSafe) {
      this.level.losing = null;
      if (!this.level.zoomedForLoss || this.level.unzoomForLoss) {
        return;
      }

      this.level.unzoomForLoss = true;
      this.level.zoomedForLoss = false;
      this.level.zoomForLossCompleted = false;

      this.unzoomStartTimer = this.timer(() => {
        if (this.level.zoomedForLoss) {
          return;
        }

        this.camera.zoomTo(
          1,
          prop('effects.zoomOnLoss.recover_zoom_duration'),
          prop('effects.zoomOnLoss.recover_zoom_ease'),
          true,
        );
        this.camera.pan(
          player.x,
          player.y,
          prop('effects.zoomOnLoss.recover_pan_duration'),
          prop('effects.zoomOnLoss.recover_pan_ease'),
          true,
          () => {
            this.cameraFollow(player);
            this.camera.useBounds = true;
            // this.setCameraDeadzone();
          },
        ).ignoresScenePause = true;

        const originTimeScale = prop('effects.zoomOnLoss.time_scale');
        this.unzoomTimeScaleTween = this.tweenPercent(
          prop('effects.zoomOnLoss.recover_time_scale_duration'),
          (factor) => {
            this.timeScale = factor + originTimeScale * (1.0 - factor);
          },
          null,
          0,
          prop('effects.zoomOnLoss.recover_time_scale_ease'),
        );
        this.unzoomTimeScaleTween.timeScale = 1;
      }, prop('effects.zoomOnLoss.recover_linger_duration'));
    } else {
      const [, follower] = min;
      this.level.losing = min;
      this.level.unzoomForLoss = false;
      if (this.unzoomTimeScaleTween) {
        this.unzoomTimeScaleTween.stop();
      }

      if (!this.level.zoomedForLoss) {
        this.level.zoomForLossCompleted = false;
        this.pauseEverythingForTransition();
        this.level.zoomedForLoss = true;
        const panDuration = prop('effects.zoomOnLoss.pan_duration');
        const zoomDuration = prop('effects.zoomOnLoss.zoom_duration');

        this.camera.setDeadzone(0, 0);
        this.cameraFollow();
        this.camera.useBounds = false;
        this.camera.pan(
          follower.x,
          follower.y,
          panDuration,
          prop('effects.zoomOnLoss.pan_ease'),
          true,
        ).ignoresScenePause = true;

        this.camera.zoomTo(
          prop('effects.zoomOnLoss.zoom_scale'),
          zoomDuration,
          prop('effects.zoomOnLoss.zoom_ease'),
          true,
        ).ignoresScenePause = true;

        this.timer(() => {
          this.timeScale = prop('effects.zoomOnLoss.time_scale');
          this.unpauseEverythingForTransition();
          this.level.zoomForLossCompleted = true;
        }, Math.max(panDuration, zoomDuration)).ignoresScenePause = true;
      }
    }
  }

  updateVelocities(time, dt) {
    const {level} = this;
    const {followers, enemies} = level;

    const followerLerp = prop('follower.velocityLerp');
    followers.forEach((follower) => {
      const v = follower.body.maxVelocity.x;
      const t = follower.targetMaxVelocity;

      follower.setMaxVelocity(v + followerLerp * (t - v) * (dt / 16));
    });

    const enemyLerp = prop('follower.velocityLerp');
    enemies.forEach((enemy) => {
      const v = enemy.body.maxVelocity.x;
      const t = enemy.targetMaxVelocity;

      enemy.setMaxVelocity(v + enemyLerp * (t - v) * (dt / 16));
    });
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

  noncoopObstaclesNearPoint(x, y, r) {
    return this.physics.overlapRect(x - r / 2, y - r / 2, r, r, false, true).map((body) => body.gameObject).filter((object) => object.tile && object.tile.isObstacle && !object.tile.isCoop);
  }

  flockFollowers() {
    const {level} = this;
    const {followers, player} = level;

    const px = player.x;
    const py = player.y;

    let acceleration = prop('follower.flockAcceleration');
    let maxVelocity = prop('follower.maxVelocity');

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
    const killerAcceleration = prop('follower.killerAcceleration');
    const killerVelocity = prop('follower.killerVelocity');

    followers.forEach((follower) => {
      if (follower.cooldown) {
        return;
      }

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
            acceleration += killerAcceleration;
            maxVelocity += killerVelocity;
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
      follower.targetMaxVelocity = maxVelocity;
    });
  }

  flockEnemies() {
    const {level} = this;
    const {followers, enemies, player} = level;

    const px = player.x;
    const py = player.y;

    let acceleration = prop('enemy.flockAcceleration');
    let maxVelocity = prop('enemy.maxVelocity');

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
    const victimAcceleration = prop('enemy.victimAcceleration');
    const victimVelocity = prop('enemy.victimVelocity');

    enemies.forEach((enemy) => {
      if (enemy.cooldown) {
        return;
      }

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
        const os = this.noncoopObstaclesNearPoint(fx, fy, obstacleRadius);
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
            acceleration += victimAcceleration;
            maxVelocity += victimVelocity;
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
      enemy.targetMaxVelocity = maxVelocity;
    });
  }

  willTransitionTo(newScene, transition) {
    super.willTransitionTo(newScene, transition);
  }

  willTransitionFrom(oldScene, transition) {
    super.willTransitionFrom(oldScene, transition);

    this.oldScene = oldScene;
    this.willTransition = transition;

    if (oldScene && oldScene.transitioning) {
      this.transitioning = true;
    }

    this.old_night_amount = oldScene ? (oldScene.night_amount || 0) : 0;
    this.old_flock_amount = oldScene ? (oldScene.flock_amount || 0) : 0;
  }

  didTransitionTo(newScene, transition) {
    super.didTransitionTo(newScene, transition);
  }

  didTransitionFrom(oldScene, transition) {
    super.didTransitionFrom(oldScene, transition);
    this.transitioning = null;
    this.command.ignoreAll('blockade', false);
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
    // this._hotReloadCurrentLevel();
  }
}
