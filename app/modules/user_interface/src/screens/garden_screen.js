/**
 * A screen module can only define dependencies toward ext.libs, SoundManager, ScreensManager, and the eventual children popins.
 * This module host the definition of the Object GardenScreen, which can be instantiated and added on stage.
 * The Chapter screen displays the content of a chapter, in the case of Kalulu, every Chapter contains
 * a few Lessons (1 to 4) for each discipline, displayed on a separate Path.
**/
define([
    '../elements/anim_background',
    '../utils/ui/screen',
    '../utils/sound/sound_manager',
    'assets/data/' + KALULU_LANGUAGE + '/dynamic_rewards',
    '../elements/kalulu_character'
], function (
    AnimBackground,
    Screen,
    SoundManager,
    DynamicRewards,
    Kalulu
) {

    'use strict';

    // ###############################################################################################################################################
    // ###  CONSTRUCTOR  #############################################################################################################################
    // ###############################################################################################################################################

    /**
     * A screen showing a chapter.
     * @constructor
     * @extends Screen
     * @param {Object} pSetup - The data required to setup the screen : {
     *      chapterIndex                : the number of the chapter,
     *      languagePathLessons         : array containing the lessonsData for the language path, 
     *      mathsPathLessonsCount       : array containing the lessonsData for the maths path
     * }
    **/
    function GardenScreen (interfaceManager, chaptersData, chaptersProgression, userProfile) {

        if (Config.enableGlobalVars) window.kalulu.gardenScreen = this;

        Screen.call(this);

        //this.modalImage = "blue_bg.png";

        if (Config.enableGlobalVars) window.kalulu.gardenScreen = this;

        this._chaptersProgression;
        this._data = chaptersData;
        this._interfaceManager = interfaceManager;
        this._userProfile = userProfile;
        this.name="mcGardenScreen";
        this.build();
        
        // Reference the built elements
        this._backgroundContainer = this.getChildByName("mcGardenScreenBackground");
        this._background = new AnimBackground("StarBg", 4);

        this._backgroundContainer.addChild(this._background);
        this._background.position.set(0,0);

        this._gardensContainer = this.getChildByName("mcGardensContainer");

        this._gardens = {};
        this._lessonsNumber = [[0,0], [0,0]];

        var length = this._gardensContainer.children.length;
        var lGarden;
        for (var i = 0 ; i < length ; i++) {
            lGarden = this._gardensContainer.children[i];

            this._gardens[lGarden.name.split("Garden")[1]] = lGarden;
        }
        //console.log(this._gardens);
        this._gardensCount = _.size(this._gardens);

        this._getLessonsNumber();
        
        this._backButton = this.getChildByName("mcGardenTLHud").getChildByName("mcBackButton");
        this._hud = { bottomLeft : this.getChildByName("mcGardenBLHud") };
        this._kaluluButton = this._hud.bottomLeft.getChildByName("mcKaluluButton");
        this._neuroenergy = this.getChildByName("mcGardenTRHud").getChildByName("mcNeuroenergy");
        this._toyChestButton = this.getChildByName("mcGardenBRHud").getChildByName("mcBurrowButton");

        this._toyChestButton.alpha = 0;
        this._toyChestButton.setModeVoid();

        this._lessonDotContainer = new PIXI3.Container();
        this._lessonDotContainer.name = "LessonDotContainer";
        this._lessonDotContainer.position.set(0, 0);
        this._lessonDotContainer.scale.set(1, 1);
        this._lessonDotContainer.rotation = 0;
        this._lessonDotContainer.zIndex = this.children.length;

        this.addChild(this._lessonDotContainer);
        this._createFertilizerText();

        // Rewards
        this._rewardChapter = [];
        this._rewardLessonLanguage = [];
        this._rewardLessonMaths = [];

        this.getDynamicRewardsBoth();
        this.getDynamicRewardsLanguage();
        this.getDynamicRewardsMaths();

        // Plant & BonusPath
        this._plants = [];
        this._bonusPathA = [];
        this._bonusPathB = [];

        var lChildren;
        for(var chapterIndex = 1; chapterIndex <= length; chapterIndex++){
            lGarden = this._gardens[chapterIndex];
            for (var k = 0 ; k < lGarden.children.length ; k++) {
                lChildren = lGarden.children[k];
                if(lChildren.name != null){
                    if(lChildren.name.indexOf("mcBonusPathA") !== -1) this._bonusPathA[chapterIndex] = lChildren;
                    else if(lChildren.name.indexOf("mcBonusPathB") !== -1) this._bonusPathB[chapterIndex] = lChildren;
                }
            }
        }

        this.unlockBonusPath();
        this.undrawBonusPath();

        // back
        this._backButton.onClick = this._onClickOnBackButton.bind(this);
        this._kaluluButton.onClick = this._onClickOnKaluluButton.bind(this);

        // Tween
        this._targetPosition = new PIXI3.Point(this._toyChestButton.parent.x + this._toyChestButton.x, this._toyChestButton.parent.y + this._toyChestButton.y);

        this._index = 1;
        this._tweenControlPoint = new PIXI3.Point(this._targetPosition.x, -500);
        this._tweenDestinationPoint = new PIXI3.Point(this._targetPosition.x, this._targetPosition.y);

        this._interactiveObject = [];

        console.log(this);
    }

    GardenScreen.prototype = Object.create(Screen.prototype);
    GardenScreen.prototype.constructor = GardenScreen;

    GardenScreen.prototype.unlockGardens = function unlockGardens (chaptersProgression) {
        var lGarden;
        this._chaptersProgression = chaptersProgression;
        for (var i = 1 ; i <= chaptersProgression.length ; i++) {
            lGarden = this._gardens[i];

            if (chaptersProgression[i-1] != "Locked") {
                if(i == this._data.currentChapter) this._focusGarden(i); // /!\ Ne surtout pas modifié cette ligne et celle du dessus en une seule /!\
            }
            else {
                lGarden.setInteractive(false);
                lGarden.children[0].setModeDisabled();
                lGarden.children[0].setInteractive(false);
            }
        }
    };

    GardenScreen.prototype.unlockPlants = function unlockPlants() {

        this.plants; // GETTER

        var lengthChapter = this._plants.length;
        var lPlant;

        for (var i = 0; i < lengthChapter; i++) {
            lPlant = this._plants[i];
            lPlant.setSaveState(this._userProfile.plantsProgression[lPlant._idChapter-1][lPlant._idPlant-1]);
            lPlant.setUserReference(this._userProfile);
            lPlant.setGardenScreenReference(this);
        }

        this.fertilizerText = this._userProfile.fertilizer;
    };

    GardenScreen.prototype.unlockBonusPath = function unlockBonusPath() {
        var lArrayLesson = [];
        var chapterIndex = 1;
        var lessonIndex = 1;
        var boolLessonPath;

        for(var children in this._userProfile.Language.plan) {
            if(children == "lesson" + lessonIndex){
                lArrayLesson.push(this._userProfile.Language.plan[children].isCompleted);
                lessonIndex++;
            }
            else if(children == "Assessment" + chapterIndex && lArrayLesson.length >= 1){
                switch (lArrayLesson.length) {
                    case 1:
                        boolLessonPath = lArrayLesson[0];
                        break;

                    case 2:
                    case 3:
                        boolLessonPath = lArrayLesson[1];
                        break;

                    default :
                        boolLessonPath = lArrayLesson[2];
                }
                if(boolLessonPath) this._bonusPathA[chapterIndex].setModeOn();
                // if(!boolLessonPath) this._bonusPathA[chapterIndex].setModeOn(); // FOR DEBUG

                lArrayLesson = [];
                chapterIndex++;
            }
        }

        chapterIndex = 1;
        lessonIndex = 1;

        for(children in this._userProfile.Maths.plan) {
            if(children == "lesson" + lessonIndex){
                lArrayLesson.push(this._userProfile.Maths.plan[children].isCompleted);
                lessonIndex++;
            }
            else if(children == "Assessment" + chapterIndex && lArrayLesson.length >= 1){
                switch (lArrayLesson.length) {
                    case 1:
                        boolLessonPath = lArrayLesson[0];
                        break;

                    case 2:
                    case 3:
                        boolLessonPath = lArrayLesson[1];
                        break;

                    default :
                        boolLessonPath = lArrayLesson[2];
                }
                if(boolLessonPath) this._bonusPathB[chapterIndex].setModeOn();
                // if(!boolLessonPath) this._bonusPathB[chapterIndex].setModeOn(); // FOR DEBUG

                lArrayLesson = [];
                chapterIndex++;
            }
        }
    };

    GardenScreen.prototype.undrawBonusPath = function undrawBonusPath() {
        var chapterIndex, i, bonusPathA, bonusPathB;
        var chapterCount = 20;
        var rewardCount = this._rewardChapter.length;
        var bonusChapter = false;

        console.log(rewardCount);

        for(chapterIndex = 1; chapterIndex < chapterCount; chapterIndex++) {
            for(i = 0; i < rewardCount; i++) {
                if(this._rewardChapter[i] == chapterIndex) bonusChapter = true;
            }
            if(!bonusChapter) {
                bonusPathA = this._bonusPathA[chapterIndex];
                bonusPathB = this._bonusPathB[chapterIndex];

                this._bonusPathA[chapterIndex] = null;
                this._bonusPathB[chapterIndex] = null;

                bonusPathA.parent.removeChild(bonusPathA);
                bonusPathB.parent.removeChild(bonusPathB);

                bonusPathA.destroy();
                bonusPathB.destroy();
            }
            bonusChapter = false;
        }
    };

    GardenScreen.prototype.unlockStarMiddle = function unlockStarMiddle() {
        var id = this._focusedGarden.id;
        
        if(this._bonusPathA[id].state === "On" && this._bonusPathB[id].state === "On") {
            this._focusedGarden.starMiddle.setModeLarge();
            if(!this._userProfile.starMiddle[this._focusedGarden.id]){
                this._removeAllChildrenInterractiveStatus(this);
                this._tweenStar(this._focusedGarden.starMiddle);
            }
        }
        else if(this._bonusPathA[id].state === "On" || this._bonusPathB[id].state === "On") this._focusedGarden.starMiddle.setModeMedium();
        else this._focusedGarden.starMiddle.setModeSmall();
    };

    GardenScreen.prototype.unlockStarPath = function unlockStarPath() {
        var id = this._focusedGarden.id;
        var starPathSave = this._userProfile.starPath[id];
        var starPath = this._focusedGarden.starPath;
        var starLessonState = this._focusedGarden.starLessonState;
        var lObject = {
            idChapter : id,
            value : [null, null]
        }
        var lStar, lState;

        for(var i = 0; i < 2; i++) {
            if(starPath[i]){

                lState = starLessonState[i];
                lStar = starPath[i];

                if (lState.isCompleted){
                    lObject.value[i] = true;
                    lStar.setModeLarge();
                    if(!starPathSave[i]) this._tweenStar(lStar);
                }
                else if (lState.isStarted){
                    lObject.value[i] = false;
                    lStar.setModeMedium();
                }
                else
                    lStar.setModeSmall();
            }
        }
        
        this._userProfile.starPath = lObject;
    };

    GardenScreen.prototype.getDynamicRewardsBoth = function getDynamicRewardsBoth() {
        var chapterIndex;
        var chapterCount = 20;

        for(chapterIndex = 1; chapterIndex <= chapterCount; chapterIndex++) {
            if(DynamicRewards.levelRewards.both[chapterIndex] != null) {
                this._rewardChapter.push(chapterIndex);
            }
        }
    };

    GardenScreen.prototype.getDynamicRewardsLanguage = function getDynamicRewardsLanguage() {
        var lessonIndex = 1;
        for(var object in this._userProfile.Language.plan) {
            if(DynamicRewards.levelRewards.language[lessonIndex] != null) {
                this._rewardLessonLanguage.push(lessonIndex);
            }
            lessonIndex++;
        }
    };

    GardenScreen.prototype.getDynamicRewardsMaths = function getDynamicRewardsMaths() {
        var lessonIndex = 1;
        for(var object in this._userProfile.Maths.plan) {
            if(DynamicRewards.levelRewards.maths[lessonIndex] != null) {
                this._rewardLessonMaths.push(lessonIndex);
            }
            lessonIndex++;
        }
    };

    // ###############################################################################################################################################
    // ###  GETTERS & SETTERS  #######################################################################################################################
    // ###############################################################################################################################################

    Object.defineProperties(GardenScreen.prototype, {
        fertilizerText : {
            get : function () { return this._neuroenergy._txt.text; },
            set : function (value) {
                this._neuroenergy._txt.text = value+"";
                if(value === 0) this._neuroenergy.setModeDisabled();
                return this._neuroenergy._txt.text;
            }
        },

        plants : {
            get : function () {

                var index = 0;
                var i, lChildren;

                for (i = 0 ; i < this._focusedGarden.children.length ; i++) {
                    lChildren = this._focusedGarden.children[i];
                    if(lChildren.name != null){
                        if(lChildren.name.indexOf("mcGraphicPlant") !== -1) this._plants[index++] = lChildren;
                    }
                }
                
                return this._plants;
            }
        }
    });


    // ##############################################################################################################################################
    // ###  PUBLIC METHODS  #########################################################################################################################
    // ##############################################################################################################################################

    GardenScreen.prototype.destroy = function destroy () {
        
        Screen.prototype.destroy.call(this);
        
        // for (var childName in this.lessonsContainer.children) {
            
        //     if (!this.lessonsContainer.children.hasOwnProperty(childName)) continue;
        //     var lChild = this.lessonsContainer.children[childName];
        //     lChild.off(MouseEventType.MOUSE_OVER, this.onMouseOver, this);
        //     lChild.off(MouseEventType.MOUSE_OUT, this.onMouseOut, this);
        // }
    };

    // ##############################################################################################################################################
    // ###  PRIVATE METHODS  ########################################################################################################################
    // ##############################################################################################################################################

    GardenScreen.prototype._getLessonsNumber = function _getLessonsNumber () {
        var gardenIndex, dotCountA, dotCountB;
        var chapterCount = 20;
        var preLessonGarden;

        for(gardenIndex = 1; gardenIndex < chapterCount; gardenIndex++) {
            dotCountA = this._data.data.language[gardenIndex - 1].children.length - 1;
            dotCountB = this._data.data.maths[gardenIndex - 1].children.length - 1;

            preLessonGarden = this._lessonsNumber[gardenIndex];
            this._lessonsNumber.push([preLessonGarden[0] + dotCountA, preLessonGarden[1] + dotCountB]);
        }
    }

    GardenScreen.prototype._onGameStageResize = function _onGameStageResize (eventData) {
        Screen.prototype._onGameStageResize.call(this, eventData);
        
        this._targetPosition.set(this._toyChestButton.parent.x + this._toyChestButton.x, this._toyChestButton.parent.y + this._toyChestButton.y);
        this._tweenControlPoint.set(this._targetPosition.x, -500);
        this._tweenDestinationPoint.set(this._targetPosition.x, this._targetPosition.y);
    };

    GardenScreen.prototype._createFertilizerText = function _createFertilizerText () {
        this._neuroenergy._txt = new PIXI3.Text("", { font : "40px Muli", fill : "#000000", align : "center" });

        this._neuroenergy._upStyle       = { font : "40px Muli", fill : "#000000", align : "center" };
        this._neuroenergy._overStyle     = { font : "40px Muli", fill : "#000000", align : "center" };
        this._neuroenergy._downStyle     = { font : "40px Muli", fill : "#000000", align : "center" };
        this._neuroenergy._disabledStyle = { font : "40px Muli", fill : "#000000", align : "center" };

        this._neuroenergy._txt.anchor.set(0.5, 0.5);
        this._neuroenergy.addChild(this._neuroenergy._txt);
    }

    // GardenScreen.prototype.drawPath = function drawPath () {
        
    //     var lPath = new PIXI3.Graphics();
    //     lPath.lineStyle(20, 0xD6D6AD, 1);
    //     lPath.moveTo(20, 20);
    //     lPath.bezierCurveTo(20, 300, 400, 300, 400, 20);
    //     lPath.bezierCurveTo(400, -180, 50, -180, 50, 20);
    //     lPath.lineStyle(0, 0xFFFFFFF, 0);
        
    //     this.addChild(lPath);
    // };

    GardenScreen.prototype._focusGarden = function _focusGarden (targetGardenId) {
        this._focusedGarden = this._gardens[targetGardenId];

        this._focusedGarden.setInteractive(false);
        this._focusedGarden.children[0].setModeEnabled();
        this._focusedGarden.children[0].setInteractive(false);

        this._gardensContainer.x = -this._focusedGarden.x;

        this._manageSlidingNavigation(targetGardenId);
    };

    GardenScreen.prototype._slideToGarden = function _slideToGarden (eventData) {
        var targetGardenId = eventData.target.id;
        var duration = 1000;

        createjs.Tween.get(this._lessonDotContainer).to({x: this._getGardensContainerTargetX(targetGardenId) - this._gardensContainer.x}, duration, createjs.Ease.quartInOut).call(function () {
            this._lessonDotContainer.x = 0;
        }.bind(this));
        createjs.Tween.get(this._gardensContainer).to({x: this._getGardensContainerTargetX(targetGardenId)}, duration, createjs.Ease.quartInOut).call(function () {
            this._manageSlidingNavigation(targetGardenId);
        }.bind(this));

        this._focusedGarden.undraw(this._lessonDotContainer);
        this._focusedGarden.undrawPlant();
        if(this._focusedGarden.starMiddle) this._focusedGarden.undrawStar();

        this._removeSlideFunctions();
    };

    GardenScreen.prototype._getGardensContainerTargetX = function _getGardensContainerTargetX (targetGardenId) {
        var offset = this._gardens[targetGardenId].x - this._focusedGarden.x;
        return this._gardensContainer.x - offset;
    };

    GardenScreen.prototype._manageSlidingNavigation = function _manageSlidingNavigation (targetGardenId) {
        this._registerFocusAndNeighbours(targetGardenId);
        this._assignSlideFunctionsToNeighbourGardens(targetGardenId);

        this._focusedGarden.draw(this._data.data.language[targetGardenId - 1], this._data.data.maths[targetGardenId - 1], this._lessonDotContainer, this._lessonsNumber, this._rewardLessonLanguage, this._rewardLessonMaths);
        this._focusedGarden.drawPlant();
        this._focusedGarden.drawStar(this._rewardChapter);

        this.unlockPlants();
        if(this._focusedGarden.starMiddle) {
            this.unlockStarMiddle();
        }

        if(this._focusedGarden.starPath.length > 0) {
            this.unlockStarPath();
        }
    };

    GardenScreen.prototype._removeSlideFunctions = function _removeSlideFunctions () {
        if (this._gardenLeftToFocus) {
            this._gardenLeftToFocus.setInteractive(false);
            this._gardenLeftToFocus.children[0].setInteractive(false);
        }

        if (this._gardenRightToFocus) {
            this._gardenRightToFocus.setInteractive(false);
            this._gardenRightToFocus.children[0].setInteractive(false);
        }
    };

    GardenScreen.prototype._registerFocusAndNeighbours = function _registerFocusAndNeighbours (targetGardenId) {
        
        // LEFT
        if (targetGardenId > 1) {
            this._gardenLeftToFocus = this._gardens[targetGardenId - 1];
            // console.log("Garden " + (targetGardenId - 1) + " assigned as Left Garden");
        }
        else {
            this._gardenLeftToFocus = null;
        }
        
        // FOCUS
        this._focusedGarden = this._gardens[targetGardenId];

        // RIGHT
        if (targetGardenId < this._gardensCount) {
            this._gardenRightToFocus = this._gardens[targetGardenId + 1];
            // console.log("Garden " + (targetGardenId + 1) + " assigned as Right Garden");
        }
        else {
            this._gardenRightToFocus = null;
        }
    };

    GardenScreen.prototype._assignSlideFunctionsToNeighbourGardens = function _assignSlideFunctionsToNeighbourGardens (targetGardenId) {

        if (this._gardenLeftToFocus) {
            this._gardenLeftToFocus.setInteractive(true);
            this._gardenLeftToFocus.children[0].setInteractive(true);
            this._gardenLeftToFocus.onClick = this._slideToGarden.bind(this);
            // console.log("Left Garden has been set Interactive");
        }

        this._focusedGarden.setInteractive(false);
        this._focusedGarden.children[0].setInteractive(false);

        if (this._gardenRightToFocus && this._chaptersProgression[targetGardenId] != "Locked") {
            this._gardenRightToFocus.setInteractive(true);
            this._gardenRightToFocus.children[0].setInteractive(true);
            this._gardenRightToFocus.onClick = this._slideToGarden.bind(this);
            // console.log("Right Garden has been set Interactive");
        }
    };

    GardenScreen.prototype._tweenStar = function _tweenStar (star) {
        // AJOUTER ASSET

        var duration = 1000;

        star.alpha = 1;
        star.scale.x = 0.5;
        star.scale.y = 0.5;

        if (this._index < 3){
            createjs.Tween.get(star.scale).to({x: 1.5, y: 1.5}, duration, createjs.Ease.bounceOut).call(function () {
                this._tweenStar(star);
                this._index++;
            }.bind(this));
            createjs.Tween.get(star).to({rotation: star.rotation + Math.PI},duration);
        }
        else {
            this._toyChestButton.scale.x = 0;
            this._toyChestButton.scale.y = 0;

            createjs.Tween.get(star.scale).to({x: 1, y: 1}, duration, createjs.Ease.bounceOut).wait(100).call(function () {
                this._index = 0;

                // A MODIFIER UNE FOIS L'ASSET INTEGRER
                star.parent.removeChild(star);
                this.addChild(star);
                //

                var guide = {
                    guide : {
                        path: [
                            star.x, star.y,
                            this._tweenControlPoint.x, this._tweenControlPoint.y,
                            this._tweenDestinationPoint.x, this._tweenDestinationPoint.y
                        ]
                    }
                };

                createjs.Tween.get(star).to(guide, duration * 2).wait(100).call(function(){
                    createjs.Tween.get(star).to({alpha: 0}, duration, createjs.Ease.cubicInOut).call(function () {
                        // DETRUIRE ASSET
                        // A MODIFIER UNE FOIS L'ASSET INTEGRER
                        star.parent.removeChild(star);
                        this._focusedGarden.addChild(star);
                        //

                        this._userProfile.starMiddle = this._focusedGarden.id;
                        this._addChildrenInterractiveStatus();
                    }.bind(this));
                    createjs.Tween.get(this._toyChestButton).to({alpha: 0}, duration, createjs.Ease.cubicInOut);
                    createjs.Tween.get(this._toyChestButton.scale).to({x: 0, y: 0}, duration, createjs.Ease.cubicInOut);
                }.bind(this));
            }.bind(this));
            createjs.Tween.get(star).to({rotation: star.rotation + Math.PI},duration);
            createjs.Tween.get(this._toyChestButton).to({alpha: 1}, duration, createjs.Ease.cubicInOut);
            createjs.Tween.get(this._toyChestButton.scale).to({x: 1, y: 1}, duration, createjs.Ease.cubicInOut);
        }
    };

    GardenScreen.prototype._removeAllChildrenInterractiveStatus = function _removeAllChildrenInterractiveStatus (pObject) {
        var lLength = pObject.children.length;
        var lChildren, i;

        for(i = lLength-1; i>=0; i--){
            if(pObject.children){
                lChildren = pObject.children[i];
                if(lChildren.children.length >= 1) this._removeAllChildrenInterractiveStatus(lChildren);
                if (lChildren.interactive) {
                    lChildren.interactive = false;
                    this._interactiveObject.push(lChildren);
                }
            }
        }
        if(pObject.interactive) {
            pObject.interactive = false;
            this._interactiveObject.push(pObject);
        }
    }

    GardenScreen.prototype._addChildrenInterractiveStatus = function _addChildrenInterractiveStatus () {
        var lLength = this._interactiveObject.length;
        var i;

        for(i = 0; i < lLength; i++) {
            this._interactiveObject[i].interactive = true;
        }

        this._interactiveObject = [];
    }

    GardenScreen.prototype._onClickOnBackButton = function _onClickOnBackButton (eventData) {
        if (Kalulu.isTalking) return;
        SoundManager.getSound("click").play();
        this._interfaceManager.requestBrainScreen();
    };

    GardenScreen.prototype._onClickOnKaluluButton = function _onClickOnKaluluButton (eventData) {
        eventData.stopPropagation();
        var lPlantLevel = 0;
        var lFertilizer = this._userProfile.fertilizer;

        for (var i = 0; i < this.plants.length; i++) {
            switch (this.plants[i]._state)
            {
                case "Large":
                    lPlantLevel +=3;
                break;
                case "Medium":
                    lPlantLevel+=2;
                break;
                case "Small":
                    lPlantLevel+=1;
                break;
                case "NotStarted":
                break;
            }
        }

        Kalulu.x = Kalulu.width/2;
        Kalulu.y = -Kalulu.height/3 - 50;
        this._hud.bottomLeft.addChild(Kalulu);

        if (!this._userProfile.kaluluTalks.lesson)  Kalulu.startTalk("kalulu_tuto_introstep01_gardenscreen");
        else if (lPlantLevel===0 && lFertilizer===0)Kalulu.startTalk("kalulu_info_gardenscreen03");
        else if (lPlantLevel<=7 && lFertilizer>0)   Kalulu.startTalk("kalulu_info_gardenscreen01");
        else if (lPlantLevel>7)                     Kalulu.startTalk("kalulu_info_gardenscreen02");
        else                                        Kalulu.startTalk("kalulu_info_gardenscreen03");
    };

    return GardenScreen;
});