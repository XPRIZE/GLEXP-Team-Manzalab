define([
    '../elements/anim_background',
    '../utils/ui/screen',
    '../utils/sound/sound_manager'
], function (
    AnimBackground,
    Screen,
    SoundManager
) {

    'use strict';

    /**
     * A screen showing a Lesson.
     * @constructor
     * @param {Lesson} lessonNode
    **/
    function LessonScreen (interfaceManager, lessonNode) {
        
        //console.log(lessonNode);
        
        Screen.call(this);
        this._interfaceManager = interfaceManager;
        this.name="mcLessonScreen";
        //this.modalImage = "purple_bg.png";

        this.build();

        this._kalulu = this._interfaceManager.kaluluCharacter;
        // Background

        this._backgroundContainer = this.getChildByName("mcLessonBackground");
        this._background = new AnimBackground("StarBg", 4);

        this._backgroundContainer.addChild(this._background);
        this._background.position.set(0,0);

        this._node = lessonNode;
        //console.log(this._node);

        // Reference auto-built parts
        this._lookAndLearnButton    = this.getChildByName("mcLookAndLearn");
        this._topMinigameButton     = this.getChildByName("mcMinigameTop");
        this._leftMinigameButton    = this.getChildByName("mcMinigameLeft");
        this._rightMinigameButton   = this.getChildByName("mcMinigameRight");
        
        this._backButton            = this.getChildByName("mcTLHudLesson").getChildByName("mcBackButton");
        this._hud                   = { bottomLeft: this.getChildByName("mcBLHudLesson") };
        this._kaluluButton          = this._hud.bottomLeft.getChildByName("mcKaluluButton");
        
        if (Config.enableGlobalVars) window.kalulu.lessonScreen = this;
        
        // Setup Buttons
        this._lookAndLearnButton.setup(this._node.children[0], this._onClickOnActivity.bind(this), true);
        
        var notionString = this.stringifyTargetNotions(this._node);
        // var centralText;
        // switch (notionString) {
        //     case 'count backwards':

        //     break;
        //     default:
        //         centralText = notion;
        //     break;
        // }
        
        this._lookAndLearnButton._upStyle       = { font : "140px Arial", fill : "#FFFFFF", align : "center" };
        this._lookAndLearnButton._overStyle     = { font : "160px Arial", fill : "#FFFFFF", align : "center" };
        this._lookAndLearnButton._downStyle     = { font : "160px Arial", fill : "#FFFFFF", align : "center" };
        this._lookAndLearnButton._disabledStyle = { font : "140px Arial", fill : "#777777", align : "center" };

        this._lookAndLearnButton.setText(notionString);
        this._lookAndLearnButton._setModeNormal();
        this._topMinigameButton.setup(this._node.children[1], this._onClickOnActivity.bind(this), true);
        this._rightMinigameButton.setup(this._node.children[2], this._onClickOnActivity.bind(this), true);
        this._leftMinigameButton.setup(this._node.children[3], this._onClickOnActivity.bind(this), true);

        this._backButton.onClick = this._onClickOnBackButton.bind(this);
        this._kaluluButton.onClick = this._onClickOnKaluluButton.bind(this);
    }

    LessonScreen.prototype = Object.create(Screen.prototype);
    LessonScreen.prototype.constructor = LessonScreen;

    LessonScreen.prototype.destroy = function destroy () {

        Screen.prototype.destroy.call(this);
    };

    LessonScreen.prototype._onClickOnActivity = function _onClickOnActivity (pEventData) {
        if (this._kalulu.isTalking) return;
        if (SoundManager.isPlaying("kalulu_amb_gardenscreen"))     SoundManager.getSound("kalulu_amb_gardenscreen").stop();
        if (SoundManager.isPlaying("kalulu_amb_gardenscreen2"))    SoundManager.getSound("kalulu_amb_gardenscreen2").stop();
        SoundManager.getSound("click").play();
        this._interfaceManager.requestMinigame(pEventData.target.data);
    };


    LessonScreen.prototype._onClickOnBackButton = function _onClickOnBackButton (pEventData) {
        if (this._kalulu.isTalking) return;
        SoundManager.getSound("click").play();
        this._interfaceManager.requestGardenScreen(this._node.parent.chapterNumber);
    };

    LessonScreen.prototype._onClickOnKaluluButton = function _onClickOnKaluluButton (pEventData) {
        

        this._kalulu.x = this._kalulu.width/2;
        this._kalulu.y = -this._kalulu.height/3-50;
        this._hud.bottomLeft.addChild(this._kalulu);
        var completedCount = 0;
        for (var i = 1 ; i <= 3 ; i++) {
            if (this._node.children[i].isCompleted) completedCount++;
        }
        var speechName = '';
        switch (completedCount) {
            case 0:
                speechName = 'kalulu_tuto_lessonscreen';
                break;
            case 1:
                speechName = 'kalulu_tuto_onegameplayed';
                break;
            case 2:
                speechName = 'kalulu_tuto_twogameplayed';
                break;
            case 3:
                speechName = 'kalulu_tuto_lessonscreen';
                break;
        }
        this._kalulu.startTalk(speechName);
    };

    LessonScreen.prototype.stringifyTargetNotions = function stringifyTargetNotions (lessonNode) {
        var string ="";
        
        for (var i = 0 ; i < lessonNode.targetNotions.length ; i++) {

            var targetNotion = lessonNode.targetNotions[i];

            if (string.length > 0) string += " & ";
            string += targetNotion.upperCase || targetNotion.VALUE;
        }

        return string;
    };

    return LessonScreen;
});