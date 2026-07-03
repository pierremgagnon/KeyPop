# Guide d'utilisation — KeyPop

Ce guide s'adresse aux **élèves**, à leurs **parents** et aux **ergothérapeutes** qui utilisent
KeyPop au quotidien. Pour la documentation technique (installation, architecture du code), voir
[`ARCHITECTURE.md`](ARCHITECTURE.md).

## Sommaire

- [Premiers pas](#premiers-pas)
- [Faire un exercice](#faire-un-exercice)
- [Réglages pendant un exercice](#réglages-pendant-un-exercice)
- [Mes statistiques](#mes-statistiques)
- [Mes chemins](#mes-chemins)
- [Espace ergothérapeute](#espace-ergothérapeute)
- [Vie privée](#vie-privée)

## Premiers pas

Au lancement de l'application, l'écran titre propose de choisir un **profil**. Chaque profil
correspond à un élève : sa progression, ses statistiques et ses réglages lui sont propres et
restent enregistrés sur cet ordinateur.

- **Choisir un profil existant** : cliquer sur sa carte.
- **Créer un profil** : cliquer sur « Nouveau profil », indiquer un prénom (et la classe si
  souhaité).
- **🔊 Narrateur** (en haut de l'écran) : coupe ou active la lecture audio des mots pour
  toute l'application. C'est un interrupteur général — voir aussi
  [Réglages pendant un exercice](#réglages-pendant-un-exercice) pour le réglage exercice par
  exercice.

## Faire un exercice

Depuis l'accueil, le bouton **« Continuer → »** lance l'exercice du moment. Le principe est
toujours le même :

1. Le texte à taper s'affiche, lettre par lettre.
2. La lettre à taper est surlignée, ainsi que la touche correspondante sur le clavier affiché
   à l'écran (avec un code couleur par doigt).
3. En cas d'erreur, KeyPop reste sur la même lettre jusqu'à ce qu'elle soit tapée correctement —
   la précision prime sur la vitesse.
4. Une fois l'exercice terminé, un écran de résultat affiche précision, vitesse, score, et deux
   indicateurs de rythme : la frappe la plus rapide et la plus lente (voir plus bas). Les deux
   lettres correspondantes sont surlignées dans le texte.

## Réglages pendant un exercice

Une rangée de « chips » (boutons arrondis) permet d'ajuster l'affichage :

- **Dictée audio** : la prochaine lettre/mot est lu à voix haute (nécessite le narrateur général
  activé). *Dans un chemin créé par un·e ergothérapeute, ce réglage est fixé par exercice — voir
  [Espace ergothérapeute](#espace-ergothérapeute) — et n'est plus modifiable ici.*
- **Police OpenDyslexic** : bascule vers une police pensée pour les élèves dyslexiques.
- Les informations sur le clavier détecté et la taille de disposition sont affichées à titre
  indicatif (non modifiables ici).

## Mes statistiques

L'écran **Stats** (accessible depuis l'accueil) résume la progression : précision et vitesse
moyennes, score total, graphique d'évolution et historique des dernières séances.

Le bouton **« Exporter le bilan PDF »** permet à l'ergothérapeute ou au parent de garder une trace
imprimable des progrès de l'élève.

## Mes chemins

Un **chemin** est une suite d'exercices personnalisés, préparée par un·e ergothérapeute (voir
section suivante) — par exemple autour d'un thème (la ferme, les phrases du quotidien…). Un chemin
s'ajoute à la progression standard de KeyPop, il ne la remplace pas : on peut faire les deux.

**Importer un chemin**, depuis l'accueil :

- **Depuis un fichier JSON** : bouton « Importer un chemin (JSON) », puis choisir le fichier reçu
  de l'ergothérapeute (par e-mail, clé USB, etc.).
- **Depuis le catalogue** : bouton « Parcourir le catalogue » — une sélection de chemins prêts à
  l'emploi, disponible même hors connexion. Le bouton **« 🔄 Rechercher des mises à jour »** va
  chercher les dernières versions en ligne ; si un chemin déjà importé a été mis à jour, KeyPop
  demande s'il faut garder la progression en cours ou repartir de zéro.

Une fois importé, un chemin apparaît dans la section **« Mes chemins »** de l'accueil, avec sa
progression (ex. « 2/5 exercices »). Le bouton **« Choisir ce chemin → »** le rend actif ; le
bouton **« ← Revenir à la progression standard »** permet d'y retourner à tout moment.

## Espace ergothérapeute

Accessible via le lien discret **« Espace ergothérapeute »** en bas de l'écran titre (aucun mot de
passe — l'application reste 100 % locale). C'est ici que l'on prépare des chemins sur mesure pour
un élève ou un groupe d'élèves.

**Créer un chemin :**

1. « + Nouveau chemin » → indiquer un titre (et une description facultative).
2. Ajouter les exercices un par un : taper le texte de l'exercice dans l'encart prévu, puis choisir
   si le **narrateur** doit lire ce texte à voix haute ou non (chip 🔊/🔇), et valider avec
   « + Ajouter l'exercice ».
3. Les exercices déjà ajoutés peuvent être réordonnés (↑ / ↓), modifiés directement dans leur
   encart de texte, ou supprimés (✕). Tout est enregistré automatiquement, pas besoin de bouton
   « Enregistrer ».

**Partager un chemin :** le bouton « Exporter JSON » télécharge le chemin sous forme de fichier
— à transmettre à l'élève par le moyen de son choix (e-mail, clé USB…) pour import direct, ou à
proposer pour inclusion dans le catalogue partagé du projet.

## Vie privée

KeyPop ne collecte aucune donnée, ne nécessite aucun compte et ne communique avec Internet que si
l'utilisateur clique explicitement sur « Rechercher des mises à jour » du catalogue (aucune
connexion automatique). Tous les profils, chemins et statistiques restent enregistrés uniquement
sur l'ordinateur utilisé.
