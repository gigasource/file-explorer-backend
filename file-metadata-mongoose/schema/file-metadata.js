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
  user: Schema.Types.ObjectId,
  fileSource: {
    type: String,
    trim: true,
  },
  generatedFileName: {
    type: String,
    trim: true,
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('FileMetadata', fileSchema);
