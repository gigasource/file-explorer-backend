function extractFilePath(fullPath) {
  if (!fullPath.endsWith('/')) fullPath += '/';
  const paths = fullPath.split('/');
  paths.pop();
  const fileName = paths.pop();
  let folderPath = paths.join('/');
  if (!folderPath.endsWith('/')) folderPath += '/';

  return {fileName, folderPath};
}

module.exports = {
  extractFilePath
}
