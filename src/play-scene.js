import SuperScene from './scaffolding/SuperScene';
import prop from './props';
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

    this.setupPhysics();

    return level;
  }

  createMap() {
    const {level} = this;
    const {tileWidth, tileHeight} = this.game.config;
    const halfHeight = tileHeight / 2;
    const halfWidth = tileWidth / 2;

    const groups = level.groups = {};

    level.map.forEach((row, y) => {
      row.forEach((tile, x) => {
        const [xCoord, yCoord] = this.positionToScreenCoordinate(tile.x, tile.y);

        if (tile.group) {
          if (!groups[tile.group]) {
            groups[tile.group] = {
              tiles: [],
              isStatic: tile.isStatic,
            };
          }

          groups[tile.group].tiles.push(tile);
        } else {
          const object = this.add.image(xCoord + halfWidth, yCoord + halfHeight, tile.image);
          tile.object = object;
          object.tile = tile;
        }
      });
    });

    Object.entries(groups).forEach(([key, config]) => {
      const {tiles, isStatic} = config;

      let group;
      if (isStatic) {
        group = this.physics.add.staticGroup({key});
      } else {
        group = this.physics.add.group({key});
      }
      config.group = group;
      config.objects = [];

      tiles.forEach((tile) => {
        const [xCoord, yCoord] = this.positionToScreenCoordinate(tile.x, tile.y);
        const object = group.create(xCoord + halfWidth, yCoord + halfHeight, tile.image);
        object.tile = tile;
        tile.object = object;
        config.objects.push(object);
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

    const player = this.physics.add.sprite(x, y, 'spriteThing');
    this.cameraFollow(player);

    return player;
  }

  setupAnimations() {
  }

  setupPhysics() {
    const {level, physics} = this;
    const {player, groups} = level;

    physics.add.overlap(player, groups.transition.group, this.enteredTransition, null, this);
    physics.add.collider(player, groups.rock.group);
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

    if (command.up.held) {
      player.setVelocityY(-200);
    } else if (command.down.held) {
      player.setVelocityY(200);
    } else {
      player.setVelocityY(0);
    }

    if (command.right.held) {
      player.setVelocityX(200);
    } else if (command.left.held) {
      player.setVelocityX(-200);
    } else {
      player.setVelocityX(0);
    }
  }

  fixedUpdate(time, dt) {
    this.processInput();
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

    x += this.camera.scrollX;
    y += this.camera.scrollY;
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
  }
}
