const {getFileMetadataStorage} = require('../util/dependencies');
const {transform} = require('../util/property-mapping');

function getFileByFullPath(fullPath, namespace) {
  const paths = fullPath.split('/');
  let fileName = paths.pop();
  if (fileName.trim().length === 0) fileName = paths.pop();
  let folderPath = paths.join('/');
  if (!folderPath.endsWith('/')) folderPath += '/';

  return getFileMetadataStorage().findFileMetadata(transform({
    fileName, folderPath,
    ...(namespace ? {namespace} : {}),
  }));
}

async function getFileByNameAndFolder(fileName, folderPath, namespace) {
  return getFileMetadataStorage().findFileMetadata(transform({
    fileName,
    folderPath,
    ...(namespace ? {namespace} : {}),
  }));
}

async function createUniqueFileName(file) {
  let newFileName = file.fileName;
  let f = await getFileByNameAndFolder(newFileName, file.folderPath, file.namespace);
  let duplicateIdentifier = 1;

  while (f) {
    const nameParts = file.fileName.split('.');
    if (nameParts.length > 1) {
      nameParts[nameParts.length - 2] += ` (${duplicateIdentifier++})`;
    } else {
      nameParts[0] += ` (${duplicateIdentifier++})`;
    }

    newFileName = nameParts.join('.');
    //example: test.png, test (1).png, test (2).png
    f = await getFileByNameAndFolder(newFileName, file.folderPath, file.namespace);
  }

  return newFileName
}

async function createFileMetadata(file) {
  if (!file.folderPath.endsWith('/')) file.folderPath += '/';
  file.fileName = await createUniqueFileName(file);
  return getFileMetadataStorage().createFileMetadata(transform(file));
}

function getFileMetadataById(fileId, namespace) {
  const file = getFileMetadataStorage().findFileMetadata(transform({
    _id: fileId,
    ...(namespace ? {namespace} : {}),
  }));

  return file ? file : null;
}

function deleteFileMetadataById(fileId, namespace) {
  return getFileMetadataStorage().deleteFileMetadata(transform({
    _id: fileId,
    ...(namespace ? {namespace} : {}),
  }));
}

module.exports = {
  createFileMetadata,
  getFileMetadataById,
  deleteFileMetadataById,
  createUniqueFileName,
  getFileByFullPath,
};
