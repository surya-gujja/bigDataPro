export default class Clone {
  constructor(signature, fileA, rangeA, fileB, rangeB) {
    this.signature = signature;
    this.fileA = fileA;
    this.rangeA = rangeA;
    this.fileB = fileB;
    this.rangeB = rangeB;
  }

  // Highlighted modification: helper to compute clone span in lines.
  size() {
    const spanA = this.rangeA ? (this.rangeA.end - this.rangeA.start + 1) : 0;
    const spanB = this.rangeB ? (this.rangeB.end - this.rangeB.start + 1) : 0;
    if (spanA && spanB) {
      return (spanA + spanB) / 2;
    }
    return spanA || spanB;
  }
}
