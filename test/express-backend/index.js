function startExpressServer(options) {
  const {mongooseConnectionUrl, namespaceHeader, expressPort} = options;
  const http = require('http');
  const port = normalizePort(expressPort || '3000');
  const express = require('express');
  const mongoose = require('mongoose');
  const initFileExplorer = require('../../index');
  const {BACKEND_TEST_CONFIG} = require('./constants');

  const app = express();

  app.use(express.json());
// app.use(express.urlencoded({extended: true}));

  mongoose.connect(mongooseConnectionUrl || BACKEND_TEST_CONFIG.LOCAL_MONGOOSE_CONNECTION_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }, err => {
    if (err) throw err;

    const MongooseFileMetadataStorage = require('./mongoose-file-metadata-storage');
    const mongooseFileMetadataStorage = new MongooseFileMetadataStorage();

    const GridFsFileStorage = require('../../file-storage-gridfs');
    const gridFsFileStorage = new GridFsFileStorage(mongoose.connection.db, {
      bucketName: 'unittest',
    });

    const {
      getUploadFileUrl,
      removeFile,
      createFileMetadata,
      getFileMetadata,
      createFolder,
      listFilesByFolder,
      uploadFile,
      downloadFile,
      namespaceMiddleware,
    } = initFileExplorer({
      dependencies: {
        fileMetadataStorage: mongooseFileMetadataStorage,
        fileStorage: gridFsFileStorage,
      }
    });

    if (namespaceHeader) app.use(namespaceMiddleware(namespaceHeader));
    // app.get('/files', getUploadFileUrl);
    // app.post('/files', createFileMetadata);
    app.post('/folders', createFolder);
    app.delete('/files/:fileId', removeFile);
    app.get('/files-metadata/:fileId', getFileMetadata);
    app.get('/folders', listFilesByFolder);
    app.post('/files', uploadFile);
    app.get('/files/:filePath(*)', downloadFile);
  });

  app.set('port', port);
  const server = http.createServer(app);
  server.listen(port);
  server.on('error', onError);
  server.on('listening', onListening);

  function onListening() {
    const addr = server.address();
    const bind = typeof addr === 'string'
        ? 'pipe ' + addr
        : 'port ' + addr.port;
    console.log('Express server started, listening on ' + bind);
  }
  function normalizePort(val) {
    const port = parseInt(val, 10);
    if (isNaN(port)) return val;
    if (port >= 0) return port;

    return false;
  }
  function onError(error) {
    if (error.syscall !== 'listen') {
      throw error;
    }

    const bind = typeof port === 'string'
        ? 'Pipe ' + port
        : 'Port ' + port;

    switch (error.code) {
      case 'EACCES':
        console.error(bind + ' requires elevated privileges');
        process.exit(1);
        break;
      case 'EADDRINUSE':
        console.error(bind + ' is already in use');
        process.exit(1);
        break;
      default:
        throw error;
    }
  }

  return server;
}

module.exports = startExpressServer;
