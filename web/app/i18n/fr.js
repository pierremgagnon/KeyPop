// fr.js — textes de l'interface en français (langue de référence / fallback).

export default {
  common: {
    windowTitle: 'KeyPop — dactylo adaptée DYS',
    chooseLanguage: 'Choisir la langue',
    optional: '(facultatif)',
    ok: 'OK',
    cancel: 'Annuler'
  },
  gate: {
    practitionerLink: '🧑‍⚕️ Espace ergothérapeute',
    title: 'Qui apprend aujourd’hui ?',
    subtitle: 'Choisis ton profil — il reste sur cet ordinateur.',
    newProfile: 'Nouveau profil',
    profileSub: 'élève',
    deleteProfileTitle: 'Supprimer ce profil',
    deleteProfileAria: 'Supprimer le profil {name}',
    deleteProfileConfirm: 'Supprimer le profil « {name} » ? Sa progression et ses statistiques seront perdues définitivement.'
  },
  modalNewProfile: {
    title: 'Nouveau profil',
    nameLabel: 'Prénom de l’élève',
    namePlaceholder: 'ex. : Léa',
    lastNameLabel: 'Nom de l’élève',
    lastNamePlaceholder: 'ex. : Martin',
    create: 'Créer le profil'
  },
  modalNewPath: {
    title: 'Nouveau chemin',
    titleLabel: 'Titre',
    titlePlaceholder: 'ex. : Les animaux de la ferme',
    descLabel: 'Description',
    descPlaceholder: 'ex. : vocabulaire simple',
    create: 'Créer le chemin'
  },
  practitioner: {
    backToTitle: '← Écran titre',
    heading: 'Espace ergothérapeute',
    subtitle: 'Crée des chemins d’exercices, exporte-les pour tes élèves.',
    noPaths: 'Aucun chemin pour l’instant.',
    edit: 'Modifier',
    export: 'Exporter',
    delete: 'Supprimer',
    newPathBtn: '+ Nouveau chemin',
    deletePathConfirm: 'Supprimer ce chemin ? Cette action est irréversible.',
    exerciseCount: '{n} exercice(s) · v{v}'
  },
  pathEditor: {
    backToList: '← Mes chemins',
    exportBtn: 'Exporter',
    titleLabel: 'Titre',
    descLabel: 'Description',
    noExercises: 'Aucun exercice pour l’instant — ajoutes-en un ci-dessous.',
    narratorFree: '🔊 Narrateur libre',
    narratorLockedOn: '🔊 Narrateur verrouillé activé',
    narratorLockedOff: '🔇 Narrateur verrouillé désactivé',
    keyboardLocked: '⌨️ Clavier verrouillé',
    keyboardFree: '⌨️ Clavier libre',
    groupPlaceholder: 'Groupe (optionnel)',
    hintPlaceholder: 'Indice (optionnel)',
    moveUp: 'Monter',
    moveDown: 'Descendre',
    remove: 'Supprimer',
    newExPlaceholder: 'Texte de l’exercice…',
    addExBtn: '+ Ajouter l’exercice'
  },
  home: {
    pts: 'pts',
    themeNight: '☾ nuit',
    themeDay: '☀ jour',
    switchProfile: 'changer de profil',
    greeting: 'Salut, {name} !',
    subtitle: 'Prêt pour quelques minutes ? On reprend en douceur.',
    exerciseOf: 'Exercice {i} sur {n}',
    exerciseOfHint: 'Exercice {i} sur {n} · {hint}',
    pathFinished: 'Chemin terminé — bravo !',
    continue: 'Continuer →',
    accuracy: 'Précision',
    speed: 'Vitesse',
    sessions: 'Séances',
    see: 'Voir',
    statsLink: 'Stats →',
    myPaths: 'Mes chemins',
    exerciseProgress: '{done}/{total} exercices',
    currentPath: '✓ Chemin actif',
    choosePathBtn: 'Choisir ce chemin →',
    importPathBtn: 'Importer un chemin',
    browseCatalogue: 'Parcourir le catalogue',
    importFailed: 'Import impossible : {reason}',
    settings: 'Réglages'
  },
  exercise: {
    narratorOnForExercise: '🔊 Narrateur activé pour cet exercice',
    narratorOffForExercise: '🔇 Narrateur désactivé pour cet exercice',
    audioChip: 'Dictée audio',
    odChip: 'Police OpenDyslexic',
    keyboardOffForExercise: '⌨️ Clavier virtuel désactivé pour cet exercice',
    keyboardChip: 'Clavier virtuel',
    metronomeChip: 'Métronome',
    metronomePaceAria: 'Objectif du métronome',
    metronomePaceOption: '{wpm} m/min',
    layoutChip: 'Clavier : {label}',
    sizeChip: 'Disposition : {size} %',
    typePrompt: 'Tape le texte :',
    liveAccuracy: 'précision',
    liveSpeed: 'm/min',
    livePts: 'pts',
    footHint: 'Garde les index sur F et J — repère-toi au toucher.',
    exerciseOf: 'Exercice {i} / {n}',
    errFeedback: 'Presque — réessaie la touche surlignée.',
    resultTitlePathDone: 'Chemin terminé 🎉',
    resultTitleGood: 'Bien joué !',
    returnToPaths: 'Retour aux chemins',
    nextExercise: 'Exercice suivant →',
    home: 'Accueil',
    resultWpm: 'mots/min',
    resultMsBetween: 'ms entre 2 frappes',
    resultFastest: 'plus rapide',
    resultSlowest: 'plus lente',
    space: 'espace',
    chooseLesson: 'Changer de leçon',
    lessonOptionLabel: 'Leçon {n}',
    restart: 'Redémarrer l’exercice',
    pause: 'Mettre en pause',
    paused: '⏸ En pause — clique pour reprendre',
    timeLeft: '{min} min restantes',
    resultTitleTimeUp: 'Temps écoulé ⏱',
    goalMet: '✅ Objectif atteint',
    goalUnmet: '🔁 Objectif pas encore atteint',
    recoAdvance: 'On dirait que tu es prêt·e pour la suite !',
    recoRepeat: 'On pourrait refaire cet exercice pour bien ancrer 👍',
    goToStats: 'Voir mes statistiques',
    logout: 'Se déconnecter'
  },
  stats: {
    pdfBtn: 'Exporter le bilan PDF',
    heading: 'Statistiques — {name}',
    subtitle: 'élève · {n} séance(s)',
    avgAccuracy: 'Précision moy.',
    avgSpeed: 'Vitesse moy.',
    totalScore: 'Score total',
    progressChart: 'Progression — mots/min',
    noSessions: 'Aucune séance pour l’instant — fais une leçon !',
    history: 'Historique',
    backHome: '← Accueil'
  },
  catalogue: {
    refresh: '🔄 Rechercher des mises à jour',
    heading: 'Catalogue de chemins',
    loading: 'Chargement…',
    backHome: '← Accueil',
    availableCount: '{n} chemin(s) disponible(s).',
    exerciseCount: '{n} exercice(s)',
    importBtn: 'Importer',
    alreadyImported: 'Déjà importé ✓',
    updateBtn: 'Mettre à jour (v{v})',
    noPaths: 'Aucun chemin dans le catalogue.',
    newVersionConfirm: 'Une nouvelle version de « {title} » est disponible.\n\nOK = garder ma progression actuelle\nAnnuler = recommencer ce chemin à zéro',
    searching: 'Recherche de mises à jour…',
    fetchError: 'Impossible de contacter GitHub — réessaie plus tard.'
  },
  pathImport: {
    errorInvalidFile: 'Fichier invalide : ce n’est pas un chemin KeyPop.',
    errorMissingTitle: 'Ce chemin n’a pas de titre.',
    errorNoExercises: 'Ce chemin ne contient aucun exercice.',
    errorInvalidExercise: 'Exercice {n} invalide (texte manquant).'
  },
  settings: {
    backHome: '← Accueil',
    heading: 'Réglages',
    subtitle: 'Ces réglages s’appliquent aux exercices de ce profil.',
    keyboard: {
      title: 'Clavier',
      auto: 'Détection automatique',
      test: 'Test clavier',
      testHint: 'Activé : chaque frappe s’affiche brièvement à l’écran pour vérifier ce que l’ordinateur reçoit.'
    },
    goals: {
      title: 'Buts du cours',
      enable: 'Activer des objectifs de leçon',
      minSpeed: 'Vitesse minimale',
      maxErrors: 'Erreurs maximum',
      maxSlowdowns: 'Ralentissements maximum'
    },
    view: {
      title: 'Vue de la leçon',
      static: 'Une ligne, curseur statique',
      mobile: 'Une ligne, curseur mobile',
      multiline: 'Texte sur plusieurs lignes',
      textSize: 'Taille du texte'
    },
    onError: {
      title: 'Pour continuer la leçon',
      block: 'Saisir le bon caractère (reste sur l’erreur)',
      correct: 'Corriger le caractère faux',
      ignore: 'Ne rien faire (avance quand même)',
      backspace: 'Autoriser la touche de retour arrière'
    },
    duration: {
      title: 'Durée de la leçon',
      enable: 'Limiter la durée de la leçon',
      minutes: 'Durée',
      saveIncomplete: 'Sauvegarder les statistiques si la leçon est incomplète'
    },
    metronome: {
      title: 'Métronome',
      adaptive: 'Mode adaptatif (s’ajuste au rythme de l’élève pendant la leçon)',
      target: 'Cadence cible'
    },
    endOfLesson: {
      title: 'Fin de la leçon',
      showResults: 'Afficher les résultats en fin de leçon',
      showRecommendations: 'Afficher une recommandation',
      continue: 'Continuer l’entraînement',
      stats: 'Aller aux statistiques',
      logout: 'Se déconnecter'
    },
    onClose: {
      title: 'À la fermeture de l’application',
      resume: 'Reprendre l’exercice en cours au prochain lancement'
    },
    display: {
      title: 'Afficher pendant l’exercice',
      statusBar: 'Barre d’état (précision/vitesse/score en direct)',
      tips: 'Conseils',
      highlight: 'Texte de la leçon en surbrillance',
      toolbar: 'Barre d’outils (options rapides)',
      lessonPicker: 'Sélecteurs pour changer de leçon',
      pause: 'Bouton pause',
      restart: 'Bouton redémarrer'
    }
  }
};
