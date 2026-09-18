# Graph Report - .  (2026-09-13)

## Corpus Check
- 30 files · ~0 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 633 nodes · 917 edges · 73 communities (37 shown, 36 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 26 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Auth Provider & Navigation Core|Auth Provider & Navigation Core]]
- [[_COMMUNITY_Auth Actions, Guest Mode & Settings|Auth Actions, Guest Mode & Settings]]
- [[_COMMUNITY_i18n Translation Modules|i18n Translation Modules]]
- [[_COMMUNITY_Palette Theming & Notifications|Palette Theming & Notifications]]
- [[_COMMUNITY_Legal Screens & App Config|Legal Screens & App Config]]
- [[_COMMUNITY_Palette Derivation & Storage|Palette Derivation & Storage]]
- [[_COMMUNITY_Package Dependencies (runtime)|Package Dependencies (runtime)]]
- [[_COMMUNITY_app.json  Expo Config|app.json / Expo Config]]
- [[_COMMUNITY_README Feature Docs|README Feature Docs]]
- [[_COMMUNITY_App Lock, Onboarding & Auth Screens|App Lock, Onboarding & Auth Screens]]
- [[_COMMUNITY_Notification Hooks & PIN Modals|Notification Hooks & PIN Modals]]
- [[_COMMUNITY_App Lock Storage & Settings Storage|App Lock Storage & Settings Storage]]
- [[_COMMUNITY_App Root, Error Boundary & Theme Storage|App Root, Error Boundary & Theme Storage]]
- [[_COMMUNITY_Home Screen, Logo & ToS Acceptance|Home Screen, Logo & ToS Acceptance]]
- [[_COMMUNITY_Package Dependencies (dev)|Package Dependencies (dev)]]
- [[_COMMUNITY_Signup Screen & Keyboard-Aware Layout|Signup Screen & Keyboard-Aware Layout]]
- [[_COMMUNITY_AuthGuest Cross-Repo Bridge|Auth/Guest Cross-Repo Bridge]]
- [[_COMMUNITY_ADR008 Palette Decision & Components|ADR008 Palette Decision & Components]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Subagent Orchestration Docs|Subagent Orchestration Docs]]
- [[_COMMUNITY_Storage Navbar Titles, Language, Theme|Storage: Navbar Titles, Language, Theme]]
- [[_COMMUNITY_Lockout, App-Lock & Two-Factor Screens|Lockout, App-Lock & Two-Factor Screens]]
- [[_COMMUNITY_package.json Manifest|package.json Manifest]]
- [[_COMMUNITY_npm Scripts|npm Scripts]]
- [[_COMMUNITY_Connection Error Screen & URL Scheme|Connection Error Screen & URL Scheme]]
- [[_COMMUNITY_MetroBabel Build Config|Metro/Babel Build Config]]
- [[_COMMUNITY_Supported Languages & Detection|Supported Languages & Detection]]
- [[_COMMUNITY_ReanimatedKeyboard Controller Config|Reanimated/Keyboard Controller Config]]
- [[_COMMUNITY_KeyboardAwareScrollView Choice|KeyboardAwareScrollView Choice]]
- [[_COMMUNITY_Confirmation Modal|Confirmation Modal]]
- [[_COMMUNITY_Settings Dropdown Option|Settings Dropdown Option]]
- [[_COMMUNITY_App Navigator Stacks|App Navigator Stacks]]
- [[_COMMUNITY_Translation Modules (loginsettings)|Translation Modules (login/settings)]]
- [[_COMMUNITY_Keyboard Controller Rationale|Keyboard Controller Rationale]]
- [[_COMMUNITY_Dark Mode & NativeWind Rationale|Dark Mode & NativeWind Rationale]]
- [[_COMMUNITY_Theme Colors & Tailwind Docs|Theme Colors & Tailwind Docs]]
- [[_COMMUNITY_Template Suite Cross-Links|Template Suite Cross-Links]]
- [[_COMMUNITY_Website Bridge (globalstailwind)|Website Bridge (globals/tailwind)]]
- [[_COMMUNITY_ConfirmationInfo Modal Components|Confirmation/Info Modal Components]]
- [[_COMMUNITY_Email Verification Flow|Email Verification Flow]]
- [[_COMMUNITY_Backend User-Create Hook|Backend User-Create Hook]]
- [[_COMMUNITY_CI Mobile Job|CI Mobile Job]]
- [[_COMMUNITY_Logo Cross-Repo Bridge|Logo Cross-Repo Bridge]]
- [[_COMMUNITY_NavbarNavigationRef Docs|Navbar/NavigationRef Docs]]
- [[_COMMUNITY_Signup Flow|Signup Flow]]
- [[_COMMUNITY_App Icon Assets|App Icon Assets]]
- [[_COMMUNITY_ESLint Config|ESLint Config]]
- [[_COMMUNITY_Polling Notifications ADR|Polling Notifications ADR]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]

