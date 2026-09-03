import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const sentryDsn = Constants.expoConfig?.extra?.SENTRY_DSN;

if (__DEV__ === false && sentryDsn) {
    Sentry.init({
        dsn: sentryDsn,
        tracesSampleRate: 0.01,
        autoSessionTracking: false,
    });
}
