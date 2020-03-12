const {setPropertyMappings} = require('./core/util/property-mapping');
const initHandlers = require('./core/file-handlers');
const {setFileMetadataStorage, setFileStorage} = require('./core/util/dependencies');

function initFileExplorer(options) {
  const {fileMetadataStorage, fileStorage} = options.dependencies;

  setFileMetadataStorage(fileMetadataStorage);
  setFileStorage(fileStorage);
  setPropertyMappings((options && options.propertyMappings) || {});

  function namespaceMiddleware(headerKey) {
    return function (req, res, next) {
      req.namespace = req.header(headerKey);
      if (!req.namespace) return res.status(400).json({error: `Missing ${headerKey} in request header`});
      else next();
    }
  }

  return {
    namespaceMiddleware,
    ...initHandlers(options),
  }
}

module.exports = initFileExplorer;
