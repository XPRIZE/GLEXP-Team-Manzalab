﻿define([
    './tree',
    'common/src/fx',
    './board'
], function (
    Tree,
    Fx,
    Board
) {
    'use strict';

    /**
     * Remediation is in charge of all the local Remediation and game loop
	 * @class
     * @extends Phaser.Group
     * @memberof Cocolision
	 * @param game {Phaser.Game} game instance
	**/
    function Remediation(game) {
        Phaser.Group.call(this, game);

        this.eventManager = game.eventManager;

        this.game = game;
        this.paused = false;
        this.won = false;

        this.lives = 0;
        this.triesRemaining = 0;
        this.consecutiveMistakes = 0;
        this.consecutiveSuccess = 0;
        this.framesToWaitBeforeNewSound = 0;
        this.roundIndex = 0;
        this.stepIndex = 0;
        
        this.initGame();

        if (Config.globalVars) window.cocolision.cocolision = this.cocolision;

               	
        if (Config.debugPanel) {

            this.debug = new Dat.GUI(/*{ autoPlace: false }*/);

            var globalLevel = this.game.params.globalLevel;

            var infoPanel = this.debug.addFolder("Level Info");

            var generalParamsPanel = this.debug.addFolder("General Parameters");
            var globalParamsPanel = this.debug.addFolder("Global Parameters");
            this._localParamsPanel = this.debug.addFolder("Local Parameters");

            var debugPanel = this.debug.addFolder("Debug Functions");

            infoPanel.add(this.game.params, "_currentGlobalLevel").listen();
            infoPanel.add(this.game.params, "_currentLocalRemediationStage").listen();


            generalParamsPanel.add(this.game.params._settingsByLevel[globalLevel].generalParameters, "incorrectResponseCountTriggeringFirstRemediation").min(1).max(5).step(1).listen();
            generalParamsPanel.add(this.game.params._settingsByLevel[globalLevel].generalParameters, "incorrectResponseCountTriggeringSecondRemediation").min(1).max(5).step(1).listen();
            generalParamsPanel.add(this.game.params._settingsByLevel[globalLevel].generalParameters, "lives").min(1).max(5).step(1).listen();
            generalParamsPanel.add(this.game.params._settingsByLevel[globalLevel].generalParameters, "capitalLettersShare").min(0).max(1).step(0.05).listen();

            globalParamsPanel.add(this.game.params._settingsByLevel[globalLevel].globalRemediation, "monkeyOnScreen").min(1).max(4).step(1).listen();

            this.setLocalPanel();

            debugPanel.add(this, "AutoWin");
            debugPanel.add(this, "AutoLose");
        }
        this.initSounds(game);
        this.initEvents();
  
        this.trees = [];
        this.initTrees(game);

        this.board = new Board(550, game.height - 50, game);

        this.initRound(this.roundIndex);
        this.setTexts();
        this.fx = new Fx(game);
    };

    Remediation.prototype = Object.create(Phaser.Group.prototype);
    Remediation.prototype.constructor = Remediation;

    /** 
     * Initalize game sounds
     **/
    Remediation.prototype.initSounds = function (game) {
        this.sounds = {};

        this.sounds.winGame = game.add.audio('winGame');
        this.sounds.loseGame = game.add.audio('loseGame');
    }

    /** 
     * Initalize game events
     **/
    Remediation.prototype.initEvents = function () {
        this.eventManager.on('pause', function () {
        }, this);

        this.eventManager.on('unPause', function () {
        }, this);

        this.eventManager.on('playCorrectSound', function () {
            this.eventManager.emit('unPause');
            if (this.framesToWaitBeforeNewSound <= 0) {
                this.sounds.correctRoundAnswer.play();
                this.framesToWaitBeforeNewSound = Math.floor((this.sounds.correctRoundAnswer.totalDuration + 0.5) * 60);
            }
        }, this);

        this.eventManager.on('playCorrectSoundNoUnPause', function () {
            if (this.framesToWaitBeforeNewSound <= 0) {
                this.sounds.correctRoundAnswer.play();
                this.framesToWaitBeforeNewSound = Math.floor((this.sounds.correctRoundAnswer.totalDuration + 0.5) * 60);
            }
        }, this);

        this.eventManager.on('swipe', function (object) {
            this.eventManager.emit('pause');
            object.apparition.close(true, 0);
            object.flyTo(this.trees.kingTree.monkey.x, this.trees.kingTree.monkey.y - 40, 1.4);
            object.clickable = false;
            object.monkeyRef.coconut.bool = false;
            object.monkeyRef.monkeySprite.animations.play('throw');
            object.monkeyRef.sounds.send.play();
            object.monkeyRef.sounds.rdm[Math.floor(Math.random() * object.monkeyRef.sounds.rdm.length)].play();

            var context = this;

            setTimeout(function () {
                context.trees.kingTree.monkey.monkeySprite.animations.play('get');
                object.moveTo(context.trees.kingTree.monkey.x - context.trees.kingTree.monkey.monkeySprite.height / 3, context.trees.kingTree.monkey.y - context.trees.kingTree.monkey.monkeySprite.height / 2, 0.3);
                context.trees.kingTree.monkey.monkeySprite.animations.currentAnim.onComplete.addOnce(function () {
                    context.trees.kingTree.monkey.monkeySprite.animations.play('look');
                    context.trees.kingTree.monkey.monkeySprite.animations.currentAnim.onComplete.addOnce(function () {
                        context.handler(object);
                    }, context);
                }, context);

            }, object.time * 1000 - 2 * 60);

        }, this);

        this.eventManager.on('exitGame', function () {
            this.eventManager.removeAllListeners();
            this.eventManager = null;
            this.game.rafiki.close();
            this.game.destroy();
            if (this.debug) {
                this.debug.destroy();
                this.debug = null;
            }
        }, this);

        this.eventManager.on('replay', function () {
            if (Config.debugPanel) {
                document.getElementsByClassName("dg main a")[0].remove();
                this.debug = null;
            }
            this.game.state.start('Setup');
        }, this);
    };
	
    /**
     * Init a new game with remediation parameters from Rafiki.
    **/
    Remediation.prototype.initGame = function initGame() {

        var params = this.game.params;

        // Setting up the recording of the game for Rafiki
        this.game.record = new this.game.rafiki.MinigameDstRecord();

        this.results = this.game.pedagogicData; // for convenience we reference also the pedagogicData object under the name 'results' because we will add response data directly on it.
        this.consecutiveMistakes = 0;
        this.consecutiveSuccess = 0;
        this.triesRemaining = params.getGlobalParams().totalTriesCount;
        this.lives = params.getGeneralParams().lives;

        this.won = false;
    };

       
    /**
     * Initialise parameters for the required round with data contained in this.pedagogicData
     **/
    Remediation.prototype.initRound = function initRound(roundIndex) {

        var roundData = this.game.pedagogicData.rounds[roundIndex];

        this.apparitionsCount = 0;
        this.framesToWaitBeforeNextSpawn = 0;
        this.framesToWaitBeforeNewSound = 0;

        this.falseResponses = [];
        this.correctResponses = [];
        this.falseStepResponsesCurrentPool = [];
        this.correctWord = roundData.word;
        this.sounds.correctRoundAnswer = this.game.add.audio(roundData.word.value);
        var stepsLength = roundData.step.length;

        var stimuliLength, stimulus;
        var falseStepResponses, correctStepResponses;

        for (var i = 0; i < stepsLength; i++) {
            falseStepResponses = [];
            correctStepResponses = {};
            stimuliLength = roundData.step[i].stimuli.length;
            for (var j = 0; j < stimuliLength; j++) {
                stimulus = roundData.step[i].stimuli[j];
                if (stimulus.correctResponse === true) {
                    correctStepResponses.value = stimulus.value;
                }

                else {
                    falseStepResponses.push(stimulus.value);
                }

                stimulus.apparitions = [];
            }
            this.falseResponses.push(falseStepResponses);
            this.correctResponses.push(correctStepResponses);
        }
    };

    Remediation.prototype.setTexts = function () {
        var localParams = this.game.params.getLocalParams();
        var globalParams = this.game.params.getGlobalParams();
        var isTargetValue, value, apparition, j, randMonkey;
        var targetCoconutSpawned = 0;

        var selectedMonkey = [];
        for (var i = 0; i < globalParams.monkeyOnScreen; i++) {
            selectedMonkey.push(i);
        }

        this.falseStepResponsesCurrentPool = [];
        for (var i = 0; i < globalParams.monkeyOnScreen; i++) {
            if (targetCoconutSpawned < localParams.minimumCorrectStimuliOnColumn) {
                isTargetValue = true; // we spawn a correct answer stimulus
                targetCoconutSpawned++;
            }
            else {
                var rand = Math.random();
                if (rand < localParams.correctResponsePercentage) {
                    isTargetValue = true;
                    targetCoconutSpawned++;
                }
                else
                    isTargetValue = false;
            }

            if (isTargetValue) {
                value = this.correctResponses[this.stepIndex].value;
            }
            else {
                if (this.falseStepResponsesCurrentPool.length === 0) {
                    this.falseStepResponsesCurrentPool = this.falseStepResponsesCurrentPool.concat(this.falseResponses[this.stepIndex].slice(0));
                    this.falseStepResponsesCurrentPool = this.falseStepResponsesCurrentPool.concat(this.falseResponses[this.stepIndex].slice(0));
                    // we do it two times to have 2 times each false response in the pool.
                }
                value = this.falseStepResponsesCurrentPool.splice(Math.floor(Math.random() * this.falseStepResponsesCurrentPool.length), 1)[0]; // Picks a random value in all the false response values
            }

            randMonkey = selectedMonkey.splice(Math.floor(Math.random() * selectedMonkey.length), 1)[0];

            this.trees.normalTree.monkey[randMonkey].coconut.sprite.setText(value);

            j = 0;
            while (this.results.rounds[this.roundIndex].step[this.stepIndex].stimuli[j].value != value) { //finds the value in the results to add one apparition
                j++;
            }
            apparition = new this.game.rafiki.StimulusApparition(isTargetValue);

            this.results.rounds[this.roundIndex].step[this.stepIndex].stimuli[j].apparitions.push(apparition);
            this.trees.normalTree.monkey[randMonkey].coconut.sprite.apparition = apparition;
        }
    };

    Remediation.prototype.handler = function (object) {
        var value = object.text.text;
        var j = 0;
        if (value != "") object.sound.play();

        if (value == this.correctResponses[this.stepIndex].value) {
            this.trees.kingTree.monkey.monkeySprite.animations.play('right');
            this.trees.kingTree.monkey.sounds.sendRight.play();
            object.tween.stop();
            object.moveTo(this.board.x + this.stepIndex * (this.board.text.fontSize - 40), this.game.height - 100, 0.7);
            this.eventManager.once('finishedMoving', function () {
                object.break();
                this.board.text.text += this.correctResponses[this.stepIndex].value;
                this.eventManager.once('finishedBreaking', function () {
                    this.success();
                }, this);
            }, this);

        }
        else {
            this.trees.kingTree.monkey.monkeySprite.animations.play('wrong');
            this.trees.kingTree.monkey.sounds.sendWrong.play();
            object.active = false;
            object.flyTo(object.origin.x, object.origin.y, 1);
            this.eventManager.once('finishedFlying', function () {
                object.monkeyRef.sounds.receiveHead.play();
                object.monkeyRef.monkeySprite.animations.play('impact');
                object.monkeyRef.monkeySprite.animations.currentAnim.onComplete.addOnce(function () {
                    object.monkeyRef.monkeySprite.animations.play('stun');
                    object.monkeyRef.stunStars.animations.play('stun');
                    object.monkeyRef.stunStars.visible = true;
                }, object);
                this.fail();
            }, this);

        }
    };

    Remediation.prototype.success = function () {
        this.consecutiveMistakes = 0;
        this.stepIndex++;
        this.consecutiveSuccess++;

        if (this.stepIndex < this.correctResponses.length) {
            this.getNewCoconuts();
            this.eventManager.emit('unPause');
        }
        else {
            this.stepIndex = 0;
            this.roundIndex++;
            this.triesRemaining--;
            this.eventManager.emit('success');
            if (this.triesRemaining > 0) {
                this.sounds.correctRoundAnswer.play();
                if (Config.debugPanel) this.cleanLocalPanel();
                this.game.params.increaseLocalDifficulty();
                if (Config.debugPanel) this.setLocalPanel(); var context = this;
                setTimeout(function () {
                    context.initRound(context.roundIndex);
                    context.board.text.text = "";
                    context.getNewCoconuts();
                    context.eventManager.emit('playCorrectSound');
                }, 3 * 1000);
            }
            else {
                this.gameOverWin();
            }
        }

    };

    Remediation.prototype.fail = function () {
        var params = this.game.params.getGeneralParams();
        this.lives--;
        this.triesRemaining--;
        this.consecutiveMistakes++;
        this.consecutiveSuccess = 0;
        this.eventManager.emit('fail');

        console.log(this.lives)
        console.log(this.triesRemaining)

        if (this.lives > 0 && this.triesRemaining > 0) {
            if (this.consecutiveMistakes === params.incorrectResponseCountTriggeringFirstRemediation) { //Triggers kalulu's help + lowers difficulty

                var context = this;
                setTimeout(function () {
                    context.eventManager.emit('playCorrectSound');//listened here; check initEvents
                }, 1000);

                if (Config.debugPanel) this.cleanLocalPanel();
                this.game.params.decreaseLocalDifficulty();
                if (Config.debugPanel) this.setLocalPanel();
            }
            else if (this.consecutiveMistakes === params.incorrectResponseCountTriggeringSecondRemediation) {

                this.eventManager.emit('help'); // listened by Kalulu to start the help speech; pauses the game in kalulu
                if (Config.debugPanel) this.cleanLocalPanel();
                this.game.params.decreaseLocalDifficulty();
                if (Config.debugPanel) this.setLocalPanel();
                this.consecutiveMistakes = 0; // restart the remediation
            }
        }
        else if (this.triesRemaining === 0 && this.lives > 0) {
            this.gameOverWin();
        }
        else {
            console.log("?")
            this.gameOverLose();
        }
    };

    Remediation.prototype.getNewCoconuts = function () {
        for (var i = 0; i < this.trees.normalTree.monkey.length; i++) {
            this.trees.normalTree.monkey[i].getNewCoconut();
        }
        this.setTexts();
    };

    Remediation.prototype.initTrees = function (game) {
        var globalParams = this.game.params.getGlobalParams();

        this.trees = {};

        this.trees.kingTree = new Tree(true, game);
        this.trees.normalTree = new Tree(false, game, globalParams.monkeyOnScreen);
    };


    Remediation.prototype.update = function () {
        if (this.framesToWaitBeforeNewSound > 0) this.framesToWaitBeforeNewSound--;
    };

    Remediation.prototype.gameOverWin = function gameOverWin() {

        this.game.won = true;
        this.sounds.winGame.play();
        this.eventManager.emit('offUi');// listened by ui

        this.sounds.winGame.onStop.add(function () {
            this.sounds.winGame.onStop.removeAll();
            this.eventManager.emit('GameOverWin');//listened by Ui (toucan = kalulu)
            this.saveGameRecord();
        }, this);
    };

    Remediation.prototype.gameOverLose = function gameOverLose() {

        this.game.won = false;
        this.sounds.loseGame.play();
        this.eventManager.emit('offUi');// listened by ui

        this.sounds.loseGame.onStop.add(function () {
            this.sounds.loseGame.onStop.removeAll();
            this.eventManager.emit('GameOverLose');// listened by ui
            this.saveGameRecord();
        }, this);
    };

    Remediation.prototype.saveGameRecord = function saveGameRecord() {
        this.game.record.close(this.game.won, this.results, this.game.params.localRemediationStage);
        this.game.rafiki.save(this.game.record);
    };

    // DEBUG
    Remediation.prototype.cleanLocalPanel = function cleanLocalPanel() {

        for (var element in this._localParamsPanel.items) {
            if (!this._localParamsPanel.items.hasOwnProperty(element)) continue;
            this._localParamsPanel.remove(this._localParamsPanel.items[element]);
        }
    };

    Remediation.prototype.setLocalPanel = function setLocalPanel() {

        var globalLevel = this.game.params.globalLevel;
        var localStage = this.game.params.localRemediationStage;

        this._localParamsPanel.items = {};
        this._localParamsPanel.items.param1 = this._localParamsPanel.add(this.game.params._settingsByLevel[globalLevel].localRemediation[localStage], "minimumCorrectStimuliOnColumn").min(0).max(20).step(1).listen();
        this._localParamsPanel.items.param2 = this._localParamsPanel.add(this.game.params._settingsByLevel[globalLevel].localRemediation[localStage], "correctResponsePercentage").min(0).max(1).step(0.1).listen();
    };

    Remediation.prototype.AutoWin = function WinGameAndSave() {

        var apparitionStats;
        var roundsCount, stepsCount, stimuliCount, currentRound, currentStep, currentStimulus;

        roundsCount = this.results.rounds.length;

        for (var i = 0 ; i < roundsCount ; i++) {

            currentRound = this.results.rounds[i];
            currentRound.word.stats = {
                apparitionTime: Date.now() - 10000,
                exitTime: Date.now(),
                success: true
            };

            stepsCount = currentRound.step.length;

            for (var j = 0 ; j < stepsCount ; j++) {

                currentStep = this.results.rounds[i].step[j];
                stimuliCount = currentStep.stimuli.length;

                for (var k = 0 ; k < stimuliCount ; k++) {

                    currentStimulus = this.results.rounds[i].step[j].stimuli[k];

                    apparitionStats = {
                        apparitionTime: Date.now() - 3000,
                        exitTime: Date.now(),
                        correctResponse: false,
                        clicked: false
                    };

                    if (currentStimulus.correctResponse) {
                        apparitionStats.correctResponse = true;
                        apparitionStats.clicked = true;
                    }

                    currentStimulus.apparitions = [apparitionStats];
                }
            }
        }

        this.won = true;
        this.eventManager.emit("exitGame");
    };

    Remediation.prototype.AutoLose = function LoseGame() {

        var apparitionStats;
        var roundsCount, stepsCount, stimuliCount, currentRound, currentStep, currentStimulus;

        roundsCount = this.results.rounds.length;

        for (var i = 0 ; i < roundsCount ; i++) {

            currentRound = this.results.rounds[i];
            currentRound.word.stats = {
                apparitionTime: Date.now() - 20000,
                exitTime: Date.now(),
                success: false
            };

            stepsCount = currentRound.step.length;

            for (var j = 0 ; j < stepsCount ; j++) {

                currentStep = this.results.rounds[i].step[j];
                stimuliCount = currentStep.stimuli.length;

                for (var k = 0 ; k < stimuliCount ; k++) {

                    currentStimulus = this.results.rounds[i].step[j].stimuli[k];

                    apparitionStats = {
                        apparitionTime: Date.now() - 3000,
                        exitTime: Date.now(),
                        correctResponse: false,
                        clicked: true
                    };

                    if (currentStimulus.correctResponse) {
                        apparitionStats.correctResponse = true;
                        apparitionStats.clicked = false;
                    }

                    currentStimulus.apparitions = [apparitionStats];
                }
            }
        }

        this.won = false;
        this.eventManager.emit('exitGame');
    };


    return Remediation;
});