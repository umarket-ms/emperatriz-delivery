package expo.modules.piplocal

import android.app.Activity
import android.app.PictureInPictureParams
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import android.util.Rational
import androidx.activity.ComponentActivity
import androidx.core.app.PictureInPictureModeChangedInfo
import androidx.core.util.Consumer
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Módulo local (Android-only) que expone la API de Picture-in-Picture (PiP) a JS.
 *
 * Notas de implementación:
 * - No hace falta parchar MainActivity.kt: ReactActivity ya reenvía
 *   `onUserLeaveHint()` → ReactDelegate → ActivityEventListener →
 *   AppContext.onUserLeaveHint() → evento ON_USER_LEAVES_ACTIVITY, que este
 *   módulo escucha con `OnUserLeavesActivity`.
 * - El cambio de modo PiP se escucha con
 *   `ComponentActivity.addOnPictureInPictureModeChangedListener` (androidx.core),
 *   disponible porque ReactActivity extiende AppCompatActivity.
 */
class PipModule : Module() {
  companion object {
    private const val NAME = "ExpoPip"
    private const val TAG = "ExpoPip"
    private const val EVENT_PIP_MODE_CHANGED = "onPipModeChanged"

    // Aspecto por defecto (ancho:alto) de la ventana flotante: 2:3 vertical.
    // DEBE mantenerse dentro del rango legal de Android [1:2.39 .. 2.39:1] —
    // un aspecto fuera de ese rango hace CRASHEAR la app (documentado por
    // Google en "Set up your app for PiP"). Mantener en sincronía con
    // PIP_ASPECT_RATIO (src/index.ts) y con <layout minWidth/minHeight> del
    // manifest (ver plugin/withPictureInPicture.js), que fija la altura a 360dp
    // (3.3x de los 108dp originales medidos en el dispositivo de prueba).
    private const val DEFAULT_PIP_WIDTH = 2
    private const val DEFAULT_PIP_HEIGHT = 3
  }

  /** Guarda la intención de entrar a PiP automáticamente al pulsar Home. */
  private var autoEnterRequested: Boolean = false

  private var pipListener: Consumer<PictureInPictureModeChangedInfo>? = null
  private var registeredActivity: ComponentActivity? = null

  private val currentActivity: Activity?
    get() = appContext.currentActivity

