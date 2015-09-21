/*
 * Fuel UX Spinbox
 * https://github.com/ExactTarget/fuelux
 *
 * Copyright (c) 2014 ExactTarget
 * Licensed under the BSD New license.
 */

// -- BEGIN UMD WRAPPER PREFACE --

// For more information on UMD visit:
// https://github.com/umdjs/umd/blob/master/jqueryPlugin.js

(function (factory) {
	if (typeof define === 'function' && define.amd) {
		// if AMD loader is available, register as an anonymous module.
		define(['jquery'], factory);
	} else if (typeof exports === 'object') {
		// Node/CommonJS
		module.exports = factory(require('jquery'));
	} else {
		// OR use browser globals if AMD is not present
		factory(jQuery);
	}
}(function ($) {
	// -- END UMD WRAPPER PREFACE --

	// -- BEGIN MODULE CODE HERE --

	var old = $.fn.spinbox;

	// SPINBOX CONSTRUCTOR AND PROTOTYPE

	var Spinbox = function Spinbox(element, options) {
		this.$element = $(element);
		this.$element.find('.btn').on('click', function (e) {
			//keep spinbox from submitting if they forgot to say type="button" on their spinner buttons
			e.preventDefault();
		});
		this.options = $.extend({}, $.fn.spinbox.defaults, options);
		this.options.step = this.$element.data('step') || this.options.step;

		this.$input = this.$element.find('.spinbox-input');
		this.$element.on('focusin.fu.spinbox', this.$input, $.proxy(this.changeFlag, this));
		this.$element.on('focusout.fu.spinbox', this.$input, $.proxy(this.change, this));
		this.$element.on('keydown.fu.spinbox', this.$input, $.proxy(this.keydown, this));
		this.$element.on('keyup.fu.spinbox', this.$input, $.proxy(this.keyup, this));

		this.bindMousewheelListeners();
		this.mousewheelTimeout = {};

		if (this.options.hold) {
			this.$element.on('mousedown.fu.spinbox', '.spinbox-up', $.proxy(function () {
				this.startSpin(true);
			}, this));
			this.$element.on('mouseup.fu.spinbox', '.spinbox-up, .spinbox-down', $.proxy(this.stopSpin, this));
			this.$element.on('mouseout.fu.spinbox', '.spinbox-up, .spinbox-down', $.proxy(this.stopSpin, this));
			this.$element.on('mousedown.fu.spinbox', '.spinbox-down', $.proxy(function () {
				this.startSpin(false);
			}, this));
		} else {
			this.$element.on('click.fu.spinbox', '.spinbox-up', $.proxy(function () {
				this.step(true);
			}, this));
			this.$element.on('click.fu.spinbox', '.spinbox-down', $.proxy(function () {
				this.step(false);
			}, this));
		}

		this.switches = {
			count: 1,
			enabled: true
		};

		if (this.options.speed === 'medium') {
			this.switches.speed = 300;
		} else if (this.options.speed === 'fast') {
			this.switches.speed = 100;
		} else {
			this.switches.speed = 500;
		}

		this.lastValue = this.options.value;

		this.render();

		if (this.options.disabled) {
			this.disable();
		}
	};

	var _limitToStep = function _limitToStep(number, step, roundDirection) {
		var limitedNumber = number;

		var remainder = number % step;
		if(remainder > 0){
			if(remainder > step/2 || typeof roundDirection !== 'undefined' && roundDirection > 0){
				limitedNumber = number - remainder + step;
			}else{
				limitedNumber = number - remainder;
			}
		}

		return limitedNumber;
	};

	Spinbox.prototype = {
		constructor: Spinbox,

		destroy: function destroy() {
			this.$element.remove();
			// any external bindings
			// [none]
			// set input value attrbute
			this.$element.find('input').each(function () {
				$(this).attr('value', $(this).val());
			});
			// empty elements to return to original markup
			// [none]
			// returns string of markup
			return this.$element[0].outerHTML;
		},

		render: function render() {
			var inputValue = this.parseInput(this.$input.val());
			var maxUnitLength = '';

			if (inputValue !== '' && this.options.value === 0) {
				this.value(inputValue);
			} else {
				this.output(this.options.value);
			}

			if (this.options.units.length) {
				$.each(this.options.units, function (index, value) {
					if (value.length > maxUnitLength.length) {
						maxUnitLength = value;
					}
				});
			}
		},

		output: function output(value, updateField) {
			value = (value + '').split('.').join(this.options.decimalMark);

			// If defaultUnit is set,
			// if value does not contain defaultUnit already,
			// and if defaultUnit is legal,
			// add defaultUnit to value
			if (this.options.defaultUnit !== '' &&
					this.options.defaultUnit !== value.slice(-Math.abs(this.options.defaultUnit.length)) &&
					this.isUnitLegal(this.options.defaultUnit)) {
				value = value + this.options.defaultUnit;
			}

			updateField = (updateField || true);
			if (updateField) {
				this.$input.val(value);
			}

			return value;
		},

		parseInput: function parseInput(value) {
			value = (value + '').split(this.options.decimalMark).join('.');

			return value;
		},

		change: function change() {
			var newVal = this.parseInput(this.$input.val()) || '';

			if (this.options.units.length || this.options.decimalMark !== '.') {
				newVal = this.parseValueWithUnit(newVal);
			} else if (newVal / 1) {
				newVal = this.checkMaxMin(newVal / 1);
				if(this.options.limitToStep){
					newVal = _limitToStep(newVal, this.options.step);
				}
				this.options.value = newVal;
			} else {
				newVal = this.checkMaxMin(newVal.replace(/[^0-9.-]/g, '') || '');
				newVal = newVal / 1;
				if(this.options.limitToStep){
					newVal = _limitToStep(newVal, this.options.step);
				}
				this.options.value = newVal;
			}

			this.output(newVal);

			this.changeFlag = false;
			this.triggerChangedEvent();
		},

		changeFlag: function changeFlag() {
			this.changeFlag = true;
		},

		stopSpin: function stopSpin() {
			if (this.switches.timeout !== undefined) {
				clearTimeout(this.switches.timeout);
				this.switches.count = 1;
				this.triggerChangedEvent();
			}
		},

		triggerChangedEvent: function triggerChangedEvent() {
			var currentValue = this.value();
			if (currentValue === this.lastValue) return;
			this.lastValue = currentValue;

			// Primary changed event
			this.$element.trigger('changed.fu.spinbox', this.output(currentValue, false));// no DOM update
		},

		startSpin: function startSpin(type) {
			if (!this.options.disabled) {
				var divisor = this.switches.count;

				if (divisor === 1) {
					this.step(type);
					divisor = 1;
				} else if (divisor < 3) {
					divisor = 1.5;
				} else if (divisor < 8) {
					divisor = 2.5;
				} else {
					divisor = 4;
				}

				this.switches.timeout = setTimeout($.proxy(function () {
					this.iterate(type);
				}, this), this.switches.speed / divisor);
				this.switches.count++;
			}
		},

		iterate: function iterate(type) {
			this.step(type);
			this.startSpin(type);
		},

		step: function step(isIncrease) {
			// isIncrease: true is up, false is down

			var digits, multiple, currentValue, limitValue;

			// trigger change event
			if (this.changeFlag) {
				this.change();
			}

			// get current value and min/max options
			currentValue = this.options.value;
			limitValue = isIncrease ? this.options.max : this.options.min;

			if ( (isIncrease ? currentValue < limitValue : currentValue > limitValue) ) {
				var newVal = currentValue + (isIncrease ? 1 : -1) * this.options.step;

				// raise to power of 10 x number of decimal places, then round
				if (this.options.step % 1 !== 0) {
					digits = (this.options.step + '').split('.')[1].length;
					multiple = Math.pow(10, digits);
					newVal = Math.round(newVal * multiple) / multiple;
				}

				// if outside limits, set to limit value
				if (isIncrease ? newVal > limitValue : newVal < limitValue) {
					this.value(limitValue);
				} else {
					this.value(newVal);
				}

			} else if (this.options.cycle) {
				var cycleVal = isIncrease ? this.options.min : this.options.max;
				this.value(cycleVal);
			}
		},

		getValue: function getValue() {
			return this.value();
		},

		setValue: function setValue(val) {
			return this.value(val);
		},

		value: function value(val) {
			if (val || val === 0) {
				if (this.options.units.length || this.options.decimalMark !== '.') {
					this.output(this.parseValueWithUnit(val + (this.unit || '')));
					return this;

				} else if (!isNaN(parseFloat(val)) && isFinite(val)) {
					this.options.value = val / 1;
					this.output(val + (this.unit ? this.unit : ''));
					return this;

				}

			} else {
				if (this.changeFlag) {
					this.change();
				}

				if (this.unit) {
					return this.options.value + this.unit;
				} else {
					return this.output(this.options.value, false);// no DOM update
				}

			}
		},

		isUnitLegal: function isUnitLegal(unit) {
			var legalUnit;

			$.each(this.options.units, function (index, value) {
				if (value.toLowerCase() === unit.toLowerCase()) {
					legalUnit = unit.toLowerCase();
					return false;
				}
			});

			return legalUnit;
		},

		getIntValue: function getIntValue(value) {
			value = (typeof value === "undefined") ? this.getValue() : value;
			var number = value.replace(/[^0-9.-]/g, '');
			return number;
		},

		// strips units and add them back
		parseValueWithUnit: function parseValueWithUnit(value) {
			var unit = value.replace(/[^a-zA-Z]/g, '');
			var number = this.getIntValue(value);

			if (unit) {
				unit = this.isUnitLegal(unit);
			}

			number = this.checkMaxMin(number / 1);
			if(this.options.limitToStep){
				number = _limitToStep(number, this.options.step);
			}

			this.options.value = number;
			this.unit = unit || undefined;
			return this.options.value + (unit || '');
		},

		checkMaxMin: function checkMaxMin(value) {
			// if unreadable
			if (isNaN(parseFloat(value))) {
				return value;
			}

			// if not within range return the limit
			if (!(value <= this.options.max && value >= this.options.min)) {
				if(value >= this.options.max){
					value = this.options.max;
				}else{
					value = this.options.min;
				}
			}

			if(this.options.limitToStep && value % this.options.step > 0){
				//force round direction so that it stays within bounds
				value = _limitToStep(value, this.options.step, (value === this.options.min) ? 1 : -1);
			}

			return value;
		},

		disable: function disable() {
			this.options.disabled = true;
			this.$element.addClass('disabled');
			this.$input.attr('disabled', '');
			this.$element.find('button').addClass('disabled');
		},

		enable: function enable() {
			this.options.disabled = false;
			this.$element.removeClass('disabled');
			this.$input.removeAttr('disabled');
			this.$element.find('button').removeClass('disabled');
		},

		keydown: function keydown(event) {
			var keyCode = event.keyCode;
			if (keyCode === 38) {
				this.step(true);
			} else if (keyCode === 40) {
				this.step(false);
			}
		},

		keyup: function keyup(event) {
			var keyCode = event.keyCode;

			if (keyCode === 38 || keyCode === 40) {
				this.triggerChangedEvent();
			}
		},

		bindMousewheelListeners: function bindMousewheelListeners() {
			var inputEl = this.$input.get(0);
			if (inputEl.addEventListener) {
				//IE 9, Chrome, Safari, Opera
				inputEl.addEventListener('mousewheel', $.proxy(this.mousewheelHandler, this), false);
				// Firefox
				inputEl.addEventListener('DOMMouseScroll', $.proxy(this.mousewheelHandler, this), false);
			} else {
				// IE <9
				inputEl.attachEvent('onmousewheel', $.proxy(this.mousewheelHandler, this));
			}
		},

		mousewheelHandler: function mousewheelHandler(event) {
			if (!this.options.disabled) {
				var e = window.event || event;// old IE support
				var delta = Math.max(-1, Math.min(1, (e.wheelDelta || -e.detail)));
				var self = this;

				clearTimeout(this.mousewheelTimeout);
				this.mousewheelTimeout = setTimeout(function () {
					self.triggerChangedEvent();
				}, 300);

				if (delta < 0) {
					this.step(true);
				} else {
					this.step(false);
				}

				if (e.preventDefault) {
					e.preventDefault();
				} else {
					e.returnValue = false;
				}

				return false;
			}
		}
	};


	// SPINBOX PLUGIN DEFINITION

	$.fn.spinbox = function spinbox(option) {
		var args = Array.prototype.slice.call(arguments, 1);
		var methodReturn;

		var $set = this.each(function () {
			var $this = $(this);
			var data = $this.data('fu.spinbox');
			var options = typeof option === 'object' && option;

			if (!data) {
				$this.data('fu.spinbox', (data = new Spinbox(this, options)));
			}

			if (typeof option === 'string') {
				methodReturn = data[option].apply(data, args);
			}
		});

		return (methodReturn === undefined) ? $set : methodReturn;
	};

	// value needs to be 0 for this.render();
	$.fn.spinbox.defaults = {
		value: 0,
		min: 0,
		max: 999,
		step: 1,
		hold: true,
		speed: 'medium',
		disabled: false,
		cycle: false,
		units: [],
		decimalMark: '.',
		defaultUnit: '',
		limitToStep: false
	};

	$.fn.spinbox.Constructor = Spinbox;

	$.fn.spinbox.noConflict = function noConflict() {
		$.fn.spinbox = old;
		return this;
	};


	// DATA-API

	$(document).on('mousedown.fu.spinbox.data-api', '[data-initialize=spinbox]', function (e) {
		var $control = $(e.target).closest('.spinbox');
		if (!$control.data('fu.spinbox')) {
			$control.spinbox($control.data());
		}
	});

	// Must be domReady for AMD compatibility
	$(function () {
		$('[data-initialize=spinbox]').each(function () {
			var $this = $(this);
			if (!$this.data('fu.spinbox')) {
				$this.spinbox($this.data());
			}
		});
	});

	// -- BEGIN UMD WRAPPER AFTERWORD --
}));
// -- END UMD WRAPPER AFTERWORD --
