(function ($) {
    var PLUGIN_NAME = 'kiss.wizard',
        pluginData = function (obj) {
            return obj.data(PLUGIN_NAME);
        };

    var privateMethods = {
        build: function (self) {
            var data = pluginData(self);
            var step = data.steps[data.currentStep];
            
            self.empty();
            
            var outer = $('<div class="wizard-container"></div>'); 
            
            var header =  $('<div class="wizard-header column column-left column-100"></div>');
            var content = $('<div class="wizard-content column column-left column-100"></div>');
            var buttons = $('<div class="wizard-buttons column column-left column-100"></div>');
      
            buttons.html($.Mustache.render(data.buttonsTemplate,  {}));
            var step = data.steps[data.currentStep];
            header.html($.Mustache.render(data.headerTemplate, data.headerDataProvider));
            
            
            
            outer.append(header);
            outer.append(content);
            outer.append(buttons);
            
            self.append(outer);
            
            $(".wizard-button-prev", self).on("click", function() {
            	
            	if (!$(this).hasClass("wizard-button-disabled")) {
            	
            	if (data.steps[data.currentStep].unload !== undefined) {
        			data.steps[data.currentStep].unload(self, data.steps[data.currentStep]);
        		}
            	if (data.currentStep>0) {
            		data.currentStep--;
            		
            		if (data.steps[data.currentStep].preload !== undefined) {
            			data.steps[data.currentStep].preload(self, data.steps[data.currentStep]);
            		}
            		
            		privateMethods.updateButtons(self);
            		privateMethods.reloadContent(self);
            		
            		if (data.steps[data.currentStep].postload !== undefined) {
            			data.steps[data.currentStep].postload(self, data.steps[data.currentStep]);
            		}
            	}
            	
            	}
            });
            
            $(".wizard-button-next", self).on("click", function() {

            	if (!$(this).hasClass("wizard-button-disabled")) {
            	if (data.steps[data.currentStep].unload !== undefined) {
        			data.steps[data.currentStep].unload(self, data.steps[data.currentStep]);
        		}
            	if (data.currentStep<(data.steps.length-1)) {
            		data.currentStep++;
            	
            		if (data.steps[data.currentStep].preload !== undefined) {
            			data.steps[data.currentStep].preload(self, data.steps[data.currentStep]);
            		}
            		
            		privateMethods.updateButtons(self);
            		privateMethods.reloadContent(self);
            		
            		if (data.steps[data.currentStep].postload !== undefined) {
            			data.steps[data.currentStep].postload(self, data.steps[data.currentStep]);
            		}
            	}
            	}
            });
         
        	if (data.steps[data.currentStep].preload !== undefined) {
    			data.steps[data.currentStep].preload(self, data.steps[data.currentStep]);
    		}
            privateMethods.reloadContent(self);
       		if (data.steps[data.currentStep].postload !== undefined) {
       			data.steps[data.currentStep].postload(self, data.steps[data.currentStep]);
       		}
        },

        updateButtons: function(self) {
            var data = pluginData(self);
            
            if (data.currentStep == 0) {
            	$('.wizard-button-prev', self).hide();
            } else {
            	$('.wizard-button-prev', self).show();
            }
            
            if (data.currentStep == (data.steps.length-1)) {
            	$('.wizard-button-next', self).hide();
            } else {
            	$('.wizard-button-next', self).show();
            }
        },
        reloadContent: function(self) {
        	var data = pluginData(self);
            var step = data.steps[data.currentStep];
            $(".wizard-content", self).html($.Mustache.render(step.template, step.dataProvider));
            privateMethods.updateButtons(self);
        }
    };

    var publicMethods = {
        init: function (options) {
            return this.each(function () {
                var self = $(this),
                    data = pluginData(self);
                if (!data) {
                    self.data(PLUGIN_NAME, $.extend(true, {
                    	currentStep: 0,
                        name: '',
                        buttonsTemplate : "wizard-buttons",
                        steps: []
                    }, options));
                    data = pluginData(self);
                }
                privateMethods.build(self);

            });
        },
        destroy: function () {
            return this.each(function () {
                $(this).removeData(PLUGIN_NAME);
            });
        },
        steps: function () {
            var self = $(this),
                data = pluginData(self);
            return data.steps;
        },
//        setValue: function (newValue) {
//            var self = $(this);
//            var data = pluginData(self);
//            data.value = newValue;
//           // privateMethods.changeValue(self);
//        },
    };

    $.fn.kissWizard = function (method) {
        if (publicMethods[method]) {
            return publicMethods[method].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof method === 'object' || !method) {
            return publicMethods.init.apply(this, arguments);
        } else {
            $.error('Method [' + method + '] not available in $.kissWizard');
        }
    };
})(jQuery);