  /** PiP existe desde Android 7.0 (API 24) y solo en dispositivos que lo soportan. */
  private val isPipSupported: Boolean
    get() = Build.VERSION.SDK_INT >= Build.VERSION_CODES.N &&
      appContext.reactContext?.packageManager
        ?.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE) == true

  override fun definition() = ModuleDefinition {
    Name(NAME)

    Events(EVENT_PIP_MODE_CHANGED)

    AsyncFunction<Boolean>("isAvailable") {
      isPipSupported
    }

    AsyncFunction<Boolean>("isInPipMode") {
      isInPipModeNow()
    }

    /**
     * Activa/desactiva la entrada automática a PiP cuando el usuario pulsa Home.
     * En Android 12+ (API 31) se delega al sistema vía `setAutoEnterEnabled`;
     * en Android 10/11 se emula en `OnUserLeavesActivity`.
     */
    AsyncFunction("setAutoEnterEnabled") { enabled: Boolean ->
      autoEnterRequested = enabled
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        applyPictureInPictureParams()
      }
    }

    /** Entra a PiP manualmente con el aspecto indicado (en píxeles lógicos). */
    AsyncFunction("enterPip") { width: Int, height: Int ->
      enterPipInternal(width, height)
    }

    OnStartObserving {
      registerPipListener()
      // Estado inicial para que JS sincronice sin round-trip extra.
      sendEvent(EVENT_PIP_MODE_CHANGED, mapOf("isInPipMode" to isInPipModeNow()))
    }

    OnStopObserving {
      unregisterPipListener()
    }

    OnActivityEntersForeground {
      // La actividad puede haberse recreado; re-registramos el listener.
      registerPipListener()
    }

    OnActivityDestroys {
      unregisterPipListener()
    }

    OnUserLeavesActivity {
      // En Android 12+ el sistema ya entró a PiP solo (autoEnterEnabled).
      // En Android 10/11 no existe esa API, así que entramos aquí a mano.
      if (autoEnterRequested &&
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.N &&
        Build.VERSION.SDK_INT < Build.VERSION_CODES.S
      ) {
        enterPipInternal(DEFAULT_PIP_WIDTH, DEFAULT_PIP_HEIGHT)
      }
    }
  }

  private fun isInPipModeNow(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
      return false
    }
    return currentActivity?.isInPictureInPictureMode == true
  }

  private fun enterPipInternal(width: Int, height: Int) {
    val activity = currentActivity ?: return
    if (!isPipSupported) {
      Log.w(TAG, "enterPip ignorado: el dispositivo no soporta PiP")
      return
    }

    activity.runOnUiThread {
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          activity.enterPictureInPictureMode(buildParams(width, height))
        } else {
          // API 24-25: solo existe la versión sin parámetros.
          @Suppress("DEPRECATION")
          activity.enterPictureInPictureMode()
        }
      } catch (e: Exception) {
        // Puede fallar si la actividad no está en foreground o ya está en PiP.
        Log.w(TAG, "enterPip falló: ${e.message}")
      }
    }
  }

  private fun applyPictureInPictureParams() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
      return
    }
    val activity = currentActivity ?: return
    activity.runOnUiThread {
      try {
        activity.setPictureInPictureParams(buildParams(DEFAULT_PIP_WIDTH, DEFAULT_PIP_HEIGHT))
      } catch (e: Exception) {
        Log.w(TAG, "setPictureInPictureParams falló: ${e.message}")
      }
    }
  }

  private fun buildParams(width: Int, height: Int): PictureInPictureParams {
    val builder = PictureInPictureParams.Builder()

    if (width > 0 && height > 0) {
      builder.setAspectRatio(Rational(width, height))
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      // Evita el flash blanco al redimensionar la ventana (clave con el WebView del mapa).
      builder.setSeamlessResizeEnabled(true)
      builder.setAutoEnterEnabled(autoEnterRequested)
    }

    return builder.build()
  }

  private fun registerPipListener() {
    val activity = currentActivity as? ComponentActivity ?: return
    if (registeredActivity === activity && pipListener != null) {
      return
    }

    unregisterPipListener()

    val listener = Consumer<PictureInPictureModeChangedInfo> { info ->
      Log.d(TAG, "onPictureInPictureModeChanged → ${info.isInPictureInPictureMode}")
      sendEvent(EVENT_PIP_MODE_CHANGED, mapOf("isInPipMode" to info.isInPictureInPictureMode))
      if (info.isInPictureInPictureMode) {
        // La activity ya está en pausa (PiP = paused) y Fabric dejó de despachar
        // frames de UI; sin esto los commits de React (ocultar paneles/tabs)
        // quedan en cola y solo se pintan al expandir la ventana.
        resumeFabricUiFrames()
      }
    }

    pipListener = listener
    registeredActivity = activity
    activity.addOnPictureInPictureModeChangedListener(listener)
    Log.d(TAG, "listener de PiP registrado en ${activity.javaClass.simpleName}")
  }

  private fun unregisterPipListener() {
    val listener = pipListener
    val activity = registeredActivity
    if (listener != null && activity != null) {
      activity.removeOnPictureInPictureModeChangedListener(listener)
    }
    pipListener = null
    registeredActivity = null
  }

  /**
   * React Native 0.76+ (Fabric) pausa el dispatch de UI cuando la activity
   * entra en pausa — y entrar a PiP pausa la activity. Resultado: los commits
   * de React (p. ej. ocultar paneles/tabs al minimizar) quedan en cola y no se
   * pintan hasta expandir la ventana (bug conocido: "State Updates Not
   * Reflected in PIP Mode with New Architecture", SO 79584231).
   *
   * Este workaround reanuda el frame callback de Fabric solo al entrar a PiP,
   * para que los commits se apliquen en vivo dentro de la ventanita. Al
   * expandir, RN llama a onHostResume → resume() (idempotente); si la app
   * sale de primer plano de verdad, onHostPause → pause() restaura el
   * comportamiento normal de ahorro de batería.
   *
   * Usa reflexión sobre un campo interno de RN: si una actualización lo
   * cambia, el catch lo deja como no-op (la app sigue funcionando, solo que
   * sin este ajuste visual en PiP).
   */
  private fun resumeFabricUiFrames() {
    try {
      val reactContext = appContext.reactContext ?: return
      // Reflexión completa: evita depender de la superficie pública exacta de
      // ReactContext en cada versión de RN.
      val uiManager = reactContext.javaClass
        .getMethod("getFabricUIManager")
        .invoke(reactContext) ?: return
      val field = Class.forName("com.facebook.react.fabric.FabricUIManager")
        .getDeclaredField("mDispatchUIFrameCallback")
      field.isAccessible = true
      val callback = field.get(uiManager) ?: return
      val resume = callback.javaClass.getDeclaredMethod("resume")
      resume.isAccessible = true
      resume.invoke(callback)
      Log.d(TAG, "frames de Fabric reanudados para PiP")
    } catch (t: Throwable) {
      Log.w(TAG, "no se pudieron reanudar los frames de Fabric: $t")
    }
  }
}
