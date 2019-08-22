// 小型图片本地缓存方案

const MAX_IMG_SIZE = 15 * 1024; // 15k
const MAX_SAVED_NUM = 30;
const AFTER_7_DAYS = 7 * 24 * 60 * 60 * 1000;
const KEY_PREFIX = 'local_cached_img_key';
const EXPIRE_KEY = 'expire';
const _localStorage = window.localStorage; // eslint-disable-line

const localImgStore = {
  expireTime: AFTER_7_DAYS, 
  keyPrefix: KEY_PREFIX,
  length: 0,
  getMainKey(id) {
    return `${this.keyPrefix}_${id}$`;
  },
  getExpireKey(id) {
    return `${this.getMainKey(id)}${EXPIRE_KEY}`;
  },
  isOurKey(k) {
    return _localStorage.hasOwnProperty(k) && k.startsWith(this.keyPrefix);
  },
  getStoredLength() {
    let num = 0;
    for (const k in _localStorage) {
      if (this.isOurKey(k)) {
        num += 1;
      }
    }
    return num / 2;
  },
  removeExpired() {
    for (const k in _localStorage) {
      if (this.isOurKey(k) && k.endsWith(EXPIRE_KEY)) {
        const expire = _localStorage[k];
        if (Date.now() - (expire ||  0) >= this.expireTime) {
          const key = k.replace(/\w+$/, '');
          _localStorage.removeItem(k);
          _localStorage.removeItem(key);
          console.warn(`will remove expired item '${key}'`);
        }
      }
    }
  },
  findOne(id) {
    return _localStorage.getItem(this.getMainKey(id));
  },
  removeOne(id) {
    _localStorage.removeItem(this.getMainKey(id));
    return this;
  },
  _saveOne(id, src, base64) {
    _localStorage.setItem(this.getMainKey(id), JSON.stringify({
      src,
      base64
    }));
    _localStorage.setItem(this.getExpireKey(id), Date.now());
  },
  saveOne(id, src) {
    // 利用空闲时间来存储
    return new Promise(rs => {
      if (this.getStoredLength() < MAX_SAVED_NUM) {
        fetchImgBlob(src)
        .then(base64 => {
          if (base64) {
            this._saveOne(id, src, base64);
            rs({
              id,
              src,
              base64
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
}

function fetchImgBlob(src) {
  // 解决canvas图片跨域问题
  return new Promise(rs => {
    const xhr = new XMLHttpRequest(); // eslint-disable-line
    xhr.onload = function() {
      if (this.response.size <= MAX_IMG_SIZE) {
        blobToBase64(this.response)
        .then(rs);
      } else {
        rs(null);
      }
    }
    xhr.onabort = xhr.onerror = function() {
      rs(null);
    }
    xhr.open('GET', src, true);
    xhr.responseType = 'blob';
    xhr.send();
  });
}

function blobToBase64(blob) {
  return new Promise(rs => {
    const reader = new FileReader(); // eslint-disable-line
    reader.onload = function (e) {
      rs(e.target.result);
    }
    reader.readAsDataURL(blob);
  });
}

localImgStore.removeExpired();

export default class LocalImgResolver {
  constructor({
    maxSize,
    maxNum,
    expireTime,
    keyPrefix
  } = {}) {
    this.maxSize = maxSize || MAX_IMG_SIZE;
    this.maxNum = maxNum || MAX_SAVED_NUM;
    this.expireTime = expireTime || AFTER_7_DAYS;
    this.keyPrefix = keyPrefix || KEY_PREFIX;
    this.matched = Object.create(null);

    localImgStore.keyPrefix = this.keyPrefix;
    localImgStore.expireTime = this.expireTime;
  }
  match(id, src) {
    if (this.matched[id]) {
      return this.matched[id];
    }

    let item = localImgStore.findOne(id);
    if (item) {
      try {
        item = JSON.parse(item);
      } catch (e) {
        item = {};
      }
    } else {
      return {
        matched: false
      }
    }
    
    const matched = item.src === src;

    if (matched) {
      this.matched[id] = {matched, item};
      console.log('[hint cache]:', id);
    } else {
      this.matched[id] = null;
      // src地址更新了，清除缓存，重新存储
      localImgStore.removeOne(id);
    }
    return {matched, item};
  }
  resolve(id, src) {
    if (!window.FileReader) { // eslint-disable-line
      return Promise.resolve({id, src, base64: null});
    } 

    const {matched, item} = this.match(id, src);
    if (matched) {
      return Promise.resolve({
        id,
        src,
        base64: item.base64
      });
    } else {
      return localImgStore.saveOne(id, src);
    }
  }
}