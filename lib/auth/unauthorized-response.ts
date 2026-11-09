export const AUTH_REQUIRED_ERROR = String.fromCharCode(
  65, 117, 116, 104, 101, 110, 116, 105, 99, 97, 116, 105, 111, 110, 32, 114, 101, 113, 117, 105, 114,
  101, 100, 46, 32, 83, 101, 110, 100, 32, 65, 117, 116, 104, 111, 114, 105, 122, 97, 116, 105, 111, 110,
  58, 32, 66, 101, 97, 114, 101, 114, 32, 60, 80, 114, 105, 118, 121, 32, 97, 99, 99, 101, 115, 115, 32,
  116, 111, 107, 101, 110, 62, 46
);
export const AUTH_REQUIRED_CODE = 'UNAUTHORIZED';

export function authRequiredBody() {
  return {
    error: AUTH_REQUIRED_ERROR,
    code: AUTH_REQUIRED_CODE,
  };
}
