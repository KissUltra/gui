'use strict';

const MIN_CONFIG_VERSION = 126;
const MAX_CONFIG_VERSION = 133;

function isNative() {
	if (typeof(nw) !== 'undefined') {
		return true;
	} else {
		return false;
	}
}

function getProxyURL(url) {
	if (isNative()) {
		return url;
	} else {
		return "proxy.php?url=" + encodeURIComponent(url);
	}
}

function scrollTop() {
	   $("#content").scrollTop(60);
}

function setLanguage(lang) {
	if (window.localStorage) {
		window.localStorage.setItem('language', lang);
	} else {
		chrome.storage.local.set({'language': lang});
	}
}

function getLanguage(callback) {
	if (window.localStorage) {
		var result = window.localStorage.getItem('language');
		if ((result != null)) {
            callback(result);
        } else {
            callback('en');
        }
	} else {
	  chrome.storage.local.get('language', function (result) {
          if ((result !== undefined) && (result.language !== undefined)) {
              callback(result.language);
          } else {
              callback('en');
          }
      });
	}
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
	$(".modal-body").html("<p class='header'>This GUI version is outdated.</p>Click download button to update to the new version.");
	$(".modal-footer").html("<a class='update-download u-button' href='https://github.com/KissUltra/gui/releases' target='_blank'>Download</a>");
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
    
    if (isNative()) {
    	checkGithubRelease(chrome.runtime.getManifest().version);
    } else {
    	
    	if ((navigator.serial === undefined) || ((navigator.userAgent.match(/Opera|OPR\//) ? true : false))) {
    		$(".modal-body").html("<p class='header'>WRONG BROWSER!</p>Kiss Ultra Web GUI works only in the browsers with Web Serial support.<br><br>" +
    				"Please install latest version of Google Chrome or Microsoft Edge.<br><br>" +
    				"If you are unable to use one of those browsers, feel free to install native GUI from github.");
        	$(".modal-footer").html("<a class='u-button' href='https://github.com/KissUltra/gui/releases/latest'>Download Native GUI</a>");
        	$(".modal-overlay").show();
        	$(".modal").css({'top':'100px'}).show();
        	$(".modal-overlay").off('click'); 
    	}
    }

    PortHandler.initialize();
    CONTENT.welcome.initialize();
    
    $(".navigation-menu-button").removeClass('unlocked');


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
    $(".update-close").on("click", function() {
    	hideModal();
    });
    $(".update-download").on("click", function() {
    	hideModal();
    });
});

Number.prototype.clamp = function (min, max) {
    return Math.min(Math.max(this, min), max);
};
