function isValidUsername(username: string) {
  const lengthValid = username.length >= 3 && username.length <= 20;
  const formatValid = /^[a-zA-Z0-9_]+$/.test(username);
  const notAllUnderscores = !/^_+$/.test(username);
  const noPrefix = !/^u\//i.test(username);

  return lengthValid && formatValid && notAllUnderscores && noPrefix;
}

export { isValidUsername };
