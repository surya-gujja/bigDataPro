class FileStorage {
  constructor() {
    this.files = [];
    this.index = new Map();
  }

  static getInstance() {
    if (!FileStorage.instance) {
      FileStorage.instance = new FileStorage();
    }
    return FileStorage.instance;
  }

  addFile(file) {
    if (this.index.has(file.name)) {
      const position = this.files.findIndex((entry) => entry.name === file.name);
      if (position !== -1) {
        this.files[position] = file;
      }
    } else {
      this.files.push(file);
    }
    this.index.set(file.name, file);
  }

  all() {
    return this.files;
  }

  get(name) {
    return this.index.get(name) || null;
  }
}

export default FileStorage;
