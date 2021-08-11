'use strict';

var ANDROID_OTG_SERIAL = "USB OTG", KISSFC_WIFI = "KISS WIFI", WEB_SERIAL = "Web Serial";

var serialDevice;

function getAvailableSerialDevices(callback) {
    var devices = [];

    if ((typeof chromeSerial !== 'undefined') && (isNative())) {
        chromeSerial.getDevices(function (chromeDevices) {
            for (var i = 0; i < chromeDevices.length; i++) devices.push(chromeDevices[i]);
            if (typeof androidOTGSerial !== 'undefined') devices.push(ANDROID_OTG_SERIAL);
            if (callback) callback(devices);
        });
    } else {
        if (typeof webSerial !== 'undefined') devices.push(WEB_SERIAL);
        if (callback) callback(devices);
    }
}

function getSerialDriverForPort(selectedPort) {
    if (selectedPort === ANDROID_OTG_SERIAL && (typeof androidOTGSerial !== 'undefined')) {
        return androidOTGSerial;
    } else if (selectedPort === WEB_SERIAL && (typeof webSerial !== 'undefined')) {
        return webSerial;
    }else if (typeof chromeSerial !== 'undefined') {
        return chromeSerial;
    } else {
        console.log("Unable to map " + selectedPort + " to the serial driver");
        return null;
    }
}
