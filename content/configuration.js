'use strict';

CONTENT.configuration = {
    USER_PIDs: [],
    PRESETS: {},
    legacyChecked: false
};




CONTENT.configuration.initialize = function (callback) {
    var self = this;
    
    self.hwTimeout = 0;
   
    function updateMixers() {
    	console.log("Update mixers");
    	var is4Motors = false;
    	if (kissProtocol.data[kissProtocol.GET_HARDWARE_INFO] != undefined) {
      	  var info = kissProtocol.data[kissProtocol.GET_HARDWARE_INFO];
      	  var tmp = info.hardwareVersion;
            var rev = tmp & 255;
            var brd = tmp >> 8;
            if (brd == 2) {
            	is4Motors = true;
            }
    	}
    	
    	if (is4Motors) {
    		console.log("ITS MINI!");
    		var mixerList = [ 4, 5, 6, 9, 10 ];
    		
    		var v = +$("select[name='mixer']").val(); // old value
    		
    		if ($("#outputMode").val() == "8") {
    			 for (var i=0; i<mixerList.length; i++) {
    				 $("option[value='"+mixerList[i]+"']", "select[name='mixer']").show();
    			 }
    		} else {
    			 for (var i=0; i<mixerList.length; i++) {
    				 $("option[value='"+mixerList[i]+"']", "select[name='mixer']").hide();
    				 if (v == mixerList[i]) {
    					 $("select[name='mixer']").val(2);
    				 }
    			 }
    		}
    	}
    }
    
    function updateInfo() {
    	if (kissProtocol.data[kissProtocol.GET_HARDWARE_INFO] != undefined) {
    	  var info = kissProtocol.data[kissProtocol.GET_HARDWARE_INFO];
    	  var tmp = info.hardwareVersion;
          var rev = tmp & 255;
          var brd = tmp >> 8;
          if (brd == 1) {
          	$("#hwversion").text("FCFC_ULTRA rev. " + rev);
          } else if (brd == 2) {
          	$("#hwversion").text("FCFC_ULTRA_MINI rev. " + rev);
          } else if (brd == 3) {
          	$("#hwversion").text("FCFC_ULTRA_2 rev. " + rev);
          } else {
          	$("#hwversion").text("UNKNOWN rev. " + rev);
          }
          var tmp = info.bootloaderVersion;
          var minor =  tmp & 255;
          var major = tmp >> 8;
          $("#blversion").text("v" + major + "." + (minor < 10 ? '0'+minor : minor));
    	} else {
    		$("#blversion").text('...');
    		$("#hwversion").text('...');
    	}
    	updateMixers();
    } 

    GUI.switchContent('configuration', function () {
    	$("#footer").hide();
        kissProtocol.send(kissProtocol.GET_SETTINGS, [kissProtocol.GET_SETTINGS], function () {
        	
            GUI.load("./content/configuration.html", function () {
                htmlLoaded(kissProtocol.data[kissProtocol.GET_SETTINGS])
                
                console.log("Getting hw info!");
                
                
                self.hwTimeout = window.setTimeout(function () {
                	console.log("No HW info received");
                	kissProtocol.init();
                }, 1000);
                
                if (kissProtocol.data[kissProtocol.GET_HARDWARE_INFO] == undefined) {
                	kissProtocol.send(kissProtocol.GET_HARDWARE_INFO, [kissProtocol.GET_HARDWARE_INFO, 0, 0], function () {
                        updateInfo();
                        if (self.hwTimeout != 0) window.clearTimeout(self.hwTimeout);
                	});
                } else {
                	if (self.hwTimeout != 0) window.clearTimeout(self.hwTimeout);
                	updateInfo();
                }
            });
        });
    });
    
    
    function fcNotCompatible() {
    	$(".modal-overlay").off('click');
    	$(".modal-overlay").on('click', function() {
    		$("#connect").click();
    		$(".modal-overlay").off('click');
    		hideModal();
    	});
    	$(".modal-body").html("<p class='header'>Warning!</p>This GUI is NOT compatible with your flight controller.<br><br>");
    	$(".modal-footer").html("");
    	$(".modal-overlay").show();
    	$(".modal").show();      
    }

    function copyTextToClipboard(text) {
        var copyFrom = $('<textarea/>');
        copyFrom.text(text);
        $('body').append(copyFrom);
        copyFrom.select();
        document.execCommand('copy');
        copyFrom.remove();
    }

    function backupConfig() {
    	if (isNative()) {
    		var chosenFileEntry = null;

    		var accepts = [{
    			extensions: ['txt']
    		}];

    		chrome.fileSystem.chooseEntry({
    			type: 'saveFile',
    			suggestedName: 'kissultra-backup',
    			accepts: accepts
    		}, function (fileEntry) {
    			if (chrome.runtime.lastError) {
    				console.error(chrome.runtime.lastError.message);
    				return;
    			}

    			if (!fileEntry) {
    				console.log('No file selected.');
    				return;
    			}

    			chosenFileEntry = fileEntry;

    			chrome.fileSystem.getDisplayPath(chosenFileEntry, function (path) {
    				console.log('Export to file: ' + path);
    			});

    			chrome.fileSystem.getWritableEntry(chosenFileEntry, function (fileEntryWritable) {

    				chrome.fileSystem.isWritableEntry(fileEntryWritable, function (isWritable) {
    					if (isWritable) {
    						chosenFileEntry = fileEntryWritable;
    						var config = kissProtocol.data[kissProtocol.GET_SETTINGS];
    						var json = JSON.stringify(config, function (k, v) {
    							if (k === 'buffer' || k === 'isActive' || k === 'actKey' || k === 'SN' || k === 'lipoConnected') {
    								return undefined;
    							} else {
    								return v;
    							}
    						}, 2);
    						var blob = new Blob([json], {
    							type: 'text/plain'
    						});

    						chosenFileEntry.createWriter(function (writer) {
    							writer.onerror = function (e) {
    								console.error(e);
    							};

    							var truncated = false;
    							writer.onwriteend = function () {
    								if (!truncated) {
    									truncated = true;
    									writer.truncate(blob.size);
    									return;
    								}
    								console.log('Config has been exported');
    							};

    							writer.write(blob);
    						}, function (e) {
    							console.error(e);
    						});
    					} else {
    						console.log('Cannot write to read only file.');
    					}
    				});
    			});
    		});
    	} else {
    		// web
    		var config = kissProtocol.data[kissProtocol.GET_SETTINGS];
    		var json = JSON.stringify(config, function (k, v) {
    			if (k === 'buffer' || k === 'isActive' || k === 'actKey' || k === 'SN' || k === 'lipoConnected' ) {
    				return undefined;
    			} else {
    				return v;
    			}
    		}, 2);
    		var blob = new Blob([json], {
    			type: 'text/plain;charset=utf-8'
    		});
    		//Check the Browser.
    		var isIE = false || !!document.documentMode;
    		if (isIE) {
    			window.navigator.msSaveBlob(blob, "kissultra-backup.txt");
    		} else {
    			var url = window.URL || window.webkitURL;
    			var link = url.createObjectURL(blob);
    			var a = $("<a />");
    			a.attr("download", "kissultra-backup.txt");
    			a.attr("href", link);
    			$("body").append(a);
    			a[0].click();
    			a.remove();	
    		}
    	}
    };

    function restoreConfig(callback) {

    	if (isNative()) {
    		var chosenFileEntry = null;

    		var accepts = [{
    			extensions: ['txt']
    		}];

    		chrome.fileSystem.chooseEntry({
    			type: 'openFile',
    			accepts: accepts
    		}, function (fileEntry) {
    			if (chrome.runtime.lastError) {
    				console.error(chrome.runtime.lastError.message);
    				return;
    			}

    			if (!fileEntry) {
    				console.log('No file selected, restore aborted.');
    				return;
    			}

    			chosenFileEntry = fileEntry;

    			chrome.fileSystem.getDisplayPath(chosenFileEntry, function (path) {
    				console.log('Import config from: ' + path);
    			});

    			chosenFileEntry.file(function (file) {
    				var reader = new FileReader();

    				reader.onprogress = function (e) {
    					if (e.total > 4096) {
    						console.log('File limit (4 KB) exceeded, aborting');
    						reader.abort();
    					}
    				};

    				reader.onloadend = function (e) {
    					if (e.total != 0 && e.total == e.loaded) {
    						console.log('Read OK');
    						try {
    							var json = JSON.parse(e.target.result);

    							console.log(json);
    							if (json.kissultra) {
    								if (callback) callback(json);
    							} else {
    								console.log("Old kiss backup detected!");
    								$(".modal-overlay").off('click');
    								$(".modal-overlay").on('click', function() {
    									hideModal();
    								});
    								$(".modal-body").html("<p class='header'>This backup is outdated.</p>For safety reasons, importing of the old backups is prohibited.");
    								$(".modal-footer").html("");
    								$(".modal-overlay").show();
    								$(".modal").show();                            	
    								return;
    							}
    						} catch (e) {
    							console.log('Wrong file');
    							return;
    						}
    					}
    				};
    				reader.readAsText(file);
    			});
    		});
    	} else {
    		// web
    	}
    };
    
    function isLegacyDefaults(data) {
    	
    	if ((+data['G_P'][0] == 3) &&
    		(+data['G_P'][1] == 3) &&
    		(+data['G_P'][2] == 8) &&
    		(+data['G_I'][0] == 0.035) &&
    		(+data['G_I'][1] == 0.035) &&
    		(+data['G_I'][2] == 0.050) &&
    		(+data['G_D'][0] == 10) &&
    		(+data['G_D'][1] == 10) &&
    		(+data['G_D'][2] == 5) &&
    		(+data['AUX'][0] == 0)) {
    		return true;
    	} 
    	return false;
    }
    
   
    function htmlLoaded(data) {
    	    	     	
        validateBounds('#content input[type="number"]');
        var settingsFilled = 0;

        $('input[name="3dMode"]').removeAttr("disabled");

        kissProtocol.send(kissProtocol.GET_INFO, [kissProtocol.GET_INFO], function () {
            var info = kissProtocol.data[kissProtocol.GET_INFO];
            $('#version').text(info.firmvareVersion);
            if ((data['CopterType'] == 7 || data['CopterType'] == 8) && (info.firmvareVersion.indexOf("KISSFC") != -1 && info.firmvareVersion.indexOf("F7") == -1)) {
                $('#pentaNoteFC').show();
            }
            if ((data['CopterType'] == 7 || data['CopterType'] == 8) && (info.firmvareVersion.indexOf("KISSCC") != -1)) {
                $('#pentaNoteCC').show();
            }
            
            
            if (!info.firmvareVersion.includes('ULTRA')) {
            	fcNotCompatible();
            }
        });

        $("#presets").change(function() {
        	var c = $(this).val();
        	if (c != "") {
        		console.log('Change to ' + c);
        		var tmp = CONTENT.configuration.PRESETS[c];

        		$('tr.roll input').eq(0).val(tmp.roll.p);
        		$('tr.roll input').eq(1).val(tmp.roll.i);
        		$('tr.roll input').eq(2).val(tmp.roll.d);

        		$('tr.pitch input').eq(0).val(tmp.pitch.p);
        		$('tr.pitch input').eq(1).val(tmp.pitch.i);
        		$('tr.pitch input').eq(2).val(tmp.pitch.d);

        		$('tr.yaw input').eq(0).val(tmp.yaw.p);
        		$('tr.yaw input').eq(1).val(tmp.yaw.i);
        		$('tr.yaw input').eq(2).val(tmp.yaw.d);

        		contentChange();
        	}
        });

        document.getElementById('rxdsm1').style.display = "inline";
        document.getElementById('rxdsm2').style.display = "inline";
        document.getElementById('rxsbus1').style.display = "inline";
        document.getElementById('rxsbus2').style.display = "inline";
        document.getElementById('rxsbus3').style.display = "inline";
        document.getElementById('rxsumd1').style.display = "inline";
        document.getElementById('rxexbus1').style.display = "inline";
        document.getElementById('rxsrxl1').style.display = "inline";
        document.getElementById('rxxbusb1').style.display = "inline";
        document.getElementById('rxcrsf1').style.display = "inline";
        document.getElementById('rxfport1').style.display = "inline";
        document.getElementById('rxfport2').style.display = "inline";
        document.getElementById('rxsbusfast').style.display = "inline";
        document.getElementById('rxghost').style.display = "inline";

        if (data['vtxType'] == 0) {
            $('#aux5').hide();
            $('#aux6').hide();
            $('#aux7').hide();
        }
      
        kissProtocol.send(kissProtocol.GET_INFO, [kissProtocol.GET_INFO], function () {
        	var info = kissProtocol.data[kissProtocol.GET_INFO];
        	var FCinfo = info.firmvareVersion.split(/-/g);

        	switch (FCinfo[0]) {
        	case "KISSFC":
        	case "KISSCC":
        	case "FETTEC_FC_NANO":
        		$("select[name='outputMode'] option[value='6']").remove(); // dshot1200
        		$("select[name='outputMode'] option[value='7']").remove(); // dshot2400
        		$("select[name='outputMode'] option[value='8']").remove(); // onewire
        		$("li[data-name='fc_flasher']").hide(); // v2 flasher
        		break;
        	case "KISSFCV2F7":
        	case "FETTEC_KISSFC":
        		$("li[data-name='fc_flasher']").show();
        		break;
        	default:
        		break;
        	}
        });
    

        var MCUid = '';
        for (var i = 0; i < 4; i++) {
            if (data['SN'][i] < 16) MCUid += '0';
            MCUid += data['SN'][i].toString(16).toUpperCase();
        }
        MCUid += '-';
        for (var i = 4; i < 8; i++) {
            if (data['SN'][i] < 16) MCUid += '0';
            MCUid += data['SN'][i].toString(16).toUpperCase();
        }
        MCUid += '-';
        for (var i = 8; i < 12; i++) {
            if (data['SN'][i] < 16) MCUid += '0';
            MCUid += data['SN'][i].toString(16).toUpperCase();
        }

        var sntext = MCUid + ' (' + (data['isActive'] ? $.i18n('text.activated') : $.i18n('text.not-activated')) + ')';
        $('#SN').text(sntext);
        $('#eeprom1').text(data['ver']);
        $('#SN2').text($.i18n("text.serial-number") + ": " + MCUid);
        $('#SN').on('click', function (e) {
            copyTextToClipboard(MCUid);
            $('#SN').text($.i18n("text.serial-clipboard"));
            setTimeout(function () {
                $('#SN').text(sntext);
            }, 1000);
        });

        var mixerList = [2, 1, 4, 5, 6, 9, 10];
           
 
        var mixer_list_e = $('select.mixer');
        for (var i = 0; i < mixerList.length; i++) {
            mixer_list_e.append('<option data-i18n="mixer.' + (mixerList[i]) + '" value="' + (mixerList[i]) + '">' + mixerList[i] + '</option>');
        }


        mixer_list_e.on('change', function () {
            var val = parseInt($(this).val());
            contentChange();
            if (val == 0) $(".tricopter").show(); else $(".tricopter").hide();
            UpdateMixerImage(val, data['ESCOutputLayout'], data['reverseMotors']);
        });

        // apply configuration values to GUI elements
        // uav type and receiver
        mixer_list_e.val(data['CopterType']).change();
        $('#rxType').val(data['RXType']);

        $('#rxType').on('change', function () {
        	
        	 if (data['ver'] >= 129) {
                          
             	if ($('#rxType').val() == 17)  {
             		$('#gimbalPTMode').show();
             	} else {
             		$('#gimbalPTMode').hide();
             	}
             }
        	 
            contentChange();
        });

        // general settings
        $('input[name="minThrottle"]').val(data['MinThrottle16']);
        $('input[name="minThrottle"]').on('input', function () {
            contentChange();
        });
        $('input[name="maxThrottle"]').val(data['MaxThrottle16']);
        $('input[name="maxThrottle"]').on('input', function () {
            contentChange();
        });
        $('input[name="minCommand"]').val(data['MinCommand16']);
        $('input[name="minCommand"]').on('input', function () {
        	if ($(this).val() == 1000) {
        		$("input[name='throttleScaling']").prop("disabled", false);
        	} else {
        		$("input[name='throttleScaling']").prop("disabled", true);
        	}
            contentChange();
        });
        $('input[name="midCommand"]').val(data['MidCommand16']);
        $('input[name="midCommand"]').on('input', function () {
            contentChange();
        });
        $('input[name="TYmid"]').val(data['TYmid16']);
        $('input[name="TYmid"]').on('input', function () {
            contentChange();
        });
        $('input[name="TYinv"]').prop('checked', data['TYinv8']);
        $('input[name="TYinv"]').on('input', function () {
            contentChange();
        });

        var outputMode = data['ESConeshot125'];

        $("#outputMode").val(outputMode);
        $("#outputMode").on('change', function () {
            contentChange();
            updateMixers();
        });

        $('input[name="failsaveseconds"]').val(data['failsaveseconds']);
        $('input[name="failsaveseconds"]').on('input', function () {
            contentChange();
        });


        $('input[name="3dMode"]').prop('checked', data['Active3DMode']);
        if (data['Active3DMode']) $("#aux4").show(); else $("#aux4").hide();
        $('input[name="3dMode"]').on('click', function () {
            if ($(this).prop('checked')) $("#aux4").show(); else $("#aux4").hide();
            contentChange();
        });

        // pid and rates
        // roll
        $('tr.roll input').eq(0).val(data['G_P'][0]);
        $('tr.roll input').eq(1).val(data['G_I'][0]);
        $('tr.roll input').eq(2).val(data['G_D'][0]);
        $('tr.roll input').eq(3).val(data['RC_Rate'][0]);
        $('tr.roll input').eq(4).val(data['RPY_Expo'][0]);
        $('tr.roll input').eq(5).val(data['RPY_Curve'][0]);
        for (var i = 0; i < 6; i++) {
            $('tr.roll input').eq(i).on('input', function () {
                contentChange();
            });
        }

        // pitch
        $('tr.pitch input').eq(0).val(data['G_P'][1]);
        $('tr.pitch input').eq(1).val(data['G_I'][1]);
        $('tr.pitch input').eq(2).val(data['G_D'][1]);
        $('tr.pitch input').eq(3).val(data['RC_Rate'][1]);
        $('tr.pitch input').eq(4).val(data['RPY_Expo'][1]);
        $('tr.pitch input').eq(5).val(data['RPY_Curve'][1]);
        for (var i = 0; i < 6; i++) {
            $('tr.pitch input').eq(i).on('input', function () {
                contentChange();
            });
        }

        // yaw
        $('tr.yaw input').eq(0).val(data['G_P'][2]);
        $('tr.yaw input').eq(1).val(data['G_I'][2]);
        $('tr.yaw input').eq(2).val(data['G_D'][2]);
        $('tr.yaw input').eq(3).val(data['RC_Rate'][2]);
        $('tr.yaw input').eq(4).val(data['RPY_Expo'][2]);
        $('tr.yaw input').eq(5).val(data['RPY_Curve'][2]);
        for (var i = 0; i < 6; i++) {
            $('tr.yaw input').eq(i).on('input', function () {
                contentChange();
            });
        }

        //TPA
        $('tr.TPA input').eq(0).val(data['TPA'][0]);
        $('tr.TPA input').eq(1).val(data['TPA'][1]);
        $('tr.TPA input').eq(2).val(data['TPA'][2]);
        for (var i = 0; i < 3; i++) {
            $('tr.TPA input').eq(i).on('input', function () {
                contentChange();
            });
        }

        // level
        $('tr.level input').eq(0).val(data['A_P']);
        $('tr.level input').eq(1).val(data['A_I']);
        $('tr.level input').eq(2).val(data['A_D']);
        $('tr.level input').eq(3).val(Math.round(data['maxAng']));

        for (var i = 0; i < 4; i++) {
            $('tr.level input').eq(i).on('input', function () {
                contentChange();
            });
        }

        $("#aux0").kissAux({
            name: $.i18n("column.arm"),
            change: function () { contentChange(); },
            value: data['AUX'][0]
        });
        $("#aux1").kissAux({
            name: $.i18n("column.level"),
            change: function () { contentChange(); },
            value: data['AUX'][1]
        });
        $("#aux2").kissAux({
            name: $.i18n("column.buzzer"),
            change: function () { contentChange(); },
            value: data['AUX'][2]
        });
        $("#aux3").kissAux({
            name: $.i18n("column.led"),
            change: function () { contentChange(); },
            knob: true,
            value: data['AUX'][3]
        });
        $("#aux4").kissAux({
            name: $.i18n("column.3d"),
            change: function () { contentChange(); },
            value: data['AUX'][4]
        });

        $("#aux5").kissAux({
            name: $.i18n("column.vtx-power"),
            change: function () { contentChange(); },
            knob: true,
            value: data['AUX'][5]
        });

        $("#aux6").kissAux({
            name: $.i18n("column.vtx-band"),
            change: function () { contentChange(); },
            value: data['AUX'][6]
        });

        $("#aux7").kissAux({
            name: $.i18n("column.vtx-channel"),
            change: function () { contentChange(); },
            value: data['AUX'][7]
        });


            $("#aux8").kissAux({
                name: $.i18n("column.turtle-mode"),
                change: function () { contentChange(); },
                value: data['AUX'][8]
            }).show();
            
            if (outputMode < 3) {
                $("#aux8").hide();
            }
     

            $("#aux9").kissAux({
                name: $.i18n("column.runcam-split"),
                change: function () { contentChange(); },
                value: data['AUX'][9]
            });
            
            $("#aux10").kissAux({
                name: $.i18n("column.led-brightness"),
                change: function () { contentChange(); },
                value: data['AUX'][10],
                knob: true
            });


            $("#aux13").kissAux({
                name: $.i18n("column.rth"),
                change: function () { contentChange(); },
                value: data['AUX'][13]
            });
            
            if (data['ver'] >= 132) {
            	$("#aux14").kissAux({
            		name: $.i18n("column.prearm"),
            		change: function () { contentChange(); },
            		value: data['AUX'][14]
            	});

            	$("#aux14").show();
            	
            	if (data['ver'] >= 134) {
            		$("#aux14").find('select').on('input', function() {
            			if (+$(this).val() == 0) {
            				$("#prearm_mode_row").hide();
            			} else {
            				$("#prearm_mode_row").show();
            			}
            		});
            		if (+$("#aux14").find('select').val() != 0) {
            			$("#prearm_mode_row").show();
            		}
            		
            		$('#prearm_mode').val(+data['prearm_mode']);
            		
            		$('#prearm_mode').on('change', function () {
                     	contentChange();
                    });
            	}
            	
            	if (data['ver'] >= 135) {
            		$("#aux0").append(" &nbsp;<input id='softarm_mode' class='unsafe' type='checkbox' /> <span class='softarm_mode' data-i18n='column.softarm-mode'>Soft</span>");
            		
            		$('#softarm_mode').prop('checked', data['softarm_mode']);
            		
            		$('#softarm_mode').on('change', function () {
                     	contentChange();
                    });
            	}
            } else {
            	$("#aux14").hide();
            }
            
            // inflight tuning
            if (data['ver'] >= 136) { // CHANGE ME!
            	$("#aux11").kissAux({
            		name: $.i18n("column.inflight.action"),
            		change: function () { contentChange(); },
            		value: data['AUX'][11]
            	});

            	$("#aux11").show();
            	
            	$("#aux12").kissAux({
            		name: $.i18n("column.inflight.value"),
            		change: function () { contentChange(); },
            		knobOnly: true,
            		value: data['AUX'][12]
            	});

            	$("#aux12").show();
            } else {
            	$("#aux11").hide();
            	$("#aux12").hide();
            }
            
  
            if (data['LPF'] == data['DLpF'] && data['LPF'] == data['yawLpF']) {
                $('select[name="lpf"]').val(data['LPF']);
                $("select[name='lpf'] option[value='7']").prop("disabled", true);
            } else {
                $('select[name="lpf"]').val(7);
            }
      
            $('select[name="lpf"]').on('change', function () {
            	contentChange();
            });

    

        // Temp fix
        if (typeof androidOTGSerial !== 'undefined') {
            $('#backup').hide();
            $('#restore').hide();
        }

        if (data.lipoConnected == 1) {
            $(".unsafe").addClass("unsafe_active");
        } else {
            $(".unsafe").removeClass("unsafe_active");
        }
   

        // Begin Custom ESC Orientation


            $('select[name="ESCOutputLayout"]').val(data['ESCOutputLayout']);

            if (data['CopterType'] == 1 || data['CopterType'] == 2) {
                $('select[name="ESCOutputLayout"]').removeAttr("disabled");
                $('select[name="ESCOutputLayout"]').val(data['ESCOutputLayout']);
            } else {
                $('select[name="ESCOutputLayout"]').prop('disabled', 'true');
                $('select[name="ESCOutputLayout"]').val(0);
            }

            $('select[name="ESCOutputLayout"]').on('change', function () {
                contentChange();
                UpdateMixerImage(data['CopterType'], parseInt($('select[name="ESCOutputLayout"]').val()), data['reverseMotors']);
            })
            
            
            
            if (data['ver'] >= 129) {
            	$('#gimbalPTMode').val(data['gimbalPTMode']);
            	
            	$('#gimbalPTMode').on('change', function () {
                    contentChange();
                });
            
            	if ($('#rxType').val() == 17)  {
            			$('#gimbalPTMode').show();
            	}
            	
            	$('input[name="throttleScaling"]').prop('checked', data['throttleScaling']);
            	$('.scaling').show();
            	
            	
            	console.log(data['minCommand']);
            	
            	if (data['MinCommand16'] == 1000) {
            		$("input[name='throttleScaling']").prop("disabled", false);
            	} else {
            		$("input[name='throttleScaling']").prop("disabled", true);
            	}
            	
            } else {
            	$('.scaling').hide();
            }
            
            
       $(".unsafe_active").prop('disabled', true);

        // END Custom ESC Orientation
        
        console.log("===");
        console.log(data);
        
        if (data['ver'] > MAX_CONFIG_VERSION) {
            $("#navigation").hide();
            $("#gui_version_mismatch").html("The version of your KISS Ultra Firmware is <b>NEWER</b> than GUI can handle.<br><br>Please visit download page and upgrade your GUI.<br><br><br>");
            $("#gui_version_mismatch").kissWarning({
            	href:"https://github.com/KissUltra/gui/releases",
            	button: 'Open download page',
            	target: '_blank',
            	action: function() {
            		$("a.connect").click(); // disconnect
            	}
            });
            $("#gui_version_mismatch").show();
        } else if (data['ver'] < MIN_CONFIG_VERSION) {
            $("#navigation").hide();
            $("#gui_version_mismatch").html("The version of your KISS Ultra Firmware is <b>OLDER</b> than GUI can handle.<br><br>Please visit download page and downgrade your GUI.<br><br><br>");
            $("#gui_version_mismatch").kissWarning({
            	href:"https://github.com/KissUltra/gui/releases",
            	button: 'Open download page',
            	target: '_blank',
            	action: function() {
            		$("a.connect").click(); // disconnect
            	}
            });
            $("#gui_version_mismatch").show();
        } else if (!data['isActive']) {
            $("#navigation").hide();

            $("#activation").kissWarning({
                title: $.i18n("title.warning"),
                button: $.i18n("button.activate"),
                action: function () {
                    // Activation procedure
                    $(".button", "#activation").hide();
                    $.ajax({
                        url: getProxyURL('http://ultraesc.de/KISSFC/getActivation/index.php?SN=' + MCUid + '&VER=' + data['ver']),
                        cache: false,
                        dataType: "text",
                        success: function (key) {
                            console.log('Got activation code ' + key);
                            data['actKey'] = parseInt(key);
                            kissProtocol.send(kissProtocol.SET_SETTINGS, kissProtocol.preparePacket(kissProtocol.SET_SETTINGS, kissProtocol.data[kissProtocol.GET_SETTINGS]));
                            kissProtocol.send(kissProtocol.GET_SETTINGS, [kissProtocol.GET_SETTINGS], function () {
                            	GUI.load("./content/configuration.html", function () {
                                    htmlLoaded(kissProtocol.data[kissProtocol.GET_SETTINGS]);
                                    updateInfo();
                                });
                            });
                        },
                        error: function () {
                            $(".button", "#activation").show();
                            console.log('getting activation code failed');
                            data['actKey'] = 0;
                            $(".button", "#activation").text($.i18n("button.activation-failed"));
                        }
                    });
                }
            });
            $("#activation").show();
            $('#SN2').on('click', function (e) {
                copyTextToClipboard(MCUid);
                $('#SN2text').text($.i18n("text.serial-clipboard"));
                setTimeout(function () {
                    $('#SN2text').text("");
                }, 1000);
            });

        }  else if (isLegacyDefaults(data) && !CONTENT.configuration.legacyChecked) {
        	
        	$("#navigation").show();
        	
        	CONTENT.configuration.legacyChecked = true;
        	   
        	$(".modal-overlay").off('click');
			$(".modal-overlay").on('click', function() {
				hideModal();
			});
			$(".modal-body").html("<p class='header'>Information</p>You are using legacy <b>KISS</b> default PIDs. Would you like to switch to <b>ULTRA</b> default PIDs?");
			$(".modal-footer").html("<a class='u-button' id='switch_to_ultra'>Yes</a>&nbsp;&nbsp;<a class='u-button' id='switch_to_kiss'>No</a>");
			$(".modal-overlay").show();
			
			
			$("#switch_to_ultra").click(function() {
				// Switching to golden starting point
				
				var tmp = CONTENT.configuration.PRESETS['default_ultra'];
						
		        $('tr.roll input').eq(0).val(tmp.roll.p);
		        $('tr.roll input').eq(1).val(tmp.roll.i);
		        $('tr.roll input').eq(2).val(tmp.roll.d);
		        
		        $('tr.pitch input').eq(0).val(tmp.pitch.p);
		        $('tr.pitch input').eq(1).val(tmp.pitch.i);
		        $('tr.pitch input').eq(2).val(tmp.pitch.d);
		        
		        $('tr.yaw input').eq(0).val(tmp.yaw.p);
		        $('tr.yaw input').eq(1).val(tmp.yaw.i);
		        $('tr.yaw input').eq(2).val(tmp.yaw.d);
				
				contentChange();
				
				grabData();
				
			    kissProtocol.send(kissProtocol.SET_SETTINGS, kissProtocol.preparePacket(kissProtocol.SET_SETTINGS, kissProtocol.data[kissProtocol.GET_SETTINGS]));
                kissProtocol.send(kissProtocol.GET_SETTINGS, [kissProtocol.GET_SETTINGS], function () {
                	GUI.load("./content/configuration.html", function () {
                         htmlLoaded(kissProtocol.data[kissProtocol.GET_SETTINGS]);
                         updateInfo();
                     });
                 });

				hideModal();
			});
			
			$("#switch_to_kiss").click(function() {
				hideModal();
			});
			
			$(".modal").show();                 
			
        } else {
            $("#navigation").show();
        }

        function grabData() {
        	data['kissultra'] = true;
        	
            // uav type and receiver
            data['CopterType'] = parseInt($('select.mixer').val());
            data['RXType'] = parseInt($('#rxType').val());

            // general settings
            data['MinThrottle16'] = parseInt($('input[name="minThrottle"]').val());
            data['MaxThrottle16'] = parseInt($('input[name="maxThrottle"]').val());
            data['MinCommand16'] = parseInt($('input[name="minCommand"]').val());
            data['MidCommand16'] = parseInt($('input[name="midCommand"]').val());
            data['TYmid16'] = parseInt($('input[name="TYmid"]').val());
            data['TYinv8'] = parseInt($('input[name="TYinv"]').prop('checked') ? 1 : 0);

            var outputMode = 0;

            outputMode = parseInt($('select[name="outputMode"]').val());
            data['ESConeshot125'] = outputMode;
            data['ESConeshot42'] = 0;

            data['Active3DMode'] = parseInt($('input[name="3dMode"]').prop('checked') ? 1 : 0);
            if (data['CopterType'] == 7 || data['CopterType'] == 8) data['Active3DMode'] = 0;
            data['failsaveseconds'] = parseInt($('input[name="failsaveseconds"]').val());
            data['BoardRotation'] = 0;

            // pid and rates
            // roll
            data['G_P'][0] = parseFloat($('tr.roll input').eq(0).val());
            data['G_I'][0] = parseFloat($('tr.roll input').eq(1).val());
            data['G_D'][0] = parseFloat($('tr.roll input').eq(2).val());
            data['RC_Rate'][0] = parseFloat($('tr.roll input').eq(3).val());
            data['RPY_Expo'][0] = parseFloat($('tr.roll input').eq(4).val());
            data['RPY_Curve'][0] = parseFloat($('tr.roll input').eq(5).val());

            // pitch
            data['G_P'][1] = parseFloat($('tr.pitch input').eq(0).val());
            data['G_I'][1] = parseFloat($('tr.pitch input').eq(1).val());
            data['G_D'][1] = parseFloat($('tr.pitch input').eq(2).val());
            data['RC_Rate'][1] = parseFloat($('tr.pitch input').eq(3).val());
            data['RPY_Expo'][1] = parseFloat($('tr.pitch input').eq(4).val());
            data['RPY_Curve'][1] = parseFloat($('tr.pitch input').eq(5).val());

            // yaw
            data['G_P'][2] = parseFloat($('tr.yaw input').eq(0).val());
            data['G_I'][2] = parseFloat($('tr.yaw input').eq(1).val());
            data['G_D'][2] = parseFloat($('tr.yaw input').eq(2).val());
            data['RC_Rate'][2] = parseFloat($('tr.yaw input').eq(3).val());
            data['RPY_Expo'][2] = parseFloat($('tr.yaw input').eq(4).val());
            data['RPY_Curve'][2] = parseFloat($('tr.yaw input').eq(5).val());

            // TPA
            data['TPA'][0] = parseFloat($('tr.TPA input').eq(0).val());
            data['TPA'][1] = parseFloat($('tr.TPA input').eq(1).val());
            data['TPA'][2] = parseFloat($('tr.TPA input').eq(2).val());

            // level
            data['A_P'] = parseFloat($('tr.level input').eq(0).val());
            data['A_I'] = parseFloat($('tr.level input').eq(1).val());
            data['A_D'] = parseFloat($('tr.level input').eq(2).val());
            data['maxAng'] = parseFloat($('tr.level input').eq(3).val());

            if (data['ver'] < 109) {
                data['LPF'] = parseInt($('select[name="lpf"]').val());
            } else {
                if (parseInt($('select[name="lpf"]').val()) != 7) {
                    data['LPF'] = parseInt($('select[name="lpf"]').val());
                    data['yawLpF'] = parseInt($('select[name="lpf"]').val());
                    data['DLpF'] = parseInt($('select[name="lpf"]').val());
                }
            }

            data['AUX'][0] = $("#aux0").kissAux('value');
            data['AUX'][1] = $("#aux1").kissAux('value');
            data['AUX'][2] = $("#aux2").kissAux('value');
            data['AUX'][3] = $("#aux3").kissAux('value');
            data['AUX'][4] = data['Active3DMode'] ? $("#aux4").kissAux('value') : 0;
            data['AUX'][5] = $("#aux5").kissAux('value');
            data['AUX'][6] = $("#aux6").kissAux('value');
            data['AUX'][7] = $("#aux7").kissAux('value');

            if (data['ver'] > 108) {
                data['AUX'][8] = $("#aux8").kissAux('value');
            }

            if (data['ver'] > 109) {
                data['AUX'][9] = $("#aux9").kissAux('value');
                data['AUX'][10] = $("#aux10").kissAux('value');
            }

          
            if (data['ver'] >= 113) {
                data['ESCOutputLayout'] = parseInt($('select[name="ESCOutputLayout"]').val());
                console.log('Store ESCOutputLayout:' + data['ESCOutputLayout']);
            }

            if (data['ver'] >= 121) {
                data['AUX'][13] = $("#aux13").kissAux('value');
            }
            
            if (data['ver'] >= 129) {
                data['throttleScaling'] = +$("input[name='throttleScaling']").prop('checked') ? 1 : 0;
            }
        
            if (data['ver'] >= 132) {
                data['AUX'][14] = $("#aux14").kissAux('value');
            }
            
            if (data['ver'] >= 134) {
                data['prearm_mode'] = +$("#prearm_mode").val();
            }
            
            if (data['ver'] >= 135) {
                data['softarm_mode'] = +$("#softarm_mode").prop('checked') ? 1 : 0;
            }
            
            if (data['ver'] >= 136) {
        	  data['AUX'][11] = $("#aux11").kissAux('value');
        	  data['AUX'][12] = $("#aux12").kissAux('value');
            }
        }
        settingsFilled = 1;

        function UpdateMixerImage(Type, ESCOrientation, Reverse) {
            if (typeof ESCOrientation == 'undefined') ESCOrientation = 0;
            console.log("Updating mixer image: Type=" + Type + " ESCOrientation=" + ESCOrientation + " Reverse=" + Reverse);

            $('.mixerPreview img').attr('src', './images/mixer/' + Type + (ESCOrientation > 0 && (Type == 1 || Type == 2) ? '_' + ESCOrientation : '') + (Reverse == 0 ? '' : '_inv') + ".png");
        }

        function contentChange() {
            $('#save').removeAttr("data-i18n");
            $('#save').attr('data-i18n', 'button.save');
            $('#save').text($.i18n("button.save"));
            if (settingsFilled) {
                $('#save').addClass("saveAct");
            }
        }

        function handleFileSelect(evt) {
        	var files = evt.target.files; 
        	for (var i = 0, f; f = files[i]; i++) {
        		var reader = new FileReader();
        		reader.onload = (function(theFile) {
        			return function(e) {
        				var json = JSON.parse(e.target.result);
        				console.log(json);
        				if (json.kissultra) {
        					GUI.load("./content/configuration.html", function () {
        						var v = +kissProtocol.data[kissProtocol.GET_SETTINGS]['ver'];
        						var tmp = $.extend({}, kissProtocol.data[kissProtocol.GET_SETTINGS], json);
        						tmp.ver = v; // fix version to one we get from FCs
        						kissProtocol.data[kissProtocol.GET_SETTINGS] = tmp;
        						htmlLoaded(kissProtocol.data[kissProtocol.GET_SETTINGS]);
        						updateInfo();
        						contentChange();
        					});
        				} else {
        					console.log("Old kiss backup detected!");
        					$(".modal-overlay").off('click');
        					$(".modal-overlay").on('click', function() {
        						hideModal();
        					});
        					$(".modal-body").html("<p class='header'>This backup is invalid.</p>For safety reasons, import of invalid backups is prohibited.");
        					$(".modal-footer").html("");
        					$(".modal-overlay").show();
        					$(".modal").show();                            	
        					return;
        				}
        			};
        		})(f);
        		reader.readAsText(f);
        	}
        }

       
        $.ajax({
            url: 'https://kiss-ultra.com/gui/presets.json',
            cache: true,
            dataType: 'json',
            success: function (pdata) {
                console.log('presetPIDs request success');
                console.log(pdata);
                self.PRESETS = pdata;
           	 	var presets = $('#presets');
           	 	presets.append('<option value="">User settings</option>');
                $.each(pdata, function(key, value) {
                	
                	var selected = '';
                	
                	if ((+data['G_P'][0] == value.roll.p) &&
                    		(+data['G_P'][1] == value.pitch.p) &&
                    		(+data['G_P'][2] == value.yaw.p) &&
                    		(+data['G_I'][0] == value.roll.i) &&
                    		(+data['G_I'][1] == value.pitch.i) &&
                    		(+data['G_I'][2] == value.yaw.i) &&
                    		(+data['G_D'][0] == value.roll.d) &&
                    		(+data['G_D'][1] == value.pitch.d) &&
                    		(+data['G_D'][2] == value.yaw.d) ) {
                		selected = 'selected';
                	}
                	
                	 presets.append('<option value="' + key + '" ' + selected + '>' + value.name + '</option>');
                });
                $('.presets').show();
            },
            error: function () {
                console.log('presetPIDs request failed');
                $('.presets').hide();
            }

        });

        if (!data['isActive']) {
            $.ajax({
                url: getProxyURL('http://ultraesc.de/KISSFC/getActivation/index.php?SN=' + MCUid + '&VER=' + data['ver']),
                cache: false,
                dataType: "text",
                success: function (key) {
                    console.log('Got activation code ' + key);
                    data['actKey'] = parseInt(key);
                },
                error: function () {
                    console.log('getting activation code failed');
                    data['actKey'] = 0;
                }

            });
        }
        
        $('#prePID').change(function () {
            if (document.getElementById('prePID').value == 'preset') {
                document.getElementById('userSel').style.display = 'none';
                document.getElementById('presetSel').style.display = 'inline-block';
                if (document.getElementById('presetSel').value == 'Preset1') {
                    shareButton.innerHTML = 'share';
                }
            } else {
                document.getElementById('presetSel').style.display = 'none';
                document.getElementById('userSel').style.display = 'inline-block';
                shareButton.innerHTML = 'Use';
            }
        });
        $('#presetSel').change(function () {
            if (document.getElementById('presetSel').value == 'Preset1') {
                shareButton.innerHTML = 'share';
            } else {
                shareButton.innerHTML = 'use';
            }
        });
        $('#userSel').change(function () {
            shareButton.innerHTML = 'use';
        });

        $('#shareButton').click(function () {
            if (document.getElementById('shareButton').innerHTML == 'use') {
                var useVals = [];
                if (document.getElementById('prePID').value == 'preset') {
                    useVals = self.PRESET_PIDs[parseInt(document.getElementById('presetSel').value)];
                } else {
                    useVals = self.USER_PIDs[parseInt(document.getElementById('userSel').value)];
                }

                // roll
                $('tr.roll input').eq(0).val(useVals.PR);
                $('tr.roll input').eq(1).val(useVals.IR);
                $('tr.roll input').eq(2).val(useVals.DR);

                // pitch
                $('tr.pitch input').eq(0).val(useVals.PP);
                $('tr.pitch input').eq(1).val(useVals.IP);
                $('tr.pitch input').eq(2).val(useVals.DP);

                // yaw
                $('tr.yaw input').eq(0).val(useVals.PY);
                $('tr.yaw input').eq(1).val(useVals.IY);
                $('tr.yaw input').eq(2).val(useVals.DY);

                //TPA
                $('tr.TPA input').eq(0).val(useVals.TP);
                $('tr.TPA input').eq(1).val(useVals.TI);
                $('tr.TPA input').eq(2).val(useVals.TD);

                // level
                $('tr.level input').eq(0).val(useVals.LP);
                $('tr.level input').eq(1).val(useVals.LI);
                $('tr.level input').eq(2).val(useVals.LD);

                $('select[name="lpf"]').val(useVals.LPF);
                contentChange();
            } else {
                var GET_PIDdatas = '[name,';

                GET_PIDdatas += 'PR:' + parseFloat($('tr.roll input').eq(0).val()) + ',';
                GET_PIDdatas += 'PP:' + parseFloat($('tr.pitch input').eq(0).val()) + ',';
                GET_PIDdatas += 'PY:' + parseFloat($('tr.yaw input').eq(0).val()) + ',';

                GET_PIDdatas += 'IR:' + parseFloat($('tr.roll input').eq(1).val()) + ',';
                GET_PIDdatas += 'IP:' + parseFloat($('tr.pitch input').eq(1).val()) + ',';
                GET_PIDdatas += 'IY:' + parseFloat($('tr.yaw input').eq(1).val()) + ',';

                GET_PIDdatas += 'DR:' + parseFloat($('tr.roll input').eq(2).val()) + ',';
                GET_PIDdatas += 'DP:' + parseFloat($('tr.pitch input').eq(2).val()) + ',';
                GET_PIDdatas += 'DY:' + parseFloat($('tr.yaw input').eq(2).val()) + ',';

                GET_PIDdatas += 'LP:' + parseFloat($('tr.level input').eq(0).val()) + ',';
                GET_PIDdatas += 'LI:' + parseFloat($('tr.level input').eq(1).val()) + ',';
                GET_PIDdatas += 'LD:' + parseFloat($('tr.level input').eq(2).val()) + ',';

                GET_PIDdatas += 'TP:' + parseFloat($('tr.TPA input').eq(0).val()) + ',';
                GET_PIDdatas += 'TI:' + parseFloat($('tr.TPA input').eq(1).val()) + ',';
                GET_PIDdatas += 'TD:' + parseFloat($('tr.TPA input').eq(2).val()) + ',';

                GET_PIDdatas += 'LPF:' + parseInt($('select[name="lpf"]').val()) + ',';

                GET_PIDdatas += ']';
                window.open('http://ultraesc.de/PREPID/index.php?setPIDs=' + GET_PIDdatas, '_blank');

            }
        });

        $('#save').on('click', function () {
            grabData();
            $('#save').removeClass("saveAct");
            $('#save').html($.i18n("button.saving"));
            kissProtocol.send(kissProtocol.SET_SETTINGS, kissProtocol.preparePacket(kissProtocol.SET_SETTINGS, kissProtocol.data[kissProtocol.GET_SETTINGS]));
            kissProtocol.send(kissProtocol.GET_SETTINGS, [kissProtocol.GET_SETTINGS], function () {
                GUI.load("./content/configuration.html", function () {
                    htmlLoaded(kissProtocol.data[kissProtocol.GET_SETTINGS]);
                    updateInfo();
                    $('#save').removeAttr("data-i18n");
                    $('#save').attr('data-i18n', 'button.saved');

                });
            });
        });

        $('#backup').on('click', function () {
            grabData();
            backupConfig();
        });

        $('#restore').on('click', function () {
        	if (isNative()) {
        		restoreConfig(function (config) {
        			GUI.load("./content/configuration.html", function () {
        				var v = +kissProtocol.data[kissProtocol.GET_SETTINGS]['ver'];
        				var tmp = $.extend({}, kissProtocol.data[kissProtocol.GET_SETTINGS], config);
        				tmp.ver = v; // fix version to one we get from FCs
        				kissProtocol.data[kissProtocol.GET_SETTINGS] = tmp;
        				htmlLoaded(kissProtocol.data[kissProtocol.GET_SETTINGS]);
        				updateInfo();
        				contentChange();
        			});
        		});
        	} else {
        		document.getElementById('files').files = new DataTransfer().files;
        		$("#files").click();
        	}
        });
        
        if (!isNative()) {
            document.getElementById('files').addEventListener('change', handleFileSelect, false);
        }
        
        scrollTop();
    }
};

CONTENT.configuration.cleanup = function (callback) {
	if (self.hwTimeout != 0) window.clearTimeout(self.hwTimeout);
    if (callback) callback();
};