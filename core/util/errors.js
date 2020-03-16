const ERROR_CODE = Object.freeze({
  RENAME_FILE_DUPLICATED_FILE: -1001,
  MOVE_FILE_DUPLICATED_FILE: -1002,
});

function constructError(errorCode) {
  const error = new Error();
  error.code = errorCode;

  switch (errorCode) {
    case ERROR_CODE.RENAME_FILE_DUPLICATED_FILE:
      error.message = 'Can not rename file/folder to an existing name';
      break;
    case ERROR_CODE.MOVE_FILE_DUPLICATED_FILE:
      error.message = 'Can not move file/folder: a file/folder with the same name exists in new location';
      break;
  }

  return error;
}

module.exports = {
  ERROR_CODE, constructError
}
