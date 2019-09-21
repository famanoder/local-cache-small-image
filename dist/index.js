(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = global || self, global.LocalImgResolver = factory());
}(this, function () { 'use strict';

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  function _defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  function _createClass(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties(Constructor.prototype, protoProps);
    if (staticProps) _defineProperties(Constructor, staticProps);
    return Constructor;
  }

  var LRU =
  /*#__PURE__*/
  function () {
    function LRU() {
      var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
          _ref$localData = _ref.localData,
          localData = _ref$localData === void 0 ? [] : _ref$localData,
          _ref$max = _ref.max,
          max = _ref$max === void 0 ? 30 : _ref$max;

      _classCallCheck(this, LRU);

      this.data = localData;
      this.max = max;
    }

    _createClass(LRU, [{
      key: "push",
      value: function push(id) {
        if (~this.data.indexOf(id)) {
          return;
        }

        var rmId;

        if (this.data.length >= this.max) {
          // 如果超过最大限制，删掉使用次数最少的
          this.data.shift();
          rmId = id;
        } // 新添加的id放到队列的最后面


        this.data.push(id);
        return rmId;
      }
    }, {
      key: "update",
      value: function update(id) {
        var ins = this.data.indexOf(id);

        if (~ins) {
          // 将命中的id放到队列的最后面
          var res = this.data[ins];
          this.data.splice(ins, 1);
          this.data.push(res);
        }
      }
    }]);

    return LRU;
  }();

  var MAX_IMG_SIZE = 20 * 1024; // 20k

  var MAX_SAVED_NUM = 30;
  var EXPIRE_TIME = 7 * 24 * 60 * 60 * 1000;
  var KEY_PREFIX = 'local_cached_img_key';
  var EXPIRE_KEY = 'expire';
  var KEY_ENDSWITH = '$';
  var _localStorage = window.localStorage; // eslint-disable-line

  var localImgStore = {
    expireTime: EXPIRE_TIME,
    keyPrefix: KEY_PREFIX,
    length: 0,
    getMainKey: function getMainKey(id) {
      return "".concat(this.keyPrefix, "_").concat(id + KEY_ENDSWITH);
    },
    getExpireKey: function getExpireKey(id) {
      return "".concat(this.getMainKey(id)).concat(EXPIRE_KEY);
    },
    getLRUdataKey: function getLRUdataKey() {
      return "".concat(this.keyPrefix, "_lru_data");
    },
    getLRUdata: function getLRUdata() {
      var savedLRUdata = _localStorage.getItem(this.getLRUdataKey());

      var lruData = [];

      if (!savedLRUdata) {
        for (var k in _localStorage) {
          if (k.endsWith(KEY_ENDSWITH)) {
            lruData.push(k.replace("".concat(KEY_PREFIX, "_"), '').replace(new RegExp("\\".concat(KEY_ENDSWITH, "$")), ''));
          }
        }

        return lruData;
      }

      return savedLRUdata.split(',');
    },
    setLRUdata: function setLRUdata(data) {
      _localStorage.setItem(this.getLRUdataKey(), data.join(','));
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

      return (num - 1) / 2;
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

      _localStorage.removeItem(this.getExpireKey(id));

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

      var _ref = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {},
          maxSize = _ref.maxSize,
          maxNum = _ref.maxNum;

      return new Promise(function (rs) {
        var res = {
          id: id,
          src: src
        };

        if (_this.getStoredLength() < maxNum) {
          fetchImgBlob(src, maxSize).then(function (base64) {
            if (base64) {
              res.base64 = base64;

              _this._saveOne(id, src, base64);
            }

            rs(res);
          });
        } else {
          rs(res);
        }
      });
    }
  };

  function fetchImgBlob(src, maxSize) {
    return new Promise(function (rs) {
      var xhr = new XMLHttpRequest(); // eslint-disable-line

      xhr.onload = function () {
        if (this.response.size <= maxSize) {
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
      var _ref2 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
          maxSize = _ref2.maxSize,
          maxNum = _ref2.maxNum,
          expireTime = _ref2.expireTime,
          keyPrefix = _ref2.keyPrefix,
          useLRU = _ref2.useLRU;

      _classCallCheck(this, LocalImgResolver);

      this.maxSize = maxSize || MAX_IMG_SIZE;
      this.maxNum = maxNum || MAX_SAVED_NUM;
      this.expireTime = expireTime || EXPIRE_TIME;
      this.keyPrefix = keyPrefix || KEY_PREFIX;
      this.useLRU = useLRU;
      this.matched = Object.create(null);
      localImgStore.keyPrefix = this.keyPrefix;
      localImgStore.expireTime = this.expireTime;

      if (useLRU) {
        this.lru = new LRU({
          max: this.maxNum,
          localData: localImgStore.getLRUdata()
        });
      }
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
      key: "resolveAll",
      value: function resolveAll(imgs) {
        var _this2 = this;

        if (imgs) {
          var imgPromises = imgs.map(function (_ref3) {
            var id = _ref3.id,
                src = _ref3.src;
            return _this2.resolve(id, src);
          });
          return Promise.all(imgPromises);
        } else {
          return Promise.resolve([]);
        }
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

        this.withLRU(id, matched);

        if (matched) {
          return Promise.resolve({
            id: id,
            src: src,
            base64: item.base64
          });
        } else {
          var option = {
            maxSize: this.maxSize,
            maxNum: this.maxNum
          };
          return localImgStore.saveOne(id, src, option);
        }
      }
    }, {
      key: "withLRU",
      value: function withLRU(id, matched) {
        if (this.useLRU) {
          if (matched) {
            this.lru.update(id);
          } else {
            var rmId = this.lru.push(id);

            if (rmId) {
              localImgStore.removeOne(id);
            }
          }

          localImgStore.setLRUdata(this.lru.data);
        }
      }
    }]);

    return LocalImgResolver;
  }();

  return LocalImgResolver;

}));
