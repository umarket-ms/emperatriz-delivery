const {
  withAndroidManifest,
  AndroidConfig,
  createRunOncePlugin,
} = require('expo/config-plugins');

const pkg = require('../package.json');

/**
 * Altura de la ventana PiP en dp.
 *
 * Medida en el dispositivo de prueba (Xiaomi 720×1650@2.0, MIUI): la ventana
 * 16:9 original medía 192×108dp → objetivo 3x = 324dp → se fija 360dp
 * (3.33x, con margen), que sigue dejando >55% de la pantalla visible.
 * Si en un dispositivo real el multiplicador no da 3x, este es el único
 * número a calibrar (ver log "[ExpoPip] ventana PiP" al entrar a PiP).
 */
const PIP_MIN_HEIGHT_DP = '360dp';

/**
 * Ancho mínimo en dp. Restricción: minHeight×(2/3) = 240dp — declarar un
 * ancho MENOR que eso hace que PhoneSizeSpecSource ajuste el ancho al aspecto
 * manteniendo la altura exacta (360dp → ventana final 240×360dp). Declararlo
 * mayor haría crecer la altura por encima de 360dp.
 */
const PIP_MIN_WIDTH_DP = '230dp';

/**
 * Habilita Picture-in-Picture (PiP) en la actividad principal:
 *
 * - `android:supportsPictureInPicture="true"` → requisito para poder llamar
 *   a `enterPictureInPictureMode()`.
 * - `android:resizeableActivity="true"` → en Android 12+ la actividad debe
 *   ser redimensionable para que la ventana flotante funcione.
 * - `android:screenOrientation="portrait"` → `sensorPortrait`: se mantiene la
 *   experiencia vertical (sin landscape), pero se relaja el bloqueo duro,
 *   que impide PiP en algunos dispositivos (especialmente plegables/tablets).
 * - `<layout android:minWidth android:minHeight>` → **la palanca de altura**:
 *   AOSP (PhoneSizeSpecSource.getDefaultSize) usa este tamaño declarado como
 *   tamaño POR DEFECTO de la PiP en lugar de calcularlo desde el aspecto.
 *   Sin él, la ventana nace a la altura que decida el fabricante (MIUI: 108dp;
 *   AOSP: ~220dp) y con el aspecto solo no se superan ~2.4x (límite legal
 *   1:2.39 de Android); con él nace a PIP_MIN_HEIGHT_DP.
 *   Requiere AMBOS atributos > 0 (PipBoundsAlgorithm.getMinimalSize).
 *
 * Nota: `android:minHeight` también fija el suelo en split-screen (la app no
 * se reduciría por debajo de ese alto al dividir pantalla) — efecto secundario
 * aceptado para una app de delivery que no se usa en split-screen.
 *
 * Nota: `android:configChanges` ya incluye `screenSize|smallestScreenSize|
 * screenLayout|orientation` en el proyecto, requisito para que la transición a
 * PiP no recree la actividad.
 */
const withPictureInPicture = (config) =>
  withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(manifest);

    activity.$['android:supportsPictureInPicture'] = 'true';
    activity.$['android:resizeableActivity'] = 'true';

    if (activity.$['android:screenOrientation'] === 'portrait') {
      activity.$['android:screenOrientation'] = 'sensorPortrait';
    }

    // Hijo <layout> del <activity> (ActivityInfo.WindowLayout, API 24+).
    // Idempotente: se sobreescribe completo en cada prebuild.
    activity.layout = {
      $: {
        'android:minWidth': PIP_MIN_WIDTH_DP,
        'android:minHeight': PIP_MIN_HEIGHT_DP,
      },
    };

    return config;
  });

module.exports = createRunOncePlugin(
  withPictureInPicture,
  pkg.name,
  pkg.version
);
