define([
    'phaser-bundle',
    './config',
    './boot',
    './states/preload',   
    './game',
    // 'params',
    'common/src/minigame_parameters',
    './setup',
    'eventemitter3',
    './states/phase_video',
    './states/phase_image',
    './states/phase_tracing'
], function (
    Phaser,
    minigameConfig,
    Boot,
    Preloader,   
    Game,
    // params,
    MinigameParameters,
    Setup,
    EventEmitter,
    PhaseVideo,
    PhaseImage,
    PhaseTracing
) {
    'use strict';

    /**
     * GameLauncher is in charge of instancing the Phaser Game
     * @class
     * @memberof Template
     * @param rafiki {Object} the pedagogic interface
         * It contains :
         * - getSetup() => returns the data instanciated by the remediation engine
         * - saveData(data) => save the remediation data of your minigame
         * - close() => tell kalulu's engine you're done
    **/
    function GameLauncher (rafiki) {
        this.rafiki = rafiki;
        this.config = minigameConfig;
        this.config.pedagogicData = rafiki.getPedagogicData();
        console.log('here');
        if (typeof this.config.requestMinigameConfig === 'function') {
            this.config.requestMinigameConfig(this.init.bind(this));
            console.log("[Minigame] Requested this.game.config");
        }
        else {
            console.error('issue with config');
        }

    }   
    

    GameLauncher.prototype.init = function init () {
        
        /**
         * Phaser Game
         * 1920 * 1350 is the targeted resolution of the Pixel C tablet
         * @type {Phaser.Game}
        **/
        this.game = new Phaser.Game(1920, 1350, Phaser.AUTO); // TODO : make it dynamic for multiscreen handling
        this.game.config = this.config;
        if (this.game.config.globalVars) {
            console.info('Debug with global Variables enabled. Everything can be found in global variable "lookandlearn"');
            window.lookandlearn = {};
            window.lookandlearn.game = this.game;
        }

        this.game.rafiki = this.rafiki;
        // debug Panel from Kalulu
        this.game.debugPanel = this.rafiki.debugPanel;
        
        //  Game States
        this.game.state.add('Boot', Boot);
        this.game.state.add('Preloader', Preloader);
        this.game.state.add('Setup', Setup);
        this.game.state.add('Phase1Video', PhaseVideo);
        this.game.state.add('Phase2Image', PhaseImage);
        this.game.state.add('Phase3Tracing', PhaseTracing);
        
        //Starts the 'Boot' State
        console.info("Look&Learn App Created, Starting Boot...");


        if (!this.game.eventManager) {
            this.game.eventManager = new EventEmitter();
        }

        this.game.eventManager.on("exitGame", this.quit, this);
        this.game.state.start('Boot');

    };

    GameLauncher.prototype.quit = function quit () {
        this.game.eventManager.off("exitGame", this.quit, this);
        this.game.rafiki.close();
        this.game.destroy();
    };

    GameLauncher.prototype.destroy = function destroy () {
        
        this.game.destroy();
        this.game = null;
    };

    return GameLauncher;
});