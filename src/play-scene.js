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
      follower.setCollideWorldBounds(true);
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
    const {player, groups, followerGroup} = level;

    physics.add.overlap(player, groups.transition.group, this.enteredTransition, null, this);
    physics.add.collider(player, groups.rock.group);

    physics.add.collider(followerGroup, player);
    physics.add.collider(followerGroup, groups.rock.group);
    physics.add.collider(followerGroup, followerGroup);
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

    const accel = prop('player.acceleration');
    let ax = 0;
    let ay = 0;

    if (command.up.held) {
      ay = -accel;
    } else if (command.down.held) {
      ay = accel;
    }

    if (command.right.held) {
      ax = accel;
    } else if (command.left.held) {
      ax = -accel;
    }

    player.body.setAcceleration(ax, ay);
  }

  fixedUpdate(time, dt) {
    this.processInput();
    this.flockFollowers();
  }

  followersNearPoint(x, y, r) {
    // overlapCirc was added in a newer version of phaser
    return this.physics.overlapRect(x - r / 2, y - r / 2, r, r, true, false).map((body) => body.gameObject).filter((object) => object.isFollower);
  }

  flockFollowers() {
    const {level, physics} = this;
    const {followers, player} = level;

    const px = player.x;
    const py = player.y;

    const acceleration = prop('follower.flockAcceleration');
    const cohereRadius = prop('follower.cohereRadius');
    const spreadRadius = prop('follower.spreadRadius');

    followers.forEach((follower) => {
      const fx = follower.x;
      const fy = follower.y;

      let tx;
      let ty;

      const cohereFollowers = this.followersNearPoint(fx, fy, cohereRadius);

      const playerDistance = Math.sqrt((px - fx) ** 2 + (py - fy) ** 2);
      if (playerDistance < cohereRadius) {
        tx = px;
        ty = py;
      } else {
        // overlapCirc was added in a newer version of phaser
        let cx = 0;
        let cy = 0;
        cohereFollowers.forEach((f) => {
          cx += f.x;
          cy += f.y;
        });
        cx /= cohereFollowers.length;
        cy /= cohereFollowers.length;
        tx = cx;
        ty = cy;
      }

      let spreadX = 0;
      let spreadY = 0;
      let spreadCount = 0;

      const spreadFollowers = cohereRadius > spreadRadius ? cohereFollowers : this.followersNearPoint(fx, fy, spreadRadius);
      spreadFollowers.forEach((f) => {
        if (f === follower) {
          return;
        }

        const dx = fx - f.x;
        const dy = fy - f.y;
        const fDistance = Math.sqrt(dx ** 2 + dy ** 2);
        if (fDistance > spreadRadius) {
          return;
        }

        spreadX += dx / fDistance;
        spreadY += dy / fDistance;
        spreadCount += 1;
      });

      const targetTheta = Math.atan2(ty - fy, tx - fx);
      let theta = targetTheta;

      if (spreadCount) {
        spreadX /= spreadCount;
        spreadY /= spreadCount;

        theta = targetTheta * 0.5 + Math.atan2(spreadY, spreadX) * 0.5;
      }

      follower.body.setAcceleration(acceleration * Math.cos(theta), acceleration * Math.sin(theta));
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
    // this._hotReloadCurrentLevel();
  }
}
