## О Проекте

### Стек

NodeJS - v.20.11.1<br/>
React - v.18<br/>
Typescript<br/>

### Добавление в "Инструкцию"

Добавить в папку public/instructions файл instruction\_{№ инструкции}
Добавить новый элемент SwiperSlide в `src\pages\project\viewer\instruction\index.tsx`

```javascript
    <SwiperSlide>
        <InstructionItem title="Текст" index={{номер инструкции}} />
    </SwiperSlide>
```

### Разворачивание и локальная разработка

1. Запустить команду `npm i`
2. Для локального запуска кода `npm run dev`
3. Для билда в продакшн `npm run build`
4. Создается папка dist - перенести в корень того места ,где будет лежать статика
