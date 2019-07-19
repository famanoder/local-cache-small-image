### local-cache-small-image

> a way to manage browser local caches for small images.  

**just recommand to cache small images（default: 15k）, prefer webp formatted.**

if you had practiced PWA, you must known that it intercept requests and store resources to cacheStorage to make our app so fast like native app nearly; in a progressive way, we can make full use of browser's storage capability, eg: localStorage、IndexDb; this time, let's store some small images to our browser storage, you will see how fast it's;

### Usage

* **Install**

```js
yarn add local-cache-small-image
// or
npm i local-cache-small-image
```

* **Option**

  * maxSize: image's max size;
  * maxNum: max number can be stored;
  * expireTime: how long stored;
  * keyPrefix: stored key prefix;

* **API**

  * resolve: (id, src) => Promise

* **Example**

```js
import LocalImgResolver from 'local-cache-small-image';

const option = {
  // maxSize: 15 * 1024,
  // maxNum: 30,
  // expireTime: 7 * 24 * 60 * 60 * 1000,
  // keyPrefix: 'local_cached_img_key_'
};
const localImgResolver = new LocalImgResolver(option);
let img;

localImgResolver
.resolve('uniqId', 'your image src')
.then(({id, src, base64}) => {
  img = base64 || src;
});
```

when you use `localImgResolver.resolve(id, src)`, it return a Promise, I try to find a cached base64, if success, resolve it, or, use this src to download the image's blob and then save it as base64, and resolve it;

### Plan

* use a worker
  
* use task queue with requestIdleCallback

* maybe IndexDB