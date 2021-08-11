'use strict';

function  getVersion() {
	if (isNative()) {
		return chrome.runtime.getManifest().version;
	} else {
		return "3.3.3-FIXME";
	}
}

CONTENT.welcome = {};

CONTENT.welcome.initialize = function (callback) {
    var self = this;

    GUI.switchContent('welcome', function () {
        GUI.load("./content/welcome.html", htmlLoaded);
    });

   
    function htmlLoaded() {
        $("#language").val($.i18n.locale);
        $("#portArea").show();
        $('#menu').show();
        $(".navigation-menu-button").css("display", "");
        $('#gui_version').text("v"+getVersion());

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
