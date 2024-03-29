'use strict';

CONTENT.rates = {

};

CONTENT.rates.initialize = function (callback) {
    var self = this;

    self.startedUIupdate = 0;
    self.updateTimeout;
    self.settingsFilled = 0;
    self.hasInput = false;
    self.lastTimestamp = null;

    GUI.switchContent('rates', function () {
        kissProtocol.send(kissProtocol.GET_SETTINGS, [kissProtocol.GET_SETTINGS], function () {
            self.settingsFilled = 1;
            GUI.load("./content/rates.html", function () {
                htmlLoaded(kissProtocol.data[kissProtocol.GET_SETTINGS])
            });
        });
    });

    function animateModel(timestamp) {
        if (GUI.activeContent == 'rates') {
            requestAnimationFrame(animateModel);

            if (!self.lastTimestamp) {
                self.lastTimestamp = timestamp;
            }
            var frameTime = timestamp - self.lastTimestamp;
            self.lastTimestamp = timestamp;

            if (frameTime > 0) {
                var freq = 1000 / frameTime;
                var rowNames = ['roll', 'pitch', 'yaw']
                var axisRate = { 'roll': 0, 'pitch': 0, 'yaw': 0 };
                if (self.hasInput) {
                    for (var i = 0; i < 3; i++) {
                        axisRate[rowNames[i]] = -Math.PI * 2 * $("#rates_chart_" + rowNames[i]).kissRatesChart('axisRate') / freq;
                    }
                }
                $("#model").kissModel('updateRate', axisRate);
                $("#model").kissModel('refresh');
            }
        }
    }

    function contentChange() {
        if (self.settingsFilled) {
            $('#save').addClass("important saveAct");
        }
        var rowNames = ['roll', 'pitch', 'yaw']
        for (var i = 0; i < 3; i++) {
            var rate = parseFloat($('tr.' + rowNames[i] + ' input').eq(0).val());
            var grate = parseFloat($('tr.' + rowNames[i] + ' input').eq(1).val());
            var usecurve = parseFloat($('tr.' + rowNames[i] + ' input').eq(2).val());
            if (!isNaN(rate) && !isNaN(grate) && !isNaN(usecurve)) {
                $('#rates_chart_' + rowNames[i]).kissRatesChart('updateRcRates', {
                    'rate': rate,
                    'grate': grate,
                    'usecurve': usecurve
                });
            }
        }
    }

    function htmlLoaded(data) {
        // generate receiver bars
        var receiverNames = [$.i18n('column.roll'), $.i18n('column.pitch'), $.i18n('column.yaw')]
        var chartDivSelectors = ['#rates_chart_roll', '#rates_chart_pitch', '#rates_chart_yaw']
        var receiverChannels = [1, 2, 3];
        var receiverContainer = $('#rbars');
        var receiverFillArray = [];
        var receiverLabelArray = [];
        self.ESCTelemetry = 0;
        self.startedUIupdate = 0;
        window.clearTimeout(self.updateTimeout);

        validateBounds('.rc_rates input[type="number"]');

        for (var i = 0; i < receiverNames.length; i++) {
        	receiverContainer.append($.Mustache.render("receiver-bar-template", {'name':receiverNames[i]}));
        }
        $('.meter .fill', receiverContainer).each(function () {
            receiverFillArray.push($(this));
        });

        $('.meter', receiverContainer).each(function () {
            receiverLabelArray.push($('.label', this));
        });

        self.barResize = function () {
        	$(".meter-bar .label, .meter-bar .fill .label").each(function(index) {
        		$(this).css("margin-left",  ($(this).closest(".meter-bar").width() / 2) - ($(this).width() / 2));
        	});
        };
        
        $(window).on('resize', self.barResize).resize(); // trigger so labels
        // get correctly
        // aligned on
        // creation

        var meterScale = {
            'min': 1000,
            'max': 2000
        };

        function grabData() {
            data['RC_Rate'][0] = parseFloat($('tr.roll input').eq(0).val());
            data['RPY_Expo'][0] = parseFloat($('tr.roll input').eq(1).val());
            data['RPY_Curve'][0] = parseFloat($('tr.roll input').eq(2).val());

            data['RC_Rate'][1] = parseFloat($('tr.pitch input').eq(0).val());
            data['RPY_Expo'][1] = parseFloat($('tr.pitch input').eq(1).val());
            data['RPY_Curve'][1] = parseFloat($('tr.pitch input').eq(2).val());

            data['RC_Rate'][2] = parseFloat($('tr.yaw input').eq(0).val());
            data['RPY_Expo'][2] = parseFloat($('tr.yaw input').eq(1).val());
            data['RPY_Curve'][2] = parseFloat($('tr.yaw input').eq(2).val());
        }

        function updateUI() {
            var telem = kissProtocol.data[kissProtocol.GET_TELEMETRY];


            if (!telem) {
                if (GUI.activeContent == 'rates') self.updateTimeout = window.setTimeout(function () {
                    updateUI();
                }, 5);
                return;
            }
            // update bars with latest data
            var receiverLabelArrayLength = receiverLabelArray.length;
            var hi = false;
            for (var i = 0; i < receiverLabelArrayLength; i++) {
                var channel = receiverChannels[i];
                if (telem['RXcommands'][channel] != 1000) {
                    hi = true;
                }
                receiverFillArray[i].css('width', ((telem['RXcommands'][channel] - meterScale.min) / (meterScale.max - meterScale.min) * 100).clamp(0, 100) + '%');
                receiverLabelArray[i].text(telem['RXcommands'][channel]);
                // redraw charts if needed
                $(chartDivSelectors[i]).kissRatesChart('updateRcInput', (telem['RXcommands'][channel] - 1500) / 500);
            }
            self.barResize();
            self.hasInput = true;

            var sampleBlock = [];

            var midscale = 1.5;

            if (GUI.activeContent == 'rates') self.updateTimeout = window.setTimeout(function () {
                fastDataPoll();
            }, 50);
        }

        // setup graph
        $(window).on('resize', self.resizeCanvas).resize();

        function fastDataPoll() {
            kissProtocol.send(kissProtocol.GET_TELEMETRY, [kissProtocol.GET_TELEMETRY], function () {
                if (GUI.activeContent == 'rates') {
                    if (self.startedUIupdate == 0) {
                        updateUI();
                    }
                }
            });
        }

        // rates
        // roll
        $('tr.roll input').eq(0).val(data['RC_Rate'][0]);
        $('tr.roll input').eq(1).val(data['RPY_Expo'][0]);
        $('tr.roll input').eq(2).val(data['RPY_Curve'][0]);
        for (var i = 0; i < 3; i++) {
            $('tr.roll input').eq(i).on('input', function () {
                contentChange();
            });
        }

        // pitch
        $('tr.pitch input').eq(0).val(data['RC_Rate'][1]);
        $('tr.pitch input').eq(1).val(data['RPY_Expo'][1]);
        $('tr.pitch input').eq(2).val(data['RPY_Curve'][1]);
        for (var i = 0; i < 3; i++) {
            $('tr.pitch input').eq(i).on('input', function () {
                contentChange();
            });
        }

        // yaw
        $('tr.yaw input').eq(0).val(data['RC_Rate'][2]);
        $('tr.yaw input').eq(1).val(data['RPY_Expo'][2]);
        $('tr.yaw input').eq(2).val(data['RPY_Curve'][2]);
        for (var i = 0; i < 3; i++) {
            $('tr.yaw input').eq(i).on('input', function () {
                contentChange();
            });
        }

        var messages = [$.i18n('text.rates-rolls'), $.i18n('text.rates-flips'), $.i18n('text.rates-turns')];
        for (i = 0; i < 3; i++) {
            $(chartDivSelectors[i]).kissRatesChart({
                name: receiverNames[i],
                message: messages[i]
            });
            $(chartDivSelectors[i]).kissRatesChart('updateRcRates', {
                rate: data['RC_Rate'][i],
                grate: data['RPY_Expo'][i],
                usecurve: data['RPY_Curve'][i]
            });
        }

        $("#model").kissModel({
            'mixer': data['CopterType']
        })

        animateModel();

        fastDataPoll();

        $('#save').click(function () {
            grabData();
            $('#save').removeClass("saveAct");
            kissProtocol.send(kissProtocol.SET_SETTINGS, kissProtocol.preparePacket(kissProtocol.SET_SETTINGS, kissProtocol.data[kissProtocol.GET_SETTINGS]));
        });
        
        scrollTop();
    }
};


CONTENT.rates.resizeCanvas = function () { }

CONTENT.rates.cleanup = function (callback) {
    $(window).off('resize', this.barResize);
    $(window).off('resize', this.resizeCanvas);
    window.clearTimeout(this.updateTimeout);
    if (callback) callback();
};