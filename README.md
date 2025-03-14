## О Проекте  
  
### Стек   
NodeJS - v.20.11.1<br/>
React  - v.18<br/>
Typescript<br/>

### Известные проблемы 

#### 1. CORS ERROR
Если вы запустили в режиме разработки сайт - необходимо запускать браузер в режиме отключенной веб безопасности
```chrome.exe --user-data-dir="C://Chrome dev session" --disable-web-security```

При продакшн билде необходимо, чтобы домены сайтов совпадали либо на сервере поменять хедер


### Добавление в "Инструкцию"
Добавить в папку public/instructions файл instruction_{№ инструкции}
Добавить новый элемент SwiperSlide в ```src\pages\project\viewer\instruction\index.tsx```
```javascript
    <SwiperSlide>
        <InstructionItem title="Текст" index={{номер инструкции}} />
    </SwiperSlide>
```

### Переменные окружения
- VITE_BACKEND_URL=адрес бэкенда
- VITE_AUTH_CLIENT_ID=oauth ckiebt id
- VITE_BROADWAY=oauth client secret
- VITE_REDICRECT_URL=oauth redirect

### Разворачивание и локальная разработка
1. Создать файл в корне(где package.json) - .env.development (для прода .env.production) и внести туда переменные окружения
2. Запустить команду ``` npm i ```
3. Для локального запуска кода  ``` npm run dev ```
4. Для билда в продакшн  ``` npm run build ```
5. Создается папка dist - перенести в корень того места ,где будет лежать статика



