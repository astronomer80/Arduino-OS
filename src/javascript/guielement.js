/*!
 * OS.js - JavaScript Operating System
 *
 * Copyright (c) 2011-2015, Anders Evenrud <andersevenrud@gmail.com>
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met: 
 * 
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer. 
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution. 
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * @author  Anders Evenrud <andersevenrud@gmail.com>
 * @licence Simplified BSD License
 */
(function(API, Utils) {
  'use strict';

  window.OSjs = window.OSjs || {};
  OSjs.GUI = OSjs.GUI || {};

  var _PreviousGUIElement;

  /////////////////////////////////////////////////////////////////////////////
  // CLASS
  /////////////////////////////////////////////////////////////////////////////

  /**
   * GUI Element
   *
   * options:
   *  onItemDropped   Function      Callback - When internal object dropped (requires dnd enabled)
   *  onFilesDropped  Function      Callback - When external file object dropped (requires dnd enabled)
   *  dnd             bool          Enable DnD (Default = false)
   *  dndDrop         bool          Enable DnD Droppable (Default = DnD)
   *  dndDrag         bool          Enable DnD Draggable (Default = DnD)
   *  dndOpts         Object        DnD Options
   *  focusable       bool          If element is focusable (Default = true)
   */
  var GUIElement = (function() {
    var _Count = 0;

    return function(name, opts) {
      opts = opts || {};

      this.name           = name || ('Unknown_' + _Count);
      this.opts           = opts || {};
      this.id             = _Count;
      this.destroyed      = false;
      this.focused        = false;
      this.tabIndex       = -1; // Set in Window::_addGUIElement()
      this.wid            = 0; // Set in Window::_addGUIElement()
      this.hasTabIndex    = opts.hasTabIndex === true;
      this.hasChanged     = false;
      this.hasCustomKeys  = opts.hasCustomKeys === true;
      this.onItemDropped  = opts.onItemDropped  || function() {};
      this.onFilesDropped = opts.onFilesDropped || function() {};
      this._onFocusWindow = function() {};
      this.$element       = null;
      this.inited         = false;
      this._window        = null;
      this._hooks         = {
        focus   : [],
        blur    : [],
        destroy : []
      };

      if ( typeof this.opts.dnd === 'undefined' ) {
        this.opts.dnd     = false;
      }
      if ( typeof this.opts.dndDrop === 'undefined' ) {
        this.opts.dndDrop = this.opts.dnd;
      }
      if ( typeof this.opts.dndDrag === 'undefined' ) {
        this.opts.dndDrag = this.opts.dnd;
      }
      if ( typeof this.opts.dndOpts === 'undefined' ) {
        this.opts.dndOpts = {};
      }
      if ( typeof this.opts.focusable === 'undefined' ) {
        this.opts.focusable = true;
      }

      this.init();
      _Count++;
    };
  })();

  GUIElement.prototype.init = function(className, tagName) {
    tagName = tagName || 'div';

    var self = this;

    var classNames = [
      'GUIElement',
      'GUIElement_' + this.id,
      Utils.$safeName(className),
      Utils.$safeName(this.name)
    ];

    this.$element = document.createElement(tagName);
    this.$element.className = classNames.join(' ');

    if ( this.opts.dnd && this.opts.dndDrop && OSjs.Compability.dnd ) {
      var opts = this.opts.dndOpts;
      opts.onItemDropped = function(ev, el, item) {
        return self.onItemDropped.call(self, ev, el, item);
      };
      opts.onFilesDropped = function(ev, el, files) {
        return self.onFilesDropped.call(self, ev, el, files);
      };

      OSjs.API.createDroppable(this.$element, opts);
    }

    if ( this.opts.focusable ) {
      this._addEventListener(this.$element, 'mousedown', function(ev) {
        self._onFocus(ev);
      });
    }

    return this.$element;
  };

  GUIElement.prototype.update = function() {
    this.inited = true;
  };

  GUIElement.prototype.destroy = function() {
    if ( this.destroyed ) { return; }

    this.destroyed = true;
    this._fireHook('destroy');
    if ( this.$element && this.$element.parentNode ) {
      this.$element.parentNode.removeChild(this.$element);
      this.$element = null;
    }
    this._hooks = {};
  };

  GUIElement.prototype._addEventListener = function(el, ev, callback) {
    el.addEventListener(ev, callback, false);

    this._addHook('destroy', function() {
      el.removeEventListener(ev, callback, false);
    });
  };

  GUIElement.prototype._addHook = function(k, func) {
    if ( typeof func === 'function' && this._hooks[k] ) {
      this._hooks[k].push(func);
    }
  };

  GUIElement.prototype._fireHook = function(k, args) {
    var self = this;
    args = args || {};
    if ( this._hooks[k] ) {
      this._hooks[k].forEach(function(hook, i) {
        if ( hook ) {
          try {
            hook.apply(self, args);
          } catch ( e ) {
            console.warn('GUIElement::_fireHook() failed to run hook', k, i, e);
            console.warn(e.stack);
          }
        }
      });
    }
  };

  GUIElement.prototype.getRoot = function() {
    return this.$element;
  };

  GUIElement.prototype.onDndDrop = function(ev) {
    return true;
  };

  GUIElement.prototype.onGlobalKeyPress = function(ev) {
    if ( this.hasCustomKeys ) { return false; }
    if ( !this.focused ) { return false; }
    if ( !this.opts.onKeyPress ) { return false; }

    this.opts.onKeyPress.call(this, ev);

    return true;
  };

  GUIElement.prototype.onKeyUp = function(ev) {
    if ( this.hasCustomKeys ) { return false; }
    if ( !this.focused ) { return false; }
    if ( !this.opts.onKeyUp ) { return false; }

    this.opts.onKeyUp.call(this, ev);

    return true;
  };

  GUIElement.prototype._onFocus = function(ev) {
    ev.stopPropagation();
    OSjs.API.blurMenu();

    this.focus();
    this._onFocusWindow.call(this, ev);
  };

  GUIElement.prototype.focus = function() {
    if ( !this.opts.focusable ) { return false; }
    if ( this.focused ) { return false; }
    if ( _PreviousGUIElement && _PreviousGUIElement.id !== this.id ) {
      _PreviousGUIElement.blur();
    }
    console.debug('GUIElement::focus()', this.id, this.name);
    this.focused = true;
    this._fireHook('focus');
    _PreviousGUIElement = this;
    return true;
  };

  GUIElement.prototype.blur = function() {
    if ( !this.opts.focusable ) { return false; }
    if ( !this.focused ) { return false; }
    console.debug('GUIElement::blur()', this.id, this.name);
    this.focused = false;
    this._fireHook('blur');
    return true;
  };

  GUIElement.prototype._setWindow = function(w) {
    this.wid      = w._wid;
    this._window  = w;

    this._onFocusWindow = function() {
      w._focus();
    };
  };

  GUIElement.prototype._setTabIndex = function(i) {
    if ( !this.hasTabIndex ) { return; }

    this.tabIndex = parseInt(i, 10) || -1;
    if ( this.$element ) {
      this.$element.setAttribute('data-tabindex', this.tabIndex.toString());
    }
  };

  /////////////////////////////////////////////////////////////////////////////
  // EXPORTS
  /////////////////////////////////////////////////////////////////////////////

  OSjs.GUI.GUIElement       = GUIElement;

})(OSjs.API, OSjs.Utils);