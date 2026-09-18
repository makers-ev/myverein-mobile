type Translation = {
  de: Record<string, string>;
  en: Record<string, string>;
};

// Real, substantive legal copy -- not Lorem Ipsum -- genericized for any app
// built from this template: `{{appName}}` is filled in at render time from
// app.json's `expo.name` (see LanguageContext.tsx's `t()`). "LPJ
// IT-Solutions" is the placeholder operator/company (matching the name
// already used in Settings' footer and Logo.tsx) -- still a literal string
// here, not interpolated. The Imprint's address/email fields stay
// bracketed TODOs since those are legally required real facts a template
// can't invent -- fill those in before shipping.
const LegalTranslation: Translation = {
  en: {
    'legal.privacy.title': 'Privacy Policy',
    'legal.privacy.placeholder-notice':
      'Real starter content, not Lorem Ipsum -- review against your actual data flows before shipping.',
    'legal.privacy.section1.title': '1. Who is responsible',
    'legal.privacy.section1.text':
      'The entity responsible for processing your data under GDPR ("controller") is named in the Imprint/legal notice. Contact them for any privacy question or request.',
    'legal.privacy.section2.title': '2. What data is processed',
    'legal.privacy.section2.text':
      'Account data: name, email address, and a hashed password (your password is never stored in plain text); optionally a two-factor authentication secret. Content: whatever you create or upload in {{appName}}, scoped to your own account or the areas you\'ve explicitly shared. Technical data: push notification tokens, IP addresses (used only for rate limiting and security logging), and basic usage/audit logs needed to run the service.',
    'legal.privacy.section3.title': '3. Why it is processed',
    'legal.privacy.section3.text':
      "To provide {{appName}}'s core functionality (your account and its content), to keep your account secure (login, two-factor authentication, rate limiting, abuse prevention), and to send you notifications and transactional emails you've opted into (e.g. sign-up verification, security alerts). The operator does not use your data for advertising and does not sell it.",
    'legal.privacy.section4.title': '4. Who else sees it',
    'legal.privacy.section4.text':
      "Your content is only shared with other users if you actively set that up (e.g. sharing or inviting someone). To run the service, the operator may use processors under data processing agreements, such as an email provider for transactional email or a push notification service. Uploaded files are stored on infrastructure the operator runs or commissions.",
    'legal.privacy.section5.title': '5. How long it is kept',
    'legal.privacy.section5.text':
      'Your data is kept for as long as your account exists. Deleting your account permanently removes your account and its associated content. Security and audit logs are kept for a limited period for abuse prevention before being purged.',
    'legal.privacy.section6.title': '6. Your rights',
    'legal.privacy.section6.text':
      "You can request access to, correction of, or export of your data, and you can delete your account at any time from Settings. You also have the right to object to processing and to lodge a complaint with your local data protection authority. To exercise any of these rights, contact the operator at the address in the Imprint.",
    'legal.privacy.section7.title': '7. Data security',
    'legal.privacy.section7.text':
      "The operator applies standard security measures (encrypted connections, hashed passwords, access controls scoped to your account). As with any software, complete security or uninterrupted availability can't be guaranteed -- see the Terms of Service for details. This policy will be updated as needed.",

    'legal.imprint.title': 'Imprint',
    'legal.imprint.placeholder-notice': 'Replace the bracketed fields below with your real provider identification before shipping.',
    'legal.imprint.section1.title': '1. Information pursuant to § 5 TMG',
    'legal.imprint.section1.text': 'LPJ IT-Solutions\n[Street and house number]\n[Postal code and city]',
    'legal.imprint.section2.title': '2. Contact',
    'legal.imprint.section2.text': 'Email: [contact@example.com]',
    'legal.imprint.section3.title': '3. Person responsible for content under § 18(2) MStV',
    'legal.imprint.section3.text': 'LPJ IT-Solutions (address as above).',
    'legal.imprint.section4.title': '4. Note',
    'legal.imprint.section4.text': '{{appName}} is operated by LPJ IT-Solutions.',

    'legal.tos.title': 'Terms of Service',
    'legal.tos.placeholder-notice': 'Real starter content, not Lorem Ipsum -- adapt the bracketed parts to your product before shipping.',
    'legal.tos.section1.title': '1. Scope',
    'legal.tos.section1.text':
      'These terms govern your use of {{appName}} (the "Service"), operated by the provider named in the Imprint. By creating an account you agree to these terms and to the Privacy Policy.',
    'legal.tos.section2.title': '2. What {{appName}} is',
    'legal.tos.section2.text': '{{appName}} is a platform that lets users [describe your core feature here]. These terms apply to all features of the Service.',
    'legal.tos.section3.title': '3. Your account',
    'legal.tos.section3.text':
      "You need an account to use most features. You're responsible for keeping your login credentials confidential and for everything that happens under your account; enable two-factor authentication in Settings if you want extra protection. Tell the operator right away if you suspect unauthorized access.",
    'legal.tos.section4.title': '4. Availability',
    'legal.tos.section4.text':
      'The operator aims to run {{appName}} reliably but makes no guarantee of uninterrupted availability. The Service may be temporarily restricted, changed, or discontinued at any time, e.g. for maintenance. [Adapt this section if your product has a beta phase or specific availability commitments.]',
    'legal.tos.section5.title': '5. Your content',
    'legal.tos.section5.text':
      "You keep ownership of everything you create in {{appName}}. You're responsible for making sure your content doesn't violate the law or anyone else's rights.",
    'legal.tos.section6.title': '6. Prohibited uses',
    'legal.tos.section6.text':
      "You may not decompile, reverse-engineer, disassemble, or otherwise attempt to obtain the app's source code, and you may not circumvent, disable, or tamper with any security or protection mechanism of the Service. Distributing or publishing source code obtained this way, or any work derived from it, is likewise prohibited. Violations may result in immediate account suspension and legal action.",
    'legal.tos.section7.title': '7. Ending your account',
    'legal.tos.section7.text':
      'You can delete your account at any time in Settings, which removes your access immediately. The operator may suspend or terminate accounts that violate these terms, are used abusively, or pose a security risk to the Service or other users.',
    'legal.tos.section8.title': '8. Liability',
    'legal.tos.section8.text':
      'The Service is provided "as is". To the extent permitted by law, the operator is not liable for indirect damages or lost data, except in cases of intent or gross negligence. The operator may update these terms as the Service changes; continued use after an update means you accept the revised terms.',

    'tos_modal.checkbox': 'I have read and agree to the Terms of Service.',
    'tos_modal.accept': 'Accept',

    'settings.section-legal': 'Legal',
    'settings.legal.privacy': 'Privacy Policy',
    'settings.legal.tos': 'Terms of Service',
    'settings.legal.imprint': 'Imprint',
    'settings.legal.contact': 'Contact',
    'settings.replay-intro': 'Show introduction again',

    'intro-modal.title': 'Welcome!',
    'intro-modal.intro': "This template ships with a few things already wired up. Here's a quick look:",
    'intro-modal.step1.title': 'Create your account',
    'intro-modal.step1.text': 'Sign up or log in from Home -- email/password auth and optional two-factor authentication are already built in.',
    'intro-modal.step2.title': 'Your account is protected',
    'intro-modal.step2.text': 'Sessions, password resets, and account deletion are handled for you -- see Settings > Security.',
    'intro-modal.step3.title': 'Explore Settings',
    'intro-modal.step3.text': 'Language, theme, App Lock, and the legal pages (Privacy Policy, Terms of Service, Imprint) all live there -- start from that section when you build your own features.',
    'intro-modal.button': "Let's go",

    'settings.section-appearance': 'Appearance',
    'settings.dark-mode': 'Dark mode',

    'settings.app-version': 'App version',

    'nav.home': 'Home',
    'nav.settings': 'Settings',
  },
  de: {
    'legal.privacy.title': 'Datenschutzerklärung',
    'legal.privacy.placeholder-notice':
      'Echter Startinhalt, kein Lorem Ipsum -- prüfe den Text gegen eure tatsächlichen Datenflüsse, bevor ihr live geht.',
    'legal.privacy.section1.title': '1. Verantwortlicher',
    'legal.privacy.section1.text':
      'Die für die Datenverarbeitung nach DSGVO verantwortliche Stelle ist im Impressum genannt. Wende dich für Datenschutzanliegen dorthin.',
    'legal.privacy.section2.title': '2. Welche Daten verarbeitet werden',
    'legal.privacy.section2.text':
      'Kontodaten: Name, E-Mail-Adresse und ein gehashtes Passwort (dein Passwort wird nie im Klartext gespeichert), optional ein Geheimnis für die Zwei-Faktor-Authentifizierung. Inhalte: alles, was du in {{appName}} anlegst oder hochlädst, jeweils nur innerhalb deines eigenen Kontos bzw. der von dir aktiv freigegebenen Bereiche. Technische Daten: Push-Tokens, IP-Adressen (nur für Rate-Limiting und Sicherheitsprotokolle) sowie einfache Nutzungs-/Audit-Logs, die für den Betrieb des Dienstes nötig sind.',
    'legal.privacy.section3.title': '3. Wofür sie verarbeitet werden',
    'legal.privacy.section3.text':
      'Um die Kernfunktionen von {{appName}} bereitzustellen (dein Konto und dessen Inhalte), um dein Konto abzusichern (Login, Zwei-Faktor-Authentifizierung, Rate-Limiting, Missbrauchsschutz) und um dir Benachrichtigungen und transaktionale E-Mails zu senden, denen du zugestimmt hast (z. B. Registrierungsbestätigung, Sicherheitshinweise). Der Betreiber nutzt deine Daten nicht für Werbung und verkauft sie nicht.',
    'legal.privacy.section4.title': '4. Wer sonst Zugriff hat',
    'legal.privacy.section4.text':
      'Deine Inhalte werden nur dann mit anderen Nutzer:innen geteilt, wenn du das aktiv einrichtest (z. B. durch Freigabe oder Einladung). Zum Betrieb des Dienstes können Auftragsverarbeiter im Rahmen von AV-Verträgen eingesetzt werden, etwa ein E-Mail-Dienstleister für transaktionale E-Mails oder ein Push-Dienst für Benachrichtigungen. Hochgeladene Dateien werden auf vom Betreiber selbst betriebener oder beauftragter Infrastruktur gespeichert.',
    'legal.privacy.section5.title': '5. Speicherdauer',
    'legal.privacy.section5.text':
      'Deine Daten werden gespeichert, solange dein Konto besteht. Löschst du dein Konto, werden dein Konto und die zugehörigen Inhalte dauerhaft entfernt. Sicherheits- und Audit-Logs werden zum Missbrauchsschutz für einen begrenzten Zeitraum aufbewahrt und danach gelöscht.',
    'legal.privacy.section6.title': '6. Deine Rechte',
    'legal.privacy.section6.text':
      'Du kannst Auskunft über, Berichtigung oder Export deiner Daten verlangen und dein Konto jederzeit in den Einstellungen löschen. Außerdem hast du ein Widerspruchsrecht gegen die Verarbeitung und kannst dich bei deiner zuständigen Datenschutzaufsichtsbehörde beschweren. Für all diese Anliegen erreichst du den Betreiber über die im Impressum genannte Adresse.',
    'legal.privacy.section7.title': '7. Datensicherheit',
    'legal.privacy.section7.text':
      'Der Betreiber setzt übliche Sicherheitsmaßnahmen ein (verschlüsselte Verbindungen, gehashte Passwörter, auf dein Konto beschränkte Zugriffsrechte). Wie bei jeder Software kann dennoch keine vollständige Sicherheit oder unterbrechungsfreie Verfügbarkeit garantiert werden -- Details dazu in den Nutzungsbedingungen. Diese Erklärung wird bei Bedarf aktualisiert.',

    'legal.imprint.title': 'Impressum',
    'legal.imprint.placeholder-notice': 'Ersetze die eckigen Klammern unten durch eure echten Anbieterangaben, bevor ihr live geht.',
    'legal.imprint.section1.title': '1. Angaben gemäß § 5 TMG',
    'legal.imprint.section1.text': 'LPJ IT-Solutions\n[Straße und Hausnummer]\n[PLZ und Ort]',
    'legal.imprint.section2.title': '2. Kontakt',
    'legal.imprint.section2.text': 'E-Mail: [kontakt@beispiel.de]',
    'legal.imprint.section3.title': '3. Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV',
    'legal.imprint.section3.text': 'LPJ IT-Solutions (Anschrift wie oben).',
    'legal.imprint.section4.title': '4. Hinweis',
    'legal.imprint.section4.text': '{{appName}} wird betrieben von LPJ IT-Solutions.',

    'legal.tos.title': 'Nutzungsbedingungen',
    'legal.tos.placeholder-notice': 'Echter Startinhalt, kein Lorem Ipsum -- passe die eckigen Klammern an euer Produkt an, bevor ihr live geht.',
    'legal.tos.section1.title': '1. Geltungsbereich',
    'legal.tos.section1.text':
      'Diese Bedingungen regeln die Nutzung von {{appName}} (der "Dienst"), betrieben vom im Impressum genannten Anbieter. Mit der Erstellung eines Kontos stimmst du diesen Bedingungen sowie der Datenschutzerklärung zu.',
    'legal.tos.section2.title': '2. Was {{appName}} ist',
    'legal.tos.section2.text': '{{appName}} ist eine Plattform, die es Nutzer:innen ermöglicht, [Kernfunktion hier ergänzen]. Diese Bedingungen gelten für alle Funktionen des Dienstes.',
    'legal.tos.section3.title': '3. Dein Konto',
    'legal.tos.section3.text':
      'Für die meisten Funktionen brauchst du ein Konto. Du bist für die Vertraulichkeit deiner Zugangsdaten und für alles verantwortlich, was unter deinem Konto passiert; aktiviere bei Bedarf die Zwei-Faktor-Authentifizierung in den Einstellungen. Melde dich sofort beim Betreiber, wenn du einen unbefugten Zugriff vermutest.',
    'legal.tos.section4.title': '4. Verfügbarkeit',
    'legal.tos.section4.text':
      'Der Betreiber bemüht sich um einen zuverlässigen Betrieb von {{appName}}, übernimmt aber keine Garantie für ununterbrochene Verfügbarkeit. Der Dienst kann jederzeit vorübergehend eingeschränkt, geändert oder eingestellt werden, etwa für Wartungsarbeiten. [Passe diesen Abschnitt an, falls euer Produkt eine Beta-Phase oder besondere Verfügbarkeitszusagen hat.]',
    'legal.tos.section5.title': '5. Deine Inhalte',
    'legal.tos.section5.text':
      'Du behältst die Rechte an allem, was du in {{appName}} anlegst. Du bist dafür verantwortlich, dass deine Inhalte keine Gesetze oder Rechte Dritter verletzen.',
    'legal.tos.section6.title': '6. Verbotene Nutzung',
    'legal.tos.section6.text':
      'Es ist nicht gestattet, die App zu dekompilieren, zurückzuentwickeln (Reverse Engineering), zu disassemblieren oder auf andere Weise zu versuchen, an ihren Quellcode zu gelangen, sowie Sicherheits- oder Schutzmechanismen des Dienstes zu umgehen, zu deaktivieren oder zu manipulieren. Ebenso untersagt ist die Weitergabe, Veröffentlichung oder Verbreitung von auf diese Weise erlangtem Quellcode oder daraus abgeleiteten Werken. Verstöße können zur sofortigen Sperrung des Kontos und zu rechtlichen Schritten führen.',
    'legal.tos.section7.title': '7. Beendigung',
    'legal.tos.section7.text':
      'Du kannst dein Konto jederzeit in den Einstellungen löschen, dein Zugriff endet dann sofort. Der Betreiber kann Konten sperren oder beenden, die gegen diese Bedingungen verstoßen, missbräuchlich genutzt werden oder ein Sicherheitsrisiko für den Dienst oder andere Nutzer:innen darstellen.',
    'legal.tos.section8.title': '8. Haftung',
    'legal.tos.section8.text':
      'Der Dienst wird "wie besehen" bereitgestellt. Soweit gesetzlich zulässig, haftet der Betreiber nicht für mittelbare Schäden oder Datenverlust, außer bei Vorsatz oder grober Fahrlässigkeit. Der Betreiber kann diese Bedingungen bei Weiterentwicklung des Dienstes anpassen; die fortgesetzte Nutzung nach einer Aktualisierung gilt als Zustimmung zu den geänderten Bedingungen.',

    'tos_modal.checkbox': 'Ich habe die Nutzungsbedingungen gelesen und stimme zu.',
    'tos_modal.accept': 'Akzeptieren',

    'settings.section-legal': 'Rechtliches',
    'settings.legal.privacy': 'Datenschutzerklärung',
    'settings.legal.tos': 'Nutzungsbedingungen',
    'settings.legal.imprint': 'Impressum',
    'settings.legal.contact': 'Kontakt',
    'settings.replay-intro': 'Einführung erneut anzeigen',

    'intro-modal.title': 'Willkommen!',
    'intro-modal.intro': 'Dieses Template bringt einiges bereits fertig eingerichtet mit. Ein kurzer Überblick:',
    'intro-modal.step1.title': 'Konto erstellen',
    'intro-modal.step1.text': 'Registriere dich oder logge dich von der Startseite aus ein -- E-Mail/Passwort-Login und optionale Zwei-Faktor-Authentifizierung sind bereits eingebaut.',
    'intro-modal.step2.title': 'Dein Konto ist geschützt',
    'intro-modal.step2.text': 'Sessions, Passwort-Reset und Konto-Löschung sind bereits fertig -- siehe Einstellungen > Sicherheit.',
    'intro-modal.step3.title': 'Einstellungen erkunden',
    'intro-modal.step3.text': 'Sprache, Theme, App-Sperre und die Rechtstexte (Datenschutzerklärung, Nutzungsbedingungen, Impressum) findest du dort -- ein guter Startpunkt, bevor du eigene Funktionen baust.',
    'intro-modal.button': "Los geht's",

    'settings.section-appearance': 'Erscheinungsbild',
    'settings.dark-mode': 'Dunkelmodus',

    'settings.app-version': 'App-Version',

    'nav.home': 'Start',
    'nav.settings': 'Einstellungen',
  },
};

export default LegalTranslation;
