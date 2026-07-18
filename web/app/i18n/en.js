// en.js — interface text in English.

export default {
  common: {
    windowTitle: 'KeyPop — DYS-friendly typing',
    chooseLanguage: 'Choose language',
    optional: '(optional)',
    ok: 'OK',
    cancel: 'Cancel'
  },
  gate: {
    practitionerLink: '🧑‍⚕️ Practitioner area',
    title: 'Who’s learning today?',
    subtitle: 'Choose your profile — it stays on this computer.',
    newProfile: 'New profile',
    profileSub: 'student',
    deleteProfileTitle: 'Delete this profile',
    deleteProfileAria: 'Delete profile {name}',
    deleteProfileConfirm: 'Delete profile "{name}"? Their progress and statistics will be permanently lost.'
  },
  modalNewProfile: {
    title: 'New profile',
    nameLabel: 'Student’s first name',
    namePlaceholder: 'e.g.: Mia',
    lastNameLabel: 'Student’s last name',
    lastNamePlaceholder: 'e.g.: Smith',
    create: 'Create profile'
  },
  modalNewPath: {
    title: 'New path',
    titleLabel: 'Title',
    titlePlaceholder: 'e.g.: Farm animals',
    descLabel: 'Description',
    descPlaceholder: 'e.g.: simple vocabulary',
    create: 'Create path'
  },
  practitioner: {
    backToTitle: '← Title screen',
    heading: 'Practitioner area',
    subtitle: 'Create exercise paths and export them for your students.',
    noPaths: 'No paths yet.',
    edit: 'Edit',
    export: 'Export',
    delete: 'Delete',
    newPathBtn: '+ New path',
    deletePathConfirm: 'Delete this path? This action is irreversible.',
    exerciseCount: '{n} exercise(s) · v{v}'
  },
  pathEditor: {
    backToList: '← My paths',
    exportBtn: 'Export',
    titleLabel: 'Title',
    descLabel: 'Description',
    noExercises: 'No exercises yet — add one below.',
    narratorFree: '🔊 Narrator free',
    narratorLockedOn: '🔊 Narrator locked on',
    narratorLockedOff: '🔇 Narrator locked off',
    keyboardLocked: '⌨️ Keyboard locked',
    keyboardFree: '⌨️ Keyboard free',
    groupPlaceholder: 'Group (optional)',
    hintPlaceholder: 'Hint (optional)',
    moveUp: 'Move up',
    moveDown: 'Move down',
    remove: 'Remove',
    newExPlaceholder: 'Exercise text…',
    addExBtn: '+ Add exercise'
  },
  home: {
    pts: 'pts',
    themeNight: '☾ night',
    themeDay: '☀ day',
    switchProfile: 'switch profile',
    greeting: 'Hi, {name}!',
    subtitle: 'Ready for a few minutes? Let’s ease back in.',
    exerciseOf: 'Exercise {i} of {n}',
    exerciseOfHint: 'Exercise {i} of {n} · {hint}',
    pathFinished: 'Path complete — great job!',
    continue: 'Continue →',
    accuracy: 'Accuracy',
    speed: 'Speed',
    sessions: 'Sessions',
    see: 'See',
    statsLink: 'Stats →',
    myPaths: 'My paths',
    exerciseProgress: '{done}/{total} exercises',
    currentPath: '✓ Current path',
    choosePathBtn: 'Choose this path →',
    importPathBtn: 'Import a path',
    browseCatalogue: 'Browse the catalogue',
    importFailed: 'Import failed: {reason}',
    settings: 'Settings'
  },
  exercise: {
    narratorOnForExercise: '🔊 Narrator on for this exercise',
    narratorOffForExercise: '🔇 Narrator off for this exercise',
    audioChip: 'Audio dictation',
    odChip: 'OpenDyslexic font',
    keyboardOffForExercise: '⌨️ Virtual keyboard off for this exercise',
    keyboardChip: 'Virtual keyboard',
    metronomeChip: 'Metronome',
    metronomePaceAria: 'Metronome target pace',
    metronomePaceOption: '{wpm} wpm',
    layoutChip: 'Keyboard: {label}',
    sizeChip: 'Layout: {size} %',
    typePrompt: 'Type the text:',
    liveAccuracy: 'accuracy',
    liveSpeed: 'wpm',
    livePts: 'pts',
    footHint: 'Keep your index fingers on F and J — feel your way by touch.',
    exerciseOf: 'Exercise {i} / {n}',
    errFeedback: 'Almost — try the highlighted key again.',
    resultTitlePathDone: 'Path complete 🎉',
    resultTitleGood: 'Well done!',
    returnToPaths: 'Back to paths',
    nextExercise: 'Next exercise →',
    home: 'Home',
    resultWpm: 'wpm',
    resultMsBetween: 'ms between keystrokes',
    resultFastest: 'fastest',
    resultSlowest: 'slowest',
    space: 'space',
    chooseLesson: 'Change lesson',
    lessonOptionLabel: 'Lesson {n}',
    restart: 'Restart exercise',
    pause: 'Pause',
    paused: '⏸ Paused — click to resume',
    timeLeft: '{min} min left',
    resultTitleTimeUp: 'Time’s up ⏱',
    goalMet: '✅ Goal met',
    goalUnmet: '🔁 Goal not met yet',
    recoAdvance: 'Looks like you’re ready for the next one!',
    recoRepeat: 'Might be worth repeating this exercise to lock it in 👍',
    goToStats: 'View my statistics',
    logout: 'Log out'
  },
  stats: {
    pdfBtn: 'Export PDF report',
    heading: 'Statistics — {name}',
    subtitle: 'student · {n} session(s)',
    avgAccuracy: 'Avg. accuracy',
    avgSpeed: 'Avg. speed',
    totalScore: 'Total score',
    progressChart: 'Progress — wpm',
    noSessions: 'No sessions yet — do a lesson!',
    history: 'History',
    backHome: '← Home'
  },
  catalogue: {
    refresh: '🔄 Check for updates',
    heading: 'Path catalogue',
    loading: 'Loading…',
    backHome: '← Home',
    availableCount: '{n} path(s) available.',
    exerciseCount: '{n} exercise(s)',
    importBtn: 'Import',
    alreadyImported: 'Already imported ✓',
    updateBtn: 'Update (v{v})',
    noPaths: 'No paths in the catalogue.',
    newVersionConfirm: 'A new version of "{title}" is available.\n\nOK = keep my current progress\nCancel = restart this path from scratch',
    searching: 'Checking for updates…',
    fetchError: 'Couldn’t reach GitHub — try again later.'
  },
  pathImport: {
    errorInvalidFile: 'Invalid file: this isn’t a KeyPop path.',
    errorMissingTitle: 'This path has no title.',
    errorNoExercises: 'This path has no exercises.',
    errorInvalidExercise: 'Exercise {n} is invalid (missing text).'
  },
  settings: {
    backHome: '← Home',
    heading: 'Settings',
    subtitle: 'These settings apply to this profile’s exercises.',
    keyboard: {
      title: 'Keyboard',
      auto: 'Automatic detection'
    },
    goals: {
      title: 'Lesson goals',
      enable: 'Enable lesson goals',
      minSpeed: 'Minimum speed',
      maxErrors: 'Maximum errors',
      maxSlowdowns: 'Maximum slowdowns'
    },
    view: {
      title: 'Lesson view',
      static: 'Single line, static cursor',
      mobile: 'Single line, moving cursor',
      multiline: 'Multi-line text',
      textSize: 'Text size'
    },
    onError: {
      title: 'When you make a mistake',
      block: 'Type the correct character (stays on the mistake)',
      correct: 'Correct the wrong character',
      ignore: 'Do nothing (moves on anyway)',
      backspace: 'Allow the backspace key'
    },
    duration: {
      title: 'Lesson duration',
      enable: 'Limit the lesson duration',
      minutes: 'Duration',
      saveIncomplete: 'Save statistics if the lesson is incomplete'
    },
    metronome: {
      title: 'Metronome',
      adaptive: 'Adaptive mode (adjusts to the student’s pace during the lesson)',
      target: 'Target pace'
    },
    endOfLesson: {
      title: 'End of lesson',
      showResults: 'Show results at the end of the lesson',
      showRecommendations: 'Show a recommendation',
      continue: 'Continue training',
      stats: 'Go to statistics',
      logout: 'Log out'
    },
    onClose: {
      title: 'When closing the app',
      resume: 'Resume the current exercise next time'
    },
    display: {
      title: 'Show during the exercise',
      statusBar: 'Status bar (live accuracy/speed/score)',
      tips: 'Tips',
      highlight: 'Lesson text highlighting',
      toolbar: 'Toolbar (quick options)',
      lessonPicker: 'Lesson picker',
      pause: 'Pause button',
      restart: 'Restart button'
    }
  }
};
