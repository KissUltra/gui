'use strict';

CONTENT.welcome = {};

CONTENT.welcome.initialize = function (callback) {
    var self = this;

    GUI.switchContent('welcome', function () {
        GUI.load("./content/welcome.html", htmlLoaded);
    });

   
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
    }
};

CONTENT.welcome.cleanup = function (callback) {
    if (callback)
        callback();
};
