const {getFileMetadataStorage} = require('../util/dependencies');
const {transform} = require('../util/property-mapping');
const {createUniqueFileName} = require('./file-metadata-handler');

async function findFolder(fullPath, namespace) {
  const paths = fullPath.split('/');
  let folderName = paths.pop();
  if (folderName.trim().length === 0) folderName = paths.pop();

  return await _findFolder(folderName, paths.join('/'), namespace);
}

async function _findFolder(folderName, folderPath, namespace) {
  if (!folderPath.endsWith('/')) folderPath += '/';
  folderName = folderName.replace(/\//g, '');

  if (folderName.trim() === '' && folderPath === '/') return true; // special case: root folder '/' is always considered existed

  const existingFile = await getFileMetadataStorage().findFileMetadata(transform({
    fileName: folderName,
    folderPath,
    ...(namespace ? {namespace} : {}),
  }));
  if (existingFile && existingFile.isFolder) return existingFile;
  else return null;
}


async function createFolder(folderName, folderPath, namespace) {
  if (!folderPath.endsWith('/')) folderPath += '/';
  folderName = folderName.replace(/\//g, '');
  folderName = await createUniqueFileName({fileName: folderName, folderPath, namespace});

  const existingFolder = await _findFolder(folderName, folderPath, namespace);
  if (existingFolder) return false;
  else return getFileMetadataStorage().createFolder(transform({
    fileName: folderName,
    folderPath,
    ...(namespace ? {namespace} : {}),
  }));
}

async function listFilesByFolder(folderPath, namespace) {
  if (!folderPath.endsWith('/')) folderPath += '/';

  return getFileMetadataStorage().findFileMetadatas(transform({
    folderPath,
    ...(namespace ? {namespace} : {}),
  }));
}

module.exports = {
  createFolder,
  listFilesByFolder,
  findFolder,
};
