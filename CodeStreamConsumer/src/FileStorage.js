class FileStorage {
  constructor() {
    this.files = [];
  }

  static getInstance() {
    if (!FileStorage.instance) {
      FileStorage.instance = new FileStorage();
    }
    return FileStorage.instance;
  }

  addFile(file) {
    this.files.push(file);
  }

  all() {
    return this.files;
  }
}

export default FileStorage;
