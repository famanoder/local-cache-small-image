// 小型图片本地缓存方案

const MAX_IMG_SIZE = 15 * 1024; // 15k
const MAX_SAVED_NUM = 30;
const AFTER_7_DAYS = 7 * 24 * 60 * 60 * 1000;
const KEY_PREFIX = 'local_cached_img_key_';

const localImgStore = {
  keyPrefix: KEY_PREFIX,
  length: 0,
  getKey(id) {
    return this.keyPrefix + id;
  },
  getStoredLength() {
    let num = 0;
    for(let k in localStorage) {
      if(localStorage.hasOwnProperty(k) && k.startsWith(this.keyPrefix)) {
        num += 1;
      }
    }
    return num;
  },
  findOne(id) {
    return localStorage.getItem(this.getKey(id));
  },
  removeOne(id) {
    localStorage.removeItem(this.getKey(id));
    return this;
  },
  _saveOne(id, src, base64) {
    localStorage.setItem(this.getKey(id), JSON.stringify({
      src,
      base64
    }));
  },
  saveOne(id, src) {
    // 利用空闲时间来存储
    return new Promise((rs, rj) => {
      if(this.getStoredLength() < MAX_SAVED_NUM) {
        fetchImgBlob(src)
        .then(base64 => {
          if(base64) {
            this._saveOne(id, src, base64);
            rs({
              id,
              src,
              base64
            });
          }else{
            rs(null);
          }
        });
      }else{
        rs(null);
      }
    });
  }
}

function fetchImgBlob(src) {
  // 解决canvas图片跨域问题
  return new Promise((rs, rj) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = function() {
      if(this.response.size <= MAX_IMG_SIZE) {
        blobToBase64(this.response)
        .then(rs);
      }else{
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
  return new Promise((rs, rj) => {
    const reader = new FileReader();
    reader.onload = function (e) {
      rs(e.target.result);
    }
    reader.readAsDataURL(blob);
  });
}

function supportWebp() {
  let canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const hasWebp = canvas.toDataURL('image/webp').startsWith('data:image/webp');
  canvas = null;
  return hasWebp;
}

export default class LocalImgResolver {
  constructor({
    maxSize,
    maxNum,
    expireTime,
    keyPrefix
  }) {
    this.maxSize = maxSize || MAX_IMG_SIZE;
    this.maxNum = maxNum || MAX_SAVED_NUM;
    this.expireTime = expireTime || AFTER_7_DAYS;
    this.keyPrefix = keyPrefix || KEY_PREFIX;
    this.matched = Object.create(null);

    localImgStore.keyPrefix = this.keyPrefix;
  }
  match(id, src) {
    if(this.matched[id]) {
      return this.matched[id];
    }

    let item = localImgStore.findOne(id);
    if(item) {
      try{
        item = JSON.parse(item);
      }catch(e) {
        item = {};
      }
    }else{
      return {
        matched: false
      }
    }
    
    const matched = item.src === src;

    if(matched) {
      this.matched[id] = {matched, item};
      console.log('[hint cache]:', id);
    }else{
      this.matched[id] = null;
      // src地址更新了，清除缓存，重新存储
      localImgStore.removeOne(id);
    }
    return {matched, item};
  }
  resolve(id, src) {
    if(!window.FileReader) {
      return Promise.resolve({id, src, base64: null});
    } 

    const {matched, item} = this.match(id, src);
    if(matched) {
      return Promise.resolve({
        id,
        src,
        base64: item.base64
      });
    }else{
      return localImgStore.saveOne(id, src);
    }
  }
};