## God Nodes (most connected - your core abstractions)
1. `useLanguage()` - 44 edges
2. `useThemeColors()` - 38 edges
3. `useAuth()` - 19 edges
4. `expo` - 14 edges
5. `LanguageContext Provider` - 14 edges
6. `Language` - 12 edges
7. `scripts` - 9 edges
8. `LegalTranslation Module` - 9 edges
9. `SettingsScreen component` - 9 edges
10. `README architecture overview` - 9 edges

## Surprising Connections (you probably didn't know these)
- `HomeScreen` --references--> `README architecture overview`  [EXTRACTED]
  src/screens/HomeScreen.tsx → README.md
- `LoginScreen component` --references--> `README architecture overview`  [EXTRACTED]
  src/screens/LoginScreen.tsx → README.md
- `Navbar component` --references--> `README architecture overview`  [EXTRACTED]
  src/components/Navbar.tsx → README.md
- `RequireAuth` --references--> `CLAUDE.md guest mode conventions`  [EXTRACTED]
  src/auth/RequireAuth.tsx → CLAUDE.md
- `useRequireAuth` --references--> `CLAUDE.md guest mode conventions`  [EXTRACTED]
  src/hooks/useRequireAuth.ts → CLAUDE.md

## Hyperedges (group relationships)
- **ADR-009 First-Pass AI Translation Pattern** — adr009_decision, componenttranslation_module, generaltranslation_module, loginsignuptranslation_module, modaltranslation_module, notificationtranslation_module, pagelayouttranslation_module, settingstranslation_module [EXTRACTED 1.00]
- **Translation Module Aggregation into LanguageContext** — languagecontext_provider, componenttranslation_module, generaltranslation_module, loginsignuptranslation_module, modaltranslation_module, notificationtranslation_module, pagelayouttranslation_module, settingstranslation_module, legaltranslation_module [EXTRACTED 1.00]
- **App Lock Feature Translation Cluster** — modaltranslation_module, settingstranslation_module, componenttranslation_module [INFERRED 0.85]
- **Palette theming system** — PaletteProvider_component, palettes_registry, deriveTokens_deriveTokens, paletteStorage_module, colors_useThemeColors [EXTRACTED 0.90]
- **Notification fetch/display/mutate flow** — useNotifications_useNotifications, useNotifications_useNotificationMutations, NotificationsScreen_screen, NotificationsScreen_useNotificationText [EXTRACTED 0.90]
- **Language detection and selection flow** — supportedLanguages_registry, systemLanguage_detectSystemLanguage, SettingsScreen_screen [INFERRED 0.75]

## Communities (73 total, 36 thin omitted)

### Community 0 - "Auth Provider & Navigation Core"
Cohesion: 0.06
Nodes (33): AuthClient, checkBackendHealth(), AuthContext, AuthContextType, AuthProvider(), AuthResult, EnableTwoFactorResult, ListSessionsResult (+25 more)

### Community 1 - "Auth Actions, Guest Mode & Settings"
Cohesion: 0.06
Nodes (48): apiFetch() wrapper, AppLockGate, AppLockScreen, AppNavigator component, authClient (Better Auth client instance), backendUrl, AuthProvider component, AuthProvider.cancelTwoFactor (+40 more)

### Community 2 - "i18n Translation Modules"
Cohesion: 0.07
Nodes (31): ComponentTranslation, Translation, GeneralTranslation, Translation, defaultLanguage, Language, LanguageContext, LanguageContextType (+23 more)

### Community 3 - "Palette Theming & Notifications"
Cohesion: 0.06
Nodes (36): ADR-008: palette derivation, no WCAG enforcement, ADR-009: single language registry, RTL out of scope, AcceptTosModal, IntroModal, LegalDocumentLayout, NotificationCard, NotificationsScreen, useNotificationText() (+28 more)

### Community 4 - "Legal Screens & App Config"
Cohesion: 0.09
Nodes (35): AcceptTosModal, ADR-009: First-Pass AI Translation, ADR-010: app.json as Canonical Identity File, ADR-010 (app.json as canonical identity file), app.json (Expo Config), app.json Expo Config, app.json expo.name / expo.extra (appName, defaultLanguage), admin-notification-templates.ts (backend) (+27 more)

### Community 5 - "Palette Derivation & Storage"
Cohesion: 0.12
Nodes (24): AnchorKey, Mode, PaletteCustomEditorProps, deriveTokens(), foregroundFor(), hexToRgb(), hexToRgbTriplet(), luminance() (+16 more)

