const requiredProperties = ['fileName', 'mimeType', 'uploadedFileName', 'sizeInBytes', 'folderPath', 'isFolder', 'namespace', 'fileId'];
let propertyMappings = {};

function createFileWithMappings(file) {
  const propHandler = {
    get: function (obj, prop, receiver) {
      prop = propertyMappings[prop] || prop;
      return Reflect.get(obj, prop, receiver);
    },
    set: function (obj, prop, value) {
      prop = propertyMappings[prop] || prop;
      Reflect.set(obj, prop, value);
    }
  };

  const proxiedFile = new Proxy({}, propHandler);

  requiredProperties.forEach(propertyName => {
    proxiedFile[propertyName] = file[propertyName];
    proxiedFile[propertyMappings[propertyName]] = file[propertyMappings[propertyName]];
  });
  Reflect.ownKeys(file).forEach(propertyName => proxiedFile[propertyName] = file[propertyName]);

  return proxiedFile;
}

function setPropertyMappings(mappings) {
  propertyMappings = mappings;
}

function transform(object) {
  const transformedObject = {};
  Reflect.ownKeys(object).forEach(originProp => {
    const destProp = propertyMappings[originProp] ? propertyMappings[originProp] : originProp;
    transformedObject[destProp] = object[originProp];
  });
  return transformedObject;
}

module.exports = {
  createFileWithMappings,
  setPropertyMappings,
  transform,
};
