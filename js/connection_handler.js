'use strict';

var bootTimeout;

var kissProtocolHandler = function (info) {
    kissProtocol.read(info);
}

$(document).ready(function () {
	
	
	if (isNative()) {
		$('#portArea a.connect').click(function () {
			var selectedPort = String($('#port').val())

			if (selectedPort != '0') {

				if (GUI.state == "CONNECT") {
					GUI.switchToConnecting();
					console.log('Connecting to: ' + selectedPort);
					GUI.connectingTo = selectedPort;
					serialDevice = getSerialDriverForPort(selectedPort);
					serialDevice.connect(selectedPort, {
						bitrate: 115200
					}, connected);
				} else {
					GUI.switchToConnect();
					GUI.timeoutKillAll();
					GUI.intervalKillAll();
					GUI.contentSwitchCleanup();
					GUI.contentSwitchInProgress = false;
					kissProtocol.removePendingRequests();
					serialDevice.disconnect(function () {
						kissProtocol.disconnectCleanup();
						disconnected();
						GUI.connectedTo = false;
						if (GUI.activeContent != 'firmware') {
							$('#content').empty();
							// load welcome content
							CONTENT.welcome.initialize();
						}
					});
				}
			}
		});
	} else {
		// web

//		navigator.serial.addEventListener("connect", (event) => {
//			console.log("CONNECT!!!");
//		});
//
//		navigator.serial.addEventListener("disconnect", (event) => {
//			console.log("DISCONNECT!!!");
//		});

		var connectButton = document.getElementById('connect');

		connectButton.addEventListener('click', async () => {
			var selectedPort = String($('#port').val());
			try {
				if (GUI.state == "CONNECT") {
					GUI.switchToConnecting();
					console.log('Connecting to: ' + selectedPort);
					GUI.connectingTo = selectedPort;
					
					let device;
					let filters = [{ usbVendorId: 0x0483, usbProductId: 0x5740 }];
					device = await navigator.serial.requestPort({'filters': filters});
					
					serialDevice = getSerialDriverForPort(selectedPort);
					serialDevice.connect(device, {
						baudRate: 115200,
						bufferSize: 16384
					}, connected);
				} else {
					GUI.switchToConnect();
					GUI.timeoutKillAll();
					GUI.intervalKillAll();
					GUI.contentSwitchCleanup();
					GUI.contentSwitchInProgress = false;
					kissProtocol.removePendingRequests();
					serialDevice.disconnect(function () {
						kissProtocol.disconnectCleanup();
						disconnected();
						GUI.connectedTo = false;
						if (GUI.activeContent != 'firmware') {
							$('#content').empty();
							// load welcome content
							CONTENT.welcome.initialize();
						}
					});
				}
							
			} catch (error) {
				console.log('Connect error: ' + error.message);
			}
		});
	}

    function connected(openInfo) {
    	console.log(openInfo);
        if (openInfo) {
            // update connectedTo
            GUI.connectedTo = GUI.connectingTo;

            // reset connectingTo
            GUI.connectingTo = false;

            // save selected port with chrome.storage if the port differs
            if (typeof chromeSerial !== 'undefined') {
                chrome.storage.local.get('lastUsedPort', function (result) {
                    if (result.lastUsedPort) {
                        if (result.lastUsedPort != GUI.connectedTo) {
                            // last used port doesn't match the one found in
                            // local db, we will store the new one
                            chrome.storage.local.set({
                                'lastUsedPort': GUI.connectedTo
                            });
                        }
                    } else {
                        // variable isn't stored yet, saving
                        chrome.storage.local.set({
                            'lastUsedPort': GUI.connectedTo
                        });
                    }
                });
            }

            GUI.switchToDisconnect();
            kissProtocol.data = [];
            
            var bootloaderListener = function (info) {
                serialDevice.onReceive.removeListener(bootloaderListener);
                if (info.data.byteLength > 0) {
                    var view = new Uint8Array(info.data);
                    if (view.length == 5) {
                        if (view[0] == 81 && view[1] == 255 && view[2] == 255 && view[3] == 125) {
                            // todo: Check for proper loader
                            if (view[4] != 0) {
                                clearTimeout(bootTimeout);
                                $("#portArea").children().addClass('flashing-in-progress');
                                $("#menu").hide();
                                $(".navigation-menu-button").hide(); // hide menu during flashing
                                CONTENT.fc_flasher.initialize();
                            }
                        }
                    }
                }
            }

            serialDevice.onReceive.addListener(bootloaderListener);
            serialDevice.onReceive.addListener(kissProtocolHandler);
            kissProtocol.init();

            var bootloaderCheck = [81, 255, 255, 125, 0];
            var bufferOut = new ArrayBuffer(bootloaderCheck.length);
            var bufferView = new Uint8Array(bufferOut);
            bufferView.set(bootloaderCheck, 0);
            serialDevice.send(bufferOut, function (a) {
                console.log("Bootloader check has been sent");
            });

            var bootTimeout = function () {
                serialDevice.onReceive.removeListener(bootloaderListener);
                CONTENT.configuration.initialize();
            }

            bootTimeout = setTimeout(bootTimeout, 250); // bootloader response in 250ms
        } else {
            console.log('Failed to open serial port');
            GUI.switchToConnect();
        }
    }

    function disconnected(result) {
        if (result) { // All went as expected
        } else { // Something went wrong
        }
    }
    
    
});
