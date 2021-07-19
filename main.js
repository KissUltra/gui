'use strict';

const MIN_CONFIG_VERSION = 126; // this gui can manage versions in this range
const MAX_CONFIG_VERSION = 126;

function scrollTop() {
	   $("#content").scrollTop(60);
}

function setLanguage(lang) {
	chrome.storage.local.set({'language': lang});
}

function getLanguage(callback) {
	  chrome.storage.local.get('language', function (result) {
          if ((result !== undefined) && (result.language !== undefined)) {
              callback(result.language);
          } else {
              callback('en');
          }
      });
}

function changeLanguage() {
    getLanguage(function (lang) {
        console.log("Switching to " + lang);
        $.i18n({
            locale: lang
        });
        $.i18n.locale = lang;
        $.i18n().load('./i18n/' + lang + '.json', lang).done(
            function () {
                $("*").i18n();
            });
    });
}

function showUpdateModal() {
	$(".modal,.modal-overlay").show();
} 

function hideModal() {
	$(".modal,.modal-overlay").hide();
}

function checkGithubRelease(currVersion) {
		
    console.log("Looking for version newer then " + currVersion);
    $.get('https://api.github.com/repos/KissUltra/gui/releases', function (releaseData) {
        console.log(releaseData);
        if (releaseData.length > 0) {
        	console.log('Latest release found: ' + releaseData[0].tag_name, ' parameter: ' + currVersion);
        	if (semver.gt(releaseData[0].tag_name, currVersion)) {
        		console.log('New version ' + releaseData[0].tag_name + ' available!');
        		showUpdateModal();
        	} else {
        		hideModal();
        		console.log('Latest version!');
        	}
    	}
    });
};

$(document).ready(function () {

    $.i18n.debug = true;

    changeLanguage();

    // Check for update
    checkGithubRelease(chrome.runtime.getManifest().version);

    PortHandler.initialize();
    CONTENT.welcome.initialize();


    $(".navigation-menu-button").on("click", function () {
    	
        var self = this;
        var content = $(self).attr('data-name');
        
        function content_ready() {
            GUI.contentSwitchInProgress = false;
        }
    
        if ($(self).hasClass('unlocked') && GUI.activeContent != content) {
            $("#navigation button").removeClass("active-menu");
        	$(self).addClass("active-menu");
            GUI.contentSwitchInProgress = true;
            GUI.contentSwitchCleanup(function () {
                CONTENT[content].initialize();
            });
        }

    });
    
    $(".update-close, .modal-overlay").on("click", function() {
    	hideModal();
    });
    
    $(".update-download").on("click", function() {
    	hideModal();
    });
});

Number.prototype.clamp = function (min, max) {
    return Math.min(Math.max(this, min), max);
};
