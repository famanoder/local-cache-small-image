export default class LRU {
  constructor({
    localData = [],
    max = 30
  } = {}) {
    this.data = localData;
    this.max = max;
  }
  push(id) {
    if(~this.data.indexOf(id)) {
      return;
    }
    let rmId;
    if(this.data.length >= this.max) {
      // 如果超过最大限制，删掉使用次数最少的
      this.data.shift();
      rmId = id;
    }

    // 新添加的id放到队列的最后面
    this.data.push(id);

    return rmId;

  }
  update(id) {
    const ins = this.data.indexOf(id);
    if(~ins) {
      // 将命中的id放到队列的最后面
      const res = this.data[ins];
      this.data.splice(ins, 1);
      this.data.push(res);
    }
  }
}