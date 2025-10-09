export default class SourceLine {
  constructor(number, text) {
    this.number = number;
    this.text = text;
  }

  normalised() {
    return this.text.replace(/\s+/g, ' ').trim();
  }
}