### Community 6 - "Package Dependencies (runtime)"
Cohesion: 0.07
Nodes (30): dependencies, better-auth, @better-auth/expo, expo, expo-constants, expo-linking, expo-localization, expo-navigation-bar (+22 more)

### Community 7 - "app.json / Expo Config"
Cohesion: 0.07
Nodes (27): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, package, predictiveBackGestureEnabled, expo (+19 more)

### Community 8 - "README Feature Docs"
Cohesion: 0.09
Nodes (27): Guest mode gating rationale (CLAUDE.md), useNotifications / useNotificationMutations hooks, Navbar, NotificationsScreen, apiFetch<T>, AppLockGate, AppNavigator, authClient (Better Auth Expo client) (+19 more)

### Community 9 - "App Lock, Onboarding & Auth Screens"
Cohesion: 0.11
Nodes (20): AppLockGate(), AppLockGateProps, IntroModal(), IntroModalProps, STEPS, EmailVerificationScreen(), EmailVerificationScreenProps, ForgotPasswordScreen() (+12 more)

### Community 10 - "Notification Hooks & PIN Modals"
Cohesion: 0.14
Nodes (15): useNotificationMutations(), useNotifications(), LegalDocumentLayout(), ConfirmationInputModal(), ConfirmationModalProps, SetupPinModal(), SetupPinModalProps, VerifyPinModal() (+7 more)

### Community 11 - "App Lock Storage & Settings Storage"
Cohesion: 0.16
Nodes (11): clearAppLockPin(), getAppLockPin(), setAppLockPin(), InfoModalProps, SettingsScreen(), SettingsScreenProps, getShowNavbarTitles(), getShowTopbarTitles() (+3 more)

### Community 12 - "App Root, Error Boundary & Theme Storage"
Cohesion: 0.13
Nodes (9): App Root Component, Navbar (floating bottom pill), ErrorBoundary, ErrorBoundaryProps, ErrorBoundaryState, mycollection-app PageLayout Navbar, PaletteProvider(), getStoredTheme() (+1 more)

### Community 13 - "Home Screen, Logo & ToS Acceptance"
Cohesion: 0.16
Nodes (10): LogoProps, AcceptTosModal(), AcceptTosModalProps, hasAcceptedTos(), setTosAccepted(), hasSeenIntro(), setIntroSeen(), FEATURE_CARDS (+2 more)

### Community 14 - "Package Dependencies (dev)"
Cohesion: 0.15
Nodes (13): devDependencies, babel-preset-expo, eslint, eslint-config-expo, jest, jest-expo, @react-native/jest-preset, tailwindcss (+5 more)

### Community 15 - "Signup Screen & Keyboard-Aware Layout"
Cohesion: 0.17
Nodes (9): KeyboardAwareScreenProps, IconCalendar, IconLock, IconMail, IconMapPin, IconPhone, SignupFormData, SignupScreen() (+1 more)

### Community 16 - "Auth/Guest Cross-Repo Bridge"
Cohesion: 0.22
Nodes (11): AppLockGate, AuthProvider / useAuth, AuthProvider Test Suite, RequireAuth Screen Gate, App Lock PIN Storage (SecureStore), Better Auth Client Instance, auth-backend-template twoFactor() plugin, Guest Mode Pattern (CLAUDE.md) (+3 more)

### Community 17 - "ADR008 Palette Decision & Components"
Cohesion: 0.20
Nodes (10): ADR-008: Runtime Palette CSS Vars, AppNavigator Component, App.tsx Root Component, ErrorBoundary, KeyboardAwareScreen Component, Navbar Component, PaletteCustomEditor Component, PaletteProvider Component (+2 more)

