import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './AppNavigator';

/**
 * Official "navigating without the navigation prop" pattern
 * (https://reactnavigation.org/docs/navigating-without-navigation-prop/) --
 * needed here because Navbar.tsx is rendered as a sibling of
 * RootStack.Navigator (see AppNavigator.tsx), not as one of its Screens.
 * `useNavigation()`/`useNavigationState()` only work for descendants of a
 * Navigator (the context they read is set up by <Navigator>, not by
 * NavigationContainer) -- a component outside that tree needs this
 * imperative ref instead, which works from anywhere. Type-only import of
 * RootStackParamList from AppNavigator.tsx (which itself imports this
 * module) doesn't create a runtime circular dependency.
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigate<RouteName extends keyof RootStackParamList>(
  name: RouteName,
  params?: RootStackParamList[RouteName]
) {
  if (navigationRef.isReady()) {
    // `navigate`'s overloaded signature doesn't resolve well through a
    // generic wrapper -- casting the function reference itself (not the
    // individual arguments) is the pattern react-navigation's own docs use
    // for this exact helper.
    (navigationRef.navigate as (name: RouteName, params?: RootStackParamList[RouteName]) => void)(name, params);
  }
}
