export default class SourceLine {
  constructor(number, text) {
    this.number = number;
    this.text = text;
    this._normalised = null;
  }

  normalised() {
    if (this._normalised === null) {
      this._normalised = this.text.replace(/\s+/g, ' ').trim();
    }
    return this._normalised;
  }

  equals(other) {
    if (!other) {
      return false;
    }
    return this.normalised() === other.normalised();
  }
}