### Community 18 - "TypeScript Config"
Cohesion: 0.22
Nodes (9): compilerOptions, baseUrl, ignoreDeprecations, paths, strict, types, extends, @/* (+1 more)

### Community 19 - "Subagent Orchestration Docs"
Cohesion: 0.22
Nodes (9): graphify, Graphify usage convention (query before search, --update after changes), Repo Orchestration Workflow, rn-reviewer subagent, rn-state-nav-dev subagent, rn-ui-dev subagent, rn-reviewer subagent, rn-state-nav-dev subagent (+1 more)

### Community 20 - "Storage: Navbar Titles, Language, Theme"
Cohesion: 0.25
Nodes (9): getShowNavbarTitles/setShowNavbarTitles, getShowTopbarTitles/setShowTopbarTitles, LanguageProvider component, getStoredLanguage, setStoredLanguage, Decision: manual dark-mode toggle via NativeWind colorScheme API, README: State and storage table, getStoredTheme (+1 more)

### Community 21 - "Lockout, App-Lock & Two-Factor Screens"
Cohesion: 0.36
Nodes (5): useAttemptLockout(), AppLockScreen(), AppLockScreenProps, TwoFactorScreen(), TwoFactorScreenProps

### Community 22 - "package.json Manifest"
Cohesion: 0.39
Nodes (6): jest, preset, main, name, private, version

### Community 23 - "npm Scripts"
Cohesion: 0.25
Nodes (8): scripts, android, ios, lint, start, test, typecheck, web

### Community 24 - "Connection Error Screen & URL Scheme"
Cohesion: 0.38
Nodes (4): ConnectionErrorScreen(), ConnectionErrorScreenProps, ConnectionStatus, withScheme()

### Community 25 - "Metro/Babel Build Config"
Cohesion: 0.40
Nodes (3): config, { getDefaultConfig }, { withNativeWind }

### Community 26 - "Supported Languages & Detection"
Cohesion: 0.40
Nodes (4): Language type, detectSystemLanguage test suite, detectSystemLanguage(), website acceptLanguage.ts (external)

### Community 27 - "Reanimated/Keyboard Controller Config"
Cohesion: 0.67
Nodes (4): babel-preset-expo reanimated/worklets auto-detection (re-enabled), Rationale: removal of dead react-native-worklets pin, react-native-keyboard-controller dependency, react-native-reanimated dependency

### Community 28 - "KeyboardAwareScrollView Choice"
Cohesion: 0.67
Nodes (4): App (root component), KeyboardAwareScreen, KeyboardAwareScrollView (react-native-keyboard-controller), Rationale: KeyboardAwareScrollView over hand-rolled KeyboardAvoidingView

### Community 30 - "Settings Dropdown Option"
Cohesion: 0.50
Nodes (3): DropdownOption, SettingsDropdownOption(), SettingsDropdownOptionProps

### Community 31 - "App Navigator Stacks"
Cohesion: 0.50
Nodes (4): MainNavigator component, MainNavigator, TwoFactorNavigator, useRequireAuth

### Community 32 - "Translation Modules (login/settings)"
Cohesion: 0.67
Nodes (3): translations merged table, LoginSignupTranslation table, SettingsTranslation table

### Community 33 - "Keyboard Controller Rationale"
Cohesion: 0.67
Nodes (3): react-native-keyboard-controller, KeyboardAwareScreen library choice rationale, KeyboardAwareScreen

### Community 34 - "Dark Mode & NativeWind Rationale"
Cohesion: 0.67
Nodes (3): Manual dark-mode toggle rationale, NativeWind, NativeWind wiring fix rationale

### Community 35 - "Theme Colors & Tailwind Docs"
Cohesion: 0.67
Nodes (3): src/theme/colors.ts, tailwind.config.js, useNavigationTheme

### Community 36 - "Template Suite Cross-Links"
Cohesion: 0.67
Nodes (3): _template_better-auth-backend, _template_better-auth-mobile (this app), _template_better-auth-website

## Ambiguous Edges - Review These
- `babel.config.js` → `package.json`  [AMBIGUOUS]
  babel.config.js · relation: conceptually_related_to
- `PageLayoutTranslation Module` → `SettingsTranslation Module`  [AMBIGUOUS]
  src/contexts/translation/PageLayoutTranslation.ts · relation: shares_data_with
- `ErrorBoundary` → `AppNavigator Component`  [AMBIGUOUS]
  src/error/ErrorBoundary.tsx · relation: conceptually_related_to

## Knowledge Gaps
- **270 isolated node(s):** `name`, `slug`, `scheme`, `version`, `orientation` (+265 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **36 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `babel.config.js` and `package.json`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `PageLayoutTranslation Module` and `SettingsTranslation Module`?**
  _Edge tagged AMBIGUOUS (relation: shares_data_with) - confidence is low._
- **What is the exact relationship between `ErrorBoundary` and `AppNavigator Component`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `useLanguage()` connect `Notification Hooks & PIN Modals` to `Auth Provider & Navigation Core`, `i18n Translation Modules`, `App Lock, Onboarding & Auth Screens`, `App Lock Storage & Settings Storage`, `Home Screen, Logo & ToS Acceptance`, `Signup Screen & Keyboard-Aware Layout`, `Lockout, App-Lock & Two-Factor Screens`, `Connection Error Screen & URL Scheme`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `useThemeColors()` connect `App Lock, Onboarding & Auth Screens` to `Auth Provider & Navigation Core`, `Notification Hooks & PIN Modals`, `App Lock Storage & Settings Storage`, `Signup Screen & Keyboard-Aware Layout`, `Lockout, App-Lock & Two-Factor Screens`, `Connection Error Screen & URL Scheme`, `Settings Dropdown Option`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `name`, `slug`, `scheme` to the rest of the system?**
  _285 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Auth Provider & Navigation Core` be split into smaller, more focused modules?**
  _Cohesion score 0.0641025641025641 - nodes in this community are weakly interconnected._