(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(["exports"], factory);
  } else if (typeof exports !== "undefined") {
    factory(exports);
  } else {
    var mod = {
      exports: {}
    };
    factory(mod.exports);
    global.index = mod.exports;
  }
})(this, function (_exports) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = void 0;

  function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

  function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

  function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

  // 小型图片本地缓存方案
  var MAX_IMG_SIZE = 15 * 1024; // 15k

  var MAX_SAVED_NUM = 30;
  var AFTER_7_DAYS = 7 * 24 * 60 * 60 * 1000;
  var KEY_PREFIX = 'local_cached_img_key';
  var EXPIRE_KEY = 'expire';
  var _localStorage = window.localStorage; // eslint-disable-line

  var localImgStore = {
    expireTime: AFTER_7_DAYS,
    keyPrefix: KEY_PREFIX,
    length: 0,
    getMainKey: function getMainKey(id) {
      return "".concat(this.keyPrefix, "_").concat(id, "$");
    },
    getExpireKey: function getExpireKey(id) {
      return "".concat(this.getMainKey(id)).concat(EXPIRE_KEY);
    },
    isOurKey: function isOurKey(k) {
      return _localStorage.hasOwnProperty(k) && k.startsWith(this.keyPrefix);
    },
    getStoredLength: function getStoredLength() {
      var num = 0;

      for (var k in _localStorage) {
        if (this.isOurKey(k)) {
          num += 1;
        }
      }

      return num / 2;
    },
    removeExpired: function removeExpired() {
      for (var k in _localStorage) {
        if (this.isOurKey(k) && k.endsWith(EXPIRE_KEY)) {
          var expire = _localStorage[k];

          if (Date.now() - (expire || 0) >= this.expireTime) {
            var key = k.replace(/\w+$/, '');

            _localStorage.removeItem(k);

            _localStorage.removeItem(key);

            console.warn("will remove expired item '".concat(key, "'"));
          }
        }
      }
    },
    findOne: function findOne(id) {
      return _localStorage.getItem(this.getMainKey(id));
    },
    removeOne: function removeOne(id) {
      _localStorage.removeItem(this.getMainKey(id));

      return this;
    },
    _saveOne: function _saveOne(id, src, base64) {
      _localStorage.setItem(this.getMainKey(id), JSON.stringify({
        src: src,
        base64: base64
      }));

      _localStorage.setItem(this.getExpireKey(id), Date.now());
    },
    saveOne: function saveOne(id, src) {
      var _this = this;

      // 利用空闲时间来存储
      return new Promise(function (rs) {
        if (_this.getStoredLength() < MAX_SAVED_NUM) {
          fetchImgBlob(src).then(function (base64) {
            if (base64) {
              _this._saveOne(id, src, base64);

              rs({
                id: id,
                src: src,
                base64: base64
              });
            } else {
              rs({});
            }
          });
        } else {
          rs({});
        }
      });
    }
  };

  function fetchImgBlob(src) {
    // 解决canvas图片跨域问题
    return new Promise(function (rs) {
      var xhr = new XMLHttpRequest(); // eslint-disable-line

      xhr.onload = function () {
        if (this.response.size <= MAX_IMG_SIZE) {
          blobToBase64(this.response).then(rs);
        } else {
          rs(null);
        }
      };

      xhr.onabort = xhr.onerror = function () {
        rs(null);
      };

      xhr.open('GET', src, true);
      xhr.responseType = 'blob';
      xhr.send();
    });
  }

  function blobToBase64(blob) {
    return new Promise(function (rs) {
      var reader = new FileReader(); // eslint-disable-line

      reader.onload = function (e) {
        rs(e.target.result);
      };

      reader.readAsDataURL(blob);
    });
  }

  localImgStore.removeExpired();

  var LocalImgResolver =
  /*#__PURE__*/
  function () {
    function LocalImgResolver() {
      var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
          maxSize = _ref.maxSize,
          maxNum = _ref.maxNum,
          expireTime = _ref.expireTime,
          keyPrefix = _ref.keyPrefix;

      _classCallCheck(this, LocalImgResolver);

      this.maxSize = maxSize || MAX_IMG_SIZE;
      this.maxNum = maxNum || MAX_SAVED_NUM;
      this.expireTime = expireTime || AFTER_7_DAYS;
      this.keyPrefix = keyPrefix || KEY_PREFIX;
      this.matched = Object.create(null);
      localImgStore.keyPrefix = this.keyPrefix;
      localImgStore.expireTime = this.expireTime;
    }

    _createClass(LocalImgResolver, [{
      key: "match",
      value: function match(id, src) {
        if (this.matched[id]) {
          return this.matched[id];
        }

        var item = localImgStore.findOne(id);

        if (item) {
          try {
            item = JSON.parse(item);
          } catch (e) {
            item = {};
          }
        } else {
          return {
            matched: false
          };
        }

        var matched = item.src === src;

        if (matched) {
          this.matched[id] = {
            matched: matched,
            item: item
          };
          console.log('[hint cache]:', id);
        } else {
          this.matched[id] = null; // src地址更新了，清除缓存，重新存储

          localImgStore.removeOne(id);
        }

        return {
          matched: matched,
          item: item
        };
      }
    }, {
      key: "resolve",
      value: function resolve(id, src) {
        if (!window.FileReader) {
          // eslint-disable-line
          return Promise.resolve({
            id: id,
            src: src,
            base64: null
          });
        }

        var _this$match = this.match(id, src),
            matched = _this$match.matched,
            item = _this$match.item;

        if (matched) {
          return Promise.resolve({
            id: id,
            src: src,
            base64: item.base64
          });
        } else {
          return localImgStore.saveOne(id, src);
        }
      }
    }]);

    return LocalImgResolver;
  }();

  _exports.default = LocalImgResolver;
});