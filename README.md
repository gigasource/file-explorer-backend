# file-explorer-backend

## 1. Data structure
### 1.a Required properties
```
  // The name of the file
  fileName: String, 

  // The folder path of the file (e.g: '/home/', '/documents/work/')
  folderPath: String, 

  // MimeType of the file
  mimeType: String, 

  // If this record is a file or a folder
  isFolder: Boolean, 

  // Size of the file when saved in storage
  sizeInBytes: Number, 
```
### 1.b Optional properties
```
  // FileName saved on storage system
  uploadedFileName: String,

  // If namespace middleware is used
  namespace: String, 

  // File identifier on storage system to get the file when needed
  // For example: 
  // if the storage system is S3 or Bunny CDN, it can be an URL: https://bunny/file.txt
  // if the storage system is GridFS, it is the ObjectId of the 'files' collection
  fileId: String, 
```

An example of file metadata object:
```json
{
  "fileName": "file.txt",
  "mimeType": "text/plain",
  "folderPath": "/home/docs/",
  "sizeInBytes": "123",
  "isFolder": true,
  "uploadedFileName": "random-file-name-65G9-GFDGFD-543534GDV-GT34GFDGDF.txt",
  "namespace": "user-admin-1",
  "fileId": "https://bunnycdn/578543785348.txt (or an ObjectId: 8501859174829234 (GridFS))"
}
```

### 1.c How to customize property names
Pass an mapping object in initFileExplorer function like this:
```javascript
const {
    uploadFile,
    downloadFile,
    otherApis,
  } = initFileExplorer({
    dependencies: {
      fileMetadataStorage: mongooseFileMetadataStorage,
      fileStorage: gridFsFileStorage,
    },
    propertyMappings: {
      fileName: "name",
      mimeType: "mime",
      folderPath: "folder",
      sizeInBytes: "size",
    }
  });
```
Then file metadata object will be returned and saved in database with new property names:
```
{
  "name": "file.txt",
  "mime": "text/plain",
  "folder": "/home/docs/",
  "size": "123",
  "isFolder": true, (this prop is not mapped so the name will be the default name)
  ...
}
```

## 2. Code example
Check repository https://github.com/gigasource/file-explorer for examples

## 3. Roadmap
- Do property mappings for request queries and body
