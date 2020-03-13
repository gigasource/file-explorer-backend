const requiredProperties = ['fileName', 'mimeType', 'uploadedFileName', 'sizeInBytes', 'folderPath', 'isFolder', 'namespace', 'fileId'];
let propertyMappings = {};

function transformInternal(externalObject) {
  function transformObject(object) {
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

    const internalObject = new Proxy({}, propHandler);

    requiredProperties.forEach(propertyName => {
      internalObject[propertyName] = object[propertyName];
      internalObject[propertyMappings[propertyName]] = object[propertyMappings[propertyName]];
    });
    Reflect.ownKeys(object).forEach(propertyName => internalObject[propertyName] = object[propertyName]);

    return internalObject;
  }

  if (Array.isArray(externalObject)) {
    return externalObject.map(obj => transformObject(obj));
  } else {
    return transformObject(externalObject);
  }
}

function setPropertyMappings(mappings) {
  propertyMappings = mappings;
}

function transformExternal(internalObject) {
  function transformObject(obj) {
    const externalObject = {};
    Reflect.ownKeys(obj).forEach(originProp => {
      const destProp = propertyMappings[originProp] ? propertyMappings[originProp] : originProp;
      externalObject[destProp] = obj[originProp];
    });
    return externalObject;
  }

  if (Array.isArray(internalObject)) {
    return internalObject.map(obj => transformObject(obj));
  } else {
    return transformObject(internalObject);
  }
}

module.exports = {
  transformInternal,
  setPropertyMappings,
  transformExternal,
};
