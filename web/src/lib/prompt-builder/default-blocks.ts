import type { PromptBlockInput } from "./types";

/** Блоки лаборатории по умолчанию — редактируются в UI; strength влияет на вес в итоговом промпте. */
export function getDefaultPromptBlocks(): PromptBlockInput[] {
  return [
    {
      blockKey: "output_intent",
      label: "Задача кадра",
      sortOrder: 0,
      enabled: true,
      strength: 1,
      content: `Создай одно кинематографичное фото премиального уровня, не постер и не заставку игры. Фотореализм, драматичный свет, естественная текстура кожи, лёгкая плёнка, высокий динамический диапазон.`,
    },
    {
      blockKey: "subject_identity",
      label: "Сохранение лица и тела",
      sortOrder: 10,
      enabled: true,
      strength: 1,
      content: `Человек с референс-фото должен оставаться узнаваемым: сохрани черты лица, глаза, нос, рот, причёску, тон кожи и пропорции тела. Не заменяй лицо другим человеком.`,
    },
    {
      blockKey: "fandom_canon",
      label: "Канон фандома и визуальные якоря",
      sortOrder: 20,
      enabled: true,
      strength: 1,
      content: `{{FANDOM_CANON}}`,
    },
    {
      blockKey: "scene",
      label: "Сцена",
      sortOrder: 30,
      enabled: true,
      strength: 1,
      content: `{{SCENE_DETAIL}}`,
    },
    {
      blockKey: "cinematic_craft",
      label: "Киноязык",
      sortOrder: 40,
      enabled: true,
      strength: 1,
      content: `Съёмка на полный кадр, при необходимости мелкая глубина резкости, мотивированный свет, объём в кадре, разделение цвета, сильная композиция (правило третей или динамическая диагональ), характеристики светосильной кинооптики.`,
    },
    {
      blockKey: "emotion_performance",
      label: "Эмоция и игра",
      sortOrder: 50,
      enabled: true,
      strength: 1,
      content: `{{EMOTION_NOTES}} Естественная микромимика, ясная эмоциональная линия, язык тела соответствует моменту.`,
    },
    {
      blockKey: "integration",
      label: "Встраивание в кадр",
      sortOrder: 60,
      enabled: true,
      strength: 1,
      content: `Согласуй направление и цветовую температуру света на персонаже со средой; связные тени; естественный контакт с полом и предметами; ткань реагирует на ветер и свет; без «вырезанных» контуров.`,
    },
    {
      blockKey: "negative_constraints",
      label: "Исключить / избегать",
      sortOrder: 70,
      enabled: true,
      strength: 1,
      content: `Избегай: лишних людей как со-героев, дублирующихся лиц, деформированных рук, восковой кожи, пластикового CGI, водяных знаков, текста поверх кадра, низкого разрешения, чрезмерной резкости с ореолами.`,
    },
  ];
}
