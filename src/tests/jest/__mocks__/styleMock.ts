// Прокси-объект, который возвращает имя класса как есть
module.exports = new Proxy(
  {},
  {
    get: function getter(_target, key) {
      return key;
    },
  }
);