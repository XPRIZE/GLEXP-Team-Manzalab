﻿define([
    './line',
    './caterpillar',
    'common/src/fx'
], function (
    Line,
    Caterpillar,
    Fx
) {
    'use strict';

    function Remediation(game) {

        Phaser.Group.call(this, game);

        this.eventManager = game.eventManager;

        var data = this.game.pedagogicData;
        this.discipline = data.discipline;       

        this.game = game;
        this.paused = true;
        this.won = false;

        this.lives = 0;
        this.consecutiveMistakes = 0;
        this.consecutiveSuccess = 0;
        this.framesToWaitBeforeNextSpawn = 0;
        this.framesToWaitBeforeNewSound = 0;
        this.berrySpawned = 0;
        this.targetBerriesSpawned = 0;
        this.distracterBerriesSpawned = 0;
        this.roundIndex = 0;
        this.stepIndex = 0;

        this.initGame();

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

            globalParamsPanel.add(this.game.params._settingsByLevel[globalLevel].globalRemediation, "berriesOnScreen").min(1).max(6).step(1).listen();
            globalParamsPanel.add(this.game.params._settingsByLevel[globalLevel].globalRemediation, "lineCount").min(2).max(4).step(1).listen();

            this.setLocalPanel();

            debugPanel.add(this, "AutoWin");
            debugPanel.add(this, "AutoLose");
        }


        this.lines = [];
        this.initLines(game);

        this.initCaterpillar(game);

        this.initEvents();
        this.initSounds(game);

        this.fx = new Fx(game);

        this.initRound(this.roundIndex);
    }

    Remediation.prototype = Object.create(Phaser.Group.prototype);
    Remediation.prototype.constructor = Remediation;

    Remediation.prototype.updateGameDesignDebug = function () {
        this.setSpeed(this.game.params.getLocalParams().speed);
        this.caterpillar.setSpeed(this.game.params.getLocalParams().speed);
    };

    Remediation.prototype.initSounds = function (game) {
        this.sounds = {};

        this.sounds.right = game.add.audio('right');
        this.sounds.wrong = game.add.audio('wrong');
        this.sounds.winGame = game.add.audio('winGame');
        this.sounds.loseGame = game.add.audio('loseGame');
    };

    Remediation.prototype.initEvents = function () {
        this.eventManager.on('pause', function () {
            this.pause(true);
        }, this);

        this.eventManager.on('unPause', function () {
            this.pause(false);
        }, this);

        this.eventManager.on('playCorrectSound', function () {
            this.eventManager.emit('unPause');
            if (this.framesToWaitBeforeNewSound <= 0) {
                if (this.discipline != "maths") {
                    this.sounds.correctRoundAnswer.play();
                    this.framesToWaitBeforeNewSound = Math.floor((this.sounds.correctRoundAnswer.totalDuration + 0.5) * 60);
                }
                else {

                }
            }
        }, this);

        this.eventManager.on('playCorrectSoundNoUnPause', function () {
            if (this.framesToWaitBeforeNewSound <= 0) {
                if (this.discipline != "maths") {
                    this.sounds.correctRoundAnswer.play();
                    this.framesToWaitBeforeNewSound = Math.floor((this.sounds.correctRoundAnswer.totalDuration + 0.5) * 60);
                }
                else {

                }
            }
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
        if (this.discipline != "maths") {
            this.correctWord = roundData.word;
            this.sounds.correctRoundAnswer = this.game.add.audio(roundData.word.value);
        }
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


    Remediation.prototype.pause = function (bool) {
        this.paused = bool;
        this.caterpillar.pause(bool);
        for (var i = 0; i < this.lines.length; i++) {
            this.lines[i].pause(bool);
        }
    };

    Remediation.prototype.collision = function () {

        var lLinesCount = this.lines.length;
        var lGraphemeCount;
        for (var i = 0; i < lLinesCount; i++) {
            lGraphemeCount = this.lines[i].graph.length;
            for (var j = 0; j < lGraphemeCount; j++) {
                if (!this.lines[i].graph[j].eaten && this.caterpillar.branch == this.lines[i].branch) {
                    this.game.physics.arcade.collide(this.caterpillar.head, this.lines[i].graph[j], this.collisionHandler, null, this);
                }
            }
        }
    };

    Remediation.prototype.eat = function (obj1, obj2) {

        this.caterpillar.head.eat();
        this.caterpillar.head.head.animations.currentAnim.onComplete.addOnce(function () {
            this.collisionHandler(obj1, obj2);
        }, this);
    };

    Remediation.prototype.collisionHandler = function (obj1, obj2) {
        this.caterpillar.clickable = false;
        var value = obj2.parent.text.text;
        obj2.parent.apparition.close(true, 0);
        this.game.world.bringToTop(this.caterpillar.head);

        obj2.parent.eaten = true;
        this.setSpeed(1.2);

        if (value !== "") obj2.parent.sound.play();

        if (value == this.correctResponses[this.stepIndex].value) {
            this.fx.hit(this.caterpillar.head.x, this.caterpillar.head.y, true);
            this.sounds.right.play();
            this.caterpillar.head.eat();
            this.caterpillar.head.head.animations.currentAnim.onComplete.addOnce(function () {
                this.fadeAllGraph();
                this.setSpeed(this.game.params.getLocalParams().speed);
                this.eventManager.emit('pause');
                this.success();
                obj2.parent.visible = false;
                obj2.parent.spawned = false;
            }, this);
        }
        else {
            this.fx.hit(this.caterpillar.head.x, this.caterpillar.head.y, false);
            this.sounds.wrong.play();
            this.caterpillar.head.spit();
            this.caterpillar.head.head.animations.currentAnim.onComplete.addOnce(function () {
                this.setSpeed(this.game.params.getLocalParams().speed);
                this.eventManager.emit('pause');
                this.fail();
                obj2.parent.visible = false;
                obj2.parent.spawned = false;
            }, this);
        }
    };

    Remediation.prototype.success = function success () {
        this.consecutiveMistakes = 0;
        this.caterpillar.addBody(this.correctResponses[this.stepIndex].value);
        this.stepIndex++;
        this.falseStepResponsesCurrentPool = [];
        this.apparitionsCount = 0;
        this.caterpillar.clickable = true;

        if (this.stepIndex < this.correctResponses.length) {
            this.eventManager.emit('unPause');
        }
        else {

            this.stepIndex = 0;
            this.roundIndex++;
            this.triesRemaining--;
            this.eventManager.emit('success');

            if (this.triesRemaining > 0) {

                if (this.discipline != "maths") this.sounds.correctRoundAnswer.play();              
                if (Config.debugPanel) this.cleanLocalPanel();
                this.game.params.increaseLocalDifficulty();
                if (Config.debugPanel) this.setLocalPanel(); 
                var context = this;
                setTimeout(function () {
                    context.initRound(context.roundIndex);
                    context.destroyGraph();
                    context.caterpillar.reset(context.lines[1].y);
                    context.caterpillar.branch = 2;
                    context.eventManager.emit('playCorrectSound');
                }, 3 * 1000);
            }
            else {
                this.gameOverWin();
            }
        }

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

    Remediation.prototype.destroyGraph = function () {
        for (var i = 0; i < this.lines.length; i++) {
            this.lines[i].destroyGraph();
        }
    };

    Remediation.prototype.resetLines = function () {
        var linesLength = this.lines.length;

        for (var i = 0; i < linesLength; i++) {
            var graphLength = this.lines[0].graph.length;
            for (var j = 0; j < graphLength; j++) {
                this.lines[0].graph.pop().destroy();
            }
            var leavesLength = this.lines[0].leaves.length;
            for (var j = 0; j < leavesLength; j++) {
                this.lines[0].leaves.pop().destroy();
            }
            this.lines.splice(0, 1)[0].destroy();
        }
    };

    Remediation.prototype.fadeAllGraph = function () {
        var linesLength = this.lines.length;

        for (var i = 0; i < linesLength; i++) {
            this.lines[i].fadeAndDestroyGraph();
        }
    };

    Remediation.prototype.fail = function () {
        this.lives--;
        this.triesRemaining--;
        this.consecutiveMistakes++;
        this.eventManager.emit('fail');
        this.caterpillar.clickable = true;

        if (this.lives > 0 && this.triesRemaining > 0) {
            if (this.consecutiveMistakes == this.game.params.getGeneralParams().incorrectResponseCountTriggeringSecondRemediation) {
                this.consecutiveMistakes = 0;
                this.eventManager.emit('help');
                if (Config.debugPanel) this.cleanLocalPanel();
                this.game.params.decreaseLocalDifficulty();
                if (Config.debugPanel) this.setLocalPanel();
            }
            else {
                this.eventManager.emit('playCorrectSound');             
            }
        }
        else if (this.triesRemaining === 0 && this.lives > 0) {
            this.gameOverWin();
        }
        else {
            this.gameOverLose();
        }
    };

    Remediation.prototype.initLines = function (game) {

        var generalParams = this.game.params.getGeneralParams();
        var globalParams = this.game.params.getGlobalParams();
        var localParams = this.game.params.getLocalParams();

        for (var i = 0; i < globalParams.lineCount; i++) {
            var temp = new Line(175,
                (i + 1) * game.world.height / (globalParams.lineCount + 1),
                game);

            temp.line.hitArea = new Phaser.Rectangle(0,
                -game.world.height / (globalParams.lineCount + 1),
                game.world.width,
                (game.world.height / (globalParams.lineCount + 1)) * 2);

            temp.line.inputEnabled = true;
            temp.inputEnabled = true;
            temp.events = temp.line.events;

            temp.events.onInputDown.add(this.click, this);
            temp.branch = i + 1;
            temp.setSpeed(localParams.speed);
            this.lines.push(temp);
        }
    };

    Remediation.prototype.setSpeed = function (speed) {
        for (var i = 0; i < this.lines.length; i++) {
            this.lines[i].setSpeed(speed);
        }
    };

    Remediation.prototype.click = function (target, pointer) {
        if (!this.paused && this.caterpillar.clickable)
            if (target.parent.branch != this.caterpillar.branch) {
                this.caterpillar.branch = target.parent.branch;
                this.caterpillar.moveTo(target.parent.y);
            }
    };

    Remediation.prototype.initCaterpillar = function (game) {

        var generalParams = this.game.params.getGeneralParams();
        var globalParams = this.game.params.getGlobalParams();
        var localParams = this.game.params.getLocalParams();

        var line, branch;

        if (this.lines.length === 3) {
            line = 1; branch = 2;
        }
        else if (this.lines.length === 4 || this.line.length === 5) {
            line = 2; branch = 3;
        }

        this.caterpillar = new Caterpillar(this.lines[line].x + 100, this.lines[line].y, game);
        this.caterpillar.branch = branch;
        this.caterpillar.setSpeed(generalParams.caterpillarSpeed);
    };

    Remediation.prototype.manageBerriesSpawning = function () {

        var generalParams = this.game.params.getGeneralParams();
        var globalParams = this.game.params.getGlobalParams();
        var localParams = this.game.params.getLocalParams(); // get the latest localParams (localParams can change anytime during the game following player's inputs)

        this.framesToWaitBeforeNextSpawn--;
        var berriesCountToAdd = globalParams.berriesOnScreen - this.berriesSpawned;

        var str = "--> missing " + berriesCountToAdd + "( " + this.berriesSpawned + " vs. " + globalParams.berriesOnScreen + " required)";
        //console.log(str);
        // console.info("frames before new " + this.framesToWaitBeforeNextSpawn);
        if (berriesCountToAdd === 0) {
            console.log("engough jellies on screen");
            return;
        }
        else if (berriesCountToAdd > 0 && this.framesToWaitBeforeNextSpawn <= 0) {
            this.spawnBerry();

        }
    };

    Remediation.prototype.spawnBerry = function () {
        var localParams = this.game.params.getLocalParams();
        var globalParams = this.game.params.getGlobalParams();
        var isTargetValue, value, lineNumber, lBerry, j, apparition;

        // determine if we need a target or a distracter
        if (this.targetBerriesSpawned < localParams.minimumCorrectStimuliOnScreen && this.apparitionsCount > globalParams.berriesOnScreen / 2) {
            isTargetValue = true; // we spawn a correct answer stimulus
        }
        else {
            var rand = Math.random();
            if (rand < localParams.correctResponsePercentage)
                isTargetValue = true;
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

        lineNumber = Math.floor(Math.random() * globalParams.lineCount);
        lBerry = this.lines[lineNumber].spawnGraph(value);

        j = 0;
        console.log(value);
        while (this.results.rounds[this.roundIndex].step[this.stepIndex].stimuli[j].value != value) { //finds the value in the results to add one apparition
            j++;
        }
        apparition = new this.game.rafiki.StimulusApparition(isTargetValue);

        this.results.rounds[this.roundIndex].step[this.stepIndex].stimuli[j].apparitions.push(apparition);
        lBerry.apparition = apparition;
        this.apparitionsCount++;
        this.framesToWaitBeforeNextSpawn = localParams.respawnTime * 60;

        for (var i = 0; i < this.caterpillar.tail.length; i++) {
            this.game.world.bringToTop(this.caterpillar.tail[i]);
        }
        for (var i = 0; i < this.caterpillar.caterpillarBody.length; i++) {
            this.game.world.bringToTop(this.caterpillar.caterpillarBody[i]);

        }
        this.game.world.bringToTop(this.caterpillar.head);
    };

    Remediation.prototype.update = function () {

        if (this.framesToWaitBeforeNewSound > 0) this.framesToWaitBeforeNewSound--;

        if (this.paused) return;

        this.collision();

        this.berriesSpawned = 0;

        this.targetBerriesSpawned = 0;
        this.distracterBerriesSpawned = 0;
        for (var i = 0 ; i < this.lines.length ; i++) {
            this.berriesSpawned += this.lines[i].graph.length;
            for (var j = this.lines[i].graph.length - 1; j >= 0 ; j--) {

                var lBerry = this.lines[i].graph[j];

                if (lBerry.hasExitedScreen) {
                    if (!lBerry.apparition.isClicked) {
                        lBerry.apparition.close(false, 0);
                    }

                    this.lines[i].graph.splice(j, 1)[0].destroy();
                }
                else {
                    if (lBerry.apparition.isCorrect) {
                        this.targetBerriesSpawned++;
                    }
                    else {
                        this.distracterBerriesSpawned++;
                    }
                }
            }
        }

        this.manageBerriesSpawning();
    };

    Remediation.prototype.setLocalPanel = function setLocalPanel() {

        var globalLevel = this.game.params.globalLevel;
        var localStage = this.game.params.localRemediationStage;

        this._localParamsPanel.items = {};
        this._localParamsPanel.items.param1 = this._localParamsPanel.add(this.game.params._settingsByLevel[globalLevel].localRemediation[localStage], "minimumCorrectStimuliOnScreen").min(0).max(20).step(1).listen();
        this._localParamsPanel.items.param2 = this._localParamsPanel.add(this.game.params._settingsByLevel[globalLevel].localRemediation[localStage], "correctResponsePercentage").min(0).max(1).step(0.1).listen();
        this._localParamsPanel.items.param3 = this._localParamsPanel.add(this.game.params._settingsByLevel[globalLevel].localRemediation[localStage], "respawnTime").min(1).max(5).step(0.1).listen();
        this._localParamsPanel.items.param4 = this._localParamsPanel.add(this.game.params._settingsByLevel[globalLevel].localRemediation[localStage], "speed").min(1).max(20).step(0.5).listen();
        this._localParamsPanel.items.param5 = this._localParamsPanel.add(this, "updateGameDesignDebug");
    };

    Remediation.prototype.cleanLocalPanel = function cleanLocalPanel() {

        for (var element in this._localParamsPanel.items) {
            if (!this._localParamsPanel.items.hasOwnProperty(element)) continue;
            this._localParamsPanel.remove(this._localParamsPanel.items[element]);
        }
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