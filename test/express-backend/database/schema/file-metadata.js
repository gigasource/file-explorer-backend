const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const fileSchema = new Schema({
  fileName: {
    type: String,
    trim: true,
  },
  mimeType: {
    type: String,
    trim: true,
  },
  uploadedFileName: {
    type: String,
    trim: true,
  },
  sizeInBytes: {
    type: Number,
  },
  folderPath: {
    type: String,
  },
  isFolder: {
    type: Boolean,
    default: false,
  },
  namespace: {
    type: String,
    trim: true,
  },
  fileId: {
    type: String,
    trim: true,
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('FileMetadata', fileSchema);
