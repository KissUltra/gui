'use strict';

var reader = null;
var readerCancelCallback = false;

async function readLoop(port) {
	var exitFlag = false;
	reader = port.readable.getReader();
	while (port.readable && !exitFlag) {
		try {
			while (true) {
				const { value, done } = await reader.read();
				if (done) {
					console.log("Cancelled in the loop");
					exitFlag = true;
					break;
				}
				for (var i = (webSerial.onReceive.listeners.length - 1); i >= 0; i--) {
					webSerial.onReceive.listeners[i]({ 'connectionId': 1, 'data': value.buffer });
				}
			}
		} catch (error) {
			for (var i = (webSerial.onReceiveError.listeners.length - 1); i >= 0; i--) {
				webSerial.onReceiveError.listeners[i]({ 'connectionId': 1, 'error': error }); 
			}
		} finally {
			reader.releaseLock();
		}
	}
	 
	if (readerCancelCallback) {
		readerCancelCallback();
	}
};


async function readUntilClosed() {
	
}


var webSerial = {
    request: null,
    connectionId: false,
    bitrate: 0,
    bytesReceived: 0,
    bytesSent: 0,
    failed: 0,
    port: null,

    transmitting: false,
    outputBuffer: [],
    
    connect: function (device, options, callback) {
        var self = this;

        var request = {
            path: WEB_SERIAL,
            options: options,
            callback: callback,
            fulfilled: false,
            canceled: false
        };

        // expose request object reference to the serial layer so .disconnect routine can interact with the flags
        self.request = request;
             
        device.open(options).then(function() {
        	self.device = device;
            self.bitrate = options.baudRate;
            self.bytesReceived = 0;
            self.bytesSent = 0;
            self.failed = 0;
            request.fulfilled = true;
            
            
            // Listeners
            
            self.onReceive.addListener(function logBytesReceived(info) {
                self.bytesReceived += info.data.byteLength;
                self.dump('->', info.data);
            });

            self.onReceiveError.addListener(function watchForOnReceiveErrors(info) {
            	console.log("ERROR!!!");
                console.log(info);
                if (info.error.code == 19) {
                	   self.emptyOutputBuffer();

                       // remove listeners
                       for (var i = (self.onReceive.listeners.length - 1); i >= 0; i--) {
                           self.onReceive.removeListener(self.onReceive.listeners[i]);
                       }

                       for (var i = (self.onReceiveError.listeners.length - 1); i >= 0; i--) {
                           self.onReceiveError.removeListener(self.onReceiveError.listeners[i]);
                       }
               
                    
                       	self.device.close().then(function() {
                             console.log("Closing port, active content is " + GUI.activeContent);
                               self.connectionId = false;
                               self.bitrate = 0;
        			
        						GUI.connectedTo = false;
        						if (GUI.activeContent != 'fc_flasher') {
        						   	GUI.switchToConnect();
        							GUI.contentSwitchCleanup();
                					GUI.contentSwitchInProgress = false;
                					kissProtocol.removePendingRequests();
                		
                					GUI.timeoutKillAll();
                					GUI.intervalKillAll();
                						
                					kissProtocol.disconnectCleanup();
        						   	
        							$('#content').empty();
        							// load welcome content
        							CONTENT.welcome.initialize();
        						}
        			
                             
                           });
                     

                }
            });
            
         
            readerCancelCallback = false;
            readLoop(device);
            
            if (request.callback) request.callback(true);
        });
    },
    disconnect: function (callback) {
    	var self = this;

    	console.log("disconnect()");

    	self.emptyOutputBuffer();

    	// remove listeners
    	for (var i = (self.onReceive.listeners.length - 1); i >= 0; i--) {
    		self.onReceive.removeListener(self.onReceive.listeners[i]);
    	}

    	for (var i = (self.onReceiveError.listeners.length - 1); i >= 0; i--) {
    		self.onReceiveError.removeListener(self.onReceiveError.listeners[i]);
    	}

    	readerCancelCallback = function() {
    		readerCancelCallback = false;

    		self.device.close().then(function() {
    			console.log("Closing port");
    			self.connectionId = false;
    			self.bitrate = 0;
    			if (callback) callback({});
    		});
    	};


    	try { 
    		console.log("Cancelling reader");
    		reader.cancel(); 
    	} catch (error) {
    		self.connectionId = false;
    		self.bitrate = 0;
    		if (callback) callback({});
    	}
    },
    getDevices: function (callback) {
        callback([WEB_SERIAL]);
    },
    getInfo: function (callback) {
       if (callback) callback();
    },
    getControlSignals: function (callback) {
        if (callback) callback();
    },
    setControlSignals: function (signals, callback) {
        if (callback) callback();
    },
    send: function (data, callback) {
        var self = this;
        self.outputBuffer.push({ 'data': data, 'callback': callback });

        function send() {
            // store inside separate variables in case array gets destroyed
            var data = self.outputBuffer[0].data,
                callback = self.outputBuffer[0].callback;

            self.dump('<-', data);
               
            const writer = self.device.writable.getWriter();
            const toSend = new Uint8Array(data);
            writer.write(toSend).then(function() {
            	

            	   
            	    self.bytesSent += toSend.length;; // data.length

                    // fire callback
                    if (callback) callback({});

                    // remove data for current transmission form the buffer
                    self.outputBuffer.shift();

                    // if there is any data in the queue fire send immediately, otherwise stop trasmitting
                    if (self.outputBuffer.length) {
                        // keep the buffer withing reasonable limits
                        if (self.outputBuffer.length > 100) {
                            var counter = 0;

                            while (self.outputBuffer.length > 100) {
                                self.outputBuffer.pop();
                                counter++;
                            }

                            console.log('SERIAL: Send buffer overflowing, dropped: ' + counter + ' entries');
                        }

                        send();
                    } else {
                        self.transmitting = false;
                    }
            });
            
     	   writer.releaseLock();
         
        }

        if (!self.transmitting) {
            self.transmitting = true;
            send();
        }
    },
    onReceive: {
        listeners: [],

        addListener: function (functionReference) {
            this.listeners.push(functionReference);
        },
        removeListener: function (functionReference) {
            for (var i = (this.listeners.length - 1); i >= 0; i--) {
                if (this.listeners[i] == functionReference) {
                    this.listeners.splice(i, 1);
                }
            }
        }
    },
    onReceiveError: {
        listeners: [],

        addListener: function (functionReference) {
            this.listeners.push(functionReference);
        },
        removeListener: function (functionReference) {
            for (var i = (this.listeners.length - 1); i >= 0; i--) {
                if (this.listeners[i] == functionReference) {
                    this.listeners.splice(i, 1);
                    break;
                }
            }
        }
    },
    emptyOutputBuffer: function () {
        this.outputBuffer = [];
        this.transmitting = false;
    },
    byteToHex: function (byte) {
        var hexChar = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C", "D", "E", "F"];
        return hexChar[(byte >> 4) & 0x0f] + hexChar[byte & 0x0f];
    },
    wordToHex: function (byte) {
        return this.byteToHex(byte >> 8 & 0xff) + this.byteToHex(byte & 0xff);
    },
    dump: function (direction, data) {
//        var view = new Uint8Array(data);
//        var line = '';
//        for (var i = 0; i < view.length; i++) {
//            if (i%16==0) {
//                if (i>0) console.log(line);
//                line=direction + ' ' + this.wordToHex(i) + ': ';
//            }
//            line +=  this.byteToHex(view[i]) + ' ';
//         }
//        console.log(line);
    },
    reconnect: function(timeout, callback) {
    	  var self = this;
    	  var device = self.device;
    	  var options = self.request.options;
    	  console.log("reconnecting()");
    	  console.log(device);
    	  console.log(options);
    	  //self.disconnect(function (result) {
    		  window.setTimeout(function() {
    			  self.connect(device, options, function (connectionInfo) {
        			  console.log("Reconnect: Connected");
        			  callback(true);
        		  });
    		  }, timeout);
    	 // });
    }
};