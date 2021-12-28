'use strict';

CONTENT.welcome = {};

CONTENT.welcome.initialize = function (callback) {
    var self = this;
    
    self.curPic = 0;
    self.picCnt = 2;
    self.timeout;

    GUI.switchContent('welcome', function () {
        GUI.load("./content/welcome.html", htmlLoaded);
    });

    function changePicture() {
    	self.curPic++;
    	if (self.curPic >= self.picCnt) {
    		self.curPic = 0;
    	}
    	
    	for (var i=0; i<self.picCnt; i++) {
    		if (i != self.curPic) {
    			$("#fc_image_"+i).fadeOut(2000);
    		}
    	}
    	
    	$("#fc_image_" + self.curPic).fadeIn(2000, function() {
    		self.timeout = setTimeout(changePicture, 7500);
    	});
    }
   
    function htmlLoaded() {
    	if (isNative()) {
    		$("#web_gui").show();
    		$("#native_gui").hide();
    	} else {
    		$("#web_gui").hide();
    		$("#native_gui").show();
    	}
        $("#language").val($.i18n.locale);
        $("#portArea").show();
        $('#menu').show();
        $(".navigation-menu-button").css("display", "");
        
        if (isNative()) {
        	$('#gui_version').text("v"+chrome.runtime.getManifest().version);
        } else {
        	$.ajax({
        		  dataType: 'json',
        		  url: 'manifest.json',
        		  success: function(data) {
        				$('#gui_version').text("v"+data.version);
        		  }
        	});
        }

        $("#language").on("change", function () {
            var lang = $(this).val();
            $.i18n.locale = lang;
            setLanguage(lang);
            changeLanguage();
        });
        
        scrollTop();
        
        window.clearTimeout(self.timeout);
     
        self.timeout = setTimeout(changePicture, 5000);
    }
};

CONTENT.welcome.cleanup = function (callback) {
	window.clearTimeout(this.timeout);
    if (callback) {
        callback();
    }
};
