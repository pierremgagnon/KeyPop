// lessons.js — niveaux & leçons (progression DYS : du repos vers les phrases).

export const LEVELS = [
  {
    id: 'repos', title: 'La rangée de repos', hint: 'q s d f g · h j k l m',
    lessons: ['fff jjj ddd kkk', 'fj fj dk dk sl sl', 'jk dl fg hj', 'qsdf jklm qsdf jklm']
  },
  {
    id: 'haut', title: 'La rangée du haut', hint: 'a z e r t · y u i o p',
    lessons: ['le re te', 'les tes des', 'arrete ta tarte', 'azerty poterie']
  },
  {
    id: 'milieu', title: 'La rangée du milieu', hint: 'mots simples',
    lessons: ['les jolis dahlias du jardin', 'la salade du midi', 'le jardin fleuri', 'kilo dalia gladi']
  },
  {
    id: 'bas', title: 'La rangée du bas', hint: 'w x c v b n',
    lessons: ['bon bien', 'vache cube', 'nuance bvcn', 'cave bonne vie']
  },
  {
    id: 'mots', title: 'Les mots', hint: 'mots du quotidien',
    lessons: ['cartable', 'recreation', 'ordinateur', 'la maison rouge']
  },
  {
    id: 'bigrammes', title: 'Les bigrammes', hint: 'ch ph gn ou',
    lessons: ['ch ph gn', 'chaque photo', 'la montagne', 'mon chien joue']
  },
  {
    id: 'phrases', title: 'Les phrases', hint: 'texte suivi',
    lessons: ['le chat dort sur le tapis du salon.', 'je prends mes notes en classe.', 'la pluie tombe doucement ce matin.']
  }
];

export function lessonText(levelIndex, lessonIndex) {
  const lvl = LEVELS[Math.max(0, Math.min(levelIndex, LEVELS.length - 1))];
  const list = lvl.lessons;
  return list[Math.max(0, Math.min(lessonIndex, list.length - 1))];
}

export function nextPosition(levelIndex, lessonIndex) {
  const lvl = LEVELS[levelIndex];
  if (lessonIndex + 1 < lvl.lessons.length) return { levelIndex, lessonIndex: lessonIndex + 1 };
  if (levelIndex + 1 < LEVELS.length) return { levelIndex: levelIndex + 1, lessonIndex: 0 };
  return { levelIndex, lessonIndex }; // fin du parcours
}
