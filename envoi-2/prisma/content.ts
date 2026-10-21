// Contenus publics et PROJETS de documents juridiques. Tout champ [À RENSEIGNER] doit être complété,
// et l'ensemble validé par un juriste suisse avant le lancement (voir docs/AVANT-MISE-EN-PRODUCTION.md).
const TODO = "[À RENSEIGNER]";
export const CONTENT: { slug: string; title: string; body: string }[] = [
{ slug: "comment-ca-marche", title: "Comment ça marche", body: `
## Réserver en quelques minutes
1. **Indiquez votre adresse** (ou votre code postal) pour voir les barbiers qui se déplacent chez vous.
2. **Choisissez votre prestation** : coupe, barbe, coupe et barbe, coupe enfant.
3. **Sélectionnez un barbier et un créneau** — « dès que possible » si un barbier est réellement disponible, ou la date de votre choix.
4. **Vérifiez le prix total** : prestations, frais de déplacement et conditions d'annulation sont affichés avant de payer.
5. **Payez en ligne.** Votre moyen de paiement est seulement *autorisé* : vous n'êtes débité qu'une fois la demande acceptée par le barbier.
6. **Suivez votre rendez-vous** : acceptée, barbier en route, prestation commencée, terminée. Vous recevez un reçu et pouvez laisser un avis.

## Si le barbier refuse ou ne répond pas
Aucun montant n'est débité : l'autorisation est libérée automatiquement et nous vous proposons un autre barbier ou le prochain créneau possible.
` },
{ slug: "a-propos", title: "À propos", body: `
GoBarber.ch met en relation des clients avec des barbiers indépendants qui se déplacent à domicile.

${TODO} — présentation de l'entreprise, de l'équipe et de la mission (à rédiger par l'exploitant). Aucune information n'est inventée ici.
` },
{ slug: "faq", title: "Questions fréquentes", body: `
## Quand suis-je débité ?
Votre moyen de paiement est autorisé à l'envoi de la demande. Le montant est encaissé lorsque le barbier accepte. S'il refuse ou ne répond pas, l'autorisation est libérée.

## Puis-je annuler ?
Oui. Gratuitement tant que le barbier n'a pas accepté, puis selon la [politique d'annulation](/legal/annulation) (gratuit jusqu'à 24 h avant, frais ensuite).

## Mes données de carte sont-elles stockées chez GoBarber.ch ?
Non. Les paiements sont traités par un prestataire de paiement certifié ; nous ne voyons ni ne stockons jamais votre numéro de carte.

## Mon adresse est-elle visible de tous ?
Non. Le barbier ne voit votre adresse complète qu'une fois le rendez-vous accepté, et uniquement pour ce rendez-vous.

## Comment devenir barbier partenaire ?
Rendez-vous sur [Devenir partenaire](/devenir-partenaire). Chaque candidature est vérifiée avant activation.

## Comment supprimer mon compte ou obtenir mes données ?
Depuis « Mon compte » → « Confidentialité » : export de vos données et suppression du compte.
` },
{ slug: "devenir-partenaire", title: "Devenir partenaire barbier", body: `
## Développez votre clientèle, restez indépendant
- Vous fixez vos **prestations, prix, horaires et zones** de déplacement.
- Vous acceptez ou refusez chaque demande, dans un délai défini.
- Vous êtes payé via notre prestataire de paiement, après chaque prestation, déduction faite de la commission de la plateforme (${TODO} — taux affiché avant votre inscription).

## Ce qu'il faut pour candidater
- Une pièce d'identité et, selon votre situation, les justificatifs d'activité indépendante et d'autorisation de travail applicables en Suisse ${TODO}.
- Une assurance responsabilité civile professionnelle ${TODO}.
- L'acceptation du contrat partenaire et des règles de la plateforme.

Votre profil est vérifié et validé par notre équipe avant d'apparaître aux clients.
` },
{ slug: "contact", title: "Contact et assistance", body: `Pour toute question sur une réservation, un remboursement ou un litige, utilisez le formulaire ci-dessous. Indiquez le numéro de réservation (GB-AAAA-NNNNNN) pour une réponse plus rapide.` },
{ slug: "conditions-generales", title: "Conditions générales (clients) — PROJET", body: `
> **Projet à faire valider par un juriste avant publication.** Les champs ${TODO} sont à compléter.

## 1. Éditeur et rôle de GoBarber.ch
GoBarber.ch est exploité par ${TODO} (raison sociale, forme juridique, siège, numéro IDE/CHE, TVA). GoBarber.ch est une **plateforme de mise en relation** : le contrat de prestation de coiffure est conclu directement entre le client et le barbier indépendant ; GoBarber.ch agit pour l'encaissement et l'administration de la réservation. ${TODO} : vérifier la qualification juridique exacte (intermédiaire, mandataire pour l'encaissement) et ses conséquences (TVA, responsabilité).

## 2. Compte
Le client doit être majeur (les coupes enfant sont réservées par un titulaire adulte présent). Les informations fournies doivent être exactes. Le client est responsable de la confidentialité de son mot de passe.

## 3. Réservation et prix
Le prix total (prestations, frais de déplacement, remise éventuelle), en CHF ${TODO}(TTC/HT selon statut), est affiché avant le paiement. La réservation est ferme dès l'acceptation par le barbier.

## 4. Paiement
Le moyen de paiement est autorisé à l'envoi de la demande et débité à l'acceptation. Le paiement est traité par ${TODO} (prestataire de paiement) ; GoBarber.ch ne stocke aucun numéro de carte. Moyens proposés selon disponibilité : cartes, Apple Pay, Google Pay, TWINT.

## 5. Annulation, retard, absence
Voir la [politique d'annulation](/legal/annulation).

## 6. Obligations du client
Disposer à l'adresse indiquée d'un lieu adapté (point d'eau, prise, espace suffisant), être présent, se comporter de manière respectueuse. Le barbier peut interrompre la prestation en cas de comportement inapproprié ou de danger ; le montant reste alors dû.

## 7. Responsabilité
Le barbier est responsable de l'exécution de sa prestation et dispose d'une assurance responsabilité civile professionnelle ${TODO}. La responsabilité de GoBarber.ch est limitée, dans la mesure permise par la loi, à ses propres manquements (sans exclure la responsabilité pour dol ou négligence grave). ${TODO}

## 8. Avis et messages
Les avis proviennent uniquement de rendez-vous réalisés. Les contenus illicites ou injurieux peuvent être modérés. La messagerie est réservée à l'organisation du rendez-vous.

## 9. Réclamations et litiges
Écrivez à l'assistance ${TODO} (e-mail). Droit suisse applicable ; for ${TODO}. Les droits impératifs des consommateurs demeurent réservés.

## 10. Données personnelles
Voir la [politique de confidentialité](/legal/confidentialite).

## 11. Modification des conditions
GoBarber.ch peut modifier ces conditions ; les réservations en cours restent soumises aux conditions applicables à leur conclusion.

*Version projet — ${TODO} date d'entrée en vigueur.*
` },
{ slug: "contrat-partenaire", title: "Contrat et conditions des partenaires barbiers — PROJET", body: `
> **Projet à faire valider par un juriste.** Point critique : le **statut d'indépendant** du barbier (risque de requalification en salarié — AVS/LPP/LAA, loi sur le service de l'emploi). ${TODO}

## 1. Objet
GoBarber.ch fournit au partenaire un accès à sa plateforme de réservation et d'encaissement. Le partenaire exerce son activité **en son nom, à ses risques**, comme indépendant. Aucun lien de subordination : le partenaire fixe ses horaires, ses prix et ses zones, et peut refuser une demande.

## 2. Conditions d'admission
Identité vérifiée ; statut d'indépendant et affiliation aux assurances sociales ; autorisation de travail pour les ressortissants étrangers ; assurance responsabilité civile professionnelle ; hygiène et sécurité du matériel. Documents exigés : ${TODO}. L'activation est soumise à la validation de l'administrateur.

## 3. Tarifs, commission, versements
Le partenaire fixe le prix de ses prestations. GoBarber.ch prélève une commission de ${TODO} % sur les prestations (hors frais de déplacement, entièrement reversés au partenaire), les frais du prestataire de paiement étant ${TODO}. Versement ${TODO} heures après la fin de la prestation sur le compte renseigné chez le prestataire de paiement. Le partenaire est seul responsable de ses impôts, cotisations sociales et de la TVA éventuelle.

## 4. Réponse aux demandes
Délai de réponse défini sur la plateforme (demande immédiate : 15 min par défaut ; réservation planifiée : 12 h). Les non-réponses répétées et les annulations tardives peuvent entraîner une suspension.

## 5. Annulations, retards, absences
Une annulation par le partenaire après acceptation entraîne le remboursement intégral du client et peut donner lieu à des mesures (avertissement, suspension). Le partenaire signale l'absence du client après l'arrivée sur place.

## 6. Qualité, comportement, sécurité
Respect des clients, ponctualité, hygiène, interdiction de détourner les clients vers un paiement hors plateforme, confidentialité de l'adresse et des données clients (usage limité au rendez-vous).

## 7. Assurances
Assurance RC professionnelle obligatoire : ${TODO}. Accident et maladie : à la charge du partenaire.

## 8. Suspension et résiliation
Par l'une ou l'autre partie avec préavis de ${TODO} ; suspension immédiate en cas de manquement grave. Les versements dus pour les prestations réalisées restent acquis.

## 9. Données personnelles
GoBarber.ch et le partenaire sont chacun responsables de leurs traitements ; le partenaire n'utilise les données client que pour exécuter le rendez-vous.

## 10. Droit applicable et for
Droit suisse ; for ${TODO}.
` },
{ slug: "confidentialite", title: "Politique de confidentialité — PROJET", body: `
> **Projet à faire valider** (LPD suisse révisée du 1er sept. 2023 ; RGPD si applicable). ${TODO}

## Responsable du traitement
${TODO} (raison sociale, adresse, contact protection des données).

## Données collectées (minimum nécessaire)
- **Compte** : nom, prénom, e-mail, téléphone (facultatif), mot de passe (stocké haché, jamais en clair).
- **Adresses** : adresse d'intervention ; l'adresse complète n'est communiquée au barbier qu'à l'acceptation du rendez-vous.
- **Réservations et messages** liés au rendez-vous.
- **Paiement** : traité par ${TODO} ; nous ne conservons que des références (jamais le numéro de carte).
- **Barbiers partenaires** : identité, justificatifs, informations d'activité.
- **Localisation** : uniquement si vous l'activez (facultatif) ; la saisie manuelle de l'adresse reste toujours possible.
- **Journaux techniques** de sécurité (adresse IP, horodatage), sans contenu sensible.

## Finalités et bases légales
Exécution du contrat (réservation, paiement, support) ; obligations légales (comptabilité) ; intérêt légitime (sécurité, prévention de la fraude) ; consentement (notifications marketing, géolocalisation).

## Destinataires
Barbier concerné (limité au rendez-vous), prestataire de paiement, hébergeur, service d'e-mail ${TODO}. Transferts hors de Suisse/UE : ${TODO}.

## Durées de conservation
Compte : jusqu'à suppression. Pièces comptables : 10 ans (CO art. 958f). Messages : ${TODO} mois après le rendez-vous. Journaux de sécurité : ${TODO} mois.

## Vos droits
Accès, rectification, suppression, portabilité, opposition : depuis « Mon compte → Confidentialité » (export et suppression en libre-service) ou par e-mail à ${TODO}. Réclamation possible auprès du PFPDT (Suisse).

## Sécurité
Chiffrement des connexions, mots de passe hachés, contrôle d'accès par rôle, 2FA pour l'administration, journalisation.
` },
{ slug: "annulation", title: "Annulation, remboursement, retard et absence", body: `
> Valeurs par défaut (modifiables par l'administrateur) — **à valider juridiquement**.

## Annulation par le client
- **Avant acceptation par le barbier** : gratuite, aucun débit.
- **Dans les 5 minutes suivant l'acceptation** : gratuite.
- **Plus de 24 h avant le rendez-vous** : gratuite, remboursement intégral.
- **Entre 24 h et 2 h avant** : 50 % du montant retenu.
- **Moins de 2 h avant, ou barbier déjà en route** : montant dû.

## Annulation, refus ou absence du barbier
Remboursement **intégral** et immédiat. Les annulations tardives répétées peuvent entraîner la suspension du barbier.

## Pas de réponse du barbier
La demande expire, aucun montant n'est débité.

## Retard
Le barbier prévient le client via la messagerie. Au-delà de 20 minutes de retard non convenu, le client peut annuler sans frais ou demander un geste commercial à l'assistance.

## Absence du client
Si le client est injoignable ou absent à l'arrivée du barbier (attente de 15 minutes), le montant est dû.

## Litiges et réclamations
Ouvrez une réclamation depuis la réservation dans les 7 jours : l'équipe examine le dossier (messages, statuts, horodatages) et décide d'un remboursement total ou partiel. Les remboursements sont crédités sur le moyen de paiement d'origine (délai bancaire 5–10 jours ouvrables).
` },
{ slug: "mentions-legales", title: "Mentions légales — PROJET", body: `
- **Éditeur** : ${TODO} (raison sociale et forme juridique)
- **Siège** : ${TODO}
- **Numéro IDE / registre du commerce** : ${TODO}
- **TVA** : ${TODO}
- **Représentant légal** : ${TODO}
- **Contact** : ${TODO} (e-mail, téléphone)
- **Hébergeur** : ${TODO}
- **Responsable du contenu** : ${TODO}

Aucune de ces informations n'a été inventée : elles doivent être fournies par l'exploitant.
` },
{ slug: "cookies", title: "Cookies et traceurs", body: `
GoBarber.ch utilise uniquement des **cookies strictement nécessaires** (session de connexion, sécurité). Aucun cookie publicitaire ni de mesure d'audience n'est déposé actuellement ; aucun bandeau de consentement n'est donc nécessaire. Si des outils d'audience ou marketing sont ajoutés (${TODO}), un bandeau de consentement sera mis en place **avant** leur activation.
` },
];
