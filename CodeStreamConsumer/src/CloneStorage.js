class CloneStorage {
  constructor() {
    this.clones = new Map();
  }

  static getInstance() {
    if (!CloneStorage.instance) {
      CloneStorage.instance = new CloneStorage();
    }
    return CloneStorage.instance;
  }

  addClone(clone) {
    const key = `${clone.signature}:${clone.fileA}:${clone.rangeA.start}-${clone.rangeA.end}:${clone.fileB}:${clone.rangeB.start}-${clone.rangeB.end}`;
    if (!this.clones.has(key)) {
      this.clones.set(key, clone);
    }
  }

  all() {
    return Array.from(this.clones.values());
  }
}

export default CloneStorage;
